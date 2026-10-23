// 사이트 설정. 여기 넣는 키는 모두 웹페이지에 공개돼도 되는 키만 씀.
// REST API 키, Admin 키, Client Secret, Supabase secret(service_role) 키는 절대 넣지 말 것.
window.POSTCARD_CONFIG = {
  // 카카오톡으로 전송하기 ('카카오톡공유_설정방법.md')
  // 카카오 개발자 앱 '하영고라보게'의 JavaScript 키. 등록한 사이트 주소에서만 동작함
  KAKAO_JS_KEY: '2712d9d852d5069a4e4375574d2c4c04',

  // 모두가 보는 엽서 게시판 (Supabase 프로젝트 goraboge-postcard, 'supabase/board.sql')
  // publishable 키는 공개용. 누가 무엇을 할 수 있는지는 데이터베이스 규칙(RLS)이 지킴
  SUPABASE_URL: 'https://arihrphljtppzmtllzeu.supabase.co',
  SUPABASE_KEY: 'sb_publishable_2zNSN3lxwQhhMP1Berri_A_IBsNhT1e',

  // 성과 측정 (track.js, v7.11) — 웹진 '하영 고라보게'와 같은 GA4 측정 ID(G-로 시작)를 넣는다. 비어 있으면 아무 데도 보내지 않음.
  // 웹진 안(…/team1/play/postcard/)에 띄워졌을 때는 이 값과 상관없이 웹진의 GA4 로 넘김(웹진 config.js 의 analytics.ga4)
  GA4_ID: '',
  // v7.15: Google 태그 관리자(GTM) — 웹진과 같은 컨테이너. 이 사이트가 따로 열렸을 때만 부른다(track.js).
  // 웹진 안(…/play/postcard/)에서는 웹진 페이지의 GTM 이 이 사이트의 이벤트(pc_…)까지 받으므로 부르지 않음(두 번 세지 않게)
  GTM_ID: 'GTM-K97VS62N',
  // 웹진 주소(이 사이트를 띄우는 바깥 페이지)의 출처 — 여기서 온 '인사'만 믿고 측정 · 이동 신호를 보냄. 웹진 주소가 바뀌면 함께 고칠 것
  WEBZINE_ORIGINS: ['https://gamboyartmad-commits.github.io', 'https://lxwebzine.hankyung.com', 'https://www.hankyung.com', 'https://hankyung.com', 'http://localhost:4174', 'http://127.0.0.1:4174', 'http://localhost:4175', 'http://127.0.0.1:4175'],
  // GA4 교차 도메인(따로 열렸을 때 웹진과 같은 방문으로 이어 보기)
  WEBZINE_DOMAINS: ['hankyung.com', 'gamboyartmad-commits.github.io'],
  // 따로 열렸을 때 '기사 보러가기' · 웹진 홍보 띠가 갈 웹진 주소. 웹진이 실제 주소(…/team1/)에 올라가면 그 주소로 바꿀 것
  WEBZINE_URL: '../../',   // 통합본: 같은 사이트의 웹진 첫 화면(엽서 사이트 = play/postcard/)
};
