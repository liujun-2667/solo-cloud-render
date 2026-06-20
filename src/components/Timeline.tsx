import { useRef, useState, useEffect } from "react";
import { Play, Pause, Plus, Trash2, Gauge, CloudRain, Snowflake, Sun, Lock, Unlock, Settings } from "lucide-react";
import { useTimelineStore, PLAYBACK_SPEEDS, getWeatherTypeColor } from "@/store/timeline";
import { useParamsStore } from "@/store/renderParams";
import { cn } from "@/lib/utils";
import type { WeatherType, RainIntensity } from "@/types";

interface TimelineProps {
  accent: string;
}

export function Timeline({ accent }: TimelineProps) {
  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const playbackSpeedIndex = useTimelineStore((s) => s.playbackSpeedIndex);
  const keyframes = useTimelineStore((s) => s.keyframes);
  const useWeatherPreset = useTimelineStore((s) => s.useWeatherPreset);
  const weatherKeyframes = useTimelineStore((s) => s.weatherKeyframes);
  const useWeatherKeyframes = useTimelineStore((s) => s.useWeatherKeyframes);
  const weatherTransitionDuration = useTimelineStore((s) => s.weatherTransitionDuration);
  const weatherLocked = useTimelineStore((s) => s.weatherLocked);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const togglePlaying = useTimelineStore((s) => s.togglePlaying);
  const cyclePlaybackSpeed = useTimelineStore((s) => s.cyclePlaybackSpeed);
  const addKeyframe = useTimelineStore((s) => s.addKeyframe);
  const removeKeyframe = useTimelineStore((s) => s.removeKeyframe);
  const setUseWeatherPreset = useTimelineStore((s) => s.setUseWeatherPreset);
  const addWeatherKeyframe = useTimelineStore((s) => s.addWeatherKeyframe);
  const removeWeatherKeyframe = useTimelineStore((s) => s.removeWeatherKeyframe);
  const updateWeatherKeyframe = useTimelineStore((s) => s.updateWeatherKeyframe);
  const moveWeatherKeyframe = useTimelineStore((s) => s.moveWeatherKeyframe);
  const setUseWeatherKeyframes = useTimelineStore((s) => s.setUseWeatherKeyframes);
  const setWeatherTransitionDuration = useTimelineStore((s) => s.setWeatherTransitionDuration);
  const setWeatherLocked = useTimelineStore((s) => s.setWeatherLocked);

  const params = useParamsStore((s) => s.params);

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [selectedWeatherKeyframe, setSelectedWeatherKeyframe] = useState<string | null>(null);
  const [draggingWeatherKeyframe, setDraggingWeatherKeyframe] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const getTimeFromX = (clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return pct * 24;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingWeatherKeyframe) return;
    const time = getTimeFromX(e.clientX);
    setCurrentTime(time);
  };

  const handleTrackDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromX(e.clientX);
    addWeatherKeyframe(time);
  };

  useEffect(() => {
    if (!dragging && !draggingWeatherKeyframe) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingWeatherKeyframe) {
        const time = getTimeFromX(e.clientX);
        moveWeatherKeyframe(draggingWeatherKeyframe, time);
      } else if (dragging) {
        const time = getTimeFromX(e.clientX);
        setCurrentTime(time);
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setDraggingWeatherKeyframe(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, draggingWeatherKeyframe, setCurrentTime, moveWeatherKeyframe]);

  const handleAddWeatherKeyframe = () => {
    addWeatherKeyframe(currentTime);
  };

  const handleKeyframeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedKeyframe(selectedKeyframe === id ? null : id);
    setSelectedWeatherKeyframe(null);
  };

  const handleWeatherKeyframeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedWeatherKeyframe(selectedWeatherKeyframe === id ? null : id);
    setSelectedKeyframe(null);
  };

  const handleWeatherKeyframeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingWeatherKeyframe(id);
    setSelectedWeatherKeyframe(id);
  };

  const handleDeleteKeyframe = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeKeyframe(id);
    if (selectedKeyframe === id) setSelectedKeyframe(null);
  };

  const handleDeleteWeatherKeyframe = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeWeatherKeyframe(id);
    if (selectedWeatherKeyframe === id) setSelectedWeatherKeyframe(null);
  };

  const timePct = (currentTime / 24) * 100;
  const speedLabel = `${PLAYBACK_SPEEDS[playbackSpeedIndex]}x`;

  const selectedWeatherKf = weatherKeyframes.find((k) => k.id === selectedWeatherKeyframe);

  const getWeatherIcon = (type: WeatherType) => {
    switch (type) {
      case "clear": return <Sun size={10} />;
      case "rain": return <CloudRain size={10} />;
      case "snow": return <Snowflake size={10} />;
    }
  };

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
            onClick={() => setWeatherLocked(!weatherLocked)}
            className={cn(
              "icon-btn",
              weatherLocked ? "text-amber-400" : "text-cloud-dim/60 hover:text-cloud",
            )}
            title={weatherLocked ? "天气已锁定" : "锁定天气"}
          >
            {weatherLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "icon-btn",
              showSettings ? "text-cloud" : "text-cloud-dim/60 hover:text-cloud",
            )}
            title="天气设置"
          >
            <Settings size={14} />
          </button>

          <div className="w-px h-3 bg-white/10" />

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

          <button
            onClick={() => setUseWeatherKeyframes(!useWeatherKeyframes)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md transition-colors",
              useWeatherKeyframes
                ? "text-cloud"
                : "text-cloud-dim/60 hover:text-cloud",
            )}
            style={useWeatherKeyframes ? { background: `${accent}22`, color: accent } : {}}
            title="使用天气关键帧"
          >
            关键帧
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
            onClick={handleAddWeatherKeyframe}
            className="icon-btn"
            title="添加天气关键帧"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 p-3 rounded-lg bg-white/[0.03] space-y-3">
          <div className="text-[11px] font-medium text-cloud mb-2">天气过渡设置</div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-cloud-dim w-16">过渡时长</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={weatherTransitionDuration}
              onChange={(e) => setWeatherTransitionDuration(parseFloat(e.target.value))}
              className="flex-1 cloud-slider"
              style={{
                background: `linear-gradient(to right, ${accent}cc 0%, ${accent}55 ${((weatherTransitionDuration - 0.5) / 9.5) * 100}%, rgba(255,255,255,0.08) ${((weatherTransitionDuration - 0.5) / 9.5) * 100}%, rgba(255,255,255,0.08) 100%)`,
              }}
            />
            <span className="text-[10px] font-mono text-cloud-dim w-10 text-right">
              {weatherTransitionDuration.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {selectedWeatherKf && (
        <div className="mb-3 p-3 rounded-lg bg-white/[0.03] space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-cloud">天气关键帧属性</span>
            <button
              onClick={(e) => handleDeleteWeatherKeyframe(e, selectedWeatherKf.id)}
              className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1"
            >
              <Trash2 size={12} />
              删除
            </button>
          </div>

          <div className="text-[10px] text-cloud-dim">
            时间: {formatTime(selectedWeatherKf.time)}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-cloud-dim">天气类型</div>
            <div className="grid grid-cols-3 gap-1">
              {(["clear", "rain", "snow"] as WeatherType[]).map((type) => {
                const active = selectedWeatherKf.weatherType === type;
                const labels = { clear: "晴", rain: "雨", snow: "雪" };
                const icons = { clear: <Sun size={10} />, rain: <CloudRain size={10} />, snow: <Snowflake size={10} /> };
                return (
                  <button
                    key={type}
                    onClick={() => updateWeatherKeyframe(selectedWeatherKf.id, { weatherType: type })}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] transition-all",
                      active ? "text-white" : "text-cloud-dim hover:text-cloud hover:bg-white/5",
                    )}
                    style={active ? { background: getWeatherTypeColor(type) } : undefined}
                  >
                    {icons[type]}
                    <span>{labels[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedWeatherKf.weatherType === "rain" && (
            <div className="space-y-1">
              <div className="text-[10px] text-cloud-dim">雨量等级</div>
              <div className="grid grid-cols-4 gap-1">
                {(["light", "moderate", "heavy", "storm"] as RainIntensity[]).map((intensity) => {
                  const active = selectedWeatherKf.rainIntensity === intensity;
                  const labels = { light: "小雨", moderate: "中雨", heavy: "大雨", storm: "暴雨" };
                  return (
                    <button
                      key={intensity}
                      onClick={() => updateWeatherKeyframe(selectedWeatherKf.id, { rainIntensity: intensity })}
                      className={cn(
                        "rounded-md py-1 text-[9px] transition-all",
                        active ? "text-white" : "text-cloud-dim hover:text-cloud hover:bg-white/5",
                      )}
                      style={active ? { background: accent } : undefined}
                    >
                      {labels[intensity]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cloud-dim">粒子密度倍率</span>
              <span className="text-[10px] font-mono text-cloud-dim">
                {selectedWeatherKf.particleDensityMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={selectedWeatherKf.particleDensityMultiplier}
              onChange={(e) => updateWeatherKeyframe(selectedWeatherKf.id, {
                particleDensityMultiplier: parseFloat(e.target.value),
              })}
              className="w-full cloud-slider"
              style={{
                background: `linear-gradient(to right, ${accent}cc 0%, ${accent}55 ${((selectedWeatherKf.particleDensityMultiplier - 0.1) / 2.9) * 100}%, rgba(255,255,255,0.08) ${((selectedWeatherKf.particleDensityMultiplier - 0.1) / 2.9) * 100}%, rgba(255,255,255,0.08) 100%)`,
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cloud-dim">风影响系数</span>
              <span className="text-[10px] font-mono text-cloud-dim">
                {selectedWeatherKf.windParticleInfluence.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={selectedWeatherKf.windParticleInfluence}
              onChange={(e) => updateWeatherKeyframe(selectedWeatherKf.id, {
                windParticleInfluence: parseFloat(e.target.value),
              })}
              className="w-full cloud-slider"
              style={{
                background: `linear-gradient(to right, ${accent}cc 0%, ${accent}55 ${(selectedWeatherKf.windParticleInfluence / 2) * 100}%, rgba(255,255,255,0.08) ${(selectedWeatherKf.windParticleInfluence / 2) * 100}%, rgba(255,255,255,0.08) 100%)`,
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer group"
        onClick={handleTrackClick}
        onMouseDown={(e) => {
          if (!draggingWeatherKeyframe) setDragging(true);
        }}
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
                  "w-2.5 h-2.5 rotate-45 transition-all",
                  isSelected ? "scale-125" : "hover:scale-110",
                )}
                style={{
                  background: accent,
                  boxShadow: isSelected ? `0 0 6px ${accent}` : "none",
                }}
              />
              {isSelected && (
                <button
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-red-400 hover:text-red-300"
                  onClick={(e) => handleDeleteKeyframe(e, kf.id)}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}

        {weatherKeyframes.map((kf) => {
          const leftPct = (kf.time / 24) * 100;
          const isSelected = selectedWeatherKeyframe === kf.id;
          const color = getWeatherTypeColor(kf.weatherType);
          return (
            <div
              key={kf.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab z-20 active:cursor-grabbing"
              style={{ left: `${leftPct}%` }}
              onClick={(e) => handleWeatherKeyframeClick(e, kf.id)}
              onMouseDown={(e) => handleWeatherKeyframeMouseDown(e, kf.id)}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                  isSelected ? "scale-125" : "hover:scale-110",
                )}
                style={{
                  background: color,
                  boxShadow: isSelected ? `0 0 10px ${color}` : `0 0 4px ${color}80`,
                  color: kf.weatherType === "snow" ? "#334155" : "#fff",
                }}
              >
                {getWeatherIcon(kf.weatherType)}
              </div>
            </div>
          );
        })}

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-30"
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

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" style={{ boxShadow: "0 0 4px #fbbf2480" }} />
          <span className="text-[9px] text-cloud-dim/60">晴天</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" style={{ boxShadow: "0 0 4px #3b82f680" }} />
          <span className="text-[9px] text-cloud-dim/60">雨天</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-sky-100" style={{ boxShadow: "0 0 4px #e0f2fe80" }} />
          <span className="text-[9px] text-cloud-dim/60">雪天</span>
        </div>
        <div className="ml-auto text-[9px] text-cloud-dim/40">
          双击添加天气关键帧 · 拖拽调整位置
        </div>
      </div>
    </div>
  );
}
