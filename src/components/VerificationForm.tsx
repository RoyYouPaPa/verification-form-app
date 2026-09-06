import { useMemo, useState } from 'react';
import { companies, companyOrder, type CompanyConfig } from '../config/companies';
import { PhotoUploader, type PhotoItem } from './PhotoUploader';
import { generatePdf, buildFileName } from '../pdf/generatePdf';
import { loadFontBytes, loadSealBytes, fileToBytes } from '../pdf/assets';
import { getStorage, type FormRecord } from '../storage';
import { compressImage } from '../utils/image';

const PHOTOS_PER_PAGE = 15;

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function VerificationForm() {
  const [companyKey, setCompanyKey] = useState<string>(companyOrder[0]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [date, setDate] = useState<string>(today());
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const company: CompanyConfig = companies[companyKey];

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE)),
    [photos.length]
  );

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleAdd = async (files: FileList) => {
    // 上傳當下就壓縮：每張盡量保留尺寸、降品質，目標 < 1MB。
    // 逐張處理（避免一次解碼多張大圖造成記憶體尖峰），完成一張就顯示一張。
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        let outFile: File;
        try {
          const { blob } = await compressImage(file);
          const name = file.name.replace(/\.[^./]+$/, '') + '.jpg';
          outFile =
            blob instanceof File && blob === (file as unknown as Blob)
              ? file
              : new File([blob], name, { type: blob.type || 'image/jpeg' });
        } catch {
          // 解碼/壓縮失敗（例如特殊格式）→ 退回原檔，不阻斷流程。
          outFile = file;
        }
        const item: PhotoItem = {
          id: uid(),
          file: outFile,
          url: URL.createObjectURL(outFile),
          sizeKB: Math.round(outFile.size / 1024),
        };
        setPhotos((prev) => [...prev, item]);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = (id: string) => {
    setPhotos((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const handleGenerate = async () => {
    setBusy(true);
    setMessage('');
    try {
      const [fontBytes, sealBytes, photoBytes] = await Promise.all([
        loadFontBytes(),
        loadSealBytes(company.sealPath),
        Promise.all(photos.map((p) => fileToBytes(p.file))),
      ]);

      const pdfBytes = await generatePdf({
        companyKey,
        fields,
        date,
        photos: photoBytes,
        fontBytes,
        sealBytes,
        company,
      });

      // 觸發下載
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const fileName = buildFileName(company, fields, date);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // 儲存抽象層（預設 none = 不儲存）
      const record: FormRecord = {
        company: companyKey,
        date,
        fields,
        photoCount: photos.length,
        pageCount,
        createdAt: new Date().toISOString(),
      };
      await getStorage().save(record, blob);

      setMessage(`已產生 PDF：${fileName}（共 ${pageCount} 頁）`);
    } catch (err) {
      console.error(err);
      setMessage(`產生失敗：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-wrap">
      <header className="app-header">
        <h1>驗收單 PDF 產生器</h1>
      </header>

      <section className="card">
        <div className="row">
          <label className="field">
            <span>公司別</span>
            <select
              value={companyKey}
              onChange={(e) => {
                setCompanyKey(e.target.value);
                setFields({}); // 換公司清空欄位
              }}
            >
              {companyOrder.map((k) => (
                <option key={k} value={k}>
                  {companies[k].name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        <div className="fields-grid">
          {Array.from({
            length: Math.max(
              company.leftFields.length,
              company.rightFields.length
            ),
          }).flatMap((_, i) => {
            const l = company.leftFields[i];
            const r = company.rightFields[i];
            const cell = (f?: { key: string }, side?: string) =>
              f ? (
                <label className="field" key={f.key}>
                  <span>{f.key}</span>
                  <input
                    type="text"
                    value={fields[f.key] ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </label>
              ) : (
                <span className="field-empty" key={`empty-${side}-${i}`} />
              );
            // 左右同一列並排，右邊沒有欄位時該格留空，維持左右對齊。
            return [cell(l, 'l'), cell(r, 'r')];
          })}
        </div>
      </section>

      <section className="card">
        <h2>照片（順序即 PDF 內排列順序）</h2>
        <PhotoUploader
          photos={photos}
          processing={processing}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onMove={handleMove}
        />
        <p className="hint">
          目前 {photos.length} 張 → 預估 {pageCount} 頁（每頁 15 張 + 印章）。
          上傳時會自動壓縮，每張控制在約 1MB 以內。
        </p>
      </section>

      <section className="card actions">
        <button
          className="btn primary"
          onClick={handleGenerate}
          disabled={busy || processing}
        >
          {busy ? '產生中…' : processing ? '照片壓縮中…' : '產生 PDF'}
        </button>
        {message && <p className="message">{message}</p>}
      </section>
    </div>
  );
}
