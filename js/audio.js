/*
 * 轻量 Web Audio 声音系统。
 * 第一版不依赖任何外部音频；正式素材可在这里替换或叠加。
 */
class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.ambienceGain = null;
    this.musicGain = null;
    this.rainSources = [];
    this.drone = [];
    this.dropTimer = null;
    this.summerTimer = null;
    this.started = false;
    this.muted = false;
    this.mood = "title";
  }

  async start() {
    if (!this.ctx) this.buildGraph();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        // 声卡不可用或省电模式下，resume() 偶尔不会及时返回。
        // 声音不能阻塞剧情，因此最多等待 450ms。
        await Promise.race([
          this.ctx.resume(),
          new Promise((resolve) => setTimeout(resolve, 450))
        ]);
      } catch (error) {
        // 无音频设备时保持静音，游戏仍然继续。
      }
    }
    this.started = true;
    this.applySettings(true);
    this.startRain();
  }

  buildGraph() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.75;
    this.ambienceGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0;
    this.musicGain.gain.value = 0;
    this.ambienceGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
  }

  makeNoise(seconds = 3) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = white * 0.22 + last * 2.2;
    }
    return buffer;
  }

  startRain() {
    if (!this.ctx || this.rainSources.length) return;
    const now = this.ctx.currentTime;
    const configs = [
      { type: "bandpass", frequency: 1450, q: 0.42, gain: 0.24 },
      { type: "highpass", frequency: 3600, q: 0.2, gain: 0.075 },
      { type: "lowpass", frequency: 520, q: 0.4, gain: 0.07 }
    ];

    configs.forEach((config) => {
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.makeNoise(4);
      source.loop = true;
      filter.type = config.type;
      filter.frequency.value = config.frequency;
      filter.Q.value = config.q;
      gain.gain.value = config.gain;
      source.connect(filter).connect(gain).connect(this.ambienceGain);
      source.start(now + Math.random() * 0.08);
      this.rainSources.push({ source, filter, gain });
    });
    this.scheduleDrop();
  }

  scheduleDrop() {
    clearTimeout(this.dropTimer);
    const delay = 650 + Math.random() * 1500;
    this.dropTimer = setTimeout(() => {
      if (this.started && this.settings.ambience && !this.muted && this.mood !== "summer") {
        this.playDroplet();
      }
      this.scheduleDrop();
    }, delay);
  }

  playDroplet() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(760 + Math.random() * 740, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.08);
    filter.type = "bandpass";
    filter.frequency.value = 1150;
    filter.Q.value = 2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.022, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(filter).connect(gain).connect(this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  ensureDrone() {
    if (!this.ctx || this.drone.length) return;
    [43.65, 65.41].forEach((frequency, index) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = index ? "sine" : "triangle";
      osc.frequency.value = frequency;
      filter.type = "lowpass";
      filter.frequency.value = 130;
      gain.gain.value = index ? 0.18 : 0.1;
      osc.connect(filter).connect(gain).connect(this.musicGain);
      osc.start();
      this.drone.push({ osc, filter, gain, base: frequency });
    });
  }

  applySettings(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = immediate ? 0.03 : 0.7;
    const ambienceTarget = this.settings.ambience && !this.muted ? (this.mood === "summer" ? 0.12 : 0.32) : 0;
    const musicTarget = this.settings.music && !this.muted && ["choice", "zhou", "lin"].includes(this.mood) ? 0.07 : 0;
    this.ambienceGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.cancelScheduledValues(now);
    this.ambienceGain.gain.linearRampToValueAtTime(ambienceTarget, now + ramp);
    this.musicGain.gain.linearRampToValueAtTime(musicTarget, now + ramp);
  }

  setSettings(settings) {
    this.settings = settings;
    this.applySettings();
  }

  setMuted(value) {
    this.muted = value;
    this.applySettings();
  }

  setMood(mood) {
    this.mood = mood;
    if (["choice", "zhou", "lin"].includes(mood)) this.ensureDrone();
    if (mood === "summer") this.startSummer();
    else this.stopSummer();
    this.applySettings();
  }

  setPerspectiveHover(id) {
    if (!this.ctx || !this.drone.length) return;
    const now = this.ctx.currentTime;
    this.drone.forEach((voice, index) => {
      const ratio = id === "lin" ? (index ? 1.18 : 1.06) : id === "zhou" ? (index ? 0.94 : 0.88) : 1;
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.linearRampToValueAtTime(voice.base * ratio, now + 0.45);
    });
  }

  playCue(type) {
    if (!this.ctx || !this.started || this.muted || !this.settings.ambience) return;
    if (type === "train") return this.playTrain();
    if (type === "thunder") return this.playThunder();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type === "choice" ? "sine" : "triangle";
    const start = type === "paper" ? 950 : type === "luggage" ? 105 : 62;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(38, start * 0.65), now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "choice" ? 0.055 : 0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(gain).connect(type === "choice" ? this.musicGain : this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playTrain() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const source = this.ctx.createBufferSource();
    source.buffer = this.makeNoise(4.5);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.linearRampToValueAtTime(620, now + 2.1);
    filter.frequency.linearRampToValueAtTime(150, now + 4.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 1.5);
    gain.gain.linearRampToValueAtTime(0.0001, now + 4.4);
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start(now);
    source.stop(now + 4.5);

    [110, 146.8].forEach((frequency) => {
      const horn = this.ctx.createOscillator();
      const hornGain = this.ctx.createGain();
      horn.type = "sine";
      horn.frequency.value = frequency;
      hornGain.gain.setValueAtTime(0.0001, now + 0.55);
      hornGain.gain.linearRampToValueAtTime(0.026, now + 1.1);
      hornGain.gain.linearRampToValueAtTime(0.0001, now + 3.2);
      horn.connect(hornGain).connect(this.ambienceGain);
      horn.start(now + 0.5);
      horn.stop(now + 3.3);
    });
  }

  playThunder() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.makeNoise(2.8);
    filter.type = "lowpass";
    filter.frequency.value = 120;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start(now);
  }

  startSummer() {
    clearInterval(this.summerTimer);
    this.summerTimer = setInterval(() => {
      if (!this.ctx || !this.settings.ambience || this.muted || this.mood !== "summer") return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 4100 + Math.random() * 1300;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.006, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(this.ambienceGain);
      osc.start(now);
      osc.stop(now + 0.14);
    }, 180 + Math.random() * 120);
  }

  stopSummer() {
    clearInterval(this.summerTimer);
    this.summerTimer = null;
  }
}

window.GameAudio = GameAudio;
