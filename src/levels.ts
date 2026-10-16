import type { BlockDef, Level, PathPt } from "./sim";

const P = (...path: PathPt[]): BlockDef => ({ path });
/** Block in pair group `pair`: clicking any member starts the whole group. */
const G = (pair: number, ...path: PathPt[]): BlockDef => ({ path, pair });

export const levels: Level[] = [
  // 1: single block
  { size: [5, 3], blocks: [P([0, 1], [4, 1])] },
  // 2: bend
  { size: [5, 4], blocks: [P([0, 0], [4, 0], [4, 3])] },
  // 3: two independent blocks
  { size: [5, 4], blocks: [P([0, 0], [4, 0]), P([0, 3], [4, 3])] },
  // 4: crossing paths, any order works
  { size: [5, 5], blocks: [P([0, 2], [4, 2]), P([2, 0], [2, 4])] },
  // 5: B sits on A's path (trap: click A first)
  { size: [5, 5], blocks: [P([0, 2], [4, 2]), P([2, 2], [2, 0])] },
  // 6: B's goal sits on A's path (trap: click B first)
  { size: [5, 4], blocks: [P([0, 1], [4, 1]), P([2, 3], [2, 1])] },
  // 7: L-shaped path, blocker on the second leg
  { size: [6, 4], blocks: [P([0, 0], [4, 0], [4, 3]), P([4, 2], [1, 2])] },
  // 8: A needs C gone, B must wait for A and C
  { size: [5, 5], blocks: [P([0, 2], [4, 2]), P([2, 0], [2, 2]), P([4, 0], [0, 0])] },
  // 9: three-block chain, one valid order
  { size: [6, 5], blocks: [P([0, 2], [5, 2]), P([2, 2], [2, 0]), P([2, 0], [5, 0])] },
  // 10: B first, then A and C in either order
  { size: [6, 5], blocks: [P([0, 0], [0, 3], [5, 3]), P([3, 3], [3, 0]), P([5, 1], [3, 1])] },
  // 11: two blockers and a long sweeper
  { size: [7, 5], blocks: [P([0, 2], [6, 2]), P([2, 2], [2, 0]), P([4, 2], [4, 4]), P([6, 0], [1, 0])] },
  // 12: loop path with a parked trap
  { size: [7, 5], blocks: [P([0, 0], [6, 0], [6, 4]), P([6, 2], [3, 2]), P([3, 4], [3, 1]), P([0, 3], [3, 3])] },
  // 13: pause: D waits a second at its node
  { size: [7, 5], blocks: [P([0, 1], [6, 1]), P([3, 3], [0, 3]), P([3, 1], [3, 4]), P([6, 4], [4, 4, "p"], [1, 4])] },
  // 14: staggered blockers, two pauses
  { size: [6, 5], blocks: [P([0, 0], [0, 4], [4, 4, "p"], [5, 4]), P([3, 4], [3, 1]), P([5, 1], [4, 1, "p"], [2, 1]), P([0, 2], [2, 2])] },
  // 15: five blocks, two feeder chains
  { size: [8, 6], blocks: [
      P([0, 5], [6, 5, "p"], [7, 5]),
      P([2, 5], [2, 0]),
      P([2, 3], [5, 3]),
      P([5, 5], [5, 4]),
      P([7, 0], [4, 0, "p"], [1, 0]),
    ] },
  // 16: loop with decoys
  { size: [8, 6], blocks: [
      P([0, 0], [2, 0, "p"], [7, 0], [7, 5]),
      P([7, 3], [4, 3]),
      P([4, 5], [4, 2]),
      P([4, 0], [4, 1]),
      P([0, 5], [2, 5, "p"], [6, 5]),
    ] },
  // 17: pinwheel, exactly one order works
  { size: [7, 7], blocks: [P([0, 1], [3, 1, "p"], [5, 1]), P([5, 0], [5, 5]), P([6, 5], [3, 5, "p"], [1, 5]), P([1, 6], [1, 2])] },
  // 18: mixed start- and goal-blocks
  { size: [8, 6], blocks: [
      P([0, 3], [7, 3]),
      P([3, 3], [3, 0]),
      P([7, 0], [4, 0, "p"], [2, 0]),
      P([5, 5], [5, 4, "p"], [5, 3]),
      P([6, 0], [6, 2]),
    ] },
  // 19: two chains meeting at one sweeper
  { size: [9, 7], blocks: [
      P([0, 3], [8, 3]),
      P([2, 3], [2, 0]),
      P([6, 3], [6, 6]),
      P([8, 0], [4, 0, "p"], [1, 0]),
      P([0, 6], [2, 6, "p"], [8, 6]),
      P([4, 3], [4, 4, "p"], [4, 5]),
    ] },
  // 20: staircase, six blocks in one forced order
  { size: [9, 7], blocks: [
      P([3, 1], [3, 0]),
      P([0, 1], [8, 1]),
      P([0, 6], [0, 3, "p"], [0, 0]),
      P([8, 6], [4, 6, "p"], [0, 6]),
      P([8, 2], [8, 6]),
      P([5, 2], [6, 2, "p"], [8, 2]),
    ] },
  // 21: first pair: both start together
  { size: [6, 4], blocks: [G(0, [0, 0], [5, 0]), G(0, [0, 3], [5, 3]), P([2, 3], [2, 1])] },
  // 22: pair that must dephase: B pauses so A clears the crossing
  { size: [6, 5], blocks: [G(0, [0, 2], [5, 2]), G(0, [2, 0], [2, 1, "p"], [2, 4]), P([4, 2], [4, 4]), P([0, 4], [3, 4])] },
  // 23: pairs; 1 valid order of 3 units
  { size: [7, 5], blocks: [G(0, [4, 3], [1, 3], [1, 0], [0, 0]), P([6, 1], [6, 4], [3, 4]), P([0, 2], [5, 2], [5, 4]), G(0, [3, 0], [5, 0], [5, 2])] },
  // 24: pairs+pause; 2 valid orders of 4 units
  { size: [7, 5], blocks: [
      P([5, 2], [6, 2], [6, 0]),
      G(0, [2, 3], [2, 4], [0, 4]),
      P([1, 4], [1, 0], [0, 0]),
      G(0, [3, 0], [5, 0], [5, 1, "p"], [5, 3]),
      P([0, 1], [4, 1], [4, 0]),
    ] },
  // 25: pairs+pause; 3 valid orders of 4 units
  { size: [8, 6], blocks: [
      P([6, 5], [2, 5], [2, 2]),
      P([2, 3], [4, 3], [4, 0], [1, 0]),
      P([1, 2], [3, 2, "p"], [3, 4]),
      G(0, [0, 4], [6, 4], [6, 2]),
      G(0, [6, 0], [7, 0], [7, 3]),
    ] },
  // 26: pairs+pause; 1 valid order of 5 units
  { size: [8, 6], blocks: [
      P([6, 5], [4, 5], [4, 3]),
      P([3, 1], [3, 4], [1, 4]),
      P([7, 1], [1, 1], [1, 0]),
      G(0, [0, 0], [0, 3], [5, 3]),
      P([1, 3], [1, 2, "p"], [1, 1]),
      G(0, [6, 2], [7, 2], [7, 0]),
    ] },
  // 27: pairs; 2 valid orders of 4 units
  { size: [8, 6], blocks: [
      G(0, [7, 4], [5, 4], [5, 2], [7, 2]),
      P([3, 5], [3, 3], [1, 3]),
      P([1, 0], [1, 4], [0, 4], [0, 5]),
      G(0, [6, 1], [2, 1], [2, 5], [4, 5]),
      G(1, [2, 1], [2, 0], [0, 0]),
      G(1, [5, 2], [5, 0]),
    ] },
  // 28: pairs+pause; 1 valid order of 5 units
  { size: [9, 6], blocks: [
      G(1, [4, 5], [6, 5], [6, 0]),
      G(0, [6, 3], [8, 3], [8, 5]),
      P([2, 2], [2, 1, "p"], [2, 0]),
      P([7, 0], [0, 0], [0, 3]),
      P([0, 5], [4, 5], [4, 1]),
      G(1, [8, 1], [5, 1], [5, 0]),
      G(0, [2, 4], [2, 2], [0, 2]),
    ] },
  // 29: locks; 1 valid order of 3 units
  { size: [6, 4], blocks: [P([3, 0], [5, 0], [5, 2]), P([1, 2], [3, 2], [3, 0], [1, 0]), P([2, 3], [2, 1], [0, 1])], locks: [{ at: [2,2], open: true }] },
  // 30: locks; 2 valid orders of 4 units
  { size: [7, 5], blocks: [P([0, 3], [3, 3], [3, 1]), P([5, 0], [5, 3], [6, 3]), P([2, 4], [0, 4], [0, 1]), P([3, 2], [6, 2], [6, 0])], locks: [{ at: [2,3], open: false }] },
  // 31: locks; 1 valid order of 5 units
  { size: [7, 5], blocks: [
      P([5, 2], [6, 2], [6, 0]),
      P([2, 3], [2, 4], [0, 4]),
      P([1, 4], [1, 0], [0, 0]),
      P([3, 0], [5, 0], [5, 3]),
      P([0, 1], [4, 1], [4, 0]),
    ], locks: [{ at: [1,1], open: false }] },
  // 32: locks; 3 valid orders of 5 units
  { size: [8, 6], blocks: [
      P([2, 3], [0, 3], [0, 5], [3, 5]),
      P([3, 0], [3, 3], [7, 3]),
      P([1, 5], [1, 1], [4, 1]),
      P([6, 4], [6, 5], [7, 5]),
      P([7, 2], [7, 0], [0, 0]),
    ], locks: [{ at: [6,3], open: false }, { at: [5,0], open: false }] },
  // 33: locks; 2 valid orders of 6 units
  { size: [8, 6], blocks: [
      P([3, 2], [1, 2], [1, 5]),
      P([3, 3], [6, 3], [6, 5]),
      P([2, 5], [2, 0], [0, 0]),
      P([6, 0], [7, 0], [7, 3]),
      P([3, 4], [3, 5], [7, 5]),
      P([3, 5], [0, 5], [0, 1]),
    ], locks: [{ at: [1,0], open: false }, { at: [1,3], open: false }] },
  // 34: locks; 2 valid orders of 6 units
  { size: [9, 6], blocks: [
      P([5, 4], [7, 4], [7, 5]),
      P([2, 3], [8, 3], [8, 5]),
      P([3, 5], [3, 3]),
      P([5, 2], [1, 2], [1, 5], [6, 5]),
      P([0, 4], [4, 4], [4, 5]),
      P([5, 0], [8, 0], [8, 3]),
    ], locks: [{ at: [2,4], open: true }, { at: [4,2], open: true }] },
  // 35: pairs+locks+pause; 1 valid order of 5 units
  { size: [9, 6], blocks: [
      G(0, [4, 1], [3, 1, "p"], [1, 1]),
      G(0, [6, 3], [6, 5]),
      P([8, 5], [8, 3], [4, 3]),
      P([2, 4], [0, 4], [0, 1]),
      P([3, 0], [8, 0], [8, 3]),
      P([7, 4], [4, 4], [4, 2]),
    ], locks: [{ at: [6,4], open: false }] },
  // 36: pairs+locks+pause; 2 valid orders of 6 units
  { size: [9, 6], blocks: [
      P([6, 4], [1, 4], [1, 5]),
      G(0, [8, 1], [8, 0], [6, 0, "p"], [5, 0], [5, 4]),
      P([4, 1], [8, 1], [8, 3]),
      P([5, 5], [7, 5], [7, 1]),
      P([2, 3], [0, 3], [0, 5]),
      P([2, 1], [0, 1], [0, 0]),
      G(0, [5, 3], [2, 3], [2, 5]),
    ], locks: [{ at: [5,1], open: false }] },
  // 37: pairs+locks+pause; 2 valid orders of 6 units
  { size: [9, 7], blocks: [
      G(0, [1, 0], [1, 4], [0, 4]),
      G(0, [5, 5], [8, 5]),
      P([3, 2], [6, 2], [6, 0]),
      P([0, 5], [4, 5, "p"], [5, 5], [5, 3]),
      P([5, 0], [8, 0], [8, 3]),
      P([7, 3], [8, 3], [8, 6], [5, 6]),
      P([4, 1], [2, 1], [2, 5]),
    ], locks: [{ at: [3,5], open: true }, { at: [5,2], open: false }] },
  // 38: pairs+locks+pause; 2 valid orders of 6 units
  { size: [10, 7], blocks: [
      G(0, [8, 4], [9, 4], [9, 0]),
      G(0, [2, 3], [8, 3], [8, 0]),
      P([3, 2], [5, 2], [5, 5]),
      G(1, [2, 0], [0, 0], [0, 3]),
      P([4, 5], [9, 5]),
      P([2, 6], [2, 0], [4, 0]),
      G(1, [1, 4], [0, 4, "p"], [0, 6]),
      P([0, 5], [4, 5], [4, 2]),
    ], locks: [{ at: [4,3], open: true }] },
  // 39: pairs+locks+pause; 2 valid orders of 7 units
  { size: [10, 7], blocks: [
      P([5, 5], [3, 5], [3, 6], [7, 6]),
      P([2, 6], [2, 1], [0, 1]),
      P([4, 2], [1, 2, "p"], [0, 2]),
      P([6, 4], [8, 4], [8, 1]),
      P([4, 4], [4, 0], [0, 0]),
      P([9, 1], [7, 1, "p"], [3, 1], [3, 0]),
      G(0, [9, 5], [7, 5], [7, 2]),
      G(0, [6, 6], [6, 3]),
    ], locks: [{ at: [2,0], open: true }] },
  // 40: pairs+locks+pause; 2 valid orders of 7 units
  { size: [10, 7], blocks: [
      G(0, [5, 3], [7, 3], [7, 6]),
      P([5, 6], [5, 1]),
      P([6, 5], [6, 6], [4, 6]),
      P([1, 6], [4, 6], [4, 0]),
      P([0, 2], [0, 4, "p"], [0, 5]),
      P([1, 0], [7, 0, "p"], [8, 0]),
      G(0, [9, 1], [6, 1], [6, 3]),
      P([3, 0], [3, 4], [9, 4]),
    ], locks: [{ at: [4,3], open: false }, { at: [7,4], open: false }] },
];
