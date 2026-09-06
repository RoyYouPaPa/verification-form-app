// 與 DOM / 瀏覽器完全無關的純函式：吃 bytes，吐 PDF bytes。
// 可被 React 端呼叫，也可被 Node 測試直接 import。
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CompanyConfig, FieldDef } from '../config/companies';

export interface GeneratePdfInput {
  companyKey: string;
  fields: Record<string, string>;
  date: string; // YYYY-MM-DD
  photos: Uint8Array[]; // JPEG/PNG bytes，依序
  fontBytes: Uint8Array; // Noto Sans TC
  sealBytes: Uint8Array | null;
  company: CompanyConfig;
  /**
   * 是否對字型做 subset。預設 false。
   * 註：pdf-lib + fontkit 對 Noto CJK 這類含 composite 字符的字型做 subset
   * 會漏字/毀損（部分字顯示不出來），故預設關閉、內嵌完整字型以確保正確。
   */
  subsetFont?: boolean;
}

// ---- A4 直式版面常數（單位 pt）----
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 28;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELLS_PER_PAGE = GRID_COLS * GRID_ROWS; // 16
const PHOTOS_PER_PAGE = CELLS_PER_PAGE - 1; // 15（右下角留給印章）

// 照片區底端 y（pdf 座標，原點在左下）。頂端 y 由各公司表頭高度決定。
const GRID_BOTTOM = 28;
const CELL_PAD = 5;
// 照片區外框粗細（使用者要求：照片區要有粗外框包起來、內部不畫格線）。
const OUTER_BORDER_W = 2;

const BLACK = rgb(0, 0, 0);

// 簡易圖片格式偵測（避免用錯 embed 方法）
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

async function embedImage(
  doc: PDFDocument,
  bytes: Uint8Array
): Promise<PDFImage> {
  return isPng(bytes) ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

// contain：把圖等比例縮放置中放進 (x,y,w,h) 矩形，不變形，多餘留白。
function containRect(
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = boxX + (boxW - w) / 2;
  const y = boxY + (boxH - h) / 2;
  return { x, y, w, h };
}

interface HeaderCtx {
  page: PDFPage;
  font: PDFFont;
  company: CompanyConfig;
  fields: Record<string, string>;
  date: string;
  pageNumber: number;
}

// 置中畫字
function drawCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  cx: number,
  y: number,
  size: number
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color: BLACK });
}

// 右對齊畫字
function drawRight(
  page: PDFPage,
  font: PDFFont,
  text: string,
  rx: number,
  y: number,
  size: number,
  color = BLACK
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rx - w, y, size, font, color });
}

// 「標籤: 值」左對齊
function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  size: number
) {
  const l = `${label}: `;
  page.drawText(l, { x, y, size, font, color: BLACK });
  const lw = font.widthOfTextAtSize(l, size);
  page.drawText(value, { x: x + lw, y, size, font, color: BLACK });
}

/**
 * boxed 版型：公司名靠左 + 右上聯絡資訊；標題置中；
 * 客戶資訊為「有框線的表格盒」。回傳照片區頂端 y。
 */
function drawHeaderBoxed(ctx: HeaderCtx): number {
  const { page, font, company, fields, date, pageNumber } = ctx;

  // 公司抬頭：靠左對齊
  page.drawText(company.name, {
    x: MARGIN_X,
    y: PAGE_H - 40,
    size: 19,
    font,
    color: BLACK,
  });

  // 右上：聯絡資訊多行，右對齊
  const rx = PAGE_W - MARGIN_X;
  let ty = PAGE_H - 22;
  for (const line of company.contactLines) {
    drawRight(page, font, line, rx, ty, 8);
    ty -= 11;
  }

  // 標題「驗收單」置中（全頁寬）
  drawCentered(page, font, '驗收單', PAGE_W / 2, PAGE_H - 80, 23);

  // 客戶資訊表格盒：外框 + 中間分隔 + 列線
  const rows = Math.max(company.leftFields.length, company.rightFields.length);
  const rowH = 19;
  const boxTop = PAGE_H - 96;
  const boxH = rows * rowH;
  const boxBottom = boxTop - boxH;
  const midX = MARGIN_X + CONTENT_W / 2;
  const fieldSize = 10.5;
  const pad = 5;

  // 外框
  page.drawRectangle({
    x: MARGIN_X,
    y: boxBottom,
    width: CONTENT_W,
    height: boxH,
    borderColor: BLACK,
    borderWidth: 1,
  });
  // 中間垂直分隔
  page.drawLine({
    start: { x: midX, y: boxBottom },
    end: { x: midX, y: boxTop },
    thickness: 1,
    color: BLACK,
  });
  // 列分隔線
  for (let i = 1; i < rows; i++) {
    const ly = boxTop - i * rowH;
    page.drawLine({
      start: { x: MARGIN_X, y: ly },
      end: { x: PAGE_W - MARGIN_X, y: ly },
      thickness: 0.6,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  const drawCol = (defs: FieldDef[], x: number) => {
    for (let i = 0; i < defs.length; i++) {
      const y = boxTop - i * rowH - (rowH - fieldSize) / 2 - fieldSize + 3;
      drawLabelValue(
        page,
        font,
        defs[i].key,
        fields[defs[i].key] ?? '',
        x + pad,
        y,
        fieldSize
      );
    }
  };
  drawCol(company.leftFields, MARGIN_X);
  drawCol(company.rightFields, midX);

  // 日期 / 頁數：置於盒子右上外側上方（聯絡資訊下方）
  drawRight(page, font, `日期: ${date}`, rx, ty - 2, 9);
  drawRight(page, font, `頁數: ${pageNumber}`, rx, ty - 14, 9);

  return boxBottom - 10;
}

/**
 * plain 版型：公司名 + 標題全寬置中、無聯絡資訊；
 * 客戶資訊為「標籤: 值」純文字、無框線。回傳照片區頂端 y。
 */
function drawHeaderPlain(ctx: HeaderCtx): number {
  const { page, font, company, fields, date, pageNumber } = ctx;

  // 公司名 + 標題，全寬置中
  drawCentered(page, font, company.name, PAGE_W / 2, PAGE_H - 42, 20);
  drawCentered(page, font, '驗收單', PAGE_W / 2, PAGE_H - 72, 22);

  // 右上：日期 / 頁數
  const rx = PAGE_W - MARGIN_X;
  drawRight(page, font, `日期: ${date}`, rx, PAGE_H - 22, 9);
  drawRight(page, font, `頁數: ${pageNumber}`, rx, PAGE_H - 34, 9);

  // 客戶資訊：兩欄「標籤: 值」純文字、無框線
  const fieldSize = 11;
  const rowH = 19;
  const top = PAGE_H - 100;
  const rightX = MARGIN_X + CONTENT_W / 2;
  const drawCol = (defs: FieldDef[], x: number) => {
    for (let i = 0; i < defs.length; i++) {
      drawLabelValue(
        page,
        font,
        defs[i].key,
        fields[defs[i].key] ?? '',
        x,
        top - i * rowH,
        fieldSize
      );
    }
  };
  drawCol(company.leftFields, MARGIN_X);
  drawCol(company.rightFields, rightX);

  const rows = Math.max(company.leftFields.length, company.rightFields.length);
  return top - (rows - 1) * rowH - 16;
}

function drawHeader(ctx: HeaderCtx): number {
  return ctx.company.headerStyle === 'boxed'
    ? drawHeaderBoxed(ctx)
    : drawHeaderPlain(ctx);
}

/**
 * 產生驗收單 PDF。
 * 規則：每頁 4x4=16 格，前 15 格由左到右、由上到下填照片，
 * 第 16 格（右下）固定放印章。超過 15 張換頁、重複表頭、頁數 +1。
 */
export async function generatePdf(input: GeneratePdfInput): Promise<Uint8Array> {
  const { photos, fontBytes, sealBytes, company, fields, date } = input;
  const subsetFont = input.subsetFont ?? false;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // 預設 subset:false，內嵌完整字型確保中文不漏字（見 subsetFont 說明）。
  const font = await doc.embedFont(fontBytes, { subset: subsetFont });

  const sealImage = sealBytes ? await embedImage(doc, sealBytes) : null;

  // 至少 1 頁（即使 0 張照片也要有表頭 + 印章）。
  const pageCount = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const gridTop = drawHeader({
      page,
      font,
      company,
      fields,
      date,
      pageNumber: p + 1,
    });

    // 照片區：一個粗外框，內部不畫格線。
    const gridH = gridTop - GRID_BOTTOM;
    const cellW = CONTENT_W / GRID_COLS;
    const cellH = gridH / GRID_ROWS;
    page.drawRectangle({
      x: MARGIN_X,
      y: GRID_BOTTOM,
      width: CONTENT_W,
      height: gridH,
      borderColor: BLACK,
      borderWidth: OUTER_BORDER_W,
    });

    // 某格的左下座標
    const cellXY = (cell: number) => {
      const col = cell % GRID_COLS;
      const row = Math.floor(cell / GRID_COLS); // 0 在最上
      return {
        x: MARGIN_X + col * cellW,
        y: gridTop - (row + 1) * cellH,
      };
    };

    const drawInCell = (img: PDFImage, cell: number) => {
      const { x, y } = cellXY(cell);
      const box = containRect(
        img.width,
        img.height,
        x + CELL_PAD,
        y + CELL_PAD,
        cellW - CELL_PAD * 2,
        cellH - CELL_PAD * 2
      );
      page.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h });
    };

    const pagePhotos = photos.slice(
      p * PHOTOS_PER_PAGE,
      p * PHOTOS_PER_PAGE + PHOTOS_PER_PAGE
    );

    // 前 15 格放照片（不足則留白，不畫任何格線）
    for (let cell = 0; cell < PHOTOS_PER_PAGE; cell++) {
      const photoBytes = pagePhotos[cell];
      if (!photoBytes) continue;
      const img = await embedImage(doc, photoBytes);
      drawInCell(img, cell);
    }

    // 第 16 格（右下）：印章，或「印章待補」占位。
    const sealCell = CELLS_PER_PAGE - 1;
    if (sealImage) {
      drawInCell(sealImage, sealCell);
    } else {
      const { x, y } = cellXY(sealCell);
      page.drawRectangle({
        x: x + CELL_PAD,
        y: y + CELL_PAD,
        width: cellW - CELL_PAD * 2,
        height: cellH - CELL_PAD * 2,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 1,
        borderDashArray: [4, 3],
      });
      const label = '（印章待補）';
      const size = 10;
      const w = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: x + (cellW - w) / 2,
        y: y + cellH / 2 - size / 2,
        size,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  return doc.save();
}

/** 依規格產生檔名：{公司別}_{客戶}_驗收單_{YYYYMMDD}.pdf，非法字元換底線。 */
export function buildFileName(
  company: CompanyConfig,
  fields: Record<string, string>,
  date: string
): string {
  const customer =
    fields['客戶'] || fields['客戶名稱'] || '未填客戶';
  // 檔名中段用各公司設定的欄位（鵬曜=工程名稱、澄遠=驗收項目）；未填則退回「驗收單」。
  const project = fields[company.fileNameFieldKey] || '驗收單';
  const ymd = date.replace(/-/g, '');
  const raw = `${company.name}_${customer}_${project}_${ymd}`;
  const safe = raw.replace(/[\\/:*?"<>|]/g, '_');
  return `${safe}.pdf`;
}
