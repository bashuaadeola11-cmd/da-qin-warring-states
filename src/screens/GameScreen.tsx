import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game/engine";
import { audio } from "@/game/audio";
import type { BattleNode, GameResult, HudSnapshot } from "@/game/types";
import { Hud, type FeedItem } from "@/components/game/Hud";
import { TouchControls } from "@/components/game/TouchControls";
import { trpc } from "@/providers/trpc";

let idCounter = 1;

export function GameScreen({
  node,
  quality,
  sensitivity,
  onExit,
}: {
  node: BattleNode;
  quality: "high" | "low";
  sensitivity: number;
  onExit: (to: "map" | "menu") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [hitmarks, setHitmarks] = useState<{ id: number; kill: boolean }[]>([]);
  const [damageFlash, setDamageFlash] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [started, setStarted] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [name, setName] = useState(() => localStorage.getItem("dq_name") || "");
  const [submitted, setSubmitted] = useState(false);
  const submitMut = trpc.scores.submit.useMutation();

  const pushFeed = useCallback((text: string, kind: FeedItem["kind"]) => {
    setFeed((f) => [...f.slice(-6), { id: idCounter++, text, kind }]);
  }, []);

  useEffect(() => {
    engineRef.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new GameEngine(
      canvas,
      node,
      {
        onSnapshot: setSnap,
        onEvent: (ev) => {
          if (ev.type === "hitmark") {
            const id = idCounter++;
            setHitmarks((h) => [...h, { id, kill: false }]);
            setTimeout(() => setHitmarks((h) => h.filter((x) => x.id !== id)), 300);
          } else if (ev.type === "kill" && ev.text) {
            const id = idCounter++;
            setHitmarks((h) => [...h, { id, kill: true }]);
            setTimeout(() => setHitmarks((h) => h.filter((x) => x.id !== id)), 300);
            pushFeed(ev.text, "kill");
          } else if (ev.type === "playerHurt") {
            setDamageFlash((n) => n + 1);
          } else if (ev.type === "wave" && ev.text) {
            pushFeed(ev.text, "wave");
          } else if (ev.type === "dryFire") {
            pushFeed("Crossbow spanning…", "info");
          }
        },
        onEnd: (r) => setResult(r),
        onPauseRequest: () => {
          eng.setPaused(true);
          setPaused(true);
        },
      },
      quality
    );
    eng.init();
    engineRef.current = eng;
    // debug/testing handle
    (window as unknown as { __dq: GameEngine }).__dq = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, restartKey, node.id]);

  const resume = () => {
    audio.unlock();
    setPaused(false);
    engineRef.current?.setPaused(false);
    engineRef.current?.relockPointer();
  };

  const restart = () => {
    audio.unlock();
    setResult(null);
    setPaused(false);
    setFeed([]);
    setSubmitted(false);
    setSnap(null);
    setRestartKey((k) => k + 1);
  };

  const quit = (to: "map" | "menu") => {
    engineRef.current?.dispose();
    engineRef.current = null;
    onExit(to);
  };

  const submitScore = () => {
    if (!result || !name.trim()) return;
    localStorage.setItem("dq_name", name.trim());
    submitMut.mutate(
      {
        name: name.trim().slice(0, 24),
        nodeId: result.nodeId,
        kills: result.kills,
        score: result.score,
        timeSec: result.timeSec,
        victory: result.victory,
      },
      { onSuccess: () => setSubmitted(true) }
    );
  };

  // best score per node, locally, for the map screen badge
  useEffect(() => {
    if (!result) return;
    try {
      const key = `dq_best_${result.nodeId}`;
      const prev = parseInt(localStorage.getItem(key) || "0", 10);
      if (result.score > prev) localStorage.setItem(key, String(result.score));
    } catch {
      /* ignore */
    }
  }, [result]);

  // intro/start gate (also unlocks audio on gesture)
  if (!started) {
    return (
      <div className="relative flex h-full min-h-[100dvh] flex-col items-center justify-center bg-[#17140f] px-6 text-center">
        <div className="font-brush rise-in text-6xl text-[#c53a24] md:text-7xl">{node.zh}</div>
        <h1 className="rise-in mt-3 text-2xl font-semibold uppercase tracking-[0.2em] text-[#ece4d0] md:text-3xl" style={{ animationDelay: "0.08s" }}>
          {node.name}
        </h1>
        <div className="rise-in mt-1 text-sm tracking-[0.3em] text-[#b08d4f]" style={{ animationDelay: "0.14s" }}>
          {node.year} · {node.era}
        </div>
        <p className="font-body rise-in mt-5 max-w-xl text-sm leading-relaxed text-[#c8bfa8]" style={{ animationDelay: "0.2s" }}>
          {node.description}
        </p>
        <div className="rise-in mt-5 border border-[#b08d4f]/40 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#ece4d0]" style={{ animationDelay: "0.26s" }}>
          {node.objectiveText}
        </div>
        <button
          onClick={() => {
            audio.unlock();
            audio.load();
            audio.play("click");
            setStarted(true);
          }}
          className="rise-in mt-8 min-h-[48px] min-w-[220px] bg-[#c53a24] px-8 py-3 text-sm font-bold uppercase tracking-[0.3em] text-[#f5ecd8] transition-colors hover:bg-[#e04a30]"
          style={{ animationDelay: "0.32s" }}
        >
          Deploy 出戰
        </button>
        <div className="font-body mt-6 max-w-md text-[11px] leading-relaxed text-[#8a8272]">
          WASD move · Mouse look · LMB fire · RMB aim · Q switch weapon · Shift sprint · Space jump ·
          Esc pause — on touch devices use the on-screen sticks.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
      {snap && <Hud snap={snap} feed={feed} hitmarks={hitmarks} damageFlash={damageFlash} />}
      {engineRef.current?.touchDevice && !paused && !result && (
        <TouchControls engine={() => engineRef.current} />
      )}

      {/* pause button (touch) */}
      {!paused && !result && (
        <button
          aria-label="Pause"
          onClick={() => {
            engineRef.current?.setPaused(true);
            setPaused(true);
            audio.play("click");
          }}
          className="absolute right-3 top-16 z-40 flex h-11 w-11 items-center justify-center border border-[#ece4d0]/30 bg-black/50 text-[#ece4d0] md:top-20"
        >
          <span className="text-lg leading-none">Ⅱ</span>
        </button>
      )}

      {/* pause overlay */}
      {paused && !result && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75 px-6">
          <div className="font-brush text-5xl text-[#ece4d0]">停</div>
          <div className="mt-1 text-sm uppercase tracking-[0.4em] text-[#b08d4f]">Paused</div>
          <div className="mt-8 flex w-full max-w-[260px] flex-col gap-3">
            <button onClick={resume} className="min-h-[48px] bg-[#c53a24] px-6 py-3 text-sm font-bold uppercase tracking-[0.25em] text-[#f5ecd8] hover:bg-[#e04a30]">
              Resume
            </button>
            <button onClick={restart} className="min-h-[48px] border border-[#ece4d0]/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10">
              Restart battle
            </button>
            <button onClick={() => quit("map")} className="min-h-[48px] border border-[#ece4d0]/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10">
              Abandon — map
            </button>
          </div>
        </div>
      )}

      {/* end overlay */}
      {result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="ink-grain relative w-full max-w-md border border-[#b08d4f]/30 bg-[#1c1813] p-6 md:p-8">
            <div className={`font-brush text-6xl ${result.victory ? "text-[#c53a24]" : "text-[#6e675c]"}`}>
              {result.victory ? "勝" : "殞"}
            </div>
            <div className="mt-1 text-lg font-semibold uppercase tracking-[0.3em] text-[#ece4d0]">
              {result.victory ? "Victory" : "Fallen in battle"}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8a8272]">{result.nodeName}</div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="border border-[#ece4d0]/15 py-3">
                <div className="text-2xl font-semibold tabular-nums text-[#ece4d0]">{result.kills}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#8a8272]">Kills</div>
              </div>
              <div className="border border-[#ece4d0]/15 py-3">
                <div className="text-2xl font-semibold tabular-nums text-[#b08d4f]">{result.score}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#8a8272]">Score</div>
              </div>
              <div className="border border-[#ece4d0]/15 py-3">
                <div className="text-2xl font-semibold tabular-nums text-[#ece4d0]">
                  {Math.floor(result.timeSec / 60)}:{String(result.timeSec % 60).padStart(2, "0")}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[#8a8272]">Time</div>
              </div>
            </div>

            {/* leaderboard submit */}
            {!submitted ? (
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#8a8272]">
                  Record your name in the annals
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={24}
                    placeholder="Warrior name"
                    className="min-h-[44px] flex-1 border border-[#ece4d0]/25 bg-black/40 px-3 text-sm text-[#ece4d0] outline-none placeholder:text-[#6e675c] focus:border-[#c53a24]"
                  />
                  <button
                    onClick={submitScore}
                    disabled={!name.trim() || submitMut.isPending}
                    className="min-h-[44px] bg-[#b08d4f] px-4 text-xs font-bold uppercase tracking-widest text-[#17140f] hover:bg-[#c8a05e] disabled:opacity-40"
                  >
                    {submitMut.isPending ? "…" : "Submit"}
                  </button>
                </div>
                {submitMut.isError && (
                  <div className="mt-1 text-[11px] text-[#e04a30]">Could not reach the annals — score kept locally.</div>
                )}
              </div>
            ) : (
              <div className="mt-5 border border-[#b08d4f]/40 px-3 py-2 text-center text-xs uppercase tracking-[0.2em] text-[#b08d4f]">
                Recorded in the annals 載入史冊
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button onClick={restart} className="min-h-[48px] flex-1 bg-[#c53a24] px-4 py-3 text-xs font-bold uppercase tracking-[0.25em] text-[#f5ecd8] hover:bg-[#e04a30]">
                Fight again
              </button>
              <button onClick={() => quit("map")} className="min-h-[48px] flex-1 border border-[#ece4d0]/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10">
                Campaign map
              </button>
              <button onClick={() => quit("menu")} className="min-h-[48px] flex-1 border border-[#ece4d0]/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10">
                Main menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
