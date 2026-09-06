// Node 煙霧測試：直接 import 純函式 generatePdf，餵 fixture 產出 PDF 並驗證頁數。
// 執行：npx tsx scripts/smoke.mjs  （需 Node 20）
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { generatePdf } from '../src/pdf/generatePdf.ts';
import { companies } from '../src/config/companies.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const fontPath = process.env.FONT_PATH
  ? resolve(root, process.env.FONT_PATH)
  : resolve(root, 'public/fonts/NotoSansTC-Regular.ttf');
const fontBytes = new Uint8Array(await readFile(fontPath));
console.log(`使用字型: ${fontPath}`);
const sealBytes = new Uint8Array(
  await readFile(resolve(root, 'public/seals/pengyao.jpeg'))
);

// 3 張範例照片 → 複製成 20 張
const samples = ['sample1.jpeg', 'sample2.jpeg', 'sample3.jpeg'];
const sampleBytes = await Promise.all(
  samples.map(async (f) =>
    new Uint8Array(await readFile(resolve(root, 'test-assets', f)))
  )
);
const photos = [];
for (let i = 0; i < 20; i++) {
  photos.push(sampleBytes[i % sampleBytes.length]);
}

const company = companies.pengyao;

const pdfBytes = await generatePdf({
  companyKey: 'pengyao',
  fields: {
    客戶: '測試客戶',
    聯絡人: '王小明',
    電話: '02-1234-5678',
    傳真: '02-1234-5679',
    工程名稱: '煙霧測試工程',
    工程地點: '台北市',
    製表人員: '測試員',
  },
  date: '2026-09-05',
  photos,
  fontBytes,
  sealBytes,
  company,
});

await writeFile(resolve(root, 'smoke-output.pdf'), pdfBytes);

const doc = await PDFDocument.load(pdfBytes);
const pageCount = doc.getPageCount();
console.log(`照片張數: ${photos.length}`);
console.log(`產出頁數: ${pageCount}`);

if (pageCount !== 2) {
  console.error(`FAIL：預期 2 頁，實際 ${pageCount} 頁`);
  process.exit(1);
}
console.log('PASS：20 張照片 → 2 頁，smoke-output.pdf 已寫出。');
