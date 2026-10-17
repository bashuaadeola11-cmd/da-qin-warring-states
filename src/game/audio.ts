// Audio manager: loads generated mp3 sfx when available, always has a
// WebAudio-synthesized fallback so the game is never silent.

type SfxName = "shot" | "swing" | "hit" | "hurt" | "kill" | "horn" | "wave" | "click";

class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  private master: GainNode | null = null;
  private ambNodes: AudioNode[] = [];
  private ambGain: GainNode | null = null;
  volume = 0.8;
  private started = false;

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  async load() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const files: [SfxName, string][] = [
      ["shot", "/assets/sfx/crossbow.mp3"],
      ["swing", "/assets/sfx/swing.mp3"],
      ["hit", "/assets/sfx/hit.mp3"],
    ];
    await Promise.all(
      files.map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf);
        } catch {
          /* fallback stays */
        }
      })
    );
  }

  unlock() {
    this.ensureCtx();
    this.started = true;
  }

  play(name: SfxName, gain = 1, rate = 1) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || !this.started) return;
    const buf = this.buffers.get(name);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.master);
      src.start();
      return;
    }
    this.synth(name, gain);
  }

  private synth(name: SfxName, gain: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = this.master!;
    const noiseBuf = this.getNoise();
    const env = (peak: number, dur: number) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak * gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      g.connect(out);
      return g;
    };
    const noise = (freq: number, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      src.connect(f);
      return { src, f };
    };
    switch (name) {
      case "shot": {
        const g = env(0.7, 0.18);
        const { src } = noise(2400, 0.7);
        src.connect(g);
        src.start(t);
        src.stop(t + 0.2);
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(400, t);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
        o.connect(env(0.4, 0.14));
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case "swing": {
        const g = env(0.35, 0.22);
        const { src, f } = noise(900, 2);
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
        src.connect(g);
        src.start(t);
        src.stop(t + 0.25);
        break;
      }
      case "hit": {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
        o.connect(env(0.5, 0.12));
        o.start(t);
        o.stop(t + 0.12);
        break;
      }
      case "kill": {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        o.connect(env(0.45, 0.32));
        o.start(t);
        o.stop(t + 0.32);
        break;
      }
      case "hurt": {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
        o.connect(env(0.7, 0.28));
        o.start(t);
        o.stop(t + 0.28);
        break;
      }
      case "horn":
      case "wave": {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(98, t);
        o.frequency.linearRampToValueAtTime(146, t + 0.7);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4 * gain, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.5);
        break;
      }
      case "click": {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = 660;
        o.connect(env(0.15, 0.05));
        o.start(t);
        o.stop(t + 0.06);
        break;
      }
    }
  }

  private noiseBuf: AudioBuffer | null = null;
  private getNoise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  startAmbience(kind: "drums" | "wind") {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    this.stopAmbience();
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.35;
    this.ambGain.connect(this.master);
    if (kind === "drums") {
      // war-drum pattern via scheduled oscillator thumps
      const pattern = [0, 0.5, 0.75, 1.5, 2.0, 2.25, 3.0];
      const loop = 4;
      const schedule = (startAt: number) => {
        if (!this.ambGain) return;
        for (const p of pattern) {
          const t = startAt + p;
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(75, t);
          o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(p % 1.5 === 0 ? 0.9 : 0.5, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          o.connect(g).connect(this.ambGain);
          o.start(t);
          o.stop(t + 0.4);
          this.ambNodes.push(o, g);
        }
        this.ambTimer = window.setTimeout(() => schedule(ctx.currentTime + 0.05), loop * 1000);
      };
      schedule(ctx.currentTime + 0.1);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 320;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 140;
      lfo.connect(lfoG).connect(f.frequency);
      src.connect(f).connect(this.ambGain);
      src.start();
      lfo.start();
      this.ambNodes.push(src, f, lfo, lfoG);
    }
  }

  private ambTimer = 0;

  stopAmbience() {
    window.clearTimeout(this.ambTimer);
    for (const n of this.ambNodes) {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.ambNodes = [];
    if (this.ambGain) {
      this.ambGain.disconnect();
      this.ambGain = null;
    }
  }
}

export const audio = new AudioManager();
