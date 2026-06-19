import { useStatsStore } from "@/store/stats";
import { formatTime } from "@/utils/math";

export function StatsOverlay() {
  const stats = useStatsStore();
  const fpsColor = stats.fps >= 55 ? "#5eff8a" : stats.fps >= 30 ? "#ffd54f" : "#ff5e5e";

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-1.5 font-mono">
      <div className="glass rounded-lg px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-cloud-dim">FPS</span>
          <span className="text-xl font-semibold tabular-nums" style={{ color: fpsColor }}>
            {stats.fps}
          </span>
        </div>
      </div>
      <div className="glass-soft rounded-lg px-3 py-1.5 text-[10px] text-cloud-dim space-y-0.5">
        <Row label="分辨率" value={`${stats.resolution[0]}×${stats.resolution[1]}`} />
        <Row label="云层" value={formatTime(stats.cloudMs)} />
        <Row label="大气" value={formatTime(stats.atmosphereMs)} />
        <Row label="合成" value={formatTime(stats.compositeMs)} />
        <Row label="总帧" value={formatTime(stats.frameMs)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-28 items-center justify-between gap-3">
      <span className="opacity-70">{label}</span>
      <span className="text-cloud tabular-nums">{value}</span>
    </div>
  );
}
