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
    this.musicFilter = null;
    this.musicLfo = null;
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
    // 粉红噪声与棕色噪声的混合比纯白噪声柔和，
    // 避免长时间播放后出现类似电流或压缩失真的高频感。
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.296516;
      b2 = 0.57 * b2 + white * 1.052692;
      brown = (brown + white * 0.02) / 1.02;
      const softNoise = (b0 + b1 + b2 + white * 0.1848) * 0.11 + brown * 0.62;
      data[i] = Math.max(-1, Math.min(1, softNoise));
    }
    return buffer;
  }

  startRain() {
    if (!this.ctx || this.rainSources.length) return;
    const now = this.ctx.currentTime;
    const configs = [
      { type: "lowpass", frequency: 1350, q: 0.32, gain: 0.22 },
      { type: "bandpass", frequency: 2750, q: 0.38, gain: 0.035 },
      { type: "lowpass", frequency: 260, q: 0.25, gain: 0.055 }
    ];

    configs.forEach((config) => {
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.makeNoise(10);
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
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    source.buffer = this.makeNoise(0.16);
    filter.type = "bandpass";
    filter.frequency.value = 1050 + Math.random() * 650;
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.014, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start(now);
    source.stop(now + 0.16);
  }

  ensureDrone() {
    if (!this.ctx || this.drone.length) return;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 420;
    this.musicFilter.Q.value = 0.35;
    this.musicFilter.connect(this.musicGain);

    [55, 82.41, 110].forEach((frequency, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = index === 0 ? "triangle" : "sine";
      osc.frequency.value = frequency;
      gain.gain.value = [0.16, 0.1, 0.045][index];
      osc.connect(gain).connect(this.musicFilter);
      osc.start();
      this.drone.push({ osc, gain, base: frequency });
    });

    // 极慢的滤波呼吸让配乐有生命感，但不会变成明显旋律。
    this.musicLfo = this.ctx.createOscillator();
    const lfoDepth = this.ctx.createGain();
    this.musicLfo.type = "sine";
    this.musicLfo.frequency.value = 0.055;
    lfoDepth.gain.value = 55;
    this.musicLfo.connect(lfoDepth).connect(this.musicFilter.frequency);
    this.musicLfo.start();
  }

  applySettings(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = immediate ? 0.03 : 1.1;
    const ambienceLevels = {
      title: 0.22,
      rain: 0.27,
      choice: 0.17,
      zhou: 0.15,
      lin: 0.15,
      summer: 0.1
    };
    const ambienceTarget = this.settings.ambience && !this.muted ? (ambienceLevels[this.mood] ?? 0.2) : 0;
    const musicTarget = this.settings.music && !this.muted && ["choice", "zhou", "lin"].includes(this.mood) ? 0.115 : 0;
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
    const ratios = {
      lin: [1.0, 1.122, 1.189],
      zhou: [0.89, 0.943, 1.0]
    };
    this.drone.forEach((voice, index) => {
      const ratio = ratios[id]?.[index] || 1;
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.linearRampToValueAtTime(voice.base * ratio, now + 0.45);
    });
  }

  playCue(type) {
    if (!this.ctx || !this.started || this.muted) return;
    if (type === "choice" && !this.settings.music) return;
    if (type !== "choice" && !this.settings.ambience) return;
    if (type === "train") return this.playTrain();
    if (type === "thunder") return this.playThunder();
    if (type === "paper") return this.playTextureCue();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type === "choice" ? "sine" : "triangle";
    const start = type === "luggage" ? 105 : 62;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(38, start * 0.65), now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "choice" ? 0.042 : 0.026, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(gain).connect(type === "choice" ? this.musicGain : this.ambienceGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playTextureCue() {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.makeNoise(0.22);
    filter.type = "bandpass";
    filter.frequency.value = 1450;
    filter.Q.value = 0.55;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.018, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start(now);
    source.stop(now + 0.22);
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
    gain.gain.linearRampToValueAtTime(0.085, now + 1.5);
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
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.makeNoise(0.14);
      filter.type = "bandpass";
      filter.frequency.value = 3800 + Math.random() * 900;
      filter.Q.value = 4.5;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      source.connect(filter).connect(gain).connect(this.ambienceGain);
      source.start(now);
      source.stop(now + 0.14);
    }, 180 + Math.random() * 120);
  }

  stopSummer() {
    clearInterval(this.summerTimer);
    this.summerTimer = null;
  }
}

window.GameAudio = GameAudio;
