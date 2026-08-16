/* =====================================================================
   FOR ADUU — a birthday adventure by Jyoti
   script.js — state machine + interactions + audio + easter eggs
   ===================================================================== */

(() => {
"use strict";

/* ============================================================
   0. CONFIG — edit these
   ============================================================ */
const SECRET_PIN = "1234";                 // <-- change the PIN here only
const PIN_HINT = "Hint: it is 1234 🐣";
const YT_VIDEO_ID = "P3wSn5K9quo";         // background music (from the brief)
const MUSIC_VOLUME = 22;                   // 0-100, kept low/atmospheric

const photos = [                           // <-- swap these files in the project folder
  "aditiya-1.jpg",
  "aditiya-2.jpg",
  "aditiya-3.jpg",
  "aditiya-4.jpg"
];

const scenes = {
  PIN: "pin", SURPRISE: "surprise", BIRTHDAY: "birthday", BALLOONS: "balloons",
  CAKE: "cake", ROSES: "roses", PHOTOS: "photos", LETTER: "letter",
  FOOTBALL: "football", GIFT: "gift", PLAYER: "player", FINAL: "final"
};
const SCENE_ORDER = [scenes.PIN, scenes.SURPRISE, scenes.BIRTHDAY, scenes.BALLOONS, scenes.FOOTBALL,
  scenes.CAKE, scenes.ROSES, scenes.PHOTOS, scenes.LETTER, scenes.GIFT, scenes.PLAYER, scenes.FINAL];

const PROGRESS_STEP_FOR_SCENE = {
  pin: 1, surprise: 1, birthday: 1, balloons: 2, cake: 3, roses: 4,
  football: 4, photos: 6, letter: 7, gift: 8, player: 9, final: 10
};

const TOTAL_EGGS = 7;

const AppState = {
  balloonsCompleted:false, footballCompleted:false, goals:0, shots:0, saves:0,
  hatTrick:false, batmanFound:false, spidermanFound:false, candleMaster:false,
  bouquetFound:false, photosViewed:0, letterOpened:false, giftOpened:false
};
const Achievements = (() => {
  const defs = {
    firstStep:["🔐 FIRST STEP","Entered the birthday adventure."],
    balloonHunter:["🎈 BALLOON HUNTER","Popped every balloon."],
    hatTrick:["⚽ HAT-TRICK HERO","Scored three goals."],
    darkKnight:["🦇 DARK KNIGHT","Found the Batman secret."],
    webHead:["🕷️ WEB HEAD","Found the Spider-Man secret."],
    candleMaster:["🕯️ CANDLE MASTER","Successfully completed the candle interaction."],
    roseFinder:["🌹 ROSE FINDER","Discovered the bouquet interaction."],
    memoryHunter:["📸 MEMORY HUNTER","Viewed every photo."],
    heartfelt:["💌 HEARTFELT","Opened the birthday letter."],
    ultimate:["🎁 ULTIMATE SURPRISE","Opened the final gift."]
  };
  const unlocked = new Set();
  function unlock(id){ if(unlocked.has(id) || !defs[id]) return; unlocked.add(id); const [title,desc]=defs[id];
    const t=document.createElement("div"); t.className="achievement-toast"; t.innerHTML=`<span class="achievement-badge">🏆</span><div><small>ACHIEVEMENT UNLOCKED</small><strong>${title}</strong><em>${desc}</em></div>`; document.body.appendChild(t);
    AudioManager.play("mission"); navigator.vibrate?.([20,30,20]); setTimeout(()=>t.classList.add("show"),20); setTimeout(()=>{t.classList.remove("show");setTimeout(()=>t.remove(),450)},3600);
  }
  return {unlock,has:id=>unlocked.has(id)};
})();
function updateMissionHUD(){
  const list=[AppState.balloonsCompleted,AppState.footballCompleted,AppState.candleMaster,AppState.bouquetFound,AppState.photosViewed>=4,AppState.letterOpened,AppState.giftOpened];
  const done=list.filter(Boolean).length, pct=Math.round(done/7*100);
  const b=qs("#mission-bar"),c=qs("#mission-progress"); if(b)b.style.width=pct+"%"; if(c)c.textContent=`${done}/7`;
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   1. UTILITIES
   ============================================================ */
const qs = (s, ctx = document) => ctx.querySelector(s);
const qsa = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function setVH() {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
}
setVH();
window.addEventListener("resize", setVH);
window.addEventListener("orientationchange", setVH);

/* ============================================================
   2. AUDIO MANAGER — synthesized sound effects (no external files)
      + YouTube-embedded background music
   ============================================================ */
const AudioManager = (() => {
  let ctx = null;
  let muted = false;
  let unlocked = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, { type = "sine", vol = 0.16, glideTo = null, attack = 0.008 } = {}) {
    const ac = ensureCtx();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ac.currentTime + start + dur);
    gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.02);
  }

  function noiseBurst(start, dur, { vol = 0.12, filterFreq = 1800, type = "highpass" } = {}) {
    const ac = ensureCtx();
    if (!ac || muted) return;
    const bufferSize = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, ac.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(ac.currentTime + start);
  }

  const RECIPES = {
    click: () => tone(520, 0, 0.07, { type: "sine", vol: 0.1 }),
    del: () => tone(300, 0, 0.08, { type: "sine", vol: 0.09 }),
    error: () => { tone(200, 0, 0.18, { type: "sawtooth", vol: 0.08 }); tone(160, 0.08, 0.18, { type: "sawtooth", vol: 0.08 }); },
    success: () => { tone(523, 0, 0.14, { vol: 0.14 }); tone(659, 0.1, 0.16, { vol: 0.14 }); tone(784, 0.2, 0.28, { vol: 0.15 }); },
    pop: () => { tone(700, 0, 0.09, { type: "triangle", vol: 0.16, glideTo: 220 }); noiseBurst(0, 0.05, { vol: 0.06 }); },
    whoosh: () => noiseBurst(0, 0.3, { vol: 0.09, filterFreq: 900, type: "bandpass" }),
    magic: () => { [880, 1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.06, 0.22, { type: "triangle", vol: 0.09 })); },
    yes: () => { tone(660, 0, 0.1, { vol: 0.14 }); tone(880, 0.08, 0.18, { vol: 0.14 }); },
    kick: () => { tone(120, 0, 0.14, { type: "sine", vol: 0.2, glideTo: 50 }); noiseBurst(0, 0.05, { vol: 0.05 }); },
    bat: () => noiseBurst(0, 0.45, { vol: 0.07, filterFreq: 400, type: "lowpass" }),
    web: () => tone(300, 0, 0.28, { type: "sawtooth", vol: 0.06, glideTo: 900 }),
    cake: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.3, { vol: 0.1 })); },
    candle: () => noiseBurst(0, 0.35, { vol: 0.08, filterFreq: 1200, type: "lowpass" }),
    rose: () => { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, i * 0.05, 0.18, { type: "triangle", vol: 0.07 })); },
    swipe: () => tone(500, 0, 0.06, { type: "sine", vol: 0.08, glideTo: 800 }),
    paper: () => noiseBurst(0, 0.22, { vol: 0.07, filterFreq: 2200, type: "highpass" }),
    suspense: () => tone(220, 0, 0.6, { type: "sine", vol: 0.06, glideTo: 440 }),
    celebrate: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.07, 0.4, { vol: 0.1 })); },
    eggFound: () => { tone(784, 0, 0.1, { vol: 0.12 }); tone(1046, 0.09, 0.18, { vol: 0.13 }); },
    mission: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.09, 0.5, { vol: 0.11 })); },
    whistle: () => { tone(1700,0,.16,{type:"sine",vol:.06,glideTo:2100}); tone(1400,.18,.18,{type:"sine",vol:.05,glideTo:1900}); },
    goal: () => { tone(392,0,.08,{vol:.13}); tone(523,.08,.12,{vol:.14}); tone(784,.2,.35,{vol:.15}); },
    save: () => { tone(260,0,.12,{type:"triangle",vol:.1,glideTo:130}); },
    webSwing: () => { noiseBurst(0,.24,{vol:.06,filterFreq:1500,type:"bandpass"}); tone(500,.02,.3,{type:"sine",vol:.05,glideTo:1200}); }
  };

  function play(name) {
    if (!unlocked) return;
    const fn = RECIPES[name];
    if (fn) { try { fn(); } catch (e) { /* audio not critical */ } }
  }

  function unlockAudio() {
    unlocked = true;
    ensureCtx();
  }

  function setMuted(v) { muted = v; }
  function isMuted() { return muted; }

  return { play, unlockAudio, setMuted, isMuted };
})();

/* ============================================================
   3. BACKGROUND MUSIC (YouTube IFrame API)
   ============================================================ */
const MusicManager = (() => {
  let player = null;
  let ready = false;
  let playing = false;
  let fadeTimer = null;

  function injectAPI() {
    if (window.YT && window.YT.Player) { createPlayer(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = createPlayer;
  }

  function createPlayer() {
    const host = document.createElement("div");
    host.id = "yt-music-host";
    host.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0;";
    document.body.appendChild(host);
    player = new YT.Player(host, {
      videoId: YT_VIDEO_ID,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, loop: 1, playlist: YT_VIDEO_ID },
      events: {
        onReady: () => { ready = true; player.setVolume(0); },
        onStateChange: () => {}
      }
    });
  }

  function fadeTo(target, ms) {
    if (!player || !ready) return;
    clearInterval(fadeTimer);
    const steps = 16;
    const start = player.getVolume ? player.getVolume() : 0;
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      const v = start + (target - start) * (i / steps);
      try { player.setVolume(clamp(v, 0, 100)); } catch (e) {}
      if (i >= steps) clearInterval(fadeTimer);
    }, ms / steps);
  }

  function start() {
    if (!player) return;
    try {
      player.playVideo();
      playing = true;
      fadeTo(MUSIC_VOLUME, 900);
    } catch (e) {}
  }

  function stop() {
    if (!player) return;
    fadeTo(0, 500);
    setTimeout(() => { try { player.pauseVideo(); } catch (e) {} }, 520);
    playing = false;
  }

  function toggle() {
    if (playing) stop(); else start();
    return playing;
  }

  function isPlaying() { return playing; }

  return { injectAPI, start, stop, toggle, isPlaying };
})();

/* ============================================================
   4. AMBIENT VISUAL FX — floating hearts/sparkles + confetti canvas
   ============================================================ */
const floatLayer = qs("#float-layer");
const fxCanvas = qs("#fx-canvas");
const fxCtx = fxCanvas.getContext("2d");
let fxParticles = [];
let fxRAF = null;

function resizeCanvas() {
  fxCanvas.width = window.innerWidth * devicePixelRatio;
  fxCanvas.height = window.innerHeight * devicePixelRatio;
  fxCanvas.style.width = window.innerWidth + "px";
  fxCanvas.style.height = window.innerHeight + "px";
  fxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function spawnFloaties(emojis, count = 6) {
  if (prefersReducedMotion) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "floaty";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const left = rand(4, 92);
    const dur = rand(4.5, 8);
    const delay = rand(0, 1.4);
    const size = rand(0.9, 1.7);
    el.style.left = left + "%";
    el.style.fontSize = size + "rem";
    el.style.setProperty("--drift", rand(-40, 40) + "px");
    el.style.animationDuration = dur + "s";
    el.style.animationDelay = delay + "s";
    floatLayer.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 200);
  }
}

function confettiBurst(originX, originY, { count = 26, colors = ["#ff6b93", "#f0c14b", "#ffb3c6", "#fff4ef"], power = 1 } = {}) {
  if (prefersReducedMotion) count = Math.min(count, 8);
  const ox = originX ?? window.innerWidth / 2;
  const oy = originY ?? window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(2, 6) * power;
    fxParticles.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      g: 0.14,
      life: rand(50, 90),
      age: 0,
      size: rand(4, 8),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? "rect" : "circle",
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2)
    });
  }
  if (!fxRAF) fxRAF = requestAnimationFrame(tickFx);
}

function tickFx() {
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  fxParticles = fxParticles.filter(p => p.age < p.life);
  fxParticles.forEach(p => {
    p.age++;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const alpha = clamp(1 - p.age / p.life, 0, 1);
    fxCtx.save();
    fxCtx.globalAlpha = alpha;
    fxCtx.translate(p.x, p.y);
    fxCtx.rotate(p.rot);
    fxCtx.fillStyle = p.color;
    if (p.shape === "rect") fxCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else { fxCtx.beginPath(); fxCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2); fxCtx.fill(); }
    fxCtx.restore();
  });
  if (fxParticles.length > 0) {
    fxRAF = requestAnimationFrame(tickFx);
  } else {
    fxRAF = null;
  }
}

/* ============================================================
   5. EASTER EGG SYSTEM
   ============================================================ */
const EasterEggs = (() => {
  const found = new Set();
  const counterPill = qs("#egg-counter");
  const counterText = qs("#egg-count-text");
  const toast = qs("#egg-toast");
  let toastTimer = null;

  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => { toast.hidden = true; }, 300);
    }, 2600);
  }

  function discover(id, msg) {
    if (found.has(id)) return;
    found.add(id);
    counterPill.hidden = false;
    counterPill.classList.add("shown");
    counterText.textContent = `${found.size} / ${TOTAL_EGGS}`;
    counterPill.classList.remove("bump");
    void counterPill.offsetWidth;
    counterPill.classList.add("bump");
    AudioManager.play("eggFound");
    showToast(msg);
    spawnFloaties(["✨"], 4);
    if (found.size === TOTAL_EGGS) {
      setTimeout(() => {
        AudioManager.play("mission");
        showToast("🏆 SECRET MISSION COMPLETE");
      }, 400);
    }
  }

  function allFound() { return found.size >= TOTAL_EGGS; }
  function count() { return found.size; }

  return { discover, allFound, count };
})();

/* ============================================================
   6. SCENE MANAGER
   ============================================================ */
const sceneEls = {};
qsa(".scene").forEach(el => { sceneEls[el.dataset.scene] = el; });
const progressTrack = qs("#progress-track");
const progressNodes = qsa(".progress-node");
let currentScene = null;

function goTo(name, { silent = false } = {}) {
  const prevEl = currentScene ? sceneEls[currentScene] : null;
  const nextEl = sceneEls[name];
  if (!nextEl || name === currentScene) return;

  if (prevEl) {
    prevEl.classList.remove("active");
  }
  nextEl.classList.add("active");
  currentScene = name;

  updateProgress(name);
  runSceneEnter(name);
}

function updateProgress(name) {
  const step = PROGRESS_STEP_FOR_SCENE[name];
  if (!step) return;
  progressTrack.hidden = false;
  progressTrack.classList.add("shown");
  progressNodes.forEach(node => {
    const s = Number(node.dataset.step);
    node.classList.toggle("done", s < step);
    node.classList.toggle("now", s === step);
  });
}

const sceneEnterHooks = {};
function onEnter(name, fn) { sceneEnterHooks[name] = fn; }
function runSceneEnter(name) {
  if (sceneEnterHooks[name]) sceneEnterHooks[name]();
}

/* ============================================================
   7. SCENE 01 — PIN ENTRY
   ============================================================ */
(() => {
  let entered = "";
  const dotsWrap = qs("#pin-dots");
  const dots = qsa(".pin-dot", dotsWrap);
  const keypad = qs("#keypad");
  const unlockOverlay = qs("#unlock-overlay");
  const hintText = qs("#pin-hint-text");
  let hintShown = false;

  function renderDots() {
    dots.forEach((d, i) => d.classList.toggle("filled", i < entered.length));
  }

  function wrongFeedback() {
    dotsWrap.classList.add("shake");
    AudioManager.play("error");
    setTimeout(() => {
      dotsWrap.classList.remove("shake");
      entered = "";
      renderDots();
    }, 420);
  }

  function correctFeedback() {
    Achievements.unlock("firstStep"); updateMissionHUD();
    dotsWrap.classList.add("success");
    AudioManager.play("success");
    AudioManager.unlockAudio();
    setTimeout(() => {
      unlockOverlay.hidden = false;
      MusicManager.start();
      qs("#music-toggle").hidden = false;
      qs("#music-toggle").setAttribute("aria-pressed", "true");
      qs("#egg-batman").hidden = false;
      spawnFloaties(["💗", "✨", "💛"], 10);
    }, 300);
    setTimeout(() => {
      unlockOverlay.hidden = true;
      goTo(scenes.SURPRISE);
    }, 2000);
  }

  function handleKey(key) {
    if (key === "hint") {
      hintShown = !hintShown;
      hintText.hidden = !hintShown;
      return;
    }
    AudioManager.unlockAudio();
    if (key === "del") {
      entered = entered.slice(0, -1);
      AudioManager.play("del");
      renderDots();
      return;
    }
    if (entered.length >= 4) return;
    entered += key;
    AudioManager.play("click");
    renderDots();
    if (entered.length === 4) {
      if (entered === SECRET_PIN) correctFeedback();
      else wrongFeedback();
    }
  }

  keypad.addEventListener("click", (e) => {
    const btn = e.target.closest(".key");
    if (!btn) return;
    handleKey(btn.dataset.key);
  });

  window.addEventListener("keydown", (e) => {
    if (currentScene !== scenes.PIN) return;
    if (/^[0-9]$/.test(e.key)) handleKey(e.key);
    else if (e.key === "Backspace") handleKey("del");
  });

  qs("#pin-hint-text").hidden = true;
  hintText.textContent = PIN_HINT;
})();

/* ============================================================
   8. SCENE 02 — SURPRISE POPUP (escaping NO button)
   ============================================================ */
(() => {
  const yesBtn = qs("#yes-btn-1");
  const noBtn = qs("#no-btn-1");
  const btnRow = qs("#surprise-btn-row");
  const messages = ["No? 👀", "Are you sure?", "Nice try 😂", "Just press YES! 😄"];
  let dodgeCount = 0;
  let escaped = false;

  function escape(clientX, clientY) {
    escaped = true;
    dodgeCount++;
    AudioManager.play("whoosh");
    const btnRect = noBtn.getBoundingClientRect();
    const yesRect = yesBtn.getBoundingClientRect();
    const margin = 16;
    const w = btnRect.width || 110;
    const h = btnRect.height || 48;
    let attempts = 0;
    let x, y;
    do {
      x = rand(margin, window.innerWidth - w - margin);
      y = rand(window.innerHeight * 0.2, window.innerHeight * 0.82 - h);
      attempts++;
    } while (
      attempts < 12 &&
      x < yesRect.right + 24 && x + w > yesRect.left - 24 &&
      y < yesRect.bottom + 24 && y + h > yesRect.top - 24
    );
    noBtn.classList.add("fixed-pos");
    noBtn.style.left = x + "px";
    noBtn.style.top = y + "px";
    if (dodgeCount <= messages.length) noBtn.textContent = messages[Math.min(dodgeCount - 1, messages.length - 1)];
  }

  noBtn.addEventListener("pointerenter", (e) => { if (matchMedia("(hover:hover)").matches) escape(e.clientX, e.clientY); });
  noBtn.addEventListener("pointerdown", (e) => { escape(e.clientX, e.clientY); e.preventDefault(); });
  noBtn.addEventListener("touchstart", (e) => { escape(); e.preventDefault(); }, { passive: false });

  yesBtn.addEventListener("click", () => {
    AudioManager.play("yes");
    spawnFloaties(["❤️", "✨"], 6);
    goTo(scenes.BIRTHDAY);
  });

  onEnter(scenes.SURPRISE, () => {
    escaped = false;
    dodgeCount = 0;
    noBtn.classList.remove("fixed-pos");
    noBtn.style.left = ""; noBtn.style.top = "";
    noBtn.textContent = "NO 😏";
  });
})();

/* ============================================================
   9. SCENE 03 — BIRTHDAY REVEAL
   ============================================================ */
(() => {
  qs("#birthday-next").addEventListener("click", () => {
    AudioManager.play("yes");
    goTo(scenes.BALLOONS);
  });
  onEnter(scenes.BIRTHDAY, () => {
    AudioManager.play("success");
    confettiBurst(window.innerWidth / 2, window.innerHeight * 0.35, { count: 34 });
    spawnFloaties(["🎉", "💗", "✨"], 8);
  });
})();

/* ============================================================
   10. SCENE 04 — BALLOON MINI-GAME
   ============================================================ */
(() => {
  const field = qs("#balloon-field");
  const sentenceEl = qs("#balloon-sentence");
  const words = ["YOU", "ARE", "SO", "SPECIAL"];
  let popped = [];
  let autoAdvanceTimer = null;
  let candleTriTapCount = 0; // (unused here, placeholder removed below)

  function build() {
    field.innerHTML = "";
    popped = [false, false, false, false];
    sentenceEl.textContent = "";
    words.forEach((word, i) => {
      const b = document.createElement("button");
      b.className = "balloon";
      b.setAttribute("aria-label", "Pop balloon " + (i + 1));
      const wordSpan = document.createElement("span");
      wordSpan.className = "balloon-word";
      wordSpan.textContent = word;
      b.appendChild(wordSpan);
      if (i === 0) {
        // subtle football-styled balloon
        const ball = document.createElement("span");
        ball.textContent = "⚽";
        ball.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:rgba(255,255,255,0.35);pointer-events:none;";
        b.appendChild(ball);
      }
      b.addEventListener("click", () => pop(b, i), { once: true });
      field.appendChild(b);
    });
  }

  function pop(el, i) {
    if (popped[i]) return;
    popped[i] = true;
    el.classList.add("popped");
    el.querySelector(".balloon-word").classList.add("show");
    AudioManager.play("pop");
    const rect = el.getBoundingClientRect();
    confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 16, power: 0.8 });
    sentenceEl.textContent = words.filter((_, idx) => popped[idx]).join(" ") ;
    if (popped.every(Boolean)) {
      EasterEggs.discover("balloonGoal", "⚽ GOAL! You scored all 4!"); AppState.balloonsCompleted=true; Achievements.unlock("balloonHunter"); updateMissionHUD();
      sentenceEl.textContent = "YOU ARE SO SPECIAL ❤️";
      AudioManager.play("magic");
      spawnFloaties(["❤️", "✨"], 10);
      autoAdvanceTimer = setTimeout(() => goTo(scenes.FOOTBALL), 1800);
    }
  }

  onEnter(scenes.BALLOONS, () => {
    clearTimeout(autoAdvanceTimer);
    build();
  });
})();

/* ============================================================
   11. SCENE 05 — CAKE + CANDLE
   ============================================================ */
(() => {
  const candle = qs("#candle");
  const glow = qs(".cake-glow");
  const smoke = qs("#smoke-puff");
  let blown = false;
  let tapTimestamps = [];

  function blowOut() {
    if (blown) return;
    blown = true;
    AppState.candleMaster=true; Achievements.unlock("candleMaster"); updateMissionHUD();
    candle.classList.add("blown");
    glow.classList.add("off");
    smoke.hidden = false;
    smoke.style.animation = "none";
    void smoke.offsetWidth;
    smoke.style.animation = "";
    AudioManager.play("candle");
    setTimeout(() => AudioManager.play("cake"), 350);
    confettiBurst(window.innerWidth / 2, window.innerHeight * 0.4, { count: 30 });
    spawnFloaties(["🎂", "✨", "💛"], 8);
    setTimeout(() => goTo(scenes.ROSES), 1700);
  }

  candle.addEventListener("click", () => {
    const now = Date.now();
    tapTimestamps.push(now);
    tapTimestamps = tapTimestamps.filter(t => now - t < 700);
    if (tapTimestamps.length >= 3) {
      EasterEggs.discover("candleTriple", "⚽ Nutmeg! (that's a football move, by the way)");
      tapTimestamps = [];
    }
    blowOut();
  });

  onEnter(scenes.CAKE, () => {
    blown = false;
    tapTimestamps = [];
    candle.classList.remove("blown");
    glow.classList.remove("off");
    smoke.hidden = true;
  });
})();

/* ============================================================
   12. SCENE 06 — ROSE BOUQUET (wrapped → reveal → bloom)
   ============================================================ */
(() => {
  const lead = qs("#roses-lead");
  const card = qs("#bouquet-card");
  const teaserEyebrow = qs("#bouquet-teaser-eyebrow");
  const teaserSub = qs("#bouquet-teaser-sub");
  const title = qs("#roses-title");
  const closed = qs("#bouquet-closed");
  const open = qs("#bouquet-open");
  const revealBtn = qs("#bouquet-reveal-btn");
  const continueBtn = qs("#roses-continue");
  let leadTimer = null;
  let revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    revealBtn.hidden = true;
    closed.classList.add("opening");
    AudioManager.play("whoosh");
    setTimeout(() => {
      teaserEyebrow.hidden = true;
      teaserSub.hidden = true;
      title.hidden = false;
      closed.hidden = true;
      open.hidden = false;
      AudioManager.play("rose"); AppState.bouquetFound=true; Achievements.unlock("roseFinder"); updateMissionHUD();
      spawnFloaties(["🌹", "✨"], 10);
      requestAnimationFrame(() => open.classList.add("show"));
      setTimeout(() => { continueBtn.hidden = false; }, 900);
    }, 420);
  }

  revealBtn.addEventListener("click", reveal);

  continueBtn.addEventListener("click", () => {
    AudioManager.play("yes");
    goTo(scenes.PHOTOS);
  });

  onEnter(scenes.ROSES, () => {
    clearTimeout(leadTimer);
    revealed = false;
    card.hidden = true;
    lead.hidden = false;
    teaserEyebrow.hidden = false;
    teaserSub.hidden = false;
    title.hidden = true;
    closed.hidden = false;
    closed.classList.remove("opening");
    open.hidden = true;
    open.classList.remove("show");
    revealBtn.hidden = false;
    continueBtn.hidden = true;
    leadTimer = setTimeout(() => {
      lead.hidden = true;
      card.hidden = false;
      spawnFloaties(["✨"], 4);
    }, 1500);
  });
})();

/* ============================================================
   13. SCENE 07 — PHOTO FLASH CARDS
   ============================================================ */
(() => {
  const stage = qs("#photo-stage");
  const cards = qsa(".photo-card", stage);
  const countEl = qs("#photo-count");
  const prevBtn = qs("#photo-prev");
  const nextBtn = qs("#photo-next");
  const webEgg = qs("#web-egg");
  let index = 0;
  const total = cards.length;
  const seen = new Set();
  let advanced = false;

  function render() {
    cards.forEach((card, i) => {
      card.classList.remove("pos-current", "pos-next", "pos-prev", "pos-hidden");
      if (i === index) card.classList.add("pos-current");
      else if (i === (index + 1) % total) card.classList.add("pos-next");
      else if (i === (index - 1 + total) % total) card.classList.add("pos-prev");
      else card.classList.add("pos-hidden");
    });
    countEl.textContent = String(index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
    webEgg.hidden = index !== 2; // spider photo card

    seen.add(index); AppState.photosViewed=seen.size; if(seen.size===total) Achievements.unlock("memoryHunter"); updateMissionHUD();
    if (!advanced && seen.size === total && currentScene === scenes.PHOTOS) {
      advanced = true;
      setTimeout(() => goTo(scenes.LETTER), 900);
    }
  }

  function go(delta) {
    index = (index + delta + total) % total;
    AudioManager.play("swipe");
    render();
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  webEgg.addEventListener("click", (e) => {
    e.stopPropagation();
    EasterEggs.discover("spiderWeb", "🕷️ Friendly Neighborhood Birthday Boy detected!"); AppState.spidermanFound=true; Achievements.unlock("webHead"); updateMissionHUD(); openThemeSecret("spider");
  });

  // swipe / drag
  let startX = 0, currentX = 0, dragging = false;
  const current = () => qs(".photo-card.pos-current", stage);

  function dragStart(x) {
    dragging = true;
    startX = x; currentX = x;
    const c = current();
    if (c) c.classList.add("dragging");
  }
  function dragMove(x) {
    if (!dragging) return;
    currentX = x;
    const dx = currentX - startX;
    const c = current();
    if (c) c.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
  }
  function dragEnd() {
    if (!dragging) return;
    dragging = false;
    const dx = currentX - startX;
    const c = current();
    if (c) { c.style.transform = ""; c.classList.remove("dragging"); }
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  }

  stage.addEventListener("pointerdown", (e) => dragStart(e.clientX));
  window.addEventListener("pointermove", (e) => { if (currentScene === scenes.PHOTOS) dragMove(e.clientX); });
  window.addEventListener("pointerup", () => { if (currentScene === scenes.PHOTOS) dragEnd(); });

  const modal=qs("#photo-modal"), modalImg=qs("#photo-modal-img"), modalClose=qs("#photo-close"), modalPrev=qs("#photo-modal-prev"), modalNext=qs("#photo-modal-next");
  function openPhoto(){ modalImg.src=photos[index]; modal.hidden=false; requestAnimationFrame(()=>modal.classList.add("show")); AudioManager.play("web"); }
  function closePhoto(){ modal.classList.remove("show"); setTimeout(()=>modal.hidden=true,250); }
  cards.forEach(card=>card.addEventListener("click",()=>openPhoto()));
  modalClose.addEventListener("click",closePhoto); modalPrev.addEventListener("click",()=>{go(-1);openPhoto()}); modalNext.addEventListener("click",()=>{go(1);openPhoto()});
  modal.addEventListener("click",e=>{if(e.target===modal)closePhoto()}); window.addEventListener("keydown",e=>{if(!modal.hidden&&e.key==="Escape")closePhoto()});
  onEnter(scenes.PHOTOS, () => { index = 0; seen.clear(); advanced = false; render(); });
})();

/* ============================================================
   14. SCENE 08 — PERSONAL LETTER
   ============================================================ */
(() => {
  const seal = qs("#letter-seal");
  const paper = qs("#letter-paper");
  const nextBtn = qs("#letter-next");
  let opened = false;
  let tapTimestamps = [];

  function open() {
    if (opened) return;
    opened = true;
    seal.classList.add("opening");
    AudioManager.play("paper");
    setTimeout(() => {
      seal.hidden = true;
      paper.hidden = false;
      nextBtn.hidden = false; AppState.letterOpened=true; Achievements.unlock("heartfelt"); updateMissionHUD();
      spawnFloaties(["💗", "✨"], 6);
    }, 380);
  }

  seal.addEventListener("click", () => {
    const now = Date.now();
    tapTimestamps.push(now);
    tapTimestamps = tapTimestamps.filter(t => now - t < 700);
    if (tapTimestamps.length >= 3) {
      EasterEggs.discover("letterTripleTap", "🦇 Gotham-level secrecy achieved.");
      tapTimestamps = [];
    }
    open();
  });
  seal.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });

  nextBtn.addEventListener("click", () => {
    AudioManager.play("yes");
    goTo(scenes.GIFT);
  });

  onEnter(scenes.LETTER, () => {
    opened = false;
    tapTimestamps = [];
    seal.hidden = false;
    seal.classList.remove("opening");
    paper.hidden = true;
    nextBtn.hidden = true;
  });
})();

/* ============================================================
   15. SCENE 09 — GIFT BOX (shake-by-drag or press-and-hold to open)
   ============================================================ */
(() => {
  const box = qs("#gift-box");
  const HOLD_MS = 650;
  const SHAKE_WINDOW = 900;
  const SHAKE_REVERSALS_NEEDED = 3;
  const SHAKE_MIN_DELTA = 6;

  let opened = false;
  let heldPastOpen = false;
  let dragActive = false;
  let holding = false;
  let holdStart = 0;
  let holdRAF = null;
  let lastX = 0, lastDir = 0, reversals = 0, reversalWindowStart = 0;

  function setHold(pct) { box.style.setProperty("--hold", String(pct)); }

  function resetShake() { reversals = 0; lastDir = 0; reversalWindowStart = 0; }

  function stopHold() {
    holding = false;
    if (holdRAF) cancelAnimationFrame(holdRAF);
    holdRAF = null;
    box.classList.remove("holding");
    setHold(0);
  }

  function startHold() {
    if (opened || holding) return;
    holding = true;
    holdStart = Date.now();
    box.classList.add("holding");
    const tick = () => {
      if (!holding) return;
      const elapsed = Date.now() - holdStart;
      const pct = clamp((elapsed / HOLD_MS) * 100, 0, 100);
      setHold(pct);
      if (elapsed >= HOLD_MS) { stopHold(); openBox(); return; }
      holdRAF = requestAnimationFrame(tick);
    };
    holdRAF = requestAnimationFrame(tick);
  }

  function openBox() {
    if (opened) return;
    opened = true;
    AppState.giftOpened=true; Achievements.unlock("ultimate"); updateMissionHUD();
    heldPastOpen = dragActive;
    box.classList.add("shake");
    AudioManager.play("suspense");
    setTimeout(() => {
      box.classList.remove("shake");
      box.classList.add("opened");
      AudioManager.play("magic");
      const rect = box.getBoundingClientRect();
      confettiBurst(rect.left + rect.width / 2, rect.top, { count: 36 });
      spawnFloaties(["🎁", "✨", "💛"], 8);
      setTimeout(() => {
        if (heldPastOpen) {
          EasterEggs.discover("giftLongPress", "🕷️ With great birthdays comes great responsibility… to eat cake.");
        }
        goTo(scenes.PLAYER);
      }, 1400);
    }, 480);
  }

  box.addEventListener("pointerdown", (e) => {
    if (opened) return;
    e.preventDefault();
    try { box.setPointerCapture(e.pointerId); } catch (err) {}
    dragActive = true;
    lastX = e.clientX;
    resetShake();
    startHold();
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragActive || opened || currentScene !== scenes.GIFT) return;
    const dx = e.clientX - lastX;
    if (Math.abs(dx) < SHAKE_MIN_DELTA) return;
    const dir = dx > 0 ? 1 : -1;
    lastX = e.clientX;
    const now = Date.now();
    if (dir !== lastDir) {
      if (!reversalWindowStart || now - reversalWindowStart > SHAKE_WINDOW) {
        reversalWindowStart = now;
        reversals = 0;
      }
      reversals++;
      lastDir = dir;
      if (reversals >= SHAKE_REVERSALS_NEEDED) {
        stopHold();
        AudioManager.play("whoosh");
        resetShake();
        openBox();
      }
    }
  });

  function endPointer() {
    dragActive = false;
    resetShake();
    if (!opened) stopHold();
  }
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  box.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !opened) { e.preventDefault(); openBox(); }
  });

  onEnter(scenes.GIFT, () => {
    opened = false;
    heldPastOpen = false;
    dragActive = false;
    stopHold();
    box.classList.remove("opened", "shake", "holding");
  });
})();

/* ============================================================
   16. SCENE 05 — FOOTBALL PENALTY SHOOTOUT
   ============================================================ */
(() => {
  const zones=qsa("#shoot-zones button"), keeper=qs("#keeper"), score=qs("#football-score"), shots=qs("#football-shots"), saves=qs("#football-saves"), commentary=qs("#football-commentary"), attempts=qs("#football-attempts");
  let used=0, goals=0, saved=0, locked=false;
  const keeperZones=["tl","tc","tr","ml","c","mr","bl","bc","br"];
  const lines={goal:["WHAT A FINISH!","THE CROWD ERUPTS!","GOOOOOOAL!"],save:["WHAT A SAVE!","THE KEEPER READ IT!","DENIED!"]};
  function reset(){used=goals=saved=0;locked=false; score.textContent="0";shots.textContent="0";saves.textContent="0";attempts.textContent="3 SHOTS";commentary.textContent="Aduu (Mera Spotify) steps up..."; keeper.className="keeper";}
  function shoot(zone){
    if(locked || used>=3) return; locked=true; used++; AppState.shots=used; AppState.goals=goals; AppState.saves=saved; shots.textContent=used;
    const k=keeperZones[Math.floor(Math.random()*keeperZones.length)]; keeper.dataset.zone=k; keeper.classList.add("dive",k);
    commentary.textContent="He shoots!"; AudioManager.play("kick");
    const isGoal=k!==zone; setTimeout(()=>{
      if(isGoal){goals++; score.textContent=goals; commentary.textContent=lines.goal[Math.min(goals-1,2)]; AudioManager.play("goal"); confettiBurst(window.innerWidth/2,window.innerHeight*.35,{count:24}); navigator.vibrate?.(35);}
      else {saved++; saves.textContent=saved; commentary.textContent=lines.save[saved%3]; AudioManager.play("save"); navigator.vibrate?.(18);}
      AppState.goals=goals; AppState.saves=saved; attempts.textContent=used<3?`${3-used} SHOTS LEFT`:"FULL TIME";
      if(goals>=3){AppState.hatTrick=true; AppState.footballCompleted=true; Achievements.unlock("hatTrick"); updateMissionHUD(); commentary.textContent="🔥 HAT-TRICK HERO!"; setTimeout(()=>goTo(scenes.CAKE),1700); return;}
      if(used>=3){AppState.footballCompleted=true; updateMissionHUD(); setTimeout(()=>goTo(scenes.CAKE),1700); return;}
      locked=false;
    },650);
  }
  zones.forEach(b=>b.addEventListener("click",()=>shoot(b.dataset.zone)));
  const jt=qs("#juggle-toggle"), game=qs("#juggle-game"), jb=qs("#juggle-ball"), jc=qs("#juggle-count"); let touches=0, juggleTimer=null;
  jt?.addEventListener("click",()=>{game.hidden=!game.hidden; if(!game.hidden){touches=0;jc.textContent="0";jb.style.top="50%";clearTimeout(juggleTimer);juggleTimer=setTimeout(()=>{jb.style.top="100%"},1800)}});
  jb?.addEventListener("pointerdown",e=>{e.preventDefault();touches++;jc.textContent=touches;AudioManager.play("kick");navigator.vibrate?.(8);jb.classList.remove("juggle-pop");void jb.offsetWidth;jb.classList.add("juggle-pop");clearTimeout(juggleTimer);juggleTimer=setTimeout(()=>{jb.style.top="100%"},Math.max(650,1200-touches*14));if(touches===10)commentary.textContent="NICE!";if(touches===20)commentary.textContent="SKILL MODE!";if(touches===30)commentary.textContent="🔥 LEGENDARY!";});
  onEnter(scenes.FOOTBALL,()=>reset());
})();

/* ============================================================
   17. PLAYER CARD
   ============================================================ */
(() => {
  const next=qs("#player-next"); if(next) next.addEventListener("click",()=>{AudioManager.play("yes"); goTo(scenes.FINAL);});
})();

/* ============================================================
   18. CINEMATIC THEME SECRETS
   ============================================================ */
function openThemeSecret(kind){
  const overlay=qs("#secret-overlay"), box=qs("#secret-scene"); if(!overlay||!box)return;
  const data={
    batman:{icon:"🦇",title:"GOTHAM HAS A MESSAGE...",msg:"Even Batman needs a best friend.",className:"bat-secret"},
    spider:{icon:"🕷️",title:"⚠️ SPIDER-SENSE ACTIVATED",msg:"With great friendship comes great memories.",className:"spider-secret"},
    football:{icon:"🦇 + ⚽",title:"EVEN GOTHAM NEEDS A STRIKER",msg:"Birthday football mode unlocked.",className:"football-secret"}
  }[kind];
  if(!data)return; box.className="secret-scene "+data.className; box.innerHTML=`<div class="secret-icon">${data.icon}</div><h2>${data.title}</h2><p>${data.msg}</p><strong>Happy Birthday, Aduu (Mera Spotify) ❤️</strong>`; overlay.hidden=false; overlay.classList.add("show"); AudioManager.play(kind==="batman"?"bat":kind==="spider"?"webSwing":"kick");
  if(kind==="batman"){for(let i=0;i<7;i++){const b=document.createElement("i");b.textContent="🦇";b.style.left=Math.random()*100+"%";b.style.animationDelay=Math.random()*1.4+"s";box.appendChild(b);}}
  setTimeout(()=>{overlay.classList.remove("show");setTimeout(()=>overlay.hidden=true,500)},4200);
}

/* ============================================================
   16. SCENE 10 — FINAL REVEAL
   ============================================================ */
(() => {
  const finalMessage = qs("#final-message");
  const secretMission = qs("#secret-mission");
  const title = qs("#final-title");
  const sub = qs("#final-sub");

  onEnter(scenes.FINAL, () => {
    AudioManager.play("celebrate");
    confettiBurst(window.innerWidth / 2, window.innerHeight * 0.3, { count: 46 });
    spawnFloaties(["🎉", "❤️", "✨", "🎂"], 14);
    if (EasterEggs.allFound()) {
      title.textContent = "🏆 Surprise!";
      sub.textContent = "You found every last secret.";
      finalMessage.hidden = true;
      secretMission.hidden = false;
    } else {
      finalMessage.hidden = false;
      secretMission.hidden = true;
      title.textContent = "⚽ 🦇 🕷️ ADUU — THE LEGEND";
      sub.innerHTML = "FRIEND · CHAOS PARTNER · MEMORY MAKER · LEGEND<br><b>HAPPY BIRTHDAY, ADUU ❤️</b>";
    }
  });
})();

/* ============================================================
   17. GLOBAL EASTER EGG TRIGGERS (football + batman icons)
   ============================================================ */
(() => {
  qs("#egg-football").addEventListener("click", () => {
    EasterEggs.discover("footballIcon", "⚽ Scoreboard: Birthday 1 — Monday 0.");
    openThemeSecret("football");
  });
  qs("#egg-batman").addEventListener("click", () => {
    EasterEggs.discover("batmanIcon", "🦇 Even Batman deserves a birthday break.");
    AppState.batmanFound=true; Achievements.unlock("darkKnight"); updateMissionHUD(); openThemeSecret("batman");
  });
})();

/* ============================================================
   18. MUSIC TOGGLE BUTTON
   ============================================================ */
(() => {
  const btn = qs("#music-toggle");
  const icon = qs("#music-icon");
  btn.addEventListener("click", () => {
    const playing = MusicManager.toggle();
    btn.setAttribute("aria-pressed", String(playing));
    icon.textContent = playing ? "🎵" : "🔇";
  });
})();


/* ============================================================
   19. REPLAY
   ============================================================ */
(() => { const b=qs("#play-again"); if(!b)return; b.addEventListener("click",()=>location.reload()); })();

/* ============================================================
   19. INIT
   ============================================================ */
MusicManager.injectAPI();
sceneEls[scenes.PIN].classList.add("active");
currentScene = scenes.PIN;
updateMissionHUD();
spawnFloaties(["✨", "💗"], 5);
setInterval(() => { if (!prefersReducedMotion) spawnFloaties(["✨"], 2); }, 5000);

})();
