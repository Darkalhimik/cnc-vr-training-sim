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
- Machine materials in `cnc-machine.tsx` / `procedural-shell.tsx` are the
  physical machine's own colours and sit outside this palette.

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

1. Check air supply via the rear valve (OPEN).
2. Press the green power button.
3. E-stop: pull the button out and rotate clockwise to release.
4. Door check: if open, close it; if closed, open and close it again.
5. Handle Jog -> Diagnostics.

## Modes

- `desktop`: mouse/touch training.
- `vr`: WebXR VR mode.
- `ar`: WebXR AR mode for mobile.
- `tutorial`: focused mode limited to the mission.

## Model integration

Current machine supports two modes:

- If `public/models/haas-umc500.glb` exists, the real model is rendered.
- If it does not exist, the scene falls back to the built-in placeholder.

To attach a real Haas UMC500 model:

1. Put model file into `public/models/haas-umc500.glb`.
2. Keep interaction anchors using `MACHINE_PART_POSITIONS` so tutorial highlighting remains stable.

### Where to get source model

You can use official or community CAD sources, then convert to `.glb`:

1. Haas official resources / vendor CAD portals (if available for your license).
2. Engineering model libraries such as TraceParts / 3D ContentCentral / GrabCAD.
3. Exported in-house CAD (SolidWorks/STEP/OBJ) from your team.

## Notes

- This starter already compiles and passes `npm run build`.
- WebXR support depends on browser/device capabilities and HTTPS.
