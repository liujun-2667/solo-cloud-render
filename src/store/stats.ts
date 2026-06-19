import { create } from "zustand";
import type { RenderStats } from "@/types";

interface StatsStoreState extends RenderStats {
  setStats: (stats: Partial<RenderStats>) => void;
  reset: () => void;
}

const EMPTY_STATS: RenderStats = {
  fps: 0,
  frameMs: 0,
  cloudMs: 0,
  atmosphereMs: 0,
  compositeMs: 0,
  resolution: [0, 0],
};

export const useStatsStore = create<StatsStoreState>((set) => ({
  ...EMPTY_STATS,
  setStats: (stats) => set((s) => ({ ...s, ...stats })),
  reset: () => set({ ...EMPTY_STATS }),
}));
