// csv.js — CSV(쉼표로 나눈 표) 파일을 읽어 JSON 과 같은 모양(객체의 배열)으로 바꾼다.
// 지금은 지도의 장소 목록(config.js 의 map.dataFile 이 .csv 로 끝날 때)에 쓴다. js/shared.js 의 fetchData 가 부른다.
// 엑셀 · 구글 시트 · 메모장 어디서 저장했든 읽을 수 있게 너그럽게 받는다:
//   · 글자 방식: UTF-8(맨 앞 BOM 이 있어도 됨) → 아니면 EUC-KR(엑셀의 'CSV(쉼표로 분리)') → UTF-16(엑셀의 '유니코드 텍스트')
//   · 따옴표 안의 쉼표 · 줄바꿈 · "" (따옴표 글자), 줄 끝 CRLF / LF, 빈 줄
//   · 머리글(첫 줄)은 한글 · 영문 어느 쪽이든, 빈칸 · 대소문자가 달라도 된다(아래 COLUMN_ALIASES)

// ✏️ 교체: 머리글(열 이름) 별칭. 왼쪽 = 코드가 쓰는 이름, 오른쪽 = CSV 첫 줄에 적을 수 있는 이름들
// (빈칸은 없애고 영문은 소문자로 바꿔 견준다 — '상호 명' · 'Name' 도 된다. 여기에 없는 머리글은 그 이름 그대로 남는다)
export const COLUMN_ALIASES = {
  name: ['이름', '상호명', '상호', '가게명', '가게이름', '장소명', '장소', '명칭', 'name'],
  meaning: ['뜻', '의미', '뜻풀이', '제주어뜻', 'meaning'],
  address: ['주소', '위치', '소재지', '도로명주소', 'address', 'addr'],
  lat: ['위도', 'lat', 'latitude'],
  lng: ['경도', 'lng', 'lon', 'long', 'longitude'],
  category: ['분류', '구분', 'category'],
  kind: ['업종', '종류', '세부분류', 'kind'],
  coordStatus: ['좌표상태', '좌표확인', 'coordstatus'],
  note: ['메모', '비고', 'note', 'notes', 'memo'],
  todo: ['확인할것', '할일', 'todo'],
};

// 숫자로 바꿔 둘 열(위도 · 경도). 숫자가 아닌 글자(빈칸 · 'TODO' 등)는 그대로 둔다 → js/map.js 가 '좌표 확인 중'으로 처리한다
const NUMBER_COLUMNS = ['lat', 'lng'];

/* ── 글자 방식 풀기 ─────────────────────────────────────────── */

// 파일의 바이트(ArrayBuffer · Uint8Array) → 글자. 이미 글자면 맨 앞의 BOM 만 뗀다
export function decodeText(input) {
  if (typeof input === 'string') return input.replace(/^﻿/, '');
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  // UTF-16(맨 앞 두 바이트가 FF FE · FE FF)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    // fatal: UTF-8 로 풀 수 없는 바이트가 하나라도 있으면 오류 → 아래에서 EUC-KR 로 다시 푼다. BOM 은 TextDecoder 가 뗀다
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes); // EUC-KR 을 모르는 환경: 깨진 글자가 섞이더라도 읽는다
    }
  }
}

/* ── 표 풀기 ───────────────────────────────────────────────── */

// 칸을 나누는 글자: 보통 쉼표. 첫 줄에 쉼표가 없고 탭 · 쌍반점(;)이 있으면 그것으로 나눈다(엑셀의 다른 저장 방식)
function delimiterOf(text) {
  const end = text.search(/[\r\n]/);
  const head = (end < 0 ? text : text.slice(0, end)).replace(/"[^"]*"/g, '');
  if (head.includes(',')) return ',';
  if (head.includes('\t')) return '\t';
  return head.includes(';') ? ';' : ',';
}

// CSV 글 → 줄마다 칸의 배열([['이름', '뜻'], ['거문오름', '…'], …]). 칸이 모두 빈 줄은 건너뛴다.
// 연 따옴표(")가 파일 끝까지 닫히지 않으면(메모장으로 고치다 하나를 지운 경우 등) 그 뒤 줄이 모두 한 칸에 삼켜진다
// → 그 따옴표 하나를 빼고 다시 읽어 나머지 줄을 살리고, 몇 번째 줄인지 콘솔에 알린다
export function parseCSV(source) {
  let text = decodeText(source);
  const comma = delimiterOf(text);
  for (;;) {
    const { rows, openAt } = splitRows(text, comma);
    if (openAt < 0) return rows;
    const line = text.slice(0, openAt).split(/\r\n?|\n/).length;
    console.warn(`[csv] ${line}번째 줄의 따옴표(")가 닫히지 않았어요 — 그 따옴표를 빼고 읽었습니다. 파일을 확인해 주세요`);
    text = text.slice(0, openAt) + text.slice(openAt + 1);
  }
}

// 표 나누기. openAt = 파일 끝까지 닫히지 않은 따옴표의 자리(없으면 -1)
function splitRows(text, comma) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false; // 따옴표 안인가
  let wasQuoted = false; // 이 칸이 따옴표로 시작했는가(따옴표 칸은 앞뒤 빈칸을 그대로 둔다)
  let openAt = -1; // 지금 열려 있는 따옴표의 자리

  const endCell = () => {
    row.push(wasQuoted ? cell : cell.trim());
    cell = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { // "" = 따옴표 글자 하나
        cell += '"';
        i += 1;
      } else quoted = false;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      wasQuoted = true;
      openAt = i;
      cell = '';
    } else if (ch === comma) endCell();
    else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
    } else if (!wasQuoted || ch.trim() !== '') cell += ch; // 닫는 따옴표 뒤의 빈칸은 버린다
  }
  if (cell !== '' || row.length) endRow(); // 마지막 줄 끝에 줄바꿈이 없을 때
  return { rows, openAt: quoted ? openAt : -1 };
}

/* ── 머리글 맞추기 ─────────────────────────────────────────── */

// ✏️ 교체: 언어별 열의 꼬리(왼쪽 = 코드가 쓰는 언어 코드, 오른쪽 = 머리글 끝에 붙일 수 있는 말).
// '뜻_en' · 'meaning_en' · '뜻(영어)' · 'Meaning EN' → meaning_en, '뜻_jje' · '뜻(제주어)' → meaning_jje (js/i18n.js 의 pick 이 지금 언어의 열을 쓴다)
export const LANG_SUFFIXES = {
  en: ['en', 'english', '영어', '영문'],
  jje: ['jje', '제주어', '제주말'],
};

// '상호 명' · ' Name ' · '위도(lat)' → '상호명' · 'name' · '위도'
const plain = (header) => String(header ?? '').replace(/[\s﻿​]/g, '').toLowerCase();

// 머리글 끝의 언어 꼬리: '뜻_en' → ['뜻', 'en'], '뜻(제주어)' → ['뜻', 'jje']. 꼬리가 없으면 null
function langTail(text) {
  for (const [code, words] of Object.entries(LANG_SUFFIXES)) {
    for (const word of words) {
      const w = plain(word);
      const m = new RegExp(`^(.+?)(?:[_\\-.]${w}|[(（\\[]${w}[)）\\]])$`).exec(text);
      if (m) return [m[1], code];
    }
  }
  return null;
}

function keyOf(header, aliases) {
  const names = Object.keys(aliases);
  const match = (value) => names.find((name) => plain(name) === value || aliases[name].some((alias) => plain(alias) === value));
  const raw = String(header ?? '').trim();
  // 'Meaning EN' 처럼 빈칸으로 꼬리를 붙인 경우도 받는다(빈칸을 _ 로 바꿔 견준다)
  const text = plain(raw.replace(/\s+(?=\S+$)/, '_'));
  // 언어별 열('뜻_en' · '뜻(제주어)') → 'meaning_en' · 'meaning_jje'. 앞부분이 아는 이름일 때만
  const tail = langTail(text);
  if (tail) {
    const base = match(tail[0]) || match(tail[0].replace(/[(（\[].*$/, ''));
    if (base) return `${base}_${tail[1]}`;
  }
  const flat = plain(raw);
  const bare = flat.replace(/[(（\[].*$/, ''); // 괄호 설명은 떼고도 견줘 본다
  return match(flat) || (bare && match(bare)) || raw;
}

// '33.457184' · ' 126.71 ' → 숫자. 숫자로 읽히지 않으면 원래 글자 그대로
const toNumber = (value) => (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : value);

// CSV 글 → [{ name: '거문오름', lat: 33.45, … }, …]. 첫 줄이 머리글이다
export function readCSV(source, aliases = COLUMN_ALIASES) {
  const [head, ...body] = parseCSV(source);
  if (!head) return [];
  const keys = head.map((header) => keyOf(header, aliases));
  return body.map((cells) => {
    const item = {};
    keys.forEach((key, i) => {
      if (!key || key in item) return; // 머리글이 빈 열 · 같은 뜻의 열이 두 번 나오면 앞의 것만 쓴다
      const value = cells[i] ?? '';
      item[key] = NUMBER_COLUMNS.includes(key) ? toNumber(value) : value;
    });
    return item;
  });
}
