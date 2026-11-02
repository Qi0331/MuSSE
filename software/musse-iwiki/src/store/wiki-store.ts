export interface DocSnapshot {
  path: string;
  content: string;
  /** Opaque version token. Local store uses a content hash. */
  version: string;
}

export interface DocMeta {
  path: string;
  version: string;
}

/**
 * The only persistence abstraction. Business code never writes local files
 * as a fallback: if the store is unavailable, operations fail loudly.
 */
export interface WikiStore {
  read(path: string): Promise<DocSnapshot>;
  write(path: string, content: string, expectedVersion?: string): Promise<DocSnapshot>;
  list(prefix?: string): Promise<DocMeta[]>;
}

export const DOC_PATHS = {
  tasks: "MuSSE 个人管理/任务总表.md",
  notes: "MuSSE 个人管理/快捷笔记.md",
  goalsDir: "MuSSE 个人管理/长期目标",
} as const;

export function goalPath(goalId: string): string {
  return `${DOC_PATHS.goalsDir}/${goalId}.md`;
}
