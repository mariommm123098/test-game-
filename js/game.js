/* global STORY, GameAudio */
(() => {
  "use strict";

  const STORAGE_KEY = "weNeverLied.save.v1";
  const DEFAULT_SAVE = {
    version: 1,
    started: false,
    prologueCompleted: false,
    viewedPerspectives: { zhou: false, lin: false },
    lastPerspective: null,
    checkpoint: "title",
    dialogueIndex: 0,
    history: [],
    settings: { textSpeed: 34, ambience: true, music: true }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  class RainRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.drops = [];
      this.running = true;
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.resize = this.resize.bind(this);
      addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(() => this.frame());
    }

    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = innerWidth * dpr;
      this.canvas.height = innerHeight * dpr;
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = this.reduced ? 28 : Math.min(190, Math.floor(innerWidth / 7));
      this.drops = Array.from({ length: count }, () => this.makeDrop(true));
    }

    makeDrop(randomY = false) {
      const depth = Math.random();
      return {
        x: Math.random() * (innerWidth + 260) - 80,
        y: randomY ? Math.random() * innerHeight : -60,
        len: 10 + depth * 30,
        speed: 8 + depth * 19,
        alpha: 0.08 + depth * 0.22,
        width: depth > 0.76 ? 1.15 : 0.55
      };
    }

    frame() {
      if (!this.running) return;
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
      this.drops.forEach((drop, index) => {
        this.ctx.beginPath();
        this.ctx.moveTo(drop.x, drop.y);
        this.ctx.lineTo(drop.x - drop.len * 0.22, drop.y + drop.len);
        this.ctx.strokeStyle = `rgba(190, 214, 226, ${drop.alpha})`;
        this.ctx.lineWidth = drop.width;
        this.ctx.stroke();
        drop.x -= drop.speed * 0.22;
        drop.y += drop.speed;
        if (drop.y > innerHeight + 60 || drop.x < -150) this.drops[index] = this.makeDrop(false);
      });
      requestAnimationFrame(() => this.frame());
    }
  }

  class NarrativeGame {
    constructor() {
      this.app = $("#app");
      this.scene = $("#scene");
      this.curtain = $("#curtain");
      this.flash = $("#flash");
      this.dialogueIndex = 0;
      this.typingTimer = null;
      this.typing = false;
      this.fullLine = "";
      this.locked = false;
      this.lastInputAt = 0;
      this.memoryResolver = null;
      this.memoryLastAdvance = 0;
      this.currentShot = null;
      this.shotTimer = null;
      this.currentScreen = "loading";
      this.save = this.loadSave();
      this.audio = new GameAudio(this.save.settings);
      this.rain = new RainRenderer($("#rainCanvas"));
      this.cacheElements();
      this.bindEvents();
      this.applySettingsToUI();
      this.renderTitleProgress();
      this.init();
    }

    cacheElements() {
      this.screens = $$(".screen");
      this.titleScreen = $("#titleScreen");
      this.locationCard = $("#locationCard");
      this.dialogueScreen = $("#dialogueScreen");
      this.choiceScreen = $("#choiceScreen");
      this.memoryScreen = $("#memoryScreen");
      this.intertitleScreen = $("#intertitleScreen");
      this.endingScreen = $("#endingScreen");
      this.dialogueBox = $("#dialogueBox");
      this.speakerName = $("#speakerName");
      this.dialogueText = $("#dialogueText");
      this.caption = $("#cinematicCaption");
      this.settingsDialog = $("#settingsDialog");
      this.historyDialog = $("#historyDialog");
      this.returnDialog = $("#returnDialog");
      this.toastElement = $("#toast");
    }

    async init() {
      await this.waitForBackground();
      await wait(650);
      this.app.classList.remove("is-loading");
      $("#loadingScreen").classList.add("loading-screen--out");
      await wait(650);
      $("#loadingScreen").hidden = true;
      this.curtain.classList.remove("curtain--closed");
      this.scene.setAttribute("aria-hidden", "false");
      this.showOnly(this.titleScreen, "title");
      setTimeout(() => this.toast("建议佩戴耳机体验", 3200), 1300);
    }

    waitForBackground() {
      const image = $(".scene__image");
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 2500);
      });
    }

    bindEvents() {
      $("#startButton").addEventListener("click", () => this.startNewGame());
      $("#continueButton").addEventListener("click", () => this.continueGame());
      $("#titleSettingsButton").addEventListener("click", () => this.openSettings());
      $("#settingsButton").addEventListener("click", () => this.openSettings());
      $("#historyButton").addEventListener("click", () => this.openHistory());
      $("#soundButton").addEventListener("click", () => this.toggleMute());
      $("#fullscreenButton").addEventListener("click", () => this.toggleFullscreen());
      $("#dialogFullscreenButton").addEventListener("click", () => this.toggleFullscreen());
      $("#dialogueAdvance").addEventListener("click", () => this.advanceDialogue());
      $("#memoryAdvance").addEventListener("click", () => this.advanceMemory());
      $("#otherPerspectiveButton").addEventListener("click", () => this.replayOtherPerspective());
      $("#returnTitleButton").addEventListener("click", () => this.returnToTitle(false));
      $("#settingsReturnButton").addEventListener("click", () => {
        this.settingsDialog.close();
        this.returnToTitle(true);
      });
      $("#confirmReturnButton").addEventListener("click", () => {
        this.returnDialog.close();
        this.performReturnToTitle();
      });

      $$(".perspective-card").forEach((card) => {
        const id = card.dataset.perspective;
        card.addEventListener("mouseenter", () => this.previewPerspective(id));
        card.addEventListener("focus", () => this.previewPerspective(id));
        card.addEventListener("mouseleave", () => this.previewPerspective(null));
        card.addEventListener("blur", () => this.previewPerspective(null));
        card.addEventListener("click", () => this.choosePerspective(id));
      });

      $$('input[name="textSpeed"]').forEach((input) => input.addEventListener("change", (event) => {
        this.save.settings.textSpeed = Number(event.target.value);
        this.persist();
        this.toast(`文字速度：${event.target.nextElementSibling.textContent}`);
      }));
      $("#ambienceToggle").addEventListener("change", (event) => {
        this.save.settings.ambience = event.target.checked;
        this.persistAndApplyAudio();
      });
      $("#musicToggle").addEventListener("change", (event) => {
        this.save.settings.music = event.target.checked;
        this.persistAndApplyAudio();
      });

      document.addEventListener("keydown", (event) => this.onKeydown(event));
      document.addEventListener("pointerdown", () => {
        if (this.audio.ctx?.state === "suspended") this.audio.ctx.resume().catch(() => {});
      }, { passive: true });
      document.addEventListener("fullscreenchange", () => this.updateFullscreenButton());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.audio.ctx?.state === "running") this.audio.ctx.suspend();
      });
    }

    onKeydown(event) {
      if (event.key === "Escape") {
        if (this.settingsDialog.open || this.historyDialog.open || this.returnDialog.open) return;
        if (this.currentScreen === "title") this.openSettings();
        else this.openSettings();
        return;
      }
      if ([" ", "Enter"].includes(event.key) && !this.anyDialogOpen()) {
        if (["dialogue", "memory"].includes(this.currentScreen)) event.preventDefault();
        if (this.currentScreen === "dialogue") this.advanceDialogue();
        if (this.currentScreen === "memory") this.advanceMemory();
      }
    }

    anyDialogOpen() {
      return this.settingsDialog.open || this.historyDialog.open || this.returnDialog.open;
    }

    async startNewGame() {
      await this.audio.start();
      this.save.started = true;
      this.save.checkpoint = "dialogue";
      this.save.dialogueIndex = 0;
      this.persist();
      this.dialogueIndex = 0;
      await this.enterGame();
      await this.playLocationCard();
      this.beginDialogue(0);
    }

    async continueGame() {
      await this.audio.start();
      await this.enterGame();
      if (this.save.checkpoint === "choice") {
        this.showChoice();
      } else if (this.save.checkpoint === "ending" || this.save.prologueCompleted) {
        this.showEnding();
      } else {
        this.dialogueIndex = Math.max(0, Math.min(this.save.dialogueIndex || 0, STORY.prologue.length - 1));
        this.beginDialogue(this.dialogueIndex);
      }
    }

    async enterGame() {
      this.audio.setMood("rain");
      this.scene.className = "scene scene--game";
      this.app.classList.add("game-active");
      this.curtain.classList.add("curtain--closed");
      await wait(620);
      $("#topbar").classList.add("topbar--visible");
      this.curtain.classList.remove("curtain--closed");
    }

    async playLocationCard() {
      this.showOnly(this.locationCard, "location");
      this.curtain.classList.add("curtain--location");
      await wait(450);
      this.locationCard.classList.add("location-card--visible");
      await wait(2300);
      this.locationCard.classList.remove("location-card--visible");
      await wait(650);
      this.curtain.classList.remove("curtain--location");
    }

    beginDialogue(index) {
      this.showOnly(this.dialogueScreen, "dialogue");
      this.scene.className = "scene scene--game scene--ground";
      this.currentShot = "ground";
      this.dialogueIndex = index;
      this.renderDialogue(STORY.prologue[this.dialogueIndex]);
    }

    async renderDialogue(entry) {
      if (!entry) return this.finishDialogue();
      this.clearTyping();
      this.locked = true;
      const wasVisible = this.dialogueBox.classList.contains("dialogue-box--visible");

      // 先保留当前框体类型完成淡出，再切换旁白/动作/对白样式。
      // 如果过早移除类型类，半透明框会在淡出途中短暂恢复成实体对白框，
      // 造成玩家看到的“一闪而过的矩形框”。
      this.dialogueBox.classList.remove("dialogue-box--visible");
      this.caption.classList.remove("cinematic-caption--visible");
      const shotChange = this.applyEffect(entry.effect);
      await Promise.all([
        wait(Math.max(entry.pauseBefore || 250, wasVisible ? 560 : 0)),
        shotChange
      ]);
      if (this.currentScreen !== "dialogue") return;

      this.dialogueBox.classList.remove(
        "dialogue-box--narration",
        "dialogue-box--action",
        "dialogue-box--zhou",
        "dialogue-box--lin"
      );
      this.speakerName.textContent = entry.speaker || (entry.type === "action" ? "" : "旁白");
      this.dialogueText.textContent = "";
      this.dialogueBox.classList.toggle("dialogue-box--narration", entry.type === "narration");
      this.dialogueBox.classList.toggle("dialogue-box--action", entry.type === "action");
      this.dialogueBox.classList.toggle("dialogue-box--zhou", entry.type === "dialogue" && entry.speaker === "周屿");
      this.dialogueBox.classList.toggle("dialogue-box--lin", entry.type === "dialogue" && entry.speaker === "林栀");
      this.dialogueBox.classList.add("dialogue-box--visible");
      this.fullLine = entry.text;
      this.startTypewriter(entry.text);
      this.locked = false;
    }

    startTypewriter(text) {
      const characters = [...text];
      let index = 0;
      this.typing = true;
      this.dialogueText.textContent = "";
      this.dialogueBox.classList.add("is-typing");
      const step = () => {
        this.dialogueText.textContent += characters[index] || "";
        index += 1;
        if (index >= characters.length) {
          this.finishTyping();
          return;
        }
        const punctuation = /[。？！，、…]/.test(characters[index - 1]);
        this.typingTimer = setTimeout(step, this.save.settings.textSpeed * (punctuation ? 2.6 : 1));
      };
      step();
    }

    finishTyping() {
      this.clearTyping();
      this.dialogueText.textContent = this.fullLine;
      this.dialogueBox.classList.remove("is-typing");
      const entry = STORY.prologue[this.dialogueIndex];
      this.addHistory(entry.speaker || (entry.type === "action" ? "画面" : "旁白"), entry.text);
    }

    clearTyping() {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
      this.typing = false;
    }

    async advanceDialogue() {
      const now = performance.now();
      if (this.locked || now - this.lastInputAt < 220) return;
      this.lastInputAt = now;
      if (this.typing) {
        this.finishTyping();
        return;
      }
      this.locked = true;
      const current = STORY.prologue[this.dialogueIndex];
      if (current?.afterHold) await wait(current.afterHold);
      this.dialogueIndex += 1;
      this.save.dialogueIndex = this.dialogueIndex;
      this.persist();
      if (this.dialogueIndex >= STORY.prologue.length) return this.finishDialogue();
      this.renderDialogue(STORY.prologue[this.dialogueIndex]);
    }

    async finishDialogue() {
      this.clearTyping();
      this.dialogueBox.classList.remove("dialogue-box--visible");
      this.locked = true;
      // 最后一句留在周屿的肩后近景；对白消失后再切到火车远光，
      // 让火车成为一个独立的句号，而不是和对白同时亮起的特效。
      await this.applyEffect("train");
      this.scene.classList.add("scene--frozen");
      this.audio.playCue("train");
      await wait(3800);
      this.locked = false;
      this.showChoice();
    }

    async applyEffect(effect) {
      if (!effect) return;
      const isNewShot = this.currentShot !== effect;

      if (isNewShot) {
        // 直接让上一构图连续运动到下一构图。雨层始终可见，
        // 不再使用暗色遮罩或强制重排，因此不会产生闪黑与“卡一下”的错觉。
        this.scene.classList.remove(
          "scene--ground",
          "scene--reveal",
          "scene--zhou",
          "scene--lin",
          "scene--luggage",
          "scene--train",
          "scene--frozen",
          "scene--camera-moving"
        );
        this.scene.classList.add(`scene--${effect}`);
        this.scene.classList.add("scene--camera-moving");
        this.currentShot = effect;
        clearTimeout(this.shotTimer);
        this.shotTimer = setTimeout(() => this.scene.classList.remove("scene--camera-moving"), 1380);
      }

      if (effect === "luggage") this.audio.playCue("luggage");
      if (effect === "train") setTimeout(() => this.flashLightning(), 900);
    }

    flashLightning() {
      this.flash.classList.add("flash--active");
      this.audio.playCue("thunder");
      setTimeout(() => this.flash.classList.remove("flash--active"), 550);
    }

    showChoice() {
      this.save.checkpoint = "choice";
      this.persist();
      this.audio.setMood("choice");
      this.scene.className = "scene scene--game scene--choice";
      this.showOnly(this.choiceScreen, "choice");
      this.updateChoiceCards();
      requestAnimationFrame(() => this.choiceScreen.classList.add("choice-screen--visible"));
    }

    updateChoiceCards() {
      $$(".perspective-card").forEach((card) => {
        const viewed = this.save.viewedPerspectives[card.dataset.perspective];
        card.classList.toggle("is-viewed", viewed);
        $(".perspective-card__status", card).textContent = viewed ? "已看过 · REMEMBERED" : "尚未阅读";
      });
    }

    previewPerspective(id) {
      this.scene.classList.toggle("scene--peek-zhou", id === "zhou");
      this.scene.classList.toggle("scene--peek-lin", id === "lin");
      this.choiceScreen.classList.toggle("is-peeking-zhou", id === "zhou");
      this.choiceScreen.classList.toggle("is-peeking-lin", id === "lin");
      this.audio.setPerspectiveHover(id);
    }

    async choosePerspective(id) {
      if (this.locked) return;
      this.locked = true;
      this.audio.playCue("choice");
      this.audio.setMood(id);
      this.save.lastPerspective = id;
      this.save.viewedPerspectives[id] = true;
      this.persist();
      this.previewPerspective(id);
      this.choiceScreen.classList.add("choice-screen--chosen");
      await wait(900);
      this.choiceScreen.classList.remove("choice-screen--visible", "choice-screen--chosen");
      this.runPerspective(id);
    }

    async runPerspective(id) {
      const route = STORY.perspectives[id];
      this.locked = false;
      this.scene.className = `scene scene--game scene--memory scene--memory-${id}`;
      this.showOnly(this.memoryScreen, "memory");
      this.memoryScreen.className = `screen memory-screen memory-screen--${id}`;
      $("#memoryKicker").textContent = route.visualLabel;
      $("#memoryTitle").classList.remove("is-visible");
      $("#memoryTitle").textContent = "";
      $("#memoryFragments").innerHTML = "";
      $("#innerThought").classList.remove("is-visible");
      $("#innerThought").textContent = "";
      await wait(500);
      $("#memoryTitle").textContent = route.remembered;
      $("#memoryTitle").classList.add("is-visible");
      this.addHistory("记忆", route.remembered);
      await this.waitForMemoryAdvance(1750);

      for (let index = 0; index < route.fragments.length; index += 1) {
        const paragraph = document.createElement("p");
        paragraph.textContent = route.fragments[index];
        if (index === route.fragments.length - 1) paragraph.classList.add("memory-fragment--last");
        $("#memoryFragments").append(paragraph);
        requestAnimationFrame(() => paragraph.classList.add("is-visible"));
        this.audio.playCue(id === "lin" ? "paper" : "luggage");
        this.addHistory("碎片", route.fragments[index]);
        await this.waitForMemoryAdvance(index === route.fragments.length - 1 ? 2100 : 1250);
      }

      $("#innerThought").textContent = route.thought;
      $("#innerThought").classList.add("is-visible");
      this.addHistory(`${route.name} · 心声`, route.thought);
      await this.waitForMemoryAdvance(3900);
      this.finishPerspective();
    }

    waitForMemoryAdvance(duration) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.memoryResolver = null;
          resolve();
        }, duration);
        this.memoryResolver = () => {
          clearTimeout(timer);
          this.memoryResolver = null;
          resolve();
        };
      });
    }

    advanceMemory() {
      const now = performance.now();
      if (now - this.memoryLastAdvance < 260) return;
      this.memoryLastAdvance = now;
      if (this.memoryResolver) this.memoryResolver();
    }

    async finishPerspective() {
      this.memoryResolver = null;
      this.save.prologueCompleted = true;
      this.save.checkpoint = "ending";
      this.persist();
      this.curtain.classList.add("curtain--closed");
      await wait(850);
      this.scene.className = "scene scene--black";
      this.showOnly(this.intertitleScreen, "intertitle");
      $("#intertitleEyebrow").textContent = "";
      $("#intertitleMain").textContent = STORY.intertitles.before.main;
      $("#intertitleSub").textContent = "";
      this.curtain.classList.remove("curtain--closed");
      this.intertitleScreen.classList.add("intertitle-screen--visible");
      await wait(2500);
      this.intertitleScreen.classList.remove("intertitle-screen--visible");
      await wait(650);

      const chapter = STORY.intertitles.chapterOne;
      $("#intertitleEyebrow").textContent = chapter.eyebrow;
      $("#intertitleMain").textContent = chapter.main;
      $("#intertitleSub").textContent = chapter.sub;
      this.audio.setMood("summer");
      this.scene.className = "scene scene--summer";
      this.intertitleScreen.classList.add("intertitle-screen--chapter", "intertitle-screen--visible");
      await wait(3300);
      this.intertitleScreen.classList.remove("intertitle-screen--visible", "intertitle-screen--chapter");
      await wait(600);
      this.showEnding();
    }

    showEnding() {
      this.audio.setMood("summer");
      this.scene.className = "scene scene--summer";
      this.showOnly(this.endingScreen, "ending");
      const last = this.save.lastPerspective;
      $("#chosenName").textContent = last ? STORY.perspectives[last].name : "一段记忆";
      const both = this.save.viewedPerspectives.zhou && this.save.viewedPerspectives.lin;
      $("#truthMessage").hidden = !both;
      $$("#routeProgress [data-route]").forEach((item) => {
        item.classList.toggle("is-complete", this.save.viewedPerspectives[item.dataset.route]);
      });
      $("#otherPerspectiveButton").textContent = both ? "再次选择视角" : "重新选择另一视角";
      requestAnimationFrame(() => this.endingScreen.classList.add("ending-screen--visible"));
      this.renderTitleProgress();
    }

    async replayOtherPerspective() {
      await this.audio.start();
      this.endingScreen.classList.remove("ending-screen--visible");
      await wait(450);
      this.audio.setMood("choice");
      this.scene.className = "scene scene--game scene--choice";
      this.showChoice();
    }

    returnToTitle(fromSettings) {
      if (fromSettings || !["title", "ending"].includes(this.currentScreen)) {
        this.returnDialog.showModal();
      } else {
        this.performReturnToTitle();
      }
    }

    async performReturnToTitle() {
      this.clearTyping();
      if (this.memoryResolver) this.memoryResolver();
      this.curtain.classList.add("curtain--closed");
      await wait(650);
      this.audio.setMood("title");
      this.scene.className = "scene scene--title";
      this.app.classList.remove("game-active");
      $("#topbar").classList.remove("topbar--visible");
      this.showOnly(this.titleScreen, "title");
      this.renderTitleProgress();
      this.curtain.classList.remove("curtain--closed");
    }

    showOnly(target, name) {
      this.screens.forEach((screen) => {
        const active = screen === target;
        screen.hidden = !active;
        if (!active) screen.setAttribute("aria-hidden", "true");
        else screen.removeAttribute("aria-hidden");
      });
      this.currentScreen = name;
      this.app.dataset.screen = name;
    }

    openSettings() {
      this.applySettingsToUI();
      $("#settingsReturnButton").hidden = this.currentScreen === "title";
      this.settingsDialog.showModal();
    }

    openHistory() {
      const list = $("#historyList");
      if (!this.save.history.length) {
        list.innerHTML = '<p class="history-empty">还没有可以回想的句子。</p>';
      } else {
        list.innerHTML = this.save.history.map((item) => `<article><span>${this.escapeHTML(item.speaker)}</span><p>${this.escapeHTML(item.text)}</p></article>`).join("");
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
      }
      this.historyDialog.showModal();
    }

    addHistory(speaker, text) {
      const last = this.save.history[this.save.history.length - 1];
      if (last?.speaker === speaker && last?.text === text) return;
      this.save.history.push({ speaker, text });
      this.save.history = this.save.history.slice(-80);
      this.persist();
    }

    escapeHTML(value) {
      return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
    }

    toggleMute() {
      this.audio.setMuted(!this.audio.muted);
      $("#soundButton").classList.toggle("is-muted", this.audio.muted);
      $("#soundButton").setAttribute("aria-label", this.audio.muted ? "打开声音" : "关闭声音");
      this.toast(this.audio.muted ? "声音已关闭" : "声音已打开");
    }

    async toggleFullscreen() {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
        else await document.exitFullscreen?.();
      } catch (error) {
        this.toast("当前浏览器不允许进入全屏");
      }
    }

    updateFullscreenButton() {
      const label = document.fullscreenElement ? "退出全屏" : "全屏";
      $("#fullscreenButton").setAttribute("aria-label", label);
      $("#dialogFullscreenButton span").textContent = label;
    }

    applySettingsToUI() {
      const speed = String(this.save.settings.textSpeed);
      const radio = $(`input[name="textSpeed"][value="${speed}"]`);
      if (radio) radio.checked = true;
      $("#ambienceToggle").checked = this.save.settings.ambience;
      $("#musicToggle").checked = this.save.settings.music;
      $("#dialogFullscreenButton").hidden = !document.fullscreenEnabled;
    }

    persistAndApplyAudio() {
      this.persist();
      this.audio.setSettings(this.save.settings);
      this.toast("声音设置已保存");
    }

    renderTitleProgress() {
      const continueButton = $("#continueButton");
      continueButton.hidden = !this.save.started;
      const viewed = Number(this.save.viewedPerspectives.zhou) + Number(this.save.viewedPerspectives.lin);
      const note = $("#progressNote");
      if (!this.save.started) note.textContent = "";
      else if (viewed === 2) note.textContent = "两段记忆已读 · 2 / 2";
      else if (viewed === 1) note.textContent = "仍有另一段记忆没有被看见";
      else note.textContent = "进度已自动保存";
    }

    toast(message, duration = 1800) {
      clearTimeout(this.toastTimer);
      this.toastElement.textContent = message;
      this.toastElement.classList.add("toast--visible");
      this.toastTimer = setTimeout(() => this.toastElement.classList.remove("toast--visible"), duration);
    }

    loadSave() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!raw || raw.version !== 1) return structuredClone(DEFAULT_SAVE);
        return {
          ...structuredClone(DEFAULT_SAVE),
          ...raw,
          viewedPerspectives: { ...DEFAULT_SAVE.viewedPerspectives, ...(raw.viewedPerspectives || {}) },
          settings: { ...DEFAULT_SAVE.settings, ...(raw.settings || {}) },
          history: Array.isArray(raw.history) ? raw.history : []
        };
      } catch (error) {
        return structuredClone(DEFAULT_SAVE);
      }
    }

    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
      } catch (error) {
        // 隐私模式可能禁止 localStorage；游戏仍可在本次会话运行。
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.game = new NarrativeGame();
  });
})();
