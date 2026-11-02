import type { Note } from "../types.ts";
import { ParseError, ValidationError } from "../types.ts";

export function parseNotes(markdown: string): Note[] {
  const notes: Note[] = [];
  const chunks = markdown.split(/^##[ \t]+/m).slice(1);
  for (const chunk of chunks) {
    const [heading, ...rest] = chunk.split(/\r?\n/);
    const content = rest
      .join("\n")
      .trim()
      .replace(/^\\(#{1,6}[ \t])/gm, "$1"); // unescape heading-like lines for display
    if (content === "") continue;
    const id = heading.trim().replace(/\s+/g, "-");
    notes.push({ id, createdAt: heading.trim(), content });
  }
  return notes;
}

/** Prevents note bodies from injecting new `##` entries. */
function escapeHeadingLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^(\s*)(#{1,6}[ \t])/, "$1\\$2"))
    .join("\n");
}

export function appendNote(
  markdown: string,
  timestamp: string,
  content: string,
): { markdown: string; heading: string } {
  const text = content.trim();
  if (text === "") throw new ValidationError("note content is empty");
  if (text.length > 4000) throw new ValidationError("note too long (max 4000)");

  // Same-minute notes must have distinct, stable, human-readable headings.
  const existing = new Set<string>();
  for (const match of markdown.matchAll(/^##[ \t]+(.+)$/gm)) {
    existing.add(match[1].trim());
  }
  let heading = timestamp;
  let suffix = 2;
  while (existing.has(heading)) {
    heading = `${timestamp} #${suffix++}`;
  }

  const block = `## ${heading}\n\n${escapeHeadingLines(text)}\n`;
  const next = markdown.trim() === ""
    ? `# 快捷笔记\n\n${block}`
    : `${markdown.trimEnd()}\n\n${block}`;
  return { markdown: next, heading };
}

export function requireNoteHeading(markdown: string): void {
  if (!/^#\s/m.test(markdown)) throw new ParseError("note document has no heading");
}
