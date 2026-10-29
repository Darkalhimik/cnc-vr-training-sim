"use client";

import { create } from "zustand";
import type { CheckAgainst } from "@/features/part-development/program-check";

/**
 * Whether the full-screen editor is open, and the choices both editor views
 * share. The program text itself is not here: it lives in the job store, so
 * the compact tab and the full-screen editor can never disagree about it.
 */
type ProgramEditorStore = {
  isOpen: boolean;
  /** What the live check assumes: the probed setup, or the machine as it is. */
  against: CheckAgainst;
  /** A program from control memory shown read-only instead of the job's;
   *  null shows the job program. */
  viewing: string | null;

  open: () => void;
  close: () => void;
  setAgainst: (against: CheckAgainst) => void;
  view: (name: string | null) => void;
};

export const useProgramEditor = create<ProgramEditorStore>((set) => ({
  isOpen: false,
  against: "ideal",
  viewing: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, viewing: null }),
  setAgainst: (against) => set({ against }),
  view: (viewing) => set({ viewing }),
}));
