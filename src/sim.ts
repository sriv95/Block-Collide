export type Pt = [number, number];
/** Path point; a third element "p" makes a moving block stop there until it is clicked again. "j" makes the block jump to the point from the one before it (a portal pair). */
export type PathPt = Pt | [number, number, "p" | "j"];
/** `pair`: blocks sharing a group id all start when any one is clicked. `rot`: degrees the block square is turned. */
export type BlockDef = { path: PathPt[]; color?: string; pair?: number; rot?: number };
/** A gate on a block's path. Toggles open<->closed every time a block is clicked to move, and is gone once its block has passed it. */
export type LockDef = { at: Pt; open: boolean; rot?: number };
/** Lock in play: `owner` is the block whose path it sits on, `d` its distance along that path. */
export type LockState = LockDef & { owner: number; d: number };
/** Path points and locks are in cells from the stage's top-left corner (1 cell = 100 logical px). */
export type Level = { blocks: BlockDef[]; locks?: LockDef[] };

/** Logical canvas. Real game: 56px block, 500px/s on a 1000x562 stage. */
export const W = 1000, H = 562;
export const CELL = 100; // logical px per cell
export const SPEED = 5; // cells per second
export const HALF = 0.28; // block half-width in cells (drawn)
// Collision half-widths in cells, fitted to crash/no-crash tests in the real game.
export const HIT_STRAIGHT = 0.302; // blocks not turned (collider a little bigger than the drawn 0.28)
export const HIT_TURNED = 0.281; // blocks turned 45 degrees (collider as drawn)
export const HIT_LOCK = 0.22; // locks: smaller, so a block may graze one

export type Block = { def: BlockDef; len: number; dist: number; moving: boolean; stops: number[] };
export type State = { blocks: Block[]; locks: LockState[] };

export const segLen = (a: PathPt, b: PathPt) => (b[2] === "j" ? 0 : Math.hypot(b[0] - a[0], b[1] - a[1]));

/** Which block's path a point lies on, and how far along it. */
const onPath = (blocks: Block[], at: Pt) => {
  let best = { owner: -1, d: 0, gap: 0.2 }; // farther than 0.2 cells from every path: no owner
  blocks.forEach((b, owner) => {
    let base = 0;
    const p = b.def.path;
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i], l = segLen(p[i - 1] as Pt, p[i] as Pt);
      const t = l ? Math.max(0, Math.min(1, ((at[0] - x0) * (x1 - x0) + (at[1] - y0) * (y1 - y0)) / (l * l))) : 0;
      const gap = Math.hypot(at[0] - (x0 + (x1 - x0) * t), at[1] - (y0 + (y1 - y0) * t));
      if (gap < best.gap) best = { owner, d: base + t * l, gap };
      base += l;
    }
  });
  return best;
};

export const makeState = (lv: Level): State => {
  const blocks = lv.blocks.map((def) => {
    const p = def.path;
    let len = 0;
    const stops: number[] = [];
    for (let i = 1; i < p.length; i++) {
      len += segLen(p[i - 1] as Pt, p[i] as Pt);
      if (p[i][2] === "p" && i < p.length - 1) stops.push(len); // a pause on the final point is ignored
    }
    return { def, len, dist: 0, moving: false, stops };
  });
  return { blocks, locks: (lv.locks ?? []).map((l) => ({ ...l, ...onPath(blocks, l.at) })) };
};

export const pos = (b: Block): Pt => {
  let d = b.dist;
  const p = b.def.path;
  for (let i = 1; i < p.length; i++) {
    const l = segLen(p[i - 1] as Pt, p[i] as Pt);
    if (d <= l) {
      const t = l ? d / l : 0;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
    }
    d -= l;
  }
  return p[p.length - 1].slice(0, 2) as Pt;
};

/** Direction (radians) of the path segment the block is on; at a corner, the segment it will take next. */
export const heading = (b: Block): number => {
  let d = b.dist;
  const p = b.def.path;
  for (let i = 1; i < p.length; i++) {
    const l = segLen(p[i - 1] as Pt, p[i] as Pt);
    if (d < l || i === p.length - 1) return Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]);
    d -= l;
  }
  return 0;
};

export const done = (b: Block) => b.dist >= b.len;

/** Collision half-width of a block turned `r` degrees. */
export const half = (r: number) => (r % 90 === 0 ? HIT_STRAIGHT : HIT_TURNED);
/** Separating-axis test for two turned squares of half-widths `h`, `g` (degrees). */
export const overlap = (p: Pt, r: number, q: Pt, t: number, h = half(r), g = half(t)) => {
  const dx = q[0] - p[0], dy = q[1] - p[1], k = Math.PI / 180;
  return [r, r + 90, t, t + 90].every((a) => {
    const c = Math.cos(a * k), s = Math.sin(a * k);
    const ext = (m: number, w: number) => w * (Math.abs(Math.cos((m - a) * k)) + Math.abs(Math.sin((m - a) * k)));
    return Math.abs(dx * c + dy * s) < ext(r, h) + ext(t, g) - 1e-9;
  });
};
const rot = (b: Block) => b.def.rot ?? 0;
/** Blocks overlapping another block or a closed lock. */
export const hitters = ({ blocks, locks }: State) =>
  blocks.filter((b) => blocks.some((c) => c !== b && overlap(pos(b), rot(b), pos(c), rot(c))) || locks.some((l) => !l.open && overlap(pos(b), rot(b), l.at, l.rot ?? 0, half(rot(b)), HIT_LOCK)));

/** Advance moving blocks by dt seconds. Returns true if anything overlaps. */
export const step = (s: State, dt: number): boolean => {
  for (const b of s.blocks) {
    if (!b.moving) continue;
    const next = b.stops[0] ?? b.len;
    b.dist = Math.min(next, b.dist + SPEED * dt);
    if (b.dist < next) continue;
    b.moving = false;
    b.stops.shift();
  }
  s.locks = s.locks.filter((l) => l.owner < 0 || s.blocks[l.owner].dist <= l.d);
  return hitters(s).length > 0;
};

/** Start the block, or its whole pair group, if unfinished. Every start flips all locks. Ignored while any block is moving (as in the original). */
export const click = (s: State, b: Block) => {
  if (s.blocks.some((c) => c.moving)) return;
  let started = false;
  for (const c of s.blocks)
    if ((c === b || (b.def.pair !== undefined && c.def.pair === b.def.pair)) && !c.moving && !done(c)) c.moving = started = true;
  if (started) for (const l of s.locks) l.open = !l.open;
};

export const won = (s: State) => s.blocks.every(done);
