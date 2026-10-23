// maker.js — 제주어 엽서 쓰기: 플로팅 버튼 + 변환 모달 + 엽서 미리보기 (세 페이지 공용, root = document.body)
// 변환은 convert.js 의 convertToJeju 만 불러와 호출한다(변환 방식은 여기서 알 필요가 없다).
// 하는 일:
//   (1) <body> 끝에 플로팅 버튼(.fab)과 모달(.maker)을 넣는다. data-open-maker 가 붙은 모든 요소가 같은 모달을 연다
//   (2) 쓰기 → [제주어로 바꾸기] → 엽서 미리보기 → [이미지로 저장] · [메일로 받기] · [다시 쓰기]
//   (3) '엽서 쓰기' 섹션의 견본 엽서([data-postcard-sample])를 그린다
// 바깥 링크 모드: config.js 의 links.postcard 에 주소가 있으면 모달을 만들지 않는다 —
//   플로팅 버튼은 그 주소로 가는 링크(<a target="_blank">)가 되고, data-open-maker 단추도 그 주소를 새 탭으로 연다.
// 생김새는 css/maker.css, 그림 만들기는 postcard-image.js, 메일은 mailer.js 가 맡는다.

import { t, tHTML } from './i18n.js';
import { isConfigured, mailMessage, sendPostcard } from './mailer.js';
import { download, renderPNG } from './postcard-image.js';
import { escapeHTML, getConfig, postmarkSVG, stampSVG, SVG_FONT, todayKR, withTimeout } from './shared.js';
import { track, withCampaign } from './track.js';

// 변환 함수는 쓸 때 불러온다 — convert.js 를 바꿔 끼우다 오타가 나도 버튼 · 모달은 그대로 살고,
// 변환할 때 "변환에 실패했어요" 안내만 뜬다. (convert.js 에서 가져오는 것은 convertToJeju 하나뿐이다)
const loadConverter = () =>
  import('./convert.js').then(({ convertToJeju }) => {
    if (typeof convertToJeju !== 'function') throw new Error('convert.js 에 convertToJeju 함수가 없어요');
    return convertToJeju;
  });

const MAX_TEXT = 200; // 본문 글자 수 제한
const WARN_TEXT = 180; // 이만큼 넘으면 글자 수를 강조한다
const MAX_NAME = 20; // 받는 사람 · 보내는 사람
const IMAGE_WIDTH = 1500; // 저장하는 PNG 의 가로(px) → 1500 x 1000
const CONVERT_TIMEOUT = 20000; // 변환이 이만큼 걸려도 끝나지 않으면 실패로 본다(ms)
const MIN_BUSY = 450; // '바꾸는 중…' 이 너무 짧게 깜빡이지 않게 하는 최소 시간(ms)
// 미리보기의 제주어 글자가 이보다 작으면(px) '바꾼 글 크게 보기' 를 내놓는다(손글씨는 같은 크기의 본문 글꼴보다 작게 보인다)
const SMALL_PRINT = 17;
// 보이는 화면의 높이가 이보다 낮으면(px) 모달을 줄여 놓는다(화면 키보드가 올라온 휴대폰 · 눕힌 휴대폰) — css 의 data-short
const SHORT_VIEW = 440;
const TINY_VIEW = 300;

// 엽서 글자 크기의 범위(엽서 폭의 %) — 글이 길수록 작아진다
const FS_MAX = 13;
const FS_MIN = 2.5;
// 여러 줄로 나눠 쓴 글은 '나눈 줄이 중간에서 접히지 않는 크기'까지 글자를 줄인다.
// 다만 들어가는 가장 큰 크기의 이 비율보다 작아져야 한다면 줄이지 않고 줄이 접히게 둔다
const KEEP_LINES_RATIO = 0.6;
// 원문(표준어) 글자 크기: 기본은 제주어 본문의 절반, 자리가 남으면 78% 까지
const SUB_MIN = 2.2;
const SUB_MAX = 4.4;
const SUB_RATIO = 0.5;
const SUB_RATIO_MAX = 0.78;
const NAME_SIZES = [4.8, 4.2, 3.6, 3.1];
// 엽서의 '인쇄된' 작은 글자(우표 · 아래 웹진 이름)는 기기 기본 글꼴(shared.js 의 SVG_FONT)로 적는다 — SVG 글자라 그림에 따로 싣지 않아도 된다

// 화면 문구는 모두 t('키', '한국어') 로 꺼낸다(언어별 문구는 data/i18n/*.json 의 같은 키). 쓸 때 꺼내 읽는다(get) — 사전이 도착한 뒤의 언어로.
// 언어를 바꿔도 그대로인 것: 변환 기능(표준어 → 제주어) · 아래 예시 문장(변환할 표준어) · 엽서에 찍히는 글자(표준어 꼬리표 · To. · From. · 소인 · 웹진 이름)
// ✏️ 교체: 모달의 제목('엽서 쓰기' 섹션의 제목은 index.html 에 따로 있다) · 오른쪽 아래 플로팅 버튼의 글자(화면 낭독기가 읽는 이름도 같다)
// 사이트 맨 위(이 파일은 js/ 안) — 어느 쪽(play/postcard/ · articles/)에서 불러도 그림 · 쪽 주소가 맞게
const SITE_ROOT = new URL('../', import.meta.url);
const STAMP_SRC = new URL('assets/intro/stamp-citrus.webp', SITE_ROOT).href;
// 21차: '제주어 엽서 써보기'(섹션 단추 · 플로팅 버튼)가 가는 엽서 쓰러가기 쪽('/'로 끝나는 주소)
// (36차) ?start=write — 엽서 사이트가 첫 장면(책상 · 저절로 내려가기)을 건너뛰고 바로 편지 쓰기 화면으로(웹진에서 온 사람은 봉투 인트로를 이미 봤다 — 사용자)
const PLAY_URL = new URL('play/postcard/?start=write', SITE_ROOT).href;

const TEXT = {
  get title() { return t('maker.title', '제주어 엽서 쓰기'); },
  get fab() { return t('maker.fab', '제주어 엽서 써보기'); },
  get fabSub() { return t('maker.fab-sub', '가족 · 친구 · 나에게 한 장'); }, // 플로팅 버튼의 둘째 줄(작은 글자)
  get newTab() { return t('maker.new-tab', '새 탭에서 열려요'); }, // 바깥 링크 모드에서 화면 낭독기에 덧붙여 알리는 말(버튼 이름 뒤 괄호 안)
  // 견본 엽서 크게 보기(화면 낭독기가 읽는 이름)
  get zoomLabel() { return t('write.zoom-label', '엽서 샘플 크게 보기'); },
  get zoomClose() { return t('write.zoom-close', '닫기'); },
  get zoomPrev() { return t('write.zoom-prev', '이전 엽서'); },
  get zoomNext() { return t('write.zoom-next', '다음 엽서'); },
};

// ✏️ 교체: 예시 문장(표준어 — 변환할 글이라 언어를 바꿔도 그대로). 누르면 입력칸에 채워진다
const EXAMPLES = ['어서 오세요', '고맙습니다. 또 오세요', '할머니, 사랑합니다', '안녕하세요? 반갑습니다'];

// ✏️ 교체: 화면에 나오는 안내 문구(변환 · 저장). 메일 발송 안내는 js/mailer.js 의 MESSAGES,
//          그림 기능을 불러오지 못했을 때의 안내는 js/postcard-image.js 의 NO_LIBRARY 에 있다.
//          단추 · 입력칸의 이름은 아래 modalHTML, 엽서에 찍히는 글자는 postcardHTML · stampHTML 에 있다
const MSG = {
  get convertFail() { return t('maker.convert-fail', '변환에 실패했어요, 다시 시도해 주세요'); },
  get converted() { return t('maker.converted', '제주어 엽서가 나왔어요'); },
  get same() { return t('maker.same', '바뀐 곳이 없어요. 다른 표현으로 써 보세요'); },
  get stale() { return t('maker.stale', '글이 바뀌었어요. 다시 바꿔 주세요'); },
  get tooLong() { return t('maker.too-long', '글이 길어서 엽서에 다 담기지 않았어요. 조금 줄여 보세요'); },
  get example() { return t('maker.example-added', '예시 문장을 넣었어요'); },
  get imageFail() { return t('maker.image-fail', '이미지를 만들지 못했어요, 다시 시도해 주세요'); },
  get saved() { return t('maker.saved', '엽서를 이미지로 저장했어요'); },
  get savedLink() { return t('maker.saved-link', '저장이 안 됐다면 새 탭에서 열기'); },
  get opened() { return t('maker.opened', '새 탭에 엽서를 띄웠어요. 그림을 길게 눌러 저장해 주세요'); },
  get emailInvalid() { return t('maker.email-invalid', '이메일 주소를 다시 확인해 주세요'); },
  get mailSent() { return t('maker.mail-sent', '엽서를 보냈어요! 메일함을 확인해 주세요'); },
  get mailInlineNote() { return t('maker.mail-inline-note', "Gmail 등 일부 메일에서는 엽서 그림이 안 보일 수 있어요. 그럴 땐 '이미지로 저장'을 써 주세요"); },
  // 화면 낭독기에만 알리는 글자 수 안내(눈으로는 글자 수 강조가 보인다)
  get countNear() { return t('maker.count-near', '{max}자까지 쓸 수 있어요. 얼마 남지 않았어요', { max: MAX_TEXT }); },
  get countFull() { return t('maker.count-full', '{max}자를 모두 채웠어요. 더는 쓸 수 없어요', { max: MAX_TEXT }); },
};
const BUSY_LABEL = {
  get convert() { return t('maker.busy-convert', '바꾸는 중…'); },
  get save() { return t('maker.busy-save', '그리는 중…'); },
  get send() { return t('maker.busy-send', '보내는 중…'); },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 사용자가 쓴 글에서 그림으로 옮길 수 없는 글자를 걸러 낸다. 엽서는 SVG 를 거쳐 그림이 되는데, 눈에 보이지 않는
// 제어 문자(다른 프로그램에서 복사한 글에 섞여 온다)나 반쪽만 남은 이모지가 한 글자라도 있으면 그림이 만들어지지 않는다.
const tidy = (value) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000B\u000C]/g, '\n') // 세로 탭 · 쪽 넘김 = 다른 프로그램의 줄바꿈
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (ch) => (ch.length === 2 ? ch : ''));

/* ── 엽서(.postcard) 그리기 ─────────────────────────────────────────────────── */

// 우표의 톱니 테두리: 네 변에 반달 모양 구멍을 낸 사각형(SVG path)
function perforatedEdge(width, height, step, radius) {
  const side = (count, line, arc) => {
    let d = '';
    for (let i = 0; i < count; i += 1) d += `${line}${step / 2 - radius}a${radius} ${radius} 0 0 0 ${arc}${line}${step / 2 - radius}`;
    return d;
  };
  const cols = Math.round(width / step);
  const rows = Math.round(height / step);
  return `M0 0${side(cols, 'h', `${radius * 2} 0`)}${side(rows, 'v', `0 ${radius * 2}`)}${side(cols, 'h-', `${-radius * 2} 0`)}${side(rows, 'v-', `0 ${-radius * 2}`)}Z`;
}

// css/base.css 의 토큰 값을 읽는다('--paper-50' → '#fbf6ea')
const token = (name) => escapeHTML(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'currentColor');

// 그림으로 옮겨도 깨지지 않는 인라인 SVG 우표(mask · filter 를 쓰지 않는다). 그림은 shared.js 의 감귤.
// 엽서를 그림으로 옮길 때 SVG 안쪽 요소에는 css 클래스의 색이 따라가지 않는다 → 색 · 글꼴을 속성으로 직접 적는다
// ✏️ 교체: 우표 아래 글자 'JEJU'
function stampHTML() {
  const edge = perforatedEdge(100, 120, 10, 2.9);
  const art = stampSVG('tangerine').replace(/^<svg[^>]*>|<\/svg>\s*$/g, '');
  const paper = token('--paper-50');
  const ink = token('--basalt-900');
  return `<svg viewBox="0 0 100 120" aria-hidden="true" focusable="false">
    <path d="${edge}" transform="translate(1.8 2.6)" fill="${ink}" fill-opacity="0.2"/>
    <path d="${edge}" fill="${paper}" stroke="${ink}" stroke-opacity="0.22" stroke-width="0.8"/>
    <rect x="9.5" y="9.5" width="81" height="101" fill="${token('--tangerine-500')}"/>
    <rect x="13" y="13" width="74" height="94" fill="none" stroke="${ink}" stroke-width="1.3"/>
    <g transform="translate(15.5 9.5) scale(1.5)" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${art}</g>
    <text x="51.5" y="99" text-anchor="middle" fill="${ink}" font-family="${SVG_FONT}" font-size="12.5" font-weight="800" letter-spacing="2.6">JEJU</text>
  </svg>`;
}

// 엽서 한 장의 틀. 글은 fillPostcard 가 textContent 로 넣는다(사용자가 쓴 글을 innerHTML 로 넣지 않는다)
// data-capture-lines = 그림으로 옮길 때 화면에 보이는 줄바꿈 그대로 그린다(js/postcard-image.js)
// ✏️ 교체: 빈 엽서의 안내 문구, 꼬리표 '표준어', 소인 둘레 글자 'JEJU POST' · '제주', 'To.' · 'From.'
//          (아래 인쇄 글자 'POSTCARD · 웹진 이름' 은 fillPostcard 에 있다)
function postcardHTML() {
  return `<div class="postcard" data-postcard data-empty="true">
    <span class="postcard__band" aria-hidden="true"></span>
    <div class="postcard__paper">
      <span class="postcard__laid" data-capture-detail aria-hidden="true"></span>
      <span class="postcard__grain" data-capture-skip aria-hidden="true"></span>
      <div class="postcard__message">
        <div class="postcard__message-in">
          <p class="postcard__hint">${tHTML('maker.card-hint', '여기에 제주어 엽서가\n나타나요').replace(/\n/g, '<br>')}</p>
          <p class="postcard__jeju" data-pc="jeju" data-capture-lines></p>
          <p class="postcard__original" data-pc="original-row"><span class="postcard__tag">표준어</span><span data-pc="original" data-capture-lines></span></p>
        </div>
      </div>
      <div class="postcard__side">
        <div class="postcard__post" aria-hidden="true">
          <span class="postcard__stamp">${stampHTML()}</span>
          <span class="postmark postcard__postmark">${postmarkSVG({ top: 'JEJU POST', bottom: '제주', date: todayKR() })}</span>
        </div>
        <div class="postcard__lines">
          <p class="postcard__line"><span class="postcard__line-label">To.</span><span class="postcard__line-name" data-pc="to"></span></p>
          <p class="postcard__line"><span class="postcard__line-label">From.</span><span class="postcard__line-name" data-pc="from"></span></p>
        </div>
        <svg class="postcard__print" viewBox="0 0 300 22" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false"><text x="299" y="16" text-anchor="end" fill="${token('--basalt-500')}" font-family="${SVG_FONT}" font-size="11.5" font-weight="700" letter-spacing="1.8" data-pc="print"></text></svg>
      </div>
    </div>
  </div>`;
}

// 받는 사람 · 보내는 사람: 한 줄에 들어갈 때까지 글자를 줄이고, 그래도 넘치면 두 줄로
function fitNames(card) {
  card.querySelectorAll('.postcard__line-name').forEach((el) => {
    el.removeAttribute('data-wrap');
    const fits = NAME_SIZES.some((size) => {
      el.style.setProperty('--pc-name', String(size));
      return el.scrollWidth <= el.clientWidth + 1;
    });
    if (!fits) el.dataset.wrap = 'true';
  });
}

// low(들어간다) ~ high(넘친다) 사이에서 들어가는 가장 큰 값을 찾는다(소수 둘째 자리까지)
function largestFit(low, high, fits) {
  let ok = low;
  let over = high;
  for (let i = 0; i < 8; i += 1) {
    const mid = (ok + over) / 2;
    if (fits(mid)) ok = mid;
    else over = mid;
  }
  return Math.floor(ok * 100) / 100;
}

// cqw 단위(엽서 폭의 1%)를 아는 브라우저인가 — 모르는 브라우저(Safari 15)에서는 아래 fitPostcard 가 --u 를 직접 적는다
const knowsCqw = () => Boolean(window.CSS && CSS.supports && CSS.supports('width', '1cqw'));

// 본문: 칸에 다 들어가는 가장 큰 글자 크기를 찾는다. 엽서가 화면에 보일 때만 잴 수 있다.
//   --pc-fs  = 제주어 본문,  --pc-sub = 원문(작게). 둘 다 엽서 폭의 %
// 여러 줄로 나눠 쓴 글은 나눈 줄이 접히지 않는 크기를 먼저 찾는다(위의 KEEP_LINES_RATIO).
// 가장 작은 크기로도 넘치면 data-overflow="true" 를 붙이고 false 를 돌려준다
function fitPostcard(card) {
  const box = card.querySelector('.postcard__message');
  const inner = card.querySelector('.postcard__message-in');
  if (!box || !inner || !box.clientHeight) return true;

  // 안쪽 치수의 기준 --u(엽서 폭의 1%): css 의 어림값(4.6px)은 휴대폰의 작은 엽서에서 너무 크다 → 실제 폭으로 적는다.
  // 엽서 크기가 바뀔 때마다 이 함수가 다시 불리므로(watchSize) 값도 따라 바뀐다
  if (!knowsCqw() && card.clientWidth) card.style.setProperty('--u', `${card.clientWidth / 100}px`);

  const boxStyle = getComputedStyle(box);
  const room = box.clientHeight - parseFloat(boxStyle.paddingTop) - parseFloat(boxStyle.paddingBottom);
  const subOf = (size) => Math.min(Math.max(size * SUB_RATIO, SUB_MIN), SUB_MAX);
  const fits = (size, sub = subOf(size)) => {
    card.style.setProperty('--pc-fs', String(size));
    card.style.setProperty('--pc-sub', String(sub));
    return inner.offsetHeight <= room + 0.5 && inner.scrollWidth <= inner.clientWidth + 1;
  };

  // 쓴 사람이 직접 나눈 줄이 중간에서 접히지 않는가: 저절로는 줄이 바뀌지 않게 해 보고(white-space: pre) 높이가 그대로인지 본다
  const jeju = card.querySelector('[data-pc="jeju"]');
  const keepsLines = (size) => {
    if (!fits(size)) return false;
    const inline = jeju.style.whiteSpace;
    const wrapped = jeju.offsetHeight;
    jeju.style.whiteSpace = 'pre';
    const unwrapped = jeju.offsetHeight;
    jeju.style.whiteSpace = inline;
    return Math.abs(wrapped - unwrapped) < 1;
  };

  // 1. 제주어 본문을 되도록 크게
  let size = FS_MAX;
  let ok = fits(size);
  if (!ok) {
    ok = fits(FS_MIN);
    size = ok ? largestFit(FS_MIN, FS_MAX, fits) : FS_MIN;
  }
  // 1-1. 여러 줄로 나눠 쓴 글인데 그 크기에서 줄이 한 번 더 접힌다면: 접히지 않는 가장 큰 크기로 줄인다(너무 작아지지 않을 때만)
  if (ok && jeju && jeju.textContent.trim().includes('\n') && !keepsLines(size)) {
    const floor = Math.max(FS_MIN, size * KEEP_LINES_RATIO);
    if (keepsLines(floor)) size = largestFit(floor, size, keepsLines);
  }
  // 2. 자리가 남으면 원문도 조금 키운다(제주어 본문보다는 눈에 띄게 작게)
  const subMax = Math.min(SUB_MAX, size * SUB_RATIO_MAX);
  let sub = subOf(size);
  if (ok && subMax > sub) sub = fits(size, subMax) ? subMax : largestFit(sub, subMax, (value) => fits(size, value));
  fits(size, sub);

  card.dataset.overflow = String(!ok);
  fitNames(card);
  return ok;
}

// 엽서에 글을 채운다. jeju 가 비어 있으면 '빈 엽서'(안내 문구) 상태
function fillPostcard(card, { jeju = '', original = '', to = '', from = '', showOriginal = true } = {}) {
  const part = (name) => card.querySelector(`[data-pc="${name}"]`);
  // 어디서 온 글이든(사용자 입력 · 변환 결과 · data- 속성) 그림으로 옮길 수 없는 글자는 여기서 한 번 더 거른다
  part('jeju').textContent = tidy(jeju);
  part('original').textContent = tidy(original);
  part('to').textContent = tidy(to);
  part('from').textContent = tidy(from);
  // ✏️ 교체: 엽서 아래의 작은 인쇄 글자('POSTCARD · ' 뒤는 config.js 의 site.name)
  part('print').textContent = `POSTCARD · ${getConfig().site.name}`;
  // 원문이 제주어와 똑같으면 두 번 보여 줄 필요가 없다
  part('original-row').hidden = !(showOriginal && original && original !== jeju);
  card.dataset.empty = String(!jeju);
  return fitPostcard(card);
}

// 손글씨 글꼴이 늦게 도착하면 글자 폭이 달라진다 → 도착한 뒤 한 번 더 맞춘다
function refitWhenFontReady(card) {
  if (!document.fonts || !document.fonts.load) return;
  const family = getComputedStyle(card).fontFamily;
  document.fonts.load(`32px ${family}`, card.textContent || '가').then(() => fitPostcard(card), () => {});
}

// 엽서 크기가 바뀌거나(창 크기 · 숨었다가 나타남) 글꼴이 뒤늦게 도착하면 다시 맞춘다
function watchSize(card, onFit = () => {}) {
  const refit = () => onFit(fitPostcard(card));
  if ('ResizeObserver' in window) new ResizeObserver(refit).observe(card);
  // 글꼴 스타일은 화면을 먼저 그린 뒤에 적용된다(<head> 의 media="print" onload) → 손글씨 글꼴이 처음 맞춘 뒤에 도착할 수 있다
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refit);
}

/* ── 마크업 ───────────────────────────────────────────────────────────────── */

// 플로팅 버튼: 짙은 알약에 두 줄 글자(제목 · 작은 설명) + 오른쪽 위로 삐져나온 우표('인트로 사진/우표'). 이름은 위의 TEXT.fab. ✏️ 우표 그림을 바꾸려면 아래 src
// link 가 있으면(바깥 링크 모드) 그 주소를 새 탭으로 여는 링크로, 없으면 변환 창을 여는 단추로 만든다
const fabInner = () => `<span class="fab__text" aria-hidden="true"><b class="fab__title">${escapeHTML(TEXT.fab)}</b><span class="fab__sub">${escapeHTML(TEXT.fabSub)}</span></span>
  <img class="fab__stamp" src="${STAMP_SRC}" alt="" width="478" height="640" decoding="async">`;
const fabHTML = (link = '', newTab = true) =>
  link && !newTab
    ? `<a class="fab" href="${escapeHTML(link)}" data-track-cta data-track-location="fab" aria-label="${escapeHTML(TEXT.fab)}">
  ${fabInner()}
</a>`
    : link
    ? `<a class="fab" href="${escapeHTML(withCampaign(link, 'fab'))}" target="_blank" rel="noopener" data-track-cta data-track-location="fab" aria-label="${escapeHTML(`${TEXT.fab} (${TEXT.newTab})`)}">
  ${fabInner()}
</a>`
    : `<button type="button" class="fab" data-open-maker data-track-location="fab" aria-haspopup="dialog" aria-label="${escapeHTML(TEXT.fab)}">
  ${fabInner()}
</button>`;

// config.js 의 links.postcard — 엽서 쓰기를 맡을 주소. http · https 로 시작하는 전체 주소,
// 또는 (31차) 이 사이트 안의 경로(예: 'postcard/' — 웹진 첫 화면 기준. GitHub 통합본처럼 엽서 사이트를 같은 사이트 안에 둘 때)
// 비어 있으면 ''(변환 창을 쓴다). 그 밖의 값(javascript: · // 로 시작하는 주소 등)은 무시하고 콘솔에 알린다
export function postcardLink() {
  const raw = String(getConfig().links.postcard ?? '').trim();
  if (!raw) return '';
  try {
    const url = /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//') ? new URL(raw) : new URL(raw, SITE_ROOT);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !raw.startsWith('//')) return url.href;
  } catch { /* 주소 꼴이 아니다 → 아래 경고로 */ }
  console.warn(`[maker] config.js 의 links.postcard 는 https:// · http:// 로 시작하는 전체 주소나 이 사이트 안의 경로(예: postcard/)여야 해요. 지금 값(${raw})은 무시하고 변환 창을 엽니다.`);
  return '';
}

const chipsHTML = () =>
  EXAMPLES.map((text) => `<button type="button" class="maker__chip" data-maker-chip>${escapeHTML(text)}</button>`).join('');

// ✏️ 교체: 모달 안의 글 — 안내 한 줄, 입력칸 이름(받는 사람 · 보내는 사람), 단추 이름, 메일 안내문(언어별 문구는 data/i18n/*.json 의 같은 키).
//          단추 이름은 data-label 과 단추 글자가 같은 키를 쓴다(일하는 동안의 '…하는 중' 은 위의 BUSY_LABEL)
const modalHTML = () => `<div class="maker" data-maker hidden>
  <div class="maker__backdrop" data-maker-close></div>
  <section class="maker__panel paper" role="dialog" aria-modal="true" aria-labelledby="maker-title" data-step="write">
    <div class="airmail-strip maker__strip" aria-hidden="true"></div>
    <div class="maker__head">
      <div>
        <p class="eyebrow" lang="en">Postcard Maker</p>
        <h2 id="maker-title" class="section-title maker__title">${escapeHTML(TEXT.title)}</h2>
      </div>
      <button type="button" class="maker__close" data-maker-close aria-label="${tHTML('maker.close', '닫기')}">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.5c4.7 4.2 9 8.6 13.3 13.3M18.6 5c-4.3 4.6-8.8 9-13.5 13.6"/></svg>
      </button>
    </div>

    <div class="maker__body">
      <form class="maker__write" data-maker-form novalidate>
        <label class="maker__guide" for="maker-text">${tHTML('maker.guide', '표준어로 편지나 한 줄 글을 써 보세요')}</label>
        <div class="maker__sheet">
          <textarea id="maker-text" class="maker__text" maxlength="${MAX_TEXT}" rows="5" placeholder="${tHTML('maker.placeholder', '예) 어서 오세요')}" aria-describedby="maker-count"></textarea>
          <p id="maker-count" class="maker__count" data-maker-count><span class="visually-hidden">${tHTML('maker.count-label', '글자 수')} </span><b data-maker-count-now>0</b> / ${MAX_TEXT}</p>
          <p class="visually-hidden" role="status" aria-live="polite" data-maker-count-live></p>
        </div>
        <div class="maker__chips" role="group" aria-label="${tHTML('maker.examples-label', '예시 문장')}">
          <span class="maker__chips-label" aria-hidden="true">${tHTML('maker.examples', '예시')}</span>${chipsHTML()}
        </div>
        <div class="maker__names">
          <label class="maker__field"><span class="maker__label">${tHTML('maker.to', '받는 사람')} <small>${tHTML('maker.optional', '(선택)')}</small></span><input class="maker__input" type="text" maxlength="${MAX_NAME}" autocomplete="off" data-maker-to></label>
          <label class="maker__field"><span class="maker__label">${tHTML('maker.from', '보내는 사람')} <small>${tHTML('maker.optional', '(선택)')}</small></span><input class="maker__input" type="text" maxlength="${MAX_NAME}" autocomplete="off" data-maker-from></label>
        </div>
        <div class="maker__write-foot">
          <button type="submit" class="btn maker__convert" data-maker-convert data-label="${tHTML('maker.convert', '제주어로 바꾸기')}" disabled>${tHTML('maker.convert', '제주어로 바꾸기')}</button>
          <p class="maker__status" data-maker-status="write" role="status" aria-live="polite"></p>
        </div>
      </form>

      <div class="maker__result" data-maker-result>
        <div class="maker__desk" data-maker-desk data-stale="false">
          <span class="tape maker__tape" aria-hidden="true"></span>
          <div class="maker__card" role="group" aria-label="${tHTML('maker.preview-label', '엽서 미리보기')}">${postcardHTML()}</div>
          <p class="maker__stale" data-maker-stale hidden>${escapeHTML(MSG.stale)}</p>
        </div>
        <details class="maker__plain" data-maker-plain hidden>
          <summary>${tHTML('maker.plain', '바꾼 글 크게 보기')}</summary>
          <p class="maker__plain-text" data-maker-plain-text></p>
        </details>
        <label class="maker__toggle"><input type="checkbox" data-maker-original checked>${tHTML('maker.show-original', '원문(표준어) 함께 보기')}</label>
        <div class="maker__actions">
          <button type="button" class="btn" data-maker-save data-label="${tHTML('maker.save', '이미지로 저장')}" disabled>${tHTML('maker.save', '이미지로 저장')}</button>
          <button type="button" class="btn btn--ink" data-maker-mail aria-expanded="false" aria-controls="maker-mail" disabled>${tHTML('maker.mail', '메일로 받기')}</button>
          <button type="button" class="maker__again" data-maker-again hidden>${tHTML('maker.again', '다시 쓰기')}</button>
        </div>
        <p id="maker-result-status" class="maker__status" data-maker-status="result" role="status" aria-live="polite"></p>
        <form id="maker-mail" class="maker__mail" data-maker-mailform novalidate hidden>
          <label class="maker__label" for="maker-email">${tHTML('maker.email-label', '엽서를 받을 이메일 주소')}</label>
          <div class="maker__mail-row">
            <input id="maker-email" class="maker__input" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com" aria-describedby="maker-mail-note">
            <button type="submit" class="btn btn--s" data-maker-send data-label="${tHTML('maker.send', '보내기')}">${tHTML('maker.send', '보내기')}</button>
          </div>
          <p id="maker-mail-note" class="maker__note">${tHTML('maker.mail-note', '이 사이트는 주소를 따로 저장하지 않아요. 메일은 EmailJS를 통해 발송돼요')}</p>
        </form>
      </div>
    </div>
  </section>
</div>`;

/* ── 견본 엽서('엽서 쓰기' 섹션) ───────────────────────────────────────────── */

// <figure data-postcard-sample data-jeju="…" data-original="…"> 안에 엽서를 그린다(장식 — 글은 figcaption 이 읽어 준다)
function mountSample(host) {
  if (host.querySelector('.postcard')) return;
  const wrap = document.createElement('div');
  wrap.className = 'write__card';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<span class="tape write__tape"></span>${postcardHTML()}`;
  host.append(wrap);

  const card = wrap.querySelector('.postcard');
  const { jeju = '', original = '', to = '', from = '' } = host.dataset;
  fillPostcard(card, { jeju, original, to, from });
  refitWhenFontReady(card);
  watchSize(card);
}

/* ── 모달 ─────────────────────────────────────────────────────────────────── */

// 플로팅 버튼을 붙인 뒤 두 모드가 함께 하는 일
function watchFab(fab) {
  const html = document.documentElement;
  // 버튼의 실제 폭을 css 에 알려 준다(--fab-w) — 글자 수(언어)에 따라 폭이 달라져도 지도 저작권 표시 등이 버튼만큼 비켜난다
  if (fab && 'ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (fab.offsetWidth) html.style.setProperty('--fab-w', `${fab.offsetWidth}px`);
    }).observe(fab);
  }
  // (36차) 예전에는 '엽서 쓰기' 단추가 보일 때 · 다른 단추와 겹칠 때 버튼을 숨겼다(write-in-view · watchAvoid) —
  // 스크롤하면 깜빡이며 사라져 뺐다(사용자). 버튼은 인트로 · 엽서 쓰기 창이 열린 동안만 숨는다(css/maker.css '2.')
}

// 링크 모드: 모달 없이 플로팅 버튼(링크)만 붙이고, data-open-maker 단추도 같은 주소로 간다.
// newTab = true → 새 탭(바깥 사이트), false → 같은 탭(21차: 이 사이트의 엽서 쓰러가기 쪽 play/postcard/)
function initLink(root, link, newTab = true) {
  root.insertAdjacentHTML('beforeend', fabHTML(link, newTab));
  // 이 단추들은 이제 창(dialog)을 여는 단추가 아니라 다른 사이트로 가는 링크다 → 화면 낭독기에도 그렇게 알린다
  // 새 탭으로 열린다는 것도 화면 낭독기에 알린다(플로팅 버튼의 이름처럼 보이는 글자 뒤에 괄호로 — 화면에는 보이지 않는다)
  document.querySelectorAll('[data-open-maker]').forEach((el) => {
    el.removeAttribute('aria-haspopup');
    if (el.tagName !== 'BUTTON') return;
    el.setAttribute('role', 'link');
    if (newTab && !el.getAttribute('aria-label')) el.insertAdjacentHTML('beforeend', `<span class="visually-hidden"> (${escapeHTML(TEXT.newTab)})</span>`);
  });
  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-open-maker]') : null;
    if (!trigger) return;
    event.preventDefault();
    if (!newTab) {
      window.location.assign(link);
      return;
    }
    // 광고로 들어온 정보(utm …)를 엽서 쓰기 사이트에도 넘긴다(js/track.js 의 withCampaign)
    window.open(withCampaign(link, trigger.dataset.trackLocation || ''), '_blank', 'noopener');
  });
  watchFab(root.querySelector('.fab'));
}

// '제주어로 내 마음 전하기' 섹션의 예시 엽서 세 장: 몇 초마다 다음 장으로(마우스를 올리거나 포커스가 있으면 · 화면 밖이면 멈춘다).
// '동작 줄이기'에서는 저절로 넘기지 않는다. 아래 동그라미 단추로 직접 고를 수 있다.
// ✏️ 교체: 넘어가는 간격(밀리초)
const EXAMPLE_INTERVAL = 4500;
// (36차) 손가락 · 마우스로 좌우로 밀어 넘기기. 가로로 SWIPE_MIN px 넘게(세로보다 많이) 밀면 onStep(+1 | -1).
// 민 뒤에 따라오는 '누름'(엽서 크게 보기)은 한 번 막는다. 세로로 미는 손가락은 브라우저가 평소처럼 페이지를 스크롤한다(css 의 touch-action: pan-y)
const SWIPE_MIN = 40;
function onSwipe(el, onStep) {
  let start = null;
  let swiped = false;
  el.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY };
  });
  el.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
    swiped = true;
    setTimeout(() => { swiped = false; }, 0);
    onStep(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { start = null; });
  el.addEventListener('click', (event) => {
    if (!swiped) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  el.addEventListener('dragstart', (event) => event.preventDefault()); // 그림을 끌어 옮기지 않게
}

function initExamples(box) {
  const items = [...box.querySelectorAll('.write__example')];
  const dots = [...box.querySelectorAll('[data-example-dot]')];
  if (items.length < 2) return;
  let current = 0;
  let timer = null;
  let paused = false;
  let visible = true;
  const show = (n) => {
    current = (n + items.length) % items.length;
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === current);
      item.toggleAttribute('inert', i !== current);
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === current)));
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tick = () => {
    clearTimeout(timer);
    // 크게 보기 창이 열려 있는 동안은 넘기지 않는다(닫으면 포커스가 돌아갈 엽서가 그대로 있게)
    if (paused || !visible || reduce.matches || document.documentElement.classList.contains('zoom-open')) return;
    timer = setTimeout(() => { show(current + 1); tick(); }, EXAMPLE_INTERVAL);
  };
  dots.forEach((dot) => dot.addEventListener('click', () => { show(Number(dot.dataset.exampleDot) || 0); tick(); }));
  // 좌우 꺾쇠(27차): 앞 · 다음 장으로 바로(끝에서는 반대쪽 끝으로 돈다)
  box.querySelectorAll('[data-example-step]').forEach((btn) => btn.addEventListener('click', () => { show(current + (Number(btn.dataset.exampleStep) || 1)); tick(); }));
  // (36차) 좌우로 밀어 넘기기(사용자)
  onSwipe(box, (step) => { show(current + step); tick(); });
  box.addEventListener('pointerenter', () => { paused = true; tick(); });
  box.addEventListener('pointerleave', () => { paused = false; tick(); });
  box.addEventListener('focusin', () => { paused = true; tick(); });
  box.addEventListener('focusout', () => { paused = false; tick(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; tick(); }).observe(box);
  }
  reduce.addEventListener?.('change', tick);
  show(0);
  tick();
}

// 견본 엽서 크게 보기: 엽서를 누르면 화면 가운데에 크게(누른 엽서 자리에서 커지며 나온다 — '동작 줄이기'에서는 바로).
// 휴대폰(폭 599px 이하)은 글이 읽히는 세로판(data-zoom-m), 넓은 화면은 가로판. 닫기 = 닫기 단추 · 바깥 누르기 · Esc, 좌우 단추 · ← → 로 다른 장.
// 생김새는 css/maker.css '7-2.'
const ZOOM_ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>',
};

function initZoom(box) {
  const buttons = [...box.querySelectorAll('[data-example-zoom]')];
  if (!buttons.length) return;
  const html = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let layer = null;
  let parts = {};
  let index = 0;
  let opener = null;

  const build = () => {
    layer = document.createElement('div');
    layer.className = 'zoom';
    layer.hidden = true;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', TEXT.zoomLabel);
    const many = buttons.length > 1;
    layer.innerHTML = `
      <div class="zoom__backdrop" data-zoom-close></div>
      <figure class="zoom__figure">
        <picture><source class="zoom__source" media="(max-width: 599px)"><img class="zoom__img" alt="" decoding="async"></picture>
      </figure>
      <button type="button" class="zoom__btn zoom__close" data-zoom-close aria-label="${escapeHTML(TEXT.zoomClose)}">${ZOOM_ICON.close}</button>
      ${many ? `<button type="button" class="zoom__btn zoom__nav zoom__nav--prev" data-zoom-step="-1" aria-label="${escapeHTML(TEXT.zoomPrev)}">${ZOOM_ICON.prev}</button>
      <button type="button" class="zoom__btn zoom__nav zoom__nav--next" data-zoom-step="1" aria-label="${escapeHTML(TEXT.zoomNext)}">${ZOOM_ICON.next}</button>` : ''}`;
    document.body.append(layer);
    parts = {
      figure: layer.querySelector('.zoom__figure'),
      source: layer.querySelector('.zoom__source'),
      img: layer.querySelector('.zoom__img'),
      close: layer.querySelector('.zoom__close'),
    };
    layer.addEventListener('click', (event) => {
      const el = event.target instanceof Element ? event.target : null;
      if (!el) return;
      if (el.closest('[data-zoom-close]')) close();
      const step = el.closest('[data-zoom-step]');
      if (step) fill(index + Number(step.dataset.zoomStep));
    });
    // (36차) 크게 본 엽서도 좌우로 밀어 넘기기
    if (many) onSwipe(parts.figure, (dir) => fill(index + dir));
    layer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        fill(index + (event.key === 'ArrowLeft' ? -1 : 1));
      } else if (event.key === 'Tab') {
        // 창 안의 단추들 사이에서만 돈다
        const focusables = [...layer.querySelectorAll('button')];
        const at = focusables.indexOf(document.activeElement);
        const next = (at + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
        event.preventDefault();
        focusables[next].focus();
      }
    });
  };

  const fill = (i) => {
    index = (i + buttons.length) % buttons.length;
    const thumb = buttons[index].querySelector('img');
    parts.source.srcset = buttons[index].dataset.zoomM || thumb.currentSrc || thumb.src;
    parts.img.src = thumb.currentSrc || thumb.src;
    parts.img.alt = thumb.alt;
  };

  // 누른 엽서 자리 → 화면 가운데로 커지며 나온다(그림이 준비된 뒤에 잰다. 늦으면 0.4초 뒤 그냥)
  const grow = (from) => {
    if (reduce.matches || typeof parts.figure.animate !== 'function') return;
    const ready = parts.img.decode ? parts.img.decode().catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise((r) => setTimeout(r, 400))]).then(() => {
      const to = parts.figure.getBoundingClientRect();
      if (!to.width || !from.width) return;
      const scale = Math.min(1, from.width / to.width);
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      parts.figure.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.35 },
        { transform: 'none', opacity: 1 },
      ], { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    });
  };

  function open(i, button) {
    if (!layer) build();
    opener = button;
    fill(i);
    layer.hidden = false;
    html.classList.add('zoom-open');
    parts.close.focus({ preventScroll: true });
    grow(button.getBoundingClientRect());
    track('example_zoom', { sample: i + 1, name: button.dataset.zoomName || '' });
  }

  function close() {
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    html.classList.remove('zoom-open');
    if (opener && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => open(i, button)));
}

export function init(root = document.body) {
  if (!root || document.querySelector('.fab, [data-maker]')) return;

  root.querySelectorAll('[data-postcard-sample]').forEach(mountSample);
  root.querySelectorAll('[data-write-examples]').forEach((box) => {
    initExamples(box);
    initZoom(box);
  });
  // 21차: 엽서 쓰러가기는 이 사이트의 쪽(play/postcard/ — '/'로 끝나는 주소)에서 한다.
  // 다른 쪽(서브 메인 · 기사)의 '제주어 엽서 써보기' · 플로팅 버튼은 그 쪽으로 가는 링크(같은 탭 — 체류 시간이 이어서 재진다).
  // 그 쪽에서는 config.js 의 바깥 주소(links.postcard)가 있으면 바깥 사이트를 안에 띄우고(js/play.js), 없으면 아래 변환 창을 바로 연다
  const pageMode = document.body.dataset.page === 'postcard';
  if (!pageMode) {
    initLink(root, PLAY_URL, false);
    return;
  }
  if (postcardLink()) return;

  root.insertAdjacentHTML('beforeend', modalHTML());
  // 변환 파일을 미리 받아 둔다(첫 변환이 늦지 않게). 불러오지 못하면 고칠 사람이 알 수 있게 콘솔에 남긴다
  loadConverter().catch((err) => console.error('[maker] js/convert.js 를 불러오지 못했어요(변환이 실패합니다)', err));

  const html = document.documentElement;
  const modal = root.querySelector('[data-maker]');
  const find = (selector) => modal.querySelector(selector);
  const els = {
    fab: root.querySelector('.fab'),
    panel: find('.maker__panel'),
    write: find('[data-maker-form]'),
    text: find('#maker-text'),
    count: find('[data-maker-count]'),
    countNow: find('[data-maker-count-now]'),
    countLive: find('[data-maker-count-live]'),
    to: find('[data-maker-to]'),
    from: find('[data-maker-from]'),
    convert: find('[data-maker-convert]'),
    writeStatus: find('[data-maker-status="write"]'),
    result: find('[data-maker-result]'),
    desk: find('[data-maker-desk]'),
    card: find('[data-postcard]'),
    staleNote: find('[data-maker-stale]'),
    plain: find('[data-maker-plain]'),
    plainText: find('[data-maker-plain-text]'),
    original: find('[data-maker-original]'),
    save: find('[data-maker-save]'),
    mail: find('[data-maker-mail]'),
    again: find('[data-maker-again]'),
    mailForm: find('[data-maker-mailform]'),
    email: find('#maker-email'),
    send: find('[data-maker-send]'),
    resultStatus: find('[data-maker-status="result"]'),
  };

  let isOpen = false;
  let opener = null; // 모달을 연 단추(닫으면 여기로 포커스를 돌려준다)
  let busy = ''; // '' | 'convert' | 'save' | 'send'
  let result = null; // { source: 바꾸기 전 글, jeju: 바꾼 글 }
  let wasStale = false;
  let countZone = 0; // 글자 수 구간: 0 = 여유 · 1 = 얼마 안 남음 · 2 = 다 참
  let ticket = 0; // 늦게 도착한 옛 변환 결과를 버리려고
  let closing = false; // 그리는 · 보내는 도중에 닫았다 → 일이 끝난 뒤에 실제로 숨긴다
  let repaint = false; // 그리는 · 보내는 동안 미뤄 둔 엽서 고쳐 그리기
  let bodyPadding = null;
  const inerted = [];

  /* 상태 메시지 — role="status" 라 화면 낭독기가 읽어 준다. tone: info | ok | error
     note = 덧붙이는 작은 글, link = 덧붙이는 링크 { text, href }(새 탭에서 열린다),
     quiet = 화면을 움직이지 않는다(글을 쓰는 도중에 뜨는 안내) */
  function say(el, message = '', tone = 'info', { note = '', link = null, quiet = false } = {}) {
    el.textContent = '';
    el.removeAttribute('data-tone');
    if (!message) return;
    el.dataset.tone = tone;
    const main = document.createElement('span');
    main.textContent = message;
    el.append(main);
    if (note) {
      const small = document.createElement('small');
      small.className = 'maker__status-note';
      small.textContent = note;
      el.append(small);
    }
    if (link) {
      const anchor = document.createElement('a');
      anchor.className = 'maker__status-link';
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.textContent = link.text;
      el.append(anchor);
    }
    // 좁은 화면 · 화면 키보드 때문에 메시지가 화면 밖에 놓였으면 보이는 데까지만 끌어온다
    if (isOpen && !quiet) el.scrollIntoView({ block: 'nearest' });
  }

  // 좁은 화면에서는 쓰기 칸과 엽서 칸 가운데 하나만 보인다(css 가 data-step 을 보고 가른다)
  const isHidden = (el) => getComputedStyle(el).display === 'none';
  const setStep = (step) => { els.panel.dataset.step = step; };
  const textNow = () => tidy(els.text.value).trim(); // 지금 쓴 글(그림으로 옮길 수 있게 다듬은 것)
  const nameOf = (input) => tidy(input.value).replace(/\s+/g, ' ').trim();
  const isStale = () => Boolean(result) && textNow() !== result.source;
  const isDrawing = () => busy === 'save' || busy === 'send'; // 엽서를 그림으로 옮기는 중

  // 엽서의 글자가 너무 작게 줄었으면(긴 글 · 좁은 화면) 바꾼 글을 본문 글꼴로 크게 읽을 수 있게 내놓는다
  function syncPlain() {
    if (!result) {
      els.plain.hidden = true;
      els.plain.open = false;
      return;
    }
    els.plainText.textContent = result.jeju;
    const jeju = els.card.querySelector('[data-pc="jeju"]');
    if (!jeju.getClientRects().length) return; // 엽서가 보이지 않을 때는 잴 수 없다(보이게 되면 다시 잰다)
    els.plain.hidden = parseFloat(getComputedStyle(jeju).fontSize) >= SMALL_PRINT;
  }

  // 엽서에 지금 상태를 그린다. 엽서를 그림으로 옮기는 동안에는 건드리지 않고, 끝난 뒤에 그린다
  function paint() {
    if (isDrawing()) {
      repaint = true;
      return true;
    }
    const fits = fillPostcard(els.card, {
      jeju: result ? result.jeju : '',
      original: result ? result.source : '',
      to: nameOf(els.to),
      from: nameOf(els.from),
      showOriginal: els.original.checked,
    });
    syncPlain();
    return fits;
  }

  function toggleMail(show) {
    els.mailForm.hidden = !show;
    els.mail.setAttribute('aria-expanded', String(show));
  }

  // 주소 오류 표시: 틀렸을 때는 입력칸이 오류 메시지(상태 줄)도 함께 가리키게 한다
  function markEmail(invalid) {
    if (invalid) els.email.setAttribute('aria-invalid', 'true');
    else els.email.removeAttribute('aria-invalid');
    els.email.setAttribute('aria-describedby', invalid ? `${els.resultStatus.id} maker-mail-note` : 'maker-mail-note');
  }

  // 단추 · 글자 수 · '다시 바꿔야 함' 표시를 지금 상태에 맞춘다
  function sync() {
    const length = els.text.value.length;
    const hasText = textNow() !== '';
    const stale = isStale();
    const ready = Boolean(result) && !stale;

    els.countNow.textContent = String(length);
    els.count.dataset.warn = String(length > WARN_TEXT);
    // 글자 수 강조는 눈으로만 보인다 → 구간이 바뀔 때 화면 낭독기에도 한 번 알린다
    const zone = length >= MAX_TEXT ? 2 : length > WARN_TEXT ? 1 : 0;
    if (zone !== countZone) {
      els.countLive.textContent = zone > countZone ? (zone === 2 ? MSG.countFull : MSG.countNear) : '';
      countZone = zone;
    }

    els.convert.disabled = !hasText && busy !== 'convert';
    els.save.disabled = !ready && busy !== 'save';
    els.mail.disabled = !ready;
    els.original.disabled = !result;
    els.again.hidden = !result;

    // 일하는 중에는 단추를 '누를 수 없음'으로만 표시한다(disabled 로 바꾸면 키보드 포커스를 잃는다)
    [els.convert, els.save, els.mail, els.send].forEach((btn) => {
      if (busy) btn.setAttribute('aria-disabled', 'true');
      else btn.removeAttribute('aria-disabled');
    });
    [['convert', els.convert], ['save', els.save], ['send', els.send]].forEach(([name, btn]) => {
      const working = busy === name;
      btn.textContent = working ? BUSY_LABEL[name] : btn.dataset.label;
      if (working) btn.setAttribute('aria-busy', 'true');
      else btn.removeAttribute('aria-busy');
    });

    // 글을 고치면 엽서와 글이 어긋난다 → 저장 · 메일을 막고 다시 바꾸게 한다
    els.desk.dataset.stale = String(stale);
    els.staleNote.hidden = !stale;
    if (stale && !els.mailForm.hidden && busy !== 'send') toggleMail(false);
    if (stale && !wasStale) {
      say(els.writeStatus, MSG.stale, 'info', { quiet: true });
      // 앞선 저장 · 메일 안내(와 주소 오류 표시)는 이제 지금 글의 것이 아니다
      if (!isDrawing()) say(els.resultStatus);
      markEmail(false);
    }
    if (!stale && wasStale && els.writeStatus.textContent === MSG.stale) say(els.writeStatus);
    wasStale = stale;
  }

  function setBusy(kind) {
    busy = kind;
    sync();
    if (kind) return;
    // 일이 끝났다: 미뤄 둔 엽서 고쳐 그리기와 닫기를 마저 한다
    if (repaint) {
      repaint = false;
      paint();
    }
    finishClose();
  }

  /* 1 → 2. 제주어로 바꾸기 */
  async function convert() {
    const source = textNow();
    if (busy || !source) return;
    const mine = ++ticket;
    say(els.writeStatus);
    say(els.resultStatus);
    setBusy('convert');

    let jeju = '';
    try {
      // convert.js 를 불러오지 못했거나(문법 오류 · 함수 이름이 다름) 변환이 throw 해도 같은 안내로 간다
      const work = loadConverter().then((convertToJeju) => convertToJeju(source));
      const [value] = await Promise.all([withTimeout(work, CONVERT_TIMEOUT), sleep(MIN_BUSY)]);
      jeju = typeof value === 'string' ? tidy(value) : '';
      if (jeju.trim() === '') throw new Error('변환 결과가 비어 있어요');
    } catch (err) {
      console.error('[maker] 변환 실패', err);
      if (mine !== ticket) return;
      setBusy('');
      say(els.writeStatus, MSG.convertFail, 'error');
      return;
    }
    if (mine !== ticket) return;

    result = { source, jeju };
    toggleMail(false);
    setBusy('');
    // 바꾸는 사이에 글을 또 고쳤다면 이 엽서는 옛 글의 것이다 → 쓰기 칸에 머물며 '다시 바꿔 주세요' 만 알린다
    if (isStale()) {
      paint();
      say(els.writeStatus, MSG.stale, 'info', { quiet: true });
      return;
    }
    setStep('card');
    const fits = paint();
    refitWhenFontReady(els.card);

    const same = jeju.trim() === source;
    const [message, tone] = !fits ? [MSG.tooLong, 'info'] : same ? [MSG.same, 'info'] : [MSG.converted, 'ok'];
    track('maker_convert', { result: !fits ? 'too_long' : same ? 'same' : 'ok' });
    say(els.writeStatus, message, tone);
    // 좁은 화면에서는 쓰기 칸이 사라지고 엽서 칸이 나온다 → 안내와 포커스도 그쪽으로
    if (isHidden(els.write)) {
      say(els.resultStatus, message, tone);
      if (isOpen) els.save.focus({ preventScroll: true });
      find('.maker__body').scrollTop = 0;
    }
  }

  /* 3. 이미지로 저장 */
  async function save() {
    if (busy || !result || isStale()) return;
    say(els.resultStatus);
    setBusy('save');
    try {
      const dataUrl = await renderPNG(els.card, { width: IMAGE_WIDTH });
      const { started, url } = download(dataUrl, `jeju-postcard-${todayKR().replace(/\D/g, '')}.png`);
      // 내려받기가 실제로 됐는지는 알 수 없다(앱 속 브라우저 등) → 같은 그림을 새 탭에서 여는 길을 함께 내놓는다
      track('maker_save');
      if (started) say(els.resultStatus, MSG.saved, 'ok', { link: { text: MSG.savedLink, href: url } });
      else say(els.resultStatus, MSG.opened, 'ok');
    } catch (err) {
      console.error('[maker] 이미지 저장 실패', err);
      say(els.resultStatus, err && err.code === 'no-lib' ? err.message : MSG.imageFail, 'error');
    } finally {
      setBusy('');
    }
  }

  /* 4. 메일로 받기 */
  function openMail() {
    if (busy || !result || isStale()) return;
    const show = els.mailForm.hidden;
    toggleMail(show);
    if (!show) return;
    els.email.focus();
    // 설정이 안 된 사이트라면 주소를 적기 전에 미리 알려 준다
    if (!isConfigured()) say(els.resultStatus, mailMessage('notConfigured'));
  }

  async function send() {
    if (busy || !result || isStale()) return;
    const to = els.email.value.trim();
    if (!EMAIL_RE.test(to)) {
      markEmail(true);
      els.email.focus();
      say(els.resultStatus, MSG.emailInvalid, 'error');
      return;
    }
    markEmail(false);
    // 키가 비어 있으면 보내지 않는다
    if (!isConfigured()) {
      say(els.resultStatus, mailMessage('notConfigured'), 'error');
      return;
    }

    say(els.resultStatus);
    // 메일의 '글자로 된 엽서'도 엽서 그림과 같게: 원문 줄이 엽서에 없으면(원문 보기를 껐거나 바뀐 곳이 없는 글) 원문을 싣지 않는다
    const showsOriginal = !els.card.querySelector('[data-pc="original-row"]').hidden;
    setBusy('send');
    try {
      const sent = await sendPostcard({
        to,
        jejuText: result.jeju,
        originalText: showsOriginal ? result.source : '',
        toName: nameOf(els.to),
        fromName: nameOf(els.from),
        node: els.card,
      });
      track('maker_mail');
      say(els.resultStatus, MSG.mailSent, 'ok', { note: sent && sent.mode === 'inline' ? MSG.mailInlineNote : '' });
    } catch (err) {
      // mailer.js 가 원인에 맞는 사용자 문구를 담아 던진다(MailError). '방금 보냈어요'(cooldown)는 오류가 아니라 안내
      const known = Boolean(err) && err.name === 'MailError';
      say(els.resultStatus, known ? err.message : mailMessage('unknown'), known && err.code === 'cooldown' ? 'info' : 'error');
      if (!known) console.error('[maker] 메일 발송 실패', err);
    } finally {
      setBusy('');
    }
  }

  /* 5. 다시 쓰기: 쓴 글은 남겨 두고(고쳐 쓰기 쉽게) 엽서만 비운다 */
  function rewrite() {
    if (busy) return;
    ticket += 1;
    result = null;
    toggleMail(false);
    markEmail(false);
    say(els.writeStatus);
    say(els.resultStatus);
    setStep('write');
    paint();
    sync();
    els.text.focus({ preventScroll: true });
    els.text.select();
  }

  /* 열고 닫기 */

  // 배경 스크롤 잠금: 스크롤바가 사라지며 화면이 옆으로 밀리지 않게 그 폭만큼 body 에 여백을 준다
  function lockScroll() {
    const gap = window.innerWidth - html.clientWidth;
    if (gap > 0) {
      bodyPadding = document.body.style.paddingRight;
      const now = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${now + gap}px`;
    }
    html.classList.add('maker-open');
  }

  function unlockScroll() {
    html.classList.remove('maker-open');
    if (bodyPadding === null) return;
    document.body.style.paddingRight = bodyPadding;
    bodyPadding = null;
  }

  // 모달 밖의 모든 것을 잠근다(키보드 · 화면 낭독기가 배경으로 나가지 않게)
  function setInert(on) {
    if (!on) {
      inerted.splice(0).forEach((el) => el.removeAttribute('inert'));
      return;
    }
    [...document.body.children].forEach((el) => {
      if (el === modal || el.hasAttribute('inert') || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) return;
      el.setAttribute('inert', '');
      inerted.push(el);
    });
  }

  // 실제로 보이는 화면(화면 키보드를 뺀 높이)에 모달을 맞춘다
  const viewport = window.visualViewport;
  function syncViewport() {
    if (!viewport || !isOpen) return;
    if (Math.abs(viewport.scale - 1) > 0.01) {
      // 손가락으로 확대한 상태에서는 건드리지 않는다
      modal.style.removeProperty('--maker-vh');
      modal.style.removeProperty('--maker-top');
      modal.removeAttribute('data-short');
      return;
    }
    modal.style.setProperty('--maker-vh', `${viewport.height}px`);
    modal.style.setProperty('--maker-top', `${viewport.offsetTop}px`);
    // 보이는 높이가 낮으면 css 가 머리글 · 편지지 · 아래 단추 줄을 줄여, 쓰는 칸이 가려지지 않게 한다
    if (viewport.height < SHORT_VIEW) modal.dataset.short = viewport.height < TINY_VIEW ? 'tiny' : 'true';
    else modal.removeAttribute('data-short');
  }

  // 닫는 중(아래 close 참고)이던 표시를 거둔다
  function clearClosing() {
    closing = false;
    modal.removeAttribute('data-closing');
    modal.removeAttribute('inert');
    modal.style.removeProperty('width');
    modal.style.removeProperty('height');
  }

  // 그리기 · 보내기가 끝났을 때: 그사이에 닫아 두었다면 이제 실제로 숨긴다
  function finishClose() {
    if (!closing) return;
    clearClosing();
    modal.hidden = true;
  }

  function open(trigger) {
    if (isOpen) return;
    isOpen = true;
    opener = trigger instanceof HTMLElement ? trigger : null;
    if (closing) clearClosing();
    lockScroll();
    modal.hidden = false;
    setInert(true);
    syncViewport();
    sync();
    paint();
    // 첫 입력칸으로. 좁은 화면에서 엽서 칸을 보던 중에 닫았다가 다시 열었다면 그 칸의 첫 단추로
    const first = !isHidden(els.write) ? els.text : els.save.disabled ? find('.maker__close') : els.save;
    first.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (isDrawing()) {
      // 엽서를 그림으로 옮기는 중에 숨기면(display: none) 깨진 그림이 저장되거나 메일로 나간다
      // → 눈에만 안 보이게 하고 크기를 그대로 붙잡아 둔 채, 일이 끝난 뒤에 숨긴다(finishClose)
      const box = modal.getBoundingClientRect();
      closing = true;
      modal.style.width = `${box.width}px`;
      modal.style.height = `${box.height}px`;
      modal.dataset.closing = 'true';
      modal.setAttribute('inert', '');
    } else {
      modal.hidden = true;
    }
    setInert(false);
    unlockScroll();
    const back = opener && opener.isConnected ? opener : els.fab;
    opener = null;
    if (back) back.focus({ preventScroll: true });
    // 엽서 쓰러가기 쪽에서는 닫으면 왔던 쪽(이 사이트)으로, 바로 들어왔으면 서브 메인으로
    let fromHere = false;
    try { fromHere = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch { /* 주소를 못 읽으면 서브 메인으로 */ }
    if (fromHere && history.length > 1) history.back();
    else window.location.assign(SITE_ROOT.href);
  }

  // Esc 로 닫기 + Tab 이 모달 안에서만 돌게 하기(포커스 트랩)
  function onKeydown(event) {
    if (!isOpen) return;
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...els.panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const inside = els.panel.contains(document.activeElement);
    if (event.shiftKey && (!inside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  /* 이벤트 */

  // data-open-maker 가 붙은 모든 요소(플로팅 버튼 · 엽서 쓰기 섹션의 '제주어 엽서 써보기' 단추)가 같은 모달을 연다
  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-open-maker]') : null;
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });
  document.addEventListener('keydown', onKeydown);
  if (viewport) {
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
  }

  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-maker-close]')) {
      close();
      return;
    }
    const chip = target.closest('[data-maker-chip]');
    if (chip && !busy) {
      els.text.value = chip.textContent;
      sync();
      if (!isStale()) say(els.writeStatus, MSG.example);
    }
  });

  els.text.addEventListener('input', (event) => {
    // 제한을 넘은 글은 잘라 낸다(maxlength 를 지키지 않는 입력 방식 대비). 한글을 조합하는 중에는 건드리지 않는다
    // (이모지처럼 두 칸짜리 글자가 반으로 잘리면 앞쪽 반도 마저 뺀다)
    if (!event.isComposing && els.text.value.length > MAX_TEXT) {
      els.text.value = els.text.value.slice(0, MAX_TEXT).replace(/[\uD800-\uDBFF]$/, '');
    }
    // 글을 고치기 시작하면 앞선 안내는 지운다('다시 바꿔 주세요' 는 sync 가 맡는다)
    if (els.writeStatus.dataset.tone && !isStale()) say(els.writeStatus);
    sync();
  });
  // Ctrl(⌘) + Enter 로도 바꾼다(그냥 Enter 는 줄바꿈)
  els.text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      convert();
    }
  });
  els.write.addEventListener('submit', (event) => {
    event.preventDefault();
    convert();
  });

  // 받는 사람 · 보내는 사람 · 원문 보기는 바꾸는 즉시 엽서에 나타난다(다시 바꿀 필요 없음)
  [els.to, els.from].forEach((input) => input.addEventListener('input', () => paint()));
  els.original.addEventListener('change', () => paint());
  els.save.addEventListener('click', save);
  els.mail.addEventListener('click', openMail);
  els.again.addEventListener('click', rewrite);
  els.mailForm.addEventListener('submit', (event) => {
    event.preventDefault();
    send();
  });
  els.email.addEventListener('input', () => markEmail(false));

  watchFab(els.fab);
  watchSize(els.card, syncPlain);
  sync();
  // 엽서 쓰러가기 쪽(play/postcard/): 변환 창을 바로 연다(닫으면 웹진으로 — 아래 close)
  open(null);
}
