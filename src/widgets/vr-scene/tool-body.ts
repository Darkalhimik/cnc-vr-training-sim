import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LibraryTool } from "@/entities/part/tool-library";
import { assemblyById, type HolderKind } from "@/entities/tooling/catalog";

/**
 * A tool as three.js geometry, at its real size: the CT40 holder of its kind
 * (side-lock, collet chuck, shrink fit, shell mill arbor or drill chuck) and
 * its cutter, fluted and coloured by its coating.
 *
 * The origin is the gauge line and the tool points down −Y, the way it hangs
 * from the spindle; the CT40 taper and pull stud stand above it. In the
 * spindle they are hidden in the nose, but in the changer's arm and pockets,
 * in the crib and on the cart they are what the tool is held by, so they are
 * drawn.
 *
 * By default each tool is a handful of meshes, one per material, so a cart of
 * thirty costs few draw calls. `explodable` keeps it as three groups —
 * PullStud, Holder, Cutter — for the tool inspector to pull apart.
 */
const MM = 0.001;

// CAT40 (ANSI B5.50): 7/24 taper, 44.45 mm at the gauge line, 68.4 mm long;
// V-flange 63.5 mm across and 15.9 mm thick, groove in the middle.
const TAPER_LENGTH = 68.4 * MM;
const TAPER_BIG = 44.45 * MM;
const TAPER_SMALL = TAPER_BIG - (TAPER_LENGTH * 7) / 24;
const FLANGE_R = 31.75 * MM;
const FLANGE_T = 15.9 * MM;
const GROOVE_R = 28 * MM;
const STUD = { r: 7.5 * MM, length: 24 * MM, headR: 9.5 * MM, head: 8 * MM };

const material = (color: string, metalness: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

// Shared by every tool: a crib of twenty tools, one set of materials.
const MATERIALS = {
  holder: material("#b9bfc6", 0.85, 0.3),
  dark: material("#3c4046", 0.4, 0.5),
  /** Ground carbide shank, uncoated. */
  shank: material("#a3aab1", 0.8, 0.32),
  /** AlTiN / TiAlN: the dark violet-grey of most carbide cutters. */
  altin: material("#3a3b45", 0.7, 0.35),
  /** TiN: the gold of coated HSS drills. */
  tin: material("#c9a23e", 0.8, 0.35),
  /** A face mill's steel body. */
  body: material("#55595f", 0.6, 0.45),
  insert: material("#2a2c30", 0.5, 0.4),
};
type MaterialKey = keyof typeof MATERIALS;

/** Radius at the top (+Y, towards the flange) and at the bottom. */
const cylinder = (top: number, bottom: number, height: number, segments = 32) =>
  new THREE.CylinderGeometry(top, bottom, height, segments);

/**
 * A fluted length: the cylinder twisted along a helix with `flutes` grooves
 * cut into it, so an end mill or a drill reads as one from across the room.
 */
function flutedGeometry(radius: number, length: number, flutes: number, helixDeg: number) {
  const g = new THREE.CylinderGeometry(radius, radius, length, 48, 12);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const twistPerM = Math.tan(THREE.MathUtils.degToRad(helixDeg)) / radius;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-9) continue;
    const theta = Math.atan2(v.z, v.x);
    // A gullet in each flute: a smooth notch a fifth of the radius deep.
    const notch = Math.max(0, -Math.cos(flutes * theta));
    const rr = r * (1 - 0.2 * notch * notch);
    const twisted = theta + (v.y + length / 2) * twistPerM;
    p.setXYZ(i, rr * Math.cos(twisted), v.y, rr * Math.sin(twisted));
  }
  g.computeVertexNormals();
  return g;
}

type Part = { geometry: THREE.BufferGeometry; material: MaterialKey; y: number; x?: number; rx?: number; rz?: number };

const noRaycast = () => {};

/** The holder below the flange, down to its face at `faceY`. */
function holderParts(kind: HolderKind, noseR: number, faceY: number, shankR: number): Part[] {
  const top = -FLANGE_T;
  const body = top - faceY; // positive length
  if (body <= 0) return [];
  const parts: Part[] = [];
  const mid = (a: number, b: number) => (a + b) / 2;
  switch (kind) {
    case "side-lock": {
      // A collar under the flange, then the nose; the set screw's boss on the side.
      const collarR = Math.max(noseR, 22 * MM);
      const collar = Math.min(12 * MM, body * 0.3);
      parts.push({ geometry: cylinder(collarR, collarR, collar), material: "holder", y: top - collar / 2 });
      parts.push({ geometry: cylinder(collarR, noseR, body - collar), material: "holder", y: mid(top - collar, faceY) });
      const bossY = faceY + Math.min(body - collar, 30 * MM) * 0.55;
      parts.push({ geometry: cylinder(7 * MM, 7 * MM, 8 * MM, 16), material: "holder", y: bossY, x: noseR + 3 * MM, rz: Math.PI / 2 });
      parts.push({ geometry: cylinder(3.5 * MM, 3.5 * MM, 1 * MM, 6), material: "dark", y: bossY, x: noseR + 7.1 * MM, rz: Math.PI / 2 });
      break;
    }
    case "er-collet": {
      // Body, then the nut — the chuck's widest part — with the collet's face in it.
      const nut = Math.min(noseR * 0.75, body * 0.5);
      const bodyR = Math.max(noseR * 0.82, 16 * MM);
      parts.push({ geometry: cylinder(Math.max(bodyR, 22 * MM), bodyR, body - nut), material: "holder", y: mid(top, faceY + nut) });
      parts.push({ geometry: cylinder(noseR, noseR, nut, 6), material: "holder", y: faceY + nut / 2 });
      parts.push({ geometry: cylinder(noseR * 0.78, noseR * 0.78, nut * 0.6, 32), material: "holder", y: faceY + nut * 0.3 });
      parts.push({ geometry: cylinder(Math.max(shankR * 1.6, noseR * 0.5), shankR * 1.6, 0.6 * MM, 24), material: "dark", y: faceY - 0.1 * MM });
      break;
    }
    case "shrink-fit": {
      // A slim nose with a 4.5° taper down to the face.
      const rootR = Math.max(noseR + Math.tan(THREE.MathUtils.degToRad(4.5)) * body, 20 * MM);
      const collar = 10 * MM;
      parts.push({ geometry: cylinder(22 * MM, 22 * MM, collar), material: "holder", y: top - collar / 2 });
      parts.push({ geometry: cylinder(Math.min(rootR, 22 * MM), noseR, body - collar), material: "holder", y: mid(top - collar, faceY) });
      break;
    }
    case "shell-mill": {
      // Short and wide: the cutter sits on its face, driven by two keys.
      parts.push({ geometry: cylinder(Math.max(noseR, 24 * MM), noseR, body), material: "holder", y: mid(top, faceY) });
      for (const side of [-1, 1]) {
        parts.push({ geometry: new THREE.BoxGeometry(5 * MM, 5 * MM, 10 * MM), material: "dark", y: faceY - 2 * MM, x: side * shankR * 1.1 });
      }
      break;
    }
    case "drill-chuck": {
      // An arbor, then the chuck's sleeve with grip rings, then the jaws.
      const sleeve = Math.min(48 * MM, body * 0.6);
      const jaws = 8 * MM;
      parts.push({ geometry: cylinder(15 * MM, 20 * MM, body - sleeve), material: "holder", y: mid(top, faceY + sleeve) });
      parts.push({ geometry: cylinder(noseR * 0.9, noseR, sleeve - jaws), material: "holder", y: faceY + jaws + (sleeve - jaws) / 2 });
      for (const k of [0.3, 0.6]) {
        parts.push({ geometry: cylinder(noseR * 1.02, noseR * 1.02, 4 * MM, 32), material: "dark", y: faceY + jaws + (sleeve - jaws) * k });
      }
      parts.push({ geometry: cylinder(noseR * 0.7, shankR * 1.8, jaws, 24), material: "holder", y: faceY + jaws / 2 });
      break;
    }
  }
  return parts;
}

/** The cutter, from the holder face at `faceY` down to the tip. */
function cutterParts(tool: LibraryTool, faceY: number): Part[] {
  const crib = assemblyById(tool.assembly);
  const cutter = crib?.cutterSpec;
  const r = (tool.diameter / 2) * MM;
  const tipY = -tool.length * MM;
  const coat: MaterialKey = cutter?.material === "hss-co" ? "tin" : "altin";
  const flutes = cutter?.flutes ?? (tool.kind === "drill" || tool.kind === "spot" ? 2 : 3);
  const parts: Part[] = [];

  if (tool.kind === "face") {
    // Steel body, then the ring of inserts at the bottom.
    const ring = tool.fluteLength * MM;
    const height = faceY - tipY - ring;
    parts.push({ geometry: cylinder(r * 0.8, r * 0.9, height, 40), material: "body", y: tipY + ring + height / 2 });
    parts.push({ geometry: cylinder(r * 0.94, r * 0.94, ring, 40), material: "body", y: tipY + ring / 2 });
    for (let i = 0; i < flutes; i++) {
      const a = (i / flutes) * Math.PI * 2;
      const insert = new THREE.BoxGeometry(10 * MM, ring * 1.05, 10 * MM);
      insert.rotateY(-a + Math.PI / 4);
      insert.translate(Math.cos(a) * (r - 4.5 * MM), 0, Math.sin(a) * (r - 4.5 * MM));
      parts.push({ geometry: insert, material: "insert", y: tipY + ring / 2 });
    }
    parts.push({ geometry: cylinder(6 * MM, 6 * MM, 1 * MM, 6), material: "dark", y: tipY - 0.3 * MM });
    return parts;
  }

  const pointed = tool.kind === "drill" || tool.kind === "spot";
  const tipLength = pointed ? r / Math.tan(((tool.tipAngle ?? 118) * Math.PI) / 360) : tool.kind === "ball" ? r : 0;
  const shankR = ((cutter?.shank ?? tool.diameter) / 2) * MM;
  // The shank runs on up into the holder: hidden when assembled, there when
  // the tool is taken apart.
  const gripped = Math.max(0, ((cutter?.overallLength ?? tool.stickout) - tool.stickout) * MM);
  const shankLength = faceY + gripped - tipY - tool.fluteLength * MM;
  if (shankLength > 0) {
    parts.push({ geometry: cylinder(shankR, shankR, shankLength, 24), material: coat === "tin" ? "tin" : "shank", y: tipY + tool.fluteLength * MM + shankLength / 2 });
  }
  const flute = tool.fluteLength * MM - tipLength;
  if (flute > 0) {
    const helix = pointed ? 30 : tool.kind === "ball" ? 30 : 38;
    parts.push({ geometry: flutedGeometry(r, flute, flutes, helix), material: coat, y: tipY + tipLength + flute / 2 });
  }
  if (pointed) {
    const point = new THREE.ConeGeometry(r * 0.97, tipLength, 32);
    point.rotateX(Math.PI);
    parts.push({ geometry: point, material: coat, y: tipY + tipLength / 2 });
  }
  if (tool.kind === "ball") {
    parts.push({ geometry: new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), material: coat, y: tipY + r });
  }
  return parts;
}

function studAndTaper(): { stud: Part[]; holder: Part[] } {
  const lip = (FLANGE_T - 6 * MM) / 2;
  return {
    stud: [
      { geometry: cylinder(STUD.r, STUD.r, STUD.length, 16), material: "holder", y: TAPER_LENGTH + STUD.length / 2 },
      { geometry: cylinder(STUD.headR, STUD.headR, STUD.head, 16), material: "holder", y: TAPER_LENGTH + STUD.length },
    ],
    holder: [
      { geometry: cylinder(TAPER_SMALL / 2, TAPER_BIG / 2, TAPER_LENGTH), material: "holder", y: TAPER_LENGTH / 2 },
      // V-flange, with its two drive slots dark so the spindle's turn reads.
      { geometry: cylinder(FLANGE_R, FLANGE_R, lip, 48), material: "holder", y: -lip / 2 },
      { geometry: cylinder(GROOVE_R, GROOVE_R, 6 * MM, 48), material: "holder", y: -FLANGE_T / 2 },
      { geometry: cylinder(FLANGE_R, FLANGE_R, lip, 48), material: "holder", y: -FLANGE_T + lip / 2 },
      { geometry: new THREE.BoxGeometry(8 * MM, FLANGE_T * 0.9, 16 * MM), material: "dark", y: -FLANGE_T / 2, x: FLANGE_R - 3 * MM },
      { geometry: new THREE.BoxGeometry(8 * MM, FLANGE_T * 0.9, 16 * MM), material: "dark", y: -FLANGE_T / 2, x: -FLANGE_R + 3 * MM },
    ],
  };
}

function place(part: Part) {
  const g = part.geometry;
  if (part.rx) g.rotateX(part.rx);
  if (part.rz) g.rotateZ(part.rz);
  g.translate(part.x ?? 0, part.y, 0);
  return g;
}

/** One mesh per material: few draw calls for a tool that never comes apart. */
function merged(parts: Part[], pickable: boolean) {
  const group = new THREE.Group();
  const byMaterial = new Map<MaterialKey, THREE.BufferGeometry[]>();
  for (const part of parts) {
    const g = place(part);
    // Mixed primitives: keep only what every one of them has.
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    const list = byMaterial.get(part.material) ?? [];
    list.push(flat);
    byMaterial.set(part.material, list);
  }
  for (const [key, list] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(list), MATERIALS[key]);
    mesh.name = key;
    if (!pickable) mesh.raycast = noRaycast;
    group.add(mesh);
    list.forEach((g) => g.dispose());
  }
  return group;
}

function separate(name: string, parts: Part[], pickable: boolean) {
  const group = new THREE.Group();
  group.name = name;
  for (const part of parts) {
    const mesh = new THREE.Mesh(place(part), MATERIALS[part.material]);
    if (!pickable) mesh.raycast = noRaycast;
    group.add(mesh);
  }
  return group;
}

export type ToolObjectOptions = {
  /** Three groups (PullStud, Holder, Cutter) rather than merged meshes. */
  explodable?: boolean;
  /** Takes clicks — in the crib and on the cart. In the machine the tool
   *  hangs under pointable parts and must not take theirs. */
  pickable?: boolean;
};

export function createToolObject(tool: LibraryTool, options: ToolObjectOptions = {}): THREE.Group {
  const crib = assemblyById(tool.assembly);
  const holderKind: HolderKind = crib?.holderSpec.kind ?? (tool.kind === "face" ? "shell-mill" : "side-lock");
  const noseR = (tool.holderDiameter / 2) * MM;
  const faceY = -(tool.length - tool.stickout) * MM;
  const shankR = ((crib?.cutterSpec.shank ?? tool.diameter) / 2) * MM;
  const { stud, holder } = studAndTaper();
  const holderAll = [...holder, ...holderParts(holderKind, noseR, faceY, shankR)];
  const cutter = cutterParts(tool, faceY);
  const pickable = options.pickable ?? false;

  let group: THREE.Group;
  if (options.explodable) {
    group = new THREE.Group();
    group.add(separate("PullStud", stud, pickable), separate("Holder", holderAll, pickable), separate("Cutter", cutter, pickable));
  } else {
    group = merged([...stud, ...holderAll, ...cutter], pickable);
  }
  group.name = `ToolBody_T${tool.number}`;
  return group;
}

/** Takes a tool out of the scene and frees its geometry (materials are shared). */
export function disposeToolObject(object: THREE.Object3D) {
  object.removeFromParent();
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
