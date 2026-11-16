# 반 투표 (class-vote)

**무엇**: 반티 투표 웹앱. 아이들은 번호로 입장(https://is.gd/banti63), 선생님은 `/teacher`에서 라운드(제외 투표 / 선택 투표 / 양자택일)를 열고 마감하고 통계를 본다.

**지금 상태** (2026-11-16): 첫 판 배포. https://class-vote.class-soccer.workers.dev · 후보 8개는 `src/items.js`.

**주의**
- 배포는 `npx wrangler deploy` (Cloudflare Workers + Durable Object 하나 "main"). GitHub push만으로는 배포 안 됨. 이 컴은 class-soccer의 wrangler로 돌림: `node ..\class-soccer\node_modules\wrangler\bin\wrangler.js deploy`.
- 선생님 열쇠는 투표를 만들 때 한 번 나오고 그 브라우저 localStorage에 저장된다. "처음부터 다시"는 결과만 지우고 열쇠는 그대로.
- 수업 중 배포해도 상태(DO 저장소)는 남지만, 화면이 잠깐 끊길 수 있다.
