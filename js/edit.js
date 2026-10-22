// edit.js — 글 편집 모드(주소 끝에 ?edit 을 붙였을 때만 뜬다. 예: index.html?edit · 글자 조절판과 함께: index.html?tune&edit)
// 점선 상자(HTML 에서 data-edit 가 붙은 요소)의 글을 화면에서 바로 고치고, [저장]을 누르면 이 페이지의 HTML 파일(index.html)에 써 넣는다.
//  · 문단 상자(data-edit-block): Enter = 새 문단, 문단을 다 지우면 그 문단이 빠진다.
//  · 그 밖의 상자: Enter = 줄바꿈(제목 · 문단) 또는 막힘(단추 · 목차 · 한 줄 글). 굵게 = ⌘B(Ctrl+B).
//  · 서식 막대(점선 상자 안을 누르거나 글자를 고르면 위에 뜬다): 크기 · 자간 · 줄 간격 −/+ · 서식 지우기.
//    글자를 골랐으면 그 글자만, 고르지 않았으면 그 줄(문단 상자의 한 문단, 또는 그 상자 전체)에 적용된다 → HTML 에 style="…" 로 저장된다.
//  · 저장: '웹진 미리보기 열기.command'(작업 폴더 — .work/edit/serve.py)로 연 페이지면 그 서버가 바로 파일에 쓴다(가장 확실).
//    그 밖의 서버로 열었으면 크롬 · 엣지의 '파일 시스템 접근'으로: 처음 한 번 jeju-webzine 폴더를 고르면(수정 허락을 묻는다) 그 폴더의 파일을 고친다.
//    어느 쪽이든 고치기 전 파일은 jeju-webzine/.edit-backup/ 에 시간 이름으로 남는다(사이트에는 올라가지 않는 폴더).
//  · 저장하기 전의 고침은 이 브라우저에 임시로 남는다(새로고침 · 창을 닫아도 다시 열면 되살아난다 — 저장하거나 [되돌리기]를 누르면 지운다).
// 사이트를 쓰는 사람에게는 보이지 않는다(?edit 이 없으면 이 파일을 불러오지도 않는다 — js/main.js).

const FILE = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
const INLINE_TAGS = new Set(['B', 'STRONG', 'EM', 'I', 'SMALL', 'SPAN', 'BR']);
const KEEP_CLASS = new Set(['keep', 'br-wide']); // 안쪽 span · br 에 남겨 둘 class
// 서식 막대가 쓰는 꾸밈만 남긴다(다른 곳에서 붙여 넣은 글꼴 · 색 따위는 걷는다)
const STYLE_PROPS = ['font-size', 'letter-spacing', 'line-height', 'font-weight'];
const styleOf = (node) => (node && node.style
  ? STYLE_PROPS.map((prop) => {
    const value = node.style.getPropertyValue(prop).trim();
    return /^[-\d.]+(px|em|rem|%)?$|^(normal|bold|[1-9]00)$/.test(value) ? `${prop}: ${value}` : '';
  }).filter(Boolean).join('; ')
  : '');
const DB = 'hayeong-edit';

/* ── 글 정리: contenteditable 이 붙이는 style · font · div 따위를 걷고, 허락한 태그만 남긴다 ── */

function cleanInline(from, doc) {
  const out = doc.createDocumentFragment();
  from.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      out.append(doc.createTextNode(node.data.replace(/ /g, ' ')));
      return;
    }
    if (node.nodeType !== 1) return;
    let tag = node.tagName;
    if (tag === 'STRONG') tag = 'B';
    if (tag === 'DIV' || tag === 'P') { // 줄 안에 생긴 덩어리 → 줄바꿈 + 그 안의 글
      if (out.childNodes.length) out.append(doc.createElement('br'));
      out.append(cleanInline(node, doc));
      return;
    }
    if (!INLINE_TAGS.has(tag)) { out.append(cleanInline(node, doc)); return; } // 모르는 태그는 벗기고 글만
    const el = doc.createElement(tag);
    const keep = [...node.classList].filter((c) => KEEP_CLASS.has(c));
    if (keep.length) el.className = keep.join(' ');
    const style = tag === 'SPAN' ? styleOf(node) : '';
    if (style) el.setAttribute('style', style); // 서식 막대로 바꾼 크기 · 자간 · 줄 간격
    if (tag === 'SPAN' && !keep.length && !style && node.hasAttribute('style')) { out.append(cleanInline(node, doc)); return; } // 크롬이 붙인 꾸밈 span
    if (tag !== 'BR') el.append(cleanInline(node, doc));
    out.append(el);
  });
  return out;
}

const toHTML = (frag) => {
  const box = document.createElement('div');
  box.append(frag);
  return box.innerHTML.replace(/(?:\s*<br>)+\s*$/, '').replace(/^\s+|\s+$/g, '').replace(/[ \t]{2,}/g, ' ');
};

// 문단 상자 → ['<p class="…">…</p>', …]. 원래 문단에 있던 번역 표지(data-i18n · data-i18n-html)는 그대로 둔다
const KEEP_ATTRS = ['data-i18n', 'data-i18n-html'];
function blockParagraphs(el) {
  const pClass = el.dataset.editBlock || '';
  const paras = [];
  let loose = document.createElement('p');
  const flush = () => {
    const html = toHTML(cleanInline(loose, document));
    let attrs = KEEP_ATTRS.filter((name) => loose.hasAttribute && loose.hasAttribute(name)).map((name) => ` ${name}="${loose.getAttribute(name).replace(/"/g, '&quot;')}"`).join('');
    const style = styleOf(loose); // 그 줄(문단)에 준 크기 · 자간 · 줄 간격
    if (style) attrs += ` style="${style}"`;
    if (html.replace(/<br>/g, '').trim()) paras.push({ html, attrs });
    loose = document.createElement('p');
  };
  el.childNodes.forEach((node) => {
    if (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV')) {
      flush();
      loose = node;
      flush();
    } else if (node.nodeType === 1 && node.tagName === 'BR') {
      flush();
    } else loose.append(node.cloneNode(true));
  });
  flush();
  return paras.map(({ html, attrs }) => `<p${pClass ? ` class="${pClass}"` : ''}${attrs}>${html}</p>`);
}

const valueOf = (el) => (el.hasAttribute('data-edit-block') ? blockParagraphs(el).join('\n') : toHTML(cleanInline(el, document)));
// 바뀌었는지 견줄 값 = 안쪽 글 + 상자 자체에 준 서식
const stateOf = (el) => `${valueOf(el)}\u0001${styleOf(el)}`;

/* ── 파일에 써 넣기: data-edit="이름" 이 붙은 요소의 안쪽만 바꾼다(나머지 글자 · 주석은 그대로) ── */

function patch(src, key, el) {
  const at = src.indexOf(`data-edit="${key}"`);
  if (at < 0) throw new Error(`'${key}' 자리를 ${FILE} 에서 찾지 못했어요(HTML 에서 data-edit 를 지웠나요?)`);
  const open = src.lastIndexOf('<', at);
  const tag = /^<([a-zA-Z0-9]+)/.exec(src.slice(open))[1];
  let i = open;
  let quote = '';
  for (; i < src.length; i += 1) { // 시작 태그의 끝(따옴표 안의 > 는 건너뛴다)
    const c = src[i];
    if (quote) { if (c === quote) quote = ''; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break;
  }
  const innerStart = i + 1;
  // 상자 자체에 준 서식(서식 막대 — 줄 전체)은 시작 태그의 style="…" 로
  let startTag = src.slice(open, innerStart).replace(/\sstyle="[^"]*"/, '');
  const own = styleOf(el);
  if (own) startTag = startTag.replace(/\s*>$/, ` style="${own}">`);
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'); // 짝이 맞는 닫는 태그(같은 태그가 안에 겹쳐 있어도)
  re.lastIndex = innerStart;
  let depth = 1;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) { depth -= 1; if (!depth) break; } else depth += 1;
  }
  if (!m) throw new Error(`'${key}' 의 닫는 태그를 찾지 못했어요`);
  let inner = valueOf(el);
  if (el.hasAttribute('data-edit-block')) {
    const lineStart = src.lastIndexOf('\n', open) + 1;
    const indent = /^[ \t]*/.exec(src.slice(lineStart, open))[0];
    inner = `\n${blockParagraphs(el).map((p) => `${indent}  ${p}`).join('\n')}\n${indent}`;
  }
  return src.slice(0, open) + startTag + inner + src.slice(m.index);
}

/* ── 고른 폴더 기억하기(IndexedDB — 다음에 열 때 다시 고르지 않게) ── */

const idb = (mode, fn) => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('kv');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const tx = req.result.transaction('kv', mode);
    const r = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(r && r.result);
    tx.onerror = () => reject(tx.error);
  };
});

let dir = null;
async function folder() {
  if (dir) return dir;
  let saved = null;
  try { saved = await idb('readonly', (s) => s.get('dir')); } catch { /* 기억 못 하는 브라우저 */ }
  if (saved && (await saved.requestPermission({ mode: 'readwrite' })) === 'granted') dir = saved;
  else dir = await window.showDirectoryPicker({ id: 'hayeong-webzine', mode: 'readwrite' });
  try { // 맞는 폴더인지: 이 페이지 파일과 js/edit.js 가 있어야 한다
    await dir.getFileHandle(FILE);
    await (await dir.getDirectoryHandle('js')).getFileHandle('edit.js');
  } catch {
    dir = null;
    throw new Error(`'jeju-webzine' 폴더를 골라 주세요(그 안에 ${FILE} 이 있는 폴더)`);
  }
  try { await idb('readwrite', (s) => s.put(dir, 'dir')); } catch { /* 이번에만 */ }
  return dir;
}

// 편집 저장 서버(.work/edit/serve.py)로 열었는가
async function hasServer() {
  try {
    const res = await fetch('/__edit/ping', { cache: 'no-store' });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

export async function writeViaServer(path, content) {
  const res = await fetch('/__edit/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, content }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `저장 서버 오류(HTTP ${res.status})`);
  return data.backup;
}

async function save(changed) {
  if (await hasServer()) {
    const before = await (await fetch(location.pathname, { cache: 'no-store' })).text();
    let after = before;
    changed.forEach((el) => { after = patch(after, el.dataset.edit, el); });
    return writeViaServer(location.pathname, after);
  }
  if (!window.showDirectoryPicker) throw new Error('이 브라우저는 파일에 바로 저장할 수 없어요 — 작업 폴더의 \'웹진 미리보기 열기.command\' 로 열거나 크롬으로 열어 주세요');
  const d = await folder();
  const handle = await d.getFileHandle(FILE);
  const before = await (await handle.getFile()).text();
  let after = before;
  changed.forEach((el) => { after = patch(after, el.dataset.edit, el); });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const backups = await d.getDirectoryHandle('.edit-backup', { create: true });
  const backupName = `${FILE.replace(/\.html$/, '')}-${stamp}.html`;
  const bw = await (await backups.getFileHandle(backupName, { create: true })).createWritable();
  await bw.write(before);
  await bw.close();
  const w = await handle.createWritable();
  await w.write(after);
  await w.close();
  return backupName;
}

// 검사용(헤드리스 크롬으로 파일에 쓰지 않고 바뀔 내용을 확인할 때)
export const _test = { patch, valueOf, stateOf };

/* ── 화면 ── */

export function initEdit() {
  if (document.querySelector('.edit-bar')) return;
  const style = document.createElement('style');
  style.textContent = `
    [data-edit]{outline:1.5px dashed rgb(225 101 58/.75);outline-offset:4px;border-radius:2px;cursor:text}
    [data-edit]:hover{outline-color:#e1653a}
    [data-edit]:focus{outline:2px solid #e1653a;background-color:rgb(255 250 240/.55)}
    [data-edit].is-changed{outline:2px solid #2e7d4f}
    [data-edit-block]{min-height:1.5em}
    .edit-bar{position:fixed;left:50%;top:calc(var(--topbar-space,0px) + 10px);z-index:2100;translate:-50% 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;width:max-content;max-width:calc(100vw - 24px);padding:8px 10px 8px 14px;border:1.5px solid #2e2d36;border-radius:14px;background:#fffaf0;box-shadow:0 14px 30px -12px rgb(0 0 0/.45);color:#2e2d36;font:13px/1.4 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;letter-spacing:0}
    .edit-bar b{font-weight:800}
    .edit-bar__hint{color:#6b5a4e}
    .edit-bar__count{padding:2px 8px;border-radius:999px;background:#f6d9a8;font-weight:700}
    .edit-bar button{padding:6px 12px;border:1.5px solid #2e2d36;border-radius:999px;background:#fffaf0;color:#2e2d36;font:inherit;font-weight:700;cursor:pointer}
    .edit-bar button.edit-bar__save{background:#2e2d36;color:#fffaf0}
    .edit-bar button:disabled{opacity:.45;cursor:default}
    .edit-bar__status{flex-basis:100%;margin:0;color:#2e7d4f;font-weight:700}
    .edit-bar__status:empty{display:none}
    .edit-bar__status.is-error{color:#b3261e}
    html.edit-off [data-edit]{outline:none}
  `;
  document.head.append(style);

  const bar = document.createElement('section');
  bar.className = 'edit-bar';
  bar.setAttribute('aria-label', '글 편집 모드');
  bar.innerHTML = `<b>글 편집 모드</b>
    <span class="edit-bar__hint">점선 상자를 눌러 고치세요 · 굵게 ⌘B · 문단 상자에서 Enter = 새 문단</span>
    <span class="edit-bar__count" data-edit-count>바뀐 곳 0</span>
    <button type="button" class="edit-bar__save" data-save disabled>저장</button>
    <button type="button" data-undo disabled>되돌리기</button>
    <button type="button" data-lines aria-pressed="false">점선 끄기</button>
    <p class="edit-bar__status" role="status"></p>`;
  document.body.append(bar);
  const status = bar.querySelector('.edit-bar__status');
  const say = (text, error = false) => { status.textContent = text; status.classList.toggle('is-error', error); };

  const lang = document.documentElement.lang;
  if (lang && lang !== 'ko') {
    say('한국어 화면에서만 고칠 수 있어요 — 위의 언어 단추에서 한국어를 고른 뒤 다시 열어 주세요.', true);
    bar.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    return;
  }

  const els = [...document.querySelectorAll('[data-edit]')];
  const original = new Map(els.map((el) => [el, stateOf(el)]));
  const originalRaw = new Map(els.map((el) => [el, { html: el.innerHTML, style: el.getAttribute('style') }]));
  const changed = () => els.filter((el) => stateOf(el) !== original.get(el));
  // 저장하기 전의 고침을 이 브라우저에 임시로 남긴다(localStorage — 페이지마다 따로)
  const DRAFT = `hayeong-edit-draft:${location.pathname}`;
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || '{}') || {}; } catch { return {}; } };
  const writeDraft = (list) => {
    try {
      if (!list.length) localStorage.removeItem(DRAFT);
      else localStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(list.map((el) => [el.dataset.edit, { h: el.innerHTML, s: el.getAttribute('style') || '' }]))));
    } catch { /* 저장소가 막힌 브라우저 */ }
  };
  const refresh = () => {
    const list = changed();
    writeDraft(list);
    els.forEach((el) => el.classList.toggle('is-changed', list.includes(el)));
    bar.querySelector('[data-edit-count]').textContent = `바뀐 곳 ${list.length}`;
    bar.querySelector('[data-save]').disabled = !list.length;
    bar.querySelector('[data-undo]').disabled = !list.length;
  };

  document.execCommand('defaultParagraphSeparator', false, 'p');
  els.forEach((el) => {
    el.contentEditable = 'true';
    el.spellcheck = false;
    const oneLine = el.tagName === 'SPAN' || el.tagName === 'LI' || el.closest('a, button');
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (el.hasAttribute('data-edit-block')) return; // 새 문단(브라우저 기본)
      e.preventDefault();
      if (!oneLine) document.execCommand('insertLineBreak');
    });
    el.addEventListener('paste', (e) => { // 붙여 넣기는 글자만(다른 곳의 글꼴 · 색이 따라오지 않게)
      e.preventDefault();
      const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      document.execCommand('insertText', false, oneLine ? text.replace(/\s*\n\s*/g, ' ') : text);
    });
    el.addEventListener('input', refresh);
    el.addEventListener('blur', () => { if (window.ScrollTrigger) window.ScrollTrigger.refresh(true); });
  });
  // 고치는 동안 목차 링크 · 엽서 단추를 눌러도 이동하거나 창이 열리지 않게.
  // 단추(<button>) 안의 글은 브라우저가 그 자리에서 고치게 해 주지 않는다 → 누르면 작은 입력 창으로 묻는다
  window.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-edit]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    if (el.closest('button')) {
      const next = window.prompt('단추 글자', el.textContent.trim());
      if (next !== null && next.trim()) {
        el.textContent = next.trim();
        refresh();
      }
    }
  }, true);
  window.addEventListener('beforeunload', (e) => {
    if (changed().length) { e.preventDefault(); e.returnValue = ''; }
  });

  bar.querySelector('[data-save]').addEventListener('click', async () => {
    const list = changed();
    if (!list.length) return;
    say('저장하는 중…');
    try {
      const backup = await save(list);
      list.forEach((el) => {
        original.set(el, stateOf(el));
        originalRaw.set(el, { html: el.innerHTML, style: el.getAttribute('style') });
      });
      refresh();
      say(`${FILE} 에 저장했어요(바뀐 곳 ${list.length}). 고치기 전 파일은 jeju-webzine/.edit-backup/${backup}`);
    } catch (err) {
      if (err && err.name === 'AbortError') { say('폴더를 고르지 않아서 저장하지 않았어요.', true); return; }
      say(`저장하지 못했어요: ${err && err.message ? err.message : err}`, true);
      console.error('[edit]', err);
    }
  });
  bar.querySelector('[data-undo]').addEventListener('click', () => {
    original.forEach((state, el) => {
      if (stateOf(el) === state) return;
      const raw = originalRaw.get(el);
      el.innerHTML = raw.html;
      if (raw.style) el.setAttribute('style', raw.style); else el.removeAttribute('style');
    });
    refresh();
    say('저장하지 않은 고침을 모두 되돌렸어요.');
  });
  bar.querySelector('[data-lines]').addEventListener('click', (e) => {
    const off = document.documentElement.classList.toggle('edit-off');
    e.currentTarget.textContent = off ? '점선 켜기' : '점선 끄기';
    e.currentTarget.setAttribute('aria-pressed', String(off));
  });
  initFormatBar(els, refresh);
  // 지난번에 저장하지 않은 고침이 남아 있으면 되살린다
  const draft = readDraft();
  let restored = 0;
  els.forEach((el) => {
    const saved = draft[el.dataset.edit];
    const html = typeof saved === 'string' ? saved : saved && saved.h;
    const style = saved && typeof saved === 'object' ? saved.s : null;
    if (typeof html === 'string' && (html !== el.innerHTML || (style ?? '') !== (el.getAttribute('style') || ''))) {
      el.innerHTML = html;
      if (style) el.setAttribute('style', style); else if (style === '') el.removeAttribute('style');
      restored += 1;
    }
  });
  refresh();
  if (restored) say(`저장하지 않은 고침 ${restored}곳을 되살렸어요 — [저장]을 누르면 파일에 써 넣어요.`);
  hasServer().then((ok) => {
    if (!ok && !status.textContent) say('지금 서버로는 [저장]할 때 jeju-webzine 폴더를 한 번 골라야 해요. 더 쉬운 방법: 작업 폴더의 \'웹진 미리보기 열기.command\' 를 더블클릭해 열기.');
  });
}

/* ── 서식 막대: 크기 · 자간 · 줄 간격 −/+ · 서식 지우기 ──
   글자를 골랐으면 그 글자만(<span style="…"> 로 감싼다), 고르지 않았으면 커서가 있는 줄 전체(문단 상자의 한 문단, 아니면 상자 자체) */
function initFormatBar(els, onChange) {
  const bar = document.createElement('div');
  bar.className = 'edit-fmt';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', '글자 서식');
  bar.hidden = true;
  const btn = (act, label, title) => `<button type="button" data-fmt="${act}" title="${title}">${label}</button>`;
  bar.innerHTML = `
    <span class="edit-fmt__group"><span class="edit-fmt__name">크기</span>${btn('size:-1', '−', '글자 작게(1px)')}${btn('size:1', '+', '글자 크게(1px)')}</span>
    <span class="edit-fmt__group"><span class="edit-fmt__name">자간</span>${btn('track:-0.01', '−', '자간 좁게(0.01em)')}${btn('track:0.01', '+', '자간 넓게(0.01em)')}</span>
    <span class="edit-fmt__group"><span class="edit-fmt__name">줄간</span>${btn('lead:-0.05', '−', '줄 간격 좁게')}${btn('lead:0.05', '+', '줄 간격 넓게')}</span>
    ${btn('bold', '<b>B</b>', '굵게(⌘B)')}${btn('clear', '지우기', '이 줄의 서식 지우기')}
    <span class="edit-fmt__now" data-fmt-now></span>`;
  document.body.append(bar);
  const now = bar.querySelector('[data-fmt-now]');
  const style = document.createElement('style');
  style.textContent = `
    .edit-fmt{position:fixed;z-index:2200;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;max-width:calc(100vw - 16px);padding:5px 8px;border:1.5px solid #2e2d36;border-radius:10px;background:#fffaf0;box-shadow:0 10px 22px -10px rgb(0 0 0/.45);color:#2e2d36;font:12px/1.2 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;letter-spacing:0}
    .edit-fmt[hidden]{display:none}
    .edit-fmt__group{display:inline-flex;align-items:center;gap:2px}
    .edit-fmt__name{margin-right:2px;color:#6b5a4e;font-weight:700}
    .edit-fmt button{min-width:26px;height:26px;padding:0 6px;border:1px solid #2e2d36;border-radius:6px;background:#fff;color:#2e2d36;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
    .edit-fmt button[data-fmt="clear"]{font-size:12px}
    .edit-fmt__now{color:#6b5a4e;font-variant-numeric:tabular-nums}`;
  document.head.append(style);

  const boxOf = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest('[data-edit]') : null;
  };
  // 커서가 있는 '줄': 문단 상자 안이면 그 문단(p), 아니면 상자 자체
  const lineOf = (node, box) => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (box.hasAttribute('data-edit-block')) {
      const p = el.closest('[data-edit] > p, [data-edit] > div');
      if (p && box.contains(p)) return p;
    }
    return box;
  };
  const px = (el) => parseFloat(getComputedStyle(el).fontSize) || 16;
  const readNow = (el) => {
    const cs = getComputedStyle(el);
    const size = px(el);
    const track = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / size;
    const lead = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / size;
    return { size, track, lead };
  };
  const round = (n, k = 1000) => Math.round(n * k) / k;
  const show = (el) => {
    const v = readNow(el);
    now.textContent = `${round(v.size, 10)}px · 자간 ${round(v.track, 100)}em · 줄간 ${round(v.lead, 100)}`;
  };
  let target = null; // 지금 서식을 바꿀 상자

  const place = () => {
    const sel = getSelection();
    const box = sel.rangeCount ? boxOf(sel.anchorNode) : null;
    if (!box || !els.includes(box) || document.activeElement !== box) {
      if (!bar.matches(':hover')) bar.hidden = true;
      return;
    }
    target = box;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect().width || range.getBoundingClientRect().height ? range.getBoundingClientRect() : box.getBoundingClientRect();
    bar.hidden = false;
    const top = rect.top - bar.offsetHeight - 10;
    bar.style.top = `${top < 8 ? rect.bottom + 10 : top}px`;
    bar.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - bar.offsetWidth - 8))}px`;
    show(sel.isCollapsed ? lineOf(sel.anchorNode, box) : (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement));
  };
  document.addEventListener('selectionchange', place);
  window.addEventListener('scroll', () => { if (!bar.hidden) place(); }, { passive: true });
  bar.addEventListener('mousedown', (e) => e.preventDefault()); // 막대를 눌러도 고른 글자가 풀리지 않게

  // 고른 글자를 표시 글꼴(font face="__fmt__")로 감싼 뒤 span 으로 바꾼다 — 여러 줄 · 태그에 걸친 선택도 알맞게 쪼개진다
  const wrapSelection = (box, apply) => {
    // 방금 감싼 글자를 그대로 고른 채 또 누르면(+ 를 여러 번) 새로 감싸지 않고 그 span 의 값만 바꾼다
    const range0 = getSelection().getRangeAt(0);
    const only = range0.startContainer === range0.endContainer && range0.endOffset - range0.startOffset === 1
      ? range0.startContainer.childNodes[range0.startOffset] : null;
    if (only && only.nodeType === 1 && only.tagName === 'SPAN' && only.hasAttribute('style') && box.contains(only)) {
      apply(only);
      return;
    }
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontName', false, '__fmt__');
    const marks = [...box.querySelectorAll('font[face="__fmt__"]')];
    const spans = marks.map((font) => {
      const span = document.createElement('span');
      while (font.firstChild) span.append(font.firstChild);
      font.replaceWith(span);
      return span;
    });
    spans.forEach((span) => apply(span));
    if (spans.length) {
      const range = document.createRange();
      range.setStartBefore(spans[0]);
      range.setEndAfter(spans[spans.length - 1]);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };
  const step = (el, kind, delta) => {
    const v = readNow(el);
    if (kind === 'size') el.style.fontSize = `${round(Math.max(8, v.size + delta), 10)}px`;
    if (kind === 'track') el.style.letterSpacing = `${round(v.track + delta)}em`;
    if (kind === 'lead') el.style.lineHeight = String(round(Math.max(0.8, v.lead + delta), 100));
  };

  bar.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-fmt]') : null;
    if (!b || !target) return;
    const sel = getSelection();
    const [act, amount] = b.dataset.fmt.split(':');
    if (act === 'bold') document.execCommand('bold');
    else if (act === 'clear') {
      const line = lineOf(sel.anchorNode || target, target);
      line.removeAttribute('style');
      line.querySelectorAll('span[style]').forEach((span) => {
        if (span.classList.length) span.removeAttribute('style');
        else span.replaceWith(...span.childNodes);
      });
    } else {
      const delta = parseFloat(amount);
      // 줄 간격은 늘 줄 전체에(글자 몇 개의 줄 간격은 의미가 없다)
      if (act === 'lead' || sel.isCollapsed) step(lineOf(sel.anchorNode || target, target), act, delta);
      else wrapSelection(target, (span) => step(span, act, delta));
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
    onChange();
    place();
  });
}

