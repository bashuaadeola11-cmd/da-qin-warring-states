import { audio } from "@/game/audio";

export function Menu({
  onCampaign,
  onQuickBattle,
  onLeaderboard,
  onSettings,
}: {
  onCampaign: () => void;
  onQuickBattle: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}) {
  const click = (fn: () => void) => () => {
    audio.unlock();
    audio.play("click");
    fn();
  };

  return (
    <div className="ink-grain relative flex h-full min-h-[100dvh] flex-col overflow-hidden bg-[#17140f]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/assets/menu-backdrop.png)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#17140f] via-[#17140f]/80 to-[#17140f]/20" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#17140f] to-transparent" />

      {/* vertical brush title */}
      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 select-none md:right-14 lg:block">
        <div className="writing-vertical font-brush text-[11rem] leading-none text-[#c53a24]/90 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
          大秦
        </div>
        <div className="writing-vertical mx-auto mt-6 text-xs tracking-[0.6em] text-[#b08d4f]">
          風蕭蕭兮易水寒
        </div>
      </div>

      {/* content */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-center px-6 py-10 md:px-16 lg:px-24">
        <div className="rise-in flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-[#c53a24] bg-[#7a1f14]/80">
            <span className="font-brush text-2xl text-[#f0e2c8]">戰</span>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#b08d4f]">
            From legend to empire
          </div>
        </div>

        <h1 className="rise-in mt-4 text-5xl font-bold uppercase leading-none tracking-[0.08em] text-[#ece4d0] md:text-7xl" style={{ animationDelay: "0.06s" }}>
          Da Qin
        </h1>
        <div className="rise-in mt-2 text-xl font-medium uppercase tracking-[0.5em] text-[#c53a24] md:text-2xl" style={{ animationDelay: "0.12s" }}>
          Warring States
        </div>
        <p className="font-body rise-in mt-5 max-w-md text-sm leading-relaxed text-[#c8bfa8]" style={{ animationDelay: "0.18s" }}>
          A first-person campaign through five thousand years of Chinese warfare — from the Yellow
          Emperor's misty plains at Zhuolu to the First Emperor's Great Wall. Crossbow and jian in
          hand. History is written by the last one standing.
        </p>

        <div className="rise-in mt-9 flex w-full max-w-xs flex-col gap-3" style={{ animationDelay: "0.24s" }}>
          <button
            onClick={click(onCampaign)}
            className="group flex min-h-[52px] items-center justify-between bg-[#c53a24] px-6 text-left text-sm font-bold uppercase tracking-[0.3em] text-[#f5ecd8] transition-colors hover:bg-[#e04a30]"
          >
            Campaign 征戰
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
          <button
            onClick={click(onQuickBattle)}
            className="group flex min-h-[52px] items-center justify-between border border-[#ece4d0]/30 px-6 text-left text-sm font-semibold uppercase tracking-[0.3em] text-[#ece4d0] transition-colors hover:bg-white/10"
          >
            Quick battle 速戰
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
          <div className="flex gap-3">
            <button
              onClick={click(onLeaderboard)}
              className="min-h-[48px] flex-1 border border-[#b08d4f]/40 px-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#b08d4f] transition-colors hover:bg-[#b08d4f]/10"
            >
              Annals 史冊
            </button>
            <button
              onClick={click(onSettings)}
              className="min-h-[48px] flex-1 border border-[#ece4d0]/25 px-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#9a9284] transition-colors hover:bg-white/10"
            >
              Settings 設置
            </button>
          </div>
        </div>

        <div className="font-body mt-10 max-w-md text-[11px] leading-relaxed text-[#6e675c]">
          WASD + mouse · mobile twin-stick supported · Best experienced with sound on.
        </div>
      </div>
    </div>
  );
}
