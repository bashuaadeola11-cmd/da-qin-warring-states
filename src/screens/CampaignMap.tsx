import { useEffect, useRef, useState } from "react";
import { BATTLE_NODES } from "@/data/campaign";
import type { BattleNode } from "@/game/types";
import { audio } from "@/game/audio";

// Strategic campaign map — stylized ink-wash China with chronologically linked
// battle nodes from the Age of Legend to the Qin Empire.

export function CampaignMap({
  onDeploy,
  onBack,
}: {
  onDeploy: (node: BattleNode) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<BattleNode>(BATTLE_NODES[0]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // center the scrollable map on the node cluster on narrow screens
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.scrollWidth * 0.48 - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, target);
  }, []);

  const bestOf = (id: string) => {
    try {
      const v = parseInt(localStorage.getItem(`dq_best_${id}`) || "0", 10);
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="relative flex h-full min-h-[100dvh] flex-col bg-[#17140f] lg:flex-row">
      {/* map panel */}
      <div className="relative min-h-[60dvh] flex-1 lg:min-h-0">
        {/* fixed header overlay (does not scroll with the map) */}
        <div className="pointer-events-none absolute left-4 top-4 z-20 md:left-6 md:top-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#b08d4f]">
            華夏大地 · Campaign
          </div>
          <div className="hud-shadow text-xl font-bold uppercase tracking-[0.15em] text-[#ece4d0]">
            Choose your battle
          </div>
        </div>
        <button
          onClick={() => {
            audio.play("click");
            onBack();
          }}
          className="absolute right-4 top-4 z-20 min-h-[44px] border border-[#ece4d0]/30 bg-black/50 px-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10 md:right-6 md:top-6"
        >
          ← Menu
        </button>
        <div ref={scrollRef} className="h-full min-h-[60dvh] overflow-x-auto overflow-y-hidden lg:min-h-0">
        <div className="relative h-full min-h-[60dvh] w-full min-w-[640px] lg:min-w-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: "url(/assets/map-ink.png)" }}
        />
        <div className="absolute inset-0 bg-[#17140f]/35" />

        {/* nodes overlay */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* chronological path */}
          <polyline
            points={BATTLE_NODES.map((n) => `${n.mapX},${n.mapY}`).join(" ")}
            fill="none"
            stroke="rgba(197,58,36,0.55)"
            strokeWidth="0.35"
            strokeDasharray="1.2 0.9"
          />
        </svg>
        {BATTLE_NODES.map((n) => {
          const best = bestOf(n.id);
          const active = selected.id === n.id;
          return (
            <button
              key={n.id}
              onClick={() => {
                audio.play("click");
                setSelected(n);
              }}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${n.mapX}%`, top: `${n.mapY}%` }}
              aria-label={n.name}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all md:h-12 md:w-12 ${
                  active
                    ? "scale-110 border-[#e04a30] bg-[#7a1f14] shadow-[0_0_24px_rgba(224,74,48,0.55)]"
                    : "border-[#b08d4f]/70 bg-[#1c1813]/85 hover:border-[#e04a30]"
                }`}
              >
                <span className="font-brush text-lg text-[#f0e2c8] md:text-xl">{n.zh.slice(0, 1)}</span>
              </span>
              <span
                className={`hud-shadow pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest ${
                  active ? "text-[#f0e2c8]" : "text-[#c8bfa8]/80"
                }`}
              >
                {n.name}
              </span>
              {best !== null && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b08d4f] px-1 text-[9px] font-bold text-[#17140f]">
                  ★
                </span>
              )}
            </button>
          );
        })}
        </div>
        </div>
      </div>

      {/* briefing panel */}
      <div className="relative flex w-full flex-col border-t border-[#b08d4f]/25 bg-[#1c1813] lg:w-[400px] lg:border-l lg:border-t-0">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex items-baseline gap-3">
            <span className="font-brush text-5xl text-[#c53a24]">{selected.zh}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold uppercase tracking-[0.12em] text-[#ece4d0]">
            {selected.name}
          </h2>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-[#b08d4f]">
            {selected.year} · {selected.era}
          </div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.2em] text-[#8a8272]">{selected.location}</div>

          <p className="font-body mt-5 text-sm leading-relaxed text-[#c8bfa8]">{selected.description}</p>

          <div className="mt-6 space-y-3">
            <div className="flex items-start justify-between gap-4 border-b border-[#ece4d0]/10 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8a8272]">Objective</span>
              <span className="text-right text-sm font-medium text-[#ece4d0]">{selected.objectiveText}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[#ece4d0]/10 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8a8272]">Enemy</span>
              <span className="text-right text-sm font-medium text-[#ece4d0]">
                {selected.enemy.name} <span className="font-brush text-[#c53a24]">{selected.enemy.zh}</span>
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[#ece4d0]/10 pb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8a8272]">You fight as</span>
              <span className="text-right text-sm font-medium text-[#ece4d0]">{selected.playerTitle}</span>
            </div>
            {bestOf(selected.id) !== null && (
              <div className="flex items-start justify-between gap-4 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8a8272]">Your best</span>
                <span className="text-right text-sm font-semibold text-[#b08d4f]">{bestOf(selected.id)} pts</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 pt-0 md:p-8 md:pt-0">
          <button
            onClick={() => {
              audio.play("horn", 0.5);
              onDeploy(selected);
            }}
            className="flex min-h-[52px] w-full items-center justify-center gap-3 bg-[#c53a24] px-6 py-3 text-sm font-bold uppercase tracking-[0.3em] text-[#f5ecd8] transition-colors hover:bg-[#e04a30]"
          >
            Deploy 出戰
          </button>
        </div>
      </div>
    </div>
  );
}
