// Shared game types

export type ObjectiveType = "eliminate" | "survive" | "hold";

export interface FactionSpec {
  id: string;
  name: string;
  zh: string;
  armorColor: number;
  clothColor: number;
  skinTone: number;
  helmet: "tribal" | "bronze" | "qinsoldier" | "terracotta" | "fur";
  archerRatio: number; // 0..1 share of enemies that are archers
  hp: number;
  speed: number;
  damage: number;
}

export interface BattleNode {
  id: string;
  name: string;
  zh: string;
  year: string;
  era: string;
  location: string;
  description: string;
  objective: ObjectiveType;
  objectiveText: string;
  target: number; // kills for eliminate, waves for survive, seconds for hold
  enemy: FactionSpec;
  playerTitle: string;
  timeOfDay: "dawn" | "noon" | "dusk" | "night" | "overcast";
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  fogDensity: number;
  ambient: number; // ambient light intensity
  sunColor: number;
  sunIntensity: number;
  // position on the strategic map (percent coords)
  mapX: number;
  mapY: number;
}

export interface GameResult {
  nodeId: string;
  nodeName: string;
  victory: boolean;
  kills: number;
  score: number;
  timeSec: number;
  wavesCleared?: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  weapon: "crossbow" | "sword";
  boltReady: boolean;
  reloadPct: number; // 0..1
  aiming: boolean;
  score: number;
  kills: number;
  target: number;
  objective: ObjectiveType;
  objectiveText: string;
  wave: number;
  holdPct: number;
  compassDeg: number;
  enemies: { x: number; z: number; alive: boolean }[];
  playerPos: { x: number; z: number };
  structures: { x: number; z: number; kind: string }[];
  timeSec: number;
}

export type GameEventType =
  | "hitmark"
  | "kill"
  | "playerHurt"
  | "wave"
  | "objectiveDone"
  | "reloadStart"
  | "reloadDone"
  | "dryFire";

export interface GameEvent {
  type: GameEventType;
  text?: string;
}
