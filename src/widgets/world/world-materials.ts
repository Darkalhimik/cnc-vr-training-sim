/**
 * The workshop's surfaces: a handful of shared materials and painted
 * textures. Shared, because merged geometry only batches by material, and
 * a headset draws every batch twice. Textures are painted on canvases at
 * load — no files to fetch, and the sizes stay small (≤ 1024).
 */
import * as THREE from "three";

export type MaterialKey =
  | "wallLow"
  | "wallLobby"
  | "wallHall"
  | "skirting"
  | "steel"
  | "steelLight"
  | "beam"
  | "ceilingLobby"
  | "ceilingHall"
  | "lightWarm"
  | "lightCool"
  | "housing"
  | "safety"
  | "black"
  | "walkway"
  | "paint"
  | "wood"
  | "fabric"
  | "ceramic"
  | "leaf"
  | "red"
  | "rubber"
  | "aluminium"
  | "barSteel"
  | "pallet"
  | "blueSteel"
  | "glass"
  | "sign"
  | "shade"
  | "glow";

function canvas(size: number, paint: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size);
  return c;
}

/** Deterministic noise, so a reload paints the same floor. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texture(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft blots, darker and lighter: the life in a painted or poured surface. */
function mottle(ctx: CanvasRenderingContext2D, size: number, count: number, strength: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const light = r() > 0.5;
    const radius = 6 + r() * size * 0.06;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    const a = strength * (0.4 + r() * 0.6);
    g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.3})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    const x = r() * size;
    const y = r() * size;
    // Draw wrapped, so the texture tiles without seams.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.save();
        ctx.translate(x + dx, y + dy);
        ctx.fillStyle = g;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      }
    }
  }
}

function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/** Polished concrete for the hall: one tile is 6 m, saw-cut joints every 3 m. */
export function hallFloorTexture() {
  return texture(
    canvas(1024, (ctx, size) => {
      ctx.fillStyle = "#6b7074";
      ctx.fillRect(0, 0, size, size);
      mottle(ctx, size, 260, 0.06, 11);
      speckle(ctx, size, 9000, 12);
      ctx.strokeStyle = "rgba(20,22,24,0.55)";
      ctx.lineWidth = 2;
      for (const p of [0, size / 2]) {
        ctx.beginPath();
        ctx.moveTo(p + 1, 0);
        ctx.lineTo(p + 1, size);
        ctx.moveTo(0, p + 1);
        ctx.lineTo(size, p + 1);
        ctx.stroke();
      }
    }),
  );
}

/** Warm stone tiles for the lobby: one texture is 2.4 m, four 600 mm tiles. */
export function lobbyFloorTexture() {
  return texture(
    canvas(1024, (ctx, size) => {
      const r = rng(21);
      const tile = size / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const v = Math.round(r() * 10 - 5);
          ctx.fillStyle = `rgb(${142 + v},${134 + v},${123 + v})`;
          ctx.fillRect(i * tile, j * tile, tile, tile);
        }
      }
      mottle(ctx, size, 220, 0.05, 22);
      speckle(ctx, size, 6000, 23);
      ctx.strokeStyle = "rgba(60,54,48,0.7)";
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tile, 0);
        ctx.lineTo(i * tile, size);
        ctx.moveTo(0, i * tile);
        ctx.lineTo(size, i * tile);
        ctx.stroke();
      }
    }),
  );
}

/** Roller-painted wall: near-white noise the material's colour tints. */
function paintTexture() {
  return texture(
    canvas(256, (ctx, size) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      mottle(ctx, size, 90, 0.018, 31);
      speckle(ctx, size, 1500, 32);
    }),
  );
}

function woodTexture() {
  return texture(
    canvas(256, (ctx, size) => {
      const r = rng(41);
      ctx.fillStyle = "#b5875a";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 2) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? "255,230,200" : "70,40,15"},${0.04 + r() * 0.06})`;
        ctx.fillRect(0, y, size, 1 + r() * 2);
      }
    }),
  );
}

/** A soft dark rectangle, fading to nothing: contact shadow under anything. */
function shadeTexture() {
  return texture(
    canvas(128, (ctx, size) => {
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // Distance outside an inner rectangle, as a fraction of the margin.
          const m = size * 0.28;
          const dx = Math.max(0, Math.abs(x - size / 2 + 0.5) - (size / 2 - m)) / m;
          const dy = Math.max(0, Math.abs(y - size / 2 + 0.5) - (size / 2 - m)) / m;
          const d = Math.min(1, Math.hypot(dx, dy));
          const a = (1 - d) * (1 - d);
          const i = (y * size + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
          img.data[i + 3] = Math.round(a * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    }),
    false,
    false,
  );
}

function glowTexture() {
  return texture(
    canvas(64, (ctx, size) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,248,232,0.9)");
      g.addColorStop(0.35, "rgba(255,244,222,0.25)");
      g.addColorStop(1, "rgba(255,240,215,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }),
    false,
  );
}

// ---------------------------------------------------------------- signs

/** Every sign in the workshop is one region of one texture: one material,
 *  so all the signs merge into a single draw. 2 columns × 16 rows of 4:1. */
export const SIGN_SLOTS = { columns: 2, rows: 16, width: 512, height: 128 };

export type SignSpec =
  | { kind: "label"; lines: string[] }
  | { kind: "mandatory"; text: string; icon: "eyes" | "ears" | "boots" }
  | { kind: "fire"; text: string }
  | { kind: "warning"; text: string };

/** A sign's region of the atlas, [u0, v0, u1, v1], by its slot — known
 *  before anything is painted, so geometry can be built first. */
export function signUv(index: number): [number, number, number, number] {
  const { columns, rows } = SIGN_SLOTS;
  const u0 = (index % columns) / columns;
  const v1 = 1 - Math.floor(index / columns) / rows;
  return [u0, v1 - 1 / rows, u0 + 1 / columns, v1];
}

export type SignAtlas = {
  texture: THREE.CanvasTexture;
  uv: (index: number) => [number, number, number, number];
  /** Paint again — once the web fonts have arrived. */
  repaint: () => void;
};

function family(face: "--font-inter" | "--font-open-sans") {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.body).getPropertyValue(face).trim();
  return v || "Inter, 'Segoe UI', sans-serif";
}

function paintSign(ctx: CanvasRenderingContext2D, spec: SignSpec, w: number, h: number) {
  const heading = family("--font-inter");
  const body = family("--font-open-sans");
  ctx.textBaseline = "middle";
  if (spec.kind === "label") {
    ctx.fillStyle = "#1d2025";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e3b21c";
    ctx.fillRect(0, 0, 10, h);
    const [first, ...rest] = spec.lines;
    ctx.fillStyle = "#f2f3f4";
    ctx.font = `600 ${Math.round(h * 0.34)}px ${heading}`;
    ctx.fillText(first, 30, rest.length ? h * 0.38 : h / 2, w - 44);
    if (rest.length) {
      ctx.fillStyle = "#9aa1a9";
      ctx.font = `500 ${Math.round(h * 0.17)}px ${body}`;
      ctx.fillText(rest.join(" · "), 31, h * 0.74, w - 44);
    }
    return;
  }
  const colors = { mandatory: "#1f5fae", fire: "#c4281c", warning: "#e3b21c" } as const;
  ctx.fillStyle = "#f4f4f2";
  ctx.fillRect(0, 0, w, h);
  // ISO-style symbol on the left, the words beside it.
  const cx = h / 2;
  const cy = h / 2;
  const r = h * 0.38;
  ctx.fillStyle = colors[spec.kind];
  if (spec.kind === "warning") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.85);
    ctx.lineTo(cx - r, cy + r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1c1d1f";
    ctx.font = `800 ${Math.round(r * 1.1)}px ${heading}`;
    ctx.textAlign = "center";
    ctx.fillText("!", cx, cy + r * 0.25);
    ctx.textAlign = "left";
  } else if (spec.kind === "fire") {
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - r * 0.25, cy - r * 0.55, r * 0.5, r * 1.2);
    ctx.fillRect(cx - r * 0.1, cy - r * 0.8, r * 0.45, r * 0.18);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = r * 0.12;
    if (spec.icon === "eyes") {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * r * 0.36, cy, r * 0.28, r * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (spec.icon === "ears") {
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.1, r * 0.5, Math.PI, 0);
      ctx.stroke();
      for (const s of [-1, 1]) ctx.fillRect(cx + s * r * 0.5 - r * 0.14, cy, r * 0.28, r * 0.42);
    } else {
      ctx.fillRect(cx - r * 0.45, cy + r * 0.15, r * 0.9, r * 0.32);
      ctx.fillRect(cx - r * 0.45, cy - r * 0.5, r * 0.36, r * 0.7);
    }
  }
  ctx.fillStyle = "#1c1d1f";
  ctx.font = `700 ${Math.round(h * 0.2)}px ${heading}`;
  const words = spec.text.split("\n");
  words.forEach((line, i) => ctx.fillText(line, h + 8, h / 2 + (i - (words.length - 1) / 2) * h * 0.26, w - h - 16));
}

/** Paints `specs` into the atlas; index i is specs[i]'s region. */
export function signAtlas(specs: SignSpec[]): SignAtlas {
  const { columns, rows, width, height } = SIGN_SLOTS;
  const c = document.createElement("canvas");
  c.width = columns * width;
  c.height = rows * height;
  const ctx = c.getContext("2d")!;
  const paint = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    specs.slice(0, columns * rows).forEach((spec, i) => {
      ctx.save();
      ctx.translate((i % columns) * width, Math.floor(i / columns) * height);
      paintSign(ctx, spec, width, height);
      ctx.restore();
    });
  };
  paint();
  const t = texture(c, false);
  t.flipY = true;
  return {
    texture: t,
    repaint: () => {
      paint();
      t.needsUpdate = true;
    },
    uv: signUv,
  };
}

// ---------------------------------------------------------------- materials

/** The workshop's materials, made once per scene. */
export function createMaterials(atlas: SignAtlas): Record<MaterialKey, THREE.Material> {
  const paint = paintTexture();
  const wood = woodTexture();
  const standard = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  return {
    wallLow: standard({ color: "#3a4048", map: paint, roughness: 0.75 }),
    wallLobby: standard({ color: "#ddd6ca", map: paint, roughness: 0.9 }),
    wallHall: standard({ color: "#aab0b6", map: paint, roughness: 0.88 }),
    skirting: standard({ color: "#25292e", roughness: 0.6 }),
    steel: standard({ color: "#2c3036", metalness: 0.55, roughness: 0.42 }),
    steelLight: standard({ color: "#7d848b", metalness: 0.6, roughness: 0.4 }),
    beam: standard({ color: "#4b5158", metalness: 0.45, roughness: 0.55 }),
    // A ceiling is lit by what bounces off the floor and walls, which these
    // lights do not compute: a little emission stands in for it.
    ceilingLobby: standard({ color: "#d4cfc6", emissive: "#8f8a80", emissiveIntensity: 0.45, roughness: 0.95 }),
    // Steel roof decking: mid grey, lifted a little for the light it would
    // catch from the floor, so the roof reads as a roof and not a void.
    ceilingHall: standard({ color: "#59606a", emissive: "#2c3138", emissiveIntensity: 0.6, roughness: 0.8 }),
    lightWarm: standard({ color: "#fff1dc", emissive: "#ffe9c8", emissiveIntensity: 1.6, toneMapped: false }),
    lightCool: standard({ color: "#f3f7ff", emissive: "#eef3ff", emissiveIntensity: 2.2, toneMapped: false }),
    housing: standard({ color: "#3a3f45", metalness: 0.6, roughness: 0.35 }),
    safety: standard({ color: "#e0ad16", roughness: 0.55 }),
    black: standard({ color: "#1b1c1e", roughness: 0.6 }),
    walkway: standard({ color: "#3f8f5f", roughness: 0.6 }),
    paint: standard({ color: "#e9eaea", roughness: 0.6 }),
    wood: standard({ map: wood, roughness: 0.65 }),
    fabric: standard({ color: "#34465a", roughness: 0.95 }),
    ceramic: standard({ color: "#e8e3da", roughness: 0.35 }),
    leaf: standard({ color: "#3d6b3a", roughness: 0.8, side: THREE.DoubleSide }),
    red: standard({ color: "#c0221d", metalness: 0.3, roughness: 0.35 }),
    rubber: standard({ color: "#18191b", roughness: 0.9 }),
    aluminium: standard({ color: "#c7ccd1", metalness: 0.85, roughness: 0.32 }),
    barSteel: standard({ color: "#80868c", metalness: 0.8, roughness: 0.4 }),
    pallet: standard({ color: "#b48f61", map: wood, roughness: 0.85 }),
    blueSteel: standard({ color: "#264a7a", metalness: 0.45, roughness: 0.45 }),
    glass: standard({ color: "#c8d8e4", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    sign: new THREE.MeshBasicMaterial({ map: atlas.texture, toneMapped: false }),
    shade: new THREE.MeshBasicMaterial({ map: shadeTexture(), transparent: true, depthWrite: false, opacity: 0.55, color: "#000000" }),
    glow: new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  };
}

export function disposeMaterials(materials: Record<string, THREE.Material>) {
  for (const m of Object.values(materials)) {
    for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
    m.dispose();
  }
}
