// i18n.js — 언어 전환(한국어 / English / 제주어): 사전 읽기 · 문서에 입히기 · 전환 단추 · 데이터의 언어별 값
// 자세한 쓰는 법은 README 의 '언어 전환' 절.
//   · 화면의 한국어(HTML 에 적힌 글자 · JS 의 t() 둘째 값)가 원문이자 기본값이다. 번역은 data/i18n/en.json · jje.json 에 { "키": "문구" } 로 적는다.
//   · HTML: 바꿀 요소에 data-i18n="키"(글자) · data-i18n-html="키"(<br> <em> <strong> <b> <small> <span> 만 허용)
//           · data-i18n-attr="aria-label:키; alt:키2"(속성 — 여러 개는 ; 로 나눈다)
//   · JS:   t('키', '한국어', { 변수 }) — 문구 안의 {name} 이 변수 자리. HTML 문자열 안에 넣을 때는 tHTML(같은 모양, 특수 문자를 바꿔 준다)
//   · 데이터(JSON · CSV): pick(항목, '필드') — 'quote_en' · 'meaning_jje' 처럼 '<필드>_<언어>' 값이 있으면 그것, 없으면 한국어 값
//   · 기사 본문: <div data-lang-block="ko"> · "en" · "jje" 가운데 지금 언어의 블록만 보인다(없거나 비면 한국어 블록 + 안내)
//   · 사전에 없는 키는 한국어로 보인다. 주소에 ?i18n-debug=1 을 붙이면 빠진 키를 화면에 점선으로 표시하고 콘솔에 목록을 낸다
// 언어를 고르는 순서: 주소의 ?lang=ko|en|jje → 저장된 값(localStorage 'hayeong-lang') → 한국어.
//   각 HTML <head> 의 한 줄 스크립트가 먼저 정해 <html lang · data-lang> 에 적고, 한국어가 아니면 글을 바꿀 때까지 화면을 잠깐 가린다(i18n-pending, 최대 1.5초).
// 언어를 바꾸면 저장하고 페이지를 다시 불러온다(모든 모듈이 처음부터 그 언어로 그린다 — 그리는 도중에 바꾸지 않는다).
// 모듈 맨 바깥에서는 DOM 을 건드리지 않는다. js/main.js · js/article.js 가 섹션을 시작하기 전에 loadI18n() 을 기다린다.

import { escapeHTML, fetchJSON, getConfig, withTimeout } from './shared.js';

// 23차: '제주어' 화면 전환 단추는 뺐다(언어 단추 = 한국어 · English). 예전에 제주어를 골라 저장해 둔 방문자는 한국어로 열린다.
// 제주어판을 되살리려면 여기에 'jje' 를 다시 넣고, index.html <head> 의 한 줄 스크립트의 L 목록에도 'jje' 를 넣는다(번역 data/i18n/jje.json 은 남아 있다)
export const LANGS = ['ko', 'en'];

// ✏️ 교체: 전환 단추의 글자 — 각 언어를 그 언어로 적은 이름(long = 넓은 화면, short = 좁은 화면 · 폭 767px 이하).
//          화면 낭독기는 늘 long 을 읽는다. 단추 묶음의 이름('언어 선택')은 사전의 lang.group
const LANG_NAMES = {
  ko: { long: '한국어', short: 'KO' },
  en: { long: 'English', short: 'EN' },
  jje: { long: '제주어', short: '제주' },
};

const STORE_KEY = 'hayeong-lang'; // 각 HTML <head> 의 한 줄 스크립트와 같아야 한다
const DICT_WAIT = 6000; // 사전 파일을 기다리는 시간(ms). 넘기면 한국어로 보여 준다
const FONT_WAIT = 800; // 제주어판: 아래아 글꼴을 기다리는 시간(ms) — 자모가 흩어져 보였다가 붙는 깜빡임을 막는다
// 아래아 음절(조합형 옛한글: 초성 U+1100–1112 + 아래아 ᆞ/ᆢ)
const ARAEA = /[\u1100-\u1112][\u119E\u11A2]/;

const state = {
  lang: '',
  dict: {},
  ready: false, // 사전을 다 읽었는가(그 전에 부른 t() 는 빠진 키로 세지 않는다)
  debug: false,
  missing: new Map(), // 빠진 키 → 그 자리에 보인 한국어(화면에 점선으로 표시할 때 찾는다)
};

/* ── 언어 정하기 · 바꾸기 ─────────────────────────────────────────────────── */

const isLang = (value) => LANGS.includes(value);

// <head> 의 한 줄 스크립트가 정한 값(없으면 같은 순서로 다시 정한다)
function detect() {
  const fromHtml = document.documentElement.dataset.lang;
  if (isLang(fromHtml)) return fromHtml;
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등) */ }
  return 'ko';
}

// 지금 언어: 'ko' | 'en' | 'jje'
export const getLang = () => state.lang || detect();

// 언어를 바꾼다: 저장한 뒤 페이지를 다시 불러온다(보던 자리는 브라우저가 되살린다).
// 주소에 ?lang= 이 있으면 그 값이 우선하므로 주소도 고친다. 저장할 수 없는 브라우저에서는 주소에 ?lang= 을 붙여 둔다
export function setLang(next) {
  if (!isLang(next) || next === getLang()) return;
  let saved = false;
  try {
    localStorage.setItem(STORE_KEY, next);
    saved = localStorage.getItem(STORE_KEY) === next;
  } catch { /* 아래에서 주소로 대신한다 */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang') || !saved) {
    url.searchParams.set('lang', next);
    history.replaceState(history.state, '', url);
  }
  location.reload();
}

// 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)에서는 언어를 기억할 곳이 주소뿐이다 →
// 이 사이트의 다른 페이지로 가는 링크를 누를 때 ?lang= 을 붙여 준다(데이터로 그린 엽서의 링크까지 — 누르는 순간에 고친다)
function keepLangInLinks() {
  try {
    localStorage.setItem(STORE_KEY, state.lang);
    if (localStorage.getItem(STORE_KEY) === state.lang) return;
  } catch { /* 저장소를 쓸 수 없다 → 아래로 */ }
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\.html?$|\/$/.test(url.pathname)) return;
    url.searchParams.set('lang', state.lang);
    link.href = url.href;
  }, true);
}

/* ── 문구 꺼내기 ──────────────────────────────────────────────────────────── */

// '{count}곳' + { count: 3 } → '3곳'. 값이 없는 자리는 그대로 둔다
const fill = (text, vars) =>
  (vars ? text.replace(/\{([a-zA-Z]+)\}/g, (all, name) => (vars[name] === undefined || vars[name] === null ? all : String(vars[name]))) : text);

// 사전에서 문구를 꺼낸다. 사전에 없거나(빈 문구 포함) 한국어 화면이면 ko(한국어 원문)를 쓴다
export function t(key, ko, vars) {
  let text = String(ko ?? '');
  if (state.lang && state.lang !== 'ko') {
    const value = state.dict[key];
    if (typeof value === 'string' && value.trim()) text = value;
    else if (state.ready) noteMissing(key, fill(text, vars));
  }
  return fill(text, vars);
}

// HTML 문자열 안에 넣을 문구(글자 · 속성값). 변수는 날것으로 넘기면 문구 전체를 한 번에 바꿔 준다(& < > " ')
export const tHTML = (key, ko, vars) => escapeHTML(t(key, ko, vars));

// 데이터 항목의 언어별 값: 지금 언어가 en 이면 item.quote_en, jje 면 item.quote_jje → 비었으면 item.quote(한국어)
export function pick(item, field) {
  if (!item || typeof item !== 'object') return undefined;
  if (state.lang && state.lang !== 'ko') {
    const value = item[`${field}_${state.lang}`];
    if (value !== undefined && value !== null && String(value).trim() !== '') return typeof value === 'string' ? value.normalize('NFC') : value;
    const ko = item[field];
    if (state.ready && ko !== undefined && ko !== null && String(ko).trim()) {
      noteMissing(`data:${field}_${state.lang} (${String(item.id ?? item.name ?? '?').trim()})`, String(ko).trim());
    }
  }
  return item[field];
}

function noteMissing(key, ko) {
  if (!state.debug || state.missing.has(key)) return;
  state.missing.set(key, ko);
  scheduleDebug();
}

/* ── 문서에 입히기 ────────────────────────────────────────────────────────── */

// data-i18n: 요소의 글자를 바꾼다. 안에 그림(svg)이나 다른 태그가 있으면 요소에 바로 붙은 첫 글자 마디만 바꾼다
// (앞뒤 빈칸은 원래대로 둔다 — 아이콘과 글자 사이 간격이 그대로 남는다)
function setText(el, value) {
  const node = el.children.length ? [...el.childNodes].find((n) => n.nodeType === 3 && n.data.trim()) : null;
  const old = node ? node.data : el.textContent;
  const [, lead, , trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(old);
  if (node) node.data = lead + value + trail;
  else el.textContent = lead + value + trail;
}

// data-i18n-html: 허용한 태그만 남기고 나머지 태그는 글자로 푼다. 속성은 class · lang 만
const SAFE_TAGS = new Set(['BR', 'EM', 'STRONG', 'B', 'I', 'SMALL', 'SPAN']);
function safeHTML(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const clean = (parent) => {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType === 3) return;
      if (node.nodeType !== 1 || !SAFE_TAGS.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.nodeType === 1 ? node.textContent : ''));
        return;
      }
      [...node.attributes].forEach((attr) => {
        const ok = (attr.name === 'class' && /^[\w\s-]*$/.test(attr.value)) || (attr.name === 'lang' && /^[\w-]{2,12}$/.test(attr.value));
        if (!ok) node.removeAttribute(attr.name);
      });
      clean(node);
    });
  };
  clean(tpl.content);
  return tpl.content;
}

// 'aria-label:intro.seal-label; alt:site.name' → [['aria-label', 'intro.seal-label'], ['alt', 'site.name']]
const attrPairs = (spec) =>
  String(spec || '').split(';').map((part) => part.split(':').map((s) => s.trim())).filter(([name, key]) => name && key);

const lookup = (key) => {
  const value = state.dict[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

// 빠진 키(디버그): 요소에 표시를 남긴다(화면 점선은 css/base.css 의 '언어 전환' 절)
function markStatic(el, key, ko, kind) {
  if (!state.debug) return;
  state.missing.set(key, ko);
  el.setAttribute(kind === 'attr' ? 'data-i18n-missing-attr' : 'data-i18n-missing', key);
}

// root 안의 data-i18n · data-i18n-html · data-i18n-attr 를 지금 언어로 바꾼다(한국어면 아무것도 하지 않는다)
export function applyI18n(root = document) {
  if (!state.lang || state.lang === 'ko' || !root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const value = lookup(key);
    if (value) setText(el, value);
    else markStatic(el, key, (el.children.length ? [...el.childNodes].find((n) => n.nodeType === 3 && n.data.trim())?.data : el.textContent || '').trim());
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    const value = lookup(key);
    if (value) el.replaceChildren(safeHTML(value));
    else markStatic(el, key, el.textContent.replace(/\s+/g, ' ').trim());
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    attrPairs(el.dataset.i18nAttr).forEach(([name, key]) => {
      const value = lookup(key);
      if (value) el.setAttribute(name, value);
      else markStatic(el, key, el.getAttribute(name) || '', 'attr');
    });
  });
}

// 기사 본문의 언어 블록: 같은 부모 안의 [data-lang-block] 가운데 지금 언어의 것만 보이고 나머지는 hidden.
// 그 언어 블록이 없거나 비어 있으면 한국어 블록을 보이고, 그 위에 '아직 옮기지 않은 글' 안내를 단다.
// 보이는 블록에 맞춰: 그 블록 h1 의 id 로 aria-labelledby, 블록의 data-cover-alt 로 대표 사진의 대체 글(img[data-lang-alt]), 탭 제목
function applyLangBlocks() {
  if (state.lang === 'ko') return;
  const groups = new Map();
  document.querySelectorAll('[data-lang-block]').forEach((block) => {
    const parent = block.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(block);
  });
  groups.forEach((blocks, parent) => {
    const ko = blocks.find((b) => b.dataset.langBlock === 'ko');
    const mine = blocks.find((b) => b.dataset.langBlock === state.lang);
    const filled = Boolean(mine && mine.textContent.trim());
    const show = filled ? mine : ko;
    if (!show) return;
    blocks.forEach((b) => { b.hidden = b !== show; });

    if (!filled) {
      // 한국어 블록으로 대신 보여 준다 — 화면 낭독기가 한국어로 읽게 lang 을 단다
      show.lang = 'ko';
      if (state.debug) state.missing.set(`block:${state.lang}`, '');
      const note = document.createElement('p');
      note.className = 'placeholder-note i18n-note';
      note.setAttribute('role', 'note');
      note.textContent = t('article.not-translated', '아직 이 언어로 옮기지 않은 글입니다');
      show.before(note);
      return;
    }
    const heading = show.querySelector('h1[id]');
    if (heading && parent.hasAttribute('aria-labelledby')) parent.setAttribute('aria-labelledby', heading.id);
    const alt = show.dataset.coverAlt;
    const img = parent.querySelector('img[data-lang-alt]');
    if (img && alt !== undefined) img.alt = alt;
    if (heading && heading.textContent.trim()) document.title = `${heading.textContent.trim()} — ${t('site.name', '하영 고라보게')}`;
  });
}

/* ── 전환 단추 ───────────────────────────────────────────────────────────── */

// config.js 의 links.english — 영어판 랜딩페이지 주소(http · https 로 시작하는 전체 주소만). 없으면 ''
function englishLink() {
  const raw = String(getConfig().links.english ?? '').trim();
  if (!raw) return '';
  // 같은 사이트 안의 페이지(예: 'en/' · 'en/index.html') — 주소 꼴(https: · mailto: …)이나 '//' 로 시작하지 않는 상대 경로는 그대로 쓴다
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//') && /^[\w./#?=&%-]+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* 주소 꼴이 아니다 → 아래 경고로 */ }
  console.warn(`[i18n] config.js 의 links.english 는 https:// · http:// 로 시작하는 전체 주소이거나 이 사이트 안의 경로(예: en/index.html)여야 해요. 지금 값(${raw})은 무시하고 이 사이트의 영어 번역을 씁니다.`);
  return '';
}

// [data-lang-switch] 자리마다 단추 세 개(한국어 / English / 제주어)를 그린다. 지금 언어는 aria-pressed="true".
// 영어판 랜딩페이지 주소(links.english)가 있으면 English 는 그 페이지로 가는 링크가 된다
function renderSwitches() {
  const english = englishLink();
  document.querySelectorAll('[data-lang-switch]').forEach((slot) => {
    if (slot.querySelector('.lang-switch')) return;
    const buttons = LANGS.map((code) => {
      const name = LANG_NAMES[code];
      if (code === 'en' && english) {
        return `<a class="lang-switch__btn" lang="en" hreflang="en" href="${escapeHTML(english)}">`
          + `<span class="lang-switch__long">${escapeHTML(name.long)}</span><span class="lang-switch__short" aria-hidden="true">${escapeHTML(name.short)}</span></a>`;
      }
      return `<button type="button" class="lang-switch__btn" lang="${code}" data-lang-to="${code}" aria-pressed="${code === state.lang}">`
        + `<span class="lang-switch__long">${escapeHTML(name.long)}</span><span class="lang-switch__short" aria-hidden="true">${escapeHTML(name.short)}</span></button>`;
    }).join('');
    slot.innerHTML = `<div class="lang-switch" role="group" aria-label="${tHTML('lang.group', '언어 선택')}">${buttons}</div>`;
    const floating = slot.classList.contains('lang-float');
    slot.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-lang-to]') : null;
      if (!button) return;
      // 휴대폰에서 접혀 있을 때(지금 언어 단추 하나만 보일 때 — css/base.css '언어 전환'): 누르면 세 단추를 펼친다
      if (floating && button.getAttribute('aria-pressed') === 'true' && isFolded()) {
        foldSwitch(slot, slot.classList.contains('is-open'));
        return;
      }
      if (floating) foldSwitch(slot, true);
      if (button.dataset.langTo !== state.lang) document.dispatchEvent(new CustomEvent('hayeong:lang-change', { detail: { lang: button.dataset.langTo } }));
      setLang(button.dataset.langTo);
    });
    if (floating) {
      // 펼친 채로 다른 곳을 누르면 다시 접는다
      document.addEventListener('click', (event) => {
        if (slot.classList.contains('is-open') && !slot.contains(event.target)) foldSwitch(slot, true);
      });
      watchAvoid(slot);
    }
  });
}

// index 의 떠 있는 언어 단추가 접히는 때: 휴대폰(폭 767px 이하)에서 위쪽 목차가 내려온 뒤(<html class="past-intro"> — js/main.js)
const isFolded = () => window.matchMedia('(max-width: 767px)').matches && document.documentElement.classList.contains('past-intro');

function foldSwitch(slot, fold) {
  slot.classList.toggle('is-open', !fold);
  const current = slot.querySelector('[aria-pressed="true"]');
  if (current) current.setAttribute('aria-expanded', String(!fold));
}

// 화면에 떠 있는 단추(index 의 .lang-float) 자리에 눌러야 하는 것(HTML 에서 data-lang-avoid 를 붙인 요소 — 지도 단추 줄)이
// 들어와 있는 동안 단추를 숨긴다(css 의 html.lang-avoid). 플로팅 버튼의 data-fab-avoid 와 같은 방식
function watchAvoid(slot) {
  const targets = [...document.querySelectorAll('[data-lang-avoid]')];
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const html = document.documentElement;
  const inside = new Set();
  let observer = null;
  let box = '';
  const watch = () => {
    const rect = slot.getBoundingClientRect();
    if (!rect.width) return;
    const view = document.documentElement;
    // 단추 자리 + 둘레 8px 만 보는 관찰 창(위 · 오른쪽 · 아래 · 왼쪽을 그만큼 깎는다)
    const next = `${-Math.max(0, Math.round(rect.top - 8))}px ${-Math.max(0, Math.round(view.clientWidth - rect.right - 8))}px ${-Math.max(0, Math.round(view.clientHeight - rect.bottom - 8))}px ${-Math.max(0, Math.round(rect.left - 8))}px`;
    if (next === box) return;
    box = next;
    if (observer) observer.disconnect();
    inside.clear();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? inside.add(entry.target) : inside.delete(entry.target)));
      html.classList.toggle('lang-avoid', inside.size > 0 && !slot.contains(document.activeElement));
    }, { rootMargin: next });
    targets.forEach((el) => observer.observe(el));
  };
  watch();
  window.addEventListener('resize', watch);
  if ('ResizeObserver' in window) new ResizeObserver(watch).observe(slot);
}

/* ── 사전 읽기 ───────────────────────────────────────────────────────────── */

// { "키": "문구" } 만 남긴다(글자가 아닌 값 · 빈 문구는 버린다). 제주어의 아래아 음절이 풀려 있어도 한 덩어리로 보이게 NFC 로 맞춘다
function cleanDict(data) {
  const out = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) out[key] = value.normalize('NFC');
  });
  return out;
}

// 제주어판: 아래아 글꼴(css/base.css 의 Araea …)을 미리 받아 둔다. 늦으면 기다리지 않는다
function araeaFontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const sample = '\u1112\u119E\u11AB'; // ᄒᆞᆫ
  const loads = ['Araea Sans', 'Araea Serif', 'Araea Display', 'Araea Hand'].map((family) => document.fonts.load(`1em "${family}"`, sample));
  return withTimeout(Promise.all(loads), FONT_WAIT).catch(() => {});
}

let loading = null;

// 언어를 정하고(한국어가 아니면 사전을 받아) 문서에 입힌 뒤, 전환 단추를 그리고 가림막(i18n-pending)을 걷는다.
// 여러 번 불러도 한 번만 한다. 사전을 받지 못해도 실패하지 않는다(한국어로 보인다)
export function loadI18n() {
  if (!loading) loading = start();
  return loading;
}

async function start() {
  const html = document.documentElement;
  state.lang = detect();
  state.debug = new URLSearchParams(location.search).get('i18n-debug') === '1';
  html.lang = state.lang;
  html.dataset.lang = state.lang;
  try {
    if (state.lang !== 'ko') {
      keepLangInLinks();
      try {
        state.dict = cleanDict(await withTimeout(fetchJSON(new URL(`../data/i18n/${state.lang}.json`, import.meta.url).href), DICT_WAIT, `data/i18n/${state.lang}.json 의 응답이 늦어요`));
      } catch (err) {
        console.error(`[i18n] data/i18n/${state.lang}.json 을 읽지 못해 한국어로 보여 줍니다${err instanceof SyntaxError ? '(쉼표 · 따옴표 등 파일의 문법을 확인해 주세요)' : ''}`, err);
        state.dict = {};
      }
      if (state.lang === 'jje' && Object.values(state.dict).some((value) => ARAEA.test(value))) await araeaFontsReady();
    }
    state.ready = true;
    applyI18n(document);
    applyLangBlocks();
  } catch (err) {
    console.error('[i18n] 번역을 입히지 못했어요', err);
  } finally {
    try {
      renderSwitches();
    } catch (err) {
      console.error('[i18n] 언어 전환 단추를 그리지 못했어요', err);
    }
    html.classList.remove('i18n-pending');
    if (state.debug) startDebug();
  }
}

/* ── ?i18n-debug=1 : 빠진 키 보기 ─────────────────────────────────────────── */

let debugTimer = 0;
const scheduleDebug = () => {
  if (!state.debug || !document.documentElement.classList.contains('i18n-debug')) return;
  clearTimeout(debugTimer);
  debugTimer = setTimeout(markDynamic, 300);
};

// JS 가 그린 글자 · 속성 가운데 빠진 키의 한국어와 같은 것에 점선 표시(data-i18n-missing)를 단다
function markDynamic() {
  const texts = new Map();
  state.missing.forEach((ko, key) => {
    if (ko && ko.length > 1 && !key.startsWith('block:')) texts.set(ko, key);
  });
  if (!texts.size) return;
  const find = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    if (texts.has(text)) return texts.get(text);
    for (const [ko, key] of texts) if (ko.length > 2 && text.includes(ko)) return key;
    return null;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-lang-switch], script, style')) continue;
    const key = find(node.data);
    if (key && !parent.hasAttribute('data-i18n-missing')) parent.setAttribute('data-i18n-missing', key);
  }
  document.body.querySelectorAll('[aria-label], [alt], [title], [placeholder]').forEach((el) => {
    if (el.closest('[data-lang-switch]')) return;
    const key = ['aria-label', 'alt', 'title', 'placeholder'].map((name) => find(el.getAttribute(name))).find(Boolean);
    if (key && !el.hasAttribute('data-i18n-missing-attr')) el.setAttribute('data-i18n-missing-attr', key);
  });
}

function report() {
  const keys = [...state.missing.keys()].sort();
  const file = `data/i18n/${state.lang}.json`;
  if (!keys.length) {
    console.info(`[i18n] ${file}: 빠진 키가 없어요`);
    return;
  }
  console.info(`[i18n] ${file} 에 없는 키 ${keys.length}개(화면에 빨간 점선 — 글자, 파란 점선 — 화면 낭독기 이름 · 대체 글). 'data:' 는 데이터 파일의 '<필드>_${state.lang}', 'block:' 은 기사 언어 블록`, keys);
}

function startDebug() {
  const html = document.documentElement;
  if (state.lang === 'ko') {
    console.info('[i18n] 한국어 화면은 원문 그대로라 빠진 키가 없어요. ?lang=en&i18n-debug=1 · ?lang=jje&i18n-debug=1 로 확인하세요');
    return;
  }
  html.classList.add('i18n-debug');
  scheduleDebug();
  if ('MutationObserver' in window) new MutationObserver(scheduleDebug).observe(document.body, { childList: true, subtree: true, characterData: true });
  // 데이터로 그리는 섹션이 다 그려진 뒤에 목록을 낸다(나중에 생기는 쪽지 · 창의 문구는 화면 표시만 늘어난다)
  const done = () => setTimeout(() => {
    markDynamic();
    report();
  }, 2500);
  if (document.readyState === 'complete') done();
  else window.addEventListener('load', done, { once: true });
  window.i18nMissing = () => [...state.missing.keys()].sort(); // 콘솔에서 언제든 다시 볼 수 있게
}
