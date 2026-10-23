# 하영 고라보게 — 제주어 웹진 + 제주어로 엽서 적기 (통합본)

제주어 웹진 「하영 고라보게」와 엽서 쓰기 사이트 「제주어로 엽서 적기」를 한 사이트로 묶은 저장소예요.
서버 없이 파일만으로 돌아가는 정적 사이트라, 이 저장소의 파일을 웹 서버 폴더에 **그대로** 올리면 됩니다(빌드 과정 없음).

## 실제 주소 (한국경제 웹진)

이 저장소를 그대로 가져가 `https://lxwebzine.hankyung.com/2026-1/team1/` 아래에 올립니다.

| 들어오는 길 | 주소 | 이 저장소의 파일 |
| --- | --- | --- |
| 메인(웹진 첫 화면) | `…/team1/` | `index.html` |
| 광고 · 웹진의 '제주어 엽서 써보기' | `…/team1/play/postcard/` | `play/postcard/` (엽서 사이트 자체) |
| 인터뷰 기사 | `…/team1/articles/interview01.html` · `interview02.html` | `articles/` |
| 영어 웹진 | `…/team1/en/` | `en/` |
| 개인정보처리방침 | `…/team1/privacy.html` | `privacy.html` |
| 예전 엽서 링크(이미 보낸 엽서) | `…/team1/postcard/?p=…` | `postcard/` — `play/postcard/` 로 넘겨줌 |
| 엽서 게시판 관리 | `…/team1/play/postcard/admin.html` | 관리자 계정으로 로그인 |

GitHub Pages(Settings → Pages → Branch `main` · `/ (root)`) 주소 https://gamboyartmad-commits.github.io/webzine/ 에서도 똑같이 열려요(시험용).

## 둘러보는 길(네비게이션)

1. **광고로 들어온 사람** — `play/postcard/`: 첫 화면(책상 위 편지 + '지금, 생각나는 사람이 있나요?')을 잠깐 보여 준 뒤 저절로 편지 쓰기 화면까지 내려가요 →
   편지 쓰기 → '제주어로 보내기' → 보내기(카카오톡 · 메일 · 링크 복사 · 이미지 저장 · 게시판) →
   위 막대 '영상 보러 가기'(웹진의 '왜 제주어로 써야 할까요?' 영상, `../../#why`) · 아래 '제주어 이야기, 더 읽어 볼까요?'(웹진 첫 화면)로 웹진 콘텐츠를 이어 봐요.
2. **메인으로 들어온 사람** — `index.html`: 봉투 인트로(스티커 · 휠 한 칸 · 손가락으로 밀기 · 가만히 있으면 저절로 — 약 2초) → '엽서 쓰기' →
   '왜 제주어로 써야 할까요?' 영상 · 목소리 · 인터뷰 기사(끝에 '웹진 홈으로') · 상호 지도 → '제주어 엽서 써보기'(위 단추 · 오른쪽 플로팅 배너 · 맨 아래 카드) →
   엽서 사이트의 편지 쓰기 화면으로 바로(`play/postcard/?start=write` — 첫 화면은 건너뜀) → 보낸 뒤 웹진으로. 웹진에서 온 사람은 엽서 사이트 위 로고 '하영 고라보게'를 눌러도 웹진 첫 화면으로 돌아가요.
   인트로는 지나가면 다시 올라갈 수 없고, 같은 방문에서 웹진으로 돌아오면(기사 · 영어 · 엽서 사이트 → 웹진) 건너뜁니다.
3. **카카오톡 · 메일로 엽서를 받은 사람** — 받은 엽서 → 답장하기 · 나도 엽서 쓰기 · 웹진 보러 가기.

## 올릴 때 확인할 것

- **카카오톡 공유**: 카카오 개발자 사이트 → 앱 '하영고라보게'에 `https://lxwebzine.hankyung.com` 을 **두 곳** 등록해야 해요 — 플랫폼 → Web 의 사이트 도메인(JavaScript SDK 도메인), 제품 링크 관리 → 웹 도메인. 없으면 이 주소에서 카카오톡 보내기가 '도메인이 맞지 않음'으로 거절돼요.
- **메일 보내기**: `play/postcard/` 의 메일은 구글 Apps Script 가 보냅니다. 코드 = `제주어 엽서 사이트/_tools/mail_script.gs`(팀 작업 폴더) — 고친 뒤 script.google.com 에서 다시 배포(배포 관리 → 새 버전).
- **성과 측정**: Google 태그 관리자 `GTM-K97VS62N` 이 웹진의 모든 쪽 `<head>` · `<body>` 에 들어 있고, 엽서 사이트(`play/postcard/config.js` 의 `GTM_ID`)도 같은 컨테이너를 불러요. 이벤트 목록은 `README-webzine.md` 의 '성과 측정'.
- **웹진메인 카드**: 한경 웹진 메인(`/2026-1/`)은 이 폴더의 `webzine.json` 을 읽어 카드를 만들어요(이름 · 큰 문구 · 설명 · 가로 사진 `assets/card/card-wide.jpg` · 세로 4:5 사진 `assets/card/card-tall.jpg` · 사진 설명 · 기사). 카드 문구나 사진을 바꾸려면 이 파일을 고치면 돼요.
- **엽서 게시판**: Supabase 주소와 공개용 키는 `play/postcard/config.js`(공개돼도 되는 키만).
- 하위 폴더 주소가 `/` 로 끝나면 그 폴더의 `index.html` 을 열어 주도록(일반 웹 서버의 기본값) 해 주세요 — `play/postcard/` · `en/` · `postcard/`.

## 내 컴퓨터에서 보기

이 폴더에서 아래를 실행하고 http://localhost:8000/ 을 엽니다(파일을 더블클릭해서 열면 일부 기능이 안 돼요).

```bash
python3 -m http.server 8000
```

## 고치는 법

이 저장소는 팀 작업 폴더의 두 원본(`jeju-webzine/`, `제주어 엽서 사이트/`)을 합쳐 만든 사본이에요.
원본을 고친 뒤 `python3 -I .work/github/build.py` 로 다시 만들어 올립니다. 저장소에서 직접 고친 내용은 다음에 다시 만들 때 덮어써질 수 있으니, 고쳤다면 원본에도 옮겨 주세요.

- 웹진 글 · 사진 · 링크 바꾸는 법, 차수별 기록: [`README-webzine.md`](README-webzine.md)
- 주소 끝에 붙이는 도구: `?edit`(글 고치기) · `?tune`(글자 크기 · 간격) · `?photo`(사진 보정) — 작업 폴더의 '웹진 미리보기 열기.command' 로 연 미리보기에서 파일에 바로 저장돼요. `?track-debug` 는 보내는 측정 이벤트를 화면에 띄웁니다.

이 저장소는 원래 엽서 사이트 저장소 `goraboge-postcard` 였어요(2026-10-22 이름을 바꾸고 웹진과 합침 — 그 전 기록은 엽서 사이트 v7.10까지).

## 만든 것 · 쓴 것

- 사진 · 그림: 인터뷰 사진 외의 사진 · 그림은 팀이 직접 찍은 사진을 바탕으로 AI 도구로 만들었어요.
- 글꼴: 웹진 — Pretendard(OFL), 나눔손글씨 가람연꽃 © NAVER, 고운바탕(OFL), 나눔손글씨 펜(OFL), Noto Sans KR · Noto Serif KR 옛한글 조각(OFL). 엽서 사이트 — 하영 손글씨(Poor Story 바탕에 아래아를 더한 글꼴, SIL OFL 1.1 — `play/postcard/fonts/OFL-HayeongHand.txt`), 부크크 명조, 그리운 단정한손글씨, 고운바탕 · 고운돋움. 각 글꼴의 배포 조건을 따릅니다.
- 라이브러리(CDN): GSAP · ScrollTrigger, Leaflet, html-to-image. 지도 바탕은 EOX · OpenStreetMap.
- 인스타그램: [@jeju_goraboge](https://www.instagram.com/jeju_goraboge/) · 문의: rjyproject26@gmail.com
