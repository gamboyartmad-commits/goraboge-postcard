// story.js — '이 말이 사라지면' 애니메이션(index.html 의 엽서 써보기 섹션 안 '왜 제주어로 써야 할까요?' 의 iframe — assets/story/jeju-disappear.html)
// 애니메이션 마지막의 '제주어 엽서 쓰러가기' 단추를 누르면 iframe 이 postMessage({ type: 'hayeong:scroll-to', target: 'write' })를 보낸다
// → 이 페이지의 엽서 써보기 섹션(#write)으로 스크롤하고, 키보드 · 화면 낭독기 사용자를 위해 그 섹션 제목으로 포커스를 옮긴다.
// 성과 측정(js/track.js): story_cta(이 단추를 누름)

import { prefersReducedMotion } from './shared.js';
import { track } from './track.js';

// 애니메이션이 보낼 수 있는 곳(이 밖의 id 는 무시한다)
const TARGETS = new Set(['write']);

export function init(root) {
  const frame = root.querySelector('[data-story-frame]');
  if (!frame) return;
  window.addEventListener('message', (event) => {
    // 이 iframe 이 보낸 것만 받는다(다른 창 · 확장 프로그램이 보낸 메시지는 무시)
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'hayeong:scroll-to' || !TARGETS.has(data.target)) return;
    const target = document.getElementById(data.target);
    if (!target) return;
    track('story_cta', { target: data.target });
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    const title = target.querySelector('h2');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
  });
}
