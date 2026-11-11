/**
 * Finding a way on foot through the workshop: round machines and furniture,
 * through the shop door, never through a wall. The desktop player walks these
 * routes when sent somewhere — to a station picked from a list, to the
 * machine of a level just started, to where a control can be seen.
 *
 * Pure. The floor is a grid of cells; a cell is free when a walker standing
 * at its centre touches nothing (layout.ts's isBlocked). A* over the grid,
 * then the corners pulled tight, so the route is a few straight legs.
 */
import { isBlocked, roomAt, type Vec2, type WorldLayout } from "./layout";

const CELL = 0.25;

type Grid = { x0: number; z0: number; cols: number; rows: number; free: Uint8Array };

const grids = new WeakMap<WorldLayout, Grid>();

function gridOf(layout: WorldLayout): Grid {
  const cached = grids.get(layout);
  if (cached) return cached;
  const x0 = Math.min(...layout.rooms.map((r) => r.floor.min[0]));
  const z0 = Math.min(...layout.rooms.map((r) => r.floor.min[1]));
  const x1 = Math.max(...layout.rooms.map((r) => r.floor.max[0]));
  const z1 = Math.max(...layout.rooms.map((r) => r.floor.max[1]));
  const cols = Math.ceil((x1 - x0) / CELL);
  const rows = Math.ceil((z1 - z0) / CELL);
  const free = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p: Vec2 = [x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL];
      free[j * cols + i] = roomAt(layout, p) && !isBlocked(layout, p) ? 1 : 0;
    }
  }
  const grid = { x0, z0, cols, rows, free };
  grids.set(layout, grid);
  return grid;
}

const cellOf = (g: Grid, p: Vec2): [number, number] => [Math.floor((p[0] - g.x0) / CELL), Math.floor((p[1] - g.z0) / CELL)];
const centre = (g: Grid, i: number, j: number): Vec2 => [g.x0 + (i + 0.5) * CELL, g.z0 + (j + 0.5) * CELL];
const isFree = (g: Grid, i: number, j: number) => i >= 0 && j >= 0 && i < g.cols && j < g.rows && g.free[j * g.cols + i] === 1;

/** The free cell nearest `p`, searched outwards ring by ring. */
function nearestFreeCell(g: Grid, p: Vec2, maxRings = 12): [number, number] | null {
  const [ci, cj] = cellOf(g, p);
  for (let ring = 0; ring <= maxRings; ring++) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring || !isFree(g, ci + di, cj + dj)) continue;
        const c = centre(g, ci + di, cj + dj);
        const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
        if (d < bestD) [best, bestD] = [[ci + di, cj + dj], d];
      }
    }
    if (best) return best;
  }
  return null;
}

/** The free standing point nearest `p` (itself, when nothing is in the way). */
export function nearestFree(layout: WorldLayout, p: Vec2): Vec2 | null {
  if (roomAt(layout, p) && !isBlocked(layout, p)) return p;
  const g = gridOf(layout);
  const cell = nearestFreeCell(g, p);
  return cell ? centre(g, cell[0], cell[1]) : null;
}

/** Whether a walker can go from `a` to `b` in a straight line. */
function clear(layout: WorldLayout, a: Vec2, b: Vec2) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(length / (CELL / 2)));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (isBlocked(layout, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
  }
  return true;
}

/**
 * A walkable route from `from` to `to`: the points to walk through, `to` (or
 * the free point nearest it) last. Null when there is no way there.
 */
export function findPath(layout: WorldLayout, from: Vec2, to: Vec2): Vec2[] | null {
  const goal = nearestFree(layout, to);
  if (!goal) return null;
  if (clear(layout, from, goal)) return [goal];

  const g = gridOf(layout);
  const start = nearestFreeCell(g, from);
  const end = cellOf(g, goal);
  if (!start || !isFree(g, end[0], end[1])) return null;

  const n = g.cols * g.rows;
  const cost = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const startId = start[1] * g.cols + start[0];
  const endId = end[1] * g.cols + end[0];
  const h = (id: number) => Math.hypot((id % g.cols) - end[0], Math.floor(id / g.cols) - end[1]);
  // A binary heap of [priority, id].
  const heap: [number, number][] = [];
  const push = (item: [number, number]) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  cost[startId] = 0;
  push([h(startId), startId]);
  while (heap.length) {
    const [, id] = pop();
    if (closed[id]) continue;
    closed[id] = 1;
    if (id === endId) break;
    const i = id % g.cols;
    const j = Math.floor(id / g.cols);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || !isFree(g, i + di, j + dj)) continue;
        // No cutting a corner past a blocked cell.
        if (di && dj && (!isFree(g, i + di, j) || !isFree(g, i, j + dj))) continue;
        const next = (j + dj) * g.cols + (i + di);
        const c = cost[id] + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[next]) {
          cost[next] = c;
          came[next] = id;
          push([c + h(next), next]);
        }
      }
    }
  }
  if (!closed[endId]) return null;

  const cells: Vec2[] = [];
  for (let id = endId; id !== -1; id = came[id]) cells.push(centre(g, id % g.cols, Math.floor(id / g.cols)));
  cells.reverse();
  cells[cells.length - 1] = goal;

  // Pull the route tight: from each point, go straight to the furthest one in sight.
  const route: Vec2[] = [];
  let at = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) {
      if (clear(layout, at, cells[m])) {
        far = m;
        break;
      }
    }
    route.push(cells[far]);
    at = cells[far];
    k = far + 1;
  }
  return route;
}
