import { Sun, Wind, Cloud, Gauge, RotateCcw } from "lucide-react";
import { useParamsStore } from "@/store/renderParams";
import { usePresetStore } from "@/store/preset";
import { DEFAULT_RENDER_PARAMS } from "@/render/constants";
import { CollapsibleSection } from "./CollapsibleSection";
import { ParamSlider } from "./ParamSlider";
import { cn } from "@/lib/utils";

export function ControlPanel({ accent }: { accent: string }) {
  const params = useParamsStore((s) => s.params);
  const setParams = useParamsStore((s) => s.setParams);
  const reset = useParamsStore((s) => s.reset);
  const activeId = usePresetStore((s) => s.activePresetId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide text-cloud">参数调节</h2>
          <p className="text-[10px] text-cloud-dim/70 font-mono mt-0.5">实时影响渲染结果</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-cloud-dim transition-colors hover:bg-white/5 hover:text-cloud"
          title="重置所有参数"
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {/* Sun */}
        <CollapsibleSection id="sun" title="太阳控制" icon={<Sun size={14} />} accent={accent}>
          <ParamSlider paramKey="sunAzimuth" label="方位角" value={params.sunAzimuth} accent={accent} />
          <ParamSlider paramKey="sunElevation" label="仰角" value={params.sunElevation} accent={accent} />
          <ParamSlider paramKey="sunIntensity" label="光照强度" value={params.sunIntensity} accent={accent} />

          <ToggleRow
            label="色温覆盖"
            checked={params.colorTempOverride}
            onChange={(v) => setParams({ colorTempOverride: v })}
            accent={accent}
          />
          {params.colorTempOverride && (
            <ParamSlider paramKey="colorTemp" label="色温" value={params.colorTemp} accent={accent} />
          )}
        </CollapsibleSection>

        {/* Atmosphere */}
        <CollapsibleSection id="atmosphere" title="大气参数" icon={<Wind size={14} />} accent={accent} defaultOpen={false}>
          <RayleighGroup value={params.rayleighCoeff} onChange={(v) => setParams({ rayleighCoeff: v })} accent={accent} />
          <ParamSlider paramKey="mieCoeff" label="Mie 系数" value={params.mieCoeff} accent={accent} />
          <ParamSlider paramKey="mieG" label="Mie 各向异性 g" value={params.mieG} accent={accent} />
          <ParamSlider paramKey="rayleighScaleHeight" label="Rayleigh 标高" value={params.rayleighScaleHeight} accent={accent} />
          <ParamSlider paramKey="mieScaleHeight" label="Mie 标高" value={params.mieScaleHeight} accent={accent} />
          <ParamSlider paramKey="visibility" label="能见度" value={params.visibility} accent={accent} />
          <ParamSlider paramKey="cloudShadowStrength" label="云阴影强度" value={params.cloudShadowStrength} accent={accent} />
        </CollapsibleSection>

        {/* Clouds */}
        <CollapsibleSection id="clouds" title="云层参数" icon={<Cloud size={14} />} accent={accent}>
          <ParamSlider paramKey="coverage" label="覆盖率" value={params.coverage} accent={accent} />
          <ParamSlider paramKey="cloudBase" label="云底高度" value={params.cloudBase} accent={accent} />
          <ParamSlider paramKey="cloudThickness" label="云层厚度" value={params.cloudThickness} accent={accent} />
          <ParamSlider paramKey="noiseFrequency" label="噪声频率" value={params.noiseFrequency} accent={accent} />
          <ParamSlider paramKey="detailStrength" label="细节强度" value={params.detailStrength} accent={accent} />
          <ParamSlider paramKey="windSpeed" label="风速" value={params.windSpeed} accent={accent} />
          <ParamSlider paramKey="windDirection" label="风向" value={params.windDirection} accent={accent} />
        </CollapsibleSection>

        {/* Quality */}
        <CollapsibleSection id="quality" title="渲染质量" icon={<Gauge size={14} />} accent={accent} defaultOpen={false}>
          <ParamSlider paramKey="atmosphereSteps" label="大气步数" value={params.atmosphereSteps} accent={accent} />
          <ParamSlider paramKey="cloudSteps" label="云步数" value={params.cloudSteps} accent={accent} />
          <ParamSlider paramKey="resolutionScale" label="分辨率缩放" value={params.resolutionScale} accent={accent} />
          <QualityHint steps={params.atmosphereSteps} scale={params.resolutionScale} />
        </CollapsibleSection>
      </div>

      <div className="border-t border-white/[0.05] px-4 py-2.5">
        <p className="text-[10px] text-cloud-dim/60 font-mono">
          当前预设: <span style={{ color: accent }}>{activeId}</span>
        </p>
      </div>
    </div>
  );
}

function QualityHint({ steps, scale }: { steps: number; scale: number }) {
  const perf = steps >= 48 ? "高" : steps >= 24 ? "中" : "低";
  const res = scale >= 0.9 ? "100%" : `${Math.round(scale * 100)}%`;
  return (
    <div className="flex gap-2 pt-1">
      <span className="chip glass-soft text-cloud-dim">质量{perf}</span>
      <span className="chip glass-soft text-cloud-dim">渲染{res}</span>
    </div>
  );
}

function RayleighGroup({
  value,
  onChange,
  accent,
}: {
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  accent: string;
}) {
  const channels: { label: string; color: string; idx: number }[] = [
    { label: "R 红光", color: "#ff5e5e", idx: 0 },
    { label: "G 绿光", color: "#5eff8a", idx: 1 },
    { label: "B 蓝光", color: "#5e9bff", idx: 2 },
  ];
  return (
    <div className="space-y-3 rounded-lg bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-cloud-dim">Rayleigh 散射系数</span>
        <span className="font-mono text-[10px] text-cloud-dim/60">1/λ⁴</span>
      </div>
      {channels.map((c) => {
        const meta = { min: 0, max: 8e-5, step: 0.5e-6 };
        const pct = ((value[c.idx] - meta.min) / (meta.max - meta.min)) * 100;
        return (
          <div key={c.label} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px]" style={{ color: c.color }}>{c.label}</span>
              <span className="font-mono text-[10px] text-cloud-dim">{value[c.idx].toExponential(2)}</span>
            </div>
            <input
              type="range"
              className="cloud-slider"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={value[c.idx]}
              onChange={(e) => {
                const next = [...value] as [number, number, number];
                next[c.idx] = parseFloat(e.target.value);
                onChange(next);
              }}
              style={{
                background: `linear-gradient(to right, ${c.color}cc 0%, ${c.color}55 ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  accent,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-cloud-dim">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn("toggle-track relative h-5 w-9 rounded-full", checked ? "" : "bg-white/10")}
        style={checked ? { background: accent } : undefined}
      >
        <span
          className={cn("toggle-knob absolute top-0.5 h-4 w-4 rounded-full bg-white shadow", checked ? "left-[18px]" : "left-0.5")}
        />
      </button>
    </div>
  );
}
