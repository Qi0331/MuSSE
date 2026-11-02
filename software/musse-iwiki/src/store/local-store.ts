import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { DocMeta, DocSnapshot, WikiStore } from "./wiki-store.ts";
import { ConflictError, NotFoundError } from "../types.ts";

function versionOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}

/**
 * Offline test fixture store. It is NOT a production data source and does not
 * write to disk; writes live in memory for the duration of the process.
 */
export class MemoryStore implements WikiStore {
  private readonly docs = new Map<string, string>();
  readonly writeCount: { value: number } = { value: 0 };

  seed(path: string, content: string): void {
    this.docs.set(path, content);
  }

  listSync(): DocMeta[] {
    return [...this.docs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => ({ path, version: versionOf(content) }));
  }

  async read(path: string): Promise<DocSnapshot> {
    const content = this.docs.get(path);
    if (content === undefined) throw new NotFoundError(`document not found: ${path}`);
    return { path, content, version: versionOf(content) };
  }

  async write(
    path: string,
    content: string,
    expectedVersion?: string,
  ): Promise<DocSnapshot> {
    const existing = this.docs.get(path);
    if (expectedVersion !== undefined) {
      if (existing === undefined) {
        throw new ConflictError(`document disappeared before write: ${path}`);
      }
      if (versionOf(existing) !== expectedVersion) {
        throw new ConflictError(
          `document changed since read: ${path}; refusing to overwrite`,
        );
      }
    }
    this.docs.set(path, content);
    this.writeCount.value++;
    return { path, content, version: versionOf(content) };
  }

  async list(prefix = ""): Promise<DocMeta[]> {
    return this.listSync().filter((doc) => doc.path.startsWith(prefix));
  }
}

/** Loads markdown files from a fixture directory into a MemoryStore. */
export async function loadFixtureStore(rootDir: string): Promise<MemoryStore> {
  const store = new MemoryStore();

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(rootDir, full).split(sep).join("/");
        store.seed(rel, await readFile(full, "utf8"));
      }
    }
  }

  await walk(rootDir);
  return store;
}
