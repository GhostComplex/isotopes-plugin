// plugins/pet/ui/pet.js — Multi-agent GIF pet system

const API = window.location.origin;
const bubble = document.getElementById("speech-bubble");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-btn");
const chatToggle = document.getElementById("chat-toggle");
const contentGrid = document.getElementById("content-grid");

let bubbleTimer = null;

// ======== Agent definitions ========

const AGENTS = {
  eous:     { name: "EOUS",     prefix: "eous",     session: null },
  amillion: { name: "AMILLION", prefix: "amillion", session: null },
  penguin:  { name: "PENGUIN",  prefix: "enguin",   session: null },  // file prefix is "enguin"
};

// GIF states per agent: idle, jump, touch
function gifUrl(agentId, state) {
  const prefix = AGENTS[agentId].prefix;
  return `/ui/pet/gif/${prefix}-${state}.gif`;
}

// Currently selected agent for chat
let selectedAgent = "eous";

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
  if (action === "poke") {
    pokeAgent(agentId);
    return;
  }
  const def = ACTION_ANIMS[action];
  if (def) {
    playAgentAnim(agentId, def.anim, def.gif, 1200);
  }
}

// ======== Selection ========

function selectAgent(agentId) {
  selectedAgent = agentId;
  document.querySelectorAll(".agent-slot").forEach(s => s.classList.remove("selected"));
  const el = getSlotElements(agentId);
  if (el) el.slot.classList.add("selected");

  // Update panel header
  const header = document.querySelector(".panel-right .panel-header");
  if (header) header.textContent = `COMMS — ${AGENTS[agentId].name}`;
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

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function sendMessage(agentId, text) {
  const sessionId = await ensureSession(agentId);
  addMessage("user", `[${AGENTS[agentId].name}] ${text}`);
  input.disabled = true;
  form.querySelector("button").disabled = true;

  const assistantDiv = addMessage("assistant", "");
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
  input.disabled = false;
  form.querySelector("button").disabled = false;
  input.focus();
}

function handleSSE(agentId, event, data, assistantDiv) {
  switch (event) {
    case "text_delta":
      assistantDiv.textContent += data.text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
      break;
    case "tool_call":
      if (data.toolName === "set_pet_mood") {
        addMessage("tool", `♦ ${AGENTS[agentId].name} MOOD → ${(data.args?.mood || "").toUpperCase()}`);
      } else if (data.toolName === "pet_action") {
        playAction(agentId, data.args?.action || "bounce");
        addMessage("tool", `♦ ${AGENTS[agentId].name} ACT → ${(data.args?.action || "").toUpperCase()}`);
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

// Click on any agent: select + poke
document.querySelectorAll(".agent-slot").forEach(slot => {
  slot.addEventListener("click", () => {
    const agentId = slot.dataset.agent;
    selectAgent(agentId);
    pokeAgent(agentId);
    sendMessage(agentId, "*用户戳了你一下*");
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendMessage(selectedAgent, text);
});

clearBtn.addEventListener("click", () => {
  Object.values(AGENTS).forEach(a => a.session = null);
  messagesEl.innerHTML = "";
  Object.keys(AGENTS).forEach(id => setAgentGif(id, "idel"));
  showBubble("SYS RESET OK");
});

chatToggle.addEventListener("click", () => {
  contentGrid.classList.toggle("chat-hidden");
  chatToggle.classList.toggle("active", !contentGrid.classList.contains("chat-hidden"));
});
chatToggle.classList.add("active");

// ======== Init ========

selectAgent("eous");
showBubble("CLICK A BANGBOO!");
