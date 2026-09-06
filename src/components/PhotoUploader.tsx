import { useRef, type ChangeEvent } from 'react';

export interface PhotoItem {
  id: string;
  file: File;
  url: string; // object URL，用於縮圖預覽
}

interface Props {
  photos: PhotoItem[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

// 多張照片上傳：縮圖清單、可刪除單張、可用上下按鈕調整順序。
// 照片順序 = PDF 內排列順序。
export function PhotoUploader({ photos, onAdd, onRemove, onMove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAdd(e.target.files);
    }
    // 清空 value，讓同一批檔案可重複選取
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="uploader">
      <div className="uploader-head">
        <label className="btn file-btn">
          選擇照片
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            hidden
          />
        </label>
        <span className="count">已選 {photos.length} 張</span>
      </div>

      {photos.length === 0 ? (
        <p className="empty">尚未選擇照片。每頁最多放 15 張，超過會自動換頁。</p>
      ) : (
        <ul className="thumb-grid">
          {photos.map((p, i) => (
            <li className="thumb" key={p.id}>
              <div className="thumb-index">{i + 1}</div>
              <img src={p.url} alt={`photo-${i + 1}`} />
              <div className="thumb-actions">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => onMove(p.id, -1)}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === photos.length - 1}
                  onClick={() => onMove(p.id, 1)}
                  title="下移"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onRemove(p.id)}
                  title="刪除"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
