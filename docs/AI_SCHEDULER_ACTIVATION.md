# AI 초안 예약 실행 활성화 안내

현재 상태: **비활성**. 이 저장소에는 cron을 등록하는 Netlify Function이 아직 없습니다.

선택한 후보는 Netlify Scheduled Functions입니다. 현재 사이트가 Netlify에서 배포되고, 실행이 운영자 PC와 무관하며, GitHub Actions용 별도 토큰을 추가하지 않아도 되기 때문입니다. Netlify의 scheduled function은 published deploy에서 UTC 기준으로 실행되고 30초 제한이 있으므로, 활성화 시 최소 1시간마다 최대 5개 초안만 처리합니다.

## 활성화 전 필수 조건

1. 운영자가 AI provider와 server-only credential 또는 Netlify AI Gateway 사용을 승인한다.
2. CMS Git 큐를 서버 저장소(Netlify Blobs 등)와 동기화할 관리자 인증 API를 별도 검토·승인한다.
3. `AI_SCHEDULER_ENABLED=true`를 Netlify 환경변수에만 설정한다. 저장소·클라이언트 코드에는 넣지 않는다.
4. auto publish가 필요한 경우에도 `AI_AUTO_PUBLISH=true`를 별도 명시하고, publish adapter와 추가 운영 승인을 거친다.

## 활성화 시 추가할 얇은 wrapper

`netlify/functions/ai-draft-scheduler.ts`에 `schedule: "0 * * * *"`를 설정하고 `_shared/ai-draft-scheduler.ts`의 `runScheduledDrafts`만 호출합니다. `next_run`을 idempotency key로 사용하고, Netlify Blobs site-scoped strong-consistency store에 run record를 기록합니다.

실패 항목은 최대 3회까지 다음 시간 실행에 재시도하고 이후 `failed`로 남깁니다. 품질 게이트가 통과해도 기본 결과는 `draft`; gate 실패는 `review`입니다. 이 runner에는 publisher가 없으므로 현재 코드에서는 어떤 환경변수 조합도 자동 발행하지 않습니다.
