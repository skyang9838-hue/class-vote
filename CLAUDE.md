# 우리 반 투표 (class-vote)

**무엇**: 반 투표 웹앱(처음엔 반티용). 아이들은 번호로 입장(https://is.gd/vote63, 옛 banti63도 같은 곳), 선생님은 `/teacher`에서 라운드(제외 투표 / 선택 투표 / 양자택일)를 열고 마감하고 통계를 본다.

**지금 상태** (2026-11-16): 첫 판 배포. https://class-vote.class-soccer.workers.dev · 후보 8개는 `src/items.js`.

**주의**
- 배포는 `npx wrangler deploy` (Cloudflare Workers + Durable Object 하나 "main"). GitHub push만으로는 배포 안 됨. 이 컴은 class-soccer의 wrangler로 돌림: `node ..\class-soccer\node_modules\wrangler\bin\wrangler.js deploy`.
- 11/17 오후: 선생님 비밀번호(state.pin, 처음 열 때 정함), 표 수는 선생님 화면에만, 1등은 선생님이 '발표'를 눌러야 아이들 화면에 뜸(state.announced), 라운드 사이에 '항목 고치기'(이름·사진·쇼핑몰 주소). 번호는 0~total(지금 25).
- 11/17 첫 실전: 아르헨티나 11 : 맨유 9로 결정.
- `src/items.js`는 새 투표를 만들 때의 기본 후보일 뿐, 그 뒤엔 서버 상태의 items(선생님 편집)가 기준. 패들렛 미리보기 주소는 깨지니 쇼핑몰 원본 사진 주소를 쓴다.
- 수업 중 배포해도 상태(DO 저장소)는 남지만, 화면이 잠깐 끊길 수 있다.
- 11/17 저녁 v2: 이름 "우리 반 투표" + 주제 칸, 옛 데이터 삭제(state.v !== 2면 storage.deleteAll). 항목은 선생님 화면 라운드 준비 때 바로 추가(+ 카드, 여러 줄 붙여넣기)·✕ 지우기·이름 눌러 고치기, 사진은 Ctrl+V(480px jpeg로 줄여 DO에 `img:<id>`로 저장, /api/img/<id>로 냄). 사진 없으면 이름만 큰 카드.
