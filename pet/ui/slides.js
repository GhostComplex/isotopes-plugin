const SLIDES = [
  {
    num: 1,
    title: "PROJECT ISOTOPES",
    subtitle: "AI Agent 自我迭代实践",
    content: [
      "Ste.Z  /  Ghost Complex"
    ],
    type: "cover"
  },
  {
    num: 2,
    title: "ISOTOPES 是什么",
    content: [
      "一个轻量、可自托管、高度可定制、面向多 Agent 协作和自身代码 / Prompt 迭代的 AI agent framework。"
    ],
    tags: [
      { label: "RUNTIME", desc: "多 Agent Runtime" },
      { label: "ORCH", desc: "Subagent Orchestration" },
      { label: "API", desc: "Sessions / Logs / API" },
      { label: "DAEMON", desc: "Cron / Heartbeat / Hot-reload" },
      { label: "EXTEND", desc: "Plugins / Sandbox / Permissions" }
    ],
    type: "feature"
  },
  {
    num: 3,
    title: "为什么我们没有停在 OpenClaw",
    items: [
      { label: "代码规模更小", desc: "~2万行 vs ~69万行" },
      { label: "Coding Agent 体验优化", desc: "执行过程可见、可追踪、可打断" },
      { label: "Sandbox 更贴近工程实践", desc: "Git Auth 机制 · Allowed Workspaces 限定" },
      { label: "插件系统更框架化", desc: "transport / UI / tool / hooks 四类扩展" }
    ],
    type: "list"
  },
  {
    num: 4,
    title: "ISOTOPES ARCHITECTURE",
    layers: [
      { label: "INTERFACE LAYER", items: "IM  |  CLI  |  API :2712  |  Plugin UIs" },
      { label: "TRANSPORT LAYER", items: "Discord  |  Feishu  |  HTTP/API  |  Plugin Transport" },
      { label: "CORE RUNTIME", items: "Agent Manager  |  runAgentLoop()  |  Tool Dispatch  |  Subagent Backend" },
      { label: "PLUGIN SYSTEM", items: "Transport  |  UI  |  Tool  |  Lifecycle Hooks" },
      { label: "PERSISTENCE & INFRA", items: "Sessions  |  Hot Reload  |  Sandbox  |  Daemon  |  Skills" }
    ],
    type: "architecture"
  },
  {
    num: 5,
    title: "> BEFORE WE START",
    content: [],
    type: "divider"
  },
  {
    num: 6,
    title: "Prompt Engineering 与上下文腐化",
    formula: "max  P( output | context )",
    subtitle: "LLM 本质是条件概率生成：给定上下文，输出概率最高的 token 序列。在它自己的分布下，输出永远是「最优解」。",
    items: [
      { num: "01", label: "认同倾向 Sycophancy", desc: "P(agree) >> P(disagree) — 模型倾向于认同说话者和自己先前的输出，持续强化错误判断。" },
      { num: "02", label: "误差积累 Context Drift", desc: "output(t) → context(t+1) — 每步输出成为下步 prior，一步错则后续所有「最优解」都基于错误前提展开。" },
      { num: "03", label: "注意力丢失 Lost in the Middle", desc: "长上下文中，模型对中间位置的信息注意力最弱。关键指令被淹没在大量历史对话中遗忘。" }
    ],
    footer: "",
    type: "concept"
  },
  {
    num: 7,
    title: "Harness Engineering",
    subtitle: "Steer & Execute.",
    content: ["工程师的核心工作不再是写代码，而是设计让 Agent 能可靠工作的环境：", "反馈回路、护栏、文档、CI、权限 — 这些「缰绳」才是真正的产出。"],
    loop: ["Steering", "Execution", "Verification", "Reward Function"],
    practices: [
      { label: "Guardrails", desc: "CI + Test" },
      { label: "Role Separation", desc: "Lead 不写代码，Dev 不 review 自己" },
      { label: "Clean Context", desc: "独立 Cron Session，定期用干净上下文纠偏" },
      { label: "Doc as Source", desc: "GitHub Driven: PRD / issues" },
      { label: "Runtime Observability", desc: "产品 log / 截图等运行时状态" }
    ],
    footer: "",
    type: "harness"
  },
  {
    num: 8,
    title: "> How we apply it to Project Isotopes",
    phases: [
      { label: "PHASE 1", name: "Bootstrap", desc: "把 Agent 组织进工程流程" },
      { label: "PHASE 2", name: "Co-Evolution", desc: "让 Agent 参与自身迭代" },
      { label: "PHASE 3", name: "Full Autonomy", desc: "走向完全自主" }
    ],
    type: "phases"
  },
  {
    num: 9,
    title: "PHASE 1: BOOTSTRAP",
    subtitle: "角色拆分正确后，Agent 已经可以完成完整的软件交付闭环。",
    roles: [
      { icon: "", name: "STEINS", desc: "定方向 · PRD · 验收" },
      { icon: "", name: "MAJOR", desc: "AI Tech Lead" },
      { icon: "", name: "TACHIKOMA", desc: "AI Dev · subagent" }
    ],
    flow: "design doc → review → code → test → merge",
    stats: [
      { value: "5", label: "milestones<br>一晚完成" },
      { value: "19", label: "PRs merged" },
      { value: "741", label: "tests" }
    ],
    footer: "",
    type: "phase1"
  },
  {
    num: 10,
    title: "HOW IT RUNS",
    columns: [
      { label: "LEAD", desc: "Tech Lead Skill", items: ["拆 issue / 分配任务", "review PR / merge", "节奏控制 / 质量把关"] },
      { label: "DEV", desc: "Dev Skill", items: ["spawn subagent 写代码", "跑测试 / 开 PR", "执行具体改动"] }
    ],
    antiCorruption: [
      { num: "01", text: "Coding 与 Review 角色分离 — 写代码的不能 review 自己" },
      { num: "02", text: "善用 Claude Code subagent — subagent 执行写码，主 agent 专注审查" },
      { num: "03", text: "管理者上下文专注管理与审核 — Lead 不写实现代码" },
      { num: "04", text: "CI + Test = Ground Truth — 测试和 CI 是最基础的事实来源" },
      { num: "05", text: "GitHub Driven Development — 用 GitHub 管理和共享一切" },
      { num: "06", text: "独立 Cron Session 纠偏 — 干净上下文定期巡检" }
    ],
    footer: "",
    type: "roles"
  },
  {
    num: 11,
    title: "PHASE 2: CO-EVOLUTION",
    subtitle: "当系统开始运行在自己的代码上，关键问题变成「能不能稳定地改自己」。",
    stats: [
      { value: "4 天", label: "v0.2.0 → v0.1.0" },
      { value: "60+", label: "PRs merged" },
      { value: "817→1973", label: "tests 增长" }
    ],
    footer: "",
    type: "phase2"
  },
  {
    num: 12,
    title: "HOW IT WORKS: Phase 2 反馈机制",
    same: [
      { label: "GitHub = Ground Truth", desc: "PRD / issues / 进度管理依然在 GitHub" },
      { label: "Cron 纠偏", desc: "独立 session 定期观察 Discord 状态，干净上下文纠偏" }
    ],
    different: {
      title: "Phase 2 的关键不同：反馈函数 = 系统运行的真实表现",
      items: [
        { label: "State", desc: "运行中的代码 + Discord 行为" },
        { label: "Reward", desc: "系统 log / 异常 / 用户反馈" },
        { label: "Policy Update", desc: "改代码 / 改配置 / 写入 MEMORY" }
      ]
    },
    note: "Phase 1 的反馈来自 review（主观）  Phase 2 的反馈来自系统运行（客观）  → 更真实的 ground truth，更强的抗腐化",
    footer: "",
    type: "feedback"
  },
  {
    num: 13,
    title: "PHASE 3: FULL AUTONOMY",
    subtitle: 'Tech Lead 和 Dev 都跑在 <span class="hl-orange">Isotopes</span> 上，<span class="hl-orange">Isotopes</span> 自己在写自己。',
    agents: [
      { name: "Major", role: "Isotopes / Lead", tasks: ["拆 issue / review PR", "管理节奏 / 质量把关", "监控 Fairy 状态"] },
      { name: "Fairy", role: "Isotopes / Dev", tasks: ["改自己代码 / 跑测试", "开 PR / spawn subagent", "监控 Major 状态"] }
    ],
    note: "",
    points: [
      "反馈函数不变 — 系统运行表现 + log = ground truth",
      "多角色暴露更多问题 — Lead/Dev 交互面更大，覆盖更多边界",
      "Isotopes 写 Isotopes — 代码、runtime、部署全部自闭环"
    ],
    type: "phase3"
  },
  {
    num: 14,
    title: "> Harness Engineering",
    subtitle: "Steer & Execute.",
    pillars: ["角色分离", "独立上下文纠偏", "GitHub Driven", "CI + Test Ground Truth"],
    type: "summary"
  },
  {
    num: 15,
    title: "",
    quote: "我们不是在训练一个更聪明的 Agent。",
    quote2: "我们是在设计一个让 Agent 能持续变靠谱的系统。",
    label: "PROJECT ISOTOPES",
    type: "ending"
  }
];

let current = 0;
const total = SLIDES.length;
const slideArea = document.getElementById('slide-area');
const counter = document.getElementById('counter');
const progressFill = document.getElementById('progress-fill');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

function pad(n) { return String(n).padStart(2, '0'); }

function renderSlide(s) {
  const h = (tag, cls, text) => `<${tag} class="${cls}">${text}</${tag}>`;
  const title = s.title ? h('div', 'slide-title', esc(s.title)) : '';
  const subtitle = s.subtitle ? `<div class="slide-subtitle">${s.subtitle}</div>` : '';
  const footer = s.footer ? `<div class="slide-footer">${esc(s.footer)}</div>` : '';

  switch (s.type) {
    case 'cover':
      return `<div class="s-cover">
        <div class="cover-title">${esc(s.title)}</div>
        <div class="cover-subtitle">${esc(s.subtitle)}</div>
        <div class="cover-content">${s.content.map(c => esc(c)).join('<br>')}</div>
      </div>`;

    case 'feature':
      return `${title}
        <div class="f-desc">${s.content.map(c => esc(c)).join('<br>')}</div>
        <div class="tag-grid">${s.tags.map((t, i) => `
          <div class="tag-card" style="animation-delay:${i * 0.1}s">
            <div class="tag-label">${esc(t.label)}</div>
            <div class="tag-desc">${esc(t.desc)}</div>
          </div>`).join('')}
        </div>`;

    case 'list':
      return `${title}
        <div class="list-cards">${s.items.map((i, idx) => `
          <div class="list-card" style="animation-delay:${idx * 0.12}s">
            <div class="list-num">${pad(idx + 1)}</div>
            <div class="list-label">${esc(i.label)}</div>
            <div class="list-desc">${esc(i.desc)}</div>
          </div>`).join('')}
        </div>`;

    case 'architecture':
      return `${title}
        <div class="arch-diagram">
        ${s.layers.map((l, i) => `
          <div class="arch-layer${i === 2 ? ' arch-layer--core' : ''}" style="animation-delay:${i * 0.15}s">
            <div class="layer-header">
              <span class="layer-label">${esc(l.label)}</span>
            </div>
            <div class="layer-items">
              ${l.items.split('  |  ').map(item => `<span class="layer-chip">${esc(item.trim())}</span>`).join('')}
            </div>
          </div>
          ${i < s.layers.length - 1 ? '<div class="arch-arrow"><span class="arch-arrow-line"></span><span class="arch-arrow-head">▼</span></div>' : ''}
        `).join('')}
        </div>`;

    case 'divider':
      return `<div class="s-divider">
        <div class="divider-title blink-cursor">${esc(s.title)}</div>
      </div>`;

    case 'concept':
      return `${title}
        <div class="formula-box">${esc(s.formula)}</div>
        <div class="concept-subtitle">${esc(s.subtitle)}</div>
        <div class="concept-items">${s.items.map(i => `
          <div class="concept-item">
            <div class="concept-num">${esc(i.num)}</div>
            <div>
              <div class="concept-label">${esc(i.label)}</div>
              <div class="concept-desc">${esc(i.desc)}</div>
            </div>
          </div>`).join('')}
        </div>
        ${footer}`;

    case 'harness':
      return `${title}
        <div class="harness-subtitle">${esc(s.subtitle)}</div>
        <div class="harness-desc">${s.content.map(c => esc(c)).join('<br>')}</div>
        <div class="harness-columns">
          <div class="harness-col-left">
            <div class="harness-loop-circle">
              <div class="loop-orbit"></div>
              <div class="loop-arrow-ring"></div>
              ${s.loop.map((l, i) => `<div class="loop-step loop-step-${i}">${esc(l)}</div>`).join('')}
            </div>
          </div>
          <div class="harness-col-right">
            ${s.practices.map((p, i) => `<div class="practice-card" style="animation-delay:${i * 0.1}s">
              <div class="practice-label">${esc(p.label)}</div>
              <div class="practice-desc">${esc(p.desc)}</div>
            </div>`).join('')}
          </div>
        </div>
        ${footer}`;

    case 'phases':
      return `${title}
        <div class="phase-grid">${s.phases.map(p => `
          <div class="phase-box">
            <div class="phase-label">${esc(p.label)}</div>
            <div class="phase-name">${esc(p.name)}</div>
            <div class="phase-desc">${esc(p.desc)}</div>
          </div>`).join('')}
        </div>`;

    case 'phase1':
      return `${title}${subtitle}
        <div class="roles-row">${s.roles.map(r => `
          <div class="role-card">
            <div class="role-icon">${r.icon}</div>
            <div class="role-name">${esc(r.name)}</div>
            <div class="role-desc">${esc(r.desc)}</div>
          </div>`).join('')}
        </div>
        <div class="flow-line">${esc(s.flow)}</div>
        <div class="stats-row">${s.stats.map(st => `
          <div class="stat-box">
            <div class="stat-value">${esc(st.value)}</div>
            <div class="stat-label">${st.label}</div>
          </div>`).join('')}
        </div>
        ${footer}`;

    case 'roles':
      return `${title}
        <div class="columns-row">${s.columns.map(c => `
          <div class="col-box">
            <div class="col-label">${esc(c.label)}</div>
            <div class="col-desc">${esc(c.desc)}</div>
            <ul class="col-items">${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
          </div>`).join('')}
        </div>
        <div class="ac-list">${s.antiCorruption.map(a => `
          <div class="ac-item">
            <div class="ac-num">${esc(a.num)}</div>
            <div class="ac-text">${esc(a.text)}</div>
          </div>`).join('')}
        </div>
        ${footer}`;

    case 'phase2':
      return `${title}
        <div class="phase2-subtitle">${esc(s.subtitle)}</div>
        <div class="stats-row">${s.stats.map(st => `
          <div class="stat-box">
            <div class="stat-value">${esc(st.value)}</div>
            <div class="stat-label">${st.label}</div>
          </div>`).join('')}
        </div>
        ${footer}`;

    case 'feedback':
      return `${title}
        <div class="fb-columns">
          <div class="fb-section">
            <div class="fb-title">[ INHERITED ]</div>
            <div class="fb-items">${s.same.map(i => `
              <div class="fb-item">
                <div class="fb-label">${esc(i.label)}</div>
                <div class="fb-desc">${esc(i.desc)}</div>
              </div>`).join('')}
            </div>
          </div>
          <div class="fb-section">
            <div class="fb-title">[ EVOLVED ]</div>
            <div class="fb-diff-title">${esc(s.different.title)}</div>
            <div class="fb-items">${s.different.items.map(i => `
              <div class="fb-item">
                <div class="fb-label">${esc(i.label)}</div>
                <div class="fb-desc">${esc(i.desc)}</div>
              </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="fb-note">${esc(s.note)}</div>
        ${footer}`;

    case 'phase3':
      return `${title}${subtitle}
        <div class="agent-grid">${s.agents.map(a => `
          <div class="agent-card">
            <div class="agent-name">${esc(a.name)}</div>
            <div class="agent-role">${esc(a.role)}</div>
            <ul class="agent-tasks">${a.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          </div>`).join('')}
        </div>
        <div class="agent-note">${esc(s.note)}</div>
        <ul class="points-list">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;

    case 'summary':
      return `<div class="s-summary">
        <div class="summary-title">${esc(s.title)}</div>
        <div class="summary-subtitle">${esc(s.subtitle)}</div>
        <div class="pillar-grid">${s.pillars.map(p => `
          <div class="pillar-box">${esc(p)}</div>`).join('')}
        </div>
      </div>`;

    case 'ending':
      return `<div class="s-ending">
        <div class="end-quote">${esc(s.quote)}</div>
        <div class="end-quote2">${esc(s.quote2)}</div>
        <div class="end-label">${esc(s.label)}</div>
      </div>`;

    default:
      return `${title}<p>${JSON.stringify(s)}</p>`;
  }
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function show(idx, dir) {
  if (idx < 0 || idx >= total) return;
  const prev = current;
  current = idx;
  update();

  const el = slideArea.querySelector('.slide');
  if (el) {
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      insertSlide();
    }, 200);
  } else {
    insertSlide();
  }
}

function insertSlide() {
  const div = document.createElement('div');
  div.className = 'slide in';
  div.innerHTML = renderSlide(SLIDES[current]);
  const zoom = slideArea.dataset.zoom;
  if (zoom) div.style.zoom = zoom;
  slideArea.appendChild(div);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      div.classList.remove('in');
    });
  });
}

function update() {
  counter.textContent = `${pad(current + 1)} / ${pad(total)}`;
  progressFill.style.width = `${((current + 1) / total) * 100}%`;
  btnPrev.disabled = current === 0;
  btnNext.disabled = current === total - 1;
}

btnPrev.addEventListener('click', () => show(current - 1, -1));
btnNext.addEventListener('click', () => show(current + 1, 1));

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') show(current - 1, -1);
  if (e.key === 'ArrowRight') show(current + 1, 1);
});

// Init
update();
insertSlide();

// ── Zoom slider ──
const zoomSlider = document.getElementById("zoom-slider");
const zoomVal = document.getElementById("zoom-val");
function applyZoom(v) {
  const scale = v / 100;
  const slide = slideArea.querySelector('.slide');
  if (slide) slide.style.zoom = scale;
  slideArea.dataset.zoom = scale;
  zoomVal.textContent = v + "%";
  localStorage.setItem("slides:zoom", v);
}

const savedZoom = localStorage.getItem("slides:zoom");
if (savedZoom) {
  zoomSlider.value = savedZoom;
  applyZoom(savedZoom);
}

zoomSlider.addEventListener("input", () => applyZoom(zoomSlider.value));
