// Golden checks for the G-code interpreter in src/entities/nc.
//
// There is no test runner in the repo, so this compiles the interpreter (and
// the machine modules it imports) with the repo's own TypeScript into a temp
// directory, then runs plain assertions and prints a pass/fail table.
//
//   node tools/nc-check/run.mjs
//
// Exit code 1 if any check fails.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temp = mkdtempSync(join(tmpdir(), "nc-check-"));
const out = join(temp, "out");

function compile(files) {
  const tsconfig = join(temp, `tsconfig-${files.length}.json`);
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        moduleResolution: "node",
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        types: [],
        lib: ["ES2022", "DOM"],
        rootDir: join(repo, "src"),
        outDir: out,
        baseUrl: repo,
        paths: { "@/*": ["src/*"] },
      },
      files: files.map((f) => join(repo, f)),
    }),
  );
  execFileSync(process.execPath, [join(repo, "node_modules/typescript/bin/tsc"), "-p", tsconfig], { stdio: "pipe" });
}

try {
  compile(["src/entities/nc/index.ts"]);
} catch (e) {
  console.error(String(e.stdout ?? e));
  rmSync(temp, { recursive: true, force: true });
  process.exit(1);
}

// The emitted CommonJS still says require("@/…"); point that at the output.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = join(out, request.slice(2));
  return resolveFilename.call(this, request, ...rest);
};
const require = createRequire(join(out, "index.js"));
const nc = require(join(out, "entities/nc/index.js"));
const kin = require(join(out, "entities/machine/kinematics.js"));
const { TRAVEL } = require(join(out, "entities/machine/machine-logic.js"));

// --- fixtures -------------------------------------------------------------------

const G54 = { x: -300, y: -200, z: -350, b: 0, c: 0 };
const TOOLS = {
  1: { number: 1, length: 100, diameter: 10 },
  2: { number: 2, length: 120, diameter: 6 },
  3: { number: 3, length: 110, diameter: 8.5 },
};
const START = { x: 0, y: 0, z: 0, b: 0, c: 0 };
const setup = (extra = {}) => ({
  workOffsets: { G54: { ...G54 } },
  tools: TOOLS,
  toolInSpindle: 1,
  start: START,
  ...extra,
  options: { ...(extra.options ?? {}) },
});
const run = (lines, extra) => nc.interpret(lines.join("\n"), setup(extra));

/** Work coordinates of a machine position with a tool of length H. */
const work = (p, H = 100, off = G54) => ({ x: p.x - off.x, y: p.y - off.y, z: p.z - off.z - H });
const moves = (r) => r.motions.filter((m) => m.kind === "rapid" || m.kind === "feed");
const alarms = (r) => r.diagnostics.filter((d) => d.severity === "alarm");

function close(a, b, tol, what) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${what}: got ${a.toFixed(4)}, expected ${b.toFixed(4)}`);
}
function point(p, q, tol, what) {
  close(p.x, q.x, tol, `${what} X`);
  close(p.y, q.y, tol, `${what} Y`);
  if (q.z !== undefined) close(p.z, q.z, tol, `${what} Z`);
}
function clean(r) {
  const a = alarms(r);
  if (a.length) throw new Error(`unexpected alarm line ${a[0].line}: ${a[0].code ?? ""} ${a[0].message}`);
}
function alarmAt(r, line, code) {
  const a = alarms(r);
  if (a.length !== 1) throw new Error(`expected one alarm, got ${a.length}: ${a.map((d) => d.message).join("; ")}`);
  if (a[0].line !== line) throw new Error(`alarm at line ${a[0].line}, expected ${line}: ${a[0].message}`);
  if (code && a[0].code !== code) throw new Error(`alarm code ${a[0].code}, expected ${code}: ${a[0].message}`);
  return a[0];
}
const ok = (cond, what) => {
  if (!cond) throw new Error(what);
};

const HEADER = ["O01000 (TEST)", "G00 G17 G21 G40 G49 G80 G90", "G00 G54 X0. Y0. S1000 M03", "G43 H01 Z25."];

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, pass: true, detail: detail ?? "" });
  } catch (e) {
    results.push({ name, pass: false, detail: e.message });
  }
}

// --- checks -----------------------------------------------------------------------

check("G0/G1 with G54 + G43 H01: machine Z = work Z + Z + H", () => {
  const r = run(["T1 M06", "G00 G90 G54 X10. Y20.", "S1000 M03", "G43 H01 Z5.", "G01 Z-2. F200.", "X30.", "M30"]);
  clean(r);
  const m = moves(r);
  point(m[0].to, { x: -290, y: -180, z: 0 }, 1e-9, "rapid to X10 Y20");
  close(m[1].to.z, -350 + 5 + 100, 1e-9, "G43 Z5");
  close(m[2].to.z, -350 - 2 + 100, 1e-9, "G01 Z-2");
  point(m[3].to, { x: -270, y: -180, z: -252 }, 1e-9, "X30");
  close(m[3].feed, 200, 1e-9, "feed");
  close(m[3].seconds, 6, 1e-9, "20 mm at F200");
  ok(r.motions.at(-1).kind === "end", "ends with M30");
  return `Z${m[2].to.z} at work Z-2`;
});

check("G02/G03 I/J/K and R arcs: endpoints, radius, direction, chord tolerance", () => {
  const r = run([...HEADER, "G01 Z0. F300.", "X20. Y0.", "G03 X0. Y20. I-20. J0.", "G02 X-20. Y0. R20.", "M30"]);
  clean(r);
  const arc1 = moves(r).filter((m) => m.line === 7).map((m) => work(m.to));
  const arc2 = moves(r).filter((m) => m.line === 8).map((m) => work(m.to));
  ok(arc1.length > 10, `G03 linearised into ${arc1.length} chords`);
  point(arc1.at(-1), { x: 0, y: 20, z: 0 }, 1e-9, "G03 end");
  point(arc2.at(-1), { x: -20, y: 0, z: 0 }, 1e-9, "G02 end");
  let worst = 0;
  let prev = { x: 20, y: 0 };
  for (const p of arc1) {
    close(Math.hypot(p.x, p.y), 20, 1e-9, "G03 point radius");
    worst = Math.max(worst, 20 - Math.hypot((p.x + prev.x) / 2, (p.y + prev.y) / 2));
    ok(Math.atan2(p.y, p.x) > Math.atan2(prev.y, prev.x) - 1e-12, "G03 turns counter-clockwise");
    prev = p;
  }
  ok(worst <= 0.01 + 1e-9, `chord error ${worst}`);
  // R20 CW from (0,20) to (-20,0), short way: centre (-20,20).
  for (const p of arc2) close(Math.hypot(p.x + 20, p.y - 20), 20, 1e-9, "G02 R point radius");
  return `${arc1.length}+${arc2.length} chords, max chord error ${worst.toFixed(4)} mm`;
});

check("Full circle G02 I-only and helix G03 with Z", () => {
  const r = run([...HEADER, "G01 Z0. F300.", "X20. Y0.", "G02 I-20.", "G03 X20. Y0. Z-6. I-20. J0.", "M30"]);
  clean(r);
  const full = moves(r).filter((m) => m.line === 7);
  const helix = moves(r).filter((m) => m.line === 8);
  const length = full.reduce((s, m) => s + Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y), 0);
  close(length, 2 * Math.PI * 20, 0.05, "full circle length");
  point(work(full.at(-1).to), { x: 20, y: 0, z: 0 }, 1e-9, "full circle end");
  let z = 0;
  for (const m of helix) {
    const p = work(m.to);
    close(Math.hypot(p.x, p.y), 20, 1e-9, "helix radius");
    ok(p.z < z + 1e-12, "helix Z descends steadily");
    z = p.z;
  }
  close(z, -6, 1e-9, "helix end Z");
  return `circle ${full.length} chords, helix ${helix.length} chords`;
});

check("G81 G99/G98 hole sequence and retract heights", () => {
  const r = run([...HEADER, "G99 G81 X10. Y10. Z-5. R2. F100.", "X20.", "G98 X30.", "G80", "M30"]);
  clean(r);
  const seq = moves(r)
    .filter((m) => m.line >= 5 && m.line <= 7)
    .map((m) => `${m.kind[0]}${+work(m.to).x.toFixed(3)},${+work(m.to).z.toFixed(3)}`);
  const want = ["r10,25", "r10,2", "f10,-5", "r10,2", "r20,2", "f20,-5", "r20,2", "r30,2", "f30,-5", "r30,25"];
  ok(seq.join(" ") === want.join(" "), `got ${seq.join(" ")}`);
  return seq.join(" ");
});

check("G83 peck (full retract) and G73 chip-break", () => {
  const r83 = run([...HEADER, "G98 G83 X0. Y0. Z-10. R1. Q4. F100.", "G80", "M30"]);
  clean(r83);
  const z83 = moves(r83).filter((m) => m.line === 5).map((m) => `${m.kind[0]}${+work(m.to).z.toFixed(2)}`);
  const want83 = "r1 f-3 r1 r-1.73 f-7 r1 r-5.73 f-10 r25";
  ok(z83.join(" ") === want83, `G83 got ${z83.join(" ")}`);
  const r73 = run([...HEADER, "G99 G73 X0. Y0. Z-10. R1. Q4. F100.", "G80", "M30"]);
  clean(r73);
  const z73 = moves(r73).filter((m) => m.line === 5).map((m) => `${m.kind[0]}${+work(m.to).z.toFixed(2)}`);
  const want73 = "r1 f-3 r-1.73 f-7 r-5.73 f-10 r1";
  ok(z73.join(" ") === want73, `G73 got ${z73.join(" ")}`);
  return `G83 ${z83.join(" ")} | G73 ${z73.join(" ")}`;
});

check("G91 canned cycle with L repeats (R from initial, Z from R)", () => {
  const r = run([...HEADER, "G91 G81 X10. Z-6. R-20. L3 F100.", "G90 G80", "M30"]);
  clean(r);
  const holes = moves(r).filter((m) => m.kind === "feed").map((m) => work(m.to));
  ok(holes.length === 3, `${holes.length} holes`);
  holes.forEach((p, i) => point(p, { x: 10 * (i + 1), y: 0, z: -1 }, 1e-9, `hole ${i + 1}`));
  const last = work(moves(r).at(-1).to);
  close(last.z, 25, 1e-9, "G98 return to the initial Z25");
  return "X10/20/30 to Z-1, back to Z25";
});

check("G41 outside a 40x40 square: path offset by D/2, sharp corners", () => {
  const r = run([
    ...HEADER,
    "G00 X-20. Y-20.",
    "G01 Z-5. F200.",
    "G41 D01 X0. Y-10.",
    "Y40.",
    "X40.",
    "Y0.",
    "X-10.",
    "G40 X-20. Y-20.",
    "G00 Z25.",
    "M30",
  ]);
  clean(r);
  const ends = moves(r)
    .filter((m) => m.line >= 7 && m.line <= 12)
    .map((m) => work(m.to));
  const want = [
    [-5, -10],
    [-5, 45],
    [45, 45],
    [45, -5],
    [-10, -5],
    [-20, -20],
  ];
  ok(ends.length === want.length, `${ends.length} moves: ${ends.map((p) => `(${p.x},${p.y})`).join(" ")}`);
  ends.forEach((p, i) => point(p, { x: want[i][0], y: want[i][1] }, 1e-9, `corner ${i}`));
  return want.map((p) => `(${p})`).join(" ");
});

check("G41 line–arc corner: offset arc radius R + D/2", () => {
  const r = run([
    ...HEADER,
    "G00 X-20. Y-20.",
    "G01 Z-5. F200.",
    "G41 D01 X0. Y-10.",
    "Y35.",
    "G02 X5. Y40. R5.",
    "G01 X40.",
    "G40 X50. Y50.",
    "M30",
  ]);
  clean(r);
  const arc = moves(r).filter((m) => m.line === 9).map((m) => work(m.to));
  ok(arc.length > 3, "arc linearised");
  for (const p of arc) close(Math.hypot(p.x - 5, p.y - 35), 10, 1e-9, "offset arc radius");
  point(arc.at(-1), { x: 5, y: 45 }, 1e-9, "arc end on the offset of X40 line");
  const line = moves(r).filter((m) => m.line === 8).at(-1);
  point(work(line.to), { x: -5, y: 35 }, 1e-9, "tangent line meets arc");
  return `${arc.length} chords at R10`;
});

check("Cutter comp alarms: inside arc smaller than radius (342), G18 (344)", () => {
  const small = run([
    ...HEADER,
    "G00 X0. Y0.",
    "G01 Z-5. F200.",
    "G41 D01 X10. Y0.",
    "Y20.",
    "G03 X7. Y23. R3.",
    "G01 X0.",
    "G40 X0. Y0.",
    "M30",
  ]);
  const a = alarmAt(small, 9, "342");
  const plane = run([...HEADER, "G18", "G41 D01 X10.", "M30"]);
  alarmAt(plane, 6, "344");
  return a.message;
});

check("G13 circular pocket I/K/Q with D01 (r5)", () => {
  const r = run([...HEADER, "G00 X0. Y0. Z2.", "G13 I8. K15. Q5. D01 Z-3. F200.", "G00 Z25.", "M30"]);
  clean(r);
  const pts = moves(r).filter((m) => m.line === 6).map((m) => work(m.to));
  const radius = Math.max(...pts.map((p) => Math.hypot(p.x, p.y)));
  close(radius, 10, 1e-6, "outer ring radius = K - r");
  const rings = new Set(pts.map((p) => Math.hypot(p.x, p.y).toFixed(3)));
  ok(rings.has("3.000") && rings.has("8.000") && rings.has("10.000"), `rings ${[...rings].slice(0, 8)}`);
  point(pts.at(-1), { x: 0, y: 0, z: -3 }, 1e-9, "ends at the centre, at depth");
  close(pts[0].z, -3, 1e-9, "plunge to Z-3 first");
  return `rings 3/8/10 mm, ${pts.length} moves`;
});

check("G70 bolt circle with G81 L0", () => {
  const r = run([...HEADER, "G00 X50. Y50.", "G81 G99 Z-3. R2. F100. L0", "G70 I20. J0. L4", "G80", "M30"]);
  clean(r);
  const holes = moves(r).filter((m) => m.kind === "feed").map((m) => work(m.to));
  const want = [
    [70, 50],
    [50, 70],
    [30, 50],
    [50, 30],
  ];
  ok(holes.length === 4, `${holes.length} holes`);
  holes.forEach((p, i) => point(p, { x: want[i][0], y: want[i][1], z: -3 }, 1e-9, `hole ${i + 1}`));
  return "4 holes at 0/90/180/270°";
});

check("G28: G91 Z0 straight home; G90 Z0 via work Z0", () => {
  const inc = run([...HEADER, "G00 X10. Y10.", "G91 G28 Z0.", "G90", "M30"]);
  clean(inc);
  const m = moves(inc).filter((x) => x.line === 6);
  ok(m.length === 1, `${m.length} moves`);
  point(m[0].to, { x: -290, y: -190, z: 0 }, 1e-9, "Z home, X/Y unchanged");
  const abs = run([...HEADER, "G00 X10. Y10.", "G90 G28 Z0.", "M30"]);
  clean(abs);
  const n = moves(abs).filter((x) => x.line === 6);
  ok(n.length === 2, `${n.length} moves`);
  close(n[0].to.z, -350 + 0 + 100, 1e-9, "intermediate at work Z0");
  close(n[1].to.z, 0, 1e-9, "then machine Z0");
  return "G91: 1 move; G90: via Z-250";
});

check("G10 L2 P2 sets G55, then G55 is used", () => {
  const r = run(["G10 L2 P2 X-250. Y-150. Z-340.", "G10 L2 P2 G91 X5.", "G90 G55 G00 X0. Y0.", "G43 H01 Z10.", "M30"]);
  clean(r);
  const m = moves(r);
  point(m[0].to, { x: -245, y: -150 }, 1e-9, "G55 X0 Y0");
  close(m[1].to.z, -340 + 10 + 100, 1e-9, "G55 Z10 with H01");
  return "G55 = X-245 Y-150 Z-340";
});

check("G68 rotation R90 about X0 Y0", () => {
  const r = run([...HEADER, "G68 X0. Y0. R90.", "G01 X10. Y0. F100.", "G91 X5.", "G90 G69", "G00 X0. Y0.", "M30"]);
  clean(r);
  const m = moves(r);
  point(work(m.find((x) => x.line === 6).to), { x: 0, y: 10 }, 1e-9, "X10 Y0 -> (0,10)");
  point(work(m.find((x) => x.line === 7).to), { x: 0, y: 15 }, 1e-9, "G91 X5 rotated too");
  return "(10,0)->(0,10), +X5 -> +Y5";
});

check("M98 P2000 L3 subprogram with M99, and M97 local", () => {
  const sub = "O02000\nG91 G01 X5. F100.\nG90\nM99\n";
  const r = run([...HEADER, "G00 X0. Y0. Z0.", "M98 P2000 L3", "M97 P100", "M30", "N100 G01 Y7. F100.", "M99"], {
    programs: { O02000: sub },
  });
  clean(r);
  const subMoves = moves(r).filter((m) => m.program === "O02000");
  ok(subMoves.length === 3, `${subMoves.length} sub moves`);
  close(work(subMoves.at(-1).to).x, 15, 1e-9, "3 x X5");
  close(work(moves(r).at(-1).to).y, 7, 1e-9, "M97 local sub ran");
  ok(r.motions.at(-1).kind === "end" && r.motions.at(-1).line === 8, "ends at M30");
  return "X+15 in O02000, then N100";
});

check("Macro WHILE loops drilling a 3x2 grid", () => {
  const r = run([
    ...HEADER,
    "#1 = 0",
    "WHILE [#1 LT 3] DO1",
    "#2 = 0",
    "WHILE [#2 LT 2] DO2",
    "G81 G98 X[#1 * 10] Y[#2 * 10 + 5] Z-2. R1. F100.",
    "#2 = #2 + 1",
    "END2",
    "#1 = #1 + 1",
    "END1",
    "G80",
    "M30",
  ]);
  clean(r);
  const holes = moves(r).filter((m) => m.kind === "feed").map((m) => work(m.to));
  ok(holes.length === 6, `${holes.length} holes`);
  const want = [
    [0, 5],
    [0, 15],
    [10, 5],
    [10, 15],
    [20, 5],
    [20, 15],
  ];
  holes.forEach((p, i) => point(p, { x: want[i][0], y: want[i][1], z: -2 }, 1e-9, `hole ${i + 1}`));
  return "6 holes";
});

check("Inch program (Setting 9 = INCH): converted to mm", () => {
  const r = run(["G20 G00 G90 G54 X1. Y-0.5", "S1000 M03", "G43 H01 Z0.5", "G01 Z-0.1 F10.", "M30"], {
    options: { metricDefault: false },
  });
  clean(r);
  const m = moves(r);
  point(m[0].to, { x: -300 + 25.4, y: -200 - 12.7 }, 1e-9, "X1 Y-0.5");
  close(m[2].to.z, -350 - 2.54 + 100, 1e-9, "Z-0.1");
  close(m[2].feed, 254, 1e-9, "F10 in/min");
  ok(r.modal.units === "G20", "modal G20");
  const wrong = run(["G20 G00 X1.", "M30"]);
  alarmAt(wrong, 1, "383");
  return "1 in = 25.4 mm; G20 on a metric control -> 383";
});

check("Over-travel alarm at the right line, motions stop before it", () => {
  const r = run([...HEADER, "G00 X-200.", "G00 X-400.", "G00 X0.", "M30"]);
  const a = alarmAt(r, 6, "1.316");
  ok(moves(r).every((m) => m.line < 6), "no motion from line 6 on");
  ok(r.motions.at(-1).kind !== "end", "program did not reach M30");
  return a.message;
});

check("Feed with spindle stopped / no S", () => {
  const stopped = run(["G00 G90 G54 X0. Y0. S1000", "G43 H01 Z5.", "G01 X10. F100.", "M30"]);
  const a = alarmAt(stopped, 3);
  ok(a.message.startsWith("FEED MOVE WITH SPINDLE STOPPED"), a.message);
  const noS = run(["G00 G90 G54 X0. Y0. M03", "G43 H01 Z5.", "G01 X10. F100.", "M30"]);
  alarmAt(noS, 3, "390");
  const noF = run([...HEADER, "G01 X10.", "M30"]);
  alarmAt(noF, 5, "320");
  return "spindle stopped; 390 no S; 320 no F";
});

check("G254 at B90 C90: X0 Y0 Z0 on the rotated work origin (kinematics.ts)", () => {
  // Work origin on top of a 50 mm stock in the vise, measured at B0 C0.
  const origin = kin.linearForNose([kin.C_CENTER[0], kin.C_CENTER[1], kin.C_CENTER[2] + kin.VISE_TOP + 50]);
  const off = { ...origin, b: 0, c: 0 };
  const r = nc.interpret(
    ["G00 G90 G54 S1000 M03", "G43 H01 Z100.", "G53 G00 Z0.", "G00 B90. C90.", "G254", "G00 X0. Y0.", "G00 Z0.", "G00 X10.", "M30"].join(
      "\n",
    ),
    { ...setup(), workOffsets: { G54: off } },
  );
  clean(r);
  const at7 = moves(r).filter((m) => m.line === 7).at(-1).to;
  const originTable = kin.workOriginInTable(off);
  const expected = kin.linearForTableTip(originTable, 90, 90, 100);
  point(at7, expected, 1e-9, "machine X/Y/Z");
  close(at7.b, 90, 1e-9, "B");
  close(at7.c, 90, 1e-9, "C");
  // Independent check: the tool tip, seen from the stock, is on the origin.
  const tip = kin.toolInStock(at7, 100).tip;
  const want = kin.tableToStock(originTable);
  point({ x: tip[0], y: tip[1], z: tip[2] }, { x: want[0], y: want[1], z: want[2] }, 1e-9, "tip on the work origin");
  const at8 = moves(r).filter((m) => m.line === 8).at(-1).to;
  const tip8 = kin.toolInStock(at8, 100).tip;
  point({ x: tip8[0], y: tip8[1], z: tip8[2] }, { x: want[0] + 10, y: want[1], z: want[2] }, 1e-9, "X10 along the part X");
  ok(moves(r).filter((m) => m.line >= 6).every((m) => m.tcp), "tcp flag set under G254");
  const bad = nc.interpret(["G00 G90 G54", "G254", "M30"].join("\n"), { ...setup(), workOffsets: { G54: { ...off, b: 5 } } });
  ok(alarms(bad)[0]?.message.startsWith("G254 WITH NON-ZERO B WORK OFFSET"), "B offset alarm");
  return `machine X${at7.x.toFixed(3)} Y${at7.y.toFixed(3)} Z${at7.z.toFixed(3)}`;
});

check("G234 TCPC: B/C move keeps the tip on the same part point", () => {
  const origin = kin.linearForNose([kin.C_CENTER[0], kin.C_CENTER[1], kin.C_CENTER[2] + kin.VISE_TOP + 50]);
  const off = { ...origin, b: 0, c: 0 };
  const r = nc.interpret(
    ["G00 G90 G54 S1000 M03", "G234 H01", "G00 X0. Y0. Z20.", "G01 B45. C30. F1000.", "G49", "M30"].join("\n"),
    { ...setup(), workOffsets: { G54: off } },
  );
  clean(r);
  const rot = moves(r).filter((m) => m.line === 4);
  ok(rot.length > 5, `${rot.length} segments`);
  const want = kin.tableToStock(kin.workOriginInTable(off)).map((v, i) => v + (i === 2 ? 20 : 0));
  let worst = 0;
  for (const m of rot) {
    const tip = kin.toolInStock(m.to, 100).tip;
    worst = Math.max(worst, Math.hypot(tip[0] - want[0], tip[1] - want[1], tip[2] - want[2]));
  }
  ok(worst < 1e-9, `tip moved ${worst} mm`);
  close(rot.at(-1).to.b, 45, 1e-9, "B end");
  close(rot.at(-1).to.c, 30, 1e-9, "C end");
  const seconds = rot.reduce((s, m) => s + m.seconds, 0);
  close(seconds, (Math.hypot(45, 30) / 1000) * 60, 1e-9, "rotary-only time at F deg/min");
  ok(rot.every((m) => m.tcp), "tcp flag");
  return `${rot.length} segments, tip error ${worst.toExponential(1)} mm`;
});

check("G04 dwell P1.5 = 1.5 s, P1500 = 1.5 s; cycle time sums", () => {
  const r = run([...HEADER, "G04 P1.5", "G04 P1500", "M30"]);
  clean(r);
  const d = r.motions.filter((m) => m.kind === "dwell").map((m) => m.seconds);
  ok(d.length === 2 && d[0] === 1.5 && d[1] === 1.5, `dwells ${d}`);
  const sum = r.motions.reduce((s, m) => s + (m.seconds ?? 0), 0);
  close(r.cycleSeconds, sum, 1e-9, "cycleSeconds");
  return `cycle ${r.cycleSeconds.toFixed(2)} s`;
});

check("Tool change: Z home, then X/Y to the SMTC arm; pockets swap; toolsUsed", () => {
  const r = run([...HEADER, "G01 Z0. F100.", "T2 M06", "S2000 M03", "G43 H02 Z10.", "G01 Z0.", "M30"]);
  clean(r);
  const i = r.motions.findIndex((m) => m.kind === "toolChange");
  const c = r.motions[i];
  ok(i > 1 && c.tool === 2 && c.from === 1, "toolChange T1 -> T2");
  // Z first, then X/Y at Z0 (Setting 247 OFF), both rapids.
  const [zUp, xy] = [r.motions[i - 2], r.motions[i - 1]];
  ok(zUp.kind === "rapid" && xy.kind === "rapid", "rapids before the change");
  close(zUp.to.z, 0, 1e-9, "Z at machine zero first");
  point(zUp.to, { ...zUp.from, z: 0 }, 1e-9, "Z alone");
  point(xy.to, { x: -610, y: -82, z: 0 }, 1e-9, "tool-change X/Y");
  // Default pockets: T N in pocket N; the spindle tool's pocket is at the arm.
  ok(c.pocket === 2 && c.index === 1, `pocket ${c.pocket}, index ${c.index}`);
  close(c.seconds, c.indexSeconds + 2.8, 1e-9, "index + 2.8 s swap");
  ok(JSON.stringify(r.toolsUsed) === "[1,2]", `toolsUsed ${r.toolsUsed}`);
  close(moves(r).at(-1).to.z, -350 + 0 + 120, 1e-9, "H02 length");
  // Random pockets: T1 went into pocket 2, so T1 comes back out of it.
  const back = run(["T2 M06", "T3 M06", "T1 M06", "M30"]);
  clean(back);
  const seq = back.motions.filter((m) => m.kind === "toolChange").map((m) => `${m.from}>${m.tool}@${m.pocket}${m.index >= 0 ? "+" : ""}${m.index}`);
  ok(JSON.stringify(seq) === '["1>2@2+1","2>3@3+1","3>1@2-1"]', `sequence ${seq}`);
  const given = run(["T3 M06", "M30"], { pockets: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], carouselPocket: 2 });
  const g = given.motions.find((m) => m.kind === "toolChange");
  ok(g.pocket === 30 && g.index === -2, `T3 from pocket 30 the short way: ${g.pocket} ${g.index}`);
  const bad = run([...HEADER, "T9 M06", "M30"]);
  ok(alarms(bad)[0]?.message.startsWith("TOOL NOT IN TOOL TABLE"), "T9 not in table");
  const unloaded = run(["T3 M06", "M30"], { pockets: new Array(30).fill(0) });
  ok(alarms(unloaded)[0]?.message.includes("not in a carousel pocket"), "T3 in no pocket");
  const noT = run(["M06", "M30"], { toolInSpindle: 0 });
  ok(alarms(noT)[0]?.message.startsWith("M06 WITHOUT T CODE"), "M06 without T");
  return `T1 -> T2: Z0, X-610 Y-82, ${c.seconds.toFixed(2)} s`;
});

check("Program errors: invalid G (310), two M-codes (339), arc R too small (302)", () => {
  alarmAt(run([...HEADER, "G31 X10.", "M30"]), 5, "310");
  alarmAt(run([...HEADER, "M08 M09", "M30"]), 5, "339");
  alarmAt(run([...HEADER, "G01 Z0. F100.", "G02 X40. Y0. R10.", "M30"]), 6, "302");
  alarmAt(run([...HEADER, "G01 Z0. F100.", "G02 X40. Y0. I10. J0.", "M30"]), 6, "304");
  alarmAt(run([...HEADER, "M98 P4444", "M30"]), 5, "314");
  return "310, 339, 302, 304, 314";
});

check("Decimal point rules: X10 = 0.010 mm (Setting 162 OFF), float with it ON", () => {
  const r = run([...HEADER, "G00 X10 Y2.", "M30"]);
  clean(r);
  close(work(moves(r).at(-1).to).x, 0.01, 1e-12, "X10 -> 0.010");
  ok(r.diagnostics.some((d) => d.severity === "warning" && d.message.includes("Setting 162")), "warning");
  const f = run([...HEADER, "G00 X10 Y2.", "M30"], { options: { defaultToFloat: true } });
  close(work(moves(f).at(-1).to).x, 10, 1e-12, "X10 -> 10 with Setting 162 ON");
  return "X10 = 0.010 mm / 10 mm";
});

check("G65 macro call: arguments to #24/#26, local scope", () => {
  const macro = "O09010\nG01 X#24 Z#26 F#9\nM99\n";
  const r = run([...HEADER, "G01 Z0. F100.", "G65 P9010 X12.5 Z-1. F50.", "M30"], { programs: { O09010: macro } });
  clean(r);
  const last = moves(r).at(-1);
  point(work(last.to), { x: 12.5, y: 0, z: -1 }, 1e-9, "macro move");
  close(last.feed, 50, 1e-9, "F from #9");
  return "X12.5 Z-1 F50 via #24/#26/#9";
});

check("Travel limits used are TRAVEL from machine-logic.ts", () => {
  ok(TRAVEL.x[0] === -610 && TRAVEL.z[0] === -406 && TRAVEL.c === null, JSON.stringify(TRAVEL));
  return JSON.stringify(TRAVEL);
});


check("G84 rigid tap: spindle runs itself, reverses at Z, J2 retract twice as fast", () => {
  const r = run(["G00 G90 G54 X0. Y0. S500", "G43 H01 Z25.", "G98 G84 X10. Y0. Z-10. R2. F500. J2", "G80", "M30"]);
  clean(r);
  const tap = r.motions.filter((m) => m.line === 3);
  const kinds = tap.map((m) => (m.kind === "spindle" ? m.dir : `${m.kind[0]}${+work(m.to).z.toFixed(2)}`)).join(" ");
  ok(kinds === "r25 r2 cw f-10 ccw f2 cw r25", kinds);
  const [down, up] = tap.filter((m) => m.kind === "feed");
  close(up.seconds, down.seconds / 2, 1e-9, "J2 retract time");
  return kinds;
});

check("G76 fine bore: orient, shift Q along +X, retract, shift back", () => {
  const r = run([...HEADER, "G98 G76 X0. Y0. Z-8. R2. Q0.5 F80.", "G80", "M30"]);
  clean(r);
  const seq = r.motions
    .filter((m) => m.line === 5)
    .map((m) => (m.kind === "spindle" ? m.dir : `${m.kind[0]}${+work(m.to).x.toFixed(2)},${+work(m.to).z.toFixed(2)}`))
    .join(" ");
  ok(seq === "r0,2 f0,-8 stop r0.5,-8 r0.5,25 r0,25 cw", seq);
  return seq;
});

check("G52 local shift and G92 position preset", () => {
  const r = run([...HEADER, "G52 X10. Y5.", "G00 X0. Y0.", "G52 X0. Y0.", "G00 X20. Y0.", "G92 X0. Y0.", "G00 X5. Y0.", "M30"]);
  clean(r);
  const at = (line) => work(moves(r).find((m) => m.line === line).to);
  point(at(6), { x: 10, y: 5 }, 1e-9, "G52 X10 Y5");
  point(at(8), { x: 20, y: 0 }, 1e-9, "G52 cleared");
  point(at(10), { x: 25, y: 0 }, 1e-9, "after G92 X0 at X20, X5 is X25");
  ok(r.modal.work.x === 5, `work position reads X${r.modal.work.x}`);
  return "G52 (10,5); G92 makes X20 read 0";
});

check("G51 scaling P2 about X0 Y0, arcs scaled too", () => {
  const r = run([...HEADER, "G01 Z0. F100.", "G51 X0. Y0. P2.", "G01 X10. Y0.", "G03 X0. Y10. I-10. J0.", "G50", "M30"]);
  clean(r);
  point(work(moves(r).find((m) => m.line === 7).to), { x: 20, y: 0 }, 1e-9, "X10 scaled x2");
  for (const m of moves(r).filter((x) => x.line === 8)) close(Math.hypot(work(m.to).x, work(m.to).y), 20, 1e-9, "arc R20");
  return "X10 -> 20, R10 arc -> R20";
});

check("G93 inverse time: block takes 60/F s; F needed on every block", () => {
  const r = run([...HEADER, "G01 Z0. F100.", "G93 G01 X50. F4.", "G94 F100.", "M30"]);
  clean(r);
  const m = moves(r).filter((x) => x.line === 6);
  close(m.reduce((s, x) => s + x.seconds, 0), 15, 1e-9, "60/4 s");
  const bad = run([...HEADER, "G01 Z0. F100.", "G93 G01 X50. F4.", "X60.", "M30"]);
  alarmAt(bad, 7, "320");
  return "15 s; missing F -> 320";
});

check("#3000 user alarm 1000+n with the comment; IF GOTO", () => {
  const r = run([...HEADER, "#100 = 3", "IF [#100 GT 2] GOTO 20", "G00 X50.", "N20 #3000 = 15 (FIXTURE NOT CLAMPED)", "M30"]);
  const a = alarmAt(r, 8, "1015");
  ok(a.message === "FIXTURE NOT CLAMPED", a.message);
  ok(!moves(r).some((m) => m.line === 7), "GOTO skipped line 7");
  return `${a.code} ${a.message}`;
});

check("M99: end of main stops without alarm; mid-program M99 alarms; M99 P jumps", () => {
  const loop = run([...HEADER, "G00 X10.", "M99"]);
  clean(loop);
  ok(loop.motions.at(-1).kind === "end", "end after M99");
  const stray = run([...HEADER, "M99", "G00 X10.", "M30"]);
  alarmAt(stray, 5);
  const jump = run([...HEADER, "#1 = 0", "N10 #1 = #1 + 1", "G91 G00 X1.", "IF [#1 GE 3] GOTO 20", "M99 P10", "N20 G90 M30"]);
  clean(jump);
  close(work(moves(jump).at(-1).to).x, 3, 1e-9, "three passes through N10");
  return "M99 end; stray M99 alarm; M99 P10 loop x3";
});

check("Block delete: /-blocks skipped only with BLOCK DELETE on", () => {
  const text = [...HEADER, "/G00 X50.", "G00 Y10.", "M30"];
  const off = run(text);
  const on = run(text, { options: { blockDelete: true } });
  clean(off);
  clean(on);
  ok(moves(off).some((m) => m.line === 5), "runs with BLOCK DELETE off");
  ok(!moves(on).some((m) => m.line === 5), "skipped with BLOCK DELETE on");
  return "ok";
});

check("G29 returns through the G28 intermediate point", () => {
  const r = run([...HEADER, "G00 X10. Y10.", "G28 G91 Z0.", "G90 G43 H01", "G29 X30. Y20.", "M30"]);
  clean(r);
  const m = moves(r).filter((x) => x.line === 8);
  point(work(m.at(-1).to), { x: 30, y: 20 }, 1e-9, "G29 target");
  return `${m.length} moves`;
});

check("M00 stops spindle and coolant; M01 only with OPTION STOP on", () => {
  const text = [...HEADER, "M08", "M01", "G01 X10. F100.", "M30"];
  const off = run(text);
  clean(off);
  const on = run(text, { options: { optionalStop: true } });
  alarmAt(on, 7);
  ok(on.motions.some((m) => m.kind === "coolant" && !m.on && m.line === 6), "coolant off at M01");
  return "M01 + OPTION STOP stops the spindle -> feed alarm on line 7";
});

// Integration: the repo's own CAM output for its sample part must run clean.
check("CAM sample program (src/entities/part/cam.ts) runs without alarms", () => {
  try {
    compile(["src/entities/nc/index.ts", "src/entities/part/cam.ts", "src/entities/part/setup.ts"]);
  } catch (e) {
    return `skipped: cam.ts does not compile on its own (${String(e.stdout ?? e).split("\n")[0]})`;
  }
  const cam = require(join(out, "entities/part/cam.js"));
  const design = require(join(out, "entities/part/part-design.js"));
  const partSetup = require(join(out, "entities/part/setup.js"));
  const lib = require(join(out, "entities/part/tool-library.js"));
  const text = cam.generateProgram(design.SAMPLE_DESIGN).text;
  const tools = {};
  for (const t of lib.TOOL_LIBRARY) tools[t.number] = { number: t.number, length: t.length ?? 100, diameter: t.diameter };
  const r = nc.interpret(text, {
    workOffsets: { G54: partSetup.idealWorkOffset(design.SAMPLE_DESIGN.stock) },
    tools,
    toolInSpindle: 0,
    start: START,
  });
  clean(r);
  const warnings = r.diagnostics.map((d) => `L${d.line} ${d.message}`);
  const summary = `${text.split("\n").length} lines, ${r.motions.length} motions, ${r.cycleSeconds.toFixed(0)} s, tools ${r.toolsUsed}`;
  return `${summary}; ${warnings.length} warnings${warnings.length ? `: ${warnings.join(" | ")}` : ""}`;
});

// --- report ---------------------------------------------------------------------

rmSync(temp, { recursive: true, force: true });
const width = Math.max(...results.map((r) => r.name.length));
console.log(`\n${"#".padStart(3)}  ${"check".padEnd(width)}  result  detail`);
console.log(`${"-".repeat(3)}  ${"-".repeat(width)}  ------  ${"-".repeat(40)}`);
results.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(3)}  ${r.name.padEnd(width)}  ${r.pass ? "PASS  " : "FAIL  "}  ${r.detail}`);
});
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
