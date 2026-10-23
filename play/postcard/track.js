// track.js — 성과 측정 (v7.11). 웹진 '하영 고라보게'와 같은 GA4 속성으로 잰다.
// ① 웹진의 '엽서 쓰러가기' 쪽(…/team1/play/postcard/) 안에 띄워져 있으면: 여기서 일어난 일을 웹진으로 넘긴다(postMessage).
//    웹진 쪽 js/play.js 가 받아 웹진의 GA4 로 보낸다(같은 방문 · 같은 사용자로 이어짐). 체류 시간은 웹진 쪽이 재고, 여기서는 '쓰는 중' 신호만 보낸다.
// ② 따로 열리면(카카오톡 · 메일 · 링크로 바로): config.js 의 GA4_ID 로 직접 보낸다. 웹진 주소(WEBZINE_DOMAINS)와는 GA4 교차 도메인으로 이어 본다.
//    v7.15: config.js 의 GTM_ID(웹진과 같은 Google 태그 관리자)도 이때만 불러 이벤트를 dataLayer 로 보낸다(웹진 안에서는 웹진 페이지의 GTM 이 받는다)
// 보내는 이벤트(모두 pc_ 로 시작 — 웹진 이벤트와 한 속성 안에서 구분):
//   pc_click(누른 단추) · pc_view(화면) · pc_view_time(화면마다 머문 초) · pc_card_pick · pc_send_open · pc_send_done(method)
//   · pc_received_view · 따로 열렸을 때만 pc_dwell_milestone · pc_page_time · page_view(GA4 기본)
// 단추 이름에는 사람이 쓴 글(편지 · 이름 · 게시판 글)을 담지 않는다 — id · data-track · 정해 둔 이름만.
// 확인: 주소 끝에 ?track-debug → 화면 왼쪽 아래 · 콘솔에 보낸 이벤트가 뜬다(GA4 ID 가 없어도).
(function () {
  const cfg = window.POSTCARD_CONFIG || {};
  const rawId = String(cfg.GA4_ID || '').trim();
  const GA4_ID = /^G-[A-Z0-9]{4,}$/.test(rawId) ? rawId : '';
  if (rawId && !GA4_ID) console.warn(`[track] config.js 의 GA4_ID 값(${rawId})의 꼴이 맞지 않아 불러오지 않았어요(G-로 시작)`);
  const rawGtm = String(cfg.GTM_ID || '').trim();
  const GTM_ID = /^GTM-[A-Z0-9]{4,}$/.test(rawGtm) ? rawGtm : '';   // v7.15
  const ORIGINS = (cfg.WEBZINE_ORIGINS || []).map((o) => String(o).replace(/\/$/, ''));
  const DOMAINS = cfg.WEBZINE_DOMAINS || [];
  const debug = /[?&]track-debug(?:[=&]|$)/.test(location.search);
  const embedded = window.parent !== window;

  let mode = embedded ? 'waiting' : 'alone';   // waiting → webzine(웹진 안) | alone(따로)
  let parentOrigin = '';
  const queue = [];
  let log = null;

  function showDebug(name, params, where) {
    console.info('[track]', where, name, params);
    if (!debug) return;
    if (!log) {
      log = document.createElement('ol');
      log.setAttribute('aria-hidden', 'true');
      log.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;max-width:min(92vw,360px);margin:0;padding:8px 10px 8px 26px;'
        + 'border-radius:8px;background:rgb(20 20 24/.86);color:#e8f7ec;font:12px/1.45 ui-monospace,Menlo,monospace;pointer-events:none';
      document.body.append(log);
    }
    const li = document.createElement('li');
    li.textContent = `${where === 'webzine' ? '→웹진 ' : ''}${name} ${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ')}`;
    log.append(li);
    while (log.children.length > 8) log.firstElementChild.remove();
  }

  // 값은 글자 · 숫자만, 길이도 줄여서
  function clean(params) {
    const out = {};
    Object.entries(params || {}).forEach(([k, v]) => {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'string' || typeof v === 'boolean') out[k] = String(v).slice(0, 80);
    });
    return out;
  }

  function deliver(name, params) {
    if (mode === 'webzine') {
      window.parent.postMessage({ source: 'hayeong-postcard', kind: 'event', name, params }, parentOrigin);
      showDebug(name, params, 'webzine');
      return;
    }
    if (GA4_ID && typeof window.gtag === 'function') window.gtag('event', name, params);
    if (GTM_ID) window.dataLayer.push({ event: name, ...params });   // v7.15: GTM '맞춤 이벤트' 트리거로 받는다
    showDebug(name, params, 'ga4');
  }

  function hyTrack(name, params) {
    if (!/^[a-z0-9_]{1,40}$/.test(name)) return;
    const data = clean(params);
    if (mode === 'waiting') {
      if (queue.length < 60) queue.push([name, data]);
      return;
    }
    deliver(name, data);
  }
  window.hyTrack = hyTrack;

  /* ── GA4 (따로 열렸을 때만) ───────────────────────────────────── */
  function loadGa4() {
    if (!GA4_ID) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date());
    // 웹진 주소와 같은 사용자 · 방문으로 이어 보기(교차 도메인): 서로 오가는 링크에 _gl 이 붙는다
    window.gtag('config', GA4_ID, DOMAINS.length ? { linker: { domains: DOMAINS } } : {});
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
    s.addEventListener('error', () => console.warn('[track] GA4 를 불러오지 못했어요(광고 차단 프로그램일 수 있어요)'));
    document.head.append(s);
  }

  /* ── GTM (v7.15, 따로 열렸을 때만 — 웹진과 같은 컨테이너. 웹진 안에서는 웹진 페이지의 GTM 이 받는다) ── */
  function loadGtm() {
    if (!GTM_ID) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    s.addEventListener('error', () => console.warn('[track] GTM 을 불러오지 못했어요(광고 차단 프로그램일 수 있어요)'));
    document.head.append(s);
  }

  function becomeAlone() {
    if (mode === 'alone' && loadGa4.done) return;
    mode = 'alone';
    loadGa4.done = true;
    loadGa4();
    loadGtm();
    queue.splice(0).forEach(([n, p]) => deliver(n, p));
    watchDwell();
  }

  function becomeWebzine(origin) {
    if (mode === 'webzine') return;
    // 인사가 늦게 와서 이미 따로 열린 것처럼 시작했어도, 이제부터는 웹진으로 넘긴다
    mode = 'webzine';
    parentOrigin = origin;
    queue.splice(0).forEach(([n, p]) => deliver(n, p));
    watchActivity();
  }

  /* ── 웹진과 인사하기 ─────────────────────────────────────────── */
  // 웹진(js/play.js)이 iframe 을 다 불러온 뒤 { source: 'hayeong-webzine', kind: 'hello' } 를 보낸다. 정해 둔 주소(WEBZINE_ORIGINS)에서 온 것만 믿는다
  window.addEventListener('message', (event) => {
    const d = event.data;
    if (!d || d.source !== 'hayeong-webzine' || d.kind !== 'hello') return;
    if (!ORIGINS.includes(event.origin)) return;
    becomeWebzine(event.origin);
    window.parent.postMessage({ source: 'hayeong-postcard', kind: 'ready' }, event.origin);   // 대답(웹진이 인사를 그만 보냄)
  });
  if (embedded) {
    // 웹진이 아닌 곳에 띄워졌거나 인사가 오지 않으면 따로 열린 것처럼
    setTimeout(() => { if (mode === 'waiting') becomeAlone(); }, 6000);
  } else {
    becomeAlone();
  }

  /* ── 누른 단추 ──────────────────────────────────────────────── */
  // 이름: id → data-track → 정해 둔 이름(엽서 그림 띠 · 템플릿 단추 · 게시판 엽서). 사람이 쓴 글은 담지 않는다
  function labelOf(el) {
    if (el.id) return el.id;
    if (el.dataset.track) return el.dataset.track;
    if (el.classList.contains('strip-item')) return `card_${Number(el.dataset.index) + 1}`;
    if (el.classList.contains('template-chip')) return `template:${(el.textContent || '').trim().slice(0, 20)}`;   // 정해 둔 템플릿 이름(예: 엄마에게)
    if (el.classList.contains('board-card')) return 'board_card';
    if (el.classList.contains('intro-pop-dot')) return 'intro_dot';
    const cls = (el.className && typeof el.className === 'string') ? el.className.split(/\s+/)[0] : '';
    return cls || el.tagName.toLowerCase();
  }
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) return;   // 사람이 누른 것만(사이트가 안에서 대신 누르는 단추 · 내려받기 링크는 빼고)
    const el = event.target instanceof Element ? event.target.closest('button, a[href], [role="button"], summary') : null;
    if (!el) return;
    hyTrack('pc_click', { button: labelOf(el), view: document.body.dataset.view || 'flow' });
  }, true);

  /* ── 웹진으로 돌아가기(기사 보러가기 · 웹진 홍보 띠) ───────────── */
  // 웹진 안이면 새 탭이 아니라 그 웹진(바깥 창)이 돌아가게 하고, 따로 열렸으면 링크 그대로(WEBZINE_URL)
  if (cfg.WEBZINE_URL) {
    // v7.16: data-webzine-hash 가 있으면 웹진의 그 섹션으로(위 막대 '영상 보러 가기' → #why)
    document.querySelectorAll('[data-webzine-link]').forEach((a) => { a.href = cfg.WEBZINE_URL + (a.dataset.webzineHash ? `#${a.dataset.webzineHash}` : ''); });
  }
  document.addEventListener('click', (event) => {
    const a = event.target instanceof Element ? event.target.closest('[data-webzine-link]') : null;
    if (!a || mode !== 'webzine') return;
    event.preventDefault();
    window.parent.postMessage({ source: 'hayeong-postcard', kind: 'nav', to: 'webzine', from: a.dataset.webzineLink || '' }, parentOrigin);
  });

  /* ── 머문 시간 ─────────────────────────────────────────────── */
  // 화면(flow · send · board · end …)마다 머문 초: 화면이 바뀌거나 떠날 때 pc_view_time(두 경우 모두)
  // 따로 열렸을 때는 페이지 전체도: pc_dwell_milestone(10 · 30 · 60 · 120 · 300 · 600초) · pc_page_time(떠날 때)
  // 웹진 안에서는 전체 머문 시간을 웹진이 재므로, 손가락 · 마우스가 움직이면 5초에 한 번 '쓰는 중' 신호만
  const IDLE_MS = 30000;
  let lastMove = performance.now();
  let last = lastMove;
  let pageActive = 0;
  let viewActive = 0;
  let viewName = '';
  const counting = () => !document.hidden && performance.now() - lastMove < IDLE_MS;
  function tick() {
    const now = performance.now();
    if (counting()) { const d = Math.min(now - last, 2000); pageActive += d; viewActive += d; }
    last = now;
  }
  function flushView(reason) {
    tick();
    const sec = Math.round(viewActive / 1000);
    if (viewName && sec > 0) hyTrack('pc_view_time', { view: viewName, seconds: sec, reason });
    viewActive = 0;
  }
  function onView() {
    const v = document.body.dataset.view || 'flow';
    if (v === viewName) return;
    flushView('change');
    viewName = v;
  }
  ['scroll', 'pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel', 'input'].forEach((t) => window.addEventListener(t, () => {
    const now = performance.now();
    if (now - lastMove >= IDLE_MS) last = now;
    lastMove = now;
  }, { passive: true, capture: true }));
  setInterval(tick, 1000);
  new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  document.addEventListener('DOMContentLoaded', () => { viewName = document.body.dataset.view || 'flow'; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushView('hidden');
    else { last = performance.now(); lastMove = last; }
  });
  window.addEventListener('pagehide', () => flushView('leave'));

  function watchDwell() {
    if (watchDwell.on) return;
    watchDwell.on = true;
    const marks = [10, 30, 60, 120, 300, 600];
    const done = new Set();
    let sent = -1;
    setInterval(() => {
      const sec = pageActive / 1000;
      marks.forEach((m) => { if (sec >= m && !done.has(m)) { done.add(m); hyTrack('pc_dwell_milestone', { seconds: m }); } });
    }, 1000);
    const flush = (reason) => {
      tick();
      const total = Math.round(pageActive / 1000);
      if (total <= 0 || total === sent) return;
      sent = total;
      hyTrack('pc_page_time', { seconds: total, reason });
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush('hidden'); });
    window.addEventListener('pagehide', () => flush('leave'));
  }

  function watchActivity() {
    if (watchActivity.on) return;
    watchActivity.on = true;
    let sentAt = 0;
    const ping = () => {
      const now = Date.now();
      if (now - sentAt < 5000 || mode !== 'webzine') return;
      sentAt = now;
      window.parent.postMessage({ source: 'hayeong-postcard', kind: 'activity' }, parentOrigin);
    };
    ['scroll', 'pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel', 'input'].forEach((t) => window.addEventListener(t, ping, { passive: true, capture: true }));
    ping();
  }
})();
