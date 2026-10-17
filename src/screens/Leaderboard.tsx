import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BATTLE_NODES } from "@/data/campaign";
import { audio } from "@/game/audio";

export function Leaderboard({ onBack }: { onBack: () => void }) {
  const [nodeId, setNodeId] = useState<string>("all");
  const query = trpc.scores.top.useQuery(
    { nodeId: nodeId === "all" ? undefined : nodeId, limit: 20 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="ink-grain relative flex min-h-[100dvh] flex-col bg-[#17140f]">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-brush text-4xl text-[#c53a24]">史冊</span>
              <h1 className="text-2xl font-bold uppercase tracking-[0.2em] text-[#ece4d0]">The Annals</h1>
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.3em] text-[#b08d4f]">
              Greatest warriors across the ages
            </div>
          </div>
          <button
            onClick={() => {
              audio.play("click");
              onBack();
            }}
            className="min-h-[44px] border border-[#ece4d0]/30 px-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#ece4d0] hover:bg-white/10"
          >
            ← Back
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {["all", ...BATTLE_NODES.map((n) => n.id)].map((id) => (
            <button
              key={id}
              onClick={() => {
                audio.play("click");
                setNodeId(id);
              }}
              className={`min-h-[44px] border px-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                nodeId === id
                  ? "border-[#c53a24] bg-[#7a1f14]/60 text-[#f0e2c8]"
                  : "border-[#ece4d0]/20 text-[#9a9284] hover:border-[#ece4d0]/50"
              }`}
            >
              {id === "all" ? "All battles" : BATTLE_NODES.find((n) => n.id === id)?.zh}
            </button>
          ))}
        </div>

        <div className="mt-6 border border-[#b08d4f]/25 bg-[#1c1813]">
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem] gap-2 border-b border-[#ece4d0]/10 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8272] md:grid-cols-[3rem_1fr_7rem_5rem_5rem]">
            <span>#</span>
            <span>Warrior</span>
            <span className="hidden md:block">Battle</span>
            <span className="text-right">Kills</span>
            <span className="text-right">Score</span>
          </div>
          {query.isLoading && (
            <div className="px-4 py-10 text-center text-sm text-[#8a8272]">Reading the bamboo slips…</div>
          )}
          {query.isError && (
            <div className="px-4 py-10 text-center text-sm text-[#8a8272]">
              The annals are sealed for now — the scribes could not be reached.
            </div>
          )}
          {query.data && query.data.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-[#8a8272]">
              No names recorded yet. Be the first to make history.
            </div>
          )}
          {query.data?.map((row, i) => (
            <div
              key={row.id}
              className={`grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem] items-center gap-2 px-4 py-3 md:grid-cols-[3rem_1fr_7rem_5rem_5rem] ${
                i < 3 ? "bg-[#7a1f14]/25" : i % 2 ? "bg-white/[0.02]" : ""
              }`}
            >
              <span className={`font-brush text-xl ${i === 0 ? "text-[#e04a30]" : i < 3 ? "text-[#b08d4f]" : "text-[#6e675c]"}`}>
                {i + 1}
              </span>
              <span className="truncate text-sm font-medium text-[#ece4d0]">
                {row.name}
                {row.victory && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#a8d890]">勝 victory</span>}
              </span>
              <span className="hidden text-xs text-[#9a9284] md:block">
                {BATTLE_NODES.find((n) => n.id === row.nodeId)?.zh ?? row.nodeId}
              </span>
              <span className="text-right text-sm tabular-nums text-[#c8bfa8]">{row.kills}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-[#b08d4f]">{row.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
