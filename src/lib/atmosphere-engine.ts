import type { Scene } from "./workspace";

type Noise = "white" | "brown";
type Sound = { source: AudioScheduledSourceNode; nodes: AudioNode[] };

export class AtmosphereEngine {
  private context = new AudioContext();
  private output = this.context.createGain();
  private sceneGain: GainNode | null = null;
  private sounds: Sound[] = [];
  private buffers = new Map<Noise, AudioBuffer>();
  private request = 0;

  constructor() {
    this.output.gain.value = 0.45;
    this.output.connect(this.context.destination);
  }

  setVolume(volume: number) {
    this.output.gain.setTargetAtTime(volume * 0.65, this.context.currentTime, 0.045);
  }

  async play(scene: Scene, volume: number) {
    const request = ++this.request;
    await this.context.resume();
    if (request !== this.request) return false;

    this.fadeOut();
    const now = this.context.currentTime;
    const mix = this.context.createGain();
    mix.gain.setValueAtTime(0, now);
    mix.gain.linearRampToValueAtTime(1, now + 0.7);
    mix.connect(this.output);
    this.sceneGain = mix;
    this.setVolume(volume);

    switch (scene) {
      case "rain":
        this.noise("white", "lowpass", 5300, 0.33);
        this.noise("brown", "lowpass", 430, 0.42, 0.19);
        this.noise("white", "bandpass", 1800, 0.06, 0.11);
        break;
      case "cafe":
        this.noise("brown", "bandpass", 390, 0.25, 0.28);
        this.noise("white", "lowpass", 690, 0.13, 0.38);
        this.pad([130.81, 196, 246.94, 329.63], 0.021, "triangle");
        break;
      case "moon":
        this.noise("brown", "lowpass", 220, 0.14, 0.17);
        this.pad([110, 164.81, 220, 261.63, 329.63], 0.032, "sine");
        break;
      case "forest":
        this.noise("white", "lowpass", 1400, 0.20, 0.22);
        this.noise("brown", "highpass", 190, 0.16, 0.13);
        this.birds();
        break;
    }
    return true;
  }

  pause() {
    this.request += 1;
    this.fadeOut();
  }

  dispose() {
    this.pause();
    void this.context.close();
  }

  private fadeOut() {
    if (!this.sceneGain) return;
    const mix = this.sceneGain;
    const stopping = this.sounds;
    const time = this.context.currentTime;
    if (mix.gain.cancelAndHoldAtTime) {
      mix.gain.cancelAndHoldAtTime(time);
    } else {
      const level = mix.gain.value;
      mix.gain.cancelScheduledValues(time);
      mix.gain.setValueAtTime(level, time);
    }
    mix.gain.linearRampToValueAtTime(0, time + 0.25);
    for (const { source } of stopping) source.stop(time + 0.26);
    setTimeout(() => {
      for (const { source, nodes } of stopping) {
        source.disconnect();
        nodes.forEach((node) => node.disconnect());
      }
      mix.disconnect();
    }, 300);
    this.sounds = [];
    this.sceneGain = null;
  }

  private noiseBuffer(kind: Noise) {
    const existing = this.buffers.get(kind);
    if (existing) return existing;

    const length = this.context.sampleRate * 7;
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    const seam = Math.round(this.context.sampleRate * 0.12);

    for (let channel = 0; channel < 2; channel += 1) {
      const samples = buffer.getChannelData(channel);
      let brown = 0;
      const sample = () => {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        return kind === "white" ? white : brown * 3.5;
      };
      for (let i = 0; i < length; i += 1) samples[i] = sample();
      for (let i = 0; i < seam; i += 1) samples[i] = samples[i] * (i / seam) + sample() * (1 - i / seam);
    }
    this.buffers.set(kind, buffer);
    return buffer;
  }

  private noise(kind: Noise, type: BiquadFilterType, frequency: number, volume: number, pulse?: number) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer(kind);
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === "bandpass" ? 0.5 : 0.25;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.sceneGain!);
    if (pulse) this.modulate(gain.gain, pulse, volume * 0.24);
    this.sounds.push({ source, nodes: [filter, gain] });
    source.start();
  }

  private modulate(target: AudioParam, rate: number, depth: number) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = rate;
    gain.gain.value = depth;
    oscillator.connect(gain).connect(target);
    this.sounds.push({ source: oscillator, nodes: [gain] });
    oscillator.start();
  }

  private pad(frequencies: number[], volume: number, type: OscillatorType) {
    frequencies.forEach((frequency, index) => {
      const source = this.context.createOscillator();
      const gain = this.context.createGain();
      const pan = this.context.createStereoPanner();
      source.type = type;
      source.frequency.value = frequency;
      source.detune.value = index % 2 === 0 ? -3 : 3;
      pan.pan.value = index % 2 === 0 ? -0.45 : 0.45;
      gain.gain.value = volume;
      this.modulate(gain.gain, 0.045 + index * 0.011, volume * 0.65);
      source.connect(gain).connect(pan).connect(this.sceneGain!);
      this.sounds.push({ source, nodes: [gain, pan] });
      source.start();
    });
  }

  private birds() {
    const source = this.context.createBufferSource();
    const rate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, rate * 18, rate);
    for (let bird = 0; bird < 7; bird += 1) {
      const channel = buffer.getChannelData(bird % 2);
      const start = Math.floor(rate * (1.7 + bird * 2.25 + Math.random() * 0.6));
      const frequency = 1950 + Math.random() * 680;
      const length = Math.round(rate * (0.11 + Math.random() * 0.15));
      for (let i = 0; i < length; i += 1) {
        const progress = i / length;
        const phase = 2 * Math.PI * (frequency * i / rate + 55 * progress ** 2);
        channel[start + i] += Math.sin(phase) * Math.sin(Math.PI * progress) ** 3 * 0.028;
      }
    }
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.sceneGain!);
    this.sounds.push({ source, nodes: [] });
    source.start();
  }
}
