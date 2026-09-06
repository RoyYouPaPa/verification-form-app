// 瀏覽器端資源載入輔助：抓字型 / 印章 / 把 File 轉成 bytes。
// 這些牽涉 fetch/FileReader，刻意與純函式 generatePdf 分開。

const BASE = import.meta.env.BASE_URL; // 例如 "/" 或 "/repo-name/"

/** 抓取字型 bytes（放在 public/fonts）。 */
export async function loadFontBytes(): Promise<Uint8Array> {
  const res = await fetch(`${BASE}fonts/NotoSansTC-Regular.ttf`);
  if (!res.ok) throw new Error(`字型載入失敗：${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * 抓取印章 bytes；若不存在（例如某公司印章尚未放置）回傳 null，
 * 讓 PDF 以「印章待補」占位框處理，不 crash。
 */
export async function loadSealBytes(sealPath: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${BASE}${sealPath}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return null;
    const bytes = new Uint8Array(buf);
    // 防呆：缺檔時 dev server / SPA 會回 200 + index.html（非圖片），
    // 若直接丟進 embedJpg 會拋「SOI not found」導致整份 PDF 產不出來。
    // 因此檢查 magic bytes，只有真的是 PNG / JPEG 才回傳，否則當作無印章。
    if (!isPngOrJpeg(bytes)) return null;
    return bytes;
  } catch {
    return null;
  }
}

/** 檢查 bytes 是否為 PNG 或 JPEG（依檔頭 magic bytes）。 */
function isPngOrJpeg(b: Uint8Array): boolean {
  if (b.length < 4) return false;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; // \x89PNG
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; // JPEG SOI
  return isPng || isJpeg;
}

/** File → Uint8Array */
export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
