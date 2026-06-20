import { PARAM_META } from "@/render/constants";
import { useParamsStore } from "@/store/renderParams";
import { cn } from "@/lib/utils";

interface ParamSliderProps {
  paramKey: string;
  label: string;
  value: number;
  accent?: string;
  className?: string;
  disabled?: boolean;
}

export function ParamSlider({ paramKey, label, value, accent, className, disabled = false }: ParamSliderProps) {
  const meta = PARAM_META[paramKey];
  const setParams = useParamsStore((s) => s.setParams);

  const pct = meta ? ((value - meta.min) / (meta.max - meta.min)) * 100 : 50;
  const accentColor = accent ?? "#4fc3f7";
  const display = meta ? formatDisplay(value, meta.step) : String(value);

  return (
    <div className={cn("space-y-1.5", className, disabled && "opacity-50 pointer-events-none")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-cloud-dim">{label}</span>
        <span className="font-mono text-[11px] text-cloud tabular-nums">
          {display}
          <span className="text-cloud-dim/70 ml-0.5">{meta?.unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="cloud-slider"
        min={meta?.min ?? 0}
        max={meta?.max ?? 1}
        step={meta?.step ?? 0.01}
        value={value}
        onChange={(e) => setParams({ [paramKey]: parseFloat(e.target.value) } as never)}
        disabled={disabled}
        style={{
          background: `linear-gradient(to right, ${accentColor}cc 0%, ${accentColor}55 ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
        }}
      />
    </div>
  );
}

function formatDisplay(v: number, step: number): string {
  if (step >= 1) return Math.round(v).toString();
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(4);
}
