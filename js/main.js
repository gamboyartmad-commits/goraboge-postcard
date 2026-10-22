// main.js — index.html 진입점
// 순서: (언어 사전 · 데이터 · 섹션 모듈을 함께 받기 시작) → CDN 라이브러리 기다리기(최대 3초) → 언어 입히기(js/i18n.js — 한국어면 바로 끝)
//       → 인트로(모듈이 오는 대로) → 나머지 섹션 모듈 로드 → 도입 문구 → 엽서 쓰기
//       → 데이터 로드 → 인용·인터뷰 엽서·지도 → 등장 효과 → 스크롤 위치 재계산
// 각 섹션의 init 은 화면 위→아래(DOM) 순서로, ScrollTrigger 를 "바로"(await 없이) 만들어야 핀 간격이 맞는다.
// 섹션 모듈은 맨 바깥(함수 밖)에서 window.gsap · DOM 을 건드리지 말고 init 안에서만 쓴다.

import { loadI18n, t } from './i18n.js';
import { fetchData, fetchJSON, getConfig, hasScrollTrigger, initReveal, libsSettled, safeInit, showNote } from './shared.js';
import { init as initTrack } from './track.js';

// ✏️ 교체: 섹션 자리에 띄우는 안내(언어별 문구는 data/i18n/*.json 의 같은 키). 쓸 때 꺼내 읽는다(get) — 사전이 도착한 뒤의 언어로
const TEXT = {
  get dataError() { return t('common.data-error', '데이터를 불러오지 못했어요(로컬 서버로 열었는지 확인)'); },
  // JSON 파일을 고치다 쉼표·따옴표가 어긋난 경우(서버 문제가 아니다)
  get dataSyntaxError() { return t('common.data-syntax-error', '데이터 파일의 문법을 확인해 주세요(쉼표·따옴표 — 자세한 위치는 브라우저 콘솔)'); },
  get moduleError() { return t('common.module-error-section', '이 섹션의 스크립트를 불러오지 못했어요(브라우저 콘솔 확인)'); },
};
const $ = (selector) => document.querySelector(selector);

// 글자 조절판: 주소 끝에 ?tune 을 붙였을 때만 불러온다(css/theme.css '0.' 의 값을 화면에서 바로 바꿔 보고 복사 — js/tune.js)
if (/[?&]tune(?:[=&]|$)/.test(location.search)) import('./tune.js').then((mod) => mod.initTune()).catch((err) => console.error('[tune] 조절판을 불러오지 못했어요', err));
// 사진 보정판: 주소 끝에 ?photo 를 붙였을 때만(메인 화면 사진 · 인트로 배경의 색감 · 부분 보정 — js/photo.js)
if (/[?&]photo(?:[=&]|$)/.test(location.search)) import('./photo.js').then((mod) => mod.initPhoto()).catch((err) => console.error('[photo] 사진 보정판을 불러오지 못했어요', err));
// 글 편집 모드: 주소 끝에 ?edit 을 붙였을 때만(점선 상자의 글을 화면에서 고치고 index.html 에 저장 — js/edit.js)
if (/[?&]edit(?:[=&]|$)/.test(location.search)) import('./edit.js').then((mod) => mod.initEdit()).catch((err) => console.error('[edit] 편집 모드를 불러오지 못했어요', err));

// 성과 측정(js/track.js): 가장 먼저 — 광고로 들어온 정보(utm …)를 잡고, config.js 의 analytics 에 ID 가 있는 도구만 불러온다
try {
  initTrack();
} catch (err) {
  console.error('[track] 성과 측정을 시작하지 못했어요', err);
}

// 섹션 모듈을 하나씩 따로 불러온다 → 한 파일에 오류가 있어도 나머지 섹션은 그대로 돈다
const loadInit = (name) =>
  import(`./${name}.js`).then(
    (mod) => mod.init,
    (err) => {
      console.error(`[${name}] 모듈을 불러오지 못했어요`, err);
      return null;
    },
  );

// GSAP 에 ScrollTrigger 를 등록한다(둘 다 도착했을 때만 true). <script async> 라 ScrollTrigger 가 GSAP 보다 먼저 도착하면
// 저절로 등록되지 않는다 → 쓰기 전에 늘 이 함수를 거친다(이미 등록했으면 아무 일도 하지 않는다)
const useScrollTrigger = () => {
  if (!hasScrollTrigger()) return false;
  window.gsap.registerPlugin(window.ScrollTrigger);
  return true;
};

// 핀·스크럽의 시작/끝 위치를 다시 계산한다(글꼴·이미지가 늦게 도착하면 높이가 달라지므로)
// safe = true 면 스크롤이 멈춘 뒤로 미룬다(스크롤 도중에 화면이 튀지 않게)
const refresh = (safe = false) => {
  if (useScrollTrigger()) window.ScrollTrigger.refresh(safe);
};

// '목록으로'(index.html#interviews)처럼 # 이 붙은 주소로 들어온 경우:
// 핀 간격과 데이터로 그린 내용 때문에 페이지 길이가 바뀌므로, 다 그린 뒤 그 자리로 다시 데려간다
let userMoved = false;
['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((type) => {
  window.addEventListener(type, () => { userMoved = true; }, { once: true, passive: true });
});

function scrollToHash() {
  if (userMoved || location.hash.length < 2) return;
  // 새로고침·뒤로 가기는 브라우저가 기억해 둔 위치를 따른다
  const [nav] = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
  if (nav && nav.type !== 'navigate') return;
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch { /* 잘못 적힌 주소는 무시 */ }
  if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
}

// 지도에 찍을 장소 목록 파일(config.js 의 map.dataFile). 비어 있거나 글자가 아니면 기본 파일을 쓴다
const placesFile = () => {
  const file = getConfig().map.dataFile;
  return typeof file === 'string' && file.trim() ? file.trim() : 'data/places.json';
};

// 데이터가 필요한 섹션: 모듈이나 데이터를 불러오지 못했으면 섹션 안에 안내만 남긴다
function initWithData(name, initFn, root, result) {
  if (!initFn) {
    showNote(root, TEXT.moduleError);
    return;
  }
  if (result.status === 'fulfilled') {
    safeInit(name, initFn, root, result.value);
    return;
  }
  console.error(`[${name}] 데이터 로드 실패`, result.reason);
  showNote(root, result.reason instanceof SyntaxError ? TEXT.dataSyntaxError : TEXT.dataError);
}

// 위쪽 고정 목차(index.html 의 <nav data-topbar>): 지금 화면 가운데에 걸친 섹션의 링크에 aria-current 를 단다.
// 인트로(메인 화면까지)를 다 지나 첫 섹션의 윗변이 목차 아래에 닿으면 <html class="past-intro"> — CSS 가 이때 목차와 주황 테두리를 보여 준다
function initTopbar() {
  const bar = document.querySelector('[data-topbar]');
  const first = document.getElementById('write');
  if (!bar) return;
  const html = document.documentElement;
  let ticking = false;
  const check = () => {
    ticking = false;
    const space = bar.offsetHeight + bar.offsetTop;
    html.classList.toggle('past-intro', Boolean(first) && first.getBoundingClientRect().top <= space + 1);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  check();
  if (!('IntersectionObserver' in window)) return;
  const links = new Map([...bar.querySelectorAll('[data-spy]')].map((a) => [a.dataset.spy, a]));
  const mark = (id) => links.forEach((a, key) => {
    if (key === id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) mark(entry.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' }); // 화면 가운데 5% 띠에 들어온 섹션
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
  // 인트로로 돌아가면 표시를 지운다
  const intro = document.getElementById('intro');
  if (intro) new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.5) mark(''); }, { threshold: [0.5] }).observe(intro);
}

async function boot() {
  // 언어 사전(한국어가 아닐 때만 data/i18n/<언어>.json)도 함께 받기 시작한다 — 섹션을 시작하기 전에 기다린다
  const i18nReady = loadI18n();
  // 데이터와 섹션 모듈을 먼저 내려받기 시작한다(하나가 실패해도 나머지는 계속 진행).
  // 지도의 장소 목록은 config.js 의 map.dataFile(기본 data/places.json, .csv 로 끝나면 CSV 로 읽는다)
  const dataReady = Promise.allSettled([
    fetchJSON('data/quotes.json'),
    fetchJSON('data/interviews.json'),
    fetchData(placesFile()),
  ]);
  const [loadIntro, ...loadRest] = ['intro', 'quotes', 'postcards', 'map', 'maker', 'story'].map(loadInit);

  // CDN 라이브러리(GSAP · ScrollTrigger · Leaflet)는 <script async> 라 우리 코드보다 늦게 올 수 있다 → 올 때까지 기다린다.
  // 3초가 지나도 오지 않으면(답 없이 멈춘 CDN) 없는 채로 시작한다 — 각 섹션이 정적 배치 · 글 목록으로 내용을 보여 준다
  await libsSettled(3000);

  // 화면의 글자를 지금 언어로 바꾼 뒤에 섹션을 시작한다(인트로가 치수를 재기 전에 글이 정해져 있어야 한다).
  // 모든 섹션이 t() 로 문구를 꺼내므로 이 줄이 섹션 시작보다 앞에 있어야 한다(한국어면 바로 지나간다)
  await i18nReady;

  if (useScrollTrigger()) {
    // 모바일 주소창이 접히고 펴질 때마다 위치를 다시 계산하지 않는다(핀 구간에서 화면이 튀는 것 방지)
    window.ScrollTrigger.config({ ignoreMobileResize: true });
  }

  // HTML 에 이미 있는 [data-reveal] 요소는 데이터를 기다리지 않고 바로 살핀다
  initReveal();
  initTopbar();

  // 1. 인트로는 첫 화면이므로 자기 모듈이 오는 대로 바로 시작한다(다른 모듈을 기다리지 않는다. DOM 맨 위라 핀 순서도 그대로).
  // 인트로가 실패하면 정적 배치(.intro-static)로 내용을 보여 주고,
  // 플로팅 버튼이 계속 숨어 있지 않게(html[data-intro="active"]) '끝남'으로 바꿔 준다
  safeInit('intro', await loadIntro, $('#intro')).then((ok) => {
    if (ok) return;
    document.documentElement.classList.add('intro-static');
    document.documentElement.dataset.intro = 'done';
  });

  const [initQuotes, initPostcards, initMap, initMaker, initStory] = await Promise.all(loadRest);

  // 엽서 쓰기(플로팅 버튼·모달은 페이지 전체에 붙으므로 root 는 body). 데이터도 ScrollTrigger 도 쓰지 않으므로
  // 데이터를 기다리지 않고 먼저 붙인다(데이터의 답이 늦어도 버튼은 쓸 수 있게).
  // 불러오지 못했으면 '제주어 엽서 써보기' 단추가 아무 반응이 없으므로 섹션에 안내를 남긴다
  safeInit('maker', initMaker, document.body).then((ok) => {
    if (!ok) showNote($('#write'), TEXT.moduleError);
  });
  // '왜 제주어로'의 '이 말이 사라지면' 애니메이션: 마지막 단추 → 엽서 써보기(섹션 맨 위)로 스크롤
  if (initStory) safeInit('story', initStory, $('#write'));

  const [quotes, interviews, places] = await dataReady;

  // DOM 순서대로: 인용 → 인터뷰 엽서 → (엽서 쓰기) → 지도
  initWithData('quotes', initQuotes, $('#quotes'), quotes);
  initWithData('interviews', initPostcards, $('#interviews'), interviews);
  initWithData('map', initMap, $('#map'), places);

  initReveal();
  refresh();
  scrollToHash();
}

// 이미지·글꼴이 늦게 도착하면 높이가 달라진다 → 스크롤이 멈춘 틈에 다시 계산
const onLoad = () => {
  refresh(true);
  scrollToHash();
};
if (document.readyState === 'complete') onLoad();
else window.addEventListener('load', onLoad, { once: true });

if (document.fonts) {
  // 글꼴이 load 보다 늦게 도착하면 위쪽 섹션의 글줄이 바뀌어 # 위치가 어긋난다 → 페이지를 연 직후(5초 안)에는 한 번 더 데려간다
  const onFonts = () => {
    refresh(true);
    if (performance.now() < 5000) scrollToHash();
  };
  if (document.fonts.ready) document.fonts.ready.then(onFonts);
  // 나중에 그린 글자 때문에 뒤늦게 내려받는 글꼴 조각도 챙긴다
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
}

boot();
