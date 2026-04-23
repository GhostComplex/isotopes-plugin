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
    sendMessage(id, text);
  });
});

function openChatTab(agentId) {
  selectedAgent = agentId;
  Object.entries(agentTabs).forEach(([id, t]) => {
    t.tab.classList.toggle("active", id === agentId);
  });
  // Also highlight pet
  document.querySelectorAll(".agent-slot").forEach(s => s.classList.remove("selected"));
  const el = getSlotElements(agentId);
  if (el) el.slot.classList.add("selected");
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
  const res = await fetch(`${API}/api/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  const data = await res.json();
  agent.session = data.sessionId;
  return agent.session;
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
  Object.values(AGENTS).forEach(a => a.session = null);
  Object.values(agentTabs).forEach(t => t.messages.innerHTML = "");
  Object.keys(AGENTS).forEach(id => setAgentGif(id, "idel"));
  showBubble("SYS RESET OK");
});

chatToggle.addEventListener("click", () => {
  contentGrid.classList.toggle("chat-hidden");
  chatToggle.classList.toggle("active", !contentGrid.classList.contains("chat-hidden"));
});
chatToggle.classList.add("active");

// ======== Roaming system ========

const roamState = {};
const ROAM_SPEED = 0.6; // px per frame
const PET_W = 160;
const PET_H = 200;

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
    s.x += vx;
    s.y += vy;
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

openChatTab("eous");
showBubble("CLICK A BANGBOO!");

initRoamPositions();
Object.keys(AGENTS).forEach(id => {
  setTimeout(() => pickNewTarget(id), 1000 + Math.random() * 2000);
});
requestAnimationFrame(roamTick);

window.addEventListener("resize", () => {
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
