/**
 * @pmndrs/pointer-events (via @react-three/xr) adds pointer capture to
 * three's Object3D with `declare module "three"`. `three` only re-exports the
 * class, and whether TypeScript merges an augmentation through that
 * re-export depends on the order it checks files in — so adding an unrelated
 * import elsewhere could split Object3D into two incompatible types. Adding
 * the same members where the class is declared makes it hold either way.
 */
import "three";

declare module "three/src/core/Object3D.js" {
  interface Object3D {
    setPointerCapture(pointerId: number): void;
    releasePointerCapture(pointerId: number): void;
    hasPointerCapture(pointerId: number): boolean;
  }
}
