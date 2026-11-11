/**
 * R3F calls onClick even when the pointer travelled between going down and
 * coming up — which on a desktop is the end of a drag to look round. A click
 * that ends a drag must not press what happens to be under the cursor.
 * `delta` is the pointer's travel in pixels; XR rays leave it unset.
 */
export const isDragClick = (event: { delta?: number }) => (event.delta ?? 0) > 4;
