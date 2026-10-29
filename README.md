# CNC Trainer

A CNC training simulator for desktop, VR and phone AR. Each machine has guided
tutorials, machining tasks whose parts are measured, and free play; the parts a
trainee makes go into a 3D warehouse, and the tools come from a shop-wide tool
crib, loaded into each machine at its tool cart. One machine so far: the Haas
UMC-500.

## Stack

- Next.js 15 (App Router), route handlers for the API
- React Three Fiber + Drei, WebXR via `@react-three/xr`
- Zustand for client state; CodeMirror 6 for the G-code editor
- Postgres with Drizzle ORM; Better Auth (guest + email/password)
- Tailwind v4 with a shadcn-style semantic token layer

## Design system

The UI follows the c2m house rules (`c2m-dashboard`'s `c2m-ui` skill): dark-first,
semantic tokens, dense controls, no hero type and no gradients.

- **Tokens** live in `src/app/globals.css` — `:root` / `.dark` define the zinc
  oklch palette, `@theme inline` maps it onto `bg-background`, `bg-card`,
  `text-muted-foreground`, `border`, `bg-accent`, `bg-destructive`. Chrome never
  uses a raw hex or a raw `zinc-*` shade.
- **Type**: Inter for headings (`font-heading`, automatic via `@layer base`),
  Open Sans for everything else (`font-sans`), JetBrains Mono for precise values
  only (`font-mono`) — ids, machine states, scale factors. All three load in
  `src/app/layout.tsx` and must stay mapped in `@theme inline`, or the utility
  silently falls back to the system stack.
- **Light and dark**, dark by default. The choice is stored under the
  `cnc-theme` localStorage key and re-applied by a blocking inline script in
  `src/app/layout.tsx` before first paint, so the page never flashes the wrong
  theme; `<html>` therefore ships with no theme class and carries
  `suppressHydrationWarning`. Toggle lives in the landing navbar and the HUD
  toolbar. Hued pills use a shade pair (`-700` light / `-300` dark).
- **The 3D stage does not follow the theme.** `--stage` (used as `bg-stage`) is
  the same near-black in both, because the machine's own shell is light grey and
  vanishes on a white page. Chrome floating over it uses `bg-background/8x` so it
  stays theme-aware and legible on the dark stage — which is why controls there
  are panel-surfaced rather than `bg-primary`.
- **Density**: `text-xs/relaxed` body and controls, `h-7` default button,
  `text-2xl font-semibold tracking-tight` as the largest type in the product.
  Spacing comes from the 4px scale (`gap-2`, `p-3`, `p-4`).
- **Hue is state, never decoration.** Both tone registries are one file each and
  must stay in step: `src/shared/ui/tone.ts` for the DOM, and
  `src/widgets/vr-scene/panel-theme.ts` for the in-scene VR boards, which resolve
  the same tones to hex because a three.js material cannot read a CSS variable.
  Add a state to those maps, not at the call site.
- Machine materials (set in `tools/blender/build_umc500.py`) and the pendant
  screen (`pendant-screen.ts`) are the physical machine's own colours and sit
  outside this palette.

## Run

```bash
npm install                 # or pnpm install
cp .env.example .env.local  # then set BETTER_AUTH_SECRET
npm run db:up               # Postgres in Docker, published on :5433
npm run db:migrate
npm run dev                 # https://localhost:3000 (self-signed, for WebXR)
```

`npm run db:generate` writes a new migration into `drizzle/` after a change to
`src/server/db/schema.ts`; commit it with the change.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Machines: every machine, your progress on it, the warehouse, the toolbox |
| `/machines/<slug>` | The machine: a live 3D model, specs, progress, the ways on |
| `/machines/<slug>/levels` | The level map: tutorials and tasks as tracks, Free play, the device |
| `/world/<device>?level=<id>&at=<station>` | The trainer: the workshop (desktop, `vr`) or the machine in your room (`glasses`, `phone`) |
| `/warehouse` | The parts you saved, on the shelves of the warehouse's cabinet; click one to inspect it (`/cabinet` redirects here) |
| `/toolbox` | The tool crib — every tool, holder and cutter, to turn round and take apart — and each machine's tool table (`?machine=umc500`) |
| `/sign-in` | Sign in, or turn a guest into an account |

Machines and levels are data: `src/entities/catalog/`. A level's behaviour —
its steps, its part, its grading — is looked up by id in `src/features/levels/`.

## The workshop

The trainer is a place, not a page per machine: a **lobby** with the
warehouse, the tool crib, the level terminal and the progress wall, and
through its door the **shop hall**, machines in bays either side of an aisle,
each with its tool cart. The layout is
computed from the machine catalogue (`src/entities/world/layout.ts`): a new
machine takes the next bay, and the hall grows a row when the bays run out.

- **Desktop** walks it in first person — WASD, drag to look, Shift to run,
  colliding with walls and machines. Click a station (or pick it from the
  panel) to walk there; at a machine the view becomes the familiar orbit with
  the machine's side panel, at the warehouse the shelves can be picked from,
  at the tool crib or a cart the tools.
  Esc steps back.
- **VR headset** walks it for real: room-scale walking, the left stick to
  move, the right stick to snap-turn, the teleport arc onto any floor. The
  side panel's content stands beside each machine as boards.
- **AR glasses** see the machine alone in their own room: point at the floor
  and pinch (or pull the trigger) to put it down, anchored where it stands.
  **Phone AR** shows it in camera view. The boards stand beside it.

In a headset the machine and the warehouse are things to handle, not panels:

- **Carry parts** — open the door, squeeze (or pinch) the part in the vise
  and lift it out; carry it to the warehouse and let go over the lit place on
  the shelf to keep it. Let go anywhere else and it goes back into the vise.
  Parts on the shelves can be picked up and turned in the hand.
- **Hands** — fingers poke the pendant's buttons, the full panel's keys and
  the boards' buttons; a pinch-ray reaches further.
- **Haptics** — the controller that pressed something feels it; the
  handwheel clicks through its detents, cutting buzzes with the load, and a
  crash is a jolt.

Levels start from the terminal in the lobby (or a link with `?level=`) and
the page never changes while playing, so a headset session survives a level
change; the URL is rewritten in place so a reload comes back to it.

## Modes

- **Free play** — the whole machine with nothing scripted: design a part or
  write its G-code, set up the vise, tools and offsets, cut it, then **Save to
  warehouse** (or export STL). The machine carries the tool table set up at
  its tool cart. Starts homed; **Cold start** gives the shift-start
  machine.
- **Tutorials** — one procedure each, step by step with the next control lit:
  machine startup, jogging, part zero (G54), tool lengths, MDI, running a
  program (single block, feed hold), lines and arcs. Played in order.
- **Tasks** — a drawing, a clamped and probed blank, and a program header. The
  trainee writes the program and runs it; **Measure part** compares the cut
  stock with the drawing cut by the CAM's own program on the same voxel
  lattice (`src/features/levels/grading.ts`): material left counts once, an
  over-cut twice, a crash caps the score at 50 %. Stars come from the score
  and the time.

Progress (best time, score, stars, attempts) is saved per user and level.
Nobody has to sign up: the first save or finished level makes a guest account,
and signing up later keeps everything the guest did.

Devices: `desktop`, `vr` (a WebXR headset in the workshop), `glasses` (a
passthrough headset — the machine in your room) and `phone` (phone AR).

## The program editor

The workspace's Program tab and its **Full screen** editor
(`src/widgets/gcode-editor/`) are CodeMirror with the Haas dialect: syntax
colours, completion and hover docs for every G- and M-code, the interpreter's
alarms and the crash check inline as you type, and a 3D backplot of the real
tool tip's path. Ctrl+S sends the program to the control, Ctrl+Enter checks.

## The warehouse

Where saved parts are kept: for now one steel cabinet of lit shelves in the
lobby; more cabinets can stand beside it. A saved part is the removal engine's
distance field, gzipped, plus a coarse copy for the shelf
(`src/features/warehouse/part-field.ts`) — typically 10–150
KB, an order of magnitude smaller than its mesh, stored in Postgres. The
browser meshes it with the same surface nets that cut it. 30 places per user;
a part's geometry never changes, so the browser caches it for good.

## The toolbox

Tools are the shop's, not a machine's: a CT40 holder fits every 40-taper mill
(`docs/haas-ngc/tooling.md`). So the **tool crib** stands in the lobby with
every tool the trainer has — face mills, end mills, ball mills, spot drills,
drills, each in its holder (side-lock, ER collet chuck, shrink fit, shell mill
arbor, drill chuck) — and each machine has a **tool cart** in its bay, where its
tool table is set up from the crib. `/toolbox` is both on one page.

- Pick a tool to see it close up, turn it round and **take it apart** (pull
  stud, holder, cutter), with its holder's and cutter's data and where it is
  loaded.
- A machine's table is checked as it is edited against that machine's spindle
  and changer — taper, length from the gauge line, mass, and a large tool's
  empty neighbours — and again by the server. Saved per user and machine
  (`/api/tooling`, table `tool_loadout`).
- **Free play** runs the machine with the saved table: loaded T-in-pocket-T
  when the machine is idle, new tools unmeasured; the CAM picks from it.
  **Levels** always use the shop's standard set, T1–T8.

The crib is `src/entities/tooling/catalog.ts`; a new tool is an entry there
(holder, cutter, stick-out), drawn and checked from its data.

## The pendant

The machine's own pendant is the simplified one; its blue **FULL PANEL** key
(or *Open full panel* in the side panel) opens the complete NGC pendant at
full size beside the machine: all 132 keys at the positions measured from
Haas's keyboard drawing, the physical controls, the side-panel switches and
a live screen. The keyboard is one painted texture, like the real membrane,
so it costs one draw call in a headset. On a desktop, with the full panel open,
the computer keyboard types into the control's input line (Enter is ENTER,
Backspace is CANCEL), and tutorials light the keys they ask for.

## The tool changer

M06 runs the 30-pocket side-mount changer as the real one does
(`docs/haas-ngc/smtc.md`): Z clears, the head goes to the arm, the carousel
indexes the short way, the pocket tilts down, the double arm swaps the two
tools and the old one goes into the pocket the new one came from. Every tool
in the table is drawn in its pocket, with its CAT40 taper and pull stud. The
animation runs on machine time, so FEED HOLD freezes it; NEXT TOOL and ATC
FWD/REV at the keypad play the same change.

## The startup tutorial

The Haas NGC startup, in the order an operator does it at the start of a shift.
The machine starts as the last shift left it: air off, mains off, E-stop
pressed, door open, axes parked away from home.

1. **Air** — open the shut-off valve on the rear panel; the gauge rises to ~6 bar.
2. **Mains** — turn the main disconnect on the electrical cabinet to I.
3. **Power** — press POWER ON and wait for the control to boot.
4. **E-stop** — twist the E-stop to release it.
5. **Reset** — press RESET to clear 107 EMERGENCY OFF and 102 SERVOS OFF.
6. **Door** — close the front door.
7. **Home** — press POWER UP; Z returns first, then X/Y, then B/C.
8. **Jog** — HANDLE JOG, select X, jog X at least 50 mm minus with the handwheel.
9. **Warm-up** — MEMORY, CYCLE START, and let the spindle warm-up finish.

Phases complete on machine state, not clicks, so timer-driven events (the boot
finishing, the zero return arriving) advance the tutorial too. Every completed
step keeps a guard: undo one — shut the air off, open the door — and the
tutorial sends the trainee back to it, then skips back up past every later step
whose outcome still holds.

## Machine and control

`src/entities/machine/machine-logic.ts` is the machine and its NGC control as
a pure `reduce(state, action)`: interlocks (door hold, low air, E-stop, mains
cut under load), alarms, the six modes (EDIT, MEMORY, MDI, HANDLE JOG, ZERO
RETURN, LIST PROGRAM), display pages, handle increments, overrides, work and
tool offset tables (F1 sets, ENTER adds, PART ZERO SET, TOOL OFFSET
MEASURE), program memory and MDI. Behaviour follows the research in
`docs/haas-ngc/`.

- **Programs** run through `src/entities/nc` — a Haas-dialect G-code
  interpreter: arcs, canned cycles, cutter compensation, work/tool offsets,
  subprograms, macro B, G254 dynamic work offset and G234 TCPC through the
  trunnion kinematics in `src/entities/machine/kinematics.ts`. CYCLE START
  interprets the active program against the machine's offsets, tool table
  and retained macro variables; `program-run.ts` plays the result in time
  with overrides, single block, M00/M01 and feed hold, and reports back what
  the control keeps: G10 and `#2001`/`#5221`-style offset writes, `#500`–`#999`,
  the work offset in use, and the active codes CURRENT COMMANDS shows. An
  interpreter alarm stops the run at its block, as on the real control.
- **Check before running**: the workspace's Program tab runs the interpreter
  against the ideal setup or the machine as it is set up now, and flags
  moves that would put a real tool tip into the vise or the platter — the
  crash an unmeasured tool or a wrong G54 Z causes, which the control cannot
  see.
- **Cutting** is `src/features/part-development/removal`: a 5-axis
  signed-distance voxel engine in a Web Worker, meshed with surface nets.
  Every tool movement — program or hand jog — is swept through the stock;
  a shank or holder contact, a rapid into material or a cut with the spindle
  stopped is a crash alarm.
- **CAM** (`src/entities/part/cam.ts`) writes Haas-style programs from the
  feature-based designer: 3+2 indexing with G254 for side faces, G41 on
  contours, canned cycles for holes.

Checks (no test runner in the repo; each compiles with the repo's
TypeScript and prints a pass/fail table):

```bash
node tools/logic-check/run.mjs     # reducer, control, every tutorial played through, program runs
node tools/nc-check/run.mjs        # G-code interpreter, 38 golden cases
node tools/removal-check/run.mjs   # removal accuracy, collisions, timing
```

The removal timing checks assume an otherwise idle machine; under load they
can miss their budgets while the accuracy checks still pass.

## Model

`public/models/umc500.glb` is generated — do not edit it by hand. It is built
from Haas's own CAD by a Blender script, each part from the finest source
that has it:

- **Solid models** (STEP, ~50 MB each, not in git), from the "3D Models"
  links on the UMC-500 page at haascnc.com: "w/SMTC-120" into
  `assets/cad/haas-smtc120/` (base, trunnion, platter, axes, head, spindle,
  door, side window, tank, tool setter) and "w/10+1 Pallet Pool" into
  `assets/cad/haas-pp10/` (the side-mount changer's arm and cam box).
- **The configurator export** `assets/cad/UMC-500_SS_02_2026.glb` (in git) for
  what the solid models lack in the standard configuration: the enclosure cut
  for the 30+1 changer, the 30-pocket carousel and the pendant. Without the
  solid models the build falls back to it alone, at a third of the detail.

Blender cannot read STEP, so OpenCascade tessellates it first:

```bash
python -m venv tools/cad/.venv
tools/cad/.venv/Scripts/python -m pip install cadquery-ocp
tools/cad/.venv/Scripts/python -I tools/cad/step_to_glb.py     --step "assets/cad/haas-smtc120/UMC-500 + 120 PKT TC_4_2026.STEP"     --out assets/cad/haas-smtc120/umc500-smtc120.glb
tools/cad/.venv/Scripts/python -I tools/cad/step_to_glb.py     --step "assets/cad/haas-pp10/UMC-500 w 10 Station PP_3_2026.STEP"     --out assets/cad/haas-pp10/umc500-pp10.glb
```

(about a minute each; an `.inventory.json` beside each GLB lists every part
with its STEP name, size and triangles). Then:

```bash
blender -b --factory-startup --python tools/blender/build_umc500.py
# with preview renders of the result:
blender -b --factory-startup --python tools/blender/build_umc500.py -- --preview <dir>
```

The script picks one standard configuration out of the CAD's overlaid options,
stands it up (both sources share Haas's origin, so they line up to the
millimetre), splits the trunnion into fixed base and tilting cradle, re-parents
every moving part under a pivot on its real axis (X/Y/Z, B, C, spindle, door,
carousel, pockets, changer arm), replaces the pendant's controls with separate
pressable ones plus a screen and beacon, and adds the rear air regulator and
the cabinet main disconnect. The GLB is Draco-compressed (about 1 MB for
~240k triangles); the app serves three's decoder from `public/draco/`, so a
self-hosted install never fetches it from a CDN.

The app binds to the model by data, not coordinates: pointable nodes carry a
`part` extra (one of `MACHINE_PART_IDS`), arrow targets are `Anchor_<part>`
empties, and the moving nodes keep the names listed in `RIG_NODES` in the
script and `NODE_NAMES` in `src/widgets/vr-scene/machine-rig.ts`. A new
control is added in the script and in `machine-parts.ts`, nowhere else.

## Research

`docs/haas-ngc/` is the spec the control was built from: pendant layout,
operation, G- and M-codes, settings and alarms, UMC-500 data, tooling. Each file lists
its sources and what could not be confirmed (notably the B-axis sign, which
this model takes as Haas documents it: −35° to +120°, +B tipping the platter
towards −X).

## Deploy

**Vercel (free tier).** Add Neon from the Vercel Marketplace (it sets
`DATABASE_URL`; use the pooled connection string) and set
`BETTER_AUTH_SECRET`. The `vercel-build` script applies migrations, then
builds. Budget, at half the free limits: Neon 0.5 GB storage and 100 CU-hours
a month (a part is 10–150 KB; the database sleeps when idle); Vercel 1M
function calls and 4 CPU-hours a month — pages are static, only the API runs
functions, and part geometry is cached in the browser.

**Self-hosted (Docker).** On the server, put `BETTER_AUTH_SECRET` (and
`PUBLIC_URL` if the box has a name) in a `.env` next to `docker-compose.yml`,
then:

```bash
docker compose up -d --build
```

Postgres and the app start together; the app migrates the database on start.
WebXR needs HTTPS, so put the app behind a TLS proxy for VR and AR.

## Notes

- WebXR support depends on browser/device capabilities and HTTPS.
