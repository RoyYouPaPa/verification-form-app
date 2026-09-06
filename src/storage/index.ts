// 儲存抽象層：預留資料庫接口，預設「不儲存」(none)。
// 依 VITE_STORAGE_MODE 切換 adapter；none 時完全不發出任何網路請求。

export interface FormRecord {
  company: string;
  date: string;
  fields: Record<string, string>;
  photoCount: number;
  pageCount: number;
  createdAt: string;
}

export interface StorageAdapter {
  save(record: FormRecord, pdf: Blob): Promise<void>;
}

/** 預設：不儲存，只 console.log。產完 PDF 就算完成。 */
class NoneAdapter implements StorageAdapter {
  async save(record: FormRecord): Promise<void> {
    // 不發任何網路請求。
    console.log('[storage:none] 不儲存，僅記錄：', record);
  }
}

/** Supabase stub：讀 env，尚未實作。未啟用時不影響流程。 */
class SupabaseAdapter implements StorageAdapter {
  private url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  private anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  async save(record: FormRecord, _pdf: Blob): Promise<void> {
    // TODO: 之後接上。
    // 需要：把 pdf 上傳到 Supabase Storage，並把 record 寫進資料表。
    // 例如使用 @supabase/supabase-js：createClient(this.url, this.anonKey)。
    console.log('[storage:supabase] stub，尚未接上。', {
      url: this.url,
      hasKey: Boolean(this.anonKey),
      record,
    });
  }
}

/** 通用 REST stub：讀 VITE_STORAGE_API_URL，尚未實作。 */
class RestAdapter implements StorageAdapter {
  private apiUrl = import.meta.env.VITE_STORAGE_API_URL as string | undefined;

  async save(record: FormRecord, _pdf: Blob): Promise<void> {
    // TODO: 之後接上。
    // 例如：POST multipart/form-data 到 this.apiUrl，帶 record(JSON) + pdf(檔案)。
    console.log('[storage:rest] stub，尚未接上。', {
      apiUrl: this.apiUrl,
      record,
    });
  }
}

/** 工廠：依 VITE_STORAGE_MODE（none|supabase|rest，預設 none）回傳 adapter。 */
export function getStorage(): StorageAdapter {
  const mode = (import.meta.env.VITE_STORAGE_MODE as string | undefined) ?? 'none';
  switch (mode) {
    case 'supabase':
      return new SupabaseAdapter();
    case 'rest':
      return new RestAdapter();
    case 'none':
    default:
      return new NoneAdapter();
  }
}
