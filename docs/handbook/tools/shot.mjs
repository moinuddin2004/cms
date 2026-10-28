import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
const [,, htmlFile, outPrefix, ...sels] = process.argv;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 700, height: 1000, deviceScaleFactor: 1.4 });
await p.emulateMediaType('print');
await p.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load', timeout: 0 });
for (let i = 0; i < sels.length; i++) {
  const el = await p.$(sels[i]);
  if (!el) { console.log('no match', sels[i]); continue; }
  await el.screenshot({ path: `${outPrefix}-${i}.png` });
  console.log('shot', i);
}
await b.close();
