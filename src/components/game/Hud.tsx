import { useEffect, useRef } from "react";
import type { HudSnapshot } from "@/game/types";

// ---------- compass ----------
const BEARINGS: [number, string][] = [
  [0, "N"], [45, "NE"], [90, "E"], [135, "SE"],
  [180, "S"], [225, "SW"], [270, "W"], [315, "NW"],
];

function Compass({ deg }: { deg: number }) {
  const width = 260;
  const pxPerDeg = 3;
  const items: { label: string; x: number; major: boolean }[] = [];
  for (let rep = -1; rep <= 1; rep++) {
    for (const [b, label] of BEARINGS) {
      items.push({ label, x: (b + rep * 360) * pxPerDeg, major: true });
    }
    for (let d = 0; d < 360; d += 15) {
      if (d % 45 !== 0) items.push({ label: "", x: (d + rep * 360) * pxPerDeg, major: false });
    }
  }
  const center = deg * pxPerDeg;
  return (
    <div className="relative h-8 overflow-hidden" style={{ width }}>
      <div
        className="absolute top-0 h-full"
        style={{ transform: `translateX(${width / 2 - center}px)`, width: 360 * pxPerDeg * 3 }}
      >
        {items.map((it, i) =>
          Math.abs(it.x - center) < width / 2 + 30 ? (
            <div
              key={i}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: it.x, transform: "translateX(-50%)" }}
            >
              {it.major ? (
                <span className="hud-shadow text-[13px] font-semibold tracking-wider text-[#ece4d0]">
                  {it.label}
                </span>
              ) : (
                <span className="mt-[3px] block h-[14px] w-px bg-[#ece4d0]/50" />
              )}
            </div>
          ) : null
        )}
      </div>
      <div className="absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 bg-[#c53a24]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
    </div>
  );
}

// ---------- minimap ----------
function Minimap({ snap }: { snap: HudSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const S = c.width;
    const R = S / 2;
    const scale = R / 90; // show 90m radius
    ctx.clearRect(0, 0, S, S);
    // bg
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(16,14,10,0.72)";
    ctx.fillRect(0, 0, S, S);
    const px = snap.playerPos.x;
    const pz = snap.playerPos.z;
    const toMap = (x: number, z: number): [number, number] => [
      R + (x - px) * scale,
      R + (z - pz) * scale,
    ];
    // great wall band (north)
    ctx.strokeStyle = "rgba(200,180,140,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = px - 95; x <= px + 95; x += 8) {
      const z = -190 + Math.sin(x * 0.02) * 14;
      const [mx, my] = toMap(x, z);
      if (x === px - 95) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();
    // structures
    for (const st of snap.structures) {
      const [mx, my] = toMap(st.x, st.z);
      if (mx < 0 || mx > S || my < 0 || my > S) continue;
      ctx.fillStyle =
        st.kind === "banner" ? "#c53a24" : st.kind === "tower" ? "#b08d4f" : "rgba(180,170,140,0.4)";
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // enemies
    for (const e of snap.enemies) {
      const [mx, my] = toMap(e.x, e.z);
      if (mx < 0 || mx > S || my < 0 || my > S) continue;
      ctx.fillStyle = "#e04a30";
      ctx.beginPath();
      ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // player arrow (points north/up relative map; heading shown by rotating triangle)
    ctx.translate(R, R);
    ctx.rotate((snap.compassDeg * Math.PI) / 180);
    ctx.fillStyle = "#ece4d0";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // ring
    ctx.strokeStyle = "rgba(236,228,208,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [snap]);
  return <canvas ref={ref} width={132} height={132} className="rounded-full" />;
}

// ---------- crosshair ----------
function Crosshair({ snap, hitmarks }: { snap: HudSnapshot; hitmarks: { id: number; kill: boolean }[] }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {snap.weapon === "crossbow" ? (
        snap.aiming ? (
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-[#ece4d0]/80" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c53a24]" />
          </div>
        ) : (
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-[#ece4d0]" />
            <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-[#ece4d0]" />
            <div className="absolute left-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[#ece4d0]" />
            <div className="absolute right-0 top-1/2 h-px w-2 -translate-y-1/2 bg-[#ece4d0]" />
            <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ece4d0]" />
          </div>
        )
      ) : (
        <div className="h-[5px] w-[5px] rounded-full bg-[#ece4d0]/80" />
      )}
      {hitmarks.map((h) => (
        <div key={h.id} className="hitmarker absolute left-1/2 top-1/2 h-6 w-6">
          <div
            className={`absolute left-1/2 top-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 ${
              h.kill ? "bg-[#e04a30]" : "bg-white"
            }`}
          />
          <div
            className={`absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 ${
              h.kill ? "bg-[#e04a30]" : "bg-white"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ---------- main HUD ----------
export interface FeedItem {
  id: number;
  text: string;
  kind: "kill" | "wave" | "info";
}

export function Hud({
  snap,
  feed,
  hitmarks,
  damageFlash,
}: {
  snap: HudSnapshot;
  feed: FeedItem[];
  hitmarks: { id: number; kill: boolean }[];
  damageFlash: number; // increment to retrigger
}) {
  const hpPct = snap.health / snap.maxHealth;
  const lowHp = hpPct <= 0.3;
  const mmss = `${Math.floor(snap.timeSec / 60)}:${String(snap.timeSec % 60).padStart(2, "0")}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* damage vignette */}
      {damageFlash > 0 && (
        <div
          key={damageFlash}
          className="damage-flash absolute inset-0"
          style={{ boxShadow: "inset 0 0 120px 40px rgba(190,30,15,0.55)" }}
        />
      )}
      {lowHp && (
        <div
          className="lowhp-pulse absolute inset-0"
          style={{ boxShadow: "inset 0 0 140px 50px rgba(190,30,15,0.5)" }}
        />
      )}
      {/* permanent slight vignette */}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 180px 30px rgba(0,0,0,0.45)" }} />

      {/* top-left: minimap + objective */}
      <div className="absolute left-3 top-3 flex origin-top-left scale-[0.72] flex-col gap-2 sm:scale-100 md:left-5 md:top-5">
        <Minimap snap={snap} />
        <div className="max-w-[220px]">
          <div className="hud-shadow text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b08d4f]">
            Objective
          </div>
          <div className="hud-shadow text-sm font-medium text-[#ece4d0]">{snap.objectiveText}</div>
          {snap.objective === "eliminate" && (
            <div className="mt-1 h-1 w-40 bg-black/50">
              <div
                className="h-full bg-[#c53a24] transition-all duration-300"
                style={{ width: `${Math.min(100, (snap.kills / snap.target) * 100)}%` }}
              />
            </div>
          )}
          {snap.objective === "hold" && (
            <div className="mt-1 h-1 w-40 bg-black/50">
              <div className="h-full bg-[#b08d4f] transition-all duration-300" style={{ width: `${snap.holdPct * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* top-center: compass + wave banner */}
      <div className="absolute left-1/2 top-2 hidden -translate-x-1/2 sm:block md:top-4">
        <Compass deg={snap.compassDeg} />
        {snap.objective === "survive" && snap.wave > 0 && (
          <div className="hud-shadow mt-1 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#ece4d0]">
            Wave {snap.wave} / {snap.target}
          </div>
        )}
      </div>

      {/* top-right: score + feed */}
      <div className="absolute right-3 top-3 text-right md:right-5 md:top-5">
        <div className="hud-shadow text-2xl font-semibold tabular-nums text-[#ece4d0]">{snap.score}</div>
        <div className="hud-shadow text-[11px] uppercase tracking-[0.25em] text-[#b08d4f]">
          {snap.kills} kills · {mmss}
        </div>
        <div className="mt-2 flex flex-col items-end gap-1">
          {feed.slice(-4).map((f) => (
            <div
              key={f.id}
              className={`feed-in hud-shadow px-2 py-0.5 text-xs ${
                f.kind === "kill"
                  ? "bg-black/45 text-[#e8c8a0]"
                  : f.kind === "wave"
                    ? "bg-[#7a1f14]/70 font-semibold tracking-widest text-[#f0e2c8]"
                    : "bg-black/45 text-[#ece4d0]"
              }`}
            >
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* bottom-left: health */}
      <div className="absolute bottom-4 left-3 md:bottom-6 md:left-6">
        <div className="hud-shadow mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#b08d4f]">
          生命 Health
        </div>
        <div className="h-[10px] w-44 border border-[#ece4d0]/25 bg-black/55 md:w-56">
          <div
            className={`h-full transition-all duration-200 ${lowHp ? "bg-[#e04a30]" : "bg-[#d8cba8]"}`}
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        <div className="hud-shadow mt-1 text-lg font-semibold tabular-nums text-[#ece4d0]">{snap.health}</div>
      </div>

      {/* bottom-right: weapon card */}
      <div className="absolute bottom-4 right-3 text-right md:bottom-6 md:right-6">
        {snap.weapon === "crossbow" ? (
          <>
            <div className="hud-shadow text-[11px] font-semibold uppercase tracking-[0.25em] text-[#b08d4f]">
              弩 Qin Crossbow
            </div>
            <div className="hud-shadow mt-0.5 text-sm font-medium text-[#ece4d0]">
              {snap.boltReady ? (
                <span className="text-[#a8d890]">● BOLT LOADED</span>
              ) : (
                <span className="text-[#e0b060]">SPANNING…</span>
              )}
            </div>
            {!snap.boltReady && (
              <div className="ml-auto mt-1 h-1 w-28 bg-black/55">
                <div className="h-full bg-[#e0b060]" style={{ width: `${snap.reloadPct * 100}%` }} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="hud-shadow text-[11px] font-semibold uppercase tracking-[0.25em] text-[#b08d4f]">
              劍 Bronze Jian
            </div>
            <div className="hud-shadow mt-0.5 text-sm font-medium text-[#ece4d0]">MELEE</div>
          </>
        )}
        <div className="hud-shadow mt-1 hidden text-[10px] uppercase tracking-wider text-[#9a9284] md:block">
          Q — switch · RMB — aim · Shift — sprint
        </div>
      </div>

      <Crosshair snap={snap} hitmarks={hitmarks} />
    </div>
  );
}
