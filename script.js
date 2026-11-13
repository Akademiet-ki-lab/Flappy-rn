(() => {
  "use strict";

  const W = 400,
    H = 640,
    GROUND = 552;
  const GAP_MIN = 126,
    GAP_MAX = 146,
    SPACING = 215,
    GOAL = 100,
    BASE_SPEED = 2.4,
    STEP_EVERY = 20,
    STEP_BOOST = 0.4;
  const GRAV = 0.38,
    FLAP = -6.9,
    MAXFALL = 9.5,
    R = 11;
  const KEY = "orneflukt-best",
    KEY_XP = "orneflukt-xp",
    KEY_SKIN = "orneflukt-skin";
  const MAX_XP = 200, // max level; level = total XP
    TREES_PER_XP = 10, // 1 XP for every 10th tree
    FEATHER_XP = 40, // level where the golden feather is unlocked
    INVULN = 75; // frames of protection after the feather is used
  const reduce = !!(
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  /* ---- tokens from CSS ---- */
  const cs = getComputedStyle(document.documentElement);
  const C = {};
  [
    "--night",
    "--sky-hi",
    "--sky-mid",
    "--sky-low",
    "--snow",
    "--snow-shade",
    "--spruce",
    "--spruce-dark",
    "--trunk",
    "--eagle",
    "--eagle-dark",
    "--eagle-belly",
    "--eagle-head",
    "--tail",
    "--beak",
    "--aurora",
    "--aurora-2",
    "--rock-far",
    "--rock-near",
    "--mist",
    "--forest-far",
    "--reed",
    "--ink",
    "--red",
  ].forEach((n) => {
    C[n] = cs.getPropertyValue(n).trim();
  });
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return (
      "rgba(" +
      ((n >> 16) & 255) +
      "," +
      ((n >> 8) & 255) +
      "," +
      (n & 255) +
      "," +
      a +
      ")"
    );
  }
  const rnd = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- skins: unlocked with XP (xp = XP needed) ---- */
  const DEFAULT_PAL = {
    eagle: C["--eagle"],
    dark: C["--eagle-dark"],
    belly: C["--eagle-belly"],
    head: C["--eagle-head"],
    tail: C["--tail"],
    beak: C["--beak"],
  };
  const LOCKED_PAL = {
    eagle: "#1d3049",
    dark: "#14243a",
    belly: "#27415f",
    head: "#2a4566",
    tail: "#2a4566",
    beak: "#2a4566",
  };
  const SKINS = [
    { name: "Havørn", xp: 0, c: DEFAULT_PAL },
    {
      name: "Kongeørn",
      xp: 20,
      c: { eagle: "#8a5a22", dark: "#4a2f10", belly: "#c89a52", head: "#e8b84a", tail: "#f0e6c8", beak: "#f2b632" },
    },
    {
      name: "Snøørn",
      xp: 40,
      c: { eagle: "#cfd8e3", dark: "#7d8ea3", belly: "#f2f6fa", head: "#ffffff", tail: "#ffffff", beak: "#f2a03a" },
    },
    {
      name: "Nattørn",
      xp: 70,
      c: { eagle: "#2b2f4a", dark: "#14172b", belly: "#4a5080", head: "#6c72b0", tail: "#9aa0d8", beak: "#ffd45e" },
    },
    {
      name: "Nordlysørn",
      xp: 100,
      c: { eagle: "#1f8f72", dark: "#0f4a40", belly: "#7dffc0", head: "#c58bff", tail: "#7dffc0", beak: "#fff2a8" },
    },
    {
      name: "Ildørn",
      xp: 140,
      c: { eagle: "#b8321f", dark: "#5c1209", belly: "#ff9a3c", head: "#ffd27a", tail: "#ff7a2e", beak: "#ffe14d" },
    },
    {
      name: "Gullørn",
      xp: 200,
      c: { eagle: "#d4a017", dark: "#7a5a05", belly: "#fff0a0", head: "#fff7c8", tail: "#ffffff", beak: "#ff7a1a" },
    },
  ];

  /* ---- DOM ---- */
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"),
    frameEl = $("frame"),
    canvas = $("c"),
    ctx = canvas.getContext("2d");
  const intro = $("intro"),
    tapEl = $("tap");
  const endEl = $("end"),
    endTitle = $("endTitle"),
    endScore = $("endScore"),
    endBest = $("endBest");
  const lvlEl = $("lvl"),
    xpFill = $("xpFill"),
    skinPrev = $("skinPrev"),
    skinNext = $("skinNext"),
    skinName = $("skinName"),
    skinInfo = $("skinInfo"),
    endXp = $("endXp"),
    recordEl = $("record"),
    featherInfo = $("featherInfo");
  const againBtn = $("again"),
    shareBtn = $("share"),
    shareMsg = $("shareMsg"),
    shareOut = $("shareOut"),
    shareText = $("shareText");

  let view = 1;
  let cacheDirty = true,
    skyLayer = null,
    glowLayer = null,
    farTile = null,
    nearTile = null;
  const grads = {};
  function fit() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.2, Math.min(r.width / W, r.height / H, 1.35));
    frameEl.style.width = W * s + "px";
    frameEl.style.height = H * s + "px";
    frameEl.style.fontSize = Math.max(13, 16 * s) + "px";
    // cap the backing-store size: very high resolutions make every frame slow
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (s * dpr > 2) dpr = Math.max(1, 2 / s);
    const cw = Math.round(W * s * dpr),
      ch = Math.round(H * s * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    view = cw / W;
    cacheDirty = true;
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  window.addEventListener("resize", fit);
  fit();
  if (document.fonts && document.fonts.load)
    document.fonts.load('52px "Fjalla One"');

  /* ---- state ---- */
  const eagle = {
    x: 110,
    y: 290,
    vy: 0,
    rot: 0,
    phase: 0,
    energy: 0,
    scale: 1,
    alpha: 1,
  };
  let state = "ready"; // ready | play | dying | landed | over | won
  let score = 0,
    best = 0;
  let scroll = 0,
    frame = 0,
    curSpeed = BASE_SPEED;
  let trees = [],
    particles = [];
  let shake = 0,
    flash = 0,
    scorePop = 0;
  let landedT = 0,
    winT = 0,
    winHold = 0,
    winStartY = 290;
  let lastGapTop = 170,
    endShown = false,
    endAt = 0;
  let xp = 0,
    equipped = 0, // skin used in the game
    skinIdx = 0, // skin shown in the menu
    runXp = 0,
    runUnlocked = [];
  let feather = false, // golden feather active in this run
    invuln = 0,
    bestBeaten = false;

  try {
    best = parseInt(localStorage.getItem(KEY), 10) || 0;
    xp = clamp(parseInt(localStorage.getItem(KEY_XP), 10) || 0, 0, MAX_XP);
    equipped = parseInt(localStorage.getItem(KEY_SKIN), 10) || 0;
  } catch (e) {}
  if (!(equipped >= 0 && equipped < SKINS.length) || SKINS[equipped].xp > xp)
    equipped = 0;
  skinIdx = equipped;
  function saveBest() {
    try {
      localStorage.setItem(KEY, String(best));
    } catch (e) {}
  }
  function saveProgress() {
    try {
      localStorage.setItem(KEY_XP, String(xp));
      localStorage.setItem(KEY_SKIN, String(equipped));
    } catch (e) {}
  }
  function recordBest() {
    if (score > best) {
      best = score;
      bestBeaten = true;
      saveBest();
    }
  }
  const isUnlocked = (i) => SKINS[i].xp <= xp;
  function pal() {
    return isUnlocked(skinIdx) ? SKINS[skinIdx].c : LOCKED_PAL;
  }
  function gainXp() {
    if (xp >= MAX_XP) return;
    const before = xp;
    xp++;
    runXp++;
    SKINS.forEach((sk) => {
      if (sk.xp > before && sk.xp <= xp) runUnlocked.push(sk.name);
    });
    saveProgress();
  }
  function updateMenu() {
    const sk = SKINS[skinIdx];
    recordEl.textContent = "Din rekord er " + best + " av " + GOAL + " trær";
    featherInfo.textContent =
      xp >= FEATHER_XP
        ? "Gullfjær aktiv: du tåler ett tretreff per runde"
        : "Gullfjær ved level " + FEATHER_XP + ": tåler ett tretreff";
    lvlEl.textContent = "Level " + xp + " av " + MAX_XP;
    const nextI = SKINS.findIndex((x) => x.xp > xp);
    let from = 0,
      to = MAX_XP;
    if (nextI >= 0) {
      from = SKINS[nextI - 1].xp;
      to = SKINS[nextI].xp;
    }
    xpFill.style.width =
      (to > from ? clamp(((xp - from) / (to - from)) * 100, 0, 100) : 100) +
      "%";
    skinName.textContent = isUnlocked(skinIdx) ? sk.name : "Låst skin";
    skinInfo.textContent = isUnlocked(skinIdx)
      ? skinIdx === equipped
        ? nextI >= 0
          ? "Neste skinn: " + SKINS[nextI].name + " ved level " + SKINS[nextI].xp
          : "Alle skins er låst opp"
        : sk.name
      : "Låses opp ved level " + sk.xp;
  }
  function changeSkin(d) {
    skinIdx = (skinIdx + d + SKINS.length) % SKINS.length;
    if (isUnlocked(skinIdx)) {
      equipped = skinIdx;
      saveProgress();
    }
    updateMenu();
  }

  /* ---- scenery data ---- */
  const stars = Array.from({ length: 36 }, (_, i) => ({
    x: rnd(i + 1) * W,
    y: rnd(i + 90) * 230,
    r: 0.5 + rnd(i + 200) * 1.1,
    p: rnd(i + 300) * 6,
  }));
  const flakes = Array.from({ length: reduce ? 36 : 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 0.7 + Math.random() * 2.3,
    ph: Math.random() * 6.28,
  }));
  flakes.forEach((fl) => (fl.a = Math.min(0.85, 0.45 + fl.r * 0.12)));
  const farRidge = {
    base: 432,
    a1: 92,
    a2: 40,
    a3: 18,
    ph1: 0.6,
    ph2: 1.9,
    ph3: 0.3,
  };
  const nearRidge = {
    base: 478,
    a1: 70,
    a2: 32,
    a3: 14,
    ph1: 2.4,
    ph2: 0.7,
    ph3: 1.5,
  };

  /* ---- trees ---- */
  function makeTree(x) {
    const gap = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    const minTop = 55,
      maxTop = GROUND - 55 - gap;
    // pick anywhere in the full height, but limit the jump from the previous opening
    const target = minTop + Math.random() * (maxTop - minTop);
    const gapTop = clamp(target, lastGapTop - 230, lastGapTop + 230);
    lastGapTop = gapTop;
    const gapBottom = gapTop + gap;
    const hT = gapTop + 30,
      hB = GROUND + 8 - gapBottom;
    return {
      x,
      gapTop,
      gapBottom,
      scored: false,
      wT: clamp(58 + hT * 0.3, 72, 128),
      wB: clamp(58 + hB * 0.3, 72, 128),
    };
  }
  function hitTree(t) {
    const parts = [
      { tip: t.gapBottom, base: GROUND + 8, w: t.wB, dir: 1 },
      { tip: t.gapTop, base: -30, w: t.wT, dir: -1 },
    ];
    for (const p of parts) {
      const h = Math.abs(p.base - p.tip);
      for (const dy of [-R, -R / 2, 0, R / 2, R]) {
        const yy = eagle.y + dy;
        const d = (yy - p.tip) * p.dir;
        if (d < 0 || d > h) continue;
        const hw = (((d / h) * p.w) / 2) * 0.8;
        const reach = Math.sqrt(R * R - dy * dy);
        if (Math.abs(eagle.x - t.x) < hw + reach * 0.9) return true;
      }
    }
    return false;
  }

  /* ---- particles ---- */
  function puff(x, y, n, color, spread, grav) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + (Math.random() * 16 - 8),
        y,
        vx: (Math.random() * 3.2 - 1.6) * spread,
        vy: -(0.8 + Math.random() * 2.4),
        r: 1.5 + Math.random() * 2.5,
        life: 1,
        decay: 0.012 + Math.random() * 0.013,
        g: grav,
        color,
      });
    }
  }

  /* ---- game flow ---- */
  function reset() {
    trees = [];
    particles = [];
    score = 0;
    scroll = scroll || 0;
    eagle.x = 110;
    eagle.y = 290;
    eagle.vy = 0;
    eagle.rot = 0;
    eagle.scale = 1;
    eagle.alpha = 1;
    eagle.energy = 0;
    lastGapTop = 170;
    curSpeed = BASE_SPEED;
    winT = 0;
    winHold = 0;
    landedT = 0;
    shake = 0;
    flash = 0;
    scorePop = 0;
    endShown = false;
    endEl.hidden = true;
    state = "ready";
    intro.hidden = false;
    tapEl.textContent =
      best > 0 ? "Trykk for å prøve igjen" : "Trykk for å flakse";
    skinIdx = equipped;
    updateMenu();
  }
  function start() {
    // a locked skin can only be previewed; play with the last unlocked one
    if (!isUnlocked(skinIdx)) skinIdx = equipped;
    runXp = 0;
    runUnlocked = [];
    bestBeaten = false;
    feather = xp >= FEATHER_XP;
    invuln = 0;
    state = "play";
    intro.hidden = true;
    trees = [makeTree(W + 130)];
    flap();
  }
  function flap() {
    eagle.vy = FLAP;
    eagle.energy = 1;
  }
  function die() {
    state = "dying";
    eagle.vy = -2.5;
    if (!reduce) {
      shake = 10;
      flash = 0.5;
    }
    feather = false;
    recordBest();
    puff(eagle.x, eagle.y, 10, pal().head, 1.2, 0.03);
    puff(eagle.x, eagle.y, 8, pal().eagle, 1.2, 0.03);
  }
  function win() {
    state = "won";
    score = GOAL;
    recordBest();
    winT = 0;
    winHold = 0;
    winStartY = eagle.y;
  }
  function showEnd(kind) {
    endShown = true;
    state = kind === "won" ? "won" : "over";
    const newBest = bestBeaten;
    endTitle.textContent =
      kind === "won"
        ? "WOW, du er veldig flink! Men klarer du det igjen?"
        : "Au! Du traff et tre.";
    endScore.textContent = String(score);
    endBest.textContent =
      kind === "won"
        ? "Full score. Alle 100 trær."
        : newBest && score > 0
          ? "Ny rekord!"
          : "Rekord: " + best;
    let xpText =
      runXp > 0
        ? "+" + runXp + " XP · Level " + xp
        : "Ingen XP denne gangen. Du får 1 XP for hvert " +
          TREES_PER_XP +
          ". tre.";
    if (xp >= MAX_XP) xpText = "Maks level (" + MAX_XP + ")! " + xpText;
    if (runUnlocked.length)
      xpText += " Nytt skin: " + runUnlocked.join(", ") + "!";
    endXp.textContent = xpText;
    shareMsg.textContent = "";
    shareOut.hidden = true;
    endEl.hidden = false;
    endAt = performance.now() + 500;
    setTimeout(() => {
      if (!endEl.hidden) againBtn.focus({ preventScroll: true });
    }, 600);
  }
  function restart() {
    reset();
  }

  function action() {
    if (state === "ready") start();
    else if (state === "play") flap();
  }

  frameEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button,input")) return;
    e.preventDefault();
    action();
  });
  window.addEventListener("keydown", (e) => {
    const onControl =
      e.target && e.target.closest && e.target.closest("button,input");
    if (
      e.code === "Space" ||
      e.code === "ArrowUp" ||
      e.code === "KeyW" ||
      e.code === "Enter"
    ) {
      if (endShown) {
        if (onControl) return;
        e.preventDefault();
        if (performance.now() > endAt) restart();
        return;
      }
      if (e.code === "Enter") return;
      e.preventDefault();
      if (e.repeat) return;
      action();
    } else if (
      (e.code === "ArrowLeft" || e.code === "ArrowRight") &&
      state === "ready" &&
      !endShown
    ) {
      e.preventDefault();
      changeSkin(e.code === "ArrowLeft" ? -1 : 1);
    }
  });
  skinPrev.addEventListener("click", () => changeSkin(-1));
  skinNext.addEventListener("click", () => changeSkin(1));
  againBtn.addEventListener("click", restart);
  shareBtn.addEventListener("click", () => {
    const text =
      score >= GOAL
        ? "Jeg klarte alle 100 trær i Ørneflukt! Klarer du det?"
        : "Jeg fløy forbi " +
          score +
          (score === 1 ? " tre" : " trær") +
          " i Ørneflukt. Klarer du å slå meg?";
    const manual = () => {
      shareOut.hidden = false;
      shareText.value = text;
      shareText.focus();
      shareText.select();
      shareMsg.textContent = "Merk teksten og kopier den.";
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            shareOut.hidden = false;
            shareText.value = text;
            shareMsg.textContent = "Kopiert. Lim den inn i en melding.";
          })
          .catch(manual);
      } else manual();
    } catch (err) {
      manual();
    }
  });

  /* ---- update ---- */
  function update(f) {
    frame += f;
    if (shake > 0) shake = Math.max(0, shake - 0.7 * f);
    if (flash > 0) flash = Math.max(0, flash - 0.03 * f);
    if (scorePop > 0) scorePop = Math.max(0, scorePop - 0.06 * f);
    eagle.energy = Math.max(0, eagle.energy - 0.035 * f);
    eagle.phase += (0.2 + 0.45 * eagle.energy) * f;

    for (const fl of flakes) {
      fl.y += (0.35 + fl.r * 0.32) * f;
      fl.x +=
        Math.sin(frame * 0.02 + fl.ph) * 0.25 * f - (0.25 + fl.r * 0.12) * f;
      if (fl.y > H) {
        fl.y = -4;
        fl.x = Math.random() * W;
      }
      if (fl.x < -4) fl.x = W + 4;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.vy += p.g * f;
      p.life -= p.decay * f;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (state === "ready") {
      scroll += 1.0 * f;
      eagle.energy = Math.max(eagle.energy, 0.3);
      eagle.y = 290 + Math.sin(frame * 0.07) * 9;
      eagle.rot = Math.sin(frame * 0.07) * 0.05;
    } else if (state === "play") {
      updatePlay(f);
    } else if (state === "dying") {
      eagle.vy = Math.min(eagle.vy + GRAV * f, 11);
      eagle.y += eagle.vy * f;
      eagle.rot += (2.9 - eagle.rot) * Math.min(1, 0.07 * f);
      if (eagle.y >= GROUND - 9) {
        eagle.y = GROUND - 9;
        eagle.vy = 0;
        state = "landed";
        landedT = 0;
        puff(eagle.x, GROUND - 6, 26, C["--snow"], 1.6, 0.08);
        if (!reduce) shake = 6;
      }
    } else if (state === "landed" || state === "over") {
      eagle.rot += (2.9 - eagle.rot) * Math.min(1, 0.1 * f);
      if (state === "landed") {
        landedT += f;
        if (landedT > 28) showEnd("over");
      }
    } else if (state === "won") {
      winT = Math.min(1, winT + f / 230);
      const p = winT;
      const e1 = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      eagle.x = 110 + 155 * e1;
      eagle.y =
        winStartY +
        (330 - winStartY) * e1 +
        Math.sin(frame * 0.06) * 5 * (1 - e1);
      eagle.scale = 1 - 0.9 * (1 - Math.pow(1 - p, 2));
      eagle.alpha = 1 - 0.4 * p;
      eagle.rot = -0.18;
      eagle.energy = Math.max(eagle.energy, 0.7 * (1 - p) + 0.15);
      scroll += 1.8 * f;
      for (const t of trees) t.x -= 2.4 * f;
      if (winT >= 1 && !endShown) {
        winHold += f;
        if (winHold > 35) showEnd("won");
      }
    }
  }

  function updatePlay(f) {
    // faster every STEP_EVERY trees (20, 40, 60, 80), eased in smoothly
    const target = BASE_SPEED + Math.floor(score / STEP_EVERY) * STEP_BOOST;
    curSpeed += (target - curSpeed) * Math.min(1, 0.04 * f);
    const speed = curSpeed;
    scroll += speed * f;
    eagle.vy = Math.min(eagle.vy + GRAV * f, MAXFALL);
    eagle.y += eagle.vy * f;
    if (eagle.y < 10) {
      eagle.y = 10;
      if (eagle.vy < 0) eagle.vy = 0;
    }
    eagle.rot +=
      (clamp(eagle.vy * 0.07, -0.5, 1.2) - eagle.rot) * Math.min(1, 0.25 * f);

    for (const t of trees) t.x -= speed * f;
    while (trees.length && trees[0].x < -90) trees.shift();
    const last = trees[trees.length - 1];
    if (!last || last.x < W + 130 - SPACING) {
      trees.push(makeTree((last ? last.x : W + 130 - SPACING) + SPACING));
    }

    let won = false;
    for (const t of trees) {
      if (!t.scored && t.x < eagle.x) {
        t.scored = true;
        score++;
        scorePop = 1;
        if (score % TREES_PER_XP === 0) gainXp();
        if (score >= GOAL) {
          won = true;
          break;
        }
      }
    }
    if (won) {
      win();
      return;
    }

    if (eagle.y + R >= GROUND - 2) {
      die();
      return;
    }
    if (invuln > 0) invuln = Math.max(0, invuln - f);
    for (const t of trees) {
      if (Math.abs(t.x - eagle.x) < 90 && hitTree(t)) {
        if (invuln > 0) continue;
        if (feather) {
          // the golden feather absorbs one hit
          feather = false;
          invuln = INVULN;
          eagle.vy = FLAP * 0.6;
          eagle.energy = 1;
          if (!reduce) {
            shake = 8;
            flash = 0.35;
          }
          puff(eagle.x, eagle.y, 14, "#f5c542", 1.4, 0.03);
          puff(eagle.x, eagle.y, 8, "#fff3b0", 1.2, 0.03);
          continue;
        }
        die();
        return;
      }
    }
  }

  /* ---- drawing ---- */
  /* ---- cached layers: static scenery is drawn once, then just blitted ---- */
  function makeLayer(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * view));
    c.height = Math.max(1, Math.round(h * view));
    const g = c.getContext("2d");
    g.scale(c.width / w, c.height / h);
    draw(g);
    return c;
  }
  function ridgeTile(p, rock, fog) {
    const top = p.base - (p.a1 + p.a2 + p.a3);
    // 800 is the pattern period; 4 extra px let neighbouring tiles overlap (no seam)
    return {
      top,
      img: makeLayer(804, GROUND - top, (g) => {
        g.translate(0, -top);
        const gr = g.createLinearGradient(0, top, 0, GROUND);
        gr.addColorStop(0, C["--snow"]);
        gr.addColorStop(0.2, C["--snow"]);
        gr.addColorStop(0.27, C["--snow-shade"]);
        gr.addColorStop(0.36, rock);
        gr.addColorStop(1, fog);
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, GROUND);
        for (let x = 0; x <= 804; x += 4) g.lineTo(x, ridgeY(x, p));
        g.lineTo(804, GROUND);
        g.closePath();
        g.fill();
      }),
    };
  }
  function buildCaches() {
    cacheDirty = false;
    skyLayer = makeLayer(W + 20, H + 20, (g) => {
      g.translate(10, 10);
      const gr = g.createLinearGradient(0, 0, 0, GROUND);
      gr.addColorStop(0, C["--sky-hi"]);
      gr.addColorStop(0.55, C["--sky-mid"]);
      gr.addColorStop(1, C["--sky-low"]);
      g.fillStyle = gr;
      g.fillRect(-10, -10, W + 20, H + 20);
    });
    glowLayer = makeLayer(W, 320, (g) => {
      g.translate(0, -240);
      const gl = g.createRadialGradient(320, 470, 0, 320, 470, 230);
      gl.addColorStop(0, rgba(C["--sky-low"], 0.5));
      gl.addColorStop(1, rgba(C["--sky-low"], 0));
      g.fillStyle = gl;
      g.fillRect(0, 240, W, 320);
    });
    farTile = ridgeTile(farRidge, C["--rock-far"], C["--mist"]);
    nearTile = ridgeTile(nearRidge, C["--rock-near"], C["--mist"]);
  }
  function vgrad(key, y0, y1, stops) {
    let g = grads[key];
    if (!g) {
      g = ctx.createLinearGradient(0, y0, 0, y1);
      for (const st of stops) g.addColorStop(st[0], st[1]);
      grads[key] = g;
    }
    return g;
  }

  function drawSky() {
    ctx.drawImage(skyLayer, -10, -10, W + 20, H + 20);

    ctx.fillStyle = C["--snow"];
    for (const s of stars) {
      ctx.globalAlpha = reduce ? 0.45 : 0.3 + 0.3 * Math.sin(frame * 0.03 + s.p);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const t = reduce ? 0 : frame * 0.012;
    ribbon(70, 46, 0.011, t, C["--aurora"], 0.22);
    ribbon(125, 36, 0.016, -t * 0.8 + 2, C["--aurora-2"], 0.12);

    ctx.drawImage(glowLayer, 0, 240, W, 320);
  }
  function ribbon(y0, amp, k, t, color, a) {
    const pts = [];
    for (let x = 0; x <= W; x += 10) {
      pts.push([
        x,
        y0 + amp * Math.sin(x * k + t) + 18 * Math.sin(x * k * 2.3 - t * 1.3),
      ]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    for (let i = pts.length - 1; i >= 0; i--) {
      ctx.lineTo(
        pts[i][0],
        pts[i][1] + 70 + 28 * Math.sin(pts[i][0] * 0.03 + t),
      );
    }
    ctx.closePath();
    ctx.fillStyle = vgrad("aur" + y0, y0 - 60, y0 + 170, [
      [0, rgba(color, 0)],
      [0.35, rgba(color, a)],
      [1, rgba(color, 0)],
    ]);
    ctx.fill();
  }

  function ridgeY(x, p) {
    return (
      p.base -
      (p.a1 * (1 - Math.abs(Math.sin((Math.PI * x) / 400 + p.ph1))) +
        p.a2 * (1 - Math.abs(Math.sin((Math.PI * x) / 160 + p.ph2))) +
        p.a3 * (1 - Math.abs(Math.sin((Math.PI * x) / 100 + p.ph3))))
    );
  }
  function drawRidge(tile, off) {
    const h = GROUND - tile.top;
    ctx.drawImage(tile.img, -off, tile.top, 804, h);
    ctx.drawImage(tile.img, 800 - off, tile.top, 804, h);
  }
  function fir(x, by, h, w) {
    const Rr = [
      [0, -1],
      [0.38, -0.62],
      [0.2, -0.62],
      [0.68, -0.3],
      [0.34, -0.3],
      [1, 0],
    ];
    ctx.beginPath();
    ctx.moveTo(x + Rr[0][0] * w, by + Rr[0][1] * h);
    for (let i = 1; i < Rr.length; i++)
      ctx.lineTo(x + Rr[i][0] * w, by + Rr[i][1] * h);
    for (let i = Rr.length - 1; i >= 0; i--)
      ctx.lineTo(x - Rr[i][0] * w, by + Rr[i][1] * h);
    ctx.closePath();
    ctx.fill();
  }
  function drawFarForest(off) {
    ctx.fillStyle = C["--forest-far"];
    const N = 27,
      per = 800 / N;
    for (let i = 0; i < N; i++) {
      const wx = i * per + rnd(i) * per * 0.6;
      const hgt = 34 + rnd(i + 50) * 30,
        wd = 9 + rnd(i + 90) * 7;
      const sx = (((wx - off) % 800) + 800) % 800;
      for (const x of [sx, sx - 800]) {
        if (x < -30 || x > W + 30) continue;
        fir(x, GROUND - 2, hgt, wd);
      }
    }
  }

  function spruce(cx, tipY, baseY, w, snowy) {
    const h = baseY - tipY,
      trunkH = Math.min(26, h * 0.12),
      body = h - trunkH;
    ctx.fillStyle = C["--trunk"];
    ctx.fillRect(cx - 5, baseY - trunkH - 6, 10, trunkH + 12);
    const n = Math.max(3, Math.min(7, Math.round(body / 46)));
    for (let i = 0; i < n; i++) {
      const ya = tipY + body * (i / (n + 0.35));
      const yb = tipY + body * ((i + 1.35) / (n + 0.35));
      const hwb = (((yb - tipY) / body) * w) / 2;
      ctx.fillStyle = C["--spruce"];
      ctx.beginPath();
      ctx.moveTo(cx, ya);
      ctx.lineTo(cx + hwb, yb);
      ctx.quadraticCurveTo(cx, yb - 7, cx - hwb, yb);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(C["--spruce-dark"], 0.55);
      ctx.beginPath();
      ctx.moveTo(cx, ya);
      ctx.lineTo(cx + hwb, yb);
      ctx.quadraticCurveTo(cx + hwb * 0.5, yb - 5, cx, yb - 3.5);
      ctx.closePath();
      ctx.fill();
      if (snowy) {
        const f = 0.52,
          yy = ya + (yb - ya) * f,
          sx = hwb * f;
        ctx.fillStyle = C["--snow"];
        ctx.beginPath();
        ctx.moveTo(cx, ya - 1);
        ctx.lineTo(cx + sx, yy);
        ctx.quadraticCurveTo(cx + sx * 0.5, yy + 9, cx, yy + 1);
        ctx.quadraticCurveTo(cx - sx * 0.5, yy + 9, cx - sx, yy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  function drawTrees() {
    for (const t of trees) {
      if (t.x < -90 || t.x > W + 90) continue;
      spruce(t.x, t.gapBottom, GROUND + 8, t.wB, true);
      ctx.save();
      ctx.scale(1, -1);
      spruce(t.x, -t.gapTop, 30, t.wT, false);
      ctx.restore();
    }
  }

  function drawGround() {
    const off = scroll;
    ctx.fillStyle = C["--snow"];
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 5) {
      ctx.lineTo(
        x,
        GROUND +
          3 * Math.sin((x + off) * 0.045) +
          2 * Math.sin((x + off) * 0.11 + 1.3),
      );
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = vgrad("gshade", GROUND, H, [
      [0, rgba(C["--snow-shade"], 0)],
      [1, rgba(C["--snow-shade"], 0.9)],
    ]);
    ctx.fillRect(-10, GROUND, W + 20, H - GROUND + 10);

    ctx.fillStyle = rgba(C["--snow"], 0.7);
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 5) {
      ctx.lineTo(
        x,
        GROUND +
          34 +
          5 * Math.sin((x + off * 1.25) * 0.03) +
          3 * Math.sin((x + off * 1.25) * 0.09),
      );
    }
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = C["--reed"];
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let k = 0; k < 5; k++) {
      const wx = k * 72 + rnd(k + 7) * 30;
      const by = GROUND + 28 + rnd(k + 20) * 34;
      const sx = (((wx - off * 1.25) % 360) + 360) % 360;
      for (const x of [sx, sx + 360]) {
        if (x > W + 10) continue;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x - 2, by - 9);
        ctx.moveTo(x, by);
        ctx.lineTo(x + 1, by - 12);
        ctx.moveTo(x, by);
        ctx.lineTo(x + 4, by - 8);
        ctx.stroke();
      }
    }
  }

  function drawFlakes() {
    ctx.fillStyle = C["--snow"];
    for (const fl of flakes) {
      ctx.globalAlpha = fl.a;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let P = DEFAULT_PAL;
  function wingShape(th, fill, shade) {
    ctx.save();
    ctx.translate(4, -3);
    ctx.rotate(th);
    ctx.beginPath();
    ctx.moveTo(4, -1);
    ctx.quadraticCurveTo(-14, -14, -40, -10);
    ctx.lineTo(-36, -5);
    ctx.lineTo(-40, -2);
    ctx.lineTo(-33, 1);
    ctx.lineTo(-36, 5);
    ctx.lineTo(-27, 6);
    ctx.lineTo(-28, 10);
    ctx.lineTo(-17, 9);
    ctx.lineTo(-17, 13);
    ctx.lineTo(-6, 10);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (shade) {
      ctx.fillStyle = shade;
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,.28)";
    ctx.stroke();
    if (!shade) {
      ctx.fillStyle = P.eagle;
      ctx.beginPath();
      ctx.ellipse(-8, -2, 11, 5, 0.05, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawEagle() {
    const e = eagle;
    P = pal();
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.scale(e.scale, e.scale);
    ctx.globalAlpha =
      invuln > 0 && Math.floor(frame / 4) % 2 ? e.alpha * 0.4 : e.alpha;

    let th;
    if (state === "dying") th = 1.15 + 0.25 * Math.sin(frame * 0.6);
    else if (state === "landed" || state === "over") th = 0.55;
    else th = 0.2 + (0.25 + 0.75 * e.energy) * Math.sin(e.phase);

    // far wing
    wingShape(th * 0.8 + 0.1, P.dark, "rgba(0,0,0,.28)");
    // tail
    ctx.fillStyle = P.tail;
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.lineTo(-34, -7);
    ctx.lineTo(-37, 1);
    ctx.lineTo(-33, 7);
    ctx.lineTo(-11, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,25,.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-35, -2);
    ctx.moveTo(-14, 3);
    ctx.lineTo(-34, 4);
    ctx.stroke();
    // talons
    ctx.strokeStyle = P.beak;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(1, 15);
    ctx.moveTo(5, 10);
    ctx.lineTo(8, 15);
    ctx.stroke();
    // body
    ctx.fillStyle = P.eagle;
    ctx.beginPath();
    ctx.ellipse(-3, 2, 18, 10.5, 0.12, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = P.belly;
    ctx.beginPath();
    ctx.ellipse(-1, 6, 12, 4.8, 0.1, 0, 6.283);
    ctx.fill();
    // neck and head
    ctx.fillStyle = P.head;
    ctx.beginPath();
    ctx.ellipse(8, -2, 9, 7, -0.5, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13, -6, 8.2, 0, 6.283);
    ctx.fill();
    // beak
    ctx.fillStyle = P.beak;
    ctx.beginPath();
    ctx.moveTo(18, -10);
    ctx.bezierCurveTo(25, -11, 31, -8, 31, -2);
    ctx.bezierCurveTo(29, -3, 27, -3, 25, -3);
    ctx.lineTo(18, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,25,.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // eye and brow
    ctx.fillStyle = "#1a120b";
    ctx.beginPath();
    ctx.arc(16.5, -8, 2.2, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(17.1, -8.7, 0.7, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(13, -12.4);
    ctx.lineTo(19.5, -9.6);
    ctx.stroke();
    // near wing
    wingShape(th, P.dark, null);

    ctx.restore();
  }

  function drawFeather(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.6);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8a5a00";
    ctx.lineWidth = 1.6;
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(11, -4, 0, 10);
    ctx.quadraticCurveTo(-11, -4, 0, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 19);
    ctx.stroke();
    ctx.restore();
  }

  function drawScore() {
    if (state === "ready") return;
    if (feather && state === "play") drawFeather(W / 2, 126, 0.9);
    const s = 1 + 0.3 * scorePop;
    ctx.save();
    ctx.translate(W / 2, 84);
    ctx.scale(s, s);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.font = '52px "Fjalla One", Impact, "Arial Narrow", sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(C["--night"], 0.55);
    ctx.strokeText(String(score), 0, 0);
    ctx.fillStyle = C["--snow"];
    ctx.fillText(String(score), 0, 0);
    ctx.font = '700 13px "Nunito Sans", system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText("av " + GOAL + " trær", 0, 20);
    ctx.fillText("av " + GOAL + " trær", 0, 20);
    ctx.restore();
  }

  function render() {
    if (cacheDirty) buildCaches();
    ctx.setTransform(view, 0, 0, view, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );

    drawSky();
    drawRidge(farTile, (scroll * 0.08) % 800);
    drawRidge(nearTile, (scroll * 0.2) % 800);
    ctx.fillStyle = vgrad("mist", 420, GROUND, [
      [0, rgba(C["--mist"], 0)],
      [1, rgba(C["--mist"], 0.6)],
    ]);
    ctx.fillRect(-10, 420, W + 20, GROUND - 420);
    drawFarForest((scroll * 0.5) % 800);
    drawTrees();
    drawGround();
    drawFlakes();
    drawParticles();
    drawEagle();

    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = rgba(C["--snow"], flash);
      ctx.fillRect(0, 0, W, H);
    }
    drawScore();
  }

  /* ---- loop ---- */
  reset();
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    update(dt / 16.667);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
