// photo.js — 사진 보정판(주소 끝에 ?photo 를 붙였을 때만 뜬다. 예: index.html?photo · 다른 판과 함께: index.html?tune&edit&photo)
// 메인 화면 사진 · 인트로 배경을 화면에서 바로 보정한다. 막대를 움직이면 웹진 안의 그 사진이 바로 바뀐다.
//  · 전체 색감: 밝기 · 대비 · 밝은 곳 · 어두운 곳 · 색온도 · 색조 · 채도 · 생동감 (인트로 배경은 흐림도)
//  · 색깔별: 흙 · 바위 / 마른 풀 / 풀 · 나무 / 바다 / 하늘 — 색상 · 채도 · 밝기
//  · 부분 보정(최대 3개): 위쪽 · 아래쪽 · 왼쪽 · 오른쪽에서 번지는 영역, 또는 동그라미 영역 — 그 영역만 밝기 · 채도 · 색온도 · 색조.
//    [영역 보기]를 켜면 영역이 빨갛게 보이고, 동그라미는 사진을 눌러 가운데를 옮길 수 있다.
//  · [저장] = '웹진 미리보기 열기.command'(.work/edit/serve.py)로 연 페이지에서: 그림 파일(jeju-webzine/assets/intro/…)과
//    보정 값(.work/photo/settings/<main|intro>.json)을 쓴다. 고치기 전 그림은 jeju-webzine/.edit-backup/ 에 남는다.
//    서버가 없으면 [그림 내려받기]로 받아 직접 바꿔 넣는다.
// 시작할 사진(바탕)은 작업 폴더의 .work/photo/sources/ — 사이트에는 들어가지 않는다(발행본에서도 이 파일은 뺀다 — .work/publish/build.py).
// 사이트를 쓰는 사람에게는 보이지 않는다(?photo 가 없으면 이 파일을 불러오지도 않는다 — js/main.js).

const SOURCES = new URL('../.work/photo/sources/', location.href); // jeju-webzine/index.html 기준 → 작업 폴더/.work/photo/sources/
const STORE = 'hayeong-photo';

// ✏️ 보정할 사진: 바탕(시작할 사진) 후보 · 저장할 곳 · 저장할 폭
const TARGETS = {
  main: {
    label: '메인 화면 사진',
    bases: [
      { key: 'current', label: '지금 사진(인트로처럼 푸릇한 보정)', file: 'main-current.jpg' },
      { key: 'original', label: '원본 사진(보정 전 — 메인 제주)', file: 'main-original.jpg' },
    ],
    out: 'assets/intro/front-main-jeju.jpg',
    width: 2560,
    blur: false,
  },
  intro: {
    label: '인트로 배경',
    bases: [
      { key: 'current', label: '지금 배경(흐리게 · 푸릇하게)', file: 'intro-current.jpg' },
      { key: 'vintage', label: '빈티지 제주 배경 원본(흐림을 올려 쓰세요)', file: 'intro-vintage.jpg' },
      { key: 'main', label: '메인 제주 원본(같은 장면 · 더 선명 — 흐림을 올려 쓰세요)', file: 'main-original.jpg' },
    ],
    out: 'assets/intro/intro-bg.jpg',
    width: 1600,
    blur: true,
  },
};

// 전체 색감 막대(값의 범위는 모두 -100 ~ 100, 흐림만 0 ~ 40)
const GLOBAL = [
  { key: 'exposure', label: '밝기' },
  { key: 'contrast', label: '대비' },
  { key: 'highlights', label: '밝은 곳(하늘 · 구름)' },
  { key: 'shadows', label: '어두운 곳(그늘 · 바위)' },
  { key: 'temp', label: '색온도(− 차갑게 · + 따뜻하게)' },
  { key: 'tint', label: '색조(− 자줏빛 · + 초록빛)' },
  { key: 'saturation', label: '채도(색 진하기)' },
  { key: 'vibrance', label: '생동감(옅은 색만 진하게)' },
];
const BLUR = { key: 'blur', label: '흐림(인트로 배경)', min: 0, max: 40 };

// 색깔별: 가운데 색상(도) — 그 둘레 ±40도가 함께 바뀐다
const BANDS = [
  { key: 'earth', label: '흙 · 바위(빨강 · 주황)', hue: 25 },
  { key: 'dry', label: '마른 풀(노랑)', hue: 55 },
  { key: 'green', label: '풀 · 나무(초록)', hue: 110 },
  { key: 'sea', label: '바다(청록)', hue: 180 },
  { key: 'sky', label: '하늘(파랑)', hue: 215 },
];
const BAND_PARTS = [
  { key: 'h', label: '색상(− 왼쪽 색 쪽 · + 오른쪽 색 쪽)' },
  { key: 's', label: '채도' },
  { key: 'l', label: '밝기' },
];

// 부분 보정 한 개의 기본값
const SHAPES = [
  { key: 'top', label: '위쪽에서(하늘)' },
  { key: 'bottom', label: '아래쪽에서(땅 · 풀)' },
  { key: 'left', label: '왼쪽에서' },
  { key: 'right', label: '오른쪽에서' },
  { key: 'circle', label: '동그라미(사진을 눌러 자리 정하기)' },
];
const newLayer = (shape = 'top') => ({ shape, pos: shape === 'bottom' || shape === 'right' ? 60 : 40, soft: 30, cx: 50, cy: 50, r: 25, invert: false, exposure: 0, saturation: 0, temp: 0, tint: 0 });
const LAYER_ADJ = [
  { key: 'exposure', label: '밝기' },
  { key: 'saturation', label: '채도' },
  { key: 'temp', label: '색온도' },
  { key: 'tint', label: '색조(초록빛)' },
];
const MAX_LAYERS = 3;

const blank = (target) => ({
  base: TARGETS[target].bases[0].key,
  ...Object.fromEntries(GLOBAL.map((g) => [g.key, 0])),
  blur: 0,
  bands: Object.fromEntries(BANDS.map((b) => [b.key, { h: 0, s: 0, l: 0 }])),
  layers: [],
});

/* ── 보정 계산 ─────────────────────────────────────────────── */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  if (a === b) return v < a ? 0 : 1;
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// 밝기 · 대비 · 밝은 곳 · 어두운 곳 → 채널마다 쓰는 256칸 표(빠르게)
function toneTable(s) {
  const lut = new Float32Array(256);
  const g = Math.pow(2, -s.exposure / 100 * 1.2);
  const c = 1 + s.contrast / 100 * 0.6;
  const hi = s.highlights / 100;
  const sh = s.shadows / 100;
  for (let i = 0; i < 256; i++) {
    let v = Math.pow(i / 255, g);
    const wh = smooth(0.45, 1, v);
    const ws = 1 - smooth(0, 0.55, v);
    v += hi * 0.35 * wh * (hi > 0 ? 1 - v : v);
    v += sh * 0.35 * ws * (sh > 0 ? 1 - v : v);
    v = (v - 0.5) * c + 0.5;
    lut[i] = clamp01(v);
  }
  return lut;
}

// 부분 보정의 밝기 표(0~1 → 0~1)
function gammaTable(amount) {
  const lut = new Float32Array(256);
  const g = Math.pow(2, -amount / 100 * 1.1);
  for (let i = 0; i < 256; i++) lut[i] = Math.pow(i / 255, g);
  return lut;
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  return [hueToRgb(p, q, hk + 1 / 3), hueToRgb(p, q, hk), hueToRgb(p, q, hk - 1 / 3)];
}

// 부분 보정 영역의 세기(0~1). x · y = 사진 안의 자리(0~1), aspect = 가로 / 세로
function maskAt(layer, x, y, aspect) {
  let m;
  const half = Math.max(0.005, layer.soft / 200);
  const pos = layer.pos / 100;
  switch (layer.shape) {
    case 'top': m = 1 - smooth(pos - half, pos + half, y); break;
    case 'bottom': m = smooth(pos - half, pos + half, y); break;
    case 'left': m = 1 - smooth(pos - half, pos + half, x); break;
    case 'right': m = smooth(pos - half, pos + half, x); break;
    default: {
      const dx = (x - layer.cx / 100) * aspect;
      const dy = y - layer.cy / 100;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = layer.r / 100;
      m = 1 - smooth(r * (1 - layer.soft / 100), r, d);
    }
  }
  return layer.invert ? 1 - m : m;
}

// 그림 한 장(ImageData)을 보정 값대로 고친다. showMask = 영역 보기(그 부분 보정의 영역을 빨갛게)
function grade(image, s, showMask = -1) {
  const { data, width, height } = image;
  const tone = toneTable(s);
  const rM = 1 + s.temp / 100 * 0.12;
  const bM = 1 - s.temp / 100 * 0.12;
  const gM = 1 + s.tint / 100 * 0.08;
  const satK = 1 + s.saturation / 100;
  const vib = s.vibrance / 100;
  const bands = BANDS.map((b) => ({ hue: b.hue, ...s.bands[b.key] })).filter((b) => b.h || b.s || b.l);
  const layers = s.layers.map((l, i) => ({ ...l, index: i, lut: gammaTable(l.exposure) }))
    .filter((l) => l.exposure || l.saturation || l.temp || l.tint || l.index === showMask);
  const aspect = width / height;
  for (let y = 0, i = 0; y < height; y++) {
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x++, i += 4) {
      let r = tone[data[i]] * rM;
      let g = tone[data[i + 1]] * gM;
      let b = tone[data[i + 2]] * bM;
      // 채도 · 생동감(옅은 색일수록 더)
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat0 = Math.max(r, g, b) - Math.min(r, g, b);
      const k = satK + vib * (1 - Math.min(1, sat0 * 1.6));
      r = L + (r - L) * k;
      g = L + (g - L) * k;
      b = L + (b - L) * k;
      // 색깔별
      if (bands.length) {
        const [h, sl, l] = rgbToHsl(clamp01(r), clamp01(g), clamp01(b));
        let dh = 0;
        let sm = 1;
        let dl = 0;
        const sw = Math.min(1, sl * 3); // 거의 흰 · 회색인 곳(구름)은 덜 바뀌게
        for (const band of bands) {
          let d = Math.abs(h - band.hue);
          if (d > 180) d = 360 - d;
          const w = d < 40 ? (1 - d / 40) ** 2 * sw : 0;
          if (!w) continue;
          dh += w * band.h * 0.3;
          sm *= 1 + w * band.s / 100;
          dl += w * band.l / 100 * 0.25;
        }
        if (dh || sm !== 1 || dl) [r, g, b] = hslToRgb(h + dh, clamp01(sl * sm), clamp01(l + dl * (dl > 0 ? 1 - l : l) * 2));
      }
      // 부분 보정
      if (layers.length) {
        const nx = (x + 0.5) / width;
        for (const layer of layers) {
          const m = maskAt(layer, nx, ny, aspect);
          if (m <= 0.002) continue;
          let lr = layer.lut[Math.max(0, Math.min(255, Math.round(r * 255)))];
          let lg = layer.lut[Math.max(0, Math.min(255, Math.round(g * 255)))];
          let lb = layer.lut[Math.max(0, Math.min(255, Math.round(b * 255)))];
          lr *= 1 + layer.temp / 100 * 0.12;
          lb *= 1 - layer.temp / 100 * 0.12;
          lg *= 1 + layer.tint / 100 * 0.08;
          const ll = 0.299 * lr + 0.587 * lg + 0.114 * lb;
          const lk = 1 + layer.saturation / 100;
          lr = ll + (lr - ll) * lk;
          lg = ll + (lg - ll) * lk;
          lb = ll + (lb - ll) * lk;
          r += (lr - r) * m;
          g += (lg - g) * m;
          b += (lb - b) * m;
          if (layer.index === showMask) {
            r += (1 - r) * m * 0.45;
            g -= g * m * 0.35;
            b -= b * m * 0.35;
          }
        }
      }
      data[i] = clamp01(r) * 255;
      data[i + 1] = clamp01(g) * 255;
      data[i + 2] = clamp01(b) * 255;
    }
  }
  return image;
}

/* ── 그림 읽기 · 그리기 ─────────────────────────────────────── */

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`그림을 불러오지 못했어요: ${src}`));
  img.src = src;
});

// 바탕 그림을 폭 w 로(흐림이 있으면 흐리게) 그려 ImageData 로. blur 는 '폭 1600 기준 px'
function baseData(img, w, blur) {
  const h = Math.round(img.naturalHeight * w / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  if (blur > 0) {
    // 흐림이 가장자리에서 비어 보이지 않게 조금 크게 그린 뒤 흐린다
    const px = blur * w / 1600;
    ctx.filter = `blur(${px}px)`;
    ctx.drawImage(img, -px * 2, -px * 2, w + px * 4, h + px * 4);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return ctx.getImageData(0, 0, w, h);
}

const toCanvas = (image) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
};

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/* ── 화면 속 사진에 입히기 ─────────────────────────────────── */

// 메인 사진(<img>) 또는 인트로 배경(.intro__desk 의 background-image 둘째 겹)
function viewOf(target) {
  if (target === 'main') {
    const img = document.querySelector('.front__img');
    return img && {
      el: img,
      show(url) { img.src = url; },
      reset() { img.src = img.dataset.photoSrc || img.src; },
      fit() { // object-fit: cover + object-position
        const pos = getComputedStyle(img).objectPosition.split(' ').map((p) => parseFloat(p) / 100);
        return { el: img, px: pos[0] || 0.5, py: pos[1] || 0.5 };
      },
    };
  }
  const desk = document.querySelector('.intro__desk');
  if (!desk) return null;
  // css 가 그리는 배경(가장자리 그늘 + intro-bg.jpg)을 처음 한 번만 기억해 두고, 그림 자리만 바꿔 끼운다
  if (!desk.dataset.photoBg) desk.dataset.photoBg = getComputedStyle(desk).backgroundImage;
  const original = desk.dataset.photoBg;
  return {
    el: desk,
    show(url) { desk.style.backgroundImage = original.replace(/url\([^)]*intro-bg[^)]*\)/, `url("${url}")`); },
    reset() { desk.style.backgroundImage = ''; },
    fit() { return { el: desk, px: 0.5, py: 0.5 }; },
  };
}

// 화면을 누른 자리 → 사진 안의 자리(0~1). cover 로 잘려 보이는 것을 되짚는다
function pointInPhoto(view, image, event) {
  const { el, px, py } = view.fit();
  const box = el.getBoundingClientRect();
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const left = box.left + (box.width - w) * px;
  const top = box.top + (box.height - h) * py;
  const x = (event.clientX - left) / w;
  const y = (event.clientY - top) / h;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

// 메인 사진이 보이는 자리(인트로 끝)로 · 인트로 배경이 보이는 자리(맨 위)로
function scrollToTarget(target) {
  if (target === 'intro') {
    window.scrollTo(0, 0);
    return;
  }
  const intro = document.getElementById('intro');
  const stage = intro && intro.querySelector('.intro__stage');
  const front = document.querySelector('.intro__front');
  if (document.documentElement.classList.contains('intro-static')) {
    if (front) front.scrollIntoView({ block: 'start' });
  } else if (intro && stage) {
    window.scrollTo(0, intro.offsetTop + Math.max(0, intro.offsetHeight - stage.offsetHeight) - 2);
  }
}

/* ── 서버(저장) ─────────────────────────────────────────────── */

async function hasServer() {
  try {
    const res = await fetch('/__edit/ping', { cache: 'no-store' });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `저장하지 못했어요(${res.status})`);
  return data;
}

/* ── 판 ─────────────────────────────────────────────────────── */

const CSS = `
  .photo{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));top:calc(12px + env(safe-area-inset-top,0px));z-index:2001;width:min(340px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px 14px;border:1.5px solid #2e2d36;border-radius:12px;background:#fffaf0;box-shadow:0 14px 30px -12px rgb(0 0 0/.45);color:#2e2d36;font:13px/1.45 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;letter-spacing:0}
  .photo *{box-sizing:border-box}
  .photo__head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}
  .photo__title{margin:0;font-size:14px;font-weight:800}
  .photo__tabs{display:flex;gap:4px;margin:0 0 8px}
  .photo__tabs button[aria-pressed="true"]{background:#2e2d36;color:#fffaf0}
  .photo label.photo__field{display:grid;gap:3px;margin:0 0 8px;font-weight:600}
  .photo select{width:100%;padding:5px 6px;border:1px solid #d7a873;border-radius:6px;background:#fff;color:#2e2d36;font:inherit}
  .photo details{margin:10px 0 0;padding-top:8px;border-top:1px dashed #d7a873}
  .photo summary{font-weight:800;cursor:pointer}
  .photo__row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin:6px 0 0}
  .photo__row span{font-weight:600}
  .photo__row output{font-variant-numeric:tabular-nums;font-weight:700}
  .photo__row input{grid-column:1/-1;width:100%;margin:0;accent-color:#e1653a}
  .photo__row.is-changed span::after{content:" ●";color:#e1653a}
  .photo__band{margin:8px 0 0;padding:6px 8px;border-radius:8px;background:#fdf1dc}
  .photo__band b{display:block}
  .photo__layer{margin:8px 0 0;padding:8px;border:1px solid #d7a873;border-radius:8px;background:#fff}
  .photo__layer-head{display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:800}
  .photo__check{display:flex;align-items:center;gap:6px;margin:6px 0 0;font-weight:600}
  .photo__btns{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 8px}
  .photo button{padding:6px 10px;border:1.5px solid #2e2d36;border-radius:999px;background:#fffaf0;color:#2e2d36;font:inherit;font-weight:700;cursor:pointer}
  .photo button.photo__main{background:#2e2d36;color:#fffaf0}
  .photo button:disabled{opacity:.45;cursor:default}
  .photo__status{margin:0 0 6px;color:#2e7d4f;font-weight:700}
  .photo__status:empty{display:none}
  .photo__status.is-error{color:#b3261e}
  .photo__note{margin:6px 0 0;color:#6b5a4e;font-size:12px}
  .photo.is-folded{width:auto}
  .photo.is-folded > :not(.photo__head){display:none}
  html.photo-picking .front__img,html.photo-picking .intro__desk{cursor:crosshair}
`;

const range = (key, label, value, { min = -100, max = 100, step = 1, path = key } = {}) => `
  <label class="photo__row${value ? ' is-changed' : ''}"><span>${label}</span><output>${value}</output>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-path="${path}"></label>`;

export function initPhoto() {
  if (document.querySelector('.photo')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const html = document.documentElement;
  const panel = document.createElement('section');
  panel.className = 'photo';
  panel.setAttribute('aria-label', '사진 보정판');
  document.body.append(panel);

  let store = {};
  try { store = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { /* 저장소를 못 쓰면 이번 화면에서만 */ }
  const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch { /* 위와 같다 */ } };

  // 메인 화면 사진이 페이지에 없으면(27차에 메인 화면을 뺐다) 그 탭을 빼고 인트로 배경만
  if (!document.querySelector('.front__img')) delete TARGETS.main;
  let target = TARGETS[store.target] ? store.target : Object.keys(TARGETS)[0];
  const state = {}; // 대상마다 지금 보정 값
  const saved = {}; // 대상마다 파일에 저장된 보정 값(.work/photo/settings)
  let showMask = -1; // 영역 보기 중인 부분 보정 번호
  let picking = -1; // 사진을 눌러 동그라미 자리를 정하는 중인 부분 보정 번호
  let baseImg = null;
  let baseKey = '';
  let preview = null; // 미리보기 바탕(작게) ImageData — 흐림까지 입힌 것
  let previewKey = '';
  let lastUrl = '';
  let busy = false;
  let again = false;

  const S = () => state[target];
  const T = () => TARGETS[target];

  const status = () => panel.querySelector('[data-photo-status]');
  const say = (text, error = false) => {
    const el = status();
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-error', error);
  };

  const remember = () => {
    store.target = target;
    store[target] = S();
    keep();
  };

  async function loadSettings(name) {
    try {
      const res = await fetch(new URL(`../.work/photo/settings/${name}.json`, location.href), { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // 미리보기 그리기(막대를 움직일 때마다 — 한 번에 하나씩, 밀린 것은 마지막 것만)
  async function draw() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const s = S();
      const base = T().bases.find((b) => b.key === s.base) || T().bases[0];
      if (baseKey !== `${target}:${base.key}`) {
        baseImg = await loadImage(new URL(base.file, SOURCES).href);
        baseKey = `${target}:${base.key}`;
        previewKey = '';
      }
      const w = Math.min(baseImg.naturalWidth, target === 'main' ? 1400 : 1000);
      const key = `${baseKey}:${w}:${T().blur ? s.blur : 0}`;
      if (key !== previewKey) {
        preview = baseData(baseImg, w, T().blur ? s.blur : 0);
        previewKey = key;
      }
      const image = new ImageData(new Uint8ClampedArray(preview.data), preview.width, preview.height);
      grade(image, s, showMask);
      const blob = await toBlob(toCanvas(image), 0.86);
      const url = URL.createObjectURL(blob);
      const view = viewOf(target);
      if (view) view.show(url);
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = url;
    } catch (err) {
      say(err && err.message ? err.message : String(err), true);
    } finally {
      busy = false;
      if (again) { again = false; draw(); }
    }
  }

  const layerHTML = (layer, i) => {
    const circle = layer.shape === 'circle';
    return `<div class="photo__layer" data-layer="${i}">
      <div class="photo__layer-head">부분 보정 ${i + 1}<button type="button" data-layer-remove="${i}">빼기</button></div>
      <label class="photo__field">영역<select data-path="layers.${i}.shape">${SHAPES.map((sh) => `<option value="${sh.key}"${sh.key === layer.shape ? ' selected' : ''}>${sh.label}</option>`).join('')}</select></label>
      ${circle
        ? range('cx', '가운데 — 가로(%)', layer.cx, { min: 0, max: 100, path: `layers.${i}.cx` })
          + range('cy', '가운데 — 세로(%)', layer.cy, { min: 0, max: 100, path: `layers.${i}.cy` })
          + range('r', '크기(%)', layer.r, { min: 3, max: 100, path: `layers.${i}.r` })
        : range('pos', '경계 자리(%)', layer.pos, { min: 0, max: 100, path: `layers.${i}.pos` })}
      ${range('soft', '경계 부드럽게(%)', layer.soft, { min: 0, max: 100, path: `layers.${i}.soft` })}
      ${LAYER_ADJ.map((a) => range(a.key, a.label, layer[a.key], { path: `layers.${i}.${a.key}` })).join('')}
      <label class="photo__check"><input type="checkbox" data-path="layers.${i}.invert"${layer.invert ? ' checked' : ''}> 영역 뒤집기(바깥쪽을 보정)</label>
      <label class="photo__check"><input type="checkbox" data-mask="${i}"${showMask === i ? ' checked' : ''}> 영역 보기(빨갛게)</label>
      ${circle ? `<p class="photo__btns"><button type="button" data-pick="${i}" aria-pressed="${picking === i}">${picking === i ? '사진을 누르세요…' : '사진을 눌러 자리 정하기'}</button></p>` : ''}
    </div>`;
  };

  function render() {
    const s = S();
    // 다시 그려도 펼쳐 둔 칸(전체 색감 · 색깔별 · 부분 보정)은 그대로
    const opened = [...panel.querySelectorAll('details')].map((d) => d.open);
    panel.innerHTML = `
      <div class="photo__head"><p class="photo__title">사진 보정판</p><button type="button" data-fold aria-expanded="${!panel.classList.contains('is-folded')}">${panel.classList.contains('is-folded') ? '펼치기' : '접기'}</button></div>
      <div class="photo__tabs" role="group" aria-label="보정할 사진">${Object.entries(TARGETS).map(([k, t]) => `<button type="button" data-target="${k}" aria-pressed="${k === target}">${t.label}</button>`).join('')}</div>
      <label class="photo__field">시작할 사진<select data-path="base">${T().bases.map((b) => `<option value="${b.key}"${b.key === s.base ? ' selected' : ''}>${b.label}</option>`).join('')}</select></label>
      <details open><summary>전체 색감</summary>
        ${GLOBAL.map((g) => range(g.key, g.label, s[g.key])).join('')}
        ${T().blur ? range(BLUR.key, BLUR.label, s.blur, { min: BLUR.min, max: BLUR.max, step: 0.5 }) : ''}
      </details>
      <details><summary>색깔별(풀 · 하늘 · 바다 …)</summary>
        ${BANDS.map((b) => `<div class="photo__band"><b>${b.label}</b>${BAND_PARTS.map((p) => range(p.key, p.label, s.bands[b.key][p.key], { path: `bands.${b.key}.${p.key}` })).join('')}</div>`).join('')}
      </details>
      <details${s.layers.length ? ' open' : ''}><summary>부분 보정(영역만)</summary>
        ${s.layers.map(layerHTML).join('')}
        <p class="photo__btns"><button type="button" data-layer-add${s.layers.length >= MAX_LAYERS ? ' disabled' : ''}>+ 부분 보정 더하기</button></p>
      </details>
      <div class="photo__btns">
        <button type="button" class="photo__main" data-save>저장</button>
        <button type="button" data-compare>누르는 동안 원래 사진</button>
        <button type="button" data-reset>처음으로(모두 0)</button>
        <button type="button" data-revert>저장한 값으로</button>
        <button type="button" data-download>그림 내려받기</button>
      </div>
      <p class="photo__status" role="status" data-photo-status></p>
      <p class="photo__note">막대 = 0 이면 '시작할 사진' 그대로예요. [저장]은 그림 파일(<b>jeju-webzine/${T().out}</b>)과 보정 값(<b>.work/photo/settings/${target}.json</b>)을 써요 — '웹진 미리보기 열기.command' 로 연 페이지에서.
        고치기 전 그림은 jeju-webzine/.edit-backup/ 에 남아요. 막대를 두 번 누르면 그 막대만 0 으로.</p>`;
    if (opened.length) panel.querySelectorAll('details').forEach((d, i) => { if (opened[i] !== undefined) d.open = opened[i]; });
  }

  // 'layers.0.exposure' 같은 길에 값 넣기
  const setPath = (obj, path, value) => {
    const keys = path.split('.');
    let o = obj;
    keys.slice(0, -1).forEach((k) => { o = o[k]; });
    o[keys[keys.length - 1]] = value;
  };

  panel.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.path || input.type !== 'range') return;
    const value = parseFloat(input.value);
    setPath(S(), input.dataset.path, value);
    const row = input.closest('.photo__row');
    if (row) {
      row.querySelector('output').textContent = value;
      row.classList.toggle('is-changed', value !== 0);
    }
    remember();
    draw();
  });

  panel.addEventListener('change', (event) => {
    const el = event.target;
    if (el instanceof HTMLSelectElement && el.dataset.path) {
      if (el.dataset.path === 'base') S().base = el.value;
      else {
        const i = Number(el.dataset.path.split('.')[1]);
        const old = S().layers[i];
        S().layers[i] = { ...newLayer(el.value), ...Object.fromEntries(LAYER_ADJ.map((a) => [a.key, old[a.key]])), invert: old.invert };
      }
      remember();
      render();
      draw();
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.dataset.mask !== undefined) showMask = el.checked ? Number(el.dataset.mask) : -1;
      else if (el.dataset.path) { setPath(S(), el.dataset.path, el.checked); remember(); }
      render();
      draw();
    }
  });

  // 막대를 두 번 누르면 그 막대만 0(흐림 · 영역 모양 값은 처음 값)
  panel.addEventListener('dblclick', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
    const path = input.dataset.path;
    const last = path.split('.').pop();
    const fresh = newLayer();
    const value = ['pos', 'soft', 'cx', 'cy', 'r'].includes(last) ? fresh[last] : 0;
    setPath(S(), path, value);
    remember();
    render();
    draw();
  });

  panel.addEventListener('click', async (event) => {
    const btn = event.target instanceof Element ? event.target.closest('button') : null;
    if (!btn) return;
    if (btn.dataset.fold !== undefined) {
      panel.classList.toggle('is-folded');
      store.folded = panel.classList.contains('is-folded');
      keep();
      render();
      return;
    }
    if (btn.dataset.target) {
      if (btn.dataset.target === target) return;
      viewOf(target)?.reset();
      target = btn.dataset.target;
      showMask = -1;
      picking = -1;
      remember();
      render();
      scrollToTarget(target);
      draw();
      return;
    }
    if (btn.dataset.layerAdd !== undefined) {
      if (S().layers.length < MAX_LAYERS) S().layers.push(newLayer());
      showMask = S().layers.length - 1;
      remember();
      render();
      draw();
      return;
    }
    if (btn.dataset.layerRemove !== undefined) {
      S().layers.splice(Number(btn.dataset.layerRemove), 1);
      showMask = -1;
      picking = -1;
      remember();
      render();
      draw();
      return;
    }
    if (btn.dataset.pick !== undefined) {
      const i = Number(btn.dataset.pick);
      picking = picking === i ? -1 : i;
      html.classList.toggle('photo-picking', picking >= 0);
      render();
      return;
    }
    if (btn.dataset.reset !== undefined) {
      state[target] = { ...blank(target), base: S().base };
      showMask = -1;
      remember();
      render();
      draw();
      return;
    }
    if (btn.dataset.revert !== undefined) {
      state[target] = saved[target] ? structuredClone(saved[target]) : blank(target);
      showMask = -1;
      remember();
      render();
      draw();
      say(saved[target] ? '파일에 저장된 값으로 되돌렸어요.' : '아직 저장한 값이 없어서 처음 값(모두 0)으로 했어요.');
      return;
    }
    if (btn.dataset.save !== undefined || btn.dataset.download !== undefined) {
      const download = btn.dataset.download !== undefined;
      if (!download && !(await hasServer())) {
        say('여기서는 파일에 바로 저장할 수 없어요 — 작업 폴더의 \'웹진 미리보기 열기.command\' 를 더블클릭해 연 페이지에서 저장하거나, [그림 내려받기]로 받아 직접 바꿔 넣으세요.', true);
        return;
      }
      btn.disabled = true;
      say(download ? '그림을 만드는 중…' : '큰 그림을 만들어 저장하는 중…(몇 초 걸려요)');
      try {
        const s = structuredClone(S());
        const base = T().bases.find((b) => b.key === s.base) || T().bases[0];
        const img = await loadImage(new URL(base.file, SOURCES).href);
        const full = grade(baseData(img, T().width, T().blur ? s.blur : 0), s);
        const blob = await toBlob(toCanvas(full), 0.9);
        if (download) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = T().out.split('/').pop();
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          say(`내려받았어요 — 받은 파일을 jeju-webzine/${T().out} 에 덮어 넣으면 바뀌어요.`);
        } else {
          const dataUrl = await blobToDataURL(blob);
          const result = await post('/__edit/image', { path: T().out, data: dataUrl });
          await post('/__edit/photo-settings', { name: target, content: JSON.stringify(s, null, 2) });
          saved[target] = s;
          say(`저장했어요: jeju-webzine/${T().out}(${full.width}x${full.height}) · 보정 값 .work/photo/settings/${target}.json — 고치기 전 그림: jeju-webzine/.edit-backup/${result.backup}`);
        }
      } catch (err) {
        say(`저장하지 못했어요: ${err && err.message ? err.message : err}`, true);
      } finally {
        btn.disabled = false;
      }
    }
  });

  // 누르는 동안 원래 사진(시작할 사진 그대로)
  const compare = (on) => {
    if (on) {
      const base = T().bases.find((b) => b.key === S().base) || T().bases[0];
      viewOf(target)?.show(new URL(base.file, SOURCES).href);
    } else if (lastUrl) viewOf(target)?.show(lastUrl);
  };
  panel.addEventListener('pointerdown', (e) => { if (e.target instanceof Element && e.target.closest('[data-compare]')) compare(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => panel.addEventListener(type, (e) => { if (e.target instanceof Element && e.target.closest('[data-compare]')) compare(false); }));

  // 동그라미 자리 정하기: 사진을 누른 자리 = 가운데
  document.addEventListener('click', (event) => {
    if (picking < 0 || panel.contains(event.target)) return;
    const view = viewOf(target);
    if (!view || !preview) return;
    const point = pointInPhoto(view, preview, event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    const layer = S().layers[picking];
    layer.cx = Math.round(point.x * 100);
    layer.cy = Math.round(point.y * 100);
    picking = -1;
    html.classList.remove('photo-picking');
    remember();
    render();
    draw();
  }, true);

  // 시작: 저장된 보정 값(파일) → 이 브라우저에 남은 고치던 값 → 처음 값
  (async () => {
    const [main, intro] = await Promise.all([loadSettings('main'), loadSettings('intro')]);
    if (main) saved.main = main;
    if (intro) saved.intro = intro;
    Object.keys(TARGETS).forEach((k) => {
      const fromStore = store[k];
      const pick = fromStore || saved[k] || blank(k);
      state[k] = { ...blank(k), ...structuredClone(pick), bands: { ...blank(k).bands, ...(pick.bands || {}) }, layers: Array.isArray(pick.layers) ? pick.layers : [] };
    });
    const img = document.querySelector('.front__img');
    if (img) img.dataset.photoSrc = img.getAttribute('src');
    if (store.folded) panel.classList.add('is-folded');
    render();
    draw();
  })();
}
