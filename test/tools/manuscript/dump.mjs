/* サイト（../../index.html）を開いて、原稿に必要な本文を site.json に書き出す。
   CASES / WORKS / CASE_META はページ内の定数をそのまま読む。
   PROJECT 02 だけは直書きDOMなので、他ケースと同じ形に組み直している。 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {chromium} from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '../../index.html');
const OUT  = path.join(HERE, 'site.json');
const GSAP = path.resolve(HERE, 'node_modules/gsap/dist');   // あればCDNの代わりに使う

const browser = await chromium.launch(
  process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});

if (fs.existsSync(GSAP)) {
  await page.route('**cdnjs.cloudflare.com**', r => {
    const f = r.request().url().includes('ScrollTrigger') ? 'ScrollTrigger.min.js' : 'gsap.min.js';
    r.fulfill({body: fs.readFileSync(path.join(GSAP, f)), contentType: 'application/javascript'});
  });
}
await page.goto('file://' + SITE);
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const T = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
  const sc = document.querySelector('.showcase');
  const tcard = sc.querySelector('.panel.work.tcard');
  const ctxImg = tcard.querySelector('.t-media img');

  const c01 = {
    context: {
      f: ctxImg ? ctxImg.getAttribute('src').split('/').pop() : null,
      cap: T(tcard.querySelector('.t-cap')),
      paras: [...tcard.querySelectorAll('.t-body p')].map(T)
    },
    judgment: [...sc.querySelectorAll('.g-cell')].map(e => ({
      h: T(e.querySelector('.g-head')), t: T(e.querySelector('.g-text'))})),
    steps: [...sc.querySelectorAll('.hc-cap')].map(e => ({
      cat: T(e.querySelector('.p-cat')), h: T(e.querySelector('h2')), cap: T(e.querySelector('.cap-detail'))})),
    evidence: [...sc.querySelectorAll('.p-step')].map(e => ({
      no: T(e.querySelector('.ps-no')), h: T(e.querySelector('.ps-head')),
      sub: T(e.querySelector('.ps-sub')), stack: T(e.querySelector('.ps-stack')),
      paras: [...e.querySelectorAll('.ps-text')].map(T),
      link: (e.querySelector('.ps-link') || {}).href || null,
      cells: [...e.querySelectorAll('.ps-cell')].map(c =>
        (c.querySelector('video') ? '動画：' : '') + T(c.querySelector('b')))
    })),
    result: {head: T(sc.querySelector('.c-head')), paras: [...sc.querySelectorAll('.c-text')].map(T)}
  };

  const hero = {
    lead: T(document.querySelector('.hero-lead')),
    cards: [...document.querySelectorAll('.hg-title')].map((e, i) => ({
      t: T(e),
      lead: T(document.querySelectorAll('.hg-lead')[i]),
      cat: T(document.querySelectorAll('.hg-cat')[i])}))
  };
  const concept = {svg: [...document.querySelectorAll('#hmSvg text')].map(T).filter(Boolean)};
  const awHead = {h: T(document.querySelector('.aw-head h2')), lead: T(document.querySelector('.aw-head p'))};
  const about = {
    head: T(document.querySelector('.abt-head')),
    name: T(document.querySelector('.prof-name')),
    kana: T(document.querySelector('.prof-kana')),
    timeline: [...document.querySelectorAll('.prof-tl-item')].map(e => ({
      y: T(e.querySelector('.prof-tl-year')), t: T(e.querySelector('.prof-tl-text'))})).filter(x => x.y || x.t),
    now: T(document.querySelector('.prof-tl-now')),
    body: [...document.querySelectorAll('#about p')].filter(e => !e.className && T(e).length > 40).map(T)
  };
  const foot = {
    lead: T(document.querySelector('.ft-lead')),
    copy: T(document.querySelector('.ft-copy')),
    mail: (document.querySelector('#foot a[href^="mailto:"]') || {getAttribute: () => null}).getAttribute('href')
  };

  /* 取りこぼし検出用に、表示されている全リーフテキストも持っていく */
  const leaves = [];
  document.querySelectorAll('body *').forEach(e => {
    if (e.children.length) return;
    if (e.closest('.wk-modal,.wd-modal,.wk-lb,script,style')) return;
    const t = T(e); if (t && t.length > 1) leaves.push(t);
  });

  return {meta: CASE_META, order: CASE_KEYS, cases: CASES, works: WORKS,
          c01, hero, concept, awHead, about, foot, leaves: [...new Set(leaves)]};
});

fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log(`site.json を書き出しました（ケース ${data.order.length} 件 / All Works ${data.works.length} 件）`);
await browser.close();
