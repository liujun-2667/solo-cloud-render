import { usePresetStore } from "@/store/preset";
import { PRESETS } from "@/presets/presets";
import { cn } from "@/lib/utils";

export function PresetBar({ accent }: { accent: string }) {
  const activeId = usePresetStore((s) => s.activePresetId);
  const setActive = usePresetStore((s) => s.setActivePreset);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-1">
      {PRESETS.map((preset) => {
        const active = preset.id === activeId;
        return (
          <button
            key={preset.id}
            onClick={() => setActive(preset.id, true)}
            title={preset.description}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-300",
              active
                ? "border-white/20 bg-white/[0.08] shadow-glow"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10",
            )}
            style={active ? { boxShadow: `0 0 20px -6px ${preset.accent}80`, borderColor: `${preset.accent}66` } : undefined}
          >
            <span
              className="h-6 w-6 rounded-md transition-transform duration-300 group-hover:scale-110"
              style={{
                background: `linear-gradient(135deg, ${preset.accent}, ${preset.accent}55)`,
                boxShadow: active ? `0 0 12px ${preset.accent}99` : `inset 0 0 0 1px rgba(255,255,255,0.1)`,
              }}
            />
            <div className="flex flex-col items-start leading-tight pr-1">
              <span
                className={cn("text-[12px] font-medium transition-colors", active ? "text-cloud" : "text-cloud-dim group-hover:text-cloud")}
              >
                {preset.name}
              </span>
            </div>
            {active && (
              <span
                className="ml-0.5 h-1.5 w-1.5 rounded-full animate-pulse-soft"
                style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
