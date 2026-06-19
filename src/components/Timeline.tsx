import { useRef, useState, useEffect } from "react";
import { Play, Pause, Plus, Trash2, Gauge } from "lucide-react";
import { useTimelineStore, PLAYBACK_SPEEDS } from "@/store/timeline";
import { useParamsStore } from "@/store/renderParams";
import { cn } from "@/lib/utils";

interface TimelineProps {
  accent: string;
}

export function Timeline({ accent }: TimelineProps) {
  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const playbackSpeedIndex = useTimelineStore((s) => s.playbackSpeedIndex);
  const keyframes = useTimelineStore((s) => s.keyframes);
  const useWeatherPreset = useTimelineStore((s) => s.useWeatherPreset);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const togglePlaying = useTimelineStore((s) => s.togglePlaying);
  const cyclePlaybackSpeed = useTimelineStore((s) => s.cyclePlaybackSpeed);
  const addKeyframe = useTimelineStore((s) => s.addKeyframe);
  const removeKeyframe = useTimelineStore((s) => s.removeKeyframe);
  const setUseWeatherPreset = useTimelineStore((s) => s.setUseWeatherPreset);

  const params = useParamsStore((s) => s.params);

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const time = pct * 24;
    setCurrentTime(time);
  };

  const handleTrackDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const time = pct * 24;
    addKeyframe(time, params);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      setCurrentTime(pct * 24);
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, setCurrentTime]);

  const handleAddKeyframe = () => {
    addKeyframe(currentTime, params);
  };

  const handleKeyframeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedKeyframe(selectedKeyframe === id ? null : id);
  };

  const handleDeleteKeyframe = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeKeyframe(id);
    if (selectedKeyframe === id) setSelectedKeyframe(null);
  };

  const timePct = (currentTime / 24) * 100;
  const speedLabel = `${PLAYBACK_SPEEDS[playbackSpeedIndex]}x`;

  return (
    <div className="glass rounded-xl px-4 py-3 shadow-panel">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge size={14} style={{ color: accent }} />
          <span className="text-[11px] font-mono text-cloud">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-cloud-dim/60">天气模拟</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setUseWeatherPreset(!useWeatherPreset)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md transition-colors",
              useWeatherPreset
                ? "text-cloud"
                : "text-cloud-dim/60 hover:text-cloud",
            )}
            style={useWeatherPreset ? { background: `${accent}22`, color: accent } : {}}
            title="使用预设天气曲线"
          >
            天气预设
          </button>
          <div className="w-px h-3 bg-white/10" />
          <button
            onClick={togglePlaying}
            className="icon-btn"
            title={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={cyclePlaybackSpeed}
            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-cloud hover:bg-white/[0.1] transition-colors"
            title="播放速度"
          >
            {speedLabel}
          </button>
          <button
            onClick={handleAddKeyframe}
            className="icon-btn"
            title="添加关键帧"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-8 cursor-pointer group"
        onClick={handleTrackClick}
        onMouseDown={() => setDragging(true)}
        onDoubleClick={handleTrackDoubleClick}
      >
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-colors"
            style={{ width: `${timePct}%`, background: accent }}
          />
        </div>

        <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
          {[0, 6, 12, 18, 24].map((h) => (
            <div
              key={h}
              className="absolute top-0 bottom-0 w-px bg-white/10"
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
        </div>

        {keyframes.map((kf) => {
          const leftPct = (kf.time / 24) * 100;
          const isSelected = selectedKeyframe === kf.id;
          return (
            <div
              key={kf.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer z-10"
              style={{ left: `${leftPct}%` }}
              onClick={(e) => handleKeyframeClick(e, kf.id)}
            >
              <div
                className={cn(
                  "w-3 h-3 rotate-45 transition-all",
                  isSelected ? "scale-125" : "hover:scale-110",
                )}
                style={{
                  background: accent,
                  boxShadow: isSelected ? `0 0 8px ${accent}` : "none",
                }}
              />
              {isSelected && (
                <button
                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-red-400 hover:text-red-300"
                  onClick={(e) => handleDeleteKeyframe(e, kf.id)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20"
          style={{ left: `${timePct}%` }}
        >
          <div
            className="w-4 h-4 rounded-full bg-white shadow-lg"
            style={{ boxShadow: `0 0 10px ${accent}80` }}
          />
        </div>
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-cloud-dim/40">00:00</span>
        <span className="text-[9px] font-mono text-cloud-dim/40">06:00</span>
        <span className="text-[9px] font-mono text-cloud-dim/40">12:00</span>
        <span className="text-[9px] font-mono text-cloud-dim/40">18:00</span>
        <span className="text-[9px] font-mono text-cloud-dim/40">24:00</span>
      </div>
    </div>
  );
}
