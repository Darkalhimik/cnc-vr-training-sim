# CNC VR Training Simulator

Starter architecture for a CNC industrial training simulator (Desktop + VR + AR), inspired by the Hydrolic XR projects.

## Stack

- Next.js 15 (App Router)
- React Three Fiber + Drei
- WebXR via `@react-three/xr`
- Zustand state machine for tutorial flow

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
