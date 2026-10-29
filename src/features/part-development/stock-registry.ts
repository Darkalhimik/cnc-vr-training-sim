"use client";

import { create } from "zustand";
import type { StockRemoval } from "./removal";

/**
 * The solid being cut, for what lives outside the scene — the panel's STL
 * export. The scene's runtime registers it while the stock is in the vise.
 */
export const useStockRegistry = create<{
  removal: StockRemoval | null;
  setRemoval: (removal: StockRemoval | null) => void;
}>((set) => ({ removal: null, setRemoval: (removal) => set({ removal }) }));
