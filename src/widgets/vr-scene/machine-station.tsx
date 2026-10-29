"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GameMode } from "@/entities/machine/machine-types";
import type { MachinePartId } from "@/entities/machine/machine-parts";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useInteraction } from "@/features/session/use-interaction";
import { useSessionStore } from "@/features/session/session-store";
import { useTutorialHighlights } from "@/features/tutorial/tutorial-store";
import { FullPendant3D } from "@/widgets/full-pendant/full-pendant-3d";
import { showToast } from "@/shared/ui/toast";
import { CncMachine } from "./cnc-machine";
import { SceneBoards } from "./scene-boards";

/** With hints on and nothing under the pointer, free play marks the controls
 *  a startup touches. */
const FREEPLAY_HINTS: MachinePartId[] = [
  "air_valve",
  "main_switch",
  "power_on",
  "estop",
  "reset",
  "power_up",
  "door",
  "hand_jog",
  "handwheel",
  "cycle_start",
];

type Props = {
  gameMode: GameMode;
  /** Boards in the scene, because the DOM side panel cannot be seen. */
  boards: boolean;
  /** The size and turn lectern: only where the machine is placed in the
   *  trainee's own room. In the workshop it stands in its bay at full size. */
  adjustable: boolean;
  /** Parts respond to pointing. Off while a desktop walker passes by: a click
   *  on the machine then means "go to it", not "press what is under the
   *  cursor". */
  interactive: boolean;
  /** Fly the desktop camera to the full panel when it opens. */
  focusPanel: boolean;
};

/**
 * One machine as a working station, in its own floor frame (footprint centred
 * on the origin, the operator's side towards +z): the machine, its full-size
 * pendant when open, and the boards that stand in for the side panel. The
 * workshop puts it in a bay; AR puts it on the trainee's floor.
 */
export function MachineStation({ gameMode, boards, adjustable, interactive, focusPanel }: Props) {
  const interactWithPart = useInteraction();
  const hoveredPart = useSessionStore((s) => s.hoveredPart);
  const hintsEnabled = useSessionStore((s) => s.hintsEnabled);
  const setHoveredPart = useSessionStore((s) => s.setHoveredPart);
  const machineScale = useSessionStore((s) => s.machineScale);
  const machineYaw = useSessionStore((s) => s.machineYaw);
  const fullPanelOpen = useSessionStore((s) => s.fullPanelOpen);
  const setFullPanelOpen = useSessionStore((s) => s.setFullPanelOpen);
  const focusNode = useSessionStore((s) => s.focusNode);
  const focusCamera = useSessionStore((s) => s.focusCamera);
  const tutorialHighlights = useTutorialHighlights();

  // Opening the full panel brings the desktop camera to it, and closing it
  // brings the camera back to the machine's own pendant.
  const panelWasOpen = useRef(fullPanelOpen);
  useEffect(() => {
    const wasOpen = panelWasOpen.current;
    panelWasOpen.current = fullPanelOpen;
    if (!focusPanel) return;
    if (fullPanelOpen) focusNode("FullPanel_View");
    else if (wasOpen) focusCamera("screen");
  }, [fullPanelOpen, focusPanel, focusNode, focusCamera]);

  const highlightedParts = useMemo(() => {
    if (gameMode === "tutorial") return tutorialHighlights;
    if (!hintsEnabled) return [];
    return hoveredPart ? [hoveredPart] : FREEPLAY_HINTS;
  }, [gameMode, hintsEnabled, hoveredPart, tutorialHighlights]);

  const scale = adjustable ? machineScale : 1;
  const yaw = adjustable ? machineYaw : 0;

  return (
    <>
      <group scale={scale}>
        {/* Only the machine turns: the boards stay where the user is. */}
        <group rotation={[0, yaw, 0]}>
          <CncMachine
            interactive={interactive}
            highlightedParts={highlightedParts}
            hoveredPart={hoveredPart}
            onPartInteract={interactWithPart}
            onHoverPart={setHoveredPart}
          />
        </group>
      </group>

      {/* The full-size pendant stands to the right of the machine, turned
          towards the operator. Unscaled: it is read, not inspected. */}
      {fullPanelOpen && (
        <group position={[2.05, 1.32, 1.3]} rotation={[0, -0.55, 0]}>
          <FullPendant3D
            onPartInteract={interactWithPart}
            onKey={(id, shift) => {
              const { rejected, notice } = useMachineStore.getState().pressKey(id, shift);
              const message = rejected ?? notice;
              if (message) showToast(message, rejected ? "warning" : "info");
            }}
            onUnhandledKey={(label) => showToast(`${label}: not simulated yet.`, "info")}
            onClose={() => setFullPanelOpen(false)}
          />
        </group>
      )}

      {/* Outside the scaled group: a board that shrinks with the machine stops
          being readable, and a safety warning that shrinks stops being one. */}
      {boards && <SceneBoards gameMode={gameMode} showView={adjustable} />}
    </>
  );
}
