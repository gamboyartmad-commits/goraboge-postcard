// config.js — 직접 고치는 설정 파일: 이름 · 링크 · 메일 · 지도 데이터 (자세한 순서는 README 참고)
// 글꼴 · 색 · 크기 · 사진 자리 같은 '모양'은 css/theme.css 에서 고칩니다.
// 따옴표 안의 값만 바꾸고, 쉼표와 중괄호는 그대로 두세요.

window.JEJU_CONFIG = {
  site: {
    // ✏️ 교체: 웹진 이름 — 메일 제목·본문과 엽서 이미지에 쓰입니다.
    //          화면에 보이는 이름(각 HTML 의 <title>, 로고 그림의 alt, 헤더, 푸터)은 HTML 에서 따로 고쳐야 합니다.
    name: '하영 고라보게',
  },

  // 바깥 링크
  links: {
    // ✏️ 교체: '제주어 엽서 쓰기'를 다른 사이트(새 링크)에서 하게 하려면 그 주소를 따옴표 안에 넣습니다.
    //          예) postcard: 'https://example.com/postcard',
    //          주소가 있으면 오른쪽 아래 플로팅 버튼('제주어 엽서 쓰러가기')과 '엽서 쓰러 가기' 단추가 그 주소를 새 탭으로 엽니다.
    //          비어 있으면('') 지금처럼 이 사이트 안의 변환 창이 열립니다.
    //          https:// 또는 http:// 로 시작하는 전체 주소, 또는 이 사이트 안의 경로(예: postcard: 'postcard/')를 받습니다(다른 값은 무시하고 변환 창을 엽니다).
    //          (31차) 엽서 사이트 저장소(goraboge-postcard)를 웹진과 합쳐 gamboyartmad-commits/webzine 으로 바꿨다 → 엽서 사이트 주소 = …/webzine/postcard/
    //          (예전 주소 …/goraboge-postcard/ 는 새 주소로 넘겨준다). GitHub 통합본 자체(.work/github/build.py)에서는 이 값을 같은 사이트 안의 'postcard/' 로 바꿔 올린다.
    //          (30차) 팀의 '제주어로 엽서 적기' 사이트(GitHub Pages — 원본은 작업 폴더 '제주어 엽서 사이트/').
    //          웹진의 엽서 단추는 모두 웹진 안 '엽서 쓰러가기' 쪽(play/postcard/)으로 가고, 그 쪽이 이 사이트를 화면 가득 띄운다.
    //          엽서 사이트 안에서 누른 단추 · 보낸 방법 · 머문 시간은 웹진의 GA4 로 함께 잰다(js/play.js ↔ 엽서 사이트 track.js)
    postcard: 'postcard/',   // GitHub 통합본: 같은 사이트 안의 엽서 사이트(.work/github/build.py)
    // 엽서 쓰러가기 쪽에서 엽서 사이트를 여는 방식: 'frame' = 쪽 안에 화면 가득 띄움(실제 사이트) · 'link' = '엽서 사이트 열기' 큰 단추(새 탭).
    //          claude.ai 공유 링크는 다른 사이트를 페이지 안에 띄우지 못해서 발행용 사본만 'link' 로 바꾼다(.work/publish/build.py)
    postcardOpen: 'frame',

    // ✏️ 교체: 영어판 랜딩페이지 주소. 넣으면 언어 단추의 'English' 가 이 사이트의 영어 번역 대신 그 페이지로 넘어갑니다(같은 탭).
    //          예) english: 'https://example.com/en',   또는 이 사이트 안의 페이지: english: 'en/',
    //          20차: 외국인 전용 웹진('Welcome to Jeju' — 작업 폴더의 '외국인 전용 웹진/')을 en/index.html 로 넣고 연결했다(.work/sync/foreign.py). 21차: 주소는 '/'로 끝나게 en/(서버가 en/index.html 을 연다)
    //          비어 있으면('') 지금처럼 이 사이트를 영어로 바꿔 보여 줍니다. 전체 주소(https:// · http://) 또는 이 사이트 안의 경로만 받습니다.
    english: 'en/',
  },

  // '메일로 받기' 발송 설정 — https://www.emailjs.com 에 가입한 뒤 대시보드(dashboard.emailjs.com)에서 값을 복사합니다.
  // 아래 세 값 가운데 하나라도 'YOUR_…' 그대로거나 비어 있으면 메일을 보내지 않고
  // "메일 발송 설정이 아직 안 되어 있어요" 안내만 띄웁니다. (단계별 설명은 README 의 'EmailJS 설정 방법')
  // 세 값은 브라우저에 그대로 보이는 공개 값입니다. 대시보드의 Private Key 는 여기에 절대 넣지 마세요.
  emailjs: {
    // ✏️ 교체: 대시보드 왼쪽 Email Services → 연결한 메일 서비스(Gmail 등)의 Service ID (예: service_ab12cd3)
    serviceId: 'YOUR_SERVICE_ID',
    // ✏️ 교체: Email Templates → 만든 템플릿을 열면 Settings 탭에 있는 Template ID (예: template_xy98zw7)
    //          템플릿의 To Email 칸에는 {{to_email}} 을 적어야 받는 사람에게 갑니다.
    //          템플릿에서 쓸 수 있는 변수: {{to_email}} {{postcard_image}} {{jeju_text}} {{original_text}}
    //                                      {{to_name}} {{from_name}} {{site_name}} {{sent_date}}
    templateId: 'YOUR_TEMPLATE_ID',
    // ✏️ 교체: Account → General 의 Public Key
    publicKey: 'YOUR_PUBLIC_KEY',
    // 엽서 그림을 메일에 싣는 방법 — 쓰는 요금제에 맞춰 둘 중 하나를 고릅니다.
    //   'inline'     : 무료 플랜(기본). 작은 JPEG(30KB 이하)를 메일 본문에 넣습니다.
    //                  템플릿 본문에 <img src="{{postcard_image}}"> 를 넣어야 그림이 보입니다.
    //                  Gmail(웹·앱)과 옛 Outlook 에서는 이 방식의 그림이 보이지 않을 수 있어요
    //                  (그래서 글자로 된 엽서도 함께 보냅니다. Apple Mail · Outlook.com 등에서는 보입니다).
    //   'attachment' : 유료 플랜(Personal 이상). 큰 JPEG(350KB 이하)를 첨부 파일로 보냅니다.
    //                  템플릿의 Attachments 탭에서 Variable Attachment 를 추가하고
    //                  Filename 은 jeju-postcard.jpg, Parameter name 은 postcard_image 로 맞춰야 합니다.
    //   (무료 플랜: 한 달 200통 · 1초에 1통. 한도를 넘으면 "이번 달 메일 발송 한도를 모두 썼어요" 안내가 뜹니다)
    imageMode: 'inline',
  },

  // 지도: 장소 데이터 파일 · 바탕(타일)
  map: {
    // ✏️ 교체: 지도에 찍을 장소 목록 파일. 기본은 'data/places.json'.
    //          CSV(엑셀 · 구글 시트에서 'CSV' 로 저장한 표)를 쓰려면 파일을 data/ 폴더에 넣고 그 이름을 적습니다.
    //          예) dataFile: 'data/places.csv',
    //          표의 첫 줄(머리글)은 data/places.sample.csv 처럼: 이름, 뜻, 주소, 위도, 경도, 분류(가게 · 명소 — 비었거나 분류 열이 없으면 가게), 업종, 좌표상태, 메모
    //          (머리글은 영문 name, meaning, address, lat, lng, category, kind … 도 됩니다. 위도 · 경도가 빈 줄은 지도에 찍지 않고 목록에만 나옵니다)
    dataFile: 'data/places.json',

    // ✏️ 교체: 지도 아래 장소 목록에 처음 보여 줄 곳 수(나머지는 '더보기' 단추를 눌러야 펼쳐집니다). 1 이상의 정수.
    //          바꾸면 css/theme.css 의 '7. 지도' 에 있는 --map-rows(접힌 목록의 줄 수)도 같은 셈으로 고치세요.
    listFirst: 4,
    // ✏️ 교체: 휴대폰(폭 767px 이하)에서 처음 보여 줄 곳 수(25차 — 2곳만 보이고 나머지는 '더보기'). 바꾸면 css/theme.css '7. 지도' 휴대폰 블록의 --map-rows 도 같은 수로.
    listFirstPhone: 2,

    // 지도 바탕(타일)
    //   'eox'   : 키 없이 쓸 수 있는 EOX Terrain Light (기본)
    //   'carto' : CARTO Voyager(라벨 없음). 아래 cartoKey 가 꼭 필요합니다. 비어 있으면 'eox' 로 대신합니다.
    //   'local' : 사이트 안에 받아 둔 타일(assets/tiles, 줌 12까지 — 더 가까이 보면 조금 흐려짐). 인터넷의 지도 서버를 쓰지 못하는 곳에 올릴 때
    //             (claude.ai 에 발행한 페이지는 바깥 이미지를 막아서, 발행용 사본은 이 값으로 바뀐다 — .work/publish/build.py)
    //   'carto' 로 바꾸면 index.html · interview-01.html · interview-02.html 푸터의 '지도:' 출처도
    //   '© OpenStreetMap contributors, © CARTO' 로 함께 고치세요.
    tiles: 'eox',
    // ✏️ 교체: tiles 를 'carto' 로 바꿀 때만 — https://carto.com 에서 발급받은 API 키
    cartoKey: '',
  },

  // Voices(목소리) 캐러셀 — js/quotes.js
  quotes: {
    // ✏️ 교체: 몇 초마다 저절로 다음 사람으로 넘길지(0 = 저절로 넘기지 않음).
    //          섹션이 화면에 보일 때만 돌고, 마우스를 올리거나 키보드 포커스가 안에 있으면 멈춥니다.
    //          방문자가 한 번이라도 직접 넘기면 그 뒤로는 저절로 넘기지 않습니다. '동작 줄이기'를 켠 기기에서는 돌지 않습니다.
    autoplay: 5,
  },

  // 성과 측정(광고 · 방문 분석) — js/track.js. ID 를 넣은 도구만 불러옵니다(모두 비어 있으면 아무 데도 보내지 않습니다).
  // 잘 되는지 보려면 주소 끝에 ?track-debug 를 붙여 여세요 — 화면 왼쪽 아래에 보낸 이벤트(엽서 써보기 클릭 등)가 뜹니다.
  // 도구를 넣거나 빼면 개인정보처리방침(privacy.html)의 5 · 6절 표도 실제로 쓰는 도구에 맞춰 고치세요. 이벤트 목록은 README '성과 측정'.
  analytics: {
    // ✏️ 교체: Google 애널리틱스 4 측정 ID (예: 'G-AB12CD34EF') — 애널리틱스 > 관리 > 데이터 스트림
    ga4: '',
    // ✏️ 교체: Google 태그 관리자 컨테이너 ID (예: 'GTM-ABCD123'). 태그 관리자를 쓰면 위 · 아래 도구는 비워 두고 태그 관리자 안에서 설정해도 됩니다
    //          (35차) 사용자가 준 GTM 기본 코드를 각 페이지 <head> · <body> 에 그대로 붙였다(index · privacy · play/postcard · 기사 두 편 · en — 같은 ID).
    //          여기 같은 ID 를 두면 js/track.js 가 GTM 을 다시 부르지는 않고 웹진의 이벤트(cta_click · section_time · pc_… 등)를 dataLayer 로 보낸다
    gtm: 'GTM-K97VS62N',
    // ✏️ 교체: Google 광고 태그 ID (예: 'AW-123456789')와 '엽서 써보기' 전환의 전환 라벨(예: 'AbCdEfGh123') — Google 광고 > 목표 > 전환 > 태그 설정
    googleAds: '',
    googleAdsLabel: '',
    // ✏️ 교체: Meta(인스타그램 · 페이스북) 픽셀 ID — 숫자만 (예: '123456789012345'). 이벤트 관리자에서 복사
    meta: '',
    // ✏️ 교체: 카카오 픽셀 ID — 숫자만 (예: '1234567890123456789'). 카카오비즈니스 > 픽셀 & SDK
    kakao: '',
    // (30차) GA4 교차 도메인: 웹진과 엽서 사이트를 오가는 사람을 한 방문으로 이어 본다(엽서 사이트 config.js 의 GA4_ID 도 같은 ID 로).
    //          웹진이 올라가는 주소 · 엽서 사이트 주소의 도메인
    linkDomains: ['hankyung.com', 'gamboyartmad-commits.github.io'],
  },
};
