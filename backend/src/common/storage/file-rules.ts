import { BadRequestException } from '@nestjs/common';

/**
 * What may be uploaded where. Checked on the file's BYTES (magic numbers),
 * never on the name or the Content-Type the browser sent, so a renamed
 * .html/.exe/.svg can't pass as an image. Provider-independent.
 */
export type FileKind = 'avatar' | 'image' | 'document';

const MB = 1024 * 1024;

export const FILE_KINDS: Record<
  FileKind,
  { mimeTypes: string[]; maxBytes: number; label: string }
> = {
  /** Profile photos. */
  avatar: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 2 * MB,
    label: 'JPG, PNG or WebP image up to 2 MB',
  },
  /** Logos, favicons and other branding images. */
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: 5 * MB,
    label: 'JPG, PNG, WebP or GIF image up to 5 MB',
  },
  /** Patient documents: scans, photos, PDFs. */
  document: {
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'application/pdf',
    ],
    maxBytes: 15 * MB,
    label: 'image (JPG, PNG, WebP, GIF, HEIC) or PDF up to 15 MB',
  },
};

/** Largest size any kind allows — use as the multer limit. */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(FILE_KINDS).map((k) => k.maxBytes),
);

export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/** MIME type from the first bytes, or null when not a type we accept. */
export function sniffMimeType(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  const ascii = (start: number, end: number) =>
    buf.subarray(start, end).toString('latin1');
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (
    buf[0] === 0x89 &&
    ascii(1, 4) === 'PNG' &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a
  )
    return 'image/png';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (
    ascii(4, 8) === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ascii(8, 12))
  )
    return 'image/heic';
  return null;
}

/** Throws 400 unless `file` is an allowed `kind`; returns the real MIME type. */
export function assertAllowedFile(
  file: Express.Multer.File | undefined,
  kind: FileKind,
): string {
  const rule = FILE_KINDS[kind];
  if (!file?.buffer?.length) throw new BadRequestException('No file provided');
  if (file.size > rule.maxBytes || file.buffer.length > rule.maxBytes) {
    throw new BadRequestException(`File is too large. Allowed: ${rule.label}`);
  }
  const mime = sniffMimeType(file.buffer);
  if (!mime || !rule.mimeTypes.includes(mime)) {
    throw new BadRequestException(
      `Unsupported file type. Allowed: ${rule.label}`,
    );
  }
  return mime;
}
