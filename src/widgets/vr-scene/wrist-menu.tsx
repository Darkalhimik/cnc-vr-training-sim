"use client";

import { XRSpace, useXR, useXRInputSourceState } from "@react-three/xr";
import { XR_MOVEMENTS, useSessionStore } from "@/features/session/session-store";
import { PAD, StackBoard, buttonsRow, textRow, type Row } from "./board-kit";

/** Board units are metres at reading distance; on the wrist it is held close. */
const WIDTH = 0.9;
const SCALE = 0.32;
const INNER = WIDTH - 2 * PAD;

export type WristChoice = { label: string; current: boolean; disabled?: boolean; onPress: () => void };

/**
 * A small menu on the back of the left wrist, in VR and AR glasses: how to
 * get about (teleport, walk, joystick) and, in AR, which machine is out.
 * It rides with the left controller or hand; the right hand's ray presses
 * it. Only in a session — before one, the page's panel holds the same.
 * Must be inside the XROrigin: the wrist's space is the origin's.
 */
export function WristMenu({ machines }: { machines?: WristChoice[] }) {
  const session = useXR((s) => s.session);
  const controller = useXRInputSourceState("controller", "left");
  const hand = useXRInputSourceState("hand", "left");
  const movement = useSessionStore((s) => s.xrMovement);
  const setMovement = useSessionStore((s) => s.setXrMovement);
  const space = controller?.inputSource.gripSpace ?? hand?.inputSource.gripSpace;
  if (!session || !space) return null;

  const rows: Row[] = [
    textRow("MOVEMENT", "caption", INNER, { gap: 0.01 }),
    buttonsRow(
      XR_MOVEMENTS.map((m) => ({
        label: m.label,
        variant: m.value === movement ? ("primary" as const) : ("secondary" as const),
        onPress: () => setMovement(m.value),
      })),
      INNER,
    ),
    ...(machines?.length
      ? [
          textRow("MACHINE", "caption", INNER, { gap: 0.01 }),
          buttonsRow(
            machines.map((m) => ({
              label: m.label,
              variant: m.current ? ("primary" as const) : ("secondary" as const),
              disabled: m.disabled,
              onPress: m.onPress,
            })),
            INNER,
          ),
        ]
      : []),
  ];

  return (
    <XRSpace space={space}>
      {/* Above the back of the wrist, tipped towards the eyes. */}
      <group position={[0, 0.06, 0.05]} rotation={[-1.05, 0, 0]} scale={SCALE}>
        <StackBoard width={WIDTH} rows={rows} anchor="center" />
      </group>
    </XRSpace>
  );
}
