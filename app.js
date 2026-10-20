// ---------- 엽서 목록 ----------
// 12장 모두 같은 틀(1920×1280, 오른쪽 절반에 To / 8줄 / From)이라 쓰는 자리가 같음

// 그림을 고치면 IMG_V를 올려서 브라우저에 남은 예전 그림 대신 새 그림을 받게 함
const IMG_V = '?v=2';   // v2: 미리 찍혀 있던 소인을 지운 그림
const CARDS = [
  { src: `images/card-01.webp${IMG_V}`, alt: '해녀가 헤엄치는 바다' },
  { src: `images/card-02.webp${IMG_V}`, alt: '비 오는 창밖의 꽃밭' },
  { src: `images/card-03.webp${IMG_V}`, alt: '노을 진 바닷가의 돌하르방' },
  { src: `images/card-04.webp${IMG_V}`, alt: '오름 길에서 내려다본 바닷가 마을' },
  { src: `images/card-05.webp${IMG_V}`, alt: '협재 바닷가 모래언덕' },
  { src: `images/card-06.webp${IMG_V}`, alt: '바위 위로 쏟아지는 폭포' },
  { src: `images/card-07.webp${IMG_V}`, alt: '물웅덩이가 고인 현무암 바닷가' },
  { src: `images/card-08.webp${IMG_V}`, alt: '창문 너머 들판의 말' },
  { src: `images/card-09.webp${IMG_V}`, alt: '고글을 쓰고 오토바이에 탄 강아지' },
  { src: `images/card-10.webp${IMG_V}`, alt: '해녀의 숨비소리 벽화 앞을 걷는 해녀' },
  { src: `images/card-11.webp${IMG_V}`, alt: '돌담 사이 바다로 난 길' },
  { src: `images/card-12.webp${IMG_V}`, alt: '돌집 옆 들판에 선 말' },
];

const cardImage = document.getElementById('cardImage');
const cardPhoto = document.getElementById('cardPhoto');
const cardMessage = document.getElementById('cardMessage');
const cardTo = document.getElementById('cardTo');
const cardFrom = document.getElementById('cardFrom');
const carousel = document.getElementById('carousel');
const statusEl = document.getElementById('status');

const narrowScreen = window.matchMedia('(max-width: 700px)');

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
const N = CARDS.length;

const GAP = () => parseFloat(getComputedStyle(carousel).columnGap) || 14;

const cardTiles = [];
for (let copy = 0; copy < COPIES; copy++) {
  CARDS.forEach((card, index) => {
    const slot = copy * N + index;
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

function selectCard(index) {
  currentCard = index;
  cardImage.src = CARDS[index].src;
  cardImage.alt = CARDS[index].alt + ' 엽서';
  showPhoto(false);
}

const tileCenter = (k) => cardTiles[k].offsetLeft + cardTiles[k].offsetWidth / 2;
const setWidth = () => tileCenter(N) - tileCenter(0);   // 한 벌(12장)의 길이

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
    if (slot % N !== currentCard) selectCard(slot % N);
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
  if (k === centerSlot) selectCard(k % N);   // 내 사진이 올라가 있었다면 이 그림으로 되돌림
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
// 엽서 왼쪽 그림 자리(960×1280)에 사진을 꽉 채워 넣음. 비율이 다르면 가운데를 기준으로 잘림.
// 다른 엽서를 골랐다가 '내 사진' 칸을 다시 누르면 넣었던 사진으로 돌아옴

const PHOTO_W = 960;
const PHOTO_MAX_BYTES = 30 * 1024 * 1024;

const photoInput = document.getElementById('photoInput');
const photoTile = document.getElementById('photoTile');
const photoThumb = document.getElementById('photoThumb');
const photoLabel = document.getElementById('photoLabel');
let photoUrl = null;      // 넣어 둔 사진
let photoActive = false;  // 지금 엽서에 사진이 보이는지

const photoCaption = document.getElementById('photoCaption');

function showPhoto(on) {
  photoActive = on && !!photoUrl;
  cardPhoto.hidden = !photoActive;
  // 사진 칸 밑 설명: 지금 누르면 무슨 일이 일어나는지
  if (photoActive) photoCaption.textContent = '한 번 더 누르면 다른 사진으로';
  else if (photoUrl) photoCaption.textContent = '누르면 내 사진으로 돌아가요';
  else photoCaption.textContent = '직접 찍은 사진으로 엽서 만들기';
  markPicked();
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
  cardPhoto.src = url;
  photoThumb.src = url;
  photoThumb.hidden = false;
  photoTile.classList.add('has-photo');
  photoLabel.textContent = '내 사진';
  showPhoto(true);

  const fits = Math.abs(probe.naturalWidth / probe.naturalHeight - PHOTO_W / CARD_H) < 0.02;
  setStatus(fits ? '사진을 넣었어요.' : '사진을 넣었어요. 엽서 크기(960×1280)에 맞게 가운데를 기준으로 잘랐어요.');
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

const TR_NOTE = '「개정증보 제주어사전」을 바탕으로 한 참고용 번역이에요. 어색한 곳은 고쳐도 돼요.';

// 지금 편지의 두 모습. 엽서에 제주어 편지를 담은 뒤 글을 고치지 않았으면 그대로 다시 보여 줌
let letter = { standard: '', jeju: '' };

function showView(name) {
  writePanelEl.hidden = name !== 'write';
  boardSection.hidden = name !== 'write';
  translatePage.hidden = name !== 'translate';
  window.scrollTo(0, 0);
}

// 브라우저의 뒤로 가기로도 엽서 쓰기로 돌아오게
window.addEventListener('popstate', (e) => {
  showView(e.state && e.state.view === 'translate' ? 'translate' : 'write');
});

// 버튼으로 돌아갈 때는 history.back()을 쓰지 않음: 브라우저가 이 기록을 건너뛰면 사이트 밖으로 나가 버림.
// 지금 기록을 '쓰기'로 바꿔 두면, 나중에 뒤로 가기를 눌러도 엽서 쓰기 화면이 그대로 보임
function leaveTranslate() {
  showView('write');
  if (history.state && history.state.view === 'translate') history.replaceState({ view: 'write' }, '');
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
  letter.jeju = window.translateToJeju(letter.standard);
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
    writingBox().focus();
    return;
  }
  setStatus('');
  setTrStatus('');
  trStandard.value = jejuApplied && text === letter.jeju ? letter.standard : text;
  fillPaperInfo();
  if (jejuApplied && text === letter.jeju) {
    trJeju.value = letter.jeju;
    markStale(false);
    trNote.textContent = TR_NOTE;
  } else {
    convertLetter();
  }
  showView('translate');
  fitTrTexts();
  history.pushState({ view: 'translate' }, '');
  document.getElementById('translateTitle').focus({ preventScroll: true });
});

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
  trConvert.classList.remove('is-spinning');
  void trConvert.offsetWidth;
  trConvert.classList.add('is-spinning');
});

// 표준어 편지를 고치면 제주어 결과는 아직 예전 글이라고 알려 줌
trStandard.addEventListener('input', () => {
  fitHeight(trStandard);
  if (trStandard.value !== letter.standard) {
    markStale(true);
    trNote.textContent = '표준어 편지를 고쳤어요. 가운데 \u2018제주어로 변환하기\u2019를 누르면 다시 바뀌어요.';
  }
});

trJeju.addEventListener('input', () => {
  letter.jeju = trJeju.value;
  fitHeight(trJeju);
});

// 엽서에 글을 담아 보고, 엽서 8줄을 넘으면 되돌림.
// 2단계 페이지에 있을 때는 엽서가 숨어 있어 높이를 잴 수 없으므로 잠깐 펼쳐서 잼 (화면에는 안 보임)
function putOnCard(text) {
  const before = cardMessage.value;
  const wasHidden = writePanelEl.hidden;
  writePanelEl.hidden = false;
  cardMessage.value = text;
  const overflow = cardMessage.scrollHeight > cardMessage.clientHeight;
  writePanelEl.hidden = wasHidden;
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
  leaveTranslate();
  writingBox().focus({ preventScroll: true });
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

// 이 편지로 보내기: 제주어 편지를 엽서에 담고, 도장을 찍은 뒤 보내기를 엶
document.getElementById('trNext').addEventListener('click', () => {
  if (!trJeju.value.trim()) {
    setTrStatus('제주어 편지가 비어 있어요. 가운데 버튼을 눌러 바꿔 주세요.', true);
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
  leaveTranslate();
  stampCard();
  // 휴대폰은 아래에서 올라오는 판이 엽서를 어둡게 덮으므로 도장을 다 찍은 뒤에 엶
  if (narrowScreen.matches && !reduceMotion.matches) setTimeout(openSend, 1500);
  else openSend();
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
const FONT = `${FONT_PX}px "NanumMyeongjo YetHangul", "Malgun Gothic", "Apple SD Gothic Neo", serif`;
const SPOTS = {
  message: { x: 1064, top: 313, width: 727, lines: 8 },
  to: { x: 1130, top: 221, width: 265 },
  from: { x: 1405, top: 1049, width: 270 },
  date: { x: 1064, top: 1049 },            // style.css의 .card-date (글자는 3.1cqh)
};

// 원래 엽서에 인쇄돼 있던 소인과 같은 자리·크기 (style.css의 .card-stamp)
const STAMP = { left: 0.7819, top: 0.0694, size: 0.1912, angle: 0 };

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

// 화면의 object-fit: cover 와 같게, 넘치는 쪽을 가운데 기준으로 잘라 그림
function drawCover(ctx, img, width, height) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
}

async function renderCard() {
  const text = cardMessage.value + cardTo.value + cardFrom.value;
  try { await document.fonts.load(`${FONT_PX}px "NanumMyeongjo YetHangul"`, text || '가'); } catch (e) { /* 기본 글꼴로 그림 */ }
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
  ctx.fillText(cardTo.value, SPOTS.to.x, SPOTS.to.top + baseline, SPOTS.to.width);
  ctx.fillText(cardFrom.value, SPOTS.from.x, SPOTS.from.top + baseline, SPOTS.from.width);

  // 날짜는 조금 작고 옅게
  const DATE_PX = CARD_H * 0.031;
  ctx.font = `${DATE_PX}px "NanumMyeongjo YetHangul", "Malgun Gothic", "Apple SD Gothic Neo", serif`;
  ctx.fillStyle = '#6f6455';
  const dm = ctx.measureText('0');
  const dAscent = dm.fontBoundingBoxAscent || DATE_PX * 0.8;
  const dDescent = dm.fontBoundingBoxDescent || DATE_PX * 0.2;
  ctx.fillText(TODAY, SPOTS.date.x, SPOTS.date.top + (LINE - (dAscent + dDescent)) / 2 + dAscent);

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
const writePanel = sendPanel.closest('.panel');
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
  shareMenu.hidden = true;
  shareBtn.setAttribute('aria-expanded', 'false');
  mailForm.hidden = true;
  mailOption.setAttribute('aria-expanded', 'false');
  setSheetStatus('');
  setStatus('');
  // 보내기를 여는 동안 엽서 고르기 칸과 쓰기 칸은 숨기고 저장 · 공유 · 게시판 버튼만
  writePanel.classList.add('is-sending');
  if (KAKAO_JS_KEY) uploadCardImage().catch(() => {});   // 카카오톡 공유에 쓸 엽서 이미지를 미리 올려 둠
  if (narrowScreen.matches) {
    sendPanel.showModal();
    document.getElementById('shareBtn').focus();
  } else {
    sendPanel.show();
    document.getElementById('saveBtn').focus();
  }
}

function closeSend() {
  if (sendPanel.open) sendPanel.close();   // close 이벤트에서 버튼 줄을 되돌림
}

sendPanel.addEventListener('close', () => {
  writePanel.classList.remove('is-sending');
  translateBtn.focus({ preventScroll: true });
});

// 보내기를 마치면 닫고 결과는 엽서 아래에 알려 줌
function finishSend(text) {
  closeSend();
  setStatus(text);
}


// 뒤로: 도장을 지우고 2단계 '제주어로 변환하기' 페이지로 돌아감
document.getElementById('sendBack').addEventListener('click', () => {
  closeSend();
  clearStamp();
  translateBtn.click();
});

// 아직 표준어면 2단계 페이지로 가서 바꿈
document.getElementById('sendHintTranslate').addEventListener('click', () => {
  closeSend();
  translateBtn.click();
});

// 컴퓨터에서 펼친 줄은 창이 아니라서 Esc를 직접 받아 닫음
sendPanel.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !narrowScreen.matches) closeSend();
});

// 휴대폰 판 바깥(어두운 곳)을 누르면 닫힘
sendPanel.addEventListener('click', (e) => {
  if (e.target === sendPanel && narrowScreen.matches) closeSend();
});

// 펼친 채로 화면 폭이 바뀌면(컴퓨터 ↔ 휴대폰 크기) 일단 닫음
narrowScreen.addEventListener('change', closeSend);

// 저장
document.getElementById('saveBtn').addEventListener('click', async () => {
  download(await toBlob(await renderCard(), 'image/png'));
  finishSend('엽서를 이미지로 저장했어요.');
});

// 공유하기: 누르면 아래에 URL 복사 / 이메일로 보내기 / 카카오톡으로 전송하기가 펼쳐짐
const shareBtn = document.getElementById('shareBtn');
const shareMenu = document.getElementById('shareMenu');

shareBtn.addEventListener('click', () => {
  shareMenu.hidden = !shareMenu.hidden;
  shareBtn.setAttribute('aria-expanded', String(!shareMenu.hidden));
  if (shareMenu.hidden) {
    mailForm.hidden = true;
    mailOption.setAttribute('aria-expanded', 'false');
  }
});

// ---------- 엽서를 링크에 담기 ----------
// 받는 칸·내용·보내는 칸·엽서 번호를 주소 끝(#p=...)에 담아서, 링크를 연 사람에게 그 엽서를 보여 줌.
// 직접 넣은 사진은 너무 커서 링크에 담지 못함 (그때는 고른 엽서 그림으로 보임)

function currentPost() {
  return { card: currentCard, to: cardTo.value.trim(), message: cardMessage.value, from: cardFrom.value.trim(), date: TODAY };
}

function encodePost(post) {
  const json = JSON.stringify({ c: post.card, t: post.to, m: post.message, f: post.from, d: post.date });
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
    return { card, to: text(d.t, 20), message: text(d.m, 400), from: text(d.f, 20), date };
  } catch (e) {
    return null;
  }
}

function postUrl() {
  return `${location.origin}${location.pathname}#p=${encodePost(currentPost())}`;
}

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
  if (await copyText(postUrl())) {
    finishSend('엽서 링크를 복사했어요. 받는 사람에게 붙여 넣어 보내 주세요.' + PHOTO_NOTE() + LOCAL_NOTE);
  } else {
    setSheetStatus('링크를 복사하지 못했어요. 다시 눌러 주세요.', true);
  }
});

// 카카오톡으로 전송하기
// config.js에 카카오 JavaScript 키를 넣으면 카카오톡 공유 창이 열려 친구를 고르고 보낼 수 있음.
// 메시지에는 지금 엽서를 그린 이미지(제주어 편지 + 소인)가 들어가고, '엽서 열어 보기'를 누르면 이 사이트에서 그 엽서가 열림.
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
  const key = `${encodePost(currentPost())}|${photoActive}|${stamped}`;
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
function kakaoUrl() {
  return `${location.origin}${location.pathname}?p=${encodePost(currentPost())}`;
}

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
  K.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: post.to ? `${post.to}에게 제주어 엽서가 도착했어요` : '제주어 엽서가 도착했어요',
      description: post.message.replace(/\s+/g, ' ').trim().slice(0, 60) || '하영고라보게 · 제주어로 엽서 적기',
      imageUrl,
      imageWidth: 1920,
      imageHeight: 1280,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '엽서 열어 보기', link: { mobileWebUrl: url, webUrl: url } }],
  });
}

document.getElementById('kakaoBtn').addEventListener('click', async () => {
  const url = postUrl();
  if (KAKAO_JS_KEY) {
    const btn = document.getElementById('kakaoBtn');
    btn.disabled = true;
    setSheetStatus('카카오톡을 여는 중이에요...');
    try {
      await shareToKakao();
      finishSend('카카오톡 공유 창을 열었어요. 받을 친구를 골라 보내 주세요.' + PHOTO_NOTE() + LOCAL_NOTE);
    } catch (e) {
      setSheetStatus(`카카오톡을 열지 못했어요. 카카오 개발자 사이트에 이 사이트 주소(${location.origin})가 등록돼 있는지 확인해 주세요. (${e.message || e})`, true);
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: '제주어 엽서', text: '제주어 엽서가 도착했어요', url });
      finishSend('');
    } catch (err) {
      if (err.name !== 'AbortError') setSheetStatus('공유 창을 열지 못했어요. URL 복사로 보내 주세요.', true);
    }
    return;
  }
  // 키도 공유 창도 없는 PC 브라우저: 링크를 복사해 두고 카카오톡에 붙여 넣게 안내
  await copyText(url);
  finishSend('엽서 링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.' + PHOTO_NOTE() + LOCAL_NOTE);
});

// 메일 (Google Apps Script 웹앱)
const MAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2mo6dZ-DAXsN1JRdb_V3DSTdGFMb9gOLi55IOgX94NL0KjVg5dgI7SXld9qquKC05/exec';

mailOption.addEventListener('click', () => {
  mailForm.hidden = !mailForm.hidden;
  mailOption.setAttribute('aria-expanded', String(!mailForm.hidden));
  if (!mailForm.hidden) mailInput.focus();
});

mailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!mailForm.reportValidity()) return;

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
        filename: 'jeju-postcard.jpg',
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '알 수 없는 오류');
    mailForm.reset();
    finishSend('엽서를 메일로 보냈어요!');
  } catch (err) {
    setSheetStatus(`메일을 보내지 못했어요. (${err.message}) 이미지로 저장해서 직접 보내 주세요.`, true);
  } finally {
    mailSubmit.disabled = false;
    mailSubmit.textContent = '보내기';
  }
});

// ---------- 엽서 게시판 ----------
// 다른 사람들이 쓴 엽서를 코르크판에 붙여 보여 줌. 누르면 크게 볼 수 있음.
// 지금은 예시 3장. 실제로 사람들이 쓴 엽서를 모으려면 저장할 곳(서버나 구글 시트)이 필요함

const BOARD_POSTCARDS = [
  {
    card: 0, to: '할망', from: '손녀 민지', date: '2026.10.15', tilt: -4, pin: '#d9533c',
    message: '할망, 펜안ᄒᆞ우까? 제주 바당이 하영 기렵수다. ᄒᆞᆫ저 보고정 ᄒᆞ우다.',
  },
  {
    card: 2, to: '어멍', from: '막내', date: '2026.10.16', tilt: 3, pin: '#3f7fc4',
    message: '어멍, ᄎᆞᆷ말 고맙수다.\n늘 건강ᄒᆞᆸ서. ᄉᆞ랑ᄒᆞᆸ네다.',
  },
  {
    card: 4, to: '지수', from: '하은', date: '2026.10.17', tilt: -2, pin: '#e8b62f',
    message: '친구광 ᄒᆞᆫ듸 ᄇᆞ름 부는 ᄆᆞ을을 걸엇수다. 늴 ᄒᆞᆨ교에서 만나게!',
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
    <img class="mini-stamp" src="images/stamp-goraboge.png?v=2" alt="">`;
  // 글은 textContent로 넣어서 나중에 사람들이 쓴 글이 들어와도 HTML로 해석되지 않게 함
  el.querySelector('.card-to').textContent = post.to;
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
  btn.setAttribute('aria-label', `${post.from || '누군가'}님이 ${post.to || '누군가'}님에게 쓴 엽서 크게 보기`);
  const mini = document.createElement('div');
  mini.className = 'mini-card';
  fillMiniCard(mini, post);
  btn.appendChild(mini);
  btn.addEventListener('click', () => {
    fillMiniCard(boardViewCard, post);
    boardView.showModal();
  });
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

BOARD_POSTCARDS.forEach((post) => addBoardCard(post));
loadMyPosts().forEach((post) => addBoardCard(post, { prepend: true }));

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
  return canvas.toDataURL('image/jpeg', 0.72);
}

document.getElementById('boardBtn').addEventListener('click', () => {
  pendingPhoto = photoActive ? makePhotoThumb() : null;
  fillMiniCard(boardPostCard, postForBoard());
  boardPost.showModal();
});

hideNames.addEventListener('change', () => fillMiniCard(boardPostCard, postForBoard()));

document.getElementById('boardPostCancel').addEventListener('click', () => boardPost.close());

document.getElementById('boardPostConfirm').addEventListener('click', () => {
  const post = postForBoard();
  const list = loadMyPosts();
  list.push(post);
  const saved = saveMyPosts(list);
  boardPost.close();
  closeSend();
  const card = addBoardCard(post, { prepend: true, fresh: true });
  setStatus(saved
    ? '게시판에 엽서를 붙였어요. (지금은 시험 단계라 이 기기에서만 보여요)'
    : '게시판에 엽서를 붙였어요. (저장 공간이 막혀 있어서 새로고침하면 사라져요)');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ---------- 링크로 받은 엽서 보여 주기 ----------
// 주소에 #p=... (또는 카카오톡으로 받은 ?p=...)가 있으면 보낸 사람이 쓴 엽서를 먼저 크게 보여 줌

const receivedView = document.getElementById('receivedView');
const receivedCard = document.getElementById('receivedCard');

function clearReceived() {
  const params = new URLSearchParams(location.search);
  params.delete('p');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''));
}

document.getElementById('writeBackBtn').addEventListener('click', () => {
  receivedView.close();
  writingBox().focus();
});
receivedView.addEventListener('close', clearReceived);

const receivedCode = location.hash.startsWith('#p=') ? location.hash.slice(3) : new URLSearchParams(location.search).get('p');
const received = receivedCode ? decodePost(receivedCode) : null;
if (received) {
  fillMiniCard(receivedCard, received);
  receivedView.showModal();
}

// ---------- 사용 방법 ----------

document.getElementById('helpBtn').addEventListener('click', () => {
  document.getElementById('helpDialog').showModal();
});
