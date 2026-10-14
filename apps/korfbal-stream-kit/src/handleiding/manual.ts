import {Marked} from 'marked';

/**
 * The user manual: Markdown files in ./live (crew during a broadcast) and ./beheer (preparing and
 * configuring). File names start with a number for the order, e.g. `03-callsheet.md`; the first
 * `# ` line is the chapter title. The files are bundled into the app, so the manual works offline.
 */
export type ManualPart = 'live' | 'beheer';

export type ManualSection = { id: string; title: string };

export type ManualChapter = {
  part: ManualPart;
  slug: string;
  title: string;
  markdown: string;
  sections: ManualSection[];
};

const files = import.meta.glob('./{live,beheer}/*.md', {query: '?raw', import: 'default', eager: true}) as Record<string, string>;

/** Anchor id for a heading: "Kleuren & tijden" → "kleuren-tijden". */
export function headingId(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function parseChapter(file: string, markdown: string): ManualChapter | null {
  const m = file.match(/\/(live|beheer)\/\d+-([a-z0-9-]+)\.md$/);
  if (!m) return null;
  const title = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? m[2];
  const sections = [...markdown.matchAll(/^## (.+)$/gm)].map(([, t]) => ({id: headingId(t.trim()), title: t.trim()}));
  return {part: m[1] as ManualPart, slug: m[2], title, markdown, sections};
}

const chapters: ManualChapter[] = Object.keys(files)
  .sort()
  .map((file) => parseChapter(file, files[file]))
  .filter((c): c is ManualChapter => !!c);

export function manualChapters(part: ManualPart): ManualChapter[] {
  return chapters.filter((c) => c.part === part);
}

/** Chapters (with their matching sections) that contain all words of the query. */
export function searchManual(part: ManualPart, query: string): ManualChapter[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return manualChapters(part);
  return manualChapters(part).filter((c) => {
    const text = c.markdown.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// Headings get ids so the help button and the table of contents can link to a section
const md = new Marked({
  renderer: {
    heading({tokens, depth, text}) {
      return `<h${depth} id="${headingId(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

/** HTML for a chapter. Only for the bundled manual files: they are part of the app, not user input. */
export function renderManual(markdown: string): string {
  return md.parse(markdown, {async: false}) as string;
}
