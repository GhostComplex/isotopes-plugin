// plugins/pet/ui/pet.js — GIF-animated Bangboo pet

const API = window.location.origin;
const pet = document.getElementById("pet");
const petGif = document.getElementById("pet-gif");
const bubble = document.getElementById("speech-bubble");
const moodText = document.getElementById("mood-text");
const statMood = document.getElementById("stat-mood");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-btn");
const chatToggle = document.getElementById("chat-toggle");
const contentGrid = document.getElementById("content-grid");

let sessionId = null;
let bubbleTimer = null;
let currentMood = "neutral";
let animating = false;

// ======== GIF sources ========
const GIFS = {
  idle:  "/ui/pet/gif/idle.gif",
  stand: "/ui/pet/gif/stand.gif",
  look:  "/ui/pet/gif/look.gif",
};

// ======== CSS animation names for poke reactions ========
const POKE_REACTIONS = [
  { gif: "stand", anim: "anim-jump" },
  { gif: "look",  anim: "anim-shake" },
  { gif: "idle",  anim: "anim-squish" },
  { gif: "stand", anim: "anim-bounce" },
  { gif: "look",  anim: "anim-spin" },
];

// Action -> CSS animation mapping
const ACTION_ANIMS = {
  jump:   "anim-jump",
  spin:   "anim-spin",
  shake:  "anim-shake",
  wave:   "anim-wave",
  dance:  "anim-dance",
  bounce: "anim-bounce",
  nod:    "anim-nod",
  poke:   null, // handled specially
  sleep:  null,
};

// ======== Animation engine ========

function setGif(name) {
  const src = GIFS[name] || GIFS.idle;
  // Force reload to restart GIF animation
  petGif.src = "";
  petGif.src = src;
}

function playAnim(cssClass, gifName, duration) {
  if (animating) return;
  animating = true;

  if (gifName) setGif(gifName);

  // Remove old anim classes
  pet.className = "";
  void pet.offsetWidth; // force reflow
  pet.classList.add(cssClass);

  setTimeout(() => {
    pet.classList.remove(cssClass);
    setGif("idle");
    animating = false;
  }, duration || 1200);
}

function playAnimation(action) {
  if (action === "poke") {
    const pick = POKE_REACTIONS[Math.floor(Math.random() * POKE_REACTIONS.length)];
    playAnim(pick.anim, pick.gif, 1000);
    return;
  }

  if (action === "sleep") {
    setGif("look");
    return;
  }

  const anim = ACTION_ANIMS[action];
  if (anim) {
    const gifs = ["idle", "stand", "look"];
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    playAnim(anim, gif, 1200);
  }
}

function setMood(mood) {
  currentMood = mood;
  const upper = mood.toUpperCase();
  if (moodText) moodText.textContent = upper;
  if (statMood) statMood.textContent = upper;
  // Set data-mood on a parent for CSS glow effects
  pet.closest(".panel-center")?.setAttribute("data-mood", mood);
}

// ======== Session & Chat ========

async function ensureSession() {
  if (sessionId) return;
  const res = await fetch(`${API}/api/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  sessionId = data.sessionId;
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function sendMessage(text) {
  await ensureSession();
  addMessage("user", text);
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
          handleSSE(eventType, data, assistantDiv);
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

function handleSSE(event, data, assistantDiv) {
  switch (event) {
    case "text_delta":
      assistantDiv.textContent += data.text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
      break;
    case "tool_call":
      if (data.toolName === "set_pet_mood") {
        setMood(data.args?.mood || "neutral");
        addMessage("tool", `♦ MOOD → ${(data.args?.mood || "").toUpperCase()}`);
      } else if (data.toolName === "pet_action") {
        playAnimation(data.args?.action || "bounce");
        addMessage("tool", `♦ ACT → ${(data.args?.action || "").toUpperCase()}`);
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

// ======== Interactions ========

pet.addEventListener("click", () => {
  playAnimation("poke");
  sendMessage("*用户戳了你一下*");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendMessage(text);
});

clearBtn.addEventListener("click", () => {
  sessionId = null;
  currentMood = "neutral";
  if (moodText) moodText.textContent = "NEUTRAL";
  if (statMood) statMood.textContent = "NEUTRAL";
  messagesEl.innerHTML = "";
  setGif("idle");
  showBubble("SYS RESET OK");
});

chatToggle.addEventListener("click", () => {
  contentGrid.classList.toggle("chat-hidden");
  chatToggle.classList.toggle("active", !contentGrid.classList.contains("chat-hidden"));
});
chatToggle.classList.add("active");

// ======== Init ========

showBubble("CLICK ME!");
