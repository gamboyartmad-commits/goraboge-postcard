// quotes.js — 3. 인용(No.02 · Voices): data/quotes.json 을 좌우 슬라이드(캐러셀)로 보여 준다
// 넘기는 방법: 인물 아이콘 · 이전/다음 단추 · 손가락으로 좌우 밀기 · 키보드 ← → Home End.
// 저절로도 넘어간다(25차 — config.js 의 quotes.autoplay 초마다. 방문자가 직접 넘기면 그 뒤로는 멈춘다).
// 배치와 움직임은 css/quotes.css 가 맡는다. 여기서는
//   (1) 슬라이드와 인물 아이콘을 그리고
//   (2) '지금 슬라이드' 하나에만 .is-active 를 붙인다(나머지는 inert + aria-hidden).
// GSAP 을 쓰지 않는다 → CDN 을 받지 못해도 그대로 동작한다.

import { pick, t, tHTML } from './i18n.js';
import { clamp, escapeHTML, fillStampsAndPostmarks, getConfig, showNote } from './shared.js';
import { track } from './track.js';

/* ✏️ 교체: 이 모듈이 화면 · 화면 낭독기에 내보내는 문구(언어별 문구는 data/i18n/*.json 의 같은 키 — t('키', '한국어'))
   (index.html 에 직접 적힌 문구: 캐러셀 이름표 aria-roledescription, '인용 바로 가기', '이전 인용', '다음 인용')
   이 값들은 HTML 문자열에 들어가므로 tHTML(특수 문자를 바꿔 준다)로 꺼낸다. 이름(name)은 다듬기 전의 날것을 넘긴다 */
const TEXT = {
  get slideRole() { return tHTML('quotes.slide-role', '슬라이드'); }, // 화면 낭독기가 슬라이드 하나를 부르는 이름
  // 슬라이드 이름표 · 넘겼을 때 화면 낭독기에 알리는 말: '6명 중 2번째 — 이름'
  position: (n, total, name) => (name
    ? tHTML('quotes.position-name', '{total}명 중 {n}번째 — {name}', { n, total, name })
    : tHTML('quotes.position', '{total}명 중 {n}번째', { n, total })),
  // 인물 아이콘의 이름표
  thumb: (n, name) => (name
    ? tHTML('quotes.thumb-name', '{n}번째 인용 보기 — {name}', { n, name })
    : tHTML('quotes.thumb', '{n}번째 인용 보기', { n })),
  get empty() { return t('quotes.empty', '인용 데이터가 비어 있어요(data/quotes.json 확인)'); },
  // ✏️ 교체: 인터뷰 기사로 가는 링크 글자(data/quotes.json 에 "interview" 주소가 있는 사람만)
  get more() { return tHTML('quotes.more', '인터뷰 전문 읽기'); },
};

// 바탕색 이름(css/quotes.css 의 '1. 바탕색'). tone 이 비었거나 모르는 값이면 이 순서대로 돌려 쓴다
const TONES = ['paper', 'sea', 'tangerine', 'basalt'];

// 손가락으로 밀어 넘기기: 가로로 이만큼(px) 넘게, 그리고 세로보다 더 많이 움직였을 때만
const SWIPE_MIN = 40;

// 인용문이 길면 글자를 줄인다(글자 수 기준 — css 의 data-size)
const sizeOf = (text) => {
  const length = [...text].length;
  if (length > 110) return 'xl';
  return length > 64 ? 'l' : 'm';
};

const pad2 = (n) => String(n).padStart(2, '0');

// 선택 필드 face: 사진 안에서 얼굴 한가운데가 있는 자리 "가로% 세로%"(예: "50% 30%") → 아이콘이 그 자리를 잘라 보여 준다.
// 숫자와 % 로만 된 값만 받아 style 에 넣는다(그 밖의 값은 무시하고 css 의 기본 자리를 쓴다)
const faceStyle = (value) => {
  const m = /^\s*(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%\s*$/.exec(String(value ?? ''));
  return m ? `--face-x: ${clamp(Number(m[1]), 0, 100)}%; --face-y: ${clamp(Number(m[2]), 0, 100)}%` : '';
};

// 선택 필드 photoPos · photoShift: 큰 사진 한 장만의 자리(두 값 = 가로 세로. 숫자 + % · px · rem · em 만 받고 그 밖의 값은 무시한다)
//   photoPos   "50% 20%"     배경이 있는 사진("frame": true)을 잘라 보여 줄 중심 → 그 슬라이드의 --q-frame-pos
//   photoShift "1rem -2rem"  사진 자리 옮기기(+ 오른쪽 · 아래 / − 왼쪽 · 위) → 그 슬라이드의 --q-photo-x · --q-photo-y
// 슬라이드에 직접 적으므로 css/theme.css 의 '모든 인물에 함께' 값보다 우선한다
const PAIR = /^\s*(-?\d{1,4}(?:\.\d+)?(?:%|px|rem|em)|0)\s+(-?\d{1,4}(?:\.\d+)?(?:%|px|rem|em)|0)\s*$/;
const photoStyle = (pos, shift) => {
  const p = PAIR.exec(String(pos ?? ''));
  const s = PAIR.exec(String(shift ?? ''));
  return [p && `--q-frame-pos: ${p[1]} ${p[2]}`, s && `--q-photo-x: ${s[1]}; --q-photo-y: ${s[2]}`].filter(Boolean).join('; ');
};

// 큰따옴표 장식
const MARK_SVG = '<svg class="quotes__mark" viewBox="0 0 64 46" aria-hidden="true" focusable="false"><path d="M27.5 4.500C14 8.500 4.500 19 4.500 31.500c0 7.200 4.700 12 11.200 12 6 0 10.600-4.400 10.600-10.400 0-5.700-4.100-9.800-9.600-9.800-.9 0-1.800.1-2.600.4 1.300-6.300 6.300-11.300 14.300-14.200zM60 4.500C46.500 8.500 37 19 37 31.500c0 7.200 4.700 12 11.200 12 6 0 10.600-4.400 10.600-10.400 0-5.700-4.100-9.800-9.600-9.800-.9 0-1.800.1-2.600.4 1.300-6.300 6.300-11.300 14.300-14.200z"/></svg>';

/* ── 그리기 ─────────────────────────────────────────────────── */

// 데이터를 화면에 쓸 모양으로 다듬는다(빈 값·모르는 tone 대비). 글자는 모두 escapeHTML 을 거친다.
// 글(quote · name · affiliation · photoAlt)은 지금 언어의 값 — 예: 영어면 "quote_en" 이 있으면 그것, 없으면 "quote"(js/i18n.js 의 pick)
function normalize(quotes) {
  return quotes
    .filter((q, i) => {
      // 인용문도 이름도 없는 빈 칸은 그리지 않는다(빈 슬라이드 한 장이 생기지 않게)
      const filled = Boolean(q && typeof q === 'object' && (String(pick(q, 'quote') ?? '').trim() || String(pick(q, 'name') ?? '').trim()));
      if (!filled) console.warn(`[quotes] data/quotes.json 의 ${i + 1}번째 항목이 비어 있어 건너뜁니다`);
      return filled;
    })
    .map((q, i) => {
      const quote = String(pick(q, 'quote') ?? '').trim();
      const name = String(pick(q, 'name') ?? '').trim();
      return {
        tone: TONES.includes(q.tone) ? q.tone : TONES[i % TONES.length],
        size: sizeOf(quote),
        quote: escapeHTML(quote),
        // 선택: 큰 인용 아래에 붙는 짧은 말(감동 한 줄) — 문자열 배열. 지금 언어의 값(예: "lines_en")이 있으면 그것
        lines: (Array.isArray(pick(q, 'lines')) ? pick(q, 'lines') : []).map((line) => String(line ?? '').trim()).filter(Boolean).map(escapeHTML),
        name: escapeHTML(name),
        rawName: name, // 이름표 문구(TEXT.position · thumb)에 넣는 날것 — 문구 전체를 한 번에 바꾼다
        affiliation: escapeHTML(String(pick(q, 'affiliation') ?? '').trim()),
        photo: escapeHTML(String(q.photo ?? '').trim()),
        photoAlt: escapeHTML(String(pick(q, 'photoAlt') ?? '').trim()),
        thumb: escapeHTML(String(q.thumb ?? '').trim()), // 선택: 정사각형 얼굴 사진(없으면 photo 를 잘라 쓴다)
        framed: q.frame === true, // 선택: 배경이 있는 보통 사진 → 종이 테두리를 두른 인화 사진처럼 보여 준다
        facePos: faceStyle(q.face), // 선택: photo 를 잘라 쓸 때 얼굴이 있는 자리
        photoStyle: photoStyle(q.photoPos, q.photoShift), // 선택: 큰 사진 한 장만의 자리
        // 선택: 이 사람의 인터뷰 기사(같은 사이트의 articles/interviewNN.html 또는 #… 이 붙은 주소만 받는다)
        interview: /^(articles\/)?interview-?\d+\.html(#[\w-]+)?$/.test(String(q.interview ?? '').trim()) ? String(q.interview).trim() : '',
      };
    });
}

// 슬라이드 하나. 넓은 화면에서 홀수 번째 = 글 왼쪽 · 사진 오른쪽, 짝수 번째(--flip) = 사진 왼쪽 · 글 오른쪽.
// 첫 슬라이드만 보이는 채로 그리고 나머지는 오른쪽에 숨겨 둔다(inert: 포커스 · 화면 낭독기가 들어가지 않는다)
function itemHTML(q, i, total) {
  const photo = q.photo
    ? `<img class="quotes__img" src="${q.photo}" alt="${q.photoAlt}" width="800" height="1000" loading="lazy" decoding="async">`
    : '';
  const state = i === 0 ? '' : ' data-side="right" inert aria-hidden="true"';
  const style = q.photoStyle ? ` style="${q.photoStyle}"` : '';
  return `
    <div class="quotes__item${i === 0 ? ' is-active' : ''}${i % 2 ? ' quotes__item--flip' : ''}${q.framed ? ' quotes__item--framed' : ''}" role="group" aria-roledescription="${TEXT.slideRole}" aria-label="${TEXT.position(i + 1, total, q.rawName)}" data-tone="${q.tone}" data-size="${q.size}"${style}${state}>
      <div class="quotes__photo">${photo}</div>
      <figure class="quotes__fig">
        ${MARK_SVG}
        <blockquote class="quotes__quote"><p>${q.quote}</p></blockquote>
        ${q.lines.length ? `<div class="quotes__lines">${q.lines.map((line) => `<p>${line}</p>`).join('')}</div>` : ''}
        <figcaption class="quotes__who">
          <strong class="quotes__name">${q.name}</strong>
          <span class="quotes__aff">${q.affiliation}</span>
        </figcaption>
        ${q.interview ? `<a class="quotes__more" href="${q.interview}">${TEXT.more}<span class="visually-hidden"> — ${q.name}</span> <span class="quotes__more-arrow" aria-hidden="true">→</span></a>` : ''}
      </figure>
    </div>`;
}

// 인물 아이콘(누르면 그 사람의 슬라이드로)
function thumbHTML(q, i) {
  const src = q.thumb || q.photo;
  const face = src ? `<img src="${src}" alt="${q.photoAlt}" loading="lazy" decoding="async">` : i + 1;   // 40차: 인물 아이콘에도 대체텍스트(단추 이름은 aria-label)
  const style = q.facePos && !q.thumb ? ` style="${q.facePos}"` : '';
  return `
    <li>
      <button type="button" class="quotes__thumb${q.thumb ? ' quotes__thumb--plain' : ''}" data-index="${i}" data-tone="${q.tone}" aria-label="${TEXT.thumb(i + 1, q.rawName)}"${i === 0 ? ' aria-current="true"' : ''}${style}>${face}</button>
    </li>`;
}

/* ── 진입점 ──────────────────────────────────────────────────── */

export function init(root, quotes) {
  const viewport = root.querySelector('.quotes__viewport');
  const list = root.querySelector('.quotes__list');
  if (!viewport || !list) throw new Error('.quotes__viewport · .quotes__list 요소를 찾지 못했습니다');

  // 우표 · 소인(장식)이 있으면 채운다(25차에 오른쪽 위 우표를 뺐다 — 다시 넣으면 그대로 그려진다)
  fillStampsAndPostmarks(root);

  const items = Array.isArray(quotes) ? normalize(quotes) : [];
  if (!items.length) {
    showNote(root, TEXT.empty);
    return;
  }

  const total = items.length;
  const thumbs = root.querySelector('.quotes__thumbs');
  const countNow = root.querySelector('.quotes__count-now');
  const countAll = root.querySelector('.quotes__count-all');
  const live = root.querySelector('.quotes__live');

  // 사진을 불러오지 못하면(경로 오타 등): 큰 사진은 빼고(뒤의 원 장식만 남는다) 아이콘은 번호로 바꾼다.
  // error 이벤트는 위로 올라오지 않으므로 캡처 단계에서 받는다
  root.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const btn = img.closest('.quotes__thumb');
    if (btn) btn.textContent = Number(btn.dataset.index) + 1;
    else if (img.classList.contains('quotes__img')) img.remove();
  }, true);

  list.innerHTML = items.map((q, i) => itemHTML(q, i, total)).join('');
  if (thumbs) thumbs.innerHTML = items.map(thumbHTML).join('');
  if (countAll) countAll.textContent = `/ ${pad2(total)}`;
  root.dataset.tone = items[0].tone; // 섹션 바탕색 = 지금 보이는 사람의 tone
  root.classList.toggle('quotes--single', total < 2); // 한 사람뿐이면 단추 줄을 감춘다(css)

  const itemEls = [...list.children];
  const thumbEls = thumbs ? [...thumbs.querySelectorAll('.quotes__thumb')] : [];

  // 숨어 있는 슬라이드의 사진은 브라우저가 미루어 받는다(loading="lazy") → 넘기는 순간 사진이 늦게 뜰 수 있다.
  // 섹션이 화면 가까이 오면 한꺼번에 받아 둔다
  const loadPhotos = () => list.querySelectorAll('.quotes__img').forEach((img) => { img.loading = 'eager'; });
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watcher.disconnect();
      loadPhotos();
    }, { rootMargin: '100% 0px' });
    watcher.observe(root);
  } else {
    loadPhotos();
  }

  if (total < 2) return;

  /* 휴대폰: 창 높이가 지금 슬라이드를 따라간다(css 의 '휴대폰' 규칙) → 넘길 때 그 사이를 부드럽게 잇는다.
     창에 높이 transition 이 없는 화면(태블릿 · 데스크톱 · '동작 줄이기')에서는 아무것도 하지 않는다 */
  let heightTimer = 0;
  const resize = (fromH) => {
    clearTimeout(heightTimer);
    viewport.style.height = '';
    const toH = viewport.offsetHeight;
    const dur = getComputedStyle(viewport).transitionDuration.split(',')[0];
    const ms = parseFloat(dur) * (dur.endsWith('ms') ? 1 : 1000);
    if (!ms || Math.abs(toH - fromH) < 2) return;
    viewport.style.height = `${fromH}px`;
    void viewport.offsetHeight;
    viewport.style.height = `${toH}px`;
    heightTimer = setTimeout(() => { viewport.style.height = ''; }, ms + 60);
  };

  /* 넘기기 — index: 보여 줄 번호(끝을 넘으면 반대쪽 끝으로 돈다), way: 1 = 오른쪽에서 들어온다 / -1 = 왼쪽에서,
     auto: 저절로 넘긴 것(측정 이벤트 · 화면 낭독기 알림을 보내지 않는다) */
  let current = 0;
  const show = (index, way, auto = false) => {
    const next = ((index % total) + total) % total;
    if (next === current) return;
    const dir = way || (next > current ? 1 : -1);
    const fromH = viewport.offsetHeight;
    const from = itemEls[current];
    const to = itemEls[next];

    // 들어올 슬라이드를 들어올 쪽에 미리 가져다 놓고(움직임 없이), 나갈 슬라이드는 반대쪽으로 보낸다.
    // 아직 나가는 중이라 화면에 보이는 슬라이드를 다시 부르면(빠르게 되돌릴 때) 옮기지 않고 그 자리에서 돌아오게 한다
    if (getComputedStyle(to).visibility === 'hidden') {
      to.classList.add('is-ready');
      to.dataset.side = dir > 0 ? 'right' : 'left';
      void to.offsetWidth; // 자리를 옮긴 것을 브라우저가 먼저 반영하게 한다(이 줄이 없으면 제자리에서 나타난다)
      to.classList.remove('is-ready');
    }
    from.dataset.side = dir > 0 ? 'left' : 'right';

    itemEls.forEach((el, i) => {
      const on = i === next;
      el.classList.toggle('is-active', on);
      el.toggleAttribute('inert', !on);
      if (on) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    });
    thumbEls.forEach((btn, i) => {
      if (i === next) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
    resize(fromH);

    current = next;
    root.dataset.tone = items[next].tone;
    if (countNow) countNow.textContent = pad2(next + 1);
    if (auto) return;
    track('voices_view', { person: next + 1, name: items[next].name || '' });
    // 화면 낭독기에 알린다(포커스는 누른 단추에 그대로 둔다). 이름 속 &amp; 등은 글자로 되돌려 읽힌다
    if (live) live.textContent = to.getAttribute('aria-label');
  };

  /* 저절로 넘기기: config.js 의 quotes.autoplay 초마다 다음 사람으로(0 이면 끈다).
     섹션이 화면에 보일 때만 돌고, 마우스를 올려 두거나 안에 키보드 포커스가 있으면 멈춘다.
     방문자가 한 번이라도 직접 넘기면(아이콘 · 단추 · 밀기 · 키보드) 그 뒤로는 저절로 넘기지 않는다. '동작 줄이기' 기기에서는 돌지 않는다 */
  const autoSec = Number(getConfig().quotes.autoplay);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let autoOff = !(autoSec > 0) || reduceMotion.matches;
  let autoTimer = 0;
  let inView = false;
  let hovering = false;
  let focused = false;
  const planAuto = () => {
    clearTimeout(autoTimer);
    if (autoOff || !inView || hovering || focused || document.hidden) return;
    autoTimer = setTimeout(() => {
      show(current + 1, 1, true);
      planAuto();
    }, autoSec * 1000);
  };
  const takeOver = () => {
    autoOff = true;
    clearTimeout(autoTimer);
  };
  if (!autoOff) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        planAuto();
      }, { threshold: 0.4 }).observe(viewport);
    } else {
      inView = true;
    }
    root.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovering = true; planAuto(); } });
    root.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') { hovering = false; planAuto(); } });
    root.addEventListener('focusin', () => { focused = true; planAuto(); });
    root.addEventListener('focusout', (event) => {
      if (root.contains(event.relatedTarget)) return;
      focused = false;
      planAuto();
    });
    document.addEventListener('visibilitychange', planAuto);
    reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) takeOver(); });
    planAuto();
  }

  const step = (delta) => {
    takeOver();
    show(current + delta, delta);
  };

  /* 인물 아이콘 · 이전/다음 단추 */
  root.addEventListener('click', (event) => {
    // 아이콘 둘레(아주 좁은 화면에서 넓혀 둔 누르는 자리 — css 의 .quotes__thumbs li::before)를 누른 것도 그 아이콘으로 받는다
    const thumb = event.target.closest('.quotes__thumb') || event.target.closest('.quotes__thumbs li')?.querySelector('.quotes__thumb');
    if (thumb) {
      takeOver();
      show(Number(thumb.dataset.index));
      return;
    }
    const arrow = event.target.closest('[data-quotes-step]');
    if (arrow) step(Number(arrow.dataset.quotesStep) < 0 ? -1 : 1);
  });

  /* 키보드: 캐러셀 안(아이콘 · 단추)에 포커스가 있을 때 ← → 로 넘기고 Home · End 로 처음 · 끝으로.
     인물 아이콘에서 넘기면 포커스도 지금 사람의 아이콘으로 옮긴다(보이는 사람과 포커스가 어긋나지 않게 — 이전 · 다음 단추에서는 그대로) */
  root.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'Home') { takeOver(); show(0, -1); }
    else if (event.key === 'End') { takeOver(); show(total - 1, 1); }
    else return;
    event.preventDefault(); // 페이지가 함께 스크롤되지 않게
    if (event.target instanceof Element && event.target.closest('.quotes__thumb') && thumbEls[current]) thumbEls[current].focus();
  });

  /* 손가락으로 좌우 밀기(세로로 미는 것은 브라우저가 페이지 스크롤로 처리한다 — css 의 touch-action) */
  let touch = null;
  viewport.addEventListener('touchstart', (event) => {
    const t = event.touches[0];
    touch = event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; // 두 손가락(확대)은 넘기기가 아니다
  }, { passive: true });
  viewport.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) touch = null;
  }, { passive: true });
  viewport.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  viewport.addEventListener('touchend', (event) => {
    if (!touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1); // 왼쪽으로 밀면 다음 사람
  }, { passive: true });
}
