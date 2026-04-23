// plugins/pet/ui/pet.js — Sprite-animated Virtual Pet

const API = window.location.origin;
const canvas = document.getElementById("pet");
const ctx = canvas.getContext("2d");
const bubble = document.getElementById("speech-bubble");
const moodText = document.getElementById("mood-text");
const statMood = document.getElementById("stat-mood");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-btn");

let sessionId = null;
let bubbleTimer = null;

// ---- Sprite engine ----

const SHEET_IMG = new Image();
SHEET_IMG.src = "/ui/pet/bangboo-sheet.png";

let manifest = null;
let currentAnim = "idle";
let currentFrame = 0;
let frameTimer = 0;
let lastTime = 0;
let animQueue = [];      // queued one-shot animations
let looping = true;      // is current anim looping?
let currentMood = "neutral";

const FPS = {
  idle: 4,     // slow breathing
  bounce: 10,
  jump: 10,
  poke: 12,
  shake: 12,
  spin: 10,
  dance: 8,
  wave: 6,
  nod: 8,
  sleep: 3,
};

async function loadManifest() {
  const res = await fetch("/ui/pet/bangboo-manifest.json");
  manifest = await res.json();
}

function drawFrame() {
  if (!manifest) return;
  const anim = manifest.animations[currentAnim];
  if (!anim) return;

  const scale = manifest.scale;
  const fw = anim.frameWidth * scale;
  const fh = anim.frameHeight * scale;
  const sx = currentFrame * fw;
  const sy = anim.row * fh;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(SHEET_IMG, sx, sy, fw, fh, 0, 0, canvas.width, canvas.height);
}

function tick(time) {
  if (!lastTime) lastTime = time;
  const dt = time - lastTime;
  lastTime = time;

  if (manifest && SHEET_IMG.complete) {
    const fps = FPS[currentAnim] || 8;
    frameTimer += dt;
    if (frameTimer >= 1000 / fps) {
      frameTimer = 0;
      const anim = manifest.animations[currentAnim];
      if (anim) {
        currentFrame++;
        if (currentFrame >= anim.frames) {
          if (looping) {
            currentFrame = 0;
          } else {
            // One-shot done — go to next in queue or back to idle/mood
            currentFrame = anim.frames - 1;
            if (animQueue.length > 0) {
              const next = animQueue.shift();
              playAnim(next.name, next.loop);
            } else {
              // Return to mood sprite or idle
              const moodAnim = "mood_" + currentMood;
              if (manifest.animations[moodAnim]) {
                currentAnim = moodAnim;
                currentFrame = 0;
                looping = false;
              } else {
                currentAnim = "idle";
                currentFrame = 0;
                looping = true;
              }
            }
          }
        }
      }
      drawFrame();
    }
  }

  requestAnimationFrame(tick);
}

function playAnim(name, loop = false) {
  if (!manifest || !manifest.animations[name]) return;
  currentAnim = name;
  currentFrame = 0;
  frameTimer = 0;
  looping = loop;
}

function queueAnim(name) {
  animQueue.push({ name, loop: false });
}

// Map tool actions to sprite anims
const ACTION_MAP = {
  jump: "jump",
  spin: "spin",
  shake: "shake",
  wave: "wave",
  dance: "dance",
  sleep: "sleep",
  bounce: "bounce",
  nod: "nod",
  poke: "poke",
};

function playAnimation(action) {
  const animName = ACTION_MAP[action];
  if (animName) {
    const isLoop = action === "sleep";
    playAnim(animName, isLoop);
  }
}

function setMood(mood) {
  currentMood = mood;
  const upper = mood.toUpperCase();
  if (moodText) moodText.textContent = upper;
  if (statMood) statMood.textContent = upper;

  // Show mood sprite briefly, then back to idle
  const moodAnim = "mood_" + mood;
  if (manifest && manifest.animations[moodAnim]) {
    playAnim(moodAnim, false);
    // After a beat, return to idle
    setTimeout(() => {
      if (currentAnim === moodAnim) {
        playAnim("idle", true);
      }
    }, 1500);
  }
}

// ---- Session ----

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

// ---- Chat ----

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

// ---- Interactions ----

canvas.addEventListener("click", () => {
  playAnim("poke", false);
  sendMessage("*用户戳了你一下*");
});

// Hover effect
canvas.addEventListener("mouseenter", () => {
  canvas.style.filter = "brightness(1.15)";
});
canvas.addEventListener("mouseleave", () => {
  canvas.style.filter = "";
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
  playAnim("idle", true);
  showBubble("SYS RESET OK");
});

// ---- Init ----

async function init() {
  await loadManifest();
  SHEET_IMG.onload = () => {
    drawFrame();
  };
  if (SHEET_IMG.complete) drawFrame();
  requestAnimationFrame(tick);
  showBubble("CLICK ME!");
}

init();
