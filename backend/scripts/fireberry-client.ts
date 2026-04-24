const FIREBERRY_BASE = "https://api.fireberry.com";

export interface FireberryResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface QueryPage<T> {
  ObjectName: string;
  SystemName: string;
  PrimaryKey: string;
  PageNum: number;
  IsLastPage: boolean;
  Columns: Array<{ fieldname: string; name: string }>;
  Data: T[];
}

export class FireberryClient {
  constructor(private tokenId: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${FIREBERRY_BASE}${path}`, {
      ...init,
      headers: {
        tokenid: this.tokenId,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fireberry ${init?.method || "GET"} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as FireberryResponse<T>;
    if (!json.success) throw new Error(`Fireberry returned success=false: ${json.message}`);
    return json.data;
  }

  async queryAll<T = Record<string, any>>(objectType: number, fields: string = "*", pageSize = 500): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    while (true) {
      const data = await this.request<QueryPage<T>>("/api/query", {
        method: "POST",
        body: JSON.stringify({ objecttype: objectType, page_size: pageSize, page_number: page, fields }),
      });
      all.push(...data.Data);
      if (data.IsLastPage) break;
      page++;
      if (page > 100) throw new Error(`Pagination runaway on object ${objectType}`);
    }
    return all;
  }
}
