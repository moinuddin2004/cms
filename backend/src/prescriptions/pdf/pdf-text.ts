import { dirname, join } from 'path';
import * as fontkit from 'fontkit';
import {
  Color,
  PDFDocument,
  PDFFont,
  PDFPage,
  Rotation,
  StandardFonts,
  rgb,
  toRadians,
} from 'pdf-lib';
import {
  bidiSegments,
  hasArabicScript,
  isRtlParagraph,
  reverseForRtl,
  wrapWords,
} from './bidi';

/**
 * Urdu / Arabic-script text for pdf-lib.
 *
 * pdf-lib does no OpenType shaping, so an embedded Urdu font would print
 * disconnected letters left-to-right. Instead, Arabic-script runs are shaped
 * with fontkit (contextual forms, ligatures, Nastaliq cursive attachment,
 * right-to-left glyph order) and each glyph outline is drawn as a vector
 * path. Latin runs keep using the standard Helvetica fonts, so pages without
 * Urdu render exactly as before. Urdu drawn this way is not selectable /
 * searchable text in the PDF — an accepted trade-off.
 *
 * Font: Noto Nastaliq Urdu (SIL OFL 1.1, from @fontsource/noto-nastaliq-urdu,
 * licence in that package) — the script Urdu readers expect, and the font the
 * web preview uses.
 */

const URDU_FONT_DIR = join(
  dirname(require.resolve('@fontsource/noto-nastaliq-urdu/package.json')),
  'files',
);

/**
 * Nastaliq letters are small for their em: set Urdu a bit larger than the
 * surrounding Latin so both read at the same visual size.
 */
export const URDU_SIZE_FACTOR = 1.15;
/** Space a Nastaliq line needs above / below its baseline, in Urdu ems. */
const URDU_ABOVE = 1.15;
const URDU_BELOW = 0.65;
/** Helvetica's ascent / descent, in ems. */
const LATIN_ABOVE = 0.75;
const LATIN_BELOW = 0.25;

const fontCache = new Map<number, fontkit.Font>();

function urduFont(bold: boolean): fontkit.Font {
  const weight = bold ? 700 : 400;
  let font = fontCache.get(weight);
  if (!font) {
    font = fontkit.openSync(
      join(URDU_FONT_DIR, `noto-nastaliq-urdu-arabic-${weight}-normal.woff`),
    ) as fontkit.Font;
    guardNullAnchors(font);
    fontCache.set(weight, font);
  }
  return font;
}

interface GposProcessor {
  applyAnchor(
    markRecord: { markAnchor?: unknown },
    baseAnchor: unknown,
    baseIndex: number,
  ): void;
}

/**
 * fontkit 2.0.4 crashes ("reading 'xCoordinate'") on mark-attachment records
 * whose anchor is NULL — legal OpenType that Noto Nastaliq Urdu uses (e.g.
 * زیادہ, روزانہ). HarfBuzz treats a NULL anchor as "no attachment"; do the
 * same by skipping it. Patched on this font's own GPOS processor only.
 */
function guardNullAnchors(font: fontkit.Font): void {
  const gpos = (
    font as unknown as {
      _layoutEngine?: { engine?: { GPOSProcessor?: GposProcessor } };
    }
  )._layoutEngine?.engine?.GPOSProcessor;
  if (!gpos) return;
  const proto = Object.getPrototypeOf(gpos) as GposProcessor;
  gpos.applyAnchor = (markRecord, baseAnchor, baseIndex) => {
    if (!baseAnchor || !markRecord?.markAnchor) return;
    proto.applyAnchor.call(gpos, markRecord, baseAnchor, baseIndex);
  };
}

/** Zero-width chars: drawn as nothing if the font maps them to .notdef. */
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f]);

const round = (n: number) => Math.round(n * 10) / 10;

interface LatinPiece {
  kind: 'latin';
  text: string;
  width: number;
}
interface ArabicPiece {
  kind: 'arabic';
  /** Shaped words / spaces in visual order (font units). */
  words: ShapedWord[];
  scale: number;
  width: number;
}
type Piece = LatinPiece | ArabicPiece;

export interface DrawTextOptions {
  x: number;
  /** Baseline. */
  y: number;
  size: number;
  bold?: boolean;
  color?: Color;
  opacity?: number;
  rotate?: Rotation;
}

export interface ParagraphOptions {
  x: number;
  /** Baseline of the first line (as for plain Latin text). */
  y: number;
  width: number;
  size: number;
  /** Baseline-to-baseline distance for Latin lines. */
  lineHeight: number;
  bold?: boolean;
  color?: Color;
  /** 'auto' right-aligns paragraphs whose first strong letter is Urdu. */
  align?: 'left' | 'right' | 'auto';
}

export class PdfTextWriter {
  private readonly charsets = new Map<PDFFont, Set<number>>();

  private constructor(
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {}

  static async create(pdf: PDFDocument): Promise<PdfTextWriter> {
    const [font, bold] = await Promise.all([
      pdf.embedFont(StandardFonts.Helvetica),
      pdf.embedFont(StandardFonts.HelveticaBold),
    ]);
    return new PdfTextWriter(font, bold);
  }

  /** Rendered width of a single line of (possibly mixed) text. */
  widthOf(text: string, size: number, bold = false): number {
    return this.pieces(text, size, bold).reduce((w, p) => w + p.width, 0);
  }

  /** Draw one line starting at `x`; returns its width. */
  draw(page: PDFPage, text: string, opts: DrawTextOptions): number {
    const pieces = this.pieces(text, opts.size, !!opts.bold);
    const angle = opts.rotate ? toRadians(opts.rotate) : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let dx = 0;
    for (const p of pieces) {
      const x = opts.x + dx * cos;
      const y = opts.y + dx * sin;
      if (p.kind === 'latin') {
        if (p.text.trim()) {
          page.drawText(p.text, {
            x,
            y,
            size: opts.size,
            font: opts.bold ? this.bold : this.font,
            color: opts.color,
            opacity: opts.opacity,
            rotate: opts.rotate,
          });
        }
      } else if (p.words.some((w) => w.glyphs.length)) {
        page.drawSvgPath(glyphPath(p.words), {
          x,
          y,
          scale: p.scale,
          color: opts.color ?? rgb(0, 0, 0),
          opacity: opts.opacity,
          rotate: opts.rotate,
        });
      }
      dx += p.width;
    }
    return dx;
  }

  /** Draw right-aligned so the line ends at `right`. */
  drawRight(
    page: PDFPage,
    text: string,
    opts: Omit<DrawTextOptions, 'x'> & { right: number },
  ): number {
    const width = this.widthOf(text, opts.size, !!opts.bold);
    this.draw(page, text, { ...opts, x: opts.right - width });
    return width;
  }

  /** Space a line needs above / below its baseline. */
  extent(text: string, size: number): { above: number; below: number } {
    if (!hasArabicScript(text)) {
      return { above: LATIN_ABOVE * size, below: LATIN_BELOW * size };
    }
    const urdu = size * URDU_SIZE_FACTOR;
    return { above: URDU_ABOVE * urdu, below: URDU_BELOW * urdu };
  }

  /**
   * Word-wrapped paragraph(s). Latin-only lines step by `lineHeight` exactly
   * like before; lines with Urdu get the extra room Nastaliq needs. Returns
   * the baseline where the next line would go.
   */
  paragraph(page: PDFPage, text: string, opts: ParagraphOptions): number {
    let baseline = opts.y;
    const latin = this.extent('', opts.size);
    for (const para of text.split(/\r?\n/)) {
      const rtl = isRtlParagraph(para);
      const right = opts.align === 'right' || (opts.align !== 'left' && rtl);
      const lines = wrapWords(para, opts.width, (l) =>
        this.widthOf(l, opts.size, opts.bold),
      );
      for (const line of lines) {
        const ext = this.extent(line, opts.size);
        const extraAbove = Math.max(0, ext.above - latin.above);
        const extraBelow = Math.max(0, ext.below - latin.below);
        baseline -= extraAbove;
        const width = this.widthOf(line, opts.size, opts.bold);
        this.draw(page, line, {
          x: right ? opts.x + opts.width - width : opts.x,
          y: baseline,
          size: opts.size,
          bold: opts.bold,
          color: opts.color,
        });
        baseline -= opts.lineHeight + extraBelow;
      }
    }
    return baseline;
  }

  /** Lines a paragraph wraps to (for callers that measure before drawing). */
  wrap(text: string, width: number, size: number, bold = false): string[] {
    return text
      .split(/\r?\n/)
      .flatMap((para) =>
        wrapWords(para, width, (l) => this.widthOf(l, size, bold)),
      );
  }

  // ─── internals ─────────────────────────────────────────────────────

  private pieces(text: string, size: number, bold: boolean): Piece[] {
    const clean = text.replace(/[\r\n\t]+/g, ' ');
    if (!hasArabicScript(clean)) {
      return [this.latinPiece(clean, size, bold)];
    }
    return bidiSegments(clean).map((seg) =>
      seg.arabic
        ? this.arabicPiece(seg.text, seg.rtl, size, bold)
        : this.latinPiece(
            seg.rtl ? reverseForRtl(seg.text) : seg.text,
            size,
            bold,
          ),
    );
  }

  private latinPiece(text: string, size: number, bold: boolean): LatinPiece {
    const font = bold ? this.bold : this.font;
    const safe = this.encodable(font, text);
    return {
      kind: 'latin',
      text: safe,
      width: font.widthOfTextAtSize(safe, size),
    };
  }

  /** Replace characters the standard font can't encode (WinAnsi) with '?'. */
  private encodable(font: PDFFont, text: string): string {
    let set = this.charsets.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      this.charsets.set(font, set);
    }
    let out = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (set.has(cp)) out += ch;
      else if (!ZERO_WIDTH.has(cp)) out += '?';
    }
    return out;
  }

  private arabicPiece(
    text: string,
    rtl: boolean,
    size: number,
    bold: boolean,
  ): ArabicPiece {
    const font = urduFont(bold);
    const scale = (size * URDU_SIZE_FACTOR) / font.unitsPerEm;
    // Shaping never crosses a space, so words are shaped (and cached) one at
    // a time; that keeps the repeated measuring done by wrapping cheap.
    const parts = text.split(/(\s+)/).filter(Boolean);
    if (rtl) parts.reverse();
    const words = parts.map((w) => shapeWord(font, bold, w, rtl));
    const advance = words.reduce((sum, w) => sum + w.advance, 0);
    return { kind: 'arabic', words, scale, width: advance * scale };
  }
}

interface ShapedWord {
  /** Advance width in font units. */
  advance: number;
  /** Glyphs in visual order, offset from the word's left edge. */
  glyphs: { glyph: fontkit.Glyph; x: number; y: number }[];
}

const shapeCache = new Map<string, ShapedWord>();
const SHAPE_CACHE_LIMIT = 5000;

/** fontkit layout of one word (contextual forms, ligatures, positioning). */
function shapeWord(
  font: fontkit.Font,
  bold: boolean,
  word: string,
  rtl: boolean,
): ShapedWord {
  const key = `${bold ? 'b' : 'r'}${rtl ? '<' : '>'}${word}`;
  const hit = shapeCache.get(key);
  if (hit) return hit;
  // fontkit returns right-to-left runs already in visual order.
  const run = font.layout(
    word,
    undefined,
    undefined,
    undefined,
    rtl ? 'rtl' : 'ltr',
  );
  const shaped: ShapedWord = { advance: 0, glyphs: [] };
  let penY = 0;
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    if (glyph.id === 0) {
      // .notdef: never draw its box; zero-width chars take no space either.
      if (glyph.codePoints.every((cp) => ZERO_WIDTH.has(cp))) return;
    } else {
      shaped.glyphs.push({
        glyph,
        x: shaped.advance + pos.xOffset,
        y: penY + pos.yOffset,
      });
    }
    shaped.advance += pos.xAdvance;
    penY += pos.yAdvance;
  });
  if (shapeCache.size >= SHAPE_CACHE_LIMIT) shapeCache.clear();
  shapeCache.set(key, shaped);
  return shaped;
}

/**
 * One SVG path for a run of shaped words, in font units. Font outlines are
 * y-up while pdf-lib draws SVG paths y-down, so y is negated here.
 */
function glyphPath(words: ShapedWord[]): string {
  const parts: string[] = [];
  let originX = 0;
  for (const word of words) {
    for (const { glyph, x: gx, y: gy } of word.glyphs) {
      const ox = originX + gx;
      const pt = (x: number, y: number) =>
        `${round(ox + x)} ${round(-(gy + y))}`;
      for (const { command, args: a } of glyph.path.commands) {
        switch (command) {
          case 'moveTo':
            parts.push(`M${pt(a[0], a[1])}`);
            break;
          case 'lineTo':
            parts.push(`L${pt(a[0], a[1])}`);
            break;
          case 'quadraticCurveTo':
            parts.push(`Q${pt(a[0], a[1])} ${pt(a[2], a[3])}`);
            break;
          case 'bezierCurveTo':
            parts.push(
              `C${pt(a[0], a[1])} ${pt(a[2], a[3])} ${pt(a[4], a[5])}`,
            );
            break;
          case 'closePath':
            parts.push('Z');
            break;
        }
      }
    }
    originX += word.advance;
  }
  return parts.join('');
}
