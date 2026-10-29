"use client";

import { create } from "zustand";
import { generateProgram } from "@/entities/part/cam";
import {
  SAMPLE_DESIGN,
  newFeatureId,
  type Face,
  type Feature,
  type FeatureKind,
  type PartDesign,
  type Stock,
} from "@/entities/part/part-design";

export type WorkspaceTab = "design" | "program";

type JobStore = {
  design: PartDesign;
  /** The program in the editor — generated from the design, or hand-edited. */
  program: string;
  /** Hand edits are kept until the trainee regenerates on purpose. */
  programEdited: boolean;
  camWarnings: string[];
  workspaceOpen: boolean;
  tab: WorkspaceTab;

  updateDesign: (patch: Partial<Pick<PartDesign, "name" | "programNumber">>) => void;
  updateStock: (patch: Partial<Stock>) => void;
  addFeature: (kind: FeatureKind, face: Face) => void;
  updateFeature: (id: string, patch: Partial<Feature>) => void;
  removeFeature: (id: string) => void;
  generate: () => void;
  setProgram: (text: string) => void;
  setWorkspaceOpen: (open: boolean) => void;
  setTab: (tab: WorkspaceTab) => void;
  /** Swap the whole job — a level's part, or free play's own coming back.
   *  Without a program, the CAM writes one from the design. */
  loadJob: (design: PartDesign, program?: string) => void;
};

/** A sensible first version of each feature, so "add" gives something to edit. */
function defaultFeature(kind: FeatureKind, face: Face): Feature {
  const id = newFeatureId();
  switch (kind) {
    case "face":
      return { id, kind, face, depth: 1 };
    case "pocket-rect":
      return { id, kind, face, center: [0, 0], size: [20, 14], cornerRadius: 4, depth: 5 };
    case "pocket-circle":
      return { id, kind, face, center: [0, 0], diameter: 14, depth: 5 };
    case "hole":
      return { id, kind, face, center: [0, 0], diameter: 6.8, depth: 12 };
    case "slot":
      return { id, kind, face, start: [-10, 0], end: [10, 0], width: 6, depth: 3 };
    case "contour":
      return { id, kind, face: "top", size: [70, 50], cornerRadius: 5, depth: 10 };
  }
}

const initial = generateProgram(SAMPLE_DESIGN);

export const useJobStore = create<JobStore>((set, get) => {
  /** Regenerate unless the trainee has edited the program by hand. */
  const withDesign = (design: PartDesign) => {
    if (get().programEdited) return set({ design });
    const result = generateProgram(design);
    set({ design, program: result.text, camWarnings: result.warnings });
  };

  return {
    design: SAMPLE_DESIGN,
    program: initial.text,
    programEdited: false,
    camWarnings: initial.warnings,
    workspaceOpen: false,
    tab: "design",

    updateDesign: (patch) => withDesign({ ...get().design, ...patch }),
    updateStock: (patch) => {
      const { design } = get();
      withDesign({ ...design, stock: { ...design.stock, ...patch } });
    },
    addFeature: (kind, face) => {
      const { design } = get();
      withDesign({ ...design, features: [...design.features, defaultFeature(kind, face)] });
    },
    updateFeature: (id, patch) => {
      const { design } = get();
      withDesign({
        ...design,
        features: design.features.map((f) => (f.id === id ? ({ ...f, ...patch } as Feature) : f)),
      });
    },
    removeFeature: (id) => {
      const { design } = get();
      withDesign({ ...design, features: design.features.filter((f) => f.id !== id) });
    },
    generate: () => {
      const result = generateProgram(get().design);
      set({ program: result.text, camWarnings: result.warnings, programEdited: false });
    },
    setProgram: (text) => set({ program: text, programEdited: true }),
    setWorkspaceOpen: (open) => set({ workspaceOpen: open }),
    loadJob: (design, program) => {
      const result = generateProgram(design);
      set({
        design,
        program: program ?? result.text,
        programEdited: program !== undefined,
        camWarnings: result.warnings,
      });
    },
    setTab: (tab) => set({ tab }),
  };
});
