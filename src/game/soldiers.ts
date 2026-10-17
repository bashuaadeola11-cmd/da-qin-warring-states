import * as THREE from "three";
import { heightAt } from "./noise";
import type { FactionSpec } from "./types";

export interface Soldier {
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armR: THREE.Group;
  alive: boolean;
  dying: number; // seconds since death, -1 = alive
  hp: number;
  archer: boolean;
  speed: number;
  damage: number;
  walkPhase: number;
  attackCd: number;
  windup: number; // >0 while winding up a melee strike
  shootCd: number;
  strafeDir: number;
  strafeT: number;
}

export interface AiContext {
  playerPos: THREE.Vector3;
  colliders: { x: number; z: number; r: number }[];
  onMeleeHit: (damage: number) => void;
  onShoot: (from: THREE.Vector3, dir: THREE.Vector3, damage: number) => void;
}

// shared geometry cache
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const matCache = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    matCache.set(color, m);
  }
  return m;
}

function buildHelmet(kind: FactionSpec["helmet"], headY: number): THREE.Object3D {
  switch (kind) {
    case "tribal": {
      // horned skull cap
      const g = new THREE.Group();
      const cap = new THREE.Mesh(geo("helmetTribal", () => new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)), mat(0x8a7a52));
      const hornGeo = geo("horn", () => new THREE.ConeGeometry(0.05, 0.3, 5));
      const h1 = new THREE.Mesh(hornGeo, mat(0xe8dcc0));
      h1.position.set(0.18, 0.12, 0);
      h1.rotation.z = -0.7;
      const h2 = h1.clone();
      h2.position.x = -0.18;
      h2.rotation.z = 0.7;
      g.add(cap, h1, h2);
      g.position.y = headY + 0.1;
      return g;
    }
    case "bronze": {
      const h = new THREE.Mesh(geo("helmetBronze", () => new THREE.ConeGeometry(0.2, 0.28, 8)), mat(0x6e6a4a));
      h.position.y = headY + 0.16;
      return h;
    }
    case "qinsoldier": {
      const h = new THREE.Mesh(geo("helmetQin", () => new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8)), mat(0x2e2a26));
      h.position.y = headY + 0.14;
      return h;
    }
    case "terracotta": {
      // topknot
      const g = new THREE.Group();
      const band = new THREE.Mesh(geo("helmetTerra", () => new THREE.CylinderGeometry(0.19, 0.19, 0.08, 8)), mat(0x6e5844));
      const knot = new THREE.Mesh(geo("knot", () => new THREE.SphereGeometry(0.07, 6, 5)), mat(0x5c4a3a));
      knot.position.set(0.06, 0.22, 0);
      g.add(band, knot);
      g.position.y = headY + 0.12;
      return g;
    }
    case "fur": {
      const h = new THREE.Mesh(geo("helmetFur", () => new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8)), mat(0x4a3a2a));
      h.position.y = headY + 0.08;
      return h;
    }
  }
}

function buildWeapon(archer: boolean): THREE.Object3D {
  if (archer) {
    const g = new THREE.Group();
    const bow = new THREE.Mesh(
      geo("bow", () => new THREE.TorusGeometry(0.55, 0.035, 5, 12, Math.PI)),
      mat(0x54432e)
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 2;
    g.add(bow);
    return g;
  }
  // ge halberd: long pole + dagger-axe blade
  const g = new THREE.Group();
  const pole = new THREE.Mesh(geo("gePole", () => new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6)), mat(0x54432e));
  const blade = new THREE.Mesh(geo("geBlade", () => new THREE.BoxGeometry(0.3, 0.08, 0.04)), mat(0x9a948a));
  blade.position.set(0.14, 1.2, 0);
  const tip = new THREE.Mesh(geo("geTip", () => new THREE.ConeGeometry(0.05, 0.28, 5)), mat(0x9a948a));
  tip.position.y = 1.44;
  g.add(pole, blade, tip);
  return g;
}

export function createSoldier(spec: FactionSpec, archer: boolean): Soldier {
  const group = new THREE.Group();
  const armor = mat(spec.armorColor);
  const cloth = mat(spec.clothColor);
  const skin = mat(spec.skinTone);

  const legGeo = geo("leg", () => new THREE.BoxGeometry(0.22, 0.8, 0.24));
  legGeo.translate(0, -0.4, 0);
  const legL = new THREE.Mesh(legGeo, cloth);
  legL.position.set(0.14, 0.8, 0);
  const legR = new THREE.Mesh(legGeo, cloth);
  legR.position.set(-0.14, 0.8, 0);

  const torso = new THREE.Mesh(geo("torso", () => new THREE.BoxGeometry(0.62, 0.72, 0.36)), armor);
  torso.position.y = 1.16;
  const skirt = new THREE.Mesh(geo("skirt", () => new THREE.CylinderGeometry(0.34, 0.44, 0.36, 8)), cloth);
  skirt.position.y = 0.72;

  const head = new THREE.Mesh(geo("head", () => new THREE.BoxGeometry(0.3, 0.32, 0.3)), skin);
  head.position.y = 1.7;
  const helmet = buildHelmet(spec.helmet, 1.7);

  const armR = new THREE.Group();
  const armMesh = new THREE.Mesh(geo("arm", () => new THREE.BoxGeometry(0.16, 0.62, 0.18)), skin);
  armMesh.position.y = -0.26;
  armR.add(armMesh);
  const weapon = buildWeapon(archer);
  weapon.position.set(0, -0.5, 0.15);
  if (!archer) weapon.rotation.x = Math.PI / 2.4;
  armR.add(weapon);
  armR.position.set(0.42, 1.44, 0);

  const armL = new THREE.Mesh(geo("arm", () => new THREE.BoxGeometry(0.16, 0.62, 0.18)), skin);
  armL.position.set(-0.42, 1.24, 0);

  group.add(legL, legR, torso, skirt, head, helmet, armR, armL);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  return {
    group,
    legL,
    legR,
    armR,
    alive: true,
    dying: -1,
    hp: spec.hp,
    archer,
    speed: spec.speed * (0.9 + Math.random() * 0.25),
    damage: spec.damage,
    walkPhase: Math.random() * 10,
    attackCd: 0,
    windup: 0,
    shootCd: 1.5 + Math.random() * 2,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeT: 2 + Math.random() * 3,
  };
}

const MELEE_RANGE = 2.4;
const ARCHER_RANGE = 30;
const tmpDir = new THREE.Vector3();

export function updateSoldier(s: Soldier, dt: number, ctx: AiContext) {
  const g = s.group;

  if (!s.alive) {
    // death: tip over, sink after a moment
    s.dying += dt;
    if (s.dying < 0.7) {
      g.rotation.x = -Math.min(1, s.dying / 0.5) * (Math.PI / 2) * 0.96;
    } else if (s.dying > 2.2) {
      g.position.y -= dt * 0.6;
    }
    return;
  }

  const dx = ctx.playerPos.x - g.position.x;
  const dz = ctx.playerPos.z - g.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const targetRange = s.archer ? ARCHER_RANGE * (0.7 + (s.strafeDir + 1) * 0.15) : MELEE_RANGE * 0.8;

  // face the player
  g.rotation.y = Math.atan2(dx, dz);

  let moveX = 0;
  let moveZ = 0;
  if (dist > targetRange + 0.5) {
    moveX = dx / dist;
    moveZ = dz / dist;
  } else if (s.archer && dist < ARCHER_RANGE * 0.45) {
    moveX = -dx / dist;
    moveZ = -dz / dist; // back away
  } else {
    // strafe around player
    s.strafeT -= dt;
    if (s.strafeT <= 0) {
      s.strafeT = 2 + Math.random() * 3;
      s.strafeDir *= -1;
    }
    moveX = (-dz / dist) * s.strafeDir * 0.5;
    moveZ = (dx / dist) * s.strafeDir * 0.5;
  }

  // separation from handled by engine (cheap pass)
  const sp = s.speed * (s.windup > 0 ? 0.15 : 1);
  let nx = g.position.x + moveX * sp * dt;
  let nz = g.position.z + moveZ * sp * dt;

  // collide with world circles
  for (const c of ctx.colliders) {
    const cdx = nx - c.x;
    const cdz = nz - c.z;
    const cd = Math.sqrt(cdx * cdx + cdz * cdz);
    if (cd < c.r + 0.5 && cd > 0.0001) {
      nx = c.x + (cdx / cd) * (c.r + 0.5);
      nz = c.z + (cdz / cd) * (c.r + 0.5);
    }
  }
  // stay in bounds
  nx = Math.max(-250, Math.min(250, nx));
  nz = Math.max(-250, Math.min(250, nz));
  g.position.x = nx;
  g.position.z = nz;
  g.position.y = heightAt(nx, nz);

  // walk animation
  const moving = Math.abs(moveX) + Math.abs(moveZ) > 0.05;
  if (moving) {
    s.walkPhase += dt * s.speed * 2.2;
    s.legL.rotation.x = Math.sin(s.walkPhase) * 0.55;
    s.legR.rotation.x = -Math.sin(s.walkPhase) * 0.55;
  } else {
    s.legL.rotation.x *= 0.8;
    s.legR.rotation.x *= 0.8;
  }

  // combat
  if (s.archer) {
    s.shootCd -= dt;
    s.armR.rotation.x = -Math.PI / 2 + 0.2; // aim pose
    if (s.shootCd <= 0 && dist < ARCHER_RANGE * 1.4 && dist > 3) {
      s.shootCd = 2.6 + Math.random() * 1.6;
      tmpDir.set(dx, 0, dz);
      // lead + arc: aim at chest with slight elevation by distance
      const from = new THREE.Vector3(g.position.x, g.position.y + 1.5, g.position.z);
      const to = new THREE.Vector3(ctx.playerPos.x, ctx.playerPos.y - 0.2 + dist * 0.045, ctx.playerPos.z);
      const dir = to.sub(from).normalize();
      ctx.onShoot(from, dir, s.damage);
    }
  } else {
    s.attackCd -= dt;
    if (s.windup > 0) {
      s.windup -= dt;
      s.armR.rotation.x = -2.4 + (0.5 - s.windup) * 6; // swing down
      if (s.windup <= 0) {
        if (dist < MELEE_RANGE + 0.4) ctx.onMeleeHit(s.damage);
        s.attackCd = 1.1 + Math.random() * 0.7;
      }
    } else if (dist < MELEE_RANGE && s.attackCd <= 0) {
      s.windup = 0.5; // half-second telegraph
      s.armR.rotation.x = -2.4; // raise weapon
    } else {
      s.armR.rotation.x = moving ? Math.sin(s.walkPhase) * 0.3 - 0.2 : -0.2;
    }
  }
}

export function hitSoldier(s: Soldier, dmg: number): boolean {
  if (!s.alive) return false;
  s.hp -= dmg;
  if (s.hp <= 0) {
    s.alive = false;
    s.dying = 0;
    return true;
  }
  // flinch
  s.group.position.y += 0.08;
  return false;
}
