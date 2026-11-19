/* =========================================================================
   NEON HOLOGRAM SLOT 6×6
    FINAL BUILD 5 / 5 — step 3 (BFS cluster pays 4+, tumble cascades,
    SlotEngine tumbles + ×1→×32 ladder + free spins, EVERY spin started by
    hand) AND VFXManager: instanced neon spark bursts + decaying camera shake
    (the BIG / MEGA WIN is a holographic overlay with a counting-up counter
    only) — step 5: CyberAudioEngine (pure Web Audio, no mp3/wav: bright
    122 BPM major-pentatonic groove, punchy spin whoosh, glass landings,
    ladder-synced arps, big-win chord) plus the Telegram WebApp wiring
    (?balance / ?session_id, sendData + close, haptics, mute + exit controls).

    ФОН И ГРАФИКА: космический туннель из колец, летящие частицы, фоновая
    пыль, светящиеся орбы и конус проектора выключены окончательно. На сцене
    только поле 6×6 (стеклянная подложка + скан-плита + неоновая рама) и 36
    крупных 3D-фруктов / цифр на чистом тёмно-фиолетово-синем градиенте.
    ПОСТ-ОБРАБОТКА: UnrealBloomPass / EffectComposer отключены — рендер идёт
    напрямую в canvas, мягкое свечение дают собственные emissive-материалы.
   ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DEG = THREE.MathUtils.degToRad;

/* ---------------- телефон / Telegram Mini App ---------------------------
   768px — ровно та же граница, что и у @media (max-width:768px) в style.css:
   всё, что уже, считается телефоном и получает лёгкий тир качества и
   портретную авто-рамку камеры. PixelRatio сверху ограничен жёстко:
   Math.min(devicePixelRatio, 1.5) — см. CFG.dpr. */
const MOBILE_BP = 768;
const isMobileViewport = () => window.innerWidth < MOBILE_BP;
/** Телефон остаётся телефоном и в альбомной ориентации (innerWidth уже 812):
    touch + мобильный UA + короткая сторона экрана. Десктоп с тачскрином,
    планшеты-гибриды и обычный браузер под это правило не подпадают. */
const isMobileBoot = () => {
  if (isMobileViewport()) return true;
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const ua = /Android|iPhone|iPad|iPod|Telegram/i.test(navigator.userAgent || '');
  const scr = window.screen || {};
  const shortSide = Math.min(scr.width || 0, scr.height || 0);
  return !!(touch && ua && shortSide > 0 && shortSide < 1024);
};

/* 6 × 6 field: 36 cells on a 1.35 unit step centred on the origin. The outer
   holographic frame / slab keep their old 10.75 size, so the stage still fills
   the screen — only the symbols inside get 1.5× bigger. */
const CFG = Object.freeze({
  grid:      { size: 6, step: 1.35, min: -3.375, max: 3.375 },
  /* Жёсткий потолок pixelRatio для ВСЕХ устройств: Math.min(devicePixelRatio,
     1.5). На телефоне с dpr 3-4 это снимает в 2-4 раза больше пикселей с
     фрагментного конвейера, а без bloom-проходов картинка остаётся резкой. */
  dpr:       1.5,
  /* Heavy VFX (VFXManager): everything pooled behind an InstancedMesh, the
     массивы посчитаны под лестницу качества УЛЬТРА / ВЫСОКОЕ / БЫСТРОЕ.
     Sparks are deliberately tiny: a cluster burst is a puff of neon embers —
     6-8 искр на ячейку вместо прежних 11, ни летящих шаров, ни дождя. */
  vfx: {
    shardCap: 320, flashCap: 96,
    shardsPerCell: [8, 7, 6],        /* neon sparks per vanished symbol */
    overlayHold: 3.5, countDur: 0.95
  },
  /* Glossy 3D fruit + arcade digits: unit-space models scaled by size, and by
     SymbolFactory.TYPE_SCALE on top, so every archetype lands at 72-78 % of a
     1.35 cell - the big three already sat there, the small four were dragged up. */
  symbols:   { size: 1.1, frontZ: 0.34, scatterShare: 0.035, count: 36 },
  camera:    { fov: 52, near: 0.1, far: 460, pos: [0, 0.85, 12.4] },
  /* Режиссёрское кресло + портретная авто-рамка. distMin / distMax — это
     альбомный орбита; на телефоне пол дистанции диктует само поле (см.
     _fitCamera): fitWidth 9.2 = 6 шагов по 1.35 + габариты 3D-символов, т.е.
     вся ширина играбельного поля 6×6, которая обязана влезть в горизонтальный
     угол обзора при ЛЮБОМ соотношении сторон (9:16, 9:20 портрет включительно).
     fitPad — страхующий запас по бокам, fitBack — насколько можно отъехать
     назад от «поле впритык», aimMax — потолок вертикального прицела в юнитах. */
  view:      { azimuth: DEG(21), polarMin: DEG(71), polarMax: DEG(97), distMin: 10.6, distMax: 13.4,
               fitWidth: 9.2, fitPad: 1.05, fitBack: 1.16, aimMax: 1.8 },
  palette: {
    cyan:   { hex: 0x00f3ff, rgb: '0,243,255' },
    violet: { hex: 0xbc13fe, rgb: '188,19,254' },
    amber:  { hex: 0xffb02e, rgb: '255,176,46' },
    rose:   { hex: 0xff2a6d, rgb: '255,42,109' },
    /* OVERDRIVE (free-spin bonus): red / gold pair mirroring the violet / cyan roles */
    red:    { hex: 0xff1f3d, rgb: '255,31,61' },
    gold:   { hex: 0xffc23a, rgb: '255,194,58' },
    /* Тёмно-фиолетовая база фона — тот же тон, что и --ink в style.css: canvas
       заливается им целиком, а сине-фиолетовый перелив сверху рисует CSS-слой
       .veil, поэтому никакой 3D-«космос» на заднем плане не нужен вовсе. */
    ink:    0x0b0722
  }
});

/* Adaptive quality ladder — keeps the target at 60 FPS.
  Post-processing больше нет, поэтому ярус качества решает только про
   разрешение (dprCap), преломлённую подложку поля и «жидкий» металл кнопки.
   Имена ярусов — русские, они уходят прямо в бейдж «КАЧЕСТВО» на нижней панели. */
const TIERS = Object.freeze([
  { name: 'УЛЬТРА',  dprCap: 1.50, transmission: 0.90, liquid: true  },
  { name: 'ВЫСОКОЕ', dprCap: 1.30, transmission: 0.55, liquid: true  },
  { name: 'БЫСТРОЕ', dprCap: 1.00, transmission: 0.00, liquid: false }
]);

/* Мягкое свечение без bloom: раз пост-обработка отключена, собственное
   emissive-свечение материалов поднимается, чтобы фрукты и цифры всё ещё
   светились изнутри, а не выглядели плоскими plastic-игрушками. */
const EMISSIVE_BOOST = 1.45;

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const hdr = (hex, gain = 1) => new THREE.Color(hex).multiplyScalar(gain);

/** Русская плюрализация для строк телеметрии: 1 кластер / 2 кластера /
    5 кластеров. Линейное «n + ' cluster(s)'» по-русски не работает, поэтому
    лог выбирает форму сам по последним цифрам числа. */
const pluralRu = (n, one, few, many) => {
  const v = Math.abs(Math.trunc(n) || 0);
  const t = v % 10, h = v % 100;
  if (t === 1 && h !== 11) return one;
  if (t >= 2 && t <= 4 && (h < 10 || h >= 20)) return few;
  return many;
};

/** Внутренние фазы движка → короткие русские статусы бейджа «ТЕЛЕМЕТРИЯ ПОЛЯ». */
const PHASE_LABEL = Object.freeze({
  idle: 'ОЖИДАНИЕ',
  deal: 'РАЗДАЧА',
  evaluating: 'ОЦЕНКА'
});

/** Radial glow sprite texture built on a canvas (no external assets). */
function glowTexture(rgb, size = 128) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, `rgba(${rgb},1)`);
  g.addColorStop(0.18, `rgba(${rgb},0.55)`);
  g.addColorStop(0.55, `rgba(${rgb},0.12)`);
  g.addColorStop(1.00, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Point list for a rounded rectangle (used by the neon field frames). */
function roundedRect(w, h, r, seg = 10) {
  const hw = Math.max(w / 2 - r, 0), hh = Math.max(h / 2 - r, 0);
  const pts = [];
  const arc = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (Math.PI / 2) * (i / seg);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  arc(hw, hh, 0); arc(-hw, hh, Math.PI / 2); arc(-hw, -hh, Math.PI); arc(hw, -hh, Math.PI * 1.5);
  return pts;
}
/* =========================================================================
   GLSL — holographic scan plate only.
   Particle streaks (летящая космическая пыль) и финальный grade-проход
   (хроматическая аберрация / зерно / скан-полосы пост-обработки) удалены
   вместе с туннелем и EffectComposer: на фоне остаётся ровно один дешёвый
   шейдер — плита сканлайнов внутри неоновой рамы поля 6×6.
   ========================================================================= */
const PLATE_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PLATE_FRAG = /* glsl */`
precision highp float;
uniform float uTime;
uniform float uPulse;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float edge = smoothstep(0.0, 0.10, uv.x) * smoothstep(1.0, 0.90, uv.x)
             * smoothstep(0.0, 0.10, uv.y) * smoothstep(1.0, 0.90, uv.y);
  float scan = pow(0.5 + 0.5 * sin(uv.y * 120.0 - uTime * 2.4), 4.0);
  float travel = fract(uv.y * 1.0 - uTime * 0.22);
  float band = smoothstep(0.0, 0.14, travel) * (1.0 - smoothstep(0.14, 0.46, travel));
  float grid = step(0.985, fract(uv.x * 9.0)) + step(0.985, fract(uv.y * 9.0));
  float flick = 0.92 + 0.08 * sin(uTime * 26.0 + hash(uv * 90.0) * 6.2831);
  vec3 col = mix(uColorA, uColorB, clamp(uv.y + 0.25 * sin(uTime * 0.6), 0.0, 1.0));
  col *= (0.055 + scan * 0.14 + band * 0.20 + grid * 0.20) * flick * (1.0 + uPulse * 1.4);
  float alpha = (0.085 + scan * 0.13 + band * 0.20 + grid * 0.15) * edge * flick;
  gl_FragColor = vec4(col * edge, alpha);
}`;

/* =========================================================================
   HUD controller — DOM state only (real game logic arrives in step 2)
   ========================================================================= */
class Hud {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      boot: $('boot'), bootMsg: $('boot-msg'),
      fps: $('tele-fps'), draw: $('tele-draw'),
      railState: $('rail-state'), railLog: $('rail-log'), railCharge: $('rail-charge'),
      balance: $('out-balance'), bet: $('out-bet'), mult: $('out-mult'), fs: $('out-fs'),
      win: $('out-win'), grid: $('out-grid'), quality: $('out-quality'),
      spin: $('btn-spin'), betUp: $('btn-bet-up'), betDn: $('btn-bet-dn'),
      mute: $('btn-audio'), exit: $('btn-exit'),
      /* мобильная телеметрия: панель «ТЕЛЕМЕТРИЯ ПОЛЯ» + кнопка-табулятор ЛОГ,
          на экранах < 768px панель свёрнута по умолчанию (style.css, body.rail-on) */
      rail: $('rail'), railBtn: $('btn-rail')
    };
    this._cache = {};
    this._spinTimer = 0;
  }

  fmt(v, d = 2) {
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  _set(key, node, text) {
    if (!node || this._cache[key] === text) return;
    this._cache[key] = text;
    node.textContent = text;
  }

  setBalance(v) { this._set('balance', this.el.balance, this.fmt(v)); }
  setBet(v) { this._set('bet', this.el.bet, this.fmt(v)); }
  setWin(v) { this._set('win', this.el.win, this.fmt(v)); }
  setMultiplier(v) { this._set('mult', this.el.mult, '×' + this.fmt(v)); }
  /** «ФРИСПИНЫ, когда активны»: карточка живёт в мобильной панели только пока
      счётчик ненулевой — иначе линия из четырёх карточек не влезает в 360px. */
  setFreeSpins(v) {
    const n = Number(v) || 0;
    this._set('fs', this.el.fs, String(n));
    const on = n > 0;
    if (this._cache.fsOn !== on) {
      this._cache.fsOn = on;
      document.body.classList.toggle('has-fs', on);
    }
  }
  setQuality(name) { this._set('quality', this.el.quality, name); }

  /** Speaker button state: the icon swap is pure CSS on [aria-pressed]. */
  setMuted(on) {
    const b = this.el.mute;
    if (!b) return;
    b.setAttribute('aria-pressed', String(!on));
    b.setAttribute('aria-label', on ? 'Звук выключен — включить' : 'Звук включён — выключить');
    const t = b.querySelector('.ico-txt');
    if (t && t.textContent !== (on ? 'БЕЗ ЗВУКА' : 'ЗВУК')) t.textContent = on ? 'БЕЗ ЗВУКА' : 'ЗВУК';
  }
  /** Мобильная кнопка «ЛОГ»: на телефоне левое окно телеметрии свёрнуто, чтобы
      не закрывать 3D-фрукты, и разворачивается одним нажатием. CSS правит всё
      через body.rail-on, здесь только сам флаг и aria-состояние кнопки. */
  toggleRail(open) {
    const next = open === undefined ? !document.body.classList.contains('rail-on') : !!open;
    document.body.classList.toggle('rail-on', next);
    if (this.el.railBtn) this.el.railBtn.setAttribute('aria-pressed', String(next));
    return next;
  }

  setState(text) { this._set('state', this.el.railState, text); }

  setFps(v) {
    this._set('fps', this.el.fps, String(v));
    if (this.el.fps) this.el.fps.classList.toggle('hot', v >= 55);
  }

  setDraws(v) { this._set('draw', this.el.draw, String(v)); }

  /** Шкала «заряд» в левом окне телеметрии: больше это не шкала гипер драйва,
      а прогресс лестницы множителя ×1 → ×32 (0 % … 100 %). */
  setCharge(pct) {
    const w = clamp(pct, 0, 100).toFixed(1) + '%';
    if (this.el.railCharge && this._cache.charge !== w) {
      this._cache.charge = w;
      this.el.railCharge.style.width = w;
    }
  }

  log(msg) {
    if (!this.el.railLog) return;
    const li = document.createElement('li');
    li.innerHTML = '<span>›</span> ' + msg;
    this.el.railLog.prepend(li);
    while (this.el.railLog.children.length > 5) this.el.railLog.lastElementChild.remove();
  }

  flashSpin() {
    const b = this.el.spin;
    if (!b) return;
    b.classList.remove('is-spinning');
    void b.offsetWidth;
    b.classList.add('is-spinning');
    clearTimeout(this._spinTimer);
    this._spinTimer = setTimeout(() => b.classList.remove('is-spinning'), 660);
  }

  hideBoot() { if (this.el.boot) this.el.boot.classList.add('is-off'); }

  bootError(message) {
    if (!this.el.bootMsg) return;
    this.el.bootMsg.textContent = message;
    this.el.bootMsg.classList.add('is-err');
    if (this.el.boot) this.el.boot.classList.remove('is-off');
  }
}
/* =========================================================================
   SYMBOL TYPES — one row per archetype: the seven glossy 3D fruit / digit
   models. hex + accent tint the neon sparks of a cluster detonation, gain
   keeps those sparks bright in their own additive HDR shader (bloom-прохода
   больше нет, поэтому яркость искр полностью в их руках).
   key stays Latin (it seeds the Object3D names and the factory debug info),
   label is the Russian name the telemetry rail and the big win log print.
   ========================================================================= */
const SYMBOL_TYPES = Object.freeze([
  { key: 'CHERRY',         label: 'ВИШНЯ',     hex: 0xff1f3d, accent: 0x66ff8f, gain: 1.05 },
  { key: 'LEMON',          label: 'ЛИМОН',     hex: 0xffd402, accent: 0xf4ff7a, gain: 1.0  },
  { key: 'WATERMELON',     label: 'АРБУЗ',     hex: 0xff2f55, accent: 0x35e070, gain: 1.05 },
  { key: 'GRAPE',          label: 'ВИНОГРАД',  hex: 0x9d3bff, accent: 0xdcae66, gain: 1.0  },
  { key: 'LUCKY 7',        label: 'СЕМЁРКА',   hex: 0xff9d1f, accent: 0xffe066, gain: 1.1  },
  { key: 'LUCKY 8',        label: 'ВОСЬМЁРКА', hex: 0x37d5ff, accent: 0xa8f0ff, gain: 1.1  },
  { key: 'SCATTER · STAR', label: 'ЗВЕЗДА',    hex: 0xffc23a, accent: 0x00f3ff, gain: 1.1  }
]);

/* =========================================================================
   SymbolFactory — 7 chunky, juicy 3D symbols: glossy cherries, a lemon, a
   watermelon slice, a grape cluster, a massive Lucky 7, a chrome Lucky 8 and
   a gold scatter star. Each is a MeshStandardMaterial candy shell (0.2 /
   roughness 0.25 + a soft emissive core) lit by the RoomEnvironment probe,
   so the fruit read as wet plastic under neon light instead of wireframe art.
   Models are authored in unit space (bounding radius ≈ 0.45) and scaled by
   SymbolFactory.SCALE = 1.1 with SymbolFactory.TYPE_SCALE multiplied in per
   archetype, which lands every one of the seven at 72-78 % of one 1.35 grid
   cell - chunky, but never touching a neighbour.
   Same-material parts are merged into ONE geometry per colour, so
   a symbol is 2–3 meshes and the whole 6 × 6 field shares 14 materials.
   ========================================================================= */
class SymbolFactory {
  static SCALE = 1.1;
  /** footprint guard: nothing may grow past 1.6 / 1.35 of a grid cell */
  static SCALE_MAX = 1.6;
  /** Per-archetype footprint multiplier [x, y, z] applied on top of SCALE.
      CHERRY / WATERMELON / SCATTER were authored at 72-78 % of a 1.35 cell while
      the other four sat at 46-56 %, so those four are widened sideways and only
      slightly raised: the tallest axis - and with it the vertical gap to a
      neighbour - stays inside the same 1.24 max-dimension guard that
      tools/_factory.mjs enforces. Measured fills are noted per entry. */
  static TYPE_SCALE = [
    [1, 1, 1],           /* 0 CHERRY      71.7 % - already at the target */
    [1.38, 1.16, 1.38],  /* 1 LEMON       53.8 % -> 74.6 % */
    [1, 1, 1],           /* 2 WATERMELON  76.1 % - already at the target */
    [1.34, 1.28, 1.34],  /* 3 GRAPE       55.9 % -> 74.4 % */
    [1.48, 1.26, 1],     /* 4 LUCKY 7     50.7 % -> 74.5 %, flat digit keeps its thickness */
    [1.6, 1.3, 1],       /* 5 LUCKY 8     46.4 % -> 74.7 %, flat digit keeps its thickness */
    [1, 1, 1],           /* 6 SCATTER     77.7 % - already at the target */
  ];
  static TYPES = SYMBOL_TYPES;

  constructor(glowTexture = null) {
    this.glowTexture = glowTexture;
    this.geometries = [];
    this.materials = [];
    this.textures = [];
    this.spinners = [];
    this.pulsers = [];
    this.built = 0;
    /* Recycle bins: released groups keep their exact motion registrations, so
       re-acquiring a symbol of the same archetype costs zero allocations and
       never leaves stale spinners in the shared update lists. */
    this.pools = SYMBOL_TYPES.map(() => []);
    this.poolCap = 14;
    this._offList = 0;

    this.material = this._buildMaterials();
    this.geometry = this._buildGeometryLibrary();
  }

  get typeCount() { return SYMBOL_TYPES.length; }

  /* ---------------- shared glossy PBR materials ---------------- */
  /**
   * The one candy-shell preset every part uses: metalness 0.2, roughness 0.25
   * and a soft emissive core so the fruit never goes flat in the dark rows of
   * the field. envMapIntensity leans on the RoomEnvironment probe for the wet
   * specular highlight. Post-processing is off, so the soft glow of every
   * symbol is its OWN light: emissiveIntensity is scaled by EMISSIVE_BOOST
   * instead of being picked up by a bloom threshold that no longer exists.
   */
  _glossy(hex, emissive, intensity, env = 1.15, metalness = 0.2, roughness = 0.25) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(emissive),
      emissiveIntensity: intensity * EMISSIVE_BOOST,
      metalness,
      roughness,
      envMapIntensity: env
    });
    this.materials.push(mat);
    return mat;
  }

  _buildMaterials() {
    const M = {};
    /* fruit */
    M.cherry = this._glossy(0xff1226, 0xc4001c, 0.34);
    M.stem = this._glossy(0x2fa84f, 0x12692a, 0.24);
    M.lemon = this._glossy(0xffd402, 0xd07f00, 0.32, 1.25);
    M.melonRind = this._glossy(0x0f8f3e, 0x04571f, 0.24);
    M.melonBand = this._glossy(0xa8e05a, 0x5f9b28, 0.2);
    M.melonFlesh = this._glossy(0xff2f55, 0xc40026, 0.34);
    M.seed = this._glossy(0x241209, 0x000000, 0.12, 0.8);
    M.grape = this._glossy(0x9d3bff, 0x5c00c0, 0.32);
    M.leaf = this._glossy(0x37c24f, 0x12842a, 0.26);
    /* arcade metal: the neon Lucky 7, the chrome Lucky 8 + the gold scatter star */
    M.gold = this._glossy(0xffa51f, 0xff5e00, 0.62, 1.45);
    M.chrome = this._glossy(0xd7ecff, 0x0b78a8, 0.5, 1.75, 0.78, 0.16);
    M.star = this._glossy(0xffc23a, 0xff8400, 0.55, 1.45);
    /* wet specular dot every berry / fruit carries, HDR enough to bloom */
    M.gloss = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xdff4ff),
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.25,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    /* soft turquoise halo behind the SCATTER star (billboard sprite) */
    this.haloTexture = glowTexture('0,243,255', 128);
    this.textures.push(this.haloTexture);
    this.haloMaterial = new THREE.SpriteMaterial({
      map: this.haloTexture,
      color: 0x2ff0ff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.materials.push(M.gloss, this.haloMaterial);
    return M;
  }

  /* ---------------- geometry helpers ---------------- */
  _track(geo) {
    this.geometries.push(geo);
    return geo;
  }

  /** Bake a transform into a geometry so parts can be merged into one buffer. */
  static bake(geo, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')
    );
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(position[0], position[1], position[2]),
      q,
      new THREE.Vector3(scale[0], scale[1], scale[2])
    );
    geo.applyMatrix4(m);
    return geo;
  }

  /** Merge position + normal so every part of one colour costs one draw call. */
  static mergePositionNormal(geometries) {
    const flat = [];
    const scratch = [];
    for (const geo of geometries) {
      const src = geo.index ? geo.toNonIndexed() : geo;
      if (src !== geo) scratch.push(src);
      flat.push(src);
    }
    let total = 0;
    for (const src of flat) total += src.attributes.position.count;
    const position = new Float32Array(total * 3);
    const normal = new Float32Array(total * 3);
    let offset = 0;
    for (const src of flat) {
      const count = src.attributes.position.count * 3;
      position.set(src.attributes.position.array.subarray(0, count), offset);
      if (src.attributes.normal) normal.set(src.attributes.normal.array.subarray(0, count), offset);
      offset += count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    merged.computeBoundingSphere();
    for (const geo of geometries) geo.dispose();
    for (const src of scratch) src.dispose();
    return merged;
  }

  /** Merge + register same-material parts in one call. */
  _merge(parts) {
    return this._track(SymbolFactory.mergePositionNormal(parts));
  }

  /** Chunky rounded half-disc slab — the three layers of the watermelon slice. */
  _halfDisc(radius, depth, z = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-radius, 0);
    shape.absarc(0, 0, radius, Math.PI, 0, true);
    shape.lineTo(-radius, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 26
    });
    geo.translate(0, 0, -depth * 0.5 + z);
    return geo;
  }

  /** Five-pointed star outline used by the SCATTER symbol. */
  _starShape(outer, inner) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  _buildGeometryLibrary() {
    const G = {};

    /* 0 · CHERRY — two heavy berries, curved stems + leaf, wet highlight dots */
    const cherries = [];
    const cherryDots = [];
    const cherryStems = [];
    for (const [bx, by, bz, squash] of [[-0.2, -0.12, 0.05, 1], [0.19, -0.17, -0.05, 0.93]]) {
      const berry = new THREE.SphereGeometry(0.245, 32, 20);
      SymbolFactory.bake(berry, [bx, by, bz], [0, 0, 0], [1, squash, 0.97]);
      cherries.push(berry);

      const dot = new THREE.SphereGeometry(0.055, 12, 10);
      SymbolFactory.bake(dot, [bx - 0.095, by + 0.14, bz + 0.18], [0, 0, 0], [1.6, 1, 0.55]);
      cherryDots.push(dot);

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(bx + (bx < 0 ? -0.03 : 0.03), by + 0.2, bz),
        new THREE.Vector3(bx * 0.4, 0.4, -0.04),
        new THREE.Vector3(0.03, 0.43, 0.0)
      );
      cherryStems.push(new THREE.TubeGeometry(curve, 14, 0.023, 6, false));
    }
    const cherryLeaf = new THREE.SphereGeometry(0.095, 18, 10);
    SymbolFactory.bake(cherryLeaf, [0.16, 0.47, -0.01], [0.2, 0.5, -0.8], [1.55, 0.24, 1]);
    cherryStems.push(cherryLeaf);
    G.cherryBerries = this._merge(cherries);
    G.cherryStems = this._merge(cherryStems);
    G.cherryDots = this._merge(cherryDots);

    /* 1 · LEMON — stretched sphere with the two characteristic nipples */
    const lemonParts = [];
    const lemonBody = new THREE.SphereGeometry(0.33, 40, 28);
    SymbolFactory.bake(lemonBody, [0, 0, 0], [0, 0, 0], [1, 1.2, 1]);
    lemonParts.push(lemonBody);
    for (const pole of [1, -1]) {
      const tip = new THREE.SphereGeometry(0.105, 20, 14);
      SymbolFactory.bake(tip, [0, pole * 0.36, 0], [0, 0, 0], [0.85, 0.75, 0.85]);
      lemonParts.push(tip);
    }
    G.lemonBody = this._merge(lemonParts);
    const lemonDot = new THREE.SphereGeometry(0.075, 14, 12);
    SymbolFactory.bake(lemonDot, [-0.14, 0.14, 0.22], [0, 0, 0], [1.25, 1.9, 0.5]);
    G.lemonDot = this._track(lemonDot);

    /* 2 · WATERMELON — rind / light band / flesh half-discs stacked front to
       back so the front view shows three clean arcs, then the dark seeds */
    G.melonRind = this._track(this._halfDisc(0.44, 0.17, -0.05));
    G.melonBand = this._track(this._halfDisc(0.4, 0.17, 0.0));
    G.melonFlesh = this._track(this._halfDisc(0.365, 0.17, 0.05));
    const seeds = [];
    for (const [sx, sy, tilt] of [[-0.2, 0.08, 0.3], [-0.07, 0.23, -0.2], [0.09, 0.09, 0.15], [0.2, 0.2, -0.35], [0.0, -0.03, 0]]) {
      const seed = new THREE.SphereGeometry(0.033, 12, 8);
      SymbolFactory.bake(seed, [sx, sy, 0.145], [0.35, 0, tilt], [1, 1.55, 0.75]);
      seeds.push(seed);
    }
    G.melonSeeds = this._merge(seeds);

    /* 3 · GRAPE — 8 glossy berries merged into one bunch + vine, leaf, sheen */
    const grapes = [];
    for (const [gx, gy, gz] of [
      [-0.17, 0.14, 0.03], [0.0, 0.15, -0.05], [0.17, 0.14, 0.03],
      [-0.22, -0.01, -0.03], [-0.04, 0.0, 0.05], [0.14, -0.01, -0.04],
      [-0.12, -0.16, 0.02], [0.04, -0.17, -0.02]
    ]) {
      const berry = new THREE.SphereGeometry(0.148, 26, 18);
      SymbolFactory.bake(berry, [gx, gy, gz], [0, 0, 0], [1, 1.06, 1]);
      grapes.push(berry);
    }
    G.grapeBerries = this._merge(grapes);
    const vine = [];
    const vineCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.02, 0.24, 0.0),
      new THREE.Vector3(0.05, 0.35, -0.03),
      new THREE.Vector3(0.17, 0.4, 0.01)
    );
    vine.push(new THREE.TubeGeometry(vineCurve, 14, 0.024, 6, false));
    const grapeLeaf = new THREE.SphereGeometry(0.1, 18, 10);
    SymbolFactory.bake(grapeLeaf, [-0.11, 0.37, 0.0], [0.2, 0, -0.6], [1.6, 0.22, 1.05]);
    vine.push(grapeLeaf);
    G.grapeVine = this._merge(vine);
    const grapeDots = [];
    for (const [dx, dy, dz] of [[-0.233, 0.224, 0.122], [0.0, 0.24, 0.102], [-0.103, 0.084, 0.142]]) {
      const dot = new THREE.SphereGeometry(0.042, 10, 8);
      SymbolFactory.bake(dot, [dx, dy, dz], [0, 0, 0], [1.4, 1, 0.5]);
      grapeDots.push(dot);
    }
    G.grapeDots = this._merge(grapeDots);

    /* 4 · LUCKY 7 — two bevelled 3D blocks: the slanted bar + the downstroke */
    const sevenBar = new RoundedBoxGeometry(0.62, 0.16, 0.18, 4, 0.055);
    SymbolFactory.bake(sevenBar, [0, 0.3, 0], [0, 0, -0.06]);
    const sevenStem = new RoundedBoxGeometry(0.16, 0.66, 0.18, 4, 0.055);
    SymbolFactory.bake(sevenStem, [0.05, -0.02, 0], [0, 0, -0.24]);
    G.lucky7 = this._merge([sevenBar, sevenStem]);

    /* 5 · LUCKY 8 — two stacked chunky rings, polished like arcade chrome */
    const eightTop = new THREE.TorusGeometry(0.165, 0.07, 14, 30);
    SymbolFactory.bake(eightTop, [0, 0.175, 0]);
    const eightBottom = new THREE.TorusGeometry(0.205, 0.08, 14, 32);
    SymbolFactory.bake(eightBottom, [0, -0.13, 0]);
    G.lucky8 = this._merge([eightTop, eightBottom]);

    /* 6 · SCATTER STAR — extruded pentagram, gold + soft turquoise halo */
    const star = new THREE.ExtrudeGeometry(this._starShape(0.47, 0.195), {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 6
    });
    star.translate(0, 0, -0.115);
    G.star = this._track(star);

    return G;
  }

  /* ---------------- motion registration ---------------- */
  _spin(obj, axis, speed, boost = 3) {
    this.spinners.push({ obj, axis: axis.clone().normalize(), speed, boost, mul: 1, listed: true });
  }

  _pulse(obj, base, amp, rate, phase = 0) {
    this.pulsers.push({ obj, base, amp, rate, phase, listed: true });
  }

  /** Re-roll the tumble personality of a (possibly recycled) symbol group. */
  _seedMotion(motions, seed) {
    const spinScale = 0.55 + seed * 0.9;
    const handedness = seed < 0.5 ? 1 : -1;
    for (const s of motions.spinners) {
      if (!s.listed) { s.listed = true; this.spinners.push(s); this._offList--; }
      s.mul = spinScale;
      s.speed = Math.abs(s.speed) * handedness;
      s.axis.x += (seed - 0.5) * 0.7;
      s.axis.y += (seed - 0.5) * 0.4;
      s.axis.normalize();
    }
    for (const p of motions.pulsers) {
      if (!p.listed) { p.listed = true; this.pulsers.push(p); this._offList--; }
    }
  }

  /* Only registrations still attached to a live group animate + get compacted. */
  _compactMotion() {
    this.spinners = this.spinners.filter((s) => s.listed);
    this.pulsers = this.pulsers.filter((p) => p.listed);
    this._offList = 0;
  }

  /* ---------------- the 7 archetypes (unit space, circumradius ≈ 0.5) ------
     Everything except the SCATTER star is registered without spinners /
     pulsers: the models face the camera dead-on and the idle life comes from
     the per-cell sway + float the update() loop already drives. */
  /** Small HDR-hot highlight cluster that reads as a wet specular dot. */
  _dot(geo, mat) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    return mesh;
  }

  /** 0 · CHERRY — twin glossy red berries on curved green stems. */
  _buildCherry(group, M) {
    group.add(new THREE.Mesh(this.geometry.cherryBerries, M.cherry));
    group.add(new THREE.Mesh(this.geometry.cherryStems, M.stem));
    group.add(this._dot(this.geometry.cherryDots, M.gloss));
  }

  /** 1 · LEMON — stretched yellow body with the two characteristic tips. */
  _buildLemon(group, M) {
    group.add(new THREE.Mesh(this.geometry.lemonBody, M.lemon));
    group.add(this._dot(this.geometry.lemonDot, M.gloss));
  }

  /** 2 · WATERMELON — rind / pale band / red flesh + dark seeds. */
  _buildWatermelon(group, M) {
    group.add(new THREE.Mesh(this.geometry.melonRind, M.melonRind));
    group.add(new THREE.Mesh(this.geometry.melonBand, M.melonBand));
    group.add(new THREE.Mesh(this.geometry.melonFlesh, M.melonFlesh));
    group.add(new THREE.Mesh(this.geometry.melonSeeds, M.seed));
  }

  /** 3 · GRAPE — 8-berry glossy bunch topped with a leaf. */
  _buildGrape(group, M) {
    group.add(new THREE.Mesh(this.geometry.grapeBerries, M.grape));
    group.add(new THREE.Mesh(this.geometry.grapeVine, M.leaf));
    group.add(this._dot(this.geometry.grapeDots, M.gloss));
  }

  /** 4 · LUCKY 7 — two slanted, bevelled gold blocks. */
  _buildLucky7(group, M) {
    group.add(new THREE.Mesh(this.geometry.lucky7, M.gold));
  }

  /** 5 · LUCKY 8 — two stacked polished chrome rings. */
  _buildLucky8(group, M) {
    group.add(new THREE.Mesh(this.geometry.lucky8, M.chrome));
  }

  /** 6 · SCATTER · STAR — extruded gold pentagram in a turquoise halo. */
  _buildScatterStar(group, M) {
    const star = new THREE.Mesh(this.geometry.star, M.star);
    const halo = new THREE.Sprite(this.haloMaterial);
    halo.scale.setScalar(0.86);
    halo.position.z = -0.06;
    halo.renderOrder = -1;
    group.add(halo, star);
    this._spin(star, new THREE.Vector3(0, 0, 1), 0.5, 2.2);
    this._pulse(halo, 0.86, 0.13, 3.2, 0.6);
  }

  /* ---------------- public API ---------------- */
  /** One glossy 3D symbol, sized to sit inside a single grid cell. */
  /** Final group scale for one archetype. SCALE is the runtime knob and gets
      clamped; TYPE_SCALE is an authored constant, so it is applied AFTER the
      clamp and can never run away on its own. */
  _applyFootprint(group, index, scale) {
    const s = clamp(scale, 0.3, SymbolFactory.SCALE_MAX);
    const m = SymbolFactory.TYPE_SCALE[index] || SymbolFactory.TYPE_SCALE[0];
    group.scale.set(s * m[0], s * m[1], s * m[2]);
    return s;
  }

  build(type = 0, { phase = 0, seed = Math.random(), scale = SymbolFactory.SCALE } = {}) {
    const n = SYMBOL_TYPES.length;
    const index = ((Math.floor(type) % n) + n) % n;
    const meta = SYMBOL_TYPES[index];
    const group = new THREE.Group();
    group.name = 'symbol-' + index + '-' + meta.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const spinFrom = this.spinners.length;
    const pulseFrom = this.pulsers.length;
    switch (index) {
      case 0: this._buildCherry(group, this.material); break;
      case 1: this._buildLemon(group, this.material); break;
      case 2: this._buildWatermelon(group, this.material); break;
      case 3: this._buildGrape(group, this.material); break;
      case 4: this._buildLucky7(group, this.material); break;
      case 5: this._buildLucky8(group, this.material); break;
      default: this._buildScatterStar(group, this.material); break;
    }

    /* footprint guard: a finished symbol must stay inside its cell */
    this._applyFootprint(group, index, scale);
    group.rotation.set(0, 0, 0);

    /* only the SCATTER star registers motion, the fruit ride the cell sway */
    const motions = {
      spinners: this.spinners.slice(spinFrom),
      pulsers: this.pulsers.slice(pulseFrom)
    };
    group.userData.motions = motions;
    if (motions.spinners.length) this._seedMotion(motions, seed);

    group.userData.symbol = {
      type: index,
      key: meta.key,
      hex: meta.hex,
      phase,
      seed,
      spinScale: 0.55 + seed * 0.9,
      parts: group.children.length
    };
    this.built++;
    return group;
  }

  /** Live symbol or a recycled clone of the same archetype — cost of a fresh
      build only when the bin for that type is empty (engine hot path). */
  acquire(type = 0, { phase = 0, seed = Math.random(), scale = SymbolFactory.SCALE } = {}) {
    const n = SYMBOL_TYPES.length;
    const index = ((Math.floor(type) % n) + n) % n;
    const pool = this.pools[index];
    const group = pool.pop();
    if (!group) return this.build(index, { phase, seed, scale });

    const meta = SYMBOL_TYPES[index];
    const info = group.userData.symbol;
    const motions = group.userData.motions;
    const spinScale = 0.55 + seed * 0.9;
    if (motions.spinners.length) this._seedMotion(motions, seed);
    group.visible = true;
    this._applyFootprint(group, index, scale);
    group.rotation.set(0, 0, 0);
    info.type = index;
    info.key = meta.key;
    info.hex = meta.hex;
    info.phase = phase;
    info.seed = seed;
    info.spinScale = spinScale;
    this.built++;
    return group;
  }

  /** Take a symbol out of the stage: detach, park its motion registrations,
      bin it for reuse (or free its resources when the bin is full). */
  release(group) {
    if (!group) return;
    const motions = group.userData.motions;
    if (motions) {
      for (const s of motions.spinners) if (s.listed) { s.listed = false; this._offList++; }
      for (const p of motions.pulsers) if (p.listed) { p.listed = false; this._offList++; }
    }
    if (group.parent) group.parent.remove(group);
    const index = group.userData.symbol ? group.userData.symbol.type : 0;
    const pool = this.pools[index] || (this.pools[index] = []);
    if (pool.length < this.poolCap) {
      group.visible = true;
      this._applyFootprint(group, index, SymbolFactory.SCALE);
      pool.push(group);
    } else {
      this._releaseResources(group);
    }
    if (this._offList > 900) this._compactMotion();
  }

  /* Geometries + materials are shared per archetype (7 shader programs for the
     whole field), so only non-registered extras may ever be disposed here. */
  _releaseResources(group) {
    const geos = this._sharedGeoSet || (this._sharedGeoSet = new Set(this.geometries));
    const mats = this._sharedMatSet || (this._sharedMatSet = new Set(this.materials));
    group.traverse((node) => {
      if (node.geometry && !geos.has(node.geometry) && typeof node.geometry.dispose === 'function') node.geometry.dispose();
      const mat = node.material;
      if (!mat) return;
      if (Array.isArray(mat)) {
        for (const m of mat) if (!mats.has(m) && typeof m.dispose === 'function') m.dispose();
      } else if (!mats.has(mat) && typeof mat.dispose === 'function') {
        mat.dispose();
      }
    });
    if (typeof group.clear === 'function') group.clear();
  }

  /** Advance every registered part motion (the star spin + the scatter halo).
      `pulse` — тот самый затухающий импульс КРУТИТЬ: на мгновение частицы
      внутри моделей разгоняются и подпрыгивают вместе со всем полем. */
  update(dt, t, pulse = 0) {
    const spinners = this.spinners;
    for (let i = 0; i < spinners.length; i++) {
      const s = spinners[i];
      if (!s.listed) continue;
      s.obj.rotateOnWorldAxis(s.axis, s.speed * s.mul * dt * (1 + pulse * s.boost));
    }
    const pulsers = this.pulsers;
    for (let i = 0; i < pulsers.length; i++) {
      const p = pulsers[i];
      if (!p.listed) continue;
      p.obj.scale.setScalar(p.base + p.amp * Math.sin(t * p.rate + p.phase) + pulse * p.amp * 0.4);
    }
  }

  /** Field roll for a fresh deal. When the engine hands in its TYPE_WEIGHTS the
      deal rolls exactly like the refills: the four fruits carry the board, the
      two arcade digits land rare and SCATTER keeps its ~3.5 %. Without weights
      it falls back to the old even split over the playable archetypes. */
  static randomComposition(count = 36, scatterShare = 0.035, rand = Math.random, weights = null) {
    const n = SYMBOL_TYPES.length;
    const scatter = n - 1;
    const share = clamp(scatterShare, 0, 0.25);
    const weighted = Array.isArray(weights) && weights.length === n;
    let total = 0;
    if (weighted) for (const w of weights) total += w;
    const picks = new Array(count);
    let scatters = 0;
    for (let i = 0; i < count; i++) {
      let type = scatter;
      if (weighted) {
        let roll = rand() * total;
        for (let t = 0; t < n; t++) { roll -= weights[t]; if (roll <= 0) { type = t; break; } }
      } else {
        type = rand() < share ? scatter : Math.floor(rand() * scatter);
      }
      if (type === scatter) scatters++;
      picks[i] = type;
    }
    /* the bonus must stay reachable: never deal a bone-dry board */
    let guard = 0;
    while (scatters < 1 && guard++ < count) {
      const i = Math.floor(rand() * count);
      if (picks[i] !== scatter) { picks[i] = scatter; scatters++; }
    }
    return picks;
  }

  dispose() {
    for (const pool of this.pools) {
      for (const group of pool) {
        if (group.parent) group.parent.remove(group);
        if (typeof group.clear === 'function') group.clear();
      }
      pool.length = 0;
    }
    for (const geo of this.geometries) if (geo && typeof geo.dispose === 'function') geo.dispose();
    for (const mat of this.materials) if (mat && typeof mat.dispose === 'function') mat.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.spinners.length = 0;
    this.pulsers.length = 0;
    this.built = 0;
  }
}

/* =========================================================================
   VFX GLSL — pooled instanced shards + flash sprites, nothing else.
   Both programs are additive + HDR: without a bloom pass they ARE their own
   light, so the tint is pre-multiplied well above 1.0. A retired pool slot
   (aGlow ≤ 0) is clipped away inside the vertex stage, so an idle pool costs
   zero fragments and zero fill.
   ========================================================================= */
const VFX_SHARD_VERT = /* glsl */`
attribute float aShell;   /* static vertex tag: 0 = tetra half, 1 = octa half */
attribute float aShape;   /* per instance: which half of the buffer it draws */
attribute vec3  aTint;    /* per instance: HDR colour, written once at spawn */
attribute float aGlow;    /* per instance: 0 → the slot is free, clip it away */
varying vec3  vTint;
varying float vGlow;
varying vec3  vNormal;
void main() {
  vTint = aTint;
  vGlow = aGlow;
  vNormal = vec3(0.0, 0.0, 1.0);
  if (aGlow <= 0.0005 || abs(aShell - aShape) > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   /* outside the frustum */
    return;
  }
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
  gl_Position = projectionMatrix * mv;
}`;

const VFX_SHARD_FRAG = /* glsl */`
precision highp float;
varying vec3  vTint;
varying float vGlow;
varying vec3  vNormal;
void main() {
  if (vGlow <= 0.0005) discard;
  vec3 n = normalize(vNormal);
  /* edges burn brighter than faces — the fragments read as molten neon */
  float rim = 0.5 + 0.9 * pow(clamp(1.0 - abs(n.z), 0.0, 1.0), 1.5);
  gl_FragColor = vec4(vTint * rim * vGlow, 1.0);
}`;

const VFX_FLASH_VERT = /* glsl */`
attribute vec3  aTint;
attribute float aSize;   /* world-space diameter */
attribute float aGlow;
uniform float uScale;    /* device pixels per world unit at depth 1 */
varying vec3  vTint;
varying float vGlow;
void main() {
  vTint = aTint;
  vGlow = aGlow;
  if (aGlow <= 0.0005) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mv.z, 0.001);
  gl_PointSize = min(aSize * uScale / depth, 1400.0);
  gl_Position = projectionMatrix * mv;
}`;

const VFX_FLASH_FRAG = /* glsl */`
precision highp float;
varying vec3  vTint;
varying float vGlow;
void main() {
  if (vGlow <= 0.0005) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float core = exp(-d2 * 7.0);
  float halo = exp(-d2 * 1.45);
  float mask = core * 0.95 + halo * 0.32;
  gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.55) * mask * vGlow, mask * vGlow);
}`;

/* =========================================================================
   VFXManager — step 4 heavy FX layer, mounted inside the field group so every
   burst inherits the hologram stage transform.
     · cluster detonation → flash impulse + small instanced neon sparks
     · camera shake       → decaying high-frequency impulse on X / Y only
     · BIG / MEGA WIN     → holographic overlay with a counting-up counter ONLY
   There is no particle rain, no flying energy orbs and no bokeh sheet in here:
   the celebration is the overlay, the detonation is a tight puff of sparks,
   nothing else. Two draw calls maximum (shards InstancedMesh, flash Points),
   all fed from pre-allocated typed-array pools with free stacks:
   nothing in here allocates during a spin, and the whole layer switches its
   `visible` flag off the moment the last particle dies.
   ========================================================================= */
class VFXManager {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;

    const v = CFG.vfx;
    this.shardCap = v.shardCap;
    this.flashCap = v.flashCap;

    this.group = new THREE.Group();
    this.group.name = 'vfx-layer';
    this.group.visible = false;
    scene.board.add(this.group);

    /* scratch objects: built once, reused on every write to the GPU buffers */
    this._obj = new THREE.Object3D();
    this._axis = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._col = new THREE.Color();
    this._size = new THREE.Vector2();

    /* camera shake state (impulse + decay envelope, never touches the base) */
    this.shakeAmp = 0;
    this.shakeDur = 0.5;
    this.shakeT = 0;
    this.shakeClock = Math.random() * 10;
    this._shakeOffset = new THREE.Vector3();
    this._basePos = new THREE.Vector3();
    this._baseQuat = new THREE.Quaternion();
    this._shakeRoll = 0;
    this._shakeApplied = false;

    this.tier = 0;
    this._perCell = v.shardsPerCell[0];

    this.disposables = [];
    this._initShards();
    this._initFlashes();
    this._initOverlay();
  }

  /* ---------------- quality hooks (driven by the scene's tier ladder) ------ */
  setTier(index) {
    const tiers = CFG.vfx.shardsPerCell;
    const t = clamp(index | 0, 0, tiers.length - 1);
    this.tier = t;
    this._perCell = tiers[t];
  }

  /** Flash sprites are sized in device pixels: keep the scale honest on resize. */
  setPixelRatio(ratio) {
    const size = this.scene.renderer.getSize(this._size);
    const h = Math.max(size.y * ratio, 1);
    this.flashMat.uniforms.uScale.value = (h * 0.5) / Math.tan(DEG(CFG.camera.fov) * 0.5);
  }

  /* ---------------- shard pool: tetra + octa shells, ONE InstancedMesh ----- */
  /** Both polyhedra are flattened into a single vertex buffer and tagged with
      aShell; aShape per instance picks the half it renders, so one draw call
      covers two different fragment silhouettes. */
  _buildShardGeometry() {
    const shells = [
      { src: new THREE.TetrahedronGeometry(0.115, 0), shell: 0 },
      { src: new THREE.OctahedronGeometry(0.1, 0), shell: 1 }
    ];
    let total = 0;
    for (const s of shells) {
      s.flat = s.src.index ? s.src.toNonIndexed() : s.src;
      s.count = s.flat.attributes.position.count;
      total += s.count;
    }
    const position = new Float32Array(total * 3);
    const normal = new Float32Array(total * 3);
    const aShell = new Float32Array(total);
    let offset = 0;
    for (const s of shells) {
      position.set(s.flat.attributes.position.array, offset * 3);
      if (s.flat.attributes.normal) normal.set(s.flat.attributes.normal.array, offset * 3);
      aShell.fill(s.shell, offset, offset + s.count);
      offset += s.count;
    }
    for (const s of shells) s.src.dispose();

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    merged.setAttribute('aShell', new THREE.BufferAttribute(aShell, 1));
    merged.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 16);
    return merged;
  }

  _initShards() {
    const cap = this.shardCap;
    const geo = this._buildShardGeometry();
    const tint = new Float32Array(cap * 3);
    const glow = new Float32Array(cap);
    const shape = new Float32Array(cap);
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 1).setUsage(THREE.DynamicDrawUsage));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VFX_SHARD_VERT,
      fragmentShader: VFX_SHARD_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9;
    mesh.name = 'vfx-shards';

    const obj = this._obj;
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.setScalar(0);
    obj.updateMatrix();
    for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, obj.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this.shardMesh = mesh;
    this.shardTint = tint;
    this.shardGlow = glow;
    this.shardShape = shape;
    this.shardPos = new Float32Array(cap * 3);
    this.shardVel = new Float32Array(cap * 3);
    this.shardAxis = new Float32Array(cap * 3);
    this.shardAngle = new Float32Array(cap);
    this.shardSpin = new Float32Array(cap);
    this.shardScale = new Float32Array(cap);
    this.shardLife = new Float32Array(cap);
    this.shardTtl = new Float32Array(cap);
    /* free stack: pop() hands out slots 0,1,2…, push() takes them straight back */
    this.shardStack = new Int32Array(cap);
    for (let i = 0; i < cap; i++) this.shardStack[i] = cap - 1 - i;
    this.shardTop = cap;
    this.shardLive = 0;
    this._shardSpawned = false;

    this.group.add(mesh);
    this.disposables.push(geo, mat);
  }

  /* ------- flash pool: radial impulses as GPU points, one draw call -------- */
  _initFlashes() {
    const cap = this.flashCap;
    const position = new Float32Array(cap * 3);
    const tint = new Float32Array(cap * 3);
    const size = new Float32Array(cap);
    const glow = new Float32Array(cap);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 16);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1100 } },
      vertexShader: VFX_FLASH_VERT,
      fragmentShader: VFX_FLASH_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 12;
    points.name = 'vfx-flashes';

    this.flashPoints = points;
    this.flashMat = mat;
    this.flashPos = position;
    this.flashTint = tint;
    this.flashSize = size;
    this.flashGlow = glow;
    this.flashBase = new Float32Array(cap);
    this.flashLife = new Float32Array(cap);
    this.flashTtl = new Float32Array(cap);
    this.flashStack = new Int32Array(cap);
    for (let i = 0; i < cap; i++) this.flashStack[i] = cap - 1 - i;
    this.flashTop = cap;
    this.flashLive = 0;

    this.group.add(points);
    this.disposables.push(geo, mat);
  }

  /* ------------ BIG / MEGA WIN overlay (DOM chrome, counter in the loop) --- */
  _initOverlay() {
    const id = (key) => document.getElementById(key);
    this.ov = {
      el: id('bigwin'),
      kicker: id('bigwin-kicker'),
      title: id('bigwin-title'),
      value: id('bigwin-value'),
      num: id('bigwin-count'),
      sub: id('bigwin-sub'),
      bar: id('bigwin-bar'),
      open: false,
      t: 0,
      amount: 0,
      hold: CFG.vfx.overlayHold,
      count: CFG.vfx.countDur
    };
    this._ovText = '';
    this._ovTimer = 0;
    this._onOverlayDown = () => this.dismissOverlay();
    /* Escape skips the rest of the celebration: click and the 3.5 s timer stay
       the two primary ways out, so this is only the "I get it" shortcut. */
    this._onOverlayKey = (e) => {
      if (this.ov.open && e.key === 'Escape') this.dismissOverlay();
    };
    const el = this.ov.el;
    if (el) el.addEventListener('pointerdown', this._onOverlayDown);
    window.addEventListener('keydown', this._onOverlayKey);
  }

  /* ============================ public triggers ============================ */
  /**
   * Cluster detonation. `cells` is a plain list of board-space anchors
   * { x, y, z, hex } — one per vanished symbol, handed over by SlotEngine.
   * Every anchor gets a flash impulse + instanced shards that fly out of the
   * cluster centre, then fall under gravity while they shrink and fade.
   */
  explode(cells, opts = {}) {
    const n = opts.n == null ? cells.length : Math.min(opts.n | 0, cells.length);
    if (!n) return;
    const hex = opts.hex == null ? CFG.palette.cyan.hex : opts.hex;
    const cx = opts.cx || 0;
    const cy = opts.cy || 0;
    /* hard FPS budget: never oversubscribe the pool — thin the burst out */
    const perCell = Math.max(4, Math.min(this._perCell, (this.shardTop / n) | 0));
    const flashes = Math.min(n, this.flashTop);

    for (let i = 0; i < n; i++) {
      const cell = cells[i];
      const cellHex = cell.hex == null ? hex : cell.hex;
      if (i < flashes) this._pushFlash(cell.x, cell.y, cell.z + 0.05, cellHex, 1.3, 0.3);
      const dx = cell.x - cx;
      const dy = cell.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const ox = dx / d;
      const oy = dy / d;
      for (let k = 0; k < perCell; k++) this._pushShard(cell.x, cell.y, cell.z, cellHex, ox, oy);
    }
  }

  /** Camera impulse: high-frequency shake on X / Y, decaying to zero. */
  shake(strength = 1, duration = 0.5) {
    const s = clamp(strength, 0, 2);
    if (s <= 0) return;
    this.shakeAmp = Math.min(this.shakeAmp + s, 1.9);
    this.shakeDur = clamp(Math.max(duration, this.shakeDur), 0.2, 1.1);
    if (this.shakeT > this.shakeDur) this.shakeT = 0;
  }

  /* ------------------------------ pool plumbing ---------------------------- */
  _setShardTint(i, hex) {
    const i3 = i * 3;
    this._col.setHex(hex);
    const g = 1.55 + Math.random() * 1.1;
    this.shardTint[i3] = this._col.r * g;
    this.shardTint[i3 + 1] = this._col.g * g;
    this.shardTint[i3 + 2] = this._col.b * g;
  }

  _pushShard(x, y, z, hex, ox, oy) {
    if (this.shardTop === 0) return -1;
    const i = this.shardStack[--this.shardTop];
    this.shardLive++;
    this._shardSpawned = true;

    const i3 = i * 3;
    const a = Math.random() * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const speed = 1.7 + Math.random() * 2.4;
    const outward = 0.8 + Math.random() * 1.4;

    this.shardPos[i3] = x + ca * 0.08;
    this.shardPos[i3 + 1] = y + sa * 0.08;
    this.shardPos[i3 + 2] = z;
    this.shardVel[i3] = (ca * 0.72 + ox * outward * 0.55) * speed;
    this.shardVel[i3 + 1] = (sa * 0.72 + oy * outward * 0.55) * speed + 1.1;
    this.shardVel[i3 + 2] = (Math.random() - 0.34) * speed * 0.7;

    const ax = Math.random() * 2 - 1;
    const ay = Math.random() * 2 - 1;
    const az = Math.random() * 2 - 1;
    const len = Math.hypot(ax, ay, az) || 1;
    this.shardAxis[i3] = ax / len;
    this.shardAxis[i3 + 1] = ay / len;
    this.shardAxis[i3 + 2] = az / len;
    this.shardAngle[i] = Math.random() * 6.28318;
    this.shardSpin[i] = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 13);
    this.shardScale[i] = 0.5 + Math.random() * 0.7;
    this.shardLife[i] = 0;
    this.shardTtl[i] = 0.42 + Math.random() * 0.45;
    this.shardShape[i] = Math.random() < 0.55 ? 0 : 1;   /* tetra ↔ octa shell */
    this.shardGlow[i] = 1;
    this._setShardTint(i, hex);
    return i;
  }

  _pushFlash(x, y, z, hex, size, dur) {
    if (this.flashTop === 0) return -1;
    const i = this.flashStack[--this.flashTop];
    this.flashLive++;
    const i3 = i * 3;
    this.flashPos[i3] = x;
    this.flashPos[i3 + 1] = y;
    this.flashPos[i3 + 2] = z;
    this._col.setHex(hex);
    const g = 1.65;
    this.flashTint[i3] = this._col.r * g + 0.26;
    this.flashTint[i3 + 1] = this._col.g * g + 0.28;
    this.flashTint[i3 + 2] = this._col.b * g + 0.3;
    this.flashBase[i] = size;
    this.flashSize[i] = size * 0.4;
    this.flashLife[i] = 0;
    this.flashTtl[i] = dur + Math.random() * 0.1;
    this.flashGlow[i] = 0.02;
    return i;
  }

  /* ============================ per-frame updates =========================== */
  update(dt, t) {
    this._updateShards(dt);
    this._updateFlashes(dt);
    this._updateShake(dt);
    this._updateOverlay(dt);
    /* the whole layer costs nothing at all while the pools are empty */
    this.group.visible = (this.shardLive + this.flashLive) > 0;
  }

  /** Shards: outward velocity → gravity + drag, axis-angle spin, shrinking
      scale and a smooth fade written straight into the aGlow instance buffer. */
  _updateShards(dt) {
    if (this.shardLive <= 0) return;
    const mesh = this.shardMesh;
    const geo = mesh.geometry;
    const pos = this.shardPos;
    const vel = this.shardVel;
    const glow = this.shardGlow;
    const stack = this.shardStack;
    const obj = this._obj;
    const grav = 8.8 * dt;
    const drag = 1 - Math.min(dt * 1.25, 0.35);

    for (let i = 0; i < this.shardCap; i++) {
      if (glow[i] <= 0) continue;
      const i3 = i * 3;
      const life = (this.shardLife[i] += dt);
      const p = life / this.shardTtl[i];
      if (p >= 1) {
        glow[i] = 0;
        this.shardLive--;
        stack[this.shardTop++] = i;
        continue;
      }
      const vx = (vel[i3] *= drag);
      const vy = ((vel[i3 + 1] -= grav), (vel[i3 + 1] *= drag));
      const vz = (vel[i3 + 2] *= drag);
      const px = (pos[i3] += vx * dt);
      const py = (pos[i3 + 1] += vy * dt);
      const pz = (pos[i3 + 2] += vz * dt);

      const fade = Math.pow(1 - p, 0.6);
      const pop = Math.min(life * 24, 1);
      glow[i] = pop * fade;

      const angle = (this.shardAngle[i] += this.shardSpin[i] * dt);
      this._axis.set(this.shardAxis[i3], this.shardAxis[i3 + 1], this.shardAxis[i3 + 2]);
      this._quat.setFromAxisAngle(this._axis, angle);
      obj.position.set(px, py, pz);
      obj.quaternion.copy(this._quat);
      obj.scale.setScalar(Math.max(this.shardScale[i] * (0.3 + 0.7 * fade) * pop, 0.002));
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    geo.attributes.aGlow.needsUpdate = true;
    if (this._shardSpawned) {
      geo.attributes.aTint.needsUpdate = true;
      geo.attributes.aShape.needsUpdate = true;
      this._shardSpawned = false;
    }
  }

  /** Flashes: rise instantly, then expand while the glow collapses. */
  _updateFlashes(dt) {
    if (this.flashLive <= 0) return;
    const geo = this.flashPoints.geometry;
    for (let i = 0; i < this.flashCap; i++) {
      if (this.flashGlow[i] <= 0) continue;
      const life = (this.flashLife[i] += dt);
      const p = life / this.flashTtl[i];
      if (p >= 1) {
        this.flashGlow[i] = 0;
        this.flashSize[i] = 0;
        this.flashLive--;
        this.flashStack[this.flashTop++] = i;
        continue;
      }
      const ease = 1 - (1 - p) * (1 - p);
      const rise = Math.min(life * 26, 1);
      this.flashSize[i] = this.flashBase[i] * (0.4 + 1.6 * ease);
      this.flashGlow[i] = rise * Math.pow(1 - p, 1.8);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aGlow.needsUpdate = true;
  }

  /**
   * Screen shake — a decaying, high-frequency impulse on the camera X / Y.
   * CyberpunkScene calls restoreCamera() right BEFORE controls.update() and
   * update() right AFTER it: OrbitControls always reads and writes the
   * pristine director position, so damping, dolly and drags never fight the
   * impulse and the base orbit state can never drift or accumulate.
   */
  restoreCamera() {
    if (!this._shakeApplied) return;
    const cam = this.scene.camera;
    cam.position.copy(this._basePos);
    cam.quaternion.copy(this._baseQuat);
    this._shakeApplied = false;
  }

  _updateShake(dt) {
    this.restoreCamera();
    if (this.shakeAmp <= 0) { this.shakeT = 0; return; }

    this.shakeT += dt;
    const p = this.shakeT / this.shakeDur;
    if (p >= 1) { this.shakeAmp = 0; this.shakeT = 0; return; }

    const envelope = this.shakeAmp * Math.pow(1 - p, 1.9);
    /* high-frequency dual oscillator: two detuned sines read as a mechanical
       impulse instead of a sine wobble, and cost no extra random() calls */
    this.shakeClock += dt;
    const c = this.shakeClock;
    const sx = Math.sin(c * 61.7) * 0.62 + Math.sin(c * 97.3) * 0.38;
    const sy = Math.sin(c * 53.1 + 1.7) * 0.66 + Math.sin(c * 88.9 + 0.4) * 0.34;

    const cam = this.scene.camera;
    this._basePos.copy(cam.position);
    this._baseQuat.copy(cam.quaternion);
    this._shakeOffset.set(sx * 0.17 * envelope, sy * 0.14 * envelope, 0);
    this._shakeRoll = sy * 0.012 * envelope;
    cam.position.add(this._shakeOffset);
    cam.rotateZ(this._shakeRoll);
    this._shakeApplied = true;
  }

  /* ------------------------- holographic payout overlay -------------------- */
  showOverlay({ amount, mult = 1, mega = false }) {
    const o = this.ov;
    if (!o.el) return;
    o.amount = amount;
    o.t = 0;
    o.open = true;
    o.el.classList.remove('is-out');
    o.el.classList.add('is-on');
    o.el.classList.toggle('is-mega', !!mega);
    /* restart the entry keyframes on every payout */
    o.title.style.animation = 'none';
    void o.title.offsetWidth;
    o.title.style.animation = '';
    o.title.textContent = mega ? 'МЕГА ВЫИГРЫШ' : 'КРУПНЫЙ ВЫИГРЫШ';
    o.kicker.innerHTML = 'кластерный каскад · множитель <b>&times;' + Math.round(mult) + '</b>';
    o.sub.textContent = this.hud.fmt(amount) + ' зачислено · пиковый множитель ×' +
      Math.round(mult) + ' · нажмите в любом месте, чтобы закрыть';
    this._ovText = '';
    this._ovTimer = 0;
    if (o.num) o.num.textContent = this.hud.fmt(0);
    o.bar.style.transform = 'scaleX(1)';
  }

  dismissOverlay() {
    const o = this.ov;
    if (!o.open) return;
    o.open = false;
    o.el.classList.remove('is-on');
    o.el.classList.add('is-out');
  }

  _updateOverlay(dt) {
    const o = this.ov;
    if (o.open) {
      o.t += dt;
      if (o.t >= o.hold) this.dismissOverlay();
      else {
        /* the counter counts up on its own curve, the bar is the auto-close */
        const c = clamp(o.t / o.count, 0, 1);
        const shown = o.amount * (1 - Math.pow(1 - c, 3));
        const text = this.hud.fmt(shown);
        if (text !== this._ovText) {
          this._ovText = text;
          if (o.num) o.num.textContent = text;
        }
        o.bar.style.transform = 'scaleX(' + (1 - clamp(o.t / o.hold, 0, 1)).toFixed(3) + ')';
      }
      return;
    }
    if (!o.el || !o.el.classList.contains('is-out')) return;
    this._ovTimer += dt;
    if (this._ovTimer >= 0.42) {
      this._ovTimer = 0;
      o.el.classList.remove('is-out');
    }
  }

  /* All pool state is static: a reset only has to retire every live slot. */
  reset() {
    this.dismissOverlay();
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.restoreCamera();
    this.shardGlow.fill(0);
    this.shardLive = 0;
    for (let i = 0; i < this.shardCap; i++) this.shardStack[i] = this.shardCap - 1 - i;
    this.shardTop = this.shardCap;
    this.shardMesh.geometry.attributes.aGlow.needsUpdate = true;
    this.flashGlow.fill(0);
    this.flashSize.fill(0);
    this.flashLive = 0;
    for (let i = 0; i < this.flashCap; i++) this.flashStack[i] = this.flashCap - 1 - i;
    this.flashTop = this.flashCap;
    this.flashPoints.geometry.attributes.aGlow.needsUpdate = true;
    this.flashPoints.geometry.attributes.aSize.needsUpdate = true;
    this.group.visible = false;
  }

  dispose() {
    this.dismissOverlay();
    const el = this.ov && this.ov.el;
    if (el && this._onOverlayDown) el.removeEventListener('pointerdown', this._onOverlayDown);
    if (this._onOverlayKey) window.removeEventListener('keydown', this._onOverlayKey);
    this.restoreCamera();
    if (this.group.parent) this.group.parent.remove(this.group);
    if (this.shardMesh) this.shardMesh.dispose();
    if (this.flashPoints) this.flashPoints.geometry.dispose();
    for (const d of this.disposables) if (d && typeof d.dispose === 'function') d.dispose();
    this.disposables.length = 0;
  }
}

/* =========================================================================
   CyberpunkScene — hologram stage: чистое поле 6×6 + рендер напрямую в canvas
   (никаких tunnel / particles / post FX, никакого «космоса» на заднем плане)
   ========================================================================= */
class CyberpunkScene {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;

    /* public state — driven by SlotEngine (step 3) */
    this.spinKick = 0;
    this.spinWave = -1;
    this.overdrive = false;
    this.overdriveBlend = 0;
    this.engine = null;
    /* heavy FX layer (step 4): created in _initVFX once the stage exists */
    this.vfx = null;

    this.clock = new THREE.Clock();
    this.disposables = [];
    this._raf = 0;
    this._tier = 0;
    /* Шкала прогресса лестницы множителя — то, чем теперь живёт нижняя полоска
       «заряд» в окне телеметрии (раньше она показывала гипер драйв). */
    this._charge = 0;
    /* Телефон по умолчанию стартует с лёгкого тира (ВЫСОКОЕ): преломлённая
       стеклянная подложка поля стоит мобильному GPU дороже всего, а нагретый
       телефон теряет кадры быстрее, чем игрок успевает это заметить.
       _tierFloor — пол для FPS-гарда: вниз он шагает и дальше, назад — только
       до этого потолка, иначе через 12 c телефон снова уедет в УЛЬТРА.
       _dprHardCap — абсолютный потолок пикселей для ВСЕХ устройств:
       CFG.dpr = 1.5, т.е. итог всегда Math.min(window.devicePixelRatio, 1.5). */
    this.isMobile = isMobileBoot();
    this._tierFloor = this.isMobile ? 1 : 0;
    this._dprHardCap = CFG.dpr;
    this._tier = this._tierFloor;
    this._pixelCap = Math.min(TIERS[this._tierFloor].dprCap, this._dprHardCap);
    /* Портретная рамка: _fitCamera считает дистанцию «всё поле 6×6 в кадре» и
       вертикальный прицел между шапкой и панелью; aiming доводится плавно
       (this._aimY → this._aimTargetY) прямо в рендер-цикле. */
    this._fitRadius = CFG.camera.pos[2];
    this._aimY = 0;
    this._aimTargetY = 0;
    this._fitDir = new THREE.Vector3();
    this._fitTarget = new THREE.Vector3(0, 0, 0);
    this._fpsAvg = 60;
    this._hudAcc = 0;
    this._tierHold = 0;
    this._tmpObj = new THREE.Object3D();
    this._tmpColor = new THREE.Color();

    this._initRenderer();
    this._initEnvironment();
    this._initTextures();
    this._initCamera();
    this._initControls();
    this._initLights();
    this._initBoard();
    this._initVFX();
    this._bindWindow();
    this._resize();
    this._applyTier(this._tierFloor);
  }

  /* ---------------- core ---------------- */
  _initRenderer() {
    /* Рендер идёт напрямую в canvas: EffectComposer / RenderPass /
       UnrealBloomPass / OutputPass из импортов убраны, поэтому никаких
       offscreen-буферов и дополнительных полноэкранных проходов на телефоне
       больше нет. MSAA включается только на десктопе — на мобильном GPU
       сглаживание стоит дороже, чем выглядит. */
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobileBoot(),
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance'
    });
    /* Тёмно-фиолетовая база фона = --ink из style.css; сине-фиолетовый
       перелив поверх неё рисует CSS-слой .veil, так что 3D-фон не нужен. */
    this.renderer.setClearColor(CFG.palette.ink, 1);
    this.renderer.setClearAlpha(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* Экспозиция поднята с 0.78: раньше bloom дотягивал картинку до нужной
       яркости, теперь её тянут собственные emissive-материалы. */
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = false;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
  }

  _initEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this._envRT = pmrem.fromScene(room, 0.05);
    this.scene.environment = this._envRT.texture;
    if (typeof room.dispose === 'function') room.dispose();
    pmrem.dispose();
  }

  _initTextures() {
    this._glowCyan = glowTexture(CFG.palette.cyan.rgb, 128);
    this._glowViolet = glowTexture(CFG.palette.violet.rgb, 128);
    this._glowSoft = glowTexture('160,232,255', 64);
    this.disposables.push(this._glowCyan, this._glowViolet, this._glowSoft);
  }

  _initCamera() {
    const [x, y, z] = CFG.camera.pos;
    this.camera = new THREE.PerspectiveCamera(CFG.camera.fov, window.innerWidth / window.innerHeight, CFG.camera.near, CFG.camera.far);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
    /* Первый же кадр обязан вмещать всю ширину поля: на 9:16 без этого боковая
       обрезка видна ещё до того, как отработает resize-слушатель. */
    this._fitCamera();
  }

  /* Hard angular clamp: the player may only admire the hologram from a fixed director seat. */
  _initControls() {
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    c.enablePan = false;
    c.enableZoom = true;
    c.zoomSpeed = 0.45;
    c.rotateSpeed = 0.26;
    c.enableDamping = true;
    c.dampingFactor = 0.055;
    c.minDistance = CFG.view.distMin;
    c.maxDistance = CFG.view.distMax;
    c.minPolarAngle = CFG.view.polarMin;
    c.maxPolarAngle = CFG.view.polarMax;
    c.minAzimuthAngle = -CFG.view.azimuth;
    c.maxAzimuthAngle = CFG.view.azimuth;
    c.target.set(0, 0, 0);
    c.update();
    this.controls = c;
    /* Орбита пересобирается под текущий экран: на портрете minDistance /
       maxDistance уезжают вместе с авто-рамкой, в альбоме остаются 10.6–13.4. */
    this._fitCamera();
  }
  /* ---------------- lighting ---------------- */
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0x1c2b47, 1.15));
    const hemi = new THREE.HemisphereLight(0x0b2340, 0x180325, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0x9fd8ff, 0.5);
    key.position.set(4, 7, 9);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(CFG.palette.violet.hex, 0.35);
    rim.position.set(-6, -4, -7);
    this.scene.add(rim);

    /* the two colored point lights that orbit the field in the anim loop */
    this.lightViolet = new THREE.PointLight(CFG.palette.violet.hex, 105, 52, 1.5);
    this.lightCyan = new THREE.PointLight(CFG.palette.cyan.hex, 105, 52, 1.5);
    /* cool ↔ hot (OVERDRIVE) colour pairs, blended by overdriveBlend */
    this._lightCool = new THREE.Color(CFG.palette.violet.hex);
    this._lightHot = new THREE.Color(CFG.palette.red.hex);
    this._lightCoolAlt = new THREE.Color(CFG.palette.cyan.hex);
    this._lightHotAlt = new THREE.Color(CFG.palette.gold.hex);
    this.lightViolet.position.set(-7, 4, 5);
    this.lightCyan.position.set(7, -4, 5);
    this.scene.add(this.lightViolet, this.lightCyan);
  }

  /* КОСМИЧЕСКИЙ ТУННЕЛЬ УБРАН ПОЛНОСТЬЮ: 30 гексагональных колец
     «гиперпространства», кибер-пол из GridHelper и поток из 1500 летящих
     частиц-звёзд больше не существуют — ни мешей, ни шейдеров, ни покадровых
     обновлений. Задний план отдали чистому CSS-градиенту (style.css → .veil)
     поверх тёмно-фиолетовой заливки canvas#gl. */
  /* ---------------- 6×6 holographic field ---------------- */
  _initBoard() {
    this.board = new THREE.Group();
    this.board.name = 'slot-field-6x6';
    this.frames = [];
    this.corners = [];
    this._buildHoloSlab();
    this._buildScanPlate();
    this._buildFrames();
    this._buildFieldGrid();
    this._buildCells();
    this._buildSymbols();
    this._buildCorners();
    this.scene.add(this.board);
  }

  /* Volume backing slab: glass-like physical material with real refraction. */
  _buildHoloSlab() {
    const geo = new RoundedBoxGeometry(10.7, 10.7, 0.4, 5, 0.26);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x061323,
      metalness: 0.0,
      roughness: 0.17,
      transmission: TIERS[0].transmission,
      thickness: 1.15,
      ior: 1.34,
      specularIntensity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      iridescence: 0.6,
      iridescenceIOR: 1.3,
      attenuationColor: new THREE.Color(CFG.palette.cyan.hex),
      attenuationDistance: 3.4,
      emissive: new THREE.Color(0x00060d),
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 0.7
    });
    this.holoSlab = new THREE.Mesh(geo, mat);
    this._slabCool = new THREE.Color(CFG.palette.cyan.hex);
    this._slabHot = new THREE.Color(CFG.palette.gold.hex);
    this.holoSlab.name = 'holo-backing';
    this.holoSlab.position.set(0, 0, -0.62);
    this.board.add(this.holoSlab);
    this.disposables.push(geo, mat);
  }

  _buildScanPlate() {
    const geo = new THREE.PlaneGeometry(11.6, 11.6);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uColorA: { value: new THREE.Color(CFG.palette.violet.hex) },
        uColorB: { value: new THREE.Color(CFG.palette.cyan.hex) }
      },
      vertexShader: PLATE_VERT,
      fragmentShader: PLATE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.scanPlate = new THREE.Mesh(geo, mat);
    /* cool ↔ hot pair, lerped by overdriveBlend in _updateBoard */
    this._plateA = mat.uniforms.uColorA.value.clone();
    this._plateB = mat.uniforms.uColorB.value.clone();
    this._plateHotA = new THREE.Color(CFG.palette.red.hex);
    this._plateHotB = new THREE.Color(CFG.palette.gold.hex);
    this.scanPlate.position.z = -0.95;
    this.board.add(this.scanPlate);
    this.disposables.push(geo, mat);
  }

  /** Glowing rounded-rect tube (Catmull-Rom closed curve → TubeGeometry). */
  _neonTube(w, h, r, hex, { z = 0.1, radius = 0.03, gain = 2.2, opacity = 0.9, phase = 0, hot = hex, hotGain = gain } = {}) {
    const pts = roundedRect(w, h, r, 10).map((p) => new THREE.Vector3(p.x, p.y, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.4);
    const geo = new THREE.TubeGeometry(curve, 240, radius, 8, true);
    const baseColor = hdr(hex, gain);
    const hotColor = hdr(hot, hotGain);
    const mat = new THREE.MeshBasicMaterial({ color: baseColor.clone(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    this.board.add(mesh);
    this.disposables.push(geo, mat);
    this.frames.push({ mesh, baseColor, hotColor, gain, opacity, phase });
    return mesh;
  }

  _dashedFrame(w, h, r, hex, z) {
    const pts = roundedRect(w, h, r, 8).map((p) => new THREE.Vector3(p.x, p.y, z));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: hdr(hex, 1.05), dashSize: 0.34, gapSize: 0.22,
      transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const loop = new THREE.LineLoop(geo, mat);
    loop.computeLineDistances();
    this.board.add(loop);
    this.disposables.push(geo, mat);
    return loop;
  }

  /* Double neon frame: heavy outer tube + inner violet tube + dashed tech loop. */
  _buildFrames() {
    this._neonTube(10.75, 10.75, 0.9, CFG.palette.cyan.hex, { z: 0.22, radius: 0.03, gain: 1.45, opacity: 0.82, phase: 0, hot: CFG.palette.gold.hex, hotGain: 1.7 });
    this._neonTube(9.95, 9.95, 0.7, CFG.palette.violet.hex, { z: 0.12, radius: 0.02, gain: 1.15, opacity: 0.7, phase: 1.7, hot: CFG.palette.red.hex, hotGain: 1.45 });
    this._dashedFrame(10.3, 10.3, 0.8, CFG.palette.cyan.hex, 0.26);
  }

  _buildFieldGrid() {
    const { size, step, min } = CFG.grid;
    const half = step * 0.5;
    const ext = (size - 1) * half + half;
    const pts = [];
    for (let i = 0; i <= size; i++) {
      const p = min - half + i * step;
      pts.push(new THREE.Vector3(p, -ext, 0), new THREE.Vector3(p, ext, 0));
      pts.push(new THREE.Vector3(-ext, p, 0), new THREE.Vector3(ext, p, 0));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: hdr(CFG.palette.cyan.hex, 0.85), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fieldGrid = new THREE.LineSegments(geo, mat);
    this.fieldGrid.position.z = -0.12;
    this.board.add(this.fieldGrid);
    this.disposables.push(geo, mat);
  }
  /* Cell anchors only: home position + breathing phase per grid index
     (index = row * size + col, row 0 = BOTTOM row).
     The decorative socket pedestals that used to sit behind every symbol —
     36 instanced hexagonal / diamond prisms rotating under the fruit and the
     digits — are switched off for good. The field now keeps nothing but the
     translucent hologram backing (holoSlab + scanPlate) and the thin fieldGrid
     lines, so no marker pokes out around a symbol any more. Symbols still read
     cellHomes / cellPhase, which is why the anchors are computed exactly as
     before and this.cells simply stays null. */
  _buildCells() {
    const { size, step, min } = CFG.grid;
    this.cells = null;                 /* no per-cell diamond meshes rendered */
    this.cellHomes = [];
    this.cellPhase = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.cellHomes.push(new THREE.Vector3(min + x * step, min + y * step, 0));
        this.cellPhase[y * size + x] = (x * 0.61 + y * 0.83) % (Math.PI * 2);
      }
    }
  }

  /* 36 glossy 3D symbols — one per cell, all from SymbolFactory. They replace
     the plain glow points of step 1 and now stand on their own: the socket
     pedestals that used to frame every cell are gone (see _buildCells). */
  _buildSymbols() {
    const cfg = CFG.symbols;
    this.symbolFactory = new SymbolFactory(this._glowSoft);
    this.symbols = [];
    this.symbolLayer = new THREE.Group();
    this.symbolLayer.name = 'symbol-field-6x6';

    const total = Math.min(cfg.count || this.cellHomes.length, this.cellHomes.length);
    const picks = SymbolFactory.randomComposition(total, cfg.scatterShare, Math.random, TYPE_WEIGHTS);
    const counts = new Array(SYMBOL_TYPES.length).fill(0);
    const golden = 0.6180339887498949;

    for (let i = 0; i < total; i++) {
      const phase = this.cellPhase[i] || (i * golden * Math.PI * 2) % (Math.PI * 2);
      const seed = (i * golden) % 1;
      this.spawnSymbol(i, picks[i], { phase, seed });
      counts[picks[i]]++;
    }

    this.symbolCounts = counts;
    this.board.add(this.symbolLayer);
    this.disposables.push(this.symbolFactory);
  }

  /* Place one symbol into grid cell `index` (index = row * size + col, row 0 =
     the BOTTOM row). `lift` is its vertical offset above the cell home: the
     engine animates it for the deal, tumble drops and elastic landings. */
  spawnSymbol(index, type, { phase = 0, seed = Math.random(), lift = 0 } = {}) {
    const home = this.cellHomes[index];
    if (!home) return null;
    const group = this.symbolFactory.acquire(type, { phase, seed, scale: CFG.symbols.size });
    if (!group) return null;
    group.position.set(home.x, home.y + lift, CFG.symbols.frontZ);
    this.symbolLayer.add(group);
    const rec = {
      group,
      home,
      cell: index,
      type,
      phase,
      seed,
      frontZ: CFG.symbols.frontZ,
      baseScale: group.scale.x,
      baseScaleY: group.scale.y,
      baseScaleZ: group.scale.z,
      lift,
      pop: 0,
      land: 0,
      vanish: 1,
      winning: false,
      dying: false,
      anim: null,
      animDone: null
    };
    group.userData.rec = rec;
    this.symbols.push(rec);
    return rec;
  }

  /** SlotEngine calls this the moment a symbol has left the stage for good:
      it is pulled out of the render list and returned to the factory bin. */
  killSymbol(rec) {
    if (!rec) return;
    const i = this.symbols.indexOf(rec);
    if (i >= 0) this.symbols.splice(i, 1);
    if (rec.group) {
      rec.group.userData.rec = null;
      this.symbolFactory.release(rec.group);
      rec.group = null;
    }
  }

  /* Field motion: every symbol tumbles on its own axis inside the factory,
     while the layer as a whole breathes with the spin wave in sync.
     lift / pop / land / vanish are per-frame values written by SlotEngine. */
  _updateSymbols(dt, t) {
    const kick = this.spinKick;
    const waveActive = this.spinWave >= 0;
    const waveX = waveActive ? CFG.grid.min + this.spinWave * (CFG.grid.size - 1) * CFG.grid.step : 99;

    for (let i = 0; i < this.symbols.length; i++) {
      const s = this.symbols[i];
      const g = s.group;
      if (!g) continue;
      const home = s.home;
      const dx = home.x - waveX;
      const bump = waveActive ? Math.exp(-dx * dx * 4.5) : 0;
      const pop = s.pop || 0;
      const lift = s.lift || 0;
      const bob = Math.sin(t * 1.2 + s.phase) * 0.06;
      g.position.set(
        home.x,
        home.y + lift + Math.sin(t * 0.9 + s.phase) * 0.02,
        s.frontZ + bob + bump * 0.42 + kick * 0.15 + pop * 0.5
      );
      const breathe = 1 + Math.sin(t * 2 + s.phase) * 0.02 + bump * 0.16 + kick * 0.07 +
        pop * (0.32 + 0.1 * Math.sin(t * 16 + s.phase)) -
        (s.land || 0) * 0.14;
      /* The breathe / pop / land wave must keep the archetype footprint ratio:
         a lemon widened to 74 % has to breathe wide, not back to a cube. */
      const grow = Math.max(breathe, 0.02) * (s.vanish === undefined ? 1 : s.vanish);
      g.scale.set(
        s.baseScale * grow,
        (s.baseScaleY || s.baseScale) * grow,
        (s.baseScaleZ || s.baseScale) * grow
      );
      if (pop > 0.02) g.rotation.y += dt * pop * 4.2;
    }

    /* hyper → импульс КРУТИТЬ: внутримодельные спиннеры / пульсеры на мгновение
       разгоняются вместе со всем полем, когда игрок нажал кнопку. */
    this.symbolFactory.update(dt, t, Math.min(kick, 1));
  }

  /* Angular corner accents: L brackets + pulsing nodes + glow sprites. */
  _buildCorners() {
    const h = 10.75 / 2;
    const arm = 1.35;
    const t = 0.075;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: hdr(CFG.palette.cyan.hex, 1.8), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
        const a1 = new THREE.Mesh(new THREE.BoxGeometry(arm, t, t), mat);
        a1.position.set(sx * (h - arm / 2), sy * h, 0.22);
        const a2 = new THREE.Mesh(new THREE.BoxGeometry(t, arm, t), mat);
        a2.position.set(sx * h, sy * (h - arm / 2), 0.22);
        const nodeGeo = new THREE.OctahedronGeometry(0.17, 0);
        const node = new THREE.Mesh(nodeGeo, mat);
        node.position.set(sx * h, sy * h, 0.22);
        const glowMat = new THREE.SpriteMaterial({ map: this._glowCyan, color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
        const glow = new THREE.Sprite(glowMat);
        glow.position.copy(node.position);
        glow.scale.setScalar(2.0);
        group.add(a1, a2, node, glow);
        this.board.add(group);
        this.corners.push({ node, glow, mat, glowMat, phase: (sx > 0 ? 0 : 1.6) + (sy > 0 ? 0 : 0.8) });
        this.disposables.push(a1.geometry, a2.geometry, nodeGeo, mat, glowMat);
      }
    }
  }
  /* Конус проектора, торцовое кольцо и пятно «деки» под полем (проектор
     светил снизу вверх на голограмму) убраны вместе с космосом: под полем
     6×6 теперь просто чистый градиент фона. Свет дают четыре направленные /
     точечные лампы из _initLights и собственные emissive-материалы символов.

     POST-PROCESSING БОЛЬШЕ НЕТ: EffectComposer + RenderPass + UnrealBloomPass
     + ShaderPass(grade) + OutputPass удалены вместе с импортами. Кадр пишется
     напрямую renderer.render(scene, camera) — на телефоне это минус четыре
     полноэкранных прохода и минус два HalfFloat-буфера, а мягкое свечение
     держится на emissive-каналах самих символов (EMISSIVE_BOOST). */

  /* ---------------- heavy VFX layer (step 4) ---------------- */
  /** Mounted as a child of the field group so bursts inherit the hologram
      stage motion; the shake is applied to the camera around controls.update. */
  _initVFX() {
    this.vfx = new VFXManager(this, this.hud);
    this.vfx.setPixelRatio(this.renderer.getPixelRatio());
    this.vfx.setTier(this._tier);
    this.disposables.push(this.vfx);
  }

  /* ---------------- quality / resize ---------------- */
  _applyTier(index) {
    const tier = TIERS[index];
    if (!tier) return;
    this._tier = index;
    /* Потолок пикселей яруса никогда не выпускается за CFG.dpr = 1.5. */
    this._pixelCap = Math.min(tier.dprCap, this._dprHardCap);

    const slabMat = this.holoSlab.material;
    slabMat.transmission = tier.transmission;
    slabMat.opacity = tier.transmission > 0 ? 1 : 0.38;
    slabMat.transparent = true;
    slabMat.needsUpdate = true;

    document.body.classList.toggle('is-low', !tier.liquid);
    this.hud.setQuality(tier.name);
    /* the VFX pools follow the quality ladder: fewer shards / droplets when
       the FPS guard has already stepped the scene down */
    if (this.vfx) this.vfx.setTier(index);
    this._resize();
  }

  _autoQuality(dt) {
    this._tierHold += dt;
    if (this._tierHold < 6) return;
    const now = performance.now();
    if (this._fpsAvg < 48 && this._tier < TIERS.length - 1 && now - this._lastSwitch > 4000) {
      this._lastSwitch = now;
      this._tierHold = 0;
      this._applyTier(this._tier + 1);
      this.hud.log(`качество → ${TIERS[this._tier].name} (защита по FPS)`);
    } else if (this._fpsAvg > 58 && this._tier > this._tierFloor && now - this._lastSwitch > 12000) {
      this._lastSwitch = now;
      this._tierHold = 0;
      this._applyTier(this._tier - 1);
      this.hud.log(`качество → ${TIERS[this._tier].name} (запас мощности)`);
    }
  }

  /* ---------------- portrait-safe framing (телефон / Mini App) ----------- */
  /** Свободная вертикальная полоса, которую голограмме разрешено занимать: всё,
      что ниже шапки и выше нижней панели. Меряется по живому DOM, поэтому учтены
      и env(safe-area-inset-*), и двухрядная мобильная панель, и шторка Telegram.
      Фоллбэк (12% / 26%) — на случай, если HUD ещё не разложен. */
  _hudBand(h) {
    let top = 0;
    let bottom = 0;
    const head = document.querySelector('.hud-top');
    const deck = document.querySelector('.hud-bottom');
    if (head) {
      const r = head.getBoundingClientRect();
      if (r.height > 0) top = r.bottom;
    }
    if (deck) {
      const r = deck.getBoundingClientRect();
      if (r.height > 0) bottom = h - r.top;
    }
    if (top <= 0 && bottom <= 0) return { top: h * 0.12, bottom: h * 0.26 };
    return { top: clamp(top, 0, h * 0.42), bottom: clamp(bottom, 0, h * 0.55) };
  }

  /** Дистанция + вертикальный прицел, при которых ПОЛНОЕ поле 6×6 помещается в
      кадр на любом соотношении сторон. Поле (6 шагов по 1.35 + габариты
      3D-символов) = 9.2 юнита шириной, значит горизонтальная пирамида видимости
      на дистанции камеры обязана накрыть ровно эти 9.2:

          distH = (targetWidth / 2) / (Math.tan(vFovRad / 2) * aspect)

      FOV перспективной камеры задаёт вертикаль, поэтому горизонталь выводится
      умножением на aspect — и именно она умирает первой на портрете 9:16: при
      fov 52° tan(26°) = 0.4877, baseZ 12.4 даёт 6.8 юнита вместо 9.2.
      distH для 9:16 = 16.8, для 9:20 = 21.0 — оба больше классического кресла
      12.4, поэтому на портрете floor = Math.max(baseZ, distH * fitPad), а в
      альбоме floor остаётся прежним distMin: там поле и так влезает, и привычный
      зум 10.6–13.4 не ломается. minDistance поднимается до floor (приблизиться
      можно ровно до «поле впритык»), maxDistance — до floor * fitBack, иначе
      OrbitControls на следующем update() вернул бы радиус обратно на 13.4 и
      обрезка осталась бы на месте. Вызывается из _initCamera(), _initControls()
      и _resize(); вертикальный прицел насаживается на controls.target в _update. */
  _fitCamera() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const tanHalf = Math.tan(DEG(CFG.camera.fov) * 0.5);
    const distH = (CFG.view.fitWidth / 2) / (tanHalf * Math.max(aspect, 0.05));
    const floor = aspect < 1
      ? Math.max(CFG.camera.pos[2], distH * CFG.view.fitPad)
      : Math.max(CFG.view.distMin, distH * CFG.view.fitPad);
    const ceil = Math.max(CFG.view.distMax, floor * CFG.view.fitBack);
    const c = this.controls;
    this._fitRadius = floor;

    /* Камера едет вдоль уже выбранного игроком направления (драг / зум не
       сбрасываются): OrbitControls каждый кадр читает position - target. */
    const target = c ? c.target : this._fitTarget.set(0, this._aimY, 0);
    const dir = this._fitDir.copy(this.camera.position).sub(target);
    let dist = dir.length();
    if (!(dist > 1e-4)) {
      dir.set(CFG.camera.pos[0], CFG.camera.pos[1], CFG.camera.pos[2]);
      dist = dir.length();
    }
    dir.divideScalar(dist);
    const radius = clamp(dist, floor, c ? ceil : Number.POSITIVE_INFINITY);

    /* Вертикаль: центр поля ровно по центру полосы между шапкой и панелью.
       Прицел уходит вниз (target.y < 0), когда свободная полоса выше центра
       экрана — то есть почти всегда, потому что нижняя панель выше шапки.
       Пикселей на юнит считаем для ФАКТИЧЕСКОГО радиуса, а не для пода: иначе
       сдвиг ошибался бы на величину текущего зума игрока. */
    const band = this._hudBand(h);
    const pxPerUnit = (h * 0.5) / Math.max(radius * tanHalf, 1e-4);
    const aimPx = (band.top + (h - band.bottom)) * 0.5 - h * 0.5;
    const aim = aimPx / Math.max(pxPerUnit, 1e-6);
    this._aimTargetY = Number.isFinite(aim) ? clamp(aim, -CFG.view.aimMax, CFG.view.aimMax) : 0;

    if (c) {
      c.minDistance = floor;
      c.maxDistance = ceil;
      c.target.set(0, this._aimY, 0);
    }
    this.camera.position.copy(target).addScaledVector(dir, radius);
    this.camera.lookAt(target);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this._pixelCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    /* Кадр под любой экран: на вертикальном телефоне distH выталкивает камеру
       назад, а прицел паркует поле между шапкой и панелью управления. */
    this._fitCamera();
    /* Буфер пост-обработки удалён: renderer сам держит размер drawing buffer,
       ни composer.setPixelRatio / setSize, ни uniform частиц больше не нужны. */
    if (this.vfx) this.vfx.setPixelRatio(dpr);
  }

  _bindWindow() {
    this._lastSwitch = performance.now();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
    /* Телефон доезжает до финальных размеров не сразу: Telegram Mini App и iOS
       отдают новый innerHeight только кадром позже поворота, поэтому второй,
       отложенный замер (setInterval тут запрещён, setTimeout — единственный). */
    this._onResizeLate = () => setTimeout(this._onResize, 260);
    window.addEventListener('orientationchange', this._onResizeLate, { passive: true });
    /* Шторка Mini App / программная клавиатура меняют visual viewport, а не
       window — без этого слушателя камера осталась бы в старых границах. */
    const vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === 'function') {
      this._onViewport = () => this._resize();
      vv.addEventListener('resize', this._onViewport, { passive: true });
    }
    this._onVisibility = () => { if (document.hidden) this.stop(); else this.start(); };
    document.addEventListener('visibilitychange', this._onVisibility);
  }
  /* ---------------- public API (driven by SlotEngine) ---------------- */
  /** Русское имя яруса качества — для строки телеметрии и отладки. */
  get tierName() { return (TIERS[this._tier] || TIERS[0]).name; }

  /** Действующий потолок pixelRatio: потолок яруса, но не выше CFG.dpr = 1.5. */
  get pixelCap() { return this._pixelCap; }

  /** true на телефоне / в Telegram Mini App: лёгкий тир по умолчанию. */
  get mobileProfile() { return this.isMobile; }

  /** Публичный перезапуск авто-рамки и drawing buffer: Telegram разворачивает
      Mini App асинхронно, и кадром после ready() / expand() размеры другие. */
  refit() { this._resize(); }

  /** Free-spin bonus palette: frames, lights, slab and HUD go red / gold. */
  setOverdrive(on) {
    const next = !!on;
    if (this.overdrive === next) return next;
    this.overdrive = next;
    document.body.classList.toggle('is-overdrive', next);
    return next;
  }

  triggerSpinPulse() {
    this.spinKick = 1;
    this.spinWave = 0;
  }

  start() {
    if (this._raf) return;
    this.clock.getDelta();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (!this._raf) return;
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /* ---------------- per-frame updates ---------------- */
  _update(dt, t) {
    this.overdriveBlend = damp(this.overdriveBlend, this.overdrive ? 1 : 0, 3.4, dt);
    this.spinKick = damp(this.spinKick, 0, 3.2, dt);

    if (this.spinWave >= 0) {
      this.spinWave += dt / 0.8;
      if (this.spinWave > 1) this.spinWave = -1;
    }

    this._updateBoard(dt, t);
    /* SlotEngine ticks the logical grid + symbol animations right before the
       symbol layer writes them to the scene graph. */
    if (this.engine) this.engine.update(dt, t);
    this._updateSymbols(dt, t);
    this._updateLights(t);
    /* Аркадный саундтрек планирует ноты из этого же кадра: рендер-цикл —
       единственный дирижёр секвенсора, никаких setInterval / своих таймеров. */
    if (this.audio && this.audio.updateMusic) this.audio.updateMusic();
    /* Undo last frame's shake BEFORE the controls integrate, so OrbitControls
       always integrates from the pristine director position … */
    if (this.vfx) this.vfx.restoreCamera();
    this.controls.update();
    /* Портретный прицел доводится плавно, чтобы поворот экрана не бил рывком */
    this._aimY = damp(this._aimY, this._aimTargetY, 5, dt);
    /* «Дыхание» сцены живёт поверх прицела: без this._aimY здесь каждый кадр
       возвращал бы target к нулю и портретная центровка пропадала бы. */
    this.controls.target.set(Math.sin(t * 0.27) * 0.1, this._aimY + Math.cos(t * 0.21) * 0.08, 0);
    /* … and read the pools + re-apply the impulse right AFTER it: the render
       sees the shake, the next frame's controls never do. */
    if (this.vfx) this.vfx.update(dt, t);
  }

  /* Поле 6×6: ни cell-сокетов, ни туннеля, ни проектора — только дыхание
     панели, пульс неоновой рамы, угловые акценты и скан-плита внутри рамки.
     glow — затухающий импульс КРУТИТЬ (spinKick): он заменил гипер-подсветку,
     которой больше нет. */
  _updateBoard(dt, t) {
    const kick = this.spinKick;
    const glow = Math.min(kick, 1);

    /* Маркеры ячеек (36 инстанс-пьедесталов) выключены окончательно, как и
       туннель с частицами: от поля остались стеклянная подложка, скан-плита,
       тонкие линии сетки и 36 объёмных символов. */
    this.board.rotation.z = Math.sin(t * 0.34) * 0.012 + Math.sin(t * 58) * 0.014 * kick;
    this.board.rotation.y = Math.sin(t * 0.29) * 0.03;
    this.board.rotation.x = Math.sin(t * 0.23) * 0.02;
    this.board.position.y = Math.sin(t * 0.62) * 0.05;

    for (const f of this.frames) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.2 + f.phase);
      f.mesh.material.opacity = clamp(f.opacity * (pulse + glow * 0.4 + kick * 0.5), 0, 1);
      f.mesh.material.color.copy(f.baseColor).lerp(f.hotColor, this.overdriveBlend).multiplyScalar(1 + glow * 0.8 + kick * 0.9);
    }

    for (const c of this.corners) {
      const p = 0.55 + 0.45 * Math.sin(t * 3.1 + c.phase);
      c.mat.opacity = clamp(0.45 + p * 0.45 + kick * 0.4, 0, 1);
      c.glowMat.opacity = clamp(0.24 + p * 0.4 + glow * 0.26, 0, 1);
      c.glow.scale.setScalar(1.8 + p * 0.55 + glow * 1.0);
      c.node.rotation.set(t * 0.9 + c.phase, t * 1.3, 0);
    }

    const plateU = this.scanPlate.material.uniforms;
    plateU.uTime.value = t;
    plateU.uPulse.value = glow * 0.55;
    plateU.uColorA.value.copy(this._plateA).lerp(this._plateHotA, this.overdriveBlend);
    plateU.uColorB.value.copy(this._plateB).lerp(this._plateHotB, this.overdriveBlend);
    this.holoSlab.material.attenuationColor.copy(this._slabCool).lerp(this._slabHot, this.overdriveBlend);
  }

  _updateLights(t) {
    const od = this.overdriveBlend;
    const violet = this.lightViolet;
    const cyan = this.lightCyan;
    violet.position.set(Math.sin(t * 0.62) * 7.4, Math.cos(t * 0.44) * 5.2, 4.6 + Math.sin(t * 0.35) * 2.4);
    cyan.position.set(Math.sin(t * 0.51 + 2.4) * -7.8, Math.sin(t * 0.38 + 1.1) * 5.6, 5.0 + Math.cos(t * 0.27) * 2.0);
    violet.intensity = 118 + 26 * Math.sin(t * 1.1) + od * 90;
    cyan.intensity = 118 - 26 * Math.sin(t * 0.9) + od * 90;
    violet.color.copy(this._lightCool).lerp(this._lightHot, od);
    cyan.color.copy(this._lightCoolAlt).lerp(this._lightHotAlt, od);
  }

  /* Шкала «заряд» = прогресс лестницы множителя: ×1 → 0 %, ×32 → 100 %.
     (Раньше по ней же показывался гипер драйв.) */
  _ladderCharge() {
    const mult = this.engine ? Math.max(this.engine.mult || 1, 1) : 1;
    return clamp(Math.log2(mult) / 5, 0, 1) * 100;
  }

  _telemetry(dt) {
    this._fpsAvg += (1 / Math.max(dt, 1e-4) - this._fpsAvg) * 0.08;
    this._hudAcc += dt;
    if (this._hudAcc < 0.4) return;
    this._hudAcc = 0;
    this.hud.setFps(Math.round(clamp(this._fpsAvg, 0, 240)));
    this.hud.setDraws(this.renderer.info.render.calls);
    this._charge = damp(this._charge, this._ladderCharge(), 2.4, 0.4);
    this.hud.setCharge(this._charge);
    this._autoQuality(0.4);
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.renderer.info.reset();
    this._update(dt, t);
    /* Прямой лёгкий рендер: ни EffectComposer, ни bloom, ни grade-прохода —
       один вызов renderer.render() пишет кадр прямо в canvas#gl. */
    this.renderer.render(this.scene, this.camera);
    this._telemetry(dt);
  };

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    window.removeEventListener('orientationchange', this._onResizeLate);
    if (this._onViewport && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onViewport);
    }
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.controls.dispose();
    for (const d of this.disposables) if (d && typeof d.dispose === 'function') d.dispose();
    this._envRT.dispose();
    this.renderer.dispose();
  }
}
/* =========================================================================
   SLOT ENGINE · 6×6 CLUSTER PAYS
   BFS flood fill for clusters (4+ of a kind, orthogonal only — the SCATTER
   archetype never joins a cluster) · tumble cascades with column gravity and
   elastic landings · doubling ladder ×1→×32 · 4+ SCATTER opens 10 free spins
   in the red/gold OVERDRIVE mode where the ladder is never reset. Nothing is
   ever auto-fired: every spin — paid or free — waits for the player to hit
   SPIN / SPACE.
   The engine owns the logical grid; visuals are "lift / pop / vanish" values
   it writes on the scene records every frame (spawnSymbol / killSymbol).
   ========================================================================= */
const GRID = CFG.grid.size;
const CELLS = GRID * GRID;
const STEP = CFG.grid.step;
const SCATTER = SYMBOL_TYPES.length - 1;
/* 4 in a row is the smallest paying cluster — on 36 cells that keeps the
   tumbles coming on roughly every other deal. */
const MIN_CLUSTER = 4;
const MAX_TUMBLES = 12;
const MULT_LADDER = Object.freeze([1, 2, 4, 8, 16, 32]);
const FS_AWARD = 10;
const FS_SCATTERS = 4;
/* pay[type][band] in × bet — bands: 0 → 4-5 · 1 → 6-8 · 2 → 9-12 · 3 → 13+ */
const PAY_TABLE = Object.freeze([
  Object.freeze([0.2, 0.6, 2.0, 6]),     /* 0 CHERRY */
  Object.freeze([0.4, 1.0, 3.2, 10]),    /* 1 LEMON */
  Object.freeze([0.6, 1.8, 5.0, 16]),    /* 2 WATERMELON */
  Object.freeze([1.0, 3.0, 9.0, 28]),    /* 3 GRAPE */
  Object.freeze([1.8, 5.0, 14.0, 45]),   /* 4 LUCKY 7 */
  Object.freeze([2.0, 5.6, 16.0, 50]),    /* 5 LUCKY 8 */
  Object.freeze([0, 0, 0, 0])            /* 6 SCATTER — pays by count instead */
]);
/* scatter pays by how many sit on the field once the last tumble settles */
const SCATTER_PAY = Object.freeze([0, 0, 0, 0, 2, 6, 15, 50]);
/* deal + refill odds: the four fruits carry the board, the two arcade digits
   land rare and SCATTER holds ~3.5 % of it so the bonus stays a rare treat
   instead of an every-spin event */
const TYPE_WEIGHTS = Object.freeze([1.34, 1.2, 1.06, 0.95, 0.42, 0.3, 0.19]);
/* BIG WIN / MEGA WIN thresholds in × bet — VFXManager holographic overlay */
const WIN_BIG = 15;
const WIN_MEGA = 40;
/* cluster / cascade thresholds that hit the camera with a decaying impulse */
const SHAKE_CLUSTER = 8;
const SHAKE_MULT = 4;
/* animation pacing, seconds */
const T = Object.freeze({
  clearDur: 0.44, clearCol: 0.022, clearWait: 0.74,
  dealBase: 0.40, dealPer: 0.05, dealCol: 0.05, dealWait: 1.62,
  highlight: 0.3, vanish: 0.34, collapseWait: 0.86
});
const PAY_BAND = (n) => (n >= 13 ? 3 : n >= 9 ? 2 : n >= 6 ? 1 : 0);
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1, q = p - 1; return 1 + c3 * q * q * q + c1 * q * q; };
const easeInCubic = (p) => p * p * p;
const easeOutQuad = (p) => 1 - (1 - p) * (1 - p);

class SlotEngine {
  constructor(scene, hud, opts = {}) {
    this.scene = scene;
    this.hud = hud;
    /* step 5 · wallet bookkeeping: EXIT always reports the profit measured
       against the balance the backend handed us in the query string. */
    this.balance = Number.isFinite(opts.balance) ? opts.balance : 10000;
    this.initialBalance = this.balance;
    this.sessionId = typeof opts.sessionId === 'string' && opts.sessionId ? opts.sessionId : 'demo_local';
    this.bets = opts.bets && opts.bets.length ? opts.bets : [1];
    this.betIndex = clamp(opts.betIndex == null ? this.bets.length - 1 : opts.betIndex, 0, this.bets.length - 1) | 0;

    /* logical field: index = row * GRID + col, row 0 is the BOTTOM row */
    this.grid = new Int8Array(CELLS).fill(-1);
    this.records = new Array(CELLS).fill(null);
    this.dying = [];
    this._seen = new Uint8Array(CELLS);
    this._queue = new Int32Array(CELLS);
    this._finished = [];
    this._timers = [];
    this.time = 0;

    /* Heavy FX layer of step 4 lives in the scene; the anchor buffer below is
       reused by every detonation so the tumble loop never allocates. */
    this.audio = opts.audio || scene.audio || null;
    /* optional boot hook — Telegram haptics listen in on the payout moments */
    this.onBigWin = typeof opts.onBigWin === 'function' ? opts.onBigWin : null;
    this.vfx = scene.vfx || null;
    this._fxAnchors = [];

    this.phase = 'idle';
    this.busy = false;
    this.mult = 1;
    this.spinWin = 0;
    this.tumble = 0;
    this.spins = 0;
    this.totalStake = 0;
    this.totalWin = 0;
    this.maxMult = 1;
    this.fsRemaining = 0;
    this.bonusOn = false;

    /* weighted roll table for refills — SCATTER stays rare but always reachable */
    let wtotal = 0;
    for (const w of TYPE_WEIGHTS) wtotal += w;
    this._weightTotal = wtotal;

    /* the scene already forged a full 6×6 field at boot: adopt it as round 0 */
    const stage = this.scene.symbols;
    for (let i = 0; i < stage.length; i++) {
      const rec = stage[i];
      if (!rec || typeof rec.cell !== 'number') continue;
      this.records[rec.cell] = rec;
      this.grid[rec.cell] = rec.type;
    }
  }

  get bet() { return this.bets[this.betIndex]; }

  /** Session profit for Telegram's sendData payload (never below a real loss). */
  get profit() { return this.balance - this.initialBalance; }

  setBetIndex(i) {
    if (this.busy) return this.betIndex;
    this.betIndex = clamp(i | 0, 0, this.bets.length - 1) | 0;
    this.hud.setBet(this.bet);
    return this.betIndex;
  }

  sync() {
    this.hud.setBalance(this.balance);
    this.hud.setBet(this.bet);
    this.hud.setMultiplier(this.mult);
    this.hud.setFreeSpins(this.fsRemaining);
    this.hud.setWin(this.spinWin);
  }

  /* ---------------- frame-driven scheduler (tab-safe) ---------------- */
  _at(delay, fn) {
    const at = this.time + Math.max(delay, 0.01);
    const list = this._timers;
    let i = list.length;
    while (i > 0 && list[i - 1].at > at) i--;
    list.splice(i, 0, { at, fn });
  }

  /* ---------------- symbol plumbing (scene owns the meshes) ---------------- */
  _spawn(index, type, lift = 0) {
    const golden = 0.6180339887498949;
    const seed = (index * golden + this.time * 0.7919 + Math.random() * 0.11) % 1;
    const rec = this.scene.spawnSymbol(index, type, {
      phase: (index * 1.373 + this.time * 0.5) % 6.2831853,
      seed,
      lift
    });
    this.records[index] = rec || null;
    return rec;
  }

  _reap(rec) {
    if (!rec) return;
    const i = this.dying.indexOf(rec);
    if (i >= 0) this.dying.splice(i, 1);
    this.scene.killSymbol(rec);
  }

  /* lift / pop / land / vanish animate on the record; _updateSymbols renders them */
  /** Touchdown of a falling symbol: the audio engine caps the 36-voice rain. */
  _onLand(rec) {
    if (rec) rec.land = 1;
    if (this.audio && rec) this.audio.land(rec.cell || 0);
  }

  _anim(rec, cfg) {
    if (!rec) return;
    rec.anim = {
      kind: cfg.kind,
      y0: cfg.y0 || 0,
      y1: cfg.y1 || 0,
      t: 0,
      dur: Math.max(cfg.dur || 0.3, 0.05),
      delay: Math.max(cfg.delay || 0, 0),
      ease: cfg.ease || easeOutQuad
    };
    rec.lift = rec.anim.y0;
    rec.animDone = cfg.done || null;
  }

  _stepAnim(rec, dt, finished) {
    const a = rec.anim;
    if (a.delay > 0) {
      a.delay -= dt;
      rec.lift = a.y0;
      if (a.delay > 0) return;
    }
    a.t += dt;
    const p = clamp(a.t / a.dur, 0, 1);
    rec.lift = a.y0 + (a.y1 - a.y0) * a.ease(p);
    if (a.kind === 'vanish') rec.vanish = Math.max(1 - p * p * 1.2, 0);
    if (p >= 1) {
      rec.lift = a.y1;
      rec.anim = null;
      if (a.kind === 'vanish') rec.vanish = 0;
      if (a.kind === 'fall') this._onLand(rec);
      finished.push(rec);
    }
  }

  update(dt, t) {
    this.time += dt;
    const stage = this.scene.symbols;
    const finished = this._finished;
    finished.length = 0;

    for (let i = 0; i < stage.length; i++) {
      const rec = stage[i];
      if (rec.anim) this._stepAnim(rec, dt, finished);
      if (rec.dying) continue;
      if (rec.winning || rec.pop > 0.0005) rec.pop = damp(rec.pop || 0, rec.winning ? 1 : 0, 11, dt);
      if (rec.land > 0.0005) rec.land = damp(rec.land, 0, 7, dt);
    }
    /* kill/respawn happens here, never in the middle of the render list walk */
    for (let i = 0; i < finished.length; i++) {
      const rec = finished[i];
      const done = rec.animDone;
      rec.animDone = null;
      if (done) done();
    }
    const timers = this._timers;
    while (timers.length && timers[0].at <= this.time) {
      const timer = timers.shift();
      timer.fn();
    }
  }

  /* ---------------- spin flow ---------------- */
  spin() {
    if (this.busy) return false;
    const bet = this.bet;
    const free = this.bonusOn && this.fsRemaining > 0;
    if (!free && this.balance < bet) {
      this.hud.setState('НЕТ СРЕДСТВ');
      this.hud.log('недостаточно средств · ставка <span>' + this.hud.fmt(bet) + '</span>');
      return false;
    }

    this.busy = true;
    this.phase = 'deal';
    this.spinWin = 0;
    this.tumble = 0;
    this.spins++;
    this.totalStake += bet;
    if (!this.bonusOn) this.mult = 1;

    if (free) {
      this.fsRemaining--;
      this.hud.setFreeSpins(this.fsRemaining);
    } else {
      this.balance -= bet;
      this.hud.setBalance(this.balance);
    }

    this.hud.setMultiplier(this.mult);
    this.hud.setWin(0);
    this.hud.flashSpin();
    this.hud.setState(free ? 'ФРИСПИН' : 'КРУТИМ');
    this.hud.log((free ? 'фриспин · ставка <span>' : 'вращение · ставка <span>') + this.hud.fmt(bet) + '</span>');
    this._setSpinLabel(free ? 'ФРИСПИН' : 'КРУТИТЬ');

    /* импульс всей раздачи: панель, рама и символы реагируют на нажатие */
    this.scene.triggerSpinPulse();
    /* яркий мажорный свист вращения + восходящее трезвучие вместо гула */
    if (this.audio) this.audio.spin(free);

    this._dropField();
    this._at(T.clearWait, () => {
      this._deal();
      this._at(T.dealWait, () => this._evaluate());
    });
    return true;
  }

  /** Every old symbol plunges down and out of the field. */
  _dropField() {
    const floorY = -(GRID * STEP * 0.5 + 4.2);
    for (let i = 0; i < CELLS; i++) {
      const rec = this.records[i];
      if (!rec) continue;
      this.records[i] = null;
      this.grid[i] = -1;
      rec.dying = true;
      this.dying.push(rec);
      this._anim(rec, {
        kind: 'clear',
        y0: rec.lift || 0,
        y1: floorY - rec.home.y,
        dur: T.clearDur + (i % GRID) * 0.014,
        delay: (i % GRID) * T.clearCol,
        ease: easeInCubic,
        done: () => this._reap(rec)
      });
    }
  }

  /** 36 new symbols rain in column by column and land with an elastic bounce. */
  _deal() {
    const picks = SymbolFactory.randomComposition(CELLS, CFG.symbols.scatterShare, Math.random, TYPE_WEIGHTS);
    for (let i = 0; i < CELLS; i++) {
      const row = (i / GRID) | 0;
      const col = i % GRID;
      const dist = (GRID - 1 - row) * STEP + 3.4;
      this.grid[i] = picks[i];
      const rec = this._spawn(i, picks[i], dist);
      this._anim(rec, {
        kind: 'fall',
        y0: dist,
        y1: 0,
        dur: T.dealBase + dist * T.dealPer,
        delay: col * T.dealCol + row * 0.012,
        ease: easeOutBack,
        done: () => { if (rec) rec.land = 1; }
      });
    }
    this.phase = 'evaluating';
  }

  /** Weighted roll for refills (SCATTER keeps its small share). */
  _roll() {
    let roll = Math.random() * this._weightTotal;
    for (let i = 0; i < TYPE_WEIGHTS.length; i++) {
      roll -= TYPE_WEIGHTS[i];
      if (roll <= 0) return i;
    }
    return 0;
  }

  _setSpinLabel(text) {
    const btn = this.hud.el.spin;
    const label = btn ? btn.querySelector('.spin-label') : null;
    if (label && label.textContent !== text) label.textContent = text;
  }

  /* ---------------- BFS flood fill (horizontal + vertical, never diagonal) -- */
  _clusters() {
    const grid = this.grid;
    const seen = this._seen;
    const queue = this._queue;
    seen.fill(0);
    const found = [];

    for (let start = 0; start < CELLS; start++) {
      const type = grid[start];
      if (type < 0 || type >= SCATTER || seen[start]) continue;   /* SCATTER never clusters */
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      seen[start] = 1;
      const cells = [];
      while (head < tail) {
        const cur = queue[head++];
        cells.push(cur);
        const row = (cur / GRID) | 0;
        const col = cur - row * GRID;
        if (col > 0) {
          const n = cur - 1;
          if (!seen[n] && grid[n] === type) { seen[n] = 1; queue[tail++] = n; }
        }
        if (col < GRID - 1) {
          const n = cur + 1;
          if (!seen[n] && grid[n] === type) { seen[n] = 1; queue[tail++] = n; }
        }
        if (row > 0) {
          const n = cur - GRID;
          if (!seen[n] && grid[n] === type) { seen[n] = 1; queue[tail++] = n; }
        }
        if (row < GRID - 1) {
          const n = cur + GRID;
          if (!seen[n] && grid[n] === type) { seen[n] = 1; queue[tail++] = n; }
        }
      }
      if (cells.length >= MIN_CLUSTER) found.push({ type, size: cells.length, cells });
    }
    found.sort((a, b) => b.size - a.size);
    return found;
  }

  /* ---------------- win check → ladder → tumble loop ---------------- */
  _evaluate() {
    const clusters = this._clusters();
    if (!clusters.length) return this._settle();

    const rung = Math.min(this.tumble, MULT_LADDER.length - 1);
    this.mult = MULT_LADDER[rung];
    /* step 5 · synth arpeggiator: every ladder rung ×1→×32 lifts the chord a
       semitone, so a deep cascade walks up the scale exactly like the win does */
    if (this.audio) this.audio.cascade(rung, clusters.length);
    if (this.mult > this.maxMult) this.maxMult = this.mult;
    this.hud.setMultiplier(this.mult);

    let base = 0;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      base += PAY_TABLE[c.type][PAY_BAND(c.size)];
    }
    const gain = base * this.bet * this.mult;
    this.spinWin += gain;
    this.totalWin += gain;
    this.hud.setWin(this.spinWin);

    const capped = this.tumble >= MAX_TUMBLES;
    this.tumble++;
    const top = clusters[0];
    this.hud.setState('КАСКАД ' + this.tumble + ' · ×' + this.mult);
    this.hud.log(
      clusters.length + ' ' + pluralRu(clusters.length, 'кластер', 'кластера', 'кластеров') + ' · ' +
      SYMBOL_TYPES[top.type].label + ' ×<span>' + top.size + '</span> → +' +
      this.hud.fmt(gain) + ' (×' + this.mult + ')'
    );

    this._highlight(clusters);
    this.scene.spinKick = 1;

    if (capped) {
      this._at(T.highlight, () => {
        this._vanish(clusters);
        this._at(T.vanish + 0.06, () => this._settle());
      });
      return;
    }
    this._at(T.highlight, () => {
      this._vanish(clusters);
      this._at(T.vanish, () => {
        this._collapse();
        this._at(T.collapseWait, () => this._evaluate());
      });
    });
  }

  _highlight(clusters) {
    for (let i = 0; i < clusters.length; i++) {
      const cells = clusters[i].cells;
      for (let k = 0; k < cells.length; k++) {
        const rec = this.records[cells[k]];
        if (rec) rec.winning = true;
      }
    }
  }

  /**
   * Heavy FX for a winning cascade (VFXManager): every vanished symbol gets a
   * flash + a small instanced shard burst, the geometric centre of the biggest
   * cluster punches the camera with a decaying impulse, and a cluster of 8+
   * symbols — or a cascade that reached the ×4 rung — hits harder. Anchors go
   * into a reused buffer, so a detonation costs zero allocations while the
   * tumble loop is running.
   */
  _detonate(clusters) {
    const vfx = this.vfx;
    if (!vfx || !clusters.length) return;
    const homes = this.scene.cellHomes;
    const pool = this._fxAnchors;
    while (pool.length < CELLS) pool.push({ x: 0, y: 0, z: 0, hex: 0 });

    let topSize = 0;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const meta = SYMBOL_TYPES[c.type];
      const cells = c.cells;
      const n = cells.length;

      let cx = 0;
      let cy = 0;
      for (let k = 0; k < n; k++) {
        const home = homes[cells[k]];
        const a = pool[k];
        cx += a.x = home.x;
        cy += a.y = home.y;
        a.z = home.z + 0.18;
        a.hex = k % 3 === 0 ? meta.accent : meta.hex;
      }
      cx /= n;
      cy /= n;
      vfx.explode(pool, { n, cx, cy, hex: meta.hex });

      if (n > topSize) topSize = n;
    }

    /* no energy orbs fly to the multiplier panels any more: the detonation
       is the spark puff alone, nothing floats across the stage. */
    if (topSize >= SHAKE_CLUSTER || this.mult >= SHAKE_MULT) {
      const size = Math.min(topSize, 26);
      const strength = 0.55 + size * 0.045 +
        (this.mult >= SHAKE_MULT ? 0.3 + Math.min(this.mult, 32) * 0.012 : 0);
      vfx.shake(strength, 0.42 + size * 0.012);
    }
  }

  /** Winning symbols flare (pop ≈ 1 in _updateSymbols), then shrink away. */
  _vanish(clusters) {
    this._detonate(clusters);
    /* the sub-hit lands at the exact frame the winning symbols blow apart */
    if (this.audio) this.audio.explode(clusters[0] ? clusters[0].size : 0, this.mult);
    for (let i = 0; i < clusters.length; i++) {
      const cells = clusters[i].cells;
      for (let k = 0; k < cells.length; k++) {
        const idx = cells[k];
        const rec = this.records[idx];
        if (!rec) continue;
        this.records[idx] = null;
        this.grid[idx] = -1;
        rec.dying = true;
        this.dying.push(rec);
        this._anim(rec, {
          kind: 'vanish',
          y0: rec.lift || 0,
          y1: (rec.lift || 0) + 1.1,
          dur: T.vanish - 0.06 + (idx % GRID) * 0.008,
          ease: easeOutQuad,
          done: () => this._reap(rec)
        });
      }
    }
  }

  /** Gravity: survivors slide down their own column, the holes above refill. */
  _collapse() {
    for (let col = 0; col < GRID; col++) {
      let write = 0;
      for (let row = 0; row < GRID; row++) {
        const idx = row * GRID + col;
        if (this.grid[idx] < 0) continue;
        const landing = write * GRID + col;
        if (landing !== idx) {
          const rec = this.records[idx];
          const type = this.grid[idx];
          this.grid[idx] = -1;
          this.records[idx] = null;
          this.grid[landing] = type;
          this.records[landing] = rec;
          if (rec) {
            const drop = (row - write) * STEP;
            rec.cell = landing;
            rec.home = this.scene.cellHomes[landing];
            this._anim(rec, {
              kind: 'fall',
              y0: (rec.lift || 0) + drop,
              y1: 0,
              dur: 0.26 + drop * 0.05,
              delay: 0.04 + col * 0.018,
              ease: easeOutBack,
              done: () => { rec.land = 1; }
            });
          }
        }
        write++;
      }
      const holes = GRID - write;
      for (let row = write; row < GRID; row++) {
        const idx = row * GRID + col;
        const type = this._roll();
        this.grid[idx] = type;
        const dist = (GRID - 1 - row) * STEP + holes * STEP + 2.4;
        const rec = this._spawn(idx, type, dist);
        this._anim(rec, {
          kind: 'fall',
          y0: dist,
          y1: 0,
          dur: 0.3 + dist * 0.05,
          delay: 0.05 + col * 0.02,
          ease: easeOutBack,
          done: () => { if (rec) rec.land = 1; }
        });
      }
    }
  }

  /* ---------------- payout + free-spin bonus ---------------- */
  _settle() {
    /* safety net: whatever is still mid-flight leaves the stage right now */
    if (this.dying.length) {
      const leftovers = this.dying.slice();
      this.dying.length = 0;
      for (const rec of leftovers) this.scene.killSymbol(rec);
    }

    let scatters = 0;
    for (let i = 0; i < CELLS; i++) if (this.grid[i] === SCATTER) scatters++;

    let total = this.spinWin;
    const scatterPay = SCATTER_PAY[Math.min(scatters, SCATTER_PAY.length - 1)] * this.bet * this.mult;
    if (scatterPay > 0) {
      total += scatterPay;
      this.totalWin += scatterPay;
      this.hud.log(SYMBOL_TYPES[SCATTER].label + ' ×' + scatters + ' · <span>+' + this.hud.fmt(scatterPay) + '</span>');
    }
    if (total > 0) {
      this.balance += total;
      this.hud.setBalance(this.balance);
      this.hud.log('выплата зачислена · <span>+' + this.hud.fmt(total) + '</span> · каскад ' + this.tumble);
    }
    this.spinWin = total;
    this.hud.setWin(total);

    /* BIG WIN (≥15× stake) / MEGA WIN (≥40×): the holographic payout overlay
       with its counting-up counter, one chord and one camera punch — nothing
       else. No sphere rain, no bokeh. Closed on click or after 3.5 s. */
    const vfx = this.vfx;
    if (vfx && total > 0 && total >= this.bet * WIN_BIG) {
      const turns = total / this.bet;
      const mega = total >= this.bet * WIN_MEGA;
      this.hud.setState(mega ? 'МЕГА ВЫИГРЫШ' : 'КРУПНЫЙ ВЫИГРЫШ');
      vfx.showOverlay({ amount: total, mult: this.maxMult, mega });
      if (this.audio) this.audio.bigWin(mega);
      vfx.shake(mega ? 1.7 : 1.15, 0.8);
      if (this.onBigWin) this.onBigWin(total, mega);
      this.hud.log((mega ? '<span>МЕГА ВЫИГРЫШ</span>' : '<span>КРУПНЫЙ ВЫИГРЫШ</span>') +
        ' · <span>×' + this.hud.fmt(turns) + '</span> к ставке · пик <span>×' +
        this.maxMult + '</span>');
    }

    /* 4+ SCATTER left on the field once the cascades stop → 10 free spins */
    if (scatters >= FS_SCATTERS) {
      this.fsRemaining += FS_AWARD;
      this.bonusOn = true;
      this._setBonusVisuals(true);
      /* scatter alert sweep — аркадная петля раскрывается в setOverdrive() ниже */
      if (this.audio) this.audio.freeSpins(scatters);
      this.hud.setFreeSpins(this.fsRemaining);
      this.hud.log('<span>' + SYMBOL_TYPES[SCATTER].label + ' ×' + scatters + '</span> · ' +
        FS_AWARD + ' ' + pluralRu(FS_AWARD, 'фриспин', 'фриспина', 'фриспинов') + ' · бонусный режим включён');
    }

    const sessionOver = this.bonusOn && this.fsRemaining <= 0;
    if (sessionOver) {
      this.bonusOn = false;
      this.mult = 1;
      this._setBonusVisuals(false);
      this.hud.setFreeSpins(0);
      this.hud.log('фриспины завершены · лестница множителя сброшена к <span>×1</span>');
    } else if (!this.bonusOn) {
      this.mult = 1;
    }

    this.hud.setMultiplier(this.mult);
    this._setSpinLabel(this.fsRemaining > 0 ? 'ФРИСПИН' : 'КРУТИТЬ');
    this.phase = 'idle';
    this.busy = false;

    /* Free spins are NEVER auto-fired: the field simply waits, the readout
       and the button label telling the player the next deal is on the house
       and one КРУТИТЬ / ПРОБЕЛ press away. */
    if (this.fsRemaining > 0) {
      this.hud.setState('ФРИ ×' + this.fsRemaining + ' · КРУТИТЬ');
      this.hud.log('фриспин готов · нажимай <span>КРУТИТЬ</span> · осталось ' + this.fsRemaining);
    } else {
      this.hud.setState('ОЖИДАНИЕ');
    }
  }

  /** Red / gold override for the whole free-spin session. */
  _setBonusVisuals(on) {
    this.scene.setOverdrive(on);
    /* звук следует за картинкой: аркадная петля прибавляет яркость, плотность
       арпеджио и октаву, когда бонус активен (setOverdrive в аудиодвижке) */
    if (this.audio) this.audio.setOverdrive(on);
  }

  /** Session readout for the rail / console sandbox (window.NEON.engine.stats()). */
  stats() {
    return {
      spins: this.spins,
      staked: this.totalStake,
      won: this.totalWin,
      rtp: this.totalStake > 0 ? this.totalWin / this.totalStake : 0,
      maxMult: this.maxMult,
      balance: this.balance,
      initialBalance: this.initialBalance,
      profit: this.profit,
      session: this.sessionId,
      freeSpins: this.fsRemaining,
      bonus: this.bonusOn
    };
  }
}

/* =========================================================================
   BOOT
   ========================================================================= */
const BETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];

/* =========================================================================
   CYBER AUDIO ENGINE · STEP 5 — 100 % procedural Web Audio, zero assets.
   Nothing is sampled: instead of the old grim 27.5 / 55 Hz drone bed the game
   now runs a LIGHT, UPBEAT ARCADE GROOVE — 122 BPM in a major pentatonic
   (C · G · A · F), a soft pulsing bass, bright plucked arpeggio notes and a
   feather-light offbeat hat, all quietly mixed under the reels. On top of it:
   the bright КРУТИТЬ whoosh + rising major triad, glass landing pings with a
   hard polyphony cap (36 symbols rain down together), a cascade arpeggiator
   that lifts the chord one semitone per ladder rung ×1→×32, punchy detonations
   and a BIG / MEGA WIN major chord pushed through feedback delay and a
   procedurally generated convolution hall.
   Секвенсор не имеет собственных таймеров: ноты планируются из рендер-цикла
   (CyberpunkScene._update → updateMusic) коротким look-ahead окном.
   Every voice is a fresh node pair dropped on 'ended', so the graph never
   grows while a session runs and the master bus stays inside the limiter.
   ========================================================================= */
class CyberAudioEngine {
  /* Мажорная пентатоника — опора всего движка: приземления фруктов, арпеджио
     каскадов и фоновая мелодия идут по одним и тем же ступеням, поэтому микс
     звучит весело и стройно, а не «минорно-киберпанково». */
  static PENTA = Object.freeze([0, 2, 4, 7, 9]);
  static ARP = Object.freeze([0, 4, 7, 12, 16]);      /* мажорное add9 звучание */
  static LAND_VOICES = 6;                             /* 36 символов → максимум 6 голосов */
  static LAND_GAP = 0.024;                            /* пауза между двумя пингами, c */
  /* ------------------------- аркадная фоновая петля ------------------------- */
  static BPM = 122;                                   /* бодрый аркадный темп */
  static STEP = 60 / 122 / 4;                         /* 16-я нота ≈ 0.123 c */
  static STEPS_PER_BAR = 16;                          /* 4/4, шагами на такт */
  static BARS = 4;                                    /* длина петли: 64 шага */
  /* Полутон-корни четырёх тактов: C · G · A · F — самый «солнечный» круг
     мажорной пентатоники, без минорного тона вниз. */
  static CHORDS = Object.freeze([0, 7, 9, 5]);
  /* Ступени пентатоники на шаг (null — пауза): мелодия прыгает вверх-вниз,
     как в аркадных играх, а не ползёт по хроматике. */
  static MELODY = Object.freeze([0, null, 2, 4, null, 2, 3, null, 4, null, 3, 2, null, 0, 2, null]);
  static LOOKAHEAD = 0.18;                            /* как далеко вперёд пишем ноты */
  static MUSIC_LEVEL = 0.15;                          /* «невысокая громкость» фона */

  constructor(opts = {}) {
    this.level = clamp(opts.level == null ? 0.78 : Number(opts.level), 0, 1);
    this.muted = !!opts.muted;
    this.ctx = null;
    this.bus = null;
    this.music = null;
    this.unlocked = false;
    this.overdrive = false;
    this.landVoices = 0;
    this._lastLand = -1;
    this._noise = null;
    this._ir = null;
    /* позиция секвенсора: шаг петли + время следующей ноты по часам AudioContext */
    this._step = 0;
    this._nextStepTime = 0;
  }

  static get supported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  /** True while a sound can actually be scheduled. */
  get ready() {
    return this.unlocked && !this.muted && !!this.ctx && this.ctx.state !== 'closed';
  }

  /* ------------------------------ lifecycle ------------------------------- */
  /** First user gesture: build the graph, wake the context, fade the bed in. */
  unlock() {
    if (this.unlocked) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch (err) {
      this.ctx = new AC();
    }
    this._build();
    this.unlocked = true;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this._startMusic();
    this._glide(this.bus.master.gain, this.muted ? 0 : this.level, 0.7);
    return true;
  }

  /** Master mute — the flag is honoured even before the AudioContext exists. */
  setMuted(on, fade = 0.22) {
    this.muted = !!on;
    if (!this.unlocked || !this.bus) return this.muted;
    this._glide(this.bus.master.gain, this.muted ? 0 : this.level, fade);
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  /** Backgrounded tab: freeze the clock instead of letting the mix drift. */
  onVisibility(hidden) {
    if (!this.unlocked || !this.ctx || this.ctx.state === 'closed') return;
    if (hidden) {
      if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      /* после сна часы стоят на месте, но секвенсор всё равно «приземляем» к
         текущему времени — иначе первый кадр после возврата выстреливает
         пучком отложенных нот. */
      this._nextStepTime = this.ctx.currentTime + 0.08;
    }
  }

  /* ------------------------------- plumbing ------------------------------- */
  /** Click-free parameter move: cancel, latch, then ramp over `dur` seconds. */
  _glide(param, value, dur = 0.25) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + Math.max(dur, 0.01));
    return param;
  }

  /** Percussive AD envelope; exponential tails keep it organic and silent. */
  _envelope(at, peak, attack = 0.006, hold = 0.01, release = 0.2) {
    const g = this.ctx.createGain();
    const top = Math.max(peak, 0.0002);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(top, at + Math.max(attack, 0.001));
    g.gain.setValueAtTime(top, at + attack + Math.max(hold, 0));
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + Math.max(release, 0.01));
    return g;
  }
  /* --------------------------- master + FX graph --------------------------- */
  _build() {
    const ctx = this.ctx;

    const master = ctx.createGain();
    master.gain.value = 0;                        /* fades in on unlock */
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 22;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    /* send A · feedback delay (the arps and the big-win chord live in it) */
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.29;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.44;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass';
    dampen.frequency.value = 2400;
    delay.connect(dampen).connect(feedback).connect(delay);
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.55;
    delay.connect(delayWet).connect(master);

    /* send B · hall built from decaying noise: no .wav impulse anywhere */
    const verb = ctx.createConvolver();
    verb.buffer = this._impulse(2.8, 3.1);
    const verbWet = ctx.createGain();
    verbWet.gain.value = 0.42;
    verb.connect(verbWet).connect(master);

    const delayIn = ctx.createGain();
    delayIn.gain.value = 1;
    delayIn.connect(delay);
    const verbIn = ctx.createGain();
    verbIn.gain.value = 1;
    verbIn.connect(verb);

    this.bus = { master, limiter, sfx, delay, feedback, verb, delayIn, verbIn };
  }

  /** Procedural IR: tight early reflections, long dark decay, stereo width. */
  _impulse(dur = 2.8, decay = 3.1) {
    if (this._ir) return this._ir;
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.max(1024, Math.floor(rate * dur));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      const pre = Math.floor(rate * (ch ? 0.006 : 0));
      for (let i = 0; i < len; i++) {
        const t = i / len;
        let v = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - Math.pow(t, 6));
        if (i < pre) v = 0;
        else if (i < pre + rate * 0.014) v *= 0.32;   /* early reflections stay dry */
        data[i] = v;
      }
    }
    this._ir = buf;
    return buf;
  }

  /** One second of white noise, generated once and reused by every burst. */
  _noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const len = Math.max(1024, Math.floor(ctx.sampleRate));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  /** Looped noise voice reading a random slice of the shared buffer. */
  _noiseVoice(at, dur, rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    src.playbackRate.value = rate;
    src.start(at, Math.random() * 0.7);
    src.stop(at + dur);
    return src;
  }

  /** Dry/wet wiring of one voice: sfx bus + the two FX sends. */
  _route(node, dry = 1, dly = 0, verb = 0) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (dry >= 1) node.connect(bus.sfx);
    else if (dry > 0) {
      const g = ctx.createGain();
      g.gain.value = dry;
      node.connect(g).connect(bus.sfx);
    }
    if (dly > 0) {
      const g = ctx.createGain();
      g.gain.value = dly;
      node.connect(g).connect(bus.delayIn);
    }
    if (verb > 0) {
      const g = ctx.createGain();
      g.gain.value = verb;
      node.connect(g).connect(bus.verbIn);
    }
    return node;
  }
  /* ------------------------ the upbeat arcade bed ------------------------ */
  /**
   * Никакого мрачного гудящего фона (27.5 / 55 Гц дрон удалён вместе с
   * DRONE_ROOT): шина фоновой музыки — это один светлый lowpass + общий
   * фейдер, а ноты (пульсирующий бас, мягкий кик, лёгкий хэт и светлые
   * арпеджио-щипки) пишет секвенсор updateMusic() прямо из рендер-цикла.
   * Постоянно работающих осцилляторов в миксе ноль: каждый голос — пара
   * узлов на пару десятых долей секунды, умирающая сама.
   */
  _startMusic() {
    if (this.music || !this.bus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0.0001;

    /* Светлый тон: срез вчетверо выше прежнего гула, арпеджио остаются
       стеклянными, а не «туманными»; Q почти нулевой — никакой окраски. */
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    tone.Q.value = 0.55;
    tone.connect(out);

    this._route(out, 1, 0.18, 0.2);
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(CyberAudioEngine.MUSIC_LEVEL, now + 2.4);

    this.music = { out, tone };
    this._step = 0;
    this._nextStepTime = now + 0.15;
  }

  /** MIDI → Гц: единственный источник высоты для всего секвенсора. */
  static hz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** Пульсирующий бас: треугольник в основной позиции + синус на октаву выше
      для читаемости на динамиках телефона. Инфразвукового суб-слоя нет
      намеренно: 30 Гц на мобильном спикере только жрёт громкость и возвращает
      тот самый гудящий низ, от которого мы ушли. */
  _bassNote(at, midi, peak = 0.4, dur = 0.14) {
    const ctx = this.ctx;
    const f = CyberAudioEngine.hz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const top = ctx.createOscillator();
    top.type = 'sine';
    top.frequency.value = f * 2;
    const topGain = ctx.createGain();
    topGain.gain.value = 0.4;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    osc.connect(mix);
    top.connect(topGain).connect(mix);
    const g = this._envelope(at, peak, 0.01, 0.02, dur);
    mix.connect(g).connect(this.music.tone);
    osc.start(at);
    osc.stop(at + dur + 0.1);
    top.start(at);
    top.stop(at + dur + 0.1);
  }

  /** Светлое арпеджио-щипание: быстрая атака, звонкая октавная верхушка. */
  _pluck(at, midi, peak = 0.17, dur = 0.3) {
    const ctx = this.ctx;
    const f = CyberAudioEngine.hz(midi);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const shine = ctx.createOscillator();
    shine.type = 'sine';
    shine.frequency.value = f * 2.004;
    const shineGain = ctx.createGain();
    shineGain.gain.value = 0.38;
    const mix = ctx.createGain();
    mix.gain.value = 0.55;
    osc.connect(mix);
    shine.connect(shineGain).connect(mix);
    const g = this._envelope(at, peak, 0.004, 0.008, dur);
    mix.connect(g).connect(this.music.tone);
    osc.start(at);
    osc.stop(at + dur + 0.12);
    shine.start(at);
    shine.stop(at + dur + 0.12);
  }

  /** Мягкий «кач» на сильную долю: короткий синус 110 → 55 Гц, без гула. */
  _kick(at, peak = 0.3) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(55, at + 0.09);
    const g = this._envelope(at, peak, 0.004, 0.008, 0.12);
    osc.connect(g).connect(this.music.out);
    osc.start(at);
    osc.stop(at + 0.22);
  }

  /** Перышко хэта на слабую долю: короткий шумовой всплеск выше 7 кГц. */
  _hat(at, peak = 0.04) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = this._envelope(at, peak, 0.001, 0, 0.03);
    this._noiseVoice(at, 0.05, 1.8).connect(hp).connect(g);
    g.connect(this.music.out);
  }

  /**
   * Дирижёр петли. Вызывается каждый кадр из CyberpunkScene._update: пока
   * контекст жив, расписываем ноты на LOOKAHEAD вперёд — этого хватает с
   * большим запасом при 60 FPS, и при этом в файле по-прежнему нет ни одного
   * setInterval / setTimeout-таймера, который устроил бы гонку кадров.
   */
  updateMusic() {
    if (!this.ready || !this.music) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    /* после простоя (свёрнутая вкладка, заблокированный экран) не даём
       секвенсору вывалить залп «догоняющих» нот */
    if (!this._nextStepTime || this._nextStepTime < now - 0.35) this._nextStepTime = now + 0.05;
    const horizon = now + CyberAudioEngine.LOOKAHEAD;
    let budget = 12;                                  /* потолок шагов за один кадр */
    while (this._nextStepTime < horizon && budget-- > 0) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._step = (this._step + 1) % (CyberAudioEngine.BARS * CyberAudioEngine.STEPS_PER_BAR);
      this._nextStepTime += CyberAudioEngine.STEP;
    }
  }

  /**
   * Один шаг сетки 122 BPM: бас бьёт по всем восьмым, кик — только 1-я и 3-я
   * доля, хэт — по слабым восьмым, арпеджио идёт по рисунку MELODY (ступени
   * мажорной пентатоники текущего такта C · G · A · F). OVERDRIVE поднимает
   * арпеджио на октаву и добавляет второй голос на слабой доле — бонус
   * звучит ярче, темп остаётся прежним.
   */
  _scheduleStep(step, at) {
    const E = CyberAudioEngine;
    const perBar = E.STEPS_PER_BAR;
    const bar = ((step / perBar) | 0) % E.CHORDS.length;
    const inBar = step % perBar;
    const rootSemi = E.CHORDS[bar];
    const hot = this.overdrive;
    const swing = inBar % 2 === 1 ? 0.012 : 0;        /* лёгкий свинг слабых долей */

    if (inBar % 2 === 0) {
      const strong = inBar === 0 || inBar === 8;
      const walk = inBar === 14 ? 7 : 0;              /* подводящий ход к следующему такту */
      this._bassNote(at, 36 + rootSemi + walk, strong ? 0.46 : 0.3, strong ? 0.2 : 0.12);
    }
    if (inBar === 0 || inBar === 8) this._kick(at, 0.28);
    if (inBar % 2 === 1) this._hat(at + swing, inBar % 4 === 3 ? 0.05 : 0.028);

    const deg = E.MELODY[inBar];
    if (deg != null) {
      const octave = inBar >= 8 ? 12 : 0;
      this._pluck(at + swing, 60 + rootSemi + E.PENTA[deg % E.PENTA.length] + octave + (hot ? 12 : 0),
        hot ? 0.2 : 0.16);
    }
    if (hot && inBar % 2 === 1) {
      const extra = ((deg == null ? 0 : deg) + 2) % E.PENTA.length;
      this._pluck(at + swing, 72 + rootSemi + E.PENTA[extra], 0.11, 0.22);
    }
  }

  /**
   * OVERDRIVE / фриспины: аркадная петля раскрывается вместе с красно-золотой
   * картинкой — фильтр фоновой шины светлеет, громкость чуть подрастает, а
   * секвенсор добавляет октаву и второй арпеджио-голос. Всё плавно за ~1 с и
   * так же плавно возвращается, когда бонус закончился.
   */
  setOverdrive(on) {
    this.overdrive = !!on;
    if (!this.music || !this.ctx || this.ctx.state === 'closed') return this.overdrive;
    const d = this.overdrive;
    const base = CyberAudioEngine.MUSIC_LEVEL;
    this._glide(this.music.tone.frequency, d ? 6800 : 4200, 0.9);
    this._glide(this.music.tone.Q, d ? 0.9 : 0.55, 0.9);
    this._glide(this.music.out.gain, d ? base * 1.35 : base, 1.0);
    return this.overdrive;
  }
  /* ------------------------------- the spin ------------------------------- */
  /**
   * КРУТИТЬ: яркий восходящий свист 480 Гц → 7 кГц + мажорное трезвучие
   * долями вверх (C - E - G - C) — звонкий жест «поехали!» вместо прежнего
   * низкого гула корпуса. Лёгкий пружинистый подскок держит ритм, не низ.
   */
  spin(free = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const lift = free ? 1.19 : 1;

    /* пружинистый подскок — короткий и упругий, а не гудящий */
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(330 * lift, now);
    body.frequency.exponentialRampToValueAtTime(120, now + 0.16);
    const bg = this._envelope(now, 0.42 * lift, 0.004, 0.012, 0.2);
    body.connect(bg);
    this._route(bg, 1, 0.05, 0.04);
    body.start(now);
    body.stop(now + 0.3);

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2.4;
    band.frequency.setValueAtTime(480, now);
    band.frequency.exponentialRampToValueAtTime(7000, now + 0.42);
    const ng = this._envelope(now, 0.24 * lift, 0.03, 0.1, 0.3);
    this._noiseVoice(now, 0.52).connect(band).connect(ng);
    this._route(ng, 1, 0.16, 0.1);

    /* мажорное трезвучие долями вверх — тот самый звонкий аркадный жест */
    const triad = [0, 4, 7, 12];
    for (let i = 0; i < triad.length; i++) {
      const at = now + 0.02 + i * 0.052;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 523.25 * lift * Math.pow(2, triad[i] / 12);
      const g = this._envelope(at, 0.13 - i * 0.012, 0.003, 0.008, 0.18);
      o.connect(g);
      this._route(g, 1, 0.26, 0.2);
      o.start(at);
      o.stop(at + 0.26);
    }
  }

  /* ---------------------------- symbol landings ---------------------------- */
  /**
   * Glass-metal touchdown ping. 36 symbols hit the field inside half a second,
   * so the engine is hard-capped: at most LAND_VOICES rings at a time and never
   * two closer than LAND_GAP — the rain reads as texture instead of volume.
   * Pitch walks the MAJOR pentatonic per cell with ±1.5 % random detune, the
   * FM partial sits a clean octave+fifth above the carrier, so every landing
   * rings bright and sweet instead of dark and clangy.
   */
  land(cell = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (this.landVoices >= CyberAudioEngine.LAND_VOICES) return;
    if (now - this._lastLand < CyberAudioEngine.LAND_GAP) return;
    this._lastLand = now;

    const penta = CyberAudioEngine.PENTA;
    const step = penta[Math.abs(cell | 0) % penta.length] +
      12 * ((((cell | 0) / penta.length) | 0) % 2);
    const f = 783.99 * Math.pow(2, (step - 12) / 12) * (1 + (Math.random() * 0.03 - 0.015));
    const at = now + Math.random() * 0.014;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = f;
    /* FM off a 3.x partial buys the glass shimmer no filter can fake */
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f * 3.0;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 1.7, at);
    modGain.gain.exponentialRampToValueAtTime(f * 0.04, at + 0.09);
    mod.connect(modGain).connect(carrier.frequency);

    const g = this._envelope(at, 0.16, 0.002, 0.004, 0.13);
    carrier.connect(g);
    this._route(g, 1, 0.08, 0.24);

    const edge = ctx.createBiquadFilter();
    edge.type = 'highpass';
    edge.frequency.value = 5200;
    const eg = this._envelope(at, 0.06, 0.001, 0, 0.02);
    this._noiseVoice(at, 0.03, 1.6).connect(edge).connect(eg);
    this._route(eg, 1, 0, 0.1);

    this.landVoices++;
    carrier.onended = () => { this.landVoices = Math.max(0, this.landVoices - 1); };
    carrier.start(at);
    carrier.stop(at + 0.17);
    mod.start(at);
    mod.stop(at + 0.17);
  }
  /* --------------------------- cascade arpeggiator --------------------------- */
  /**
   * Tumble synth: the chord (major add9) is transposed one semitone up per
   * ladder rung, so ×1 → ×2 → ×4 → ×8 → ×16 → ×32 walks the key exactly like
   * the multiplier does. Notes fan out as an arp, wet into the feedback delay,
   * and the filter stays bright (2.2 kHz → 900 Hz) so a win never sounds sad.
   */
  cascade(rung = 0, voices = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const semi = clamp(rung | 0, 0, 8);
    const root = 261.63 * Math.pow(2, semi / 12);          /* C4 и выше */
    const arp = CyberAudioEngine.ARP;
    const spread = voices >= 3 ? 0.052 : 0.078;
    const peak = 0.16 * (1 - semi * 0.05);                 /* hot rungs stay thin */

    for (let i = 0; i < arp.length; i++) {
      const at = now + i * spread;
      const f = root * Math.pow(2, arp[i] / 12);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (i - 2) * 4;
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = f * 0.5;
      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200 + semi * 320, at);
      lp.frequency.exponentialRampToValueAtTime(900, at + 0.5);
      const g = this._envelope(at, peak, 0.01, 0.03, 0.46);
      osc.connect(mix);
      sub.connect(mix);
      mix.connect(lp).connect(g);
      this._route(g, 1, 0.34, 0.4);
      osc.start(at);
      osc.stop(at + 0.58);
      sub.start(at);
      sub.stop(at + 0.58);
    }
    if (semi >= 2) {
      const at = now + arp.length * spread;
      const bell = ctx.createOscillator();
      bell.type = 'triangle';
      bell.frequency.value = root * 4;
      const g = this._envelope(at, peak * 1.05, 0.004, 0.01, 0.5);
      bell.connect(g);
      this._route(g, 1, 0.4, 0.6);
      bell.start(at);
      bell.stop(at + 0.62);
    }
  }

  /** Cluster detonation: pitch-dropping sub + gritty square + noise crack. */
  explode(size = 6, mult = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const amp = clamp(0.2 + size * 0.018 + (mult >= 4 ? 0.1 : 0), 0.12, 0.5);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(184, now);
    sub.frequency.exponentialRampToValueAtTime(44, now + 0.3);
    const sg = this._envelope(now, amp, 0.004, 0.02, 0.32);
    sub.connect(sg);
    this._route(sg, 1, 0.1, 0.08);
    sub.start(now);
    sub.stop(now + 0.44);

    const grit = ctx.createOscillator();
    grit.type = 'square';
    grit.frequency.setValueAtTime(148, now);
    grit.frequency.exponentialRampToValueAtTime(62, now + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const gg = this._envelope(now, amp * 0.28, 0.002, 0.005, 0.16);
    grit.connect(lp).connect(gg);
    this._route(gg, 1, 0.06, 0.06);
    grit.start(now);
    grit.stop(now + 0.24);

    const crackBp = ctx.createBiquadFilter();
    crackBp.type = 'bandpass';
    crackBp.Q.value = 1.2;
    crackBp.frequency.setValueAtTime(3800, now);
    crackBp.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
    const cg = this._envelope(now, amp * 0.5, 0.002, 0.005, 0.16);
    this._noiseVoice(now, 0.22).connect(crackBp).connect(cg);
    this._route(cg, 1, 0.12, 0.3);

    /* звонкий мажорный искристый «дзынь» поверх взрыва: квинта + большая
       терция — взрыв кластера звучит как маленький праздник, а не как удар */
    const sparkle = [7, 4, 12];
    for (let i = 0; i < sparkle.length; i++) {
      const at = now + 0.01 + i * 0.028;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1046.5 * Math.pow(2, sparkle[i] / 12);
      const g = this._envelope(at, Math.min(0.14, amp * 0.3), 0.002, 0.006, 0.14);
      o.connect(g);
      this._route(g, 1, 0.3, 0.4);
      o.start(at);
      o.stop(at + 0.22);
    }
  }
  /** 4+ SCATTER: rising alert sweep; the bed itself opens in setOverdrive(). */
  freeSpins(count = 4) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const steps = clamp(count | 0, 4, 8);
    /* ступени мажорной пентатоники вверх — как набор монеток в аркадах */
    const penta = CyberAudioEngine.PENTA;
    for (let i = 0; i < steps; i++) {
      const at = now + i * 0.085;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const degree = penta[i % penta.length] + 12 * (((i / penta.length) | 0) + (i > 3 ? 1 : 0));
      o.frequency.value = 523.25 * Math.pow(2, degree / 12);
      const g = this._envelope(at, 0.15, 0.004, 0.01, 0.22);
      o.connect(g);
      this._route(g, 1, 0.35, 0.5);
      o.start(at);
      o.stop(at + 0.3);
    }
  }

  /** BIG / MEGA WIN: detuned saw stack + MAJOR chord + rising sub, hall-soaked. */
  bigWin(mega = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = 130.81;                                     /* C3 — мажорная база */
    /* C - E - G - C - E - G: чистый мажор, никакой минорной грусти */
    const stack = mega ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12, 16, 24];
    const tail = mega ? 3.4 : 2.6;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(mega ? 8200 : 5600, now + 0.7);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.4, now + 0.09);
    out.gain.exponentialRampToValueAtTime(0.0001, now + tail);
    lp.connect(out);
    this._route(out, 1, 0.5, 0.75);

    for (let i = 0; i < stack.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = root * Math.pow(2, stack[i] / 12);
      osc.detune.value = (i % 2 ? 9 : -9) + (Math.random() * 6 - 3);
      const g = ctx.createGain();
      g.gain.value = 0.16 / (1 + i * 0.35);
      osc.connect(g).connect(lp);
      osc.start(now + i * 0.02);
      osc.stop(now + tail + 0.2);
    }

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(root * 0.5, now);
    sub.frequency.exponentialRampToValueAtTime(root * 1.5, now + 2.2);
    const sg = this._envelope(now, 0.42, 0.05, 0.4, 2.1);
    sub.connect(sg);
    this._route(sg, 1, 0.15, 0.25);
    sub.start(now);
    sub.stop(now + 2.8);

    const riserBp = ctx.createBiquadFilter();
    riserBp.type = 'bandpass';
    riserBp.Q.value = 1.6;
    riserBp.frequency.setValueAtTime(620, now);
    riserBp.frequency.exponentialRampToValueAtTime(8400, now + 1);
    const rg = this._envelope(now, 0.13, 0.5, 0.05, 0.5);
    this._noiseVoice(now, 1.15).connect(riserBp).connect(rg);
    this._route(rg, 1, 0.3, 0.5);

    const at = now + 1.05;
    const bell = ctx.createOscillator();
    bell.type = 'triangle';
    bell.frequency.value = root * (mega ? 8 : 6);
    const bg = this._envelope(at, 0.28, 0.004, 0.02, 1.4);
    bell.connect(bg);
    this._route(bg, 1, 0.5, 0.9);
    bell.start(at);
    bell.stop(at + 1.6);
  }

  /** Short UI blip for the mute / exit controls: bright, ringing, upbeat. */
  tick(up = true) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    /* мажорная квкта вверх / квинта вниз — короткий «дзынь», а не писка */
    o.frequency.setValueAtTime(up ? 784 : 1046.5, now);
    o.frequency.exponentialRampToValueAtTime(up ? 1568 : 659.25, now + 0.07);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    const g = this._envelope(now, 0.1, 0.002, 0.006, 0.09);
    o.connect(hp).connect(g);
    this._route(g, 1, 0.12, 0.16);
    o.start(now);
    o.stop(now + 0.16);
  }
}

function hasWebGL2() {
  try {
    const probe = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && probe.getContext('webgl2'));
  } catch (err) {
    return false;
  }
}

(function boot() {
  const hud = new Hud();
  /* ---------------- step 5 · session handshake ----------------------------
     the backend opens the WebApp as …/index.html?balance=…&session_id=…;
     with no query string at all the game runs on an offline sandbox wallet */
  const params = new URLSearchParams(location.search);
  const seed = Number.parseFloat(params.get('balance'));
  const initialBalance = Number.isFinite(seed) && seed >= 0 ? seed : 10000;
  const sessionId = String(params.get('session_id') || params.get('session') || 'demo_local').slice(0, 128);
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const inTelegram = !!(tg && typeof tg.sendData === 'function');
  const haptic = (style = 'light') => {
    const hf = tg && tg.HapticFeedback;
    if (!hf || typeof hf.impactOccurred !== 'function') return;
    try { hf.impactOccurred(style); } catch (err) { /* haptics are optional */ }
  };
  if (!hasWebGL2()) {
    hud.bootError('WEBGL2 НЕДОСТУПЕН · включите аппаратное ускорение или обновите браузер');
    return;
  }

  try {
    const app = new CyberpunkScene(document.getElementById('gl'), hud);
    /* the game lives here: logical 6×6 grid + animations + wallet */
    const audio = new CyberAudioEngine({ level: 0.78 });
    const engine = new SlotEngine(app, hud, {
      balance: initialBalance,
      sessionId,
      bets: BETS,
      betIndex: 7,
      audio,
      onBigWin: (amount, mega) => haptic(mega ? 'rigid' : 'medium')
    });
    app.audio = audio;
    app.engine = engine;
    /* step 4 sandbox: NEON.celebrate(18) pops the BIG WIN overlay on demand,
       NEON.vfx.reset() clears every spark / flash pool mid-session */
    const celebrate = (turns = 18, bet = engine.bet) => {
      const amount = turns * bet;
      const mega = turns >= WIN_MEGA;
      app.vfx.showOverlay({ amount, mult: engine.maxMult, mega });
      if (audio) audio.bigWin(mega);
      app.vfx.shake(mega ? 1.7 : 1.15, 0.8);
      return amount;
    };
    window.NEON = {
      THREE, app, hud, CFG, TIERS, SymbolFactory, SYMBOL_TYPES, SlotEngine,
      engine, vfx: app.vfx, audio, CyberAudioEngine, celebrate,
      session: { id: sessionId, initialBalance, inTelegram }
    };

    /* one call = full spin: stake → deal → BFS clusters → tumbles → payout */
    const spin = () => {
      if (engine.spin()) haptic('light');
    };

    hud.el.spin.addEventListener('click', spin);
    hud.el.betUp.addEventListener('click', () => engine.setBetIndex(engine.betIndex + 1));
    hud.el.betDn.addEventListener('click', () => engine.setBetIndex(engine.betIndex - 1));
    /* мобильный лог: на телефоне панель телеметрии свёрнута, чтобы не закрывать
       3D-фрукты, а кнопка «ЛОГ» разворачивает её поверх поля одним касанием */
    if (hud.el.railBtn) hud.el.railBtn.addEventListener('click', () => hud.toggleRail());

    /* ---------------- step 5 · procedural audio unlock + controls ----------
       browsers refuse to start an AudioContext before a gesture, so the first
       pointer / key event arms the arcade groove and both listeners retire. */
    const unlockAudio = () => {
      if (!audio.unlock()) return;
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      hud.log('звук · <span>web-audio</span> разблокирован · аркадный ритм ' + CyberAudioEngine.BPM + ' BPM нарастает');
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    document.addEventListener('visibilitychange', () => audio.onVisibility(document.hidden));

    const applyMute = (on) => {
      const muted = audio.setMuted(on);
      hud.setMuted(muted);
      if (!muted) audio.tick(true);
      hud.log(muted
        ? 'звук <span>выключен</span> · кнопка динамика или клавиша M включит обратно'
        : 'звук <span>включён</span> · процедурный аркадный микс ' + CyberAudioEngine.BPM + ' BPM');
      haptic('light');
    };
    if (hud.el.mute) hud.el.mute.addEventListener('click', () => applyMute(!audio.muted));

    /* EXIT: hand the settled wallet back to Telegram via sendData, then close.
       Outside Telegram the same summary lands in the rail log instead. */
    const exitGame = () => {
      const profit = engine.profit;
      /* Ключей с профитом два намеренно: "session_profit" ждёт бэкенд шага 5,
         а "profit" уже сидит в контракте старых сборок — значение общее и
         округленное до копейки, чтобы в JSON не улетел binary-float хвост
         вида 1000.0000000000002 (движок считает в float-арифметике). */
      const settled = Math.round(profit * 100) / 100;
      const payload = JSON.stringify({
        session_id: engine.sessionId,
        final_balance: Math.round(engine.balance * 100) / 100,
        session_profit: settled,
        profit: settled
      });
      haptic('heavy');
      audio.setMuted(true);
      hud.setMuted(true);
      hud.setState('СЕССИЯ ЗАКРЫТА');
      /* Optional chaining прямо по требованиям: Telegram может и не оказаться
         на месте (вкладка браузера, старый WebView, блокировка скрипта), но
         баланс в таком случае всё равно уходит в лог. */
      const webApp = window.Telegram?.WebApp;
      if (inTelegram && webApp) {
        try {
          /* sendData сам закрывает окно сразу после отправки данных боту —
             поэтому tg.close() здесь НЕ вызывается в ту же миллисекунду, а
             только страхует на случай, если WebApp почему-то не закрылся. */
          webApp.sendData(payload);
          hud.log('telegram · <span>sendData</span> отправлен · ' + payload);
          setTimeout(() => window.Telegram?.WebApp?.close(), 250);
        } catch (err) {
          console.warn('[NEON] sendData failed', err);
          hud.log('telegram · <span>sendData не прошёл</span> · ' + payload);
          setTimeout(() => window.Telegram?.WebApp?.close(), 250);
        }
      } else {
        audio.tick(false);
        hud.log('<span>сессия ' + engine.sessionId + '</span> закрыта · баланс <span>' +
          hud.fmt(engine.balance) + '</span> · профит <span>' +
          (profit >= 0 ? '+' : '−') + hud.fmt(Math.abs(profit)) + '</span> от стартового <span>' +
          hud.fmt(engine.initialBalance) + '</span>');
      }
    };
    if (hud.el.exit) hud.el.exit.addEventListener('click', exitGame);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        /* a focused SPIN button already fires click on Space / Enter */
        if (document.activeElement === hud.el.spin) return;
        e.preventDefault();
        spin();
      } else if (e.code === 'KeyM') {
        applyMute(!audio.muted);
      } else if (e.code === 'KeyQ' || e.code === 'Escape') {
        exitGame();
      }
    });

    engine.sync();
    hud.setCharge(0);
    hud.setMuted(audio.muted);
    hud.setState('ОЖИДАНИЕ');
    hud.log('three.js r' + THREE.REVISION + ' · связь установлена через jsdelivr');
    hud.log('рендер <span>напрямую</span> · без EffectComposer / UnrealBloomPass · pixelRatio ≤ ' + CFG.dpr +
      ' · мягкое свечение дают emissive-материалы символов');
    hud.log('фон <span>чистый</span> · туннель из колец, летящие частицы, пыль, орбы и конус проектора удалены · только тёмно-фиолетово-синий градиент');
    hud.log('фабрика символов · ' + app.symbolFactory.typeCount + ' объёмных 3D-архетипов · лак metalness 0.2 + хромированные цифры / мягкое свечение');
    const mix = app.symbolCounts.map((c, i) => c + '× ' + SYMBOL_TYPES[i].label).join(' · ');
    hud.log('поле 6×6 готово · ' + app.symbols.length + ' символов · шаг ' + CFG.grid.step + ' · ' + mix);
    /* Мобильный профиль: лёгкий тир + dpr-потолок + авто-рамка камеры, которая
       гарантирует всю ширину поля 9.2 юнита в кадре даже на 9:16 / 9:20. */
    hud.log((app.mobileProfile
      ? 'телефон · тир <span>' + app.tierName + '</span> · pixelRatio ≤ ' + app.pixelCap
      : 'десктоп · тир <span>' + app.tierName + '</span> · pixelRatio ≤ ' + app.pixelCap) +
      ' · авто-камера: поле ' + CFG.view.fitWidth + ' юнитов влезает в 9:16 / 9:20');
    hud.log('кластерный движок · <span>BFS 4+</span> · лестница ×1→×32 · ' + FS_SCATTERS + '+ ' +
      SYMBOL_TYPES[SCATTER].label.toLowerCase() + ' = ' + FS_AWARD + ' ' + pluralRu(FS_AWARD, 'фриспин', 'фриспина', 'фриспинов'));
    hud.log('запуски · <span>только вручную</span> — каждая раздача, даже бесплатная, ждёт нажатия КРУТИТЬ или ПРОБЕЛ');
    hud.log('vfx-менеджер · <span>пулы инстансов</span> ' + CFG.vfx.shardCap + ' искр / ' + CFG.vfx.flashCap + ' вспышек · ' + CFG.vfx.shardsPerCell[0] + '–' + CFG.vfx.shardsPerCell[2] + ' искр на ячейку · тряска · без орбов и дождя из сфер');
    hud.log('звук · <span>CyberAudioEngine</span> · весёлый аркадный ритм ' + CyberAudioEngine.BPM + ' BPM в мажорной пентатонике: пульсирующий бас + светлые арпеджио · ни одного сэмпла');
    hud.log('telegram-сессия · <span>' + sessionId + '</span> · стартовый капитал <span>' + hud.fmt(initialBalance) +
      '</span> · ' + (inTelegram ? 'WebApp <span>sendData + close</span> готов' : 'браузерная песочница · ВЫХОД пишет итог в лог'));

    /* Telegram WebApp chrome: full screen, dark header, no page gestures.
       Every call is feature-detected, so a plain browser tab ignores them. */
    if (tg && typeof tg.ready === 'function') {
      try {
        tg.ready();
        if (typeof tg.expand === 'function') tg.expand();
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#0b0722');
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#0b0722');
        if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
        /* expand() приходит не в этом же кадре: через 320 мс WebView уже в
           полный экран, поэтому пересобираем кадр камеры и размер буфера */
        setTimeout(() => app.refit(), 320);
      } catch (err) { console.warn('[NEON] telegram chrome skipped', err); }
    }

    app.start();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__NEON_BOOTED = true;
      clearTimeout(window.__NEON_WATCHDOG);
      hud.hideBoot();
    }));
  } catch (err) {
    console.error('[NEON] boot failure', err);
    hud.bootError('ОШИБКА ЗАПУСКА · ' + (err && err.message ? err.message : String(err)));
  }
})();
