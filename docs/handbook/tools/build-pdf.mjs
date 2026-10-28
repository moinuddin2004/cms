// Build the handbook PDFs from docs/handbook/src/**/*.md.
//   node docs/handbook/tools/build-pdf.mjs            # every PDF
//   node docs/handbook/tools/build-pdf.mjs 10-Module-Billing 95-Status-and-Gaps   # named ones
// Uses the installed Chrome (tools/puppeteer.json). Output: docs/handbook/pdf/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HB = path.resolve(HERE, '..');
const SRC = path.join(HB, 'src');
const OUT = path.join(HB, 'pdf');
const TMP = path.join(HB, 'tools', '.build');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const CHROME = JSON.parse(fs.readFileSync(path.join(HERE, 'puppeteer.json'), 'utf8')).executablePath;
const DATE = '2026-10-28';

// ---------- chapter catalogue ----------
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : [],
  );
const PART_TITLES = {
  part1: 'Part 1 — Product overview',
  part2: 'Part 2 — How the system is built',
  part3: 'Part 3 — Organizations, locations, roles and permissions',
  part4: 'Part 4 — Data model',
  part5: 'Part 5 — Module chapters',
  part6: 'Part 6 — End-to-end workflows',
  part7: 'Part 7 — Cross-cutting concerns',
  part8: 'Part 8 — Current status',
  appendix: 'Appendices',
};
const chapters = walk(SRC)
  .map((file) => {
    const base = path.basename(file, '.md');
    const m = base.match(/^ch(\d+)-/);
    const a = base.match(/^app([A-E])-/);
    const part = path.basename(path.dirname(file)).split('-')[0];
    const sort = m ? Number(m[1]) : 1000 + a[1].charCodeAt(0);
    const first = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith('# '));
    return { file, base, no: m ? Number(m[1]) : null, sort, part, title: first.replace(/^#\s+/, '') };
  })
  .sort((a, b) => a.sort - b.sort);
const range = (lo, hi) => chapters.filter((c) => c.no && c.no >= lo && c.no <= hi);

const MODULES = [
  [28, 'Patients'], [29, 'Appointments'], [30, 'Queue'], [31, 'Consultation'], [32, 'Prescriptions'],
  [33, 'Treatment-Plans'], [34, 'Billing'], [35, 'Commissions'], [36, 'Dashboard-and-Reports'],
  [37, 'Employees'], [38, 'Payroll'], [39, 'Inventory'], [40, 'Dental-Lab'], [41, 'Lab-Portal'],
  [42, 'Lab-Finance'], [43, 'Workflow-Engine'], [44, 'Notifications'], [45, 'Subscriptions-and-Onboarding'],
];
const GROUPS = [
  { name: '00-Complete-Handbook', title: 'Complete Handbook', list: chapters },
  { name: '01-Product-and-Architecture', title: 'Product and Architecture (Parts 1–3)', list: range(1, 11) },
  { name: '02-Data-Model', title: 'Data Model (Part 4)', list: range(12, 27) },
  ...MODULES.map(([n, nm]) => ({
    name: `10-Module-${nm}`, title: `Module: ${nm.replace(/-/g, ' ')}`, list: range(n, n),
  })),
  { name: '80-Cross-Cutting', title: 'Cross-Cutting Concerns (Part 7)', list: range(56, 63) },
  { name: '90-End-to-End-Workflows', title: 'End-to-End Workflows (Part 6)', list: range(46, 55) },
  { name: '95-Status-and-Gaps', title: 'Current Status and Gaps (Part 8)', list: range(64, 68) },
];

// ---------- markdown -> html ----------
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chapterHtml(c) {
  const dir = path.dirname(c.file);
  const r = new marked.Renderer();
  r.heading = (text, level) => `<h${level} id="${c.base}-${slug(text)}">${text}</h${level}>\n`;
  r.image = (href, title, text) => {
    const abs = path.resolve(dir, href);
    return `<img src="${pathToFileURL(abs).href}" alt="${esc(text || '')}">`;
  };
  r.table = (header, body) => `<div class="tw"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  const html = marked.parse(fs.readFileSync(c.file, 'utf8'), { renderer: r, gfm: true, mangle: false, headerIds: false });
  return `<section class="chapter" id="${c.base}">${html}</section>`;
}

const CSS = `
@page { size: A4; margin: 16mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.45; color: #1e293b; margin: 0; }
h1 { font-size: 21pt; line-height: 1.2; margin: 0 0 6mm; color: #0f172a; border-bottom: 2px solid #0f766e; padding-bottom: 3mm; }
h2 { font-size: 14.5pt; margin: 8mm 0 3mm; color: #0f172a; break-after: avoid; }
h3 { font-size: 12pt; margin: 6mm 0 2mm; color: #0f766e; break-after: avoid; }
h4 { font-size: 10.5pt; margin: 4mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 2.5mm; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; } li { margin-bottom: 1mm; }
code { font-family: Consolas, "Courier New", monospace; font-size: 8.6pt; background: #f1f5f9; padding: 0 1.2mm; border-radius: 1mm; overflow-wrap: anywhere; }
pre { background: #f1f5f9; padding: 3mm; border-radius: 1.5mm; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
pre code { background: none; padding: 0; }
.tw { margin: 2mm 0 3mm; }
table { border-collapse: collapse; width: 100%; font-size: 8.3pt; table-layout: auto; }
th, td { border: 0.3mm solid #cbd5e1; padding: 1.2mm 1.8mm; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
th { background: #e2f1ef; overflow-wrap: normal; word-break: normal; } tr { break-inside: avoid; } thead { display: table-header-group; }
img { display: block; margin: 3mm auto 1.5mm; max-width: 100%; max-height: 225mm; width: auto; height: auto; object-fit: contain; }
img + p, p:has(> em:only-child) { break-before: avoid; }
em { color: #334155; }
blockquote { margin: 2mm 0; padding-left: 3mm; border-left: 1mm solid #94a3b8; color: #475569; }
.chapter { break-before: page; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: left; break-after: page; }
.cover .k { font-size: 11pt; letter-spacing: .12em; text-transform: uppercase; color: #0f766e; margin-bottom: 6mm; }
.cover .t { font-size: 32pt; font-weight: 700; line-height: 1.1; color: #0f172a; margin-bottom: 5mm; }
.cover .s { font-size: 17pt; color: #334155; margin-bottom: 14mm; }
.cover .m { font-size: 10pt; color: #64748b; }
.howto { break-after: page; } .howto h1 { font-size: 18pt; }
.part { height: 240mm; display: flex; align-items: center; break-before: page; break-after: page; font-size: 26pt; font-weight: 700; color: #0f766e; }
.toc h1 { border: none; } .toc { break-after: page; }
.toc .p { font-weight: 700; margin: 4mm 0 1mm; color: #0f766e; }
.toc .r { display: flex; gap: 2mm; font-size: 9.5pt; padding: .4mm 0; }
.toc .r .d { flex: 1; border-bottom: .25mm dotted #94a3b8; margin-bottom: 1.4mm; }
.toc a { color: inherit; text-decoration: none; }
`;

const HOWTO = `
<section class="howto"><h1>How to read this document</h1>
<p>This is part of the <strong>System Owner's Handbook</strong> for a multi-tenant clinic management product, called "the Platform" throughout. It is written for the product owner, a software engineer, and every chapter can be read on its own.</p>
<p><strong>Status labels.</strong> Every feature carries exactly one label, based on the code as of ${DATE}:</p>
<ul>
<li><strong>[Implemented]</strong>: built end to end.</li>
<li><strong>[Partial]</strong>: some of it exists; the text says exactly what is missing.</li>
<li><strong>[Not implemented]</strong>: planned, seeded, disabled or only mentioned. It is never described as working.</li>
<li><strong>[Unverified]</strong>: the code was read but the behaviour could not be confirmed; the text says what is unconfirmed.</li>
</ul>
<p><strong>Source of truth.</strong> The code is the source of truth. Where older documentation disagreed with the code, the handbook follows the code. Nothing was executed while writing: behaviour is described from reading the code.</p>
<p><strong>Figures.</strong> Every figure has a number, a caption and a paragraph that describes it in words. Figures captioned "screenshot pending" are placeholders; the paragraph after them describes the screen from the code. The few real screenshots were taken on 2026-10-23 and show a former working name of the product.</p>
<p><strong>Names.</strong> "Organization" is one clinic business (the tenant); "location" is one of its branches. File paths and code names appear in a short "Technical references" line at the end of each feature. Example people and places are fictional.</p>
</section>`;

// ---------- chrome helpers ----------
async function withBrowser(fn) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try { return await fn(browser); } finally { await browser.close(); }
}
async function toPdf(browser, html, outFile, footerTitle) {
  const htmlFile = path.join(TMP, path.basename(outFile, '.pdf') + '.html');
  fs.writeFileSync(htmlFile, html);
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load', timeout: 0 });
  const check = await page.evaluate(() => {
    const imgs = [...document.images];
    const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src);
    return { n: imgs.length, broken };
  });
  const footer = footerTitle
    ? `<div style="width:100%;font-size:7.5pt;color:#64748b;padding:0 17mm;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(footerTitle)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
    : '<div></div>';
  await page.pdf({
    path: outFile, format: 'A4', printBackground: true, displayHeaderFooter: !!footerTitle,
    headerTemplate: '<div></div>', footerTemplate: footer, outline: true, tagged: true, timeout: 0,
    margin: { top: '16mm', bottom: '20mm', left: '17mm', right: '17mm' },
  });
  await page.close();
  return check;
}
const pageCount = (file) => {
  const b = fs.readFileSync(file).toString('latin1');
  return (b.match(/\/Type\s*\/Page[^s]/g) || []).length;
};
const wrapDoc = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;

// ---------- build ----------
const pcFile = path.join(TMP, 'pagecounts.json');
const pcCache = fs.existsSync(pcFile) ? JSON.parse(fs.readFileSync(pcFile, 'utf8')) : {};
const stamp = (c) => `${fs.statSync(c.file).mtimeMs}`;

async function chapterPages(browser, c, report) {
  const key = c.base;
  if (pcCache[key] && pcCache[key].stamp === stamp(c)) return pcCache[key].pages;
  const out = path.join(TMP, `pc-${c.base}.pdf`);
  const chk = await toPdf(browser, wrapDoc(chapterHtml(c)), out, null);
  if (chk.broken.length) report.broken.push(...chk.broken.map((b) => `${c.base}: ${b}`));
  report.images += chk.n;
  const pages = pageCount(out);
  fs.unlinkSync(out);
  pcCache[key] = { stamp: stamp(c), pages };
  fs.writeFileSync(pcFile, JSON.stringify(pcCache));
  return pages;
}

function tocHtml(entries) {
  let h = '<section class="toc"><h1>Table of contents</h1>';
  let lastPart = null;
  for (const e of entries) {
    if (e.part !== lastPart) { h += `<div class="p">${esc(PART_TITLES[e.part] || e.part)}</div>`; lastPart = e.part; }
    h += `<div class="r"><a href="#${e.base}">${esc(e.title)}</a><span class="d"></span><span>${e.page}</span></div>`;
  }
  return h + '</section>';
}

async function buildGroup(browser, g, report) {
  const t0 = Date.now();
  // pass 1: page counts per chapter (cached) ----
  const counts = [];
  for (const c of g.list) counts.push(await chapterPages(browser, c, report));
  // fixed front matter: cover(1) + howto(1) + toc(n)
  const tocFor = (startPage) => {
    let page = startPage; let lastPart = null; const es = [];
    g.list.forEach((c, i) => {
      if (c.part !== lastPart && g.name.startsWith('00-')) page += 1; // part divider page
      lastPart = c.part;
      es.push({ ...c, page });
      page += counts[i];
    });
    return es;
  };
  // howto may take 1-2 pages: measure front matter once
  const cover = `<section class="cover"><div class="k">System Owner's Handbook</div><div class="t">${esc(g.title)}</div><div class="s">Multi-tenant clinic management platform</div><div class="m">Status as of ${DATE} · code is the source of truth · written for a software-engineer owner</div></section>`;
  const frontProbe = path.join(TMP, `front-${g.name}.pdf`);
  await toPdf(browser, wrapDoc(cover + HOWTO + tocHtml(tocFor(1))), frontProbe, null);
  const frontPages = pageCount(frontProbe); fs.unlinkSync(frontProbe);
  const entries = tocFor(frontPages + 1);
  // final render
  let body = cover + HOWTO + tocHtml(entries);
  let lastPart = null;
  for (const c of g.list) {
    if (c.part !== lastPart && g.name.startsWith('00-')) body += `<div class="part">${esc(PART_TITLES[c.part])}</div>`;
    lastPart = c.part;
    body += chapterHtml(c);
  }
  const out = path.join(OUT, `${g.name}.pdf`);
  const chk = await toPdf(browser, wrapDoc(body), out, `System Owner's Handbook — ${g.title}`);
  const total = pageCount(out);
  const expected = entries.at(-1).page + counts.at(-1) - 1;
  report.rows.push({ name: g.name, chapters: g.list.length, pages: total, expected, images: chk.n, broken: chk.broken.length,
    mb: (fs.statSync(out).size / 1048576).toFixed(1), sec: ((Date.now() - t0) / 1000).toFixed(0) });
  if (chk.broken.length) report.broken.push(...chk.broken.map((b) => `${g.name}: ${b}`));
}

const want = process.argv.slice(2);
const report = { rows: [], broken: [], images: 0 };
await withBrowser(async (browser) => {
  for (const g of GROUPS) {
    if (want.length && !want.includes(g.name)) continue;
    await buildGroup(browser, g, report);
    const r = report.rows.at(-1);
    console.log(`${r.name}: ${r.chapters} ch, ${r.pages} pages (toc expects ${r.expected}), ${r.images} images, ${r.broken} broken, ${r.mb} MB, ${r.sec}s`);
  }
});
fs.writeFileSync(path.join(OUT, '_build-report.json'), JSON.stringify(report, null, 1));
if (report.broken.length) { console.error('BROKEN IMAGES:', report.broken.slice(0, 20)); process.exit(1); }
