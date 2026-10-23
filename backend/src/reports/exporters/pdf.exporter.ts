import { dirname, join } from 'path';
import * as pdfmake from 'pdfmake';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { formatCell, periodLine } from '../core/report-format';
import type { ReportColumn, ReportView } from '../core/report.types';
import { isEmphasized } from './xlsx.exporter';

/** PDFs past this many rows are refused (hundreds of pages): use Excel. */
export const MAX_PDF_ROWS = 5000;

const FONT_DIR = join(
  dirname(require.resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);
const URDU_DIR = join(
  dirname(require.resolve('@fontsource/noto-naskh-arabic/package.json')),
  'files',
);
const urdu = (weight: number) =>
  join(URDU_DIR, `noto-naskh-arabic-arabic-${weight}-normal.woff`);

// pdfmake is a process-wide singleton: configure it once, and never let a
// document pull a URL or a local file other than the bundled fonts.
pdfmake.setFonts({
  Roboto: {
    normal: join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
  // Roboto has no Arabic script: Urdu names (علی خان) are set in Naskh.
  Naskh: {
    normal: urdu(400),
    bold: urdu(700),
    italics: urdu(400),
    bolditalics: urdu(700),
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(
  (path) => path.startsWith(FONT_DIR) || path.startsWith(URDU_DIR),
);

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

const MARGIN = 30;
const CELL_PADDING = 9; // pdfmake's default 4 + 4 padding and the 1pt rule

const isNumeric = (c: ReportColumn) =>
  c.type === 'money' ||
  c.type === 'number' ||
  c.type === 'decimal' ||
  c.type === 'percent';

function widths(cols: ReportColumn[], landscape: boolean): number[] {
  const page = landscape ? 841.89 : 595.28;
  const available = page - MARGIN * 2 - CELL_PADDING * cols.length;
  const weights = cols.map((c) => c.weight ?? (c.type === 'text' ? 2 : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.max(24, (w / sum) * available));
}

/**
 * Text of a cell. Urdu goes in Naskh, whose Arabic subset has no space
 * glyph: an all-Urdu text is set word by word with Roboto spaces between
 * (pdfmake orders the right-to-left runs, fontkit shapes each word).
 */
function cellText(text: string): Record<string, unknown> {
  if (!ARABIC_SCRIPT.test(text)) return { text };
  if (/[A-Za-z]/.test(text)) return { text, font: 'Naskh', fontSize: 9 };
  const words = text.split(/\s+/).filter(Boolean);
  return {
    text: words.flatMap((w, i) => [
      ...(i ? [{ text: ' ', font: 'Roboto' }] : []),
      { text: w, font: 'Naskh' },
    ]),
    fontSize: 9,
  };
}

function cell(
  text: string,
  c: ReportColumn,
  extra: Partial<Record<string, unknown>> = {},
): TableCell {
  return {
    ...cellText(text),
    alignment: isNumeric(c) ? 'right' : 'left',
    ...extra,
  } as TableCell;
}

/**
 * A4 report: title block, summary strip, a zebra table whose header repeats
 * on every page, a bold totals row, and "Page x of y" footers.
 */
export async function exportPdf(
  view: ReportView,
  landscape = false,
): Promise<Buffer> {
  const cols = view.columns;
  const body: TableCell[][] = [
    cols.map((c) => cell(c.header, c, { bold: true, fillColor: '#EFF3F8' })),
    ...view.rows.map((r) =>
      cols.map((c) =>
        r._kind === 'section'
          ? cell(c === cols[0] ? String(r[c.key] ?? '') : '', c, {
              bold: true,
              color: '#475569',
            })
          : cell(
              formatCell(r[c.key], c.type),
              c,
              isEmphasized(r._kind) ? { bold: true } : {},
            ),
      ),
    ),
  ];
  if (view.totals) {
    body.push(
      cols.map((c, i) =>
        cell(
          i === 0 && view.totals?.[c.key] == null
            ? 'Total'
            : view.totals?.[c.key] == null
              ? ''
              : formatCell(view.totals[c.key], c.type),
          c,
          { bold: true, fillColor: '#F8FAFC' },
        ),
      ),
    );
  }

  const content: Content[] = [
    { text: view.title, style: 'title' },
    {
      text: `${view.meta.organizationName} · ${view.meta.scopeLabel}`,
      style: 'muted',
    },
    { text: periodLine(view), style: 'muted', margin: [0, 0, 0, 10] },
  ];

  if (view.summary.length) {
    content.push({
      table: {
        widths: view.summary.map(() => '*'),
        body: [
          view.summary.map((s) => ({
            stack: [
              { text: s.label, style: 'muted', fontSize: 7 },
              { text: formatCell(s.value, s.type), bold: true, fontSize: 10 },
            ],
          })),
        ],
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 10],
    });
  }

  content.push({
    table: {
      headerRows: 1,
      widths: widths(cols, landscape),
      body,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i, node) =>
        i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3,
      vLineWidth: () => 0,
      hLineColor: () => '#CBD5E1',
      fillColor: (rowIndex) =>
        rowIndex > 0 && rowIndex % 2 === 0 ? '#FAFBFC' : null,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  });

  if (!view.rows.length) {
    content.push({
      text: 'No records for this period.',
      style: 'muted',
      margin: [0, 8, 0, 0],
    });
  }
  if (view.truncated) {
    content.push({
      text: `Only the first ${view.rows.length} rows are included. Narrow the date range for the rest.`,
      italics: true,
      color: '#B45309',
      margin: [0, 8, 0, 0],
    });
  }
  for (const note of view.notes) {
    content.push({
      text: note,
      style: 'muted',
      italics: true,
      margin: [0, 6, 0, 0],
    });
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [MARGIN, MARGIN, MARGIN, 36],
    info: { title: view.title, creator: 'DentalFlow' },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: '#0F172A' },
    styles: {
      title: { fontSize: 15, bold: true, margin: [0, 0, 0, 2] },
      muted: { color: '#64748B', fontSize: 8 },
    },
    footer: (page, pages) => ({
      columns: [
        {
          text: `${view.title} · ${view.meta.organizationName}`,
          style: 'muted',
        },
        {
          text: `Page ${page} of ${pages}`,
          alignment: 'right',
          style: 'muted',
        },
      ],
      margin: [MARGIN, 12, MARGIN, 0],
    }),
    content,
  };

  return pdfmake.createPdf(doc).getBuffer();
}
