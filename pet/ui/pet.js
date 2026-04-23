// plugins/pet/ui/pet.js — Pixel art animated pet with articulated parts

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
const chatToggle = document.getElementById("chat-toggle");
const contentGrid = document.getElementById("content-grid");

const PX = 8; // pixel scale factor
const W = canvas.width / PX;  // 32 logical pixels
const H = canvas.height / PX; // 40 logical pixels

let sessionId = null;
let bubbleTimer = null;
let currentMood = "neutral";

// ========== COLOR PALETTE ==========
const C = {
  _:    null,                // transparent
  BK:   "#1a1a1a",          // black
  DK:   "#2e2e36",          // dark gray (body)
  GR:   "#3a3a42",          // gray (body highlight)
  GH:   "#4a4a52",          // gray highlight
  CR:   "#e0d6c2",          // cream (ears, feet)
  CL:   "#c8bea8",          // cream shadow
  OR:   "#ff6a2f",          // orange (scarf)
  OD:   "#cc4e1a",          // orange dark
  OL:   "#ff8c55",          // orange light
  EG:   "#7aff3a",          // eye green (bright)
  ED:   "#3a8818",          // eye green (dark/pupil)
  EL:   "#ccff66",          // eye highlight
  WH:   "#f0ece4",          // white
  RD:   "#ff3333",          // red (angry)
  PK:   "#ff6a8a",          // pink (love)
  BL:   "#5588cc",          // blue (sad)
  YL:   "#ffcc00",          // yellow (excited)
};

// ========== BODY PARTS (pixel grids, origin at top-left) ==========
// Each part: { pixels: [[row]], w, h, anchor: {x, y} }
// Anchor = the point around which the part is positioned

// Left ear (5w x 11h)
const EAR_L = [
  [C._,C.BK,C.BK,C.BK,C._],
  [C.BK,C.CR,C.CR,C.CR,C.BK],
  [C.BK,C.CR,C.OR,C.CR,C.BK],
  [C.BK,C.CR,C.OR,C.CR,C.BK],
  [C.BK,C.CR,C.OR,C.CR,C.BK],
  [C.BK,C.CR,C.OR,C.CR,C.BK],
  [C.BK,C.CR,C.OR,C.CR,C.BK],
  [C.BK,C.CR,C.CR,C.CR,C.BK],
  [C._,C.BK,C.CR,C.BK,C._],
  [C._,C._,C.BK,C._,C._],
  [C._,C._,C.BK,C._,C._],
];

// Right ear (mirror of left - generated)
const EAR_R = EAR_L.map(row => [...row].reverse());

// Head (16w x 14h) — dark rounded shape
const HEAD = [
  [C._,C._,C._,C._,C._,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C._,C._,C._,C._,C._],
  [C._,C._,C._,C.BK,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.BK,C.BK,C._,C._,C._],
  [C._,C._,C.BK,C.GH,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._,C._],
  [C._,C.BK,C.GH,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.GR,C.DK,C.BK,C._],
  [C.BK,C.GR,C.GR,C.BK,C.BK,C._,C._,C._,C._,C._,C._,C.BK,C.BK,C.GR,C.DK,C.BK],
  [C.BK,C.GR,C.GR,C.BK,C._,C._,C._,C._,C._,C._,C._,C._,C.BK,C.GR,C.DK,C.BK],
  [C.BK,C.GR,C.GR,C.BK,C._,C._,C._,C._,C._,C._,C._,C._,C.BK,C.GR,C.DK,C.BK],
  [C.BK,C.GR,C.GR,C.BK,C.BK,C._,C._,C._,C._,C._,C._,C.BK,C.BK,C.GR,C.DK,C.BK],
  [C._,C.BK,C.GR,C.GR,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._,C._],
  [C._,C._,C._,C.BK,C.BK,C.DK,C.DK,C.DK,C.DK,C.DK,C.DK,C.BK,C.BK,C._,C._,C._],
  [C._,C._,C._,C._,C._,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C._,C._,C._,C._,C._],
];

// Eyes — 3x3 each (drawn separately so we can change color)
function makeEye(bright, dark, highlight) {
  return [
    [C._,  bright, C._],
    [bright, dark, bright],
    [C._,  bright, highlight],
  ];
}

// Scarf (18w x 4h)
const SCARF = [
  [C._,C._,C.BK,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.OR,C.BK,C._,C._],
  [C._,C.BK,C.OL,C.OR,C.OR,C.WH,C.WH,C.OR,C.OR,C.OR,C.WH,C.WH,C.OR,C.OR,C.OR,C.OL,C.BK,C._],
  [C._,C.BK,C.OR,C.OR,C.WH,C._,C.WH,C._,C.OR,C.WH,C._,C.WH,C._,C.OR,C.OR,C.OR,C.BK,C._],
  [C._,C._,C.BK,C.BK,C.BK,C._,C.BK,C._,C.BK,C.BK,C._,C.BK,C._,C.BK,C.BK,C.BK,C._,C._],
];

// Scarf tail (4w x 5h) — hangs to the left
const SCARF_TAIL = [
  [C.BK,C.OR,C.OR,C.BK],
  [C.BK,C.OR,C.OR,C.BK],
  [C._,C.BK,C.OR,C.BK],
  [C._,C.BK,C.OD,C.BK],
  [C._,C._,C.BK,C._],
];

// Body (14w x 10h)
const BODY = [
  [C._,C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.BK,C._,C._],
  [C._,C.BK,C.GH,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.OR,C.OR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.OR,C.OD,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.DK,C.BK,C._],
  [C._,C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.BK,C._,C._],
  [C._,C._,C._,C.BK,C.GR,C.GR,C.GR,C.GR,C.GR,C.GR,C.BK,C._,C._,C._],
  [C._,C._,C._,C._,C.BK,C.BK,C.BK,C.BK,C.BK,C.BK,C._,C._,C._,C._],
];

// Arm (3w x 6h)
const ARM = [
  [C._,C.BK,C._],
  [C.BK,C.GR,C.BK],
  [C.BK,C.GR,C.BK],
  [C.BK,C.DK,C.BK],
  [C.BK,C.DK,C.BK],
  [C._,C.BK,C._],
];

// Foot (4w x 3h)
const FOOT = [
  [C._,C.BK,C.BK,C._],
  [C.BK,C.CR,C.CL,C.BK],
  [C.BK,C.BK,C.BK,C.BK],
];

// ========== POSE SYSTEM ==========
// A pose defines offsets for each part relative to a base position
// Base positions (logical pixels from canvas top-left):
const BASE = {
  earL:   { x: 7,  y: 2 },
  earR:   { x: 20, y: 2 },
  head:   { x: 8,  y: 10 },
  eyeL:   { x: 13, y: 16 },
  eyeR:   { x: 19, y: 16 },
  scarf:  { x: 7,  y: 22 },
  scarfTail: { x: 3, y: 23 },
  body:   { x: 9,  y: 25 },
  armL:   { x: 6,  y: 26 },
  armR:   { x: 23, y: 26 },
  footL:  { x: 11, y: 34 },
  footR:  { x: 19, y: 34 },
};

function defaultPose() {
  return {
    earL: { dx: 0, dy: 0 },
    earR: { dx: 0, dy: 0 },
    head: { dx: 0, dy: 0 },
    eyeL: { dx: 0, dy: 0 },
    eyeR: { dx: 0, dy: 0 },
    scarf: { dx: 0, dy: 0 },
    scarfTail: { dx: 0, dy: 0 },
    body: { dx: 0, dy: 0 },
    armL: { dx: 0, dy: 0 },
    armR: { dx: 0, dy: 0 },
    footL: { dx: 0, dy: 0 },
    footR: { dx: 0, dy: 0 },
    eyeColor: null,  // null = use mood color
    eyeState: "open", // open, closed, wide, angry
    mouthState: "normal", // normal, happy, open
  };
}

function p(overrides) {
  return { ...defaultPose(), ...overrides };
}

// ========== ANIMATIONS ==========
// Each animation: { frames: [pose, ...], fps, loop }

const ANIMS = {
  idle: {
    fps: 3,
    loop: true,
    frames: [
      p({}),
      p({ head:{dx:0,dy:-1}, earL:{dx:0,dy:-1}, earR:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1}, scarf:{dx:0,dy:0}, scarfTail:{dx:0,dy:0} }),
      p({ head:{dx:0,dy:-1}, earL:{dx:0,dy:-2}, earR:{dx:0,dy:-2}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1} }),
      p({ head:{dx:0,dy:-1}, earL:{dx:0,dy:-1}, earR:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1} }),
    ],
  },

  // POKE REACTIONS (randomly chosen)
  poke_jump: {
    fps: 8,
    loop: false,
    frames: [
      p({ body:{dx:0,dy:1}, head:{dx:0,dy:1}, eyeState:"wide" }),
      p({ body:{dx:0,dy:-2}, head:{dx:0,dy:-3}, earL:{dx:0,dy:-3}, earR:{dx:0,dy:-3}, eyeL:{dx:0,dy:-3}, eyeR:{dx:0,dy:-3}, eyeState:"wide", armL:{dx:-1,dy:-2}, armR:{dx:1,dy:-2} }),
      p({ body:{dx:0,dy:-5}, head:{dx:0,dy:-6}, earL:{dx:-1,dy:-7}, earR:{dx:1,dy:-7}, eyeL:{dx:0,dy:-6}, eyeR:{dx:0,dy:-6}, scarf:{dx:0,dy:-4}, scarfTail:{dx:-1,dy:-3}, eyeState:"wide", armL:{dx:-2,dy:-4}, armR:{dx:2,dy:-4}, footL:{dx:0,dy:-2}, footR:{dx:0,dy:-2} }),
      p({ body:{dx:0,dy:-3}, head:{dx:0,dy:-4}, earL:{dx:0,dy:-4}, earR:{dx:0,dy:-4}, eyeL:{dx:0,dy:-4}, eyeR:{dx:0,dy:-4}, scarf:{dx:0,dy:-2}, scarfTail:{dx:0,dy:-1}, armL:{dx:-1,dy:-2}, armR:{dx:1,dy:-2} }),
      p({ body:{dx:0,dy:1}, head:{dx:0,dy:0}, earL:{dx:0,dy:1}, earR:{dx:0,dy:1} }),
      p({}),
    ],
  },

  poke_shake: {
    fps: 10,
    loop: false,
    frames: [
      p({ head:{dx:-2,dy:0}, earL:{dx:-2,dy:0}, earR:{dx:-2,dy:0}, eyeL:{dx:-2,dy:0}, eyeR:{dx:-2,dy:0}, eyeState:"angry" }),
      p({ head:{dx:2,dy:0}, earL:{dx:2,dy:0}, earR:{dx:2,dy:0}, eyeL:{dx:2,dy:0}, eyeR:{dx:2,dy:0}, eyeState:"angry" }),
      p({ head:{dx:-2,dy:0}, earL:{dx:-3,dy:0}, earR:{dx:-1,dy:0}, eyeL:{dx:-2,dy:0}, eyeR:{dx:-2,dy:0}, eyeState:"angry" }),
      p({ head:{dx:2,dy:0}, earL:{dx:1,dy:0}, earR:{dx:3,dy:0}, eyeL:{dx:2,dy:0}, eyeR:{dx:2,dy:0}, eyeState:"angry" }),
      p({ head:{dx:-1,dy:0}, earL:{dx:-1,dy:0}, earR:{dx:-1,dy:0}, eyeL:{dx:-1,dy:0}, eyeR:{dx:-1,dy:0} }),
      p({}),
    ],
  },

  poke_squish: {
    fps: 8,
    loop: false,
    frames: [
      p({ head:{dx:0,dy:2}, earL:{dx:1,dy:3}, earR:{dx:-1,dy:3}, eyeL:{dx:0,dy:2}, eyeR:{dx:0,dy:2}, body:{dx:0,dy:1}, eyeState:"closed" }),
      p({ head:{dx:0,dy:3}, earL:{dx:2,dy:4}, earR:{dx:-2,dy:4}, eyeL:{dx:0,dy:3}, eyeR:{dx:0,dy:3}, body:{dx:0,dy:1}, armL:{dx:-1,dy:0}, armR:{dx:1,dy:0}, eyeState:"closed" }),
      p({ head:{dx:0,dy:1}, earL:{dx:1,dy:2}, earR:{dx:-1,dy:2}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1}, eyeState:"closed" }),
      p({ head:{dx:0,dy:-2}, earL:{dx:0,dy:-3}, earR:{dx:0,dy:-3}, eyeL:{dx:0,dy:-2}, eyeR:{dx:0,dy:-2}, eyeState:"wide", armL:{dx:-1,dy:-1}, armR:{dx:1,dy:-1} }),
      p({ head:{dx:0,dy:-1}, earL:{dx:0,dy:-1}, earR:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1} }),
      p({}),
    ],
  },

  poke_happy: {
    fps: 7,
    loop: false,
    frames: [
      p({ eyeState:"closed", mouthState:"happy" }),
      p({ head:{dx:0,dy:-2}, earL:{dx:0,dy:-3}, earR:{dx:0,dy:-3}, eyeL:{dx:0,dy:-2}, eyeR:{dx:0,dy:-2}, body:{dx:0,dy:-1}, eyeState:"closed", mouthState:"happy", armL:{dx:-1,dy:-2}, armR:{dx:1,dy:-2} }),
      p({ head:{dx:0,dy:-1}, earL:{dx:0,dy:-1}, earR:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1}, eyeState:"closed", mouthState:"happy" }),
      p({ head:{dx:0,dy:-3}, earL:{dx:-1,dy:-4}, earR:{dx:1,dy:-4}, eyeL:{dx:0,dy:-3}, eyeR:{dx:0,dy:-3}, body:{dx:0,dy:-1}, footL:{dx:0,dy:-1}, footR:{dx:0,dy:-1}, eyeState:"closed", mouthState:"happy", armL:{dx:-2,dy:-3}, armR:{dx:2,dy:-3} }),
      p({ head:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1}, mouthState:"happy" }),
      p({ mouthState:"happy" }),
      p({}),
    ],
  },

  poke_spin: {
    fps: 10,
    loop: false,
    frames: [
      p({ head:{dx:1,dy:0}, earL:{dx:2,dy:0}, earR:{dx:0,dy:0} }),
      p({ head:{dx:2,dy:0}, earL:{dx:3,dy:1}, earR:{dx:1,dy:1}, eyeState:"closed", body:{dx:1,dy:0}, armL:{dx:2,dy:0}, armR:{dx:2,dy:0} }),
      p({ head:{dx:1,dy:0}, body:{dx:1,dy:0}, eyeState:"closed", armL:{dx:2,dy:0}, armR:{dx:0,dy:0} }),
      p({ head:{dx:-1,dy:0}, earL:{dx:-2,dy:1}, earR:{dx:0,dy:1}, eyeState:"closed", body:{dx:-1,dy:0}, armL:{dx:-2,dy:0}, armR:{dx:-2,dy:0} }),
      p({ head:{dx:-2,dy:0}, earL:{dx:-3,dy:0}, earR:{dx:-1,dy:0}, eyeState:"closed", body:{dx:-1,dy:0} }),
      p({ head:{dx:-1,dy:0}, body:{dx:0,dy:0} }),
      p({ eyeState:"wide" }),
      p({}),
    ],
  },

  // ACTION ANIMATIONS (triggered by tool calls)
  dance: {
    fps: 6,
    loop: false,
    frames: [
      p({ head:{dx:0,dy:-2}, earL:{dx:-1,dy:-2}, earR:{dx:1,dy:-2}, armL:{dx:-2,dy:-3}, armR:{dx:1,dy:0}, footR:{dx:1,dy:0}, mouthState:"happy" }),
      p({ head:{dx:0,dy:0}, armL:{dx:0,dy:0}, armR:{dx:2,dy:-3}, footL:{dx:-1,dy:0}, mouthState:"happy" }),
      p({ head:{dx:0,dy:-2}, earL:{dx:1,dy:-2}, earR:{dx:-1,dy:-2}, armL:{dx:-2,dy:-3}, armR:{dx:1,dy:0}, footR:{dx:1,dy:0}, mouthState:"happy" }),
      p({ head:{dx:0,dy:0}, armL:{dx:0,dy:0}, armR:{dx:2,dy:-3}, footL:{dx:-1,dy:0}, mouthState:"happy" }),
      p({ head:{dx:0,dy:-3}, earL:{dx:-1,dy:-4}, earR:{dx:1,dy:-4}, eyeL:{dx:0,dy:-3}, eyeR:{dx:0,dy:-3}, armL:{dx:-2,dy:-4}, armR:{dx:2,dy:-4}, body:{dx:0,dy:-1}, footL:{dx:0,dy:-1}, footR:{dx:0,dy:-1}, mouthState:"happy" }),
      p({ mouthState:"happy" }),
      p({}),
    ],
  },

  wave: {
    fps: 5,
    loop: false,
    frames: [
      p({ armR:{dx:1,dy:-2} }),
      p({ armR:{dx:2,dy:-4}, earR:{dx:0,dy:-1} }),
      p({ armR:{dx:1,dy:-3} }),
      p({ armR:{dx:2,dy:-4}, earR:{dx:0,dy:-1} }),
      p({ armR:{dx:1,dy:-2} }),
      p({}),
    ],
  },

  bounce: {
    fps: 8,
    loop: false,
    frames: [
      p({ body:{dx:0,dy:1}, head:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1} }),
      p({ body:{dx:0,dy:-3}, head:{dx:0,dy:-4}, earL:{dx:0,dy:-5}, earR:{dx:0,dy:-5}, eyeL:{dx:0,dy:-4}, eyeR:{dx:0,dy:-4}, scarf:{dx:0,dy:-2}, scarfTail:{dx:0,dy:-1}, armL:{dx:0,dy:-2}, armR:{dx:0,dy:-2}, footL:{dx:0,dy:-1}, footR:{dx:0,dy:-1} }),
      p({ body:{dx:0,dy:1}, head:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1} }),
      p({ body:{dx:0,dy:-2}, head:{dx:0,dy:-3}, earL:{dx:0,dy:-3}, earR:{dx:0,dy:-3}, eyeL:{dx:0,dy:-3}, eyeR:{dx:0,dy:-3}, scarf:{dx:0,dy:-1}, armL:{dx:0,dy:-1}, armR:{dx:0,dy:-1} }),
      p({ body:{dx:0,dy:1}, head:{dx:0,dy:0} }),
      p({}),
    ],
  },

  nod: {
    fps: 5,
    loop: false,
    frames: [
      p({ head:{dx:0,dy:1}, earL:{dx:0,dy:1}, earR:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1} }),
      p({ head:{dx:0,dy:2}, earL:{dx:0,dy:2}, earR:{dx:0,dy:2}, eyeL:{dx:0,dy:2}, eyeR:{dx:0,dy:2}, eyeState:"closed" }),
      p({ head:{dx:0,dy:1}, earL:{dx:0,dy:1}, earR:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1} }),
      p({}),
      p({ head:{dx:0,dy:1}, earL:{dx:0,dy:1}, earR:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1}, eyeState:"closed" }),
      p({}),
    ],
  },

  sleep: {
    fps: 2,
    loop: true,
    frames: [
      p({ head:{dx:0,dy:1}, earL:{dx:0,dy:2}, earR:{dx:0,dy:2}, eyeState:"closed", body:{dx:0,dy:0} }),
      p({ head:{dx:0,dy:2}, earL:{dx:1,dy:3}, earR:{dx:-1,dy:3}, eyeState:"closed" }),
      p({ head:{dx:0,dy:2}, earL:{dx:0,dy:3}, earR:{dx:0,dy:3}, eyeState:"closed" }),
      p({ head:{dx:0,dy:1}, earL:{dx:-1,dy:2}, earR:{dx:1,dy:2}, eyeState:"closed" }),
    ],
  },

  jump: {
    fps: 8,
    loop: false,
    frames: [
      p({ body:{dx:0,dy:2}, head:{dx:0,dy:1}, eyeL:{dx:0,dy:1}, eyeR:{dx:0,dy:1} }),
      p({ body:{dx:0,dy:-3}, head:{dx:0,dy:-5}, earL:{dx:0,dy:-6}, earR:{dx:0,dy:-6}, eyeL:{dx:0,dy:-5}, eyeR:{dx:0,dy:-5}, scarf:{dx:0,dy:-3}, scarfTail:{dx:-1,dy:-2}, armL:{dx:-1,dy:-4}, armR:{dx:1,dy:-4}, footL:{dx:0,dy:-2}, footR:{dx:0,dy:-2}, eyeState:"wide" }),
      p({ body:{dx:0,dy:-6}, head:{dx:0,dy:-8}, earL:{dx:-1,dy:-10}, earR:{dx:1,dy:-10}, eyeL:{dx:0,dy:-8}, eyeR:{dx:0,dy:-8}, scarf:{dx:0,dy:-5}, scarfTail:{dx:-1,dy:-4}, armL:{dx:-2,dy:-6}, armR:{dx:2,dy:-6}, footL:{dx:-1,dy:-4}, footR:{dx:1,dy:-4}, eyeState:"wide" }),
      p({ body:{dx:0,dy:-4}, head:{dx:0,dy:-6}, earL:{dx:0,dy:-7}, earR:{dx:0,dy:-7}, eyeL:{dx:0,dy:-6}, eyeR:{dx:0,dy:-6}, scarf:{dx:0,dy:-3}, scarfTail:{dx:0,dy:-2}, armL:{dx:-1,dy:-3}, armR:{dx:1,dy:-3}, footL:{dx:0,dy:-2}, footR:{dx:0,dy:-2} }),
      p({ body:{dx:0,dy:-1}, head:{dx:0,dy:-1}, earL:{dx:0,dy:-1}, earR:{dx:0,dy:-1}, eyeL:{dx:0,dy:-1}, eyeR:{dx:0,dy:-1} }),
      p({ body:{dx:0,dy:2}, head:{dx:0,dy:1} }),
      p({}),
    ],
  },

  shake: {
    fps: 10,
    loop: false,
    frames: [
      p({ head:{dx:-2,dy:0}, body:{dx:-1,dy:0}, earL:{dx:-2,dy:0}, earR:{dx:-2,dy:0}, eyeL:{dx:-2,dy:0}, eyeR:{dx:-2,dy:0}, scarf:{dx:-1,dy:0}, scarfTail:{dx:-1,dy:0}, armL:{dx:-2,dy:0}, armR:{dx:-1,dy:0} }),
      p({ head:{dx:2,dy:0}, body:{dx:1,dy:0}, earL:{dx:2,dy:0}, earR:{dx:2,dy:0}, eyeL:{dx:2,dy:0}, eyeR:{dx:2,dy:0}, scarf:{dx:1,dy:0}, scarfTail:{dx:2,dy:0}, armL:{dx:1,dy:0}, armR:{dx:2,dy:0} }),
      p({ head:{dx:-2,dy:0}, body:{dx:-1,dy:0}, earL:{dx:-3,dy:0}, earR:{dx:-1,dy:0}, eyeL:{dx:-2,dy:0}, eyeR:{dx:-2,dy:0}, scarf:{dx:-1,dy:0}, armL:{dx:-2,dy:0}, armR:{dx:-1,dy:0} }),
      p({ head:{dx:2,dy:0}, body:{dx:1,dy:0}, earL:{dx:1,dy:0}, earR:{dx:3,dy:0}, eyeL:{dx:2,dy:0}, eyeR:{dx:2,dy:0}, scarf:{dx:1,dy:0}, armL:{dx:1,dy:0}, armR:{dx:2,dy:0} }),
      p({ head:{dx:-1,dy:0}, earL:{dx:-1,dy:0}, earR:{dx:-1,dy:0}, eyeL:{dx:-1,dy:0}, eyeR:{dx:-1,dy:0} }),
      p({}),
    ],
  },

  spin: {
    fps: 10,
    loop: false,
    frames: [
      p({}),
      p({ head:{dx:2,dy:0}, body:{dx:2,dy:0}, earL:{dx:3,dy:1}, earR:{dx:1,dy:0}, eyeState:"closed", armL:{dx:2,dy:0}, armR:{dx:2,dy:0}, scarf:{dx:2,dy:0}, scarfTail:{dx:3,dy:0} }),
      p({ eyeState:"closed" }), // facing away (fake it)
      p({ head:{dx:-2,dy:0}, body:{dx:-2,dy:0}, earL:{dx:-1,dy:0}, earR:{dx:-3,dy:1}, eyeState:"closed", armL:{dx:-2,dy:0}, armR:{dx:-2,dy:0}, scarf:{dx:-2,dy:0}, scarfTail:{dx:-3,dy:0} }),
      p({}),
      p({ head:{dx:2,dy:0}, body:{dx:1,dy:0}, eyeState:"closed" }),
      p({ eyeState:"closed" }),
      p({ head:{dx:-1,dy:0}, body:{dx:-1,dy:0} }),
      p({ eyeState:"wide" }),
      p({}),
    ],
  },
};

const POKE_ANIMS = ["poke_jump", "poke_shake", "poke_squish", "poke_happy", "poke_spin"];

// ========== RENDERING ==========

function drawPixels(grid, ox, oy) {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const color = row[c];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((ox + c) * PX, (oy + r) * PX, PX, PX);
    }
  }
}

function getEyeColors() {
  const moods = {
    neutral: { bright: C.EG, dark: C.ED, hl: C.EL },
    happy:   { bright: "#7aff7a", dark: "#2a882a", hl: "#ccffcc" },
    sad:     { bright: C.BL, dark: "#2a4466", hl: "#88aadd" },
    excited: { bright: C.YL, dark: "#887700", hl: "#ffee88" },
    angry:   { bright: C.RD, dark: "#881111", hl: "#ff8888" },
    love:    { bright: C.PK, dark: "#883344", hl: "#ffbbcc" },
    confused:{ bright: "#cccc44", dark: "#666622", hl: "#eeff88" },
    sleepy:  { bright: "#446644", dark: "#223322", hl: "#668866" },
  };
  return moods[currentMood] || moods.neutral;
}

function render(pose) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const d = (part) => pose[part] || { dx: 0, dy: 0 };
  const bx = (part) => BASE[part].x + d(part).dx;
  const by = (part) => BASE[part].y + d(part).dy;

  // Draw order: feet, body, arms, scarf tail, head, ears, scarf, eyes
  drawPixels(FOOT, bx("footL"), by("footL"));
  drawPixels(FOOT, bx("footR"), by("footR"));
  drawPixels(ARM, bx("armL"), by("armL"));
  drawPixels(ARM, bx("armR"), by("armR"));
  drawPixels(BODY, bx("body"), by("body"));
  drawPixels(SCARF_TAIL, bx("scarfTail"), by("scarfTail"));
  drawPixels(HEAD, bx("head"), by("head"));
  drawPixels(EAR_L, bx("earL"), by("earL"));
  drawPixels(EAR_R, bx("earR"), by("earR"));
  drawPixels(SCARF, bx("scarf"), by("scarf"));

  // Eyes
  const ec = getEyeColors();
  const estate = pose.eyeState || "open";

  if (estate === "closed") {
    // Closed eyes: horizontal line
    const elx = bx("eyeL"), ely = by("eyeL");
    const erx = bx("eyeR"), ery = by("eyeR");
    ctx.fillStyle = ec.bright;
    ctx.fillRect((elx) * PX, (ely + 1) * PX, 3 * PX, PX);
    ctx.fillRect((erx) * PX, (ery + 1) * PX, 3 * PX, PX);
  } else if (estate === "wide") {
    // Wide eyes: bigger
    const eyeWide = [
      [C._,     ec.bright, ec.bright, C._],
      [ec.bright, ec.dark,  ec.dark,  ec.bright],
      [ec.bright, ec.dark,  ec.hl,    ec.bright],
      [C._,     ec.bright, ec.bright, C._],
    ];
    drawPixels(eyeWide, bx("eyeL") - 0, by("eyeL") - 0);
    drawPixels(eyeWide, bx("eyeR") - 0, by("eyeR") - 0);
  } else if (estate === "angry") {
    // Angry: angled brows via shifted pixels
    const eyeAngry = makeEye(C.RD, "#881111", "#ff8888");
    drawPixels(eyeAngry, bx("eyeL"), by("eyeL"));
    drawPixels(eyeAngry, bx("eyeR"), by("eyeR"));
    // Brow lines
    ctx.fillStyle = C.RD;
    ctx.fillRect((bx("eyeL")) * PX, (by("eyeL") - 1) * PX, 3 * PX, PX);
    ctx.fillRect((bx("eyeR")) * PX, (by("eyeR") - 1) * PX, 3 * PX, PX);
  } else {
    // Normal open eyes
    const eye = makeEye(ec.bright, ec.dark, ec.hl);
    drawPixels(eye, bx("eyeL"), by("eyeL"));
    drawPixels(eye, bx("eyeR"), by("eyeR"));
  }

  // Mouth
  const ms = pose.mouthState || "normal";
  const mouthX = bx("head") + 7;
  const mouthY = by("head") + 8;
  if (ms === "happy") {
    ctx.fillStyle = ec.bright;
    ctx.fillRect(mouthX * PX, mouthY * PX, PX, PX);
    ctx.fillRect((mouthX + 1) * PX, (mouthY + 1) * PX, PX, PX);
    ctx.fillRect((mouthX - 1) * PX, (mouthY + 1) * PX, PX, PX);
  } else if (ms === "open") {
    ctx.fillStyle = ec.bright;
    ctx.fillRect(mouthX * PX, mouthY * PX, PX, PX);
    ctx.fillRect((mouthX - 1) * PX, mouthY * PX, PX, PX);
    ctx.fillRect((mouthX + 1) * PX, mouthY * PX, PX, PX);
  }
  // "normal" = no visible mouth (screen shows eyes only)
}

// ========== ANIMATION ENGINE ==========

let currentAnim = "idle";
let currentFrame = 0;
let frameTimer = 0;
let lastTime = 0;

function playAnim(name) {
  if (!ANIMS[name]) return;
  currentAnim = name;
  currentFrame = 0;
  frameTimer = 0;
}

function tick(time) {
  if (!lastTime) lastTime = time;
  const dt = time - lastTime;
  lastTime = time;

  const anim = ANIMS[currentAnim];
  if (anim) {
    frameTimer += dt;
    if (frameTimer >= 1000 / anim.fps) {
      frameTimer = 0;
      currentFrame++;
      if (currentFrame >= anim.frames.length) {
        if (anim.loop) {
          currentFrame = 0;
        } else {
          currentFrame = anim.frames.length - 1;
          // Return to idle after a beat
          setTimeout(() => {
            if (currentAnim !== "idle" && currentAnim !== "sleep") {
              playAnim("idle");
            }
          }, 200);
        }
      }
    }
    render(anim.frames[currentFrame]);
  }

  requestAnimationFrame(tick);
}

// ========== ACTION MAP ==========

const ACTION_MAP = {
  jump: "jump", spin: "spin", shake: "shake", wave: "wave",
  dance: "dance", sleep: "sleep", bounce: "bounce", nod: "nod",
  poke: null, // handled specially
};

function playAnimation(action) {
  if (action === "poke") {
    const pick = POKE_ANIMS[Math.floor(Math.random() * POKE_ANIMS.length)];
    playAnim(pick);
  } else {
    const name = ACTION_MAP[action];
    if (name && ANIMS[name]) {
      playAnim(name);
    }
  }
}

function setMood(mood) {
  currentMood = mood;
  const upper = mood.toUpperCase();
  if (moodText) moodText.textContent = upper;
  if (statMood) statMood.textContent = upper;
}

// ========== SESSION & CHAT ==========

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

// ========== INTERACTIONS ==========

canvas.addEventListener("click", () => {
  const pick = POKE_ANIMS[Math.floor(Math.random() * POKE_ANIMS.length)];
  playAnim(pick);
  sendMessage("*用户戳了你一下*");
});

canvas.style.cursor = "pointer";

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
  playAnim("idle");
  showBubble("SYS RESET OK");
});

chatToggle.addEventListener("click", () => {
  contentGrid.classList.toggle("chat-hidden");
  chatToggle.classList.toggle("active", !contentGrid.classList.contains("chat-hidden"));
});
chatToggle.classList.add("active");

// ========== INIT ==========

render(defaultPose());
requestAnimationFrame(tick);
showBubble("CLICK ME!");
