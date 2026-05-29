// 시각 검증 스크립트 — 앱 화면 자동 캡처
//
// 사장님 결정 (2026-05-29 정책 뒤집음): designer(CTO 역할)가 구현 후 사진을 먼저 직접 본다.
// 디자인 규칙 위반 있으면 coder로 되돌리고(총괄 루프), 통과한 뒤에만 사장님께 최종 사진 전송.
// 옛 2026-05-23 "CTO 안 봄, 토큰 절약" 폐기 — 재작업 34% 원인. 사진값 수십 원 < 재작업 수백~수천 원.
//
// 사용법:
//   node scripts/snap.js              → 배포 URL (pongdang-shabu.pages.dev) 캡처
//   node scripts/snap.js --local      → 로컬 index.html 캡처 (외부 막힐 때 fallback)
//
// 출력: visual-check-output/{timestamp}/{name}.png (gitignore 박힘, repo 안 들어감)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const useLocal = args.includes('--local');

const url = useLocal
  ? 'file://' + path.resolve(__dirname, '..', 'index.html')
  : 'https://pongdang-shabu.pages.dev';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(__dirname, '..', 'visual-check-output', timestamp);
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-quic', '--ignore-certificate-errors'],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();

  const consoleMsgs = [];
  page.on('console', m => consoleMsgs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => consoleMsgs.push('[pageerror] ' + e.message));

  // 1. 모바일 (iPhone 13 폭 390px)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');

  console.log('→ goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));  // Supabase 로드 대기

  await page.screenshot({ path: path.join(outDir, '01_mobile.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, '02_mobile_full.png'), fullPage: true });

  // 2. 좁은 모바일 (iPhone SE 폭 360px) — 텍스트 잘림 확인
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(outDir, '03_narrow_mobile.png'), fullPage: false });

  // 3. 데스크탑
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(outDir, '04_desktop.png'), fullPage: false });

  // 4. 메타 정보 + 콘솔 에러 보고
  const title = await page.title();
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 800);

  const report = {
    timestamp,
    url,
    title,
    bodyPreview: bodyText,
    consoleMsgCount: consoleMsgs.length,
    consoleSample: consoleMsgs.slice(0, 20),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log('\n=== 캡처 완료 ===');
  console.log('출력:', outDir);
  console.log('파일:', fs.readdirSync(outDir).join(', '));
  console.log('타이틀:', title);
  console.log('콘솔 메시지:', consoleMsgs.length, '건');
  if (consoleMsgs.length > 0) {
    console.log('\n=== 콘솔 샘플 ===');
    consoleMsgs.slice(0, 10).forEach(m => console.log('  ' + m));
  }

  await browser.close();

  // 디자인 4종 점검 — CTO(designer 역할)가 사장님 보고 전 먼저 직접 확인 (2026-05-29 정책)
  console.log('\n=== 디자인 4종 점검 (CTO가 사장님 보고 전 직접 확인) ===');
  console.log('1. 정보 위계 — 매출 같은 1순위 정보가 가장 강조됐나');
  console.log('2. 모바일 폭 — 텍스트 잘림·삐죽 없나 (03_narrow_mobile.png 확인)');
  console.log('3. 잔재 디자인 — 옛날 그림자·border 안 남았나');
  console.log('4. 통일감 — 비슷한 화면들 패턴 일치');
})();
