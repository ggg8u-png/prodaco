# 구글 서치콘솔 소유확인 — DNS TXT 레코드 (prodaco.kr)

구글 서치콘솔에서 **도메인 속성**(`prodaco.kr`)을 등록하면 DNS TXT 레코드로 소유확인을 요구한다.
아래 값을 prodaco.kr 의 DNS 에 추가하면 된다.

## 1. 추가할 레코드

| 항목 | 값 |
| --- | --- |
| 유형(Type) | `TXT` |
| 이름/호스트(Name/Host) | 비워둠 = 루트 도메인 (`@` 또는 `prodaco.kr` 로 표기하는 곳도 있음) |
| 값(Value) | `google-site-verification=7f2IHKl2pfSZipwOeIhbIKHq5Kcqyl7UZ8_WO0hNK50` |
| TTL | 기본값(3600 등) 그대로 |

주의사항

- 값은 `google-site-verification=` 접두사까지 **통째로** 넣는다. 접두사를 빼면 확인되지 않는다.
- 서브도메인(`www`)에 넣지 않는다. 도메인 속성은 **루트 도메인**의 TXT 를 본다.
- 기존 TXT 레코드(SPF 등)가 있으면 **덮어쓰지 말고 레코드를 하나 더 추가**한다.
  한 도메인에 TXT 여러 개가 공존할 수 있다.
  (2026-07 기준 prodaco.kr 루트에는 TXT 레코드가 없었다 — 처음 추가하는 경우다.)

## 2. 어디에서 추가하나 — **Netlify DNS**

prodaco.kr 은 네임서버가 Netlify DNS(NS1)로 위임돼 있다.

```
$ node -e "require('dns').promises.resolveNs('prodaco.kr').then(console.log)"
[ 'dns1.p05.nsone.net', 'dns2.p05.nsone.net', 'dns3.p05.nsone.net', 'dns4.p05.nsone.net' ]
```

즉 **도메인을 산 등록대행업체(가비아·후이즈·카페24 등)의 DNS 화면이 아니라 Netlify 에서** 추가해야 한다.
등록대행업체 쪽에 TXT 를 넣어도 실제 조회는 Netlify 존을 보기 때문에 반영되지 않는다.
(등록대행업체 화면에서는 네임서버가 위 `*.nsone.net` 로 지정돼 있는지만 확인하면 된다.)

Netlify 에서 추가하는 순서:

1. Netlify 로그인 → 상단 **Domains** (또는 사이트 → Domain management)
2. 도메인 목록에서 **prodaco.kr** 선택 → **DNS records**
3. **Add new record** 클릭
4. Type `TXT` / Name **비워둠**(루트) / Value `google-site-verification=7f2IHKl2pfSZipwOeIhbIKHq5Kcqyl7UZ8_WO0hNK50` / TTL 기본값
5. Save
6. 서치콘솔로 돌아가 **확인(VERIFY)** 클릭

DNS 전파는 보통 수 분, 늦으면 TTL 만큼(최대 1시간 내외) 걸린다.
바로 실패하면 몇 분 뒤 다시 **확인**을 누르면 된다.

## 3. 반영 확인

레포에 확인 스크립트가 있다. 전파 여부를 바로 볼 수 있다.

```bash
npm run verify:dns
```

- 통과: `✅ TXT 레코드 확인됨` + 조회된 값 출력
- 실패: 현재 루트 TXT 목록을 보여주고 종료 코드 1

다른 도메인·다른 토큰을 확인하려면:

```bash
node scripts/check-dns-txt.mjs --domain example.com --value "google-site-verification=..."
```

## 4. 소유확인 방법 비교 (참고)

| 방법 | 속성 유형 | 이 레포에서의 위치 |
| --- | --- | --- |
| DNS TXT | 도메인 속성(`prodaco.kr` 전체, http/https·www 모두 포함) | 레포 밖 — Netlify DNS |
| HTML 태그 | URL 접두어 속성(`https://prodaco.kr/`) | `/admin` → ① 사이트 설정 → "구글 소유확인 코드(HTML 태그)" |
| HTML 파일 | URL 접두어 속성 | `public/` 에 파일 업로드 |

- **DNS TXT 가 권장 방식**이다. 프로토콜·서브도메인 변형이 한 속성으로 묶여 데이터가 갈리지 않는다.
- HTML 태그 방식을 쓸 경우, 서치콘솔이 **HTML 태그용으로 발급한 별도 토큰**을 넣어야 한다.
  위 DNS TXT 토큰을 그대로 메타 태그에 넣으면 확인되지 않는다.
- 네이버 소유확인은 별개다 — 파일 방식(`public/naver...html`) + 메타 태그로 이미 설정돼 있고, 이 작업과 무관하다.
