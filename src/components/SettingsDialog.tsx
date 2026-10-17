import { audio } from "@/game/audio";

export interface GameSettings {
  sensitivity: number;
  volume: number;
  quality: "high" | "low";
}

export function loadSettings(): GameSettings {
  try {
    return {
      sensitivity: parseFloat(localStorage.getItem("dq_sens") || "1") || 1,
      volume: parseFloat(localStorage.getItem("dq_vol") || "0.8"),
      quality: (localStorage.getItem("dq_quality") as "high" | "low") || "high",
    };
  } catch {
    return { sensitivity: 1, volume: 0.8, quality: "high" };
  }
}

export function SettingsDialog({
  settings,
  onChange,
  onClose,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onClose: () => void;
}) {
  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    try {
      localStorage.setItem("dq_sens", String(next.sensitivity));
      localStorage.setItem("dq_vol", String(next.volume));
      localStorage.setItem("dq_quality", next.quality);
    } catch {
      /* ignore */
    }
    if (patch.volume !== undefined) audio.setVolume(patch.volume);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-[#b08d4f]/30 bg-[#1c1813] p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-baseline gap-3">
          <span className="font-brush text-3xl text-[#c53a24]">設置</span>
          <span className="text-lg font-bold uppercase tracking-[0.2em] text-[#ece4d0]">Settings</span>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.2em] text-[#9a9284]">
              <span>Look sensitivity</span>
              <span className="tabular-nums text-[#ece4d0]">{settings.sensitivity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.05}
              value={settings.sensitivity}
              onChange={(e) => update({ sensitivity: parseFloat(e.target.value) })}
              className="h-11 w-full accent-[#c53a24]"
              aria-label="Look sensitivity"
            />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.2em] text-[#9a9284]">
              <span>Volume</span>
              <span className="tabular-nums text-[#ece4d0]">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => update({ volume: parseFloat(e.target.value) })}
              className="h-11 w-full accent-[#c53a24]"
              aria-label="Volume"
            />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[#9a9284]">Graphics quality</div>
            <div className="flex gap-2">
              {(["high", "low"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    audio.play("click");
                    update({ quality: q });
                  }}
                  className={`min-h-[44px] flex-1 border px-3 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                    settings.quality === q
                      ? "border-[#c53a24] bg-[#7a1f14]/60 text-[#f0e2c8]"
                      : "border-[#ece4d0]/20 text-[#9a9284] hover:border-[#ece4d0]/50"
                  }`}
                >
                  {q === "high" ? "High · shadows" : "Low · fast"}
                </button>
              ))}
            </div>
            <div className="font-body mt-2 text-[11px] leading-relaxed text-[#6e675c]">
              Quality applies to the next battle you deploy to.
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            audio.play("click");
            onClose();
          }}
          className="mt-7 min-h-[48px] w-full bg-[#c53a24] px-4 py-3 text-xs font-bold uppercase tracking-[0.3em] text-[#f5ecd8] hover:bg-[#e04a30]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
