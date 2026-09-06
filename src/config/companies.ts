// 公司設定：資料驅動。
// 新增一間公司 = 在 companies 加一筆（公司名、聯絡行、欄位、印章路徑），
// 不需要改動表單或 PDF 版面程式。

export interface FieldDef {
  /** 欄位鍵值，也是 PDF/表單 label（會加上冒號顯示，例如「客戶:」） */
  key: string;
}

/**
 * 表頭版型：
 * - 'boxed'：公司名置中於左區 + 右上聯絡資訊，客戶資訊用「有框線的表格盒」呈現（鵬曜原稿）。
 * - 'plain'：公司名 + 標題全寬置中、無聯絡資訊，客戶資訊為「標籤:值」純文字、無框線（澄遠原稿）。
 */
export type HeaderStyle = 'boxed' | 'plain';

export interface CompanyConfig {
  /** 內部 key，例如 pengyao / chengyuan */
  key: string;
  /** 公司全名（顯示於表頭左上、用於檔名） */
  name: string;
  /** 表頭版型（各公司忠於原稿，不可共用同一種） */
  headerStyle: HeaderStyle;
  /** 表頭右上角固定顯示的聯絡資訊多行（可為空陣列） */
  contactLines: string[];
  /** 左欄欄位（由上到下） */
  leftFields: FieldDef[];
  /** 右欄欄位（由上到下） */
  rightFields: FieldDef[];
  /** 檔名中段要用的欄位 key（例如鵬曜用「工程名稱」、澄遠用「驗收項目」）。 */
  fileNameFieldKey: string;
  /** 印章圖檔路徑（相對於 base，例如 seals/pengyao.jpeg）。 */
  sealPath: string;
}

const f = (key: string): FieldDef => ({ key });

export const companies: Record<string, CompanyConfig> = {
  pengyao: {
    key: 'pengyao',
    name: '鵬曜工程有限公司',
    headerStyle: 'boxed',
    contactLines: [
      '電話/傳真: (02)2662-8384',
      '手機: 0937819234',
      'E-mail:peng.yau@msa.hinet.net',
    ],
    leftFields: [f('客戶'), f('聯絡人'), f('電話'), f('傳真')],
    rightFields: [f('工程名稱'), f('工程地點'), f('製表人員')],
    fileNameFieldKey: '工程名稱',
    sealPath: 'seals/pengyao.jpeg',
  },
  chengyuan: {
    key: 'chengyuan',
    name: '澄遠工程有限公司',
    headerStyle: 'plain',
    // 澄遠表頭無聯絡資訊。
    contactLines: [],
    leftFields: [f('客戶名稱'), f('電話'), f('分機'), f('製表人員')],
    rightFields: [f('聯絡人'), f('傳真'), f('驗收項目')],
    fileNameFieldKey: '驗收項目',
    // 檔案可能尚未放置；載入失敗時 PDF/表單以灰色虛線框處理，不可 crash。
    sealPath: 'seals/chengyuan.png',
  },
};

/** 下拉選單順序 */
export const companyOrder: string[] = ['pengyao', 'chengyuan'];

/** 取得某公司全部欄位（左欄接右欄），供表單初始化用 */
export function allFieldKeys(company: CompanyConfig): string[] {
  return [...company.leftFields, ...company.rightFields].map((x) => x.key);
}
