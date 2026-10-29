// Scenario checks for the machine, the NGC control and the tutorials:
// the reducer in src/entities/machine, the tutorial engine and steps, and the
// program playback driving an interpreted program.
//
// No test runner in the repo, so — like tools/nc-check — this compiles the
// modules with the repo's TypeScript into a temp directory and runs plain
// assertions.
//
//   node tools/logic-check/run.mjs
//
// Exit code 1 if any scenario fails.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temp = mkdtempSync(join(tmpdir(), "logic-check-"));
const out = join(temp, "out");
const files = [
  "src/entities/machine/machine-logic.ts",
  "src/entities/machine/program-playback.ts",
  "src/entities/machine/program-run.ts",
  "src/entities/machine/machine-store.ts",
  "src/entities/part/cam.ts",
  "src/entities/part/setup.ts",
  "src/features/part-development/program-check.ts",
  "src/features/cnc-tutorial/tutorial-engine.ts",
  "src/features/cnc-tutorial/steps/index.ts",
  "src/features/levels/tutorials.ts",
  "src/entities/nc/index.ts",
];
const tsconfig = join(temp, "tsconfig.json");
writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      moduleResolution: "node",
      strict: true,
      skipLibCheck: true,
      types: [],
      rootDir: join(repo, "src"),
      outDir: out,
      baseUrl: repo,
      paths: { "@/*": ["src/*"] },
    },
    files: files.map((f) => join(repo, f)),
  }),
);
try {
  execFileSync(process.execPath, [join(repo, "node_modules/typescript/bin/tsc"), "-p", tsconfig], { stdio: "pipe" });
} catch (e) {
  console.error(String(e.stdout ?? e));
  rmSync(temp, { recursive: true, force: true });
  process.exit(1);
}
const resolveFilename = Module._resolveFilename;
// The compiled store lives in a temp directory: find zustand in the repo.
const zustand = createRequire(join(repo, "package.json")).resolve("zustand");
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = join(out, request.slice(2));
  else if (request === "zustand") request = zustand;
  return resolveFilename.call(this, request, ...rest);
};
const require = createRequire(join(out, "index.js"));
const assert = require("node:assert/strict");
const L = require(join(out, "entities/machine/machine-logic.js"));
const T = require(join(out, "entities/machine/machine-types.js"));
const P = require(join(out, "entities/machine/program-playback.js"));
const nc = require(join(out, "entities/nc/index.js"));
const R = require(join(out, "entities/machine/program-run.js"));
const { useMachineStore, getActiveRun } = require(join(out, "entities/machine/machine-store.js"));
const { advanceTutorial } = require(join(out, "features/cnc-tutorial/tutorial-engine.js"));
const { cncTutorialSteps: steps } = require(join(out, "features/cnc-tutorial/steps/index.js"));

let failed = 0;
const scenario = (name, fn) => {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${e.message.split("\n").slice(0, 8).join("\n      ")}`);
  }
};

// A store with a fake clock: timers fire only when `wait()` runs them.
function sim() {
  let m = T.initialMachineState, cursor = { stepIndex: 0, phaseIndex: 0, status: "active", reached: 0 };
  const pending = new Map(); const log = [];
  const sync = () => { const r = advanceTutorial(steps, cursor, m); cursor = r.cursor; if (r.violation) log.push("VIOLATION: " + r.violation); };
  const dispatch = (a) => {
    const o = L.reduce(m, a);
    if (o.run) api.lastRun = o.run;
    for (const k of o.cancel ?? []) pending.delete(k);
    for (const k of o.start ?? []) pending.set(k, L.timerDelay(o.next, k));
    m = o.next; sync();
    if (o.rejected) log.push("REJECT: " + o.rejected);
    if (o.notice) log.push("NOTICE: " + o.notice);
    return o;
  };
  var api = {
    op: (part, sign) => dispatch({ type: "operate", part, sign }),
    key: (key, shift) => dispatch({ type: "key", key, shift }),
    dispatch,
    wait: () => { while (pending.size) { const [k] = pending.keys(); pending.delete(k); dispatch({ type: "timer", timer: k }); } },
    get m() { return m; }, get cursor() { return cursor; }, log,
    where: () => cursor.status === "complete" ? "COMPLETE" : `${steps[cursor.stepIndex].id}/${steps[cursor.stepIndex].phases[cursor.phaseIndex].id}`,
  };
  sync();
  return api;
}


let s;
const expect = (where) => assert.equal(s.where(), where);
scenario('1. happy path ok', () => {
// 1. Happy path, in tutorial order.
s = sim();
expect("air-supply/open-valve");
s.op("power_on"); assert.match(s.log.at(-1), /No mains power/);
s.op("air_valve"); expect("main-power/switch-on");
s.op("main_switch"); expect("power-on/press-power");
s.op("power_on"); expect("power-on/wait-boot");
s.wait(); expect("estop/estop-release");
assert.deepEqual(s.m.alarms.map(a => a.code), ["102", "107"]);
s.op("reset"); assert.match(s.log.at(-1), /could not clear 107/);
s.op("estop"); expect("clear-alarms/press-reset");
s.op("power_up"); assert.match(s.log.at(-1), /Clear the alarms/);
s.op("reset"); expect("door/door-close"); assert.deepEqual(s.m.alarms, []);
s.op("power_up"); assert.match(s.log.at(-1), /Close the door/);
s.op("door"); expect("zero-return/press-power-up");
s.op("power_up"); expect("zero-return/wait-home"); assert.equal(s.m.position.z, 0); assert.equal(s.m.position.x, -212);
s.wait(); expect("handle-jog/jog-mode"); assert.deepEqual(s.m.position, { x: 0, y: 0, z: 0, b: 0, c: 0 });
s.op("handwheel", -1); assert.match(s.log.at(-1), /HANDLE JOG/);
s.op("hand_jog"); expect("handle-jog/jog-axis");
s.op("handwheel", -1); assert.match(s.log.at(-1), /Choose an axis/);
s.op("axis_x"); expect("handle-jog/jog-move");
s.op("handwheel", 1); assert.match(s.log.at(-1), /plus travel limit/);
for (let i = 0; i < 5; i++) s.op("handwheel", -1);
assert.equal(s.m.position.x, -50); expect("warmup/memory-mode");
s.op("cycle_start"); assert.match(s.log.at(-1), /MEMORY/);
s.op("memory"); expect("warmup/cycle-start");
s.op("cycle_start"); expect("warmup/watch-warmup"); assert.equal(s.m.program, "running"); assert.equal(s.lastRun, "start");
s.op("feed_hold"); assert.equal(s.m.program, "hold");
s.op("cycle_start"); assert.equal(s.m.program, "running"); assert.equal(s.lastRun, "resume");
s.dispatch({ type: "runHalt", halt: "end", position: s.m.position, line: 12 });
expect("COMPLETE"); assert.equal(s.m.warmupDone, true); assert.equal(s.m.program, "idle");
});

scenario('2. air loss recovery ok', () => {

// 2. Losing air after completion costs the air step and RESET, nothing more.
s.op("air_valve");
assert.match(s.log.at(-2), /air supply was shut off/); assert.match(s.log.at(-1), /LOW AIR/);
expect("air-supply/open-valve"); assert.deepEqual(s.m.alarms.map(a => a.code), ["low-air", "102"]);
s.op("air_valve"); expect("clear-alarms/press-reset");
s.op("reset"); expect("COMPLETE");
});

scenario('3. interlocks ok', () => {

// 3. Door opened during zero return aborts homing; E-stop during warm-up.
s = sim();
for (const p of ["air_valve", "main_switch", "power_on"]) s.op(p); s.wait();
for (const p of ["estop", "reset", "door", "power_up"]) s.op(p);
assert.equal(s.m.homingStage, 0);
s.op("door"); assert.match(s.log.at(-1), /homing aborted/); assert.equal(s.m.homingStage, null); assert.equal(s.m.homed, false);
s.op("door"); s.op("power_up"); s.wait(); assert.equal(s.m.homed, true);
s.op("cycle_start"); assert.equal(s.m.program, "running");
s.op("estop"); assert.equal(s.m.program, "idle"); assert.equal(s.lastRun, "stop"); assert.deepEqual(s.m.alarms.map(a => a.code), ["107", "102"]); assert.equal(s.m.homed, true);
s.op("cycle_start"); assert.match(s.log.at(-1), /Clear the alarms/);
});

scenario('4. power loss ok', () => {

// 4. Cutting mains with the control up drops everything and warns.
s.op("main_switch"); assert.match(s.log.at(-1), /Mains cut/); assert.equal(s.m.control, "off"); assert.equal(s.m.homed, false);
// Power off mid-boot cancels the boot.
s.op("main_switch"); s.op("power_on"); s.op("power_off"); s.wait(); assert.equal(s.m.control, "off");
});

scenario('5. coolant ok', () => {

// 5. Coolant needs the door shut; the door opening stops it.
s = sim();
for (const p of ["air_valve", "main_switch", "power_on"]) s.op(p); s.wait();
s.op("estop"); s.op("reset"); s.op("coolant"); assert.match(s.log.at(-1), /Close the door/);
s.op("door"); s.op("coolant"); assert.equal(s.m.coolantOn, true); s.op("door"); assert.equal(s.m.coolantOn, false);
});

scenario('6. NGC keyboard ok', () => {

// 6. NGC keyboard: modes, offsets, MDI, increments, overrides.
s = sim();
for (const p of ["air_valve", "main_switch", "power_on"]) s.op(p); s.wait();
s.op("estop"); s.op("reset"); s.op("door"); s.op("power_up"); s.wait(); assert.equal(s.m.homed, true);
s.key("HANDLE_JOG"); assert.equal(s.m.mode, "jog");
s.key("INC_01"); assert.equal(s.m.handleIncrement, 0.1);
s.key("JOG_-X"); assert.equal(s.m.position.x, -1); assert.equal(s.m.jogAxis, "x");
s.key("JOG_-AC", true); assert.equal(s.m.jogAxis, "b"); assert.equal(s.m.position.b, -1);
s.key("OFFSET"); s.key("OFFSET"); assert.equal(s.m.offsetTab, "tool");
s.key("F4"); assert.equal(s.m.offsetTab, "work");
s.key("PART_ZERO_SET"); assert.equal(s.m.workOffsets.G54.x, -1); assert.equal(s.m.offsetCursor.col, 1);
s.key("NUM_5"); s.key("DOT"); s.key("NUM_5"); s.key("F1"); assert.equal(s.m.workOffsets.G54.y, 5.5);
s.key("NUM_1"); s.key("ENTER"); assert.equal(s.m.workOffsets.G54.y, 6.5);
s.key("TOOL_OFFSET_MEASURE"); assert.equal(s.m.tools[2].length, s.m.position.z); assert.equal(s.m.offsetTab, "tool");
s.key("FEED_+10"); s.key("FEED_+10"); assert.equal(s.m.overrides.feed, 120); s.key("RAPID_25"); assert.equal(s.m.overrides.rapid, 25);
s.key("MDI"); for (const k of ["ALPHA_G", "NUM_0", "NUM_0", "SPACE", "ALPHA_X", "MINUS", "NUM_5", "NUM_0", "DOT"]) s.key(k);
assert.equal(s.m.input, "G00 X-50."); s.key("INSERT"); assert.equal(s.m.mdi, "G00 X-50."); assert.equal(s.m.input, "");
s.op("cycle_start"); assert.equal(s.m.program, "running"); assert.equal(s.m.runSource, "mdi");
s.op("reset"); assert.equal(s.m.program, "idle");
s.key("LIST_PROGRAM"); assert.equal(s.m.display, "list"); s.key("SELECT_PROGRAM"); assert.equal(s.m.activeProgram, "O09999");
s.key("ZERO_RETURN"); s.key("ALPHA_Z"); s.key("ZR_SINGLE"); assert.deepEqual(s.m.homingAxes, ["z"]); s.wait(); assert.equal(s.m.position.z, 0);
});

scenario('7. crash and stock ok', () => {

// 7. Crash and stock interlocks.
s.dispatch({ type: "crash", text: "TOOL SHANK HIT THE PART" }); assert.equal(s.m.alarms[0].code, "crash"); assert.equal(s.lastRun, "stop");
s.op("reset"); assert.deepEqual(s.m.alarms, []);
s.dispatch({ type: "stock", stock: { size: [80, 60, 40], material: "aluminium" } }); assert.match(s.log.at(-1), /Open the door/);
s.op("door"); s.dispatch({ type: "stock", stock: { size: [80, 60, 40], material: "aluminium" } }); assert.deepEqual(s.m.stock.size, [80, 60, 40]);
});

scenario("8. warm-up O09999 runs through the interpreter and playback", () => {
  const ready = { ...T.readyMachineState };
  const result = nc.interpret(T.WARMUP_PROGRAM, {
    workOffsets: ready.workOffsets,
    tools: {},
    toolInSpindle: 2,
    start: ready.position,
    options: { metricDefault: true },
  });
  assert.equal(result.diagnostics.filter((d) => d.severity === "alarm").length, 0);
  let cursor = P.startCursor;
  let position = ready.position;
  const rpm = [];
  let halt = null;
  let seconds = 0;
  while (!halt && seconds < 60) {
    const step = P.advance(result, cursor, position, 0.05, { overrides: { feed: 100, rapid: 100 }, singleBlock: false, optionalStop: false });
    cursor = step.cursor;
    position = step.position;
    for (const e of step.events) if (e.kind === "spindle") rpm.push(e.dir === "stop" ? 0 : e.rpm);
    halt = step.halt;
    seconds += 0.05;
  }
  assert.equal(halt, "end");
  assert.deepEqual(rpm.filter((r) => r > 0), [1000, 4000, 8100]);
  assert.ok(seconds > 7.5 && seconds < 12, `took ${seconds.toFixed(1)} s`);
});

scenario("9. single block stops between blocks; overrides scale time", () => {
  const result = nc.interpret("G00 G90 G54 X-10.\nX-20.\nX-30.\nM30", {
    workOffsets: { G54: { x: 0, y: 0, z: 0, b: 0, c: 0 } },
    tools: {},
    toolInSpindle: 0,
    start: { x: 0, y: 0, z: 0, b: 0, c: 0 },
    options: { metricDefault: true },
  });
  const opts = { overrides: { feed: 100, rapid: 100 }, singleBlock: true, optionalStop: false };
  let step = P.advance(result, P.startCursor, { x: 0, y: 0, z: 0, b: 0, c: 0 }, 10, opts);
  assert.equal(step.halt, "singleBlock");
  assert.equal(step.position.x, -10);
  step = P.advance(result, step.cursor, step.position, 10, opts);
  assert.equal(step.position.x, -20);
  const slow = P.advance(result, P.startCursor, { x: 0, y: 0, z: 0, b: 0, c: 0 }, 0.01, { ...opts, overrides: { feed: 100, rapid: 5 } });
  const fast = P.advance(result, P.startCursor, { x: 0, y: 0, z: 0, b: 0, c: 0 }, 0.01, opts);
  assert.ok(Math.abs(fast.position.x) > Math.abs(slow.position.x) * 10);
});

// ---------------------------------------------------------------------------
// The machine store with the interpreter behind CYCLE START, driven frame by
// frame the way MachineRuntime drives it in the scene.

const K = require(join(out, "entities/machine/kinematics.js"));
const cam = require(join(out, "entities/part/cam.js"));
const design = require(join(out, "entities/part/part-design.js"));
const { idealWorkOffset } = require(join(out, "entities/part/setup.js"));
const { TOOL_LIBRARY } = require(join(out, "entities/part/tool-library.js"));

const store = () => useMachineStore.getState();
function readyStore(patch = {}) {
  store().makeReady();
  useMachineStore.setState({ machine: { ...store().machine, ...patch }, message: null });
}
/** Plays the active run in 50 ms frames until it stops running or `limit`
 *  seconds pass; returns the program state it ended in. */
function play(limit = 600, onFrame) {
  for (let t = 0; t < limit; t += 0.05) {
    const run = getActiveRun();
    const m = store().machine;
    if (!run || m.program !== "running") return m.program;
    const frame = R.stepRun(run, m, 0.05);
    for (const action of frame.actions) store().runAction(action);
    if (frame.progress) store().runAction(frame.progress);
    onFrame?.(frame);
  }
  return "timeout";
}
function runProgram(text, name = "O01234") {
  store().loadProgram(name, text);
  store().pressKey("MEMORY");
  return store().operate("cycle_start");
}
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not ${b} ± ${tol}`);

scenario("10. MDI program runs end to end through the store", () => {
  readyStore({ mode: "mdi", mdi: "S1000 M03\nG00 G90 G54 X-25. Y-10.\nG01 Z-5. F600.\nG91 X-5." });
  store().setOffsets({ workOffsets: { ...store().machine.workOffsets, G54: { x: -100, y: -50, z: -150, b: 0, c: 0 } } });
  assert.equal(store().operate("cycle_start").run, "start");
  assert.ok(getActiveRun());
  assert.equal(play(), "idle");
  const m = store().machine;
  assert.deepEqual([m.position.x, m.position.y, m.position.z], [-130, -60, -155]);
  assert.equal(m.lastProgramDone, "MDI");
  assert.equal(getActiveRun(), null);
  assert.equal(m.activeCodes.motion, "G01");
  assert.equal(m.activeCodes.distance, "G91");
  assert.equal(m.activeCodes.feed, 600);
});

scenario("11. G10, tool and macro writes persist; the program's work offset becomes active", () => {
  readyStore();
  runProgram(
    [
      "G10 L2 P2 X-100. Y-50. Z-200.",
      "G10 L10 P3 R150.",
      "G10 L12 P3 R10.",
      "G91",
      "G10 L2 P2 X-1.",
      "G90",
      "#500 = 42.",
      "#2003 = 151.",
      "G55 G00 X0 Y0",
      "M30",
    ].join("\n"),
  );
  assert.equal(play(), "idle");
  let m = store().machine;
  assert.deepEqual(m.alarms, []);
  assert.deepEqual(m.workOffsets.G55, { x: -101, y: -50, z: -200, b: 0, c: 0 });
  assert.equal(m.tools[3].length, 151);
  assert.equal(m.tools[3].diameter, 10);
  assert.equal(m.macroVariables[500], 42);
  assert.equal(m.activeWorkOffset, "G55");
  assert.deepEqual([m.position.x, m.position.y], [-101, -50]);
  // The control keeps them: the next program reads #500 and the new G55.
  runProgram("IF [#500 NE 42.] THEN #3000 = 1 (LOST #500)\nG55 G00 X10.\nM30", "O01235");
  assert.equal(play(), "idle");
  m = store().machine;
  assert.deepEqual(m.alarms, []);
  assert.equal(m.position.x, -91);
});

scenario("12. A program alarm stops the run at its block; what ran before it stays", () => {
  readyStore();
  runProgram("G10 L2 P1 X-10.\nS1000 M03\nG53 G00 X-10.\nG53 G01 X-20. F3000.\nG53 G00 X50.\nM30");
  assert.equal(play(), "idle");
  const m = store().machine;
  assert.equal(m.alarms.length, 1);
  assert.equal(m.alarms[0].code, "program");
  assert.match(m.alarms[0].text, /TRAVEL/i);
  assert.equal(m.programLine, 5);
  assert.equal(m.position.x, -20);
  assert.equal(m.workOffsets.G54.x, -10);
  assert.match(store().message, /line 5/);
  assert.equal(getActiveRun(), null);
  store().operate("reset");
  assert.deepEqual(store().machine.alarms, []);
});

scenario("13. FEED HOLD pauses mid-move; M00 stops; CYCLE START resumes both", () => {
  readyStore();
  runProgram("S1000 M03\nG53 G01 X-30. F1500.\nM00\nG53 G00 X-60.\nM30");
  play(0.5); // 30 mm at 1500 mm/min takes 1.2 s
  store().operate("feed_hold");
  assert.equal(store().machine.program, "hold");
  const held = getActiveRun().position.x;
  assert.ok(held < -5 && held > -25, `held at X${held}`);
  assert.equal(play(), "hold");
  assert.equal(getActiveRun().position.x, held);
  store().operate("cycle_start");
  assert.equal(store().machine.program, "running");
  assert.equal(play(), "stopped");
  assert.equal(store().machine.position.x, -30);
  assert.equal(store().machine.programLine, 3);
  assert.equal(store().machine.spindle.dir, "stop"); // M00 stops the spindle
  store().pressKey("SPINDLE_FWD");
  store().operate("cycle_start");
  assert.equal(play(), "idle");
  assert.equal(store().machine.position.x, -60);
});

scenario("14. Single block: CURRENT COMMANDS follow each block; RESET restores the defaults", () => {
  readyStore({ singleBlock: true });
  runProgram("S1000 M03\nG00 G90 G54 X-10.\nG01 G91 X-5. F250.\nG90 G00 X-30.\nM30");
  assert.equal(play(), "stopped"); // after S1000 M03, which has no motion
  assert.equal(store().machine.spindle.dir, "cw");
  store().operate("cycle_start");
  assert.equal(play(), "stopped");
  let m = store().machine;
  assert.equal(m.position.x, -10);
  assert.deepEqual([m.activeCodes.motion, m.activeCodes.distance], ["G00", "G90"]);
  store().operate("cycle_start");
  assert.equal(play(), "stopped");
  m = store().machine;
  assert.equal(m.position.x, -15);
  assert.deepEqual([m.activeCodes.motion, m.activeCodes.distance, m.activeCodes.feed], ["G01", "G91", 250]);
  store().operate("reset");
  m = store().machine;
  assert.equal(m.program, "idle");
  assert.equal(getActiveRun(), null);
  assert.deepEqual([m.activeCodes.motion, m.activeCodes.distance, m.activeCodes.feed], ["G00", "G90", 0]);
});

scenario("15. CYCLE START puts the interpreter's warnings on the message line", () => {
  readyStore();
  runProgram("G53 G00 X-10\nM30");
  assert.match(store().message ?? "", /^Line 1: X-10 .*X-0\.01/);
  assert.equal(play(), "idle");
  assert.equal(store().machine.position.x, -0.01);
});

scenario("16. The sample job: CAM program, set up as the shortcuts do, cuts where the design says", () => {
  const d = design.SAMPLE_DESIGN;
  const { text: program } = cam.generateProgram(d);
  const tools = { ...store().machine.tools };
  for (const t of TOOL_LIBRARY) tools[t.number] = { ...tools[t.number], length: t.length, lengthWear: 0, diameter: t.diameter };
  readyStore({ stock: { size: [d.stock.x, d.stock.y, d.stock.z], material: d.stock.material } });
  store().setOffsets({ tools, workOffsets: { ...store().machine.workOffsets, G54: idealWorkOffset(d.stock) } });
  runProgram(program, `O0${d.programNumber}`);
  assert.ok(getActiveRun(), store().message);
  assert.deepEqual(getActiveRun().result.diagnostics, []);

  // Tool tips in the stock frame (origin at the bottom-face centre), per tool and axis.
  const tips = new Map();
  assert.equal(
    play(600, (frame) => {
      const t = TOOL_LIBRARY.find((x) => x.number === store().machine.toolInSpindle);
      for (const p of frame.feed) {
        const { tip, axis } = K.toolInStock(p, t.length);
        const key = `T${t.number} ${axis.map((a) => Math.round(a)).join(",")}`;
        if (!tips.has(key)) tips.set(key, []);
        tips.get(key).push(tip);
      }
    }),
    "idle",
  );
  const m = store().machine;
  assert.deepEqual(m.alarms, []);
  assert.equal(m.lastProgramDone, `O0${d.programNumber}`);

  const top = d.stock.z;
  const lowest = (key) => Math.min(...tips.get(key).map((p) => p[2]));
  // Facing takes 1 mm off the top with the face mill pointing straight down.
  near(lowest("T1 0,0,1"), top - 1, 0.05, "face mill depth");
  // The side hole on the right face: the drill points along +X at (u 0, v 6).
  const side = design.facePoint("right", d.stock, 0, 6, 12);
  const drill = tips.get("T5 1,0,0");
  assert.ok(drill, `no +X drilling; tools/axes seen: ${[...tips.keys()].join(" | ")}`);
  const deepest = drill.reduce((a, b) => (b[0] < a[0] ? b : a));
  near(deepest[1], side[1], 0.05, "side hole Y");
  near(deepest[2], side[2] + top, 0.05, "side hole Z");
  assert.ok(deepest[0] <= side[0] + 0.05 && deepest[0] >= side[0] - 2.5, `side hole bottom at X${deepest[0]}`);
  // The slot on the front face: the 6 mm end mill points along -Y, 3 mm in.
  const slot = tips.get("T3 0,-1,0");
  assert.ok(slot, `no -Y milling; tools/axes seen: ${[...tips.keys()].join(" | ")}`);
  near(Math.max(...slot.map((p) => p[1])), design.facePoint("front", d.stock, 0, 4, 3)[1], 0.05, "slot depth");
  // Nothing feeds into the vise: the jaws hold the bottom JAW_GRIP mm.
  for (const [key, list] of tips) {
    const low = Math.min(...list.map((p) => p[2]));
    assert.ok(low > design.JAW_GRIP, `${key} feeds down to Z${low.toFixed(2)}, into the jaws`);
  }
});

scenario("17. Program check: the sample job is clean on the ideal setup; unmeasured tools would crash", () => {
  const { checkProgram } = require(join(out, "features/part-development/program-check.js"));
  const d = design.SAMPLE_DESIGN;
  const { text } = cam.generateProgram(d);
  const ideal = checkProgram(text, d, "ideal", store().machine);
  assert.deepEqual(ideal.result.diagnostics, []);
  assert.deepEqual(ideal.crashes, []);
  // G54 probed, but the tool lengths never measured: every H is 0.
  readyStore();
  store().setOffsets({ workOffsets: { ...store().machine.workOffsets, G54: idealWorkOffset(d.stock) } });
  const unmeasured = checkProgram(text, d, "machine", store().machine);
  assert.ok(unmeasured.crashes.length > 0, "no crash found");
  assert.match(unmeasured.crashes[0].message, /^T1 would drive into the vise, .* mm below the top of the jaws/);
  // Measured as the tool setter would, the machine matches the ideal.
  const tools = { ...store().machine.tools };
  for (const t of TOOL_LIBRARY) tools[t.number] = { ...tools[t.number], length: t.length, lengthWear: 0, diameter: t.diameter };
  store().setOffsets({ tools });
  assert.deepEqual(checkProgram(text, d, "machine", store().machine).crashes, []);
});

scenario("18. M06 through the side-mount changer: head to the arm, random pockets, feed hold, keypad changes", () => {
  const TC = require(join(out, "entities/machine/tool-changer.js"));
  readyStore({ position: { x: -300, y: -200, z: -100, b: 0, c: 0 } });
  let m = store().machine;
  assert.equal(m.toolInSpindle, 2);
  assert.equal(m.pockets[1], 0, "T2's own pocket is empty while T2 is in the spindle");
  assert.equal(m.carouselPocket, 2);

  runProgram("T3 M06\nT2 M06\nM30");
  const { motions } = getActiveRun().result;
  const changes = motions.filter((x) => x.kind === "toolChange");
  // T3 is one pocket round; T2 then comes back out of pocket 3, where T3 goes.
  assert.deepEqual(changes.map((c) => [c.tool, c.from, c.pocket, c.index]), [[3, 2, 3, 1], [2, 3, 3, 0]]);
  // Z clears first, then X/Y go to the arm (Setting 247 OFF).
  const rapids = motions.filter((x) => x.kind === "rapid").map((x) => [x.to.x, x.to.y, x.to.z]);
  assert.deepEqual(rapids, [[-300, -200, 0], [-610, -82, 0]]);

  const c = changes[0];
  const pose = (s) => TC.changerPose(c, s);
  assert.equal(pose(c.indexSeconds / 2).phase, "index");
  const swing = pose(c.indexSeconds + 0.56 * (c.seconds - c.indexSeconds));
  assert.deepEqual([swing.phase, swing.outgoing, swing.incoming, swing.armDown], ["swing", "arm", "arm", 1]);
  const end = pose(c.seconds);
  assert.deepEqual([end.outgoing, end.incoming, end.pocketDown, end.armDown, end.arm], ["pocket", "spindle", 0, 0, -180]);

  assert.equal(play(), "idle");
  m = store().machine;
  assert.equal(m.toolInSpindle, 2);
  assert.equal(m.pockets[2], 3, "T3 went back into pocket 3");
  assert.equal(m.pockets[1], 0, "pocket 2 stays empty");
  assert.equal(m.carouselPocket, 3);
  assert.deepEqual([m.position.x, m.position.y, m.position.z], [-610, -82, 0]);

  // FEED HOLD stops a change in progress (mcode.md §5.3); CYCLE START finishes it.
  runProgram("T5 M06\nM30");
  let held = null;
  for (let i = 0; i < 400 && !held; i++) {
    play(0.05);
    const at = R.activeToolChange(getActiveRun());
    if (at && at.elapsed > 0.5) {
      store().operate("feed_hold");
      held = { ...getActiveRun().cursor };
    }
  }
  assert.ok(held, "never reached the tool change");
  assert.equal(play(), "hold");
  assert.deepEqual(getActiveRun().cursor, held);
  assert.equal(store().machine.toolInSpindle, 2);
  store().operate("cycle_start");
  assert.equal(play(), "idle");
  assert.equal(store().machine.toolInSpindle, 5);

  // Keypad changes play the same M06: ATC FWD in MDI (next tool round, or a
  // typed Tnn), NEXT TOOL in HANDLE JOG. Neither counts as a program run.
  const done = store().machine.lastProgramDone;
  store().pressKey("MDI");
  assert.equal(store().pressKey("ATC_FWD").next.runSource, "atc");
  assert.equal(play(), "idle");
  assert.equal(store().machine.toolInSpindle, 6);
  useMachineStore.setState({ machine: { ...store().machine, input: "T1" } });
  store().pressKey("ATC_REV");
  assert.equal(play(), "idle");
  assert.equal(store().machine.toolInSpindle, 1);
  store().pressKey("HANDLE_JOG");
  store().pressKey("NEXT_TOOL");
  assert.equal(play(), "idle");
  m = store().machine;
  assert.equal(m.toolInSpindle, 2);
  assert.equal(m.lastProgramDone, done);
  assert.equal(m.mode, "jog");
  assert.match(store().pressKey("ATC_FWD").rejected ?? "", /works in MDI/);
  useMachineStore.setState({ machine: { ...store().machine, doorOpen: true } });
  assert.match(store().pressKey("NEXT_TOOL").rejected ?? "", /Close the door/);
  // Every tool is somewhere, once.
  m = store().machine;
  const placed = [...m.pockets.filter(Boolean), m.toolInSpindle].sort((a, b) => a - b);
  assert.deepEqual(placed, TOOL_LIBRARY.map((t) => t.number));
});

scenario("19. Every tutorial level can be played to the end by doing what it says", () => {
  const { TUTORIALS } = require(join(out, "features/levels/tutorials.js"));
  const { useJobStore } = require(join(out, "features/part-development/job-store.js"));
  const { idealWorkOffset } = require(join(out, "entities/part/setup.js"));
  const blank = { x: 80, y: 60, z: 30, material: "aluminium" };
  const p = idealWorkOffset(blank);
  const op = (part, sign) => store().operate(part, sign);
  const key = (k) => store().pressKey(k);
  const CHAR = { " ": "SPACE", ".": "DOT", "-": "MINUS", ";": "EOB" };
  const type = (text) => {
    for (const ch of text) key(/[A-Z]/.test(ch) ? `ALPHA_${ch}` : /\d/.test(ch) ? `NUM_${ch}` : CHAR[ch]);
  };
  // The store's own timers are real ones; a scenario runs them by hand.
  const finishHoming = () => {
    for (let i = 0; i < 10 && store().machine.homingStage !== null; i++) {
      useMachineStore.setState({ machine: L.reduce(store().machine, { type: "timer", timer: "homing" }).next });
    }
  };
  /** Jog the selected axis with the handwheel at 1 mm per detent (10 per click). */
  const jogTo = (axis, target) => {
    op(`axis_${axis}`);
    key("INC_1");
    const clicks = Math.round((target - store().machine.position[axis]) / 10);
    for (let i = 0; i < Math.abs(clicks); i++) op("handwheel", Math.sign(clicks));
  };
  const gap = () => store().machine.position.z - (p.z + TOOL_LIBRARY.find((t) => t.number === store().machine.toolInSpindle).length);
  /** Down onto the part the way the tutorial teaches: coarse, then finer, to a paper's thickness. */
  const touchOff = () => {
    op("axis_z");
    for (const [inc, stop] of [["INC_1", 15], ["INC_01", 1.05], ["INC_001", 0.1]]) {
      key(inc);
      for (let i = 0; i < 200 && gap() > stop; i++) op("handwheel", -1);
    }
    assert.ok(gap() >= 0 && gap() <= 0.1, `touch-off ended ${gap().toFixed(3)} mm above the part`);
  };

  function playLevel(id, script) {
    const t = TUTORIALS[id];
    t.prepare();
    let cursor = { stepIndex: 0, phaseIndex: 0, status: "active", reached: 0 };
    const violations = [];
    const sync = () => {
      const r = advanceTutorial(t.steps, cursor, store().machine);
      cursor = r.cursor;
      if (r.violation) violations.push(r.violation);
    };
    const offMachine = useMachineStore.subscribe(sync);
    const offJob = useJobStore.subscribe(sync);
    sync();
    try {
      script();
    } finally {
      offMachine();
      offJob();
    }
    const at = cursor.status === "complete" ? "complete" : `${t.steps[cursor.stepIndex].id}/${t.steps[cursor.stepIndex].phases[cursor.phaseIndex].id}`;
    assert.equal(at, "complete", `${id} stopped at ${at}`);
    assert.deepEqual(violations, [], `${id} sent the trainee back`);
  }

  playLevel("umc500.tutorial.jog", () => {
    op("hand_jog");
    jogTo("x", -100);
    jogTo("y", -80);
    op("axis_z");
    key("INC_001");
    for (let i = 0; i < 5; i++) op("handwheel", -1);
    key("INC_1");
    jogTo("b", 30);
    jogTo("c", 90);
    op("power_up");
    finishHoming();
  });

  playLevel("umc500.tutorial.work-offset", () => {
    store().setStock({ size: [80, 60, 30], material: "aluminium" });
    op("door");
    key("OFFSET");
    if (store().machine.offsetTab !== "work") key("OFFSET");
    type(p.x.toFixed(3));
    key("F1");
    key("RIGHT");
    type(p.y.toFixed(3));
    key("F1");
  });

  playLevel("umc500.tutorial.tool-length", () => {
    op("hand_jog");
    jogTo("x", p.x);
    jogTo("y", p.y);
    touchOff();
    key("TOOL_OFFSET_MEASURE");
    key("NEXT_TOOL");
    assert.equal(play(), "idle");
    assert.equal(store().machine.toolInSpindle, 3);
    jogTo("x", p.x);
    jogTo("y", p.y);
    touchOff();
    key("TOOL_OFFSET_MEASURE");
  });

  playLevel("umc500.tutorial.mdi", () => {
    key("MDI");
    type("G00 G90 G54 X0 Y0");
    key("INSERT");
    op("cycle_start");
    assert.equal(play(), "idle");
    type("S1500 M03");
    key("INSERT");
    op("cycle_start");
    assert.equal(play(), "idle");
    key("ERASE_PROGRAM");
  });

  playLevel("umc500.tutorial.first-program", () => {
    key("LIST_PROGRAM");
    while (L.sortedPrograms(store().machine)[store().machine.offsetCursor.row] !== "O02001") key("UP");
    key("SELECT_PROGRAM");
    key("SINGLE_BLOCK");
    key("RAPID_25");
    key("MEMORY");
    op("cycle_start");
    for (let i = 0; i < 60 && store().machine.programLine < 12; i++) {
      play();
      op("cycle_start");
    }
    play();
    key("SINGLE_BLOCK");
    key("RAPID_100");
    op("cycle_start");
    play(1);
    op("feed_hold");
    op("cycle_start");
    assert.equal(play(), "idle");
  });

  playLevel("umc500.tutorial.gcode-basics", () => {
    const job = useJobStore.getState();
    job.setProgram(job.program.replace("(YOUR MOVES HERE)", "G01 X30.\nY20.\nG03 X-30. R30.\nG01 Y-20."));
    store().loadProgram("O02002", useJobStore.getState().program);
    key("MEMORY");
    op("cycle_start");
    assert.equal(play(), "idle");
  });
});

scenario("20. Tool crib: the standard set is as the levels were built on; a loadout is checked against the changer; the CAM picks from what is loaded", () => {
  const lib = require(join(out, "entities/part/tool-library.js"));
  const { checkLoadout, STANDARD_LOADOUT } = require(join(out, "entities/tooling/loadout.js"));
  const { CRIB } = require(join(out, "entities/tooling/catalog.js"));
  const { MACHINES } = require(join(out, "entities/catalog/machines.js"));
  const spec = MACHINES[0].tooling;
  const slots = (pairs) => pairs.map(([number, assembly]) => ({ number, assembly }));

  // T1–T8 keep the sizes tasks, CAM and holder-crash checks were tuned on.
  assert.deepEqual(
    lib.TOOL_LIBRARY.map((t) => [t.number, t.length, t.stickout, t.holderDiameter, t.diameter, t.fluteLength]),
    [[1, 72, 30, 50, 50, 6], [2, 95, 38, 32, 10, 22], [3, 88, 30, 28, 6, 16], [4, 82, 28, 28, 10, 8],
     [5, 110, 60, 24, 5, 52], [6, 118, 68, 24, 6.8, 63], [7, 126, 78, 26, 8.5, 75], [8, 90, 32, 28, 6, 14]],
  );
  assert.deepEqual(checkLoadout(STANDARD_LOADOUT, spec), []);
  for (const t of CRIB) assert.deepEqual(checkLoadout(slots([[15, t.id]]), spec), [], `${t.id} fits on its own`);

  // A large tool needs both neighbours empty, and pockets wrap round.
  const large = (n, others) => checkLoadout(slots([[n, "face-80"], ...others.map((o) => [o, "em-6"])]), spec).length;
  assert.equal(large(10, [8, 12]), 0);
  assert.equal(large(10, [9]), 1);
  assert.equal(large(10, [11]), 1);
  assert.equal(large(1, [30]), 1);
  assert.equal(large(30, [1]), 1);
  // Out of the changer, twice in the table, not in the crib, or over a limit.
  assert.equal(checkLoadout(slots([[31, "em-6"]]), spec).length, 1);
  assert.equal(checkLoadout(slots([[2, "em-6"], [2, "em-10"]]), spec).length, 1);
  assert.equal(checkLoadout(slots([[2, "no-such-tool"]]), spec).length, 1);
  assert.equal(checkLoadout(slots([[3, "drill-12"]]), { ...spec, maxLength: 150 }).length, 1);
  assert.equal(checkLoadout(slots([[3, "face-80"]]), { ...spec, maxMass: 2 }).length, 1);
  assert.equal(checkLoadout(slots([[3, "em-6"]]), { ...spec, interface: "BT40" }).length, 1);

  // The sample job with another set loaded: no spot drill, a bigger face
  // mill and end mill. The CAM uses what is there and says what is missing.
  const d = design.SAMPLE_DESIGN;
  try {
    lib.setActiveTools(lib.loadoutTools(slots([[1, "face-63"], [2, "em-12"], [3, "em-6"], [5, "drill-5.0"], [6, "drill-6.8"]])));
    const result = cam.generateProgram(d);
    const used = [...new Set(result.text.match(/T\d+ M06/g))].sort();
    assert.deepEqual(used, ["T1 M06", "T2 M06", "T3 M06", "T5 M06", "T6 M06"]);
    assert.ok(result.warnings.some((w) => w.includes("no spot drill")), result.warnings.join("; "));
    assert.ok(!/T4 M06/.test(result.text));
  } finally {
    lib.setActiveTools(lib.TOOL_LIBRARY);
  }
  // Back on the standard set the sample job spots its holes with T4.
  assert.ok(/T4 M06/.test(cam.generateProgram(d).text));
});

rmSync(temp, { recursive: true, force: true });
console.log(failed ? `\n${failed} scenario(s) failed` : "\nall scenarios passed");
process.exit(failed ? 1 : 0);
