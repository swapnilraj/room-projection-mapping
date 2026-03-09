'use strict';

// ═══════════════════════════════════════════════════════════════════
//  APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════

const WARP_GRID = 14;
const MAX_WORK_W = 1024;
const PARTICLE_POOL = 120;

const state = {
  baseImg: null,
  workW: 0,
  workH: 0,

  baseCanvas: null,
  reflectanceCanvas: null,
  scatterCanvas: null,
  projCanvas: null,
  coloredCanvas: null,
  bloomCanvas: null,
  filteredCanvas: null,
  warpedCanvas: null,
  edgeMap: null,
  noiseCanvas: null,

  mode: 'physical',
  compareMode: false,
  playing: true,
  speed: 1,

  env: {
    ambient: 0.15,
    brightness: 0.85,
    blackLevel: 0.0,
    lensBloom: 0.05,
    spectralBleed: 0.70,
    surfaceGamma: 0.50,
    surfaceFloor: 0.03,
    scatter: 0.10,
    projColor: [255, 255, 255],
    temp: 'neutral',
    material: 'matte',
  },

  warp: {
    enabled: false,
    corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
    dragging: -1,
  },

  showGrid: false,
  showEdgeOverlay: false,
  onionSkin: 0,

  effects: [],
  time: 0,
  lastTs: 0,
  fps: 0,
  _fpsFrames: 0,
  _fpsLast: 0,
};

// ═══════════════════════════════════════════════════════════════════
//  MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════

function solveLinear8(A, b) {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxR = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxR][col])) maxR = r;
    }
    [M[col], M[maxR]] = [M[maxR], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

function computeHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i], [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }
  const h = solveLinear8(A, b);
  if (!h) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function projectPoint(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

function affineFromTriangles(s0, s1, s2, d0, d1, d2) {
  const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (Math.abs(det) < 1e-10) return null;
  const id = 1 / det;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) * id;
  const b = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) * id;
  const c = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) * id;
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) * id;
  const tx = d0[0] - a * s0[0] - b * s0[1];
  const ty = d0[1] - c * s0[0] - d * s0[1];
  return [a, c, b, d, tx, ty];
}

// ═══════════════════════════════════════════════════════════════════
//  COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max > 0 ? d / max : 0;
  return [h, s, max];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ═══════════════════════════════════════════════════════════════════
//  COLOR WHEEL
// ═══════════════════════════════════════════════════════════════════

const wheel = {
  canvas: null,
  ctx: null,
  cx: 90, cy: 90,
  outerR: 88, innerR: 68,
  sqHalf: 46,
  hsv: [0, 0, 1],
  dragging: 'none',
};

function drawWheel() {
  const { ctx, cx, cy, outerR, innerR, sqHalf } = wheel;
  const w = wheel.canvas.width, h = wheel.canvas.height;
  ctx.clearRect(0, 0, w, h);

  for (let a = 0; a < 360; a++) {
    const rad0 = (a - 0.7) * Math.PI / 180;
    const rad1 = (a + 0.7) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, rad0, rad1);
    ctx.lineWidth = outerR - innerR;
    ctx.strokeStyle = `hsl(${a},100%,50%)`;
    ctx.stroke();
  }

  const hue = wheel.hsv[0];
  const pureColor = `hsl(${hue},100%,50%)`;
  const sqX = cx - sqHalf, sqY = cy - sqHalf;
  const sqSize = sqHalf * 2;

  ctx.fillStyle = '#fff';
  ctx.fillRect(sqX, sqY, sqSize, sqSize);

  const gradH = ctx.createLinearGradient(sqX, sqY, sqX + sqSize, sqY);
  gradH.addColorStop(0, 'rgba(255,255,255,0)');
  gradH.addColorStop(1, pureColor);
  ctx.fillStyle = gradH;
  ctx.fillRect(sqX, sqY, sqSize, sqSize);

  const gradV = ctx.createLinearGradient(sqX, sqY, sqX, sqY + sqSize);
  gradV.addColorStop(0, 'rgba(0,0,0,0)');
  gradV.addColorStop(1, '#000');
  ctx.fillStyle = gradV;
  ctx.fillRect(sqX, sqY, sqSize, sqSize);

  const hueRad = hue * Math.PI / 180;
  const ringMid = (outerR + innerR) / 2;
  const hx = cx + Math.cos(hueRad) * ringMid;
  const hy = cy + Math.sin(hueRad) * ringMid;
  ctx.beginPath();
  ctx.arc(hx, hy, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  const sx = sqX + wheel.hsv[1] * sqSize;
  const sy = sqY + (1 - wheel.hsv[2]) * sqSize;
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function wheelHitTest(x, y) {
  const { cx, cy, outerR, innerR, sqHalf } = wheel;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= innerR && dist <= outerR) return 'ring';
  if (Math.abs(x - cx) <= sqHalf && Math.abs(y - cy) <= sqHalf) return 'square';
  return 'none';
}

function wheelSetFromXY(x, y, zone) {
  const { cx, cy, sqHalf } = wheel;
  if (zone === 'ring') {
    let angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    wheel.hsv[0] = angle;
  } else if (zone === 'square') {
    const sqSize = sqHalf * 2;
    const sqX = cx - sqHalf, sqY = cy - sqHalf;
    wheel.hsv[1] = Math.max(0, Math.min(1, (x - sqX) / sqSize));
    wheel.hsv[2] = Math.max(0, Math.min(1, 1 - (y - sqY) / sqSize));
  }
  applyWheelColor();
  drawWheel();
}

function applyWheelColor() {
  const rgb = hsvToRgb(wheel.hsv[0], wheel.hsv[1], wheel.hsv[2]);
  state.env.projColor = rgb;
  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
  document.getElementById('projColor').value = hex;
  document.getElementById('projColorHex').value = hex;
}

function setWheelFromRgb(r, g, b) {
  wheel.hsv = rgbToHsv(r, g, b);
  drawWheel();
}

function initColorWheel() {
  wheel.canvas = document.getElementById('colorWheel');
  wheel.ctx = wheel.canvas.getContext('2d');

  drawWheel();

  function canvasXY(e) {
    const rect = wheel.canvas.getBoundingClientRect();
    const scaleX = wheel.canvas.width / rect.width;
    const scaleY = wheel.canvas.height / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  wheel.canvas.addEventListener('pointerdown', e => {
    const [x, y] = canvasXY(e);
    const zone = wheelHitTest(x, y);
    if (zone !== 'none') {
      wheel.dragging = zone;
      wheel.canvas.setPointerCapture(e.pointerId);
      wheelSetFromXY(x, y, zone);
    }
  });

  wheel.canvas.addEventListener('pointermove', e => {
    if (wheel.dragging === 'none') return;
    const [x, y] = canvasXY(e);
    wheelSetFromXY(x, y, wheel.dragging);
  });

  wheel.canvas.addEventListener('pointerup', () => { wheel.dragging = 'none'; });
  wheel.canvas.addEventListener('pointercancel', () => { wheel.dragging = 'none'; });

  document.getElementById('projColorHex').addEventListener('change', e => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const rgb = hexToRgb(v);
      state.env.projColor = rgb;
      document.getElementById('projColor').value = v;
      setWheelFromRgb(rgb[0], rgb[1], rgb[2]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
//  BASE IMAGE ANALYSIS
// ═══════════════════════════════════════════════════════════════════

function analyzeBase() {
  if (!state.baseImg) return;
  const { workW: w, workH: h, baseCanvas } = state;
  const ctx = baseCanvas.getContext('2d');
  ctx.drawImage(state.baseImg, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  computeEdgeMap(data, w, h);
  generateNoise(w, h);
  buildReflectanceMap();
}

// Pre-compute a reflectance map from the base image. Raw sRGB pixel values
// underestimate how much light dark printed surfaces actually reflect.
// The gamma power lifts darks (gamma < 1) to model real paper/ink reflectance.
// The floor prevents any channel from being fully black (real surfaces always
// have some minimum reflectance ~3-5%).
function buildReflectanceMap() {
  if (!state.baseImg) return;
  const { workW: w, workH: h } = state;
  const src = state.baseCanvas.getContext('2d').getImageData(0, 0, w, h);
  const dst = state.reflectanceCanvas.getContext('2d').createImageData(w, h);
  const sd = src.data, dd = dst.data;
  const gamma = state.env.surfaceGamma;
  const floor = state.env.surfaceFloor;
  const f255 = floor * 255;
  const scale = 1 - floor;
  for (let i = 0; i < sd.length; i += 4) {
    dd[i]     = Math.min(255, f255 + scale * Math.pow(sd[i] / 255, gamma) * 255);
    dd[i + 1] = Math.min(255, f255 + scale * Math.pow(sd[i + 1] / 255, gamma) * 255);
    dd[i + 2] = Math.min(255, f255 + scale * Math.pow(sd[i + 2] / 255, gamma) * 255);
    dd[i + 3] = 255;
  }
  state.reflectanceCanvas.getContext('2d').putImageData(dst, 0, 0);
}

function computeEdgeMap(data, w, h) {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    luma[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
  }
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -luma[(y - 1) * w + x - 1] + luma[(y - 1) * w + x + 1] +
        -2 * luma[y * w + x - 1] + 2 * luma[y * w + x + 1] +
        -luma[(y + 1) * w + x - 1] + luma[(y + 1) * w + x + 1];
      const gy =
        -luma[(y - 1) * w + x - 1] - 2 * luma[(y - 1) * w + x] - luma[(y - 1) * w + x + 1] +
        luma[(y + 1) * w + x - 1] + 2 * luma[(y + 1) * w + x] + luma[(y + 1) * w + x + 1];
      edge[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 2);
    }
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(edge[i] * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  state.edgeMap = c;
}

function generateNoise(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.random() * 255 | 0;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  state.noiseCanvas = c;
}

// ═══════════════════════════════════════════════════════════════════
//  EFFECTS
// ═══════════════════════════════════════════════════════════════════

class GlowPulse {
  constructor() {
    this.type = 'glowPulse';
    this.label = 'Glow Pulse';
    this.enabled = true;
    this.params = {
      cx: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Center X' },
      cy: { value: 0.45, min: 0, max: 1, step: 0.01, label: 'Center Y' },
      radius: { value: 0.4, min: 0.05, max: 1, step: 0.01, label: 'Radius' },
      speed: { value: 1.2, min: 0.1, max: 5, step: 0.1, label: 'Speed' },
      minAlpha: { value: 0.15, min: 0, max: 1, step: 0.01, label: 'Min' },
      maxAlpha: { value: 0.8, min: 0, max: 1, step: 0.01, label: 'Max' },
      r: { value: 200, min: 0, max: 255, step: 1, label: 'R' },
      g: { value: 220, min: 0, max: 255, step: 1, label: 'G' },
      b: { value: 255, min: 0, max: 255, step: 1, label: 'B' },
    };
  }
  render(ctx, w, h, t) {
    const p = this.params;
    const alpha = p.minAlpha.value +
      (p.maxAlpha.value - p.minAlpha.value) * (0.5 + 0.5 * Math.sin(t * p.speed.value));
    const cx = p.cx.value * w, cy = p.cy.value * h;
    const r = p.radius.value * Math.max(w, h);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${p.r.value},${p.g.value},${p.b.value},${alpha})`);
    grad.addColorStop(0.6, `rgba(${p.r.value},${p.g.value},${p.b.value},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${p.r.value},${p.g.value},${p.b.value},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

class BloomExpansion {
  constructor() {
    this.type = 'bloomExpansion';
    this.label = 'Bloom Expansion';
    this.enabled = true;
    this.params = {
      cx: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Center X' },
      cy: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'Center Y' },
      maxRadius: { value: 0.5, min: 0.1, max: 1.5, step: 0.01, label: 'Max Radius' },
      speed: { value: 0.8, min: 0.1, max: 4, step: 0.1, label: 'Speed' },
      softness: { value: 0.6, min: 0.1, max: 1, step: 0.01, label: 'Softness' },
      r: { value: 255, min: 0, max: 255, step: 1, label: 'R' },
      g: { value: 240, min: 0, max: 255, step: 1, label: 'G' },
      b: { value: 220, min: 0, max: 255, step: 1, label: 'B' },
    };
  }
  render(ctx, w, h, t) {
    const p = this.params;
    const cycle = (t * p.speed.value) % (Math.PI * 2);
    const expand = (1 + Math.sin(cycle - Math.PI / 2)) / 2;
    const cx = p.cx.value * w, cy = p.cy.value * h;
    const maxR = p.maxRadius.value * Math.max(w, h);
    const r = maxR * expand;
    const alpha = (1 - expand) * 0.7;
    if (alpha < 0.01 || r < 1) return;
    const innerStop = Math.max(0, 1 - p.softness.value);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${p.r.value},${p.g.value},${p.b.value},${alpha})`);
    grad.addColorStop(innerStop, `rgba(${p.r.value},${p.g.value},${p.b.value},${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(${p.r.value},${p.g.value},${p.b.value},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

class RisingParticles {
  constructor() {
    this.type = 'risingParticles';
    this.label = 'Rising Particles';
    this.enabled = true;
    this._particles = [];
    this.params = {
      count: { value: 60, min: 10, max: 200, step: 1, label: 'Count' },
      speed: { value: 40, min: 5, max: 150, step: 1, label: 'Speed' },
      size: { value: 3, min: 1, max: 10, step: 0.5, label: 'Size' },
      spread: { value: 0.6, min: 0.1, max: 1, step: 0.01, label: 'Spread' },
      originY: { value: 0.7, min: 0, max: 1, step: 0.01, label: 'Origin Y' },
      r: { value: 220, min: 0, max: 255, step: 1, label: 'R' },
      g: { value: 200, min: 0, max: 255, step: 1, label: 'G' },
      b: { value: 255, min: 0, max: 255, step: 1, label: 'B' },
    };
  }
  _ensure(w, h) {
    const n = this.params.count.value | 0;
    while (this._particles.length < n) {
      this._particles.push(this._spawn(w, h, true));
    }
    this._particles.length = n;
  }
  _spawn(w, h, randomY) {
    const p = this.params;
    const cx = 0.5, sp = p.spread.value / 2;
    return {
      x: (cx - sp + Math.random() * p.spread.value) * w,
      y: randomY ? Math.random() * h : (p.originY.value + Math.random() * (1 - p.originY.value)) * h,
      vx: (Math.random() - 0.5) * 8,
      alpha: 0.3 + Math.random() * 0.7,
      size: (0.5 + Math.random()) * p.size.value,
      phase: Math.random() * Math.PI * 2,
    };
  }
  render(ctx, w, h, t) {
    this._ensure(w, h);
    const dt = 1 / 60;
    const p = this.params;
    for (let i = 0; i < this._particles.length; i++) {
      const pt = this._particles[i];
      pt.y -= p.speed.value * dt;
      pt.x += Math.sin(t * 1.5 + pt.phase) * 0.3 + pt.vx * dt;
      if (pt.y < -10 || pt.x < -10 || pt.x > w + 10) {
        this._particles[i] = this._spawn(w, h, false);
        continue;
      }
      const lifeAlpha = Math.min(1, pt.y / (h * 0.3));
      const a = pt.alpha * lifeAlpha;
      if (a < 0.01) continue;
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size * 2);
      grad.addColorStop(0, `rgba(${p.r.value},${p.g.value},${p.b.value},${a})`);
      grad.addColorStop(1, `rgba(${p.r.value},${p.g.value},${p.b.value},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(pt.x - pt.size * 2, pt.y - pt.size * 2, pt.size * 4, pt.size * 4);
    }
  }
}

class EdgeDrift {
  constructor() {
    this.type = 'edgeDrift';
    this.label = 'Edge Drift';
    this.enabled = true;
    this.params = {
      speed: { value: 0.6, min: 0.1, max: 3, step: 0.1, label: 'Speed' },
      brightness: { value: 0.7, min: 0, max: 1, step: 0.01, label: 'Brightness' },
      width: { value: 2, min: 1, max: 8, step: 0.5, label: 'Width' },
      r: { value: 180, min: 0, max: 255, step: 1, label: 'R' },
      g: { value: 210, min: 0, max: 255, step: 1, label: 'G' },
      b: { value: 255, min: 0, max: 255, step: 1, label: 'B' },
    };
  }
  render(ctx, w, h, t) {
    if (!state.edgeMap) return;
    const p = this.params;
    const pulse = 0.5 + 0.5 * Math.sin(t * p.speed.value);
    const alpha = p.brightness.value * pulse;
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${p.width.value}px)`;
    const drift = Math.sin(t * p.speed.value * 0.7) * 4;
    ctx.drawImage(state.edgeMap, drift, drift, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = `rgb(${p.r.value},${p.g.value},${p.b.value})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

const EFFECT_TYPES = {
  glowPulse: GlowPulse,
  bloomExpansion: BloomExpansion,
  risingParticles: RisingParticles,
  edgeDrift: EdgeDrift,
};

// ═══════════════════════════════════════════════════════════════════
//  WARP RENDERING
// ═══════════════════════════════════════════════════════════════════

function renderWarped(dstCtx, srcCanvas, corners, cw, ch) {
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const src4 = [[0, 0], [sw, 0], [sw, sh], [0, sh]];
  const dst4 = corners.map(c => [c[0] * cw, c[1] * ch]);
  const H = computeHomography(src4, dst4);
  const N = WARP_GRID;

  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const sx0 = (gx / N) * sw, sy0 = (gy / N) * sh;
      const sx1 = ((gx + 1) / N) * sw, sy1 = ((gy + 1) / N) * sh;
      const s = [[sx0, sy0], [sx1, sy0], [sx1, sy1], [sx0, sy1]];
      const d = s.map(p => projectPoint(H, p[0], p[1]));
      drawTriangle(dstCtx, srcCanvas, s[0], s[1], s[2], d[0], d[1], d[2]);
      drawTriangle(dstCtx, srcCanvas, s[0], s[2], s[3], d[0], d[2], d[3]);
    }
  }
}

function drawTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
  const m = affineFromTriangles(s0, s1, s2, d0, d1, d2);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0[0], d0[1]);
  ctx.lineTo(d1[0], d1[1]);
  ctx.lineTo(d2[0], d2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
//  OPTICAL MODEL
// ═══════════════════════════════════════════════════════════════════

const TEMP_TINT = {
  warm: [1.08, 0.98, 0.88],
  neutral: [1, 1, 1],
  cool: [0.88, 0.96, 1.1],
};

// Projector spectral cross-talk matrix.
// Real projectors' color filters/LEDs overlap: "blue" leaks green, etc.
// Slider (0-1) scales off-diagonals. Derived from real-world calibration.
const CROSSTALK_BASE = {
  rr: 1.0, rg: 0.18, rb: 0.03,
  gr: 0.12, gg: 1.0, gb: 0.35,
  br: 0.03, bg: 0.10, bb: 1.0,
};

function applyCrosstalk(rgb, bleed) {
  if (bleed <= 0) return rgb;
  const [r, g, b] = rgb;
  const s = bleed;
  return [
    Math.min(255, Math.round(r + g * CROSSTALK_BASE.gr * s + b * CROSSTALK_BASE.br * s)),
    Math.min(255, Math.round(g + r * CROSSTALK_BASE.rg * s + b * CROSSTALK_BASE.gb * s)),
    Math.min(255, Math.round(b + r * CROSSTALK_BASE.rb * s + g * CROSSTALK_BASE.bg * s)),
  ];
}

function renderComposite(ctx, w, h, mode) {
  const { env } = state;
  const pc = env.projColor;
  const isWhite = pc[0] === 255 && pc[1] === 255 && pc[2] === 255;
  const rawProj = isWhite ? state.projCanvas : state.coloredCanvas;
  const proj = state.warp.enabled ? state.warpedCanvas : rawProj;
  const tint = TEMP_TINT[env.temp] || TEMP_TINT.neutral;

  if (mode === 'digital') {
    ctx.drawImage(state.baseCanvas, 0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = env.brightness;
    applyTint(ctx, proj, w, h, tint);
    ctx.restore();
  } else {
    // ambient-lit base
    ctx.globalAlpha = Math.max(0.05, env.ambient);
    ctx.drawImage(state.baseCanvas, 0, 0, w, h);
    ctx.globalAlpha = 1;

    // Black level: projector always leaks some warm-ish light even on
    // "black" output. This leaked light then reflects off the surface, so
    // we draw a flat projector-leak color filtered through the reflectance
    // map (not the raw base image — that was the old incorrect approach).
    if (env.blackLevel > 0) {
      const fc2 = state.filteredCanvas;
      const fCtx2 = fc2.getContext('2d');
      fCtx2.clearRect(0, 0, w, h);
      fCtx2.fillStyle = 'rgb(255, 245, 230)';
      fCtx2.fillRect(0, 0, w, h);
      fCtx2.globalCompositeOperation = 'multiply';
      fCtx2.drawImage(state.reflectanceCanvas, 0, 0, w, h);
      fCtx2.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = env.blackLevel * env.brightness;
      ctx.drawImage(fc2, 0, 0, w, h);
      ctx.restore();
    }

    // build bloom version of projection (blurred + added back)
    const bloomAmt = env.lensBloom;
    let projWithBloom = proj;
    if (bloomAmt > 0) {
      const bCtx = state.bloomCanvas.getContext('2d');
      bCtx.clearRect(0, 0, w, h);
      bCtx.drawImage(proj, 0, 0, w, h);
      bCtx.save();
      bCtx.globalCompositeOperation = 'lighter';
      bCtx.filter = `blur(${Math.round(8 + bloomAmt * 20)}px)`;
      bCtx.globalAlpha = bloomAmt * 0.7;
      bCtx.drawImage(proj, 0, 0, w, h);
      bCtx.filter = 'none';
      bCtx.globalAlpha = bloomAmt * 0.3;
      bCtx.filter = `blur(${Math.round(20 + bloomAmt * 40)}px)`;
      bCtx.drawImage(proj, 0, 0, w, h);
      bCtx.restore();
      projWithBloom = state.bloomCanvas;
    }

    // Reflectance-filtered projection: multiply the projected light by the
    // pre-computed reflectance map (gamma-lifted base image). This correctly
    // models wavelength-selective absorption by the print surface.
    const fc = state.filteredCanvas;
    const fCtx = fc.getContext('2d');
    fCtx.clearRect(0, 0, w, h);
    fCtx.globalCompositeOperation = 'source-over';
    applyTint(fCtx, projWithBloom, w, h, tint);
    fCtx.globalCompositeOperation = 'multiply';
    fCtx.drawImage(state.reflectanceCanvas, 0, 0, w, h);
    fCtx.globalCompositeOperation = 'source-over';

    applyMaterial(fCtx, w, h, env.material);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = env.brightness;
    ctx.drawImage(fc, 0, 0, w, h);
    ctx.restore();

    // Ambient scatter: projected light bounces off the wall, room surfaces,
    // and the print frame, creating diffuse indirect illumination. This fill
    // is heavily blurred (directionless) and arrives from all angles, so it
    // is NOT filtered through the print's reflectance — it adds colour
    // uniformly, especially to areas the direct light can't reach.
    if (env.scatter > 0) {
      const sCtx = state.scatterCanvas.getContext('2d');
      sCtx.clearRect(0, 0, w, h);
      sCtx.filter = `blur(${Math.min(80, Math.round(w * 0.08))}px)`;
      sCtx.drawImage(projWithBloom, 0, 0, w, h);
      sCtx.filter = 'none';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = env.scatter * env.brightness;
      ctx.drawImage(state.scatterCanvas, 0, 0, w, h);
      ctx.restore();
    }
  }

  if (state.onionSkin > 0) {
    ctx.save();
    ctx.globalAlpha = state.onionSkin;
    ctx.drawImage(state.baseCanvas, 0, 0, w, h);
    ctx.restore();
  }
}

function applyTint(ctx, src, w, h, tint) {
  if (tint[0] === 1 && tint[1] === 1 && tint[2] === 1) {
    ctx.drawImage(src, 0, 0, w, h);
    return;
  }
  ctx.save();
  ctx.drawImage(src, 0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${Math.round(tint[0] * 255)},${Math.round(tint[1] * 255)},${Math.round(tint[2] * 255)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function applyMaterial(ctx, w, h, material) {
  if (material === 'matte') return;

  if (material === 'glossy') {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.15;
    ctx.drawImage(state.filteredCanvas, 0, 0, w, h);
    ctx.restore();
  }

  if (material === 'textured' && state.noiseCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.12;
    ctx.drawImage(state.noiseCanvas, 0, 0, w, h);
    ctx.restore();
  }

  if (material === 'canvas') {
    ctx.save();
    ctx.filter = 'blur(0.7px)';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(state.filteredCanvas, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
    if (state.noiseCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.07;
      ctx.drawImage(state.noiseCanvas, 0, 0, w, h);
      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  OVERLAYS (grid, edges, warp handles)
// ═══════════════════════════════════════════════════════════════════

function drawOverlays(ctx, w, h) {
  if (state.showGrid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(100,140,255,0.25)';
    ctx.lineWidth = 1;
    const step = Math.max(20, w / 16);
    for (let x = step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  if (state.showEdgeOverlay && state.edgeMap) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(state.edgeMap, 0, 0, w, h);
    ctx.restore();
  }

  if (state.warp.enabled) drawWarpHandles(ctx, w, h);
}

function drawWarpHandles(ctx, w, h) {
  const pts = state.warp.corners.map(c => [c[0] * w, c[1] * h]);
  ctx.save();
  ctx.strokeStyle = 'rgba(108,140,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= 4; i++) ctx.lineTo(pts[i % 4][0], pts[i % 4][1]);
  ctx.stroke();
  ctx.setLineDash([]);

  const labels = ['TL', 'TR', 'BR', 'BL'];
  pts.forEach(([x, y], i) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = state.warp.dragging === i ? '#6c8cff' : 'rgba(108,140,255,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x, y - 12);
  });
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
//  COMPARE MODE
// ═══════════════════════════════════════════════════════════════════

let compareEls = null;

function setupCompare() {
  const wrapper = document.getElementById('canvasWrapper');
  if (state.compareMode) {
    wrapper.classList.add('compare-mode');
    const container = document.createElement('div');
    container.className = 'compare-container';
    container.id = 'compareContainer';

    const panes = [
      { label: 'Base Only', id: 'cmpBase' },
      { label: 'Digital Ideal', id: 'cmpDigital' },
      { label: 'Physical Approx', id: 'cmpPhysical' },
    ];
    compareEls = {};
    panes.forEach(p => {
      const div = document.createElement('div');
      div.className = 'compare-pane';
      const lbl = document.createElement('div');
      lbl.className = 'compare-pane-label';
      lbl.textContent = p.label;
      const cvs = document.createElement('canvas');
      cvs.width = state.workW;
      cvs.height = state.workH;
      div.appendChild(lbl);
      div.appendChild(cvs);
      container.appendChild(div);
      compareEls[p.id] = cvs;
    });
    wrapper.appendChild(container);
  } else {
    wrapper.classList.remove('compare-mode');
    const c = document.getElementById('compareContainer');
    if (c) c.remove();
    compareEls = null;
  }
}

function renderCompare() {
  if (!compareEls || !state.baseCanvas) return;
  const { workW: w, workH: h } = state;

  const ctxBase = compareEls.cmpBase.getContext('2d');
  ctxBase.clearRect(0, 0, w, h);
  ctxBase.globalAlpha = Math.max(0.05, state.env.ambient);
  ctxBase.drawImage(state.baseCanvas, 0, 0, w, h);
  ctxBase.globalAlpha = 1;

  const ctxD = compareEls.cmpDigital.getContext('2d');
  ctxD.clearRect(0, 0, w, h);
  renderComposite(ctxD, w, h, 'digital');

  const ctxP = compareEls.cmpPhysical.getContext('2d');
  ctxP.clearRect(0, 0, w, h);
  renderComposite(ctxP, w, h, 'physical');
}

// ═══════════════════════════════════════════════════════════════════
//  PRESET MANAGER
// ═══════════════════════════════════════════════════════════════════

function serializeState() {
  return {
    version: 1,
    env: { ...state.env },
    warp: {
      enabled: state.warp.enabled,
      corners: state.warp.corners.map(c => [...c]),
    },
    showGrid: state.showGrid,
    showEdgeOverlay: state.showEdgeOverlay,
    onionSkin: state.onionSkin,
    speed: state.speed,
    mode: state.mode,
    effects: state.effects.map(e => ({
      type: e.type,
      enabled: e.enabled,
      params: Object.fromEntries(
        Object.entries(e.params).map(([k, v]) => [k, v.value])
      ),
    })),
  };
}

function deserializeState(data) {
  if (data.env) {
    Object.assign(state.env, data.env);
    if (!Array.isArray(state.env.projColor)) state.env.projColor = [255, 255, 255];
    if (state.env.blackLevel === undefined) state.env.blackLevel = 0.0;
    if (state.env.lensBloom === undefined) state.env.lensBloom = 0.05;
    if (state.env.spectralBleed === undefined) state.env.spectralBleed = 0.70;
    if (state.env.surfaceGamma === undefined) state.env.surfaceGamma = 0.50;
    if (state.env.surfaceFloor === undefined) state.env.surfaceFloor = 0.03;
    if (state.env.scatter === undefined) state.env.scatter = 0.10;
  }
  if (data.warp) {
    state.warp.enabled = data.warp.enabled;
    if (data.warp.corners) state.warp.corners = data.warp.corners.map(c => [...c]);
  }
  if (data.showGrid !== undefined) state.showGrid = data.showGrid;
  if (data.showEdgeOverlay !== undefined) state.showEdgeOverlay = data.showEdgeOverlay;
  if (data.onionSkin !== undefined) state.onionSkin = data.onionSkin;
  if (data.speed !== undefined) state.speed = data.speed;
  if (data.mode) state.mode = data.mode;
  if (data.effects) {
    state.effects = [];
    data.effects.forEach(ed => {
      const Cls = EFFECT_TYPES[ed.type];
      if (!Cls) return;
      const e = new Cls();
      e.enabled = ed.enabled !== false;
      if (ed.params) {
        Object.entries(ed.params).forEach(([k, v]) => {
          if (e.params[k]) e.params[k].value = v;
        });
      }
      state.effects.push(e);
    });
  }
  syncUIFromState();
}

function savePreset() {
  const json = JSON.stringify(serializeState(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'projection-preset.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadPresetFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      deserializeState(data);
      rebuildEffectsUI();
    } catch (e) {
      console.error('Invalid preset file', e);
    }
  };
  reader.readAsText(file);
}

async function loadPresetFromUrl(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    deserializeState(data);
    rebuildEffectsUI();
  } catch (e) {
    console.warn('Could not load preset from', url, e);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════════════════════

const preview = document.getElementById('preview');
const previewCtx = preview.getContext('2d');

function render(ts) {
  requestAnimationFrame(render);

  if (!state.baseImg) return;

  const now = ts / 1000;
  if (state.playing) {
    const dt = state.lastTs ? (now - state.lastTs) * state.speed : 0;
    state.time += dt;
  }
  state.lastTs = now;

  state._fpsFrames++;
  if (now - state._fpsLast >= 1) {
    state.fps = state._fpsFrames;
    state._fpsFrames = 0;
    state._fpsLast = now;
    document.getElementById('statusFps').textContent = state.fps + ' fps';
  }

  const { workW: w, workH: h } = state;

  const pCtx = state.projCanvas.getContext('2d');
  pCtx.clearRect(0, 0, w, h);
  state.effects.forEach(e => {
    if (e.enabled) e.render(pCtx, w, h, state.time);
  });

  const pc = state.env.projColor;
  const bleed = state.env.spectralBleed;
  const effectivePC = state.mode === 'physical' && bleed > 0 ? applyCrosstalk(pc, bleed) : pc;
  const isWhite = effectivePC[0] === 255 && effectivePC[1] === 255 && effectivePC[2] === 255;
  let projSource = state.projCanvas;
  if (!isWhite) {
    const cCtx = state.coloredCanvas.getContext('2d');
    cCtx.clearRect(0, 0, w, h);
    cCtx.drawImage(state.projCanvas, 0, 0, w, h);
    cCtx.globalCompositeOperation = 'multiply';
    cCtx.fillStyle = `rgb(${effectivePC[0]},${effectivePC[1]},${effectivePC[2]})`;
    cCtx.fillRect(0, 0, w, h);
    cCtx.globalCompositeOperation = 'source-over';
    projSource = state.coloredCanvas;
  }

  if (state.warp.enabled) {
    const wCtx = state.warpedCanvas.getContext('2d');
    wCtx.clearRect(0, 0, w, h);
    renderWarped(wCtx, projSource, state.warp.corners, w, h);
  }

  if (state.compareMode) {
    renderCompare();
  } else {
    previewCtx.clearRect(0, 0, w, h);
    renderComposite(previewCtx, w, h, state.mode);
    drawOverlays(previewCtx, w, h);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE LOADING
// ═══════════════════════════════════════════════════════════════════

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function setBaseImage(src) {
  try {
    const img = await loadImage(src);
    state.baseImg = img;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX_WORK_W) { h = Math.round(h * MAX_WORK_W / w); w = MAX_WORK_W; }
    state.workW = w;
    state.workH = h;

    [state.baseCanvas, state.reflectanceCanvas, state.scatterCanvas, state.projCanvas, state.coloredCanvas, state.bloomCanvas, state.filteredCanvas, state.warpedCanvas].forEach(c => {
      c.width = w; c.height = h;
    });
    preview.width = w;
    preview.height = h;

    analyzeBase();
    document.getElementById('statusSize').textContent = `${w}×${h}`;

    if (state.effects.length === 0) {
      state.effects.push(new GlowPulse());
      state.effects.push(new RisingParticles());
      rebuildEffectsUI();
    }
  } catch (e) {
    console.error('Failed to load image', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  WARP INTERACTION
// ═══════════════════════════════════════════════════════════════════

function initWarpDrag() {
  const cvs = preview;
  const hitRadius = 14;

  function canvasCoord(e) {
    const rect = cvs.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    ];
  }

  cvs.addEventListener('pointerdown', e => {
    if (!state.warp.enabled) return;
    const [mx, my] = canvasCoord(e);
    const hr = hitRadius / Math.max(cvs.clientWidth, cvs.clientHeight);
    for (let i = 0; i < 4; i++) {
      const dx = state.warp.corners[i][0] - mx;
      const dy = state.warp.corners[i][1] - my;
      if (Math.sqrt(dx * dx + dy * dy) < hr) {
        state.warp.dragging = i;
        cvs.setPointerCapture(e.pointerId);
        return;
      }
    }
  });

  cvs.addEventListener('pointermove', e => {
    if (state.warp.dragging < 0) return;
    const [mx, my] = canvasCoord(e);
    state.warp.corners[state.warp.dragging] = [
      Math.max(0, Math.min(1, mx)),
      Math.max(0, Math.min(1, my)),
    ];
  });

  cvs.addEventListener('pointerup', () => { state.warp.dragging = -1; });
  cvs.addEventListener('pointercancel', () => { state.warp.dragging = -1; });
}

// ═══════════════════════════════════════════════════════════════════
//  UI WIRING
// ═══════════════════════════════════════════════════════════════════

function syncUIFromState() {
  document.getElementById('modeDigital').checked = state.mode === 'digital';
  document.getElementById('modePhysical').checked = state.mode === 'physical';
  document.getElementById('ambientLight').value = Math.round(state.env.ambient * 100);
  document.getElementById('projBrightness').value = Math.round(state.env.brightness * 100);
  document.getElementById('blackLevel').value = Math.round(state.env.blackLevel * 100);
  document.getElementById('lensBloom').value = Math.round(state.env.lensBloom * 100);
  document.getElementById('spectralBleed').value = Math.round(state.env.spectralBleed * 100);
  document.getElementById('surfaceGamma').value = Math.round(state.env.surfaceGamma * 100);
  document.getElementById('surfaceFloor').value = Math.round(state.env.surfaceFloor * 100);
  document.getElementById('scatter').value = Math.round(state.env.scatter * 100);
  const pc = state.env.projColor;
  const pcHex = rgbToHex(pc[0], pc[1], pc[2]);
  document.getElementById('projColor').value = pcHex;
  document.getElementById('projColorHex').value = pcHex;
  if (wheel.canvas) setWheelFromRgb(pc[0], pc[1], pc[2]);
  document.getElementById('projTemp').value = state.env.temp;
  document.getElementById('materialType').value = state.env.material;
  document.getElementById('warpEnabled').checked = state.warp.enabled;
  document.getElementById('showGrid').checked = state.showGrid;
  document.getElementById('showEdgeOverlay').checked = state.showEdgeOverlay;
  document.getElementById('onionSkin').value = Math.round(state.onionSkin * 100);
  document.getElementById('animSpeed').value = Math.round(state.speed * 100);
  updateSliderValues();
}

function updateSliderValues() {
  document.querySelectorAll('.slider-value[data-for]').forEach(span => {
    const input = document.getElementById(span.dataset.for);
    if (!input) return;
    if (span.dataset.for === 'animSpeed') {
      span.textContent = (input.value / 100).toFixed(1) + 'x';
    } else if (span.dataset.for === 'surfaceGamma') {
      span.textContent = (input.value / 100).toFixed(2);
    } else {
      span.textContent = input.value + '%';
    }
  });
}

function rebuildEffectsUI() {
  const list = document.getElementById('effectsList');
  list.innerHTML = '';
  state.effects.forEach((effect, idx) => {
    const card = document.createElement('div');
    card.className = 'effect-card';

    const header = document.createElement('div');
    header.className = 'effect-card-header';

    const title = document.createElement('span');
    title.className = 'effect-card-title';
    title.textContent = effect.label;

    const actions = document.createElement('div');
    actions.className = 'effect-card-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-small' + (effect.enabled ? ' btn-accent' : '');
    toggleBtn.textContent = effect.enabled ? 'On' : 'Off';
    toggleBtn.addEventListener('click', () => {
      effect.enabled = !effect.enabled;
      toggleBtn.textContent = effect.enabled ? 'On' : 'Off';
      toggleBtn.classList.toggle('btn-accent', effect.enabled);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.effects.splice(idx, 1);
      rebuildEffectsUI();
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(removeBtn);
    header.appendChild(title);
    header.appendChild(actions);
    card.appendChild(header);

    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'effect-card-params';
    Object.entries(effect.params).forEach(([key, param]) => {
      const row = document.createElement('label');
      row.className = 'slider-label';
      row.textContent = param.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'slider';
      input.min = param.min;
      input.max = param.max;
      input.step = param.step;
      input.value = param.value;
      const val = document.createElement('span');
      val.className = 'slider-value';
      val.textContent = Number(param.value).toFixed(param.step < 1 ? 2 : 0);
      input.addEventListener('input', () => {
        param.value = parseFloat(input.value);
        val.textContent = Number(param.value).toFixed(param.step < 1 ? 2 : 0);
      });
      row.appendChild(input);
      row.appendChild(val);
      paramsDiv.appendChild(row);
    });
    card.appendChild(paramsDiv);
    list.appendChild(card);
  });
}

function initUI() {
  initColorWheel();

  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', () => { state.mode = r.value; });
  });

  const sliderBind = (id, setter) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { setter(el.value); updateSliderValues(); });
  };

  sliderBind('ambientLight', v => { state.env.ambient = v / 100; });
  sliderBind('projBrightness', v => { state.env.brightness = v / 100; });
  sliderBind('blackLevel', v => { state.env.blackLevel = v / 100; });
  sliderBind('lensBloom', v => { state.env.lensBloom = v / 100; });
  sliderBind('spectralBleed', v => { state.env.spectralBleed = v / 100; });
  sliderBind('surfaceGamma', v => {
    state.env.surfaceGamma = v / 100;
    buildReflectanceMap();
  });
  sliderBind('surfaceFloor', v => {
    state.env.surfaceFloor = v / 100;
    buildReflectanceMap();
  });
  sliderBind('scatter', v => { state.env.scatter = v / 100; });
  sliderBind('onionSkin', v => { state.onionSkin = v / 100; });
  sliderBind('animSpeed', v => { state.speed = v / 100; });

  document.getElementById('projColor').addEventListener('input', e => {
    const rgb = hexToRgb(e.target.value);
    state.env.projColor = rgb;
    document.getElementById('projColorHex').value = e.target.value;
    setWheelFromRgb(rgb[0], rgb[1], rgb[2]);
  });
  document.getElementById('projTemp').addEventListener('change', e => { state.env.temp = e.target.value; });
  document.getElementById('materialType').addEventListener('change', e => { state.env.material = e.target.value; });

  document.getElementById('warpEnabled').addEventListener('change', e => { state.warp.enabled = e.target.checked; });
  document.getElementById('btnResetWarp').addEventListener('click', () => {
    state.warp.corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  });
  document.getElementById('showGrid').addEventListener('change', e => { state.showGrid = e.target.checked; });
  document.getElementById('showEdgeOverlay').addEventListener('change', e => { state.showEdgeOverlay = e.target.checked; });

  document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setBaseImage(URL.createObjectURL(file));
  });
  document.getElementById('presetImage').addEventListener('change', e => {
    if (e.target.value) setBaseImage(e.target.value);
  });

  document.getElementById('btnCompare').addEventListener('click', () => {
    state.compareMode = !state.compareMode;
    document.getElementById('btnCompare').classList.toggle('active', state.compareMode);
    setupCompare();
  });

  document.getElementById('btnExport').addEventListener('click', exportPNG);

  document.getElementById('btnPlayPause').addEventListener('click', () => {
    state.playing = !state.playing;
    document.getElementById('btnPlayPause').textContent = state.playing ? '⏸ Pause' : '▶ Play';
  });

  document.getElementById('btnAddEffect').addEventListener('click', () => {
    document.getElementById('effectAddMenu').classList.toggle('hidden');
  });
  document.querySelectorAll('#effectAddMenu button').forEach(btn => {
    btn.addEventListener('click', () => {
      const Cls = EFFECT_TYPES[btn.dataset.type];
      if (Cls) {
        state.effects.push(new Cls());
        rebuildEffectsUI();
        document.getElementById('effectAddMenu').classList.add('hidden');
      }
    });
  });

  document.getElementById('btnSavePreset').addEventListener('click', savePreset);
  document.getElementById('btnLoadPreset').addEventListener('click', () => {
    document.getElementById('presetFileInput').click();
  });
  document.getElementById('presetFileInput').addEventListener('change', e => {
    if (e.target.files[0]) loadPresetFile(e.target.files[0]);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════════

function exportPNG() {
  if (!state.baseImg) return;
  const link = document.createElement('a');
  link.download = 'projection-snapshot.png';

  if (state.compareMode && compareEls) {
    const { workW: w, workH: h } = state;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w * 3 + 20;
    exportCanvas.height = h + 30;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#111118';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    const labels = ['Base Only', 'Digital Ideal', 'Physical Approx'];
    const keys = ['cmpBase', 'cmpDigital', 'cmpPhysical'];
    keys.forEach((k, i) => {
      const x = i * (w + 10);
      ctx.fillText(labels[i], x + w / 2, 16);
      ctx.drawImage(compareEls[k], x, 24, w, h);
    });
    link.href = exportCanvas.toDataURL('image/png');
  } else {
    link.href = preview.toDataURL('image/png');
  }
  link.click();
}

// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════

async function init() {
  state.baseCanvas = document.createElement('canvas');
  state.reflectanceCanvas = document.createElement('canvas');
  state.scatterCanvas = document.createElement('canvas');
  state.projCanvas = document.createElement('canvas');
  state.coloredCanvas = document.createElement('canvas');
  state.bloomCanvas = document.createElement('canvas');
  state.filteredCanvas = document.createElement('canvas');
  state.warpedCanvas = document.createElement('canvas');

  initUI();
  initWarpDrag();
  updateSliderValues();

  await loadPresetFromUrl('presets/falling-up.json').catch(() => {});

  const preset = document.getElementById('presetImage').value;
  if (preset) await setBaseImage(preset);

  rebuildEffectsUI();
  requestAnimationFrame(render);
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════════════
//  CALIBRATION API (called from external scripts via page.evaluate)
// ═══════════════════════════════════════════════════════════════════

window._calibration = {
  setEnv(params) {
    const needReflRebuild = params.surfaceGamma !== undefined || params.surfaceFloor !== undefined;
    Object.assign(state.env, params);
    if (!Array.isArray(state.env.projColor)) state.env.projColor = [255, 255, 255];
    if (needReflRebuild) buildReflectanceMap();
    syncUIFromState();
  },

  disableEffects() {
    state.effects.forEach(e => { e.enabled = false; });
  },

  setFlatProjection() {
    state.effects = [new GlowPulse()];
    const p = state.effects[0].params;
    p.cx.value = 0.5; p.cy.value = 0.5;
    p.radius.value = 2; p.speed.value = 0;
    p.minAlpha.value = 1; p.maxAlpha.value = 1;
    p.r.value = 255; p.g.value = 255; p.b.value = 255;
    state.effects[0].enabled = true;
  },

  sampleRegion(nx, ny, size) {
    const cvs = document.getElementById('preview');
    const ctx = cvs.getContext('2d');
    const px = Math.round(nx * cvs.width);
    const py = Math.round(ny * cvs.height);
    const half = Math.round(size / 2);
    const data = ctx.getImageData(
      Math.max(0, px - half), Math.max(0, py - half),
      size, size
    ).data;
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
      count++;
    }
    return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
  },

  sampleAll(regions) {
    return regions.map(r => ({
      name: r.name,
      color: this.sampleRegion(r.x, r.y, r.size || 20),
    }));
  },

  forceRender() {
    const { workW: w, workH: h } = state;
    if (!state.baseImg) return;
    const pCtx = state.projCanvas.getContext('2d');
    pCtx.clearRect(0, 0, w, h);
    state.effects.forEach(e => { if (e.enabled) e.render(pCtx, w, h, state.time); });

    const pc = state.env.projColor;
    const bleed = state.env.spectralBleed;
    const effectivePC = state.mode === 'physical' && bleed > 0 ? applyCrosstalk(pc, bleed) : pc;
    const isWhite = effectivePC[0] === 255 && effectivePC[1] === 255 && effectivePC[2] === 255;
    let projSource = state.projCanvas;
    if (!isWhite) {
      const cCtx = state.coloredCanvas.getContext('2d');
      cCtx.clearRect(0, 0, w, h);
      cCtx.drawImage(state.projCanvas, 0, 0, w, h);
      cCtx.globalCompositeOperation = 'multiply';
      cCtx.fillStyle = `rgb(${effectivePC[0]},${effectivePC[1]},${effectivePC[2]})`;
      cCtx.fillRect(0, 0, w, h);
      cCtx.globalCompositeOperation = 'source-over';
      projSource = state.coloredCanvas;
    }
    if (state.warp.enabled) {
      const wCtx = state.warpedCanvas.getContext('2d');
      wCtx.clearRect(0, 0, w, h);
      renderWarped(wCtx, projSource, state.warp.corners, w, h);
    }
    const preview = document.getElementById('preview');
    const previewCtx = preview.getContext('2d');
    previewCtx.clearRect(0, 0, w, h);
    renderComposite(previewCtx, w, h, state.mode);
  },
};
