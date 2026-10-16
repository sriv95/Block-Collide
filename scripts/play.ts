// E2E: bun scripts/play.ts [url]  (dev server must be running)
import { chromium } from "playwright";
import { levels } from "../src/levels";
import { PAUSE_S, SPEED, W, H, click, layout, makeState, step, type Level } from "../src/sim";

const URL = process.argv[2] ?? "http://localhost:5173/";
const SHOTS = "/private/tmp/claude-501/-Users-sriv-Projects-Block-Collide/e7169ff5-035b-400b-a239-22d5c37cd5f4/scratchpad/";

// A move clicks one block or a whole pair group; the group's representative is its first member.
const units = (lv: Level) => lv.blocks.flatMap((b, i) => (b.pair === undefined || lv.blocks.findIndex((c) => c.pair === b.pair) === i ? [i] : []));
const members = (lv: Level, i: number) => lv.blocks.filter((b) => b === lv.blocks[i] || (b.pair !== undefined && b.pair === lv.blocks[i].pair));
const works = (lv: Level, order: number[]) => {
  const s = makeState(lv);
  if (step(s, 0)) return false;
  for (const i of order) {
    click(s, s.blocks[i]);
    while (s.blocks.some((b) => b.moving)) if (step(s, 1 / 60)) return false;
  }
  return true;
};
/** First order (DFS, crash-pruned) that wins, or with `bad`, the first order that crashes. */
const search = (lv: Level, bad = false, pre: number[] = []): number[] | undefined => {
  const U = units(lv), left = U.filter((u) => !pre.includes(u));
  if (!works(lv, pre)) return bad ? pre : undefined;
  if (!left.length) return bad ? undefined : pre;
  for (const u of left) { const r = search(lv, bad, [...pre, u]); if (r) return r; }
};
const solution = (lv: Level) => search(lv)!;
const wrong = (lv: Level) => search(lv, true)!;

const pathLen = (p: number[][]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
/** Seconds a move takes: slowest member, travel plus PAUSE_S per "p" point (not the last). */
const moveS = (lv: Level, i: number) => Math.max(...members(lv, i).map((b) => pathLen(b.path) / SPEED + PAUSE_S * b.path.slice(0, -1).filter((q) => q[2]).length));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL);

const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, info?: string) => {
  results.push([name, ok, info]);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " - " + info : ""}`);
};
const text = (id: string) => page.locator("#" + id).innerText();
const state = () => page.locator("#game").getAttribute("data-state");
const inState = (want: string, timeout = 5000) =>
  page.waitForFunction((w) => document.getElementById("game")!.dataset.state === w, want, { timeout, polling: "raf" }).then(() => true, () => false);
const blockXY = async (lv: Level, i: number) => {
  const r = (await page.locator("#c").boundingBox())!;
  const { cs, ox, oy } = layout(lv);
  const [x, y] = lv.blocks[i].path[0];
  return [r.x + ((ox + (x + 0.5) * cs) / W) * r.width, r.y + ((oy + (y + 0.5) * cs) / H) * r.height] as const;
};
const clickBlock = async (lv: Level, i: number) => page.mouse.click(...(await blockXY(lv, i)));
const label = (n: number) => page.waitForFunction((t) => document.getElementById("lvl")!.textContent === t, `LEVEL ${n}`, { timeout: 4000 }).then(() => true, () => false);

check("title shown", (await state()) === "title");
await page.screenshot({ path: SHOTS + "title.png" });
await page.click("#start");
const tiles = page.locator("#tiles button");
check("level select: one tile per level, only level 1 unlocked", (await tiles.count()) === levels.length && (await page.locator("#tiles button:enabled").count()) === 1);
await page.screenshot({ path: SHOTS + "level-select.png" });
await tiles.nth(0).click();
check("level 1 label", await label(1));

// Esc settings overlay opens/closes
await page.keyboard.press("Escape");
check("Esc opens settings", await page.locator("#settings").isVisible());
await page.screenshot({ path: SHOTS + "settings.png" });
await page.keyboard.press("Escape");
check("Esc closes settings", !(await page.locator("#settings").isVisible()));

// hover shot
await page.mouse.move(...(await blockXY(levels[0], 0)));
await sleep(100);
await page.screenshot({ path: SHOTS + "hover.png" });

// R restarts: click block, press R mid-move; must not win on original schedule
await clickBlock(levels[0], 0);
await sleep(400);
await page.keyboard.press("r");
await sleep(moveS(levels[0], 0) * 1000 + 300);
check("R restarts level", (await state()) === "play" && (await text("lvl")) === "LEVEL 1", await state());

for (let li = 0; li < levels.length; li++) {
  const lv = levels[li];
  check(`level label ${li + 1}`, await label(li + 1));
  await inState("play");

  if (li === 4) {
    const w = wrong(lv)!;
    await clickBlock(lv, w[0]);
    const crashed = await inState("crash", 3000);
    await sleep(150);
    await page.screenshot({ path: SHOTS + "crash.png" });
    check("L5 wrong order -> crash", crashed);
    check("L5 resets after crash", (await inState("play", 4000)) && (await text("lvl")) === "LEVEL 5");
  }

  const order = solution(lv);
  for (const [k, i] of order.entries()) {
    await clickBlock(lv, i);
    if ([4, 19, 27, 33, 39].includes(li) && k === order.length - 1) { await sleep(300); await page.screenshot({ path: SHOTS + `level${li + 1}-mid.png` }); }
    if (k < order.length - 1) await sleep(moveS(lv, i) * 1000 + 150);
  }
  const solved = await inState("win", moveS(lv, order.at(-1)!) * 1000 + 2000);
  if (!solved) await page.screenshot({ path: SHOTS + `fail${li + 1}.png` });
  check(`level ${li + 1} solved`, solved, `order ${order.join(",")}`);
}
check("after last level -> level select", await inState("select", 4000));
check("all levels now unlocked", (await page.locator("#tiles button:enabled").count()) === levels.length);
await page.reload();
await page.click("#start");
check("unlocks persist after reload", (await page.locator("#tiles button:enabled").count()) === levels.length);
check("no page/console errors", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(results.every((r) => r[1]) ? 0 : 1);
