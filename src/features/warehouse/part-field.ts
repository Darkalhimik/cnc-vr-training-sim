/**
 * A machined part as the warehouse stores it: the removal engine's distance
 * field, gzipped. A field is a few hundred kilobytes before compression and
 * mostly saturated "far inside / far outside" bytes, so it packs to tens of
 * kilobytes — an order of magnitude smaller than the mesh it becomes, and the
 * browser meshes it with the same surface nets that drew it on the machine.
 *
 * Layout (little-endian), then gzip:
 *   "CNCF"  u8 version  3 pad
 *   f32 voxel   u32 nx ny nz   f32 ox oy oz
 *   i8 × nx·ny·nz   (grid.ts: 1/64 voxel per step, negative is material)
 */
import { createGrid, type Grid, type GridInfo, type Vec3 } from "@/features/part-development/removal/grid";

export type PartField = { info: GridInfo; data: Int8Array<ArrayBuffer> };

const MAGIC = 0x46434e43; // "CNCF"
const VERSION = 1;
const HEADER = 4 + 4 + 4 + 12 + 12;

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeField(field: PartField): Promise<Blob> {
  const { info, data } = field;
  const raw = new Uint8Array(HEADER + data.length);
  const view = new DataView(raw.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint8(4, VERSION);
  view.setFloat32(8, info.voxel, true);
  info.dims.forEach((n, i) => view.setUint32(12 + 4 * i, n, true));
  info.origin.forEach((o, i) => view.setFloat32(24 + 4 * i, o, true));
  raw.set(new Uint8Array(data.buffer, data.byteOffset, data.length), HEADER);
  return new Blob([await pipe(raw, new CompressionStream("gzip"))], { type: "application/octet-stream" });
}

export async function decodeField(bytes: ArrayBuffer): Promise<PartField> {
  const raw = await pipe(new Uint8Array(bytes), new DecompressionStream("gzip"));
  const view = new DataView(raw.buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error("Not a part field.");
  if (view.getUint8(4) !== VERSION) throw new Error(`Part field version ${view.getUint8(4)} is not supported.`);
  const voxel = view.getFloat32(8, true);
  const dims = [0, 1, 2].map((i) => view.getUint32(12 + 4 * i, true)) as Vec3;
  const origin = [0, 1, 2].map((i) => view.getFloat32(24 + 4 * i, true)) as Vec3;
  const count = dims[0] * dims[1] * dims[2];
  if (raw.length !== HEADER + count) throw new Error("Part field is truncated.");
  const data = new Int8Array(count);
  data.set(new Int8Array(raw.buffer, HEADER, count));
  return { info: gridInfoOf(voxel, dims, origin), data };
}

/** The chunk layout grid.ts derives from the lattice. */
function gridInfoOf(voxel: number, dims: Vec3, origin: Vec3): GridInfo {
  const CHUNK = 32;
  return { voxel, dims, origin, chunks: dims.map((n) => Math.ceil((n - 1) / CHUNK)) as Vec3 };
}

/** A decoded field as a grid the mesher can run over. */
export function fieldGrid(field: PartField): Grid {
  const { chunks } = field.info;
  return { ...field.info, data: field.data, dirty: new Uint8Array(chunks[0] * chunks[1] * chunks[2]) };
}

/** Samples along the longest side of a shelf preview. */
const PREVIEW_SAMPLES = 56;

/**
 * The same part, coarse: what the shelf shows. Each coarse sample takes the
 * nearest fine one, its distance rescaled to the coarse voxel. Features
 * smaller than a coarse voxel blur away, which is the point of a preview.
 */
export function previewField(field: PartField, stock: Vec3): PartField {
  const fine = field.info;
  const voxel = Math.max(fine.voxel, Math.max(...stock) / PREVIEW_SAMPLES);
  // A fresh grid gives the coarse lattice and its air skin; its samples are
  // then overwritten from the fine field.
  const coarse = createGrid({ size: stock, voxel });
  const [nx, ny, nz] = coarse.dims;
  const [fx, fy, fz] = fine.dims;
  const scale = fine.voxel / coarse.voxel;
  const nearest = (p: number, axis: number, n: number) =>
    Math.min(n - 1, Math.max(0, Math.round((p - fine.origin[axis]) / fine.voxel)));
  let index = 0;
  for (let k = 0; k < nz; k++) {
    const fk = nearest(coarse.origin[2] + k * voxel, 2, fz);
    for (let j = 0; j < ny; j++) {
      const fj = nearest(coarse.origin[1] + j * voxel, 1, fy);
      for (let i = 0; i < nx; i++, index++) {
        const fi = nearest(coarse.origin[0] + i * voxel, 0, fx);
        // Skin samples stay air, so the coarse surface stays closed.
        if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) continue;
        coarse.data[index] = Math.round(field.data[fi + fx * (fj + fy * fk)] * scale);
      }
    }
  }
  return { info: { voxel: coarse.voxel, dims: coarse.dims, origin: coarse.origin, chunks: coarse.chunks }, data: coarse.data };
}
