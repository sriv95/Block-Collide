import "./style.css";
import { levels } from "./levels";
import { CELL, H, HALF, W, click, done, heading, hitters, makeState, pos, step, won, type Block, type PathPt, type State } from "./sim";
import { get, put } from "./store";

const COLORS = ["#2fbf5b", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#facc15", "#ef4444", "#8b5e34"];
const BG = "#e9f1f4", LINE = 3;
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
const rad = (b: Block) => ((b.def.rot ?? 0) * Math.PI) / 180;

const pick = (): Block | undefined =>
  st !== "play" || paused()
    ? undefined
    : [...sim.blocks].reverse().find((b) => {
        if (b.moving || done(b)) return false;
        const [x, y] = pos(b), r = rad(b);
        const dx = mouse[0] - x * CELL, dy = mouse[1] - y * CELL;
        // mouse offset in the block's own (turned) frame
        return Math.abs(dx * Math.cos(r) + dy * Math.sin(r)) <= HALF * CELL && Math.abs(dy * Math.cos(r) - dx * Math.sin(r)) <= HALF * CELL;
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

/** Padlock centred on x,y; `rot` turns it with the block squares of its path. */
const padlock = (x: number, y: number, s: number, open: boolean, rot: number) => {
  const c = open ? "#7b7f80" : "#000";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = BG;
  ctx.fillRect(-s / 2, -s / 2, s, s); // cuts the path line behind the lock
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 3.5;
  ctx.fillRect(-s * 0.24, -s * 0.02, s * 0.48, s * 0.34);
  ctx.beginPath();
  ctx.arc(open ? s * 0.06 : 0, -s * 0.04, s * 0.16, open ? Math.PI * 1.15 : Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(0, s * 0.12, s * 0.045, 0, 7);
  ctx.fillRect(-s * 0.02, s * 0.12, s * 0.04, s * 0.12);
  ctx.fill();
  ctx.restore();
};

const square = (x: number, y: number, s: number, fill: string, stroke: string, rot = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
};

/** Pause node: white diamond. */
const node = (x: number, y: number) => {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 19); ctx.lineTo(x + 19, y); ctx.lineTo(x, y + 19); ctx.lineTo(x - 19, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const draw = () => {
  const k = cv.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (!inLevel()) return;
  const s = 2 * HALF * CELL;
  const P = ([x, y]: PathPt) => [x * CELL, y * CELL] as const;
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
  // pause nodes still ahead of their block
  sim.blocks.forEach((b) => {
    let at = 0;
    b.def.path.forEach((q, n, p) => {
      if (n) at += Math.hypot(q[0] - p[n - 1][0], q[1] - p[n - 1][1]);
      if (q[2] && n < p.length - 1 && at > b.dist + 1e-6) node(...P(q));
    });
  });
  sim.blocks.forEach((b) => {
    const [x, y] = P(b.def.path.at(-1)!);
    const r = rad(b);
    if (!done(b)) {
      ctx.setLineDash([6, 7]);
      square(x, y, s, BG, "#000", r);
      ctx.setLineDash([]);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    square(0, 0, s, "#fff", COLORS[0]);
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(-3, 9); ctx.lineTo(12, -9);
    ctx.stroke();
    ctx.restore();
  });
  sim.locks.forEach((l) => padlock(...P(l.at), s, l.open, ((l.rot ?? 0) * Math.PI) / 180));
  const hov = pick();
  cv.style.cursor = hov ? "pointer" : "default";
  sim.blocks.forEach((b) => {
    if (done(b)) return;
    const pair = b.def.pair;
    const hot = hov && (b === hov || (pair !== undefined && hov.def.pair === pair));
    const [x, y] = P(pos(b));
    const ang = heading(b);
    const r = rad(b);
    if (crashed.includes(b)) {
      square(x, y, s, "#fff", "#dc2f2f", r);
      ctx.strokeStyle = "#dc2f2f";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, 0, 7);
      ctx.moveTo(x - s * 0.21, y - s * 0.21); ctx.lineTo(x + s * 0.21, y + s * 0.21);
      ctx.stroke();
      return;
    }
    square(x, y, hot ? s * 0.9 : s, hot ? "#000" : "#fff", "#000", r);
    if (pair === undefined) arrow(x, y, ang, hot ? "#fff" : "#000");
    else {
      ctx.fillStyle = hot ? "#fff" : "#000";
      ctx.font = "600 40px ui-rounded, 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String.fromCharCode(65 + pair), x, y + 2);
    }
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
