/**
 * R3F calls onClick even when the pointer travelled between going down and
 * coming up — which on a desktop is the end of a drag to look round. A click
 * that ends a drag must not press what happens to be under the cursor.
 * `delta` is the mouse's travel in pixels.
 *
 * In VR and AR the events come from @pmndrs/pointer-events, whose `delta`
 * getter throws ("not supported"): reading it there must not stop the press,
 * so a ray or a finger never counts as a drag.
 */
export function isDragClick(event: object): boolean {
  try {
    return ((event as { delta?: number }).delta ?? 0) > 4;
  } catch {
    return false;
  }
}
