// intro.js — 1. 인트로: 봉투가 열리고 엽서가 꺼내져 화면 가운데에서 크게 펼쳐진다 (ScrollTrigger pin + scrub). 그다음은 '엽서 쓰기' 섹션
// (27차: 메인 화면(엽서 앞면)을 지웠다. 29차: 엽서가 꺼내져 펼쳐지는 장면을 되살렸다 — 화면을 다 덮지 않고 엽서 앞면 그대로 크게.
//  스티커 · 저절로 열기는 이 장면 끝에서 멈춘다 — 화면이 '엽서 쓰기'까지 저절로 내려가지 않는다)
// 움직일 수 있을 때(GSAP 있음 + '동작 줄이기' 꺼짐)만 핀·스크럽을 만들고,
// 아니면 <html class="intro-static"> 을 붙여 css/intro.css 의 정적 배치(봉투 한 화면)로 보여 준다.
// 여는 방법은 두 가지: (가) 스크롤 (나) 봉인 스티커(.intro__seal 단추)를 누른다 → 같은 연출이 재생되고 '엽서 쓰기' 섹션까지 이어서 내려간다(30차).
// 가만히 있으면 저절로 열리는데(AUTO_OPEN), 이때는 펼쳐진 엽서에서 멈춘다(29차).
// 정적 배치에서는 스티커를 누르면 '엽서 쓰기' 섹션으로 바로 내려간다.

import { t } from './i18n.js';
import { fillStampsAndPostmarks, hasScrollTrigger, prefersReducedMotion } from './shared.js';
import { fromAd, track } from './track.js';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const MOTION_REDUCED = '(prefers-reduced-motion: reduce)';

// 타임라인 길이를 100 으로 잡는다 → 아래 숫자는 모두 '스크롤 진행률(%)'
// ✏️ 교체: 장면의 빠르기를 바꾸려면 여기 숫자를 고친다.
//          고정된 채 스크롤하는 전체 길이(화면 높이의 몇 배)는 css/intro.css 맨 위의 --intro-screens
const AT = {
  seal: 8, // 봉인 스티커가 떨어진다 (0–8 은 첫 화면 그대로)
  flap: 12.5, // 뚜껑이 열리기 시작
  flapEnd: 31.5,
  rise: 28, // 엽서가 올라오기 시작
  riseEnd: 56.5, // 엽서가 주머니를 완전히 벗어남 → 이때부터 봉투 앞으로
  grow: 57, // 엽서가 화면 가운데로 오며 크게 펼쳐진다(봉투는 아래로 내려가며 사라진다)
  growEnd: 80,
  end: 88, // 80 이후는 여유 — 펼쳐진 엽서를 잠깐 보여 준다. 이 수를 바꾸면 css/intro.css 의 --intro-screens 도 같은 비율로
};
// ✏️ 교체: 펼쳐진 엽서의 크기 — 화면 폭의 몇 배 · 화면 높이의 몇 배 안에 들어가게(둘 중 작은 쪽)
const OPEN_W = 0.86;
const OPEN_H = 0.62;

// ✏️ 교체: 봉인 스티커를 눌렀을 때 맨 위에서 인트로 끝(펼쳐진 엽서)까지 저절로 넘어가는 데 걸리는 시간(초).
//          중간에서 누르면 남은 거리만큼 짧아진다(가장 짧게는 PLAY_MIN 초)
const PLAY_SECONDS = 2.2;
const PLAY_MIN = 0.8;
// ✏️ 교체: 가만히 있으면 봉투가 저절로 열리기까지의 시간(밀리초). 광고(utm · gclid · fbclid)로 들어오면 더 빨리.
//          저절로 열지 않으려면 AUTO_OPEN = false. '동작 줄이기' 설정에서는 열지 않는다(정적 화면 + 바로 보기 단추)
const AUTO_OPEN = true;
const AUTO_OPEN_MS = 1800;
const AUTO_OPEN_AD_MS = 700;
// 저절로 넘어가는 도중에 사용자가 직접 움직이면(휠 · 손가락 · 마우스 누름 · 아래 키) 그 자리에서 멈추고 사용자에게 넘긴다
const STOP_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
const STOP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Tab', 'Escape']);

// 종이 조각이 갈라지는 방식(HTML 의 조각 순서대로). at·dur = 시작·길이(%), reach = 얼마나 멀리,
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

/* ── 정적 모드 ───────────────────────────────────────────────── */

// 핀·스크럽 없이 보여 준다. 플로팅 버튼용 data-intro 는 인트로가 화면에서 거의 벗어났는지로 정한다.
function createStill(root, html) {
  let observer = null;
  return {
    start() {
      html.classList.add('intro-static');
      html.classList.remove('intro-ready');
      if (observer) return;
      if (!('IntersectionObserver' in window)) {
        html.dataset.intro = 'done';
        return;
      }
      // 화면 위쪽 35% 를 뺀 영역에 인트로가 걸쳐 있는 동안만 'active'
      observer = new IntersectionObserver((entries) => {
        html.dataset.intro = entries[entries.length - 1].isIntersecting ? 'active' : 'done';
      }, { rootMargin: '-35% 0px 0px 0px' });
      observer.observe(root);
    },
    stop() {
      if (observer) observer.disconnect();
      observer = null;
      html.classList.remove('intro-static');
    },
  };
}

/* ── 스크롤 연출 ─────────────────────────────────────────────── */

function buildScene(root, stage, html) {
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
  const sealNote = optional('.intro__note--hint'); // '스티커를 눌러 보세요' 쪽지 — 스티커가 사라지면 화면 낭독기에서도 감춘다

  /* 치수 — 창 크기가 바뀔 때마다(ScrollTrigger refresh) 다시 잰다. offset* 값은 transform 의 영향을 받지 않는다 */
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

  // 인트로 다음 섹션('엽서 쓰기')의 윗변이 화면 맨 위에 오는 스크롤 위치(섹션의 scroll-margin-top 만큼 덜) — 스티커 · 바로 보기가 여기로 간다
  const next = root.nextElementSibling;
  const nextTop = () => (next ? next.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(next).scrollMarginTop) || 0) : 0);

  const setIntro = (state) => { html.dataset.intro = state; };
  let tl = null;
  let flapOpen = null;
  let cardOut = null;
  let sealOff = null;
  let atEnd = null;
  let auto = null; // 스티커를 눌러 저절로 넘어가는 중인 트윈

  // 봉인 스티커가 떨어져 사라진 뒤에는 누를 수 없고 키보드 포커스도 가지 않게 한다(되돌아오면 다시 누를 수 있다).
  // 화면 낭독기에서도 감춘다(aria-hidden). 단 저절로 넘어가는 중이라 포커스가 아직 스티커에 있으면 우선 aria-disabled 만 달고,
  // 포커스가 떠난 뒤(재생이 끝나 타이틀로 옮겨진 뒤)에 감춘다 — 포커스가 있는 요소를 감추면 브라우저가 경고를 낸다
  const hideSealFromAT = () => {
    if (el.seal.classList.contains('is-off')) el.seal.setAttribute('aria-hidden', 'true');
  };
  const setSealOff = (off) => {
    el.seal.classList.toggle('is-off', off);
    if (off) {
      el.seal.setAttribute('tabindex', '-1');
      el.seal.setAttribute('aria-disabled', 'true');
      if (document.activeElement === el.seal) el.seal.addEventListener('blur', hideSealFromAT, { once: true });
      else hideSealFromAT();
    } else {
      el.seal.removeAttribute('tabindex');
      el.seal.removeAttribute('aria-disabled');
      el.seal.removeAttribute('aria-hidden');
      el.seal.removeEventListener('blur', hideSealFromAT);
    }
    sealNote.forEach((node) => {
      if (off) node.setAttribute('aria-hidden', 'true');
      else node.removeAttribute('aria-hidden');
    });
  };

  // 진행률에 따라 겹침 순서를 맞춘다(거꾸로 스크롤해도 같은 자리에서 정확히 되돌아간다)
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
    // 엽서가 다 펼쳐지면(마지막 장면) '바로 보기' 단추를 숨긴다(css/intro.css '6-1.')
    const end = tl.time() >= AT.growEnd;
    if (end !== atEnd) {
      atEnd = end;
      html.classList.toggle('intro-at-end', end);
    }
    // 스티커가 반 넘게 흐려지면 '사라진 것'으로 본다
    const off = gsap.getProperty(el.seal, 'opacity') < 0.5;
    if (off !== sealOff) {
      sealOff = off;
      setSealOff(off);
    }
  };

  /* 스티커로 열기: 창 스크롤을 지금 자리에서 인트로 끝까지 부드럽게 옮긴다 → 스크럽 타임라인이 그대로 재생된다(펼쳐진 엽서에서 멈춘다) */
  // 포커스가 스티커 단추에 있을 때 스페이스로 멈추면, 손을 떼는 순간(keyup) 단추가 '눌린' 것으로 처리돼 다시 재생된다 → 그 한 번은 막는다
  let swallowSpaceUp = false;
  const isSpace = (event) => event.key === ' ' || event.key === 'Spacebar';
  const onSealKeyup = (event) => {
    if (!isSpace(event) || !swallowSpaceUp) return;
    swallowSpaceUp = false;
    event.preventDefault();
  };
  el.seal.addEventListener('keyup', onSealKeyup);
  const onUserInput = (event) => {
    if (event.type === 'keydown' && !STOP_KEYS.has(event.key)) return;
    if (event.type === 'keydown' && isSpace(event) && event.target === el.seal) swallowSpaceUp = true;
    stopAuto();
  };
  // 재생 중에 창 크기 · 화면 방향이 바뀌면: ScrollTrigger 는 스크롤이 멈출 때까지 위치 다시 재기를 미룬다 → 끝 위치가 옛값으로 남아
  // 엉뚱한 곳(인트로 중간 · 아래 섹션)에서 멈춘다. 그래서 재생 중에는 직접 바로 다시 재게 한다
  // (휴대폰 주소창이 접히며 높이만 조금 바뀌는 것은 빼고 — ScrollTrigger 와 같은 기준)
  let viewSize = { w: 0, h: 0 };
  let remeasure = 0;
  const onResize = () => {
    const minor = window.ScrollTrigger.isTouch === 1 && innerWidth === viewSize.w && Math.abs(innerHeight - viewSize.h) <= innerHeight * 0.25;
    if (minor) return;
    viewSize = { w: innerWidth, h: innerHeight };
    clearTimeout(remeasure);
    remeasure = setTimeout(() => {
      if (auto) window.ScrollTrigger.refresh();
    }, 200);
  };
  function stopAuto() {
    clearTimeout(remeasure);
    window.removeEventListener('resize', onResize);
    if (!auto) return;
    auto.kill();
    auto = null;
    STOP_EVENTS.forEach((type) => window.removeEventListener(type, onUserInput));
  }
  // onDone = 끝까지 다 넘어갔을 때 부를 함수(도중에 사용자가 멈추면 부르지 않는다)
  // toNext: 펼쳐진 엽서에서 멈추지 않고 '엽서 쓰기' 섹션까지 이어서 내려간다(봉인 스티커를 눌렀을 때 — 30차). 저절로 열기는 펼쳐진 엽서에서 멈춘다
  function play(onDone, toNext = false) {
    const st = tl && tl.scrollTrigger;
    if (!st || auto || sealOff) return;
    // 스크롤 위치가 아니라 진행률(0~1)을 움직이고, 그때그때 인트로의 시작 · 끝 위치로 바꿔 스크롤한다
    // → 재생 중에 위치가 다시 계산되면(위 onResize) 새 자리에서 정확히 멈춘다
    const goal = () => (toNext ? Math.max(st.end, nextTop()) : st.end);
    const span = () => Math.max(1, goal() - st.start);
    const from = Math.min(1, Math.max(0, (window.scrollY - st.start) / span()));
    if ((1 - from) * span() < 1) return;
    viewSize = { w: innerWidth, h: innerHeight };
    window.addEventListener('resize', onResize);
    const pos = { p: from };
    auto = gsap.to(pos, {
      p: 1,
      duration: Math.max(PLAY_MIN, (toNext ? PLAY_SECONDS + 0.6 : PLAY_SECONDS) * (1 - from)),
      ease: 'power1.inOut',
      onUpdate: () => window.scrollTo(0, st.start + span() * pos.p),
      onComplete: () => {
        window.scrollTo(0, goal());
        stopAuto();
        if (typeof onDone === 'function') onDone();
      },
    });
    // 누른 그 동작(pointerdown · Enter)은 이미 지나갔다 → 지금부터 들어오는 입력만 '사용자가 직접 움직임'으로 본다
    STOP_EVENTS.forEach((type) => window.addEventListener(type, onUserInput, { passive: true }));
  }

  try {
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: sync,
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        // 고정 구간 = CSS 가 미리 잡아 둔 높이(#intro 높이 − 무대 높이, 기본 화면 3배 = '+=300%').
        // 자리를 CSS 가 잡고 있으므로 pinSpacing 은 끈다 → 스크립트가 늦게 실행돼도 문서 길이가 변하지 않아
        // 새로고침·뒤로 가기 때 브라우저가 기억한 스크롤 위치가 어긋나지 않는다.
        end: () => `+=${Math.max(1, root.offsetHeight - stage.offsetHeight)}`,
        pin: stage,
        pinSpacing: false,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onLeave: () => setIntro('done'),
        onEnterBack: () => setIntro('active'),
        onRefresh: (self) => {
          sync();
          setIntro(self.progress < 1 ? 'active' : 'done');
        },
      },
    });

    /* 2) 8–32%: 봉인이 떨어지고 뚜껑이 위로 열린다. 첫 화면의 글자는 사라지고 조각들이 갈라지기 시작한다 */
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

    /* 3) 28–58%: 엽서가 주머니 뒤에서 위로 미끄러져 올라오고, 봉투는 조금 내려가며 반듯해진다 */
    tl.to(el.slot, { y: () => -rise(), duration: AT.riseEnd - AT.rise, ease: 'power2.inOut' }, AT.rise)
      .to(el.envelope, { y: sink, rotation: 0, duration: 30, ease: 'power1.inOut' }, AT.rise);

    /* 4) 57–80%: 엽서가 봉투 앞으로 나와 화면 가운데로 오며 크게 펼쳐진다(살짝 기울었다가 반듯하게).
          봉투는 아래로 내려가며 사라진다. 80 이후는 여유 → 핀이 풀리면 '엽서 쓰기'가 올라온다 */
    tl.to(el.card, { x: toCenterX, y: toCenterY, scale: openScale, rotation: 0, duration: AT.growEnd - AT.grow, ease: 'power2.inOut' }, AT.grow)
      .to(el.card, { rotationX: 14, transformPerspective: 900, duration: (AT.growEnd - AT.grow) / 2, ease: 'sine.out' }, AT.grow) // 종이가 펴지듯 살짝 젖혔다가
      .to(el.card, { rotationX: 0, transformPerspective: 900, duration: (AT.growEnd - AT.grow) / 2, ease: 'sine.in' }, (AT.grow + AT.growEnd) / 2) // 반듯하게
      .to([el.inside, el.flapWrap, el.pocket], { y: () => stage.offsetHeight * 0.5, opacity: 0, duration: 16, ease: 'power2.in' }, AT.grow + 2)
      .to(optional('.intro__scroll'), { opacity: 0, duration: 6 }, AT.grow)
      .set({}, {}, AT.end); // 타임라인 길이를 AT.end 로 맞춘다

    sync();
  } catch (err) {
    setSealOff(false);
    el.seal.removeEventListener('keyup', onSealKeyup);
    throw err;
  }

  // 바로 보기: 저절로 넘기기를 멈추고 '엽서 쓰기' 섹션으로 바로
  function skip() {
    stopAuto();
    window.scrollTo(0, nextTop());
  }

  return {
    play,
    skip,
    destroy() {
      stopAuto();
      el.seal.removeEventListener('keyup', onSealKeyup);
      tl = null; // 타임라인과 핀은 gsap.matchMedia 가 정리한다
      html.classList.remove('intro-at-end');
      setSealOff(false);
      el.flapWrap.style.zIndex = '';
      el.slot.style.zIndex = '';
    },
  };
}

/* ── 진입점 ──────────────────────────────────────────────────── */

export function init(root) {
  const html = document.documentElement;
  const stage = root.querySelector('.intro__stage');
  if (!stage) throw new Error('.intro__stage 요소를 찾지 못했습니다');

  // 우표 · 소인 그림(<span data-stamp> · <span data-postmark>)을 채운다(소인 가운데 글자가 비어 있을 때 쓰는 값 = 아래 문구)
  fillStampsAndPostmarks(root, { date: t('intro.postmark-date', '[발행일]') });

  // 봉인 스티커(단추): 스크롤 연출이 살아 있으면 끝까지 저절로 재생하고, 정적 배치면 엽서 앞면 화면으로 바로 내려간다
  let scene = null; // 지금 살아 있는 스크롤 연출(없으면 정적 배치)
  const seal = root.querySelector('.intro__seal');
  const next = root.nextElementSibling; // 인트로 다음 섹션('엽서 쓰기')
  const title = next && next.querySelector('h2');
  // 다음 섹션에 닿으면 키보드 포커스를 스티커에서 그 섹션 제목으로 옮긴다 — 사라진(지나간) 스티커에 포커스가 남지 않고, 화면 낭독기가 제목부터 읽는다
  const focusTitle = () => {
    if (!title || document.activeElement !== seal) return;
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
  };
  if (seal) {
    seal.addEventListener('click', () => {
      cancelAutoOpen();
      track('intro_open', { method: 'seal' });
      if (scene) {
        scene.play(focusTitle, true);   // 스티커: 엽서가 펼쳐진 뒤 '엽서 쓰기'까지 이어서(30차)
      } else if (next) {
        next.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        focusTitle();
      }
    });
  }

  // 바로 보기 단추: 봉투 연출을 건너뛰고 '엽서 쓰기' 섹션으로
  const skipButton = root.querySelector('[data-intro-skip]');
  if (skipButton) {
    skipButton.addEventListener('click', () => {
      cancelAutoOpen();
      track('intro_open', { method: 'skip' });
      if (scene) scene.skip();
      else if (next) next.scrollIntoView({ block: 'start' });
      if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
      }
    });
  }

  // 저절로 열기: 맨 위에서 가만히 있으면 AUTO_OPEN_MS 뒤에 스티커를 누른 것처럼 열린다.
  // 그 전에 사용자가 움직이면(휠 · 손가락 · 누름 · 키) 그만둔다. 탭이 뒤에 숨어 있으면 다시 보일 때부터 센다
  let autoTimer = 0;
  function cancelAutoOpen() {
    clearTimeout(autoTimer);
    autoTimer = 0;
    STOP_EVENTS.forEach((type) => window.removeEventListener(type, cancelAutoOpen));
    document.removeEventListener('visibilitychange', onVisible);
  }
  function onVisible() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', onVisible);
    autoTimer = setTimeout(autoOpen, fromAd() ? AUTO_OPEN_AD_MS : AUTO_OPEN_MS);
  }
  function autoOpen() {
    if (!scene || window.scrollY > 4) return cancelAutoOpen();
    if (document.hidden) {
      document.addEventListener('visibilitychange', onVisible);
      return undefined;
    }
    cancelAutoOpen();
    track('intro_open', { method: 'auto' });
    scene.play(focusTitle);
    return undefined;
  }
  function scheduleAutoOpen() {
    if (!AUTO_OPEN || autoTimer || window.scrollY > 4 || location.hash.length > 1) return;
    // 편집 모드(?tune · ?edit · ?photo)에서는 저절로 열지 않는다(인트로를 고치는 중에 화면이 넘어가지 않게)
    if (/[?&](tune|edit|photo)(?:[=&]|$)/.test(location.search)) return;
    STOP_EVENTS.forEach((type) => window.addEventListener(type, cancelAutoOpen, { passive: true }));
    autoTimer = setTimeout(autoOpen, fromAd() ? AUTO_OPEN_AD_MS : AUTO_OPEN_MS);
  }

  const still = createStill(root, html);
  // index.html <head> 의 안전장치가 이미 정적 화면으로 바꿔 놓았다면(스크립트가 아주 늦게 도착한 경우) 그대로 둔다.
  // 뒤늦게 연출용 배치로 되돌리면 보고 있던 화면이 바뀌어 버린다
  if (html.classList.contains('intro-static') || !hasScrollTrigger() || typeof window.gsap.matchMedia !== 'function') {
    still.start();
    return;
  }

  // '동작 줄이기' 설정이 바뀌면 gsap.matchMedia 가 앞의 것을 정리하고 맞는 쪽을 다시 실행한다
  const mm = window.gsap.matchMedia();
  // 그때는 인트로의 높이가 달라지므로 아래 섹션들의 스크롤 위치도 다시 계산하게 한다
  const refreshSoon = () => requestAnimationFrame(() => {
    if (hasScrollTrigger()) window.ScrollTrigger.refresh();
  });

  mm.add(MOTION_OK, () => {
    // 배치(CSS)를 먼저 연출용으로 바꿔야 치수를 바르게 잰다
    html.classList.add('motion-ok', 'intro-ready');
    html.classList.remove('intro-static');
    try {
      scene = buildScene(root, stage, html);
      scheduleAutoOpen();
    } catch (err) {
      scene = null;
      console.error('[intro] 스크롤 연출을 만들지 못해 정적 화면으로 보여 줍니다', err);
      html.classList.remove('intro-ready');
      // 만들다 만 것을 모두 되돌린 뒤 정적 모드로
      setTimeout(() => {
        mm.revert();
        still.start();
      }, 0);
      return undefined;
    }
    return () => {
      cancelAutoOpen();
      scene.destroy();
      scene = null;
      html.classList.remove('intro-ready');
      refreshSoon();
    };
  });

  mm.add(MOTION_REDUCED, () => {
    still.start();
    return () => {
      still.stop();
      refreshSoon();
    };
  });
}
