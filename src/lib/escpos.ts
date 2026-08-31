/**
 * ESC/POS command builder untuk thermal printer 58mm/80mm.
 * Generic — compatible dengan RPP02N, Xprinter, generic ESC/POS printers.
 *
 * Encoding: kirim raw byte array (number[]). Karakter ASCII langsung sebagai
 * charCode; non-ASCII (Indonesian dengan aksen, dll) di-strip/replace untuk
 * kompatibilitas maks. Printer thermal Indonesia rata-rata pakai CP437 default.
 */

export const PAPER_58MM_CHARS = 32;
export const PAPER_80MM_CHARS = 48;

export type PaperSize = 58 | 80;

export function charsPerLine(size: PaperSize): number {
  return size === 58 ? PAPER_58MM_CHARS : PAPER_80MM_CHARS;
}

/** Convert string to CP437-safe byte array (strip / replace non-ASCII). */
function textBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 128) {
      out.push(code);
    } else {
      // Replace common Indonesian punctuation
      switch (code) {
        case 0x2018: // '
        case 0x2019: // '
          out.push(0x27);
          break;
        case 0x201c: // "
        case 0x201d: // "
          out.push(0x22);
          break;
        case 0x2013: // –
        case 0x2014: // —
          out.push(0x2d);
          break;
        case 0x2026: // …
          out.push(0x2e, 0x2e, 0x2e);
          break;
        case 0xa0: // nbsp
          out.push(0x20);
          break;
        default:
          out.push(0x3f); // '?'
      }
    }
  }
  return out;
}

export class EscPos {
  private buf: number[] = [];

  init(): this {
    this.buf.push(0x1b, 0x40); // ESC @
    return this;
  }

  raw(...bytes: number[]): this {
    this.buf.push(...bytes);
    return this;
  }

  text(s: string): this {
    this.buf.push(...textBytes(s));
    return this;
  }

  line(s: string = ""): this {
    this.text(s);
    this.buf.push(0x0a); // LF
    return this;
  }

  feed(n: number = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(0x0a);
    return this;
  }

  /** Align: 0=left, 1=center, 2=right */
  align(mode: 0 | 1 | 2): this {
    this.buf.push(0x1b, 0x61, mode); // ESC a n
    return this;
  }

  /** Bold on/off */
  bold(on: boolean): this {
    this.buf.push(0x1b, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  /** Double-height/width. 0x00=normal, 0x10=double H, 0x20=double W, 0x30=both */
  size(mode: 0x00 | 0x10 | 0x20 | 0x30): this {
    this.buf.push(0x1b, 0x21, mode); // ESC ! n
    return this;
  }

  /** Underline off/1dot/2dot */
  underline(mode: 0 | 1 | 2): this {
    this.buf.push(0x1b, 0x2d, mode); // ESC - n
    return this;
  }

  /** Full cut (0x00) or partial cut (0x01). Feed cukup dulu sebelum cut. */
  cut(mode: 0 | 1 = 0): this {
    this.buf.push(0x1d, 0x56, 0x42 + mode, 0x00);
    return this;
  }

  /** 2-column row: left-aligned text kiri, right-aligned text kanan, dalam total `width` chars. */
  twoCol(left: string, right: string, width: number): this {
    const pad = Math.max(1, width - left.length - right.length);
    return this.line(left + " ".repeat(pad) + right);
  }

  /** Separator line pakai char (default '-'). */
  sep(width: number, char: string = "-"): this {
    return this.line(char.repeat(width));
  }

  /** Word-wrap text ke multiple lines dengan indent optional. */
  wrap(text: string, width: number, indent: string = ""): this {
    const words = text.split(/\s+/);
    let cur = "";
    for (const w of words) {
      if ((cur + (cur ? " " : "") + w).length + indent.length > width) {
        if (cur) this.line(indent + cur);
        cur = w;
      } else {
        cur = cur ? cur + " " + w : w;
      }
    }
    if (cur) this.line(indent + cur);
    return this;
  }

  build(): number[] {
    return this.buf;
  }
}
