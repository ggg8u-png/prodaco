#!/usr/bin/env node
/**
 * DNS TXT 소유확인 레코드 전파 확인 스크립트
 *
 *   npm run verify:dns
 *   node scripts/check-dns-txt.mjs --domain prodaco.kr --value "google-site-verification=..."
 *
 * 기본값은 구글 서치콘솔 도메인 속성(prodaco.kr) 소유확인 토큰이다.
 * DNS 캐시를 피하려고 시스템 리졸버 대신 공용 리졸버(구글·클라우드플레어)에 직접 질의한다.
 * (문서: docs/dns-google-verification.md)
 */
import { Resolver, promises as dnsPromises } from "node:dns";

const DEFAULT_DOMAIN = "prodaco.kr";
const DEFAULT_VALUE = "google-site-verification=7f2IHKl2pfSZipwOeIhbIKHq5Kcqyl7UZ8_WO0hNK50";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const domain = arg("domain", DEFAULT_DOMAIN);
const expected = arg("value", DEFAULT_VALUE);

// 공용 리졸버 → 실패 시 시스템 리졸버 순으로 시도한다.
const RESOLVERS = [
  { label: "Google DNS (8.8.8.8)", servers: ["8.8.8.8", "8.8.4.4"] },
  { label: "Cloudflare DNS (1.1.1.1)", servers: ["1.1.1.1", "1.0.0.1"] },
  { label: "시스템 리졸버", servers: null },
];

async function resolveTxt({ servers }) {
  if (!servers) return dnsPromises.resolveTxt(domain);
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  resolver.setServers(servers);
  return new Promise((resolve, reject) => {
    resolver.resolveTxt(domain, (err, records) => (err ? reject(err) : resolve(records)));
  });
}

let records = null;
let usedResolver = null;
const failures = [];

for (const r of RESOLVERS) {
  try {
    // TXT 는 255자마다 조각나므로 조각을 이어붙여 하나의 문자열로 만든다.
    records = (await resolveTxt(r)).map((chunks) => chunks.join(""));
    usedResolver = r.label;
    break;
  } catch (err) {
    // ENODATA = 도메인은 있으나 TXT 레코드가 없음 → 아직 추가 전. 이건 '조회 성공'으로 본다.
    if (err.code === "ENODATA") {
      records = [];
      usedResolver = r.label;
      break;
    }
    failures.push(`${r.label}: ${err.code || err.message}`);
  }
}

if (records === null) {
  console.error(`❌ ${domain} 의 TXT 레코드를 조회하지 못했습니다 (네트워크/DNS 차단 환경일 수 있음).`);
  failures.forEach((f) => console.error(`   · ${f}`));
  process.exit(2);
}

console.log(`조회: ${domain} TXT  (${usedResolver})`);

if (records.includes(expected)) {
  console.log(`✅ TXT 레코드 확인됨`);
  console.log(`   ${expected}`);
  console.log(`→ 서치콘솔에서 "확인(VERIFY)" 을 누르면 됩니다.`);
  process.exit(0);
}

console.error(`❌ 기대한 TXT 레코드가 아직 보이지 않습니다.`);
console.error(`   기대값: ${expected}`);
if (records.length === 0) {
  console.error(`   현재 루트 TXT 레코드: (없음)`);
} else {
  console.error(`   현재 루트 TXT 레코드:`);
  records.forEach((v) => console.error(`     · ${v}`));
}
console.error(`\n확인할 것:`);
console.error(`  1) Netlify DNS(prodaco.kr 존)에 추가했는지 — 등록대행업체 DNS 화면이 아님`);
console.error(`  2) 호스트/이름을 비워뒀는지(루트) — www 에 넣으면 안 됨`);
console.error(`  3) 값에 'google-site-verification=' 접두사를 포함했는지`);
console.error(`  4) 방금 추가했다면 몇 분 뒤 다시 실행 (TTL 만큼 전파 지연)`);
console.error(`\n자세히: docs/dns-google-verification.md`);
process.exit(1);
