import * as THREE from "three";
import { heightAt } from "./noise";

export interface PlayerInput {
  moveX: number; // -1..1 strafe
  moveY: number; // -1..1 forward
  lookDX: number;
  lookDY: number;
  sprint: boolean;
  jump: boolean;
  fire: boolean; // edge-triggered
  aim: boolean; // held
  melee: boolean; // edge
  switchWeapon: boolean; // edge
}

export const emptyInput = (): PlayerInput => ({
  moveX: 0,
  moveY: 0,
  lookDX: 0,
  lookDY: 0,
  sprint: false,
  jump: false,
  fire: false,
  aim: false,
  melee: false,
  switchWeapon: false,
});

const EYE = 1.66;

function box(w: number, h: number, d: number, color: number, rough = 0.7): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.15 })
  );
}

function buildCrossbow(): THREE.Group {
  const g = new THREE.Group();
  const stock = box(0.05, 0.07, 0.62, 0x4a3626, 0.8);
  const latch = box(0.06, 0.05, 0.1, 0x8a8578, 0.4);
  latch.position.set(0, 0.05, 0.05);
  // composite bow arms at front
  const armGeo = new THREE.BoxGeometry(0.3, 0.03, 0.05);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x5c4832, roughness: 0.8 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(0.16, 0.02, -0.3);
  armL.rotation.y = -0.45;
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(-0.16, 0.02, -0.3);
  armR.rotation.y = 0.45;
  // string
  const stringGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.28, 0.02, -0.22),
    new THREE.Vector3(0, 0.02, -0.14),
    new THREE.Vector3(-0.28, 0.02, -0.22),
  ]);
  const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xd8d0bc }));
  // loaded bolt
  const bolt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.34, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a8070 })
  );
  bolt.rotation.x = Math.PI / 2;
  bolt.position.set(0, 0.035, -0.18);
  bolt.name = "bolt";
  g.add(stock, latch, armL, armR, string, bolt);
  return g;
}

function buildSword(): THREE.Group {
  // jian — straight double-edged bronze sword
  const g = new THREE.Group();
  const blade = box(0.035, 0.006, 0.62, 0xc8b888, 0.3);
  blade.position.z = -0.42;
  const guard = box(0.1, 0.03, 0.04, 0x6e5a30, 0.5);
  guard.position.z = -0.11;
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.9 })
  );
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0;
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a7a40, roughness: 0.4, metalness: 0.6 })
  );
  pommel.position.z = 0.09;
  g.add(blade, guard, grip, pommel);
  return g;
}

export class Player {
  yawObj = new THREE.Object3D();
  pitchObj = new THREE.Object3D();
  camera: THREE.PerspectiveCamera;
  health = 100;
  maxHealth = 100;
  weapon: "crossbow" | "sword" = "crossbow";
  aiming = false;
  boltReady = true;
  reloadT = 0;
  reloadDur = 1.25;
  swordT = 0; // swing timer
  swordCd = 0;
  velY = 0;
  grounded = true;
  bobPhase = 0;
  recoil = 0;
  lastHurt = -99;
  sensitivity = 1;
  dead = false;

  private crossbow: THREE.Group;
  private sword: THREE.Group;
  private velX = 0;
  private velZ = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.08, 1200);
    this.yawObj.add(this.pitchObj);
    this.pitchObj.add(this.camera);
    this.pitchObj.position.y = EYE;

    this.crossbow = buildCrossbow();
    this.crossbow.scale.setScalar(0.55);
    this.crossbow.position.set(0.17, -0.14, -0.32);
    this.crossbow.rotation.y = 0.04;
    this.camera.add(this.crossbow);

    this.sword = buildSword();
    this.sword.scale.setScalar(0.7);
    this.sword.position.set(0.24, -0.22, -0.42);
    this.sword.rotation.set(0.3, -0.2, 0.5);
    this.sword.visible = false;
    this.camera.add(this.sword);
  }

  get position(): THREE.Vector3 {
    return this.yawObj.position;
  }

  spawn(x: number, z: number) {
    this.yawObj.position.set(x, heightAt(x, z), z);
    this.yawObj.rotation.y = Math.atan2(-x, -z); // face center
    this.pitchObj.rotation.x = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.weapon = "crossbow";
    this.boltReady = true;
    this.reloadT = 0;
    this.velY = 0;
  }

  hurt(dmg: number, now: number): boolean {
    if (this.dead) return false;
    this.health = Math.max(0, this.health - dmg);
    this.lastHurt = now;
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }

  update(dt: number, input: PlayerInput, colliders: { x: number; z: number; r: number }[], now: number) {
    if (this.dead) return;

    // health regen (CoD-style)
    if (now - this.lastHurt > 5 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 14 * dt);
    }

    // look
    const sens = 0.0022 * this.sensitivity * (this.aiming ? 0.55 : 1);
    this.yawObj.rotation.y -= input.lookDX * sens;
    this.pitchObj.rotation.x = THREE.MathUtils.clamp(
      this.pitchObj.rotation.x - input.lookDY * sens,
      -1.35,
      1.35
    );

    // weapon switch
    if (input.switchWeapon) {
      this.weapon = this.weapon === "crossbow" ? "sword" : "crossbow";
      this.aiming = false;
    }
    this.crossbow.visible = this.weapon === "crossbow";
    this.sword.visible = this.weapon === "sword";

    // aim
    this.aiming = this.weapon === "crossbow" && input.aim;
    const targetFov = this.aiming ? 46 : 72;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // reload
    if (!this.boltReady) {
      this.reloadT += dt;
      if (this.reloadT >= this.reloadDur) {
        this.boltReady = true;
        this.reloadT = 0;
      }
    }
    const bolt = this.crossbow.getObjectByName("bolt");
    if (bolt) bolt.visible = this.boltReady;

    // movement
    const speed = (input.sprint && input.moveY > 0.1 ? 9.2 : 5.6) * (this.aiming ? 0.5 : 1);
    const sin = Math.sin(this.yawObj.rotation.y);
    const cos = Math.cos(this.yawObj.rotation.y);
    const wishX = (input.moveX * cos - input.moveY * sin) * speed;
    const wishZ = (-input.moveX * sin - input.moveY * cos) * speed;
    const accel = this.grounded ? 14 : 4;
    this.velX += (wishX - this.velX) * Math.min(1, accel * dt);
    this.velZ += (wishZ - this.velZ) * Math.min(1, accel * dt);

    let nx = this.yawObj.position.x + this.velX * dt;
    let nz = this.yawObj.position.z + this.velZ * dt;
    for (const c of colliders) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < c.r + 0.55 && d > 0.0001) {
        nx = c.x + (dx / d) * (c.r + 0.55);
        nz = c.z + (dz / d) * (c.r + 0.55);
      }
    }
    nx = THREE.MathUtils.clamp(nx, -252, 252);
    nz = THREE.MathUtils.clamp(nz, -252, 252);
    this.yawObj.position.x = nx;
    this.yawObj.position.z = nz;

    // vertical
    const groundY = heightAt(nx, nz);
    if (input.jump && this.grounded) {
      this.velY = 6.8;
      this.grounded = false;
    }
    this.velY -= 19 * dt;
    let y = this.yawObj.position.y + this.velY * dt;
    if (y <= groundY) {
      y = groundY;
      this.velY = 0;
      this.grounded = true;
    }
    this.yawObj.position.y = y;

    // head bob
    const speedNow = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
    if (this.grounded && speedNow > 1) {
      this.bobPhase += dt * speedNow * 1.6;
      this.pitchObj.position.y = EYE + Math.sin(this.bobPhase * 2) * 0.035;
    } else {
      this.pitchObj.position.y += (EYE - this.pitchObj.position.y) * Math.min(1, dt * 6);
    }

    // recoil recovery + view model sway
    this.recoil = Math.max(0, this.recoil - dt * 5);
    const sway = Math.sin(this.bobPhase) * 0.006 * (speedNow > 1 ? 1 : 0.3);
    if (this.weapon === "crossbow") {
      const aimPos = this.aiming ? { x: 0, y: -0.092, z: -0.24 } : { x: 0.17, y: -0.14, z: -0.32 };
      this.crossbow.position.x += (aimPos.x + sway - this.crossbow.position.x) * Math.min(1, dt * 12);
      this.crossbow.position.y += (aimPos.y - this.crossbow.position.y) * Math.min(1, dt * 12);
      this.crossbow.position.z += (aimPos.z + this.recoil * 0.12 - this.crossbow.position.z) * Math.min(1, dt * 14);
      // reload dip
      if (!this.boltReady) {
        const t = this.reloadT / this.reloadDur;
        this.crossbow.position.y -= Math.sin(t * Math.PI) * 0.09;
        this.crossbow.rotation.x = Math.sin(t * Math.PI) * 0.35;
      } else {
        this.crossbow.rotation.x = this.recoil * 0.5;
      }
    } else {
      this.swordCd = Math.max(0, this.swordCd - dt);
      if (this.swordT > 0) {
        this.swordT -= dt;
        const t = 1 - this.swordT / 0.38;
        // arc swing: right-high to left-low
        this.sword.rotation.z = 0.9 - t * 2.2;
        this.sword.rotation.y = -0.5 + t * 0.9;
        this.sword.position.x = 0.34 - t * 0.5;
        this.sword.position.y = -0.18 - Math.sin(t * Math.PI) * 0.1;
      } else {
        this.sword.position.set(0.28 + sway, -0.26, -0.5);
        this.sword.rotation.set(0.3, -0.2, 0.5);
      }
    }
  }

  tryFire(): "bolt" | "dry" | "swing" | null {
    if (this.dead) return null;
    if (this.weapon === "crossbow") {
      if (!this.boltReady) return "dry";
      this.boltReady = false;
      this.reloadT = 0;
      this.recoil = 1;
      return "bolt";
    }
    if (this.swordCd > 0) return null;
    this.swordT = 0.38;
    this.swordCd = 0.55;
    return "swing";
  }

  // sword active hit window check
  swordHitActive(): boolean {
    return this.swordT > 0.1 && this.swordT < 0.3;
  }
}
