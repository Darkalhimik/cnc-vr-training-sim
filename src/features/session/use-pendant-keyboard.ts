"use client";

import { useEffect } from "react";
import { useMachineStore } from "@/entities/machine/machine-store";
import { useProgramEditor } from "@/widgets/gcode-editor";
import { showToast } from "@/shared/lib/notifications";
import { useSessionStore } from "./session-store";

/** Characters typed on a computer keyboard → NGC key ids (shifted second). */
const TYPED: Record<string, [string, boolean?]> = {
  "-": ["MINUS"],
  "+": ["MINUS", true],
  ".": ["DOT"],
  "#": ["DOT", true],
  ";": ["EOB"],
  "/": ["EOB", true],
  "(": ["PAREN_OPEN"],
  "[": ["PAREN_OPEN", true],
  ")": ["PAREN_CLOSE"],
  "]": ["PAREN_CLOSE", true],
  "=": ["NUM_0", true],
  "*": ["NUM_1", true],
  " ": ["SPACE"],
};

const NAMED: Record<string, string> = {
  Enter: "ENTER",
  Backspace: "CANCEL",
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  PageUp: "PAGE_UP",
  PageDown: "PAGE_DOWN",
  F1: "F1",
  F4: "F4",
};

function keyFor(event: KeyboardEvent): [string, boolean] | null {
  const { key } = event;
  if (/^[a-z]$/i.test(key)) return [`ALPHA_${key.toUpperCase()}`, false];
  if (/^[0-9]$/.test(key)) return [`NUM_${key}`, false];
  const typed = TYPED[key];
  if (typed) return [typed[0], typed[1] ?? false];
  const named = NAMED[key];
  return named ? [named, false] : null;
}

/**
 * With the full panel open on a desktop, the computer keyboard types into the
 * NGC's input line the way the pendant's keys do — G00 X0 Y0 is fourteen
 * clicks otherwise. Enter is the control's ENTER (which in MDI inserts the
 * block), Backspace its CANCEL. Anything typed into a text field, or while the
 * program editor is open, is left alone.
 */
export function usePendantKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (!useSessionStore.getState().fullPanelOpen || useProgramEditor.getState().isOpen) return;
      const target = event.target as HTMLElement | null;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true], .cm-editor")) return;
      const mapped = keyFor(event);
      if (!mapped) return;
      event.preventDefault();
      const { rejected } = useMachineStore.getState().pressKey(mapped[0], mapped[1]);
      if (rejected) showToast(rejected, "warning");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
