# 시공사례 검색 노출 운영 가이드

시공사례의 공개, 기술적 색인 가능성, URL 제출, 실제 색인, 검색 노출은 서로 다른 상태다.

1. `published`: 사이트에 공개되어 독립 상세 URL이 생긴 상태
2. `technicalIndexability=PASS`: HTTP·metadata·canonical·robots·SSR·schema·sitemap·내부 링크가 정상인 상태
3. `IndexNow=pending/submitted`: URL 제출 대기 또는 API 접수 상태
4. `indexStatus=indexed`: Search Advisor/GSC의 URL 검사 또는 공개 검색결과에서 해당 상세 URL을 직접 확인한 상태
5. `exactTitleStatus`: 전체 제목 검색에서 보이는지 확인한 참고값
6. `keywordStatus`: 일반 검색어에서 보이는지 확인한 참고값

앞 단계의 성공으로 뒤 단계를 추정하지 않는다. 특히 IndexNow의 `submitted`는 색인 완료가 아니고, 전체 제목 검색에서 안 보이는 것만으로 미색인이라고 단정하지 않는다.

## Decap CMS 입력

- `⑩ 시공 사례(사진)`에서 `작성 상태`, `게시일`, `콘텐츠 수정일`을 관리한다.
- 새 사례와 기존 사례의 수정 저장에는 검색 제목과 현장별 실제 작업 설명 80자 이상이 필요하다. 기존에 이미 공개된 사례의 런타임 색인 하한(40자)은 대량 제외를 피하기 위해 유지하되, 80자 미만 글은 다음 수정 때 함께 보강한다. 제목 중복은 CMS가 다른 파일까지 조회할 수 없어 배포 전 회귀검사에서 차단한다.
- `게시일`은 문서를 사이트에 공개한 날짜이고 `작업일`은 실제 현장 작업일이다.
- `콘텐츠 수정일`은 제목·설명·사진·현장 정보가 실제로 바뀐 날만 입력한다.
- 실제 검색 확인은 사례 JSON을 수정하지 않고 `⑬ 시공사례 검색 추적`에 URL별·검색엔진별로 기록한다.
- Search Advisor/GSC URL 검사 또는 공개 검색결과에서 해당 상세 URL을 직접 확인했을 때만 `indexed`를 선택한다. `not_indexed`는 Search Advisor/GSC URL 검사에서 미색인이 확인된 경우에만 선택한다.
- IndexNow 대기·접수 기록은 `⑧ IndexNow 제출 대기열`에서 확인한다.

## 변경 URL 후보와 IndexNow

후보 생성기는 새 공개, 초안 전환·삭제, 색인 신호 변경, 실제 콘텐츠·사진·수정일 변경만 감지한다. 전체 `/gallery`나 사이트 전체를 반복 제출하지 않는다. 연결된 승인 Drive 프로젝트의 전·후·추가 사진 변경도 해당 사례만 후보가 된다.

```bash
# 1. 마지막으로 처리한 커밋 이후 후보만 검토
npm run seo:gallery-indexnow -- --since <마지막-처리-커밋> --dry

# 2. 검토한 후보를 대기열에 반영(네트워크 제출 없음)
npm run seo:gallery-indexnow -- --since <마지막-처리-커밋>

# 3. 실제 전송 payload 재확인
npm run seo:indexnow -- --dry

# 4. 승인한 경우에만 실제 API 제출
npm run seo:indexnow
```

후보 생성과 실제 제출은 같은 대기열 잠금을 사용한다. 동시 실행에 따른 중복 제출이나 전송 중 새 항목 유실을 막으며, 대기열 쓰기는 임시 파일을 이용해 원자적으로 교체한다.

## 전수 기술 감사

운영 빌드를 로컬 서버로 띄운 뒤 실행한다.

```bash
npm run build
npm run start -- -p 3000
npm run seo:gallery-index -- --base-url http://127.0.0.1:3000
```

감사 결과는 다음 파일로 생성된다.

- `reports/gallery-index-status.csv`
- `reports/gallery-index-status.md`

감사는 공개 원본 JSON과 실제 런타임 문서의 1:1 정합, HTTP 200, 고유 title/description/H1, production self-canonical, 명시적 `index,follow`, 초기 SSR 본문, Article·BreadcrumbList, OG, cases sitemap, `/gallery` 페이지네이션의 실제 `<a href>`, IndexNow 상태, 네이버·구글별 수동 관측을 URL 단위로 합친다. 잘못된 추적 URL·enum·JSON도 조용히 버리지 않고 실패로 보고한다.

짧거나 서로 매우 유사한 설명은 `contentQualityWarning`으로만 표시한다. 이 경고만으로 글을 자동 삭제하거나 `noindex`로 바꾸지 않는다.

## 회귀·릴리스 검사

```bash
npm run typecheck
npm run lint
npm run test:seo
npm run build
npm run seo:validate-index
npm run seo:verify
```

`test:seo`에는 공개/초안 원본 정합, 상세 URL·metadata 고유성, 사이트맵, 대표 이미지 폴백, 같은 지역 관련 링크, gallery 실제 링크 원천, IndexNow 변경 분류·중복·되돌림 방지가 포함된다. 실제 HTTP 전수 감사와 route smoke는 운영 빌드 서버에서 별도로 실행한다.
