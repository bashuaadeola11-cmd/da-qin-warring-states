import * as THREE from "three";
import { buildWorld, animateWorld, type WorldRefs } from "./world";
import { Player, emptyInput, type PlayerInput } from "./player";
import {
  createSoldier,
  updateSoldier,
  hitSoldier,
  type Soldier,
} from "./soldiers";
import { heightAt } from "./noise";
import { audio } from "./audio";
import type { BattleNode, GameEvent, GameResult, HudSnapshot } from "./types";

export interface EngineCallbacks {
  onSnapshot: (snap: HudSnapshot) => void;
  onEvent: (ev: GameEvent) => void;
  onEnd: (result: GameResult) => void;
  onPauseRequest: () => void;
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  alive: boolean;
  friendly: boolean;
  damage: number;
  life: number;
}

const BOLT_SPEED = 72;
const ARROW_SPEED = 30;
const MAX_PROJECTILES = 48;

export class GameEngine {
  private renderer!: THREE.WebGLRenderer;
  private world!: WorldRefs;
  private player!: Player;
  private soldiers: Soldier[] = [];
  private projectiles: Projectile[] = [];
  private raf = 0;
  private lastT = 0;
  private running = false;
  private paused = false;
  private disposed = false;
  private startTime = 0;
  private elapsed = 0;

  private kills = 0;
  private score = 0;
  private wave = 0;
  private holdTime = 0;
  private spawnQueue = 0;
  private waveActive = false;
  private ended = false;

  private input: PlayerInput = emptyInput();
  private keys = new Set<string>();
  private pointerLocked = false;
  private isTouch = false;

  private snapshot: HudSnapshot;
  private snapTimer = 0;

  private canvas: HTMLCanvasElement;
  private node: BattleNode;
  private cbs: EngineCallbacks;
  private quality: "high" | "low";

  constructor(
    canvas: HTMLCanvasElement,
    node: BattleNode,
    cbs: EngineCallbacks,
    quality: "high" | "low" = "high"
  ) {
    this.canvas = canvas;
    this.node = node;
    this.cbs = cbs;
    this.quality = quality;
    this.snapshot = {
      health: 100,
      maxHealth: 100,
      weapon: "crossbow",
      boltReady: true,
      reloadPct: 1,
      aiming: false,
      score: 0,
      kills: 0,
      target: node.target,
      objective: node.objective,
      objectiveText: node.objectiveText,
      wave: 0,
      holdPct: 0,
      compassDeg: 0,
      enemies: [],
      playerPos: { x: 0, z: 0 },
      structures: [],
      timeSec: 0,
    };
  }

  // ---------------- lifecycle ----------------
  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.quality === "high",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === "high" ? 1.75 : 1.2));
    this.renderer.shadowMap.enabled = this.quality === "high";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.world = buildWorld(this.node);
    this.player = new Player(this.aspect);
    this.world.scene.add(this.player.yawObj);
    this.player.sensitivity = this.loadSens();
    this.player.spawn(24, 70);

    this.snapshot.structures = this.world.structures;
    this.initProjectiles();
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);

    this.startTime = performance.now();
    this.running = true;
    this.lastT = performance.now();
    this.loop();

    // opening spawn
    this.beginObjective();
  }

  private get aspect() {
    return this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
  }

  private resize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.player.camera.aspect = w / Math.max(1, h);
    this.player.camera.updateProjectionMatrix();
  };

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.unbindInput();
    audio.stopAmbience();
    this.renderer.dispose();
    this.world.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        o.geometry?.dispose?.();
      }
    });
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      this.lastT = performance.now();
    }
  }

  get isPaused() {
    return this.paused;
  }

  // ---------------- objectives ----------------
  private beginObjective() {
    audio.play("horn", 0.9);
    audio.startAmbience(this.node.timeOfDay === "night" ? "drums" : "wind");
    if (this.node.objective === "eliminate") {
      this.spawnQueue = this.node.target + 6; // a few extra so the field never feels empty
      this.refillField();
    } else if (this.node.objective === "survive") {
      this.startWave(1);
    } else {
      // hold
      this.spawnQueue = 999;
      this.refillField();
    }
  }

  private maxConcurrent() {
    return this.quality === "high" ? 14 : 8;
  }

  private refillField() {
    const aliveCount = this.soldiers.filter((s) => s.alive).length;
    const want = Math.min(this.maxConcurrent() - aliveCount, this.spawnQueue);
    for (let i = 0; i < want; i++) {
      this.spawnSoldier();
      this.spawnQueue--;
    }
  }

  private startWave(n: number) {
    this.wave = n;
    this.waveActive = true;
    this.spawnQueue = 3 + n * 2;
    this.refillField();
    audio.play("wave", 0.8);
    this.cbs.onEvent({ type: "wave", text: `WAVE ${n}` });
  }

  private spawnPos(): { x: number; z: number } {
    const p = this.player.position;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 45;
      const x = THREE.MathUtils.clamp(p.x + Math.cos(a) * r, -240, 240);
      const z = THREE.MathUtils.clamp(p.z + Math.sin(a) * r, -240, 240);
      let ok = true;
      for (const c of this.world.colliders) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < (c.r + 1.5) ** 2) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, z };
    }
    return { x: p.x + 60, z: p.z };
  }

  private spawnSoldier() {
    const spec = this.node.enemy;
    const archer = Math.random() < spec.archerRatio;
    const s = createSoldier(spec, archer);
    const pos = this.spawnPos();
    s.group.position.set(pos.x, heightAt(pos.x, pos.z), pos.z);
    this.world.scene.add(s.group);
    this.soldiers.push(s);
  }

  // ---------------- projectiles ----------------
  private initProjectiles() {
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshStandardMaterial({ color: 0x9a9080 });
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x6e5636 });
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const friendly = i < MAX_PROJECTILES / 2;
      const mesh = new THREE.Mesh(boltGeo, friendly ? boltMat : arrowMat);
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.projectiles.push({
        mesh,
        vel: new THREE.Vector3(),
        alive: false,
        friendly,
        damage: 0,
        life: 0,
      });
    }
  }

  private fireProjectile(from: THREE.Vector3, dir: THREE.Vector3, speed: number, friendly: boolean, damage: number) {
    const p = this.projectiles.find((q) => !q.alive && q.friendly === friendly);
    if (!p) return;
    p.alive = true;
    p.mesh.visible = true;
    p.mesh.position.copy(from);
    p.vel.copy(dir).multiplyScalar(speed);
    p.mesh.lookAt(from.clone().add(dir));
    p.damage = damage;
    p.life = 4;
  }

  private updateProjectiles(dt: number) {
    const ppos = this.player.position;
    const prev = new THREE.Vector3();
    const seg = new THREE.Vector3();
    const toPt = new THREE.Vector3();
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.life -= dt;
      p.vel.y -= (p.friendly ? 2.2 : 6.5) * dt;
      prev.copy(p.mesh.position);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
      const mp = p.mesh.position;
      const groundY = heightAt(mp.x, mp.z);
      if (p.life <= 0 || mp.y <= groundY + 0.05) {
        p.alive = false;
        p.mesh.visible = false;
        continue;
      }
      // swept segment-vs-sphere so fast bolts can't tunnel through targets
      seg.copy(mp).sub(prev);
      const segLen2 = seg.lengthSq() || 1e-8;
      const hitsAt = (px: number, py: number, pz: number, r: number): boolean => {
        toPt.set(px - prev.x, py - prev.y, pz - prev.z);
        const t = THREE.MathUtils.clamp(toPt.dot(seg) / segLen2, 0, 1);
        const cx = prev.x + seg.x * t - px;
        const cy = prev.y + seg.y * t - py;
        const cz = prev.z + seg.z * t - pz;
        return cx * cx + cy * cy + cz * cz < r * r;
      };
      if (p.friendly) {
        // vs soldiers
        for (const s of this.soldiers) {
          if (!s.alive) continue;
          const sp = s.group.position;
          if (hitsAt(sp.x, sp.y + 1.15, sp.z, 0.85) || hitsAt(sp.x, sp.y + 0.5, sp.z, 0.6)) {
            p.alive = false;
            p.mesh.visible = false;
            this.onSoldierHit(s, 2, true);
            break;
          }
        }
      } else {
        // vs player
        if (hitsAt(ppos.x, ppos.y + 1.2, ppos.z, 0.7)) {
          p.alive = false;
          p.mesh.visible = false;
          this.hurtPlayer(p.damage);
        }
      }
    }
  }

  private onSoldierHit(s: Soldier, dmg: number, fromBolt: boolean) {
    const killed = hitSoldier(s, dmg);
    if (killed) {
      this.kills++;
      this.score += fromBolt ? 100 : 120;
      this.score += this.wave * 10;
      audio.play("kill", 0.7);
      this.cbs.onEvent({ type: "kill", text: `${this.node.enemy.zh} soldier down` });
      this.checkObjectiveProgress();
    } else {
      audio.play("hit", 0.6);
    }
    this.cbs.onEvent({ type: "hitmark" });
  }

  private hurtPlayer(dmg: number) {
    const died = this.player.hurt(dmg, this.elapsed);
    audio.play("hurt", 0.8);
    this.cbs.onEvent({ type: "playerHurt" });
    if (died) this.finish(false);
  }

  private checkObjectiveProgress() {
    if (this.ended) return;
    if (this.node.objective === "eliminate" && this.kills >= this.node.target) {
      this.finish(true);
    }
  }

  private finish(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    audio.stopAmbience();
    if (victory) audio.play("horn", 1);
    document.exitPointerLock?.();
    const result: GameResult = {
      nodeId: this.node.id,
      nodeName: this.node.name,
      victory,
      kills: this.kills,
      score: this.score + (victory ? 500 : 0),
      timeSec: Math.round(this.elapsed),
      wavesCleared: this.node.objective === "survive" ? this.wave - (this.waveActive ? 1 : 0) : undefined,
    };
    // brief delay so the final kill/hurt registers visually
    setTimeout(() => this.cbs.onEnd(result), victory ? 900 : 1400);
  }

  // ---------------- input ----------------
  private loadSens(): number {
    try {
      return parseFloat(localStorage.getItem("dq_sens") || "1") || 1;
    } catch {
      return 1;
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === "KeyQ") this.input.switchWeapon = true;
    if (e.code === "Digit1") {
      if (this.player.weapon !== "crossbow") this.input.switchWeapon = true;
    }
    if (e.code === "Digit2") {
      if (this.player.weapon !== "sword") this.input.switchWeapon = true;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.input.lookDX += e.movementX;
    this.input.lookDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.paused || this.ended) return;
    if (!this.pointerLocked && !this.isTouch) {
      this.canvas.requestPointerLock?.();
      return;
    }
    if (e.button === 0) this.input.fire = true;
    if (e.button === 2) this.input.aim = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) this.input.aim = false;
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked && !this.isTouch && !this.paused && !this.ended && this.running) {
      this.cbs.onPauseRequest();
    }
  };

  private onContext = (e: Event) => e.preventDefault();

  private bindInput() {
    this.isTouch = "ontouchstart" in window && navigator.maxTouchPoints > 0;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.addEventListener("contextmenu", this.onContext);
  }

  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  // touch HUD drives these
  setTouchMove(x: number, y: number) {
    this.input.moveX = x;
    this.input.moveY = y;
  }
  addTouchLook(dx: number, dy: number) {
    this.input.lookDX += dx * 2.2;
    this.input.lookDY += dy * 2.2;
  }
  touchFire() {
    this.input.fire = true;
  }
  touchAim(on: boolean) {
    this.input.aim = on;
  }
  touchSwitch() {
    this.input.switchWeapon = true;
  }
  touchJump() {
    this.keys.add("Space");
    setTimeout(() => this.keys.delete("Space"), 120);
  }
  relockPointer() {
    if (!this.isTouch) this.canvas.requestPointerLock?.();
  }
  get touchDevice() {
    return this.isTouch;
  }
  setSensitivity(v: number) {
    this.player.sensitivity = v;
  }

  // ---------------- main loop ----------------
  private loop = () => {
    if (!this.running || this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.05) dt = 0.05;
    if (this.paused || this.ended) {
      this.renderer.render(this.world.scene, this.player.camera);
      return;
    }
    this.elapsed = (now - this.startTime) / 1000;

    // gather held-key movement (desktop)
    if (!this.isTouch) {
      this.input.moveX = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
      this.input.moveY = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    }
    this.input.sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.input.jump = this.keys.has("Space");

    // fire / melee
    if (this.input.fire) {
      const res = this.player.tryFire();
      if (res === "bolt") {
        const dir = new THREE.Vector3();
        this.player.camera.getWorldDirection(dir);
        const from = this.player.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.4);
        this.fireProjectile(from, dir, BOLT_SPEED, true, 2);
        audio.play("shot", 0.9);
      } else if (res === "dry") {
        this.cbs.onEvent({ type: "dryFire" });
      } else if (res === "swing") {
        audio.play("swing", 0.8);
      }
    }
    // sword damage window
    if (this.player.weapon === "sword" && this.player.swordHitActive()) {
      const fwd = new THREE.Vector3();
      this.player.camera.getWorldDirection(fwd);
      for (const s of this.soldiers) {
        if (!s.alive || s.group.userData.swungThisSwing === this.player["swordT"]) continue;
        const to = s.group.position.clone().sub(this.player.position);
        to.y = 0;
        const d = to.length();
        if (d < 2.6 && to.normalize().dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) > 0.4) {
          if (s.group.userData.lastSwing !== Math.round(this.player["swordT"] * 100)) {
            s.group.userData.lastSwing = Math.round(this.player["swordT"] * 100);
            this.onSoldierHit(s, 2, false);
          }
        }
      }
    }

    this.player.update(dt, this.input, this.world.colliders, this.elapsed);
    this.input.fire = false;
    this.input.switchWeapon = false;
    this.input.lookDX = 0;
    this.input.lookDY = 0;

    // soldiers
    const ctx = {
      playerPos: new THREE.Vector3(
        this.player.position.x,
        this.player.position.y + 1.2,
        this.player.position.z
      ),
      colliders: this.world.colliders,
      onMeleeHit: (dmg: number) => this.hurtPlayer(dmg),
      onShoot: (from: THREE.Vector3, dir: THREE.Vector3, dmg: number) => {
        this.fireProjectile(from, dir, ARROW_SPEED, false, dmg);
        audio.play("shot", 0.25, 0.7);
      },
    };
    for (const s of this.soldiers) updateSoldier(s, dt, ctx);

    // cheap separation
    const alive = this.soldiers.filter((s) => s.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i].group.position;
        const b = alive[j].group.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = ((1.1 - d) / d) * 0.5;
          a.x -= dx * push * 0.5;
          a.z -= dz * push * 0.5;
          b.x += dx * push * 0.5;
          b.z += dz * push * 0.5;
        }
      }
    }

    // cleanup fully-sunk corpses
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      if (!s.alive && s.dying > 4) {
        this.world.scene.remove(s.group);
        this.soldiers.splice(i, 1);
      }
    }

    this.updateProjectiles(dt);

    // objective bookkeeping
    if (this.node.objective === "survive" && this.waveActive) {
      const anyAlive = this.soldiers.some((s) => s.alive);
      if (!anyAlive && this.spawnQueue <= 0) {
        this.waveActive = false;
        if (this.wave >= this.node.target) {
          this.finish(true);
        } else {
          this.score += 250;
          setTimeout(() => {
            if (!this.ended && !this.paused) this.startWave(this.wave + 1);
          }, 2500);
        }
      } else {
        this.refillField();
      }
    } else if (this.node.objective === "eliminate") {
      this.refillField();
    } else if (this.node.objective === "hold") {
      const bp = this.world.bannerPos;
      const dx = this.player.position.x - bp.x;
      const dz = this.player.position.z - bp.z;
      const near = dx * dx + dz * dz < 15 * 15;
      if (near) {
        this.holdTime += dt;
        this.score += Math.round(dt * 10);
      }
      this.refillField();
      if (this.holdTime >= this.node.target) this.finish(true);
    }

    animateWorld(this.world, this.elapsed);

    // shadow camera follows the player
    const pp = this.player.position;
    this.world.sun.position.set(pp.x + 60, 120, pp.z - 80);
    this.world.sun.target.position.set(pp.x, 0, pp.z);
    this.world.sun.target.updateMatrixWorld();

    this.renderer.render(this.world.scene, this.player.camera);

    // HUD snapshot at ~12 Hz
    this.snapTimer += dt;
    if (this.snapTimer > 0.08) {
      this.snapTimer = 0;
      this.pushSnapshot();
    }
  };

  private pushSnapshot() {
    const snap = this.snapshot;
    snap.health = Math.round(this.player.health);
    snap.weapon = this.player.weapon;
    snap.boltReady = this.player.boltReady;
    snap.reloadPct = this.player.boltReady ? 1 : this.player.reloadT / this.player.reloadDur;
    snap.aiming = this.player.aiming;
    snap.score = this.score;
    snap.kills = this.kills;
    snap.wave = this.wave;
    snap.holdPct = Math.min(1, this.holdTime / this.node.target);
    const yaw = -this.player.yawObj.rotation.y;
    snap.compassDeg = ((yaw * 180) / Math.PI % 360 + 360) % 360;
    snap.playerPos = { x: this.player.position.x, z: this.player.position.z };
    snap.timeSec = Math.round(this.elapsed);
    snap.enemies = this.soldiers
      .filter((s) => s.alive)
      .map((s) => ({ x: s.group.position.x, z: s.group.position.z, alive: true }));
    this.cbs.onSnapshot({ ...snap });
  }
}
