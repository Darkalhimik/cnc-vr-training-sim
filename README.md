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

1. Перевірка подачі повітря через задній клапан (OPEN)
2. Натиснути зелену кнопку увімкнення
3. E-stop: висунути кнопку та повернути за годинниковою стрілкою
4. Перевірка дверей: якщо відкриті - закрити, якщо закриті - відкрити і закрити
5. Handle Jog -> Diagnostics

## Modes

- `desktop`: навчання з мишею/тачем
- `vr`: WebXR VR режим
- `ar`: WebXR AR режим для телефона
- `tutorial`: фокусний режим лише на місії

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

### Using SolidWorks source (`.SLDPRT`)

Browser runtime cannot load `.SLDPRT` directly. Convert it to `.glb` first, then place the output at `public/models/haas-umc500.glb`.

Recommended conversion flow:

1. Export from SolidWorks to `.STEP` (or `.OBJ`).
2. Import into Blender (or another converter) and clean transforms/materials.
3. Export as `.glb` (binary glTF), then copy into `public/models/`.

## Notes

- This starter already compiles and passes `npm run build`.
- WebXR support depends on browser/device capabilities and HTTPS.
