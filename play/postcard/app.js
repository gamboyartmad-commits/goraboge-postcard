// 성과 측정(v7.11): track.js 의 hyTrack 으로 보냄. track.js 를 못 불러와도 사이트는 그대로 움직이게
const hy = (name, params) => { try { if (window.hyTrack) window.hyTrack(name, params); } catch (e) { /* 측정만 빠짐 */ } };

// ---------- 엽서 목록 ----------
// 16장 모두 같은 틀(1920×1280, 오른쪽 절반에 To / 8줄 / From)이라 쓰는 자리가 같음
// hidden: true 인 그림은 고르기 띠에서 뺌. 번호(순서)는 그대로 두어야 예전에 보낸 엽서 링크 · 게시판 엽서가 같은 그림으로 열림

// 그림을 고치면 IMG_V를 올려서 브라우저에 남은 예전 그림 대신 새 그림을 받게 함
const IMG_V = '?v=3';   // v2: 미리 찍혀 있던 소인을 지운 그림, v3: 우표를 75%로 줄인 그림 (_tools/shrink_card_stamp.py)
const CARDS = [
  { src: `images/card-01.webp${IMG_V}`, alt: '해녀가 헤엄치는 바다' },
  { src: `images/card-02.webp${IMG_V}`, alt: '비 오는 창밖의 꽃밭' },
  { src: `images/card-03.webp${IMG_V}`, alt: '노을 진 바닷가의 돌하르방' },
  { src: `images/card-04.webp${IMG_V}`, alt: '오름 길에서 내려다본 바닷가 마을' },
  { src: `images/card-05.webp${IMG_V}`, alt: '협재 바닷가 모래언덕', hidden: true },
  { src: `images/card-06.webp${IMG_V}`, alt: '바위 위로 쏟아지는 폭포', hidden: true },
  { src: `images/card-07.webp${IMG_V}`, alt: '물웅덩이가 고인 현무암 바닷가' },
  { src: `images/card-08.webp${IMG_V}`, alt: '창문 너머 들판의 말' },
  { src: `images/card-09.webp${IMG_V}`, alt: '고글을 쓰고 오토바이에 탄 강아지' },
  { src: `images/card-10.webp${IMG_V}`, alt: '해녀의 숨비소리 벽화 앞을 걷는 해녀' },
  { src: `images/card-11.webp${IMG_V}`, alt: '돌담 사이 바다로 난 길', hidden: true },
  { src: `images/card-12.webp${IMG_V}`, alt: '돌집 옆 들판에 선 말' },
  // 13~16: 2026-10-21 추가 (원본 _tools/assets/cards/, 미리 찍힌 소인은 _tools/clean_card_postmark.py로 지움)
  { src: `images/card-13.webp${IMG_V}`, alt: '바닷가 모래밭을 뛰어가는 하얀 강아지' },
  { src: `images/card-14.webp${IMG_V}`, alt: '현무암 바닷가에서 책을 보는 사람' },
  { src: `images/card-15.webp${IMG_V}`, alt: '오름 위에 나란히 앉아 들판을 바라보는 두 사람' },
  { src: `images/card-16.webp${IMG_V}`, alt: '돌집 앞 분홍 벤치에 앉은 노부부' },
];

const cardImage = document.getElementById('cardImage');
const cardPhoto = document.getElementById('cardPhoto');
const cardMessage = document.getElementById('cardMessage');
const cardTo = document.getElementById('cardTo');
const cardFrom = document.getElementById('cardFrom');
const carousel = document.getElementById('carousel');
const statusEl = document.getElementById('status');

// 모바일 전용 사이트라 컴퓨터에서도 늘 휴대폰 화면처럼 동작 (가운데 휴대폰 폭으로 보임)
const narrowScreen = window.matchMedia('all');

let currentCard = 0;

function setStatus(text, warning) {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-warning', !!warning);
}

// ---------- 엽서 고르기 띠 (끝없이 도는 캐러셀) ----------
// 손가락으로 밀거나, 마우스로 끌거나, 휠을 굴리면 스르륵 넘어가고 가운데에 온 그림이 바로 엽서에 들어감.
// 엽서 12장을 여러 벌 이어 붙여 두고, 멈출 때마다 같은 그림이 있는 가운데 벌로 몰래 옮겨서
// 양쪽 끝 없이 계속 돌아가는 것처럼 보이게 함

const COPIES = 5;                       // 한 번 휙 밀어도 끝에 닿지 않을 만큼
const MIDDLE = Math.floor(COPIES / 2);  // 늘 이 벌 근처에 머무름
const PICK = CARDS.map((card, index) => index).filter((index) => !CARDS[index].hidden);   // 띠에 보이는 그림 번호
const N = PICK.length;

const GAP = () => parseFloat(getComputedStyle(carousel).columnGap) || 14;

const cardTiles = [];
for (let copy = 0; copy < COPIES; copy++) {
  PICK.forEach((index, pos) => {
    const card = CARDS[index];
    const slot = copy * N + pos;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'strip-item';
    btn.dataset.index = index;
    btn.innerHTML = `<img src="${card.src}" alt="${card.alt} 엽서" draggable="false">`;
    if (copy !== MIDDLE) {               // 화면 읽기 프로그램에는 한 벌만 알려 줌
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
    }
    btn.addEventListener('click', () => onTileClick(slot));
    carousel.appendChild(btn);
    cardTiles.push(btn);
  });
}

let centerSlot = MIDDLE * N;   // 지금 가운데 있는 칸 (여러 벌을 통틀어 센 번호)

// 지금 엽서 그림 자리에 무엇이 들어가 있는지 띠에 표시
function markPicked() {
  cardTiles.forEach((btn, k) => btn.setAttribute('aria-pressed', String(!photoActive && k === centerSlot)));
  photoTile.setAttribute('aria-pressed', String(photoActive));
}

let onCardChange = null;   // 엽서를 바꾸면 그 엽서의 템플릿 글로 (아래 '엽서 템플릿')

function selectCard(index) {
  const changed = index !== currentCard;
  currentCard = index;
  cardImage.src = CARDS[index].src;
  cardImage.alt = CARDS[index].alt + ' 엽서';
  showPhoto(false);
  if (changed && onCardChange) onCardChange(index);
  if (changed) hy('pc_card_pick', { card: index + 1 });
}

// 고른 그림을 동화 속 봉투 안 엽서에도 똑같이
function syncPreview() {
  const letterCard = document.getElementById('letterCard');
  if (letterCard && letterCard.getAttribute('src') !== cardImage.getAttribute('src')) letterCard.src = cardImage.getAttribute('src');
  if (letterCard) letterCard.alt = `봉투에 든 엽서 — ${CARDS[currentCard].alt}`;   // v7.19: 대체텍스트도 고른 엽서로
}

const tileCenter = (k) => cardTiles[k].offsetLeft + cardTiles[k].offsetWidth / 2;
const setWidth = () => tileCenter(N) - tileCenter(0);   // 한 벌(띠에 보이는 그림 수)의 길이

// 띠가 그 위치에 있을 때 가운데에 오는 칸
function slotAt(scrollLeft) {
  const mid = scrollLeft + carousel.clientWidth / 2;
  const step = tileCenter(1) - tileCenter(0);
  return Math.max(0, Math.min(cardTiles.length - 1, Math.round((mid - tileCenter(0)) / step)));
}

function scrollToSlot(k, behavior) {
  const left = tileCenter(k) - carousel.clientWidth / 2;
  if (behavior === 'smooth') {
    // 미끄러지는 동안 자석 스냅이 끼어들지 않게 잠시 풀었다가 멈추면 다시 켬
    carousel.classList.add('is-free');
    smoothPending = true;
  }
  carousel.scrollTo({ left, behavior });
  if (behavior !== 'smooth') settle();
}

// 가운데에서 멀수록 작고 흐리게. 가운데 그림이 바뀌면 엽서도 바로 바꿈
let painting = false;
function paint() {
  painting = false;
  if (!carousel.clientWidth) return;   // 첫 화면 등으로 띠가 숨어 있을 때는 잴 수 없음
  const mid = carousel.scrollLeft + carousel.clientWidth / 2;
  const step = tileCenter(1) - tileCenter(0);
  const first = Math.max(0, slotAt(carousel.scrollLeft) - 8);
  const last = Math.min(cardTiles.length - 1, first + 16);
  for (let k = first; k <= last; k++) {          // 화면 근처 칸만 다시 그림
    const d = Math.min(Math.abs(tileCenter(k) - mid) / step, 3);
    cardTiles[k].style.setProperty('--s', (1.2 - d * 0.12).toFixed(3));
    cardTiles[k].style.setProperty('--o', (1 - d * 0.2).toFixed(3));
  }
  const slot = slotAt(carousel.scrollLeft);
  if (slot !== centerSlot) {
    centerSlot = slot;
    if (PICK[slot % N] !== currentCard) selectCard(PICK[slot % N]);
    else markPicked();
  }
}

// 멈추면: 미끄러지기용으로 풀어 둔 스냅을 다시 켜고, 가운데 벌로 몰래 옮김
let smoothPending = false;
let touching = false;
let settleTimer = null;

function settle() {
  if (drag || touching) return;
  if (smoothPending) {
    smoothPending = false;
    carousel.classList.remove('is-free');
  }
  const copy = Math.floor(centerSlot / N);
  if (copy !== MIDDLE) {
    const shift = (copy - MIDDLE) * setWidth();
    centerSlot -= (copy - MIDDLE) * N;
    carousel.scrollLeft -= shift;      // 같은 그림이 같은 자리에 오므로 눈에는 안 보임
    markPicked();                      // 주황 테두리도 옮긴 칸으로
  }
  paint();
}

carousel.addEventListener('scroll', () => {
  if (!painting) { painting = true; requestAnimationFrame(paint); }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 160);
}, { passive: true });

carousel.addEventListener('touchstart', () => { touching = true; }, { passive: true });
carousel.addEventListener('touchend', () => {
  touching = false;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 400);   // 손을 뗀 뒤 관성으로 미끄러지는 시간을 기다림
}, { passive: true });

let suppressClick = false;   // 끌어서 넘긴 직후의 클릭은 무시

function onTileClick(k) {
  if (suppressClick) return;
  if (k === centerSlot) selectCard(PICK[k % N]);   // 내 사진이 올라가 있었다면 이 그림으로 되돌림
  else scrollToSlot(k, 'smooth');
}

// 마우스로 끌어서 넘기기 (손가락은 브라우저 기본 스와이프를 그대로 씀)
let drag = null;

carousel.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  drag = { startX: e.clientX, startLeft: carousel.scrollLeft, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
});

window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  if (!drag.moved && Math.abs(dx) > 4) {
    drag.moved = true;
    carousel.classList.add('is-free', 'is-dragging');
  }
  if (!drag.moved) return;
  carousel.scrollLeft = drag.startLeft - dx;
  drag.samples.push({ x: e.clientX, t: e.timeStamp });
  if (drag.samples.length > 5) drag.samples.shift();
});

window.addEventListener('pointerup', () => {
  if (!drag) return;
  const { moved, samples } = drag;
  drag = null;
  if (!moved) return;
  carousel.classList.remove('is-dragging');

  // 놓는 순간의 빠르기만큼 더 미끄러진 자리의 그림으로 감
  const first = samples[0];
  const last = samples[samples.length - 1];
  const velocity = (last.x - first.x) / Math.max(last.t - first.t, 1);   // px/ms
  scrollToSlot(slotAt(carousel.scrollLeft - velocity * 150), 'smooth');

  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
});

// 휠 한 번에 한 장씩
let lastWheel = 0;
carousel.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // 트랙패드 가로 밀기는 기본 동작 그대로
  e.preventDefault();
  if (e.timeStamp - lastWheel < 220) return;
  lastWheel = e.timeStamp;
  scrollToSlot(centerSlot + Math.sign(e.deltaY), 'smooth');
}, { passive: false });

// 키보드 ← → 로도 넘기기
carousel.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  scrollToSlot(centerSlot + (e.key === 'ArrowRight' ? 1 : -1), 'smooth');
});

window.addEventListener('resize', () => scrollToSlot(centerSlot, 'instant'));

// ---------- 내 사진 넣기 ----------
// 엽서 왼쪽 그림 자리(960×1280)에 사진을 꽉 채워 넣음. 처음엔 가운데 기준으로 잘리고,
// 사용자가 그 자리 안에서 끌어서 옮기고 · 두 손가락(또는 + − 단추, 트랙패드 핀치)으로 키울 수 있음 (photoView).
// 화면 · 저장 그림 · 카카오톡 · 메일 · 게시판 사진 모두 같은 photoView로 그림.
// 다른 엽서를 골랐다가 '내 사진' 칸을 다시 누르면 넣었던 사진(과 맞춘 위치)으로 돌아옴

const PHOTO_W = 960;
const PHOTO_MAX_BYTES = 30 * 1024 * 1024;

const photoInput = document.getElementById('photoInput');
const photoTile = document.getElementById('photoTile');
const photoThumb = document.getElementById('photoThumb');
const photoLabel = document.getElementById('photoLabel');
let photoUrl = null;      // 넣어 둔 사진
let photoActive = false;  // 지금 엽서에 사진이 보이는지


// 사진을 얼마나 키웠고(zoom 1~4) 어디를 가운데에 두었는지(cx · cy = 사진 안의 비율 0~1)
const photoView = { zoom: 1, cx: 0.5, cy: 0.5 };
const PHOTO_ZOOM_MAX = 4;
const cardPhotoView = document.getElementById('cardPhotoView');
const photoTools = document.getElementById('photoTools');

// 그림 자리(w×h)에 보일 사진의 부분: 꽉 채우는 크기 × zoom, 가운데 = (cx, cy), 사진 밖으로는 못 나가게
function photoWindow(img, w, h) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih) * photoView.zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.min(Math.max(photoView.cx * iw - sw / 2, 0), iw - sw);
  const sy = Math.min(Math.max(photoView.cy * ih - sh / 2, 0), ih - sh);
  return { sx, sy, sw, sh };
}

// 끌다가 사진 끝을 넘으면 끝에 붙여 둠 (다음에 반대로 끌 때 바로 움직이게)
function clampPhotoView() {
  if (!cardPhoto.naturalWidth) return;
  const { sx, sy, sw, sh } = photoWindow(cardPhoto, PHOTO_W, CARD_H);
  photoView.cx = (sx + sw / 2) / cardPhoto.naturalWidth;
  photoView.cy = (sy + sh / 2) / cardPhoto.naturalHeight;
}

let photoDrawPending = false;
function drawPhotoView() {
  if (photoDrawPending) return;
  photoDrawPending = true;
  requestAnimationFrame(() => {
    photoDrawPending = false;
    if (!photoActive || !cardPhoto.naturalWidth) return;
    const ctx = cardPhotoView.getContext('2d');
    drawCover(ctx, cardPhoto, cardPhotoView.width, cardPhotoView.height);
  });
}

function setPhotoZoom(zoom) {
  photoView.zoom = Math.min(PHOTO_ZOOM_MAX, Math.max(1, zoom));
  clampPhotoView();
  drawPhotoView();
}

// 손가락 · 마우스: 하나는 끌어 옮기기, 둘은 벌리고 오므려 크기
const photoPointers = new Map();
let pinchStart = null;
const pointerGap = () => {
  const [a, b] = [...photoPointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
};
cardPhotoView.addEventListener('pointerdown', (e) => {
  if (!photoActive) return;
  e.preventDefault();
  try { cardPhotoView.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ }
  photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cardPhotoView.classList.add('is-dragging');
  if (photoPointers.size === 2) pinchStart = { gap: pointerGap(), zoom: photoView.zoom };
});
cardPhotoView.addEventListener('pointermove', (e) => {
  const prev = photoPointers.get(e.pointerId);
  if (!prev) return;
  const now = { x: e.clientX, y: e.clientY };
  photoPointers.set(e.pointerId, now);
  if (photoPointers.size === 1) {
    const box = cardPhotoView.getBoundingClientRect();
    const { sw, sh } = photoWindow(cardPhoto, PHOTO_W, CARD_H);
    photoView.cx -= ((now.x - prev.x) / box.width) * (sw / cardPhoto.naturalWidth);
    photoView.cy -= ((now.y - prev.y) / box.height) * (sh / cardPhoto.naturalHeight);
    clampPhotoView();
    drawPhotoView();
  } else if (photoPointers.size === 2 && pinchStart) {
    setPhotoZoom(pinchStart.zoom * (pointerGap() / pinchStart.gap));
  }
});
['pointerup', 'pointercancel'].forEach((type) => cardPhotoView.addEventListener(type, (e) => {
  photoPointers.delete(e.pointerId);
  if (photoPointers.size < 2) pinchStart = null;
  if (!photoPointers.size) cardPhotoView.classList.remove('is-dragging');
}));
// 트랙패드 두 손가락 벌리기(ctrl + 휠)만 크기로. 그냥 휠은 화면 스크롤 그대로
cardPhotoView.addEventListener('wheel', (e) => {
  if (!photoActive || !e.ctrlKey) return;
  e.preventDefault();
  setPhotoZoom(photoView.zoom * Math.exp(-e.deltaY * 0.01));
}, { passive: false });
document.getElementById('photoZoomIn').addEventListener('click', () => setPhotoZoom(photoView.zoom * 1.25));
document.getElementById('photoZoomOut').addEventListener('click', () => setPhotoZoom(photoView.zoom / 1.25));
document.getElementById('photoReset').addEventListener('click', () => {
  Object.assign(photoView, { zoom: 1, cx: 0.5, cy: 0.5 });
  drawPhotoView();
});

function showPhoto(on) {
  photoActive = on && !!photoUrl;
  cardPhotoView.hidden = !photoActive;
  photoTools.hidden = !photoActive;
  if (photoActive) drawPhotoView();
  syncPreview();
  markPicked();   // v7.16: 사진 칸 아래 설명 줄('직접 찍은 사진으로 엽서 만들기' 등)은 뺐다(사용자)
}

photoTile.addEventListener('click', () => {
  if (photoUrl && !photoActive) showPhoto(true);
  else photoInput.click();
});

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  photoInput.value = '';               // 같은 사진을 다시 골라도 change가 일어나도록
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('사진 파일만 넣을 수 있어요.', true);
    return;
  }
  if (file.size > PHOTO_MAX_BYTES) {
    setStatus('사진이 너무 커요. 30MB보다 작은 사진을 골라 주세요.', true);
    return;
  }

  const url = URL.createObjectURL(file);
  const probe = new Image();
  probe.src = url;
  try {
    await probe.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    setStatus('이 사진은 열 수 없어요. 다른 사진을 골라 주세요.', true);
    return;
  }

  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = url;
  Object.assign(photoView, { zoom: 1, cx: 0.5, cy: 0.5 });   // 새 사진은 가운데부터
  cardPhoto.src = url;
  try { await cardPhoto.decode(); } catch (e) { /* 아래에서 다시 그림 */ }
  photoThumb.src = url;
  photoThumb.hidden = false;
  photoTile.classList.add('has-photo');
  photoLabel.textContent = '내 사진';
  showPhoto(true);

  setStatus('사진을 넣었어요. 끌어서 옮기고, 두 손가락으로 벌리거나 + − 단추로 크기를 바꿀 수 있어요.');
});

markPicked();
scrollToSlot(centerSlot, 'instant');

// ---------- 엽서 내용은 엽서에 그려진 8줄까지만 ----------

// 줄을 넘겨 쓰면 글자가 엽서 밖으로 밀려나므로, 넘친 만큼 끝에서부터 잘라냄
function fitLines() {
  while (cardMessage.scrollHeight > cardMessage.clientHeight && cardMessage.value.length > 0) {
    cardMessage.value = cardMessage.value.slice(0, -1);
  }
}

cardMessage.addEventListener('input', fitLines);

// ---------- 휴대폰: 보통 크기 칸에 쓰면 엽서에 바로 옮김 ----------

const mobileMessage = document.getElementById('mobileMessage');
const PAIRS = [
  [mobileMessage, cardMessage],
  [document.getElementById('mobileTo'), cardTo],
  [document.getElementById('mobileFrom'), cardFrom],
];

PAIRS.forEach(([mobile, card]) => {
  mobile.addEventListener('input', () => {
    card.value = mobile.value;
    if (card === cardMessage) {
      fitLines();
      if (mobile.value !== card.value) mobile.value = card.value;   // 8줄을 넘긴 만큼은 여기서도 지움
      card.dispatchEvent(new Event('input'));
    }
  });
  card.addEventListener('input', () => { if (mobile.value !== card.value) mobile.value = card.value; });
});

function syncMobile() {
  PAIRS.forEach(([mobile, card]) => { mobile.value = card.value; });
}

// ---------- 엽서 위 줄글(To · 편지 · From)을 누르면 아래 편지 쓰는 곳으로 ----------
// 엽서 칸에 바로 쓰지 않고, 화면을 '당신의 마음을 들려주세요.'까지 내려 그 칸(받는 사람 · 하고 싶은 말 · 보내는 사람)에 커서를 둠
const CARD_TO_WRITER = [
  [cardTo, 'mobileTo'],
  [cardMessage, 'mobileMessage'],
  [document.getElementById('cardFrom'), 'mobileFrom'],
];

// 마음 쓰기 칸('당신의 마음을 들려주세요.' · To · 하고 싶은 말 · From)은 처음엔 숨겨 두고(엽서 템플릿 글만),
// 'T 내 편지 쓰기' · 엽서 위 줄글을 누르면 열림
const writerPanel = document.getElementById('writerPanel');
const writeOpenBtn = document.getElementById('writeOpenBtn');
function openWriter() {
  if (!writerPanel.hidden) return;
  writerPanel.hidden = false;
  writeOpenBtn.setAttribute('aria-expanded', 'true');
}
// 'T 내 편지 쓰기': 엽서 템플릿 글(To · 편지)을 지우고 빈칸으로 열어 직접 쓰게 함.
// 이미 직접 쓴 글은 지우지 않음. 이때부터는 엽서를 바꿔도 템플릿 글이 다시 써지지 않음(그 엽서 글은 단추로만)
let writingOwn = false;
document.getElementById('translateTopBtn').addEventListener('click', () => translateBtn.click());
document.getElementById('writerSendBtn').addEventListener('click', () => translateBtn.click());   // 쓰는 칸 아래 '편지 보내기'

// v7.16: 휴대폰에서 편지를 쓰는 동안 키보드가 '편지 보내기'를 가리지 않게 — 쓰는 칸에 포커스가 있으면 단추 줄을 키보드 바로 위에 띄운다
// (visualViewport 로 키보드 높이를 재서 --kb 로. 단추를 누르는 순간 키보드가 먼저 내려가 단추가 움직이지 않게 pointerdown 은 포커스를 옮기지 않는다)
(() => {
  const bar = document.querySelector('.writer-send');
  const btn = document.getElementById('writerSendBtn');
  const fields = ['mobileTo', 'mobileFrom', 'mobileMessage'].map((id) => document.getElementById(id));
  const touch = window.matchMedia('(pointer: coarse)');
  const vv = window.visualViewport;
  if (!bar || !btn) return;
  const place = () => {
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    bar.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  fields.forEach((field) => {
    field.addEventListener('focus', () => {
      if (!touch.matches) return;
      bar.classList.add('is-typing');
      document.documentElement.classList.add('is-typing-letter');   // 그동안 왼쪽 아래 '← 뒤로'는 숨김(단추 줄과 겹치지 않게)
      place();
    });
    field.addEventListener('blur', () => {
      setTimeout(() => {
        if (fields.includes(document.activeElement)) return;
        bar.classList.remove('is-typing');
        document.documentElement.classList.remove('is-typing-letter');
      }, 150);
    });
  });
  if (vv) {
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
  }
  btn.addEventListener('pointerdown', (e) => { if (bar.classList.contains('is-typing')) e.preventDefault(); });
})();

writeOpenBtn.addEventListener('click', () => {
  writingOwn = true;
  const text = mobileMessage.value.trim();
  if (!text || isTemplateText(text)) writeField(mobileMessage, '');
  if (TEMPLATE_TOS.has(mobileTo.value.trim())) writeField(mobileTo, '');
  hideTemplateUndo();
  onCardTemplate(currentCard);
  goWriteField('mobileTo');
});

// 'T 메시지 편집' (엽서 안, 글 바로 아랫줄 가운데): 엽서에 있는 글을 그대로 둔 채 편지 쓰는 칸으로.
// 엽서 글과 쓰는 칸은 늘 같은 글이라 옮길 것은 없음. 8줄을 다 채우면 From 줄 밑 오른쪽 아래로
const cardEditBtn = document.getElementById('cardEditBtn');
cardEditBtn.addEventListener('click', (e) => {
  e.stopPropagation();   // 엽서 누르기(가까운 칸으로)와 겹치지 않게
  goWriteField('mobileMessage');
});
const CARD_LINES = 8;
let cardEditKey = '';
function placeCardEdit() {
  const box = cardMessage.clientHeight;
  if (!box) return;
  const key = `${cardMessage.value}|${box}|${cardMessage.clientWidth}`;
  if (key === cardEditKey) return;
  cardEditKey = key;
  // 글이 몇 줄인지: 잠깐 높이를 0으로 두고 글 높이를 잼
  const keep = cardMessage.style.height;
  cardMessage.style.height = '0px';
  const textHeight = cardMessage.value ? cardMessage.scrollHeight : 0;
  cardMessage.style.height = keep;
  const lines = Math.round(textHeight / (box / CARD_LINES));
  cardEditBtn.classList.toggle('is-full', lines >= CARD_LINES);
  cardEditBtn.style.setProperty('--edit-line', String(Math.max(lines, 1)));
}
(function watchCardText() {   // 엽서 글은 여러 곳에서 바뀌므로 화면 그릴 때마다 바뀌었는지만 봄
  placeCardEdit();
  requestAnimationFrame(watchCardText);
})();

function goWriteField(id) {
  openWriter();
  const heading = writerPanel;   // 쓰는 칸 맨 위(To)
  const bar = document.querySelector('.tale-bar');
  const top = heading.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 16;
  window.scrollTo({ top, behavior: smoothScroll() });
  document.getElementById(id).focus({ preventScroll: true });
}

// 엽서 칸들은 손가락 · 마우스를 그냥 통과시키므로(pointer-events: none) 엽서 전체에서 받아, 오른쪽 글 쓰는 면을 눌렀을 때만.
// 누른 높이에 가장 가까운 칸(To · 편지 · From)으로 감
document.getElementById('card').addEventListener('click', (e) => {
  const writeFace = cardMessage.getBoundingClientRect();
  if (e.clientX < writeFace.left - 12) return;   // 왼쪽 그림 쪽은 그대로
  let best = null;
  CARD_TO_WRITER.forEach(([field, id]) => {
    const r = field.getBoundingClientRect();
    const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
    if (!best || d < best.d) best = { d, id };
  });
  goWriteField(best.id);
});
CARD_TO_WRITER.forEach(([field, id]) => {
  field.addEventListener('focus', () => goWriteField(id));   // 키보드(Tab)로 들어와도 아래 쓰는 곳으로
});

// ---------- 엽서 템플릿: 엽서(그림)마다 어울리는 To · 편지 글 ----------
// 엽서를 고르면 그 엽서의 To와 편지 글이 바로 써짐(엽서에도). 단, 직접 쓴 글이 있으면 지우지 않고
// 아래 '이 엽서에 어울리는 글' 단추로만 보여 줌(누르면 바꾸고 '되돌리기' 8초).
// 노부부 엽서(16번)처럼 글이 두 가지인 엽서는 단추로 골라 씀.
// jeju = 미리 다듬은 제주어 문장(번역 규칙에 맡기면 어색해지는 곳이 있어서). 낱말은 jeju-dict.js(『개정증보 제주어사전』)의
// 짝(ᄒᆞᆫ듸 · 하영 · ᄉᆞ랑 · 느 · ᄀᆞ장 · ᄒᆞᆼ상 …)과 웹진 · 예시 엽서의 말끝(-난, -멍, -으민 좋으키여, -고정 ᄒᆞ다, -덴)을 따름.
// Claude가 만든 문장이라 제주어를 아는 분의 확인이 필요함 (HISTORY.md)
const CARD_TEMPLATES = {
  0: [{ to: '제주에서 보내는 편지',
    text: '제주의 바람을 맞으며 걷다가 네가 생각났어. 이곳의 아름다운 풍경처럼 너의 하루도 평온하고 따뜻하길 바라.',
    jeju: '제주 ᄇᆞ름 맞으멍 걷단 느 셍각이 낫어. 이디 곱닥ᄒᆞᆫ 풍경추룩 느 ᄒᆞ루도 펜안ᄒᆞ곡 ᄃᆞᄉᆞᄒᆞ민 좋으키여.' }],
  1: [{ to: '오랜만의 안부',
    text: '잘 지내고 있어? 특별한 일이 있는 건 아니지만 문득 네 생각이 나서 이렇게 편지를 써.',
    jeju: '잘 지냄시냐? 벨 일 이신 건 아니주마는 문득 느 셍각이 나난 영 펜지 쓴다.' }],
  2: [{ to: '새로운 시작',
    text: '새로운 길을 향해 나아가는 너의 용기가 참 멋져. 앞으로 마주할 모든 순간이 너에게 좋은 기억으로 남길 바라.',
    jeju: '새 질로 나아가는 느 용기가 ᄎᆞᆷ 멋지다. 앞으로 만날 모든 순간이 느안티 좋은 기억으로 남으민 좋으키여.' }],
  3: [{ to: '고마운 사람에게',
    text: '당연하게 여겼던 순간들에도 늘 네 따뜻한 마음이 있었더라. 지금이라도 꼭 고맙다는 말을 전하고 싶어.',
    jeju: '당연ᄒᆞ게 여겨난 순간들에도 늘 느 ᄃᆞᄉᆞᄒᆞᆫ ᄆᆞ음이 이서라. 이제라도 꼭 고맙덴 말 전ᄒᆞ고정 ᄒᆞ다.' }],
  6: [{ to: '사과하고 싶은 사람에게',
    text: '그때는 내 마음만 앞서서 네 마음을 미처 헤아리지 못했어. 늦었지만 진심으로 미안하다는 말을 전하고 싶어.',
    jeju: '그때는 나 ᄆᆞ음만 앞산 느 ᄆᆞ음을 미처 헤아리지 못ᄒᆞ엿어. 늦어시주마는 진심으로 미안ᄒᆞ덴 말 전ᄒᆞ고정 ᄒᆞ다.' }],
  7: [{ to: '고백하고 싶은 사람에게',
    text: '언제부터인지 너와 함께하는 시간이 자꾸 기다려져. 이제는 내 마음을 솔직하게 전하고 싶어. 나 너 좋아해.',
    jeju: '어느제부터인지 느영 ᄒᆞᆫ듸ᄒᆞ는 시간이 자꾸 지드려져. 이제랑 나 ᄆᆞ음을 솔직ᄒᆞ게 전ᄒᆞ고정 ᄒᆞ다. 나 느 좋아ᄒᆞ여.' }],
  8: [{ to: '응원하고 싶은 사람에게',
    text: '지금도 충분히 잘하고 있어. 네가 걸어가는 모든 순간을 진심으로 응원할게.',
    jeju: '지금도 충분히 잘ᄒᆞ염저. 느가 걸어가는 모든 순간을 진심으로 응원ᄒᆞ크라.' }],
  9: [{ to: '그리운 이에게',
    text: '잘 지내고 있지? 가끔 너와 함께 웃던 날들이 떠올라. 언젠가 다시 만나 못다 한 이야기들을 나누고 싶어.',
    jeju: '잘 지냄시냐? 간간 느영 ᄒᆞᆫ듸 웃엇던 날들이 셍각나. 어느제랑 ᄐᆞ시 만난 못다 ᄒᆞᆫ 이야기덜 ᄀᆞᆯ아보고정 ᄒᆞ다.' }],
  11: [{ to: '여행의 기록',
    text: '낯선 길을 걷다가 우연히 만난 풍경이 오래 마음에 남았어. 언젠가 이 여행을 떠올렸을 때, 오늘 느낀 설렘과 행복이 다시 생각났으면 좋겠어.',
    jeju: '낯선 질 걷단 우연히 만난 풍경이 오래 ᄆᆞ음에 남앗어. 어느제 이 여행 셍각ᄒᆞᆯ 때, 오늘 느낀 설렘이영 행복이 ᄐᆞ시 셍각나시민 좋으키여.' }],
  12: [{ to: '생일 축하',
    text: '태어나 줘서 고마워, 생일 진심으로 축하해! 오늘 하루가 너에게 오래도록 기억될 행복한 날이길 바라.',
    jeju: '태어나 주난 고마워, 생일 진심으로 축하ᄒᆞ여! 오늘 ᄒᆞ루가 느안티 오래오래 기억될 행복ᄒᆞᆫ 날이 되민 좋으키여.' }],
  13: [{ to: '위로하고 싶은 사람에게',
    text: '매일 괜찮을 필요는 없어. 힘든 날에는 잠시 쉬어가도 괜찮으니까, 너무 애쓰지 않았으면 좋겠어. 언제나 네 편이 되어줄게.',
    jeju: '날마다 괜찮을 필요는 엇어. 심든 날엔 ᄌᆞᆷ시 쉬어가도 괜찮으난, 너미 애쓰지 말아시민 좋으키여. 어느 때나 느 펜 되어 주크라.' }],
  14: [{ to: '친구에게',
    text: '별것 아닌 일에도 함께 웃을 수 있는 네가 있어서 참 좋아. 앞으로도 우리 재미있는 추억 많이 만들자!',
    jeju: '벨것 아닌 일에도 ᄒᆞᆫ듸 웃을 수 잇는 느가 이시난 막 좋다. 앞으로도 우리 재미난 추억 하영 만들게!' }],
  15: [
    { to: '엄마에게',
      text: '엄마, 늘 내 곁에서 든든한 힘이 되어줘서 고마워. 평소엔 쑥스러워서 말하지 못했지만 많이 사랑해.',
      jeju: '어멍, 늘 나 옆이서 든든ᄒᆞᆫ 심이 되어 주난 고마워. 펭소엔 쑥스러완 말 못 ᄒᆞ엿주마는 하영 ᄉᆞ랑ᄒᆞ여.' },
    { to: '아빠에게',
      text: '아빠, 말로 표현한 적은 별로 없지만 항상 고마운 마음이야. 묵묵히 내 편이 되어주는 아빠가 있어 참 든든해.',
      jeju: '아방, 말로 ᄀᆞᆯ아 본 적은 벨로 엇주마는 ᄒᆞᆼ상 고마운 ᄆᆞ음이라. 묵묵히 나 펜 되어 주는 아방이 이시난 ᄎᆞᆷ 든든ᄒᆞ다.' },
  ],
};
const ALL_TEMPLATES = Object.values(CARD_TEMPLATES).flat();
const TEMPLATE_JEJU = Object.fromEntries(ALL_TEMPLATES.map((t) => [t.text, t.jeju]));
const TEMPLATE_TOS = new Set(ALL_TEMPLATES.map((t) => t.to));
const isTemplateText = (text) => ALL_TEMPLATES.some((t) => t.text === text.trim());

const mobileTo = document.getElementById('mobileTo');
const templateRow = document.querySelector('.letter-templates');
const templateList = document.getElementById('templateList');
let templateChips = [];
const cardToBox = document.querySelector('#card .card-to');
const syncToScale = () => requestAnimationFrame(() => fitToField(cardToBox, cardTo.value));
mobileTo.addEventListener('input', syncToScale);
cardTo.addEventListener('input', syncToScale);

function markTemplate() {
  const now = mobileMessage.value.trim();
  templateChips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.text === now)));
}

// 직접 쓴 글이 있을 때 템플릿 단추를 누르면: 묻지 않고 바로 바꾸고, 아래에 '방금 쓴 글로 되돌리기'를 8초 동안 보여 줌
const templateUndo = document.getElementById('templateUndo');
let undo = null;   // { to, text }
let undoTimer = null;

function hideTemplateUndo() {
  clearTimeout(undoTimer);
  templateUndo.hidden = true;
  undo = null;
}

function writeField(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));   // 엽서에도 옮김
}

function writeTemplate(t) {
  writeField(mobileTo, t.to);
  writeField(mobileMessage, t.text);
  markTemplate();
}

// 지금 칸에 사람이 직접 쓴 글이 있는지 (비었거나 템플릿 글 그대로면 아님)
const hasOwnText = () => {
  const text = mobileMessage.value.trim();
  const to = mobileTo.value.trim();
  return (text && !isTemplateText(text)) || (to && !TEMPLATE_TOS.has(to));
};

// 엽서를 바꿀 때: 직접 쓴 글이 없으면 그 엽서 글로 바로 채우고, 엽서 아래 단추 줄에 그 엽서의 글을 보여 줌
function onCardTemplate(index) {
  const list = CARD_TEMPLATES[index] || [];
  const own = hasOwnText();
  if (list.length && !own && !writingOwn && !list.some((t) => t.text === mobileMessage.value.trim())) writeTemplate(list[0]);
  templateList.textContent = '';
  templateChips = list.map((t) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'template-chip';
    chip.dataset.text = t.text;
    chip.textContent = t.to;
    chip.addEventListener('click', () => {
      // 이미 고른 글 단추를 다시 누르면 그 글(To · 편지)을 지워 빈칸으로. 이때부터는 엽서를 바꿔도 템플릿 글이 다시 써지지 않음
      if (chip.getAttribute('aria-pressed') === 'true') {
        writingOwn = true;
        hideTemplateUndo();
        writeField(mobileMessage, '');
        if (mobileTo.value.trim() === t.to) writeField(mobileTo, '');
        markTemplate();
        return;
      }
      if (hasOwnText() && !undo) undo = { to: mobileTo.value, text: mobileMessage.value };   // 처음 직접 쓴 글을 기억
      writeTemplate(t);
      if (undo) {
        templateUndo.hidden = false;
        clearTimeout(undoTimer);
        undoTimer = setTimeout(hideTemplateUndo, 8000);
      }
    });
    templateList.appendChild(chip);
    return chip;
  });
  templateRow.hidden = !list.length;   // 템플릿이 있는 엽서는 늘 보임 (내 사진 칸은 없음)
  markTemplate();
}
onCardChange = onCardTemplate;
onCardTemplate(currentCard);   // 첫 엽서(해녀 바다)의 글로 시작

document.getElementById('templateUndoBtn').addEventListener('click', () => {
  const back = undo;
  hideTemplateUndo();
  if (!back) return;
  writeField(mobileTo, back.to);
  writeField(mobileMessage, back.text);
  markTemplate();
  mobileMessage.focus({ preventScroll: true });
});

mobileMessage.addEventListener('input', (e) => {
  markTemplate();
  if (e.isTrusted) hideTemplateUndo();   // 손으로 고쳐 쓰기 시작하면 되돌리기는 숨김
});
cardMessage.addEventListener('input', () => requestAnimationFrame(markTemplate));

// 하고 싶은 말 글자 수 (최대 144자, 칸 오른쪽 아래 'N/144자') — v7.11: 하영 손글씨로 엽서 한 줄에 한글 18자 × 8줄 = 144자.
// 띄어쓰기 · 문장부호가 섞이면 더 들어가지만(보통 문장 약 177자) 한글만 이어 써도 잘리지 않게 144자로 둠
const messageCount = document.querySelector('#messageCount b');
const updateMessageCount = () => { messageCount.textContent = graphemes(mobileMessage.value).length; };
mobileMessage.addEventListener('input', updateMessageCount);
cardMessage.addEventListener('input', () => requestAnimationFrame(updateMessageCount));
requestAnimationFrame(updateMessageCount);

const writingBox = () => (narrowScreen.matches ? mobileMessage : cardMessage);

// ---------- 제주어로 번역 → 2단계 '제주어로 변환하기' 페이지 ----------
// 번역 규칙과 사전은 translate.js / jeju-dict.js
// 엽서 쓰기 화면의 '제주어로 번역'을 누르면 표준어 편지와 제주어 편지를 나란히 보여 주는 페이지로 감.
// 두 편지 모두 고칠 수 있고, 가운데 버튼으로 다시 바꿈. '이 편지로 보내기'를 누르면 제주어 편지를 엽서에 담아 보내기를 엶

const translateBtn = document.getElementById('translateBtn');
const writePanelEl = document.getElementById('writePanel');
const boardSection = document.getElementById('boardSection');
const translatePage = document.getElementById('translatePage');
const trStandard = document.getElementById('trStandard');
const trJeju = document.getElementById('trJeju');
const trNote = document.getElementById('trNote');
const trStatus = document.getElementById('trStatus');
const trJejuCard = trJeju.closest('.tr-card');

// ---------- 보낼 수 없는 말 검사 (목록은 badwords.js) ----------
// 욕설 · 성적인 말 · 혐오 표현이 있으면 '이 편지로 보내기'와 모든 보내기 버튼에서 막음
const BAD_WORD_MESSAGE = '고운 말로 써 주세요. 욕설이나 야한 말, 남을 깎아내리는 말이 들어간 엽서는 보낼 수 없어요.';

function badWordIn(...texts) {
  if (!window.findBadWord) return null;
  return texts.map((t) => window.findBadWord(t)).find(Boolean) || null;
}

const cardHasBadWord = () => badWordIn(cardMessage.value, cardTo.value, cardFrom.value);

const TR_NOTE = '「개정증보 제주어사전」을 바탕으로 한 참고용 번역이에요. 어색한 곳은 고쳐도 돼요.';

// 지금 편지의 두 모습. 엽서에 제주어 편지를 담은 뒤 글을 고치지 않았으면 그대로 다시 보여 줌
let letter = { standard: '', jeju: '' };

// ---------- 제주 동화 한 편: 화면 단위 ----------
// 이야기(flow): SCENE 01~02. 화면이 멈춘 채(sticky) 스크롤에 맞춰 카메라가 움직이고(아래 '동화 장면'),
//   종이 한 장이 동화 위로 밀려 올라오며 엽서 고르기 + 마음 쓰기 (한 화면).
//   여기서부터는 버튼을 누를 때마다 화면이 통째로 바뀜 (앞 화면 내용은 보이지 않음):
//   '제주어로 바꾸기' → 보내기(send: 제주어 엽서에 우표 · 소인, 제주어 편지 고치기는 펼쳐서) → 보내기를 마치면 엔딩(end)
// 게시판(board): 따로 보는 화면
// 화면을 바꿀 때마다 브라우저 기록을 쌓아 휴대폰 뒤로 가기 · 뒤로 버튼으로 한 화면씩 돌아옴. 화면마다 보던 자리를 기억함
const scene2 = document.getElementById('scene2');
const secSend = document.getElementById('secSend');
const ending = document.getElementById('ending');
const floatCta = document.getElementById('floatCta');
const SECTIONS = { pick: scene2, translate: translatePage, send: secSend };
const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const smoothScroll = () => (calmMotion.matches ? 'auto' : 'smooth');
const storyPage = document.getElementById('storyPage');
const PAGES = {
  flow: storyPage,
  send: document.getElementById('pageSend'),
  end: document.getElementById('pageEnd'),
};
const BACK_OF = { send: 'flow', end: 'send' };   // 뒤로 가면 갈 화면
let view = 'flow';
let stepDepth = 0;                                  // 이 사이트 안에서 쌓은 기록 수
const scrollMemory = { flow: 0, send: 0, end: 0, board: 0 };  // 화면마다 보던 자리 ('pick' = 엽서 고르기, 'write' = 마음 쓰기)

function openSec(name) {
  SECTIONS[name].hidden = false;
}

// 다시 닫음 (보내기를 닫으면 소인 · 엔딩도 지움)
function closeSec(name) {
  if (name === 'send') {
    closeSend();
    clearStamp();
    ending.hidden = true;
  }
  SECTIONS[name].hidden = true;
}

function renderView(next) {
  // 닫힌 화면으로 (앞으로 가기 등) 오면 열려 있는 앞 화면으로
  if (next === 'end' && ending.hidden) next = 'send';
  if (next === 'send' && secSend.hidden) next = 'flow';
  if (view !== next) scrollMemory[view] = window.scrollY;
  view = next;
  document.body.dataset.view = next;
  hy('pc_view', { view: next });   // v7.11 성과 측정: 어느 화면을 열었는지(머문 시간은 track.js 가 화면마다 잰다)
  writePanelEl.hidden = next === 'board';
  Object.entries(PAGES).forEach(([name, el]) => { el.hidden = name !== next; });
  boardSection.hidden = next !== 'board';
  if (next === 'flow' && jejuApplied) backToStandard();   // 쓰는 곳은 늘 평소 말로
  let y = scrollMemory[next] || 0;
  if (y === 'pick') y = scene2.getBoundingClientRect().top + window.scrollY;
  if (y === 'write') {
    openWriter();   // 편지 쓰는 자리로 돌아올 때는 쓰는 칸을 열어 둠
    y = writerPanel.getBoundingClientRect().top + window.scrollY - 90;
  }
  window.scrollTo(0, y);
  updateFloatCta();
  if (next === 'flow') {
    scrollToSlot(centerSlot, 'instant');   // 숨어 있던 띠를 지금 그림에 맞춰 다시 놓음
    measureStory();
    requestStory();
  }
}

// 다음 페이지로 (기록을 하나 쌓음). fresh면 그 페이지 맨 위부터
function goView(next, fresh = false) {
  if (view === next) return;
  scrollMemory[view] = window.scrollY;
  if (fresh) scrollMemory[next] = 0;
  stepDepth += 1;
  history.pushState({ view: next, depth: stepDepth }, '');
  renderView(next);
}

// 앞 페이지로 (사이트 안에서 쌓은 기록이 있으면 브라우저 뒤로 가기와 똑같이)
function backView(fallback) {
  if (stepDepth > 0) history.back();
  else renderView(fallback);
}

// 쓰는 곳으로 돌아오면 엽서 글을 평소 말(표준어)로 되돌림. 제주어 편지는 기억해 두었다가 같은 글이면 다시 씀
function backToStandard() {
  if (putOnCard(trStandard.value)) letter.standard = trStandard.value;
  setTranslated(false);
  hideEditAlert();
  closeSec('send');
}

const goBoard = () => goView('board', true);
const leaveBoard = () => backView('flow');

window.addEventListener('popstate', (e) => {
  const state = e.state || {};
  stepDepth = state.depth || 0;
  renderView(state.view || 'flow');
});

// 제주어로 바꾼 상태: 쓰기 칸 대신 표준어 · 제주어 두 편지를 보여 주고, 엽서 글은 제주어 편지 칸에서만 고침
function setTranslated(on) {
  jejuApplied = on;
  scene2.classList.toggle('is-translated', on);
  cardMessage.readOnly = on;
}

// 엽서 위로 제주 바람이 한 번 스침. 바람이 지나가는 한가운데에서 글을 바꿈
const writeCard = document.getElementById('writeCard');
function playWind(midway) {
  if (calmMotion.matches) {
    midway();
    return;
  }
  writeCard.classList.remove('is-windy');
  void writeCard.offsetWidth;
  writeCard.classList.add('is-windy');
  setTimeout(midway, 520);
  setTimeout(() => writeCard.classList.remove('is-windy'), 1500);
}

function setTrStatus(text, warning) {
  trStatus.textContent = text;
  trStatus.classList.toggle('is-warning', !!warning);
}

// 편지 칸은 글 길이만큼 줄 단위로 늘어나서 안에서 따로 스크롤하지 않게 (엽서처럼 최소 8줄, 휴대폰은 5줄)
function fitHeight(el) {
  const line = parseFloat(getComputedStyle(el).lineHeight) || 38;
  const minLines = narrowScreen.matches ? 5 : 8;
  el.style.height = 'auto';
  el.style.height = `${Math.max(minLines, Math.ceil((el.scrollHeight - 1) / line)) * line}px`;
}

function fitTrTexts() {
  fitHeight(trStandard);
  fitHeight(trJeju);
}

// 화면 폭이 바뀌면 줄 바꿈도 바뀌므로 다시 맞춤
window.addEventListener('resize', () => { if (!translatePage.hidden) fitTrTexts(); });

// 표준어를 고친 뒤 아직 다시 바꾸지 않은 상태
function markStale(stale) {
  trJejuCard.classList.toggle('is-stale', stale);
  trNote.classList.toggle('is-warning', stale);
}

// 두 편지에 엽서의 받는 사람·보내는 사람·날짜를 똑같이 적음
function fillPaperInfo() {
  translatePage.querySelectorAll('[data-name="to"]').forEach((el) => { el.textContent = cardTo.value.trim(); });
  translatePage.querySelectorAll('[data-name="from"]').forEach((el) => { el.textContent = cardFrom.value.trim(); });
  translatePage.querySelectorAll('.tr-date').forEach((el) => { el.textContent = TODAY; });
}

function convertLetter() {
  letter.standard = trStandard.value;
  // 템플릿 글을 그대로 쓰면 미리 다듬어 둔 제주어 문장을, 아니면 번역 규칙으로
  letter.jeju = TEMPLATE_JEJU[letter.standard.trim()] || window.translateToJeju(letter.standard);
  trJeju.value = letter.jeju;
  markStale(false);
  fitHeight(trJeju);
  trNote.textContent = letter.jeju === letter.standard
    ? '바꿀 수 있는 제주어를 찾지 못했어요. 그대로 보내도 괜찮아요.'
    : TR_NOTE;
}

translateBtn.addEventListener('click', () => {
  const text = cardMessage.value;
  if (!text.trim()) {
    setStatus('먼저 엽서에 마음을 적어 주세요.', true);
    goWriteField('mobileMessage');
    return;
  }
  setStatus('');
  setTrStatus('');
  const reuse = letter.jeju && (text === letter.standard || (jejuApplied && text === letter.jeju));
  trStandard.value = jejuApplied && text === letter.jeju ? letter.standard : text;
  fillPaperInfo();
  if (reuse) {
    trJeju.value = letter.jeju;
    markStale(false);
    trNote.textContent = TR_NOTE;
  } else {
    convertLetter();
  }
  closeSec('send');
  translateBtn.disabled = true;
  playWind(() => {
    translateBtn.disabled = false;
    openSec('translate');
    jejuEditor.hidden = true;
    jejuEditBtn.setAttribute('aria-expanded', 'false');
    // 바뀐 제주어 편지를 엽서에 담고 바로 보내기 화면으로 (8줄을 넘거나 보낼 수 없는 말이면 여기 머묾)
    const problem = jejuProblem();
    if (problem) {
      setStatus(problem, true);
      return;
    }
    putOnCard(trJeju.value);
    setTranslated(true);
    letter = { standard: trStandard.value, jeju: trJeju.value };
    editAlertDismissed = false;
    hideEditAlert();
    showFinalCard();
  });
});

// 제주어 엽서로 만들 수 없는 까닭 (없으면 빈 값)
function jejuProblem() {
  if (!trJeju.value.trim()) return '제주어 편지가 비어 있어요.';
  if (badWordIn(trJeju.value, trStandard.value, cardTo.value, cardFrom.value)) return BAD_WORD_MESSAGE;
  const before = cardMessage.value;
  const fits = putOnCard(trJeju.value);
  putOnCard(before);
  return fits ? '' : '제주어로 바꾸니 엽서 8줄을 넘어가요. 편지를 조금 줄여 주세요.';
}

// 보내기 화면의 '제주어 편지 고치기': 펼치면 표준어 · 제주어 두 편지 (고치면 엽서에 바로 반영)
const jejuEditor = document.getElementById('jejuEditor');
const jejuEditBtn = document.getElementById('jejuEditBtn');
jejuEditBtn.addEventListener('click', () => {
  const open = jejuEditor.hidden;
  jejuEditor.hidden = !open;
  jejuEditBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    fitTrTexts();
    jejuEditor.scrollIntoView({ behavior: smoothScroll(), block: 'start' });
  }
});

// 보내기 화면의 완성 엽서 그림을 지금 글로 다시 그림 (우표 · 소인은 그 위에 그대로)
let refreshTimer = null;
function refreshFinal() {
  if (secSend.hidden) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const was = stamped;
    stamped = false;
    try {
      finalImage.src = (await renderCard()).toDataURL('image/jpeg', 0.9);
    } finally {
      stamped = was;
    }
  }, 350);
}

// 제주어 편지를 엽서에 담음 (엽서 8줄을 넘으면 알려 주고 엽서는 그대로)
function applyJeju() {
  if (putOnCard(trJeju.value)) {
    setTrStatus('');
    return true;
  }
  setTrStatus('제주어로 바꾼 편지가 엽서 8줄을 넘어가요. 아래 제주어 편지를 조금 줄여 주세요.', true);
  return false;
}

// 가운데 버튼: 지금 표준어 편지를 다시 제주어로
const trConvert = document.getElementById('trConvert');
trConvert.addEventListener('click', () => {
  if (!trStandard.value.trim()) {
    setTrStatus('표준어 편지가 비어 있어요.', true);
    trStandard.focus();
    return;
  }
  setTrStatus('');
  convertLetter();
  if (applyJeju()) letter.jeju = trJeju.value;
  refreshFinal();
  const paper = trJeju.closest('.tr-paper');   // 제주어 편지 칸에 글이 새로 맺힘
  paper.classList.remove('is-renewed');
  void paper.offsetWidth;
  paper.classList.add('is-renewed');
  trConvert.classList.remove('is-spinning');
  void trConvert.offsetWidth;
  trConvert.classList.add('is-spinning');
});

// 표준어 편지를 고치면 제주어 결과는 아직 예전 글이라고 알려 줌
trStandard.addEventListener('input', () => {
  fitHeight(trStandard);
  if (trStandard.value !== letter.standard) {
    markStale(true);
    trNote.textContent = '원래 편지를 고쳤어요. ‘원래 편지로 다시 바꾸기’를 누르면 제주어 편지도 바뀌어요.';
  }
});

// 제주어 편지를 고치면 엽서와 보내기 화면의 완성 엽서에도 바로
trJeju.addEventListener('input', () => {
  letter.jeju = trJeju.value;
  fitHeight(trJeju);
  applyJeju();
  refreshFinal();
});

// 엽서에 글을 담아 보고, 엽서 8줄을 넘으면 되돌림.
// 2단계 페이지에 있을 때는 엽서가 숨어 있어 높이를 잴 수 없으므로 잠깐 펼쳐서 잼 (화면에는 안 보임)
function putOnCard(text) {
  const before = cardMessage.value;
  const wasHidden = [writePanelEl.hidden, storyPage.hidden];
  writePanelEl.hidden = false;
  storyPage.hidden = false;
  cardMessage.value = text;
  const overflow = cardMessage.scrollHeight > cardMessage.clientHeight;
  [writePanelEl.hidden, storyPage.hidden] = wasHidden;
  if (overflow) {
    cardMessage.value = before;
    return false;
  }
  syncMobile();
  return true;
}

// 엽서 다시 쓰기: 고친 표준어 편지를 엽서에 담고 돌아감
document.getElementById('trBack').addEventListener('click', () => {
  if (!putOnCard(trStandard.value)) {
    setTrStatus('표준어 편지가 엽서 8줄을 넘어가요. 조금 줄여 주세요.', true);
    trStandard.focus();
    return;
  }
  letter.standard = trStandard.value;
  jejuApplied = false;
  hideEditAlert();
  closeSec('send');
  closeSec('translate');
  setTranslated(false);
  scrollMemory.flow = 'write';
  backView('flow');
});

// ---------- 보내기 소인 ----------
// 엽서 그림에 원래 인쇄돼 있던 소인은 지워 두고(_tools/clean_card_postmark.py),
// '이 편지로 보내기'를 누르면 같은 자리에 '하영고라보게' 소인이 꾹 찍힘. 글을 고치거나 뒤로 가면 지움.
// 소인은 이미지로 저장할 때도 같은 자리에 찍힘 (renderCard)

const cardEl = document.getElementById('card');
const cardStamp = document.getElementById('cardStamp');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let stamped = false;

function stampCard() {
  stamped = true;
  cardStamp.hidden = false;
  cardStamp.classList.remove('is-stamping');
  cardEl.classList.remove('is-thud');
  void cardStamp.offsetWidth;   // 움직임을 처음부터 다시
  cardStamp.classList.add('is-stamping');
  cardEl.classList.add('is-thud');
}

function clearStamp() {
  stamped = false;
  cardStamp.hidden = true;
  cardStamp.classList.remove('is-stamping');
  cardEl.classList.remove('is-thud');
}

cardMessage.addEventListener('input', clearStamp);

// 받는 사람 · 보내는 사람을 고쳐도 완성 엽서가 바뀌므로 보내기를 다시 닫음
[cardMessage, cardTo, cardFrom].forEach((el) => {
  el.addEventListener('input', () => { if (!secSend.hidden) closeSec('send'); });
});

// SCENE 04: 소인 없이 그린 완성 엽서를 보여 주고, 화면에 들어오면 귤 우표 → 하영고라보게 소인이 차례로 찍힘.
// 저장 · 공유하는 그림에는 우표와 소인이 함께 그려짐 (renderCard의 stamped)
const finalCard = document.getElementById('finalCard');
const finalImage = document.getElementById('finalImage');

// v7.16: 돋보기('편지 다시 쓰기' 오른쪽) — 제주어로 바뀐 엽서의 편지 부분(엽서 그림의 오른쪽 반)을 화면에 크게
const letterZoom = document.getElementById('letterZoom');
const letterZoomCanvas = document.getElementById('letterZoomCanvas');
document.getElementById('letterZoomBtn').addEventListener('click', async () => {
  try { await finalImage.decode(); } catch (e) { /* 이미 그려져 있음 */ }
  const w = finalImage.naturalWidth;
  const h = finalImage.naturalHeight;
  if (!w || !h) return;
  const sx = Math.round(w / 2);
  letterZoomCanvas.width = w - sx;
  letterZoomCanvas.height = h;
  letterZoomCanvas.getContext('2d').drawImage(finalImage, sx, 0, w - sx, h, 0, 0, w - sx, h);
  letterZoom.showModal();
  hy('pc_letter_zoom', {});
});
document.getElementById('letterZoomClose').addEventListener('click', () => letterZoom.close());
letterZoom.addEventListener('click', (e) => { if (e.target === letterZoom) letterZoom.close(); });   // 바깥(어두운 곳)을 눌러도 닫힘

async function showFinalCard() {
  const trNextBtn = document.getElementById('trNext');
  trNextBtn.disabled = true;
  try {
    stamped = false;
    const canvas = await renderCard();
    finalImage.src = canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    trNextBtn.disabled = false;
  }
  stamped = true;   // 이제부터 저장 · 공유 그림에는 우표와 소인이 찍힘
  ending.hidden = true;
  finalCard.classList.remove('is-stamping', 'is-stamped');
  finalCard.dataset.pending = '1';
  openSec('send');
  if (!sendPanel.open) openSend();
  if (view === 'send') {
    // 다시 찍으면 고치기 칸은 접어서 엽서 바로 아래 보내기 아이콘이 보이게
    jejuEditor.hidden = true;
    jejuEditBtn.setAttribute('aria-expanded', 'false');
    delete finalCard.dataset.pending;
    void finalCard.offsetWidth;
    finalCard.classList.add(calmMotion.matches ? 'is-stamped' : 'is-stamping');
    finalCard.scrollIntoView({ behavior: smoothScroll(), block: 'center' });
  } else {
    goView('send', true);
    document.getElementById('sendSecTitle').focus({ preventScroll: true });
  }
}

const stampWatch = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting || !finalCard.dataset.pending) return;
    delete finalCard.dataset.pending;
    finalCard.classList.add(calmMotion.matches ? 'is-stamped' : 'is-stamping');
  });
}, { threshold: 0.6 }) : null;
if (stampWatch) stampWatch.observe(finalCard);
else finalCard.classList.add('is-stamped');

// 고친 편지로 엽서 다시 찍기: 제주어 편지를 엽서에 담고 우표 · 소인을 다시 찍음
document.getElementById('trNext').addEventListener('click', () => {
  if (!trJeju.value.trim()) {
    setTrStatus('제주어 편지가 비어 있어요. ‘원래 편지로 다시 바꾸기’를 눌러 주세요.', true);
    return;
  }
  if (badWordIn(trJeju.value, trStandard.value, cardTo.value, cardFrom.value)) {
    setTrStatus(BAD_WORD_MESSAGE, true);
    return;
  }
  if (!putOnCard(trJeju.value)) {
    setTrStatus('제주어로 바꾼 편지가 엽서 8줄을 넘어가요. 조금 줄여 주세요.', true);
    trJeju.focus();
    return;
  }
  letter = { standard: trStandard.value, jeju: trJeju.value };
  jejuApplied = true;
  editAlertDismissed = false;
  hideEditAlert();
  showFinalCard();
});

// ---------- 고친 글 알림 ----------
// 제주어로 바꾼 뒤나 엽서 보내기를 연 뒤에 글을 고치면, 고친 부분은 제주어로 저절로 바뀌지 않음.
// 처음 고칠 때 알려 주고, 그 자리에서 바로 다시 바꿀 수 있게 함. '이대로 둘게요'를 누르면
// 다음에 제주어로 바꿀 때까지는 다시 띄우지 않음

const editAlert = document.getElementById('editAlert');
let jejuApplied = false;          // 지금 엽서 글이 제주어로 바꾼 상태에서 출발했는지
let editAlertDismissed = false;

function showEditAlert() {
  if (!editAlertDismissed) editAlert.hidden = false;
}

function hideEditAlert() {
  editAlert.hidden = true;
}

cardMessage.addEventListener('input', () => {
  if (jejuApplied || sendPanel.open) showEditAlert();
});

// 고친 글은 새 표준어 편지가 되어, 누르면 2단계 페이지에서 다시 바꿈
document.getElementById('editAlertTranslate').addEventListener('click', () => translateBtn.click());

document.getElementById('editAlertDismiss').addEventListener('click', () => {
  editAlertDismissed = true;
  hideEditAlert();
});

// ---------- 쓴 날짜 (yyyy.mm.dd) ----------

function formatDate(d) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY = formatDate(new Date());
document.getElementById('cardDate').textContent = TODAY;

// ---------- 엽서를 이미지로 그리기 (저장·공유·메일 공통) ----------
// 글자 자리는 style.css의 .card-message / .card-to / .card-from 과 같은 값 (1920×1280 기준)

const CARD_W = 1920;
const CARD_H = 1280;
const LINE = 92;                       // 엽서 줄 간격
const FONT_PX = CARD_H * 0.038;        // style.css의 font-size: 3.8cqh
const LETTER_FAMILY = '"Hayeong Hand", "NanumMyeongjo YetHangul", "Malgun Gothic", "Apple SD Gothic Neo", serif';   // v7.11: 엽서 글씨 = 하영 손글씨 (style.css의 --letter-font)
const FONT = `${FONT_PX}px ${LETTER_FAMILY}`;
const SPOTS = {
  message: { x: 1064, top: 313, width: 727, lines: 8 },
  to: { x: 1130, top: 221, width: 560 },   // 줄인 우표(1704) 앞까지 — 긴 To도 편지 글과 같은 크기로. 이보다 길면 글자를 줄임 (toScale)
  from: { x: 1405, top: 1049, width: 270 },
  date: { x: 1064, top: 1049 },            // style.css의 .card-date (글자는 3.1cqh)
};

// 원래 엽서에 인쇄돼 있던 소인과 같은 자리·크기 (style.css의 .card-stamp)
const STAMP = { left: 0.8266, top: 0.0699, size: 0.1434, angle: 0 };   // 우표를 75%로 줄이며 소인도 같은 비율로
// 귤 우표: 엽서 그림에 인쇄된 우표(1662,90 ~ 1846,334)를 덮는 자리

// 긴 To(예: 사과하고 싶은 사람에게)는 소인 앞까지 들어가게 글자 크기를 줄임: 1 = 그대로, 0.7 = 70%
const measureCtx = document.createElement('canvas').getContext('2d');
function toScale(text) {
  measureCtx.font = FONT;
  const w = measureCtx.measureText(text || '').width;
  return w > SPOTS.to.width ? Math.max(0.5, SPOTS.to.width / w) : 1;
}
// 엽서 · 작은 엽서의 To 칸에도 같은 비율 (style.css의 --to-scale)
function fitToField(el, text) {
  if (el) el.style.setProperty('--to-scale', toScale(text).toFixed(3));
}

const segmenter = window.Intl && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s));

// 화면의 textarea처럼 글자 단위로 줄을 나눔 (아래아 ᄒᆞ 같은 조합 글자는 쪼개지 않음)
function wrapLines(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const g of graphemes(paragraph)) {
      if (ctx.measureText(line + g).width > width && line) {
        lines.push(line);
        line = g === ' ' ? '' : g;
      } else {
        line += g;
      }
    }
    lines.push(line);
  }
  return lines;
}

// 내 사진을 그림 자리(가로:세로 = 960:1280)에 사용자가 맞춘 크기 · 위치(photoView)대로 잘라 그림
// (화면 캔버스 · 저장 그림 · 게시판 작은 사진 모두 같은 비율이라 같은 부분이 보임)
function drawCover(ctx, img, width, height) {
  const { sx, sy, sw, sh } = photoWindow(img, width, height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

async function renderCard() {
  const text = cardMessage.value + cardTo.value + cardFrom.value;
  try { await document.fonts.load(`${FONT_PX}px "Hayeong Hand"`, text || '가'); } catch (e) { /* 기본 글꼴로 그림 */ }
  if (!cardImage.complete) await cardImage.decode();

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cardImage, 0, 0, CARD_W, CARD_H);
  if (photoActive) drawCover(ctx, cardPhoto, PHOTO_W, CARD_H);
  ctx.font = FONT;
  ctx.fillStyle = '#2f2a22';
  ctx.textBaseline = 'alphabetic';

  // CSS 줄 상자처럼 줄 간격 한가운데에 글자를 놓음
  const m = ctx.measureText('가');
  const ascent = m.fontBoundingBoxAscent || FONT_PX * 0.8;
  const descent = m.fontBoundingBoxDescent || FONT_PX * 0.2;
  const baseline = (LINE - (ascent + descent)) / 2 + ascent;

  const lines = wrapLines(ctx, cardMessage.value, SPOTS.message.width).slice(0, SPOTS.message.lines);
  lines.forEach((line, i) => ctx.fillText(line, SPOTS.message.x, SPOTS.message.top + i * LINE + baseline));
  const toFit = toScale(cardTo.value);
  if (toFit < 1) ctx.font = FONT.replace(`${FONT_PX}px`, `${FONT_PX * toFit}px`);
  ctx.fillText(cardTo.value, SPOTS.to.x, SPOTS.to.top + baseline, SPOTS.to.width);
  ctx.font = FONT;
  ctx.fillText(cardFrom.value, SPOTS.from.x, SPOTS.from.top + baseline, SPOTS.from.width);

  // 날짜는 조금 작고 옅게
  const DATE_PX = CARD_H * 0.031;
  ctx.font = `${DATE_PX}px ${LETTER_FAMILY}`;
  ctx.fillStyle = '#6f6455';
  const dm = ctx.measureText('0');
  const dAscent = dm.fontBoundingBoxAscent || DATE_PX * 0.8;
  const dDescent = dm.fontBoundingBoxDescent || DATE_PX * 0.2;
  ctx.fillText(TODAY, SPOTS.date.x, SPOTS.date.top + (LINE - (dAscent + dDescent)) / 2 + dAscent);

  // 우표는 엽서 그림(card-01~12)에 인쇄된 감귤 우표(R.P. ROMÎNA · CITRUS UNSHIU)를 그대로 씀 → 그 위에 보내기 소인
  // 보내기 소인 (style.css의 .card-stamp와 같은 자리·크기)
  if (stamped) {
    const ink = cardStamp;
    if (!ink.complete) await ink.decode();
    const size = CARD_H * STAMP.size;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(CARD_W * STAMP.left + size / 2, CARD_H * STAMP.top + size / 2);
    ctx.rotate((STAMP.angle * Math.PI) / 180);
    ctx.drawImage(ink, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  return canvas;
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
const FILE_NAME = '제주어-엽서.png';

function download(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 엽서 보내기 (저장 / 메일 / 공유) ----------
// 컴퓨터: 엽서 밑 버튼 줄이 보내기 버튼 줄로 바뀜. 휴대폰: 아래에서 올라오는 판

const sendPanel = document.getElementById('sendPanel');
const writePanel = writePanelEl;
const sheetStatus = document.getElementById('sheetStatus');
const mailOption = document.getElementById('mailOption');
const mailForm = document.getElementById('mailForm');
const mailInput = document.getElementById('mailInput');
const mailSubmit = document.getElementById('mailSubmit');

function setSheetStatus(text, warning) {
  sheetStatus.textContent = text;
  sheetStatus.classList.toggle('is-warning', !!warning);
}

const sendHint = document.getElementById('sendHint');

function openSend() {
  sendHint.hidden = jejuApplied || !/[가-힣]/.test(cardMessage.value);
  sendDone.hidden = true;
  viewBoardBtn.hidden = true;
  mailForm.hidden = true;
  mailOption.setAttribute('aria-expanded', 'false');
  setSheetStatus('');
  setStatus('');
  // 보내기를 여는 동안 엽서 고르기 칸과 쓰기 칸은 숨기고 저장 · 공유 · 게시판 버튼만
  writePanel.classList.add('is-sending');
  if (KAKAO_JS_KEY) uploadCardImage().catch(() => {});   // 카카오톡 공유에 쓸 엽서 이미지를 미리 올려 둠
  sendPanel.show();   // 창이 아니라 엽서 아래에 펼쳐지는 버튼 목록
  hy('pc_send_open', { jeju: jejuApplied ? 'yes' : 'no' });   // 제주어로 바꾼 뒤 보내기 화면이 열림
}

function closeSend() {
  if (sendPanel.open) sendPanel.close();   // close 이벤트에서 버튼 줄을 되돌림
}

sendPanel.addEventListener('close', () => {
  writePanel.classList.remove('is-sending');
  document.getElementById('translateTopBtn').focus({ preventScroll: true });
});

// 보내기를 마치면 결과를 알려 주고, 다른 방법으로도 더 보낼 수 있게 버튼 목록은 그대로 둠
const sendDone = document.getElementById('sendDone');
const viewBoardBtn = document.getElementById('viewBoardBtn');

// 보낸 뒤에도 다른 화면으로 넘어가지 않고 이 보내기 화면에 그대로 머묾 (엔딩 · '새 엽서 쓰기'는 쓰지 않음).
// 다시 쓰려면 '← 편지 다시 쓰기'로 돌아감
function finishSend(text, method = '') {
  setSheetStatus(text || '보냈어요!');
  hy('pc_send_done', { method });   // v7.11 성과 측정: 어떤 방법으로 보냈는지(track.js)
}

// 엔딩: 편지가 제주 바람을 타고 하늘로 날아가고, 마지막 문장과 로고. 보낸 뒤 한 번만 저절로 내려감
function showEnding() {
  if (!ending.hidden) return;
  ending.hidden = false;
  setTimeout(() => {
    ending.classList.remove('is-playing');
    void ending.offsetWidth;
    ending.classList.add('is-playing');
    goView('end', true);
  }, 900);
}

document.getElementById('endNewBtn').addEventListener('click', () => document.getElementById('newCardBtn').click());
document.getElementById('endMoreBtn').addEventListener('click', () => backView('send'));

// 새 엽서 쓰기: 다 비우고 1단계(그림)로
document.getElementById('newCardBtn').addEventListener('click', () => {
  cardTo.value = '';
  cardFrom.value = '';
  cardMessage.value = '';
  syncMobile();
  letter = { standard: '', jeju: '' };
  jejuApplied = false;
  hideEditAlert();
  closeSend();
  clearStamp();
  setSheetStatus('');
  closeSec('send');
  closeSec('translate');
  setTranslated(false);
  scrollMemory.flow = 'pick';   // 엽서 고르기 자리 (숨어 있는 동안은 잴 수 없어 보인 뒤에 잼)
  if (stepDepth > 0) history.go(-stepDepth);   // 엽서 고르기까지 기록을 되감음
  else renderView('flow');
});

viewBoardBtn.addEventListener('click', goBoard);


// 위로: 소인을 지우고 03 제주어로
document.getElementById('sendBack').addEventListener('click', () => {
  scrollMemory.flow = 'write';
  backView('flow');
});

// 아직 표준어면 2단계 페이지로 가서 바꿈
document.getElementById('sendHintTranslate').addEventListener('click', () => {
  closeSend();
  translateBtn.click();
});

// 펼쳐 둔 버튼 목록은 Esc로 닫히지 않게 (닫히면 4단계 화면이 비어 버림)
sendPanel.addEventListener('cancel', (e) => e.preventDefault());

// 저장
document.getElementById('saveBtn').addEventListener('click', async () => {
  const blob = await toBlob(await renderCard(), 'image/png');
  const file = new File([blob], FILE_NAME, { type: 'image/png' });
  // 휴대폰: 공유 창에서 '이미지 저장'을 누르면 사진첩에 들어감
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      finishSend('엽서 그림을 저장하거나 보냈어요.', 'image_share');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  download(blob);
  finishSend('엽서를 이미지로 저장했어요.', 'image');
});


// ---------- 엽서를 링크에 담기 ----------
// 받는 칸·내용·보내는 칸·엽서 번호를 주소 끝(#p=...)에 담아서, 링크를 연 사람에게 그 엽서를 보여 줌.
// 직접 넣은 사진은 너무 커서 링크에 담지 못함 (그때는 고른 엽서 그림으로 보임)

function currentPost() {
  // standard = 제주어로 바꾸기 전 표준어 글. 엽서 글이 그 제주어 그대로일 때만 담음 (받은 엽서 화면의 '표준어로 보기')
  const standard = jejuApplied && letter.standard && cardMessage.value === letter.jeju && letter.standard !== letter.jeju ? letter.standard : '';
  return { card: currentCard, to: cardTo.value.trim(), message: cardMessage.value, from: cardFrom.value.trim(), date: TODAY, standard };
}

function encodePost(post) {
  const data = { c: post.card, t: post.to, m: post.message, f: post.from, d: post.date };
  if (post.standard) data.s = post.standard;   // 표준어 글 (있을 때만 — 링크가 그만큼 길어짐)
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePost(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const d = JSON.parse(json);
    const card = Number.isInteger(d.c) && d.c >= 0 && d.c < CARDS.length ? d.c : 0;
    const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const date = /^\d{4}\.\d{2}\.\d{2}$/.test(d.d) ? d.d : '';
    return { card, to: text(d.t, 20), message: text(d.m, 400), from: text(d.f, 20), date, standard: text(d.s, 400) };
  } catch (e) {
    return null;
  }
}

function postUrl() {
  return `${location.origin}${location.pathname}#p=${encodePost(currentPost())}`;
}

// 편지 사이트 첫 화면 주소: 받은 사람도 '나도 엽서 쓰기'로 바로 들어올 수 있게 공유할 때 함께 보냄
function siteUrl() {
  return `${location.origin}${location.pathname}`;
}
// v7.14: 웹진 「하영 고라보게」 첫 화면 주소 — 공유할 때 엽서와 함께 보냄(사용자: '웹진 링크도 같이').
// config.js 의 WEBZINE_URL(통합본은 '../' = 같은 사이트의 웹진)을 전체 주소로
const WEBZINE_NAME = '웹진 하영 고라보게';
// v7.17: 카카오톡 · 메일로 보낼 때 엽서 아래에 붙는 한 줄(사용자 — 예전 '제주어로 엽서 적기 · 웹진 하영 고라보게')
// v7.18: 두 문장을 두 줄로(사용자 — 문단 나누기)
const SHARE_LINE = '제주어가 사라지고 있어요.\n사라지지 않게 제주어 엽서를 남겨 보세요.';
function webzineUrl() {
  try { return new URL((window.POSTCARD_CONFIG || {}).WEBZINE_URL || '../', location.href).href; } catch (e) { return ''; }
}
const webzineLine = () => (webzineUrl() ? `\n${WEBZINE_NAME}: ${webzineUrl()}` : '');
// 받는 사람이 보기 편하게: 인사 한 줄 → 엽서(가장 먼저) → 나도 쓰기 → 웹진, 한 줄에 하나씩
const shareText = (postLink) => `제주어 엽서가 도착했어요.\n엽서 보기: ${postLink}\n나도 제주어 엽서 쓰기: ${siteUrl()}${webzineLine()}`;
// 링크 복사: 엽서 링크 + 웹진(짧게)
const linkText = (postLink) => `제주어 엽서가 도착했어요.\n엽서 보기: ${postLink}${webzineLine()}`;

// 지금은 내 컴퓨터(localhost)에서 열고 있어서, 사이트를 인터넷에 올려야 다른 사람도 링크를 열 수 있음
const LOCAL_ONLY = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const LOCAL_NOTE = LOCAL_ONLY ? ' (지금 주소는 이 컴퓨터에서만 열려요. 사이트를 인터넷에 올린 뒤에 다른 사람도 열 수 있어요.)' : '';
const PHOTO_NOTE = () => (photoActive ? ' 내 사진은 링크에 담기지 않아서 고른 엽서 그림으로 보여요.' : '');

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // 클립보드 권한이 없을 때를 대비한 옛 방식
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

// URL 복사
document.getElementById('copyLinkBtn').addEventListener('click', async () => {
  if (cardHasBadWord()) { setSheetStatus(BAD_WORD_MESSAGE, true); return; }
  if (await copyText(linkText(postUrl()))) {
    finishSend('엽서 링크와 웹진 주소를 복사했어요. 받는 사람에게 붙여 넣어 보내 주세요.' + PHOTO_NOTE() + LOCAL_NOTE, 'link');
  } else {
    setSheetStatus('링크를 복사하지 못했어요. 다시 눌러 주세요.', true);
  }
});

// 카카오톡으로 전송하기
// config.js에 카카오 JavaScript 키를 넣으면 카카오톡 공유 창이 열려 친구를 고르고 보낼 수 있음.
// 메시지에는 지금 엽서를 그린 이미지(제주어 편지 + 소인)가 들어가고, 카드 · '엽서 보기'를 누르면 이 사이트에서 그 엽서가,
// '웹진 보러 가기'를 누르면 웹진 「하영 고라보게」 첫 화면이 열림(v7.14).
// 엽서 이미지는 카카오 서버에 올려서 씀(Kakao.Share.uploadImage) → 사이트를 아직 인터넷에 안 올렸어도 이미지는 보임.
// 키가 없을 때는 휴대폰 공유 창(카카오톡 선택 가능)이나 링크 복사로 대신함
const KAKAO_JS_KEY = ((window.POSTCARD_CONFIG || {}).KAKAO_JS_KEY || '').trim();
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}

let kakaoLoading = null;
function kakao() {
  if (!kakaoLoading) {
    kakaoLoading = loadScript(KAKAO_SDK).then(() => {
      if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
      return window.Kakao;
    });
    kakaoLoading.catch(() => { kakaoLoading = null; });
  }
  return kakaoLoading;
}

// 엽서 이미지를 카카오 서버에 올려 둠. 같은 엽서면 한 번만 올림.
// 보내기를 열 때 미리 올려 두어, 버튼을 누르면 바로 공유 창이 뜨게 함 (늦으면 PC에서 팝업이 막힐 수 있음)
let kakaoImage = { key: '', promise: null };
function uploadCardImage() {
  const key = `${encodePost(currentPost())}|${photoActive}|${stamped}|${JSON.stringify(photoView)}`;   // 사진을 옮기면 다시 올림
  if (kakaoImage.key !== key || !kakaoImage.promise) {
    const promise = (async () => {
      const K = await kakao();
      const blob = await toBlob(await renderCard(), 'image/jpeg', 0.9);
      const file = new File([blob], 'jeju-postcard.jpg', { type: 'image/jpeg' });
      const res = await K.Share.uploadImage({ file: [file] });
      return res.infos.original.url;
    })();
    promise.catch(() => { if (kakaoImage.promise === promise) kakaoImage = { key: '', promise: null }; });
    kakaoImage = { key, promise };
  }
  return kakaoImage.promise;
}

// 카카오톡 링크는 주소 끝 #보다 ?가 더 안전하게 전달되어 ?p= 로 보냄 (받을 때는 둘 다 읽음)
// v7.13: 카카오톡 메시지는 1만 자를 넘으면 휴대폰에서 보내지지 않음(카카오 SDK 가 거절 → '잘못된 요청입니다' 화면 · 웹진 안에서는 흰 화면).
//        카카오는 메시지 안에 이 링크를 15번쯤 되풀이해 넣어서(링크 1자 = 메시지 약 15자) 링크가 KAKAO_LINK_MAX 자를 넘으면
//        ① 표준어 글(s)을 빼 보고(받은 사람의 '표준어로 보기'는 제주어 글을 풀어서 보여 줌) ② 그래도 길면 편지 사이트 첫 화면 주소로 보냄
//        (엽서 글은 카카오톡 메시지의 엽서 그림에 담겨 있음). 링크가 짧은 다른 기기에서도 똑같이(같은 엽서는 어디서 보내도 같은 메시지)
//        잰 값: 링크 56자 → 메시지 3,750자, 577자 → 11,565자 → 링크 약 470자까지 됨. 여유를 두고 420자
const KAKAO_LINK_MAX = 420;
function kakaoUrl() {
  const base = `${location.origin}${location.pathname}?p=`;
  const post = currentPost();
  const full = base + encodePost(post);
  if (full.length <= KAKAO_LINK_MAX) return full;
  const noStandard = base + encodePost({ ...post, standard: '' });
  return noStandard.length <= KAKAO_LINK_MAX ? noStandard : siteUrl();
}
const KAKAO_LONG_NOTE = ' 편지가 길어서 카카오톡 메시지에는 엽서 그림이 담기고, 메시지를 누르면 편지 사이트 첫 화면이 열려요.';

// 받는 사람 칸으로 '○○에게 제주어 엽서가 도착했어요'를 만듦. 템플릿의 To(예: 엄마에게 · 오랜만의 안부)도 자연스럽게
function arrivalTitle(to) {
  if (!to) return '제주어 엽서가 도착했어요';
  if (/에게$/.test(to)) return `${to} 제주어 엽서가 도착했어요`;
  if (TEMPLATE_TOS.has(to)) return `${to} · 제주어 엽서가 도착했어요`;
  return `${to}에게 제주어 엽서가 도착했어요`;
}
const mailToName = (to) => (/에게$/.test(to) ? to.replace(/에게$/, '') : TEMPLATE_TOS.has(to) ? '' : to);

// 돌려주는 값: 편지가 길어 받은 엽서 대신 편지 사이트 첫 화면 주소로 보냈는지(v7.13)
async function shareToKakao() {
  const K = await kakao();
  const url = kakaoUrl();
  let imageUrl;
  try {
    imageUrl = await uploadCardImage();
  } catch (e) {
    imageUrl = new URL(CARDS[currentCard].src, location.href).href;   // 올리기에 실패하면 엽서 그림만
  }
  const post = currentPost();
  // 카카오톡 그림 카드에는 주소가 따로 보이지 않아서, 설명 줄에 편지 사이트 주소를 글자로 적어 둠
  // (편지 글은 엽서 그림 안에 이미 보임. 누르는 곳은 카드 · 아래 두 단추)
  // v7.14: 메시지 아래 단추 두 개 — [엽서 보기](카드를 눌러도 같음) [웹진 보러 가기]. 편지가 길어 첫 화면으로 보낼 때는 [나도 엽서 쓰기].
  // 단추를 비워 두면 카카오가 카드 링크로 기본 단추를 붙여서 메시지가 오히려 길어짐(잰 값: 링크 420자 · 단추 둘 = 9,284자 < 1만 자).
  // 웹진 단추는 이 사이트와 같은 도메인일 때만(카카오 개발자 앱에 등록된 웹 도메인이어야 함 — 다른 도메인이면 공유가 거절될 수 있음)
  const toHome = url === siteUrl();
  const webzine = webzineUrl();
  const buttons = [{ title: toHome ? '나도 엽서 쓰기' : '엽서 보기', link: { mobileWebUrl: url, webUrl: url } }];
  if (webzine && new URL(webzine).host === location.host) buttons.push({ title: '웹진 보러 가기', link: { mobileWebUrl: webzine, webUrl: webzine } });
  K.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: arrivalTitle(post.to),
      description: SHARE_LINE,   // v7.17: '제주어로 엽서 적기 · 웹진 하영 고라보게' → 사용자 문구
      imageUrl,
      imageWidth: 1920,
      imageHeight: 1280,
      link: { mobileWebUrl: url, webUrl: url },   // 카드를 누르면 편지 사이트에서 받은 엽서가 열림 (답장하기 단추가 있음)
    },
    buttons,
  });
  return toHome;
}

document.getElementById('kakaoBtn').addEventListener('click', async () => {
  if (cardHasBadWord()) { setSheetStatus(BAD_WORD_MESSAGE, true); return; }
  const url = postUrl();
  if (KAKAO_JS_KEY) {
    const btn = document.getElementById('kakaoBtn');
    btn.disabled = true;
    setSheetStatus('카카오톡을 여는 중이에요...');
    try {
      const toHome = await shareToKakao();
      finishSend('카카오톡 공유 창을 열었어요. 받을 친구를 골라 보내 주세요.' + (toHome ? KAKAO_LONG_NOTE : '') + PHOTO_NOTE() + LOCAL_NOTE, 'kakao');
    } catch (e) {
      setSheetStatus(`카카오톡을 열지 못했어요. 카카오 개발자 사이트에 이 사이트 주소(${location.origin})가 등록돼 있는지 확인해 주세요. (${e.message || e})`, true);
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (navigator.share) {
    try {
      // 카카오톡은 text와 url을 이어 붙여 보여 줌 → 엽서 링크(url) 앞에 사이트 주소도 함께
      await navigator.share({ title: '제주어 엽서', text: `제주어 엽서가 도착했어요.\n나도 제주어 엽서 쓰기: ${siteUrl()}${webzineLine()}\n엽서 보기:`, url });
      finishSend('', 'kakao_share');
    } catch (err) {
      if (err.name !== 'AbortError') setSheetStatus('공유 창을 열지 못했어요. URL 복사로 보내 주세요.', true);
    }
    return;
  }
  // 키도 공유 창도 없는 PC 브라우저: 링크를 복사해 두고 카카오톡에 붙여 넣게 안내
  await copyText(shareText(url));
  finishSend('엽서 링크와 편지 사이트 주소를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.' + PHOTO_NOTE() + LOCAL_NOTE, 'kakao_copy');
});

// 메일 (Google Apps Script 웹앱)
const MAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzpLphT_IqCJ44mhGqcK3vAKMa1fH-Ea9U5Kntagxw1l-eHo41vVgpdFXvBxcVSBNf5zw/exec';

// 메일로 보내기: 누르면 바로 아래에 받는 사람 메일 주소 칸이 펼쳐짐
mailOption.addEventListener('click', () => {
  mailForm.hidden = !mailForm.hidden;
  mailOption.setAttribute('aria-expanded', String(!mailForm.hidden));
  if (!mailForm.hidden) mailInput.focus();
});

mailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!mailForm.reportValidity()) return;
  if (cardHasBadWord()) { setSheetStatus(BAD_WORD_MESSAGE, true); return; }

  mailSubmit.disabled = true;
  mailSubmit.textContent = '보내는 중...';
  setSheetStatus('엽서를 보내고 있어요...');
  try {
    const canvas = await renderCard();
    const res = await fetch(MAIL_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        email: mailInput.value.trim(),
        imageBase64: canvas.toDataURL('image/jpeg', 0.9),
        toName: mailToName(cardTo.value.trim()),   // 메일 서버가 뒤에 '에게'를 붙이므로 겹치지 않게
        fromName: cardFrom.value.trim(),
        message: cardMessage.value,
        filename: 'jeju-postcard.jpg',
        siteUrl: siteUrl(),         // v7.14: 메일 아래 '나도 제주어 엽서 쓰기' · '웹진' 링크(mail_script.gs — 정해 둔 도메인만 받음)
        webzineUrl: webzineUrl(),
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '알 수 없는 오류');
    mailForm.reset();
    finishSend('엽서를 메일로 보냈어요!', 'mail');
  } catch (err) {
    setSheetStatus(`메일을 보내지 못했어요. (${err.message}) 이미지로 저장해서 직접 보내 주세요.`, true);
  } finally {
    mailSubmit.disabled = false;
    mailSubmit.textContent = '보내기';
  }
});

// ---------- 엽서 게시판 ----------
// 사람들이 붙인 엽서를 코르크판에 보여 줌. 누르면 크게 볼 수 있음.
// config.js에 Supabase 주소·키가 있으면 모두가 같은 게시판을 봄 (supabase/board.sql).
// 없으면 예전처럼 이 브라우저에만 저장됨. 붙인 엽서가 3장이 안 되면 예시 엽서를 함께 보여 줌

const BOARD_POSTCARDS = [
  {
    card: 0, to: '할망', from: '손녀 민지', date: '2026.10.15', tilt: -4, pin: '#d9533c',
    message: '할망, 펜안ᄒᆞ우까? 제주 바당이 하영 기렵수다. ᄒᆞᆫ저 보고정 ᄒᆞ우다.',
    standard: '할머니, 편안하세요? 제주 바다가 많이 그리워요. 어서 보고 싶어요.',
  },
  {
    card: 2, to: '어멍', from: '막내', date: '2026.10.16', tilt: 3, pin: '#3f7fc4',
    message: '어멍, ᄎᆞᆷ말 고맙수다.\n늘 건강ᄒᆞᆸ서. ᄉᆞ랑ᄒᆞᆸ네다.',
    standard: '엄마, 정말 고마워요.\n늘 건강하세요. 사랑합니다.',
  },
  {
    card: 3, to: '지수', from: '하은', date: '2026.10.17', tilt: -2, pin: '#e8b62f',
    message: '친구광 ᄒᆞᆫ듸 ᄇᆞ름 부는 ᄆᆞ을을 걸엇수다. 늴 ᄒᆞᆨ교에서 만나게!',
    standard: '친구랑 같이 바람 부는 마을을 걸었어요. 내일 학교에서 만나자!',
  },
];

// 엽서 한 장을 줄인 모양으로 그림 (글자 자리는 쓰는 엽서와 같은 .card-* 위치를 씀)
function fillMiniCard(el, post) {
  const art = CARDS[post.card] || CARDS[0];
  el.innerHTML = `
    <img src="${art.src}" alt="${art.alt} 엽서">
    <div class="card-field card-to"></div>
    <div class="card-field card-message"></div>
    <div class="card-field card-from"></div>
    <div class="card-field card-date"></div>
    <img class="mini-stamp" src="images/stamp-goraboge.png?v=2" alt="하영 고라보게 소인">`;
  // 글은 textContent로 넣어서 나중에 사람들이 쓴 글이 들어와도 HTML로 해석되지 않게 함
  el.querySelector('.card-to').textContent = post.to;
  fitToField(el.querySelector('.card-to'), post.to);
  el.querySelector('.card-message').textContent = post.message;
  el.querySelector('.card-from').textContent = post.from;
  el.querySelector('.card-date').textContent = post.date || '';
  // 직접 넣은 사진으로 쓴 엽서는 그림 자리에 그 사진을 덮음
  if (typeof post.photo === 'string' && post.photo.startsWith('data:image/')) {
    const photo = document.createElement('img');
    photo.className = 'mini-photo';
    photo.src = post.photo;
    photo.alt = '직접 넣은 사진';
    el.querySelector('img').after(photo);
  }
}

const boardGrid = document.getElementById('boardGrid');
const boardView = document.getElementById('boardView');
const boardViewCard = document.getElementById('boardViewCard');
const boardViewToggle = document.getElementById('boardViewToggle');
let boardViewPost = null;

// 크게 본 엽서의 '표준어로 보기' ↔ '제주어로 보기'
// 표준어 글이 함께 저장된 엽서는 그 글을, 없는 엽서(예전 엽서)는 제주어 글을 대략 풀어서(translateToStandard) 보여 줌
function openBoardView(post) {
  boardViewPost = post;
  if (!post.standard && window.translateToStandard) post.standard = window.translateToStandard(post.message);
  fillMiniCard(boardViewCard, post);
  boardViewToggle.hidden = !post.standard || post.standard === post.message;
  boardViewToggle.setAttribute('aria-pressed', 'false');
  boardViewToggle.textContent = '표준어로 보기';
  boardView.showModal();
}
boardViewToggle.addEventListener('click', () => {
  if (!boardViewPost) return;
  const showStandard = boardViewToggle.getAttribute('aria-pressed') !== 'true';
  boardViewCard.querySelector('.card-message').textContent = showStandard ? boardViewPost.standard : boardViewPost.message;
  boardViewToggle.setAttribute('aria-pressed', String(showStandard));
  boardViewToggle.textContent = showStandard ? '제주어로 보기' : '표준어로 보기';
});

const PIN_COLORS = ['#d9533c', '#3f7fc4', '#e8b62f', '#5f9a4a', '#c45aa0'];
const TILTS = [-4, 3, -2, 4, -3, 2];

// 게시판에 엽서 한 장 붙이기
function addBoardCard(post, { prepend = false, fresh = false } = {}) {
  const n = boardGrid.children.length;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'board-card' + (fresh ? ' is-new' : '');
  btn.style.setProperty('--r', `${post.tilt ?? TILTS[n % TILTS.length]}deg`);
  btn.style.setProperty('--pin', post.pin || PIN_COLORS[n % PIN_COLORS.length]);
  btn.setAttribute('aria-label', `${post.from || '누군가'} 님이 ${post.to || '누군가'} 님에게 쓴 엽서 크게 보기`);
  const mini = document.createElement('div');
  mini.className = 'mini-card';
  fillMiniCard(mini, post);
  btn.appendChild(mini);
  btn.addEventListener('click', () => openBoardView(post));
  if (prepend) boardGrid.prepend(btn);
  else boardGrid.appendChild(btn);
  return btn;
}

// 이 브라우저에서 게시판에 붙인 엽서 (서버가 생기기 전까지는 이 기기에만 저장됨)
const BOARD_KEY = 'jeju-postcard-board';

function loadMyPosts() {
  try {
    const list = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveMyPosts(list) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;   // 저장 공간이 없거나 막혀 있으면 이번 화면에만 붙음
  }
}

// ---------- 모두가 보는 게시판 (Supabase) ----------
// 데이터베이스 규칙: 누구나 붙이고 읽기만, 고치기·지우기·숨기기는 관리자만, 1분에 20장까지
const BOARD_DB = {
  url: ((window.POSTCARD_CONFIG || {}).SUPABASE_URL || '').replace(/\/+$/, ''),
  key: (window.POSTCARD_CONFIG || {}).SUPABASE_KEY || '',
};
const BOARD_ONLINE = !!(BOARD_DB.url && BOARD_DB.key);
const BOARD_LIMIT = 60;   // 최근 엽서 몇 장까지 보여 줄지

function boardHeaders(extra = {}) {
  const headers = { apikey: BOARD_DB.key, ...extra };
  if (BOARD_DB.key.startsWith('eyJ')) headers.Authorization = `Bearer ${BOARD_DB.key}`;   // 예전 방식(anon) 키일 때
  return headers;
}

// standard = 제주어로 바꾸기 전 표준어 글 (크게 보기의 '표준어로 보기'). supabase/board.sql의 standard 칸
let boardHasStandard = true;   // 데이터베이스에 standard 칸이 없으면(아직 SQL을 안 돌렸으면) false로 바뀌고 예전처럼
async function fetchBoardPosts() {
  const cols = `card,to_name,message,from_name,post_date,photo${boardHasStandard ? ',standard' : ''}`;
  const res = await fetch(
    `${BOARD_DB.url}/rest/v1/board_posts?select=${cols}&order=created_at.desc&limit=${BOARD_LIMIT}`,
    { headers: boardHeaders() },
  );
  if (!res.ok && boardHasStandard && (res.status === 400 || res.status === 401)) {
    boardHasStandard = false;
    return fetchBoardPosts();
  }
  if (!res.ok) throw new Error(`게시판을 불러오지 못했어요 (${res.status})`);
  return (await res.json()).map((r) => ({
    card: r.card, to: r.to_name, message: r.message, from: r.from_name, date: r.post_date, photo: r.photo || undefined,
    standard: r.standard || '',
  }));
}

async function sendBoardPost(post) {
  const body = {
    card: post.card,
    to_name: post.to.slice(0, 20),
    message: post.message.slice(0, 400),
    from_name: post.from.slice(0, 20),
    post_date: post.date,
    photo: post.photo || null,
  };
  if (boardHasStandard && post.standard) body.standard = post.standard.slice(0, 400);
  let res = await fetch(`${BOARD_DB.url}/rest/v1/board_posts`, {
    method: 'POST',
    headers: boardHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!res.ok && body.standard && (res.status === 400 || res.status === 401)) {
    // 데이터베이스에 아직 standard 칸이 없으면 표준어 없이 다시
    boardHasStandard = false;
    delete body.standard;
    res = await fetch(`${BOARD_DB.url}/rest/v1/board_posts`, {
      method: 'POST',
      headers: boardHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json()).message || ''; } catch (e) { /* 내용 없음 */ }
    if (reason.includes('고운 말')) throw new Error(BAD_WORD_MESSAGE);
    throw new Error(reason.includes('잠시 뒤')
      ? '지금 붙이는 사람이 많아요. 잠시 뒤에 다시 붙여 주세요.'
      : '게시판에 붙이지 못했어요. 잠시 뒤에 다시 해 주세요.');
  }
}

// 예시 엽서는 실제 엽서가 3장이 안 될 때만 (data-example로 표시해 두고 나중에 뺌)
BOARD_POSTCARDS.forEach((post) => { addBoardCard(post).dataset.example = ''; });

function showBoardPosts(posts) {
  // 최신이 맨 앞에 오도록 오래된 것부터 앞에 붙임
  [...posts].reverse().forEach((post) => addBoardCard(post, { prepend: true }));
  if (posts.length >= 3) boardGrid.querySelectorAll('[data-example]').forEach((el) => el.remove());
}

if (BOARD_ONLINE) {
  fetchBoardPosts().then(showBoardPosts).catch((e) => console.warn(e));
} else {
  showBoardPosts(loadMyPosts().reverse());
}

// 크게 보기 바깥(어두운 곳)을 누르면 닫힘
boardView.addEventListener('click', (e) => { if (e.target === boardView) boardView.close(); });

// ---------- 게시판에 붙이기 ----------
// 공유와는 별개. 붙이기 전에 미리보기를 보여 주고, 이름은 기본으로 가림

const boardPost = document.getElementById('boardPost');
const boardPostCard = document.getElementById('boardPostCard');
const hideNames = document.getElementById('hideNames');

// '할망' → '할○', '손녀 민지' → '손○ ○○'
const maskName = (name) => Array.from(name).map((ch, i) => (i === 0 || ch === ' ' ? ch : '○')).join('');

let pendingPhoto = null;   // 내 사진을 넣었다면 게시판용으로 작게 줄인 사진

function postForBoard() {
  const post = currentPost();
  if (hideNames.checked) {
    post.to = maskName(post.to);
    post.from = maskName(post.from);
  }
  if (pendingPhoto) post.photo = pendingPhoto;
  return post;
}

function makePhotoThumb() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  drawCover(canvas.getContext('2d'), cardPhoto, 480, 640);
  // 게시판 데이터베이스는 사진 한 장을 20만 글자까지 받음 → 넘으면 화질을 낮춤
  for (const quality of [0.72, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= 190000) return url;
  }
  return null;
}

const boardPostStatus = document.getElementById('boardPostStatus');
const boardPostConfirm = document.getElementById('boardPostConfirm');
if (BOARD_ONLINE) {
  document.getElementById('boardPostNote').textContent =
    '게시판에 붙인 엽서는 이 사이트를 찾은 모든 사람이 볼 수 있어요. 붙인 뒤에는 직접 지울 수 없으니 주소·전화번호 같은 개인정보는 적지 말아 주세요.';
}

document.getElementById('boardBtn').addEventListener('click', () => {
  pendingPhoto = photoActive ? makePhotoThumb() : null;
  fillMiniCard(boardPostCard, postForBoard());
  boardPostStatus.textContent = '';
  boardPostStatus.classList.remove('is-warning');
  boardPost.showModal();
});

hideNames.addEventListener('change', () => fillMiniCard(boardPostCard, postForBoard()));

document.getElementById('boardPostCancel').addEventListener('click', () => boardPost.close());

boardPostConfirm.addEventListener('click', async () => {
  const post = postForBoard();
  if (cardHasBadWord()) {
    boardPostStatus.textContent = BAD_WORD_MESSAGE;
    boardPostStatus.classList.add('is-warning');
    return;
  }
  if (!post.message.trim()) {
    boardPostStatus.textContent = '엽서에 내용이 있어야 게시판에 붙일 수 있어요.';
    boardPostStatus.classList.add('is-warning');
    return;
  }

  let message;
  if (BOARD_ONLINE) {
    boardPostConfirm.disabled = true;
    boardPostStatus.classList.remove('is-warning');
    boardPostStatus.textContent = '붙이는 중이에요...';
    try {
      await sendBoardPost(post);
    } catch (e) {
      boardPostStatus.textContent = e.message;
      boardPostStatus.classList.add('is-warning');
      return;
    } finally {
      boardPostConfirm.disabled = false;
    }
    message = '게시판에 엽서를 붙였어요. 이 사이트를 찾은 모든 사람이 볼 수 있어요.';
  } else {
    const list = loadMyPosts();
    list.push(post);
    message = saveMyPosts(list)
      ? '게시판에 엽서를 붙였어요. (지금은 시험 단계라 이 기기에서만 보여요)'
      : '게시판에 엽서를 붙였어요. (저장 공간이 막혀 있어서 새로고침하면 사라져요)';
  }

  boardPost.close();
  addBoardCard(post, { prepend: true, fresh: true });
  finishSend(message, 'board');
  sendDone.hidden = false;   // 게시판에 붙였을 때만 '게시판에서 보기' 글자 단추를 보여 줌
  viewBoardBtn.hidden = false;
});

// ---------- 링크로 받은 엽서 보여 주기 ----------
// 주소에 #p=... (또는 카카오톡으로 받은 ?p=...)가 있으면 보낸 사람이 쓴 엽서를 먼저 크게 보여 줌

const receivedView = document.getElementById('receivedView');
const receivedCard = document.getElementById('receivedCard');

function clearReceived() {
  const params = new URLSearchParams(location.search);
  params.delete('p');
  const query = params.toString();
  history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : ''));
}

// 답장하기: 받은 엽서의 보낸 사람 → 내 엽서의 받는 사람, 받은 사람 → 보내는 사람으로 채우고 엽서 쓰는 곳으로
document.getElementById('writeBackBtn').addEventListener('click', () => {
  receivedView.close();
  if (!received) return;
  // 답장은 보통 직접 쓰니까 엽서 템플릿 글은 지우고 빈칸으로 시작 ('T 내 편지 쓰기'와 같음). 템플릿은 아래 단추로 고를 수 있음
  writingOwn = true;
  const text = mobileMessage.value.trim();
  if (!text || isTemplateText(text)) writeField(mobileMessage, '');
  hideTemplateUndo();
  onCardTemplate(currentCard);
  [['mobileTo', received.from], ['mobileFrom', received.to]].forEach(([id, name]) => {
    const input = document.getElementById(id);
    input.value = name.slice(0, input.maxLength > 0 ? input.maxLength : 10);
    input.dispatchEvent(new Event('input', { bubbles: true }));   // 엽서에도 옮김
  });
  openWriter();   // 채운 이름이 보이게 쓰는 칸을 열어 둠
  openWritePage();
});
receivedView.addEventListener('close', clearReceived);

const receivedCode = location.hash.startsWith('#p=') ? location.hash.slice(3) : new URLSearchParams(location.search).get('p');
const received = receivedCode ? decodePost(receivedCode) : null;
// 받은 엽서의 '표준어로 보기' ↔ '제주어로 보기': 엽서 글만 바꿔 보여 줌 (표준어 글이 있을 때만 단추가 보임 — 없으면 아래에서 풀어서 채움)
const receivedToggle = document.getElementById('receivedToggle');
receivedToggle.addEventListener('click', () => {
  const showStandard = receivedToggle.getAttribute('aria-pressed') !== 'true';
  receivedCard.querySelector('.card-message').textContent = showStandard ? received.standard : received.message;
  receivedToggle.setAttribute('aria-pressed', String(showStandard));
  receivedToggle.textContent = showStandard ? '제주어로 보기' : '표준어로 보기';
});

if (received) {
  hy('pc_received_view', { standard: received.standard ? 'yes' : 'no' });   // 받은 엽서 링크로 들어옴
  // v7.13: 표준어 글이 없는 링크(예전 링크 · 카카오톡 메시지 크기 때문에 뺀 링크)는 게시판처럼 제주어 글을 풀어서 보여 줌
  if (!received.standard && window.translateToStandard) received.standard = window.translateToStandard(received.message);
  fillMiniCard(receivedCard, received);
  receivedToggle.hidden = !received.standard || received.standard === received.message;
  receivedView.showModal();
}

// ---------- 안내 팝업 (? 단추) ----------
// v7.16: 처음 들어올 때 저절로 뜨던 것은 뺐다(사용자) — ? 단추로만 연다. '제주어 엽서 써보기'는 웹진 「하영 고라보게」로

const introPop = document.getElementById('helpDialog');
const introDots = [...introPop.querySelectorAll('.intro-pop-dot')];
const introSlides = [...introPop.querySelectorAll('.intro-pop-example')];
let introSlide = 0;
let introTimer = null;

function showIntroSlide(i) {
  introSlide = (i + introSlides.length) % introSlides.length;
  introSlides.forEach((el, n) => el.classList.toggle('is-active', n === introSlide));
  introDots.forEach((el, n) => el.setAttribute('aria-pressed', String(n === introSlide)));
}
function playIntroSlides() {
  clearInterval(introTimer);
  if (!calmMotion.matches) introTimer = setInterval(() => showIntroSlide(introSlide + 1), 4500);
}
introDots.forEach((dot, n) => dot.addEventListener('click', () => {
  showIntroSlide(n);
  playIntroSlides();
}));

function openIntro() {
  if (introPop.open) return;
  document.documentElement.classList.add('intro-open');   // 뒤 화면은 스크롤되지 않게
  introPop.showModal();
  introPop.querySelector('.intro-pop-body').scrollTop = 0;
  playIntroSlides();
}
introPop.addEventListener('close', () => {
  clearInterval(introTimer);
  document.documentElement.classList.remove('intro-open');
});
document.getElementById('introClose').addEventListener('click', () => introPop.close());
// X(또는 바깥)는 팝업만 닫는다. v7.16: '제주어 엽서 써보기'는 웹진 사이트로(사용자 — 광고로 바로 온 사람도 웹진을 보게)
document.getElementById('introStart').addEventListener('click', () => {
  introPop.close();
  hy('pc_help_to_webzine', {});
  location.href = webzineUrl() || '../../';
});
// v7.16: 예시 엽서를 손가락 · 마우스로 좌우로 밀어 넘기기(웹진의 견본 엽서와 같게)
(() => {
  const box = document.getElementById('introExamples');
  let start = null;
  box.style.touchAction = 'pan-y';
  box.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  box.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    showIntroSlide(introSlide + (dx < 0 ? 1 : -1));
    playIntroSlides();
  });
  box.addEventListener('pointercancel', () => { start = null; });
  box.addEventListener('dragstart', (e) => e.preventDefault());
})();
introPop.addEventListener('click', (e) => { if (e.target === introPop) introPop.close(); });   // 바깥(어두운 곳)을 눌러도 닫힘
document.getElementById('helpBtn').addEventListener('click', openIntro);

// ---------- 장면 사이 버튼 ----------

// 이야기를 건너뛰고 엽서 고르기 · 마음 쓰기 종이로 바로
function openWritePage() {
  if (view !== 'flow') renderView('flow');
  window.scrollTo(0, scene2.getBoundingClientRect().top + window.scrollY);
}

// 게시판 관리자 입구 (숨은 단추): '모두의 엽서 게시판' 제목을 2초 안에 3번 누르면 관리자 페이지로.
// 들어가도 관리자 계정으로 로그인해야 숨기기 · 삭제가 됨 (supabase/board_admin.sql)
let titleTaps = [];
document.getElementById('boardTitle').addEventListener('click', () => {
  const now = Date.now();
  titleTaps = titleTaps.filter((t) => now - t < 2000).concat(now);
  if (titleTaps.length >= 3) {
    titleTaps = [];
    location.href = 'admin.html';
  }
});

document.getElementById('boardNavBtn').addEventListener('click', goBoard);
document.getElementById('boardBack').addEventListener('click', leaveBoard);

// '바로 편지 쓰기': 이야기를 건너뛰고 SCENE 03으로
['jumpBtn', 'floatCta'].forEach((id) => {
  document.getElementById(id).addEventListener('click', (e) => {
    e.preventDefault();
    openWritePage();
    document.getElementById('pickTitle').focus({ preventScroll: true });
  });
});
document.querySelector('.skip-link').addEventListener('click', (e) => {
  e.preventDefault();
  openWritePage();
  mobileMessage.focus({ preventScroll: true });
});

// ---------- 뒤로가기 (위 막대) ----------
// 쓰기 페이지 → 엽서 고르기 · 게시판 → 보던 곳 · 이야기 중간이나 엽서 고르기 → 첫 페이지 ·
// 첫 페이지 → 들어오기 전 페이지(웹진). 들어오기 전 페이지가 없으면(새 탭으로 열었을 때) 첫 페이지에서는 숨김
const backBtn = document.getElementById('backBtn');
const cameFromPage = history.length > 1 && !!document.referrer;

function backTarget() {
  if (view === 'board') return 'board';
  if (BACK_OF[view]) return view;
  if (window.scrollY > window.innerHeight * 0.3) return 'top';
  return cameFromPage ? 'leave' : null;
}

function updateBackBtn() {
  const target = backTarget();
  backBtn.hidden = !target;
  backBtn.setAttribute('aria-label', {
    board: '게시판 닫기', send: '편지 쓰기로 돌아가기', end: '보내기로 돌아가기', top: '첫 페이지로', leave: '들어오기 전 페이지로',
  }[target] || '뒤로');
}

// v7.18: 웹진에서 넘어온 사람은 위 막대 로고가 웹진 첫 화면으로 돌아감(사용자). 웹진에서 온 사람 = 웹진의 '제주어 엽서 써보기'(?start=write)
// 또는 웹진 쪽(첫 화면 · 기사 · 영어 · 개인정보처리방침)에서 누른 링크. 이 사이트 안 · 예전 엽서 주소(postcard/ — 받은 엽서 넘겨주기)는 빼고,
// 같은 방문 동안 기억(새로고침해도). 광고 · 받은 엽서로 바로 온 사람은 예전처럼 이 사이트 첫 페이지로
const FROM_WEBZINE_KEY = 'hayeong-from-webzine';
const taleLogo = document.querySelector('.tale-logo');
const fromWebzine = (() => {
  const base = webzineUrl();
  if (!base) return false;
  let ref = '';
  try { ref = document.referrer ? new URL(document.referrer).href : ''; } catch (e) {}
  const rest = ref.startsWith(base) ? ref.slice(base.length) : null;
  const now = new URLSearchParams(location.search).get('start') === 'write' || (rest !== null && !/^(play|postcard)\//.test(rest));
  try {
    if (now) sessionStorage.setItem(FROM_WEBZINE_KEY, '1');
    return now || sessionStorage.getItem(FROM_WEBZINE_KEY) === '1';
  } catch (e) {
    return now;
  }
})();
if (fromWebzine) {
  taleLogo.href = webzineUrl();
  taleLogo.dataset.webzineLink = 'logo';   // 웹진 안에 띄워졌을 때는 track.js 가 바깥 창(웹진)을 돌림
  taleLogo.dataset.track = 'logo_webzine';
  taleLogo.setAttribute('aria-label', '웹진 하영 고라보게로 돌아가기');
}

// 위 막대 로고: 어느 페이지에서든 첫 페이지로 (주소 뒤 #story로 건너뛰지 않고 페이지 기록을 따라감)
taleLogo.addEventListener('click', (e) => {
  if (fromWebzine) return;   // v7.18: 링크 그대로 웹진으로
  e.preventDefault();
  if (view === 'flow') {
    window.scrollTo({ top: 0, behavior: smoothScroll() });
    return;
  }
  scrollMemory.flow = 0;
  if (stepDepth > 0) history.go(-stepDepth);   // 맨 처음 페이지까지 기록을 되감음
  else renderView('flow');
});

backBtn.addEventListener('click', () => {
  const target = backTarget();
  if (target === 'board') leaveBoard();
  else if (BACK_OF[target]) {
    if (target === 'send') scrollMemory.flow = 'write';
    backView(BACK_OF[target]);
  } else if (target === 'top') window.scrollTo({ top: 0, behavior: smoothScroll() });
  else if (target === 'leave') history.back();
});

// 이야기 중에만 아래에 '바로 편지 쓰기'를 띄움 (첫 화면을 지나고, SCENE 02 종이가 올라오기 전까지)
function updateFloatCta() {
  updateBackBtn();
  const reached = scene2.getBoundingClientRect().top < window.innerHeight * 0.5;   // 종이가 올라오면 그 안의 버튼이 대신함
  floatCta.hidden = view !== 'flow' || window.scrollY < window.innerHeight * 0.6 || reached;
}

// 장면 제목: 한 글자씩 잉크가 번지듯 써짐 (화면에 들어올 때)
function splitChars(el) {
  // <br>로 나눈 줄은 그대로 두고(예: 당신의 마음을 / 제주어로 전해보세요), 줄 안에서 글자마다 나눔
  const tmp = document.createElement('div');
  const lines = el.innerHTML.split(/<br\s*\/?>/i).map((html) => {
    tmp.innerHTML = html;
    return tmp.textContent.trim();
  }).filter(Boolean);
  el.setAttribute('aria-label', lines.join(' '));
  el.textContent = '';
  // 낱말 단위로 묶어 두어야 줄이 낱말 중간(…있나요 / ?)에서 끊기지 않음
  let i = 0;
  lines.join(' \n ').split(' ').forEach((word, w) => {
    if (word === '\n') {
      el.appendChild(document.createElement('br'));
      return;
    }
    if (w > 0 && el.lastChild && el.lastChild.nodeName !== 'BR') el.appendChild(document.createTextNode(' '));
    const box = document.createElement('span');
    box.className = 'word';
    box.setAttribute('aria-hidden', 'true');
    [...word].forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.style.setProperty('--i', i++);
      span.textContent = ch;
      box.appendChild(span);
    });
    el.appendChild(box);
  });
}

document.querySelectorAll('[data-chars], .prologue-main').forEach(splitChars);

if ('IntersectionObserver' in window) {
  const inkWatch = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      inkWatch.unobserve(en.target);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-chars]').forEach((el) => inkWatch.observe(el));
} else {
  document.querySelectorAll('[data-chars]').forEach((el) => el.classList.add('is-in'));
}

// ---------- 동화 장면 (SCENE 01 → 02 앞부분) ----------
// .story는 화면보다 몇 배 길고, 안의 .stage는 화면에 멈춰 있음(sticky). 스크롤한 만큼(p)으로 카메라가 움직임.
// 그림(색연필 일러스트): 돌담 옆 책상 — 편지가 책상 위에 놓여 있고 뒤로 바다와 들판. 첫 화면에 '지금, 생각나는 사람이 있나요?'.
// 카메라가 편지에 다가가면 엽서가 봉투에서 빠져나옴. 마지막 화면 높이만큼은 SCENE 02 종이가 위로 밀려 올라와 덮음.
// v7.16: 첫 화면부터 책상 그림(예전 첫 장면 '제주 풍경'은 뺐다), 스크롤하지 않아도 저절로 내려감(아래 '저절로 내려가기')
const story = document.getElementById('story');
const stage = document.getElementById('stage');
const world = document.getElementById('world');
const artDesk = document.getElementById('artDesk');
const letterEl = document.getElementById('letter');
const letterCardEl = document.getElementById('letterCard');
const storyCopy = document.getElementById('storyCopy');
const scrollHint = document.getElementById('scrollHint');

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const seg = (v, a, b) => clamp((v - a) / (b - a));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// 그림 원본 크기와, 책상 그림 속 편지 자리 (원본 픽셀 · 각도)
const ART = { w: 1122, h: 1402 };
const LETTER_REST = { x: 572, y: 872, angle: -3 };       // 책상 위에 놓인 편지 자리
const LETTER_SCALE = 0.3565;                            // 편지 폭 = 그림 폭 × 이 값 (그려진 봉투와 같은 크기)

const geo = { vw: 0, vh: 0, lw: 0, lh: 0, narrow: false, desk: null };

// object-fit: cover처럼 그림을 화면에 꽉 채우는 상자 (overscan: 카메라가 움직일 여유)
function coverBox(vw, vh, overscan, posY) {
  const k = Math.max(vw / ART.w, vh / ART.h) * overscan;
  const w = ART.w * k;
  const h = ART.h * k;
  return { k, w, h, x: (vw - w) / 2, y: (vh - h) * posY };
}

function placeBox(el, box) {
  el.style.left = `${box.x.toFixed(1)}px`;
  el.style.top = `${box.y.toFixed(1)}px`;
  el.style.width = `${box.w.toFixed(1)}px`;
  el.style.height = `${box.h.toFixed(1)}px`;
}

function measureStory() {
  geo.vw = stage.clientWidth;
  geo.vh = stage.clientHeight;
  geo.narrow = geo.vw < 720;
  geo.desk = coverBox(geo.vw, geo.vh, 1.04, geo.narrow ? 0.7 : 0.74);
  placeBox(artDesk, geo.desk);
  geo.lw = geo.desk.w * LETTER_SCALE;
  geo.lh = geo.lw / 1.5;
  letterEl.style.width = `${geo.lw.toFixed(1)}px`;
  letterEl.style.height = `${geo.lh.toFixed(1)}px`;
}

// 책상 그림 속 한 점 → 화면 위치
function onDesk(pt) {
  return { x: geo.desk.x + pt.x * geo.desk.k, y: geo.desk.y + pt.y * geo.desk.k };
}

function renderStory() {
  storyQueued = false;
  if (view !== 'flow' || !geo.desk) return;
  const { vw, vh } = geo;
  const r = story.getBoundingClientRect();
  if (r.bottom < 0 || r.top > vh) return;            // 화면 밖이면 그리지 않음
  const total = story.offsetHeight - vh;               // 멈춰 있는 동안 스크롤하는 길이
  const p = clamp(-r.top / total);
  const storyEnd = Math.max(0.5, (total - vh) / total); // 이 뒤로는 SCENE 02 종이가 덮어 옴
  const t = clamp(p / storyEnd);
  const q = seg(p, storyEnd, 1);

  // 첫 화면 글: 처음엔 또렷하게, 내려가면 위로 흩어짐
  const out = seg(t, 0.04, 0.22);
  storyCopy.style.opacity = (1 - out).toFixed(3);
  storyCopy.style.translate = `0 ${(-out * vh * 0.12).toFixed(1)}px`;
  storyCopy.style.visibility = out > 0.99 ? 'hidden' : 'visible';
  scrollHint.style.opacity = (1 - seg(t, 0, 0.06)).toFixed(3);

  // 편지: 처음부터 책상 위에 놓여 있음
  const rest = onDesk(LETTER_REST);
  letterEl.style.transform = `translate3d(${(rest.x - geo.lw / 2).toFixed(1)}px, ${(rest.y - geo.lh / 2).toFixed(1)}px, 0) rotate(${LETTER_REST.angle}deg)`;

  // 편지에 다가감: 카메라를 편지 쪽으로 옮기며 확대 → SCENE 02 종이가 올라올 때 조금 더
  const z = ease(seg(t, 0.14, 0.6));
  const target = Math.min(vw * (geo.narrow ? 0.92 : 0.62), 760) / geo.lw;
  const zoom = 1 + z * (Math.max(1.15, target) - 1) + q * 0.25;
  const dx = (vw / 2 - rest.x) * z;
  const dy = (vh * 0.5 - rest.y) * z;
  world.style.transformOrigin = `${rest.x.toFixed(1)}px ${rest.y.toFixed(1)}px`;
  world.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${zoom.toFixed(4)})`;

  // 편지가 펼쳐짐: 엽서가 봉투에서 위로 빠져나옴
  const open = ease(seg(t, 0.5, 1));
  letterCardEl.style.transform = `translateY(${(-46 * open - 4 * q).toFixed(1)}%) rotate(${(0.6 - 0.6 * open).toFixed(2)}deg)`;

  // 종이가 덮어 오는 동안 뒤 장면은 살짝 어두워짐
  stage.style.setProperty('--dim', (q * 0.35).toFixed(3));
}

let storyQueued = false;
function requestStory() {
  if (storyQueued) return;
  storyQueued = true;
  requestAnimationFrame(renderStory);
}

window.addEventListener('scroll', () => {
  requestStory();
  updateFloatCta();
}, { passive: true });
window.addEventListener('resize', () => {
  measureStory();
  requestStory();
});

// 동작 줄이기: 카메라 움직임 없이 첫 장면만 한 화면으로
function setupStory() {
  story.classList.toggle('is-calm', calmMotion.matches);
  measureStory();
  renderStory();
}
calmMotion.addEventListener?.('change', setupStory);

// 장마다 보던 자리는 사이트가 기억해 돌려놓음 (브라우저가 뒤로 가기 때 스크롤을 따로 옮기지 않게)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
history.replaceState({ view: 'flow', depth: 0 }, '', location.href);
renderView('flow');
setupStory();
syncPreview();
// 그림 층이 다 들어온 뒤 책상 자리를 다시 잼
window.addEventListener('load', () => { measureStory(); requestStory(); });

// ---------- 저절로 내려가기 (v7.16) ----------
// 첫 화면(책상 위 편지 + '지금, 생각나는 사람이 있나요?')을 AUTO_SLIDE_HOLD 동안 보여 준 뒤, 스크롤하거나 누르지 않아도
// 편지 쓰는 화면(SCENE 02)까지 저절로 내려간다(AUTO_SLIDE_MS 동안 — 그사이 카메라가 편지에 다가가고 엽서가 빠져나옴).
// 손으로 스크롤 · 터치 · 키를 누르면 그 자리에서 멈추고 손에 맡긴다. '동작 줄이기'는 움직임 없이 바로.
// 웹진에서 '제주어 엽서 써보기'로 온 사람(주소에 ?start=write)은 처음부터 편지 쓰기 화면, 받은 엽서 링크는 그 엽서가 먼저
// v7.17: 사용자 — '엽서 페이지 인트로도 너무 길다, 2.3초로' → 첫 화면 1초 + 내려가기 1.3초
const AUTO_SLIDE_HOLD = 1000;   // 첫 화면 글은 1초 안에 다 나타난다(style.css v7.17)
const AUTO_SLIDE_MS = 1300;
const STOP_SLIDE = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
let slideTimer = 0;
let slideFrame = 0;
function stopAutoSlide() {
  clearTimeout(slideTimer);
  cancelAnimationFrame(slideFrame);
  slideTimer = 0;
  slideFrame = 0;
  STOP_SLIDE.forEach((type) => window.removeEventListener(type, stopAutoSlide));
}
function runAutoSlide() {
  slideTimer = 0;
  if (view !== 'flow' || window.scrollY > 4 || document.querySelector('dialog[open]')) { stopAutoSlide(); return; }
  const to = scene2.getBoundingClientRect().top + window.scrollY;
  if (calmMotion.matches) { stopAutoSlide(); window.scrollTo(0, to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / AUTO_SLIDE_MS);
    window.scrollTo(0, to * ease(k));
    if (k < 1) slideFrame = requestAnimationFrame(step);
    else stopAutoSlide();
  };
  slideFrame = requestAnimationFrame(step);
}
const startParams = new URLSearchParams(location.search);
if (startParams.get('start') === 'write') {
  // 주소에서 start 는 지움(이 주소를 그대로 공유해도 받는 사람은 처음부터 보게)
  startParams.delete('start');
  const qs = startParams.toString();
  history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  if (!received) requestAnimationFrame(() => openWritePage());
} else if (!received) {
  STOP_SLIDE.forEach((type) => window.addEventListener(type, stopAutoSlide, { passive: true }));
  slideTimer = setTimeout(runAutoSlide, AUTO_SLIDE_HOLD);
}
