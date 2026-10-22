# 하영 고라보게 — 제주어 웹진 + 제주어로 엽서 적기 (통합본)

제주어 웹진 「하영 고라보게」와 엽서 쓰기 사이트 「제주어로 엽서 적기」를 한 사이트로 묶은 저장소예요.
서버 없이 파일만으로 돌아가는 정적 사이트라, GitHub Pages나 아무 웹 서버 폴더에 그대로 올리면 됩니다.

## 무엇이 어디에

| 주소(이 저장소 기준) | 쪽 |
| --- | --- |
| `index.html` | 웹진 첫 화면(서브 메인) — 봉투 인트로 · 엽서 쓰기 · 인터뷰 · 지도 · 목소리 |
| `articles/interview01.html` · `interview02.html` | 인터뷰 기사 두 편 |
| `play/postcard/` | 엽서 쓰러가기 — 아래 `postcard/` 를 화면 가득 띄우고 머문 시간을 잰다 |
| `postcard/` | 제주어로 엽서 적기(엽서 고르기 → 쓰기 → 제주어로 바꾸기 → 보내기 · 게시판) |
| `postcard/admin.html` | 엽서 게시판 관리(관리자 계정으로 로그인) |
| `en/` | 외국인용 영어 웹진 「Welcome to Jeju」 |
| `privacy.html` | 개인정보처리방침 |

사이트 주소(GitHub Pages — Settings → Pages → Branch `main` · `/ (root)`)는
https://gamboyartmad-commits.github.io/webzine/ 이고, 엽서 사이트는 https://gamboyartmad-commits.github.io/webzine/postcard/ 예요.

이 저장소는 원래 엽서 사이트 저장소 `goraboge-postcard` 였어요(2026-10-22 이름을 바꾸고 웹진과 합침 — 그 전 기록은 엽서 사이트 v7.10까지).
예전 엽서 주소 `https://gamboyartmad-commits.github.io/goraboge-postcard/…`(이미 보낸 엽서 링크 포함)는 작은 저장소 `goraboge-postcard` 가 새 주소 `…/webzine/postcard/…` 로 그대로 넘겨줘요.

## 내 컴퓨터에서 보기

이 폴더에서 아래를 실행하고 http://localhost:8000/ 을 엽니다(파일을 더블클릭해서 열면 일부 기능이 안 돼요).

```bash
python3 -m http.server 8000
```

## 두 사이트가 이어지는 곳

- 웹진 `config.js` 의 `links.postcard: 'postcard/'` — 웹진의 엽서 단추가 모두 `play/postcard/` 로 가고, 그 쪽이 `postcard/` 를 띄웁니다.
- 엽서 `postcard/config.js` 의 `WEBZINE_URL: '../'` — 엽서 사이트의 '기사 보러가기' · 웹진 홍보 띠가 웹진 첫 화면으로 갑니다.
- 웹진 안에 띄워진 엽서 사이트는 누른 단추 · 보낸 방법 · 머문 시간을 웹진으로 넘깁니다(`js/play.js` ↔ `postcard/track.js`, `postMessage`). 사람이 쓴 글은 넘기지 않아요.

## 설정할 것

- **성과 측정(GA4)**: 같은 측정 ID(`G-…`)를 웹진 `config.js` 의 `analytics.ga4` 와 `postcard/config.js` 의 `GA4_ID` 에 넣습니다. 비어 있으면 아무 데도 보내지 않아요. 이벤트 목록은 `README-webzine.md` 의 '성과 측정'.
- **카카오톡 공유**: 카카오 개발자 사이트 → 앱 '하영고라보게' → 플랫폼 → Web 에 등록된 사이트 도메인에서만 됩니다. 이 저장소는 예전 엽서 사이트와 같은 `https://gamboyartmad-commits.github.io` 라 그대로 쓰고, 다른 주소로 옮기면 그 도메인을 더해 주세요.
- **엽서 게시판 · 메일**: Supabase · Apps Script 주소와 공개용 키는 `postcard/config.js` · `config.js` 에 있어요(공개돼도 되는 키만 넣습니다).

## 고치는 법

이 저장소는 팀 작업 폴더의 두 원본(`jeju-webzine/`, `제주어 엽서 사이트/`)을 합쳐 만든 사본이에요.
원본을 고친 뒤 `python3 -I .work/github/build.py` 로 다시 만들어 올립니다. 저장소에서 직접 고친 내용은 다음에 다시 만들 때 덮어써질 수 있으니, 고쳤다면 원본에도 옮겨 주세요.

- 웹진 글 · 사진 · 링크 바꾸는 법, 차수별 기록: [`README-webzine.md`](README-webzine.md)
- 주소 끝에 붙이는 도구: `?edit`(글 고치기) · `?tune`(글자 크기 · 간격) · `?photo`(사진 보정) — 작업 폴더의 '웹진 미리보기 열기.command' 로 연 미리보기에서 파일에 바로 저장돼요. `?track-debug` 는 보내는 측정 이벤트를 화면에 띄웁니다.

## 만든 것 · 쓴 것

- 사진 · 그림: 인터뷰 사진 외의 사진 · 그림은 팀이 직접 찍은 사진을 바탕으로 AI 도구로 만들었어요.
- 글꼴: 웹진 — Pretendard(OFL), 나눔손글씨 가람연꽃 © NAVER, 고운바탕(OFL), 나눔손글씨 펜(OFL), Noto Sans KR · Noto Serif KR 옛한글 조각(OFL). 엽서 사이트 — 하영 손글씨(Poor Story 바탕에 아래아를 더한 글꼴, SIL OFL 1.1 — `postcard/fonts/OFL-HayeongHand.txt`), 부크크 명조, 그리운 단정한손글씨, 고운바탕 · 고운돋움. 각 글꼴의 배포 조건을 따릅니다.
- 라이브러리(CDN): GSAP · ScrollTrigger, Leaflet, html-to-image. 지도 바탕은 EOX · OpenStreetMap.
- 문의: rjyproject26@gmail.com
