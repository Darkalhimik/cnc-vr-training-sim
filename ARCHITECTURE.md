# Architecture

```
assets/cad/UMC-500_SS_02_2026.glb      Haas configurator CAD (source)
tools/blender/build_umc500.py          CAD -> rigged public/models/umc500.glb
src
├─ app                                 routes; /play/[device]/[gameMode]
├─ entities/machine
│  ├─ machine-types.ts                 state, axes, alarms
│  ├─ machine-parts.ts                 part registry (ids the model binds to)
│  ├─ machine-logic.ts                 pure reducer: rules, interlocks, timers
│  ├─ machine-store.ts                 zustand store; runs the reducer's timers
│  └─ machine-indicators.ts            status list shared by DOM and VR boards
├─ features
│  ├─ cnc-tutorial                     steps/, tutorial-engine.ts (pure)
│  ├─ tutorial/tutorial-store.ts       cursor + useTutorialSync
│  ├─ session                          device/game mode, scale, yaw, focus
│  └─ simulation, free-play, theme
├─ widgets
│  ├─ vr-scene
│  │  ├─ machine-rig.ts                binds the GLB, animates it from state
│  │  ├─ machine-model.tsx             loads the GLB, pointer events
│  │  ├─ pendant-screen.ts             paints the NGC screen
│  │  ├─ arrows.tsx, coolant-voxels.tsx  portalled into model nodes
│  │  └─ *-3d.tsx                      in-scene boards for VR/AR
│  └─ hud, landing, theme-toggle
└─ shared                              ui kit, tones, notifications
```

## Responsibilities

- `entities/machine`: what the machine is and does. No React, no three.js in
  the logic; `machine-logic.ts` can be exercised with plain function calls.
- `features/cnc-tutorial`: the startup sequence as data, and the engine that
  advances it from machine state and re-checks completed steps' guards.
- `widgets/vr-scene`: rendering. The rig reads machine state every frame, so
  motion never re-renders React.
- `widgets/hud`: the DOM side panel; `*-3d.tsx` boards mirror it in VR/AR.

## Interaction model

- Raycast pointer interaction on the model; a hit resolves to the nearest
  ancestor node with a `part` extra. One path for mouse, touch and XR rays.
- The handwheel reads which half was hit: right jogs plus, left minus.
- Operating a part dispatches to the reducer; refusals and notices become
  toasts (DOM and VR warning board) and the pendant screen's message line.
- The tutorial subscribes to machine state, not to clicks.

## Expand path

- Scoring/certification: time per step and guard violations are already
  observable in the tutorial store.
- More procedures (tool change, work offsets) are new step lists over the same
  reducer; new controls are added in the Blender script and the part registry.
- Unit tests: the reducer and tutorial engine are pure and ready for a runner.
