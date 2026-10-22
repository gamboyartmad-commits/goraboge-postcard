// play.js — 제주어 엽서 쓰러가기 쪽(play/postcard/index.html) 진입점
// ① 성과 측정(js/track.js) — 이 쪽의 체류 시간(page = play/postcard)도 재진다
// ② config.js 의 links.postcard 에 바깥 엽서 사이트 주소가 있으면 그 사이트를 이 쪽 안에 화면 가득 띄운다(광고 유입 정보 utm … 를 붙여서).
//    바깥 사이트 안을 누르고 쓰는 동안에도 체류 시간이 이어서 재진다(js/track.js — iframe 에 포커스가 있으면 '보는 중'으로 센다)
// ③ 주소가 비어 있으면 이 사이트의 엽서 쓰기 창(js/maker.js)을 바로 연다
// ④ (30차) 엽서 사이트와 주고받기(postMessage) — 엽서 사이트의 track.js 와 짝
//    웹진 → 엽서 사이트: { source: 'hayeong-webzine', kind: 'hello' } (엽서 사이트가 '웹진 안에 있다'를 알게 — 대답이 올 때까지 몇 번 보낸다)
//    엽서 사이트 → 웹진: kind 'ready'(대답) · 'event'(pc_… 이벤트 → 웹진 GA4 로) · 'activity'(쓰는 중 → 체류 시간) · 'nav'(기사 보러가기 → 웹진 첫 화면으로)
//    엽서 사이트 주소(links.postcard)의 출처에서 온, 바로 그 iframe 의 메시지만 받는다

import { loadI18n } from './i18n.js';
import { postcardLink } from './maker.js';
import { getConfig } from './shared.js';
import { init as initTrack, markActive, track, trackFromPostcard, withCampaign } from './track.js';

const SITE_ROOT = new URL('../', import.meta.url);

try {
  initTrack();
} catch (err) {
  console.error('[track] 성과 측정을 시작하지 못했어요', err);
}

function connect(frame, origin) {
  let answered = false;
  let tries = 0;
  const hello = () => {
    if (answered || tries > 40) return; // 약 16초까지
    tries += 1;
    try { frame.contentWindow.postMessage({ source: 'hayeong-webzine', kind: 'hello', page: 'play/postcard' }, origin); } catch { /* 아직 열리는 중 */ }
    setTimeout(hello, 400);
  };
  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    const d = event.data;
    if (!d || d.source !== 'hayeong-postcard') return;
    answered = true;
    if (d.kind === 'event') trackFromPostcard(d.name, d.params);
    else if (d.kind === 'activity') markActive();
    else if (d.kind === 'nav' && d.to === 'webzine') {
      track('postcard_back', { from: String(d.from || '').slice(0, 20) });
      window.location.assign(SITE_ROOT.href);
    }
  });
  // 엽서 사이트가 안에서 새로 열리면(받은 엽서 링크 등) 다시 인사
  frame.addEventListener('load', () => { answered = false; tries = 0; hello(); });
  hello();
}

async function start() {
  await loadI18n().catch(() => {});
  const external = postcardLink();
  if (!external) {
    const { init } = await import('./maker.js');
    init(document.body);
    return;
  }
  const url = withCampaign(external, 'play');
  // 쪽 안에 띄울 수 없는 곳(claude.ai 공유 링크 — config.js 의 links.postcardOpen = 'link'): 새 탭으로 여는 큰 단추만
  if (getConfig().links.postcardOpen === 'link') {
    const card = document.querySelector('[data-play-card]');
    card.querySelector('[data-play-card-link]').href = url;
    card.hidden = false;
    return;
  }
  const box = document.querySelector('[data-play-frame]');
  const frame = document.createElement('iframe');
  frame.src = url;
  frame.title = '제주어 엽서 쓰기';
  frame.allow = 'clipboard-write; web-share';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  box.append(frame);
  box.hidden = false;
  connect(frame, new URL(external).origin);
  // (33차) 오른쪽 아래 '화면이 보이지 않으면 새 창에서 열기' 알약은 뺐다(사용자 — 다른 사이트처럼 보임. 엽서 사이트는 같은 사이트 안이라 늘 뜬다)
  frame.addEventListener('load', () => track('postcard_site_view', { host: new URL(external).hostname }), { once: true });
}

start().catch((err) => console.error('[play] 엽서 쓰기 쪽을 열지 못했어요', err));
