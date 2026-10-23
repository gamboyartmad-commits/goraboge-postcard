// track.js — 성과 측정(광고 · 방문 분석). 세 페이지(index · 기사 · 개인정보처리방침)가 함께 쓴다.
// ① config.js 의 analytics 에 ID 를 넣은 도구만 불러온다: Google 애널리틱스 4 · Google 태그 관리자 · Google 광고 · Meta 픽셀 · 카카오 픽셀.
//    ID 가 하나도 없으면 아무 데도 보내지 않는다(개인정보처리방침 5 · 6절도 실제로 쓰는 도구에 맞춰 고친다).
// ② 사이트에서 일어나는 중요한 행동(이벤트)을 한곳에서 보낸다 — 이름과 값은 README '성과 측정'의 표.
//    가장 중요한 전환 = cta_click('제주어 엽서 써보기'를 누름) → Google 광고 전환 · Meta 'Lead' · 카카오 '참여'로도 보낸다.
// ③ 광고로 들어온 정보(utm_… · gclid · fbclid)를 이 탭이 열려 있는 동안 기억해, 엽서 쓰기 사이트(links.postcard)로 넘어갈 때 주소에 붙여 준다.
// ④ (30차) 섹션마다 머문 시간(section_time) · 누른 단추 모두(ui_click) · 웹진 ↔ 엽서 사이트 교차 도메인(analytics.linkDomains) ·
//    웹진 안에 띄운 엽서 사이트의 이벤트 받기(trackFromPostcard — js/play.js)
// 확인: 주소 끝에 ?track-debug 를 붙이면 보낸 이벤트가 화면 왼쪽 아래와 브라우저 콘솔에 뜬다(도구 ID 가 없어도 뜬다).

import { getConfig } from './shared.js';

const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
const STORE_KEY = 'hayeong-campaign';
// 도구 ID 의 꼴(틀린 값은 불러오지 않고 콘솔에 알린다)
const ID_RULES = {
  ga4: /^G-[A-Z0-9]{4,}$/,
  gtm: /^GTM-[A-Z0-9]{4,}$/,
  googleAds: /^AW-\d{5,}$/,
  meta: /^\d{6,}$/,
  kakao: /^\d{6,}$/,
};

const state = { started: false, debug: false, ids: {}, adsLabel: '', campaign: null, log: null, sent: [] };

/* ── 광고 유입 정보 ─────────────────────────────────────────────── */

// 이번 방문의 광고 정보: 주소에 있으면 그 값(새 광고 클릭), 없으면 이 탭에서 앞서 기억한 값
export function getCampaign() {
  if (state.campaign) return state.campaign;
  const params = new URLSearchParams(location.search);
  const found = {};
  CAMPAIGN_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) found[key] = value.slice(0, 200);
  });
  if (Object.keys(found).length) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(found)); } catch { /* 저장소를 못 쓰면 이 페이지에서만 */ }
    state.campaign = found;
    return found;
  }
  try {
    state.campaign = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {};
  } catch {
    state.campaign = {};
  }
  return state.campaign;
}

// 광고(utm · gclid · fbclid)로 들어왔는지
export const fromAd = () => Object.keys(getCampaign()).length > 0;

// 엽서 쓰기 사이트로 가는 주소에 유입 정보를 붙인다: 광고로 들어왔으면 그 광고의 값 그대로,
// 아니면 '웹진에서 왔다'(utm_source=hayeong-webzine · utm_medium=referral · utm_content=누른 단추 자리). 주소에 이미 있는 값은 덮지 않는다
export function withCampaign(link, location_ = '') {
  try {
    const url = new URL(link, window.location.href);
    const campaign = getCampaign();
    const add = Object.keys(campaign).length
      ? campaign
      : { utm_source: 'hayeong-webzine', utm_medium: 'referral', ...(location_ ? { utm_content: location_ } : {}) };
    Object.entries(add).forEach(([key, value]) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    return url.href;
  } catch {
    return link;
  }
}

/* ── 보내기 ─────────────────────────────────────────────────────── */

// 이벤트 하나를 켜 둔 도구 모두에 보낸다. name = 영문 소문자 · 밑줄(예: cta_click), params = 값(글자 · 숫자)
export function track(name, params = {}) {
  const data = { ...params, page: pageName() };
  const { ids } = state;
  // Google 태그 관리자: dataLayer 에 { event: 이름, …값 } (GTM 안에서 '맞춤 이벤트' 트리거로 받는다)
  if (ids.gtm) window.dataLayer.push({ event: name, ...data });
  // Google 애널리틱스 4 · Google 광고(gtag)
  if (typeof window.gtag === 'function' && (ids.ga4 || ids.googleAds)) {
    if (ids.ga4) window.gtag('event', name, data);
    if (name === 'cta_click' && ids.googleAds && state.adsLabel) window.gtag('event', 'conversion', { send_to: `${ids.googleAds}/${state.adsLabel}` });
  }
  // Meta 픽셀: 엽서 써보기 = 표준 이벤트 'Lead', 나머지는 맞춤 이벤트
  if (ids.meta && typeof window.fbq === 'function') {
    if (name === 'cta_click') window.fbq('track', 'Lead', data);
    else window.fbq('trackCustom', name, data);
  }
  // 카카오 픽셀: 엽서 써보기 = '참여'(participation). 카카오는 맞춤 이벤트가 없어 나머지는 보내지 않는다
  if (ids.kakao && name === 'cta_click' && typeof window.kakaoPixel === 'function') {
    try {
      const kp = window.kakaoPixel(ids.kakao);
      if (typeof kp.participation === 'function') kp.participation();
    } catch (err) {
      console.warn('[track] 카카오 픽셀 이벤트를 보내지 못했어요', err);
    }
  }
  state.sent.push({ name, data, at: Date.now() });
  if (state.debug) showDebug(name, data);
}

// 쪽 이름 = 사이트 맨 위(이 파일은 js/ 안)부터의 경로: index · articles/interview01 · play/postcard · en · privacy
const SITE_PATH = new URL('../', import.meta.url).pathname;
const pageName = () => {
  let path = location.pathname.startsWith(SITE_PATH) ? location.pathname.slice(SITE_PATH.length) : location.pathname.split('/').pop();
  path = path.replace(/index\.html?$/i, '').replace(/\.html?$/i, '').replace(/\/$/, '');
  return path || 'index';
};

/* ── 도구 불러오기 ──────────────────────────────────────────────── */

function loadScript(src, onload) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  if (onload) script.addEventListener('load', onload);
  script.addEventListener('error', () => console.warn(`[track] 측정 도구를 불러오지 못했어요(광고 차단 프로그램일 수 있어요): ${src}`));
  document.head.append(script);
}

function readIds() {
  const cfg = getConfig().analytics;
  const ids = {};
  Object.entries(ID_RULES).forEach(([key, rule]) => {
    const value = String(cfg[key] ?? '').trim();
    if (!value) return;
    if (rule.test(value)) ids[key] = value;
    else console.warn(`[track] config.js 의 analytics.${key} 값(${value})의 꼴이 맞지 않아 불러오지 않았어요`);
  });
  state.adsLabel = String(cfg.googleAdsLabel ?? '').trim();
  return ids;
}

function loadTools(ids) {
  window.dataLayer = window.dataLayer || [];
  // (35차) 페이지 <head> 에 GTM 기본 코드가 이미 있으면(같은 ID) 다시 부르지 않는다 — 이벤트는 track() 이 dataLayer 로 보낸다
  if (ids.gtm && !document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${ids.gtm}"]`)) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(ids.gtm)}`);
  }
  if (ids.ga4 || ids.googleAds) {
    // gtag 는 arguments 를 그대로 넣어야 한다(배열로 바꾸면 Google 태그가 읽지 못한다)
    window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date());
    // 페이지 보기(page_view)는 이 줄이 보낸다. linker = 엽서 사이트 등 다른 도메인으로 가는 링크에 _gl 을 붙여 같은 방문으로 이어 본다(30차)
    const domains = (getConfig().analytics.linkDomains || []).filter((d) => typeof d === 'string' && d);
    if (ids.ga4) window.gtag('config', ids.ga4, domains.length ? { linker: { domains } } : {});
    if (ids.googleAds) window.gtag('config', ids.googleAds);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4 || ids.googleAds)}`);
  }
  if (ids.meta && !window.fbq) {
    // Meta 픽셀 기본 코드(fbevents.js 가 오기 전의 호출은 줄 세워 두었다가 보낸다)
    const fbq = function fbq() { // eslint-disable-line func-names
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments); // eslint-disable-line prefer-rest-params
      else fbq.queue.push(arguments); // eslint-disable-line prefer-rest-params
    };
    Object.assign(fbq, { push: fbq, loaded: true, version: '2.0', queue: [] });
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    window.fbq('init', ids.meta);
    window.fbq('track', 'PageView');
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  if (ids.kakao) {
    loadScript('https://t1.daumcdn.net/kas/static/kp.js', () => {
      try {
        window.kakaoPixel(ids.kakao).pageView();
      } catch (err) {
        console.warn('[track] 카카오 픽셀을 시작하지 못했어요', err);
      }
    });
  }
}

/* ── 저절로 재는 것 ─────────────────────────────────────────────── */

// 섹션을 봤는지(화면 가운데 띠에 들어오면 한 번): data-track-section 이 붙은 요소, 없으면 main 바로 아래의 id 있는 section
function watchSections() {
  if (!('IntersectionObserver' in window)) return;
  const seen = new Set();
  const targets = [...document.querySelectorAll('[data-track-section], main > section[id], .write__why[id], footer.site-footer')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.dataset.trackSection || entry.target.id || 'footer';
      if (seen.has(id)) return;
      seen.add(id);
      observer.unobserve(entry.target);
      track('section_view', { section: id });
    });
  }, { rootMargin: '-40% 0px -45% 0px' });
  targets.forEach((el) => observer.observe(el));
}

// 체류 시간(21차): 이 페이지를 실제로 보고 있는 시간만 센다 — 탭이 보일 때만, 30초 넘게 아무 움직임(스크롤 · 마우스 · 손가락 · 키)이 없으면 멈춘다.
//   ① dwell_milestone: 10 · 30 · 60 · 120 · 300 · 600초가 될 때마다 한 번씩(떠날 때 보내는 값이 잘려도 어디까지 봤는지 남는다)
//   ② page_time: 페이지를 떠나거나 다른 탭 · 앱으로 갈 때 그때까지의 총 시간(seconds). 돌아왔다 다시 떠나면 늘어난 총 시간을 다시 보낸다
//   ③ section_time(30차): 섹션마다 머문 시간 — 화면 한가운데 줄에 걸친 섹션에 시간을 쌓아 두었다가, 떠날 때 · 다른 탭으로 갈 때 ·
//      한 번에 60초가 넘게 쌓였을 때 섹션마다 그동안 늘어난 초(seconds)를 보낸다 → GA4 에서 섹션별로 seconds 를 더하면 총 머문 시간
//   GA4 에서 숫자로 모으려면 관리 > 맞춤 정의에서 seconds 를 '맞춤 측정항목', section · button 을 '맞춤 측정기준'으로 등록한다(README '성과 측정')
const DWELL_MARKS = [10, 30, 60, 120, 300, 600];
const IDLE_MS = 30000;
const activity = { lastMove: performance.now(), resumed: false };
// 사용자가 움직였다(스크롤 · 마우스 · 손가락 · 키, 또는 웹진 안에 띄운 엽서 사이트 안에서 — js/play.js 가 알린다)
export function markActive() {
  const now = performance.now();
  if (now - activity.lastMove >= IDLE_MS) activity.resumed = true; // 자리를 비웠던 시간은 빼고 다시 센다
  activity.lastMove = now;
}
function watchDwell() {
  let active = 0;
  let last = performance.now();
  let sentTotal = -1;
  const done = new Set();
  const sectionAcc = new Map(); // 섹션 → 아직 보내지 않은 밀리초
  let current = '';
  // iframe(엽서 쓰러가기 쪽의 바깥 엽서 사이트 등) 안을 누르고 쓰는 동안은 이 쪽에 움직임이 오지 않는다 → 그 안에 포커스가 있으면 보는 중으로 센다
  const inFrame = () => Boolean(document.activeElement && document.activeElement.tagName === 'IFRAME');
  const counting = () => !document.hidden && (inFrame() || performance.now() - activity.lastMove < IDLE_MS);
  const sectionOf = (el) => el.dataset.trackSection || el.id || (el.matches('footer') ? 'footer' : 'other');
  const tick = () => {
    const now = performance.now();
    if (activity.resumed) { activity.resumed = false; last = now; }
    if (counting()) {
      const d = Math.min(now - last, 2000); // 멈췄다 돌아온 틈(절전 · 백그라운드)은 세지 않는다
      active += d;
      if (current) sectionAcc.set(current, (sectionAcc.get(current) || 0) + d);
    }
    last = now;
    const sec = active / 1000;
    DWELL_MARKS.forEach((mark) => {
      if (sec >= mark && !done.has(mark)) {
        done.add(mark);
        track('dwell_milestone', { seconds: mark });
      }
    });
    let pending = 0;
    sectionAcc.forEach((ms) => { pending += ms; });
    if (pending >= 60000) flushSections('interval');
  };
  const flushSections = (reason) => {
    sectionAcc.forEach((ms, section) => {
      const seconds = Math.round(ms / 1000);
      if (seconds < 1) return;
      track('section_time', { section, seconds, reason });
      sectionAcc.set(section, ms - seconds * 1000);
    });
  };
  const flush = (reason) => {
    tick();
    flushSections(reason);
    const total = Math.round(active / 1000);
    if (total <= 0 || total === sentTotal) return;
    sentTotal = total;
    track('page_time', { seconds: total, reason });
  };
  // 지금 섹션 = 화면 한가운데 줄에 걸친 섹션(index 의 main > section[id] · 푸터, 기사 · 다른 쪽은 data-track-section)
  if ('IntersectionObserver' in window) {
    const targets = [...document.querySelectorAll('[data-track-section], main > section[id], .write__why[id], footer.site-footer')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) current = sectionOf(entry.target);
        else if (current === sectionOf(entry.target)) current = '';
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    targets.forEach((el) => io.observe(el));
    if (!targets.length) current = pageName();
  }
  ['scroll', 'pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((type) => window.addEventListener(type, markActive, { passive: true }));
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush('hidden');
    else { last = performance.now(); activity.lastMove = last; }
  });
  window.addEventListener('pagehide', () => flush('leave'));
}

// 얼마나 내려 읽었는지: 25 · 50 · 75 · 90%(한 번씩)
function watchScrollDepth() {
  const marks = [25, 50, 75, 90];
  const done = new Set();
  let ticking = false;
  const check = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    const pct = (scrollY / max) * 100;
    marks.forEach((mark) => {
      if (pct >= mark && !done.has(mark)) {
        done.add(mark);
        track('scroll_depth', { percent: mark });
      }
    });
    if (done.size === marks.length) window.removeEventListener('scroll', onScroll);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(check);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

// 누르는 것들(한 곳에서 — 잡는 단계에서 들어 링크가 페이지를 떠나기 전에 보낸다)
function watchClicks() {
  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return;
    // ① 제주어 엽서 써보기(섹션 단추 · 플로팅 버튼 · 영상 끝 단추) — 전환
    const cta = el.closest('[data-open-maker], [data-track-cta]');
    if (cta) {
      track('cta_click', { location: cta.dataset.trackLocation || (cta.closest('section[id]') || {}).id || 'other' });
      return;
    }
    const link = el.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    // ② 인터뷰 기사 열기
    const interview = /interview-?(\d+)\.html$/i.exec(url.pathname);
    if (interview && url.origin === location.origin) {
      track('interview_open', { interview: interview[1], location: (link.closest('section[id]') || {}).id || pageName() });
      return;
    }
    // ③ 목차(메인 화면 · 위쪽 고정 목차)
    if (link.closest('.front__toc, .topbar')) {
      track('nav_click', { target: url.hash.replace('#', ''), menu: link.closest('.topbar') ? 'topbar' : 'front' });
      return;
    }
    // ④ 외국인 웹진(en/)으로 넘어감 — 서브 메인 → 외국인 웹진 흐름을 따로 센다(넘어간 뒤의 체류 시간은 en 쪽 page_time · dwell_milestone)
    if (url.origin === location.origin && /\/en\/(index\.html)?$/.test(url.pathname) && !/\/en\//.test(location.pathname)) {
      track('en_open', { location: link.closest('.site-footer') ? 'footer' : link.closest('[data-lang-switch]') ? 'lang' : (link.closest('section[id]') || {}).id || pageName() });
      return;
    }
    // ⑤ 바깥 사이트로 가는 링크
    if (url.origin !== location.origin && /^https?:$/.test(url.protocol)) track('outbound_click', { url: `${url.hostname}${url.pathname}`.slice(0, 100) });
  }, true);
}

// 누른 단추 · 링크 모두(30차): ui_click { button: 이름, section: 있던 섹션 }. 이름 = data-track-label → id → aria-label → 보이는 글자(40자)
// (어느 단추를 많이 누르는지 한눈에 — 위의 cta_click · nav_click 같은 뜻 있는 이벤트와 함께 간다)
function watchAllClicks() {
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) return; // 사람이 누른 것만(스크립트가 대신 누르는 것은 빼고)
    const el = event.target instanceof Element ? event.target.closest('button, a[href], [role="button"], summary, label[for]') : null;
    if (!el) return;
    const label = (el.dataset.trackLabel || el.id || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) || el.tagName.toLowerCase();
    const host = el.closest('[data-track-section], section[id], footer, header, nav, [role="dialog"], dialog');
    const section = host ? (host.dataset.trackSection || host.id || host.tagName.toLowerCase()) : 'page';
    track('ui_click', { button: label, section });
  }, true);
}

// 웹진 안에 띄운 엽서 사이트(js/play.js)가 넘겨준 이벤트: 이름은 pc_ 로 시작하는 것만, 값은 글자 · 숫자만(80자)
export function trackFromPostcard(name, params) {
  if (typeof name !== 'string' || !/^pc_[a-z0-9_]{1,36}$/.test(name)) return;
  const data = { source: 'postcard_site' };
  Object.entries(params && typeof params === 'object' ? params : {}).slice(0, 12).forEach(([key, value]) => {
    if (!/^[a-z0-9_]{1,30}$/.test(key)) return;
    if (typeof value === 'number' && Number.isFinite(value)) data[key] = value;
    else if (typeof value === 'string' || typeof value === 'boolean') data[key] = String(value).slice(0, 80);
  });
  track(name, data);
}

/* ── 확인용 화면(?track-debug) ──────────────────────────────────── */

function showDebug(name, data) {
  console.info('[track]', name, data);
  if (!state.log) {
    state.log = document.createElement('ol');
    state.log.setAttribute('aria-hidden', 'true');
    state.log.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;max-width:min(92vw,360px);margin:0;padding:8px 10px 8px 26px;'
      + 'border-radius:8px;background:rgb(20 20 24/.86);color:#e8f7ec;font:12px/1.45 ui-monospace,Menlo,monospace;pointer-events:none';
    document.body.append(state.log);
  }
  const item = document.createElement('li');
  const values = Object.entries(data).filter(([key]) => key !== 'page').map(([key, value]) => `${key}=${value}`).join(' ');
  item.textContent = `${name}${values ? ` · ${values}` : ''}`;
  state.log.append(item);
  while (state.log.children.length > 8) state.log.firstElementChild.remove();
}

/* ── 시작 ──────────────────────────────────────────────────────── */

export function init() {
  if (state.started) return;
  state.started = true;
  state.debug = /[?&]track-debug(?:[=&]|$)/.test(location.search);
  getCampaign();
  state.ids = readIds();
  loadTools(state.ids);
  if (state.debug) {
    const on = Object.keys(state.ids);
    console.info(`[track] 켜진 도구: ${on.length ? on.join(', ') : '없음(이벤트는 화면에만 보인다)'} · 광고 유입: ${JSON.stringify(getCampaign())}`);
  }
  watchClicks();
  watchAllClicks();
  // 언어 바꾸기(js/i18n.js 가 알린다 — i18n 이 track 을 직접 부르지 않게)
  document.addEventListener('hayeong:lang-change', (event) => track('lang_change', { lang: event.detail && event.detail.lang }));
  watchSections();
  watchScrollDepth();
  watchDwell();
  // 광고를 눌러 막 들어온 페이지에서만 한 번(같은 탭에서 다른 페이지로 옮겨 가면 보내지 않는다)
  const params = new URLSearchParams(location.search);
  if (CAMPAIGN_KEYS.some((key) => params.has(key))) {
    const c = getCampaign();
    track('ad_landing', { source: c.utm_source || (c.gclid ? 'google' : c.fbclid ? 'meta' : ''), campaign: c.utm_campaign || '' });
  }
}

// 테스트 · 확인용: 이번 페이지에서 보낸 이벤트 목록
export const sentEvents = () => state.sent.map((item) => ({ ...item }));
