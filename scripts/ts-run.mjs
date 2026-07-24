// TS 파일을 Node 에서 바로 실행하는 러너 — devDependency 인 typescript 로 require 시점에
// 트랜스파일한다. 빌드 산출물 없이 src/ 의 실제 로직(키워드·본문 생성·색인 판정)을 그대로
// 불러 감사/테스트를 돌리기 위한 용도다(감사 스크립트가 로직 사본을 들고 있으면 반드시
// 드리프트가 생기므로, 항상 원본 모듈을 실행한다).
//
//   사용: node scripts/ts-run.mjs <entry.ts> [args...]
//   예:   node scripts/ts-run.mjs scripts/seo-quality-audit.ts --full
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const Module = require("module");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

// "@/…" 경로 별칭(tsconfig paths)을 src/ 로 해석하고, 확장자 없는 요청은 .ts/.tsx 를
// 우선한다 — Node 기본 해석은 .json 을 .ts 보다 먼저 시도해 "@/data/keywords" 가
// keywords.ts 대신 keywords.json 으로 잘못 잡히기 때문(TS 컴파일러의 해석 순서와 일치시킴).
function preferTs(abs) {
  if (path.extname(abs)) return abs;
  for (const ext of [".ts", ".tsx"]) {
    if (fs.existsSync(abs + ext)) return abs + ext;
  }
  return abs;
}
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (typeof request === "string") {
    if (request.startsWith("@/")) {
      request = preferTs(path.join(SRC, request.slice(2)));
    } else if (request.startsWith(".") && parent?.filename) {
      const abs = path.resolve(path.dirname(parent.filename), request);
      if (abs.startsWith(SRC)) request = preferTs(abs);
    }
  }
  return origResolve.call(this, request, parent, ...rest);
};

// .ts/.tsx 를 CommonJS 로 트랜스파일해 로드한다(타입 검사는 tsc/next build 몫).
const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
  resolveJsonModule: true,
};
for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = (mod, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions, fileName: filename });
    mod._compile(outputText, filename);
  };
}

const entry = process.argv[2];
if (!entry) {
  console.error("사용법: node scripts/ts-run.mjs <entry.ts> [args...]");
  process.exit(2);
}
// 엔트리 이후 인자를 스크립트가 process.argv 로 읽을 수 있게 당겨 놓는다.
process.argv = [process.argv[0], path.resolve(ROOT, entry), ...process.argv.slice(3)];
require(path.resolve(ROOT, entry));
// (pathToFileURL 은 향후 ESM 엔트리 지원 시 사용 — 현재는 CJS require 로 충분)
void pathToFileURL;
