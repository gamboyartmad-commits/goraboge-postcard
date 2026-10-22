// map.js — 5. 제주어 상호 지도: Leaflet 지도 + 우표 마커(겹치는 곳은 묶음 우표) + 커서 옆 쪽지(툴팁) + 장소 목록(더보기).
// data = 장소 목록(config.js 의 map.dataFile — 기본 data/places.json, CSV 파일도 된다)
// 지도 높이와 접힌 목록의 높이는 css/map.css 가 미리 잡는다(데이터가 오기 전후로 문서 길이가 달라지지 않게).
// 여기서는 (1) 목록을 그리고 (2) 지도 · 마커 · 지명을 만들고 (3) 쪽지를 열고 닫는다.
// Leaflet(전역 L)을 불러오지 못했으면 지도 자리에 안내만 띄우고 목록은 그대로 보여 준다.

import { pick, t } from './i18n.js';
import { clamp, escapeHTML, getConfig, prefersReducedMotion, showNote } from './shared.js';
import { track } from './track.js';

/* ── 고칠 수 있는 값 ─────────────────────────────────────────── */

// 범위는 모두 [[남쪽 위도, 서쪽 경도], [북쪽 위도, 동쪽 경도]]
// ✏️ 교체: 처음에 보이는 범위(섬 전체 + 약간의 여백)
const ISLAND = [[33.16, 126.12], [33.6, 126.99]];
// ✏️ 교체: '북동부 가까이 보기' 범위(마커 대부분이 모인 조천 · 구좌 일대)
const NORTHEAST = [[33.405, 126.6], [33.575, 126.945]];
// 지도를 끌 수 있는 한계(섬 전체보다 조금 넓게, 가운데는 같게). 이 밖의 좌표는 잘못 적힌 것으로 보고 찍지 않는다
const MAX_BOUNDS = [[33.1, 126.07], [33.66, 127.04]];
const MAX_ZOOM = 16;
const ZOOM_SNAP = 0.25; // 줌이 바뀌는 단위
const FOCUS_ZOOM = 13; // 목록에서 장소를 눌렀을 때 다가가는 줌(그 곳이 묶음 우표 안에 있으면 낱개로 보일 때까지 더 다가간다)

// 목록에 처음 보여 줄 곳 수(나머지는 '더보기'를 눌러야 보인다). ✏️ 교체: 값은 config.js 의 map.listFirst 에서 고친다.
// 바꾸면 접힌 목록의 줄 수 --map-rows(= 이 수 ÷ 단 수, 올림)도 함께 고친다(css/theme.css 의 '7. 지도')
const LIST_FIRST_DEFAULT = 4; // config.js 에 값이 없거나 1 이상의 정수가 아닐 때
const listFirstOf = (value) => {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1) return n;
  console.warn(`[map] config.js 의 map.listFirst 는 1 이상의 정수여야 해요. 지금 값(${value})은 무시하고 ${LIST_FIRST_DEFAULT}곳을 보여 줍니다.`);
  return LIST_FIRST_DEFAULT;
};
let LIST_FIRST_WIDE = LIST_FIRST_DEFAULT; // init 이 config.js 의 값으로 정한다
let LIST_FIRST_PHONE = 2; // 휴대폰(폭 767px 이하) — config.js 의 map.listFirstPhone(25차)
const PHONE = window.matchMedia('(max-width: 767px)');
const listFirst = () => (PHONE.matches ? LIST_FIRST_PHONE : LIST_FIRST_WIDE);

// 묶음 우표: 장소가 많아지면 멀리서 볼 때 우표가 겹친다 → 화면에서 우표 폭의 이 배수 안에 모인 곳들을 한 장으로 합치고 곳 수를 적는다
const BUNDLE_NEAR = 0.9;
// 다만 두세 곳이 살짝만 겹칠 때(서로 우표 폭의 BUNDLE_LOOSE 배 넘게 떨어져 있을 때)는 묶지 않고 서로 조금씩 밀어 낸다
const BUNDLE_LOOSE = 0.5;
const BUNDLE_LOOSE_MAX = 3;
const SQUASH = 1; // 핀은 동그랗다 → 겹침을 따질 때 위아래 · 좌우 거리를 같게 본다

// ✏️ 교체: 단추 · 묶음 우표 · 쪽지 · 목록 · 안내의 글자(언어별 문구는 data/i18n/*.json 의 같은 키 — t('키', '한국어')).
//          쓸 때 꺼내 읽는다(get · 함수) — 사전이 도착한 뒤의 언어로. 분류(가게 · 명소)는 데이터의 값이 아니라 아래 category 가 화면에 쓰는 이름
const TEXT = {
  more: (count) => t('map.list-more', '더보기 ({count}곳)', { count }), // 목록 아래 단추(접혀 있을 때). count = 숨어 있는 곳 수
  get less() { return t('map.list-less', '접기'); }, // 같은 단추(펼쳐져 있을 때)
  bundle: (count) => t('map.bundle', '{count}곳 — 눌러서 가까이 보기', { count }), // 묶음 우표의 이름(화면 낭독기 · 키보드)
  bundleTip: (count) => t('map.bundle-tip', '이 근처 제주어 상호 {count}곳 · 누르면 펼쳐져요', { count }), // 묶음 핀에 마우스를 올리면 뜨는 말풍선
  count: (count) => t('map.count', '{count}곳', { count }), // 범례 · 목록 제목 옆의 곳 수
  category: (p) => t(`map.cat-${p.cat}`, p.category),
  get all() { return t('map.filter-all', '전체'); }, // 분류 · 지역 단추의 첫 칸
  get catLabel() { return t('map.filter-cat', '분류'); }, // 단추 줄의 이름
  get regionLabel() { return t('map.filter-region', '지역'); },
  region: (r) => t(`map.region-${r.cls}`, r.key),
  // 우표(마커)의 이름(화면 낭독기 · 키보드): '이름 — 분류(업종)'
  pin: (p) => (p.kind
    ? t('map.pin-label-kind', '{name} — {category}({kind})', { name: p.name, category: TEXT.category(p), kind: p.kind })
    : t('map.pin-label', '{name} — {category}', { name: p.name, category: TEXT.category(p) })),
  get where() { return t('map.tip-where', '위치'); }, // 쪽지 · 목록의 줄 이름
  get meaning() { return t('map.tip-meaning', '뜻'); },
  get approx() { return t('map.approx', '위치는 대략이에요'); },
  get nocoord() { return t('map.nocoord', '좌표 확인 중'); },
  // 지도 자리의 안내
  empty: (file) => t('map.empty', '지도에 올릴 장소가 없어요({file} 파일을 확인해 주세요)', { file }),
  get noMap() { return t('map.no-map', '지도를 불러오지 못했어요 — 아래 목록에서 장소를 볼 수 있어요'); },
  get wait() { return t('map.wait', '지도를 불러오는 중이에요…'); },
  get noTiles() { return t('map.no-tiles', '지도를 불러오지 못했어요(인터넷 연결을 확인해 주세요)'); },
};

// ✏️ 교체: 방향을 잡아 주는 손글씨 지명(타일에는 글자가 없다). key = 언어별 이름의 사전 키, name = 한국어
// side = 글자를 점의 어느 쪽에 둘지(s 아래 · n 위 · e 오른쪽), minZoom = 이 줌보다 멀리서 볼 때는 숨긴다(마커와 겹치므로)
const LABELS = [
  { key: 'map.label-hallasan', name: '한라산', lat: 33.3617, lng: 126.5292, kind: 'peak', side: 's', minZoom: 0 },
  { key: 'map.label-jeju-city', name: '제주시', lat: 33.4996, lng: 126.5312, kind: 'town', side: 'e', minZoom: 9.75 },
  { key: 'map.label-seogwipo', name: '서귀포', lat: 33.2541, lng: 126.56, kind: 'town', side: 's', minZoom: 0 },
  { key: 'map.label-seongsan', name: '성산일출봉', lat: 33.4581, lng: 126.9425, kind: 'town', side: 's', minZoom: 10.5 },
  { key: 'map.label-udo', name: '우도', lat: 33.5045, lng: 126.9535, kind: 'isle', side: 'n', minZoom: 10.5 },
];

// 바다 위 장식: 물결 몇 줄과 바다 이름('바당' = 바다의 제주어. 사전 키 map.sea · map.sea-sub)
const DOODLES = [
  { kind: 'wave', lat: 33.515, lng: 126.225 },
  { kind: 'wave', lat: 33.19, lng: 126.92 },
  { kind: 'wave', lat: 33.175, lng: 126.39 },
  { kind: 'wave', lat: 33.69, lng: 126.66 },
  { kind: 'wave', lat: 33.07, lng: 126.6 },
  { kind: 'sea', lat: 33.218, lng: 126.79, text: '바당', sub: '바다' },
];

const LEAFLET_WAIT = 20000; // 늦게 오는 지도 라이브러리를 이만큼 더 기다린다(ms). 그래도 없으면 목록만 보여 준다

const TIP_GAP = 14; // 커서와 쪽지 사이
const TIP_EDGE = 8; // 화면 가장자리와 쪽지 사이

/* ── 작은 그림(인라인 SVG) ───────────────────────────────────── */

const PEAK_SVG = '<svg class="map-label__peak" viewBox="0 0 34 20" aria-hidden="true" focusable="false"><path d="M2 18.500c3.500-4 6-9.500 9.500-14.500 2 2.200 3.200 4.300 4.700 6.800 1.500-1.700 2.400-3 3.800-4.300 4 3.700 7.500 7.800 12 12"/><path d="M8.800 9.200l2.900 2 2-2.300"/></svg>';
const WAVE_SVG = '<svg class="map-doodle__wave" viewBox="0 0 58 18" aria-hidden="true" focusable="false"><path d="M2 5.500c4.500-4 8.500-4 13 0s8.500 4 13 0 8.500-4 13 0 8.500 3.700 13 .3"/><path d="M12 14c4-3.600 7.800-3.500 11.800 0s8 3.600 12 0 7.800-3.300 11.500-.5"/></svg>';

/* ── 데이터 다듬기 ───────────────────────────────────────────── */

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
};

const insideJeju = (lat, lng) =>
  lat >= MAX_BOUNDS[0][0] && lat <= MAX_BOUNDS[1][0] && lng >= MAX_BOUNDS[0][1] && lng <= MAX_BOUNDS[1][1];

// 좌표 상태(coordStatus): 'TODO'(확인 중 — 지도에 찍지 않는다) · 'approx'(대략) · 그 밖은 확인됨. CSV 에는 한글로 적어도 된다
const statusOf = (value) => {
  const text = String(value ?? '').replace(/\s/g, '').toLowerCase();
  if (/^(todo|확인중|미확인|확인필요)$/.test(text)) return 'TODO';
  return /^(approx|대략|근사|근사값)$/.test(text) ? 'approx' : 'verified';
};

// 분류(category): 아래 CATS 의 key 가운데 하나. CSV 에는 비슷한 말로 적어도 된다(match).
// 비었으면(분류 열이 없는 CSV 등) 가게. 모르는 값이면 '' (부르는 쪽이 경고하고 가게로 보여 준다)
// ✏️ 교체: 분류를 더하거나 이름을 바꾸려면 여기(key = 데이터에 적는 값 · cls = 핀 색 이름 — css/map.css 의 --cat-<cls>)와
//          data/i18n/*.json 의 map.cat-<cls> 를 함께 고친다. 분류 단추 · 범례는 이 순서대로 나온다
const CATS = [
  { key: '명소', cls: 'spot', match: /^(명소|관광지|장소|자연|spot|place)$/ },
  { key: '카페·간식', cls: 'cafe', match: /^(카페·간식|카페|간식|디저트|베이커리|빵집|떡집|cafe|bakery|snack)$/ },
  { key: '맛집', cls: 'food', match: /^(맛집|식당|음식점|food|restaurant)$/ },
  { key: '가게', cls: 'shop', match: /^(가게|상점|상호|shop|store)$/ },
];
// 지역: 데이터의 region(제주시 · 서귀포시)이 있으면 그것, 없으면 주소로 가린다(주소에 '서귀포'가 있으면 서귀포시, '제주'로 시작하면 제주시)
// ✏️ 교체: 이름을 바꾸려면 여기와 data/i18n/*.json 의 map.region-<cls>
const REGIONS = [
  { key: '제주시', cls: 'jeju' },
  { key: '서귀포시', cls: 'seogwipo' },
];
const regionOf = (p) => {
  const given = String(p.region ?? '').trim();
  if (REGIONS.some((r) => r.key === given)) return given;
  const address = String(p.address ?? '');
  if (address.includes('서귀포')) return '서귀포시';
  if (/^제주/.test(address)) return '제주시';
  return '';
};

const categoryOf = (value) => {
  const text = String(value ?? '').replace(/\s/g, '').toLowerCase();
  if (!text) return CATS.find((c) => c.key === '가게');
  return CATS.find((c) => c.match.test(text)) || null;
};

// 화면에 쓸 모양으로 다듬는다. 좌표가 없거나('TODO' · 빈 값) 제주 밖이면 located = false → 지도에는 찍지 않는다.
// file = 장소 데이터 파일 이름(콘솔 안내에 쓴다).
// 글(name · meaning · address · kind)은 지금 언어의 값 — 예: 영어면 "meaning_en" 이 있으면 그것, 없으면 "meaning"(js/i18n.js 의 pick, CSV 도 같은 이름의 열)
function normalize(list, file) {
  return list
    .filter((p) => p && typeof p === 'object' && String(pick(p, 'name') ?? '').trim())
    .map((p, index) => {
      const name = String(pick(p, 'name')).trim();
      const lat = toNumber(p.lat);
      const lng = toNumber(p.lng);
      const status = statusOf(p.coordStatus);
      const located = status !== 'TODO' && Number.isFinite(lat) && Number.isFinite(lng) && insideJeju(lat, lng);
      if (!located) {
        console.warn(`[map] '${name}' 의 좌표가 없거나 제주 밖이라 지도에 표시하지 않습니다(${file} 의 위도 · 경도 확인)`);
      }
      let cat = categoryOf(p.category);
      if (!cat) {
        console.warn(`[map] '${name}' 의 분류('${String(p.category).trim()}')는 ${CATS.map((c) => `'${c.key}'`).join(' · ')} 가운데 하나여야 해요 — 가게로 표시합니다(${file} 확인)`);
        cat = CATS.find((c) => c.key === '가게');
      }
      return {
        index,
        name,
        meaning: String(pick(p, 'meaning') ?? '').trim(),
        address: String(pick(p, 'address') ?? '').trim(),
        category: cat.key, // 분류 단추의 곳 수를 셀 때 쓰는 값(화면에 쓰는 이름은 TEXT.category)
        cat: cat.cls, // 핀 · 칩의 색 이름
        region: regionOf(p), // 제주시 · 서귀포시(지역 단추)
        kind: String(pick(p, 'kind') ?? '').trim(),
        lat,
        lng,
        located,
        approx: located && status === 'approx',
      };
    });
}

/* ── HTML 조각(값은 모두 escapeHTML 을 거친다) ───────────────── */

// 위치 핀 그림(물방울 모양, 분류마다 색 — css/map.css 의 --cat-…). 뾰족한 끝이 그림의 아래 가운데
const glyphHTML = (cls) =>
  `<span class="map-glyph map-glyph--${cls}"><svg viewBox="0 0 24 32" aria-hidden="true" focusable="false"><path class="map-glyph__body" d="M12 1.2C6 1.2 1.2 5.9 1.2 11.8c0 7.4 8.6 16.8 10 18.3a1.1 1.1 0 0 0 1.6 0c1.4-1.5 10-10.9 10-18.3C22.8 5.9 18 1.2 12 1.2z"/><circle class="map-glyph__hole" cx="12" cy="11.6" r="4"/></svg></span>`;

const chipHTML = (p) =>
  `<span class="map-chip map-chip--${p.cat}">${escapeHTML(TEXT.category(p))}${p.kind ? ` · ${escapeHTML(p.kind)}` : ''}</span>`;

// 마커: 실제 자리의 점 · 이음선(겹쳐서 비켜났을 때만 보인다) + 위치 핀
const pinHTML = (p) =>
  `<span class="map-pin__dot"></span><span class="map-pin__stalk"></span><span class="map-pin__shift"><span class="map-pin__lift">${glyphHTML(p.cat)}</span></span>`;

// 묶음 핀: 곳 수가 적힌 동그라미. look = 묶인 곳이 모두 같은 분류면 그 색, 섞였으면 mix(밤색)
const bundleHTML = (count, look) =>
  `<span class="map-pin__shift"><span class="map-pin__lift"><span class="map-cluster map-cluster--${look}"><b class="map-pin__count"${count > 99 ? ' data-long' : ''}>${count}</b></span></span></span>`;

// 쪽지: 제주어 상호명 / 분류 / 위치 / 뜻
function tipHTML(p) {
  const rows = [
    p.address ? `<div class="map-tip__row"><dt>${escapeHTML(TEXT.where)}</dt><dd>${escapeHTML(p.address)}</dd></div>` : '',
    p.meaning ? `<div class="map-tip__row map-tip__row--meaning"><dt>${escapeHTML(TEXT.meaning)}</dt><dd>${escapeHTML(p.meaning)}</dd></div>` : '',
  ].join('');
  return `<p class="map-tip__name">${escapeHTML(p.name)}</p>
    <p class="map-tip__meta">${chipHTML(p)}</p>
    ${rows ? `<dl class="map-tip__rows">${rows}</dl>` : ''}
    ${p.approx ? `<p class="map-tip__approx">${escapeHTML(TEXT.approx)}</p>` : ''}`;
}

// 목록 한 칸. 지도에서 찾아갈 수 있는 곳만 <button>, 나머지는 글로만 보여 준다
function itemHTML(p, clickable, cols) {
  const tag = clickable && p.located ? 'button' : 'div';
  const attrs = tag === 'button' ? ` type="button" data-place="${p.index}"` : '';
  let flag = '';
  if (!p.located) flag = `<span class="map__item-flag map__item-flag--todo">${escapeHTML(TEXT.nocoord)}</span>`;
  else if (p.approx) flag = `<span class="map__item-flag">${escapeHTML(TEXT.approx)}</span>`;
  return `<li class="map__li" data-cat="${p.cat}" data-region="${escapeHTML(p.region)}" data-reveal style="--reveal-delay: ${((p.index % cols) * 0.07).toFixed(2)}s">
    <${tag} class="map__item${p.located ? '' : ' is-nocoord'}"${attrs}>
      <span class="map__item-stamp" aria-hidden="true">${glyphHTML(p.cat)}</span>
      <span class="map__item-body">
        <span class="map__item-top"><span class="map__item-name">${escapeHTML(p.name)}</span>${chipHTML(p)}</span>
        ${p.address ? `<span class="map__item-where"><span class="visually-hidden">${escapeHTML(TEXT.where)}: </span>${escapeHTML(p.address)}</span>` : ''}
        ${p.meaning ? `<span class="map__item-meaning"><span class="visually-hidden">${escapeHTML(TEXT.meaning)}: </span>${escapeHTML(p.meaning)}</span>` : ''}
        ${flag}
      </span>
    </${tag}>
  </li>`;
}

function labelHTML(label) {
  const mark = label.kind === 'peak' ? PEAK_SVG : label.kind === 'isle' ? '' : '<span class="map-label__dot"></span>';
  return `${mark}<span class="map-label__text">${escapeHTML(t(label.key, label.name))}</span>`;
}

const doodleHTML = (d) =>
  d.kind === 'sea'
    ? `<span class="map-doodle__sea">${escapeHTML(t('map.sea', d.text))}${d.sub ? `<small>${escapeHTML(t('map.sea-sub', d.sub))}</small>` : ''}</span>`
    : WAVE_SVG;

/* ── 머리말 · 목록 ───────────────────────────────────────────── */

// 지역 · 분류 단추(범례를 겸한다): [지역] 전체 · 제주시 · 서귀포시 / [분류] 전체 · 명소 · 카페·간식 · 맛집 — 데이터에 있는 것만, 곳 수와 함께.
// [data-map-filters] 자리마다(지도 위 · 목록 위) 같은 단추를 그리고 서로 맞춘다. 누르면 목록과 지도가 그 지역 · 분류만 보인다.
// 다른 줄과 겹치는 곳이 없는 단추(예: 서귀포시 + 명소)는 누를 수 없다. onChange({ cat, region }, 바뀐 줄)
function renderFilters(root, places, onChange) {
  const boxes = [...root.querySelectorAll('[data-map-filters]')];
  if (!boxes.length) return;
  const cats = CATS.filter((c) => places.some((p) => p.category === c.key));
  const regions = REGIONS.filter((r) => places.some((p) => p.region === r.key));
  const state = { cat: 'all', region: 'all' };
  const count = (cat, region) => places.filter((p) => (cat === 'all' || p.cat === cat) && (region === 'all' || p.region === region)).length;
  const button = (group, value, label, glyph = '') =>
    `<button type="button" class="map__filter" data-filter-group="${group}" data-filter="${escapeHTML(value)}" aria-pressed="false">${glyph}<span>${escapeHTML(label)}</span><span class="map__filter-count"></span></button>`;
  const regionRow = regions.length > 1
    ? `<div class="map__filter-row" data-filter-row="region" role="group" aria-label="${escapeHTML(TEXT.regionLabel)}"><span class="map__filter-label" aria-hidden="true">${escapeHTML(TEXT.regionLabel)}</span>${button('region', 'all', TEXT.all)}${regions.map((r) => button('region', r.key, TEXT.region(r))).join('')}</div>`
    : '';
  const catRow = `<div class="map__filter-row" data-filter-row="cat" role="group" aria-label="${escapeHTML(TEXT.catLabel)}"><span class="map__filter-label" aria-hidden="true">${escapeHTML(TEXT.catLabel)}</span>${button('cat', 'all', TEXT.all)}${cats.map((c) => button('cat', c.cls, t(`map.cat-${c.cls}`, c.key), glyphHTML(c.cls))).join('')}</div>`;
  boxes.forEach((box) => { box.innerHTML = regionRow + catRow; });

  // 눌린 단추 · 곳 수 · 누를 수 있는지를 지금 상태에 맞춘다(다시 그리지 않는다 — 키보드 포커스가 그대로 남게)
  const sync = () => {
    boxes.forEach((box) => box.querySelectorAll('[data-filter]').forEach((b) => {
      const group = b.dataset.filterGroup;
      const value = b.dataset.filter;
      const n = group === 'cat' ? count(value, state.region) : count(state.cat, value);
      b.setAttribute('aria-pressed', String(state[group] === value));
      b.querySelector('.map__filter-count').textContent = TEXT.count(n);
      const off = n === 0 && state[group] !== value;
      if (off) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    }));
    root.dataset.filterCat = state.cat;
    root.dataset.filterRegion = state.region;
  };
  sync();

  boxes.forEach((box) => box.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-filter]') : null;
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    const group = btn.dataset.filterGroup;
    state[group] = btn.dataset.filter;
    // 다른 줄과 겹치는 곳이 없어졌으면 그 줄은 '전체'로
    const other = group === 'cat' ? 'region' : 'cat';
    if (count(state.cat, state.region) === 0) state[other] = 'all';
    sync();
    onChange({ ...state }, group);
    track('map_filter', { group, value: state[group], list: Boolean(box.closest('.map__index')) });
  }));
}

// 곳 수: <span data-count="all"> (목록 제목 — 좌표 확인 중인 곳까지 모두) 또는 분류 이름(그 분류의 지도에 찍힌 곳)
function fillCounts(root, places) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.count;
    const count = key === 'all' ? places.length : places.filter((p) => p.located && p.category === key).length;
    el.textContent = TEXT.count(count);
  });
}

// 목록 '더보기': 처음에는 위 listFirst() 곳만 보이고(휴대폰 · 넓은 화면이 다르다 — 화면 폭이 그 경계를 넘으면 다시 입힌다), 목록 아래 단추를 누르면 나머지가 펼쳐진다(다시 누르면 접힌다).
// 돌려주는 함수는 지금 상태(접힘 · 펼침)를 목록에 다시 입힌다 — 목록을 새로 그린 뒤에 부른다
function initMore(root, listEl, total) {
  const button = root.querySelector('[data-map-more]');
  const label = button && button.querySelector('[data-map-more-label]');
  let filter = { cat: 'all', region: 'all' }; // 지역 · 분류 단추로 고른 것('all' 이면 전부)
  let rest = total - listFirst(); // 숨어 있는 곳 수(지금 분류 기준)
  let open = rest <= 0 || !button; // 숨길 것이 없거나 단추가 없으면 처음부터 다 보여 준다

  const shownItems = () => [...listEl.children].filter((li) => (filter.cat === 'all' || li.dataset.cat === filter.cat)
    && (filter.region === 'all' || li.dataset.region === filter.region));
  const apply = () => {
    const shown = shownItems();
    [...listEl.children].forEach((li) => { li.hidden = true; });
    const first = listFirst();
    shown.forEach((li, i) => { li.hidden = !open && i >= first; });
    rest = shown.length - first;
    // 펼친 목록은 정해진 높이 안에서 스크롤(css/map.css 의 .map__list.is-open). 접을 때는 목록 맨 위로
    listEl.classList.toggle('is-open', open && rest > 0);
    if (!open) listEl.scrollTop = 0;
    if (!button) return;
    button.hidden = rest <= 0 && !root.classList.contains('is-few') ? true : button.hidden;
    if (rest > 0) button.hidden = false;
    button.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? TEXT.less : TEXT.more(rest);
  };
  apply.setFilter = (next) => {
    filter = { cat: 'all', region: 'all', ...next };
    open = false;
    apply();
  };

  if (open) {
    root.classList.add('is-few'); // css 가 단추 자리와 미리 잡아 둔 목록 높이를 거둔다
    return apply;
  }

  button.hidden = false;
  button.addEventListener('click', (e) => {
    const before = button.getBoundingClientRect().top;
    open = !open;
    apply();
    if (open) {
      // 키보드로 펼쳤으면(detail 이 0 인 click) 새로 나타난 첫 곳으로 포커스를 옮긴다 — 단추는 목록 맨 아래로 내려가 있다
      const next = shownItems()[listFirst()];
      const first = e.detail === 0 && next && next.querySelector('button');
      if (first) first.focus();
      return;
    }
    // 접으면 목록이 짧아져 단추가 위로 딸려 올라간다 → 단추가 화면의 같은 자리에 머물게 그만큼 스크롤을 옮긴다
    // (목록 머리나 아래 섹션으로 화면이 튀지 않게. 포커스는 단추에 그대로 있다)
    const shift = button.getBoundingClientRect().top - before;
    if (Math.abs(shift) > 1) window.scrollBy(0, shift);
  });
  PHONE.addEventListener?.('change', apply);
  apply();
  return apply;
}

// atlas = buildMap() 이 돌려준 조종간(없으면 지도 없이 글 목록만)
function renderList(listEl, places, atlas) {
  const cols = clamp(Number(getComputedStyle(listEl).getPropertyValue('--map-cols')) || 1, 1, 6);
  listEl.innerHTML = places.map((p) => itemHTML(p, Boolean(atlas), cols)).join('');
  if (!atlas) return;

  listEl.querySelectorAll('button[data-place]').forEach((button) => {
    const place = places[Number(button.dataset.place)];
    if (!place) return;
    place.item = button;
    // 가리키면(hover · 포커스) 지도의 마커가 들썩이고, 누르면 지도가 그곳으로 간다
    button.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') atlas.mark(place, 'list', true); });
    button.addEventListener('pointerleave', () => atlas.mark(place, 'list', false));
    button.addEventListener('focus', () => atlas.mark(place, 'list-focus', true));
    button.addEventListener('blur', () => atlas.mark(place, 'list-focus', false));
    // detail 이 0 인 click = 키보드로 누른 것
    button.addEventListener('click', (e) => {
      atlas.goTo(place, e.detail === 0);
      track('map_place', { place: place.name, from: 'list' });
    });
  });
}

/* ── 지도 화면 안의 안내 쪽지 ─────────────────────────────────── */

function setNotice(view, message) {
  let note = view.querySelector('.map__notice');
  if (!message) {
    if (note) note.remove();
    return;
  }
  if (!note) {
    note = document.createElement('p');
    note.className = 'placeholder-note map__notice';
    note.setAttribute('role', 'status');
    view.append(note);
  }
  note.textContent = message;
}

/* ── 쪽지(툴팁) 요소 ─────────────────────────────────────────── */

// <body> 끝에 하나만 두고 돌려 쓴다
function getTip() {
  let tip = document.getElementById('map-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'map-tip';
    tip.className = 'map-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = '<div class="map-tip__paper"></div><span class="tape map-tip__tape" aria-hidden="true"></span>';
    document.body.append(tip);
  }
  return tip;
}

// 쪽지의 왼쪽 위 모서리를 (x + gapX, y + gapY)에 둔다.
// 오른쪽 · 아래 가장자리에 닿으면 반대쪽으로 뒤집고, 그래도 넘치면 화면 안으로 밀어 넣는다.
// 돌려주는 값: 좌우 어느 쪽에도 다 들어가지 않아 밀어 넣었으면 true(좁은 화면)
function placeTip(tip, x, y, gapX = TIP_GAP, gapY = TIP_GAP) {
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const maxX = document.documentElement.clientWidth - TIP_EDGE;
  const maxY = window.innerHeight - TIP_EDGE;
  let left = x + gapX;
  let top = y + gapY;
  if (left + width > maxX) left = x - gapX - width;
  if (top + height > maxY) top = y - gapY - height;
  const squeezed = left < TIP_EDGE;
  left = clamp(left, TIP_EDGE, Math.max(TIP_EDGE, maxX - width));
  top = clamp(top, TIP_EDGE, Math.max(TIP_EDGE, maxY - height));
  tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  return squeezed;
}

const isFocusVisible = (el) => {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true; // :focus-visible 을 모르는 브라우저에서는 포커스가 가면 늘 연다
  }
};

/* ── 타일(바탕 지도) ─────────────────────────────────────────── */

// 손으로 그은 선처럼 보이게: 타일 그림을 가는 가로줄 · 세로줄로 나눠 물결 모양으로 아주 조금씩(2px 안쪽) 밀어 그린다.
// 타일마다 한 번만 그리므로 지도를 끌 때 부담이 없고, 물결이 타일 크기를 주기로 되풀이되어 이웃 타일과 이어진다.
// ✏️ 교체: [한 타일 안의 물결 수(정수), 세기(px), 시작점]. 선을 흔들지 않으려면 두 목록을 [] 로 비운다
const WAVES_ACROSS = [[2, 1.1, 0.6], [5, 0.7, 2.3], [11, 0.4, 4.1]]; // 가로줄을 좌우로 미는 물결
const WAVES_DOWN = [[3, 1.0, 1.9], [7, 0.7, 0.4], [13, 0.4, 3.3]]; // 세로줄을 위아래로 미는 물결
const waveAt = (waves, t) => waves.reduce((sum, [count, strength, start]) => sum + strength * Math.sin(2 * Math.PI * count * t + start), 0);

let scratch = null; // 그리는 동안 잠깐 쓰는 캔버스(타일끼리 돌려 쓴다)

function drawWobbly(canvas, img) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const unit = width / 256; // 고해상도(@2x) 타일이면 그만큼 크게 민다
  const band = Math.max(1, Math.round(2 * unit)); // 줄 하나의 굵기
  scratch = scratch || document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  canvas.width = width;
  canvas.height = height;
  const first = scratch.getContext('2d');
  const second = canvas.getContext('2d');
  // 밀려서 비는 가장자리에는 밑에 깔아 둔 원래 그림이 비친다
  first.drawImage(img, 0, 0);
  for (let y = 0; y < height; y += band) {
    first.drawImage(img, 0, y, width, band, waveAt(WAVES_ACROSS, y / height) * unit, y, width, band);
  }
  second.drawImage(scratch, 0, 0);
  for (let x = 0; x < width; x += band) {
    second.drawImage(scratch, x, 0, band, height, x, waveAt(WAVES_DOWN, x / width) * unit, band, height);
  }
}

// 필요 없어진 타일: 받고 있던 그림을 끊는다(<canvas> 타일이라 Leaflet 이 대신 끊어 주지 못한다).
// 끊지 않으면 뒤늦게 온 옛 그림이 같은 자리의 새 타일을 '다 받음'으로 잘못 표시한다
function dropTile(L, tile) {
  const img = tile._img;
  if (!img) return;
  tile._img = null;
  img.onload = null;
  img.onerror = null;
  img.src = L.Util.emptyImageUrl;
}

// 타일을 <img> 그대로 쓰지 않고 <canvas> 에 흔들어 그리는 타일 레이어
const wobblyTileLayer = (L) => L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('canvas');
    tile.setAttribute('aria-hidden', 'true');
    const img = new Image();
    tile._img = img;
    if (this.options.crossOrigin) img.crossOrigin = this.options.crossOrigin;
    img.onload = () => {
      tile._img = null;
      try {
        drawWobbly(tile, img);
      } catch (err) {
        console.warn('[map] 타일을 흔들어 그리지 못해 그대로 그립니다', err);
        tile.width = img.naturalWidth;
        tile.height = img.naturalHeight;
        tile.getContext('2d').drawImage(img, 0, 0);
      }
      tile.complete = true; // Leaflet 이 '다 받은 타일'로 알아보게(줌이 바뀔 때 이전 타일을 바로 지우지 않는다)
      done(null, tile);
    };
    img.onerror = () => {
      tile._img = null;
      done(new Error('tile load failed'), tile);
    };
    img.src = this.getTileUrl(coords);
    return tile;
  },
  // 줌이 바뀌어 버려지는 타일 · 화면에서 치워지는 타일(Leaflet 안쪽 메서드에 한 줄씩 덧붙인다)
  _abortLoading() {
    Object.values(this._tiles).forEach((tile) => {
      if (tile.coords.z !== this._tileZoom) dropTile(L, tile.el);
    });
    L.TileLayer.prototype._abortLoading.call(this);
  },
  _removeTile(key) {
    if (this._tiles[key]) dropTile(L, this._tiles[key].el);
    return L.TileLayer.prototype._removeTile.call(this, key);
  },
});

// config.js 의 map.tiles: 'eox'(기본, 키 없이 사용) | 'carto'(map.cartoKey 필요) | 'local'(사이트 안의 assets/tiles)
function createTiles(L, config) {
  const TileLayer = wobblyTileLayer(L);
  if (config.tiles === 'carto') {
    const key = String(config.cartoKey ?? '').trim();
    if (key) {
      return new TileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`, {
        subdomains: 'abcd',
        minZoom: 8,
        maxZoom: 20,
        className: 'paper-tiles paper-tiles--carto',
        crossOrigin: 'anonymous',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      });
    }
    console.warn("[map] config.js 의 map.cartoKey 가 비어 있어 기본 지도(EOX)로 대신합니다.");
  }
  // 사이트 안에 받아 둔 타일(assets/tiles — .work/gen/fetch_tiles.py, EOX Terrain Light 줌 8~12). 바깥 이미지를 막는 곳(claude.ai 에 발행한 페이지)용.
  // 줌 12 보다 가까이 보면 12 의 타일을 키워 보여 준다(조금 흐려진다)
  if (config.tiles === 'local') {
    return new TileLayer('assets/tiles/{z}/{y}/{x}.jpg', {
      minZoom: 8,
      maxNativeZoom: 12,
      maxZoom: 16,
      bounds: MAX_BOUNDS,
      className: 'paper-tiles',
      attribution: '<a href="https://maps.eox.at">Terrain Light</a> { Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors and <a href="https://maps.eox.at/#data">others</a>, Rendering &copy; <a href="https://eox.at">EOX</a> }',
    });
  }
  // EOX Terrain Light — 주소의 {y}/{x} 순서에 주의
  return new TileLayer('https://{s}.tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg', {
    subdomains: 'abcde',
    minZoom: 8,
    maxZoom: 16,
    className: 'paper-tiles',
    crossOrigin: 'anonymous',
    attribution: '<a href="https://maps.eox.at">Terrain Light</a> { Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors and <a href="https://maps.eox.at/#data">others</a>, Rendering &copy; <a href="https://eox.at">EOX</a> }',
  });
}

/* ── 지도 ───────────────────────────────────────────────────── */

// 지도 · 마커 · 쪽지를 만들고, 목록이 쓸 조종간 { mark, goTo } 을 돌려준다
function buildMap(root, view, canvas, places) {
  const { L } = window;
  const reduced = prefersReducedMotion();
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  const isTouch = () => Boolean(coarse && coarse.matches);

  const map = L.map(canvas, {
    zoomControl: false, // + / − 는 직접 만든 종이 단추를 쓴다
    attributionControl: false, // 아래에서 왼쪽 아래에 따로 단다
    zoomSnap: ZOOM_SNAP,
    maxZoom: MAX_ZOOM,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 1, // 한계 밖으로는 끌리지 않는다
    scrollWheelZoom: false, // 처음에는 페이지 스크롤을 가로채지 않는다 — 아래 furnish 의 '휠로 확대'가 켜고 끈다
    boxZoom: false,
    dragging: true, // 14차: 손가락 · 마우스로 바로 끌어 움직인다('지도 움직이기' 단추 없이)
    zoomAnimation: !reduced,
    fadeAnimation: !reduced,
    markerZoomAnimation: !reduced,
    inertia: !reduced,
  });

  // 동작 줄이기: 방향키로 움직일 때 · 한계 안으로 되돌아올 때의 미끄러지는 이동도 바로 옮긴다
  if (reduced) {
    map.panBy = (offset, options) => L.Map.prototype.panBy.call(map, offset, { ...options, animate: false });
  }

  try {
    return furnish(L, map, { root, view, canvas, places, reduced, isTouch, coarse });
  } catch (err) {
    map.remove(); // 만들다 만 지도는 치운다
    throw err;
  }
}

function furnish(L, map, { root, view, canvas, places, reduced, isTouch, coarse }) {
  // 저작권 표시: 왼쪽 아래(오른쪽 아래는 플로팅 버튼 자리). 접두어는 Leaflet 링크만
  // 휴대폰에서는 표시가 지도 폭을 다 쓰므로, 표시가 오른쪽 아래 플로팅 버튼 자리에 들어오는 동안 버튼이 비켜 숨는다(js/maker.js 의 watchAvoid)
  const attribution = L.control.attribution({ position: 'bottomleft', prefix: '<a href="https://leafletjs.com">Leaflet</a>' }).addTo(map);
  attribution.getContainer().setAttribute('data-fab-avoid', '');
  document.dispatchEvent(new Event('fab-avoid:refresh'));

  const tiles = createTiles(L, getConfig().map).addTo(map);

  // 휠 · 트랙패드로 확대 · 축소: ① ⌘/Ctrl + 휠(맥 트랙패드의 두 손가락 벌리기 · 오므리기 포함)은 언제나 바로
  // ② 그냥 휠은 지도를 한 번 누른 뒤부터(마우스가 지도 밖으로 나가면 다시 잠근다 — 페이지를 스크롤하다 지도에 걸리지 않게).
  //    잠겨 있을 때 휠을 굴리면 지도 위에 안내를 잠깐 띄운다. 손가락 기기는 두 손가락으로 벌리기 · 오므리기(Leaflet 기본)
  const wheelHint = document.createElement('p');
  wheelHint.className = 'map__wheel-hint';
  wheelHint.setAttribute('aria-hidden', 'true');
  wheelHint.textContent = t('map.wheel-hint', '지도를 한 번 누르면 휠로 확대 · 축소할 수 있어요');
  view.append(wheelHint);
  let wheelOn = false;
  let hintTimer = 0;
  const setWheel = (on) => {
    wheelOn = on;
    if (on) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  };
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') setWheel(true); });
  view.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setWheel(false); });
  let wheelSum = 0;
  let wheelAt = null;
  let wheelTimer = 0;
  canvas.addEventListener('wheel', (e) => {
    if (wheelOn) return; // Leaflet 이 맡는다
    if (!(e.ctrlKey || e.metaKey)) {
      wheelHint.classList.add('is-on');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => wheelHint.classList.remove('is-on'), 1600);
      return; // 페이지가 그대로 스크롤된다
    }
    e.preventDefault(); // 브라우저 화면 확대 대신 지도 확대
    wheelSum += e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    wheelAt = map.mouseEventToContainerPoint(e);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const zoom = clamp(map.getZoom() + clamp(-wheelSum / 100, -1, 1), map.getMinZoom(), map.getMaxZoom()); // 한 번에 1단계까지
      wheelSum = 0;
      map.setZoomAround(wheelAt, zoom);
    }, 40);
  }, { passive: false });

  // 바탕 지도를 절반 넘게 받지 못하면 안내를 띄운다(마커와 목록은 그대로).
  // 화면을 채우는 한 묶음 단위로 센다(휴대폰은 한 묶음이 6장뿐이라 '몇 장 이상 실패'로 세면 놓친다)
  const tally = { ok: 0, bad: 0 };
  tiles.on('loading', () => {
    tally.ok = 0;
    tally.bad = 0;
  });
  tiles.on('tileload', () => {
    tally.ok += 1;
  });
  tiles.on('tileerror', () => {
    tally.bad += 1;
  });
  tiles.on('load', () => setNotice(view, tally.bad > 0 && tally.bad >= tally.ok ? TEXT.noTiles : ''));

  // 종이결: 타일 위 · 마커 아래에 깔리는 층. Leaflet 의 층은 지도를 끌면 함께 움직이므로,
  // 움직일 때마다 화면(컨테이너)에 맞춰 자리를 되돌리고 무늬만 지도를 따라가게 한다
  const grain = L.DomUtil.create('div', 'map__grain', map.createPane('paper'));
  const syncGrain = () => {
    const size = map.getSize();
    const origin = map.containerPointToLayerPoint([0, 0]);
    grain.style.width = `${size.x}px`;
    grain.style.height = `${size.y}px`;
    grain.style.backgroundPosition = `${-origin.x}px ${-origin.y}px`;
    L.DomUtil.setPosition(grain, origin);
  };

  /* 범위와 줌 */

  const pins = places.filter((p) => p.located);
  const toolButtons = [...root.querySelectorAll('.map__tool')];

  // 범위(bounds)가 화면에 들어오는 줌과 가운데 { zoom, center }.
  // gap = 화면 위 · 오른쪽 · 아래에 비워 둘 폭(px) — 범위를 그 나머지 자리에 맞춘다
  const frameOf = (bounds, padding, gap = { top: 0, right: 0, bottom: 0 }) => {
    const box = L.latLngBounds(bounds);
    const zoom = map.getBoundsZoom(box, false, [padding * 2 + gap.right, padding * 2 + gap.top + gap.bottom]);
    const middle = map.project(box.getSouthWest(), zoom).add(map.project(box.getNorthEast(), zoom)).divideBy(2);
    return { zoom, center: map.unproject(middle.add([gap.right / 2, (gap.bottom - gap.top) / 2]), zoom) };
  };

  // 분류 단추로 고른 분류(cls) — null 이면 전부. 고르지 않은 분류의 핀은 지도에서 아예 빠진다(묶음 · 겹침 풀기 · Tab 순서에서도)
  let catFilter = null;
  let regionFilter = null;
  const shown = () => (catFilter || regionFilter
    ? pins.filter((p) => (!catFilter || p.cat === catFilter) && (!regionFilter || p.region === regionFilter))
    : pins);

  // 우표 한 장의 크기(css/map.css 의 --pin-w · --pin-h). 묶여서 보이지 않는 우표도 크기는 그대로다(분류로 빠진 핀은 크기가 0 이라 보이는 핀으로 잰다)
  const stampSize = () => {
    const ref = (shown()[0] || pins[0]).el;
    return { w: ref.offsetWidth || 34, h: ref.offsetHeight || 42 };
  };

  // 그 줌에서 지도에 놓일 것들 → [{ members: [장소…], lat, lng }] — members 가 하나면 낱개 우표, 둘 이상이면 묶음 우표.
  // 화면에서 우표 폭의 BUNDLE_NEAR 배 안에 모인 곳들을 한 묶음으로 합친다(데이터에서 먼저 나온 곳이 묶음의 기준점).
  // 두세 곳이 살짝 겹칠 뿐이면 묶지 않고(아래 dodge 가 서로 조금씩 밀어 낸다), 더 확대할 수 없는 줌에서는 아예 묶지 않는다.
  // 지도를 끌어도 결과가 같고 줌이 바뀔 때만 달라진다(지도 픽셀 좌표로 따진다)
  const groupAt = (zoom) => {
    const solo = (p) => ({ members: [p], lat: p.lat, lng: p.lng });
    const list = shown();
    if (!list.length || !list[0].el || zoom >= map.getMaxZoom() - 0.01) return list.map(solo);
    const width = stampSize().w;
    const near = width * BUNDLE_NEAR;
    const cells = new Map(); // 격자 칸 → 그 칸에 기준점이 있는 묶음들(곳이 많아도 가까운 칸만 살핀다)
    const groups = [];
    list.forEach((p) => {
      const { x, y } = map.project([p.lat, p.lng], zoom);
      const cx = Math.floor(x / near);
      const cy = Math.floor((y * SQUASH) / near);
      let home = null;
      let min = near;
      for (let i = cx - 1; i <= cx + 1; i += 1) {
        for (let j = cy - 1; j <= cy + 1; j += 1) {
          (cells.get(`${i}:${j}`) || []).forEach((group) => {
            const distance = Math.hypot(group.x - x, (group.y - y) * SQUASH);
            if (distance < min) {
              min = distance;
              home = group;
            }
          });
        }
      }
      if (home) {
        home.members.push(p);
        home.points.push({ x, y });
        return;
      }
      const group = { x, y, members: [p], points: [{ x, y }] };
      groups.push(group);
      const key = `${cx}:${cy}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(group);
    });

    const out = [];
    groups.forEach(({ members, points }) => {
      let loose = members.length <= BUNDLE_LOOSE_MAX; // 두세 곳이 살짝만 겹치는가
      for (let i = 0; loose && i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          if (Math.hypot(points[j].x - points[i].x, (points[j].y - points[i].y) * SQUASH) < width * BUNDLE_LOOSE) loose = false;
        }
      }
      if (loose) {
        members.forEach((p) => out.push(solo(p)));
        return;
      }
      // 묶음 우표는 기준점(묶음의 첫 곳) 자리에 놓는다 — 기준점끼리는 늘 우표 폭의 0.9배 넘게 떨어져 있어 묶음끼리 크게 겹치지 않는다
      out.push({ members, lat: members[0].lat, lng: members[0].lng });
    });
    return out;
  };

  // 겹침 풀기 계산: 화면에서 너무 가까운 우표끼리 서로 반대쪽으로 조금씩 민다.
  // points = 우표들(낱개 · 묶음)의 제자리(지도 화면 좌표) → 우표마다 비켜날 거리 { x, y, length, far }
  const dodge = (points) => {
    const { w: width, h: height } = stampSize();
    const near = width * 0.92; // 이보다 가까우면 겹친 것으로 본다
    const squash = SQUASH; // 우표는 세로가 더 길다 → 위아래로는 조금 더 벌린다
    const reach = width * 1.6; // 가장 멀리 비켜날 수 있는 거리
    const size = map.getSize();
    const padX = width / 2 + 8;
    const padY = height / 2 + 8;
    const moves = points.map(() => ({ x: 0, y: 0 }));
    // 비켜나다가 지도 화면 밖으로 잘려 나가지 않게 가장자리에서 멈춘다(제자리가 이미 가장자리 쪽이면 더 나가지만 않게)
    const keepIn = (move, point) => {
      move.x = clamp(point.x + move.x, Math.min(padX, point.x), Math.max(size.x - padX, point.x)) - point.x;
      move.y = clamp(point.y + move.y, Math.min(padY, point.y), Math.max(size.y - padY, point.y)) - point.y;
    };

    for (let round = 0; round < 40; round += 1) {
      let moved = false;
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          let dx = points[j].x + moves[j].x - points[i].x - moves[i].x;
          let dy = (points[j].y + moves[j].y - points[i].y - moves[i].y) * squash;
          let distance = Math.hypot(dx, dy);
          if (distance >= near - 0.5) continue;
          if (distance < 0.01) {
            // 같은 자리에 있으면 순번으로 방향을 정한다
            dx = Math.cos(i * 2.4);
            dy = Math.sin(i * 2.4);
            distance = 1;
          }
          const push = (near - distance) / 2;
          const ux = (dx / distance) * push;
          const uy = ((dy / distance) * push) / squash;
          moves[i].x -= ux;
          moves[i].y -= uy;
          moves[j].x += ux;
          moves[j].y += uy;
          moved = true;
        }
      }
      if (!moved) break;
      moves.forEach((move, i) => keepIn(move, points[i]));
    }

    return moves.map((move) => {
      const length = Math.hypot(move.x, move.y);
      const scale = length > reach ? reach / length : 1;
      return { x: move.x * scale, y: move.y * scale, length: Math.min(length, reach), far: length > width * 0.75 };
    });
  };

  // 우표가 지도 단추나 저작권 표시 밑에 깔리지 않는 화면 틀을 찾는다: 가리는 것이 있으면 그만큼 화면 가장자리를
  // 비우고 범위를 다시 맞춘다(낮은 화면에서는 그만큼 멀리서 보게 된다). 비우는 방법을 네 가지로 해 보고
  // (파고든 만큼만 / 가리는 것의 끝까지 × 확대·축소 단추는 위를 / 오른쪽을 비워서) 가장 가까이 볼 수 있는 틀을 고른다
  const clearFrame = (bounds, padding) => {
    const plain = frameOf(bounds, padding);
    if (!pins.length || !pins[0].el) return plain;
    const size = map.getSize();
    const base = view.getBoundingClientRect();
    const stamp = stampSize();
    const halfW = stamp.w / 2 + 4;
    const halfH = stamp.h / 2 + 4;
    const covers = [...toolButtons, canvas.querySelector('.leaflet-control-attribution')]
      .filter((el) => el && el.offsetWidth)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const box = { left: rect.left - base.left, right: rect.right - base.left, top: rect.top - base.top, bottom: rect.bottom - base.top };
        return { box, low: box.top + box.bottom > size.y, corner: el.hasAttribute('data-map-zoom') };
      });

    // 그 화면 틀에서 가려지는 우표 수(hits)와, 그 우표들을 꺼내려면 비워야 할 폭(next).
    // aside = 확대/축소 단추(오른쪽 위 구석)는 오른쪽을 비워 피한다, full = 가리는 것의 끝까지 한 번에 비운다
    const check = (frame, gap, aside, full) => {
      const corner = map.project(frame.center, frame.zoom).subtract(size.divideBy(2));
      // 그 줌에서 보일 우표들(낱개 · 묶음)로 따진다
      const spots = groupAt(frame.zoom).map((unit) => map.project([unit.lat, unit.lng], frame.zoom).subtract(corner));
      const moves = dodge(spots); // 겹쳐서 비켜난 자리로 따진다
      const next = { ...gap };
      let hits = 0;
      spots.forEach((spot, i) => {
        if (spot.x < 0 || spot.x > size.x || spot.y < 0 || spot.y > size.y) return; // 화면 밖 우표는 따지지 않는다
        const x = spot.x + moves[i].x;
        const y = spot.y + moves[i].y;
        covers.forEach((cover) => {
          const { box } = cover;
          if (x + halfW <= box.left || x - halfW >= box.right || y + halfH <= box.top || y - halfH >= box.bottom) return;
          hits += 1;
          // 우표가 파고든 만큼 더 비운다(되풀이하면 딱 벗어나는 자리에 닿는다). full 이면 적어도 가리는 것의 끝까지
          if (cover.low) next.bottom = Math.max(next.bottom, full ? size.y - box.top + 6 : 0, gap.bottom + (y + halfH) - box.top + 2);
          else if (cover.corner && aside) next.right = Math.max(next.right, full ? size.x - box.left + 6 : 0, gap.right + (x + halfW) - box.left + 2);
          else next.top = Math.max(next.top, full ? box.bottom + 6 : 0, gap.top + box.bottom - (y - halfH) + 2);
        });
      });
      return { hits, next };
    };

    const solve = (aside, full) => {
      let gap = { top: 0, right: 0, bottom: 0 };
      let frame = plain;
      let state = check(frame, gap, aside, full);
      for (let round = 0; round < 12 && state.hits; round += 1) {
        const { next } = state;
        // 비우다가 지도 볼 자리가 너무 줄어들면 그만둔다
        if (size.y - next.top - next.bottom < 96 || size.x - next.right < 160) break;
        gap = next;
        frame = frameOf(bounds, padding, gap);
        state = check(frame, gap, aside, full);
      }
      return { frame, hits: state.hits, spare: gap.top + gap.right + gap.bottom };
    };

    let best = solve(false, false);
    if (!best.hits && best.spare === 0) return best.frame; // 가리는 것이 없다(대부분의 화면)
    [solve(true, false), solve(false, true), solve(true, true)].forEach((other) => {
      // 가려지는 우표가 적은 쪽 → 더 가까이 보는 쪽 → 덜 비운 쪽
      const better = other.hits !== best.hits ? other.hits < best.hits
        : other.frame.zoom !== best.frame.zoom ? other.frame.zoom > best.frame.zoom
          : other.spare < best.spare;
      if (better) best = other;
    });
    return best.frame;
  };

  // 끌 수 있는 한계 = MAX_BOUNDS + '섬 전체 화면'에 보이는 범위.
  // 세로로 긴 화면(휴대폰)은 섬 위아래로 바다가 넓게 보인다. 확대했을 때 그만큼은 위아래로 움직일 수 있어야
  // 북쪽 해안의 마커를 지도 단추 밑에서 꺼낼 수 있다(가로로 넓은 화면에서는 MAX_BOUNDS 와 거의 같다)
  const setRoom = ({ zoom, center }) => {
    const half = map.getSize().divideBy(2);
    const middle = map.project(center, zoom);
    map.options.maxBounds = L.latLngBounds(MAX_BOUNDS)
      .extend(map.unproject(middle.subtract(half), zoom))
      .extend(map.unproject(middle.add(half), zoom));
  };

  // 섬 전체 화면 = 가장 멀리 볼 수 있는 화면(화면 크기가 바뀌면 다시 잡는다). jump = 지도를 그 화면으로 바로 옮긴다
  let whole = null;
  const setWhole = (jump) => {
    map.options.minZoom = undefined; // 이전 값에 묶이지 않게 풀고 계산한다
    whole = clearFrame(ISLAND, 0);
    map.options.minZoom = whole.zoom;
    setRoom(whole);
    if (jump) map.setView(whole.center, whole.zoom, { animate: false });
  };
  setWhole(true); // 우표를 만든 뒤(맨 아래) 단추에 가리는 우표가 있는지 보고 한 번 더 잡는다

  const limit = (latlng, zoom) =>
    (typeof map._limitCenter === 'function' ? map._limitCenter(L.latLng(latlng), zoom, map.options.maxBounds) : L.latLng(latlng));

  // 날아가듯 이동(동작 줄이기면 바로 이동). 이미 그 자리면 아무것도 하지 않고 false
  const flyTo = (latlng, zoom, seconds) => {
    const target = limit(latlng, zoom);
    const gap = map.project(map.getCenter(), zoom).distanceTo(map.project(target, zoom));
    if (Math.abs(map.getZoom() - zoom) < 0.01 && gap < 2) return false;
    map.flyTo(target, zoom, { animate: !reduced, duration: seconds });
    return true;
  };

  /* 마커 */

  // 가리키는 이유(hover · 포커스 · 목록 · 쪽지)가 하나라도 있으면 우표가 들썩이고 맨 위로 올라온다
  const mark = (p, reason, on) => {
    if (!p || !p.el) return;
    p.reasons = p.reasons || new Set();
    if (on) p.reasons.add(reason);
    else p.reasons.delete(reason);
    const active = p.reasons.size > 0;
    if (active === Boolean(p.active)) return;
    p.active = active;
    p.el.classList.toggle('is-active', active);
    if (p.item) p.item.classList.toggle('is-active', active);
    p.marker.setZIndexOffset(active ? 1000 : 0);
    if (p.bundle) syncBundle(p.bundle); // 묶음 우표 안에 있는 곳이면 그 묶음이 대신 들썩인다
  };

  // 묶음 우표는 묶인 곳 가운데 하나라도 가리키고 있으면(목록에서 그 곳에 마우스를 올렸을 때 등) 들썩인다
  const syncBundle = (bundle) => {
    const active = bundle.members.some((p) => p.active);
    bundle.el.classList.toggle('is-active', active);
    bundle.marker.setZIndexOffset(active ? 1000 : 0);
  };

  pins.forEach((p) => {
    const icon = L.divIcon({
      className: `map-pin map-pin--${p.cat}${p.approx ? ' map-pin--approx' : ''}`,
      html: pinHTML(p),
      iconSize: null, // 크기와 기준점은 css/map.css 의 --pin-w 가 정한다
    });
    // autoPanOnFocus 끔: 포커스를 받았다고 지도가 저절로 움직이지 않게(화면 밖 마커는 아래 syncTabStops 가 Tab 순서에서 뺀다)
    p.marker = L.marker([p.lat, p.lng], { icon, keyboard: true, autoPanOnFocus: false }).addTo(map);
    p.el = p.marker.getElement();
    // 마커마다 조금씩 다른 기울기(-6° ~ 6°, 순번으로 정해지는 고정값)
    p.el.style.setProperty('--pin-tilt', `${((p.index * 37) % 13) - 6}deg`);
    p.el.setAttribute('aria-label', TEXT.pin(p));
  });

  /* 묶음 우표 */

  let units = []; // 지금 지도에 보이는 우표들: 낱개 우표(장소)와 묶음 우표. 둘 다 { el, lat, lng, dx, dy } 를 갖는다
  const bundles = new Map(); // 지금 놓여 있는 묶음 우표: 묶인 곳들의 순번('3-6-7') → { key, members, lat, lng, marker, el }

  // 묶음 우표를 누르면(Enter · Space): 묶인 곳들이 따로따로 보이는 줌까지 그 자리로 다가간다.
  // 묶음 전체가 화면에 들어오는 줌(fit)과 가장 가까운 두 곳이 떨어져 보이는 줌(apart) 가운데 낮은 쪽 —
  // 한 번에 다 풀리지 않으면 더 작은 묶음이 남고, 그것을 또 누르면 된다
  const openBundle = (bundle) => {
    cancelWaiting();
    closeTip();
    const zoom = map.getZoom();
    const top = map.getMaxZoom();
    const { w, h } = stampSize();
    const spots = bundle.members.map((p) => map.project([p.lat, p.lng], zoom));
    let closest = Infinity;
    spots.forEach((spot, i) => {
      for (let j = i + 1; j < spots.length; j += 1) closest = Math.min(closest, spot.distanceTo(spots[j]));
    });
    const box = L.latLngBounds(bundle.members.map((p) => [p.lat, p.lng]));
    const fit = map.getBoundsZoom(box, false, [w * 3, h * 3]);
    const apart = closest > 0.01 ? zoom + Math.log2((w * 1.5) / closest) : Infinity;
    const target = clamp(Math.ceil(Math.min(fit, apart) / ZOOM_SNAP) * ZOOM_SNAP, Math.min(zoom + 1, top), top);
    flyTo(box.getCenter(), target, 0.8);
  };

  const makeBundle = (key, group) => {
    const count = group.members.length;
    const look = group.members.every((p) => p.cat === group.members[0].cat) ? group.members[0].cat : 'mix';
    const icon = L.divIcon({ className: 'map-pin map-pin--bundle', html: bundleHTML(count, look), iconSize: null });
    const marker = L.marker([group.lat, group.lng], { icon, keyboard: true, autoPanOnFocus: false }).addTo(map);
    const el = marker.getElement();
    group.members[0].el.after(el); // Tab 순서가 데이터 순서를 따르게 묶음의 첫 곳 바로 뒤에 둔다(겹침 순서는 z-index 가 정한다)
    const bundle = { key, members: group.members, lat: group.lat, lng: group.lng, marker, el, dx: 0, dy: 0 };
    el.style.setProperty('--pin-tilt', `${((group.members[0].index * 37) % 13) - 6}deg`);
    el.setAttribute('aria-label', TEXT.bundle(count)); // 쪽지 대신 이름으로 알린다
    // 마우스를 올리면(키보드 포커스에도) 위에 말풍선: 숫자의 뜻과 누르면 어떻게 되는지(css/map.css 의 .map-bundle-tip).
    // 손가락 기기에서는 누르는 즉시 가까이 다가가므로 말풍선을 붙이지 않는다(위의 안내 문구가 대신한다)
    if (window.matchMedia && matchMedia('(hover: hover)').matches) {
      marker.bindTooltip(TEXT.bundleTip(count), { direction: 'top', offset: [0, -24], className: 'map-bundle-tip', opacity: 1 });
    }
    marker.on('click', () => openBundle(bundle));
    marker.on('dblclick', () => {}); // 두 번 눌러도 지도가 따로 확대되지 않게
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openBundle(bundle);
    });
    return bundle;
  };

  // 지금 줌에 맞춰 묶음을 다시 짠다(줌 · 지도 크기가 바뀔 때마다): 묶인 곳의 낱개 우표는 숨기고 그 자리에 묶음 우표를 놓는다.
  // 묶인 곳이 그대로인 묶음 우표는 다시 만들지 않고 그대로 둔다
  const regroup = () => {
    const focusedPin = pins.find((p) => p.el === document.activeElement);
    const focusedBundle = [...bundles.values()].find((bundle) => bundle.el === document.activeElement);
    const keep = new Set();
    pins.forEach((p) => {
      p.bundle = null;
    });
    units = groupAt(map.getZoom()).map((group) => {
      if (group.members.length === 1) return group.members[0];
      const key = group.members.map((p) => p.index).join('-');
      if (!bundles.has(key)) bundles.set(key, makeBundle(key, group));
      const bundle = bundles.get(key);
      keep.add(key);
      group.members.forEach((p) => {
        p.bundle = bundle;
      });
      return bundle;
    });
    bundles.forEach((bundle, key) => {
      if (keep.has(key)) return;
      map.removeLayer(bundle.marker);
      bundles.delete(key);
    });
    pins.forEach((p) => {
      const out = (Boolean(catFilter) && p.cat !== catFilter) || (Boolean(regionFilter) && p.region !== regionFilter);
      p.el.classList.toggle('is-filtered', out);
      if (out) p.el.tabIndex = -1;
      const hidden = Boolean(p.bundle) || out;
      p.el.classList.toggle('is-bundled', Boolean(p.bundle));
      if (!hidden) return;
      // 숨는 우표: 마우스 · 포커스로 들썩이던 것과 비켜나 있던 거리를 거둔다
      mark(p, 'hover', false);
      mark(p, 'focus', false);
      p.dx = 0;
      p.dy = 0;
      p.el.style.setProperty('--dx', '0px');
      p.el.style.setProperty('--dy', '0px');
      p.el.classList.remove('is-shifted');
    });
    bundles.forEach(syncBundle);
    // 키보드 포커스가 있던 우표가 묶이거나 풀려서 사라졌으면, 그 곳이 지금 들어 있는 우표로 포커스를 옮긴다
    const lost = focusedPin && focusedPin.bundle ? focusedPin
      : focusedBundle && !bundles.has(focusedBundle.key) ? focusedBundle.members[0] : null;
    if (lost) (lost.bundle ? lost.bundle.el : lost.el).focus({ preventScroll: true });
  };

  // 겹침 풀기(줌 · 크기가 바뀔 때마다 다시): 비켜날 거리를 우표에 적용한다
  const spread = () => {
    if (!units.length) return;
    const moves = dodge(units.map((unit) => map.latLngToContainerPoint([unit.lat, unit.lng])));
    units.forEach((unit, i) => {
      const { x, y, length, far } = moves[i];
      unit.dx = x;
      unit.dy = y;
      unit.el.style.setProperty('--dx', `${x.toFixed(1)}px`);
      unit.el.style.setProperty('--dy', `${y.toFixed(1)}px`);
      unit.el.style.setProperty('--len', `${length.toFixed(1)}px`);
      unit.el.style.setProperty('--ang', `${Math.atan2(y, x).toFixed(3)}rad`);
      unit.el.classList.toggle('is-shifted', far); // 우표가 실제 자리를 가리지 못할 만큼 멀어지면 점과 선으로 잇는다
    });
  };

  // 지도 화면 밖(이나 가장자리에 걸친) 우표는 Tab 순서에서 뺀다. 보이지 않는 마커로 포커스가 가면
  // 브라우저가 그 마커를 찾아 페이지를 엉뚱한 곳으로 스크롤한다(같은 내용은 아래 목록에서 볼 수 있다).
  // 묶음 우표 안에 숨은 낱개 우표도 뺀다
  const syncTabStops = () => {
    if (!pins.length) return;
    const size = map.getSize();
    const { w, h } = stampSize();
    const padX = w / 2 + 6;
    const padY = h / 2 + 6;
    pins.forEach((p) => {
      if (p.bundle || p.el.classList.contains('is-filtered')) p.el.tabIndex = -1;
    });
    units.forEach((unit) => {
      const point = map.latLngToContainerPoint([unit.lat, unit.lng]);
      const x = point.x + (unit.dx || 0);
      const y = point.y + (unit.dy || 0);
      unit.el.tabIndex = x >= padX && x <= size.x - padX && y >= padY && y <= size.y - padY ? 0 : -1;
    });
  };

  /* 지명 · 바다 장식(좌표에 붙어 지도와 함께 움직인다. 누를 수 없고 마커보다 아래) */

  const addDecor = (item, className, html, zIndexOffset) => {
    const icon = L.divIcon({ className, html, iconSize: null });
    const el = L.marker([item.lat, item.lng], { icon, interactive: false, keyboard: false, zIndexOffset }).addTo(map).getElement();
    el.setAttribute('aria-hidden', 'true');
    return el;
  };
  DOODLES.forEach((d) => addDecor(d, 'map-doodle', doodleHTML(d), -4000));
  const labels = LABELS.map((label) => ({
    minZoom: label.minZoom || 0,
    el: addDecor(label, `map-label map-label--${label.kind} map-label--${label.side}`, labelHTML(label), -2000),
  }));

  /* 단추 */

  const zoomButtons = [...root.querySelectorAll('[data-map-zoom]')];
  let zoomSeen = NaN; // onZoom 이 마지막으로 정리한 줌

  // 줌이 바뀔 때마다: 지명 가리기 · 확대/축소 단추 잠그기 · 묶음 다시 짜기 · 겹침 풀기 · Tab 순서
  const onZoom = () => {
    const zoom = map.getZoom();
    zoomSeen = zoom;
    labels.forEach((label) => label.el.classList.toggle('is-far', zoom < label.minZoom - 0.01));
    zoomButtons.forEach((button) => {
      const stuck = button.dataset.mapZoom === 'in' ? zoom >= map.getMaxZoom() - 0.01 : zoom <= map.getMinZoom() + 0.01;
      button.setAttribute('aria-disabled', String(stuck));
    });
    regroup();
    spread();
    syncTabStops();
  };

  // 손가락 · 마우스로 늘 끌어 움직일 수 있다(14차 — 예전의 '지도 움직이기' 단추는 뺐다)
  if (coarse && coarse.addEventListener) {
    coarse.addEventListener('change', () => {
      setWhole(map.getZoom() <= map.getMinZoom() + 0.01); // 단추 줄이 달라졌다
    });
  }

  /* 쪽지(툴팁) */

  const tip = getTip();
  const paper = tip.querySelector('.map-tip__paper');
  // mode: 'hover'(커서를 따라다님) · 'pin'(눌러서 고정) · 'focus'(키보드 포커스)
  const now = { place: null, mode: '', beside: true, dx: 0, dy: 0 };
  let moving = false; // 지도가 움직이는 동안에는 쪽지를 열지 않는다
  let waiting = null; // 목록에서 고른 장소 { place, byKey }(지도가 다 움직이면 쪽지를 연다)
  let cameFrom = null; // 목록에서 키보드로 찾아온 마커(Esc 를 누르면 목록의 그 칸으로 돌아간다)
  let lastMove = 0; // 지도가 마지막으로 움직인 때
  let settleTimer = 0;
  let revealTimer = 0;
  let hoverLock = null; // Esc 로 닫은 마커: 커서가 나갔다 들어올 때까지 다시 열지 않는다
  let lastPointer = 'mouse';
  let lastInput = 'pointer'; // 마지막 조작이 포인터(마우스 · 손가락)였는지 키보드였는지

  // 우표가 화면에서 차지하는 자리 = 좌표 위의 상자 + 겹쳐서 비켜난 거리
  // (비켜나는 움직임이 아직 끝나지 않았어도 '도착할 자리'를 돌려준다)
  const boxOf = (p) => {
    const rect = p.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 + (p.dx || 0), y: rect.top + rect.height / 2 + (p.dy || 0), w: rect.width, h: rect.height };
  };

  // 우표 한가운데가 지도 화면 안, 그리고 브라우저 화면 안에 있는가(묶음 우표 안에 숨어 있으면 보이지 않는 것)
  const inSight = (p) => {
    if (p.bundle) return false;
    const box = boxOf(p);
    const frame = view.getBoundingClientRect();
    return box.x >= Math.max(frame.left, 0) && box.x <= Math.min(frame.right, document.documentElement.clientWidth)
      && box.y >= Math.max(frame.top, 0) && box.y <= Math.min(frame.bottom, window.innerHeight);
  };

  // 손가락으로 눌렀을 때 고른 우표. 우표가 몰려 있으면 위에 놓인 우표의 '넓힌 누름 범위'(보이지 않는 여백)가
  // 아래 우표의 보이는 면을 덮는다 → 누른 자리가 hit 의 보이는 면이 아니면, 그 자리에 보이는 우표(없으면 전체) 중 가장 가까운 것
  const pinAt = (point, hit) => {
    const boxes = shown().filter((p) => !p.bundle).map((p) => ({ p, box: boxOf(p) }));
    const holds = ({ box }) => Math.abs(point.x - box.x) <= box.w / 2 && Math.abs(point.y - box.y) <= box.h / 2;
    if (boxes.some((entry) => entry.p === hit && holds(entry))) return hit;
    const under = boxes.filter(holds);
    let best = hit;
    let min = Infinity;
    (under.length ? under : boxes).forEach(({ p, box }) => {
      const distance = Math.hypot(box.x - point.x, (box.y - point.y) * 0.84);
      if (distance < min) {
        min = distance;
        best = p;
      }
    });
    return best;
  };

  const cancelWaiting = () => {
    waiting = null;
    clearTimeout(revealTimer);
  };

  // 고정된 쪽지의 자리: 누른 지점 옆(마커가 움직이면 따라간다) 또는 마커 옆.
  // 좁은 화면이라 옆에 둘 자리가 없으면 우표를 가리지 않게 우표 아래(아래도 없으면 위)에 둔다
  const settleTip = () => {
    const box = boxOf(now.place);
    const squeezed = now.beside
      ? placeTip(tip, box.x, box.y, box.w / 2 + 10, -box.h / 2)
      : placeTip(tip, box.x + now.dx, box.y + now.dy);
    if (squeezed) placeTip(tip, box.x, box.y, -tip.offsetWidth / 2, box.h / 2 + 12);
  };

  const closeTip = () => {
    const p = now.place;
    if (!p) return;
    now.place = null;
    now.mode = '';
    tip.classList.remove('is-open', 'is-pinned');
    p.el.removeAttribute('aria-describedby');
    mark(p, 'tip', false);
  };

  // point = 화면 좌표 { x, y }. hover 는 그 자리(커서) 옆에, pin 은 그 자리 옆에 고정, 없으면 마커 옆에 연다
  const openTip = (p, mode, point) => {
    if (now.place && now.place !== p) closeTip();
    if (now.place !== p) {
      paper.innerHTML = tipHTML(p);
      tip.dataset.cat = p.cat;
      p.el.setAttribute('aria-describedby', tip.id);
      mark(p, 'tip', true);
    }
    now.place = p;
    now.mode = mode;
    tip.classList.add('is-open');
    tip.classList.toggle('is-pinned', mode === 'pin');
    if (mode === 'hover') {
      placeTip(tip, point.x, point.y);
      return;
    }
    now.beside = !point;
    if (point) {
      const box = boxOf(p);
      now.dx = point.x - box.x;
      now.dy = point.y - box.y;
    }
    settleTip();
  };

  // 목록에서 고른 장소: 마커가 화면에 보이면(스크롤이 끝나면) 마커 옆에 쪽지를 고정한다.
  // 키보드로 골랐으면(byKey) 포커스를 그 마커로 옮긴다 — 화면이 지도로 스크롤되어도 포커스가 보이고, 쪽지가 마커의 설명으로 읽힌다
  const reveal = (p, byKey, tries) => {
    clearTimeout(revealTimer);
    if (!inSight(p)) {
      if (tries > 0) revealTimer = setTimeout(() => reveal(p, byKey, tries - 1), 120);
      return;
    }
    if (!byKey) {
      openTip(p, 'pin');
      return;
    }
    cameFrom = p;
    p.el.focus({ preventScroll: true });
    if (now.place !== p) openTip(p, 'focus'); // 포커스 표시(:focus-visible)가 켜지지 않는 브라우저에서도 연다
  };

  // 지도가 멈춘 뒤: 기다리던 장소의 쪽지를 열거나, 키보드 포커스가 있는 마커의 쪽지를 다시 연다
  const settle = () => {
    moving = false;
    const next = waiting;
    waiting = null;
    if (next) {
      reveal(next.place, next.byKey, 14);
      return;
    }
    const focused = pins.find((pin) => pin.el === document.activeElement);
    if (focused && isFocusVisible(focused.el) && inSight(focused)) openTip(focused, 'focus');
  };

  // 클릭 · 탭: 누른 지점 옆에 고정
  const press = (p, point, mouse) => {
    cancelWaiting();
    hoverLock = null;
    if (now.place === p && now.mode === 'pin') {
      // 같은 지점을 다시 누르면: 마우스는 다시 커서를 따라다니고, 손가락은 닫는다
      if (mouse && point) openTip(p, 'hover', point);
      else closeTip();
      return;
    }
    openTip(p, 'pin', point);
  };

  pins.forEach((p) => {
    const { el, marker } = p;

    // 마우스: 올리면 커서 옆에 뜨고 따라다닌다. 나가면 닫힌다
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') mark(p, 'hover', true);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || moving || hoverLock === p) return;
      // 눌러서 고정했거나 키보드 포커스로 연 쪽지는 그대로 둔다(다른 마커 위를 지나가도 우표만 들썩이고, 누르면 그쪽으로 바뀐다)
      if (now.place && now.mode !== 'hover') return;
      openTip(p, 'hover', { x: e.clientX, y: e.clientY });
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      mark(p, 'hover', false);
      if (hoverLock === p) hoverLock = null;
      if (now.place === p && now.mode === 'hover') closeTip();
    });
    el.addEventListener('pointerdown', (e) => {
      lastPointer = e.pointerType || 'mouse';
    });

    // 클릭 · 탭(지도를 끌다 놓은 것은 Leaflet 이 걸러 준다)
    marker.on('click', (event) => {
      const e = event.originalEvent || {};
      const point = Number.isFinite(e.clientX) && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : null;
      const mouse = (e.pointerType || lastPointer) === 'mouse';
      const hit = !mouse && point ? pinAt(point, p) : p;
      press(hit, point, mouse);
      track('map_place', { place: hit.name, from: 'pin' });
    });
    marker.on('dblclick', () => {}); // 우표를 두 번 눌러도 지도가 확대되지 않게(이벤트를 마커에서 끝낸다)

    // 키보드: 포커스가 가면 마커 옆에 열리고, 떠나면 닫힌다. Enter · Space 로 여닫는다
    el.addEventListener('focus', () => {
      if (!isFocusVisible(el)) return;
      mark(p, 'focus', true);
      if (moving || (now.place === p && now.mode === 'pin')) return;
      openTip(p, 'focus');
    });
    el.addEventListener('blur', () => {
      mark(p, 'focus', false);
      if (cameFrom === p) cameFrom = null;
      if (now.place !== p) return;
      // 눌러서 고정한 쪽지는 Tab 으로 떠날 때만 닫는다
      // (마커를 누르면 Leaflet 이 포커스를 지도로 잠깐 옮기므로, 누르는 중의 blur 는 무시한다)
      if (now.mode === 'focus' || (now.mode === 'pin' && lastInput === 'key')) closeTip();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (now.place === p && now.mode !== 'hover') closeTip();
      else openTip(p, 'focus');
    });
  });

  // 바깥을 누르면 닫힌다(쪽지 안쪽과 마커는 빼고 — 마커는 자기 click 이 처리한다)
  document.addEventListener('pointerdown', (e) => {
    lastInput = 'pointer';
    const target = e.target instanceof Element ? e.target : null;
    if (!now.place || now.mode === 'hover' || !target) return;
    if (tip.contains(target) || target.closest('.map-pin')) return;
    closeTip();
  }, true);

  document.addEventListener('keydown', (e) => {
    lastInput = 'key';
    if (e.key !== 'Escape') return;
    cancelWaiting(); // 목록에서 고른 장소로 가는 중이었으면 쪽지를 열지 않는다
    const p = now.place;
    if (!p) return;
    if (now.mode === 'hover') hoverLock = p;
    closeTip();
    if (cameFrom === p && document.activeElement === p.el && p.item) p.item.focus();
  }, true);

  // 페이지를 스크롤하거나 창 크기가 바뀌면: 고정된 쪽지는 마커를 따라가고, 마커가 화면 밖으로 나가면 닫는다.
  // 위치가 그대로인 scroll 이벤트는 넘긴다 — 쪽지의 새 글자 때문에 글꼴 조각이 늦게 도착하면 js/main.js 가 스크롤 위치를
  // 다시 계산하며(ScrollTrigger.refresh) 제자리 scroll 이벤트를 내는데, 그때 마우스로 연 쪽지가 저절로 닫히지 않게
  let seenScroll = `${window.scrollX},${window.scrollY}`;
  const onViewport = (e) => {
    if (e && e.type === 'scroll') {
      const at = `${window.scrollX},${window.scrollY}`;
      if (at === seenScroll) return;
      seenScroll = at;
    }
    if (!now.place) return;
    if (now.mode === 'hover' || !inSight(now.place)) closeTip();
    else settleTip();
  };
  window.addEventListener('scroll', onViewport, { passive: true });
  window.addEventListener('resize', onViewport);

  /* 지도 이벤트 */

  map.on('movestart', () => {
    moving = true;
    clearTimeout(settleTimer);
    closeTip(); // 지도를 움직이거나 줌하면 쪽지를 닫는다
  });
  const onMoveEnd = () => {
    clearTimeout(settleTimer);
    // 날아가는 도중에 지도를 끌면 Leaflet 이 줌을 어중간한 값에 세워 둔 채 zoomend 를 내지 않는다
    // → 줌 단위에 맞추고(zoomend · moveend 가 다시 온다), 줌이 달라졌으면 뒷정리(onZoom)를 한다
    const zoom = map.getZoom();
    const snapped = clamp(Math.round(zoom / ZOOM_SNAP) * ZOOM_SNAP, map.getMinZoom(), map.getMaxZoom());
    if (Math.abs(snapped - zoom) > 0.001) {
      map.setZoom(snapped, { animate: false });
      return;
    }
    if (zoom !== zoomSeen) onZoom();
    else syncTabStops();
    settleTimer = setTimeout(settle, 80); // 한계 안으로 되돌아오는 움직임이 이어질 수 있어 잠깐 기다린다
  };
  map.on('moveend', onMoveEnd);
  map.on('dragstart', cancelWaiting);
  map.on('move', () => {
    lastMove = Date.now();
  });
  map.on('move zoom viewreset', syncGrain);
  map.on('zoomend', onZoom);

  // 날아가는 도중에 두 손가락을 댔다가 그냥 떼면 Leaflet 이 이동만 끊고 moveend 를 내지 않는다
  // → 손을 뗀 뒤에도 지도가 멈춰 있으면 직접 마무리한다(안 그러면 쪽지가 다시는 열리지 않는다)
  const onTouchEnd = (e) => {
    if (!moving || (e.touches && e.touches.length)) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (moving && Date.now() - lastMove > 250) onMoveEnd();
    }, 300);
  };
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

  /* 단추 동작 */

  root.querySelectorAll('[data-map-view]').forEach((button) => {
    button.addEventListener('click', () => {
      cancelWaiting();
      closeTip();
      const frame = button.dataset.mapView === 'northeast' ? clearFrame(NORTHEAST, 20) : whole;
      flyTo(frame.center, frame.zoom, button.dataset.mapView === 'northeast' ? 1 : 0.9);
    });
  });

  zoomButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      cancelWaiting();
      if (button.dataset.mapZoom === 'in') map.zoomIn();
      else map.zoomOut();
    });
  });


  /* 크기 변화 */

  let lastSize = `${canvas.clientWidth}x${canvas.clientHeight}`;
  const onResize = () => {
    const size = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (size === lastSize || !canvas.clientWidth || !canvas.clientHeight) return;
    lastSize = size;
    // 섬 전체를 보고 있었는가(날아가는 중에는 줌이 잠깐 낮아지므로 치지 않는다)
    const wasWhole = !moving && map.getZoom() <= map.getMinZoom() + 0.01;
    map.invalidateSize({ animate: false });
    setWhole(wasWhole);
    if (!wasWhole) {
      if (map.getZoom() < whole.zoom) map.setZoom(whole.zoom, { animate: false });
      map.panInsideBounds(map.options.maxBounds, { animate: false });
    }
    syncGrain();
    onZoom();
    onViewport(); // 열려 있던 쪽지는 마커를 따라가거나 닫힌다
  };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
  else window.addEventListener('resize', onResize);

  setWhole(true);
  syncGrain();
  onZoom();

  // 그 곳이 묶음 우표에 들어가지 않고 낱개로 보이는 가장 낮은 줌(from 부터 0.5 씩 올려 본다. 끝까지 확대하면 늘 낱개다)
  const soloZoom = (p, from) => {
    for (let zoom = from; zoom < map.getMaxZoom(); zoom += 0.5) {
      if (groupAt(zoom).some((unit) => unit.members.length === 1 && unit.members[0] === p)) return zoom;
    }
    return map.getMaxZoom();
  };

  // 목록에서 장소를 눌렀을 때: 지도가 보이게 스크롤하고, 그곳으로 날아간 뒤 마커 옆에 쪽지를 연다
  // (그 곳이 묶음 우표 안에 있으면 낱개로 보이는 줌까지 다가간다).
  // byKey = 키보드(Enter · Space)로 눌렀다 → 쪽지를 고정하는 대신 포커스를 마커로 옮긴다
  const goTo = (p, byKey) => {
    if (!p || !p.marker) return;
    closeTip();
    clearTimeout(revealTimer);

    const frame = view.getBoundingClientRect();
    if (frame.top < 0 || frame.bottom > window.innerHeight) {
      const top = window.scrollY + frame.top - Math.max(12, (window.innerHeight - frame.height) / 2);
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }

    waiting = { place: p, byKey: Boolean(byKey) };
    if (!flyTo([p.lat, p.lng], soloZoom(p, Math.max(map.getZoom(), FOCUS_ZOOM)), 0.9)) {
      // 이미 그 자리 — 지도는 그대로 두고 쪽지만 연다
      clearTimeout(settleTimer);
      settle();
    }
  };

  // 분류 단추(js 아래 renderFilters): 그 분류의 핀만 남기고 묶음을 다시 짠다. 'all' · null = 전부
  const filter = ({ cat = 'all', region = 'all' } = {}, changed = '') => {
    catFilter = cat !== 'all' ? cat : null;
    regionFilter = region !== 'all' ? region : null;
    if (now.place && !shown().includes(now.place)) closeTip();
    regroup();
    spread();
    syncTabStops();
    // 지역을 바꾸면 그 지역(남은 핀)이 다 보이게 다가간다. '전체'면 섬 전체
    if (changed === 'region') {
      const list = shown();
      const frame = regionFilter && list.length ? clearFrame(L.latLngBounds(list.map((p) => [p.lat, p.lng])), 28) : whole;
      if (frame) flyTo(frame.center, frame.zoom, 0.9);
    }
  };

  return { mark, goTo, filter };
}

/* ── 시작 ───────────────────────────────────────────────────── */

export function init(root, data) {
  const view = root.querySelector('.map__view');
  const canvas = root.querySelector('.map__canvas');
  const listEl = root.querySelector('.map__list');
  if (!view || !canvas || !listEl) return;

  const file = String(getConfig().map.dataFile ?? '').trim() || 'data/places.json'; // 콘솔 · 안내에 적을 파일 이름(js/main.js 와 같은 규칙)
  const places = Array.isArray(data) ? normalize(data, file) : [];
  if (!places.length) {
    showNote(root, TEXT.empty(file));
    return;
  }

  fillCounts(root, places);
  LIST_FIRST_WIDE = listFirstOf(getConfig().map.listFirst);
  LIST_FIRST_PHONE = listFirstOf(getConfig().map.listFirstPhone);
  const applyMore = initMore(root, listEl, places.length);
  let atlasNow = null; // 지도가 만들어지면 채운다(분류 단추가 핀도 거르게)
  renderFilters(root, places, (state, changed) => {
    applyMore.setFilter(state);
    if (atlasNow) atlasNow.filter(state, changed);
    // 목록 제목 옆의 곳 수 = 지금 고른 지역 · 분류의 곳 수
    const n = places.filter((p) => (state.cat === 'all' || p.cat === state.cat) && (state.region === 'all' || p.region === state.region)).length;
    root.querySelectorAll('[data-count="all"]').forEach((el) => { el.textContent = TEXT.count(n); });
  });

  // 지도를 만들고 목록을 그린다. 지도를 만들지 못하면 안내만 띄우고 목록은 글로 보여 준다
  const draw = () => {
    let atlas = null;
    if (window.L) {
      try {
        atlas = buildMap(root, view, canvas, places);
      } catch (err) {
        console.error('[map] 지도를 만들지 못해 목록만 보여 줍니다', err);
      }
    } else {
      console.warn('[map] 지도 라이브러리(Leaflet)를 불러오지 못해 목록만 보여 줍니다');
    }
    if (!atlas) {
      root.classList.add('is-nomap');
      // 조작할 지도가 없으므로 '지도 영역 · 방향키로 움직이고…' 안내도 뗀다
      canvas.removeAttribute('role');
      canvas.removeAttribute('aria-label');
      setNotice(view, TEXT.noMap);
    }
    atlasNow = atlas;
    renderList(listEl, places, atlas);
    applyMore();
  };

  // 보통은 여기서 바로 만든다. 지도 라이브러리가 아직 오는 중일 때만(느린 회선 — js/main.js 는 3초까지만 기다린다)
  // 목록부터 글로 보여 주고, 도착하면(또는 끝내 오지 않으면) 그때 마저 그린다
  const pending = window.L ? null : document.querySelector('script[data-lib][src*="leaflet"]:not([data-done])');
  if (!pending) {
    draw();
    return;
  }
  renderList(listEl, places, null);
  applyMore();
  setNotice(view, TEXT.wait);
  let timer = 0;
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    setNotice(view, '');
    draw();
  };
  pending.addEventListener('load', finish, { once: true });
  pending.addEventListener('error', finish, { once: true });
  timer = setTimeout(finish, LEAFLET_WAIT);
}
