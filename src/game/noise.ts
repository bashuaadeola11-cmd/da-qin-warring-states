// Deterministic value noise + fbm for terrain (no external deps)

function hash2(x: number, y: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const u = smooth(xf);
  const v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm; // 0..1
}

// Terrain height field — single source of truth shared by mesh + gameplay.
// World is roughly 520x520 m centered on origin. Battle plain in the middle,
// ridge line to the north (negative z) carrying the Great Wall, hills south.
export function heightAt(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  const plain = fbm(x * 0.012 + 7.3, z * 0.012 + 2.9, 4) * 3.2;
  // ridge along north edge
  const ridgeBand = Math.max(0, 1 - Math.abs(z + 190) / 70);
  const ridge = ridgeBand * (14 + fbm(x * 0.02, z * 0.02, 3) * 8);
  // gentle hills far south/east/west
  const edge = Math.max(0, (dist - 215) / 170);
  const hills = edge * fbm(x * 0.01 + 3.1, z * 0.01 + 9.7, 4) * 19;
  // flatten a combat arena near the center
  const flat = Math.max(0, 1 - dist / 90);
  const h = plain + ridge + hills;
  return h * (1 - flat * 0.85) + flat * 0.4;
}
