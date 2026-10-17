import { useState } from "react";
import { Menu } from "@/screens/Menu";
import { CampaignMap } from "@/screens/CampaignMap";
import { GameScreen } from "@/screens/GameScreen";
import { Leaderboard } from "@/screens/Leaderboard";
import { SettingsDialog, loadSettings, type GameSettings } from "@/components/SettingsDialog";
import { BATTLE_NODES } from "@/data/campaign";
import type { BattleNode } from "@/game/types";

type Screen = "menu" | "map" | "game" | "leaderboard";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [node, setNode] = useState<BattleNode>(BATTLE_NODES[0]);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const deploy = (n: BattleNode) => {
    setNode(n);
    setScreen("game");
  };

  const quickBattle = () => {
    const n = BATTLE_NODES[Math.floor(Math.random() * BATTLE_NODES.length)];
    deploy(n);
  };

  return (
    <div className="h-[100dvh] bg-[#17140f]">
      {screen === "menu" && (
        <Menu
          onCampaign={() => setScreen("map")}
          onQuickBattle={quickBattle}
          onLeaderboard={() => setScreen("leaderboard")}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen === "map" && <CampaignMap onDeploy={deploy} onBack={() => setScreen("menu")} />}
      {screen === "leaderboard" && <Leaderboard onBack={() => setScreen("menu")} />}
      {screen === "game" && (
        <GameScreen
          node={node}
          quality={settings.quality}
          sensitivity={settings.sensitivity}
          onExit={(to) => setScreen(to)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
