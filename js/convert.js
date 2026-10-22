// convert.js — 표준어 → 제주어 변환. 변환 로직은 오직 이 파일에만 둔다.
//
// ── 변환 방식 교체 방법 ────────────────────────────────────────────────────────
// 화면 코드(maker.js · postcard-image.js · mailer.js)는 아래 함수 하나만 부른다.
//
//     export async function convertToJeju(text)  →  Promise<string>   (제주어 문장)
//
// · 이 이름과 모양(글을 받아 글을 돌려주는 async 함수)만 지키면 안쪽은 무엇으로 바꿔도 된다.
//   지금은 임시로, 출처를 확인한 낱말 몇 개만 바꾸는 '예시 사전'이 들어 있다.
// · 실패했을 때는 throw 하면 된다. 화면이 알아서 "변환에 실패했어요, 다시 시도해 주세요" 를 띄운다
//   (빈 글을 돌려줘도, 20초 안에 답이 없어도 실패로 본다 — js/maker.js 의 CONVERT_TIMEOUT).
//   그래서 이 파일에서는 화면(DOM)을 건드리지 않는다.
// · ✏️ 교체: 외부 API 로 바꿀 때 — 파일 맨 아래에 있는 convertToJeju 함수를 아래 모양으로 '바꿔 쓴다'.
//   새로 덧붙이면 안 된다: 같은 이름의 함수가 둘이면 파일 전체가 문법 오류가 되어 변환이 늘 실패한다.
//   (그 위의 예시 사전 PHRASES · WORDS · ENDINGS 와 도우미 함수들은 더 쓰지 않으니 함께 지워도 된다)
//
//     export async function convertToJeju(text) {
//       const res = await fetch('https://내-서버-주소/convert', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ text }),
//       });
//       if (!res.ok) throw new Error(`변환 서버 오류 (HTTP ${res.status})`);
//       const data = await res.json();
//       return data.jeju; // 서버가 돌려주는 제주어 문장
//     }
//
//   (API 키가 필요한 서비스는 키를 이 파일에 적지 말고, 키를 숨겨 주는 내 서버를 거쳐서 부른다)
// ──────────────────────────────────────────────────────────────────────────────

/* ── 임시 구현: 예시 사전 ─────────────────────────────────────────────────────
   출처를 확인한 표현만 담았다(제주어연구소 묻고 답하기 · 제주특별자치도 생활방언 · 제주어대사전 '제주어왓' ·
   제주도교육청 『제주의 말과 글』). ✏️ 교체: 낱말을 더할 때는 반드시 자료에서 확인하고, 지어내지 않는다.
   아래아(ㆍ)가 든 말은 완성형 표기(혼저 · 촘말로 · 호꼼)로 적었다(이 사전을 처음 쓸 때 쓰던 방식 — 그대로 두어도 된다).
   이제는 아래아 글꼴(css/base.css 의 Araea …)이 있어 조합형(ᄒᆞᆫ저 = ᄒ U+1112 + ᆞ U+119E + ᆫ U+11AB)으로 적어도 화면과 저장 그림에 한 글자로 보인다.
   조합형으로 적을 때는 NFC 로 저장하고, 호환 자모 ㆍ(U+318D) · 가운뎃점을 섞지 않는다(README '언어 전환'의 '아래아 글꼴과 입력').
   바꾸는 순서: 1) 문장 표현 → 2) 낱말 → 3) 어미. 같은 묶음 안에서는 긴 것부터(적은 순서는 상관없다). */

// 1) 문장 표현: [표준어, 제주어]. 띄어쓰기는 없어도 알아본다(어서오세요 = 어서 오세요).
//    물음꼴(안녕허우꽈 · 감수과 …)의 물음표는 붙이지 않는다 — 문장부호는 쓴 사람의 것을 그대로 둔다.
const PHRASES = [
  ['새해 복 많이 받으세요', '새해 복 만이 받읍서'], // 제주어연구소
  ['그동안 잘 지내셨습니까', '그동안 잘 지낸마씨'], // 제주어연구소
  ['조심해서 갔다 오십시오', '멩심허영 갓당 옵서'], // 도청 생활방언
  ['다음에 또 만나요', '다음에 또 만납주'], // 제주어연구소
  ['수고 많으셨습니다', '폭삭 속앗수다'], // 제주어연구소
  ['수고하셨습니다', '속앗수다'], // 제주어대사전 · 도청 생활방언
  ['어서 오십시오', '혼저 옵서'], // 도청 생활방언 · 제주어대사전
  ['어서 오세요', '혼저 옵서예'], // 교육청 『제주의 말과 글』
  ['안녕하십니까', '안녕허우꽈'], // 제주어연구소 · 도청 생활방언
  ['안녕하세요', '안녕허우꽈'], // 제주어연구소
  ['안녕히 가세요', '잘 갑서'], // 교육청 · 제주어연구소
  ['안녕히 계세요', '잘 이십서'], // 제주어연구소
  ['또 오세요', '또 옵서'], // 제주어연구소
  ['놀다 가세요', '놀당 갑서'], // 교육청 · 도청 생활방언
  ['쉬었다가 갑시다', '쉬엇당 갑주'], // 제주어연구소
  ['걱정 마십시오', '걱정 맙서'], // 도청 생활방언
  ['어디 가십니까', '어디 감수과'], // 교육청
  ['잘 지내시죠', '잘 지냄지예'], // 제주어연구소
  ['반갑습니다', '반갑수다'], // 제주어연구소
  ['고맙습니다', '고맙수다'], // 제주어연구소 · 교육청
  ['감사합니다', '감사허우다'], // 제주어연구소
  ['사랑합니다', '사랑헴수다'], // 제주어연구소
  ['환영합니다', '환영헴수다'], // 제주어연구소
  ['행복하세요', '행복헙서'], // 제주어연구소
  ['건강하세요', '건강허십서'], // 제주어연구소
  ['신났습니다', '지꺼졋수다'], // 제주어연구소 · 제주어대사전
  ['알았습니다', '알앗수다'], // 도청 생활방언
  ['좋습니다', '좋수다'], // 도청 생활방언
  ['아닙니다', '아니우다'], // 도청 생활방언
  ['너하고 나하고', '느영 나영'], // 도청 생활방언
];

// 2) 낱말: [표준어, 제주어, 조건]. 모두 '낱말의 첫머리'에서만 바꾼다(외할머니 · 불꽃 · 여동생 속은 건드리지 않는다).
//    조건 'alone'  = 뒤에 아무것도 붙지 않았을 때만(부사라서 조사가 붙으면 어색하다)
//    조건 'careful' = 뒤가 비었거나 조사만 붙었을 때만(잘못 바뀌기 쉬운 낱말: 나무라다 · 꽃잎 · 오늘날 등을 피한다)
//    받침 유무가 달라지는 낱말(할머니 → 할망, 동생 → 아시 …)은 조건을 적지 않아도 'careful' 로 다룬다 —
//    뒤에 붙은 말을 알아보지 못하면 '할망다 · 바당가재' 같은 틀린 꼴이 되므로 그대로 둔다.
const WORDS = [
  ['할아버지', '하르방'], // 제주어대사전
  ['할머니', '할망'], // 제주어대사전
  ['아버지', '아방'], // 제주어대사전
  ['어머니', '어멍'], // 제주어대사전
  ['동생', '아시'], // 제주어대사전 · 도청 제주어사전
  ['친척', '궨당'], // 제주어대사전
  ['바다', '바당'], // 제주어대사전
  ['나무', '낭', 'careful'], // 제주어대사전
  ['꽃', '꼿', 'careful'], // 제주어대사전
  ['많이', '하영'], // 제주어대사전
  ['조금', '호꼼'], // 제주어대사전 · 도청 생활방언
  ['모두', '몬딱', 'alone'], // 제주어대사전 · 도청 생활방언
  ['함께', '혼디', 'alone'], // 제주어대사전 · 도청 생활방언
  ['정말로', '촘말로'], // 도청 생활방언 · 제주어대사전
  ['오늘', '오널', 'careful'], // 제주어대사전
  // 아래는 잘못 바뀔 위험이 커서 꺼 둔다 — '바람직하다' · '~하는 바람에' · 소망을 뜻하는 '바람'까지 바뀌고,
  // 결과가 표준어 '보름(15일)'과 같은 글자가 된다.
  // ['바람', '보름', 'careful'], // 도청 생활방언 · 제주어대사전
];

// 3) 어미: [표준어, 제주어]
const ENDINGS = [
  ['했습니다', '헷수다'], // 도청 생활방언 · 제주어 표기법
  ['있습니다', '잇수다'], // 도청 생활방언 · 제주어연구소
  // 아래 둘은 잘못 바뀔 위험이 커서 꺼 둔다.
  // ['입니다', '이우다'], // 받침 없는 말 뒤에서는 '우다'이고, '보입니다' 같은 말까지 바뀐다
  // ['습니다', '수다'], // '먹습니다 · 읽습니다 · 없습니다'처럼 맞지 않는 말이 많다
];

// 받침에 따라 꼴이 달라지는 조사: [받침 뒤, 받침 없는 말 뒤]. 긴 것부터 살핀다.
const PARTICLES = [
  ['이에요', '예요'],
  ['이요', '요'],
  ['이랑', '랑'],
  ['으로', '로'],
  ['이', '가'],
  ['은', '는'],
  ['을', '를'],
  ['과', '와'],
];
// 받침과 상관없는 조사(위의 조사 뒤에 덧붙거나 서로 겹치기도 한다: 로는 · 와의 · 에서는 · 들이)
const PLAIN_PARTICLES = [
  '에게서', '한테서', '에게', '에서', '께서', '처럼', '까지', '부터', '한테', '보다', '마다', '조차', '마저', '하고',
  '도', '의', '에', '만', '는', '요', '께', '들',
];
const RIEUL = 8; // 받침 ㄹ

/* ── 한글 도우미 ───────────────────────────────────────────────────────────── */

const isHangul = (ch) => Boolean(ch) && ch >= '가' && ch <= '힣';
// 받침 번호: 0 = 받침 없음. 한글 음절은 유니코드에서 (초성 × 21 + 중성) × 28 + 받침 순서로 놓여 있다.
const batchim = (ch) => (isHangul(ch) ? (ch.charCodeAt(0) - 0xac00) % 28 : 0);
const lastOf = (word) => word[word.length - 1];
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// at 위치에서 시작하는 한글 덩어리(낱말의 나머지)
function hangulRun(text, at) {
  let end = at;
  while (end < text.length && isHangul(text[end])) end += 1;
  return text.slice(at, end);
}

// tail 이 받침과 상관없는 조사로만 이루어졌는가(비어 있어도 된다): 에 · 에서는 · 까지도
const isPlainOnly = (tail) =>
  tail === '' || PLAIN_PARTICLES.some((form) => tail.startsWith(form) && isPlainOnly(tail.slice(form.length)));

// tail(낱말 뒤에 붙은 글자들)이 '받침을 타는 조사(+ 덧붙는 조사)'로만 이루어졌으면 { pair, side, length } 를, 아니면 null 을 돌려준다
function readParticle(tail) {
  for (const pair of PARTICLES) {
    for (const side of [0, 1]) {
      const form = pair[side];
      if (tail.startsWith(form) && isPlainOnly(tail.slice(form.length))) return { pair, side, length: form.length };
    }
  }
  return null;
}

// tail 이 조사로만 이루어졌는가: '' · 가 · 로는 · 에서 · 들이(받침과 상관없는 조사 뒤에 다른 조사가 이어진 꼴)
const isParticleOnly = (tail) =>
  tail === ''
  || readParticle(tail) !== null
  || PLAIN_PARTICLES.some((form) => tail.startsWith(form) && isParticleOnly(tail.slice(form.length)));

/* ── 바꾸기 ───────────────────────────────────────────────────────────────── */

// 글을 조각으로 나눠 다룬다: { text, done } — 이미 제주어로 바꾼 조각(done)은 다음 단계에서 다시 건드리지 않는다.
// pick(match, text) 는 [바꿀 길이, 바꿔 넣을 글] 또는 null(그대로 둔다)을 돌려준다.
function swap(parts, pattern, pick) {
  const out = [];
  parts.forEach((part) => {
    if (part.done) {
      out.push(part);
      return;
    }
    const { text } = part;
    let from = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index < from) continue;
      const picked = pick(match, text);
      if (!picked) continue;
      const [length, jeju] = picked;
      if (match.index > from) out.push({ text: text.slice(from, match.index), done: false });
      out.push({ text: jeju, done: true });
      from = match.index + length;
    }
    if (from < text.length) out.push({ text: text.slice(from), done: false });
  });
  return out;
}

const byLength = (list) => [...list].sort((a, b) => b[0].length - a[0].length);

// 문장 표현 · 어미: 그대로 바꾼다. 단, 뒤에 다른 글자가 이어 붙어 있으면(좋습니다만 …) 건드리지 않는다.
function swapFixed(parts, list, { loose = false } = {}) {
  return byLength(list).reduce((acc, [standard, jeju]) => {
    const source = loose ? standard.split(' ').map(escapeRegExp).join('[ \\t]*') : escapeRegExp(standard);
    return swap(acc, new RegExp(source, 'g'), (match, text) => {
      const end = match.index + match[0].length;
      return isHangul(text[end]) ? null : [match[0].length, jeju];
    });
  }, parts);
}

// 낱말: 첫머리에서만 바꾸고, 받침 유무가 달라지면 바로 뒤의 조사를 맞춘다(할머니가 → 할망이, 동생이 → 아시가)
function swapWords(parts, list) {
  return byLength(list).reduce((acc, [standard, jeju, rule]) => {
    const before = batchim(lastOf(standard));
    const after = batchim(lastOf(jeju));
    const flips = (before > 0) !== (after > 0); // 받침 유무가 달라지는 낱말
    return swap(acc, new RegExp(escapeRegExp(standard), 'g'), (match, text) => {
      if (isHangul(text[match.index - 1])) return null; // 다른 낱말의 한가운데
      const end = match.index + standard.length;
      const tail = hangulRun(text, end);
      if (rule === 'alone' && tail !== '') return null;
      // 뒤에 붙은 말이 조사인지 알 수 없으면 바꾸지 않는다(할머니다 · 바다가재 · 오늘날)
      if ((rule === 'careful' || flips) && !isParticleOnly(tail)) return null;

      const found = flips ? readParticle(tail) : null;
      if (!found) return [standard.length, jeju];
      // '로'는 ㄹ 받침 뒤에서도 '로'다(길로 · 오널로)
      const side = found.pair[0] === '으로' && after === RIEUL ? 1 : after > 0 ? 0 : 1;
      return [standard.length + found.length, jeju + found.pair[side]];
    });
  }, parts);
}

// 표준어 글을 받아 제주어 글을 돌려준다. 줄바꿈과 문장부호는 그대로 둔다.
export async function convertToJeju(text) {
  const source = String(text ?? '').normalize('NFC');
  if (source.trim() === '') return '';

  let parts = [{ text: source, done: false }];
  parts = swapFixed(parts, PHRASES, { loose: true });
  parts = swapWords(parts, WORDS);
  parts = swapFixed(parts, ENDINGS);
  return parts.map((part) => part.text).join('');
}
