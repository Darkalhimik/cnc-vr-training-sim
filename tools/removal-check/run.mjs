/**
 * Checks the stock-removal engine (src/features/part-development/removal).
 *
 *   node tools/removal-check/run.mjs
 *
 * Compiles the engine with the repo's TypeScript into node_modules/.cache, then
 * runs geometry checks and the timing benchmark on the pure modules, and one
 * end-to-end pass through createStockRemoval with removal.worker.ts hosted on
 * a worker_threads shim. Exits non-zero if any check fails.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const engineDir = path.join(repo, "src/features/part-development/removal");
// Inside the repo so the compiled main-thread module resolves `three` from node_modules.
const cacheDir = path.join(repo, "node_modules/.cache/removal-check");
const outDir = path.join(cacheDir, "js");

// ---------------------------------------------------------------- compile

fs.rmSync(cacheDir, { recursive: true, force: true });
fs.mkdirSync(cacheDir, { recursive: true });
const sources = fs
  .readdirSync(engineDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => path.join(engineDir, f));
const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    lib: ["ES2022", "DOM"],
    strict: true,
    skipLibCheck: true,
    isolatedModules: true,
    esModuleInterop: true,
    types: [],
    noEmitOnError: true,
    rootDir: path.join(repo, "src"),
    outDir,
    paths: { "@/*": [path.join(repo, "src/*")] },
  },
  files: sources,
};
fs.writeFileSync(path.join(cacheDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
fs.writeFileSync(path.join(cacheDir, "package.json"), JSON.stringify({ type: "module" }));

const tsc = spawnSync(process.execPath, [path.join(repo, "node_modules/typescript/bin/tsc"), "-p", path.join(cacheDir, "tsconfig.json")], {
  encoding: "utf8",
});
if (tsc.status !== 0) {
  console.error("tsc failed:\n" + tsc.stdout + tsc.stderr);
  process.exit(1);
}

// The engine imports siblings without extensions, as the bundler expects; Node
// needs them spelled out. The same hook runs in the worker thread.
const hooks = `import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (/^\\.\\.?\\//.test(specifier) && !/\\.(m?js|json)$/.test(specifier)) specifier += ".js";
    return next(specifier, context);
  },
});
`;
fs.writeFileSync(path.join(cacheDir, "hooks.mjs"), hooks);
// Stands in for a dedicated worker's global scope.
fs.writeFileSync(
  path.join(cacheDir, "worker-host.mjs"),
  `import { parentPort, workerData } from "node:worker_threads";
import "./hooks.mjs";
globalThis.self = globalThis;
globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
const early = [];
let ready = false;
parentPort.on("message", (data) => (ready ? globalThis.onmessage?.({ data }) : early.push(data)));
await import(workerData.entry);
ready = true;
for (const data of early) globalThis.onmessage?.({ data });
`,
);
registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.(m?js|json)$/.test(specifier)) specifier += ".js";
    return next(specifier, context);
  },
});

const engine = (name) =>
  import(pathToFileURL(path.join(outDir, "features/part-development/removal", `${name}.js`)).href);
const { createGrid, materialVolume } = await engine("grid");
const { compileTool } = await engine("tool");
const { cutPath } = await engine("sweep");
const { POSE_STRIDE } = await engine("protocol");
const { meshAll } = await engine("mesher");
const { createSurface, refreshSurface } = await engine("surface");

// ---------------------------------------------------------------- helpers

const rows = [];
const check = (name, pass, detail) => rows.push({ name, pass, detail });
const pct = (got, want) => (100 * (got - want)) / want;
const fmt = (v, digits = 1) => v.toFixed(digits);
const UP = [0, 0, 1];
const BLOCK = { size: [100, 100, 50] };
const flat10 = { kind: "flat", diameter: 10, fluteLength: 20, stickout: 40 };

/** [[tip, axis], ...] → packed Float64Array */
const pack = (poses) => {
  const out = new Float64Array(poses.length * POSE_STRIDE);
  poses.forEach(([tip, axis], n) => {
    out.set(tip, n * POSE_STRIDE);
    out.set(axis, n * POSE_STRIDE + 3);
  });
  return out;
};
const plunge = (from, to, axis) => pack([[from, axis], [to, axis]]);

/** Signed volume of closed triangle meshes, mm³. */
function meshVolume(list) {
  let six = 0;
  for (const { positions: p, indices: x } of list) {
    for (let t = 0; t < x.length; t += 3) {
      const a = 3 * x[t];
      const b = 3 * x[t + 1];
      const c = 3 * x[t + 2];
      six +=
        p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
        p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
  }
  return six / 6;
}

/** Radius of a cutter's profile at height a above the tip. */
function profileRadius(shape, a) {
  const R = shape.diameter / 2;
  switch (shape.kind) {
    case "flat":
      return R;
    case "ball":
      return a < R ? Math.sqrt(R * R - (R - a) ** 2) : R;
    case "bull": {
      const rc = shape.cornerRadius;
      return a < rc ? R - rc + Math.sqrt(rc * rc - (rc - a) ** 2) : R;
    }
    default:
      return Math.min(R, a * Math.tan(((shape.tipAngle ?? (shape.kind === "drill" ? 118 : 90)) * Math.PI) / 360));
  }
}
const revolvedVolume = (shape, depth, n = 20000) => {
  let v = 0;
  for (let s = 0; s < n; s++) v += Math.PI * profileRadius(shape, ((s + 0.5) / n) * depth) ** 2;
  return (v * depth) / n;
};

/** Zig-zag over x, y ∈ [-40, 40], 5 mm stepover, resampled to `count` poses. */
function zigzag(count, z, axisAt = () => UP) {
  const corners = [];
  for (let r = 0; r <= 16; r++) {
    const y = -40 + 5 * r;
    corners.push(r % 2 ? [40, y] : [-40, y], r % 2 ? [-40, y] : [40, y]);
  }
  const start = [0];
  for (let n = 1; n < corners.length; n++) {
    start.push(start[n - 1] + Math.hypot(corners[n][0] - corners[n - 1][0], corners[n][1] - corners[n - 1][1]));
  }
  const total = start[start.length - 1];
  const poses = [];
  let seg = 0;
  for (let n = 0; n < count; n++) {
    const s = (total * n) / (count - 1);
    while (seg < corners.length - 2 && start[seg + 1] < s) seg++;
    const t = (s - start[seg]) / (start[seg + 1] - start[seg]);
    const [x0, y0] = corners[seg];
    const [x1, y1] = corners[seg + 1];
    poses.push([[x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z], axisAt(n / (count - 1))]);
  }
  return { poses, length: total };
}
// Tool centre covers [-40, 40]²: a 90 mm square with r5 corners, 1 mm deep.
const POCKET_MM3 = 90 * 90 - (4 - Math.PI) * 25;

const timeIt = (fn) => {
  const t0 = performance.now();
  const value = fn();
  return [value, performance.now() - t0];
};
const stats = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return {
    mean: list.reduce((s, v) => s + v, 0) / list.length,
    p95: sorted[Math.floor(0.95 * (sorted.length - 1))],
    max: sorted[sorted.length - 1],
  };
};

// ---------------------------------------------------------------- 1. plunge into the top

{
  const g = createGrid(BLOCK);
  const before = materialVolume(g);
  const r = cutPath(g, compileTool(flat10), plunge([0, 0, 55], [0, 0, 45], UP));
  const want = Math.PI * 25 * 5;
  const err = pct(r.removedMm3, want);
  const fieldErr = pct(before - materialVolume(g), want);
  check(
    "1  flat Ø10 plunged 5 mm into the top (+Z)",
    Math.abs(err) < 2 && Math.abs(fieldErr) < 2 && r.collision === null,
    `${fmt(r.removedMm3)} mm³ vs πr²h ${fmt(want)} (${fmt(err, 2)}%), voxel ${g.voxel} mm`,
  );
}

// ---------------------------------------------------------------- 1b. every profile

{
  const shapes = [
    [{ kind: "ball", diameter: 10, fluteLength: 20, stickout: 40 }, 5],
    [{ kind: "bull", diameter: 10, cornerRadius: 2, fluteLength: 20, stickout: 40 }, 5],
    [{ kind: "drill", diameter: 10, fluteLength: 30, stickout: 40 }, 6],
    [{ kind: "chamfer", diameter: 10, fluteLength: 6, stickout: 40 }, 3],
  ];
  const worst = [];
  for (const [shape, depth] of shapes) {
    const g = createGrid(BLOCK);
    const r = cutPath(g, compileTool(shape), plunge([0, 0, 50 + 5], [0, 0, 50 - depth], UP));
    const want = revolvedVolume(shape, depth);
    worst.push(`${shape.kind} ${fmt(pct(r.removedMm3, want), 2)}%`);
    shape.err = Math.abs(pct(r.removedMm3, want));
  }
  check("1b ball / bull r2 / drill 118° / chamfer 90° volumes", shapes.every(([s]) => s.err < 3), worst.join(", "));
}

// ---------------------------------------------------------------- 2. 5-axis entries

{
  const g = createGrid(BLOCK);
  const r = cutPath(g, compileTool(flat10), plunge([55, 0, 25], [45, 0, 25], [1, 0, 0]));
  const want = Math.PI * 25 * 5;
  const err = pct(r.removedMm3, want);
  check(
    "2  same cutter, axis +X, into the +X face",
    Math.abs(err) < 2 && r.collision === null,
    `${fmt(r.removedMm3)} mm³ vs ${fmt(want)} (${fmt(err, 2)}%)`,
  );
}
{
  // Tilted 30° from vertical, leaning towards azimuth 35°, fed along its own
  // axis until the tip centre is 5 mm deep: a slanted cylinder whose volume
  // below the top face is πr²·5 / cos 30°.
  const tilt = (30 * Math.PI) / 180;
  const azimuth = (35 * Math.PI) / 180;
  const axis = [Math.sin(tilt) * Math.cos(azimuth), Math.sin(tilt) * Math.sin(azimuth), Math.cos(tilt)];
  const end = [3, -4, 45];
  const start = end.map((v, n) => v + 15 * axis[n]);
  const g = createGrid(BLOCK);
  const r = cutPath(g, compileTool(flat10), plunge(start, end, axis));
  const want = (Math.PI * 25 * 5) / Math.cos(tilt);
  const err = pct(r.removedMm3, want);
  check(
    "2b same cutter tilted 30° (oblique), fed along its axis",
    Math.abs(err) < 2 && r.collision === null,
    `${fmt(r.removedMm3)} mm³ vs πr²·5/cos30° ${fmt(want)} (${fmt(err, 2)}%)`,
  );
}
{
  // A ramp is neither across nor along the axis, so it is cut as stamps.
  // Reference: a column at (x, y) ends as deep as the lowest bottom face that
  // covers it, which is the farthest-along centre within reach.
  const [x0, z0, x1, z1] = [-20, 50.5, 20, 46.5];
  const g = createGrid(BLOCK);
  const r = cutPath(g, compileTool(flat10), pack([[[x0, 0, z0], UP], [[x1, 0, z1], UP]]));
  let want = 0;
  const d = 0.01;
  for (let y = -5 + d / 2; y < 5; y += d) {
    const w = Math.sqrt(25 - y * y);
    for (let x = x0 - w + d / 2; x < x1 + w; x += d) {
      const c = Math.min(x1, x + w);
      if (c < x0) continue;
      const bottom = z0 + ((z1 - z0) * (c - x0)) / (x1 - x0);
      want += Math.max(0, 50 - bottom) * d * d;
    }
  }
  const err = pct(r.removedMm3, want);
  check(
    "2c flat Ø10 ramping 4 mm over 40 mm (stamped)",
    Math.abs(err) < 1 && r.collision === null,
    `${fmt(r.removedMm3)} mm³ vs numeric ${fmt(want)} (${fmt(err, 2)}%)`,
  );
}

// ---------------------------------------------------------------- 3. ball groove profile

{
  const g = createGrid(BLOCK);
  const ball = { kind: "ball", diameter: 10, fluteLength: 20, stickout: 40 };
  cutPath(g, compileTool(ball), pack([[[-30, 0, 47], UP], [[30, 0, 47], UP]]));
  const [nx, ny, nz] = g.dims;
  const [ox, oy, oz] = g.origin;
  const h = g.voxel;
  const i = Math.round((0 - ox) / h);
  let maxErr = 0;
  let centre = null;
  let flank = null;
  for (let j = 0; j < ny; j++) {
    const y = oy + j * h;
    if (Math.abs(y) > 3.8) continue;
    let z = null;
    for (let k = nz - 1; k > 0; k--) {
      const above = g.data[i + nx * (j + ny * k)];
      const below = g.data[i + nx * (j + ny * (k - 1))];
      if (above >= 0 && below < 0) {
        z = oz + k * h - (h * above) / (above - below);
        break;
      }
    }
    const want = 52 - Math.sqrt(25 - y * y);
    maxErr = Math.max(maxErr, Math.abs(z - want));
    if (Math.abs(y) < h) centre = z;
    if (Math.abs(Math.abs(y) - 3.25) < h / 2) flank = z;
  }
  check(
    "3  ball Ø10 groove 3 mm deep has a round bottom",
    maxErr < 0.06 && flank - centre > 1,
    `floor vs circle r5: max err ${fmt(maxErr, 3)} mm; rises ${fmt(flank - centre, 2)} mm at |y|=3.25 (circle 1.20)`,
  );
}

{
  // The exact sweep against stamping on the same groove: an axis wobble far
  // below a micron at the flute tops forces every move onto the stamp path.
  const ball = compileTool({ kind: "ball", diameter: 10, fluteLength: 20, stickout: 40 });
  const exact = createGrid(BLOCK);
  const stamped = createGrid(BLOCK);
  const straight = [];
  const wobbly = [];
  for (let n = 0; n <= 120; n++) {
    const tip = [-30 + n * 0.5, 0, 47];
    straight.push([tip, UP]);
    wobbly.push([tip, [n % 2 ? 1e-4 : -1e-4, 0, 1]]);
  }
  const a = cutPath(exact, ball, pack(straight));
  const b = cutPath(stamped, ball, pack(wobbly));
  let maxStep = 0;
  for (let n = 0; n < exact.data.length; n++) maxStep = Math.max(maxStep, Math.abs(exact.data[n] - stamped.data[n]));
  check(
    "3b exact sweep vs stamps on the same groove",
    Math.abs(pct(a.removedMm3, b.removedMm3)) < 0.2 && maxStep <= 2,
    `${fmt(a.removedMm3)} vs ${fmt(b.removedMm3)} mm³; field differs by ≤ ${maxStep}/64 voxel`,
  );
}

// ---------------------------------------------------------------- 4. closed mesh of the block

{
  const g = createGrid(BLOCK);
  const [meshes, ms] = timeIt(() => meshAll(g));
  const ids = new Map();
  const triangles = [];
  for (const m of meshes) {
    const local = new Int32Array(m.positions.length / 3);
    for (let v = 0; v < local.length; v++) {
      const key = `${m.positions[3 * v]},${m.positions[3 * v + 1]},${m.positions[3 * v + 2]}`;
      let id = ids.get(key);
      if (id === undefined) ids.set(key, (id = ids.size));
      local[v] = id;
    }
    for (const n of m.indices) triangles.push(local[n]);
  }
  // Closed and consistently wound: every directed edge once, its reverse once.
  const KEY = 2 ** 22;
  const edges = new Map();
  for (let t = 0; t < triangles.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const key = triangles[t + e] * KEY + triangles[t + ((e + 1) % 3)];
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const [key, count] of edges) {
    const a = Math.floor(key / KEY);
    const b = key % KEY;
    if (count !== 1 || edges.get(b * KEY + a) !== 1) bad++;
  }
  const volume = meshVolume(meshes);
  const want = 100 * 100 * 50;
  check(
    "4  untouched block mesh is closed, volume ≈ block",
    bad === 0 && Math.abs(pct(volume, want)) < 0.1,
    `${meshes.length} chunks, ${triangles.length / 3} tris, ${bad} open/non-manifold edges; ` +
      `${fmt(volume)} mm³ (${fmt(pct(volume, want), 3)}%); meshed in ${fmt(ms)} ms`,
  );
}

// ---------------------------------------------------------------- 5. collisions

{
  const shortFlutes = { kind: "flat", diameter: 10, fluteLength: 10, stickout: 30 };
  const results = [];

  let g = createGrid(BLOCK);
  const deep = cutPath(g, compileTool(shortFlutes), plunge([0, 0, 55], [0, 0, 35], UP));
  results.push(deep.collision?.kind === "shank" && deep.collision.poseIndex === 1);

  // The same plunge fed 1 mm per call: the shank rubs its own hole's wall.
  g = createGrid(BLOCK);
  let firstHit = null;
  for (let z = 55; z > 35; z--) {
    const r = cutPath(g, compileTool(shortFlutes), plunge([0, 0, z], [0, 0, z - 1], UP));
    if (r.collision && firstHit === null) firstHit = { depth: 50 - (z - 1), kind: r.collision.kind };
  }
  results.push(firstHit?.kind === "shank" && firstHit.depth === 11);

  g = createGrid(BLOCK);
  const shallow = cutPath(g, compileTool(shortFlutes), plunge([0, 0, 55], [0, 0, 42], UP));
  results.push(shallow.collision === null);

  // A necked shank follows the flutes down their own hole without touching.
  g = createGrid(BLOCK);
  const necked = cutPath(g, compileTool({ ...shortFlutes, shankDiameter: 8 }), plunge([0, 0, 55], [0, 0, 35], UP));
  results.push(necked.collision === null && Math.abs(pct(necked.removedMm3, Math.PI * 25 * 15)) < 2);

  g = createGrid(BLOCK);
  const stubby = { kind: "flat", diameter: 10, fluteLength: 10, stickout: 10 };
  const holder = cutPath(g, compileTool(stubby), plunge([0, 0, 55], [0, 0, 38], UP));
  results.push(holder.collision?.kind === "holder");

  g = createGrid(BLOCK);
  const side = cutPath(g, compileTool(shortFlutes), plunge([60, 10, 25], [35, 10, 25], [1, 0, 0]));
  results.push(side.collision?.kind === "shank");

  check(
    "5  shank / holder collisions",
    results.every(Boolean),
    `plunge 15>10 one call: ${deep.collision?.kind}@pose ${deep.collision?.poseIndex}; ` +
      `1 mm/call: ${firstHit?.kind} at ${firstHit?.depth} mm deep; 8 mm: ${shallow.collision ?? "none"}; ` +
      `necked Ø8 shank 15 deep: ${necked.collision ?? "none"}; ` +
      `stickout=flutes: ${holder.collision?.kind}; +X face 15>10: ${side.collision?.kind}`,
  );
}

// ---------------------------------------------------------------- 6. timing (pure modules, this thread)

const pocket = zigzag(2000, 49);
const timings = [];
for (const run of ["cold", "warm"]) {
  const { surface } = createSurface(createGrid(BLOCK));
  const packed = pack(pocket.poses);
  const [report, carveMs] = timeIt(() => cutPath(surface.grid, compileTool(flat10), packed));
  const [tiles, meshMs] = timeIt(() => refreshSurface(surface));
  timings.push({ run, carveMs, meshMs, tiles: tiles.length, report });
}
{
  const cold = timings[0];
  const warm = timings[1];
  const err = pct(cold.report.removedMm3, POCKET_MM3);
  check(
    "6a pocket, flat Ø10, 2000 poses, 1 mm deep, one cut()",
    cold.carveMs + cold.meshMs < 1000 && Math.abs(err) < 1 && cold.report.collision === null,
    `cold ${fmt(cold.carveMs)} carve + ${fmt(cold.meshMs)} mesh (${cold.tiles} tiles) = ` +
      `${fmt(cold.carveMs + cold.meshMs)} ms; warm ${fmt(warm.carveMs + warm.meshMs)} ms; ` +
      `${fmt(cold.report.removedMm3)} mm³ vs ${fmt(POCKET_MM3)} (${fmt(err, 2)}%), path ${fmt(pocket.length, 0)} mm`,
  );
}
{
  const { surface } = createSurface(createGrid(BLOCK));
  const tool = compileTool(flat10);
  const calls = [];
  let removed = 0;
  // 50 poses per call, each starting where the last ended.
  for (let s = 0; s < pocket.poses.length - 1; s += 49) {
    const [report, ms] = timeIt(() => {
      const r = cutPath(surface.grid, tool, pack(pocket.poses.slice(s, s + 50)));
      refreshSurface(surface);
      return r;
    });
    removed += report.removedMm3;
    calls.push(ms);
  }
  const st = stats(calls);
  check(
    "6b same pocket fed as 50-pose cut() calls (carve + remesh)",
    st.max < 30 && Math.abs(pct(removed, POCKET_MM3)) < 1,
    `${calls.length} calls: mean ${fmt(st.mean, 2)} ms, p95 ${fmt(st.p95, 2)}, max ${fmt(st.max, 2)} ms (first call incl. JIT)`,
  );
}
{
  // 5-axis: same zig-zag with the axis leaning 15° and circling twice.
  const lean = (15 * Math.PI) / 180;
  const fiveAxis = zigzag(2000, 49, (t) => {
    const phi = 4 * Math.PI * t;
    return [Math.sin(lean) * Math.cos(phi), Math.sin(lean) * Math.sin(phi), Math.cos(lean)];
  });
  const { surface } = createSurface(createGrid(BLOCK));
  const [report, carveMs] = timeIt(() => cutPath(surface.grid, compileTool(flat10), pack(fiveAxis.poses)));
  const [tiles, meshMs] = timeIt(() => refreshSurface(surface));
  check(
    "6c 5-axis variant (15° lead circling), 2000 poses, one cut()",
    carveMs + meshMs < 1000 && report.collision === null,
    `${fmt(carveMs)} carve + ${fmt(meshMs)} mesh (${tiles.length} tiles) = ${fmt(carveMs + meshMs)} ms, ` +
      `${fmt(report.removedMm3)} mm³`,
  );
}
{
  const { surface } = createSurface(createGrid(BLOCK));
  cutPath(surface.grid, compileTool(flat10), pack(pocket.poses));
  refreshSurface(surface);
  const { tiles } = createSurface(surface.grid); // what the main thread holds by now
  const bytes = (list) =>
    list.reduce((s, m) => s + m.positions.byteLength + m.normals.byteLength + m.indices.byteLength, 0);
  const field = surface.grid.data.byteLength;
  const cache = bytes([...surface.chunks.values()]);
  const drawn = bytes(tiles);
  const total = field + cache + drawn;
  check(
    "6d memory after the pocket (worker field + chunk cache, main tiles)",
    total < 40 * 2 ** 20,
    `field ${fmt(field / 2 ** 20)} MB (${surface.grid.dims.join("×")}) + chunk meshes ${fmt(cache / 2 ** 20)} MB + ` +
      `tile meshes ${fmt(drawn / 2 ** 20)} MB = ${fmt(total / 2 ** 20)} MB; ${tiles.length} draw calls`,
  );
}

// ---------------------------------------------------------------- 7. end to end through the worker

class WorkerShim {
  constructor(url) {
    const entry = pathToFileURL(fileURLToPath(url).replace(/\.ts$/, ".js")).href;
    this.onmessage = null;
    this.onerror = null;
    this.thread = new NodeWorker(path.join(cacheDir, "worker-host.mjs"), { workerData: { entry } });
    this.thread.on("message", (data) => this.onmessage?.({ data }));
    this.thread.on("error", (error) => this.onerror?.({ message: error.message }));
  }
  postMessage(message, transfer) {
    this.thread.postMessage(message, transfer);
  }
  terminate() {
    this.thread.terminate();
  }
}

{
  globalThis.window ??= globalThis;
  globalThis.Worker = WorkerShim;
  const { createStockRemoval } = await engine("stock-removal");
  const removal = createStockRemoval();
  const groupMeshes = () =>
    removal.group.children.map((m) => ({
      positions: m.geometry.getAttribute("position").array,
      indices: m.geometry.getIndex().array,
    }));
  const triangles = () => groupMeshes().reduce((s, m) => s + m.indices.length / 3, 0);

  const [, resetMs] = await (async () => {
    const t0 = performance.now();
    await removal.reset(BLOCK);
    return [null, performance.now() - t0];
  })();
  const startVolume = meshVolume(groupMeshes());
  const startChunks = removal.group.children.length;

  const latencies = [];
  let removed = 0;
  let collision = null;
  const toPose = ([tip, axis]) => ({ tip, axis });
  for (let s = 0; s < pocket.poses.length - 1; s += 49) {
    const t0 = performance.now();
    const report = await removal.cut(flat10, pocket.poses.slice(s, s + 50).map(toPose));
    latencies.push(performance.now() - t0);
    removed += report.removedMm3;
    collision ??= report.collision;
  }
  const st = stats(latencies);
  const endVolume = meshVolume(groupMeshes());
  const meshRemoved = startVolume - endVolume;

  const stl = await removal.exportStl();
  const bytes = new DataView(await stl.arrayBuffer());
  const stlTriangles = bytes.getUint32(80, true);
  const stlMeshes = [];
  {
    const positions = new Float32Array(stlTriangles * 9);
    for (let t = 0; t < stlTriangles; t++) {
      for (let f = 0; f < 9; f++) positions[t * 9 + f] = bytes.getFloat32(84 + 50 * t + 12 + 4 * f, true);
    }
    stlMeshes.push({ positions, indices: Uint32Array.from({ length: stlTriangles * 3 }, (_, n) => n) });
  }
  const stlVolume = meshVolume(stlMeshes);
  const groupTriangles = triangles();

  let rejectedAfterDispose = false;
  removal.dispose();
  try {
    await removal.cut(flat10, [{ tip: [0, 0, 60], axis: UP }]);
  } catch {
    rejectedAfterDispose = true;
  }

  check(
    "7a worker: reset + 50-pose cut() round trips",
    st.max < 30 && collision === null && startChunks > 0,
    `reset ${fmt(resetMs)} ms (${startChunks} meshes in group); ${latencies.length} cuts: mean ${fmt(st.mean, 2)} ms, ` +
      `p95 ${fmt(st.p95, 2)}, max ${fmt(st.max, 2)} ms`,
  );
  check(
    "7b worker: group mesh volume tracks reported removal",
    Math.abs(meshRemoved - removed) < 0.005 * removed,
    `reported ${fmt(removed)} mm³, mesh volume dropped ${fmt(meshRemoved)} mm³ (${fmt(pct(meshRemoved, removed), 2)}%)`,
  );
  check(
    "7c worker: exportStl matches the group; dispose empties it",
    stlTriangles === groupTriangles &&
      Math.abs(stlVolume - endVolume) < 1 &&
      removal.group.children.length === 0 &&
      rejectedAfterDispose,
    `${stlTriangles} STL tris vs ${groupTriangles} in group, ${fmt(stl.size / 2 ** 20)} MB, ` +
      `volume ${fmt(stlVolume)} vs ${fmt(endVolume)} mm³`,
  );
}

// ---------------------------------------------------------------- report

const width = Math.max(...rows.map((r) => r.name.length));
console.log(`\nstock removal checks — node ${process.version}\n`);
for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exitCode = failed ? 1 : 0;
