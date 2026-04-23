// plugins/pet/ui/pet.js — Virtual Pet frontend (8-bit terminal)

const API = window.location.origin;
const pet = document.getElementById("pet");
const bubble = document.getElementById("speech-bubble");
const moodText = document.getElementById("mood-text");
const statMood = document.getElementById("stat-mood");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-btn");

let sessionId = null;
let bubbleTimer = null;

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

// ---- Pet Mood & Animation ----

function setMood(mood) {
  pet.dataset.mood = mood;
  const upper = mood.toUpperCase();
  moodText.textContent = upper;
  if (statMood) statMood.textContent = upper;
  pet.classList.add("mood-change");
  setTimeout(() => pet.classList.remove("mood-change"), 400);
}

function playAnimation(action) {
  const cls = `anim-${action}`;
  pet.classList.remove(...[...pet.classList].filter(c => c.startsWith("anim-")));
  void pet.offsetWidth;
  pet.classList.add(cls);
  if (action !== "sleep") {
    pet.addEventListener("animationend", () => pet.classList.remove(cls), { once: true });
  }
}

function showBubble(text) {
  const short = text.length > 50 ? text.slice(0, 47) + "..." : text;
  bubble.textContent = short;
  bubble.classList.remove("hidden");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 4000);
}

// ---- Click / touch ----

pet.addEventListener("click", () => {
  playAnimation("poke");
  sendMessage("*用户戳了你一下*");
});

// ---- Form submit ----

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendMessage(text);
});

// ---- Clear ----

clearBtn.addEventListener("click", () => {
  sessionId = null;
  setMood("neutral");
  messagesEl.innerHTML = "";
  showBubble("SYS RESET OK");
});

// ---- Init ----

showBubble("CLICK ME!");
