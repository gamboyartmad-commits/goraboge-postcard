// postcards.js — 4. 인터뷰 엽서. index(#interviews)와 기사 하단(#more-interviews)이 함께 쓴다.
// 지금(DIRECT = true)은 엽서를 누르면 바로 기사로 간다. false 로 바꾸면 예전처럼 뒤집혀 뒷면이 보인다(아래 설명은 그 경우)
// data = data/interviews.json, options.only = ['02'] 처럼 주면 그 id 의 엽서만 그린다.
// (선택 필드: no = 엽서에 찍히는 번호, coverPos = 사진에서 보여 줄 중심 — 예: "50% 20%")
// 엽서의 생김새와 뒤집히는 움직임은 css/interviews.css 가 맡는다. 여기서는
//   (1) 데이터를 엽서 마크업(앞면 + 뒷면)으로 그리고
//   (2) 마우스 · 터치 · 키보드에 맞춰 '뒤집힘' 상태(data-flipped)만 바꾼다.
// (2)가 실패해도 엽서는 css 만으로(:hover · :focus-within) 뒤집히고 뒷면의 링크도 그대로 동작한다.

import { pick, t, tHTML } from './i18n.js';
import { escapeHTML, postmarkSVG, showNote, stampSVG } from './shared.js';

// ✏️ 교체: 엽서 · 안내의 문구(언어별 문구는 data/i18n/*.json 의 같은 키). 쓸 때 꺼내 읽는다(get) — HTML 문자열에 들어가는 것은 tHTML
const TEXT = {
  get empty() { return t('pcards.empty', '인터뷰 목록이 비어 있어요(data/interviews.json을 확인해 주세요)'); },
  get noOther() { return t('pcards.no-other', '다른 인터뷰는 아직 준비 중이에요'); },
  flip: (title) => tHTML('pcards.flip-label', '인터뷰 엽서 뒤집기: {title}', { title }), // 앞면 단추의 이름(화면 낭독기)
  get read() { return tHTML('pcards.read', '읽으러 가기'); }, // 뒷면 단추 · 바로 가는 엽서의 링크 이름 뒤
  get unflip() { return tHTML('pcards.unflip', '앞면 보기'); },
  get interviewee() { return tHTML('pcards.interviewee-sr', '인터뷰이:'); }, // 화면 낭독기에만 읽히는 머리말(뒤의 빈칸은 아래 cardHTML 에 있다)
  get affiliation() { return tHTML('pcards.affiliation-sr', '소속:'); },
};

// 엽서 디자인 2종(css/interviews.css 의 .pcard--a · .pcard--b). variant 가 비었거나 모르는 값이면 순서대로 돌려 쓴다
const VARIANTS = {
  a: { stamp: 'tangerine', stampClass: 'stamp--tangerine', tapeClass: '', ctaClass: '' }, // 감귤
  b: { stamp: 'wave', stampClass: 'stamp--sea', tapeClass: ' tape--sea', ctaClass: ' btn--ink' }, // 바다
};
const VARIANT_KEYS = Object.keys(VARIANTS);

// 뒤집기 단추 구석의 작은 표시 · '앞면 보기' 단추의 화살표(장식)
const TURN_SVG = '<svg viewBox="0 0 24 24" focusable="false"><path d="M19.500 12.200a7.500 7.500 0 1 1-2.400-5.700"/><path d="M17.800 2.800l-.400 4.100-4.100-.500"/></svg>';

// ✏️ 교체: true = 엽서를 누르면 바로 기사로 간다(뒤집지 않는다 — 앞면 전체가 기사 링크). false = 예전처럼 뒤집혀 뒷면의 '읽으러 가기'
const DIRECT = true;
const GO_SVG = '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h13.500M13 6.500l5.500 5.500-5.500 5.500"/></svg>';

const JUST_FLIPPED_MS = 500; // 터치로 뒤집은 뒤 이만큼은 뒷면 링크를 막는다(빠른 두 번 탭 대비)

let uid = 0; // 한 페이지에 엽서가 여러 번 그려져도 id 가 겹치지 않게
const bound = []; // 지금 화면에 있는 모든 엽서(바깥을 눌렀을 때 앞면으로 돌려놓으려고)
let globalReady = false;

/* ── 데이터 다듬기 ───────────────────────────────────────────── */

const clean = (value) => String(value ?? '').trim();

// 링크는 사이트 안의 주소나 http(s) 만 받는다(그 밖의 scheme — javascript: 등 — 은 버린다).
// 글자 모양이 아니라 브라우저가 실제로 해석한 결과로 가린다(줄바꿈 · 탭이 낀 'java\nscript:' 같은 값도 걸러지게)
const safeHref = (value) => {
  const href = clean(value).replace(/[\u0000-\u001f\u007f]/g, '');
  if (!href) return '#';
  try {
    const { protocol } = new URL(href, document.baseURI);
    return protocol === 'http:' || protocol === 'https:' ? href : '#';
  } catch {
    return '#';
  }
};

// 선택 필드 coverPos: 사진에서 보여 줄 중심('50% 20%' · 'center top' 등). 글자 · 숫자 · % · 빈칸만 받는다
const safePos = (value) => {
  const pos = clean(value);
  return /^[a-z0-9.%\s-]{1,30}$/i.test(pos) ? pos : '';
};

// 글자 수에 따라 글자 크기를 한 단계씩 줄인다(css 의 data-len) — 긴 제목 · 긴 요약이 엽서 밖으로 넘치지 않게
const lenOf = (str, mid, long) => {
  const n = [...str].length;
  if (n > long) return 'l';
  return n > mid ? 'm' : 's';
};

// 글자는 모두 escapeHTML 을 거친다(innerHTML 로 넣으므로).
// 글(title · interviewee · affiliation · summary · coverAlt)은 지금 언어의 값 — 예: 영어면 "title_en" 이 있으면 그것, 없으면 "title"(js/i18n.js 의 pick)
function normalize(list) {
  return list
    .filter((item, i) => {
      const ok = Boolean(item && typeof item === 'object' && clean(item.id));
      if (!ok) console.warn(`[postcards] data/interviews.json 의 ${i + 1}번째 항목에 id 가 없어 건너뜁니다`);
      return ok;
    })
    .map((item, i) => {
      const id = clean(item.id);
      const title = clean(pick(item, 'title'));
      const summary = clean(pick(item, 'summary'));
      const affiliation = clean(pick(item, 'affiliation'));
      const variant = VARIANT_KEYS.includes(item.variant) ? item.variant : VARIANT_KEYS[i % VARIANT_KEYS.length];
      const no = clean(item.no) || id; // 선택 필드 no: 엽서에 찍히는 번호(없으면 id)
      return {
        rawId: id,
        rawNo: no, // 소인용(postmarkSVG 가 스스로 escapeHTML 을 한다 → 두 번 거치지 않게 날것으로 넘긴다)
        variant,
        id: escapeHTML(id),
        no: escapeHTML(no),
        href: escapeHTML(safeHref(item.href)),
        rawTitle: title, // 단추 이름표 문구(TEXT.flip)에 넣는 날것
        title: escapeHTML(title),
        titleLen: lenOf(title, 14, 23),
        interviewee: escapeHTML(clean(pick(item, 'interviewee'))),
        affiliation: escapeHTML(affiliation),
        affLen: lenOf(affiliation, 14, 30),
        summary: escapeHTML(summary),
        summaryLen: lenOf(summary, 26, 44),
        cover: escapeHTML(clean(item.cover)),
        coverAlt: escapeHTML(clean(pick(item, 'coverAlt'))),
        coverPos: safePos(item.coverPos),
      };
    });
}

/* ── 그리기 ─────────────────────────────────────────────────── */

// 엽서 한 장. 바깥(.pcard)은 기울기와 hover 를 맡고 돌지 않는다 → 도는 판은 .pcard__inner
function cardHTML(it, index) {
  const key = `pcard-${++uid}`;
  const look = VARIANTS[it.variant];
  const tape = `<span class="tape${look.tapeClass} pcard__tape" aria-hidden="true"></span>`;

  // 앞면: 대표 사진 + 인터뷰 제목 + 꼬리표. 앞면 전체를 덮는 단추가 엽서를 뒤집는다
  const front = `
      <div class="pcard__face pcard__front">
        <img class="pcard__photo" src="${it.cover}" alt="${it.coverAlt}" loading="lazy" decoding="async"${it.coverPos ? ` style="object-position: ${it.coverPos}"` : ''}>
        ${it.variant === 'b' ? tape : ''}
        <p class="pcard__tag" lang="en"><span><span class="pcard__tag-word">INTERVIEW</span> <b>${it.no}</b></span></p>
        <div class="pcard__label">
          ${it.variant === 'a' ? tape : ''}
          <h3 class="pcard__title" id="${key}-title" data-len="${it.titleLen}">${it.title}</h3>
        </div>
        ${DIRECT
    ? `<a class="pcard__flip pcard__go" href="${it.href}"><span class="visually-hidden">${it.title} — ${TEXT.read}</span><span class="pcard__turn" aria-hidden="true">${GO_SVG}</span></a>`
    : `<button type="button" class="pcard__flip" aria-expanded="false" aria-controls="${key}-back" aria-label="${TEXT.flip(it.rawTitle)}">
          <span class="pcard__turn" aria-hidden="true">${TURN_SVG}</span>
        </button>`}
      </div>`;

  // 뒷면: 실제 엽서 뒷면처럼 — 왼쪽에 한 줄 요약과 서명, 가운데 구분선, 오른쪽에 우표 · 소인 · 주소 줄 · '읽으러 가기'.
  // 링크(.pcard__link)가 뒷면 전체를 덮는다 → 뒷면 어디를 눌러도 기사로 간다
  const back = `
      <div class="pcard__face pcard__back" id="${key}-back">
        ${it.variant === 'b' ? '<span class="airmail-strip pcard__strip pcard__strip--top" aria-hidden="true"></span><span class="airmail-strip pcard__strip pcard__strip--bottom" aria-hidden="true"></span>' : ''}
        <a class="pcard__link" href="${it.href}">
          <span class="visually-hidden">${it.title} — </span>
          <span class="btn btn--s${look.ctaClass} pcard__cta">${TEXT.read} <span class="pcard__cta-arrow" aria-hidden="true">→</span></span>
        </a>
        <div class="pcard__note">
          <p class="pcard__kicker" lang="en" aria-hidden="true"><span class="pcard__kicker-main">Post Card</span><span class="pcard__kicker-dot">·</span>Interview ${it.no}</p>
          <p class="pcard__summary" data-len="${it.summaryLen}">${it.summary}</p>
          <p class="pcard__sign" aria-hidden="true">— ${it.interviewee}</p>
        </div>
        <div class="pcard__divider" aria-hidden="true"><span lang="en">POST CARD</span></div>
        <div class="pcard__addr">
          <div class="pcard__post" aria-hidden="true">
            <span class="postmark pcard__postmark">${postmarkSVG({ date: `No.${it.rawNo}`, top: 'JEJU POST', bottom: 'INTERVIEW' })}</span>
            <span class="pcard__stamp"><span class="stamp ${look.stampClass}">${stampSVG(look.stamp)}</span></span>
          </div>
          <p class="ruled pcard__lines">
            <span class="pcard__to"><span class="visually-hidden">${TEXT.interviewee} </span>${it.interviewee}</span>
            <span class="pcard__aff" data-len="${it.affLen}"><span class="visually-hidden">${TEXT.affiliation} </span>${it.affiliation}</span>
          </p>
        </div>
        <button type="button" class="pcard__unflip"><span class="pcard__unflip-icon" aria-hidden="true">${TURN_SVG}</span>${TEXT.unflip}</button>
      </div>`;

  return `
<div class="pcards__item" data-reveal style="--reveal-delay: ${(index * 0.12).toFixed(2)}s">
  <article class="pcard pcard--${it.variant}${DIRECT ? ' pcard--direct' : ''}" data-id="${it.id}" data-flipped="false" aria-labelledby="${key}-title">
    <div class="pcard__inner">${front}${DIRECT ? '' : back}
    </div>
  </article>
</div>`;
}

/* ── 뒤집기 ─────────────────────────────────────────────────── */

// 보이지 않는 면의 단추 · 링크는 누를 수도, Tab 으로 갈 수도 없게 막는다
const HAS_INERT = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

function setInert(face, on) {
  if (HAS_INERT) {
    face.inert = on;
    return;
  }
  // inert 를 모르는 옛 브라우저: 화면 낭독기와 Tab 순서에서만이라도 뺀다
  if (on) face.setAttribute('aria-hidden', 'true');
  else face.removeAttribute('aria-hidden');
  face.querySelectorAll('a, button').forEach((el) => {
    if (on) el.setAttribute('tabindex', '-1');
    else el.removeAttribute('tabindex');
  });
}

// 엽서 바깥을 누르면(터치 · 클릭) 뒤집혀 있던 엽서를 앞면으로 돌려놓는다. 문서에 한 번만 건다
function bindGlobal() {
  if (globalReady) return;
  globalReady = true;
  document.addEventListener('pointerdown', (event) => {
    bound.forEach((card) => {
      if (card.isFlipped() && !card.el.contains(event.target)) card.flip(false, { refocus: false });
    });
  }, { passive: true });
  // 기사에서 '뒤로 가기'로 돌아왔을 때(브라우저가 화면을 그대로 되살린 경우) 뒷면이 보인 채로 남지 않게.
  // 포커스가 뒷면 링크에 남아 있었다면 뒤집기 단추로 돌려준다(flip 이 옮긴다 — 보던 자리를 잃지 않게)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) bound.forEach((card) => card.flip(false));
  });
}

function bindCard(el) {
  const front = el.querySelector('.pcard__front');
  const back = el.querySelector('.pcard__back');
  const flipBtn = el.querySelector('.pcard__flip');
  const unflipBtn = el.querySelector('.pcard__unflip');
  const link = el.querySelector('.pcard__link');
  const photo = el.querySelector('.pcard__photo');

  let flipped = false;
  let flippedAt = 0; // 뒷면으로 뒤집은 시각(ms)
  let by = null; // 무엇으로 뒤집었나: 'mouse'(올려서) | 'touch'(눌러서) | 'key'(키보드로)
  let lastPointer = ''; // 방금 엽서를 누른 장치(click 이벤트가 장치를 알려 주지 않는 브라우저용)
  let mouseOver = false; // 마우스가 지금 엽서 위에 있는가
  let hold = false; // 마우스를 올려 둔 채 '앞면 보기' · Esc 로 돌아왔다면, 나갔다 다시 들어올 때까지 hover 로 뒤집지 않는다

  // 상태를 바꾼다. 포커스가 엽서 안에 있었으면 새로 보이는 면으로 옮긴다
  // (옮긴 뒤에 숨는 면을 막아야 포커스가 엽서 밖으로 튕겨 나가지 않는다)
  const flip = (next, { source = null, refocus = true } = {}) => {
    if (next === flipped) return;
    const hadFocus = el.contains(document.activeElement);
    flipped = next;
    flippedAt = next ? performance.now() : 0;
    by = next ? source : null;
    el.dataset.flipped = String(next);
    flipBtn.setAttribute('aria-expanded', String(next));
    const showing = next ? back : front;
    const hiding = next ? front : back;
    setInert(showing, false);
    if (hadFocus && refocus) (next ? link : flipBtn).focus({ preventScroll: true });
    setInert(hiding, true);
  };

  setInert(back, true);

  // 마우스가 '돌지 않는 바깥 상자(.pcard)' 안에 있는가. 도는 판은 원근 때문에 도는 동안 상자 밖으로 조금 비져나오는데,
  // 그 부분에 닿은 것까지 hover 로 치면 엽서 바로 바깥에서 마우스를 움직일 때 뒤집혔다 돌아왔다를 되풀이한다
  const insideBox = (event) => {
    const rect = el.getBoundingClientRect();
    const tilt = ((parseFloat(getComputedStyle(el).rotate) || 0) * Math.PI) / 180;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    // 기울기만큼 되돌려, 기울이기 전의 가로 · 세로와 견준다
    const x = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const y = dy * Math.cos(tilt) - dx * Math.sin(tilt);
    return Math.abs(x) <= el.offsetWidth / 2 && Math.abs(y) <= el.offsetHeight / 2;
  };

  // 마우스: 올리면 뒷면, 나가면 앞면.
  // 터치는 여기서 뒤집지 않는다(누르는 순간 뒤집히면 그 한 번의 탭이 곧바로 '이동'이 될 수 있다)
  const onMouseOver = (event) => {
    if (event.pointerType !== 'mouse') return;
    mouseOver = true;
    if (!flipped && !hold && insideBox(event)) flip(true, { source: 'mouse' });
  };
  el.addEventListener('pointerenter', onMouseOver);
  el.addEventListener('pointermove', onMouseOver, { passive: true });
  el.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    mouseOver = false;
    hold = false;
    // 마우스로 뒤집은 엽서, 또는 다른 방법으로 뒤집었지만 포커스가 이미 엽서를 떠난 엽서는 앞면으로
    if (by === 'mouse' || (flipped && !el.contains(document.activeElement))) flip(false);
  });
  el.addEventListener('pointerdown', (event) => { lastPointer = event.pointerType; }, { passive: true });

  // 터치: 첫 탭은 앞면의 단추에 닿는다 → 뒤집기만 한다. 뒷면에서 다시 누르면 링크가 받아 기사로 간다.
  // 키보드(Enter · Space): 뒤집고 포커스를 뒷면의 링크로 옮긴다.
  flipBtn.addEventListener('click', (event) => {
    const pointer = event.pointerType || lastPointer;
    const source = event.detail === 0 ? 'key' : pointer === 'mouse' ? 'mouse' : 'touch';
    hold = false;
    flip(true, { source });
  });

  // 터치로 뒤집은 직후에는 뒷면 링크가 눌려도 이동하지 않는다
  // (빠르게 두 번 누르면 둘째 탭이 막 돌아선 뒷면에 닿아, 뒷면을 보기도 전에 기사로 넘어가 버린다)
  link.addEventListener('click', (event) => {
    if (by === 'touch' && performance.now() - flippedAt < JUST_FLIPPED_MS) event.preventDefault();
  });

  unflipBtn.addEventListener('click', () => {
    flip(false);
    hold = mouseOver;
  });

  // Esc: 앞면으로 돌아가고 포커스도 뒤집기 단추로(flip 이 옮겨 준다)
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !flipped) return;
    event.stopPropagation();
    flip(false);
    hold = mouseOver;
  });

  // Tab 으로 엽서를 벗어나면 앞면으로(마우스를 올려 둔 동안에는 그대로 둔다).
  // 포커스가 엽서 밖의 다른 요소로 옮겨 갔을 때만 — 도는 중인 엽서를 다시 눌러 포커스가 풀렸을 뿐인 경우(옮겨 간 곳 없음)는 그대로 둔다
  el.addEventListener('focusout', (event) => {
    const to = event.relatedTarget;
    if (!to || el.contains(to)) return;
    if (flipped && by !== 'mouse') flip(false, { refocus: false });
  });

  // 사진을 불러오지 못하면 깨진 그림 대신 빈 종이를 보여 준다
  const noPhoto = () => el.classList.add('pcard--nophoto');
  if (!photo.getAttribute('src') || (photo.complete && photo.naturalWidth === 0)) noPhoto();
  photo.addEventListener('error', noPhoto);

  bound.push({ el, flip, isFlipped: () => flipped });
  // 이제부터 스크립트가 뒤집는다 → css 만으로 뒤집는 대비책(:hover · :focus-within)을 끈다
  el.classList.add('is-live');
}

/* ── 시작 ───────────────────────────────────────────────────── */

export function init(root, data, options = {}) {
  // 엽서를 놓을 자리: root 안의 [data-pcards] (없으면 root 자체)
  const mount = root.querySelector('[data-pcards]') || root;
  const only = Array.isArray(options && options.only) ? options.only.map(String) : null;

  // 안내 쪽지는 엽서 자리 바로 뒤에 둔다(기사 하단에서는 '목록으로' 단추보다 앞에 오게)
  const note = (message) => {
    const el = showNote(root, message);
    if (el && mount !== root) mount.after(el);
  };

  if (!Array.isArray(data) || data.length === 0) {
    note(TEXT.empty);
    return;
  }

  const all = normalize(data);
  const items = only ? all.filter((it) => only.includes(it.rawId)) : all;
  if (items.length === 0) {
    note(only && all.length ? TEXT.noOther : TEXT.empty);
    return;
  }

  mount.innerHTML = items.map(cardHTML).join('');
  mount.dataset.count = String(items.length);
  mount.classList.add('is-ready'); // 미리 잡아 둔 빈 자리(점선 엽서) 대신 진짜 엽서가 놓였다

  mount.querySelectorAll('.pcard').forEach((card) => {
    try {
      if (DIRECT) {
        // 뒤집지 않는다: 사진을 못 불러올 때의 대비만 하고, css 만으로 뒤집는 대비책(:hover · :focus-within)도 끈다(.is-live)
        const photo = card.querySelector('.pcard__photo');
        const noPhoto = () => card.classList.add('pcard--nophoto');
        if (photo && (!photo.getAttribute('src') || (photo.complete && photo.naturalWidth === 0))) noPhoto();
        if (photo) photo.addEventListener('error', noPhoto);
        card.classList.add('is-live');
        return;
      }
      bindCard(card);
    } catch (err) {
      console.error('[postcards] 엽서 뒤집기 준비 중 오류(css 만으로 뒤집힙니다)', err);
    }
  });
  bindGlobal();
}
