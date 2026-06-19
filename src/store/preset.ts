import { create } from "zustand";
import type { Preset } from "@/types";
import { PRESETS, DEFAULT_PRESET_ID, getPresetById } from "@/presets/presets";
import { useParamsStore } from "./renderParams";
import { useCameraStore } from "./camera";

interface PresetStoreState {
  activePresetId: string;
  recording: boolean;
  setActivePreset: (id: string, animate?: boolean) => void;
  setRecording: (v: boolean) => void;
  matchActivePreset: () => void;
}

function applyPreset(preset: Preset, animate: boolean) {
  const paramStore = useParamsStore.getState();
  const cameraStore = useCameraStore.getState();
  if (animate) {
    paramStore.beginTransition(preset.params);
    cameraStore.beginTransition(preset.camera);
  } else {
    paramStore.setParams(preset.params);
    cameraStore.setCamera(preset.camera);
  }
}

export const usePresetStore = create<PresetStoreState>((set, get) => ({
  activePresetId: DEFAULT_PRESET_ID,
  recording: false,

  setActivePreset: (id, animate = true) => {
    const preset = getPresetById(id);
    if (!preset) return;
    applyPreset(preset, animate);
    set({ activePresetId: id });
  },

  setRecording: (v) => set({ recording: v }),

  matchActivePreset: () => {
    const params = useParamsStore.getState().params;
    let best = DEFAULT_PRESET_ID;
    let bestDist = Infinity;
    for (const preset of PRESETS) {
      const d =
        Math.abs(preset.params.sunElevation ?? 0 - params.sunElevation) +
        Math.abs((preset.params.coverage ?? 0) - params.coverage) * 50;
      if (d < bestDist) {
        bestDist = d;
        best = preset.id;
      }
    }
    set({ activePresetId: best });
  },
}));
