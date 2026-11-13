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
  const KEY = "orneflukt-best";
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
  const againBtn = $("again"),
    shareBtn = $("share"),
    shareMsg = $("shareMsg"),
    shareOut = $("shareOut"),
    shareText = $("shareText");

  let view = 1;
  function fit() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.2, Math.min(r.width / W, r.height / H, 1.35));
    frameEl.style.width = W * s + "px";
    frameEl.style.height = H * s + "px";
    frameEl.style.fontSize = Math.max(13, 16 * s) + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    view = (W * s * dpr) / W;
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

  try {
    best = parseInt(localStorage.getItem(KEY), 10) || 0;
  } catch (e) {}
  function saveBest() {
    try {
      localStorage.setItem(KEY, String(best));
    } catch (e) {}
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
  }
  function start() {
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
    puff(eagle.x, eagle.y, 10, C["--eagle-head"], 1.2, 0.03);
    puff(eagle.x, eagle.y, 8, C["--eagle"], 1.2, 0.03);
  }
  function win() {
    state = "won";
    score = GOAL;
    winT = 0;
    winHold = 0;
    winStartY = eagle.y;
  }
  function showEnd(kind) {
    endShown = true;
    state = kind === "won" ? "won" : "over";
    const newBest = score > best;
    if (newBest) {
      best = score;
      saveBest();
    }
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
    }
  });
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
    const target =
      BASE_SPEED + Math.floor(score / STEP_EVERY) * STEP_BOOST;
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
    for (const t of trees) {
      if (Math.abs(t.x - eagle.x) < 90 && hitTree(t)) {
        die();
        return;
      }
    }
  }

  /* ---- drawing ---- */
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, C["--sky-hi"]);
    g.addColorStop(0.55, C["--sky-mid"]);
    g.addColorStop(1, C["--sky-low"]);
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    for (const s of stars) {
      const a = 0.3 + 0.3 * Math.sin(frame * 0.03 + s.p);
      ctx.fillStyle = rgba(C["--snow"], reduce ? 0.45 : a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    }

    const t = reduce ? 0 : frame * 0.012;
    ribbon(70, 46, 0.011, t, C["--aurora"], 0.22);
    ribbon(125, 36, 0.016, -t * 0.8 + 2, C["--aurora-2"], 0.12);

    const glow = ctx.createRadialGradient(320, 470, 0, 320, 470, 230);
    glow.addColorStop(0, rgba(C["--sky-low"], 0.5));
    glow.addColorStop(1, rgba(C["--sky-low"], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 240, W, 320);
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
    const g = ctx.createLinearGradient(0, y0 - 60, 0, y0 + 170);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.35, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
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
  function drawRidge(p, off, rock, fog) {
    const top = p.base - (p.a1 + p.a2 + p.a3);
    const g = ctx.createLinearGradient(0, top, 0, GROUND);
    g.addColorStop(0, C["--snow"]);
    g.addColorStop(0.2, C["--snow"]);
    g.addColorStop(0.27, C["--snow-shade"]);
    g.addColorStop(0.36, rock);
    g.addColorStop(1, fog);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10, GROUND);
    for (let x = -10; x <= W + 10; x += 4) ctx.lineTo(x, ridgeY(x + off, p));
    ctx.lineTo(W + 10, GROUND);
    ctx.closePath();
    ctx.fill();
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

    const g = ctx.createLinearGradient(0, GROUND, 0, H);
    g.addColorStop(0, rgba(C["--snow-shade"], 0));
    g.addColorStop(1, rgba(C["--snow-shade"], 0.9));
    ctx.fillStyle = g;
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
    for (const fl of flakes) {
      ctx.fillStyle = rgba(C["--snow"], Math.min(0.85, 0.45 + fl.r * 0.12));
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, 6.283);
      ctx.fill();
    }
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
      ctx.fillStyle = C["--eagle"];
      ctx.beginPath();
      ctx.ellipse(-8, -2, 11, 5, 0.05, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawEagle() {
    const e = eagle;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.scale(e.scale, e.scale);
    ctx.globalAlpha = e.alpha;

    let th;
    if (state === "dying") th = 1.15 + 0.25 * Math.sin(frame * 0.6);
    else if (state === "landed" || state === "over") th = 0.55;
    else th = 0.2 + (0.25 + 0.75 * e.energy) * Math.sin(e.phase);

    // far wing
    wingShape(th * 0.8 + 0.1, C["--eagle-dark"], "rgba(0,0,0,.28)");
    // tail
    ctx.fillStyle = C["--tail"];
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
    ctx.strokeStyle = C["--beak"];
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(1, 15);
    ctx.moveTo(5, 10);
    ctx.lineTo(8, 15);
    ctx.stroke();
    // body
    ctx.fillStyle = C["--eagle"];
    ctx.beginPath();
    ctx.ellipse(-3, 2, 18, 10.5, 0.12, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = C["--eagle-belly"];
    ctx.beginPath();
    ctx.ellipse(-1, 6, 12, 4.8, 0.1, 0, 6.283);
    ctx.fill();
    // neck and head
    ctx.fillStyle = C["--eagle-head"];
    ctx.beginPath();
    ctx.ellipse(8, -2, 9, 7, -0.5, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13, -6, 8.2, 0, 6.283);
    ctx.fill();
    // beak
    ctx.fillStyle = C["--beak"];
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
    ctx.strokeStyle = C["--eagle-dark"];
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(13, -12.4);
    ctx.lineTo(19.5, -9.6);
    ctx.stroke();
    // near wing
    wingShape(th, C["--eagle-dark"], null);

    ctx.restore();
  }

  function drawScore() {
    if (state === "ready") return;
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
    ctx.setTransform(view, 0, 0, view, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );

    drawSky();
    drawRidge(farRidge, (scroll * 0.08) % 800, C["--rock-far"], C["--mist"]);
    drawRidge(nearRidge, (scroll * 0.2) % 800, C["--rock-near"], C["--mist"]);
    const mist = ctx.createLinearGradient(0, 420, 0, GROUND);
    mist.addColorStop(0, rgba(C["--mist"], 0));
    mist.addColorStop(1, rgba(C["--mist"], 0.6));
    ctx.fillStyle = mist;
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
