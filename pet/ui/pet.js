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
  addGroupMessage("user", text);
  groupDisplayMessages.push({ className: "msg user", text });
  saveGroupState();

  const gt = agentTabs["group"];
  if (gt) { gt.input.disabled = true; gt.form.querySelector("button").disabled = true; }

  const activeAgents = Object.keys(AGENTS).filter(id => !mutedAgents.has(id));

  for (const agentId of activeAgents) {
    const sessionId = await ensureSession(agentId);
    const enrichedText = buildGroupContext(text);

    const assistantDiv = addGroupMessage("assistant", "", agentId);
    let fullText = "";

    try {
      const res = await fetch(`${API}/api/chat/sessions/${sessionId}/message`, {
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
      showBubble(fullText);
    }
  }

  groupHistory.push({ sender: "USER", body: text });
  while (groupHistory.length > MAX_GROUP_HISTORY) groupHistory.shift();
  saveGroupState();

  if (gt) { gt.input.disabled = false; gt.form.querySelector("button").disabled = false; gt.input.focus(); }
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
  const res = await fetch(`${API}/api/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, sessionKey }),
  });
  const data = await res.json();
  agent.session = data.sessionId;
  if (data.resumed) await loadHistory(agentId);
  return agent.session;
}

async function loadHistory(agentId) {
  const agent = AGENTS[agentId];
  if (!agent.session) return;
  try {
    const res = await fetch(`${API}/api/chat/sessions/${agent.session}/messages`);
    const data = await res.json();
    if (!data.messages?.length) return;
    const t = agentTabs[agentId];
    if (t) t.messages.innerHTML = "";
    for (const msg of data.messages) {
      if (msg.role === "user") {
        addMessage("user", msg.content, agentId);
      } else if (msg.role === "assistant" && msg.content) {
        addMessage("assistant", msg.content, agentId);
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

async function sendMessage(agentId, text) {
  const sessionId = await ensureSession(agentId);
  addMessage("user", text, agentId);

  const t = agentTabs[agentId];
  if (t) { t.input.disabled = true; t.form.querySelector("button").disabled = true; }

  const assistantDiv = addMessage("assistant", "", agentId);
  let fullText = "";

  try {
    const res = await fetch(`${API}/api/chat/sessions/${sessionId}/message`, {
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

  if (fullText) showBubble(fullText);
  if (t) { t.input.disabled = false; t.form.querySelector("button").disabled = false; t.input.focus(); }
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
      }
      break;
    case "tool_result":
    case "agent_end":
      break;
    case "error":
      assistantDiv.textContent += ` [${data.message}]`;
      break;
  }
}

function showBubble(text) {
  const short = text.length > 50 ? text.slice(0, 47) + "..." : text;
  bubble.textContent = short;
  bubble.classList.remove("hidden");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 4000);
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
  Object.entries(AGENTS).forEach(([id, a]) => {
    if (a.session) fetch(`${API}/api/chat/sessions/${a.session}`, { method: "DELETE" }).catch(() => {});
    a.session = null;
  });
  Object.values(agentTabs).forEach(t => t.messages.innerHTML = "");
  groupHistory.length = 0;
  groupDisplayMessages.length = 0;
  try { localStorage.removeItem(GROUP_STORAGE_KEY); } catch (_) {}
  Object.keys(AGENTS).forEach(id => setAgentGif(id, "idel"));
  showBubble("SYS RESET OK");
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
    });
  });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function hitsBuilding(px, py) {
  for (const b of buildingBoxes) {
    if (rectsOverlap(px, py, PET_W, PET_H, b.x, b.y, b.w, b.h)) return true;
  }
  return false;
}

Object.keys(AGENTS).forEach(id => {
  roamState[id] = { x: 0, y: 0, targetX: 0, targetY: 0, paused: false, hovered: false, initialized: false };
});

function initRoamPositions() {
  const container = document.getElementById("agents-row");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const ids = Object.keys(AGENTS);
  ids.forEach((id, i) => {
    const s = roamState[id];
    if (!s.initialized) {
      s.x = (w / (ids.length + 1)) * (i + 1) - PET_W / 2;
      s.y = h / 2 - PET_H / 2 + (Math.random() - 0.5) * 60;
      s.targetX = s.x;
      s.targetY = s.y;
      s.initialized = true;
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
    if (!hitsBuilding(tx, ty)) {
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
  const collisionDist = 100;
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
        applyPosition(ids[i]);
        applyPosition(ids[j]);
        pickNewTarget(ids[i]);
        pickNewTarget(ids[j]);
      }
    }
  }
}

function roamTick() {
  Object.keys(AGENTS).forEach(id => {
    const s = roamState[id];
    if (s.paused || s.hovered) return;

    const dx = s.targetX - s.x;
    const dy = s.targetY - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // Arrived — idle a bit then pick new target
      s.paused = true;
      setAgentGif(id, "idel");
      const el = getSlotElements(id);
      if (el) el.slot.classList.remove("walking");
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
      s.paused = true;
      setAgentGif(id, "idel");
      const el = getSlotElements(id);
      if (el) el.slot.classList.remove("walking");
      setTimeout(() => {
        s.paused = false;
        pickNewTarget(id);
      }, 500 + Math.random() * 1000);
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
showBubble("CLICK A BANGBOO!");

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
