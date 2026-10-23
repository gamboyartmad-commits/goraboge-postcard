// intro.js — 1. 인트로: 봉투가 열리고 엽서가 꺼내져 크게 펼쳐진 뒤, 봉투 화면이 걷히며 그 밑의 '엽서 쓰기'가 드러난다
// (36차) 인트로는 화면을 덮는 한 장이다(css/intro.css '0-1.'). 스크롤로 넘기지 않는다 — 예전 핀 · 스크럽은 휠을 두 번 내려야 했고,
//  손 입력이 겹치면 끊겼고, 다시 위로 올라갈 수 있었다(사용자). 아래 중 하나가 오면 연출을 한 번에 재생하고(PLAY_SECONDS) 인트로를 걷어 낸다:
//   봉인 스티커 누르기 · 휠 한 칸 · 손가락으로 위로 밀기 · 아래 방향 키 · '바로 보기'(바로 걷음) · 가만히 있으면 저절로(AUTO_OPEN_MS)
// 걷어 낸 뒤에는 다시 올라가도 인트로가 없다(새로고침하면 다시). 같은 방문(탭)에서 다시 오면 처음부터 건너뛴다
// (sessionStorage 'hayeong-intro' — index.html <head> 가 html.intro-skip 을 붙인다. 주소에 #섹션이 있어도 건너뛴다).
// GSAP 이 오지 않았거나 '동작 줄이기'면 연출 없이 바로 걷는다.

import { t } from './i18n.js';
import { fillStampsAndPostmarks, prefersReducedMotion } from './shared.js';
import { fromAd, track } from './track.js';

// 타임라인 길이를 100 으로 잡는다(장면의 차례 · 비율). 재생할 때는 AT.seal ~ AT.end 를 PLAY_SECONDS 초에 돈다.
// ✏️ 교체: 장면 사이의 비율을 바꾸려면 여기 숫자를, 전체 빠르기는 PLAY_SECONDS 를 고친다
const AT = {
  seal: 8, // 봉인 스티커가 떨어진다(여기서부터 재생 — 0–8 은 첫 화면 그대로)
  flap: 12.5, // 뚜껑이 열리기 시작
  flapEnd: 31.5,
  rise: 28, // 엽서가 올라오기 시작
  riseEnd: 56.5, // 엽서가 주머니를 완전히 벗어남 → 이때부터 봉투 앞으로
  grow: 57, // 엽서가 화면 가운데로 오며 크게 펼쳐진다(봉투는 아래로 내려가며 사라진다)
  growEnd: 80,
  reveal: 84, // 봉투 화면이 걷히며 그 밑의 '엽서 쓰기'가 드러난다
  revealEnd: 98,
  end: 100,
};
// ✏️ 교체: 펼쳐진 엽서의 크기 — 화면 폭의 몇 배 · 화면 높이의 몇 배 안에 들어가게(둘 중 작은 쪽)
const OPEN_W = 0.86;
const OPEN_H = 0.62;

// ✏️ 교체: 열리는 데 걸리는 시간(초). (36차 — 사용자: '속도를 더 당겨 이탈하지 않게' — 예전 스티커 3초 → 1.6초.
//          37차 — 사용자: '인트로를 2초로' → 가만히 있을 때 처음 화면 0.7초(AUTO_OPEN_MS) + 연출 1.3초 = 2초)
const PLAY_SECONDS = 1.3;
// ✏️ 교체: 가만히 있으면 봉투가 저절로 열리기까지의 시간(밀리초). 광고(utm · gclid · fbclid)로 들어오면 더 빨리.
//          저절로 열지 않으려면 AUTO_OPEN = false. 편집 모드(?tune · ?edit · ?photo)에서는 열지 않는다
const AUTO_OPEN = true;
const AUTO_OPEN_MS = 700;
const AUTO_OPEN_AD_MS = 700;
// 손가락으로 위로 이만큼(px) 밀면 연다
const SWIPE_PX = 24;
// 이 키를 누르면 연다(스페이스 · 엔터는 단추에 포커스가 있으면 단추가 맡는다)
const OPEN_KEYS = new Set([' ', 'Spacebar', 'ArrowDown', 'PageDown', 'End']);
// 인트로가 걷힌 직후 이만큼(밀리초)은 휠을 삼킨다 — 트랙패드의 관성 스크롤이 '엽서 쓰기'를 지나쳐 내려가지 않게
const SWALLOW_WHEEL_MS = 700;

// 종이 조각이 갈라지는 방식(HTML 의 조각 순서대로). at·dur = 시작·길이(타임라인 단위), reach = 얼마나 멀리,
// lift = 위(−)·아래(+)로 흐르는 정도(화면 높이 대비), spin = 돌아가는 각도
const SCRAP_MOVES = [
  { at: 10, dur: 56, reach: 1.05, lift: -0.07, spin: 10, ease: 'sine.inOut' }, // 우리 사진
  { at: 9, dur: 44, reach: 1.3, lift: -0.05, spin: 22, ease: 'power1.inOut' }, // 이름표: 혼저 옵서
  { at: 12, dur: 58, reach: 1.1, lift: 0.02, spin: 8, ease: 'sine.inOut' }, // 필름 띠
  { at: 14, dur: 60, reach: 1.05, lift: 0.08, spin: 9, ease: 'sine.inOut' }, // 색 견본
  { at: 9, dur: 40, reach: 1.3, lift: 0.1, spin: 16, ease: 'power1.in' }, // 메모(봉투 옆 → 먼저 비킨다)
  { at: 11, dur: 48, reach: 1.2, lift: 0.12, spin: 18, ease: 'power1.inOut' }, // 이름표: 와랑와랑
  { at: 14, dur: 58, reach: 1, lift: -0.09, spin: 9, ease: 'sine.inOut' }, // 제주 배경2
  { at: 12, dur: 50, reach: 1.15, lift: -0.1, spin: 12, ease: 'sine.inOut' }, // 제주 배경3
  { at: 9, dur: 46, reach: 1.3, lift: 0.04, spin: 16, ease: 'power1.inOut' }, // 제주 배경1
  { at: 9, dur: 40, reach: 1.4, lift: -0.03, spin: 18, ease: 'power1.in' }, // 우표
  { at: 8, dur: 30, reach: 1.2, lift: -0.12, spin: 20, ease: 'power1.in' }, // 항공우편 라벨(봉투 위 → 먼저 비킨다)
  { at: 12, dur: 62, reach: 1.1, lift: 0.1, spin: 6, ease: 'sine.inOut' }, // 해녀 엽서
];

/* ── 연출(멈춰 둔 타임라인) ───────────────────────────────────────── */

function buildTimeline(root, stage) {
  const { gsap } = window;
  const pick = (selector) => {
    const node = root.querySelector(selector);
    if (!node) throw new Error(`${selector} 요소를 찾지 못했습니다`);
    return node;
  };
  const el = {
    envelope: pick('.intro__envelope'),
    flapWrap: pick('.intro__flap-wrap'),
    flap: pick('.intro__flap'),
    slot: pick('.intro__card-slot'),
    card: pick('.intro__card'),
    inside: pick('.intro__inside'),
    pocket: pick('.intro__pocket-wrap'),
    seal: pick('.intro__seal'),
  };
  // 없어도 되는 꾸밈 요소(HTML 에서 지워도 연출은 계속된다)
  const optional = (selector) => [...root.querySelectorAll(selector)];
  const scraps = optional('.intro__scrap');
  const firstScreenText = optional('.intro__kicker, .intro__note');

  /* 치수 — 창 크기가 바뀌면(열기 전) 다시 잰다. offset* 값은 transform 의 영향을 받지 않는다 */
  const gap = () => el.envelope.offsetWidth * 0.024; // 다 올라온 엽서와 봉투 사이 틈
  const rise = () => el.slot.offsetTop + el.slot.offsetHeight + gap(); // 엽서 아랫변이 봉투 윗변 위로 빠져나오는 거리
  const sink = () => (el.slot.offsetHeight + gap()) * 0.46; // 그동안 봉투가 내려가는 거리(엽서+봉투가 화면 가운데 오게)
  // 펼쳐진 엽서: 화면 가운데로, 화면 폭 · 높이의 OPEN_W · OPEN_H 안에 들어가는 만큼 크게
  const openScale = () => Math.max(1, Math.min(stage.offsetWidth * OPEN_W / el.slot.offsetWidth, stage.offsetHeight * OPEN_H / el.slot.offsetHeight));
  const toCenterX = () => stage.offsetWidth / 2 - (el.envelope.offsetLeft + el.slot.offsetLeft + el.slot.offsetWidth / 2);
  const toCenterY = () => stage.offsetHeight / 2 - (el.envelope.offsetTop + sink() + el.slot.offsetTop - rise() + el.slot.offsetHeight / 2);
  const flapDepth = () => el.envelope.offsetWidth * 1.5; // 뚜껑 원근감(작을수록 과장된다)

  // 조각: 화면 가운데보다 왼쪽에 있으면 왼쪽으로, 오른쪽에 있으면 오른쪽으로 화면 밖까지
  const side = (node) => (node.offsetLeft + node.offsetWidth / 2 < stage.offsetWidth / 2 ? -1 : 1);
  const exitX = (node, reach) => {
    if (!node.offsetWidth) return 0; // 이 화면 크기에서는 숨겨진 조각
    const pad = node.offsetWidth * 0.3 + 60; // 기울기·그림자 몫
    return side(node) < 0
      ? -(node.offsetLeft + node.offsetWidth + pad) * reach
      : (stage.offsetWidth - node.offsetLeft + pad) * reach;
  };

  let tl = null;
  let flapOpen = null;
  let cardOut = null;
  // 진행에 따라 겹침 순서를 맞춘다
  const sync = () => {
    if (!tl) return;
    // 뚜껑이 90°를 넘어 뒤로 젖혀지면 엽서보다 아래로
    const open = gsap.getProperty(el.flap, 'rotationX') > 90;
    if (open !== flapOpen) {
      flapOpen = open;
      el.flapWrap.style.zIndex = open ? '1' : '';
    }
    // 엽서가 주머니를 완전히 벗어난 뒤에만 봉투 앞으로
    const out = tl.time() >= AT.riseEnd;
    if (out !== cardOut) {
      cardOut = out;
      el.slot.style.zIndex = out ? '6' : '';
    }
  };

  tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: sync });

  /* 2) 봉인이 떨어지고 뚜껑이 위로 열린다. 첫 화면의 글자는 사라지고 조각들이 갈라지기 시작한다 */
  tl.to(el.seal, { rotation: -34, xPercent: -34, yPercent: 130, scale: 0.9, opacity: 0, duration: 8, ease: 'power2.in' }, AT.seal)
    .to(firstScreenText, { opacity: 0, y: (i) => (i ? 18 : -14), duration: 8, ease: 'power1.in' }, AT.seal)
    .fromTo(el.flap,
      { rotationX: 0, transformPerspective: flapDepth },
      { rotationX: 180, transformPerspective: flapDepth, duration: AT.flapEnd - AT.flap, ease: 'power2.inOut' },
      AT.flap);
  // 뚜껑의 음영: 들리는 동안 겉면은 어두워지고, 넘어간 뒤 속면은 밝아진다(90°는 구간의 한가운데)
  const flapHalf = (AT.flapEnd - AT.flap) / 2;
  tl.fromTo(optional('.intro__flap-face--out .intro__flap-shade'), { opacity: 0 }, { opacity: 0.5, duration: flapHalf, ease: 'sine.in' }, AT.flap)
    .fromTo(optional('.intro__flap-face--in .intro__flap-shade'), { opacity: 0.5 }, { opacity: 0, duration: flapHalf, ease: 'sine.out' }, AT.flap + flapHalf);

  scraps.forEach((node, i) => {
    const move = SCRAP_MOVES[i % SCRAP_MOVES.length];
    tl.to(node, {
      x: () => exitX(node, move.reach),
      y: () => stage.offsetHeight * move.lift,
      rotation: () => `+=${side(node) * move.spin}`,
      duration: move.dur,
      ease: move.ease,
    }, move.at);
  });

  /* 3) 엽서가 주머니 뒤에서 위로 미끄러져 올라오고, 봉투는 조금 내려가며 반듯해진다 */
  tl.to(el.slot, { y: () => -rise(), duration: AT.riseEnd - AT.rise, ease: 'power2.inOut' }, AT.rise)
    .to(el.envelope, { y: sink, rotation: 0, duration: 30, ease: 'power1.inOut' }, AT.rise);

  /* 4) 엽서가 봉투 앞으로 나와 화면 가운데로 오며 크게 펼쳐진다(살짝 기울었다가 반듯하게). 봉투는 아래로 내려가며 사라진다 */
  tl.to(el.card, { x: toCenterX, y: toCenterY, scale: openScale, rotation: 0, duration: AT.growEnd - AT.grow, ease: 'power2.inOut' }, AT.grow)
    .to(el.card, { rotationX: 14, transformPerspective: 900, duration: (AT.growEnd - AT.grow) / 2, ease: 'sine.out' }, AT.grow) // 종이가 펴지듯 살짝 젖혔다가
    .to(el.card, { rotationX: 0, transformPerspective: 900, duration: (AT.growEnd - AT.grow) / 2, ease: 'sine.in' }, (AT.grow + AT.growEnd) / 2) // 반듯하게
    .to([el.inside, el.flapWrap, el.pocket], { y: () => stage.offsetHeight * 0.5, opacity: 0, duration: 16, ease: 'power2.in' }, AT.grow + 2)
    .to(optional('.intro__scroll, .intro__skip'), { opacity: 0, duration: 6 }, AT.grow);

  /* 5) 펼쳐진 엽서가 조금 더 다가오며 봉투 화면 전체가 걷히고, 그 밑에 있던 '엽서 쓰기'가 드러난다 */
  tl.to(el.card, { scale: () => openScale() * 1.06, duration: AT.revealEnd - AT.reveal, ease: 'sine.in' }, AT.reveal)
    .to(stage, { autoAlpha: 0, duration: AT.revealEnd - AT.reveal, ease: 'power1.inOut' }, AT.reveal)
    .set({}, {}, AT.end); // 타임라인 길이를 AT.end 로 맞춘다

  sync();
  return tl;
}

/* ── 진입점 ──────────────────────────────────────────────────── */

export function init(root) {
  const html = document.documentElement;
  // 같은 방문에서 이미 봤거나 #섹션으로 들어왔으면(index.html <head>) 아무것도 하지 않는다
  if (html.classList.contains('intro-skip') || html.dataset.intro === 'done') return;
  const stage = root.querySelector('.intro__stage');
  if (!stage) throw new Error('.intro__stage 요소를 찾지 못했습니다');

  // 우표 · 소인 그림(<span data-stamp> · <span data-postmark>)을 채운다(소인 가운데 글자가 비어 있을 때 쓰는 값 = 아래 문구)
  fillStampsAndPostmarks(root, { date: t('intro.postmark-date', '[발행일]') });

  const animate = Boolean(window.gsap) && !prefersReducedMotion()
    && html.classList.contains('motion-ok') && !html.classList.contains('intro-static');
  let tl = null;
  if (animate) {
    try {
      tl = buildTimeline(root, stage);
    } catch (err) {
      console.error('[intro] 연출을 만들지 못해 연출 없이 걷어 냅니다', err);
      tl = null;
    }
  }
  html.classList.add('intro-ready'); // <head> 의 안전장치가 인트로를 걷어 내지 않게

  const next = root.nextElementSibling; // 인트로 다음 섹션('엽서 쓰기')
  const title = next && next.querySelector('h2');
  let opened = false;
  let autoTimer = 0;
  let touchY = null;

  /* 걷어 내기: 인트로를 감추고(display: none) 페이지 맨 위('엽서 쓰기')에서 스크롤을 풀어 준다 */
  function finish() {
    html.dataset.intro = 'done';
    try { sessionStorage.setItem('hayeong-intro', 'done'); } catch { /* 저장 공간을 못 쓰는 브라우저 — 다음에 다시 보일 뿐 */ }
    window.scrollTo(0, 0);
    // 키보드로 열었으면(포커스가 인트로 안 — 스티커 · 바로 보기) '엽서 쓰기' 제목으로 옮긴다(화면 낭독기가 그 제목부터 읽는다)
    if (title && root.contains(document.activeElement)) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
    // 트랙패드의 관성 스크롤이 '엽서 쓰기'를 지나쳐 내려가지 않게 잠깐 휠을 삼킨다
    const swallow = (event) => event.preventDefault();
    window.addEventListener('wheel', swallow, { passive: false });
    setTimeout(() => window.removeEventListener('wheel', swallow), SWALLOW_WHEEL_MS);
    // 위쪽 목차 · 다른 섹션의 위치를 다시 잰다
    window.dispatchEvent(new Event('scroll'));
    if (window.ScrollTrigger) requestAnimationFrame(() => window.ScrollTrigger.refresh());
  }

  function open(method, fast = false) {
    if (opened) return;
    opened = true;
    clearTimeout(autoTimer);
    document.removeEventListener('visibilitychange', onVisible);
    stopListening();
    track('intro_open', { method });
    if (tl && !fast) {
      tl.tweenFromTo(AT.seal, AT.end, { duration: PLAY_SECONDS, ease: 'sine.inOut', onComplete: finish });
    } else if (window.gsap && !prefersReducedMotion()) {
      window.gsap.to(stage, { autoAlpha: 0, duration: 0.25, ease: 'power1.out', onComplete: finish });
    } else {
      finish();
    }
  }

  /* 여는 신호들 */
  const seal = root.querySelector('.intro__seal');
  const skipButton = root.querySelector('[data-intro-skip]');
  const onSeal = () => open('seal');
  const onSkip = () => open('skip', true);
  const onWheel = (event) => {
    event.preventDefault(); // 인트로 동안은 페이지가 움직이지 않는다
    if (event.deltaY > 0) open('wheel');
  };
  const onTouchStart = (event) => { touchY = event.touches[0] ? event.touches[0].clientY : null; };
  const onTouchMove = (event) => {
    event.preventDefault(); // 화면이 튕기거나 주소창이 접히지 않게
    if (touchY === null || !event.touches[0]) return;
    if (touchY - event.touches[0].clientY > SWIPE_PX) open('swipe');
  };
  const onKey = (event) => {
    if (!OPEN_KEYS.has(event.key)) return;
    const onButton = event.target instanceof Element && event.target.closest('button, a, input, textarea, select');
    if (onButton && (event.key === ' ' || event.key === 'Spacebar')) return; // 단추의 스페이스는 단추가 맡는다
    event.preventDefault();
    open('key');
  };
  if (seal) seal.addEventListener('click', onSeal);
  if (skipButton) skipButton.addEventListener('click', onSkip);
  window.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('keydown', onKey);
  function stopListening() {
    window.removeEventListener('wheel', onWheel);
    root.removeEventListener('touchstart', onTouchStart);
    root.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
  }

  // 열기 전에 창 크기가 바뀌면 치수를 다시 잰다
  if (tl) {
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      if (opened) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (!opened) tl.invalidate(); }, 150);
    });
  }

  /* 저절로 열기: 가만히 있으면 AUTO_OPEN_MS 뒤에. 탭이 뒤에 숨어 있으면 다시 보일 때부터 센다 */
  function onVisible() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', onVisible);
    autoTimer = setTimeout(autoOpen, fromAd() ? AUTO_OPEN_AD_MS : AUTO_OPEN_MS);
  }
  function autoOpen() {
    if (opened) return;
    if (document.hidden) {
      document.addEventListener('visibilitychange', onVisible);
      return;
    }
    open('auto');
  }
  // 편집 모드(?tune · ?edit · ?photo)에서는 저절로 열지 않는다(인트로를 고치는 중에 화면이 넘어가지 않게)
  if (AUTO_OPEN && !/[?&](tune|edit|photo)(?:[=&]|$)/.test(location.search)) {
    autoTimer = setTimeout(autoOpen, fromAd() ? AUTO_OPEN_AD_MS : AUTO_OPEN_MS);
  }
}
