import { expect, test } from "bun:test";
import { levels } from "./levels";
import { click, makeState, pos, step, type Level, type State } from "./sim";

/** A move clicks one block, or one whole pair group. Returns the representative block index of each unit. */
const units = (lv: Level) => lv.blocks.flatMap((b, i) => (b.pair === undefined || lv.blocks.findIndex((c) => c.pair === b.pair) === i ? [i] : []));

/** Count winning move orders. A move runs to completion (pauses included) before the next; the state after a set of moves is order-independent, so memoise by set. */
const solve = (lv: Level) => {
  const U = units(lv), full = (1 << U.length) - 1;
  const memo = new Map<number, number>();
  const move = (s: State, u: number) => {
    const t = structuredClone(s);
    click(t, t.blocks[U[u]]);
    while (t.blocks.some((b) => b.moving)) if (step(t, 1 / 60)) return null;
    return t;
  };
  const count = (s: State, mask: number): number => {
    if (mask === full) return 1;
    let c = memo.get(mask);
    if (c === undefined) {
      c = 0;
      U.forEach((_, u) => {
        const t = mask & (1 << u) ? null : move(s, u);
        if (t) c! += count(t, mask | (1 << u));
      });
      memo.set(mask, c);
    }
    return c;
  };
  const s0 = makeState(lv);
  const first = U.map((_, u) => { const t = step(s0, 0) ? null : move(s0, u); return t ? count(t, 1 << u) : 0; });
  return { valid: first.reduce((a, b) => a + b, 0), trapped: first.some((c) => c === 0) };
};

test("level shapes are valid", () => {
  for (const lv of levels)
    for (const { path } of lv.blocks) {
      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0]).not.toEqual(path[path.length - 1]);
      path.forEach(([x, y], i) => {
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
        expect(x >= 0 && x < lv.size[0] && y >= 0 && y < lv.size[1]).toBe(true);
        if (i) expect(x === path[i - 1][0] || y === path[i - 1][1]).toBe(true);
      });
    }
});

const has = {
  pause: (lv: Level) => lv.blocks.some((b) => b.path.some((p) => p[2])),
  pair: (lv: Level) => lv.blocks.some((b) => b.pair !== undefined),
  lock: (lv: Level) => !!lv.locks?.length,
};

test("exactly 40 levels", () => expect(levels.length).toBe(40));

test("every level is solvable", () => {
  levels.forEach((lv, i) => expect(solve(lv).valid, `level ${i + 1}`).toBeGreaterThan(0));
});

test("traps exist (some first move is a dead end or crash)", () => {
  expect(levels.filter((lv) => solve(lv).trapped).length).toBeGreaterThanOrEqual(15);
});

test("late levels have few valid orders", () => {
  levels.slice(34).forEach((lv, i) => expect(solve(lv).valid, `level ${i + 35}`).toBeLessThanOrEqual(3));
});

test("mechanics are introduced in order and each used in 4+ levels", () => {
  for (const [k, f] of Object.entries(has)) expect(levels.filter(f).length, k).toBeGreaterThanOrEqual(4);
  expect(levels.slice(0, 12).some((lv) => has.pause(lv) || has.pair(lv) || has.lock(lv))).toBe(false);
  expect(levels.slice(0, 20).some((lv) => has.pair(lv) || has.lock(lv))).toBe(false);
  expect(levels.slice(0, 28).some(has.lock)).toBe(false);
});

const line = (extra: Partial<Level> = {}, ...blocks: Level["blocks"]): Level => ({ size: [6, 3], blocks, ...extra });
const time = (s: ReturnType<typeof makeState>) => {
  let t = 0;
  while (s.blocks.some((b) => b.moving) && t < 20) { step(s, 1 / 60); t += 1 / 60; }
  return t;
};

test("pause node delays arrival by PAUSE_S", () => {
  const run = (mid: [number, number] | [number, number, "p"]) => {
    const s = makeState(line({}, { path: [[0, 1], mid, [5, 1]] }));
    click(s, s.blocks[0]);
    return time(s);
  };
  expect(run([2, 1, "p"]) - run([2, 1])).toBeCloseTo(1, 1);
});

test("clicking one of a pair starts both", () => {
  const s = makeState(line({}, { path: [[0, 0], [5, 0]], pair: 1 }, { path: [[0, 2], [5, 2]], pair: 1 }, { path: [[0, 1], [1, 1]] }));
  click(s, s.blocks[1]);
  expect(s.blocks.map((b) => b.moving)).toEqual([true, true, false]);
});

test("lock toggles when a block finishes; closed lock crashes", () => {
  const lv = line({ locks: [{ at: [3, 1], open: true }] }, { path: [[0, 0], [1, 0]] }, { path: [[0, 1], [5, 1]] });
  const s = makeState(lv);
  click(s, s.blocks[0]);
  time(s);
  expect(s.locks[0].open).toBe(false);
  click(s, s.blocks[1]);
  let crashed = false;
  while (!crashed && s.blocks[1].moving) crashed = step(s, 1 / 60);
  expect(crashed).toBe(true);
  expect(pos(s.blocks[1])[0]).toBeLessThan(3);
  expect(makeState(lv).locks[0].open).toBe(true);
});
