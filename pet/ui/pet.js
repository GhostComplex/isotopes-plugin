// plugins/pet/ui/pet.js — Multi-agent GIF pet system

const API = window.location.origin;
const bubble = document.getElementById("speech-bubble");
const clearBtn = document.getElementById("clear-btn");
const chatToggle = document.getElementById("chat-toggle");
const contentGrid = document.getElementById("content-grid");

let bubbleTimer = null;

// ======== Agent definitions ========

const AGENTS = {
  eous:     { name: "EOUS",     prefix: "eous",     session: null },
  amillion: { name: "AMILLION", prefix: "amillion", session: null },
  penguin:  { name: "PENGUIN",  prefix: "enguin",   session: null },
};

function gifUrl(agentId, state) {
  const prefix = AGENTS[agentId].prefix;
  return `/ui/pet/gif/${prefix}-${state}.gif`;
}

let selectedAgent = "eous";

// ======== Chat tab elements ========

const agentTabs = {};
document.querySelectorAll(".chat-tab").forEach(tab => {
  const id = tab.dataset.agent;
  agentTabs[id] = {
    tab,
    label: tab.querySelector(".chat-tab-label"),
    messages: tab.querySelector(".chat-tab-messages"),
    form: tab.querySelector(".chat-tab-form"),
    input: tab.querySelector(".chat-tab-input"),
  };
});

// Tab click: expand that agent's chat
Object.entries(agentTabs).forEach(([id, t]) => {
  t.label.addEventListener("click", () => {
    openChatTab(id);
  });
  t.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = t.input.value.trim();
    if (!text) return;
    t.input.value = "";
    if (id === "group") {
      sendGroupMessage(text);
    } else {
      sendMessage(id, text);
    }
  });
});

// ======== Group chat ========

const GROUP_STORAGE_KEY = "pet:groupChat";
const MAX_GROUP_HISTORY = 20;
const mutedAgents = new Set();

let groupHistory = [];
let groupDisplayMessages = [];

function saveGroupState() {
  try {
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify({
      history: groupHistory,
      display: groupDisplayMessages,
    }));
  } catch (_) {}
}

function loadGroupState() {
  try {
    const raw = localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    groupHistory = data.history || [];
    groupDisplayMessages = data.display || [];
    const gt = agentTabs["group"];
    if (gt) {
      gt.messages.innerHTML = "";
      for (const item of groupDisplayMessages) {
        const div = document.createElement("div");
        div.className = item.className;
        div.textContent = item.text;
        gt.messages.appendChild(div);
      }
      gt.messages.scrollTop = gt.messages.scrollHeight;
    }
  } catch (_) {}
}

document.querySelectorAll(".mute-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const aid = btn.dataset.agent;
    btn.classList.toggle("muted");
    if (mutedAgents.has(aid)) {
      mutedAgents.delete(aid);
    } else {
      mutedAgents.add(aid);
    }
  });
});

function buildGroupContext(userMessage) {
  if (groupHistory.length === 0) return userMessage;
  const lines = groupHistory.map(e => `${e.sender}: ${e.body}`);
  return `[Chat messages since your last reply - for context]\n${lines.join("\n")}\n\n[Current message - respond to this]\n${userMessage}`;
}

function addGroupMessage(role, text, fromAgentId) {
  const gt = agentTabs["group"];
  if (!gt) return null;
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (fromAgentId && role === "assistant") {
    div.classList.add(`msg-${fromAgentId}`);
    div.textContent = `[${AGENTS[fromAgentId].name}] ${text}`;
  } else {
    div.textContent = text;
  }
  gt.messages.appendChild(div);
  gt.messages.scrollTop = gt.messages.scrollHeight;
  return div;
}

async function sendGroupMessage(text) {
  abortChain = false;
  addGroupMessage("user", text);
  groupDisplayMessages.push({ className: "msg user", text });
  saveGroupState();

  const gt = agentTabs["group"];
  if (gt) { gt.input.disabled = true; gt.form.querySelector("button").disabled = true; }

  // Only send to @mentioned agents; if none mentioned, send to all unmuted
  let targetAgents = extractMentions(text, null).filter(id => !mutedAgents.has(id));
  if (targetAgents.length === 0) {
    targetAgents = Object.keys(AGENTS).filter(id => !mutedAgents.has(id));
  }

  await processGroupAgents(targetAgents, text, gt);

  groupHistory.push({ sender: "USER", body: text });
  while (groupHistory.length > MAX_GROUP_HISTORY) groupHistory.shift();
  saveGroupState();

  updateAllCtxBars();
  if (gt) { gt.input.disabled = false; gt.form.querySelector("button").disabled = false; gt.input.focus(); }
}

async function processGroupAgents(agentIds, triggerText, gt, depth = 0) {
  if (depth > MAX_MENTION_DEPTH || abortChain) return;

  for (const agentId of agentIds) {
    if (abortChain) return;
    const sessionId = await ensureSession(agentId);
    setAgentStatus(agentId, "CHAT");
    const enrichedText = buildGroupContext(triggerText);

    const assistantDiv = addGroupMessage("assistant", "", agentId);
    let fullText = "";

    try {
      const res = await fetch(`${API}/api/sessions/${agentId}/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: enrichedText }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop();

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            const data = JSON.parse(line.slice(6));
            if (eventType === "text_delta") {
              assistantDiv.textContent = `[${AGENTS[agentId].name}] ${(assistantDiv._rawText || "") + data.text}`;
              assistantDiv._rawText = (assistantDiv._rawText || "") + data.text;
              if (gt) gt.messages.scrollTop = gt.messages.scrollHeight;
            } else if (eventType === "tool_call") {
              if (data.toolName === "pet_action") {
                playAction(agentId, data.args?.action || "bounce");
              } else if (!PET_TOOLS.has(data.toolName)) {
                const tcDiv = addToolCallMessage(agentId, data.toolName, data.args);
                if (data.toolCallId) pendingToolCalls[data.toolCallId] = tcDiv;
              }
            } else if (eventType === "tool_result") {
              const pending = data.toolCallId && pendingToolCalls[data.toolCallId];
              if (pending) {
                updateToolResult(pending, data.toolName, data.result, data.isError);
                delete pendingToolCalls[data.toolCallId];
              } else if (!PET_TOOLS.has(data.toolName)) {
                const tcDiv = addToolCallMessage(agentId, data.toolName, {});
                updateToolResult(tcDiv, data.toolName, data.result, data.isError);
              }
            }
            if (eventType === "text_delta") fullText = assistantDiv._rawText;
            eventType = null;
          } else if (line === "") {
            eventType = null;
          }
        }
      }
    } catch (err) {
      assistantDiv.textContent += " [ERR]";
    }

    if (fullText) {
      groupHistory.push({ sender: AGENTS[agentId].name, body: fullText });
      while (groupHistory.length > MAX_GROUP_HISTORY) groupHistory.shift();
      groupDisplayMessages.push({ className: `msg assistant msg-${agentId}`, text: assistantDiv.textContent });
      saveGroupState();
      showBubble(fullText, agentId, "ai");

      const chainMentions = extractMentions(fullText, agentId).filter(id => !mutedAgents.has(id));
      if (chainMentions.length > 0) {
        await processGroupAgents(chainMentions, fullText, gt, depth + 1);
      }
    }
    setAgentStatus(agentId, "IDLE");
  }
}

function openChatTab(tabId) {
  selectedAgent = tabId === "group" ? "eous" : tabId;
  Object.entries(agentTabs).forEach(([id, t]) => {
    t.tab.classList.toggle("active", id === tabId);
  });
  document.querySelectorAll(".agent-slot").forEach(s => s.classList.remove("selected"));
  if (tabId !== "group") {
    const el = getSlotElements(tabId);
    if (el) el.slot.classList.add("selected");
  }
}

// ======== Animation system ========

const POKE_REACTIONS = [
  { gif: "touch", anim: "anim-squish" },
  { gif: "jump",  anim: "anim-jump" },
  { gif: "touch", anim: "anim-shake" },
  { gif: "jump",  anim: "anim-bounce" },
  { gif: "touch", anim: "anim-spin" },
];

const ACTION_ANIMS = {
  jump:   { gif: "jump",  anim: "anim-jump" },
  spin:   { gif: "touch", anim: "anim-spin" },
  shake:  { gif: "touch", anim: "anim-shake" },
  wave:   { gif: "idel",  anim: "anim-wave" },
  dance:  { gif: "jump",  anim: "anim-dance" },
  bounce: { gif: "jump",  anim: "anim-bounce" },
  nod:    { gif: "idel",  anim: "anim-nod" },
  sleep:  { gif: "idel",  anim: null },
  poke:   null,
};

function getSlotElements(agentId) {
  const slot = document.querySelector(`.agent-slot[data-agent="${agentId}"]`);
  if (!slot) return null;
  return {
    slot,
    pet: slot.querySelector(".agent-pet"),
    gif: slot.querySelector(".agent-gif"),
  };
}

function setAgentGif(agentId, state) {
  const el = getSlotElements(agentId);
  if (!el) return;
  el.gif.src = "";
  el.gif.src = gifUrl(agentId, state);
}

function playAgentAnim(agentId, cssClass, gifState, duration) {
  const el = getSlotElements(agentId);
  if (!el) return;
  if (gifState) setAgentGif(agentId, gifState);
  el.pet.className = "agent-pet";
  void el.pet.offsetWidth;
  if (cssClass) el.pet.classList.add(cssClass);
  setTimeout(() => {
    el.pet.classList.remove(cssClass);
    setAgentGif(agentId, "idel");
  }, duration || 1200);
}

function pokeAgent(agentId) {
  const pick = POKE_REACTIONS[Math.floor(Math.random() * POKE_REACTIONS.length)];
  playAgentAnim(agentId, pick.anim, pick.gif, 1000);
}

function playAction(agentId, action) {
  if (action === "poke") { pokeAgent(agentId); return; }
  const def = ACTION_ANIMS[action];
  if (def) playAgentAnim(agentId, def.anim, def.gif, 1200);
}

// ======== Session & Chat ========

async function ensureSession(agentId) {
  const agent = AGENTS[agentId];
  if (agent.session) return agent.session;
  const sessionKey = `pet:${agentId}`;
  try {
    const res = await fetch(`${API}/api/sessions/${agentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    const data = await res.json();
    agent.session = data.key;
    if (data.resumed) await loadHistory(agentId);
    updateCtxBar(agentId);
  } catch (_) {}
  return agent.session;
}

async function loadHistory(agentId) {
  const agent = AGENTS[agentId];
  if (!agent.session) return;
  try {
    const res = await fetch(`${API}/api/sessions/${agentId}/${agent.session}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.messages?.length) return;
    const t = agentTabs[agentId];
    if (t) t.messages.innerHTML = "";
    const historyToolDivs = {};
    for (const msg of data.messages) {
      const content = msg.content;
      if (msg.role === "user") {
        const text = typeof content === "string" ? content
          : Array.isArray(content) ? content.filter(b => b.type === "text").map(b => b.text).join("") : "";
        if (text) addMessage("user", text, agentId);
      } else if (msg.role === "assistant") {
        if (!Array.isArray(content)) {
          if (content) addMessage("assistant", String(content), agentId);
          continue;
        }
        let text = "";
        for (const block of content) {
          if (block.type === "text") {
            text += block.text;
          } else if (block.type === "tool_use" || block.type === "toolCall") {
            const toolName = block.name;
            const toolArgs = block.input || block.arguments || {};
            const toolId = block.id;
            if (PET_TOOLS.has(toolName)) {
              const label = toolName === "set_pet_mood" ? `MOOD → ${(toolArgs?.mood || "").toUpperCase()}`
                : `ACT → ${(toolArgs?.action || "").toUpperCase()}`;
              addMessage("tool", `♦ ${AGENTS[agentId].name} ${label}`, agentId);
            } else {
              const div = addToolCallMessage(agentId, toolName, toolArgs);
              if (toolId) historyToolDivs[toolId] = div;
            }
          }
        }
        if (text) addMessage("assistant", text, agentId);
      } else if (msg.role === "toolResult") {
        const div = msg.toolCallId && historyToolDivs[msg.toolCallId];
        const resultText = Array.isArray(msg.content) ? msg.content.filter(b => b.type === "text").map(b => b.text).join("") : String(msg.content || "");
        if (div) {
          updateToolResult(div, msg.toolName, resultText, msg.isError);
          delete historyToolDivs[msg.toolCallId];
        }
      }
    }
  } catch (_) {}
}

function addMessage(role, text, agentId) {
  const t = agentTabs[agentId];
  if (!t) return null;
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  t.messages.appendChild(div);
  t.messages.scrollTop = t.messages.scrollHeight;
  return div;
}

const PET_TOOLS = new Set(["set_pet_mood", "pet_action"]);
const pendingToolCalls = {};

function addToolCallMessage(agentId, toolName, args) {
  const t = agentTabs[agentId];
  if (!t) return null;
  const div = document.createElement("div");
  div.className = "msg tool tool-collapsible";

  const header = document.createElement("div");
  header.className = "tool-header";
  const argsShort = Object.entries(args || {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
  header.textContent = `▶ ${toolName}(${argsShort})`;

  const detail = document.createElement("div");
  detail.className = "tool-detail";
  detail.textContent = "running...";

  header.addEventListener("click", () => {
    div.classList.toggle("expanded");
    header.textContent = header.textContent.replace(/^[▶▼]/, div.classList.contains("expanded") ? "▼" : "▶");
  });

  div.appendChild(header);
  div.appendChild(detail);
  t.messages.appendChild(div);
  t.messages.scrollTop = t.messages.scrollHeight;
  return div;
}

function updateToolResult(div, toolName, result, isError) {
  if (!div) return;
  const detail = div.querySelector(".tool-detail");
  if (!detail) return;
  const label = isError ? "ERR" : "OK";
  const text = (typeof result === "object" && result !== null) ? JSON.stringify(result, null, 2) : (result || "(empty)");
  detail.textContent = `[${label}] ${text}`;
  if (isError) div.classList.add("tool-error");
}

async function sendMessage(agentId, text) {
  abortChain = false;
  const sessionId = await ensureSession(agentId);
  addMessage("user", text, agentId);

  const t = agentTabs[agentId];
  if (t) { t.input.disabled = true; t.form.querySelector("button").disabled = true; }

  setAgentStatus(agentId, "CHAT");
  const assistantDiv = addMessage("assistant", "", agentId);
  let fullText = "";

  try {
    const res = await fetch(`${API}/api/sessions/${agentId}/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          const data = JSON.parse(line.slice(6));
          handleSSE(agentId, eventType, data, assistantDiv);
          fullText = assistantDiv.textContent;
          eventType = null;
        } else if (line === "") {
          eventType = null;
        }
      }
    }
  } catch (err) {
    assistantDiv.textContent += " [ERR]";
  }

  if (fullText) showBubble(fullText, agentId, "ai");
  setAgentStatus(agentId, "IDLE");
  updateCtxBar(agentId);
  if (t) { t.input.disabled = false; t.form.querySelector("button").disabled = false; t.input.focus(); }

  if (fullText) {
    const mentions = extractMentions(fullText, agentId);
    console.log(`[mention] ${agentId} said:`, fullText.slice(0, 100), "→ mentions:", mentions);
    for (const targetId of mentions) {
      await sendCrossAgentMessage(agentId, targetId, fullText, 1);
    }
  }
}

function handleSSE(agentId, event, data, assistantDiv) {
  const t = agentTabs[agentId];
  switch (event) {
    case "text_delta":
      assistantDiv.textContent += data.text;
      if (t) t.messages.scrollTop = t.messages.scrollHeight;
      break;
    case "tool_call":
      if (data.toolName === "set_pet_mood") {
        addMessage("tool", `♦ ${AGENTS[agentId].name} MOOD → ${(data.args?.mood || "").toUpperCase()}`, agentId);
      } else if (data.toolName === "pet_action") {
        playAction(agentId, data.args?.action || "bounce");
        addMessage("tool", `♦ ${AGENTS[agentId].name} ACT → ${(data.args?.action || "").toUpperCase()}`, agentId);
      } else {
        const div = addToolCallMessage(agentId, data.toolName, data.args);
        if (data.toolCallId) pendingToolCalls[data.toolCallId] = div;
      }
      break;
    case "tool_result": {
      const pending = data.toolCallId && pendingToolCalls[data.toolCallId];
      if (pending) {
        updateToolResult(pending, data.toolName, data.result, data.isError);
        delete pendingToolCalls[data.toolCallId];
      } else if (PET_TOOLS.has(data.toolName)) {
        if (data.result) {
          const label = data.isError ? "ERR" : "OK";
          addMessage("tool", `♦ ${AGENTS[agentId].name} ${data.toolName} → [${label}] ${data.result}`, agentId);
        }
      } else {
        const div = addToolCallMessage(agentId, data.toolName, {});
        updateToolResult(div, data.toolName, data.result, data.isError);
      }
      break;
    }
    case "agent_end":
      break;
    case "error":
      assistantDiv.textContent += ` [${data.message}]`;
      break;
  }
}

// ======== Cross-agent @mention ========

const MENTION_RE = /@(eous|amillion|penguin)/gi;
const MAX_MENTION_DEPTH = 10;
let abortChain = false;

function extractMentions(text, excludeId) {
  const mentions = new Set();
  let m;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const id = m[1].toLowerCase();
    if (id !== excludeId && AGENTS[id]) mentions.add(id);
  }
  MENTION_RE.lastIndex = 0;
  return [...mentions];
}

async function sendCrossAgentMessage(fromId, toId, text, depth) {
  if (depth > MAX_MENTION_DEPTH || abortChain) return;

  const sessionId = await ensureSession(toId);
  const fromName = AGENTS[fromId].name;
  const toName = AGENTS[toId].name;

  addMessage("cross", `[${fromName} → ${toName}] ${text.length > 80 ? text.slice(0, 77) + "..." : text}`, toId);

  setAgentStatus(toId, "CHAT");
  const assistantDiv = addMessage("assistant", "", toId);
  let fullText = "";

  try {
    const prompt = `[Message from ${fromName} to you]\n${text}`;
    const res = await fetch(`${API}/api/sessions/${toId}/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      let eventType = null;
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          const data = JSON.parse(line.slice(6));
          handleSSE(toId, eventType, data, assistantDiv);
          fullText = assistantDiv.textContent;
          eventType = null;
        } else if (line === "") {
          eventType = null;
        }
      }
    }
  } catch (err) {
    assistantDiv.textContent += " [ERR]";
  }

  if (fullText) showBubble(fullText, toId, "ai");
  setAgentStatus(toId, "IDLE");
  updateCtxBar(toId);

  const chainMentions = extractMentions(fullText, toId);
  for (const nextId of chainMentions) {
    await sendCrossAgentMessage(toId, nextId, fullText, depth + 1);
  }
}

let bubbleAgent = null;

function showBubble(text, agentId, type = "random") {
  const maxLen = type === "ai" ? 25 : 30;
  const short = text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
  bubble.textContent = short;
  bubble.classList.remove("hidden", "bubble-ai", "bubble-random");
  bubble.classList.add(type === "ai" ? "bubble-ai" : "bubble-random");
  bubbleAgent = agentId || null;
  positionBubble();
  clearTimeout(bubbleTimer);
  const duration = type === "ai" ? 6000 : 3000;
  bubbleTimer = setTimeout(() => { bubble.classList.add("hidden"); bubbleAgent = null; }, duration);
}

function positionBubble() {
  if (!bubbleAgent || bubble.classList.contains("hidden")) return;
  const el = getSlotElements(bubbleAgent);
  if (!el) return;
  const slotRect = el.slot.getBoundingClientRect();
  const bw = bubble.offsetWidth;
  bubble.style.left = (slotRect.left + slotRect.width / 2 - bw / 2) + "px";
  bubble.style.top = (slotRect.top - bubble.offsetHeight - 4) + "px";
}

// ======== Context window bar ========

const MAX_CTX_MESSAGES = 40;

async function updateCtxBar(agentId) {
  const agent = AGENTS[agentId];
  if (!agent.session) return;
  try {
    const res = await fetch(`${API}/api/sessions/${agentId}/${agent.session}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    const count = data.messages?.length || 0;
    const used = Math.min(100, (count / MAX_CTX_MESSAGES) * 100);
    const remaining = 100 - used;

    // Update pet shadow bar
    const slot = document.querySelector(`.agent-slot[data-agent="${agentId}"]`);
    if (slot) {
      const shadow = slot.querySelector(".agent-shadow");
      const fill = slot.querySelector(".ctx-fill");
      if (fill) fill.style.width = remaining + "%";
      if (shadow) shadow.classList.toggle("ctx-warn", remaining < 30);
    }

    // Update left panel card
    const card = document.querySelector(`.agent-card[data-agent="${agentId}"]`);
    if (card) {
      const ctxBar = card.querySelector(".agent-ctx-bar");
      if (ctxBar) ctxBar.style.width = remaining + "%";
      const msgCount = card.querySelector(".agent-msg-count");
      if (msgCount) msgCount.textContent = count;
      const sesId = card.querySelector(".agent-session-id");
      if (sesId) sesId.textContent = agent.session.slice(0, 8);
    }
  } catch (_) {}
}

function updateAllCtxBars() {
  Object.keys(AGENTS).forEach(id => updateCtxBar(id));
}

function setAgentStatus(agentId, status) {
  const el = document.getElementById(`status-${agentId}`);
  if (!el) return;
  el.textContent = status;
  el.classList.toggle("active", status !== "IDLE");
}

// ======== Event listeners ========

document.querySelectorAll(".agent-slot").forEach(slot => {
  slot.addEventListener("click", () => {
    const agentId = slot.dataset.agent;
    openChatTab(agentId);
    pokeAgent(agentId);
    sendMessage(agentId, "*用户戳了你一下*");
  });
});

clearBtn.addEventListener("click", () => {
  abortChain = true;
  Object.entries(AGENTS).forEach(([id, a]) => {
    if (a.session) fetch(`${API}/api/sessions/${id}/${a.session}`, { method: "DELETE" }).catch(() => {});
    a.session = null;
  });
  Object.values(agentTabs).forEach(t => t.messages.innerHTML = "");
  groupHistory.length = 0;
  groupDisplayMessages.length = 0;
  try { localStorage.removeItem(GROUP_STORAGE_KEY); } catch (_) {}
  Object.keys(AGENTS).forEach(id => setAgentGif(id, "idel"));
  showBubble("SYS RESET OK", selectedAgent);
  Object.keys(AGENTS).forEach(id => ensureSession(id));
});

chatToggle.addEventListener("click", () => {
  contentGrid.classList.toggle("chat-hidden");
  chatToggle.classList.toggle("active", !contentGrid.classList.contains("chat-hidden"));
});
chatToggle.classList.add("active");

// ======== Roaming system ========

const roamState = {};
const ROAM_SPEED = 0.6; // px per frame
const PET_W = 220;
const PET_H = 260;

let buildingBoxes = [];

const BUILDING_MESSAGES = {
  "bldg-arcade": ["开始搬砖 💼", "又要加班了...", "今天OKR写了吗？", "Teams又卡了", "Copilot帮我写吧"],
  "bldg-ramen": ["买瓶水 🥤", "有没有零食？", "便利店真方便", "买个饭团吧"],
  "bldg-coffee": ["来杯咖啡 ☕", "困了...", "今天第几杯了？", "美式还是拿铁？"],
  "bldg-chinese": ["好饿啊 🍜", "今天吃什么？", "食堂排队好长", "干饭！"],
  "bldg-tech": ["练练腿 💪", "该运动了", "摸鱼去健身", "跑步机走起"],
};

function getBuildingName(bldg) {
  for (const cls of bldg.classList) {
    if (cls.startsWith("bldg-")) return cls;
  }
  return null;
}

function updateBuildingBoxes() {
  const container = document.getElementById("agents-row");
  if (!container) return;
  const cr = container.getBoundingClientRect();
  buildingBoxes = [];
  document.querySelectorAll(".px-bldg").forEach(bldg => {
    const br = bldg.getBoundingClientRect();
    buildingBoxes.push({
      x: br.left - cr.left,
      y: br.top - cr.top,
      w: br.width,
      h: br.height,
      name: getBuildingName(bldg),
    });
  });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const BUILDING_PAD = 8;
function hitsBuilding(px, py) {
  for (const b of buildingBoxes) {
    if (rectsOverlap(
      px, py, PET_W, PET_H,
      b.x - BUILDING_PAD, b.y - BUILDING_PAD,
      b.w + BUILDING_PAD * 2, b.h + BUILDING_PAD * 2
    )) return true;
  }
  return false;
}

function pathClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(8, PET_W / 2);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (hitsBuilding(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function nearbyBuilding(px, py) {
  const pad = 30;
  for (const b of buildingBoxes) {
    if (rectsOverlap(px - pad, py - pad, PET_W + pad * 2, PET_H + pad * 2, b.x, b.y, b.w, b.h)) return b.name;
  }
  return null;
}

Object.keys(AGENTS).forEach(id => {
  roamState[id] = { x: 0, y: 0, targetX: 0, targetY: 0, paused: false, hovered: false, initialized: false };
});

function findSafePosition(w, h) {
  const margin = 20;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = margin + Math.random() * (w - PET_W - margin * 2);
    const y = margin + Math.random() * (h - PET_H - margin * 2);
    if (!hitsBuilding(x, y)) return { x, y };
  }
  return { x: w / 2 - PET_W / 2, y: h / 2 - PET_H / 2 };
}

function findPositionNearBuilding(bldgName, w, h) {
  const b = buildingBoxes.find(box => box.name === bldgName);
  if (!b) return findSafePosition(w, h);
  const pad = 40;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = b.x + b.w / 2 - PET_W / 2 + (Math.random() - 0.5) * (b.w + pad * 2);
    const y = b.y + b.h + pad * 0.5 + Math.random() * pad;
    if (x >= 0 && y >= 0 && x <= w - PET_W && y <= h - PET_H && !hitsBuilding(x, y)) return { x, y };
  }
  return findSafePosition(w, h);
}

function initRoamPositions() {
  const container = document.getElementById("agents-row");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  updateBuildingBoxes();
  const ids = Object.keys(AGENTS);
  const msAgent = ids[Math.floor(Math.random() * ids.length)];
  ids.forEach((id) => {
    const s = roamState[id];
    if (!s.initialized) {
      const pos = id === msAgent ? findPositionNearBuilding("bldg-arcade", w, h) : findSafePosition(w, h);
      s.x = pos.x;
      s.y = pos.y;
      s.targetX = s.x;
      s.targetY = s.y;
      s.initialized = true;
      if (id === msAgent) {
        setTimeout(() => {
          const msgs = BUILDING_MESSAGES["bldg-arcade"];
          showBubble(msgs[Math.floor(Math.random() * msgs.length)], id);
        }, 500);
      }
    }
    applyPosition(id);
  });
}

function pickNewTarget(agentId) {
  const container = document.getElementById("agents-row");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const margin = 20;
  const s = roamState[agentId];
  for (let attempt = 0; attempt < 20; attempt++) {
    const tx = margin + Math.random() * (rect.width - PET_W - margin * 2);
    const ty = margin + Math.random() * (rect.height - PET_H - margin * 2);
    if (!hitsBuilding(tx, ty) && pathClear(s.x, s.y, tx, ty)) {
      s.targetX = tx;
      s.targetY = ty;
      return;
    }
  }
  s.targetX = margin + Math.random() * (rect.width - PET_W - margin * 2);
  s.targetY = margin + Math.random() * (rect.height - PET_H - margin * 2);
}

function applyPosition(agentId) {
  const el = getSlotElements(agentId);
  if (!el) return;
  const s = roamState[agentId];
  el.slot.style.left = s.x + "px";
  el.slot.style.top = s.y + "px";
}

function checkCollisions() {
  const ids = Object.keys(AGENTS);
  const collisionDist = 200;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = roamState[ids[i]];
      const b = roamState[ids[j]];
      const cx = (a.x + PET_W / 2) - (b.x + PET_W / 2);
      const cy = (a.y + PET_H / 2) - (b.y + PET_H / 2);
      const dist = Math.sqrt(cx * cx + cy * cy);
      if (dist < collisionDist && dist > 0) {
        const push = (collisionDist - dist) / 2 + 5;
        const nx = cx / dist;
        const ny = cy / dist;
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;
        const container = document.getElementById("agents-row");
        if (container) {
          const rect = container.getBoundingClientRect();
          [a, b].forEach(s => {
            s.x = Math.max(0, Math.min(s.x, rect.width - PET_W));
            s.y = Math.max(0, Math.min(s.y, rect.height - PET_H));
          });
        }
        applyPosition(ids[i]);
        applyPosition(ids[j]);
        pickNewTarget(ids[i]);
        pickNewTarget(ids[j]);
      }
    }
  }
}

function roamTick() {
  const container = document.getElementById("agents-row");
  const cw = container ? container.getBoundingClientRect().width : 800;
  const ch = container ? container.getBoundingClientRect().height : 600;

  Object.keys(AGENTS).forEach(id => {
    const s = roamState[id];
    if (s.paused || s.hovered) return;

    // Escape if stuck inside a building
    if (hitsBuilding(s.x, s.y)) {
      const pos = findSafePosition(cw, ch);
      s.x = pos.x;
      s.y = pos.y;
      applyPosition(id);
      pickNewTarget(id);
      return;
    }

    const dx = s.targetX - s.x;
    const dy = s.targetY - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      s.paused = true;
      setAgentGif(id, "idel");
      const el = getSlotElements(id);
      if (el) el.slot.classList.remove("walking");

      const bldg = nearbyBuilding(s.x, s.y);
      if (bldg && BUILDING_MESSAGES[bldg] && Math.random() < 0.8) {
        const msgs = BUILDING_MESSAGES[bldg];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        showBubble(msg, id);
      }

      setTimeout(() => {
        s.paused = false;
        pickNewTarget(id);
      }, 2000 + Math.random() * 4000);
      return;
    }

    const vx = (dx / dist) * ROAM_SPEED;
    const vy = (dy / dist) * ROAM_SPEED;
    const nx = s.x + vx;
    const ny = s.y + vy;

    if (hitsBuilding(nx, ny)) {
      const blockX = hitsBuilding(nx, s.y);
      const blockY = hitsBuilding(s.x, ny);
      if (blockX && blockY) {
        pickNewTarget(id);
        return;
      }
      s.x = blockX ? s.x : nx;
      s.y = blockY ? s.y : ny;
      applyPosition(id);
      return;
    }

    s.x = nx;
    s.y = ny;
    applyPosition(id);

    // Flip based on direction
    const el = getSlotElements(id);
    if (el) {
      el.gif.style.transform = vx < 0 ? "scaleX(-1)" : "scaleX(1)";
      if (!el.slot.classList.contains("walking")) {
        el.slot.classList.add("walking");
        setAgentGif(id, "jump");
      }
    }
  });
  checkCollisions();
  positionBubble();
  requestAnimationFrame(roamTick);
}

// Hover pause
document.querySelectorAll(".agent-slot").forEach(slot => {
  const agentId = slot.dataset.agent;
  slot.addEventListener("mouseenter", () => {
    roamState[agentId].hovered = true;
    setAgentGif(agentId, "idel");
    slot.classList.remove("walking");
  });
  slot.addEventListener("mouseleave", () => {
    roamState[agentId].hovered = false;
  });
});

// ======== Init ========

openChatTab("group");
showBubble("CLICK A BANGBOO!", "eous");

// Restore group chat from localStorage
loadGroupState();

// Preload sessions to restore chat history
Object.keys(AGENTS).forEach(id => ensureSession(id));

initRoamPositions();
updateBuildingBoxes();
Object.keys(AGENTS).forEach(id => {
  setTimeout(() => pickNewTarget(id), 1000 + Math.random() * 2000);
});
requestAnimationFrame(roamTick);

window.addEventListener("resize", () => {
  updateBuildingBoxes();
  const container = document.getElementById("agents-row");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  Object.keys(AGENTS).forEach(id => {
    const s = roamState[id];
    s.x = Math.min(s.x, rect.width - PET_W - 10);
    s.y = Math.min(s.y, rect.height - PET_H - 10);
    s.x = Math.max(10, s.x);
    s.y = Math.max(10, s.y);
    applyPosition(id);
    pickNewTarget(id);
  });
});
