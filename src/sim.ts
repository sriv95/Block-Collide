export type Pt = [number, number];
/** Path point; a third element "p" makes a moving block stop there for PAUSE_S. */
export type PathPt = Pt | [number, number, "p"];
/** `pair`: blocks sharing a group id all start when any one is clicked. */
export type BlockDef = { path: PathPt[]; color?: string; pair?: number };
/** A gate on a cell centre. Toggles open<->closed whenever any block finishes its move. */
export type LockDef = { at: Pt; open: boolean };
/** Grid units. Level `size` = [cols, rows]. Path points are cell centres. */
export type Level = { size: Pt; blocks: BlockDef[]; locks?: LockDef[] };

/** Logical canvas. Real game: 56px block, 500px/s on a 1000x562 canvas with 100px cells. */
export const W = 1000, H = 562;
/** Vertical margin reserved for the LEVEL tab. */
const TOP = 40;
export const SPEED = 5; // cells per second
export const HALF = 0.28; // block half-width in cells
export const PAUSE_S = 1; // stop time at a pause node

/** Cell size and grid origin that centre a level in the canvas. */
export const layout = (lv: Level) => {
  const cs = Math.min(100, W / lv.size[0], (H - 2 * TOP) / lv.size[1]);
  return { cs, ox: (W - lv.size[0] * cs) / 2, oy: (H - lv.size[1] * cs) / 2 };
};

export type Block = { def: BlockDef; len: number; dist: number; moving: boolean; stops: number[]; wait: number };
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
    return { def, len, dist: 0, moving: false, stops, wait: 0 };
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

const near = (p: Pt, q: Pt) => Math.abs(p[0] - q[0]) < 2 * HALF && Math.abs(p[1] - q[1]) < 2 * HALF;
/** Blocks overlapping another block or a closed lock. */
export const hitters = ({ blocks, locks }: State) =>
  blocks.filter((b) => blocks.some((c) => c !== b && near(pos(b), pos(c))) || locks.some((l) => !l.open && near(pos(b), l.at)));

/** Advance moving blocks by dt seconds. Returns true if anything overlaps. */
export const step = (s: State, dt: number): boolean => {
  for (const b of s.blocks) {
    let t = dt;
    while (t > 0 && b.moving) {
      if (b.wait > 0) {
        const w = Math.min(b.wait, t);
        b.wait -= w;
        t -= w;
        continue;
      }
      const next = b.stops[0] ?? b.len;
      const reach = b.dist + SPEED * t;
      if (reach < next) { b.dist = reach; break; }
      t -= (next - b.dist) / SPEED;
      b.dist = next;
      if (b.stops.length) { b.stops.shift(); b.wait = PAUSE_S; }
      else {
        b.moving = false;
        for (const l of s.locks) l.open = !l.open;
      }
    }
  }
  return hitters(s).length > 0;
};

/** Start the block, or its whole pair group, if unfinished. */
export const click = (s: State, b: Block) => {
  for (const c of s.blocks)
    if ((c === b || (b.def.pair !== undefined && c.def.pair === b.def.pair)) && !c.moving && !done(c)) c.moving = true;
};

export const won = (s: State) => s.blocks.every(done);
