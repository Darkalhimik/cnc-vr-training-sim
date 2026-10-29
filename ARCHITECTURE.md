# Architecture

```
assets/cad/UMC-500_SS_02_2026.glb      Haas configurator CAD (source)
assets/cad/haas-*/                     Haas solid models, not in git (README: Model)
tools/cad/step_to_glb.py               STEP -> GLB + part inventory (OpenCascade)
tools/blender/build_umc500.py          CAD -> rigged, Draco-compressed public/models/umc500.glb
tools/{logic,nc,removal}-check/        check scripts (no test runner)
docs/haas-ngc/                         NGC control, SMTC and UMC-500 research
drizzle/                               SQL migrations (generated from the schema)
scripts/migrate.mjs                    applies them (local, Vercel build)
Dockerfile, docker-compose.yml         self-hosted: app + Postgres
src
├─ app                                 pages and API routes
│  ├─ page.tsx                         machines dashboard
│  ├─ machines/[slug]/                 machine page, levels/ (old play/ links redirect)
│  ├─ world/[device]/                  the trainer: workshop or AR
│  ├─ warehouse/, toolbox/, sign-in/   (cabinet/ redirects to warehouse/)
│  └─ api/                             auth/[...all], parts, progress, tooling
├─ server                              server only: db (Drizzle schema, pool,
│                                      migrate), auth (Better Auth), parts
├─ entities
│  ├─ catalog                          machines and levels as data
│  ├─ world/layout.ts                  the workshop, computed from the catalogue:
│  │                                   rooms, walls, bays, stations, colliders
│  ├─ machine
│  │  ├─ machine-types.ts              state, modes, alarms, offsets, pockets
│  │  ├─ machine-parts.ts              part registry (ids the model binds to)
│  │  ├─ machine-logic.ts              pure reducer: rules, NGC keys, timers
│  │  ├─ machine-store.ts              zustand; timers; starts program runs
│  │  ├─ program-playback.ts           plays interpreted motions in time
│  │  ├─ program-run.ts                CYCLE START -> interpreter; frames ->
│  │  │                                reducer actions (scene and tests share it)
│  │  ├─ tool-changer.ts               SMTC pockets, indexing, the swap's pose
│  │  ├─ kinematics.ts                 machine <-> table/stock frames, B/C
│  │  └─ machine-indicators.ts         status list for DOM and VR boards
│  ├─ nc                               Haas G-code interpreter
│  ├─ tooling                          the crib (holders, cutters, tools) and a
│  │                                   machine's loadout with its checks
│  └─ part                             part design, tool library (the tools
│                                      loaded now), CAM, limits
├─ features
│  ├─ levels                           tutorials.ts, tasks.ts (level content),
│  │                                   level-session (start, finish, report),
│  │                                   grading (part vs drawing), progress
│  ├─ cnc-tutorial                     startup steps, tutorial-engine.ts (pure)
│  ├─ tutorial/tutorial-store.ts       cursor over any level's steps + sync
│  ├─ warehouse                        part-field (save format), API client,
│  │                                   meshing, Save to warehouse
│  ├─ tooling                          loadout store, loading into the machine,
│  │                                   crib list, tool details and viewer,
│  │                                   tool-table editor
│  ├─ part-development                 job store, setup checklist, workspace,
│  │                                   program-check.ts (alarms + crashes
│  │                                   before a run), removal/ (cutting engine)
│  ├─ world                            world store (walk / at a station,
│  │                                   travel), shell, panels, startLevel
│  ├─ session                          device/game mode, scale, yaw, focus,
│  │                                   pendant keyboard
│  └─ simulation, free-play, theme
├─ widgets
│  ├─ vr-scene
│  │  ├─ machine-rig.ts                binds the GLB, animates it from state
│  │  ├─ tool-body.ts                  tools as geometry: CT40 taper, flange,
│  │  │                                stud, holder by kind, fluted cutter
│  │  ├─ machine-model.tsx             loads the GLB, pointer events
│  │  ├─ machine-runtime.tsx           runs programs, sweeps the stock
│  │  ├─ machine-station.tsx           machine + full pendant + boards, in the
│  │                                   machine's frame (a bay, or AR)
│  │  ├─ ar-scene.tsx                  AR glasses / phone: the machine alone
│  │  ├─ pendant-screen.ts             paints the NGC screen pages
│  │  └─ *-3d.tsx                      in-scene boards for VR/AR
│  ├─ world                            the workshop scene: rooms, lobby boards,
│  │                                   desktop navigator, VR locomotion
│  ├─ gcode-editor                     CodeMirror editor, backplot, overlay
│  ├─ full-pendant                     the full-size NGC pendant
│  ├─ warehouse-scene, machine-showcase  the warehouse's cabinet; the machine
│  │                                   page's turntable
│  ├─ tooling                          tool crib and tool cart (3D)
│  └─ app-header, machine-progress, hud, theme-toggle
└─ shared                              ui kit, icons, tones, notifications,
                                       auth client
```

## Responsibilities

- `entities/machine`: what the machine is and does. No React, no three.js in
  the logic; `machine-logic.ts` can be exercised with plain function calls.
- `features/cnc-tutorial`: the startup sequence as data, and the engine that
  advances it from machine state and re-checks completed steps' guards.
- `widgets/vr-scene`: rendering. The rig reads machine state every frame, so
  motion never re-renders React.
- `widgets/hud`: the DOM side panel; `*-3d.tsx` boards mirror it in VR/AR.
- `features/levels`: what a level is beyond its catalogue entry. A tutorial
  is steps plus the machine it starts on; a task is a design plus a program
  header. The level session puts the stores in that state, times the attempt
  and reports it to `/api/progress`, which works out the stars itself.
- `server`: the only code that touches the database or the auth secret. The
  API keeps to the trainee's own rows; every per-part route checks ownership.

## Data

- Tables: Better Auth's `user` / `session` / `account` / `verification`,
  then `level_progress` (best per user and level), `part` (the warehouse)
  and `tool_loadout` (each machine's tool table, per user).
- A part is stored as its gzipped distance field (`part-field.ts`), not a
  mesh: small enough for a free Postgres, and the browser meshes it with the
  same code that cut it.
- Guests are real users with `isAnonymous`; signing up moves their rows to
  the new account (`adoptGuest` in `server/auth.ts`).

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
- A new tutorial is a step list in `features/levels/tutorials.ts` and an entry
  in `entities/catalog/levels.ts`; a new task is a design there and in
  `tasks.ts`. `tools/logic-check` plays every tutorial through — add the new
  one's script to scenario 19.
- A new machine is a catalogue entry, its model, its rig and its levels; the
  dashboard, level map and warehouse are already keyed by machine, and a
  40-taper machine shares the tool crib; it needs `tooling` limits in its
  catalogue entry, and gets a tool cart in its bay.
- Unit tests: the reducer and tutorial engine are pure and ready for a runner.
