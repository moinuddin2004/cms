/**
 * One HTML layout for every email (account and notifications). Tables and
 * inline styles only — what mail clients (Gmail, Outlook, Apple Mail) render
 * reliably — plus a plain-text part for clients without HTML.
 *
 * Structure: hidden inbox preview line → header (clinic logo, or an initials
 * badge in the brand colour, + sender name) → card (eyebrow label, title,
 * body, optional details box, optional note, button + fallback link) →
 * footer (why you got it, manage link). Neutral branding: no product name or
 * clinic-type icons; the clinic's own name and colour are the brand.
 */
export interface EmailContent {
  /** Header: the clinic's name, or the app name for account emails. */
  senderName: string;
  /** `#rrggbb` — the clinic's theme colour. */
  brandColor?: string | null;
  /** Clinic logo (https). Without it the header shows an initials badge. */
  logoUrl?: string | null;
  /** Small label above the title, e.g. "Security" or "Lab order". */
  eyebrow?: string | null;
  title: string;
  /**
   * Plain text. Blank lines separate paragraphs; lines starting with "- "
   * become a bulleted list.
   */
  body: string;
  /** Key facts shown in a box, e.g. Order no / Due date. */
  details?: { label: string; value: string }[] | null;
  /** Small muted note under the body, e.g. how long a link works. */
  note?: string | null;
  cta?: { label: string; url: string } | null;
  /** Inbox preview text; defaults to the start of the body. */
  preheader?: string | null;
  /** Why the reader gets this email. */
  footer?: string | null;
  /** Link where the reader can switch these emails off. */
  manageUrl?: string | null;
}

const DEFAULT_BRAND = '#2563eb';
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const safeColor = (c?: string | null) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_BRAND;

const isWebUrl = (u?: string | null): u is string =>
  !!u && /^https?:\/\//i.test(u);

/** Up to two initials: "Smile Dental Clinic" → "SD". */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]);
  return (letters.join('') || '•').toUpperCase();
}

/** `#rrggbb` mixed with white — a soft tint of the brand colour. */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function bodyHtml(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lines = p.split('\n');
      const out: string[] = [];
      let text: string[] = [];
      let items: string[] = [];
      const flushText = () => {
        const t = text.join('\n').trim();
        if (t) {
          out.push(
            `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`,
          );
        }
        text = [];
      };
      const flushItems = () => {
        if (items.length) {
          out.push(
            `<ul style="margin:0 0 16px;padding:0 0 0 20px;font-size:15px;line-height:1.65;color:#334155;">${items
              .map((i) => `<li style="margin:0 0 4px;">${escapeHtml(i)}</li>`)
              .join('')}</ul>`,
          );
        }
        items = [];
      };
      for (const line of lines) {
        const m = /^\s*[-•]\s+(.*)$/.exec(line);
        if (m) {
          flushText();
          items.push(m[1].trim());
        } else {
          flushItems();
          text.push(line);
        }
      }
      flushText();
      flushItems();
      return out.join('');
    })
    .join('');
}

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const brand = safeColor(c.brandColor);
  const soft = tint(brand, 0.9);
  // A button only for a real web link (never javascript: or similar).
  const cta = c.cta && isWebUrl(c.cta.url) ? c.cta : null;
  const manageUrl = isWebUrl(c.manageUrl) ? c.manageUrl : null;
  const preheader = (c.preheader || c.body)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const header = isWebUrl(c.logoUrl)
    ? `<img src="${escapeHtml(c.logoUrl)}" alt="${escapeHtml(c.senderName)}" height="36" style="display:block;height:36px;max-width:180px;border:0;outline:none;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
         <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:10px;background:${brand};color:#ffffff;font:700 14px/36px ${FONT};">${escapeHtml(initialsOf(c.senderName))}</td>
         <td style="padding-left:10px;font:600 15px/1.3 ${FONT};color:#0f172a;">${escapeHtml(c.senderName)}</td>
       </tr></table>`;

  const eyebrow = c.eyebrow
    ? `<p style="margin:0 0 8px;font:700 11px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${brand};">${escapeHtml(c.eyebrow)}</p>`
    : '';

  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${soft};border-radius:10px;">
         ${c.details
           .map(
             (d, i) => `<tr>
               <td style="padding:${i ? '0' : '14px'} 16px 10px;font:500 13px/1.5 ${FONT};color:#64748b;width:40%;">${escapeHtml(d.label)}</td>
               <td style="padding:${i ? '0' : '14px'} 16px 10px;font:600 14px/1.5 ${FONT};color:#0f172a;">${escapeHtml(d.value)}</td>
             </tr>`,
           )
           .join('')}
         <tr><td colspan="2" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
       </table>`
    : '';

  const note = c.note
    ? `<p style="margin:0 0 20px;font:400 13px/1.55 ${FONT};color:#64748b;">${escapeHtml(c.note)}</p>`
    : '';

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;"><tr>
         <td align="center" bgcolor="${brand}" style="border-radius:10px;background:${brand};">
           <a href="${escapeHtml(cta.url)}" target="_blank" class="btn" style="display:inline-block;padding:13px 26px;font:600 15px/1.2 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a>
         </td></tr></table>
       <p style="margin:0;font:400 12px/1.6 ${FONT};color:#94a3b8;">Button not working? Copy this link into your browser:<br>
         <a href="${escapeHtml(cta.url)}" target="_blank" style="color:${brand};word-break:break-all;">${escapeHtml(cta.url)}</a></p>`
    : '';

  const footerBits = [
    c.footer ? escapeHtml(c.footer) : '',
    manageUrl
      ? `<a href="${escapeHtml(manageUrl)}" target="_blank" style="color:#64748b;text-decoration:underline;">Manage which emails you get</a>`
      : '',
  ].filter(Boolean);

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.title)}</title>
<style>
  @media (max-width:600px){ .px{padding-left:20px!important;padding-right:20px!important} .btn{display:block!important;text-align:center!important} }
  a{color:${brand}}
</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
    <tr><td class="px" style="padding:0 8px 18px;">${header}</td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:5px;line-height:5px;font-size:0;background:${brand};">&nbsp;</td></tr>
        <tr><td class="px" style="padding:32px 36px 30px;font-family:${FONT};">
          ${eyebrow}
          <h1 style="margin:0 0 18px;font:700 22px/1.35 ${FONT};color:#0f172a;letter-spacing:-.01em;">${escapeHtml(c.title)}</h1>
          ${bodyHtml(c.body)}
          ${details}
          ${note}
          ${button}
        </td></tr>
      </table>
    </td></tr>
    ${
      footerBits.length
        ? `<tr><td class="px" align="center" style="padding:20px 24px 0;font:400 12px/1.7 ${FONT};color:#94a3b8;">${footerBits.join('<br>')}</td></tr>`
        : ''
    }
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    c.senderName,
    '',
    c.eyebrow ? c.eyebrow.toUpperCase() : '',
    c.title,
    '',
    c.body.trim(),
    c.details?.length
      ? '\n' + c.details.map((d) => `${d.label}: ${d.value}`).join('\n')
      : '',
    c.note ? `\n${c.note}` : '',
    cta ? `\n${cta.label}: ${cta.url}` : '',
    c.footer ? `\n--\n${c.footer}` : '',
    manageUrl ? `Manage which emails you get: ${manageUrl}` : '',
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
    .trim();

  return { html, text };
}

/** Absolute web-app URL for an in-app path (`/lab-orders/1` → `https://app/lab-orders/1`). */
export function appUrl(path: string): string {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
