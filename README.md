# 大秦 DA QIN — Warring States

A Call of Duty-style **first-person campaign through 5,000 years of Chinese warfare** — from the Yellow Emperor's misty plains at Zhuolu (c. 2677 BC), before "China" was China, through the dynasties, to the First Emperor Qin Shi Huang and the Great Wall. Crossbow and jian (bronze sword) in hand. History is written by the last one standing.

Built as a full-stack web game: a custom Three.js FPS engine, a strategic campaign map, and a cloud leaderboard.

## The Campaign — six battles, chronological

| Battle | Year | Objective |
|---|---|---|
| 涿鹿之戰 Battle of Zhuolu | c. 2677 BC | Eliminate 15 Jiuli warriors in Chiyou's mist |
| 牧野之戰 Battle of Muye | 1046 BC | Eliminate 20 Shang soldiers at dusk |
| 長平之戰 Battle of Changping | 260 BC | Survive 5 waves at night |
| 函谷關 Hangu Pass | 318 BC | Hold the pass banner for 120 s |
| 咸陽 Fall of Xianyang | 221 BC | Destroy 24 terracotta guardians (3 HP each) |
| 長城 Defense of the Great Wall | 215 BC | Survive 6 waves of Xiongnu (archer-heavy) |

Each battle has its own sky, fog, time-of-day lighting, enemy faction (tribal, bronze-age, Qin, terracotta, Xiongnu fur-armor) and objective type. Enemies are procedurally built 3D soldiers with distinct helmets, armor and weapons (ge halberds, bows), driven by an AI state machine (approach / strafe / melee wind-up / archery with target-leading).

## Controls

**Desktop** — WASD move · mouse look (pointer lock) · LMB fire / swing · RMB aim-down-sights · R reload · 1/2 or Q switch crossbow / jian · Space jump · Shift sprint · Esc pause

**Mobile** — virtual twin-stick: left joystick to move, drag right side to look, dedicated FIRE / AIM / JUMP / weapon-swap buttons (all ≥ 44 px touch targets).

## Tech

- **Engine**: custom FPS engine on Three.js — FogExp2 atmosphere, shader sky-dome per battle, ACES tone mapping, PCFSoft shadow mapping that follows the player, instanced trees/rocks, animated banners, brazier fire particles, procedural canvas textures (zero external 3D assets)
- **Ballistics**: projectiles use swept segment-vs-sphere collision (no tunneling at 72 m/s bolt speeds) with gravity drop and damage falloff
- **Feel**: CoD-style health regen, hitmarkers, damage vignette, kill feed, weapon bob/recoil, ADS FOV zoom, war-drum ambience, positional-ish SFX (WebAudio synthesized fallback for every sound)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind + shadcn/ui — menu, scrollable campaign map, briefing panels, HUD (compass, minimap, health, ammo state), pause/end screens
- **Backend**: Hono + tRPC 11 + Drizzle ORM + MySQL — persistent leaderboard (`scores.submit` / `scores.top` per battle)
- **Responsive**: desktop ≥ 1024 px and mobile 375–430 px, safe-area aware, quality settings (high/low) for weaker GPUs

## Run it

```bash
npm install
npm run db:push   # needs DATABASE_URL (see .env.example)
npm run dev       # http://localhost:3000
```

Production: `npm run build && npm start`

> The `.env` file with live credentials is intentionally not committed — copy `.env.example` and fill in your own database / app credentials.

## Repo notes

- `src/game/` — the engine: `engine.ts` (loop, ballistics, objectives), `player.ts` (controls, weapons), `soldiers.ts` (AI + procedural meshes), `world.ts` (terrain, sky, Great Wall), `audio.ts`, `noise.ts` (terrain height field)
- `src/data/campaign.ts` — the six battle definitions (sky/fog/faction/objective tuning)
- `src/screens/` — Menu, CampaignMap, GameScreen, Leaderboard
- `api/`, `db/`, `contracts/` — tRPC backend and Drizzle schema

Audio SFX in `public/assets/sfx/` are AI-generated; all other art is procedural or AI-generated for this project.
