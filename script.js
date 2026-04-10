/* ââââââââââââââââââââââââââââââââââ
   Ink Reveal Animation
ââââââââââââââââââââââââââââââââââ */
    // ââ ç»åãªã¹ãï¼ä»®ç»å / æ¬çªã¯å®ãã¡ã¤ã«ãã¹ã«å·®ãæ¿ãï¼ ââ
    const IMAGE_SRCS = [
      "img/top/top_01.webp",
      "img/top/top_02.webp",
      "img/top/top_03.webp",
      "img/top/top_04.webp",
      "img/top/top_05.webp",
    ];
    const CYCLE_INTERVAL = 4000; // 4ç§

    const cv  = document.getElementById('ink-canvas');
    const ctx = cv.getContext('2d');

    let W = 0, H = 0;
    let imgDrawX = 0, imgDrawY = 0, imgDrawW = 0, imgDrawH = 0;
    let animId = null;
    let finished = false;

    // ç¾å¨è¡¨ç¤ºä¸­ã®ç»åã¤ã³ããã¯ã¹
    let currentIdx = 0;

    // ç´åã®å®æãã¬ã¼ã ãä¿æãããªãã¹ã¯ãªã¼ã³ã­ã£ã³ãã¹
    let prevCanvas = null;

    const BLUR_STEPS = [20, 14, 9, 5, 2, 0];
    let blurLevels = [];

    // ç»åãªãã¸ã§ã¯ãã®ã­ã£ãã·ã¥
    const imgCache = {};
    function loadImg(src) {
      return new Promise(resolve => {
        if (imgCache[src] && imgCache[src].complete) return resolve(imgCache[src]);
        const i = new Image();
        i.onload = () => { imgCache[src] = i; resolve(i); };
        i.onerror = () => resolve(null);
        i.src = src;
        imgCache[src] = i;
      });
    }

    function getCoverParams(img) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale, dh = ih * scale;
      return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
    }

    function drawFull(img) {
      const { dx, dy, dw, dh } = getCoverParams(img);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    // blurç¨ã®ç¸®å°è§£ååº¦ (0.5åã§ããã©ã¼ã¯å¤å¥ä¸è½ãªã»ã©åãè¦ãç®)
    const BLUR_SCALE = 0.5;

    function buildBlurLevels(img) {
      const { dx, dy, dw, dh } = getCoverParams(img);
      imgDrawX = dx; imgDrawY = dy; imgDrawW = dw; imgDrawH = dh;
      const bW = Math.ceil(W * BLUR_SCALE);
      const bH = Math.ceil(H * BLUR_SCALE);
      blurLevels = BLUR_STEPS.map(blur => {
        const off = document.createElement('canvas');
        off.width = bW; off.height = bH;
        const oc = off.getContext('2d');
        oc.fillStyle = '#000';
        oc.fillRect(0, 0, bW, bH);
        if (blur > 0) {
          const blurOff = document.createElement('canvas');
          blurOff.width = bW; blurOff.height = bH;
          const bc = blurOff.getContext('2d');
          bc.fillStyle = '#000';
          bc.fillRect(0, 0, bW, bH);
          bc.filter = `blur(${blur * BLUR_SCALE}px)`;
          bc.drawImage(img, dx * BLUR_SCALE, dy * BLUR_SCALE, dw * BLUR_SCALE, dh * BLUR_SCALE);
          bc.filter = 'none';
          oc.drawImage(blurOff, 0, 0);
        } else {
          oc.drawImage(img, dx * BLUR_SCALE, dy * BLUR_SCALE, dw * BLUR_SCALE, dh * BLUR_SCALE);
        }
        return off;
      });
    }

    function getBlurred(progress) {
      const bW = Math.ceil(W * BLUR_SCALE);
      const bH = Math.ceil(H * BLUR_SCALE);
      const steps = BLUR_STEPS.length - 1;
      const idx = progress * steps;
      const lo  = Math.floor(idx);
      const hi  = Math.min(lo + 1, steps);
      const t   = idx - lo;
      if (t === 0 || lo === hi) return blurLevels[lo];
      if (!_mixCanvas || _mixCanvas.width !== bW || _mixCanvas.height !== bH) {
        _mixCanvas = document.createElement('canvas');
        _mixCanvas.width = bW; _mixCanvas.height = bH;
      }
      const mc = _mixCanvas.getContext('2d');
      mc.clearRect(0, 0, bW, bH);
      mc.drawImage(blurLevels[lo], 0, 0);
      mc.globalAlpha = t;
      mc.drawImage(blurLevels[hi], 0, 0);
      mc.globalAlpha = 1;
      return _mixCanvas;
    }

    class InkDrop {
      constructor(x, y, delay) {
        this.x = x; this.y = y; this.r = 0;
        this.maxR  = Math.sqrt(W * W + H * H) * (0.28 + Math.random() * 0.4);
        this.speed = 14 + Math.random() * 12;
        this.delay = delay; this.age = 0;
        this.wb  = Math.random() * Math.PI * 2;
        this.wbS = 0.018 + Math.random() * 0.032;
        this.sx  = 0.76 + Math.random() * 0.48;
        this.sy  = 0.76 + Math.random() * 0.48;
        this.ang = Math.random() * Math.PI * 2;
        this.done = false;
        this.sats = Array.from({ length: 4 + Math.floor(Math.random() * 5) }, () => ({
          a: Math.random() * Math.PI * 2,
          d: 0.48 + Math.random() * 0.5,
          r: 0.18 + Math.random() * 0.36,
        }));
      }
      update() {
        this.age++;
        if (this.age < this.delay) return;
        this.wb += this.wbS;
        if (this.r < this.maxR) {
          this.r += this.speed * (1 - this.r / this.maxR * 0.62);
        } else { this.done = true; }
      }
      get progress() {
        if (this.age < this.delay) return 0;
        return Math.min(1, this.r / this.maxR);
      }
      drawMask(c) {
        if (this.age < this.delay || this.r <= 0) return;
        const p = this.progress;
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.ang + Math.sin(this.wb) * 0.04);
        c.scale(this.sx, this.sy);
        c.globalAlpha = Math.min(1, p * 5);
        c.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const n = 1
            + Math.sin(a * 3  + this.wb) * 0.09
            + Math.sin(a * 7  + 1.2)     * 0.055
            + Math.sin(a * 13)            * 0.028;
          c.lineTo(Math.cos(a) * this.r * n, Math.sin(a) * this.r * n);
        }
        c.closePath();
        const g = c.createRadialGradient(0, 0, this.r * 0.2, 0, 0, this.r * 1.08);
        g.addColorStop(0,    'rgba(255,255,255,1)');
        g.addColorStop(0.65, 'rgba(255,255,255,1)');
        g.addColorStop(0.9,  'rgba(255,255,255,0.5)');
        g.addColorStop(1,    'rgba(255,255,255,0)');
        c.fillStyle = g; c.fill();
        this.sats.forEach(s => {
          const sr = this.r * s.d;
          const sx = Math.cos(s.a) * sr, sy = Math.sin(s.a) * sr;
          const sR = this.r * s.r * p;
          if (sR < 1) return;
          const sg = c.createRadialGradient(sx, sy, 0, sx, sy, sR);
          sg.addColorStop(0, 'rgba(255,255,255,0.85)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = sg;
          c.beginPath(); c.arc(sx, sy, sR, 0, Math.PI * 2); c.fill();
        });
        c.restore();
      }
    }

    let drops = [], inkOff, iCtx;
    // ãã¬ã¼ã ãã¨ã«ä½¿ãåããªãã¹ã¯ãªã¼ã³Canvasï¼æ¯ãã¬ã¼ã newããªãï¼
    let _mixCanvas = null, _maskedCanvas = null;

    function makeDrops() {
      drops = [];
      const O = [
        { x: W * .5,  y: H * .5,  d: 0  },
        { x: W * .22, y: H * .28, d: 3  },
        { x: W * .78, y: H * .68, d: 5  },
        { x: W * .1,  y: H * .78, d: 7  },
        { x: W * .9,  y: H * .18, d: 6  },
        { x: W * .5,  y: H * .08, d: 9  },
        { x: W * .5,  y: H * .92, d: 10 },
        { x: W * .04, y: H * .04, d: 11 },
        { x: W * .96, y: H * .96, d: 12 },
        { x: W * .28, y: H * .96, d: 13 },
        { x: W * .74, y: H * .04, d: 14 },
        { x: W * .96, y: H * .04, d: 15 },
        { x: W * .04, y: H * .96, d: 16 },
      ];
      drops = O.map(o => new InkDrop(o.x, o.y, o.d));
      for (let i = 0; i < 22; i++)
        drops.push(new InkDrop(Math.random() * W, Math.random() * H, 2 + Math.random() * 25));
    }

    // ç¾å¨ã® canvas ç¶æã prevCanvas ã«ä¿å­ï¼drawFullå¾ã«å¼ã¶ãã¨ï¼
    function savePrevCanvas() {
      if (!prevCanvas) prevCanvas = document.createElement('canvas');
      prevCanvas.width  = W;
      prevCanvas.height = H;
      const pc = prevCanvas.getContext('2d');
      pc.fillStyle = '#000';
      pc.fillRect(0, 0, W, H);
      pc.drawImage(cv, 0, 0);
    }

    function startAnim(img, onDone) {
      if (animId) cancelAnimationFrame(animId);
      finished = false;

      buildBlurLevels(img);

      inkOff = document.createElement('canvas');
      inkOff.width = W; inkOff.height = H;
      iCtx = inkOff.getContext('2d');

      makeDrops();

      const { dx, dy, dw, dh } = getCoverParams(img);

      function frame() {
        iCtx.clearRect(0, 0, W, H);
        drops.forEach(d => { d.update(); d.drawMask(iCtx); });

        const spread     = drops.reduce((s, d) => s + d.progress, 0) / drops.length;
        const fadeAlpha  = Math.min(1, spread * 1.6);
        const blurProg   = Math.min(1, spread * 1.2);
        const blurredImg = getBlurred(blurProg);

        // åå©ç¨Canvasã§ãã¬ã¼ã ãã¨ã®ã¢ã­ã±ã¼ã·ã§ã³&GCãæé¤
        const bW = Math.ceil(W * BLUR_SCALE);
        const bH = Math.ceil(H * BLUR_SCALE);
        if (!_maskedCanvas || _maskedCanvas.width !== bW || _maskedCanvas.height !== bH) {
          _maskedCanvas = document.createElement('canvas');
          _maskedCanvas.width = bW; _maskedCanvas.height = bH;
        }
        const mc = _maskedCanvas.getContext('2d');
        mc.clearRect(0, 0, bW, bH);
        mc.drawImage(blurredImg, 0, 0);
        mc.globalCompositeOperation = 'destination-in';
        // inkOffã¯ãã«ãµã¤ãºãªã®ã§ç¸®å°ãã¦ãã¹ã¯åæ
        mc.drawImage(inkOff, 0, 0, bW, bH);
        mc.globalCompositeOperation = 'source-over';

        ctx.clearRect(0, 0, W, H);
        if (prevCanvas) {
          ctx.drawImage(prevCanvas, 0, 0);
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = fadeAlpha;
        // åè§£ååº¦maskedCanvasããã«ãµã¤ãºã«æ¡å¤§æç»
        ctx.drawImage(_maskedCanvas, 0, 0, W, H);
        ctx.globalAlpha = 1;

        if (drops.every(d => d.done)) {
          drawFull(img);
          finished = true;
          if (onDone) onDone();
          return;
        }
        animId = requestAnimationFrame(frame);
      }
      animId = requestAnimationFrame(frame);
    }

    // ãã­ã¹ãã1æå­ãã¤spanã«åå²ãã¦ã¢ãã¡ã¼ã·ã§ã³
    function splitAndAnimate(el, startDelay, duration) {
      const nodes = Array.from(el.childNodes);
      el.innerHTML = '';
      el.style.opacity = '1';

      const spans = [];
      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          [...node.textContent].forEach(ch => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch === ' ' ? '\u00A0' : ch;
            el.appendChild(span);
            spans.push(span);
          });
        } else if (node.nodeName === 'BR') {
          el.appendChild(document.createElement('br'));
        } else {
          el.appendChild(node);
        }
      });

      const count = spans.length;
      const delays = spans.map((_, i) => startDelay + (i / count) * duration);
      for (let i = delays.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [delays[i], delays[j]] = [delays[j], delays[i]];
      }
      spans.forEach((span, i) => {
        span.style.animationDelay = delays[i].toFixed(3) + 's';
      });

      return startDelay + duration;
    }

    function revealContent() {
      const elNav     = document.getElementById('main-nav');
      const elBg      = document.getElementById('col-right-bg');
      const subtitle  = document.querySelector('.subtitle');
      const name      = document.querySelector('.name');
      const divider   = document.querySelector('.divider');
      const desc      = document.querySelector('.description');

      [elNav, elBg].forEach(el => {
        el.classList.add('reveal');
        el.addEventListener('animationend', () => {
          el.style.animation = 'none';
          el.style.opacity   = '1';
          el.style.transform = 'none';
        }, { once: true });
      });

      const DURATION = 0.5;
      let t = 0.3;

      splitAndAnimate(subtitle, t, DURATION);
      t += 0.3;

      splitAndAnimate(name, t, DURATION);
      t += 0.3;

      divider.classList.add('reveal');
      divider.style.animationDelay = t + 's';
      divider.addEventListener('animationend', () => {
        divider.style.animation = 'none';
        divider.style.opacity = '1';
      }, { once: true });
      t += 0.2;

      splitAndAnimate(desc, t, DURATION);
    }

    // ã¹ã¯ã­ã¼ã«æã®ã¢ãã¬ã¹ãã¼åç¸®ã§æ¯çãå¤ãããªãããååé«ããåºå®
    const FIXED_H = window.screen.height;

    function setSize() {
      W = window.innerWidth;
      H = FIXED_H;
      cv.width  = W;
      cv.height = H;
      cv.style.width  = '100vw';
      cv.style.height = '100vh';
    }

    let contentRevealed = false;

    // æ¬¡ã®ç»åã¸ãµã¤ã¯ã«
    function scheduleNextCycle() {
      if (IMAGE_SRCS.length < 2) return;
      setTimeout(async () => {
        currentIdx = (currentIdx + 1) % IMAGE_SRCS.length;
        const nextImg = await loadImg(IMAGE_SRCS[currentIdx]);
        if (!nextImg) { scheduleNextCycle(); return; }
        savePrevCanvas();
        startAnim(nextImg, scheduleNextCycle);
      }, CYCLE_INTERVAL);
    }

    // å¨ç»åãããªã­ã¼ã
    async function init() {
      setSize();
      // ç»åã­ã¼ãæç¡ã«ãããããå¿ãrevealããä¿éºã¿ã¤ãã¼
      setTimeout(() => {
        if (!contentRevealed) { contentRevealed = true; revealContent(); }
      }, 900);
      const firstImg = await loadImg(IMAGE_SRCS[0]);
      if (!firstImg) {
        if (!contentRevealed) { contentRevealed = true; revealContent(); }
        return;
      }
      buildBlurLevels(firstImg);
      startAnim(firstImg, scheduleNextCycle);
      setTimeout(() => {
        if (!contentRevealed) { contentRevealed = true; revealContent(); }
      }, 700);
      IMAGE_SRCS.slice(1).forEach(src => loadImg(src));
    }

    // ink canvas ãéå»¶åæå â ãã¡ã¼ã¹ããã¤ã³ãããã­ãã¯ããªã
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => init(), { timeout: 1200 });
    } else {
      setTimeout(init, 200);
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        setSize();
        const img = await loadImg(IMAGE_SRCS[currentIdx]);
        if (img) buildBlurLevels(img);
        if (finished && img) drawFull(img);
      }, 100);
    });

/* ââââââââââââââââââââââââââââââââââ
   Scroll Crossfade + Strong Section Animation
ââââââââââââââââââââââââââââââââââ */
    const overlay      = document.getElementById('bg-overlay');
    const colRightBg   = document.getElementById('col-right-bg');
    const heroText     = document.getElementById('hero-text');
    const sSectionEl   = document.getElementById('strong-section');
    const mainNav      = document.getElementById('main-nav');
    const NAV_GAP      = 24;
    const NAV_H        = 52;
    const SCROLL_END   = window.innerHeight * 0.6;

    // ãã¡ã¼ã¹ããã¥ã¼: nav ãç»é¢ä¸é¨ã«åæéç½®
    const navBottomTop = window.innerHeight - NAV_H - NAV_GAP;
    mainNav.style.top  = navBottomTop + 'px';

    // åæç¶æ
    sSectionEl.style.opacity = '0';

    let sContentRevealed = false;
    let bgReadyDone      = false;
    let navReachedTop    = false; // nav ãä¸ç«¯ã«å°éãããåºå®

    let _scrollRafId = null;
    window.addEventListener('scroll', () => {
      if (_scrollRafId) return;
      _scrollRafId = requestAnimationFrame(() => {
        _scrollRafId = null;
        const progress = Math.min(1, Math.max(0, window.scrollY / SCROLL_END));

      // Nav: ä¸âä¸ï¼ä¸åº¦ä¸ç«¯ã«éãããåºå®ããã¾ã¾æ»ããªãï¼
      if (!navReachedTop) {
        const navTop = navBottomTop + (NAV_GAP - navBottomTop) * progress;
        mainNav.style.top = navTop + 'px';
        if (progress >= 1) {
          navReachedTop = true;
          mainNav.style.top = NAV_GAP + 'px';
        }
      }

      // TOP ãã§ã¼ãã¢ã¦ã (bg-overlay ãç½ããªã£ã¦ã­ã£ã³ãã¹ãè¦ãé ã)
      overlay.style.opacity    = progress;
      colRightBg.style.opacity = 1 - progress;
      heroText.style.opacity   = 1 - progress;
      document.querySelector('.col-right').style.pointerEvents = progress > 0.9 ? 'none' : '';

      // Strong section + è¦åºã: bg-overlayãç½ããªã£ãå¾åã§ãã§ã¼ãã¤ã³
      const strongP = Math.min(1, Math.max(0, (progress - 0.6) / 0.4));
      sSectionEl.style.opacity = strongP;

      // é·ç§»å®äºå¾ã«ç½èæ¯ãä»ä¸
      if (progress >= 1 && !bgReadyDone) {
        bgReadyDone = true;
        sSectionEl.classList.add('s-bg-ready');
      } else if (progress < 1 && bgReadyDone) {
        bgReadyDone = false;
        sSectionEl.classList.remove('s-bg-ready');
      }

      // ã³ã³ãã³ãã¢ãã¡ã¼ã·ã§ã³çºç«ï¼ä¸åº¦ã ãï¼
      if (progress > 0.75 && !sContentRevealed) {
        sContentRevealed = true;
        revealStrongContent();
      }
      }); // rAF
    }, { passive: true });

    // ââ Strong Section ã³ã³ãã³ãã¢ãã¡ã¼ã·ã§ã³ ââ

    // TOPã¨åãæå­ã©ã³ãã ãã§ã¼ã
    function splitAndAnimateStrong(el, startDelay, duration) {
      // u ã¿ã°ç­ãä¿æãã¤ã¤æå­åå²
      function processNode(node, spans, container) {
        if (node.nodeType === Node.TEXT_NODE) {
          [...node.textContent].forEach(ch => {
            const span = document.createElement('span');
            span.className = 's-char';
            span.textContent = ch === ' ' ? '\u00A0' : ch;
            container.appendChild(span);
            spans.push(span);
          });
        } else if (node.nodeName === 'BR') {
          container.appendChild(document.createElement('br'));
        } else {
          // u ã¿ã°ãªã©ã¯ã©ããã¼ãã¨ä¿æ
          const wrapper = node.cloneNode(false);
          container.appendChild(wrapper);
          node.childNodes.forEach(child => processNode(child, spans, wrapper));
        }
      }

      const nodes = Array.from(el.childNodes);
      el.innerHTML = '';
      el.style.opacity = '1';
      el.style.transform = 'none';

      const spans = [];
      nodes.forEach(n => processNode(n, spans, el));

      const count = spans.length;
      const delays = spans.map((_, i) => startDelay + (i / count) * duration);
      for (let i = delays.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [delays[i], delays[j]] = [delays[j], delays[i]];
      }
      spans.forEach((span, i) => {
        span.style.animationDelay = delays[i].toFixed(3) + 's';
      });
    }

    function revealStrongContent() {
      const section = document.getElementById('strong-section');

      // ç»å: Ink reveal ã¢ãã¡ã¼ã·ã§ã³
      startStrongImgAnim();

      // ãã­ã¹ãè¦ç´ ã¢ãã¡ã¼ã·ã§ã³
      const eyebrow = section.querySelector('.s-eyebrow');
      const title   = section.querySelector('.s-main-title');
      const rule    = section.querySelector('.s-rule');
      const intros  = section.querySelectorAll('.s-intro');
      const sep     = section.querySelector('.s-sep');
      const skills  = section.querySelectorAll('.s-sk');

      // eyebrow
      eyebrow.style.animation      = 's-fadeUp 0.6s ease both';
      eyebrow.style.animationDelay = '0.1s';

      // title: 1æå­ãã¤ã©ã³ãã ãã§ã¼ã
      splitAndAnimateStrong(title, 0.18, 0.5);

      // rule
      rule.style.animation      = 's-fadeUp 0.6s ease both';
      rule.style.animationDelay = '0.26s';

      // intros
      let t = 0.32;
      intros.forEach(intro => {
        intro.style.animation      = 's-fadeUp 0.6s ease both';
        intro.style.animationDelay = t + 's';
        t += 0.1;
      });

      // sep
      sep.style.animation      = 's-fadeUp 0.6s ease both';
      sep.style.animationDelay = '0.6s';

      // skill cards
      skills.forEach((sk, i) => {
        sk.style.animation      = 's-fadeUp 0.6s ease both';
        sk.style.animationDelay = (0.66 + i * 0.07) + 's';
      });
    }

    // ââ Strong ã»ã¯ã·ã§ã³ç»å Ink Reveal ââ
    function startStrongImgAnim() {
      const img = document.getElementById('s-diagram-img');
      // å°ãéå»¶ãç½®ãã¦ãããã§ã¼ãã¤ã³
      setTimeout(() => {
        img.classList.add('s-img-visible');
      }, 150);
    }

/* ââââââââââââââââââââââââââââââââââ
   Portfolio / Work Section
ââââââââââââââââââââââââââââââââââ */
  (function () {

    /* ââââââââ  DATA â 21 works  ââââââââ */
    const PF_WORKS = [
      {
        id:1, year:'2025',
        youtube:'Ll2MaM-uSSI',
        title:'ä¼æ¥­åç» ã¼ ãªã¼ãã¼ã®ä¸çã«ä¼´èµ°ãã',
        category:'Branding / Video',
        tags:['ãã©ã³ãã£ã³ã°','åç»å¶ä½','ã¡ã¼ã«ãã¬ã¸ã³','ãã£ã¬ã¯ã·ã§ã³'],
        img:'img/works/work_01/work_01.webp',
        client:'ãã«ã¿ã°ã«ã¼ãã»æ ªå¼ä¼ç¤¾ã°ã©ããã­ã¥ã¼ã',
        imgs:{ a:false, b:false, c:false },
        d:{
          overview:'ãçµå¶ã¨ãäººçã®ãå³æ¹ã«ãªãããã¨ãããã¸ã§ã³ã®ãã¨ãä¸­å°ä¼æ¥­ãªã¼ãã¼ã®æ³äººã»åäººè³ç£ãä¸ä½ã§ãµãã¼ããããã«ã¿ç¨çå£«æ³äººã«ã¦èªç¥åä¸ãç®çã¨ããåç»ã®ä½æåã³éä¿¡ã«æºããã¾ããã2026å¹´1æ15æ¥ï¼æ¨ï¼ããåã¨ãªã¢ã«ã¦ãã©ã³ãã£ã³ã°åç»ãéä¿¡ãã¦ããã¾ãã',
          challenge:'ãç¨çå£«ï¼äºåçã»éå»ã®æ°å­ãæ±ãä»äºãã¨ããä¸éã®åºå·ããã¤ã¡ã¼ã¸ãææ­ãããã«ã¿ã°ã«ã¼ãã®çã®å¼·ã¿ã§ããããªã¼ãã¼ã®äººçï¼ã©ã¤ãã¹ãã¼ã¸ï¼ãã®ãã®ã«æ·±ãå¯ãæ·»ãå§¿å¢ãããæ½å¨é¡§å®¢ã®è¨æ¶ã«æ®ãå½¢ã§æç¤ºããå¿è¦ãããã¾ãããæ©è½çãªèª¬æã§ã¯ãªããææã«è¨´ãããããã®äººãã¡ããã¼ããã¼ã«ããããã¨æããããã©ã³ãèªç¥ãæ±ãããã¾ããã',
          approach:'åºå ±ã»ãã¼ã±ãã£ã³ã°ã®è¦ç¹ãããè¦è´èã®ã¤ã³ãµã¤ããçªãããã©ã³ãã¸ã®å±æãçãããã®è¨­è¨ãè¡ãã¾ããã\n\nã³ã³ã»ããã®è±¡å¾´åï¼ã³ãã¥ãã±ã¼ã·ã§ã³ã³ã³ã»ããï¼ï¼\nãäººçã«ãªã¿ã¤ã¢ã¯å­å¨ããªããã¨ããåå¼·ãã¡ãã»ã¼ã¸ãæ²ããçµå¶èã®ææ¦ããèµ°ããã¨ããè¡çºã§è¡¨ç¾ãç¨çå£«ããè¡¨èå°ã®ä¸»å½¹ã§ã¯ãªããäºäººä¸èã§çæ¶¯ä¸¦èµ°ãç¶ãããã¼ããã¼ãã¨ãã¦æãããã©ã³ãã®ç«ã¡ä½ç½®ãæç¢ºåãã¾ããã\n\nã¿ã¼ã²ããã¸ã®å¿ççã¢ãã­ã¼ãï¼\nãæ°å­ã¯éå»ãè¨é²ããããã§ã¯ãªããæªæ¥ãæããã®ãã¨ãããã¬ã¼ãºãç¨ããå®ãã®ã¤ã¡ã¼ã¸ãå¼·ãå£«æ¥­ããæªæ¥ãåµãææ¦ã®å´ã«ããå­å¨ãã¸ã¨æè¯ããã¾ãããããã¯ãã²ã¹ãã®å¤¢ãæ¯ããOLCã®ãã¹ãã¼ãªã¼ããªã³ã°ãã®èãæ¹ã«ãéãããæ¬è³ªçãªã¢ãã­ã¼ãã§ãã',
          creative:'ãã¸ã¥ã¢ã«ã¨ãã¬ã¼ã·ã§ã³ã®ã·ã³ã¯ã­ï¼\nã¢ãã¯ã­ã¼ã ãåã®ã³ã³ãã©ã¹ããæ´»ãããã·ãããã£ãã¯ãªæ åè¡¨ç¾ï¼GRAPHIC / STILLï¼ã«ãéåæã®ãããã¬ã¼ã·ã§ã³ãèåãè¦è´èã®æ²¡å¥æãé«ãããã©ã³ãã«å¯¾ãããèª å®ããã¨ããã­ãã§ãã·ã§ããªãºã ãã15ã30ç§ã¨ããç­æéã§ç´æçã«ä¼ãã¾ããã\n\nãã¼ã¿ã«ãã©ã³ãã£ã³ã°ã®å±éï¼\nåç»å¶ä½ã«ã¨ã©ã¾ãããWebã»ã¹ãã¼ã«ã»ã°ã©ãã£ãã¯ã¸ã¨ä¸çè¦³ãæ¨ªå±éï¼BRANDING INTEGRATIONï¼ãããããæ¥ç¹ã§ä¸è²«ãããã©ã³ãä½é¨ï¼é­æ³ãè§£ããªãè¨­è¨ï¼ãæä¾ãããã¨ãå¾¹åºãã¾ããã',
          result:'ãçµå¶èã¨ãã¦ã®å­¤ç¬ã«å¯ãæ·»ã£ã¦ããããã¨ããå±æã®å£°ãå¾ãã¨ã¨ãã«ãæ¢å­ã®å£«æ¥­ã®æ ãè¶ããã¯ãªã¨ã¤ãã£ããªä¼æ¥­å§¿å¢ããæ°ããªå±¤ã¸ã®èªç¥æ¡å¤§ã«å¤§ããå¯ä¸ãã¾ããã<br><br><strong>éä¿¡åªä½ã»ã¨ãªã¢</strong><ul class=\"d-list\"><li><span class=\"d-label\">åç»ãã©ãããã©ã¼ã </span>YouTubeãTVer</li><li><span class=\"d-label\">Webåªä½</span>æ±æ´çµæ¸ãææ¥æ°èãã¸ã¿ã«ç­ï¼DSPéä¿¡ï¼</li><li><span class=\"d-label\">ã¢ããªãã£</span>ã¿ã¯ã·ã¼åºåï¼è¿ç¿ã»æ±æµ·ã¨ãªã¢ï¼GOã¿ã¯ã·ã¼ä¸­å¿ï¼</li><li><span class=\"d-label\">å±å¤å¤§åãã¸ã§ã³</span>é¹¿åå³¶ï¼Li-Kaãã¸ã§ã³ã»ã»ã³ãã©ã¹ãã¸ã§ã³ã»å¤©æé¤¨ãã¸ã§ã³ï¼ãæ²ç¸ï¼ããã³ãã¸ã§ã³ã»é£è¦ã¦ãã·ããã¸ã§ã³ï¼</li></ul>',
          role:'å¶ä½å¨ä½ã®åãã¾ã¨ãããã³åè³ªç¢ºèªã'
        }
      },
      {
        id:2, year:'2023â2026',
        youtubeApproach:'nGfB2WvLpgQ',
        title:'YouTubeãã£ã³ãã« ãã«ã¿ãã£ã³ãã«',
        category:'Digital / SNS',
        tags:['SNS','åç»å¶ä½','åºå ±','ãã£ã¬ã¯ã·ã§ã³','ãã¸ã¿ã«éç¨'],
        img:'img/works/work_02/work_02.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true, sliderC:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'ç¨åã»ä¼è¨ã¨ããé£è§£ãªãã¼ããèª°ããçè§£ã§ããæ åã³ã³ãã³ãã«å¤æããYouTubeã§ç¶ç¶çºä¿¡ãå°éå®¶ã®ç¥è¦ããåãèº«ããããç©æ¥µçºä¿¡ãã¸ã¨è»¢æããå¹åºãå±¤ã®ãã¡ã³ç²å¾ã«è²¢ç®ãããã­ã¸ã§ã¯ãã§ãã',
          challenge:'å°éå®¶ãæã¤ç¥è­ã®çºä¿¡ãããã¾ã§åãèº«ã«ãªããã¡ã§ãèªãæå ±ãæ¢ãã¦ããè¦è¾¼ã¿å®¢ã¨ã®æ¥ç¹ãéããã¦ãã¾ãããç¨åã»ä¼è¨ã¨ããé£è§£ãªãã¼ããèª°ããçè§£ã§ããè¨èã¨æ åã«ç½®ãæããä¼ç¤¾èªãç©æ¥µçã«æå ±ãå±ããä»çµã¿ã®æ§ç¯ãæ±ãããã¾ããã',
          approach:'è¦è´èãå®éã«æ°ã«ãªã£ã¦ãããã¼ãï¼æ³æ¹æ­£ã»ç¯ç¨ã»ä¼ç¤¾è¨­ç«ãªã©ï¼ãèµ·ç¹ã«ä¼ç»ãç«æ¡ãå°éå®¶ã®èª¬æãå³ãåãã¤ã©ã¹ãã§è£è¶³ããé£ããåå®¹ã§ãæå¾ã¾ã§é£½ããã«è¦ãããæ§æãè¿½æ±ãã¾ãããã¾ããåç»ãã¨ã®åçãã¼ã¿ãç¶ç¶çã«åæããè¦åºãç»åã®è¨´æ±åå®¹ãæå­ã®å¤§ããã»éç½®ãæ¥ãè¦ç´ããã¨ã§ãããå¤ãã®æ¹ã«åç»ãè¦ã¦ããããããæ¹åãç¶ãã¾ããã',
          creative:'å³è§£ãåãã®ããæ¼åºãéæã«çãè¾¼ããã¨ã§ãé·æéè¦è´ãã¦ãåèª¿ã«æããããªãç»é¢è¨­è¨ãå¾¹åºãã¾ãããå¹æé³ãå ´é¢ã«å¿ãã¦ä½¿ãåããèª¬æã®æµãã«èªç¶ãªãªãºã ãçã¾ããããå·¥å¤«ãã¾ãããã¾ããè¦åºãç»åï¼ãµã ãã¤ã«ï¼ã¯ãæããæ¼ããããªããä¸æãç®æããæå­ã®éç½®ã»è²ã»äººç©ã®è¡¨æã¾ã§ç´°ããèª¿æ´ãã¦ãã¾ãã',
          result:'æå½èãåã³ã³ãµã«ã¿ã³ãä»»ãã«ãªããã¡ã ã£ãæå ±çºä¿¡ããä¼ç¤¾å¨ä½ã§åãçµãä»çµã¿ã¸ã¨è»¢æãé£ããå°éç¥è­ãè¦ªãã¿ãããä½é¨ã¨ãã¦å±ãããã¨ã§ãå¹åºãå±¤ã®ãã¡ã³ç²å¾ã«è²¢ç®ãã¾ããã',
          role:'ä¼ç»ç«æ¡ãæ®å½±ãåç»ç·¨éãè¦åºãç»åå¶ä½ãè¦è´ãã¼ã¿ã®åæã¨æ¹åã¾ã§ä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:3, year:'2026',
        title:'ãã«ã¿ã®ç¸ç¶ãµã¤ã & ãã³ãã¬ããå¶ä½',
        category:'Web / Print',
        tags:['åºå ±','ã¦ã§ããã¶ã¤ã³','å°å·ç©','ãã£ã¬ã¯ã·ã§ã³'],
        img:'img/works/work_03/work_03.webp',
        imgs: { a:true },
        client:'ãã«ã¿ã°ã«ã¼ãã»å¤§æ¥æ¬å°å·æ ªå¼ä¼ç¤¾ã»ã¯ã©ã¦ããµã¼ã«ã¹æ ªå¼ä¼ç¤¾',
        d:{
          overview:'ç¸ç¶ã¨ããè¤éãªãã¼ãã«ä¸å®ãæ±ãããå®¶æã¸ãå®å¿ã§ããããä½ãããã°ãããããããã¨æãã¦ããããã¦ã§ããµã¤ãï¼ãã³ãã¬ãããå¶ä½ãå¤é¨å¶ä½ä¼ç¤¾ã¨é£æºããªããããã©ã³ãã¨ãã¦ã®çµ±ä¸æãä¿ã¤ãã­ã¸ã§ã¯ãã',
          challenge:'å¤§åãªæ¹ãäº¡ããããç´å¾ã®ãå®¶æã¯ãæ·±ãæ²ãã¿ã®ä¸­ã§è¤éãªæç¶ããå³ããæéã«è¿½ããããã¨ã«ãªãã¾ããæ¢å­ã®è³æã¯æå­éãå¤ããããã£ã¦ä¸å®ããããå¾åãããã¾ãããæã«åã£ãç¬éã«ãå®å¿ã§ããããä½ãããã°ãããããããã¨æãã¦ããããè³æãå¿è¦ã§ããã',
          approach:'ç³åæéãªã©è¦è½ã¨ããã¡ãªéè¦ãªæ¥ç¨ãã«ã¬ã³ãã¼å½¢å¼ã§è¦ããåãããèªèº«ã§è¡ãã¹ããã¨ã¨å°éå®¶ã«ä»»ããã¹ããã¨ã®åºå¥ãæç¢ºã«ãã¾ããããã³ãã¬ããã§ã¯ãèª­ã¿ãããã«å®è©ã®ããæ¸ä½ï¼UDãã©ã³ãï¼ãæ¡ç¨ããæå­ã®å¤§ãããè¡éã®ãã©ã³ã¹ãç´°ããæå®ãããã¨ã§ãé«é½¢ã®æ¹ãå«ããå¹åºãæ¹ãèª­ã¿ãããç´é¢ãè¿½æ±ãã¦ã§ããµã¤ãã«ã¤ãã¦ã¯å¤é¨ã®å¶ä½ä¼ç¤¾ã¨é£æºããªããããã³ãã¬ããã¨è²ä½¿ããé°å²æ°ããããªãããä¸å¯§ã«èª¿æ´ãããã©ã³ãã¨ãã¦ã®çµ±ä¸æãä¿ã¡ã¾ããã',
          creative:'ãç¸ç¶ã¯é£ãããã¨ããåå¥è¦³ãåãé¤ããããå¨ä½ãç·è²ãåºèª¿ã¨ããæãããå°è±¡ã§ã¾ã¨ãã¾ãããåå®¹ãè¤éã«ãªããããåãæå­ã®å¤ªãã«å¤åãã¤ãããã¨ã§æå ±ã«å¼·å¼±ãçã¿åºããèª­ã¿é²ããããèªé¢ãç®æãã¾ããããµã¤ãã¨ãã³ãã¬ãããå¥ã®ãµã¼ãã¹ã«è¦ããªããããè¡¨ç´ã®ã¤ã¡ã¼ã¸ãå¨ä½ã®é°å²æ°ãæããã©ã¡ãã«è§¦ãã¦ãåãå®å¿æãå±ããããããç´°é¨ã¾ã§ç®¡çãã¾ããã',
          result:'çªå£ã§ã®èª¬æã«ãããæéãå¤§å¹ã«åæ¸ããç¸è«ããæç´ã¾ã§ã®æµããã¹ã ã¼ãºã«ãã¾ãããã¾ãã2026å¹´2æããã®åºååºç¨¿éå§å¾ãç¾æç¹ã§5ä»¶ã®ãåãåãããç²å¾ãå¤é¨ã®å¶ä½ä¼ç¤¾ãåãã¾ã¨ããªãããèªç¤¾ãã©ã³ãã®åè³ªãæé«æ°´æºã§å®ãæãåãçºæ®ãã¾ããã',
          role:'å¶ä½å¨ä½ã®åãã¾ã¨ããå¤é¨ååä¼ç¤¾ã¸ã®æç¤ºãåè³ªã»é²è¡ã®ç®¡çã'
        }
      },
      {
        id:4, year:'2023â2026',
        title:'ãã«ã¿ç¨çå£«æ³äºº ãã¸ãã¹ã»ããã¼éå¶',
        category:'Event Management',
        tags:['ã»ããã¼','ã¤ãã³ã','ã¦ã§ããã¶ã¤ã³','ã¡ã¼ã«ãã¬ã¸ã³','å°å·ç©','è³æå¶ä½','åç','åºå ±','ãã£ã¬ã¯ã·ã§ã³'],
        img:'img/works/work_04/work_04.webp',
        client:'ãã«ã¿ã°ã«ã¼ãã»ä¹æ®µä¼é¤¨ãã©ã¹ï¼æ±äº¬ï¼ã»ããã«ã°ã©ã³ã´ã£ã¢ï¼å¤§éªï¼ã»åå¤å±ããªãªããã¢ã½ã·ã¢ããã«ã»ã¢ã¼ã¯ãã«ãºã¯ã©ãï¼å­æ¬æ¨ï¼ç­',
        imgs:{ hero2:true, a:true, a2:true, b:true, b2:true, c:true },
        d:{
          overview:'å¨å½ã®çµå¶èãå¯¾è±¡ã¨ãããã¸ãã¹ã»ããã¼ãã¼ã­ããè¨­è¨ã»éå¶ãæ±äº¬ã»å¤§éªã»åå¤å±ã»é¹¿åå³¶ã»æ²ç¸ã»è»½äºæ²¢ã»å­æ¬æ¨ãªã©å¹´éãéãã¦å¨å½åå°ã§æºå¡å¾¡ç¤¼ãéæãããã­ã¸ã§ã¯ãã',
          challenge:'å¤å¿ãªçµå¶èã«è¶³ãéãã§ããã ãã«ã¯ãæå ±ã®ä¾¡å¤ã ãã§ãªãããã®å ´ã«æ¥ãæå³ããããã¨æãã¦ããããæå¾æã®æ¼åºãä¸å¯æ¬ ã§ãããå¯¾é¢ã¨éä¿¡ãåæã«è¡ãããã¡ã¯ç¤¾åã§åä¾ããªããé²è¡ã®ä»çµã¿ãè³æã®ã²ãªå½¢ãã¼ã­ããä½ãä¸ããå¿è¦ããããé¢ä¿åæã¨ã®èª¿æ´ãç¹°ãè¿ããªãããåç¾ã§ããä½å¶ã¸ã¨æ´ãã¦ããã¾ããã',
          approach:'éå®¢ã®ããã®æ¡åè³æã»ã¡ã¼ã«ã»ãã©ã·ã¨å½æ¥ã®çºè¡¨è³æã®ãã¶ã¤ã³ãçµ±ä¸ããåå åããå½æ¥ã¾ã§ä¸è²«ããå°è±¡ãå±ãããã¨ã§éå®¢ã¨èªç¥ãæå¤§åãå½æ¥ã¯ç§åä½ã®é²è¡è¡¨ãä½æããä¼å ´è¨­å¶ã»éä¿¡ä¼ç¤¾ã¨ã®èª¿æ´ã»ã«ã¡ã©æ®å½±ã»é£äºã®æéã»ã¢ã³ã±ã¼ãç®¡çã¾ã§ããã¹ã¦ã®æ¥­åãç·åçã«åãã¾ã¨ãã¾ããã',
          creative:'ç¨åã»å´åã¨ããç®ã«è¦ããªããµã¼ãã¹ãæ±ããããéèæ©é¢ãä¿¡é ¼æãé£æ³ãããèæ¯ç»åãåãå¥ããªãããæå­ãå¤§ããä½¿ã£ãåå¼·ããã¶ã¤ã³ã§è¡¨ç¾ãã¾ãããå¹´ã«è¤æ°åéå¬ãããããæ¯åä¼¼ãå°è±¡ã«ãªããªãããå¤åãã¤ããªããããéåæã¨ä¿¡é ¼æã¯ä¸è²«ãã¦å®ãããä¸å¯§ã«èª¿æ´ãåå èã«ãå¤§åã«ããã¦ãããã¨æãã¦ãããããããç´°ããªå¿éããéæã«çãè¾¼ã¿ã¾ããã',
          result:'æ±äº¬ã»å¤§éªã»åå¤å±ã»é¹¿åå³¶ã»æ²ç¸ã»è»½äºæ²¢ã»å­æ¬æ¨ãªã©å¨å½åå°ã§æºå¡å¾¡ç¤¼ãéæããå¤ãã®æ°è¦è¦è¾¼ã¿å®¢ãç²å¾ã\\n\\nãã»ããã¼éå¶ã®å®ç¸¾ã\\n2023ã2025å¹´ æ±äº¬ï¼å300åç¨åº¦ï¼ã»å¤§éªï¼å300åç¨åº¦ï¼\\n2024ã2025å¹´ åå¤å±ï¼å80åç¨åº¦ï¼\\n2024å¹´ ãã«ã¿ã°ã«ã¼ãåµç«30å¨å¹´ãã¼ãã£ï¼700åç¨åº¦ï¼\\n2025å¹´ é¹¿åå³¶ï¼100åï¼ã»å­æ¬æ¨ï¼90åï¼ã»æ²ç¸ï¼100åï¼ã»è»½äºæ²¢ï¼50åï¼',
          role:'ç·åéå¶è²¬ä»»èãè³æã»æ¡åç©ã®å¶ä½ãéä¿¡ä¼ç¤¾ã»ä¼å ´ã»é£äºã®æéãå½æ¥ã®é²è¡ææ®ãã«ã¡ã©æ®å½±ãã¢ã³ã±ã¼ãç®¡çã¾ã§ä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:5, year:'2025', layout:'wide',
        title:'ç¤¾åãã¼ã¿ã«ãµã¤ã ä¼ç»æ¡',
        category:'Inner Branding / Web',
        tags:['ã¦ã§ããã¶ã¤ã³','è³æå¶ä½'],
        img:'img/works/work_05/work_05.webp',
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        imgs:{ hero2:false, a:true, a2:true, b:true, b2:true, c:true },
        d:{
          overview:'æ ç¹å¢å ã«ä¼´ãæå ±åæ­ã»å¸°å±æã®å¸èåã¨ããçµç¹èª²é¡ãè§£æ±ºãããããç¤¾åãã¼ã¿ã«ãµã¤ãã®æ§æ³ãç­æã»ä¸­æã»é·æã®3æ®µéã§è¨­è¨ãææ¡ãããã­ã¸ã§ã¯ãã',
          challenge:'æ ç¹ã®å¢å ã«ä¼´ãããå¿è¦ãªæå ±ãã©ãã«ãããããããªãããæå ±ãå¤ãã¾ã¾æ´æ°ããã¦ããªãããæå½èãéè·ããã¨æå ±ãæ¶ãã¦ãã¾ããã¨ãã£ãåé¡ãåæã§èµ·ãã¦ãã¾ãããæå ±ãæ¢ããã¨ã«æéãåããããã¨ã§æ¥­åå¹çãä¸ãããç¤¾å¡ãä¼ç¤¾ã¸ã®é¢ããã«ææ¬²ãæãã«ãããªãã¨ããæªå¾ªç°ãçã¾ãã¦ãã¾ãããã¾ããM&Aã«ãã£ã¦æ ç¹ãã¨ã«æåãäººãç°ãªãä¸­ãé¢ããæ ç¹åå£«ã®ã¤ãªãããä¸ä½æã®é¸æãæ¥åã§ããã',
          approach:'èª²é¡ããç­æã»ä¸­æã»é·æãã®3æ®µéã«æ´çããæ®µéãè¿½ã£ã¦å®ç¾ã§ããè¨ç»ã¨ãã¦ç¤¾åã«ææ¡ãã¾ãããã¾ãç­æã§ã¯ç¤¾åæå ±ã®æ´çã¨ãæ¢ããããå°ç·ã®è¨­è¨ã«çæãä¸­æã§ã¯ç¤¾åã®æ´»åãçºä¿¡ã§ããå ´ã®æ´åã¨ãç¤¾å¡ãèªä¸»çã«åããä»çµã¿ä½ãã¸ã¨çºå±ãããé·æã§ã¯æ ç¹ãè¶ããäº¤æµã®å ´ã¨ãç¤¾å¡ä¸äººã²ã¨ãã®å¾æåéãç¥è¦ãå¨ç¤¾ã§å±æã§ããä½å¶ã®æ§ç¯ãç®æãã¾ããã',
          creative:'äºåçãªæå ±ã®æ´çã«ã¨ã©ã¾ããããäººã«ãã©ã¼ã«ã¹ããæå ±ããå±ãããã¨ãæè­ãã¾ãããã©ã®æ ç¹ã®ç¤¾å¡ãã©ããªå¾æåéãæã£ã¦ããããç¥ã£ã¦ããããã¨ã§ãæ ç¹ãè¶ãã¦ç¸è«ãããããªããä¼ç¤¾å¨ä½ã®åãé«ã¾ãã¨èãã¾ãããã¾ããæå ±ãè¦ãå ´ã¨ãã¦ã ãã§ãªããç¤¾å¡èªèº«ãå­¦ã¹ãåç»ãåå¼·ä¼ã®è¨é²ãªã©ãåå®ããããã¨ã§ãæ¥å¸¸çã«ä½¿ããããªããµã¤ããç®æãã¾ããã',
          result:'åãåããå¯¾å¿ã®åæ¸ã¨ãçµç¹ã¨ãã¦ã®ä¸ä½æã®é¸æã«å¯ä¸ãç¤¾å¡ä¸äººã²ã¨ãã®ä»äºã¸ã®ææ¬²ãé«ãããã¨ãããå®¢æ§ã¸ã®å¯¾å¿åè³ªã®åä¸ã¸ã¨ã¤ãªããã¨ããèãã®ãã¨ãç¤¾åããã®å¤é©ãæ¨é²ãã¾ããã',
          role:'èª²é¡ã®åæã»æ´çããæ¹åè¨ç»ã®ç­å®ãç¤¾åã¸ã®ææ¡ã¾ã§ä¸è²«ãã¦æå½ããµã¤ãã®ä½¿ããããã®æ¹åããã³ç¤¾ååãçºä¿¡ã®ä¼ç»ç«æ¡ã'
        }
      },
      {
        id:6, year:'2025',
        title:'ãªããã¦ã¢ã¼ãããã¯ï¼ããã¡ããªã¨ã³ãã¼ã¬ ãã¼ããã¼ã·ããï¼',
        category:'Event / Community Art',
        tags:['SNS','ã¤ãã³ã','è³æå¶ä½','åºå ±','åç»å¶ä½','ãã£ã¬ã¯ã·ã§ã³','ãã©ã¤ãã¼ã','ãã¸ã¿ã«éç¨'],
        img:'img/works/work_06/work_06.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ããã¡ããªã¨ã³ãã¼ã¬ã»ãªããã¦ã¢ã¼ããã§ã¹ãã£ãã«å®è¡å§å¡ã»åå¤å±è¸è¡å¤§å­¦ã»æ¥æ±å·¥æ¥­æ ªå¼ä¼ç¤¾',
        d:{
          overview:'å°åæ´»æ§åã¨ã¢ã¼ãã£ã¹ãæ¯æ´ãç®çã«ãå¤§å­¦ã»èªæ²»ä½ã»ã¤ãã³ãäºåå±ãªã©å¤æ§ãªé¢ä¿èãå·»ãè¾¼ã¿ãªããå¬å±ã®å ´ã«è³ãããçã¿åºãããã­ã¸ã§ã¯ããç®æ¨ãä¸åãåå¡ãéæããã¼ã­ããä¼ç»ãç«ã¡ä¸ãã¦å®å¨ãã¤åæ»ãªéå¶ãå®ç¾ãã¾ããã',
          challenge:'å°åæ´»æ§åã¨ã¢ã¼ãã£ã¹ãæ¯æ´ãç®çã«ãå¤§å­¦ã»èªæ²»ä½ã»ã¤ãã³ãäºåå±ãªã©å¤æ§ãªé¢ä¿èãå·»ãè¾¼ã¿ãªãããå¬å±ã®å ´ã«è³ãããçã¿åºãå¿è¦ãããã¾ãããæç¥ããªã¨ã³ãã¼ã¬ã®ãã¼ããã¼ã¨ãã¦åå ããã«ããããä¸å®ã®åè³ªæ°´æºãæºãããã¨ãæ±ãããã¦ãããåºå±èã»æ¥å ´èã»éå¶é¢ä¿èããããã«åããä¸å¯§ãªå¯¾å¿ã¨ãå®å¨ãã¤å¬æ­£ãªéå¶ä½å¶ã®æ§ç¯ãä¸å¯æ¬ ã§ããã',
          approach:'å¶ä½éç¨ãã¤ã³ã¹ã¿ã°ã©ã ã§çºä¿¡ãããè¦ããªããåºãããææ³ã§èªç¥ã¨å¿åãåæã«æ¡å¤§ãåºå±èãå®å¿ãã¦åå ã§ãããããæ¬å¥ã»æ¬åºã®æ¡åãèä½æ¨©ã«é¢ããè¦ç´ãªã©ãå¿è¦ãªæå ±ãæ´çãã¦ããããããå±ãã¾ãããã¾ããæ¥å ´èãèªç¶ã¨åçãæ®ã£ã¦çºä¿¡ããããªãç©ºéã¥ããããæç¨¿ãã¦ãããæ¹ã¸ã®ãã¬ã¼ã³ãä¼ç»ãªã©ãå£ã³ããåºããä»æããçãè¾¼ã¿ã¾ãããã¤ã³ã¹ã¿ã°ã©ã ã§ã¯åçã ãã§ãªãåç»ãå¶ä½ã»æç¨¿ããè¦ªãã¿ãããã¨ä¸çè¦³ã®ä¼éãä¸¡ç«ãã¾ããã',
          creative:'æç¥ããªã¨ã³ãã¼ã¬ã®ã¢ã¼ãæ§ã®é«ãã«åããã¤ã¤ãå¹åºãäººã«è¦ªããã§ãããããããããã¦è¦ªãã¿ãããããããªã­ã£ã©ã¯ã¿ã¼ãå¶ä½ãç®ãå¼ãæãããªã¬ã³ã¸è²ãæ¡ç¨ããåç»ã§ã¯ã­ã£ã©ã¯ã¿ã¼ãå¤§ããåããå¹æé³ãã¤ãããã¨ã§ãåãã¦è¦ãæ¹ã«ãæ°è»½ã«æã«åã£ã¦ããããããé°å²æ°ãæ¼åºãã¾ãããä¸åéãã®ã¤ãã³ãã§ã¯ãªãç¶ç¶çãªæ´»åãè¦æ®ããä»åã®éå¶ãã¼ã¿ãåå¿ãè¨é²ã»èç©ãããã¨ã§ãæ¬¡åä»¥éã«æ´»ãããåºç¤ä½ããæè­ãã¾ããã',
          result:'ç®æ¨ãä¸åãåå¡ãéæããå°åã®ã¢ã¼ãã¤ãã³ãã¨ãã¦ã®åºç¤æ§ç¯ã«æåãè¦ç´ã»æ¡åã®æ´åããä¼å ´è¨­å¶ã¾ã§ä¸è²«ãã¦åãã¾ã¨ããã¼ã­ããä¼ç»ãç«ã¡ä¸ãã¦å®å¨ãã¤åæ»ãªéå¶ãå®ç¾ãã¾ããã',
          role:'ä¼ç»ã»å®è¡è²¬ä»»èãSNSéç¨ãåºå±èé¸èããä¼å ´è¨­å¶ã¾ã§ã®éå¶ææ®ã'
        }
      },
      {
        id:7, year:'2024',
        title:'ãã«ã¿ã°ã«ã¼ã åµæ¥­30å¨å¹´å¼å¸',
        category:'Event Management',
        tags:['ã¤ãã³ã','è³æå¶ä½','ãã£ã¬ã¯ã·ã§ã³','åç»å¶ä½'],
        img:'img/works/work_07/work_07.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'å¨å½ã«åæ£ããå¾æ¥­å¡ã»å®¶æç´700åãåå ããåµæ¥­30å¨å¹´å¼å¸ããã¼ã­ããä¼ç»ã»è¨­è¨ã»éå¶ãååä½ã®é²è¡è¨­è¨ãæå½±è³æã»æ åã»BGMå¶ä½ãä¼å ´ã¨ã®èª¿æ´å¨è¬ãæå½ããç¡äºå®éãããã­ã¸ã§ã¯ãã',
          challenge:'å¨å½ã«å¾æ¥­å¡ãåæ£ããä¸­ãåµç«30å¨å¹´ã¨ããç¯ç®ã«ãä¼ç¤¾ã¸ã®æè¬ããå½¢ã«ããå¨å¡ãåãåã³ãå±æã§ããå ´ãä½ããã¨ãæ±ãããã¾ãããå®¶æãå«ããé¢ä¿èå¨å¡ã«ä¼ç¤¾ã®æ­©ã¿ã¨æ¬æãå±ããã¨ã¨ãã«ãæ®æ®µã¯é¢ãã¦ããæ ç¹åå£«ãä¸ä½æãæããããæ¼åºãå¿è¦ã§ããã',
          approach:'ä»£è¡¨ã®æ³ããç©èªã¨ãã¦å±ããã¹ã©ã¤ããä½æããåæ ç¹ã®ç¤¾å¡ãä¸»å½¹ã¨ãã¦ç»å ´ã§ããçºè¡¨ã®å ´ãè¨­ãã¾ãããã¿ã¤ã ãã¼ãã«ãååä½ã§è¨­è¨ããéä¼ããè¨å¿µæ®å½±ã»éå ´ã¾ã§ç´4æéã®é²è¡ãç´°é¨ã¾ã§çµã¿ç«ã¦ã¾ãããä¼å ´ã¨ãªã£ããªã¼ã¬ã­ã¤ã¤ã«ããã«ã®ç§æã»é³é¿æå½ã»å¸ä¼èãªã©ãã¾ãã¾ãªã¹ã¿ããã¨ç¶¿å¯ã«æã¡åãããéã­ãæå½±è³æãé²è¡ã®å¤åã«åããã¦ãã®é½åº¦ä½ãæ¿ãããªã©ãç¾å ´ã®ç¶æ³ã«æè»ã«å¯¾å¿ãç¶ãã¾ãããBGMãå ´é¢ãã¨ã«ç·¨éããä¼å ´å¨ä½ã®é°å²æ°ãèªç¶ã«çãä¸ããããé³ã®æµãã«ã¾ã§ãã ããã¾ããã',
          creative:'ä¼å ´ã«å¥ã£ãç¬éããéå ´ã¾ã§ãè¦è¦ã«æ ããã¹ã¦ã®æå ±ï¼ã¹ã©ã¤ãã»ãµã¤ã³ã»æ åï¼ãä¸è²«ãããã¶ã¤ã³ã§çµ±ä¸ãã30å¹´ã®æ­´å²ã«æ¥ããªãéåæã¨èªããæ¼åºãã¾ãããåæ ç¹ããã®ã¯ã¤ãºãåç£åæ½é¸ãåæ¬èæ¥­ã¨ã®ã³ã©ãä¼ç»ãªã©ãåå èããè¦ãå´ãã ãã§ãªããåå ããå´ãã«ãªããå ´é¢ãéæã«çãè¾¼ã¿ãç´700åãä¸ã¤ã®ç©ºéã§æ¥½ãããä½é¨ãè¨­è¨ãã¾ããã',
          result:'ç´700åãåå ããå¤§è¦æ¨¡ãªãã¼ãã£ããé²è¡ã®ä¹±ããªãç¡äºå®éãå¾æ¥­å¡ã®ä¼ç¤¾ã¸ã®å¸°å±æè­ãå¤§ããé«ããçµç¹ã¨ãã¦ã®ä¸ä½æã®é¸æã«è²¢ç®ãã¾ãããå¤§è¦æ¨¡ãªçµç¹ãåããæç±ã¨ãç´°é¨ã¾ã§è¡ãå±ããç·»å¯ãªè¨­è¨ã»å¿éãã®ä¸¡ç«ãä½ç¾ããåãçµã¿ã§ãã',
          role:'ç·åé²è¡ç®¡çãååä½ã®é²è¡è¨­è¨ãæå½±è³æã»æ åã»BGMã®å¶ä½ã¨ç·¨éãä¼å ´åæå½èã¨ã®èª¿æ´å¨è¬ãæå½ã'
        }
      },
      {
        id:8, year:'2025',
        title:'ã²ã®ã¦ãè¨ªåçè­·ã¹ãã¼ã·ã§ã³ ä¼ç¤¾æ¡åãã³ãã¬ãã',
        category:'Print / Branding',
        tags:['è³æå¶ä½','åç','å°å·ç©','ãã£ã¬ã¯ã·ã§ã³','ãã©ã³ãã£ã³ã°'],
        img:'img/works/work_08/work_08.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'æ ªå¼ä¼ç¤¾è¼ªå¥',
        d:{
          overview:'è¨ªåçè­·ã¨ããé¦´æã¿ã®èãä»çµã¿ã¸ã®ä¸å®ãè§£æ¶ãããã²ã®ã¦ããã®å¼·ã¿ãå°åã«ä¼ãããã³ãã¬ãããå¶ä½ãèªãç¾å ´ã«è¶³ãéãã§æ®å½±ãè¡ããæ¸©ãã¿ã®ããå®éã®ç¾å ´ã®è¡¨æãèªé¢ã«çãè¾¼ãã ãã­ã¸ã§ã¯ãã',
          challenge:'è¨ªåçè­·ã¨ãããå¤ãã®æ¹ã«ã¨ã£ã¦ãªãã¿ã®èãä»çµã¿ã¸ã®ä¸å®ãè§£æ¶ãããã²ã®ã¦ããã®å¼·ã¿ã§ãããå¿ã®ã±ã¢ã¾ã§å¯ãæ·»ãå§¿å¢ããå°åã«ä¼ããå¿è¦ãããã¾ãããå©ç¨èã ãã§ãªããã®å®¶æãå«ããä¸å®ãæ©ã¿ã«å¿ããåå®¹ãå±ããªãããæã«åã£ãç¬éã«å®å¿æãæãã¦ããããè³æã¥ãããæ±ãããã¾ããã',
          approach:'èªãç¾å ´ã«è¶³ãéãã§åçæ®å½±ãè¡ããæ¸©ãã¿ã®ããå®éã®ç¾å ´ã®è¡¨æãèªé¢ã«çãè¾¼ã¿ã¾ããããå©ç¨èã®æ©ã¿ãã¨ãå®¶æã®æ©ã¿ããããããä¸å¯§ã«æ´çãã¦æ²è¼ãããã¨ã§ãã©ã¡ãã®ç«å ´ã®æ¹ãæã«åã£ã¦ããèªåãã¨ãã¨ãã¦èª­ã¿é²ããããæ§æãè¨­è¨ããµã¼ãã¹ã®æµããå°éã¹ã¿ããã®é£æºå³ãå¤§ããæãèµ·ãããè¤éãªä»çµã¿ãã²ã¨ç®ã§çè§£ã§ããããè¦è¦çã«æ´çãã¾ããã',
          creative:'ä¼ç¤¾ã®ã¤ã¡ã¼ã¸ã«ã©ã¼ã§ãããªã¬ã³ã¸è²ãåºèª¿ã«ãæ¸©ããè¿ã¥ããããå°è±¡ãå¨ä½ã«çµ±ä¸ãã¾ãããåå®¹ãå°éçã«ãªããã¡ãªåãåçãã¤ã©ã¹ããå¤ç¨ããªããå³ãå¤§ããæ²è¼ãããã¨ã§ãçé¢ãå°éå®¶ã¨ã®é£æºä½å¶ããè¦ãã ãã§ããããèªé¢ãç®æãã¾ãããä¼æ¥­çå¿µããä»£è¡¨æ¨æ¶ã®æç« ã¾ã§ãä¼ç¤¾ã®æ³ããè¨èã¨ãã¦ä¸å¯§ã«æ´çã»å·ç­ããåãªãèª¬æè³æã§ã¯ãªããä¿¡é ¼ã¨æ¸©ãããåæã«ä¼ããããä¸åã«ä»ä¸ãã¾ããã',
          result:'çªå£ã§ã®èª¬æã«ãããæéãå¤§ããåæ¸ããç¸è«ããå©ç¨éå§ã¾ã§ã®æµããã¹ã ã¼ãºã«ãç¾å ´ã®ç±éããã®ã¾ã¾åãåããè¤éãªæå ±ãæ¸©ããªä½é¨ã¸ã¨å¤ããå¶ä½åãçºæ®ãã¾ããã',
          role:'ä¼ç»ã»æ®å½±ã»ä½å³ã»ãã¶ã¤ã³ã»å·ç­ã¾ã§ä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:9, year:'2024',
        title:'ãã³ã¬ã§ã«ã³ã¿ã³ï¼ç¸ç¶ã¯7æ¥éã§ãããã¾ãã',
        category:'Publishing / PR',
        tags:['åºå ±','ãã£ã¬ã¯ã·ã§ã³','å°å·ç©','ãã©ã³ãã£ã³ã°'],
        img:'img/works/work_09/work_09.webp',
        imgs: { a:true },
        client:'ãã«ã¿ç¨çå£«æ³äººã»æ ªå¼ä¼ç¤¾å­¦ç ãã¼ã«ãã£ã³ã°ã¹',
        d:{
          overview:'ç¸ç¶ã¨ãããã¼ããã7æ¥éã®è¬ç¾©å½¢å¼ã®æ¼«ç»æ¬ãã«è½ã¨ãè¾¼ã¿ãå­¦ç ããå¨å½åºçã»è²©å£²ãå®ç¾ãè¤éãªå°éç¥è­ãè¦ªãã¿ãããå½¢ã§å±ãããã«ã¿ã°ã«ã¼ãã®ãã©ã³ãä¿¡é ¼æ§åä¸ã«å¤§ããè²¢ç®ãããã­ã¸ã§ã¯ãã',
          challenge:'ç¸ç¶ã¯èª°ãããã¤ãç´é¢ãããã¼ãã§ãããªããããé£ãããããèªåã«ã¯é¢ä¿ãªããã¨å¾åãã«ãããã¡ãªåéã§ããç¨çå£«ãæ¸ãå°éæ¸ã§ã¯æã«åã£ã¦ãããã«ãããé£ããåå®¹ãããã«èº«è¿ã«æãã¦ãããããæå¤§ã®èª²é¡ã§ãããã¾ããå¤§æåºçç¤¾ã¨ã®å±åå¶ä½ã¨ããæ§è³ªä¸ãåè³ªã»ã¹ã±ã¸ã¥ã¼ã«ã»é¢ä¿èéã®èª¿æ´ãé«ãæ°´æºã§ãããããã¨ãæ±ãããã¾ããã',
          approach:'ç¸ç¶ãã7æ¥éã®è¬ç¾©å½¢å¼ãã«æ§æãç´ããã¨ã§ãèª­èãç¡çãªãæ®µéçã«çè§£ã§ããæµããè¨­è¨ãã¾ãããæ¼«ç»ã¨ããè¡¨ç¾å½¢å¼ãé¸ãã ãã¨ã§ãå ããªããã¡ãªãã¼ãã«è¦ªãã¿ããããå ããæã«åããã£ãããä½ããã¨ã«æåãæ¼«ç»å®¶ã®é¸å®ã»çµµæã®ã¤ã¡ã¼ã¸åããã«ãé¢ä¸ããè¦ªãã¿ããããã¤æå ±éãæãªããªãè¡¨ç¾ãè¿½æ±ãã¾ãããå­¦ç ã¨ã®æã¡åããã»ã¹ã±ã¸ã¥ã¼ã«ç®¡çã»åç¨¿ç¢ºèªãªã©ãåºçã«åããä¸é£ã®é²è¡ãç¤¾åå´ã§ã¨ãã¾ã¨ãã¾ããã',
          creative:'ç»å ´ã­ã£ã©ã¯ã¿ã¼ã«ãé¢åããããã®ãã³ã¬å®¶ããããèç¨çå£«ããå¥½å¥å¿æºçãªç·¨éèããè¨­å®ããèª­èãèªåãéã­ãããç­èº«å¤§ã®äººç©ãå­¦ãã§ããæ§æã«ãã ããã¾ãããç¸ç¶æç¶ããããããå½¢å¼ã§å³è§£ãããªã©ãæå ±ãèª­ã¾ããã®ã§ã¯ãªããè¦ã¦ããããå½¢ã«æ´çãããã¨ã§ãå°éç¥è­ã®ãªãèª­èã§ãè¿·ããèª­ã¿é²ããããããå·¥å¤«ãã¾ããã',
          result:'å­¦ç ããæ¸ç±ã¨ãã¦å¨å½åºçã»è²©å£²ãå®ç¾ãè¤éãªå°éç¥è­ãã7æ¥éã§èª­ããæ¼«ç»æ¬ãã¨ããå½¢ã«è½ã¨ãè¾¼ã¿ããã«ã¿ã°ã«ã¼ãã®ç¥è¦ãåºãä¸è¬ã®æ¹ã¸å±ããåªä½ã¨ãã¦æ©è½ãã¦ãã¾ãããã©ã³ãã®ä¿¡é ¼æ§åä¸ã«ãå¤§ããè²¢ç®ãã¾ããã',
          role:'åºçãã­ã¸ã§ã¯ãã®ç¤¾åãã£ã¬ã¯ã¿ã¼ãåå®¹ã®æ´çã»æ§ææ¡ã¸ã®é¢ä¸ãçµµæèª¿æ´ãå­¦ç ã¨ã®é²è¡ç®¡çã»æ¥ç¨èª¿æ´ã»æã¡åããå¯¾å¿ãä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:10, year:'2023â2026',
        title:'æ¡ç¨ãã©ã³ãã£ã³ã° åºç¤æ§ç¯ã¨æ®å½±',
        category:'Recruiting / PR',
        tags:['æ¡ç¨','è³æå¶ä½','åç','åºå ±','ãã£ã¬ã¯ã·ã§ã³'],
        img:'img/works/work_10/work_10.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'ç¨åä¼è¨ã»çµå¶ã³ã³ãµã«ãã£ã³ã°é åã«ãããæ¡ç¨ç«¶äºã«åã¤ãããããã«ã¿ã§åãã¨ã¯ã©ããããã¨ãããæ±è·èã«å·ä½çã»é­åçã«ä¼ããæ¡ç¨ãã©ã³ãã£ã³ã°ãã¼ã­ããæ§ç¯ãåçæ®å½±ã»ããã¼å¶ä½ã»è³æä½æã¾ã§ä¸è²«ãã¦æå½ãããã­ã¸ã§ã¯ãã',
          challenge:'ç¨åä¼è¨ã»çµå¶ã³ã³ãµã«ãã£ã³ã°é åã«ãããæ¡ç¨ç«¶äºã¯æ¿ãããããã«ã¿ã§åãã¨ã¯ã©ããããã¨ãããæ±è·èã«å·ä½çãã¤é­åçã«ä¼ãããã¨ãæ±ãããã¾ãããå¤é¨ã®æ¡ç¨æ¯æ´ä¼ç¤¾ï¼Huproï¼ã¨ã®ã³ã©ãä¼ç»ãå«ããå¯¾å¤åãã«çºä¿¡ãããã¸ã¥ã¢ã«ã®è³ªãå¿åæ°ã¨ä¼ç¤¾ã®å°è±¡ãç´æ¥å·¦å³ãããããç´ æã®åè³ªã«å¦¥åã§ããªãç¶æ³ã§ããã',
          approach:'ãçµå¶èã®æææ±ºå®ãæ¯ããä»äºãã¨ããä»äºã®æ¬è³ªçãªé­åãä¸è¨ã§è¡¨ãã³ã³ã»ãããè¨­å®ãããããè»¸ã«è³æã»ããã¼ã®åå®¹ãæ´çãã¾ãããåçæ®å½±ã¯å®éã®ç¤¾å¡ãè¢«åä½ã¨ãã¦è¡ãããªã¢ã«ãªåãå§¿ãç´ æã¨ãã¦ç¢ºä¿ããªã³ã©ã¤ã³ã»ããã¼ã®éå®¢ç¨ããã¼ã§ã¯ãã¿ã¤ãã°ã©ãã£ã«å¼·å¼±ãã¤ããæææ±ºå®ãã¨ããè¨èãè¦è¦çã«éç«ããããã¨ã§ãä¸ç®ã§åå®¹ãä¼ãããã¶ã¤ã³ã«ä»ä¸ãã¾ããã',
          creative:'æªçµé¨èæ¡ç¨ãä¸»è»¸ã¨ãããããè¦ªãã¿ããããæãããã¨ãæ¸æ½æããéè¦ãã¦æ®å½±ãéææãæè­ããã¬ã¿ãããæ½ããè³æãã¶ã¤ã³ã§ã¯ã³ã¼ãã¬ã¼ãã«ã©ã¼ã®é»ãåºèª¿ã«ãèµ¤ãå·®ãè²ã¨ãã¦æ´»ç¨ãã¾ãããåå®¹ã®é£ãããã«ãã¼ãããããã¤ã©ã¹ããã¢ãã¡ã¼ã·ã§ã³ãç©æ¥µçã«åãå¥ããç¡¬ãå°è±¡ãææ­ããå·¥å¤«ãåããã¾ãããæå½èæ§ããã¯ãè¥å¹´å±¤ã®æ¡ç¨çãä¸ãã£ããã¨ã®å¬ãããå£°ãããã ãã¦ãã¾ãã',
          result:'æ¡ç¨ã»ããã¼ã¸ã®åå ç³ãè¾¼ã¿ç²å¾ã«è²¢ç®ããå¤é¨é£æºãå«ããæ¡ç¨åºå ±ã®åºç¤ãæ´åãæ¡ç¨æ´»åã«ä½¿ããåçç´ æãåè£½ã§ç¢ºä¿ãããã¨ã§ãä»å¾ã®åºåã»è³æå¶ä½ã®ã³ã¹ãã¨å·¥æ°ã®åæ¸ã«ãå¯ä¸ãã¾ããã',
          role:'æ¡ç¨åºå ±ã®ä¼ç»ã»å¶ä½å¨è¬ãåçæ®å½±ã»é¸å®ãã»ããã¼éå®¢ç¨ããã¼å¶ä½ãæ¡ç¨é¢é£è³æã®ä½æãæå½ã'
        }
      },
      {
        id:11, year:'2019',
        title:'æèã¢ã­ãã¹ãã¬ã¼ ã©ã³ãã£ã³ã°ãã¼ã¸',
        category:'Web Design / EC',
        tags:['ã¦ã§ããã¶ã¤ã³'],
        img:'img/works/work_11/work_11.webp',
        imgs: { a:true },
        client:'æ ªå¼ä¼ç¤¾ã¢ã­ãã¯ãªã¨ã¤ã',
        d:{
          overview:'ã³ã­ãç¦ã«ãããã¹ã¯çç¨ãæ¥å¸¸åããä¸­ãããã¹ã¯ã«å¹ããããã¢ã­ãã¹ãã¬ã¼ãã¨ããæ°ããçæ´»ç¿æ£ãææ¡ããååã®LPå¶ä½ãããããèªåã®çæ´»ã«å¿è¦ã ãã¨æããããä¸çè¦³ãè¦è¦ã§è¨­è¨ãã¾ããã',
          challenge:'ã³ã­ãç¦ã«ããããã¹ã¯çç¨ãæ¥å¸¸åããä¸­ãããã¹ã¯ã«å¹ããããã¢ã­ãã¹ãã¬ã¼ãã¨ããæ°ããçæ´»ç¿æ£ãææ¡ããååã®ãããã¾ããããããä½¿ãæ¹ãããã®ããã¨ããæ°ã¥ããä¸ããªããè³¼è²·ææ¬²ã«ã¤ãªããå¿è¦ãããã¾ãããååã®è¯ããä¼ããã ãã§ãªããããããèªåã®çæ´»ã«å¿è¦ã ãã¨æããããä¸çè¦³ã®è¨­è¨ãæ±ãããã¾ããã',
          approach:'ãã¼ã¸å¨ä½ãéãã¦ãé¦ããæ¤ç©ã®æ¸æ¶¼æãè¦è¦ã§ä½é¨ã§ããããè¨­è¨ãã¾ãããç½ã»èç·ã»æ°´è²ãåºèª¿ã¨ããç½ãããªéè²ã¨ããã¼ããç²¾æ²¹ã»ã¬ã©ã¹ç¶ãªã©ã®åçãå¤§ããéç½®ãããã¨ã§ãç»é¢ãè¦ãç¬éã«ãå¿å°ããããä¼ããèªé¢ãæ§ç¯ãä½¿ç¨ãã¦ããç´ æï¼ã©ãã³ãã¼ã»ã¬ã¢ã³ã»ã¦ã¼ã«ãªãªã©ï¼ãã²ã¨ã¤ãã¤ä¸å¯§ã«ç´¹ä»ããæ§æã«ããæåã¸ã®å®å¿æã¨ç´å¾æãåæã«é¸æãã¾ããã',
          creative:'è³¼å¥ãããããäººã®ããªãå¿è¦ãªã®ï¼ãã¨ããçåã«ååããã¦ç­ããæµããæè­ããããããªãæ©ã¿ããã¾ãããï¼ãããå§ã¾ãååèª¬æã»æåç´¹ä»ã»ä½¿ãæ¹ã»è³¼å¥ã¸ã¨èªç¶ã«èªå°ããæ§æãè¨­è¨ãã¾ããããã­ã¹ãã¯æå°éã«æããåçã¨ã¬ã¤ã¢ã¦ãã®åã§èª­ã¾ãã¨ãä¼ãããã¼ã¸ãç®æãã¾ãããå¨ä½ã®ãã¼ã³ãçµ±ä¸ãããã¨ã§ããã©ã³ãã¨ãã¦ã®ä¿¡é ¼æã¨ä¸åããåæã«è¡¨ç¾ãã¦ãã¾ãã',
          result:'ååã®ä¸çè¦³ãä¸æã®ãã¼ã¸ã«åç¸®ããæ°è¦é¡§å®¢ã¸ã®èªç¥ã¨è³¼è²·ã«ã¤ãªããå°ç·ãæ§ç¯ããã¼ã¸çµç±ã§ã®åãåããã»è³¼å¥ç²å¾ã«è²¢ç®ãã¾ããã',
          role:'ã©ã³ãã£ã³ã°ãã¼ã¸ã®ãã¶ã¤ã³å¨è¬ãæ§æè¨­è¨ãã¬ã¤ã¢ã¦ããéè²ãç´ æé¸å®ã¾ã§ä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:12, year:'2023â2026',
        title:'ãã£ã¹ãã¬ã¤åºå ãã¸ã¿ã«åºåã®å¶ä½ã¨æ¹åéç¨',
        category:'Digital Advertising',
        tags:['ãã£ã¹ãã¬ã¤åºå','ãã¸ã¿ã«éç¨'],
        img:'img/works/work_12/work_12.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'ã¿ã¼ã²ãããã¨ã®ç°ãªããã¼ãºã«å¯¾ããæé©ãªè¨´æ±ã¨ãã¶ã¤ã³ãä½¿ãåããåãåããç²å¾å¹çï¼æç´çï¼ãæå¤§åãAIçæç»åã®æ´»ç¨ã¨æ¥ãã®ABãã¹ãã«ãããã¶ã¤ã³ãç¶ç¶æ¹åãç¶ãããã¸ã¿ã«åºåéç¨ãã­ã¸ã§ã¯ãã',
          challenge:'ã¿ã¼ã²ãããã¨ã®ç°ãªããã¼ãºã«å¯¾ããæé©ãªè¨´æ±ã¨ãã¶ã¤ã³ãä½¿ãåããåãåããç²å¾å¹çï¼æç´çï¼ãæå¤§åããããã¨ãèª²é¡ã§ãããè¨­ç«æã®èµ·æ¥­å®¶ã¨æ¢å­ä¸­å°ä¼æ¥­ã§ã¯é¢å¿è»¸ãç°ãªããããããã«åºãããã¸ã¥ã¢ã«ã¨è¨èãå¸¸ã«æ¢ãç¶ããå¿è¦ãããã¾ããã',
          approach:'AIçæç»åãã¬ã¿ããããã¿ã¼ã²ãããã¨ã«æé©åãããã¸ã¥ã¢ã«ãæ¡ç¨ãæ¥ãABãã¹ããè¡ããäººç©ã®éç½®ããã­ã¹ããªã©ã®ã¬ã¤ã¢ã¦ãããã¼ã¿ããå³é¸ãç¶ãã¾ãããå¿ççãªéè²ãé§ä½¿ããè¨­ç«ã®ã¿ã¤ãã³ã°ãä¸­å°ä¼æ¥­ã®åãæ¿ãã¨ããã¿ã¼ã²ããç¹æ§ã«åãããã¯ãªã¨ã¤ãã£ããå¶ä½ãã¾ããã',
          creative:'äººç©ç»åã¯AIã§çæããPhotoshopã§ã¬ã¿ããå¾ã«Illustratorã§ä½æãæ¯è¼çè¥ãç·æ§ã»å°éå®¶æãããå¹´éã®ç·æ§ã»å¥³æ§ã»å¯¾è«é¢¨ãªã©è¤æ°ããªã¨ã¼ã·ã§ã³ãå±éãã«ã©ã¼ã¯è¨­ç«ï¼åå¿èã¨ããç¹ããã°ãªã¼ã³ãä½¿ç¨ï¼åå¿èãã¼ã¯ããçæ³ï¼ããã¸ãã¹æãæãããã«ã¼ã¨ãç®ç«ã¤ãã¼ã³ã¿ã»ãªã¬ã³ã¸ããã¼ãä½æããç¶ç¶çã«æé©è§£ãè¿½æ±ãã¾ããã',
          result:'ã¯ãªãã¯çï¼CTRï¼ã®åä¸ã¨ç²å¾ã³ã¹ãï¼CPAï¼ã®æé©åãå®ç¾ãææ°æè¡ã¨ãã¼ã¿ãèåãããé¡§å®¢ã®ææ¬²ãé«ããè¦è¦ä½é¨ãåµé ãã¾ããã',
          role:'ã¯ãªã¨ã¤ãã£ããã¶ã¤ãã¼ãAIæ´»ç¨ãã¬ã¿ããããã¼ã¿ã«åºã¥ãæ¹åææ¡ã'
        }
      },
      {
        id:13, year:'2023â2026',
        title:'ãªã¦ã³ãã¡ãã£ã¢ èªç¤¾éç¨ã¨æå ±çºä¿¡',
        category:'Digital / Content',
        tags:['ãã¸ã¿ã«éç¨','ã¦ã§ããã¶ã¤ã³','åºå ±','ã¡ã¼ã«ãã¬ã¸ã³'],
        img:'img/works/work_13/work_13.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'ç¨çå£«æ³äººã®å°éç¥è­ããªã¦ã³ãã¡ãã£ã¢ã¨ã¡ã¼ã«ãã¬ã¸ã³ã§ç¶ç¶çºä¿¡ããæ¤ç´¢æµå¥ã®å¢å ã¨æ¢å­é¡§å®¢ã¨ã®é¢ä¿å¼·åãå®ç¾ãä»£è¡¨ã³ã©ã ã®æ´çã»æ²è¼ãæå½ããä¼ç¤¾ã®å¯¾å¤çãªä¿¡é ¼åä¸ã«è²¢ç®ãããã­ã¸ã§ã¯ãã',
          challenge:'ç¨çå£«æ³äººã¨ãã¦å°éç¥è­ãæã¤ä¸æ¹ããã®ç¥è¦ãç¤¾å¤ã«ã»ã¨ãã©å±ãã¦ããªãç¶æ³ã§ãããæ¤ç´¢ããã®æµå¥ãå¢ãããæ°è¦é¡§å®¢ã¨ã®æ¥ç¹ãä½ãã¨ã¨ãã«ãä»£è¡¨ã®èãæ¹ãä¼ç¤¾ã®å§¿å¢ãè¨èã¨ãã¦çºä¿¡ãããã¨ã§ãåãåããåããä¿¡é ¼ãç©ã¿ä¸ããå ´ãå¿è¦ã§ããã',
          approach:'ç¨å¶æ¹æ­£ï¼å®é¡æ¸ç¨ã»å¹´åã®å£ãªã©ï¼ãå®åã§è¿·ãããããã¼ããä¸­å¿ã«ãæ¤ç´¢ããããããã¼ããé¸å®ãã¦ã³ã³ãã³ããç¶ç¶çã«çºä¿¡ãã¾ãããè¨äºã®æµãè¾¼ã¿ã«ã¨ã©ã¾ãããä¸è¦§ã§ã®è¦èªæ§ãé«ãããããµã ãã¤ã«ãæ¯åãã¶ã¤ã³å¶ä½ãã¾ãä»£è¡¨ã³ã©ã ãæ´ç°æã®ç¼ããè¨­ããæ¥ãã®çµå¶ã¸ã®è¦ç¹ãèããç¶ç¶çã«çºä¿¡ãããã¨ã§ãå°éç¥è­ã ãã§ã¯ä¼ãããªããäººã¨ãªãããå±ããå ´ãä½ãã¾ãããã¡ã¼ã«ãã¬ã¸ã³ã¨ãé£åãããæ¢å­ã®æ¥ç¹ãæ´»ãããå®æçãªæ¥è§¦ãå®ç¾ãã¾ããã',
          creative:'ãµã ãã¤ã«ã¯ãã¼ããã¨ã«ãã¶ã¤ã³ãå¤ããªãããããã«ã¿ã°ã«ã¼ãã¨ãã¦ã®ãã©ã³ãã¤ã¡ã¼ã¸ãå´©ããªãçµ±ä¸æãä¿ã¤ãã¨ãæè­ãã¾ãããé£ããç¨åãã¼ãããæããèª­ã¿ãããªããè¦åºãã¨æ§æã«è½ã¨ãè¾¼ã¿ãå°éå®¶ã§ãªãèª­èã«ãå±ãè¨äºã¥ããã«ãã ããã¾ãããä»£è¡¨ã³ã©ã ã¯åå®¹ã®æ´çã»æç« åã«ãé¢ä¸ããçµå¶èã®è¨èãèª­ã¿ãããå½¢ã«æ´ãããã¨ã§ä¼ç¤¾ã®å¯¾å¤çãªä¿¡é ¼åä¸ã«è²¢ç®ãã¾ããã',
          result:'ç¶ç¶çãªçºä¿¡ã«ããæ¤ç´¢çµç±ã§ã®æµå¥å¢å ã«è²¢ç®ãã¡ã¼ã«ãã¬ã¸ã³ã¨ã®é£åã§æ¢å­é¡§å®¢ã¸ã®ãªã¼ããå¼·åããæ¥è§¦é »åº¦ã®åä¸ã¨é¢ä¿ç¶­æã«ã¤ãªãã¾ãããä»£è¡¨ã³ã©ã ã¯å¯¾å¤çãªçºä¿¡ã®æ±ã¨ãªããä¼ç¤¾ã®èããåºãä¼ããåªä½ã¨ãã¦æ©è½ãã¦ãã¾ãã',
          role:'èªç¤¾ã¡ãã£ã¢ã®éç¨å¨è¬ããã¼ãé¸å®ãè¨äºã®æµãè¾¼ã¿ã»æ ¡æ­£ãå³è§£ã»ä½å³ããµã ãã¤ã«ãã¶ã¤ã³å¶ä½ãã¡ã¼ã«ãã¬ã¸ã³éä¿¡ãä»£è¡¨ã³ã©ã ã®æ´çã»æ²è¼ã¾ã§ä¸è²«ãã¦æå½ã'
        }
      },
      {
        id:14, year:'2024',
        title:'ITé¢é£ ä¼ç¤¾è¨­ç«åãã©ã³ãã£ã³ã°ãã¼ã¸',
        category:'Web / UX',
        tags:['ãã¸ã¿ã«éç¨','ãã£ã¹ãã¬ã¤åºå','ãã£ã¬ã¯ã·ã§ã³','ã¦ã§ããã¶ã¤ã³'],
        img:'img/works/work_14/work_14.webp',
        imgs: { a:true, a2:true },
        client:'ãã«ã¿ã°ã«ã¼ãã»ã¯ã©ã¦ããµã¼ã«ã¹æ ªå¼ä¼ç¤¾',
        d:{
          overview:'ITé¢é£äºæ¥­ã§ä¼ç¤¾è¨­ç«ãèãã¦ããæ¹åãã®LPå¶ä½ãããã¼ãããµã¤ãæµå¥ãé¢è«æ¥ç¨èª¿æ´ã¾ã§ãGoogle Workspaceã¨é£æºãããèªååãã­ã¼ã§è¨­è¨ããç³ãè¾¼ã¿ããé¢è«æ¥ç¨ã¾ã§ã®ãªã¼ãã¿ã¤ã ãå¤§å¹ã«ç­ç¸®ãããã­ã¸ã§ã¯ãã',
          challenge:'ãã¸ã¿ã«ãã¤ãã£ããªèµ·æ¥­å®¶å±¤ã®è¡åç¹æ§ããä¼ç¤¾è¨­ç«ã»åµæ¥­èè³ã»ç¨åDXã¨ããè¤åãã¼ãºã«å¯¾ããæé©ãªè¨´æ±ã¨UXãè¨­è¨ãããã¨ãèª²é¡ã§ãããã¡ã¼ã«ãé»è©±ã«ããåãåãããåæ¸ãã¤ã¤ãæç´çãé«ããé¡§å®¢åç·ã®æ§ç¯ãæ±ãããã¾ããã',
          approach:'ããã¼ãããµã¤ãæµå¥ãæ¥ç¨èª¿æ´ã¾ã§ã®æµãï¼UXï¼ãæé©åãç³ãè¾¼ã¿ããé¢è«æ¥ç¨ã¾ã§ãGoogle Workspaceã¨é£æºããããã¨ã§èªååãã­ã¼ãå®ç¾ãã¾ãããã¡ã¼ã«ãé»è©±ã«ããåãåãããåæ¸ã§ããé¡§å®¢åç·ãè¨­è¨ãã¾ããã',
          creative:'ã°ã©ãã¼ã·ã§ã³ããéè²ãã¨ãè¦ç·èªå°ãã®ä¸¡é¢ã§æ´»ç¨ããå®ç¸¾æ°å¤ã®è¦è¦åã«ããå®å¿æã®é¸æãå³ãã¾ãããã¿ã¼ã²ããï¼ITé¢é£ã®èµ·æ¥­å®¶å±¤ï¼ã«åºããã³ãã¼ã¨ãä¸ç®ã§ä¾¡å¤ãä¼ããã¬ã¤ã¢ã¦ããè¿½æ±ãã¾ããã',
          result:'ãèªåé£åããéå®¢ã¢ãã«ã®ç¢ºç«ãã¨ããªã¼ãã¿ã¤ã ç­ç¸®ããå®ç¾ãå¶æ¥­æå½èã®åãåããå¯¾å¿å·¥æ°ãå¤§å¹ã«åæ¸ãã¾ããã',
          role:'Google Workspaceé£æºè¨­è¨ï¼é¢è«äºç´ãã­ã¼ï¼ãå«ããLPå¶ä½ã»UXè¨­è¨å¨è¬ã®æå½ã'
        }
      },
      {
        id:15, year:'2023â2026',
        title:'ã³ã¼ãã¬ã¼ããµã¤ãéç¨ & ã¡ã«ãã¬éä¿¡',
        category:'Digital / PR',
        tags:['åºå ±','ãã¸ã¿ã«éç¨','ã¡ã¼ã«ãã¬ã¸ã³','ã¦ã§ããã¶ã¤ã³'],
        img:'img/works/work_15/work_15.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'ã³ã¼ãã¬ã¼ããµã¤ãã®ç¶ç¶éç¨ã¨Salesforce Pardotãæ´»ç¨ããã¡ã«ãã¬éä¿¡ãçµ±åããå®çåãã¨ãæç·åãã®2ç¨®é¡ã®ã¡ã«ãã¬ãè¨­è¨ããHTMLã³ã¼ãã£ã³ã°ããéä¿¡è¨­è¨ã¾ã§ä¸è²«ãã¦æå½ãå±äººçã ã£ãæå ±çºä¿¡ãä»çµã¿åãããã­ã¸ã§ã¯ãã',
          challenge:'ãã«ã¿ã°ã«ã¼ãã¯ç¨çå£«ã»ä¼è¨ã»æ³åãªã©è¤æ°ã®å°éé åãæã¤ç·åã°ã«ã¼ãã§ããããå®¢æ§ã¸ã®æå ±çºä¿¡ã¯åç¾å ´ã®æå½èä»»ãã«ãªã£ã¦ãããä¼ç¤¾ã¨ãã¦ä¸è²«ããã¿ã¤ãã³ã°ã»åå®¹ã§ã®çºä¿¡ãã§ãã¦ãã¾ããã§ãããç¨å¶æ¹æ­£ã»æ³æ¹æ­£ã¨ãã£ãæäºæ§ã®é«ãæå ±ããå­£ç¯ã®æ¨æ¶ã»å¹´æ«å¹´å§ã¹ã±ã¸ã¥ã¼ã«ã¨ãã£ãé¡§å®¢é¢ä¿ç¶­æã«ä¸å¯æ¬ ãªã³ãã¥ãã±ã¼ã·ã§ã³ããä½ç³»çã«ç®¡çããã¦ããªããã¨ãèª²é¡ã§ããã',
          approach:'ã³ã¼ãã¬ã¼ããµã¤ãã«ãç¥ããã»äºä¾ã»ã»ããã¼æå ±ãç¶ç¶æ²è¼ããªãããSalesforceã®Pardotãæ´»ç¨ããã¡ã«ãã¬éä¿¡ã¨é£åãããçµ±åéç¨ä½å¶ãæ§ç¯ãã¡ã«ãã¬ã¯â ãå®çåãï¼ç¨å¶æ¹æ­£å¤§ç¶±ã®æ¦ç¥ã»æ³æ¹æ­£ãã¤ã³ããªã©ï¼ã¨â¡ãæç·åãï¼æä¸­è¦èãã»å¹´æ«å¹´å§åç¥ãªã©ï¼ã®2ç¨®é¡ã§è¨­è¨ãéä¿¡ææ¥ã»æå»ã¯èªç¤¾ãã¼ã¿ã¨æ¥­çãã¼ã¿ãåæããéå°çãé«ãç«ãæ¨ææ¥ã®åå8æå°ã«çµ±ä¸ãã¾ããã',
          creative:'ä»£çåºããå¼ãç¶ãã ã¡ã«ãã¬ãã³ãã¬ã¼ãã¯divã®æ çµã¿ã®ã¿ã®æå°æ§æã§ãããããããèªèº«ã§HTMLã³ã¼ãã£ã³ã°ã¨ãã¹ããéã­ãèæ¯è²ã»ãªã¹ãã»æ ç·ã»ã«ã©ã ã¬ã¤ã¢ã¦ããªã©è¤æ°ã®ãã¶ã¤ã³ãã¿ã¼ã³ãæ®µéçã«æ¡åãå­£ç¯ãã¨ã«ãã¸ã¥ã¢ã«ãå·æ°ï¼å¤ï¼é¢¨é´ã»æé¡ã®ã¤ã©ã¹ããå¬ï¼ã¯ãªã¹ãã¹ãªã¼ã¹ãªã©ï¼ããªãããMIKATAãã©ã³ãã®ãã³ãããæãªããªããã¶ã¤ã³çµ±ä¸ãå¾¹åºãã¾ããã',
          result:'ä¼ç¤¾ã¨ãã¦æå ±ãä½ç³»çã»ç¶ç¶çã«ãå®¢æ§ã¸å±ããåºå ±åºç¤ãç¤¾åã«æ§ç¯ãã¿ã¤ã ãªã¼ãªå°éæå ±ã®çºä¿¡ã«ãããæ¢å­é¡§å®¢ããã®é«ãä¿¡é ¼ã¨ãé ¼ããå°éå®¶ãã¨ãã¦ã®ãã©ã³ãèªç¥ãç²å¾ãå±äººçã ã£ãæå ±çºä¿¡ãä»çµã¿åããçµç¹ã¨ãã¦ä¸è²«ããã³ãã¥ãã±ã¼ã·ã§ã³ãã§ããä½å¶ãç¢ºç«ãã¾ããã',
          role:'åºå ±ãã­ãã¥ã¼ãµã¼ãã³ã¼ãã¬ã¼ããµã¤ãã®éç¨ç®¡çãã¡ã«ãã¬ã®ä¼ç»ã»ã³ã³ãã³ãå¶ä½ã»HTMLã³ã¼ãã£ã³ã°ã»éä¿¡è¨­è¨ï¼Pardotéç¨ï¼ãéå°çã»ã¯ãªãã¯çãã¼ã¿ã®åæã¨æ¹åã'
        }
      },
      {
        id:16, year:'2023â2025',
        title:'ã¤ã³ãã¼ãã©ã³ãã£ã³ã° ååã»ç¤¾åå ±ã®å¶ä½',
        category:'Inner Branding / Print',
        tags:['å°å·ç©','ãã£ã¬ã¯ã·ã§ã³','ãã©ã³ãã£ã³ã°','åºå ±'],
        img:'img/works/work_16/work_16.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'M&Aã«ããæ ç¹æ¡å¤§ãç¶ãä¸­ãå¨å½åå°ã«åæ£ããå¾æ¥­å¡ã®å¸°å±æè­ã»ä¸ä½æãé¸æãããããç¤¾åå ±ããåæ°£æ§ã§ããï¼å¹´3åï¼ã®å®æçºè¡ã¨ããã«ãã£å¶ä½ãæ¨é²ãã¼ã­ããã¤ã³ãã¼ãã©ã³ãã£ã³ã°ã®ä»çµã¿ãæ§ç¯ãããã­ã¸ã§ã¯ãã',
          challenge:'M&Aã«ããæ ç¹æ¡å¤§ãç¶ãä¸­ãå¨å½åå°ã«åæ£ããå¾æ¥­å¡ãå¢å ããããã«ã¿ã°ã«ã¼ãã®ä¸å¡ã§ãããã¨ããå¸°å±æè­ã»ä¸ä½æã®é¸æãæ¥åã§ãããâ æå ±ã®åæ­ï¼æ ç¹éãé¢ãã¦ãããããä»æ ç¹ã®æ´»åã»è¡¨å½°ã»æ°å¥ç¤¾å¡æå ±ãä¼ãããªãï¼ã¨â¡å¸°å±æã®å¸èåï¼æ¥å¸¸çã«èº«ã«çãã»è§¦ãããã¢ããã®ãã¶ã¤ã³ãéããå¯è¦åãä¸è¶³ï¼ã¨ãã2ã¤ã®èª²é¡ã«å¯¾å¿ãã¾ããã',
          approach:'ç¤¾åå ±ããåæ°£æ§ã§ãããå¹´3åï¼æ¥ã»å¤ã»å¬ï¼ä¼ç»ã»ãã¶ã¤ã³ã»å¶ä½ãä»£è¡¨æ¨æ¶ã»ç¤¾å¡äº¤æµä¼ã»å¹´éè¡¨å½°ã»æ°å¥ç¤¾å¡ç´¹ä»ãªã©ãã°ã«ã¼ãå¨ä½ã®æ´»åãç¶²ç¾çã«ã«ãã¼ãåå·ã§ãã¼ãã«ã©ã¼ã»è£é£¾ãå­£ç¯ã«åããã¦ãªãã¥ã¼ã¢ã«ããæ¯å·ãèª­ã¿ãããªããèªé¢ãè¨­è¨ãã¾ãããã¾ãç¤¾ç« ã¯3Dã½ããMayaã§ã¢ããªã³ã°ï¼ã¬ã³ããªã³ã°ããå®æã¤ã¡ã¼ã¸ãé«ç²¾åº¦ã«å¯è¦åããä¸ã§çµå¶å±¤ã¸ææ¡ãã¾ããã',
          creative:'åãªãååå¶ä½ã«ã¨ã©ã¾ãããããã«ã¿ã°ã«ã¼ãã«èªããæã£ã¦åããããã¨æãããããã¶ã¤ã³ã§ãããã¨ãæéè¦è¦ãã¾ãããã³ã¼ãã¬ã¼ãã«ã©ã¼ï¼é»ï¼ãè»¸ã«ããªãããç¤¾ç« ã¯éã»éã®ç¸åããç«ä½å å·¥ãæ¤è¨ããããã­ãã§ãã·ã§ãã«ããä¿¡é ¼æããé«ç´æããå¼ã­åãããã¶ã¤ã³ã«ä»ä¸ãã¾ããã30å¨å¹´è¨å¿µå·ï¼Vol.61ã»å¬å·ï¼ã§ã¯ã600åè¦æ¨¡ã®å¤§æè¬ç¥­ç¹éã¨ãã¦ä¼å ´åçã»åæ ç¹ã®å¬ããè¦éããã¤ãããã¯æ§æã§è¡¨ç¾ãã¾ããã',
          result:'ç¤¾åå ±ã®å®æçºè¡ã«ãããå¨å½ã«åæ£ããæ ç¹éã®æå ±æ ¼å·®ãè§£æ¶ãä»æ ç¹ã®æ´»åã»è¡¨å½°ã»æ°ã¡ã³ãã¼ããèªåäºãã¨ãã¦ç¥ããæåãçã¾ããã°ã«ã¼ãã¨ãã¦ã®ä¸ä½æã¨å¸°å±æè­ã®åä¸ã«è²¢ç®ãç¤¾ç« å°å¥å¾ã¯ãç¤¾ç« ãã¤ããã¨ä»äºã¸ã®æè­ãå¤ãã£ããã¨ããå£°ãä¸ãããªã©ãæ¥å¸¸ã®è¡åå¤å®¹ã«ã¤ãªããææãå¾ããã¾ããã',
          role:'ç¤¾åå ±ããåæ°£æ§ã§ããã®å®æçºè¡ï¼ä¼ç»ãå¶ä½ãç´åï¼ãããã«ãã£ã»ååã®ãã¶ã¤ã³ä¼ç»ã»å¶ä½ãçµå¶å±¤ã¸ã®ææ¡å¨è¬ãæå½ãã¤ã³ãã¼ãã©ã³ãã£ã³ã°ã®ç¶ç¶çãªä»çµã¿ãã¼ã­ããæ§ç¯ã'
        }
      },
      {
        id:17, year:'2018',
        title:'Sony FES Watch U ãã¶ã¤ã³ã³ã³ã',
        category:'Design Competition',
        tags:['ãã©ã¤ãã¼ã','ãã©ã³ãã£ã³ã°'],
        img:'img/works/work_17/work_17.webp',
        imgs: { a:true },
        client:'Sony Fashion Entertainmentsï¼åäººå¿åï¼',
        d:{
          overview:'ã½ãã¼ã®é»å­ãã¼ãã¼è£½ã¦ã©ãããFES Watch Uãã®ãã¶ã¤ã³ã³ã³ãã«åäººå¿åãå¨å½ããéã¾ã£ãå¿åä½åã®ä¸­ãã32çµã®å¬èªã¯ãªã¨ã¤ã¿ã¼ã«é¸åºãããæ¡ç¨ãã¶ã¤ã³ã¯ã½ãã¼å¬å¼ãµã¤ãã»å°ç¨ã¢ããªã»å¨å½ã®ç¾è²¨åºã§ã®å±ç¤ºè²©å£²ã«å±éããã¾ããã',
          challenge:'ã½ãã¼ã®ãFashion Entertainmentsããä¸»å¬ããã¯ãªã¨ã¤ã¿ã¼å¬åãã­ã¸ã§ã¯ããé»å­ãã¼ãã¼è£½ã®æå­ç¤ã¨ãã«ãã®ãã¶ã¤ã³ãçãæ¿ãã§ãããã£ã¹ãã¬ã¤ã¦ã©ãããFES Watch Uãã®ãã¶ã¤ã³ãããã¼ããå¤æ§æ§ãã®ãã¨ä¸çã«åãã¦çºä¿¡ããã¯ãªã¨ã¤ã¿ã¼ãåºãåéãåãªãè£é£¾ãã¶ã¤ã³ã§ã¯ãªããé»å­ããã¤ã¹ã¨ããæåç«¯æè¡ã®ä¸ã«ãæåçãªç©èªæ§ããå®¿ããããã¡ãã·ã§ã³ã¨ææ§ãäº¤å·®ããæ°ããªä¾¡å¤ãçã¿åºããã¨ãæ±ãããã¾ããã',
          approach:'ãæéãã¨ããæ®éçãªãã¼ãã«ãæ¥æ¬äººãªãã§ã¯ã®ææ§ãæãåãããã³ã³ã»ãããè¨­è¨ãæå­ç¤ãé»å­ãã¼ãã¼ï¼ç´ï¼ã§ã§ãã¦ããã¨ããç´ æã®ç¹æ§ã«çç®ãããæ°´é¢ãããéå¯ããªã©æ¥æ¬çãªç¾æè­ï¼éã»ä½ç½ã»ä¾ã³å¯ã³ï¼ãéã­ããã¨ã§ããæã®æµããæããè£ç½®ãã¨ãã¦ã®ä½åä¸çãæ§ç¯ãã¾ããããã¶ã¤ã³ã¯æ¥µéã¾ã§è¦ç´ ãåãè½ã¨ãããããã«æ§æã§ãé»ã¨ç½ã®å¼·ãã³ã³ãã©ã¹ããæ³¢ç´ãé£æ³ãããã°ãªãããã¿ã¼ã³ã®ãã«ããæ°´é¢ã«æ ãæã®ãããªåå½¢ã¢ãã¼ãã§ãåããªãä¸­ã«æéãæµãã¦ãããã¨ããçç¾ããç¾ãè¡¨ç¾ãã¾ããã',
          creative:'FES Watch Uã®æå­ç¤ããç´ï¼é»å­ãã¼ãã¼ï¼ãã¨ããç´ æã§ãããã¨ã«æ·±ãå±é³´ããæ¥æ¬ã®ä¼çµ±ç¾è¡ãæ°´å¢¨ç»ãæã¤ãä½ç½ã®åãããã¸ã¿ã«ããã¤ã¹ã®ä¸ã§åç¾ãããã¨ã«ãã ããã¾ãããæå­ç¤ã¯ã¢ãã¯ã­ã¼ã ã«å¾¹ããå¤§ããªä½ç½ã¨æå°éã®ç·ã»å½¢ã ãã§æ§æããã«ãã«ã¯æ°´é¢ã®æ³¢ç´ã»æ ¼å­ãæ³èµ·ãããã°ãªãããã¿ã¼ã³ãæ¡ç¨ãããéã®ä¸­ã«ããåãããè¦è¦çã«è¡¨ç¾ãã¾ããã',
          result:'å¨å½ããéã¾ã£ãå¿åä½åã®ä¸­ããã32çµã®å¬èªã¯ãªã¨ã¤ã¿ã¼ã«é¸åºï¼PR TIMESæ²è¼ã»å¬å¼çºè¡¨ï¼ãæ¡ç¨ãã¶ã¤ã³ã¯ã½ãã¼å¬å¼ãµã¤ãã»å°ç¨ã¢ããªãFES Closetããéãã¦ä¸çã¸éä¿¡ãéªæ¥ã¡ã³ãºæ±äº¬ã»é«å³¶å±æ¨ªæµåºã»éå²¡ä¼å¢ä¸¹ã»å¤§ä¸¸ç¥æ¸åºã§ã®å±ç¤ºè²©å£²ã«ãå±éããã¾ããã',
          role:'å¬èªã¯ãªã¨ã¤ã¿ã¼ï¼åäººå¿åï¼ãã³ã³ã»ããç«æ¡ãã°ã©ãã£ãã¯ãã¶ã¤ã³å¶ä½ï¼æå­ç¤ã»ãã«ãï¼ãä½åä¸çè¦³ã®æ§ç¯ã'
        }
      },
      {
        id:18, year:'2018',
        title:'ãã¬ã¼ã³ãã¼ã·ã§ã³æ å æ¥­åæ¯æ´ãã¼ã«ã®ä¼ç»ã»äºç®ç²å¾',
        category:'Motion / Presentation',
        tags:['åç»å¶ä½','è³æå¶ä½'],
        img:'img/works/work_18/work_18.webp',
        client:'ARã¢ããã³ã¹ããã¯ãã­ã¸ã»æ ªå¼ä¼ç¤¾ãã¡ã¼ã¹ããªãã¤ãªã³ã°',
        d:{
          overview:'å¤§æãã¡ãã·ã§ã³ä¼æ¥­ï¼ãã¡ã¼ã¹ããªãã¤ãªã³ã°ï¼ã¸ã®ã·ã¹ãã å°å¥ç¶ç¶ã«åããçµå¶å±¤åããã¬ã¼ã³æ åãå¶ä½ããç¾ç¶ã®æ··ä¹±âéç´âå°æ¥åãã¨ãã3æ®µéã®ã¹ãã¼ãªã¼è¨­è¨ã¨ãAfter Effectsã«ããã¢ãã¡ã¼ã·ã§ã³ã§çµå¶å±¤ã®æææ±ºå®ãåãããã¨ã«è²¢ç®ãåå¹´éã®ãã­ã¸ã§ã¯ãç¶ç¶æ¿èªã¨äºç®ç¢ºä¿ãå®ç¾ãã¾ããã',
          challenge:'å¤§æãã¡ãã·ã§ã³ä¼æ¥­ï¼ãã¡ã¼ã¹ããªãã¤ãªã³ã°ï¼ã§ã¯ãã°ã­ã¼ãã«è¤æ°æ ç¹ã«ã¾ãããæå ±é£æºã«ããã¦ãã¼ã«ãçµ±ä¸ããã¦ããããåå½ã»åé¨ééã®ããåãã§æéããç¢ºèªä½æ¥­ãå¤çºãç¡é§ãªã³ãã¥ãã±ã¼ã·ã§ã³ã³ã¹ããæå¸¸çã«çºçãã¦ãã¾ãããããããè§£æ±ºããç¬èªã·ã¹ãã ã®éçºã»å°å¥ãç¶ç¶ããããã«ãçµå¶å±¤ãç´å¾ãããè«ççæ ¹æ ã¨èª¬å¾åã®ãããã¸ã¥ã¢ã«ã³ãã¥ãã±ã¼ã·ã§ã³ãä¸å¯æ¬ ã§ããã',
          approach:'ãã­ã¸ã§ã¯ãè²¬ä»»èã¨ç¶¿å¯ã«ãã¢ãªã³ã°ãè¡ãããç¾ç¶ã®æ··ä¹±ãâãã·ã¹ãã å°å¥å¾ã®æ´çãâãå°æ¥ã®å¯è½æ§ãã¨ãã3æ®µéã®ã¹ãã¼ãªã¼æ§æã§ãã¬ã¼ã³åç»ãè¨­è¨ãã¾ãããâ ãç¾ç¶ã®åé¡ãï¼ä¸çåæ ç¹ãä¹±ç«ããã¡ã¼ã«ã»Excelã»çºæ³¨ãã¼ã«ã»å°å³æå ±ãé¯ç¶ããæ··ä¹±ããæå ±ãã­ã¼ãã¢ãã¡ã¼ã·ã§ã³ã§è¦è¦åãâ¡ãå°å¥å¾ã®å¤åãï¼æå ±ãä¸ãæã«éç´ãããä¸çãè¡¨ç¾ãâ¢ãå°æ¥åãï¼åºèç©ºéã§ã®æå ±ã®è¦ããåãCGæ åã§å·ä½åã',
          creative:'æ½è±¡çãªãæå ±ã®æ··ä¹±ãããä¸çå°å³ä¸ã«åå½æ ç¹ã»ãã¼ã«ã»äººå¡ãè¤éã«çµ¡ã¿åãã¢ãã¡ã¼ã·ã§ã³ã¨ãã¦å¯è¦åãè¦ãç¬éã«ãç¢ºãã«ããã¯åé¡ã ãã¨ç´æããããã¸ã¥ã¢ã«ã®è«çè¨­è¨ã«ãã ããã¾ãããç¾ç¶ï¼æ··æ²ï¼âéç´ï¼æ´çï¼ã¨ããå¯¾æ¯ãåãã¨è²å½©ã§è¡¨ç¾ãããå°å¥åå¾ã®å·®ããè¨èãªãã§ãçè§£ã§ããæ åæ§æãå®ç¾ãã¾ãããå°æ¥åã®ãã¼ãã§ã¯ãå®éã®åºèç©ºéã«CGã¢ãã¿ã¼ãæå ±UIãçµã¿åããããå®æå¾ãããã«çºå±ã§ãããã¨ããå¯è½æ§ãæããããæ åã«ä»ä¸ãã¾ããã',
          result:'ãã¬ã¼ã³ãã¼ã·ã§ã³ã¯æåããåå¹´éã®ãã­ã¸ã§ã¯ãã®ç¶ç¶æ¿èªã¨äºç®ç¢ºä¿ãå®ç¾ããç¾ç¶ã®èª²é¡ããææã¨è«çã®ä¸¡é¢ããä¼ãããã¸ã¥ã¢ã«ã«ãããçµå¶å±¤ã®å³æ­ãå¼ãåºããã¨ã«è²¢ç®ãã¾ãããç¾å ´ã®èª²é¡ããçµå¶å±¤ãçè§£ã§ããè¨èªï¼æ åã»ãã¸ã¥ã¢ã«ï¼ãã«ç¿»è¨³ããå¤§è¦æ¨¡ãªæææ±ºå®ãåããæ¨é²åã¨ãã¦æ©è½ããå®ç¸¾ã§ãã',
          role:'ãã¬ã¼ã³ãã¼ã·ã§ã³æ åã»å³è§£å¶ä½æå½ããã­ã¸ã§ã¯ãè²¬ä»»èã¸ã®ãã¢ãªã³ã°ãã¹ãã¼ãªã¼æ§æè¨­è¨ãAfter Effectsã«ããã¢ãã¡ã¼ã·ã§ã³ã»CGæ åå¶ä½ãå¨ã¹ã©ã¤ãã®ãã¸ã¥ã¢ã«ãã£ã¬ã¯ã·ã§ã³ã'
        }
      },
      {
        id:19, year:'2019',
        title:'Zidoma ãµã¼ãã¹ãµã¤ã ãªãã©ã³ãã£ã³ã°',
        category:'Web / Branding',
        tags:['ã¦ã§ããã¶ã¤ã³','ãã¸ã¿ã«éç¨','ãã©ã³ãã£ã³ã°'],
        img:'img/works/work_19/work_19.webp',
        imgs: { a:true, a2:true },
        client:'ARã¢ããã³ã¹ããã¯ãã­ã¸',
        d:{
          overview:'ãã¡ã¤ã«ç®¡çã·ã¹ãã ãZIDOMA dataãããèª°ã§ãä½¿ãããé ¼ãããã¼ããã¼ãã¨ãã¦åå®ç¾©ãããªãã©ã³ãã£ã³ã°ææ¡ãç­å®ãèªããªãªã¸ãã«ã¤ã©ã¹ããå¶ä½ããåæã»æ®å½±ã§åã®é¡§å®¢äºä¾ãã¼ã­ããç²å¾ãããã­ã¸ã§ã¯ãã',
          challenge:'ãZIDOMA dataãã¯ä¼æ¥­ã®ãã¡ã¤ã«ãµã¼ãã¼éã®ãã¼ã¿ç§»è¡ãæ¯æ´ããBtoBãã¼ã«ãç«¶åè£½åãå­å¨ããä¸­ã§ãæ©è½ã®åªä½æ§ã ãã§ãªããITã«è©³ãããªãæå½èã§ãä½¿ãããªãããã¨ããå®å¿æã¨è¦ªãã¿ãããã®è¨´æ±ãä¸è¶³ãã¦ãã¾ãããã¾ããå°å¥äºä¾ãã¼ã­ã¨ããç¶æããã®ãªãã©ã³ãã£ã³ã°ã¨ãããéå¸¸ã«ãã¼ãã«ã®é«ãèª²é¡ã§ãããã¾ããã',
          approach:'é£è§£ãªITãã¼ã«ããèª°ã§ãä½¿ãããé ¼ãããã¼ããã¼ãã¨ãã¦åå®ç¾©ãããªãã©ã³ãã£ã³ã°ææ¡ãç­å®ããµã¤ãæ§æã¯ãèª²é¡ã®å±æãâãæ©è½ç´¹ä»ãâãå°å¥äºä¾ãâããã©ã¤ã¢ã«èªå°ãã¨ããUXè¨­è¨ãæ¡ç¨ãèªããªãªã¸ãã«ã¤ã©ã¹ããå¶ä½ããè¤éãªãã¡ã¤ã«ãµã¼ãã¼æ§æããã¼ã¿ç§»è¡ãã­ã¼ãèª°ã§ãçè§£ã§ãããã¸ã¥ã¢ã«ã§è¡¨ç¾ãåæã®ããã«åå¤å±ã¾ã§åºå¼µã»æ®å½±ãå®æ½ããåã®ãå®¢æ§ã¤ã³ã¿ãã¥ã¼ãã¼ã­ããç²å¾ãã¾ããã',
          creative:'æ¢å­ãµã¤ãã¯ITæãå¼·ãå°éç¨èªãå¤ããããåãã¦è¨ªããæå½èããé£ããããã¨é¢è±ããããè¨­è¨ã§ããããªãã©ã³ãã£ã³ã°ææ¡ã§ã¯ããªã¬ã³ã¸ãåºèª¿ã¨ããæ¸©ãã¿ã®ããã«ã©ã¼ãªã³ã°ã¨ãè¦ªãã¿ãããã¤ã©ã¹ããå¤ç¨ãããã¨ã§ãITåå¿èã§ãä»»ãããããã¨ããå®å¿æãæ¼åºãããã¡ã¤ã«ãµã¼ãã¼ã®åé¡ã«æ©ãã§ãã¾ãããï¼ãã¨ããå±æè¨´æ±ããããã«æ®ããã¦ã¼ã¶ã¼ãèªåäºã¨ãã¦æããããå°ç·è¨­è¨ãå¾¹åºãã¾ããã',
          result:'æ¢å­ãµã¤ãéç¨ãã§ã¼ãºã§ã¯ãSEGAç­ã®å¤§æä¼æ¥­ã®ã°ã«ã¼ãä¼ç¤¾ã¸ã®å°å¥å®ç¸¾ãç²å¾ãèªãåæã»æ®å½±ãã¦å¶ä½ããé¡§å®¢äºä¾ã³ã³ãã³ããæç´çã®åä¸ã«å¯ä¸ãã¾ããããªãã©ã³ãã£ã³ã°ææ¡ã«ã¤ãã¦ã¯ãã³ã­ãç¦ã«ããäºæ¥­æ¹éã®å¤æ´ã¨éè·ã«ããå®è£ã«ã¯è³ãã¾ããã§ããããã¼ã­äºä¾ã®ç¶æããã³ã³ãã³ããèªåã§éæããè¡ååã¨ãè¤éãªITãã­ãã¯ããéITå±¤ã«ä¼ãããã¸ã¥ã¢ã«ã¸ç¿»è¨³ããä¼ç»ã»å¶ä½åãçºæ®ããåãçµã¿ã§ãã',
          role:'ã¯ãªã¨ã¤ãã£ããã­ãã¥ã¼ãµã¼ãã¤ã©ã¹ãå¶ä½ããµã¤ãæ§ç¯ãåç»å¶ä½ã'
        }
      },
      {
        id:20, year:'2024',
        title:'ä¼ç¤¾æ¡åã»å¶æ¥­è³æ ãã¼ã¿ã«å¶ä½',
        category:'Branding / Print',
        tags:['å°å·ç©','ãã©ã³ãã£ã³ã°','ãã£ã¬ã¯ã·ã§ã³','åç'],
        img:'img/works/work_20/work_20.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'åµæ¥­30å¨å¹´ãè¿ãããã«ã¿ã°ã«ã¼ãã«åãã¦ãä¼ç¤¾æ¡åï¼å¨16ãã¼ã¸ï¼ã»å¶æ¥­ãã©ã·ã»åç¨®è³æããã¼ã¿ã«ã§çµ±ä¸å¶ä½ãæ¦ç¥ç«æ¡ãããã©ããã£ã¬ã¯ã·ã§ã³ã»ä½å³ã»ã©ã¤ãã£ã³ã°ã»ãã¶ã¤ã³ã¾ã§ãç¤¾åã§ä¸è²«ãã¦å®çµãããå¤§åãã­ã¸ã§ã¯ãã',
          challenge:'åµæ¥­30å¨å¹´ãè¿ãããã«ã¿ã°ã«ã¼ãã«ã¯ãã°ã«ã¼ãå¨ä½ã®ãã¸ã§ã³ã»ããã·ã§ã³ã»ããªã¥ã¼ãããã¸ãã¹ï¼ã©ã¤ãã»ã³ã³ãµã«ãã£ã³ã°ãã¨ããç¬èªãµã¼ãã¹ã®å¨è²ãä½ç³»çã«ä¼ããçµ±ä¸ãããã¯ãªã¨ã¤ãã£ããå­å¨ãã¾ããã§ãããåæå½èãåå¥ã«ä½æããè³æã¯åè³ªã»ãã³ããããã©ãã©ã§ããä¿¡é ¼ã§ãããã­ãã§ãã·ã§ãã«éå£ãã¨ããç¬¬ä¸å°è±¡ãä¸ãããã¦ãã¾ããã§ããã',
          approach:'ä»£è¡¨æ¨æ¶ã®åçæ®å½±ãã£ã¬ã¯ã·ã§ã³ãããå¨ãã¼ã¸ã®ä½å³ã»ãã¶ã¤ã³ã»ã©ã¤ãã£ã³ã°ã¾ã§ãä¸è²«ãã¦æå½ãä¼ç¤¾æ¡åï¼å¨16ãã¼ã¸ï¼ã§ã¯ãããã·ã§ã³ã»ãã¸ã§ã³ã»ããªã¥ã¼ã®ä½ç³»çãªæ´çããå§ããããã¸ãã¹ï¼ã©ã¤ãã»ã³ã³ãµã«ãã£ã³ã°ãã®ç¬èªæ§ãããããããå³è§£åï¼æ³äººã»åäººã®2ã¤ã®è²¡å¸ã®å¯è¦åã6ã¹ãããã®æé·æ¯æ´ã­ã¼ããããã4ã¤ã®ã½ãªã¥ã¼ã·ã§ã³ä½ç³»ãªã©ï¼ãå¶æ¥­ãã©ã·ã¯ãã¿ã¼ã²ããï¼ä¸­å°ä¼æ¥­ãªã¼ãã¼ï¼ã®èª²é¡æã«ç´çµããã­ã£ããã³ãã¼è¨­è¨ã¨ããã­ã¼ãã£ã¼ãã»Q&Aãç¨ããåãããããæå ±è¨­è¨ãæ¡ç¨ãã¾ããã',
          creative:'ä»£è¡¨ã®åçæ®å½±ã§ã¯ããçµå¶èã®ãã¼ããã¼ãã¨ããä¿¡é ¼æãä¼ãããããè¡¨æã»å§¿å¢ã»ç§æã»èæ¯ã¾ã§ç´°ãããã£ã¬ã¯ã·ã§ã³ãä¼ç¤¾æ¡åã®è¡¨ç´ã¯ãå±±ãç»ãçµå¶èãã¡ãã¨ããå¢¨çµµé¢¨ã®ã¤ã©ã¹ããæ¡ç¨ãããã²å­«ã®ä¸ä»£ã¾ã§ä¼´èµ°ãããã¨ãããã©ã³ãã®ä¸çè¦³ãè¦è¦çã«è¡¨ç¾ãã¾ãããã³ã¼ãã¬ã¼ãã«ã©ã¼ã®é»ãè»¸ã«ãã°ã¬ã¼ã®ã°ã©ãã¼ã·ã§ã³ã»å·®ãè²ã®èµ¤ãç²¾ç·»ã«èª¿æ´ããéåæã¨è¦ªãã¿ããããå±å­ãããã¶ã¤ã³ã·ã¹ãã ãæ§ç¯ãã¾ããã',
          result:'ã°ã«ã¼ãå¨ä½ã§çµ±ä¸ãããã¯ãªã¨ã¤ãã£ãè³ç£ãç¢ºç«ããå¯¾å¤çãªãã©ã³ãä¿¡é ¼æ§ã¨æç´çã®åä¸ã«è²¢ç®ãã¾ãããä¼ç¤¾æ¡åã¯å¶æ¥­æå½èã®èª¬æãã¼ã«ã¨ãã¦æ´»ç¨ãããã¨ã¨ãã«ãå¾æ¥­å¡ã¸ã®ä¼æ¥­çå¿µã»ãµã¼ãã¹åå®¹ã®èªè­çµ±ä¸ï¼ã¤ã³ãã¼ãã©ã³ãã£ã³ã°ï¼ã«ãæ©è½ãã¦ãã¾ãã',
          role:'ã¯ãªã¨ã¤ãã£ããã£ã¬ã¯ã¿ã¼ï¼å¨å·¥ç¨ãåç¬æå½ï¼ãä»£è¡¨æ®å½±ã®ãã©ããã£ã¬ã¯ã·ã§ã³ãå¨ãã¼ã¸ã®ãã¶ã¤ã³ã»ä½å³ã»ã©ã¤ãã£ã³ã°ãã«ã©ã¼ã»ãã©ã³ãã®é¸å®ã»ç®¡çãå¶æ¥­ãã©ã·ã®ã³ã³ãã³ãè¨­è¨ã'
        }
      },
      {
        id:21, year:'2024',
        title:'M&A ä¼ç¤¾æ¡ååç»',
        category:'Video / Branding',
        tags:['åç»å¶ä½','åç','ãã©ã³ãã£ã³ã°','ãã£ã¬ã¯ã·ã§ã³'],
        img:'img/works/work_21/work_21.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ãã«ã¿ç¨çæ³äººï¼ãã«ã¿ã°ã«ã¼ãï¼',
        d:{
          overview:'M&Aåè«æã«å£²ä¸»æ§ã»å¾æ¥­å¡æ§ã¸ãã©ããªä¼ç¤¾ã«å¥ãã®ãããä¼ããããã®ä¼ç¤¾æ¡ååç»ãç´3é±éã»åç¬ã§å¶ä½ãæ®å½±ããç·¨éã»ç´åã¾ã§å¨å·¥ç¨ãä¸äººã§å®éããã°ã«ã¼ãã¤ã³ã¸ã®ä¸å®è§£æ¶ã¨æ¿ç¶ãã­ã»ã¹ã®åæ»åã«è²¢ç®ãããã­ã¸ã§ã¯ãã',
          challenge:'ãã«ã¿ã°ã«ã¼ããM&Aã«ããæ°ããªæ ç¹ã»äºåæãæ¿ç¶ããéãå£²ä¸»å´ã®çµå¶èã»å¾æ¥­å¡ã«ã¨ã£ã¦æå¤§ã®ä¸å®ã¯ãã©ããªä¼ç¤¾ã«å¥ãã®ããã¨ããç¹ã§ãããåè«ã®å ´ã§ã¯å£é ­ãè³æã§ã®èª¬æãä¸­å¿ã¨ãªãã¾ãããããã«ã¿ã°ã«ã¼ãã®é°å²æ°ã»æåã»ä»£è¡¨ã®äººæã»ä¸ç·ã«åãä»²éã®å£°ããç´æ¥æãã¦ããããæ©ä¼ãä¸è¶³ãã¦ãããæ¿ç¶ã¸ã®å¿ççãã¼ãã«ãçãã¦ãã¾ããã',
          approach:'ä¼ç¤¾æ¡åç´ æã®æµç¨ã§æéç­ç¸®ãã¤ã¤ãã©ã³ãçµ±ä¸ãä¿ã¤ã¨ããå·¥å¤«ããå±æâä¿¡é ¼âå®å¿ãã¨ãã3æ®µéã®ã¹ãã¼ãªã¼è¨­è¨ã§å¶ä½ãåç»ã®æ§æã¯ããã«ã¿ã°ã«ã¼ãã¨ã¯ä½ãï¼ä¼ç¤¾æ¡åãã¼ãï¼ãâãä»£è¡¨ããã®ã¡ãã»ã¼ã¸ãâãå®éã«åãå¾æ¥­å¡ã®å£°ãã¨ããæµãã§è¨­è¨ããè¦è´èãæ®µéçã«å®å¿æãæããããã¹ãã¼ãªã¼æ§æã«ãã¾ãããä»£è¡¨æ¨æ¶ããã³å¾æ¥­å¡ã¤ã³ã¿ãã¥ã¼ã®æ®å½±ã»ã»ããã£ã³ã°ã¯èªåä¸äººã§æå½ãã¾ããã',
          creative:'æ¢å­ã®ä¼ç¤¾æ¡åï¼ãã³ãã¬ããï¼ã®ç´ æã»ãã¸ã¥ã¢ã«ãåç»ã«æµç¨ãããã¨ã§å¶ä½æéãå¤§å¹ã«ç­ç¸®ããªããããã©ã³ãã®ä¸è²«æ§ãæä¿ããè¨­è¨ãæ¡ç¨ãã¾ãããæ®å½±æ©æã®ã»ããã£ã³ã°ã»ã©ã¤ãã£ã³ã°ã»ã«ã¡ã©ã¯ã¼ã¯ã»åé²ã»ç·¨éã¾ã§å¨å·¥ç¨ãåç¬ã§è¡ããä¾é ¼ããç´åã¾ã§ç´3é±éã¨ããç­æéã§å¶ä½ãå®éãã¾ããã',
          result:'M&Aåè«æã®èª¬æãã¼ã«ã¨ãã¦æ´»ç¨ãããå£²ä¸»æ§ã»å¾æ¥­å¡æ§ã®ãã°ã«ã¼ãã¤ã³ã¸ã®ä¸å®è§£æ¶ãã«è²¢ç®ãç´3é±éã¨ããç­ç´æã§ãæ®å½±ã»ç·¨éã»ç´åã¾ã§ä¸äººã§å®éãå¤é¨å§è¨ã¼ã­ã§é«åè³ªãªåç»ã³ã³ãã³ããåè£½åããå®ç¸¾ã¨ãã¦ãçµç¹åã®ã¯ãªã¨ã¤ãã£ãå¶ä½åãç¤ºãã¾ããã',
          role:'ãã­ãã¥ã¼ãµã¼å¼ãã£ã¬ã¯ã¿ã¼å¼ã«ã¡ã©ãã³ï¼å¨å·¥ç¨åç¬æå½ï¼ãä¼ç»ã»æ§æè¨­è¨ãæ®å½±ã»ããã£ã³ã°ï¼ç§æã»æ©æï¼ãä»£è¡¨ããã³å¾æ¥­å¡ã¤ã³ã¿ãã¥ã¼åé²ãåç»ç·¨éã»ä»ä¸ããç´åã'
        }
      },
    ];

    const ALL_PF_TAGS = [
      // ãã¶ã¤ã³é¢ä¿
      'ã¦ã§ããã¶ã¤ã³','ãã£ã¹ãã¬ã¤åºå','å°å·ç©','ãã©ã³ãã£ã³ã°','åç',
      // ä¼ç»
      'ãã£ã¬ã¯ã·ã§ã³','è³æå¶ä½','ã»ããã¼','ã¤ãã³ã',
      // éç¨
      'SNS','ã¡ã¼ã«ãã¬ã¸ã³','ãã¸ã¿ã«éç¨','åºå ±','æ¡ç¨','åç»å¶ä½',
      // ãã©ã¤ãã¼ã
      'ãã©ã¤ãã¼ã',
    ];
    let pfSelected = new Set();
    let currentWorks = [...PF_WORKS];

    /* ââââââââ  TAGS  ââââââââ */
    function pfRenderTags() {
      const c = document.getElementById('pf-tags');
      c.innerHTML = '';
      ALL_PF_TAGS.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'pf-tag' + (pfSelected.has(tag) ? ' pf-active' : '');
        btn.textContent = tag;
        btn.addEventListener('click', () => pfToggle(tag));
        c.appendChild(btn);
      });
    }

    /* ââââââââ  WORKS  ââââââââ */
    function pfMatch(w) { return pfSelected.size ? w.tags.filter(t => pfSelected.has(t)).length : 0; }

    function pfRenderWorks() {
      const track = document.getElementById('pf-track');
      track.innerHTML = '';
      currentWorks = [...PF_WORKS]
        .map(w => ({ ...w, mc: pfMatch(w) }))
        .filter(w => !pfSelected.size || w.mc > 0)
        .sort((a,b) => b.mc - a.mc);

      document.getElementById('pf-sort-hint').textContent = '';

      if (!currentWorks.length) {
        const el = document.createElement('div');
        el.className = 'pf-empty';
        el.innerHTML = '<p class="pf-empty-title">No works found.</p><p class="pf-empty-sub">Try another tag</p>';
        track.appendChild(el); pfRefresh(); return;
      }

      currentWorks.forEach((work, i) => {
        const mHtml = pfSelected.size ? `<span class="pf-match-badge ${work.mc>0?'pf-hl':''}">${work.mc}/${work.tags.length}</span>` : '';
        const tHtml = work.tags.map(t => `<span class="pf-ctag ${pfSelected.has(t)?'pf-matched':''}">${t}</span>`).join('');
        const card = document.createElement('div');
        card.className = 'pf-card';
        card.innerHTML = `
          <div class="pf-card-img-wrap">
            <img src="${work.img}" alt="${work.title}" loading="lazy"
              onerror="this.style.display='none';this.parentNode.style.background='linear-gradient(160deg,#1a1a1a 0%,#3a3a3a 100%)'">
            <div class="pf-tag-overlay">${tHtml}</div>
            <span class="pf-card-num">${String(i+1).padStart(2,'0')}</span>
          </div>
          <div class="pf-card-footer">
            <div class="pf-card-dash"></div>
            <p class="pf-card-label">${work.title}</p>
          </div>`;
        const ci = i;
        card.addEventListener('click', () => openModal(ci));
        track.appendChild(card);
      });
      pfRefresh();
      requestAnimationFrame(() => {
        track.querySelectorAll('.pf-card').forEach(c => {
          if (c.getBoundingClientRect().left < window.innerWidth * 0.98) c.classList.add('pf-card-in');
        });
      });
    }

    /* ââââââââ  SCROLL  ââââââââ */
    let pfCfg = { scrollDist: 0 };

    let pfTagToggling = false;

    function pfCalcDist(num) {
      const effectiveNum = Math.max(num, 3);
      const trackW = effectiveNum * 260 + Math.max(0, effectiveNum - 1) * 80;
      return Math.max(0, trackW - 260);
    }

    function pfRefresh() {
      const outer = document.getElementById('pf-outer');
      const track = document.getElementById('pf-track');
      const filteredNum = track.querySelectorAll('.pf-card').length;
      const newDist = pfCalcDist(filteredNum);

      const oldDist = pfCfg.scrollDist || 0;
      const scrolledIn = Math.max(0, -outer.getBoundingClientRect().top);
      const progress = oldDist > 0 ? Math.min(1, scrolledIn / oldDist) : 0;

      pfCfg = { scrollDist: newDist };

      if (!pfTagToggling) {
        outer.style.height = (window.innerHeight + newDist) + 'px';
        if (scrolledIn > 0) {
          const outerAbsTop = outer.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: outerAbsTop + progress * newDist, behavior: 'instant' });
        }
      }

      pfTick();
    }

    function pfTick() {
      const outer = document.getElementById('pf-outer');
      const track = document.getElementById('pf-track');
      const fill  = document.getElementById('pf-fill');
      const scrolled = -outer.getBoundingClientRect().top;
      if (scrolled <= 0) { track.style.transform = 'translateX(0)'; if (fill) fill.style.width = '0%'; return; }
      const dist = pfCfg.scrollDist || 1;
      if (scrolled >= dist) {
        track.style.transform = `translateX(-${dist}px)`; if (fill) fill.style.width = '100%';
        track.querySelectorAll('.pf-card').forEach(c => c.classList.add('pf-card-in')); return;
      }
      track.style.transform = `translateX(-${scrolled}px)`;
      if (fill) fill.style.width = ((scrolled/dist)*100).toFixed(1) + '%';
      track.querySelectorAll('.pf-card').forEach(c => {
        if (c.getBoundingClientRect().left < window.innerWidth * 0.98) c.classList.add('pf-card-in');
      });
    }

        /* ââââââââ  MODAL  ââââââââ */
    const modal    = document.getElementById('wd-modal');
    const panel    = document.getElementById('wd-panel');
    const content  = document.getElementById('wd-detail-wrap');
    const closeBtn = document.getElementById('wd-close-btn');
    const backdrop = document.getElementById('wd-backdrop');
    const topTitle = document.getElementById('wd-topbar-title');
    const sbWrap   = document.getElementById('wd-scrollbar');
    const sbThumb  = document.getElementById('wd-sb-thumb');
    const sbPct    = document.getElementById('wd-sb-pct');
    let openIdx = 0, hintShown = false, closeTimer = null;

    // Align bar to right edge of the panel
    function sbAlign() {
      const r = panel.getBoundingClientRect();
      sbWrap.style.right = (window.innerWidth - r.right) + 'px';
    }
    window.addEventListener('resize', () => { if (sbWrap.style.display !== 'none') sbAlign(); });

    // HTMLã­ã£ãã·ã¥ï¼idleTime ã«äºåçæï¼
    const _detailCache = new Map();
    function getDetailHTML(work) {
      if (!_detailCache.has(work.id)) {
        _detailCache.set(work.id, buildDetailHTML(work));
      }
      return _detailCache.get(work.id);
    }
    // ãã¼ã¸èª­ã¿è¾¼ã¿å¾ã«ã¢ã¤ãã«æéãä½¿ã£ã¦å¨ä½åãããªã­ã£ãã·ã¥
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        PF_WORKS.forEach((w, i) => setTimeout(() => {
          getDetailHTML(w); // HTMLã­ã£ãã·ã¥
          // ãã¼ã­ã¼ç»åãããªãã§ããï¼ã¢ã¼ãã«ãéããæã«å³è¡¨ç¤ºï¼
          const img = new Image();
          img.src = w.img;
        }, i * 40));
      }, { timeout: 3000 });
    }

    function openModal(idx) {
      openIdx = idx;
      const work = currentWorks[idx];
      topTitle.textContent = '';

      // â  ã¹ã±ã«ãã³ãå³ã»ããï¼è»½éï¼
      content.innerHTML = '<div class="wd-skeleton-wrap"><div class="wd-sk wd-sk-title"></div><div class="wd-sk wd-sk-meta"></div><div class="wd-sk wd-sk-hero"></div><div class="wd-sk wd-sk-body"></div><div class="wd-sk wd-sk-body wd-sk-body-short"></div></div>';
      panel.scrollTop = 0;
      hintShown = false;
      clearTimeout(closeTimer);
      if (sbThumb) { sbThumb.style.height = '0%'; sbThumb.classList.remove('wd-sb-closing'); }
      if (sbPct) sbPct.textContent = '0%';

      // â¡ ã¢ã¼ãã«ãããéã â CSSã¢ãã¡ã¼ã·ã§ã³åè¡
      // visibility:hidden ã§ã¯ãªã opacity ã®ã¿ã§å¶å¾¡ â GPUã¬ã¤ã¤ã¼ãç¶­æããã©ã°ãªã
      modal.style.visibility = '';
      modal.classList.add('wd-open');
      document.getElementById('wd-fade-bottom').style.display = 'block';
      document.body.style.overflow = 'hidden';

      // â¢ ã­ã£ãã·ã¥æ¸ã¿ãªãããããªããã°æ¬¡ãã¬ã¼ã ã§æ³¨å¥
      if (_detailCache.has(work.id)) {
        content.innerHTML = _detailCache.get(work.id);
        requestAnimationFrame(() => { sbAlign(); if (sbWrap) sbWrap.style.display = 'block'; initLightbox(content); initWIS(content); });
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            content.innerHTML = getDetailHTML(work);
            sbAlign();
            if (sbWrap) sbWrap.style.display = 'block';
            initLightbox(content);
            initWIS(content);
          });
        });
      }
    }

    function closeModal() {
      hintShown = false;
      clearTimeout(closeTimer);
      sbWrap.style.display = 'none';
      document.getElementById('wd-fade-bottom').style.display = 'none';
      modal.classList.remove('wd-open');
      // GPUã¬ã¤ã¤ã¼ãç ´æ£ããªããã visibility:hidden ãä½¿ããªã
      // opacity:0 + pointer-events:none (CSSã§å¶å¾¡) ã®ã¾ã¾ã«ãã
      setTimeout(() => {
        document.body.style.overflow = '';
      }, 380);
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Scroll â grow bar height 0%â100%, auto-close at bottom
    let _panelRafId = null;
    panel.addEventListener('scroll', () => {
      if (_panelRafId) return;
      _panelRafId = requestAnimationFrame(() => {
        _panelRafId = null;
      const max = panel.scrollHeight - panel.clientHeight;
      const pct = max > 0 ? panel.scrollTop / max : 0;
      const pctVal = Math.round(pct * 100);
      if (sbThumb) sbThumb.style.height = pctVal + '%';
      if (sbPct) {
        sbPct.textContent = pctVal + '%';
        // Position badge at the bottom of the thumb
        const trackH = sbWrap.offsetHeight;
        const pos = trackH * pct;
        sbPct.style.bottom = (trackH - pos) + 'px';
        sbPct.style.transform = 'translateY(50%)';
      }

      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
      if (atBottom && !hintShown) {
        hintShown = true;
        if (sbThumb) sbThumb.classList.add('wd-sb-closing');
        closeTimer = setTimeout(closeModal, 300);
      }
      if (!atBottom && hintShown) {
        hintShown = false;
        clearTimeout(closeTimer);
        if (sbThumb) sbThumb.classList.remove('wd-sb-closing');
      }
      }); // rAF
    }, { passive: true });



    /* ââââââââ  LIGHTBOX  ââââââââ */
    (function() {
      // ã©ã¤ãããã¯ã¹DOMï¼ä¸åº¦ã ãçæï¼
      let lb = null;
      function ensureLB() {
        if (lb) return;
        lb = document.createElement('div');
        lb.id = 'wd-lb';
        lb.innerHTML = '<div class="lb-backdrop"></div><button class="lb-close" aria-label="éãã">&times;</button><div class="lb-img-wrap"><img class="lb-img" src="" alt=""></div>';
        document.body.appendChild(lb);
        lb.querySelector('.lb-backdrop').addEventListener('click', closeLB);
        lb.querySelector('.lb-close').addEventListener('click', closeLB);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });
      }
      function openLB(src) {
        ensureLB();
        const img = lb.querySelector('.lb-img');
        img.src = src;
        lb.classList.add('lb-open');
        document.body.style.overflow = 'hidden';
      }
      function closeLB() {
        if (!lb) return;
        lb.classList.remove('lb-open');
        document.body.style.overflow = '';
      }
      window.initLightbox = function(root) {
        root.querySelectorAll('.lb-trigger').forEach(el => {
          el.addEventListener('click', () => {
            const src = el.querySelector('img')?.src;
            if (src) openLB(src);
          });
          el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const src = el.querySelector('img')?.src;
              if (src) openLB(src);
            }
          });
        });
      };
    })();


    /* ââââââââ  WD INLINE SLIDER (wd-in-slider)  ââââââââ */
    window.initWIS = function(root) {
      root.querySelectorAll('.wd-in-slider').forEach(function(sl) {
        const slides = Array.from(sl.querySelectorAll('.wis-slide'));
        const dots   = Array.from(sl.querySelectorAll('.wis-dot'));
        if (slides.length < 2) return;
        let cur = 0;
        function go(n) {
          slides[cur].classList.remove('wis-active');
          dots[cur] && dots[cur].classList.remove('wis-dot-on');
          cur = (n + slides.length) % slides.length;
          slides[cur].classList.add('wis-active');
          dots[cur] && dots[cur].classList.add('wis-dot-on');
        }
        sl.querySelector('.wis-prev')?.addEventListener('click', function(e) { e.stopPropagation(); go(cur - 1); });
        sl.querySelector('.wis-next')?.addEventListener('click', function(e) { e.stopPropagation(); go(cur + 1); });
        dots.forEach(function(d, i) { d.addEventListener('click', function(e) { e.stopPropagation(); go(i); }); });
        // touch swipe
        var tx = 0;
        sl.querySelector('.wis-track')?.addEventListener('touchstart', function(e) { tx = e.touches[0].clientX; }, {passive:true});
        sl.querySelector('.wis-track')?.addEventListener('touchend', function(e) {
          var dx = e.changedTouches[0].clientX - tx;
          if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
        }, {passive:true});
      });
    };

    /* ââââââââ  DETAIL HTML  ââââââââ */
    function buildDetailHTML(work) {
      const heroSrc = work.img;
      const imgBase = work.img.replace(/\.[^.]+$/, '');
      const d = work.d || {};
      const toHTML = s => (s||'').replace(/\\n/g, '<br>');
      const tagsHTML = (work.tags||[]).map(t => `<span class="detail-tag">${t}</span>`).join('');

      // imgs ãã©ã°ã§åã¹ã­ããã®è¡¨ç¤ºãå¶å¾¡
      // ä¾: imgs:{ a:true, b:true, c:true }
      // æªæå®ã¯ãã¹ã¦ falseï¼ãã¬ã¼ã¹ãã«ãã¼ãªãï¼
      const imgs = work.imgs || {};
      // åæã¹ã­ãã
      const isWide = work.layout === 'wide';
      const imgCls = isWide ? 'wide-single' : 'split-single';
      const mkSlot = (src, cls) => `<div class="img-ph ${cls} lb-trigger" role="button" tabindex="0" aria-label="ç»åãæ¡å¤§"><img src="${src}" alt="" decoding="async" loading="lazy" onerror="this.parentNode.style.display='none'"><span class="lb-zoom-icon">&#10532;</span></div>`;
      const slotA  = imgs.a  ? mkSlot(`${imgBase}_a.webp`,  imgCls) : '';
      const slotA2 = imgs.a2 ? mkSlot(`${imgBase}_a2.webp`, imgCls) : '';
      const slotB  = imgs.b  ? mkSlot(`${imgBase}_b.webp`,  imgCls) : '';
      const slotB2 = imgs.b2 ? mkSlot(`${imgBase}_b2.webp`, imgCls) : '';
      const slotC  = imgs.c  ? mkSlot(`${imgBase}_c.webp`,  'result-wide') : '';
      // ã¹ã©ã¤ãã¼ã©ããã¼ãçæ
      
      // sliderC: creative section slider (e.g. work_02)
      const sliderCSrcs = imgs.sliderC
        ? ['s1','s2','s3','s4','s5'].map(s => mkSlot(imgBase+'_'+s+'.webp','slider-item'))
        : [];
      const colSliderC = imgs.sliderC ? mkSlider(sliderCSrcs) : '';
function mkSlider(slides) {
        if (!slides.length) return '';
        if (slides.length === 1) return slides[0]; // 1æã ããªããã®ã¾ã¾
        const inner = slides.map((s,i) => `<div class="wis-slide${i===0?' wis-active':''}">${s}</div>`).join('');
        return `<div class="wd-in-slider" data-wis-total="${slides.length}">
          <div class="wis-track">${inner}</div>
          <button class="wis-btn wis-prev" aria-label="åã®ç»å">&#8592;</button>
          <button class="wis-btn wis-next" aria-label="æ¬¡ã®ç»å">&#8594;</button>
          <div class="wis-dots">${slides.map((_,i)=>`<span class="wis-dot${i===0?' wis-dot-on':''}"></span>`).join('')}</div>
        </div>`;
      }
      const colA = (slotA || slotA2) ? (isWide ? `<div class="wide-img-row">${slotA}${slotA2}</div>` : mkSlider([slotA, slotA2].filter(Boolean))) : '';
      const colB = (slotB || slotB2) ? (isWide ? `<div class="wide-img-row">${slotB}${slotB2}</div>` : mkSlider([slotB, slotB2].filter(Boolean))) : '';
      // ãã¼ã­ã¼ä¸ã®ãµãæ¨ªé·ç»å
      const slotHero2 = imgs.hero2 ? `<div class="img-ph hero2-wide"><img src="${imgBase}_hero2.webp" alt="" decoding="async" loading="lazy" onerror="this.parentNode.style.display='none'"></div>` : '';

      return `
        <div class="content-wrap">
          <p class="breadcrumb"><a href="#">Work</a> / ${work.title}</p>
          <h1 class="page-title">${work.title}</h1>
          <div class="detail-meta-row">
            <span class="detail-year">${work.year||''}</span>
            <span class="detail-client">${work.client||''}</span>
          </div>
          <div class="detail-tags-row">${tagsHTML}</div>
        </div>
        <div class="hero-block">
          <div class="hero-image-wrap">
            <img src="${heroSrc}" alt="${work.title}"
              decoding="async" fetchpriority="low"
              onerror="this.style.display='none';this.parentNode.style.background='#1a1a1a'">
          </div>
        </div>
        ${slotHero2 ? `<div class="content-wrap">${slotHero2}</div>` : ''}
        <div class="content-wrap">
          ${(work.youtube || work.vimeo) ? `<section class="video-section">
            <div class="video-wrapper">
              ${work.youtube ? `<iframe src="https://www.youtube.com/embed/${work.youtube}?rel=0" title="${work.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` : ''}
              ${work.vimeo ? `<iframe src="https://player.vimeo.com/video/${work.vimeo}" title="${work.title}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : ''}
            </div>
            <p class="video-caption">${work.title}</p>
          </section>` : ''}
          <div class="overview"><p>${toHTML(d.overview||'')}</p></div>
          <section class="section">
            <p class="section-label">Context</p>
            <h2 class="section-title"><span class="num">1</span>èª²é¡ã¨èæ¯</h2>
            <div class="section-body"><p>${toHTML(d.challenge||'')}</p></div>
          </section>
          <section class="section">
            <p class="section-label">Strategy</p>
            <h2 class="section-title"><span class="num">2</span>æ¦ç¥çã¢ãã­ã¼ã</h2>
            <div class="section-body"><p>${toHTML(d.approach||'')}</p></div>
            ${work.youtubeApproach ? `<div class="video-wrapper wd-approach-video"><iframe src="https://www.youtube.com/embed/${work.youtubeApproach}?rel=0" title="${work.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : (colA || '')}
          </section>
          <section class="section">
            <p class="section-label">Creative</p>
            <h2 class="section-title"><span class="num">3</span>ãã ãã</h2>
            ${colSliderC ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colSliderC}` : colB ? (isWide ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}` : `<div class="split-layout"><div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}</div>`) : `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>`}
          </section>
          <section class="section">
            <p class="section-label">Results &amp; Transferability</p>
            <h2 class="section-title"><span class="num">4</span>ææã¨è²¢ç®</h2>
            <div class="section-body"><p>${toHTML(d.result||'')}</p></div>
            ${slotC}
          </section>
          <section class="section" style="margin-bottom:48px;">
            <p class="section-label">Role</p>
            <h2 class="section-title"><span class="num">5</span>å½¹å²ï¼è²¬ä»»ç¯å²ï¼</h2>
            <div class="section-body"><p>${toHTML(d.role||'')}</p></div>
          </section>
          <div class="content-bottom-spacer"></div>
        </div>`;
    }

    /* ââââââââ  STATE  ââââââââ */
    function pfToggle(tag) { pfSelected.has(tag) ? pfSelected.delete(tag) : pfSelected.add(tag); pfUpdate(); }
    function pfUpdate() {
      const outer = document.getElementById('pf-outer');
      const outerAbsTop = outer.getBoundingClientRect().top + window.scrollY;
      const scrolledIn  = Math.max(0, window.scrollY - outerAbsTop);

      // â  ååå¤§ããªé«ãã«ãã¦clampãèµ·ããªãç¶æãä½ã
      outer.style.height = (outerAbsTop + window.innerHeight * 5) + 'px';

      // â¡ åæç»ï¼pfRefreshã¯é«ãã«è§¦ããªãï¼
      pfTagToggling = true;
      pfRenderTags(); pfRenderWorks();
      pfTagToggling = false;

      const newDist = pfCfg.scrollDist || 0;

      // â¢ å¿è¦ãªãåã«ã¹ã¯ã­ã¼ã«ä½ç½®ãå®å¨ãªå¤ã¸ï¼é«ãè¨­å®ã®åã«å®æ½ï¼
      const safeScrolledIn = Math.min(scrolledIn, newDist);
      window.scrollTo({ top: outerAbsTop + safeScrolledIn, behavior: 'instant' });

      // â£ scrollYãå®å¨ãªå¤ã«ãªã£ã¦ããé«ããè¨­å® â clampãèµ·ããªã
      outer.style.height = (window.innerHeight + newDist) + 'px';

      pfTick();
      document.getElementById('pf-clear').classList.toggle('pf-visible', pfSelected.size > 0);
    }
    document.getElementById('pf-clear').addEventListener('click', () => { pfSelected.clear(); pfUpdate(); });
    window.addEventListener('scroll', pfTick, { passive: true });
    window.addEventListener('resize', pfRefresh);
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', pfUpdate); }
    else { pfUpdate(); }

  })();

/* ââââââââââââââââââââââââââââââââââ
   Modal Scrollbar
ââââââââââââââââââââââââââââââââââ */
  /* ââ  Profile Section â Avatar Upload & Timeline Reveal  ââ */
  (function () {
    // Avatar upload
    const profUpload = document.getElementById('profAvatarUpload');
    const profImg    = document.getElementById('profAvatarImg');
    if (profUpload && profImg) {
      profUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          profImg.src = ev.target.result;
          profImg.classList.add('loaded');
        };
        reader.readAsDataURL(file);
      });
    }

    // Timeline reveal on scroll (IntersectionObserver)
    const profItems = document.querySelectorAll('.prof-tl-item');
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const items = entry.target.querySelectorAll('.prof-tl-item');
            items.forEach((item, i) => {
              setTimeout(() => item.classList.add('visible'), 100 + i * 160);
            });
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      const timeline = document.querySelector('.prof-timeline');
      if (timeline) obs.observe(timeline.closest('.prof-right'));
    } else {
      profItems.forEach(item => item.classList.add('visible'));
    }
  })();

/* ââââââââââââââââââââââââââââââââââ
   Smooth Scroll Navigation
ââââââââââââââââââââââââââââââââââ */
  /* ââ  Custom Cursor â frosted glass  ââ */
  (function () {
    const wrap = document.getElementById('cursor-wrap');

    let mx=0, my=0, cx=0, cy=0;
    const LAG = 0.55;
    const lerp = (a,b,t) => a+(b-a)*t;

    // Disable on touch/tablet devices
    const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
    if (isTouchDevice()) return;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (wrap.style.opacity === '0') wrap.style.opacity = '';
    });

    (function tick() {
      cx = lerp(cx, mx, LAG);
      cy = lerp(cy, my, LAG);
      wrap.style.left = cx + 'px';
      wrap.style.top  = cy + 'px';
      requestAnimationFrame(tick);
    })();

    // Hide when leaving window
    document.addEventListener('mouseleave', () => { wrap.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { wrap.style.opacity = ''; });
  })();

/* ââââââââââââââââââââââââââââââââââ
   Custom Cursor
ââââââââââââââââââââââââââââââââââ */
  /* ââ  Smooth Scroll Navigation  ââ */
  (function () {
    const TARGETS = {
      top:       () => ({ top: 0 }),
      strengths: () => {
        const el = document.getElementById('strong-section');
        return el ? { top: el.getBoundingClientRect().top + window.scrollY - 0 } : { top: 0 };
      },
      work: () => {
        const el = document.getElementById('pf-outer');
        return el ? { top: el.getBoundingClientRect().top + window.scrollY - 0 } : { top: 0 };
      },
      about: () => {
        const el = document.getElementById('about');
        return el ? { top: el.getBoundingClientRect().top + window.scrollY - 0 } : { top: 0 };
      }
    };

    function scrollTo(key) {
      const pos = TARGETS[key] ? TARGETS[key]() : null;
      if (!pos) return;
      window.scrollTo({ top: pos.top, behavior: 'smooth' });
    }

    document.querySelectorAll('[data-scroll]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        scrollTo(el.dataset.scroll);
      });
    });
  })();

