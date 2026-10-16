export type Pt = [number, number];
/** Path point; a third element "p" makes a moving block stop there until it is clicked again. */
export type PathPt = Pt | [number, number, "p"];
/** `pair`: blocks sharing a group id all start when any one is clicked. `rot`: degrees the block square is turned. */
export type BlockDef = { path: PathPt[]; color?: string; pair?: number; rot?: number };
/** A gate on a cell centre. Toggles open<->closed every time a block is clicked to move. */
export type LockDef = { at: Pt; open: boolean; rot?: number };
/** Path points and locks are in cells from the stage's top-left corner (1 cell = 100 logical px). */
export type Level = { blocks: BlockDef[]; locks?: LockDef[] };

/** Logical canvas. Real game: 56px block, 500px/s on a 1000x562 stage. */
export const W = 1000, H = 562;
export const CELL = 100; // logical px per cell
export const SPEED = 5; // cells per second
export const HALF = 0.28; // block half-width in cells (drawn)
export const HIT = 0.25; // collision half-width: a little smaller than drawn, so near misses pass

export type Block = { def: BlockDef; len: number; dist: number; moving: boolean; stops: number[] };
export type State = { blocks: Block[]; locks: LockDef[] };

const segLen = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const makeState = (lv: Level): State => ({
  blocks: lv.blocks.map((def) => {
    const p = def.path;
    let len = 0;
    const stops: number[] = [];
    for (let i = 1; i < p.length; i++) {
      len += segLen(p[i - 1] as Pt, p[i] as Pt);
      if (p[i][2] && i < p.length - 1) stops.push(len); // a pause on the final point is ignored
    }
    return { def, len, dist: 0, moving: false, stops };
  }),
  locks: (lv.locks ?? []).map((l) => ({ ...l })),
});

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

export const done = (b: Block) => b.dist >= b.len;

/** Separating-axis test for two turned squares of half-width `h` (degrees). */
export const overlap = (p: Pt, r: number, q: Pt, t: number, h = HIT) => {
  const dx = q[0] - p[0], dy = q[1] - p[1], k = Math.PI / 180;
  return [r, r + 90, t, t + 90].every((a) => {
    const c = Math.cos(a * k), s = Math.sin(a * k);
    const ext = (m: number) => h * (Math.abs(Math.cos((m - a) * k)) + Math.abs(Math.sin((m - a) * k)));
    return Math.abs(dx * c + dy * s) < ext(r) + ext(t) - 1e-9;
  });
};
const rot = (b: Block) => b.def.rot ?? 0;
/** Blocks overlapping another block or a closed lock. */
export const hitters = ({ blocks, locks }: State) =>
  blocks.filter((b) => blocks.some((c) => c !== b && overlap(pos(b), rot(b), pos(c), rot(c))) || locks.some((l) => !l.open && overlap(pos(b), rot(b), l.at, l.rot ?? 0)));

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
  return hitters(s).length > 0;
};

/** Start the block, or its whole pair group, if unfinished. Every start flips all locks. */
export const click = (s: State, b: Block) => {
  let started = false;
  for (const c of s.blocks)
    if ((c === b || (b.def.pair !== undefined && c.def.pair === b.def.pair)) && !c.moving && !done(c)) c.moving = started = true;
  if (started) for (const l of s.locks) l.open = !l.open;
};

export const won = (s: State) => s.blocks.every(done);
