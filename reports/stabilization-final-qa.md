# [PRODACO 안정화 + QA 완료]

- 일자: 2026-09-03 (Asia/Seoul)
- 저장소: `https://github.com/ggg8u-png/prodaco`
- 배포·QA 기준: `main` at `c9ba223`
- Release 판정: **CONDITIONALLY READY**

## 1. 재현된 오류

1. Decap 시공사례 작성 오른쪽 미리보기의 `Minified React error #525`.
2. 프로덕션 dependency audit의 high severity 취약점 4건.
3. ESLint 경고 3건.
4. Next workspace root 자동 추론 경고.
5. prebuild Drive 이미지 다운로드 14건 실패(기존 URL fallback 정상).
6. 새 시공사례의 선택형 추가 사진 목록이 빈 사진 1건(`No src`)으로 시작.

세부 재현 정보는 `reports/stabilization-error-inventory.md`에 기록했다.

## 2. Root Cause

- CMS 미리보기: Decap CMS 내부 React와 별도로 로드한 React 18로 element를 생성해 서로 다른 React renderer가 섞였다.
- dependency audit: `next@15.3.9`와 고정된 전이 `postcss`/`sharp`/`nanoid` 버전이 최신 보안 권고 범위에 포함됐다.
- lint: raw `<img>` 사용 2곳과 매 render마다 새 객체를 만드는 estimate 계산.
- workspace 경고: 저장소 상위의 다른 `package-lock.json`을 Next가 root로 추론했다.
- Drive 다운로드: 외부 credential/공유 권한 또는 현재 환경의 네트워크 조건. 선택 기능이며 fallback이 구현돼 있어 전체 build는 실패하지 않는다.

## 3. 수정 파일

- `.gitignore`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `public/admin/config.yml`
- `public/admin/index.html`
- `scripts/seo-tests.ts`
- `scripts/stabilization-route-smoke.mjs`
- `src/app/gallery/page.tsx`
- `src/components/WorkPhotos.tsx`
- `src/components/QuoteChecklist.tsx`
- `reports/stabilization-error-inventory.md`
- `reports/stabilization-final-qa.md`

## 4. 수정 내용

- 외부 React 18 CDN을 제거하고 Decap 제공 `window.h`로 preview element 생성.
- 선택형 현장 추가 사진 목록에 `default: []`를 지정해 빈 사진 0건으로 시작하도록 변경.
- Next/ESLint config를 15.5.25로 패치하고 `postcss`/`sharp` 및 lockfile을 보안 패치 버전으로 갱신.
- Next 전이 의존성도 패치 버전을 쓰도록 npm overrides 적용.
- `outputFileTracingRoot`를 현재 저장소로 고정.
- 작업사진 `<img>` 2곳을 Next `Image`로 변경.
- 견적 calculator의 계산 객체를 `useMemo`로 안정화.
- 실제 production HTTP route smoke 스크립트와 npm script 추가.
- 안정화 보고서 2개만 reports ignore 예외로 추적 가능하게 변경.

## 5. 추가한 regression test

- Decap 관리자 HTML에 별도 React CDN이 없는지 검사.
- 맞춤 미리보기가 `window.h`를 사용하는지 검사.
- `window.React.createElement` 재도입 방지.
- 시공사례의 선택형 사진 목록이 빈 배열로 시작하는지 검사.
- sitemap에서 실제 표본을 선택하는 `test:routes` 추가:
  - core 6
  - gallery detail 5
  - blog detail 5
  - region 5
  - combo landing 10
  - invalid URL 5
- 각 실제 URL에서 HTTP status, final URL, title, H1, canonical, robots, description, SSR 본문, JSON-LD parse, BreadcrumbList count, og:image, sitemap inclusion, internal links, CTA 검사.

기존 before/after fixture도 재실행했다:

- 같은 현장 valid pair → PASS
- 다른 pair → REJECT
- pair 정보 없음 → 일반 사진 처리

## 6. 실행한 QA 명령

```text
git status
git branch -vv
git log -10
git diff
npm ci
npm run typecheck
npm run lint
npm run test:seo
npm run test:photos
npm run build
npm run seo:audit
npm run seo:pages
npm run seo:quality
npm run seo:quality:full
npm run seo:validate-index
npm run seo:verify
npm run seo:pseo-quality
npm run seo:links
npm run seo:brand
npm run seo:urls
npm run ai:verify
npm run ai:queue:verify
npm run ai:scheduler:verify
npm run seo:search-data
npm run seo:indexnow -- --dry
node scripts/photos-audit.mjs --report-only
node --use-system-ca scripts/phase13-host-audit.mjs
node --use-system-ca scripts/verify-live.mjs
npm run test:routes -- --base http://127.0.0.1:3001
npm audit
```

## 7. Build 결과

- PASS
- Next.js: 15.5.25
- optimized production compile: PASS
- 정적 페이지: 1,702/1,702 생성
- 환경변수/Drive 다운로드가 없어도 site build는 완료됨.

## 8. Typecheck 결과

- PASS — `tsc --noEmit`, 오류 0건.

## 9. Lint 결과

- PASS — `No ESLint warnings or errors`.
- 참고: Next 15.5에서 `next lint` 자체의 향후 Next 16 제거 안내만 출력되며 코드 warning은 아니다.

## 10. Test 결과

- PASS
- `test:seo`: 1,569개 검증 통과.
- Phase 09 콘텐츠: 15/15 통과.
- Phase 10 sitemap: 7 group, 1,418 URL, violation 0.
- `test:photos`: workphotos 8/8, Drive 6/6 통과.
- dependency audit: `found 0 vulnerabilities`.

## 11. Route QA 결과

- 로컬 production server: 36/36 PASS.
- 실제 존재 URL 31개: HTTP 200, final URL 유지, title/H1/canonical/description/SSR/JSON-LD/OG/sitemap/internal link/CTA 검증 통과.
- 존재하지 않는 URL 5개: 전부 실제 HTTP 404.
- soft 404 0건.
- 세부 결과: `reports/stabilization-route-smoke.md` 및 JSON(생성 산출물, gitignore 대상).

## 12. CMS QA 결과

- Decap config/save identifier 회귀 검사 PASS.
- Git Gateway로 로그인된 별도 Chrome 세션에서 production Decap CMS QA 수행.
- Netlify production deploy `c9ba223` 상태 `ready`, deploy error 없음(143초).
- 외부 React 18 로드 없음, `window.h` 사용, `window.React.createElement` 없음.
- 새 시공사례: 오른쪽 SEO metadata preview 정상, 오류 화면 없음, 추가 사진 0건으로 시작.
- 기존 시공사례 `case-20260902-1116`: 저장된 제목·설명·canonical·대표 이미지 preview 정상.
- 새 블로그: 오른쪽 SEO metadata preview 정상, 오류 화면 없음.
- 배포 이후 위 세 화면의 Chrome console error 0건.
- **NEEDS INPUT:** 실제 콘텐츠 생성은 외부 변경이므로 draft 저장 → 수정 → 이미지 지정 → publish → 삭제 E2E는 수행하지 않았다.

## 13. SEO QA 결과

- 정적 HTML audit: 1,686페이지, 이슈 0.
- index validation: 1,684 URL, index 1,548, noindex 136, sitemap 1,418.
- sitemap에 noindex/중복/없는 URL 없음.
- canonical loop/chain/404 target 없음.
- unique title 누락/중복 0, missing description 0, missing canonical 0, missing H1 0, missing OG 0.
- BreadcrumbList 중복 0.
- 내부 링크 orphan 0, 최대 3 click, violation 0.
- live vs local 표본 26개 불일치 0, sitemap 1,418 vs 1,418 MATCH.
- P3: full 유사도 휴리스틱에서 5개 클러스터(11 URL) 경고. 확인되지 않은 내용을 만들어 해소하지 않음.

## 14. Image/Drive QA 결과

- 사진 247장 감사.
- 승인/공개 242장.
- 중복 제외 4장.
- reviewNeeded 1장(ID `7f7cb2d1eaa1`, 스크린샷/캡처 의심) — 공개 보류.
- 공개 manifest 변경 없음.
- 대표 이미지 resolver/legacy fallback 테스트 PASS.
- Drive project 검증 6/6 PASS.
- prebuild 다운로드 14건 실패 시 Drive URL fallback 작동, build PASS.

## 15. 남은 P2/P3

- P2: credential/권한이 있는 운영 환경에서 Drive 이미지 14건의 실제 다운로드 확인.
- P3: 유사도 경고 5개 클러스터에 실제 지역별 사례/사진을 확보해 보강.
- P3: 사진 ID `7f7cb2d1eaa1` 개인정보 육안검토.
- P3: Next 16 전에 `next lint`를 ESLint CLI로 이전(현재 Next 15에서는 정상 통과).

## 16. 사용자 입력/credential 필요한 부분

1. 테스트 콘텐츠를 실제 생성해도 되는 경우 CMS draft-save-edit-publish-delete E2E 확인.
2. Drive credential 또는 파일 공유 권한으로 14개 이미지 다운로드 확인.
3. 보류 사진 1건 육안검토.

## 17. Release 판정

**CONDITIONALLY READY**

코드 기준 P0=0, P1=0이며 build/typecheck/lint/tests/핵심 routes가 모두 통과했다. 사용자가 보고한 React #525의 직접 원인을 제거했고, 배포 후 인증된 production CMS에서 새 글·기존 글 preview와 console까지 통과했다. 다만 실제 콘텐츠를 만드는 save/publish E2E와 Drive credential 검증, 보류 사진 1건의 육안검토가 남아 있으므로 무조건 READY로 표기하지 않는다.

배포 후 확인 조건:

1. draft 저장 후 수정/게시가 정상인지 확인(테스트 콘텐츠 생성 승인 시).
2. 대표 이미지 카드·상세·OG 일치 확인.
3. 배포 빌드에서 dependency audit/build가 동일하게 통과하는지 확인.
