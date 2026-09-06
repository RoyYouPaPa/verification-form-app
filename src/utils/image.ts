// 瀏覽器端照片壓縮：手機照片常常好幾 MB，這裡在上傳當下就縮到每張 < 500KB。
// 策略：優先「保留尺寸、只降 JPEG 品質」；品質降到下限仍超標，才逐步縮小尺寸重試。
// 同時套用 EXIF 方向（imageOrientation: 'from-image'），避免手機直式照片變橫的。

export interface CompressOptions {
  /** 單張目標大小上限（bytes），預設 500,000（≈500KB） */
  maxBytes?: number;
  /** 長邊最大像素（避免過大尺寸），預設 2200；為「盡量保留尺寸」取較高值 */
  maxEdge?: number;
  /** JPEG 品質起始值 / 下限 */
  startQuality?: number;
  minQuality?: number;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  /** 是否有實際重新編碼（false = 原檔已夠小，直接沿用） */
  recompressed: boolean;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // 首選 createImageBitmap 並套用 EXIF 方向。
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // 部分瀏覽器不支援 options，退而求其次。
    try {
      return await createImageBitmap(file);
    } catch {
      // 最後用 <img> 載入。
      return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('圖片解碼失敗'));
        };
        img.src = url;
      });
    }
  }
}

function dims(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ('width' in src && 'height' in src) {
    const w = (src as ImageBitmap).width || (src as HTMLImageElement).naturalWidth;
    const h =
      (src as ImageBitmap).height || (src as HTMLImageElement).naturalHeight;
    return { w, h };
  }
  return { w: 0, h: 0 };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob 失敗'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * 壓縮單張圖片為 JPEG，盡量在保留尺寸的前提下讓檔案 < maxBytes。
 * 解碼失敗時由呼叫端負責 fallback 用原檔。
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<CompressResult> {
  const maxBytes = opts.maxBytes ?? 500_000;
  const maxEdge = opts.maxEdge ?? 2200;
  const startQuality = opts.startQuality ?? 0.85;
  const minQuality = opts.minQuality ?? 0.5;

  const src = await decode(file);
  const { w: ow, h: oh } = dims(src);

  // 原檔已是 JPEG 且夠小、尺寸也不誇張 → 直接沿用，不再重編碼（保留原畫質）。
  if (
    file.size <= maxBytes &&
    /jpe?g/i.test(file.type) &&
    Math.max(ow, oh) <= maxEdge
  ) {
    if ('close' in src) (src as ImageBitmap).close();
    return { blob: file, width: ow, height: oh, recompressed: false };
  }

  // 先套用長邊上限
  const fit = Math.min(1, maxEdge / Math.max(ow, oh));
  let baseW = Math.round(ow * fit);
  let baseH = Math.round(oh * fit);

  const render = (tw: number, th: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法取得 canvas context');
    ctx.drawImage(src as CanvasImageSource, 0, 0, tw, th);
    return canvas;
  };

  let scale = 1;
  let best: Blob | null = null;
  let bestW = baseW;
  let bestH = baseH;

  // 最多 6 次：每次先在目前尺寸把品質從 start 往下調；還是太大就把尺寸再縮 15% 重試。
  for (let attempt = 0; attempt < 6; attempt++) {
    const tw = Math.max(1, Math.round(baseW * scale));
    const th = Math.max(1, Math.round(baseH * scale));
    const canvas = render(tw, th);

    let quality = startQuality;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > maxBytes && quality > minQuality) {
      quality = Math.max(minQuality, quality - 0.1);
      blob = await canvasToBlob(canvas, quality);
    }
    best = blob;
    bestW = tw;
    bestH = th;

    if (blob.size <= maxBytes || Math.max(tw, th) <= 1000) break;
    scale *= 0.85; // 仍超標且尺寸還夠大 → 再縮一點
  }

  if ('close' in src) (src as ImageBitmap).close();
  return {
    blob: best ?? file,
    width: bestW,
    height: bestH,
    recompressed: true,
  };
}
