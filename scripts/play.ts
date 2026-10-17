// E2E: bun scripts/play.ts [url]  (dev server must be running)
import { chromium } from "playwright";
import { levels } from "../src/levels";
import { solutions } from "../src/solutions";
import { CELL, W, H, click, makeState, pos, step, type Level } from "../src/sim";

const URL = process.argv[2] ?? "http://localhost:5173/";
const SHOTS = "/private/tmp/claude-501/-Users-sriv-Projects-Block-Collide/9f25eb77-ba53-4ee3-b08e-73ce7ca48f33/scratchpad/shots/";

const DT = 1 / 120;
/** Where each planned click lands (cells) and how long the plan takes to settle (seconds), by replaying the sim. */
const replay = (lv: Level, plan: [number, number][]) => {
  const s = makeState(lv);
  let t = 0;
  const at: [number, number][] = [];
  for (const [u, when] of plan) {
    for (; t < when; t += DT) step(s, DT);
    at.push(pos(s.blocks[u]));
    click(s, s.blocks[u]);
  }
  while (s.blocks.some((b) => b.moving)) { step(s, DT); t += DT; }
  return { at, end: t };
};
/** First block whose click, run to completion on its own, crashes. */
const crasher = (lv: Level) => {
  for (let u = 0; u < lv.blocks.length; u++) {
    const s = makeState(lv);
    click(s, s.blocks[u]);
    for (let t = 0; s.blocks.some((b) => b.moving) && t < 20; t += DT) if (step(s, DT)) return u;
  }
};
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
const cellXY = async ([x, y]: [number, number]) => {
  const r = (await page.locator("#c").boundingBox())!;
  return [r.x + ((x * CELL) / W) * r.width, r.y + ((y * CELL) / H) * r.height] as const;
};
const clickAt = async (c: [number, number]) => page.mouse.click(...(await cellXY(c)));
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
const first = replay(levels[0], solutions[0]);
await page.mouse.move(...(await cellXY(first.at[0])));
await sleep(100);
await page.screenshot({ path: SHOTS + "hover.png" });

// R restarts: click block, press R mid-move; must not win on original schedule
await clickAt(first.at[0]);
await sleep(400);
await page.keyboard.press("r");
await sleep(first.end * 1000 + 300);
check("R restarts level", (await state()) === "play" && (await text("lvl")) === "LEVEL 1", await state());

for (let li = 0; li < levels.length; li++) {
  const lv = levels[li], plan = solutions[li];
  check(`level label ${li + 1}`, await label(li + 1));
  await inState("play");

  if (li === 4) {
    const w = crasher(lv)!;
    await clickAt(lv.blocks[w].path[0] as [number, number]);
    const crashed = await inState("crash", 3000);
    await sleep(150);
    await page.screenshot({ path: SHOTS + "crash.png" });
    check("L5 wrong order -> crash", crashed);
    check("L5 resets after crash", (await inState("play", 4000)) && (await text("lvl")) === "LEVEL 5");
  }

  const { at, end } = replay(lv, plan);
  // click on game time (data-t), not wall time, so a slow frame cannot shift the plan
  const gameT = () => page.locator("#game").getAttribute("data-t").then(Number);
  let t0 = 0;
  for (const [k, [, when]] of plan.entries()) {
    if (k) await page.waitForFunction((t) => +document.getElementById("game")!.dataset.t! >= t, t0 + when, { polling: "raf", timeout: 20000 });
    else t0 = await gameT();
    await clickAt(at[k]);
    if (k === plan.length - 1 && [4, 19, 27, 33, 39].includes(li)) { await sleep(300); await page.screenshot({ path: SHOTS + `level${li + 1}-mid.png` }); }
  }
  const solved = await inState("win", end * 1000 + 6000);
  if (!solved) await page.screenshot({ path: SHOTS + `fail${li + 1}.png` });
  check(`level ${li + 1} solved`, solved);
}
check("after last level -> level select", await inState("select", 4000));
check("all levels now unlocked", (await page.locator("#tiles button:enabled").count()) === levels.length);
await page.reload();
await page.click("#start");
check("unlocks persist after reload", (await page.locator("#tiles button:enabled").count()) === levels.length);
check("no page/console errors", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(results.every((r) => r[1]) ? 0 : 1);
