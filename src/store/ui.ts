import { create } from "zustand";

interface UIStoreState {
  panelOpen: boolean;
  collapsedGroups: Record<string, boolean>;
  showStats: boolean;
  showGrid: boolean;
  togglePanel: () => void;
  setPanelOpen: (v: boolean) => void;
  toggleGroup: (id: string) => void;
  setGroupOpen: (id: string, open: boolean) => void;
  setShowStats: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  panelOpen: true,
  collapsedGroups: {},
  showStats: true,
  showGrid: false,
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (v) => set({ panelOpen: v }),
  toggleGroup: (id) =>
    set((s) => ({ collapsedGroups: { ...s.collapsedGroups, [id]: !s.collapsedGroups[id] } })),
  setGroupOpen: (id, open) =>
    set((s) => ({ collapsedGroups: { ...s.collapsedGroups, [id]: !open } })),
  setShowStats: (v) => set({ showStats: v }),
  setShowGrid: (v) => set({ showGrid: v }),
}));
