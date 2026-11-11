"use client";

import type { GameMode } from "@/entities/machine/machine-types";
import { useSessionStore } from "@/features/session/session-store";
import { JobBoard3D } from "./job-board-3d";
import { SizePanel3D } from "./size-panel-3d";
import { StatusBoard3D } from "./status-board-3d";
import { TaskBoard3D } from "./task-board-3d";
import { TutorialTracker3D } from "./tutorial-tracker-3d";
import { WarningBoard3D } from "./warning-board-3d";

/**
 * Where the boards stand, in the machine's floor frame (its footprint centred
 * on the origin, the operator's side towards +z). The trainee starts about
 * 2.6 m in front of the machine and a little right of centre — layout.ts —
 * so each board is turned to face that spot rather than the machine.
 *
 * Boards hang from their top edge: one that grows (a longer instruction, a
 * measured part) grows towards the floor, never into the board above.
 *
 * - The mode board — tutorial, task or job — is the left column, at reading
 *   height, clear of the machine's left side and of the door it slides along.
 * - Status is the right column. The full pendant stands at the machine's
 *   right when it is open, so status rises above it rather than in front.
 * - View (size, turn, full panel) is a lectern at waist height, front left:
 *   the controls a trainee reaches for, nearest to hand.
 * - Warnings hang over the door, where the eyes go when something is refused.
 *
 * None of them is scaled with the machine: a board that shrinks with a
 * tabletop-sized machine stops being readable, and a size control that
 * shrinks with what it sizes can end up too small to press.
 */
const MODE_BOARD = { position: [-2.1, 2.15, 1.45], yaw: 0.75 } as const;
const STATUS_BOARD = { position: [2.3, 2.05, 1.45], yaw: -0.75, abovePendantY: 2.62 } as const;
const VIEW_LECTERN = { position: [-1.25, 1.08, 2.05], yaw: 0.9, tilt: -0.55 } as const;
const WARNING_BOARD = { position: [0, 2.35, 1.7] } as const;

type Placed = { position: [number, number, number]; yaw: number };

/** Turned about +Y so its face (+z) looks at the trainee's spot. */
const facing = (x: number, y: number, z: number, stand: [number, number]): Placed => ({
  position: [x, y, z],
  yaw: Math.atan2(stand[0] - x, stand[1] - z),
});

/**
 * The same boards for a trainee standing closer — AR, 1.85 m from the
 * machine's centre (layout.ts AR_STAND): the side columns come forward to
 * stay in view, the lectern to the left hand, the warning a little lower;
 * each turned to the trainee's spot.
 */
function placedFor(stand: [number, number]) {
  const z = stand[1] - 1.55;
  return {
    mode: facing(MODE_BOARD.position[0], MODE_BOARD.position[1], z, stand),
    status: facing(STATUS_BOARD.position[0], STATUS_BOARD.position[1], z, stand),
    lectern: facing(stand[0] - 1.05, VIEW_LECTERN.position[1], stand[1] - 0.3, stand),
    warning: facing(0, 2.1, stand[1] - 0.95, stand),
  };
}

/** Lowest a board comes down to beside a machine made small, m. */
const LOWEST_READING_Y = 1.25;

/**
 * A board beside a machine sized `scale` times: the same board — never
 * scaled, so it stays readable — drawn in towards the machine (or out from
 * it) in proportion, so it is not left metres away from a tabletop model.
 * It comes down with the machine too, but not below reading height; it does
 * not go up past where it hangs at full size. Its turn is unchanged: scaling
 * both it and the trainee's spot keeps the direction between them.
 */
function nearMachine(placed: Placed, scale: number): Placed {
  if (scale === 1) return placed;
  const [x, y, z] = placed.position;
  const lowest = Math.min(y, LOWEST_READING_Y);
  return { position: [x * scale, Math.min(y, Math.max(y * scale, lowest)), z * scale], yaw: placed.yaw };
}

const PLACED_FOR_THE_BAY = {
  mode: { position: [...MODE_BOARD.position], yaw: MODE_BOARD.yaw },
  status: { position: [...STATUS_BOARD.position], yaw: STATUS_BOARD.yaw },
  lectern: { position: [...VIEW_LECTERN.position], yaw: VIEW_LECTERN.yaw },
  warning: { position: [...WARNING_BOARD.position], yaw: 0 },
} as Record<"mode" | "status" | "lectern" | "warning", Placed>;

export function SceneBoards({
  gameMode,
  showView = true,
  stand,
  scale = 1,
}: {
  gameMode: GameMode;
  showView?: boolean;
  /** Where the trainee stands, in the machine's frame, when not 2.6 m out. */
  stand?: [number, number];
  /** How big the machine is drawn (AR): the boards keep their size and
   *  come in towards it, or go out, in proportion. */
  scale?: number;
}) {
  const machineScale = useSessionStore((s) => s.machineScale);
  const setMachineScale = useSessionStore((s) => s.setMachineScale);
  const turnMachine = useSessionStore((s) => s.turnMachine);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const atFullSize = stand ? placedFor(stand) : PLACED_FOR_THE_BAY;
  const placed = {
    mode: nearMachine(atFullSize.mode, scale),
    status: nearMachine(atFullSize.status, scale),
    lectern: nearMachine(atFullSize.lectern, scale),
    warning: nearMachine(atFullSize.warning, scale),
  };
  const [sx, sy, sz] = placed.status.position;

  return (
    <>
      <group position={placed.mode.position} rotation={[0, placed.mode.yaw, 0]}>
        {gameMode === "tutorial" && <TutorialTracker3D />}
        {gameMode === "task" && <TaskBoard3D />}
        {gameMode === "freeplay" && <JobBoard3D />}
      </group>

      <group position={[sx, fullPanelOpen ? STATUS_BOARD.abovePendantY : sy, sz]} rotation={[0, placed.status.yaw, 0]}>
        <StatusBoard3D />
      </group>

      {showView && (
        <group position={placed.lectern.position} rotation={[0, placed.lectern.yaw, 0]}>
          <group rotation={[VIEW_LECTERN.tilt, 0, 0]}>
            <SizePanel3D value={machineScale} onChange={setMachineScale} onTurn={turnMachine} />
          </group>
        </group>
      )}

      <group position={placed.warning.position} rotation={[0, placed.warning.yaw, 0]}>
        <WarningBoard3D />
      </group>
    </>
  );
}
