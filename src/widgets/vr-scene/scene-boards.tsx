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

export function SceneBoards({ gameMode, showView = true }: { gameMode: GameMode; showView?: boolean }) {
  const machineScale = useSessionStore((s) => s.machineScale);
  const setMachineScale = useSessionStore((s) => s.setMachineScale);
  const turnMachine = useSessionStore((s) => s.turnMachine);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const [sx, sy, sz] = STATUS_BOARD.position;

  return (
    <>
      <group position={[...MODE_BOARD.position]} rotation={[0, MODE_BOARD.yaw, 0]}>
        {gameMode === "tutorial" && <TutorialTracker3D />}
        {gameMode === "task" && <TaskBoard3D />}
        {gameMode === "freeplay" && <JobBoard3D />}
      </group>

      <group position={[sx, fullPanelOpen ? STATUS_BOARD.abovePendantY : sy, sz]} rotation={[0, STATUS_BOARD.yaw, 0]}>
        <StatusBoard3D />
      </group>

      {showView && (
        <group position={[...VIEW_LECTERN.position]} rotation={[0, VIEW_LECTERN.yaw, 0]}>
          <group rotation={[VIEW_LECTERN.tilt, 0, 0]}>
            <SizePanel3D value={machineScale} onChange={setMachineScale} onTurn={turnMachine} />
          </group>
        </group>
      )}

      <group position={[...WARNING_BOARD.position]}>
        <WarningBoard3D />
      </group>
    </>
  );
}
