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
};
