import * as THREE from "three";
import { heightAt, fbm } from "./noise";
import type { BattleNode } from "./types";

export interface WorldRefs {
  scene: THREE.Scene;
  colliders: { x: number; z: number; r: number }[];
  structures: { x: number; z: number; kind: string }[];
  bannerPos: THREE.Vector3;
  fireParticles: THREE.Points[];
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  flames: { x: number; y: number; z: number }[];
  banners: THREE.Mesh[];
}

const WORLD_SIZE = 520;

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- sky dome ----------
function buildSky(node: BattleNode): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(node.skyTop) },
      horizonColor: { value: new THREE.Color(node.skyHorizon) },
      sunDir: { value: new THREE.Vector3(0.4, 0.35, -0.6).normalize() },
      sunColor: { value: new THREE.Color(node.sunColor) },
      night: { value: node.timeOfDay === "night" ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor, horizonColor, sunColor, sunDir;
      uniform float night;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.6));
        float sun = pow(max(dot(vDir, sunDir), 0.0), 350.0);
        col += sunColor * sun * 2.0;
        float glow = pow(max(dot(vDir, sunDir), 0.0), 6.0);
        col += sunColor * glow * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  return sky;
}

// ---------- terrain ----------
function buildTerrain(): THREE.Mesh {
  const seg = 140;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x5a6636);
  const grassDry = new THREE.Color(0x7a7444);
  const dirt = new THREE.Color(0x6e5c40);
  const rock = new THREE.Color(0x5f5a50);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.05, z * 0.05, 3);
    if (h > 16) tmp.copy(rock);
    else if (h > 8) tmp.copy(rock).lerp(dirt, 0.6);
    else tmp.copy(grass).lerp(grassDry, n);
    // trampled battle circle at center
    const d = Math.sqrt(x * x + z * z);
    if (d < 55) tmp.lerp(dirt, 0.55 * (1 - d / 55));
    tmp.multiplyScalar(0.92 + n * 0.16);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- great wall ----------
function buildGreatWall(scene: THREE.Scene, colliders: WorldRefs["colliders"], structures: WorldRefs["structures"]) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7f6c, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x6e6557, roughness: 0.9 });
  const blockGeo = new THREE.BoxGeometry(12, 7, 6);
  const towerGeo = new THREE.BoxGeometry(10, 14, 10);
  const roofGeo = new THREE.ConeGeometry(8.5, 4, 4);
  for (let x = -250; x <= 250; x += 12) {
    const z = -190 + Math.sin(x * 0.02) * 14;
    const y = heightAt(x, z);
    const b = new THREE.Mesh(blockGeo, wallMat);
    b.position.set(x, y + 3, z);
    b.castShadow = true;
    scene.add(b);
    if (Math.abs(x % 48) < 6) {
      const t = new THREE.Mesh(towerGeo, darkMat);
      t.position.set(x, y + 6, z);
      t.castShadow = true;
      scene.add(t);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x3c4a42, roughness: 0.8 }));
      roof.position.set(x, y + 15, z);
      roof.rotation.y = Math.PI / 4;
      scene.add(roof);
      colliders.push({ x, z, r: 7 });
      structures.push({ x, z, kind: "tower" });
    } else {
      colliders.push({ x, z, r: 6.5 });
    }
  }
}

// ---------- props ----------
function buildTents(scene: THREE.Scene, colliders: WorldRefs["colliders"], structures: WorldRefs["structures"]) {
  const tentGeo = new THREE.ConeGeometry(3.4, 3.6, 8);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.4);
  const qinMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.85 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28 });
  const spots: [number, number][] = [
    [-46, 30], [-38, 44], [-54, 48], [-30, 58], [-48, 64], [-62, 34],
  ];
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    const tent = new THREE.Mesh(tentGeo, qinMat);
    tent.position.set(x, y + 1.8, z);
    tent.castShadow = true;
    scene.add(tent);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, y + 2.2, z);
    scene.add(pole);
    colliders.push({ x, z, r: 3.2 });
    structures.push({ x, z, kind: "tent" });
  }
}

function buildWatchtowers(scene: THREE.Scene, colliders: WorldRefs["colliders"], structures: WorldRefs["structures"]) {
  const legMat = new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 0.9 });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x6b563a, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x39473f, roughness: 0.85 });
  const spots: [number, number][] = [[-70, -40], [74, -30], [40, 90]];
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    const g = new THREE.Group();
    for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 11), legMat);
      leg.position.set(lx, 5.5, lz);
      g.add(leg);
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 6.4), platMat);
    plat.position.y = 11;
    g.add(plat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1, 6.6), legMat);
    rail.position.y = 11.8;
    g.add(rail);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.6, 4), roofMat);
    roof.position.y = 14.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    g.position.set(x, y, z);
    scene.add(g);
    colliders.push({ x, z, r: 3.4 });
    structures.push({ x, z, kind: "tower" });
  }
}

export function makeBannerTexture(zh: string, bg: string, fg: string): THREE.CanvasTexture {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, s - 20, s - 20);
    ctx.fillStyle = fg;
    ctx.font = `bold ${s * 0.52}px "Ma Shan Zheng", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(zh, s / 2, s / 2 + 6);
  });
}

function buildBanners(scene: THREE.Scene, banners: THREE.Mesh[]) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2e20 });
  const tex = makeBannerTexture("秦", "#1e1a16", "#c03a28");
  const flagGeo = new THREE.PlaneGeometry(2.4, 3.2, 6, 6);
  const spots: [number, number][] = [
    [-14, -8], [16, -12], [-40, 22], [52, 18], [0, -60], [-24, 74], [70, -60],
  ];
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9), poleMat);
    pole.position.set(x, y + 4.5, z);
    scene.add(pole);
    const flag = new THREE.Mesh(
      flagGeo.clone(),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })
    );
    flag.position.set(x + 1.3, y + 7, z);
    flag.userData.phase = Math.random() * Math.PI * 2;
    scene.add(flag);
    banners.push(flag);
  }
}

function buildPalace(scene: THREE.Scene, structures: WorldRefs["structures"]) {
  // First Emperor's palace silhouette in the far north-west distance
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x7a6f5e, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8f8272, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2f3b35, roughness: 0.8 });
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 44), baseMat);
  base.position.y = 5;
  g.add(base);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(40, 9, 28), wallMat);
  hall.position.y = 14.5;
  g.add(hall);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 3.5, 36), roofMat);
  roof.position.y = 21;
  g.add(roof);
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(30, 2.6, 20), roofMat);
  roof2.position.y = 25;
  g.add(roof2);
  const x = -150, z = -230;
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  structures.push({ x, z, kind: "palace" });
}

function buildTreesAndRocks(scene: THREE.Scene, colliders: WorldRefs["colliders"], structures: WorldRefs["structures"]) {
  // instanced cypress-like trees
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.6);
  const crownGeo = new THREE.ConeGeometry(1.7, 6.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x33482e, roughness: 1 });
  const count = 90;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const m = new THREE.Matrix4();
  let placed = 0;
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (placed < count) {
    const x = (rand() - 0.5) * 480;
    const z = (rand() - 0.5) * 480;
    const d = Math.sqrt(x * x + z * z);
    if (d < 70 || (z < -160 && z > -230)) continue; // keep arena + wall clear
    const y = heightAt(x, z);
    const s = 0.8 + rand() * 0.9;
    m.makeScale(s, s, s).setPosition(x, y + 1.3 * s, z);
    trunks.setMatrixAt(placed, m);
    m.makeScale(s, s, s).setPosition(x, y + (2.6 + 3.2) * s, z);
    crowns.setMatrixAt(placed, m);
    colliders.push({ x, z, r: 0.9 * s });
    if (placed % 6 === 0) structures.push({ x, z, kind: "tree" });
    placed++;
  }
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  // rocks
  const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7b766c, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 60);
  let rp = 0;
  while (rp < 60) {
    const x = (rand() - 0.5) * 460;
    const z = (rand() - 0.5) * 460;
    const d = Math.sqrt(x * x + z * z);
    if (d < 45) continue;
    const y = heightAt(x, z);
    const s = 0.5 + rand() * 1.8;
    m.makeRotationY(rand() * Math.PI).scale(new THREE.Vector3(s, s * 0.7, s)).setPosition(x, y + s * 0.3, z);
    rocks.setMatrixAt(rp, m);
    if (s > 1.2) colliders.push({ x, z, r: s * 1.1 });
    rp++;
  }
  rocks.castShadow = true;
  scene.add(rocks);
}

// ---------- braziers + fire particles ----------
function buildBraziers(scene: THREE.Scene, flames: WorldRefs["flames"], fireParticles: THREE.Points[]) {
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.7, metalness: 0.5 });
  const spots: [number, number][] = [[-10, -4], [12, -8], [0, 26], [-64, -36], [70, -26], [-150, -195]];
  const lightBudget = 4;
  let li = 0;
  for (const [x, z] of spots) {
    const y = heightAt(x, z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 1.1, 8), bowlMat);
    bowl.position.set(x, y + 0.9, z);
    scene.add(bowl);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1), bowlMat);
    leg.position.set(x, y + 0.3, z);
    scene.add(leg);
    flames.push({ x, y: y + 1.6, z });
    if (li < lightBudget) {
      const l = new THREE.PointLight(0xff7a2a, 12, 18, 2);
      l.position.set(x, y + 2.2, z);
      scene.add(l);
      li++;
    }
    // particles
    const pCount = 26;
    const pg = new THREE.BufferGeometry();
    const arr = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      arr[i * 3] = x + (Math.random() - 0.5) * 0.8;
      arr[i * 3 + 1] = y + 1.4 + Math.random() * 1.6;
      arr[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
    }
    pg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({
      color: 0xffa040,
      size: 0.22,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(pg, pm);
    pts.userData.base = { x, y: y + 1.4, z };
    scene.add(pts);
    fireParticles.push(pts);
  }
}

// broken weapon debris on the field
function buildDebris(scene: THREE.Scene) {
  const spearGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 1 });
  const inst = new THREE.InstancedMesh(spearGeo, mat, 40);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 160;
    const z = (Math.random() - 0.5) * 160;
    const y = heightAt(x, z);
    e.set(Math.PI / 2 + (Math.random() - 0.5) * 0.4, 0, Math.random() * Math.PI);
    m.makeRotationFromEuler(e).setPosition(x, y + 0.15, z);
    inst.setMatrixAt(i, m);
  }
  scene.add(inst);
}

export function buildWorld(node: BattleNode): WorldRefs {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(node.fogColor, node.fogDensity);

  const colliders: WorldRefs["colliders"] = [];
  const structures: WorldRefs["structures"] = [];
  const fireParticles: THREE.Points[] = [];
  const flames: WorldRefs["flames"] = [];
  const banners: THREE.Mesh[] = [];

  scene.add(buildSky(node));

  const hemi = new THREE.HemisphereLight(0xcfd8e0, 0x3a3428, node.ambient);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(node.sunColor, node.sunIntensity);
  sun.position.set(60, 120, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  scene.add(buildTerrain());
  buildGreatWall(scene, colliders, structures);
  buildTents(scene, colliders, structures);
  buildWatchtowers(scene, colliders, structures);
  buildBanners(scene, banners);
  buildPalace(scene, structures);
  buildTreesAndRocks(scene, colliders, structures);
  buildBraziers(scene, flames, fireParticles);
  buildDebris(scene);

  // the hold-objective war banner at the center
  const bannerPos = new THREE.Vector3(0, heightAt(0, 0), 0);
  const bigPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 13),
    new THREE.MeshStandardMaterial({ color: 0x3a2e20 })
  );
  bigPole.position.set(0, bannerPos.y + 6.5, 0);
  scene.add(bigPole);
  const bigFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 5.4, 8, 8),
    new THREE.MeshStandardMaterial({
      map: makeBannerTexture("戰", "#7a1f14", "#f0e2c8"),
      side: THREE.DoubleSide,
      roughness: 0.9,
    })
  );
  bigFlag.position.set(2.2, bannerPos.y + 9.6, 0);
  bigFlag.userData.phase = 0;
  scene.add(bigFlag);
  banners.push(bigFlag);
  structures.push({ x: 0, z: 0, kind: "banner" });

  return { scene, colliders, structures, bannerPos, fireParticles, sun, hemi, flames, banners };
}

// per-frame world animation (banner sway, fire flicker)
export function animateWorld(world: WorldRefs, t: number) {
  for (const b of world.banners) {
    const pos = b.geometry.attributes.position as THREE.BufferAttribute;
    const phase = b.userData.phase as number;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const w = ((x + 2) / 4) * ((y + 3) / 6);
      pos.setZ(i, Math.sin(t * 2.2 + phase + x * 1.4 + y * 0.8) * 0.16 * (0.3 + w));
    }
    pos.needsUpdate = true;
  }
  for (const pts of world.fireParticles) {
    const base = pts.userData.base as { x: number; y: number; z: number };
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + 0.035;
      if (y > base.y + 2.2) y = base.y;
      pos.setY(i, y);
      pos.setX(i, base.x + Math.sin(t * 5 + i * 1.7) * 0.28);
    }
    pos.needsUpdate = true;
  }
}
