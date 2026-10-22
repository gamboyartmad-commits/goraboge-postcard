// postcard-image.js — 엽서 DOM → PNG/JPEG (html-to-image), 메일용 용량 맞춤 압축
// 화면에 보이는 엽서 노드(css/maker.css 의 .postcard)를 그대로 그림으로 옮긴다.
// 엽서에 무슨 글이 어떻게 들어갔는지는 모른다 — 받은 노드를 그리기만 한다.
//   renderPNG(node, { width })                → PNG data URL
//   renderJPEG(node, { maxBytes, maxWidth })  → { dataUrl, bytes, width, height, quality, ok }
//   download(dataUrl, filename)               → { started, url } (아래 설명)

import { t } from './i18n.js';
import { withTimeout } from './shared.js';

// 엽서 노드가 쓰는 웹폰트(css/maker.css 의 .postcard 와 같아야 한다).
// ✏️ 교체: 엽서 글꼴을 바꾸면 여기 두 줄도 함께 고친다(Google Fonts 의 글꼴이어야 '쓰인 글자만' 받아 올 수 있다)
const FONT_FAMILY = 'Nanum Pen Script';
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap&text=';
// 아래아(조합형 옛한글 자모)는 나눔손글씨 펜에 없다 → 엽서 글에 있으면 css/base.css 의 "Araea Hand"(assets/fonts/ 의 자모 조각)도 그림에 싣는다.
// 글꼴 정의(@font-face)는 css/base.css 에서 그대로 읽어 온다(아래 ARAEA_FALLBACK 은 읽지 못했을 때만 쓴다)
const ARAEA_FAMILY = 'Araea Hand';
const ARAEA_CHARS = /[\u1100-\u1112\u119E-\u11A2\u11A8-\u11C2]/;
const ARAEA_FALLBACK = `@font-face{font-family:"Araea Hand";font-style:normal;font-weight:500;size-adjust:66%;src:url("${new URL('../assets/fonts/NotoSansKR-araea.woff2', import.meta.url).href}") format("woff2");unicode-range:U+1100-1112,U+119E-11A2,U+11A8-11C2}`;

// ✏️ 교체: html-to-image(CDN)를 받지 못했을 때 화면에 나오는 안내(언어별 문구는 data/i18n/*.json 의 image.no-library)
const noLibrary = () => t('image.no-library', '엽서 그림을 만드는 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요');

// 단계마다 기다리는 시간의 상한(ms) — 어느 단계가 멈춰도 '그리는 중…' 이 끝나지 않는 일은 없다
const FONT_WAIT = 3000; // 화면의 글꼴이 도착하기를 기다리는 시간(못 기다려도 아래에서 글꼴을 따로 싣는다)
const FETCH_TIMEOUT = 8000; // 글꼴 파일 하나를 받는 시간(본문을 다 읽을 때까지)
const SUBSET_TIMEOUT = 10000; // 1순위 방법(쓰인 글자만 담은 글꼴) 전체
const EMBED_TIMEOUT = 10000; // 2순위 방법(페이지의 글꼴 조각을 모두 싣기)
const RENDER_TIMEOUT = 30000; // 그리기
const JPEG_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.4]; // 용량이 넘치면 품질을 이 순서로 낮춘다
const JPEG_SCALES = [1, 0.86, 0.74, 0.64, 0.55]; // 그래도 넘치면 크기를 이 비율로 줄인다

/* ── 준비 ─────────────────────────────────────────────────────────────────── */

// CDN 에서 html-to-image 를 받지 못했으면 알기 쉬운 오류를 낸다(화면이 그대로 안내한다)
function getLibrary() {
  const lib = window.htmlToImage;
  if (!lib || typeof lib.toCanvas !== 'function') {
    const err = new Error(noLibrary());
    err.code = 'no-lib';
    throw err;
  }
  return lib;
}

// 주소에서 글(text) 또는 파일(blob)을 받아 온다. 본문을 다 읽을 때까지 FETCH_TIMEOUT 을 넘기면 그만둔다
async function fetchAs(url, kind) {
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res[kind]();
  } finally {
    clearTimeout(timer);
  }
}

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// 화면의 글꼴이 다 도착한 뒤에 그린다(늦게 오는 글꼴 조각까지). 글꼴 서버가 멈춰 있으면 FONT_WAIT 까지만 기다린다
async function fontsReady(node) {
  if (!document.fonts) return;
  const text = node.textContent || '가';
  const ready = Promise.resolve(document.fonts.ready)
    .then(() => Promise.all([
      document.fonts.load(`32px "${FONT_FAMILY}"`, text),
      ARAEA_CHARS.test(text) ? document.fonts.load(`500 32px "${ARAEA_FAMILY}"`, text) : null,
    ]));
  await withTimeout(ready, FONT_WAIT).catch(() => { /* 글꼴을 못 받아도 그림은 그린다(기본 글꼴로) */ });
}

// 엽서가 화면에 놓인 크기(기울기 같은 transform 과는 상관없는 값). 보이지 않으면 그릴 수 없다 —
// 숨겨진(display: none) 노드를 그리면 안쪽 치수가 엉뚱한 기준으로 풀려 구도가 무너진다
function sizeOf(node) {
  const style = node && node.isConnected && node.getClientRects().length > 0 ? getComputedStyle(node) : null;
  const width = style ? parseFloat(style.width) : 0;
  const height = style ? parseFloat(style.height) : 0;
  if (!(width > 0 && height > 0)) throw new Error('엽서가 화면에 보이지 않아 그릴 수 없어요');
  return { width, height };
}

// 그리는 사이에 엽서가 숨거나 크기가 바뀌었으면(창을 닫음 · 화면을 돌림) 그 그림은 쓰지 않는다
function assertUnchanged(node, size) {
  const now = sizeOf(node);
  if (Math.abs(now.width - size.width) > 0.5 || Math.abs(now.height - size.height) > 0.5) {
    throw new Error('그리는 동안 엽서의 크기가 바뀌었어요');
  }
}

/* ── 글꼴 싣기 ─────────────────────────────────────────────────────────────── */
// html-to-image 는 노드를 SVG 그림으로 바꿔 그리는데, 그 안에서는 페이지의 웹폰트가 보이지 않는다.
// → 글꼴 파일을 글자(data URL)로 바꿔 그림 안에 함께 실어야 손글씨가 그대로 나온다.

let lastFont = { key: '', css: '' };
let araeaCSS = ''; // 한 번 만든 아래아 글꼴 정의(data URL 을 담은 @font-face)

// 아래아 글꼴의 @font-face 를 글꼴 파일까지 담은 글(data URL)로 만든다. css/base.css 의 정의를 그대로 쓰고 주소만 바꾼다
async function araeaFontCSS() {
  if (araeaCSS) return araeaCSS;
  let rule = ARAEA_FALLBACK;
  let base = document.baseURI;
  for (const sheet of [...document.styleSheets]) {
    let rules = null;
    try {
      rules = sheet.cssRules; // 다른 사이트의 스타일시트(Google Fonts 등)는 읽을 수 없다 → 건너뛴다
    } catch { /* 건너뛴다 */ }
    const face = rules && [...rules].find((r) => r.type === CSSRule.FONT_FACE_RULE
      && r.style.getPropertyValue('font-family').replace(/["']/g, '').trim() === ARAEA_FAMILY);
    if (face) {
      rule = face.cssText;
      base = sheet.href || document.baseURI;
      break;
    }
  }
  const src = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(rule);
  if (!src) throw new Error('아래아 글꼴 주소를 찾지 못했어요');
  const data = await blobToDataURL(await fetchAs(new URL(src[1], base).href, 'blob'));
  araeaCSS = rule.replace(src[0], `url("${data}")`);
  return araeaCSS;
}

// 1순위: 엽서에 실제로 쓰인 글자만 담은 작은 글꼴 한 개(Google Fonts 의 text= 기능) + 아래아가 있으면 아래아 글꼴
async function subsetFontCSS(text) {
  // 아래아 자모는 나눔손글씨 펜에 없으므로 Google 에 보내는 글자에서 뺀다
  const chars = [...new Set(text)].filter((ch) => ch.trim() && !ARAEA_CHARS.test(ch)).sort().join('');
  const araea = ARAEA_CHARS.test(text);
  if (!chars && !araea) return '';
  const key = `${chars}${araea ? '|araea' : ''}`;
  if (lastFont.key === key) return lastFont.css;

  let embedded = '';
  if (chars) {
    const css = await fetchAs(FONT_CSS_URL + encodeURIComponent(chars), 'text');
    const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))];
    if (!urls.length) throw new Error('글꼴 주소를 찾지 못했어요');
    embedded = css;
    for (const url of urls) {
      embedded = embedded.split(url).join(await blobToDataURL(await fetchAs(url, 'blob')));
    }
  }
  if (araea) embedded += `\n${await araeaFontCSS()}`;
  lastFont = { key, css: embedded };
  return embedded;
}

// 1순위가 실패하면 2순위: html-to-image 가 페이지의 @font-face 를 통째로 싣는다(조각이 많아 느리다).
// 그것도 실패하면 글꼴 없이 그린다(null).
async function fontEmbedCSS(node, lib) {
  const started = Date.now();
  try {
    return await withTimeout(subsetFontCSS(node.textContent || ''), SUBSET_TIMEOUT, '글꼴 조각을 받는 데 너무 오래 걸려요');
  } catch (err) {
    console.warn('[postcard-image] 글꼴 조각을 받지 못했어요', err);
  }
  // 1순위가 '기다리다 지쳐서' 실패했다면 글꼴 서버에 닿지 않는 것이다 → 조각을 수십 개 받아야 하는 2순위는 건너뛴다
  if (Date.now() - started >= FETCH_TIMEOUT - 500) return null;
  try {
    return await withTimeout(lib.getFontEmbedCSS(node), EMBED_TIMEOUT, '글꼴을 싣는 데 너무 오래 걸려요');
  } catch (err) {
    console.warn('[postcard-image] 글꼴을 싣지 못했어요(기본 글꼴로 그립니다)', err);
  }
  return null;
}

/* ── 줄바꿈 굳히기 ─────────────────────────────────────────────────────────── */
// html-to-image 는 글자 크기를 조금 줄여서 옮긴다(소수점 아래를 버리고 0.1px 을 더 뺀다). 글자가 작은 휴대폰
// 화면에서는 그만큼 한 줄에 글자가 더 들어가, 그림의 줄바꿈이 화면에서 본 것과 달라진다.
// → 그리는 동안만 [data-capture-lines] 가 붙은 요소의 글을 '화면에 보이는 줄 그대로' 굳힌다:
//   줄이 바뀌는 자리마다 줄바꿈 글자를 넣고, 저절로는 줄이 바뀌지 않게(white-space: pre) 한다.

// 재는 동안만 조상들의 기울기 · 변형을 푼다(기울어진 종이 위에서는 글자 위치가 비스듬하게 재어진다).
// 재고 나서 곧바로 되돌리므로 화면에는 그려지지 않는다. 돌려받은 함수를 부르면 원래대로.
function flattenAncestors(node) {
  const touched = [];
  for (let el = node; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const bent = ['transform', 'rotate', 'scale'].filter((name) => style[name] && style[name] !== 'none');
    if (bent.length) touched.push({ el, names: [...bent, 'transition'] });
  }
  const keep = touched.map(({ el, names }) => names.map((name) => [el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]));
  touched.forEach(({ el, names }) => names.forEach((name) => el.style.setProperty(name, 'none', 'important')));

  const put = (el, name, [value, priority]) => (value ? el.style.setProperty(name, value, priority) : el.style.removeProperty(name));
  return () => {
    // 기울기를 먼저 되돌리고, 그 값이 자리 잡은 뒤에 transition 을 되돌린다(되돌아가는 모습이 움직임으로 그려지지 않게)
    touched.forEach(({ el, names }, i) => names.slice(0, -1).forEach((name, k) => put(el, name, keep[i][k])));
    touched.forEach(({ el }) => void getComputedStyle(el).transform);
    touched.forEach(({ el, names }, i) => put(el, 'transition', keep[i][names.length - 1]));
  };
}

// el 안의 글에서 '저절로 줄이 바뀐 자리'를 찾아 줄바꿈 글자를 넣은 글을 돌려준다: [[글 노드, 굳힌 글], …]
function frozenTexts(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const out = [];
  let line = null; // 지금 줄에 놓인 글자의 { top, bottom }
  for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
    const text = textNode.data;
    let frozen = '';
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const size = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length ? 2 : 1; // 이모지 등은 두 칸이 한 글자
      const ch = text.slice(i, i + size);
      i += size - 1;
      if (ch === '\n') {
        // 쓴 사람이 넣은 줄바꿈: 다음 글자는 어차피 새 줄에서 시작한다
        line = null;
      } else {
        range.setStart(textNode, i - size + 1);
        range.setEnd(textNode, i + 1);
        const rect = [...range.getClientRects()].find((r) => r.width > 0 && r.height > 0);
        if (rect) {
          // 앞 글자와 위아래로 절반도 겹치지 않으면 다음 줄로 넘어간 것이다
          const overlap = line ? Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top) : 0;
          const wrapped = Boolean(line) && overlap < Math.min(line.bottom - line.top, rect.height) / 2;
          if (wrapped) frozen += '\n';
          if (!line || wrapped) line = { top: rect.top, bottom: rect.bottom };
        }
      }
      frozen += ch;
    }
    out.push([textNode, frozen]);
  }
  return out;
}

// node 안의 [data-capture-lines] 요소를 화면에 보이는 줄 그대로 굳힌다. 돌려받은 함수를 부르면 원래대로 돌아간다.
// 굳힌 뒤에 높이가 달라졌다면(줄을 잘못 읽었다면) 그 요소는 굳히지 않고 둔다.
function freezeLines(node) {
  const undo = [];
  const thaw = () => undo.splice(0).reverse().forEach((fn) => fn());
  try {
    const targets = [...node.querySelectorAll('[data-capture-lines]')].filter((el) => el.getClientRects().length > 0);
    if (!targets.length) return thaw;

    const unflatten = flattenAncestors(node);
    let plans;
    try {
      plans = targets.map((el) => frozenTexts(el));
    } finally {
      unflatten();
    }

    targets.forEach((el, index) => {
      // 줄 안에 놓인 요소(span)라면 그 줄을 품은 상자의 높이로 견준다
      const box = getComputedStyle(el).display.startsWith('inline') && el.parentElement ? el.parentElement : el;
      const before = box.offsetHeight;
      const inline = [el.style.getPropertyValue('white-space'), el.style.getPropertyPriority('white-space')];
      const originals = plans[index].map(([textNode]) => textNode.data);
      const restore = () => {
        plans[index].forEach(([textNode, frozen], k) => {
          if (textNode.data === frozen) textNode.data = originals[k];
        });
        if (inline[0]) el.style.setProperty('white-space', inline[0], inline[1]);
        else el.style.removeProperty('white-space');
      };
      plans[index].forEach(([textNode, frozen]) => { textNode.data = frozen; });
      el.style.setProperty('white-space', 'pre');
      if (Math.abs(box.offsetHeight - before) > 1) restore();
      else undo.push(restore);
    });
  } catch (err) {
    thaw();
    console.warn('[postcard-image] 줄바꿈을 굳히지 못했어요(그대로 그립니다)', err);
  }
  return thaw;
}

/* ── 그리기 ───────────────────────────────────────────────────────────────── */

// 노드를 가로 width px 의 캔버스로 그린다.
//   [data-capture-skip]   이 붙은 요소는 언제나 빼고 그린다(화면 전용 장식)
//   [data-capture-detail] 이 붙은 요소는 light = true 일 때 뺀다(용량을 키우는 잔무늬)
//   [data-capture-lines]  가 붙은 요소의 글은 화면에 보이는 줄바꿈 그대로 그린다
//   background = 캔버스 바탕색(JPEG 는 투명을 담지 못하므로 종이색을 깐다)
async function draw(node, { width, light = false, background = '' }) {
  const lib = getLibrary();
  if (!node || !node.isConnected) throw new Error('그릴 엽서를 찾지 못했어요');

  await fontsReady(node);

  const size = sizeOf(node);
  const outW = Math.round(width);
  const options = {
    // 소수점 아래는 버린다(올리면 오른쪽 · 아래 끝에 빈 실선이 생긴다)
    width: Math.floor(size.width),
    height: Math.floor(size.height),
    // 결과 크기는 화면 배율(devicePixelRatio)에 맡기지 않고 직접 정한다: 배율 = 목표 가로 ÷ 엽서의 화면 가로.
    // (pixelRatio 에 소수를 주면 곱셈 오차로 1px 이 모자랄 수 있어, 같은 뜻의 canvasWidth · canvasHeight 로 준다)
    canvasWidth: outW,
    canvasHeight: Math.round((outW * size.height) / size.width),
    pixelRatio: 1,
    style: { margin: '0' },
  };
  options.filter = (el) =>
    !(el.nodeType === 1 && (el.hasAttribute('data-capture-skip') || (light && el.hasAttribute('data-capture-detail'))));
  if (background) options.backgroundColor = background;

  const css = await fontEmbedCSS(node, lib);
  if (css === null) options.skipFonts = true;
  else options.fontEmbedCSS = css;

  // 글꼴을 기다리는 사이에 엽서가 숨었을 수 있다 → 그리기 직전 · 사이 · 직후에 다시 확인한다
  assertUnchanged(node, size);
  // 글꼴을 싣지 못했을 때는 줄을 굳히지 않는다(그림이 폭이 다른 기본 글꼴로 그려지면 굳힌 줄이 옆으로 넘쳐 잘린다)
  const thaw = css === null ? () => {} : freezeLines(node);
  try {
    // Safari 는 첫 호출에서 글꼴 · 배경이 빠진 그림을 줄 때가 있다 → 한 번 그려서 버리고, 두 번째 결과를 쓴다
    const twice = lib.toCanvas(node, options).then(() => {
      assertUnchanged(node, size);
      return lib.toCanvas(node, options);
    });
    const canvas = await withTimeout(twice, RENDER_TIMEOUT, '엽서를 그리는 데 너무 오래 걸려요');
    assertUnchanged(node, size);
    return canvas;
  } finally {
    thaw();
  }
}

// data URL 에 담긴 원본 파일의 크기(바이트)
function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function resizeCanvas(source, width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((width * source.height) / source.width);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* ── 내보내는 함수 ─────────────────────────────────────────────────────────── */

// 저장용 PNG. 가로 1500px 이면 3:2 엽서는 1500 x 1000 이 된다.
export async function renderPNG(node, { width = 1500 } = {}) {
  const canvas = await draw(node, { width });
  return canvas.toDataURL('image/png');
}

// 메일용 JPEG. maxBytes 이하가 될 때까지 품질 → 크기 순으로 낮춘다.
// 끝내 맞추지 못하면 가장 작은 결과를 ok: false 와 함께 돌려준다(부르는 쪽이 판단한다).
export async function renderJPEG(node, { maxBytes = 30000, maxWidth = 560, light = true } = {}) {
  const background = getComputedStyle(node).getPropertyValue('--paper-50').trim() || '#fff';
  const base = await draw(node, { width: maxWidth, light, background });

  let smallest = null;
  for (const scale of JPEG_SCALES) {
    const canvas = scale === 1 ? base : resizeCanvas(base, Math.round(maxWidth * scale));
    for (const quality of JPEG_QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const shot = { dataUrl, bytes: dataUrlBytes(dataUrl), width: canvas.width, height: canvas.height, quality };
      if (shot.bytes <= maxBytes) return { ...shot, ok: true };
      if (!smallest || shot.bytes < smallest.bytes) smallest = shot;
    }
  }
  return { ...smallest, ok: false };
}

let lastObjectURL = ''; // 마지막으로 내려받은 그림의 주소(다음 그림을 만들 때 비운다)

// data URL 을 파일로 내려받는다(<a download>). 돌려주는 값: { started, url }
//   started = 내려받기를 시작했는가. download 를 모르는 옛 브라우저에서는 새 탭에 그림을 띄우고 false
//   url     = 같은 그림을 가리키는 주소(다음 download 때까지 살아 있다). 내려받기가 실제로 됐는지는 알 수 없어서
//             (앱 속 브라우저 등은 조용히 무시한다) 화면이 '새 탭에서 열기' 링크로 함께 내놓는다 → 길게 눌러 저장
export function download(dataUrl, filename) {
  let url = dataUrl;
  try {
    // 큰 그림은 data URL 그대로보다 Blob 주소가 안전하다
    const [head, body] = dataUrl.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
    lastObjectURL = url;
  } catch { /* 바꾸지 못하면 data URL 그대로 쓴다 */ }

  const link = document.createElement('a');
  link.href = url;
  if ('download' in link) {
    link.download = filename;
    link.rel = 'noopener';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    return { started: true, url };
  }
  if (!window.open(url, '_blank')) window.location.href = url;
  return { started: false, url };
}
