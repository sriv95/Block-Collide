import "./style.css";
import { levels } from "./levels";
import { H, HALF, W, click, done, hitters, layout, makeState, pos, step, won, type Block, type PathPt, type State } from "./sim";
import { get, put } from "./store";

const COLORS = ["#2fbf5b", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#facc15", "#ef4444", "#8b5e34"];
const PAIRS = ["#0891b2", "#c2410c", "#65a30d", "#be123c"];
const BG = "#e9eef4", LINE = 3;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>("c");
const ctx = cv.getContext("2d")!;
const game = $("game"), fadeEl = $("fade"), settings = $("settings");

type St = "title" | "select" | "play" | "crash" | "win" | "fade";
let st: St = "title";
let li = 0;
let sim: State = { blocks: [], locks: [] };
let crashed: Block[] = [];
let timer = 0;
let last = performance.now();
let mouse: [number, number] = [-1e4, -1e4];
let unlocked = Math.min(levels.length, Math.max(1, Number(get("bc-unlocked")) || 1));

const inLevel = () => st !== "title" && st !== "select";
const paused = () => !settings.hidden;
const set = (s: St) => {
  st = s;
  game.dataset.state = s;
  $("title").hidden = s !== "title";
  $("select").hidden = s !== "select";
  $("lvl").hidden = $("restart").hidden = !inLevel();
};

/** Fade to black over `ms`, run cb while black, then fade back in. */
const fade = (ms: number, cb: () => void) => {
  fadeEl.style.transition = `opacity ${ms}ms`;
  fadeEl.style.opacity = "1";
  timer = window.setTimeout(() => {
    cb();
    fadeEl.style.transition = "opacity 400ms";
    fadeEl.style.opacity = "0";
  }, ms);
};

const load = (i: number) => {
  li = i;
  sim = makeState(levels[i]);
  crashed = [];
  $("lvl").textContent = `LEVEL ${i + 1}`;
  set("play");
};

const select = () => {
  clearTimeout(timer);
  fadeEl.style.transition = "none";
  fadeEl.style.opacity = "0";
  $("tiles").replaceChildren(
    ...levels.map((_, i) => {
      const b = document.createElement("button");
      b.className = "tile";
      b.textContent = String(i + 1);
      b.disabled = i >= unlocked;
      b.onclick = () => load(i);
      return b;
    }),
  );
  set("select");
};

const restart = () => {
  if (st !== "play") return;
  set("fade");
  fade(400, () => load(li));
};

const onWin = () => {
  set("win");
  if (li + 1 >= unlocked && li + 1 < levels.length) put("bc-unlocked", String((unlocked = li + 2)));
  fade(1000, () => (li + 1 < levels.length ? load(li + 1) : select()));
};

const onCrash = () => {
  crashed = hitters(sim);
  set("crash");
  timer = window.setTimeout(() => fade(500, () => load(li)), 1000);
};

// ---- drawing ----
const blockAt = (b: Block) => {
  const { cs, ox, oy } = layout(levels[li]);
  const [x, y] = pos(b);
  return { cs, x: ox + (x + 0.5) * cs, y: oy + (y + 0.5) * cs };
};

const pick = (): Block | undefined =>
  st !== "play" || paused()
    ? undefined
    : [...sim.blocks].reverse().find((b) => {
        if (b.moving || done(b)) return false;
        const { cs, x, y } = blockAt(b);
        return Math.abs(mouse[0] - x) <= HALF * cs && Math.abs(mouse[1] - y) <= HALF * cs;
      });

const arrow = (x: number, y: number, a: number, c: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(-5, -9); ctx.lineTo(8, 0); ctx.lineTo(-5, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** Pair-group accent: a small diamond on the block's top-right corner. */
const diamond = (x: number, y: number, r: number, c: string) => {
  ctx.fillStyle = c;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const padlock = (x: number, y: number, s: number, open: boolean, c: string) => {
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 4;
  ctx.fillRect(x - s * 0.22, y - s * 0.02, s * 0.44, s * 0.3);
  ctx.beginPath();
  ctx.arc(x, y - s * 0.02, s * 0.14, open ? Math.PI * 1.2 : Math.PI, 0);
  ctx.stroke();
};

const square = (x: number, y: number, s: number, fill: string, stroke: string) => {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE;
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.strokeRect(x - s / 2, y - s / 2, s, s);
};

const draw = () => {
  const k = cv.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (!inLevel()) return;
  const { cs, ox, oy } = layout(levels[li]);
  const s = 2 * HALF * cs;
  const P = ([x, y]: PathPt) => [ox + (x + 0.5) * cs, oy + (y + 0.5) * cs] as const;
  const col = (i: number) => COLORS[i % COLORS.length];

  sim.blocks.forEach((b, i) => {
    const p = b.def.path;
    ctx.strokeStyle = col(i);
    ctx.lineWidth = 12;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    // original erases the path behind the block: draw only what is left ahead of it
    let d = b.dist;
    let n = 1;
    while (n < p.length - 1 && d >= Math.hypot(p[n][0] - p[n - 1][0], p[n][1] - p[n - 1][1])) {
      d -= Math.hypot(p[n][0] - p[n - 1][0], p[n][1] - p[n - 1][1]);
      n++;
    }
    ctx.moveTo(...P(pos(b)));
    for (; n < p.length; n++) ctx.lineTo(...P(p[n]));
    ctx.stroke();
  });
  // pause nodes: clock-like disc with two bars
  sim.blocks.forEach((b, i) =>
    b.def.path.forEach((q, n) => {
      if (!q[2] || n === b.def.path.length - 1) return;
      const [x, y] = P(q);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = col(i);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.fillRect(x - 5, y - 6, 3.5, 12);
      ctx.fillRect(x + 1.5, y - 6, 3.5, 12);
    }),
  );
  sim.blocks.forEach((b, i) => {
    const [x, y] = P(b.def.path.at(-1)!);
    const pc = b.def.pair === undefined ? undefined : PAIRS[b.def.pair % PAIRS.length];
    if (!done(b)) {
      ctx.setLineDash([6, 7]);
      square(x, y, s, BG, "#000");
      ctx.setLineDash([]);
      if (pc) diamond(x + s / 2, y - s / 2, 8, pc);
      return;
    }
    square(x, y, s, "#fff", COLORS[0]);
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 11, y); ctx.lineTo(x - 3, y + 9); ctx.lineTo(x + 12, y - 9);
    ctx.stroke();
  });
  sim.locks.forEach((l) => {
    const [x, y] = P(l.at);
    if (l.open) {
      ctx.setLineDash([3, 6]);
      square(x, y, s, "rgba(0,0,0,0.04)", "rgba(0,0,0,0.35)");
      ctx.setLineDash([]);
      padlock(x, y, s, true, "rgba(0,0,0,0.3)");
    } else {
      square(x, y, s, "#1f2937", "#111827");
      padlock(x, y, s, false, "#e5e7eb");
    }
  });
  const hov = pick();
  cv.style.cursor = hov ? "pointer" : "default";
  sim.blocks.forEach((b) => {
    if (done(b)) return;
    const pair = b.def.pair;
    const pc = pair === undefined ? undefined : PAIRS[pair % PAIRS.length];
    const hot = hov && (b === hov || (pair !== undefined && hov.def.pair === pair));
    const { x, y } = blockAt(b);
    const [a, c] = b.def.path;
    const ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
    if (crashed.includes(b)) {
      square(x, y, s, "#ef4444", "#7f1d1d");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, 0, 7);
      ctx.moveTo(x - s * 0.21, y - s * 0.21); ctx.lineTo(x + s * 0.21, y + s * 0.21);
      ctx.stroke();
    } else if (hot) {
      square(x, y, s * 0.9, "#000", pc ?? "#000");
      arrow(x, y, ang, "#fff");
    } else {
      square(x, y, s, "#fff", pc ?? "#000");
      arrow(x, y, ang, "#000");
    }
    if (pc) diamond(x + s / 2, y - s / 2, 8, pc);
  });
};

const tick = (now: number) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (st === "play" && !paused()) {
    if (step(sim, dt)) onCrash();
    else if (won(sim)) onWin();
  }
  draw();
  requestAnimationFrame(tick);
};

// ---- input ----
const track = (e: PointerEvent) => {
  const r = cv.getBoundingClientRect();
  mouse = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
};
cv.addEventListener("pointermove", track);
cv.addEventListener("pointerleave", () => (mouse = [-1e4, -1e4]));
cv.addEventListener("pointerdown", (e) => {
  track(e);
  const b = pick();
  if (b) click(sim, b);
});

// ---- settings ----
const toggleSettings = (open = settings.hidden) => {
  settings.hidden = !open;
  $("sr").hidden = $("sq").hidden = !inLevel();
};

$("start").onclick = select;
$("gear").onclick = () => toggleSettings();
$("resume").onclick = () => toggleSettings(false);
$("sr").onclick = () => { toggleSettings(false); restart(); };
$("sq").onclick = () => { toggleSettings(false); select(); };
$("restart").onclick = restart;
addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") toggleSettings();
  else if (e.key.toLowerCase() === "r" && !paused()) restart();
});

const fit = () => {
  const r = game.getBoundingClientRect(), d = devicePixelRatio || 1;
  cv.width = Math.round(r.width * d);
  cv.height = Math.round(r.height * d);
};
addEventListener("resize", fit);

fit();
set("title");
requestAnimationFrame(tick);
