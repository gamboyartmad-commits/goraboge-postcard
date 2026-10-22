// shared.js — 모든 페이지·섹션이 함께 쓰는 작은 도구 모음
// CDN 전역(gsap, ScrollTrigger …)은 항상 window. 로 확인하고, 없을 때를 대비한다.

/* ── 환경 확인 ─────────────────────────────────────────────── */

// 사용자가 '동작 줄이기'를 켰는가
export const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// GSAP 을 쓸 수 있는가 (CDN 로드 실패 시 false → 정적 레이아웃으로 보여 준다)
export const hasGSAP = () => Boolean(window.gsap);

// GSAP + ScrollTrigger 를 모두 쓸 수 있는가
export const hasScrollTrigger = () => Boolean(window.gsap && window.ScrollTrigger);

// CDN 라이브러리(<head> 의 <script async data-lib>)가 도착했거나 실패할 때까지 기다린다.
// ms 가 지나도 답이 없으면 더 기다리지 않는다 → 없는 채로 정적 화면을 보여 준다(답 없이 멈춘 CDN 때문에 페이지 전체가 서지 않게)
export function libsSettled(ms = 3000) {
  const pending = [...document.querySelectorAll('script[data-lib]')].filter((script) => !script.dataset.done);
  if (!pending.length) return Promise.resolve();
  const settled = pending.map((script) => new Promise((resolve) => {
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', resolve, { once: true });
  }));
  return Promise.race([Promise.all(settled), new Promise((resolve) => setTimeout(resolve, ms))]);
}

// config.js 의 설정을 안전하게 읽는다 (파일이 없거나 항목이 빠져도 기본값으로 채움)
export function getConfig() {
  const cfg = window.JEJU_CONFIG || {};
  return {
    site: { name: '하영 고라보게', ...cfg.site },
    links: { postcard: '', english: '', ...cfg.links },
    emailjs: { serviceId: '', templateId: '', publicKey: '', imageMode: 'inline', ...cfg.emailjs },
    map: { tiles: 'eox', cartoKey: '', dataFile: 'data/places.json', listFirst: 3, listFirstPhone: 2, ...cfg.map },
    quotes: { autoplay: 5, ...cfg.quotes },
    analytics: { ga4: '', gtm: '', googleAds: '', googleAdsLabel: '', meta: '', kakao: '', linkDomains: [], ...cfg.analytics },
  };
}

/* ── 데이터 · 문자열 · 숫자 ─────────────────────────────────── */

// JSON 파일 읽기. 실패하면 throw → 호출한 쪽에서 안내 문구 등으로 처리한다.
// 답이 10초 넘게 오지 않아도 실패로 본다(끊기는 회선에서 빈 화면으로 멈춰 있지 않게)
export function fetchJSON(path) {
  const load = fetch(path).then((res) => {
    if (!res.ok) throw new Error(`${path} 을(를) 불러오지 못했습니다 (HTTP ${res.status})`);
    return res.json();
  });
  return withTimeout(load, 10000, `${path} 의 응답이 늦어요`);
}

// 데이터 파일 읽기: 이름이 .csv 로 끝나면 CSV(표)로 읽어 JSON 과 같은 모양(객체의 배열)으로 돌려주고, 그 밖에는 JSON 으로 읽는다.
// CSV 를 푸는 코드(js/csv.js)는 CSV 를 쓸 때만 내려받는다. 실패하면 fetchJSON 처럼 throw
export function fetchData(path) {
  const file = String(path ?? '').trim();
  if (!/\.csv$/i.test(file.split(/[?#]/)[0])) return fetchJSON(file);
  const load = Promise.all([fetch(file), import('./csv.js')]).then(async ([res, csv]) => {
    if (!res.ok) throw new Error(`${file} 을(를) 불러오지 못했습니다 (HTTP ${res.status})`);
    return csv.readCSV(await res.arrayBuffer());
  });
  return withTimeout(load, 10000, `${file} 의 응답이 늦어요`);
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// 사용자 입력·데이터를 innerHTML 에 넣기 전에 반드시 거친다
export const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// 약속이 ms 안에 끝나지 않으면 실패(throw)로 바꾼다 — '…하는 중' 에서 멈춰 있지 않게
export function withTimeout(promise, ms, message = `${ms}ms 안에 끝나지 않았어요`) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 한국 시간 기준 오늘 날짜 → '2026.10.12'
export function todayKR(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const pick = (type) => parts.find((p) => p.type === type).value;
    return `${pick('year')}.${pick('month')}.${pick('day')}`;
  } catch {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  }
}

/* ── 섹션 초기화 도우미 ─────────────────────────────────────── */

// 한 섹션의 오류가 다른 섹션을 막지 않도록 감싸서 실행한다(init 은 부르는 즉시 실행된다).
// 결과는 Promise<boolean> — 성공하면 true, 자리·모듈이 없거나 오류가 나면 false
export function safeInit(name, initFn, root, data, options) {
  if (!root) {
    console.warn(`[${name}] 넣을 자리를 찾지 못해 건너뜁니다.`);
    return Promise.resolve(false);
  }
  // 모듈을 불러오지 못한 경우(오류는 불러온 쪽에서 이미 콘솔에 남겼다)
  if (typeof initFn !== 'function') return Promise.resolve(false);
  const fail = (err) => {
    console.error(`[${name}] 초기화 중 오류`, err);
    return false;
  };
  try {
    return Promise.resolve(initFn(root, data, options)).then(() => true, fail);
  } catch (err) {
    return Promise.resolve(fail(err));
  }
}

// 섹션 안에 안내 쪽지를 붙인다 (데이터 로드 실패 등).
// 섹션에는 .has-note 가 붙는다 → 섹션 CSS 가 미리 잡아 둔 자리를 거두는 데 쓴다(예: css/quotes.css 7번)
export function showNote(root, message) {
  if (!root) return null;
  const note = document.createElement('p');
  note.className = 'placeholder-note';
  note.setAttribute('role', 'status');
  note.textContent = message;
  root.append(note);
  root.classList.add('has-note');
  return note;
}

/* ── 등장 효과 ─────────────────────────────────────────────── */

const REVEAL_PENDING = '[data-reveal]:not(.is-in)';
let revealObserver = null;
let revealWatcher = null;

// 나중에 끼워 넣은 [data-reveal] 요소(데이터로 그린 목록 등)도 알아서 살핀다
function watchNewReveals() {
  if (revealWatcher || !('MutationObserver' in window) || !document.body) return;
  revealWatcher = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) initReveal(node);
    }));
  });
  revealWatcher.observe(document.body, { childList: true, subtree: true });
}

// [data-reveal] 요소가 화면에 들어오면 .is-in 을 붙인다. 여러 번 불러도 된다.
export function initReveal(root = document) {
  const scope = root || document;
  const html = document.documentElement;

  if (!html.classList.contains('reveal-on')) {
    // base.css 의 '3.5초 뒤 자동 표시' 안전장치가 이미 보여 준 요소는 그대로 둔다(다시 숨기면 깜빡인다)
    document.querySelectorAll(REVEAL_PENDING).forEach((el) => {
      if (getComputedStyle(el).opacity === '1') el.classList.add('is-in');
    });
    // 이제부터 스크립트가 책임진다 → 안전장치를 끈다
    html.classList.add('reveal-on');
  }

  const items = [...scope.querySelectorAll(REVEAL_PENDING)];
  if (scope instanceof Element && scope.matches(REVEAL_PENDING)) items.unshift(scope);

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
  } else {
    if (!revealObserver) {
      // 화면 아래쪽 10% 띠를 지나 올라오면 등장(threshold 0: 화면보다 훨씬 긴 요소도 놓치지 않는다)
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    }
    items.forEach((el) => revealObserver.observe(el));
  }

  watchNewReveals();
}

/* ── 소인(우체국 도장) SVG ──────────────────────────────────── */

// SVG 안의 '인쇄된' 글자에 쓰는 기기 기본 글꼴(소인 · 엽서의 우표와 아래 인쇄 글자)
export const SVG_FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
let postmarkCount = 0;

// 한글은 넓고 영문·숫자는 좁다 → 글자 폭을 대강 어림한다(가운데 날짜가 원 밖으로 나가지 않게)
const visualLength = (str) => [...str].reduce((sum, ch) => sum + (/[\u1100-\uffff]/.test(ch) ? 1 : 0.6), 0);

// postmarkSVG({ top: 'JEJU', bottom: '제주', date: '2026.10.12', size: 220 }) → '<svg …>' 문자열
// 이중 원 + 둘레 글자 + 가운데 날짜 + 오른쪽 물결선 4줄. 색은 currentColor(.postmark 가 정한다).
// size 는 가로 px(생략하면 감싼 요소의 폭을 따른다).
export function postmarkSVG({ top = 'JEJU', bottom = '제주', date = todayKR(), size } = {}) {
  const id = `postmark-${++postmarkCount}`;
  const W = 260;
  const H = 120;
  const dateText = String(date ?? ''); // JSON 에서 null 이 와도 'null' 이라고 찍지 않는다
  const dateSize = Math.min(13, 62 / Math.max(visualLength(dateText), 1)).toFixed(1);
  const px = parseFloat(size); // 200, '200', '200px' 모두 받는다
  const sizeAttr = Number.isFinite(px) && px > 0 ? ` width="${px}" height="${Math.round((px * H) / W)}"` : '';
  // 물결선 4줄: 원의 오른쪽에서 시작해 오른쪽 끝까지
  const waves = [33, 51, 69, 87]
    .map((y, i) => `<path d="M${i % 3 === 0 ? 121 : 125} ${y}q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0 16 0"/>`)
    .join('');

  return `<svg class="postmark__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${sizeAttr} fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true" focusable="false">
  <defs>
    <path id="${id}-top" d="M17.5 60A42.5 42.5 0 0 1 102.5 60"/>
    <path id="${id}-bottom" d="M9.5 60A50.5 50.5 0 0 0 110.5 60"/>
  </defs>
  <circle cx="60" cy="60" r="56" stroke-width="2.6" stroke-linecap="butt" stroke-dasharray="118 1.6 96 2.4 70 1.2 62 0"/>
  <circle cx="60" cy="60" r="37" stroke-width="1.5" stroke-linecap="butt" stroke-dasharray="74 1.4 58 1 99 0"/>
  <path d="M25.5 49.5h69M25.5 70.5h69" stroke-width="1.5"/>
  <g stroke-width="2.3">${waves}</g>
  <g fill="currentColor" stroke="none" font-family="${SVG_FONT}" font-weight="700" text-anchor="middle">
    <circle cx="13.5" cy="60" r="1.9"/>
    <circle cx="106.5" cy="60" r="1.9"/>
    <path d="M60 31.5l1.9 4.1 4.5.5-3.3 3.1.9 4.4-4-2.2-4 2.2.9-4.4-3.3-3.1 4.5-.5z"/>
    <path d="M52 81.5q4-3.4 8 0t8 0" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <text font-size="11.5" letter-spacing="2.4"><textPath href="#${id}-top" startOffset="50%">${escapeHTML(top)}</textPath></text>
    <text font-size="11.5" letter-spacing="2.4"><textPath href="#${id}-bottom" startOffset="50%">${escapeHTML(bottom)}</textPath></text>
    <text x="60" y="64.6" font-size="${dateSize}" letter-spacing="0.3">${escapeHTML(dateText)}</text>
  </g>
</svg>`;
}

/* ── 우표 그림 SVG ─────────────────────────────────────────── */

// 단순한 선화 아이콘. 선 색은 currentColor(.stamp 의 --stamp-fg 를 따른다).
const STAMP_ART = {
  // 작은 가게: 지붕 + 물결 차양 + 문 + 창
  shop: '<path d="M5 22 24 8l19 14"/><path d="M10 19v21h28V19"/><path d="M10 25q3.5 4.5 7 0 3.5 4.5 7 0 3.5 4.5 7 0 3.5 4.5 7 0"/><path d="M19 40v-8h7v8"/><path d="M30 32h4.5v4.5H30z"/>',
  // 오름 능선과 해
  oreum: '<circle cx="35" cy="13" r="4.5"/><path d="M3 38c7-1 10-14 16-15q5 3.2 10 0c6 1 9 14 16 15"/><path d="M3 38h42"/><path d="M14 43h8M27 43h9"/>',
  // 감귤과 잎
  tangerine: '<circle cx="23" cy="29" r="13"/><path d="M23 16v-4"/><path d="M23.5 13c3-7 11-7.5 15-5-2.5 5.5-9.5 7.5-15 5z"/><path d="M19.5 20q3.5 2 7 0"/><path d="M14.5 29a8.5 8.5 0 0 1 3.5-6.5"/>',
  // 파도: 말려 오르는 물마루 + 잔물결
  wave: '<path d="M3 30c7 0 9-15 20-15 8 0 11 7 6.5 10.5-3 2.2-6-.5-4.5-3"/><path d="M29.5 25.5c4 3.5 9 4.5 15.5 4.5"/><path d="M3 38q5.25-4.5 10.5 0t10.5 0 10.5 0 10.5 0"/>',
  // 편지봉투
  letter: '<path d="M6 12h36v25H6z"/><path d="M6.5 13 24 27l17.5-14"/><path d="M6.5 36.5 19 24M41.5 36.5 29 24"/>',
};

// stampSVG('shop' | 'oreum' | 'tangerine' | 'wave' | 'letter') → '<svg …>' 문자열 (.stamp 안에 넣는다)
export function stampSVG(kind = 'letter') {
  const art = STAMP_ART[kind] || STAMP_ART.letter;
  return `<svg class="stamp__art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${art}</svg>`;
}

/* ── 우표 · 소인 자리 채우기 ───────────────────────────────── */

// HTML 에 적어 둔 <span class="stamp" data-stamp="tangerine"> 에 우표 그림을,
// <span class="postmark" data-postmark="가운데 글자" data-top="…" data-bottom="…"> 에 소인을 그려 넣는다.
// date = data-postmark 가 비어 있을 때 가운데에 찍을 글자
export function fillStampsAndPostmarks(root, { date = '' } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-stamp]').forEach((el) => {
    if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', stampSVG(el.dataset.stamp));
  });
  root.querySelectorAll('[data-postmark]').forEach((el) => {
    if (el.querySelector('svg')) return;
    el.innerHTML = postmarkSVG({
      date: el.dataset.postmark || date,
      top: el.dataset.top || 'JEJU',
      bottom: el.dataset.bottom || '제주',
    });
  });
}
