# Architecture

```
src
├─ app
│  ├─ page.tsx
│  ├─ desktop/page.tsx
│  ├─ vr/page.tsx
│  ├─ ar/page.tsx
│  └─ tutorial/page.tsx
├─ features/cnc-tutorial
│  ├─ steps/
│  ├─ tutorial-engine.ts
│  ├─ tutorial-state.ts
│  ├─ tutorial-types.ts
│  └─ tutorial-shell.tsx
├─ entities/machine
│  ├─ machine-parts.ts
│  └─ haas-umc500.ts
├─ widgets
│  ├─ vr-scene/
│  ├─ floating-ui/
│  └─ interaction-panel/
└─ shared/ui/client-only.tsx
```

## Responsibilities

- `features/cnc-tutorial`: training logic, step sequence, transitions.
- `entities/machine`: machine domain data and part anchor positions.
- `widgets/vr-scene`: 3D scene, machine rendering, visual hints.
- `widgets/floating-ui`: tutorial overlays and step messaging.
- `widgets/interaction-panel`: route/mode controls.

## Interaction model

- Raycast pointer interaction via mesh `onPointerDown`.
- One unified interaction path for mouse, touch, and XR pointer events.
- Tutorial completion is state-driven, not hardcoded in UI.

## Expand path

- Add scoring/certification fields in Zustand store.
- Add voice narration service in `features/cnc-tutorial`.
- Add physics animation layer for button push/door hinge.
- Replace placeholder machine with optimized `.glb` and LOD setup.
