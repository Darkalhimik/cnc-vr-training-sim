# CNC VR Training Simulator

Starter architecture for a CNC industrial training simulator (Desktop + VR + AR), inspired by the Hydrolic XR projects.

## Stack

- Next.js 15 (App Router)
- React Three Fiber + Drei
- WebXR via `@react-three/xr`
- Zustand state machine for tutorial flow
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
npm install
npm run dev
```

App routes:

- `https://localhost:3000/desktop`
- `https://localhost:3000/vr`
- `https://localhost:3000/ar`
- `https://localhost:3000/tutorial`

## Tutorial steps

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

## Machine logic

`src/entities/machine/machine-logic.ts` is the whole machine as a pure
`reduce(state, action)`: interlocks (door hold, low air, E-stop, mains cut
under load), alarms, modes, travel limits and the timed processes. A slow
process asks for a timer; the store feeds it back in as an action, so every
rule is testable without a clock.

## Model

`public/models/umc500.glb` is generated — do not edit it by hand. It is built
from the Haas configurator CAD in `assets/cad/` by a Blender script:

```bash
blender -b --factory-startup --python tools/blender/build_umc500.py
# with preview renders of the result:
blender -b --factory-startup --python tools/blender/build_umc500.py -- --preview <dir>
```

The script picks one standard configuration out of the CAD's overlaid options,
splits the trunnion into fixed base and tilting cradle, re-parents every moving
part under a pivot on its real axis (X/Y/Z, B, C, spindle, door), replaces the
CAD pendant's controls with separate pressable ones plus a screen and beacon,
and adds the rear air regulator and the cabinet main disconnect.

The app binds to the model by data, not coordinates: pointable nodes carry a
`part` extra (one of `MACHINE_PART_IDS`), arrow targets are `Anchor_<part>`
empties, and the moving nodes keep the names listed in `RIG_NODES` in the
script and `NODE_NAMES` in `src/widgets/vr-scene/machine-rig.ts`. A new
control is added in the script and in `machine-parts.ts`, nowhere else.

## Notes

- `npm run build` and `npm run lint` pass.
- WebXR support depends on browser/device capabilities and HTTPS.
