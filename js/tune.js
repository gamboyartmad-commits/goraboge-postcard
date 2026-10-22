// tune.js — 글자 조절판(주소 끝에 ?tune 을 붙였을 때만 뜬다. 예: index.html?tune)
// 막대를 움직이면 css/theme.css '0. 글자 크기 · 문단'의 값이 화면에서 바로 바뀐다.
// 고른 값은 이 브라우저에만 임시로 남는다(새로고침해도 유지). 모두에게 보이게 하려면:
//  · [파일에 저장] — '웹진 미리보기 열기.command'(작업 폴더 — .work/edit/serve.py)로 연 페이지면 css/theme.css '0.' 의 그 화면 폭 블록에 바로 쓴다.
//  · 아니면 [복사] 한 뒤 css/theme.css '0.' 의 같은 화면 폭 블록에 붙여 넣는다.
// 사이트를 쓰는 사람에게는 보이지 않는다(?tune 이 없으면 이 파일을 불러오지도 않는다 — js/main.js · js/article.js).

// ✏️ 조절할 값: 묶음(group) · 이름(css 변수) · 화면에 보일 이름 · 단위 · 막대의 범위. css/theme.css '0.' 과 같은 이름
const T = { unit: 'em', min: -0.08, max: 0.12, step: 0.005 }; // 자간
const LH = { unit: '', min: 1, max: 2.6, step: 0.05 }; // 줄 간격
const VARS = [
  // (27차) '메인 화면' 묶음(--front-…)은 메인 화면을 빼서 지웠다 — 값은 css/theme.css '0.' 에 남아 있다
  { group: 'Voices(목소리)', name: '--voice-size', label: '큰 말 크기', unit: 'px', min: 12, max: 40, step: 0.5 },
  { name: '--voice-lines-size', label: '아래 말 크기', unit: 'px', min: 11, max: 28, step: 0.5 },
  { group: '섹션 큰 제목', name: '--title-size', label: '크기', unit: 'px', min: 20, max: 80, step: 1 },
  { name: '--title-tracking', label: '자간', ...T },
  { name: '--title-lh', label: '줄 간격', ...LH },
  { name: '--write-title-size', label: '엽서 쓰기 제목 크기', unit: 'px', min: 18, max: 72, step: 1 },
  { name: '--voices-title-size', label: 'Voices 제목 크기', unit: 'px', min: 18, max: 72, step: 1 },
  { name: '--voices-title-lh', label: 'Voices 제목 줄 간격', ...LH },
  { name: '--voices-title-tracking', label: 'Voices 제목 자간', ...T },
  { name: '--interviews-title-size', label: '인터뷰 제목 크기', unit: 'px', min: 18, max: 72, step: 1 },
  { name: '--map-title-size', label: '지도 제목 크기', unit: 'px', min: 18, max: 72, step: 1 },
  { name: '--map-title-top-size', label: '지도 제목 윗줄 크기', unit: 'px', min: 12, max: 40, step: 0.5 },
  { name: '--map-title-top-tracking', label: '지도 제목 윗줄 자간', ...T },
  { group: '본문', name: '--text-size', label: '글자 크기', unit: 'px', min: 12, max: 26, step: 0.5 },
  { name: '--text-tracking', label: '자간', ...T },
  { name: '--text-lh', label: '줄 간격', ...LH },
  { name: '--text-gap', label: '문단 사이', unit: 'em', min: 0, max: 2.5, step: 0.05 },
  { name: '--text-width', label: '한 줄 길이(글자 수)', unit: 'em', min: 18, max: 50, step: 1 },
  { name: '--text-lead', label: '굵은 한 줄(엽서 쓰기)', unit: 'px', min: 13, max: 34, step: 0.5 },
  { name: '--text-small', label: '작은 설명', unit: 'px', min: 10, max: 22, step: 0.5 },
];

// 화면 폭 범위 — css/theme.css '0.' 의 세 블록과 같게
const RANGES = [
  { key: 'phone', label: '휴대폰(767px 이하)', test: (w) => w < 768, media: '' },
  { key: 'tablet', label: '태블릿(768~1199px)', test: (w) => w >= 768 && w < 1200, media: '(min-width: 768px)' },
  { key: 'desktop', label: '데스크톱(1200px 이상)', test: (w) => w >= 1200, media: '(min-width: 1200px)' },
];

const STORE = 'hayeong-tune';
// css/theme.css '0.' 에서 화면 폭 블록을 찾는 표지(그 블록 맨 위의 주석)
const MARK = { phone: '/* 휴대폰(767px 이하)', tablet: '/* 태블릿(768~1199px) */', desktop: '/* 데스크톱(1200px 이상) */' };

async function hasServer() {
  try {
    const res = await fetch('/__edit/ping', { cache: 'no-store' });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

// css/theme.css 의 그 화면 폭 블록에서 바꾼 값의 줄만 고쳐 쓴다(없는 줄은 블록 끝에 더한다)
async function saveTheme(rangeKey, values, fmtValue) {
  const url = new URL('css/theme.css', location.href).pathname;
  const src = await (await fetch(url, { cache: 'no-store' })).text();
  const at = src.indexOf(MARK[rangeKey]);
  if (at < 0) throw new Error('css/theme.css 의 \'0.\' 칸에서 그 화면 폭 블록을 찾지 못했어요');
  const end = src.indexOf('}', at);
  let block = src.slice(at, end);
  const indent = rangeKey === 'phone' ? '  ' : '    ';
  Object.entries(values).forEach(([name, value]) => {
    const line = new RegExp(`(\\n[ \\t]*${name}:[ \\t]*)[^;\\n]*;`);
    if (line.test(block)) block = block.replace(line, `$1${fmtValue(name, value)};`);
    else block = block.replace(/\s*$/, `\n${indent}${name}: ${fmtValue(name, value)};\n${indent.slice(2)}`);
  });
  const { writeViaServer } = await import('./edit.js');
  return writeViaServer(url, src.slice(0, at) + block + src.slice(end));
}
const root = document.documentElement;
const rangeNow = () => RANGES.find((r) => r.test(window.innerWidth)) || RANGES[0];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') || {};
  } catch {
    return {};
  }
};
const save = (all) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch { /* 저장이 막힌 브라우저: 이번 화면에서만 */ }
};

// css 가 지금 쓰는 값(숫자). 크기는 실제로 그려지는 px 로 잰다(clamp() 처럼 계산식으로 적힌 값도)
function measure(v) {
  if (v.unit === 'px') {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;font-size:var(${v.name})`;
    document.body.append(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return px;
  }
  return parseFloat(getComputedStyle(root).getPropertyValue(v.name));
}

const fmt = (n, v) => `${Math.round(n * 1000) / 1000}${v.unit}`;

export function initTune() {
  if (document.querySelector('.tune')) return;
  const style = document.createElement('style');
  style.textContent = `
    .tune{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2000;width:min(340px,calc(100vw - 24px));max-height:min(78vh,640px);overflow:auto;padding:12px 14px 14px;border:1.5px solid #2e2d36;border-radius:12px;background:#fffaf0;box-shadow:0 14px 30px -12px rgb(0 0 0/.45);color:#2e2d36;font:13px/1.45 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;letter-spacing:0}
    .tune *{box-sizing:border-box}
    .tune__head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px}
    .tune__title{margin:0;font-size:14px;font-weight:800}
    .tune__range{margin:0 0 10px;color:#a8401c;font-weight:700}
    .tune__group{margin:12px 0 6px;padding-top:8px;border-top:1px dashed #d7a873;color:#2e2d36;font-weight:800}
    .tune__group:first-child{margin-top:0;padding-top:0;border-top:0}
    .tune__row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;margin:0 0 8px}
    .tune__row label{font-weight:600}
    .tune__row output{font-variant-numeric:tabular-nums;font-weight:700}
    .tune__row input{grid-column:1/-1;width:100%;margin:0;accent-color:#e1653a}
    .tune__row.is-changed label::after{content:" ●";color:#e1653a}
    .tune__btns{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 8px}
    .tune button{padding:6px 10px;border:1.5px solid #2e2d36;border-radius:999px;background:#fffaf0;color:#2e2d36;font:inherit;font-weight:700;cursor:pointer}
    .tune button.tune__main{background:#2e2d36;color:#fffaf0}
    .tune__status{margin:0 0 8px;color:#2e7d4f;font-weight:700}
    .tune__status:empty{display:none}
    .tune__status.is-error{color:#b3261e}
    .tune textarea{width:100%;height:9.5em;padding:6px 8px;border:1px solid #d7a873;border-radius:6px;background:#fff;color:#2e2d36;font:12px/1.45 ui-monospace,Menlo,monospace;resize:vertical}
    .tune__note{margin:6px 0 0;color:#6b5a4e;font-size:12px}
    .tune.is-folded{width:auto}
    .tune.is-folded > :not(.tune__head){display:none}
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.className = 'tune';
  panel.setAttribute('aria-label', '글자 조절판');
  panel.innerHTML = `
    <div class="tune__head"><p class="tune__title">글자 조절판</p><button type="button" data-tune-fold aria-expanded="true">접기</button></div>
    <p class="tune__range" data-tune-range></p>
    <div data-tune-rows></div>
    <div class="tune__btns">
      <button type="button" class="tune__main" data-tune-save>파일에 저장</button>
      <button type="button" data-tune-copy>복사</button>
      <button type="button" data-tune-reset>이 화면 폭 처음 값으로</button>
    </div>
    <p class="tune__status" role="status" data-tune-status></p>
    <textarea readonly data-tune-out aria-label="css/theme.css 에 붙여 넣을 내용"></textarea>
    <p class="tune__note">[파일에 저장] = <b>css/theme.css '0.'</b> 의 이 화면 폭 블록에 바로 써 넣어요('웹진 미리보기 열기.command' 로 연 페이지에서).
      안 되면 [복사] → 같은 화면 폭 블록의 같은 이름 줄을 이 값으로 바꾸고 저장하세요.
      화면 폭을 바꾸면(창 크기 · 휴대폰 보기) 그 폭의 값을 따로 고를 수 있어요.</p>`;
  document.body.append(panel);

  const rowsBox = panel.querySelector('[data-tune-rows]');
  const out = panel.querySelector('[data-tune-out]');
  const rangeLabel = panel.querySelector('[data-tune-range]');
  let all = load();
  let range = null;
  let base = {}; // 이 화면 폭에서 css 가 원래 쓰던 값

  const changed = () => all[range.key] || {};

  const writeOut = () => {
    const set = changed();
    const names = VARS.filter((v) => set[v.name] !== undefined);
    if (!names.length) {
      out.value = '/* 아직 바꾼 값이 없어요 — 막대를 움직여 보세요 */';
      return;
    }
    const lines = names.map((v) => `    ${v.name}: ${fmt(set[v.name], v)};`);
    out.value = range.media
      ? `/* ${range.label} — css/theme.css '0.' 의 이 블록에 */\n@media ${range.media} {\n  :root {\n${lines.join('\n')}\n  }\n}`
      : `/* ${range.label} — css/theme.css '0.' 의 첫 블록(:root)에 */\n:root {\n${lines.map((l) => l.slice(2)).join('\n')}\n}`;
  };

  const render = () => {
    // 이 화면 폭에 임시로 넣어 둔 값을 걷고 css 의 원래 값을 잰 뒤, 저장해 둔 값을 다시 입힌다
    VARS.forEach((v) => root.style.removeProperty(v.name));
    range = rangeNow();
    base = Object.fromEntries(VARS.map((v) => [v.name, measure(v)]));
    const set = changed();
    VARS.forEach((v) => {
      if (set[v.name] !== undefined) root.style.setProperty(v.name, fmt(set[v.name], v));
    });
    rangeLabel.textContent = `지금 화면 폭 ${window.innerWidth}px · ${range.label}`;
    rowsBox.innerHTML = VARS.map((v, i) => {
      const value = set[v.name] ?? base[v.name];
      return `${v.group ? `<p class="tune__group">${v.group}</p>` : ''}<div class="tune__row${set[v.name] !== undefined ? ' is-changed' : ''}">
        <label for="tune-${i}">${v.label}</label><output for="tune-${i}">${fmt(value, v)}</output>
        <input id="tune-${i}" type="range" min="${v.min}" max="${v.max}" step="${v.step}" value="${value}" data-var="${v.name}">
      </div>`;
    }).join('');
    writeOut();
  };

  rowsBox.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-var]');
    if (!input) return;
    const v = VARS.find((x) => x.name === input.dataset.var);
    const value = parseFloat(input.value);
    all[range.key] = { ...changed(), [v.name]: value };
    save(all);
    root.style.setProperty(v.name, fmt(value, v));
    input.parentElement.querySelector('output').textContent = fmt(value, v);
    input.parentElement.classList.add('is-changed');
    writeOut();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh(true);
  });

  panel.querySelector('[data-tune-copy]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(out.value);
      button.textContent = '복사했어요';
    } catch {
      out.focus();
      out.select();
      button.textContent = '선택했어요 — ⌘C';
    }
    setTimeout(() => { button.textContent = '복사'; }, 1800);
  });

  const status = panel.querySelector('[data-tune-status]');
  const say = (text, error = false) => { status.textContent = text; status.classList.toggle('is-error', error); };
  panel.querySelector('[data-tune-save]').addEventListener('click', async () => {
    const set = changed();
    if (!Object.keys(set).length) { say('바꾼 값이 없어요.'); return; }
    if (!(await hasServer())) {
      say('여기서는 파일에 바로 저장할 수 없어요 — 작업 폴더의 \'웹진 미리보기 열기.command\' 를 더블클릭해 연 페이지에서 저장하거나, [복사]해서 붙여 넣으세요.', true);
      return;
    }
    say('저장하는 중…');
    try {
      const backup = await saveTheme(range.key, set, (name, value) => fmt(value, VARS.find((v) => v.name === name)));
      delete all[range.key];
      save(all);
      // 고친 css/theme.css 를 다시 읽어 들인 뒤 막대를 새 값으로
      const link = document.querySelector('link[href*="css/theme.css"]');
      if (link) {
        const next = link.cloneNode();
        next.href = `${new URL('css/theme.css', location.href).pathname}?v=${Date.now()}`;
        next.addEventListener('load', () => { link.remove(); render(); }, { once: true });
        link.after(next);
      } else render();
      say(`css/theme.css 의 ${range.label} 블록에 저장했어요(고치기 전 파일: jeju-webzine/.edit-backup/${backup}).`);
    } catch (err) {
      say(`저장하지 못했어요: ${err && err.message ? err.message : err}`, true);
    }
  });

  panel.querySelector('[data-tune-reset]').addEventListener('click', () => {
    delete all[range.key];
    save(all);
    render();
  });

  panel.querySelector('[data-tune-fold]').addEventListener('click', (event) => {
    const folded = panel.classList.toggle('is-folded');
    event.currentTarget.textContent = folded ? '펼치기' : '접기';
    event.currentTarget.setAttribute('aria-expanded', String(!folded));
  });

  let lastKey = '';
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (rangeNow().key !== lastKey) {
        render();
        lastKey = range.key;
      } else rangeLabel.textContent = `지금 화면 폭 ${window.innerWidth}px · ${range.label}`;
    }, 150);
  });

  render();
  lastKey = range.key;
}
