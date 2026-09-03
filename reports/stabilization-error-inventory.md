# PRODACO 안정화 오류 Inventory

- 조사일: 2026-09-03 (Asia/Seoul)
- 저장소: `https://github.com/ggg8u-png/prodaco`
- 기준 브랜치/커밋: `main` / `95e8d75`
- 기준 문서: `PRODACO_CODEX_SEQUENTIAL_MASTER_PLAN_V2.md` (사용자 제공 로컬 사본)
- 원칙: 기존 콘텐츠·URL·canonical·사용자 변경을 reset/revert하지 않음

## 요약

| ID | 등급 | 상태 | 증상 |
|---|---|---|---|
| STAB-001 | P1 | FIXED | Decap 시공사례 편집 오른쪽 미리보기에서 React error #525 |
| STAB-002 | P1 | FIXED | 프로덕션 의존성 감사에서 Next.js·PostCSS·Sharp·Nanoid 고위험 취약점 |
| STAB-003 | P2 | FIXED | ESLint 경고 3건(`<img>` 2건, 불안정한 hook dependency 1건) |
| STAB-004 | P2 | FIXED | Next 15.5가 상위 폴더 lockfile을 workspace root로 오인 |
| STAB-005 | P2 | NEEDS INPUT | prebuild에서 외부 Drive 이미지 14건 다운로드 실패, URL fallback으로 빌드는 정상 |
| STAB-006 | P3 | OPEN | full SEO 유사도 감사에서 5개 클러스터(11 URL) 경고 |
| STAB-007 | P3 | NEEDS REVIEW | 사진 1건이 스크린샷/캡처 의심으로 공개 보류 |

## 상세

### STAB-001 — Decap 미리보기 React #525

- 등급: P1
- 재현 화면: 사용자가 제공한 시공사례 작성 화면. 오른쪽 미리보기 패널에 `Minified React error #525` 표시.
- 오류 위치: `public/admin/index.html`의 맞춤 미리보기 등록 코드.
- 재현 방법: `/admin/` → `⑩ 시공 사례(사진)` → 새 글/편집 진입 → 오른쪽 미리보기 확인.
- 예상 원인(수정 전): Decap CMS 번들과 별도로 React 18 UMD를 로드하고 `window.React.createElement`로 만든 element를 Decap renderer에 전달.
- 확인된 root cause: React #525는 다른 React 버전에서 생성한 element를 렌더링할 때 발생한다. Decap 브라우저 번들이 제공하는 `window.h`를 쓰지 않고 외부 React 18을 사용한 것이 직접 원인.
- 수정:
  - 외부 React 18 CDN `<script>` 제거.
  - Decap과 동일한 renderer가 제공하는 `window.h` 사용.
  - `window.h`가 준비될 때까지 등록을 지연하도록 guard 변경.
  - 외부 React 재도입을 막는 회귀 테스트 3개 추가.
- 검증:
  - `npm run test:seo`: 관련 회귀 테스트 포함 1,568개 통과.
  - 최종 production build의 `/admin/index.html`: Identity + Decap만 로드, 외부 React 없음, 브라우저 콘솔 error 0건.
- 제한: Git Gateway 인증 세션이 없는 로컬 브라우저에서는 실제 draft 저장/수정/publish까지 수행하지 못함.

### STAB-002 — 프로덕션 의존성 고위험 취약점

- 등급: P1
- 최초 오류: `npm audit --omit=dev`가 high severity 4건으로 종료 코드 1.
- 발생 패키지: `next@15.3.9` 및 전이 `postcss`, `sharp`, `nanoid`.
- 재현 방법: 시스템 CA를 사용하는 Node로 `npm audit --omit=dev` 실행.
- root cause: 오래된 Next 15 패치 버전과 Next에 고정된 취약한 전이 의존성.
- 수정:
  - `next`/`eslint-config-next`를 `15.5.25`로 고정.
  - `postcss`를 `^8.5.26`, `sharp`를 `0.35.4`로 갱신.
  - npm overrides로 Next 전이 의존성도 같은 패치 버전을 사용하도록 통합.
  - 비강제 `npm audit fix`로 빌드 도구 전이 취약점도 갱신.
- 검증:
  - clean `npm ci` 성공.
  - 전체 `npm audit`: `found 0 vulnerabilities`.
  - Next 15.5.25 build 및 1,702개 정적 페이지 생성 성공.

### STAB-003 — ESLint 경고 3건

- 등급: P2
- 발생 파일:
  - `src/app/gallery/page.tsx`: `<img>` 사용.
  - `src/components/WorkPhotos.tsx`: `<img>` 사용.
  - `src/components/QuoteChecklist.tsx`: 매 render마다 새로 생성되는 `estimate`가 effect dependency.
- 수정:
  - 두 이미지 렌더를 `next/image`의 `Image`로 변경.
  - 가격 범위와 estimate 계산을 `useMemo`로 안정화.
- 검증: `npm run lint` → `No ESLint warnings or errors`.

### STAB-004 — 잘못된 workspace root 추론

- 등급: P2
- 오류: Next 15.5가 `C:\\Users\\CORI\\package-lock.json`을 workspace root 기준으로 선택했다는 경고.
- 발생 파일: `next.config.ts`.
- 원인: 저장소 상위에 별도 lockfile이 존재해 자동 추론이 넓은 경로를 선택.
- 수정: `outputFileTracingRoot: process.cwd()`로 저장소 루트 고정.
- 검증: 이후 lint/build에서 해당 경고 재발 없음.

### STAB-005 — Drive 이미지 다운로드 14건 실패

- 등급: P2
- 상태: NEEDS INPUT
- 오류: prebuild `fetch-gallery`에서 `total=14`, `failed=14`.
- 예상 원인: 비공개 Drive 권한 또는 현재 실행 환경의 외부 다운로드 제한.
- 영향: 다운로드 실패 시 기존 Drive URL fallback을 사용하므로 build와 사이트 생성은 정상. 사이트 전체를 throw하지 않음.
- 검증: build PASS, `drive-projects-verify` 6/6 PASS.
- 필요한 입력: 실제 Drive credential/공유 권한이 있는 운영 환경에서 다운로드 성공 여부 확인.

### STAB-006 — 본문 유사도 클러스터

- 등급: P3
- 상태: OPEN (보고만 함)
- 결과: `seo:quality:full`에서 5개 클러스터, 11개 URL이 MinHash 유사도 0.8 이상 경고.
- 영향: 표준 품질 게이트는 실패 0건이며 build 차단 없음.
- 권장: 실제 지역별 사례·사진·현장 고유 정보를 확보할 때 해당 URL부터 보강. 확인되지 않은 사실을 자동 생성해 해소하지 않음.

### STAB-007 — 사진 개인정보 육안검토

- 등급: P3
- 상태: NEEDS REVIEW
- 대상 ID: `7f7cb2d1eaa1`
- 파일명: `Screenshot_20251001_105507_KakaoTalk.png`
- 플래그: 스크린샷/캡처 의심.
- 영향: 공개 보류 상태이며 승인 manifest에는 포함되지 않음. 나머지 242장은 승인/공개, 중복 4장은 제외.
- 필요한 입력: 운영자가 `reports/photo-contact-sheet.html`에서 개인정보 포함 여부를 육안 확인.

## 재현 중 확인된 QA 환경 이슈(제품 오류 아님)

- 로컬 Node 24가 시스템 CA를 기본 사용하지 않아 최초 라이브/감사 fetch가 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`로 실패했다.
- 동일 스크립트를 `node --use-system-ca`로 재실행해 host audit과 live diff가 모두 통과했다.
- production route smoke 이후 Next 런타임 캐시에 의도적 404 표본이 생성되어 정적 감사에 잡혔다. clean build 후 서버를 띄우지 않은 상태에서 재감사하여 이슈 0건을 확인했다.

## 최종 등급 현황

- P0: 0
- P1: 0 (2건 모두 수정·회귀 검증 완료)
- P2: 1 NEEDS INPUT (Drive 다운로드, graceful fallback 정상)
- P3: 본문 유사도 경고 1묶음, 사진 육안검토 1건
