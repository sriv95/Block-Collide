import { expect, test } from "bun:test";
import { levels } from "./levels";
import { solutions } from "./solutions";
import { H, W, CELL, click, done, heading, makeState, overlap, pos, step, won, type Level } from "./sim";

const DT = 1 / 120;
/** Replay a click plan; returns whether any click was ignored, whether blocks crashed, and whether the level was won. */
const play = (lv: Level, plan: [number, number][]) => {
  const s = makeState(lv);
  let t = 0, i = 0, ignored = false, crashed = false;
  while (!crashed && t < 60 && !(i >= plan.length && !s.blocks.some((b) => b.moving))) {
    while (i < plan.length && plan[i][1] <= t + 1e-9) {
      const b = s.blocks[plan[i++][0]];
      click(s, b);
      if (!b.moving) ignored = true;
    }
    crashed = step(s, DT);
    t += DT;
  }
  return { ignored, crashed, won: won(s) };
};

test("exactly 40 levels, each with a plan", () => {
  expect(levels.length).toBe(40);
  expect(solutions.length).toBe(40);
});

test("level shapes are valid", () => {
  const maxX = W / CELL, maxY = H / CELL;
  levels.forEach((lv, n) => {
    const pairs = new Map<number, number>();
    for (const { path, pair } of lv.blocks) {
      expect(path.length, `level ${n + 1}`).toBeGreaterThanOrEqual(2);
      expect(path[0][2], `level ${n + 1} pause on start`).toBeUndefined();
      path.forEach(([x, y]) => expect(x > 0.2 && x < maxX - 0.2 && y > 0.2 && y < maxY - 0.2, `level ${n + 1} in stage`).toBe(true));
      if (pair !== undefined) pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    }
    for (const c of pairs.values()) expect(c, `level ${n + 1} pair`).toBeGreaterThanOrEqual(2);
    for (const { at } of lv.locks ?? []) expect(at[0] > 0 && at[0] < maxX && at[1] > 0 && at[1] < maxY).toBe(true);
  });
});

test("every level is won by its stored plan", () => {
  levels.forEach((lv, n) => {
    const r = play(lv, solutions[n]);
    expect(r, `level ${n + 1}`).toEqual({ ignored: false, crashed: false, won: true });
  });
});

test("clicking every block at once crashes in most levels", () => {
  const bad = levels.filter((lv) => play(lv, lv.blocks.map((_, i) => [i, 0] as [number, number])).won).length;
  expect(bad).toBeLessThanOrEqual(6);
});

const has = {
  pause: (lv: Level) => lv.blocks.some((b) => b.path.some((p) => p[2])),
  pair: (lv: Level) => lv.blocks.some((b) => b.pair !== undefined),
  lock: (lv: Level) => !!lv.locks?.length,
  turned: (lv: Level) => lv.blocks.some((b) => b.rot),
};

test("each mechanic appears in several levels, later than the basics", () => {
  for (const [k, f] of Object.entries(has)) expect(levels.filter(f).length, k).toBeGreaterThanOrEqual(3);
  expect(levels.slice(0, 9).some((lv) => has.pause(lv) || has.pair(lv) || has.lock(lv) || has.turned(lv))).toBe(false);
});

const line = (extra: Partial<Level> = {}, ...blocks: Level["blocks"]): Level => ({ blocks, ...extra });
const run = (s: ReturnType<typeof makeState>) => {
  let t = 0;
  while (s.blocks.some((b) => b.moving) && t < 20) { step(s, DT); t += DT; }
  return t;
};

test("pause node stops the block until it is clicked again", () => {
  const s = makeState(line({}, { path: [[1, 1], [3, 1, "p"], [6, 1]] }));
  click(s, s.blocks[0]);
  run(s);
  expect(pos(s.blocks[0])).toEqual([3, 1]);
  expect(done(s.blocks[0])).toBe(false);
  click(s, s.blocks[0]);
  run(s);
  expect(done(s.blocks[0])).toBe(true);
});

test("clicking one of a pair starts both", () => {
  const s = makeState(line({}, { path: [[1, 1], [6, 1]], pair: 1 }, { path: [[1, 3], [6, 3]], pair: 1 }, { path: [[1, 2], [2, 2]] }));
  click(s, s.blocks[1]);
  expect(s.blocks.map((b) => b.moving)).toEqual([true, true, false]);
});

test("every click flips all locks; a closed lock crashes a block that reaches it", () => {
  const lv = line({ locks: [{ at: [4, 2], open: true }] }, { path: [[1, 1], [2, 1]] }, { path: [[1, 2], [6, 2]] });
  const s = makeState(lv);
  click(s, s.blocks[0]);
  expect(s.locks[0].open).toBe(false);
  click(s, s.blocks[1]);
  expect(s.locks[0].open).toBe(true);
  const t = makeState(lv);
  click(t, t.blocks[0]);
  run(t);
  click(t, t.blocks[0]); // finished block: ignored, locks keep their state
  expect(t.locks[0].open).toBe(false);
  let crashed = false;
  click(t, t.blocks[1]);
  t.locks[0].open = false;
  while (!crashed && t.blocks[1].moving) crashed = step(t, DT);
  expect(crashed).toBe(true);
  expect(pos(t.blocks[1])[0]).toBeLessThan(4);
});

test("turned squares collide by their turned edges", () => {
  expect(overlap([0, 0], 0, [0.65, 0], 45)).toBe(false);
  expect(overlap([0, 0], 0, [0.58, 0], 45)).toBe(true);
  expect(overlap([0, 0], 0, [0.49, 0], 0)).toBe(true);
  expect(overlap([0, 0], 0, [0.51, 0], 0)).toBe(false);
});

test("arrow heading follows the current segment", () => {
  const s = makeState(line({}, { path: [[1, 1], [3, 1, "p"], [3, 3]] }));
  const b = s.blocks[0];
  expect(heading(b)).toBe(0);
  click(s, b);
  run(s);
  expect(heading(b)).toBeCloseTo(Math.PI / 2); // paused at the corner: faces next segment
});
