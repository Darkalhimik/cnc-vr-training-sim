"use client";

import { XRSpace, useXR, useXRInputSourceState } from "@react-three/xr";
import { PAD, StackBoard, buttonsRow, textRow, type Row } from "./board-kit";

/** Board units are metres at reading distance; on the wrist it is held close. */
const WIDTH = 0.9;
const SCALE = 0.32;
const INNER = WIDTH - 2 * PAD;

export type WristChoice = { label: string; current: boolean; disabled?: boolean; onPress: () => void };

/**
 * A small menu on the back of the left wrist in AR glasses: which machine is
 * out, and bringing it in front of the trainee again. How to get about is
 * chosen on the site before entering, not here. It rides with the left
 * controller or hand; the right hand's ray presses it. Only in a session.
 * Must be inside the XROrigin: the wrist's space is the origin's.
 */
export function WristMenu({
  machines,
  actions,
}: {
  machines?: WristChoice[];
  /** One-off buttons under the choices: in AR, bringing the machine back. */
  actions?: { label: string; onPress: () => void }[];
}) {
  const session = useXR((s) => s.session);
  const controller = useXRInputSourceState("controller", "left");
  const hand = useXRInputSourceState("hand", "left");
  const space = controller?.inputSource.gripSpace ?? hand?.inputSource.gripSpace;
  if (!session || !space || (!machines?.length && !actions?.length)) return null;

  const rows: Row[] = [
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
    ...(actions?.length ? [buttonsRow(actions, INNER)] : []),
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
