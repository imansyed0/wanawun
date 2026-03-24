export interface LessonCourseContext {
  courseId: string;
  lessonId: string;
  pageUrl: string;
  heading?: string;
  title?: string;
  note?: string;
  intro?: string;
  sections?: Array<{
    title: string;
    items: string[];
  }>;
  highlights: string[];
}

const rawCourseContext = require('../../data/course_context.json') as LessonCourseContext[];
const rawCiilStructuredContext = require('../../data/ciil_structured_context.json') as LessonCourseContext[];

function normalizeText(text?: string) {
  if (!text) return '';

  return text
    .replace(/�/g, 'a')
    .replace(/>/g, 'a')
    .replace(/\.mp3/g, '')
    .replace(/badistinctive/gi, 'a distinctive')
    .replace(/\.mp3matical/gi, 'grammatical')
    .replace(/^NOTE:\s*Click on any jpg image below to listen to the\s*/i, '')
    .replace(/^NOTE:\s*/i, '')
    .replace(/^Omkar N\.\s*/i, '')
    .replace(/^Chapter \|\s*Index\s*\|\s*Next Chapter\s*\|\s*Koshur\s*/i, '')
    .replace(/\s*\|\s*/g, ' • ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitCiilHighlights(lines: string[]) {
  const fragments = lines.flatMap((line) =>
    line
      .split(/\s+\|\s+/)
      .map((part) => normalizeText(part))
      .filter(Boolean)
  );

  const cleaned = fragments
    .filter((line) => !/^Programme \d+$/i.test(line))
    .filter((line) => !/^Click here for audio$/i.test(line))
    .filter((line) => !/^[ARG]:$/i.test(line))
    .filter((line) => line.length > 3)
    .filter((line) => !/^[ivx]+\.$/i.test(line))
    .filter((line) => !/^[A-D]\.$/.test(line))
    .filter((line) => !/^\(Fem\)$/i.test(line));

  return Array.from(new Set(cleaned)).slice(0, 8);
}

function sanitizeContext(context: LessonCourseContext): LessonCourseContext {
  if (context.courseId === 'learn-kashmiri') {
    return {
      ...context,
      note: '',
      intro: '',
      highlights: [],
    };
  }

  if (context.courseId === 'ciil') {
    const introBase = normalizeText(context.intro).replace(/^[IVXLC]+\.\s*/i, '');
    const sectionTitles = (context.sections || [])
      .map((section) => section.title)
      .filter((title) => !/^Practice Lines$/i.test(title));
    const intro =
      /introduced to$/i.test(introBase) && sectionTitles.length > 0
        ? `${introBase} ${sectionTitles[0]}.`
        : introBase;

    return {
      ...context,
      note: '',
      intro,
      highlights: [],
      sections: (context.sections || []).map((section) => ({
        title: normalizeText(section.title),
        items: section.items.map(normalizeText).filter(Boolean),
      })),
    };
  }

  const intro = normalizeText(context.intro);
  const normalizedHighlights = context.highlights
    .map(normalizeText)
    .filter(Boolean)
    .filter((line) => !/^Wakhlu\s*&\s*Bharat Wakhlu$/i.test(line))
    .filter((line) => !/^Chapter \| Index/i.test(line))
    .filter((line) => !/^Programme \d+$/i.test(line))
    .filter((line) => !intro || (line !== intro && !line.includes(intro)));

  const highlights =
    context.courseId === 'ciil'
      ? splitCiilHighlights(normalizedHighlights)
      : normalizedHighlights.slice(0, 8);

  return {
    ...context,
    note: normalizeText(context.note),
    intro,
    highlights,
  };
}

export function getLessonCourseContext(courseId: string, lessonId: string) {
  const source =
    courseId === 'ciil' ? rawCiilStructuredContext : rawCourseContext;
  const context = source.find(
    (entry) => entry.courseId === courseId && entry.lessonId === lessonId
  );

  return context ? sanitizeContext(context) : null;
}
