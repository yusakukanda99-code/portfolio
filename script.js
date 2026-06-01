/* ══════════════════════════════════
   Ink Reveal Animation
══════════════════════════════════ */
    // ── 画像リスト（仮画像 / 本番は実ファイルパスに差し替え） ──
    const IMAGE_SRCS = [
      "img/top/top_01.webp",
    ];
    const CYCLE_INTERVAL = 4000; // 4秒

    const cv  = document.getElementById('ink-canvas');
    const ctx = cv.getContext('2d');

    let W = 0, H = 0;
    let imgDrawX = 0, imgDrawY = 0, imgDrawW = 0, imgDrawH = 0;
    let animId = null;
    let finished = false;

    // 現在表示中の画像インデックス
    let currentIdx = 0;

    // 直前の完成フレームを保持するオフスクリーンキャンバス
    let prevCanvas = null;

    const BLUR_STEPS = [20, 14, 9, 5, 2, 0];
    let blurLevels = [];

    // 画像オブジェクトのキャッシュ
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

    // blur用の縮小解像度 (0.5倍でもブラーは判別不能なほど同じ見た目)
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
    // フレームごとに使い回すオフスクリーンCanvas（毎フレームnewしない）
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

    // 現在の canvas 状態を prevCanvas に保存（drawFull後に呼ぶこと）
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

        // 再利用Canvasでフレームごとのアロケーション&GCを排除
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
        // inkOffはフルサイズなので縮小してマスク合成
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
        // 半解像度maskedCanvasをフルサイズに拡大描画
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

    // テキストを1文字ずつspanに分割してアニメーション
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

    // スクロール時のアドレスバー収縮で比率が変わらないよう初回高さを固定
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

    // 次の画像へサイクル
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

    // 全画像をプリロード
    async function init() {
      setSize();
      // 画像ロード有無にかかわらず必ずrevealする保険タイマー
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

    // ink canvas を遅延初期化 – ファーストペイントをブロックしない
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

/* ══════════════════════════════════
   Scroll Crossfade + Strong Section Animation
══════════════════════════════════ */
    const overlay      = document.getElementById('bg-overlay');
    const colRightBg   = document.getElementById('col-right-bg');
    const heroText     = document.getElementById('hero-text');
    const sSectionEl   = document.getElementById('strong-section');
    const mainNav      = document.getElementById('main-nav');
    const NAV_GAP      = 24;
    const NAV_H        = 52;
    const SCROLL_END   = window.innerHeight * 0.6;

    // ファーストビュー: nav を画面下部に初期配置
    const navBottomTop = window.innerHeight - NAV_H - NAV_GAP;
    mainNav.style.top  = navBottomTop + 'px';

    // 初期状態
    sSectionEl.style.opacity = '0';

    let sContentRevealed = false;
    let bgReadyDone      = false;
    let navReachedTop    = false; // nav が上端に到達したら固定

    let _scrollRafId = null;
    window.addEventListener('scroll', () => {
      if (_scrollRafId) return;
      _scrollRafId = requestAnimationFrame(() => {
        _scrollRafId = null;
        const progress = Math.min(1, Math.max(0, window.scrollY / SCROLL_END));

      // Nav: 下→上（一度上端に達したら固定したまま戻さない）
      if (!navReachedTop) {
        const navTop = navBottomTop + (NAV_GAP - navBottomTop) * progress;
        mainNav.style.top = navTop + 'px';
        if (progress >= 1) {
          navReachedTop = true;
          mainNav.style.top = NAV_GAP + 'px';
        }
      }

      // TOP フェードアウト (bg-overlay が白くなってキャンバスを覆い隠す)
      overlay.style.opacity    = progress;
      colRightBg.style.opacity = 1 - progress;
      heroText.style.opacity   = 1 - progress;
      document.querySelector('.col-right').style.pointerEvents = progress > 0.9 ? 'none' : '';

      // Strengths のフェードイン・コンテンツ発火は IntersectionObserver 側で実施
      // （DOM順序が Top → Work → Strengths となったため、scrollY ベースでは制御せず
      //   strong-section が viewport に近づいた瞬間に1回だけ発火させる）
      }); // rAF
    }, { passive: true });

    // Strengths セクションの初回表示時にフェードイン＋コンテンツアニメ発火
    // （sContentRevealed フラグで一度だけ発火・以降は再発火しない）
    if ('IntersectionObserver' in window) {
      const strongObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !sContentRevealed) {
            sContentRevealed = true;
            sSectionEl.style.opacity = '1';
            sSectionEl.classList.add('s-bg-ready');
            bgReadyDone = true;
            revealStrongContent();
            strongObserver.disconnect();
          }
        });
      }, { rootMargin: '-20% 0px' });
      strongObserver.observe(sSectionEl);
    } else {
      // IntersectionObserver 非対応環境のフォールバック: 即時表示
      sSectionEl.style.opacity = '1';
      sSectionEl.classList.add('s-bg-ready');
      bgReadyDone = true;
      if (!sContentRevealed) { sContentRevealed = true; revealStrongContent(); }
    }

    // ── Strong Section コンテンツアニメーション ──

    // TOPと同じ文字ランダムフェード
    function splitAndAnimateStrong(el, startDelay, duration) {
      // u タグ等を保持しつつ文字分割
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
          // u タグなどはラッパーごと保持
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

      // 画像: Ink reveal アニメーション
      startStrongImgAnim();

      // テキスト要素アニメーション
      const eyebrow = section.querySelector('.s-eyebrow');
      const title   = section.querySelector('.s-main-title');
      const rule    = section.querySelector('.s-rule');
      const intros  = section.querySelectorAll('.s-intro');
      const sep     = section.querySelector('.s-sep');
      const skills  = section.querySelectorAll('.s-sk');

      // eyebrow
      eyebrow.style.animation      = 's-fadeUp 0.6s ease both';
      eyebrow.style.animationDelay = '0.1s';

      // title: 1文字ずつランダムフェード
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

    // ── Strong セクション画像 Ink Reveal ──
    function startStrongImgAnim() {
      const img = document.getElementById('s-diagram-img');
      // 少し遅延を置いてからフェードイン
      setTimeout(() => {
        img.classList.add('s-img-visible');
      }, 150);
    }

/* ══════════════════════════════════
   Portfolio / Work Section
══════════════════════════════════ */
  (function () {

    /* ════════  DATA – 21 works  ════════ */
    const PF_WORKS = [
      {
        id:6, year:'2025',
        title:'ながくてアートブック（あいちトリエンナーレ パートナーシップ）',
        category:'Event / Community Art',
        tags:['SNS','イベント','動画制作','デジタル','プライベート','デザイン'],
        img:'img/works/work_06/work_06.webp',
        slides:[
          'img/works/work_06/work_06_slide01.webp','img/works/work_06/work_06_slide02.webp',
          'img/works/work_06/work_06_slide03.webp','img/works/work_06/work_06_slide04.webp',
          'img/works/work_06/work_06_slide05.webp','img/works/work_06/work_06_slide06.webp',
          'img/works/work_06/work_06_slide07.webp','img/works/work_06/work_06_slide08.webp',
          'img/works/work_06/work_06_slide09.webp','img/works/work_06/work_06_slide10.webp',
          'img/works/work_06/work_06_slide11.webp','img/works/work_06/work_06_slide12.webp',
          'img/works/work_06/work_06_slide13.webp','img/works/work_06/work_06_slide14.webp',
          'img/works/work_06/work_06_slide15.webp','img/works/work_06/work_06_slide16.webp',
          'img/works/work_06/work_06_slide17.webp','img/works/work_06/work_06_slide18.webp',
          'img/works/work_06/work_06_slide19.webp','img/works/work_06/work_06_slide20.webp',
          'img/works/work_06/work_06_slide21.webp','img/works/work_06/work_06_slide22.webp',
        ],
        client:'あいちトリエンナーレ・ながくてアートフェスティバル実行委員・名古屋芸術大学・日東工業株式会社',
        d:{
          overview:'あいちトリエンナーレのパートナーシップとして参加したアートイベントを、企画から運営まで立ち上げ。Instagramでの運用と現場運営（規約・搬入方法など）の両輪で、<strong>300名を超える方にご来場</strong>いただきました。',
          challenge:'大学・自治体・トリエンナーレ運営・出展者・来場者と、多くの関係者が交差するプロジェクト。あいちトリエンナーレの品質基準を満たしながら幅広い層にも届ける、という両立を、仕組みのない状態から構築する必要がありました。集客チャネルも会場運営も白紙からのスタートでした。',
          approach:'<ul><li><strong>短期集中のInstagram運用：</strong> 開始3ヶ月前にInstagramを開設し、制作過程を継続発信。認知と応募を同時に拡大。写真・動画・キャラクターは運営チームですべて内製</li><li><strong>出展者の安心設計：</strong> 搬入・搬出・著作権ルールを整理し、初参加でも迷わない運営マニュアルを整備</li><li><strong>データの蓄積：</strong> 反応・参加状況を記録し、次回以降に継承できる基盤として残す</li></ul>',
          role:'企画・実行責任者の1人。SNS戦略・運用、出展者選考、会場設営、当日運営までを指揮。',
          creative:'トリエンナーレの作品性に寄せつつ、幅広い層に届くよう<strong>親しみやすいポップなキャラクター</strong>をメインビジュアルに使用。明るいオレンジを基調に、動画ではキャラクターを大きく動かし効果音を添えて、初めて見る人でも気軽に手に取れる雰囲気を演出しました。',
          result:'<ul><li><strong>目標を上回る動員：300名</strong></li><li><strong>出展応募:22名</strong></li><li>Instagram（運用2ヶ月時点）：<strong>平均再生時間17秒</strong> ／ <strong>スキップ率64%</strong> ／ <strong>プロフィール流入率36.3%</strong></li><li><strong>地域アートイベントとしての継続基盤を確立</strong>。次回以降に活かせる運営データと関係者ネットワークを蓄積</li></ul><br>※ 保存率は伸びず、制作期間の短さも課題として残った。次回は「応募に直結する誘導設計」のブラッシュアップに取り組む方針。<br><br>▶ 運用したInstagramアカウント：<a href="https://www.instagram.com/hits_mcd_artbook.project/" target="_blank" rel="noopener">@hits_mcd_artbook.project</a>'
        }
      },
      {
        id:2, year:'2023–2026',
        youtubeApproach:'nGfB2WvLpgQ',
        title:'YouTubeチャンネル ミカタチャンネル',
        category:'Digital / SNS',
        tags:['SNS','動画制作','デジタル','デザイン'],
        img:'img/works/work_02/work_02.webp',
        imgs: { b:true, b2:true, sliderC:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'中小企業オーナー・経営者をターゲットに、税務・相続・経営の専門知識を動画コンテンツ化。<strong>企画MTGから撮影・編集・投稿・分析までを一人で担当</strong>した、ミカタ税理士法人の公式YouTubeチャンネル運用プロジェクト。',
          challenge:'短期の再生数ではなく「検索され続ける資産」として知見を蓄積する設計と、長期にわたる継続的な分析・改善が求められました。',
          approach:'<ul><li><strong>ストック型コンテンツの設計：</strong> 単発の再生数ではなく「検索され続ける資産」を狙って企画</li><li><strong>フォーマットの役割設計：</strong> 長尺（解説＝登録・収益）とショート（認知＝リーチ）を役割で使い分け、目的に応じて制作・配信を運用</li></ul>',
          creative:'<ul><li><strong>データドリブンな改善：</strong> YouTube Analyticsで流入経路・視聴維持率・収益を継続的に分析し、テーマ選定と動画構成に反映</li></ul>',
          result:'<ul><li>代表例として贈与の解説動画1本が、公開から数年経っても継続的に視聴され、累計45万回再生・この動画経由のチャンネル登録 約4,000件を記録。推定収益はチャンネル全体の約6割を単独で生み続ける主力コンテンツに成長</li><li><strong>ペイドメディア連動：</strong> 直近は広告配信と連動したショート設計で月間 約11.7万人にリーチ、視聴継続率 60.9%（短尺広告として高水準）を達成</li></ul><br>→ 「課題発見 → 企画 → 制作 → 効果測定」を一人で回し、コンテンツの価値を再生数・登録・継続率という数値で示せることの証明。',
          youtubeShort:'rFJLmQVPnyI',
          role:'企画MTGの参加 → 撮影 → 編集 → 投稿 → 分析まで一人で担当。'
        }
      },
      {
        id:1, year:'2025',
        youtube:'Ll2MaM-uSSI',
        title:'企業動画 ー オーナーの一生に伴走する',
        category:'Branding / Video',
        tags:['動画制作','デジタル'],
        img:'img/works/work_01/work_01.webp',
        client:'ミカタグループ・株式会社グラッドキューブ',
        imgs:{ a:false, b:false, c:false },
        d:{
          overview:'ミカタ税理士法人のブランディング動画の<strong>企画・制作・配信のディレクション</strong>を担当。「経営と、人生の、味方になる。」というビジョンを軸に、<strong>2026年1月15日よりYouTube・TVer・タクシー広告・屋外大型ビジョン</strong>で全国展開中。',
          challenge:'「税理士＝事務的・過去の数字を扱う仕事」という固定的なイメージを払拭することが課題でした。ミカタグループの強みである「経営者の人生（ライフステージ）に深く寄り添う姿勢」を、機能説明ではなく感情に訴える形で記憶に残す必要がありました。',
          approach:'<ul><li><strong>コンセプトの方向性：</strong> 「人生にリタイアは存在しない」というメッセージを軸に、税理士を「生涯並走するパートナー」として描く方向性を制作会社と合意・採択</li><li><strong>ターゲットへの心理設計：</strong> 「数字は過去ではなく未来を描くもの」というコピーで、守りの士業を「未来を創る存在」へと言い換え</li><li><strong>マルチチャネル配信設計：</strong> 経営者層の行動導線に合わせて、Web媒体・モビリティ広告・屋外ビジョンの複合展開を計画</li></ul>',
          role:'企画・制作・配信のディレクションを担当。コンセプト・コピーの方向性確認、香盤表・コンテンツの整合チェック、デザイン・映像の品質管理、配信スケジュール管理を取りまとめ。',
          creative:'<ul><li><strong>シネマティックな映像表現：</strong> モノクロームと光のコントラストを生かした制作会社のクリエイティブを採択。重厚なナレーションとの相乗で、15〜30秒で「誠実さ」「プロフェッショナリズム」を伝える設計を承認</li><li><strong>トータルブランディングの展開：</strong> 動画にとどまらず、Web・スチール・グラフィックへ世界観を横展開。どのチャネルでも一貫したメッセージを受け取れる形に整理</li></ul>',
          result:'<ul><li><strong>既存の士業の枠を超えたブランド印象の構築に寄与</strong>。「経営者の孤独に寄り添ってくれる」という共感の声が寄せられている</li><li><strong>大規模なマルチチャネル展開を達成：</strong><ul><li>動画プラットフォーム：YouTube／TVer</li><li>Web媒体（DSP配信）：東洋経済オンライン／朝日新聞デジタル ほか</li><li>モビリティ広告：タクシー広告（近畿・東海エリア／GO中心）</li><li>屋外大型ビジョン：鹿児島（Li-Ka／センテラス／天文館）、沖縄（あしび／那覇てんぷす）</li></ul></li></ul><br>※ 認知・共感が主目的の施策のため、今後は動画→Webサイト流入→お問い合わせという<strong>コンバージョン導線の設計</strong>を次のテーマとして取り組む方針。'
        }
      },
      {
        id:17, year:'2018',
        title:'Sony FES Watch U デザインコンペ',
        category:'Design Competition',
        tags:['プライベート','デザイン'],
        img:'img/works/work_17/work_17.webp',
        imgs: { a:true },
        client:'Sony Fashion Entertainments（個人応募）',
        d:{
          overview:'ソニーの電子ペーパー製ウォッチ「FES Watch U」のデザインコンペに個人応募し、全国から<strong>32組の公認クリエイターに選出</strong>。採用デザインはソニー公式サイト・専用アプリ「FES Closet」、全国の百貨店での展示販売にまで展開された。',
          challenge:'ソニーの「Fashion Entertainments」が主催した公募プロジェクト。電子ペーパー製の文字盤とベルトを着せ替えできるウォッチに対し、テーマ「多様性」のもと、最先端技術の上に<strong>文化的な物語性を宿らせる</strong>デザインが求められました。',
          approach:'<ul><li><strong>テーマの解釈：</strong> 「多様性」という公募テーマに、「時間」という普遍テーマを掛け合わせ、日本人の美意識から接続するコンセプトを設計</li><li><strong>素材特性への着目：</strong> 文字盤が「紙（電子ペーパー）」であることに着目し、水墨画や日本美術が持つ<strong>「余白の力」をデジタルデバイス上で再現する</strong>方針</li><li><strong>コンセプトの結晶化：</strong> 「動かない中に時間が流れている」という矛盾した美を、最小限の要素で表現する方針を採用</li></ul>',
          role:'公認クリエイター（個人応募）。コンセプト立案、グラフィックデザイン制作（文字盤・ベルト）、作品世界観の構築までを一人で担当。',
          creative:'<ul><li><strong>文字盤のミニマル設計：</strong> モノクロームに徹し、大きな余白と最小限の線・形だけで構成。<strong>水面に映る月</strong>のような円形モチーフで「静の中にある動き」を視覚化</li><li><strong>ベルトのグリッドパターン：</strong> 水面の波紋・格子を想起させるグリッドを採用し、文字盤の静けさと呼応する動きのリズムを構築</li></ul>',
          result:'<ul><li><strong>全国から集まった応募作品の中から、32組の公認クリエイターに選出</strong>（PR TIMES掲載・公式発表）</li><li>採用デザインがソニー公式サイト・専用アプリ「FES Closet」を通じて世界へ配信</li><li><strong>阪急メンズ東京・高島屋横浜店・静岡伊勢丹・大丸神戸店</strong>にて展示販売を展開</li></ul>'
        }
      },
      {
        id:22, year:'2023–2026',
        title:'メールマガジン運用 ー Salesforce Pardot',
        category:'Email Marketing / Pardot',
        tags:['メルマガ','デジタル','デザイン'],
        img:'img/works/work_22/work_22.webp',
        slides:[
          'img/works/work_22/work_22_banner01.webp',
          'img/works/work_22/work_22_banner02.webp',
        ],
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'マーケティングオートメーションツール「Salesforce Account Engagement（旧 Pardot）」を活用し、メールマガジンの実装・デザイン・記事作成・配信・分析までを単独で一気通貫に担当。税制改正などの実益情報から季節のご挨拶まで、お客様との関係を継続的に育てる広報基盤を社内に構築したプロジェクト。',
          challenge:'ミカタグループは税理士・会計・法務など複数の専門領域を持つ総合グループですが、お客様への情報発信は各現場の担当者任せになっており、会社として一貫したタイミング・内容での発信ができていませんでした。税制改正・法改正といった時事性の高い情報や、季節の挨拶・年末年始スケジュールといった顧客関係維持に不可欠なコミュニケーションが体系的に管理されておらず、メールマガジンは「配信し続けて初めて関係が育つ」一方で、読み飛ばされず開封・閲覧してもらう設計が必要でした。',
          approach:'Salesforce Account Engagement（Pardot）上で、メールの実装からデザイン・記事作成・配信・効果測定までを単独で完結する運用体制を構築しました。メルマガは①「実益型」（税制改正大綱の概略・法改正ポイントなど）と②「情緒型」（暑中見舞い・年末年始告知などの季節のご挨拶）の2種類で設計。配信曜日・時刻は自社データと業界データを分析し、開封率が高い火〜木曜日の午前8時台に統一しました。配信後はPardotの開封率・クリック率を継続的に分析し、件名やバナー・記事構成の改善に反映しています。',
          creative:'代理店から引き継いだメルマガテンプレートはdivの枠組みのみの最小構成でした。そこから自身でHTMLコーディングとテストを重ね、背景色・リスト・枠線・カラムレイアウトなど複数のデザインパターンを段階的に拡充。季節のご挨拶ではビジュアルを刷新（夏：風鈴・朝顔のイラスト、冬：クリスマスリースなど）し、アニメーションを取り入れてメール上でも目に留まる動きのある表現に仕上げました。各回でMIKATAブランドのトンマナを損なわないデザイン統一を徹底しています。',
          result:'<strong>1配信あたり約16,500件・月6本ペース</strong>で配信。配信到達率99.77%、<strong>平均開封率 約30%</strong>（B2B平均 15〜25%を上回る水準）、<strong>平均クリック率 1.54%</strong>。配信リストの品質を継続的に維持。',
          role:'メールマガジン運用の全工程を単独で担当。Salesforce Account Engagement（Pardot）での実装、HTML・バナー・アニメーションのデザイン、記事・配信文のコピーライティング、配信設計、開封率・クリック率の分析と改善。'
        }
      },
      {
        id:12, year:'2023–2026',
        title:'デジタルマーケティング運用 ── 獲得から育成まで',
        category:'Digital Marketing',
        tags:['デジタル','デザイン'],
        img:'img/works/work_12/work_12.webp',
        slides:[
          'img/works/work_12/work_12_a.webp','img/works/work_12/work_12_a2.webp',
          'img/works/work_12/work_12_b.webp',
          'img/works/work_13/work_13_a.webp','img/works/work_13/work_13_a2.webp',
          'img/works/work_13/work_13_b.webp',
        ],
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'ミカタグループのデジタルマーケティングを、ディスプレイ広告による新規獲得（Paid）と、オウンドメディアによる関係育成（Owned）の両輪で運用。データを見ながら継続的に改善し、獲得から育成までを一貫して担当したプロジェクトです。',
          challenge:'新規の見込み客をいかに効率よく獲得し（Paid）、獲得後にいかに信頼を育てて関係を維持するか（Owned）という、ファネル全体の設計が課題でした。広告は設立期の起業家と既存中小企業で関心軸が異なり、オウンド側は専門知識が社外にほとんど届いていない状況。獲得と育成を分断せず、一貫した運用にする必要がありました。',
          approach:'【獲得 / Paid ＝ ディスプレイ広告】AI生成画像をレタッチしてターゲット別に最適化したビジュアルを採用し、日々ABテストで人物配置やテキストをデータから厳選。クリック率（CTR）と獲得コスト（CPA）を継続的に改善しました。あわせて、P-MAX広告が狙うターゲット（ペルソナ・キーワード）を踏まえてオウンドメディアのコンテンツを最適化し、Paid と Owned を連動させました。\\n\\n【育成 / Owned ＝ オウンドメディア】税制改正（定額減税・年収の壁など）といった検索されやすいテーマを選定（SEO）して記事を継続発信し、サムネイルを毎回デザイン制作。代表コラム「柴田昇の眼」で会社の姿勢や人となりを届け、問い合わせ前から信頼を積み上げました。',
          creative:'広告クリエイティブは人物画像をAIで生成し、Photoshopでレタッチ後にIllustratorで作成。設立＝初心者という連想からグリーンを用いるなど、ターゲット心理に合わせた複数バリエーション（若い男性・年配の専門家・女性・対談風など）を展開しました。オウンドメディアのサムネイルはテーマごとに変化をつけつつ、ミカタグループのブランドイメージを崩さない統一感を保ち、難しい税務テーマを「思わず読みたくなる」見出しと構成に落とし込みました。',
          result:'広告では クリック率（CTR）の向上と獲得コスト（CPA）の最適化を実現。オウンドメディアでは継続的なSEO発信で検索流入を増やし、代表コラムが対外発信の柱として機能しています。獲得（Paid）と育成（Owned）を連動させることで、属人的になりがちだった情報発信を会社として継続できる、フルファネルの運用体制を確立しました。',
          role:'デジタルマーケティング運用全般。広告＝AI活用・レタッチ・ABテストによるクリエイティブ改善とデータに基づく提案。オウンド＝テーマ選定（SEO）・記事制作・サムネイルデザイン・代表コラムの整理掲載。Paid広告のターゲット（ペルソナ・キーワード）を踏まえたオウンドコンテンツの最適化（Paid×Owned連携）。'
        }
      },
      {
        id:10, year:'2026',
        title:'MIKATAグループ採用サイト ── 採用ブランディングの統合設計と実装',
        category:'Recruitment Branding / Web & Content Design',
        tags:['採用','デジタル','デザイン'],
        img:'img/works/work_10/work_10.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'MIKATAグループの採用サイトを、現場ヒアリングからサイト設計・コンテンツ制作・カメラマンのディレクション・Pardot実装まで一貫して担当。<strong>6つのコンサルタント職種ページ、6つの採用ルート、複数の社員インタビュー・座談会</strong>を含む多層IAを、採用ブランディング全体として設計・実装した。',
          challenge:'採用市場での専門コンサルタント獲得競争が激化する中、複数職種（事業承継・金融・M&A・財務・労務・相続）の特性とキャリア像を、応募者の納得感を持って伝える統合型サイトが必要でした。現場のリアルを応募者に届ける情報設計と、応募導線まで含めた仕組みが求められました。',
          approach:'<ul><li><strong>現場ヒアリング起点の情報設計：</strong> 採用担当者および各事業部のコンサルタントへヒアリングし、職種ごとのリアルを抽出。応募者の知りたい順にIAを組み立て</li><li><strong>職種別の深掘りコンテンツ：</strong> 金融コンサルタントをはじめ複数職種について、<strong>仕事内容・キャリアロードマップを企画・執筆・デザイン</strong>まで一貫して担当</li><li><strong>撮影ディレクション：</strong> カメラマンと連携し、社員インタビュー・座談会・働く環境の撮影を企画。応募者が「働く自分」を想像できるビジュアルに整理</li><li><strong>Pardotによる応募導線：</strong> カジュアル面談・応募フォームを Pardot で構築し、応募者の行動を計測できる体制を整備</li></ul>',
          role:'採用ブランディング全体のディレクター兼デザイナーとして<strong>一貫して担当</strong>。現場ヒアリング、採用担当者とのコンテンツ調整、サイト設計、職種別ページ（コンテンツ作成・ロードマップ作成・デザイン）、カメラマンのディレクション、Pardot設定・実装まで。',
          creative:'<ul><li><strong>キャリアロードマップの設計：</strong> 「専門コンサルタント／経営コンサルタント／コーポレート」の3キャリアパスを可視化。職種別の成長軌道を、応募者が直感的に追える図として設計</li><li><strong>応募者視点のIA：</strong> 「会社を知る／環境／仕事／人／採用情報」の5本柱で、検討プロセスに沿った導線を構築。職種ページ・社員インタビュー・座談会を相互に行き来できる構造に</li><li><strong>撮影トーンの統一：</strong> 社員インタビュー・座談会・働く環境を、シネマティックでありながら親しみやすい光量・表情で統一</li></ul>',
          result:'<ul><li><strong>2026年公開</strong>。応募者が職種・キャリア・人・環境を多角的に検討できる<strong>統合型採用サイト</strong>として運用開始</li><li><strong>ブランドのトンマナを統一</strong>したまま、複数職種それぞれの魅力を分けて見せる構造を実現</li><li><strong>Pardotによる応募導線の可視化</strong>で、応募者の行動データを継続的に取得・改善できる土台を構築</li></ul><br>公開URL：<a href="https://mikata-c.co.jp/recruit.html" target="_blank" rel="noopener">mikata-c.co.jp/recruit.html</a>'
        }
      },
      {
        id:3, year:'2026',
        title:'ミカタの相続サイト & パンフレット制作',
        category:'Web / Print',
        tags:['デジタル','印刷物'],
        img:'img/works/work_03/work_03.webp',
        imgs: { a:true },
        layout: 'wide',
        captionA2: 'ミカタの相続サービスロゴ<br><a href="https://mikata-souzoku.jp/" target="_blank" rel="noopener">公式サイト：https://mikata-souzoku.jp/</a>',
        client:'ミカタグループ・大日本印刷株式会社・クラウドサーカス株式会社',
        d:{
          overview:'相続という複雑なテーマに不安を抱えるご家族へ、「安心できる」「何をすればいいかわかる」と感じてもらえるWebサイト＆パンフレットを制作。外部制作会社と連携し、ブランド統一を保って設計・実装。<strong>2026年2月の広告出稿開始後、相談5件を獲得</strong>。',
          challenge:'大切な方を亡くされた直後のご家族は、深い悲しみの中で複雑な手続きや厳しい期限に追われます。既存資料は文字量が多くかえって不安をあおる傾向があり、手に取った瞬間に「安心できる」「何をすればいいかわかる」と感じてもらえる資料が必要でした。',
          approach:'<ul><li><strong>日程の可視化：</strong> 申告期限など重要日程をカレンダー形式で見える化し、自身で行うことと専門家に任せることを明確に区別</li><li><strong>読みやすさの徹底：</strong> UDフォント・文字サイズ・行間を細かく指定し、高齢の方を含めた幅広い読者に届く紙面に</li><li><strong>Webと冊子のブランド統一：</strong> 外部制作会社と連携し、Webと冊子の色使い・雰囲気がずれないよう管理</li></ul>',
          role:'制作全体のディレクションを担当。外部制作会社への指示、品質・進行の管理、Webとパンフレットのブランド整合のチェックまで取りまとめ。',
          creative:'<ul><li><strong>緑色基調の柔らかい印象：</strong> 「相続は難しい」という先入観を取り除くため、緑色を基調に柔らかく親しみやすいトーンへ</li><li><strong>文字の強弱で情報設計：</strong> 内容が複雑な分、文字の太さに変化をつけて強弱を生み、読み進めやすい誌面に</li></ul>',
          result:'<a href="https://mikata-souzoku.jp/" target="_blank" rel="noopener">mikata-souzoku.jp</a>（2026年2月公開）。広告クリエイティブと併せて運用開始後、<strong>4ヶ月で問合せ102件を獲得</strong>。月次の問合せ件数は<strong>2月19件 → 5月33件</strong>と着実に拡大し、相続手続きへの相談導線を確立した。'
        }
      },
      {
        id:24, year:'2026',
        title:'社内開発AI対応PDF業務基盤「pdf-annotator」',
        category:'Internal Tool / UX & Development',
        tags:['デジタル','デザイン'],
        img:'img/works/work_24/work_24.webp',
        client:'ミカタグループ（ミカタ税理士法人）',
        d:{
          overview:'AI時代の社内ドキュメント業務基盤を、ブラウザ完結の自社ツールとして設計・開発。現場調査・UI/UXデザイン・Claudeを活用した実装まで一貫して担当し、<strong>年間約1,200万円のコスト削減を試算</strong>。AI連携を含む業務再設計を目指したプロジェクト。',
          challenge:'社内で長年使用していた既存ドキュメントツールには、公式サポート終了に伴うセキュリティ面の懸念、顧客納品時のPDF変換の手間、機能カスタマイズが不可といった複数の課題がありました。特に「AI（Claude／Gemini等）がファイルを直接読み込めない」点が業務効率化のボトルネックになっており、AIが直接扱えるPDF形式を中心に据えた自社専用のPDF業務基盤の構築が急務でした。',
          approach:'<ul><li><strong>徹底した現場調査とPMF：</strong> 三島支店で現場担当者と連携し、利用実態とニーズを把握。生の声を開発に直接反映する体制を整備</li><li><strong>Figmaによる高速プロトタイピング：</strong> UI/UXとユーザビリティテストを繰り返し、現場が迷わず使えるデザインシステムを構築</li><li><strong>Claudeを活用したアジャイル開発：</strong> AIアシストで、現場からの要望（D&D結合・階層化グループ化・電子押印など）を短期で実装・継続反映</li></ul>',
          role:'プロダクトマネージャー兼UI/UXデザイナーとして、企画・設計から実装まで<strong>一貫して担当</strong>。現場ニーズ分析、FigmaでのUI/UXデザイン・プロトタイプ作成、Claudeを活用した実装、機能カスタマイズ対応をワンストップで担当。',
          creative:'<ul><li><strong>階層化したページのグループ化(しおり機能)：</strong> 複数PDFをまたいでページをグループ／サブグループに整理でき、保存時にAdobe Acrobat互換のしおり(Bookmark)として書き出し。書類整理から納品までを1ツールで完結</li><li><strong>業務に即した操作・保存設計：</strong> 日本式の電子押印（法人名・部署名・氏名のカスタム）、dpiを「印刷用・画面用・メール用」の用途語に翻訳した保存設計、複数PDFのD&D結合、完備されたキーボードショートカット、Undo/Redoまで Adobe や Office と同じ手の動きで操作可能。技術スタックは pdf.js / fabric.js / jsPDF（バニラJS+3ライブラリ／フレームワーク不使用）</li></ul>',
          result:'<ul><li><strong>年間約1,200万円のコスト削減を試算</strong>（Adobe Acrobat Standard 約1,580円/人/月 × 634名 ≒ 月100万円）</li><li><strong>「PDF × AI」による業務プロセスの再設計：</strong> 書類のAI分析・転記ミス防止、複数年度の横断比較を自動化し、人は「精査・解釈・顧客提案」に集中できる環境を実現</li><li><strong>3層構成での製品化：</strong> ツール本体（PC専用・業務用）＋使い方ガイドサイト（レスポンシブ対応）＋社内発表資料まで設計・実装</li></ul><br>※ 今後は AI連携機能の継続強化（自動仕訳・書類分類など）と社内標準化に向けてアップデートを重ねる方針。'
        }
      },
      {
        id:4, year:'2023–2026',
        title:'ミカタ税理士法人 ビジネスセミナー運営',
        category:'Event Management',
        tags:['イベント','印刷物','デザイン'],
        img:'img/works/work_04/work_04.webp',
        client:'ミカタグループ・九段会館テラス（東京）・ホテルグランヴィア（大阪）・名古屋マリオットアソシアホテル・アークヒルズクラブ（六本木）等',
        youtubeHero2: 'YtF9PEItdBE',
        d:{
          overview:'全国の経営者を対象としたビジネスセミナーを、対面＋配信のハイブリッド形式でゼロから設計・運営。<strong>東京・大阪・名古屋・鹿児島・沖縄・軽井沢・六本木</strong>など、年間を通じて全国各地で<strong>満員御礼を達成</strong>したプロジェクト。',
          challenge:'多忙な経営者に足を運んでいただくには、情報の価値だけでなく「この場に来る意味がある」と感じてもらえる期待感の演出が不可欠でした。対面と配信を同時に行うハイブリッド形式は社内で前例がなく、進行の仕組みや資料のひな形をゼロから作り上げ、再現できる体制へと整える必要がありました。',
          approach:'<ul><li><strong>集客〜当日のデザイン統一：</strong> 案内資料・メール・チラシ・当日資料のトンマナを統一し、参加前から当日まで一貫した印象で集客と認知を最大化</li><li><strong>秒単位の進行設計：</strong> 当日は秒単位の進行表を作成し、会場・配信会社・撮影・食事・アンケートまでを取りまとめ</li><li><strong>再現できる体制化：</strong> ゼロから組み立てた進行表・資料のひな形を「再現可能な型」として残し、複数会場・複数年で横展開</li></ul>',
          role:'総合運営ディレクター。資料・案内物の制作、配信会社・会場・食事の手配、当日の進行管理、カメラ撮影、アンケート管理まで一貫して担当。',
          creative:'<ul><li><strong>信頼感を伝えるビジュアル：</strong> 目に見えないサービス（税務・労務）を扱うため、金融機関を連想させる背景と、文字を大きく使った力強いデザインで表現</li><li><strong>重厚感と新鮮さの両立：</strong> 年複数回開催で毎回印象が同じにならないよう変化をつけつつ、重厚感と信頼感は一貫して維持</li><li><strong>細やかな心配り：</strong> 参加者に「大切にされている」と感じてもらえるよう、案内物から当日進行まで細部に配慮</li></ul>',
          result:'<ul><li><strong>全国各地で満員御礼を達成</strong>し、多くの新規見込み客を獲得</li><li>セミナー運営の実績：<ul><li>2023〜2025年 東京・大阪（各<strong>300名</strong>）</li><li>2024〜2025年 名古屋（各<strong>80名</strong>）</li><li>2024年 ミカタグループ創立30周年パーティ（<strong>700名</strong>）</li><li>2025年 鹿児島（<strong>100名</strong>）・六本木（<strong>90名</strong>）・沖縄（<strong>100名</strong>）・軽井沢（<strong>50名</strong>）※招待制</li></ul></li></ul><br>公開URL：<a href="https://mikata-c.co.jp/seminar/250912.html" target="_blank" rel="noopener">mikata-c.co.jp/seminar/250912.html</a>'
        }
      },
      {
        id:23, year:'2026',
        title:'atelier privé ── アートが日常に滲み出す場の、設計と実装',
        category:'Personal Project / Platform Design & Development',
        tags:['デジタル','プライベート','デザイン'],
        img:'img/works/work_23/work_23.webp',
        client:'Personal Project',
        d:{
          overview:'招待制のアート鑑賞プラットフォーム「atelier privé」を、コンセプト設計から UI・独自カラー体系のデザイン、フロントエンド・バックエンド実装、AI機能、画像保護設計まで<strong>すべて一人で</strong>手がけた個人制作プロジェクト。「探すを出会うへ」を軸に、アートと日常の接点を再設計した。',
          challenge:'既存のアート鑑賞は「能動的に探しに行く」ことを前提とした体験になりがちで、偶然の出会いや継続的な関係性が生まれにくい構造でした。アート作品との接点を「日常に滲み出す」形で再設計することを、個人制作として探求しました。',
          approach:'<ul><li><strong>コンセプト主導の体験設計：</strong> 「探すを出会うへ」「アートが日常に滲み出す場」を体験の中核に据え、招待制で関係性の質を担保</li><li><strong>独自のシステム設計：</strong> 「リターン深度」「帰属の色」「招待の系譜スコア」「場の温度」の4指標、それを表現する非線形カラーグラデーション、年次表彰5部門を独自設計</li><li><strong>アーキテクチャ：</strong> Next.js / React / Supabase / Vercel / Turborepo モノレポ。フロント・バックエンド・認証・DB設計まで単独で実装</li></ul>',
          role:'個人制作プロジェクトとして、コンセプト設計・UI/UXデザイン・カラー体系設計・フロントエンド／バックエンド実装・AI連携・画像保護設計まで一人で担当。',
          creative:'<ul><li><strong>「鑑賞ノート」の体験設計：</strong> 出会った作品を蓄積し、年次で振り返れる形に。画面の中だけでなく、印刷物への展開も構想に含めて設計</li><li><strong>AI時代のアート保護設計：</strong> robots.txt によるクローラー全ブロック、認証エリアの noindex、ウォーターマーク、画像解像度制限（1600px）など、<strong>アーティストの作品がAI学習に無断で使われない</strong>ことを前提に画像配信の全層を設計</li><li><strong>セキュリティ・運用基盤：</strong> Cloudflare Access、TOTP・WebAuthn、重要操作の再認証、ソフトデリート（24h猶予）、監査ログを採用し、招待制の信頼を支える基盤を構築</li></ul>',
          result:'<ul><li><strong>コンセプトから実装まで全工程を一人で完遂</strong>。デザイン・体験設計・実装・セキュリティ・AI対策のすべてを単独で形にした</li><li>独自のカラー体系・指標・体験のシステム化により、<strong>「探すを出会うへ」という思想を体現する形に落とし込んだ</strong></li></ul><br>公開URL：<a href="https://atelierprive.art" target="_blank" rel="noopener">atelierprive.art</a>'
        }
      },
      {
        id:21, year:'2024',
        title:'M&A 会社案内動画',
        category:'Video / Branding',
        tags:['動画制作','ブランディング'],
        img:'img/works/work_21/work_21.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        slides:[
          'img/works/work_21/work_21_a.webp',
          'img/works/work_21/work_21_storyboard_p1.webp',
          'img/works/work_21/work_21_storyboard_p2.webp',
          'img/works/work_21/work_21_a2.webp',
        ],
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'M&A商談時に売主様・従業員様へ「どんな会社に入るのか」を伝えるための会社案内動画を、<strong>約3週間・単独で完遂</strong>。撮影〜編集〜納品まで全工程を一人で担当し、グループインへの不安解消と承継プロセスの円滑化に貢献した。',
          challenge:'ミカタグループがM&Aで新たな拠点を承継する際、売主側の経営者・従業員にとって最大の不安は「どんな会社に入るのか」という点でした。商談での口頭・資料説明だけでは、グループの雰囲気・文化・働く仲間の声を直接感じてもらう機会が不足しており、承継への心理的ハードルが生じていました。',
          approach:'<ul><li><strong>「共感→信頼→安心」の3段階ストーリー設計：</strong> 「会社案内パート」→「代表からのメッセージ」→「働く従業員の声」という流れで構成し、視聴者が段階的に安心感を持てる物語に</li><li><strong>既存会社案内の素材を動画に流用：</strong> ブランドの一貫性を保ちながら制作期間を大幅短縮。<strong>短納期×ブランド統一</strong>を両立する設計判断</li></ul>',
          role:'絵コンテ・図解作図含めた構成設計から、マイクを用いた音声収録設計・撮影、ノイズ除去を含む音声編集・映像編集まで、全工程を単独で担当。',
          creative:'<ul><li><strong>制約下のクリエイティブ判断：</strong> 既存パンフレットの素材を動画に転換することで、新規撮影リソースを最小化。ブランド世界観を崩さず短納期で完成度を担保</li><li><strong>単独進行による意思決定速度：</strong> 撮影〜編集〜納品の全工程を単独で行うことで、外部委託を介さない判断速度でイテレーションを重ねた</li></ul>',
          result:'<ul><li><strong>M&A商談時の説明ツールとして実運用</strong>。売主様・従業員様の「グループインへの不安解消」に貢献し、承継プロセスを円滑化</li><li><strong>約3週間という短納期で、撮影・編集・納品まで一人で完遂</strong></li><li><strong>外部委託ゼロで内製化</strong>を実現し、組織内で動画コンテンツを継続的に作れる体制の足場に</li></ul>'
        }
      },
      {
        id:9, year:'2024',
        title:'マンガでカンタン！相続は7日間でわかります。',
        category:'Publishing / PR',
        tags:['印刷物','デザイン'],
        img:'img/works/work_09/work_09.webp',
        client:'ミカタ税理士法人・株式会社学研ホールディングス',
        d:{
          overview:'相続というテーマを「7日間の講義形式の漫画本」に落とし込んだ書籍『<strong>マンガでカンタン！相続は７日間でわかります</strong>』（学研出版）の制作プロジェクトに、社内側の窓口として参画。<strong>学研より全国出版・販売</strong>を実現し、複雑な専門知識を親しみやすい形で届け、ミカタグループのブランド信頼性向上に貢献した。',
          challenge:'相続は誰もがいつか直面するテーマでありながら、「難しそう」「自分には関係ない」と後回しにされがちな分野です。税理士が書く専門書では手に取ってもらいにくく、難しい内容をいかに身近に感じてもらうかが課題でした。さらに、大手出版社との共同制作として、品質・スケジュール・関係者調整を高水準でやりきることも求められました。',
          approach:'<ul><li><strong>7日間の講義形式という構成方針：</strong> 相続というテーマを章立てし、読者が無理なく段階的に理解できる流れに</li><li><strong>漫画という表現形式の採用：</strong> 堅くなりがちなテーマに親しみやすさを加え、専門書では手に取りにくい層に届ける表現に</li><li><strong>学研との進行統合：</strong> 漫画家の選定・絵柄合わせ・原稿確認・スケジュール管理など、社内側の窓口として一連の進行を取りまとめ</li></ul>',
          role:'出版プロジェクトの社内ディレクター。内容の整理・構成案への関与、絵柄の方向性調整、学研との進行管理・日程調整・打ち合わせ対応を一貫して担当。',
          creative:'<ul><li><strong>読者が自己投影できる3キャラクター設定：</strong> 「面倒くさがりのマンガ家」「すご腕税理士」「好奇心旺盛な編集者」が登場人物として設定され、等身大の人物が学んでいく構成</li><li><strong>「見てわかる」情報設計：</strong> 相続手続きを<strong>すごろく形式</strong>で図解するなど、専門知識のない読者でも迷わず読み進められる視覚化を採用</li></ul>',
          result:'<ul><li><strong>学研より書籍として全国出版・販売を実現</strong></li><li>複雑な専門知識を「7日間で読める漫画本」という形に落とし込み、ミカタグループの知見を広く一般の方へ届ける<strong>媒体として機能</strong></li><li>ブランドの信頼性向上に貢献</li></ul>'
        }
      },
      {
        id:8, year:'2025',
        title:'ひのてり訪問看護ステーション 会社案内パンフレット',
        category:'Print / Branding',
        tags:['印刷物','デザイン'],
        img:'img/works/work_08/work_08.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'株式会社輪奏',
        d:{
          overview:'訪問看護という馴染みの薄い仕組みへの不安を解消し、「ひのてり」の強みを地域に伝えるパンフレットを制作。<strong>自ら現場に足を運んで撮影し、温かみのある実際の現場の表情</strong>を誌面に盛り込んだ。',
          challenge:'訪問看護という、多くの方にとってなじみの薄い仕組みへの不安を解消し、「ひのてり」の強みである「心のケアまで寄り添う姿勢」を地域に伝える必要がありました。利用者だけでなく家族も含めた不安や悩みに応えながら、手に取った瞬間に安心感を感じてもらえる資料づくりが求められました。',
          approach:'<ul><li><strong>現場撮影による温かみの誌面化：</strong> 自ら現場に足を運んで撮影し、実際のスタッフ・利用者の表情を盛り込むことで、写真から温かみが伝わる紙面に</li><li><strong>「利用者の悩み」と「家族の悩み」を分けて整理：</strong> どちらの立場の方が手に取っても「自分ごと」として読み進められる構成に</li><li><strong>複雑な仕組みの視覚化：</strong> サービスの流れや専門スタッフの連携図を大きく描き起こし、ひと目で理解できる紙面構造に</li></ul>',
          role:'<strong>企画（MVV・代表メッセージの言語化を含む）</strong>・撮影・作図・デザイン・執筆まで全工程を単独で担当。',
          creative:'<ul><li><strong>オレンジ基調の温かく近づきやすい印象：</strong> 会社のイメージカラーを軸に、全体を温かく近づきやすいトーンで統一</li><li><strong>「見るだけでわかる」紙面設計：</strong> 写真・イラストを多用し、図を大きく掲載することで、病院や専門家との連携体制が視覚で伝わるように</li><li><strong>想いの言葉化（執筆）：</strong> 企業理念から代表挨拶まで、会社の想いを丁寧に言葉に整理。単なる説明資料を超えた、信頼と温もりを伝える一冊に</li></ul>',
          result:'<ul><li>窓口での説明にかかる手間を大きく削減し、相談から利用開始までの流れをスムーズに</li><li>現場の温度感をそのまま反映し、複雑な情報を<strong>「温かく届ける」資料として機能</strong></li></ul>'
        }
      },
      {
        id:20, year:'2024',
        title:'会社案内・営業資材 トータル制作',
        category:'Branding / Print',
        tags:['印刷物','デザイン'],
        img:'img/works/work_20/work_20.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'創業30周年を迎えるミカタグループの、会社案内（全16ページ）・営業チラシ・各種資材から、ブランドの象徴となる社章までをトータルで統一制作。戦略立案・フォトディレクション・ライティング・グラフィックデザイン・3Dモデリングまで、<strong>全工程を単独で担当</strong>したインハウスブランディングプロジェクト。',
          challenge:'グループのビジョン・ミッション・バリューや、独自のコアサービス「ビジネス＆ライフ・コンサルティング」の全貌を体系的に伝える統一クリエイティブが存在しませんでした。営業担当が個別に作る資料は品質・トンマナがバラバラで、「信頼できるプロフェッショナル集団」としての第一印象を対外的に与えきれていない状態でした。',
          approach:'<ul><li><strong>サービスの構造化・図解化：</strong> 「法人と個人の2つの財布の可視化」「6ステップの成長支援ロードマップ」「4つのソリューション体系」など、独自の複雑なサービスを顧客視点で図解化</li><li><strong>ターゲットに刺さる情報設計：</strong> 営業チラシは中小企業オーナーの課題感に直結したキャッチコピー＋フローチャート＋Q&Aで直感的に理解できる構成に</li><li><strong>3Dビジュアライゼーション提案：</strong> ブランドの象徴となる社章をMayaでモデリング・レンダリングし、経営層へのスムーズな意思決定を促進</li></ul>',
          role:'クリエイティブディレクター・デザイナーとして<strong>全工程を単独で担当</strong>。経営層への提案、代表撮影のフォトディレクション、グラフィックデザイン・作図・ライティング、カラー／フォントのシステム設計、3Dモデリング・レンダリングまでを内製で実行。',
          creative:'<ul><li><strong>信頼感を伝えるフォトディレクション：</strong> 代表撮影では「経営者の生涯のパートナー」としての誠実さを表現するため、表情・姿勢・照明・背景までを細部まで設計</li><li><strong>既存資産を活かした世界観の統合：</strong> 表紙のメインビジュアル（「山を登る経営者たち」モチーフの墨絵風イラスト）は、<strong>先行して存在していたビジュアル資産を活用</strong>。コーポレートサイトのトンマナと整合する形で選定し、コーポレートカラーの黒・グレーのグラデーション・差し色の赤を精緻にコントロールしたデザインシステムへと統合。重厚感と親しみやすさが共存するブランド表現に仕上げた</li><li><strong>身にまとうブランドとしての社章：</strong> 金・銀の縁取りと立体加工の陰影を計算し、「プロフェッショナル」「信頼感」「高級感」を兼ね備えたエンブレムを設計</li></ul>',
          result:'<ul><li><strong>営業担当のコンサルタントからのフィードバック：</strong> 「<strong>お客様へ弊グループの組織体制の説明や、法人と個人のバランスの両軸によるサポートといった強みを説明しやすくなった</strong>」との声が現場から寄せられた。複雑なサービス体系の伝達精度が、商談現場の実感として向上</li><li><strong>インナーブランディングへの波及：</strong> 資材の統一により、従業員間で企業理念・サービス内容の認識統一が進み、組織のベクトル合わせとしても機能</li></ul><br>※ 今後は、構築したデザインシステムを基盤に、Web・SNS への展開ルール（デジタルガイドライン）へと拡張し、ブランドの持続的成長を支える方針。'
        }
      },
    ];

    const ALL_PF_TAGS = [
      // デザイン関係
      'デザイン','印刷物','ブランディング',
      // マーケ・運用
      'SNS','動画制作','メルマガ','デジタル','採用',
      // 企画・運営
      'イベント',
      // プライベート
      'プライベート',
    ];
    let pfSelected = new Set();
    let currentWorks = [...PF_WORKS];

    /* ════════  TAGS  ════════ */
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

    /* ════════  WORKS  ════════ */
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

    /* ════════  SCROLL  ════════ */
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

        /* ════════  MODAL  ════════ */
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

    // HTMLキャッシュ（idleTime に事前生成）
    const _detailCache = new Map();
    function getDetailHTML(work) {
      if (!_detailCache.has(work.id)) {
        _detailCache.set(work.id, buildDetailHTML(work));
      }
      return _detailCache.get(work.id);
    }
    // ページ読み込み後にアイドル時間を使って全作品をプリキャッシュ
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        PF_WORKS.forEach((w, i) => setTimeout(() => {
          getDetailHTML(w); // HTMLキャッシュ
          // ヒーロー画像もプリフェッチ（モーダルを開いた時に即表示）
          const img = new Image();
          img.src = w.img;
        }, i * 40));
      }, { timeout: 3000 });
    }

    function openModal(idx) {
      openIdx = idx;
      const work = currentWorks[idx];
      topTitle.textContent = '';

      // ① スケルトンを即セット（軽量）
      content.innerHTML = '<div class="wd-skeleton-wrap"><div class="wd-sk wd-sk-title"></div><div class="wd-sk wd-sk-meta"></div><div class="wd-sk wd-sk-hero"></div><div class="wd-sk wd-sk-body"></div><div class="wd-sk wd-sk-body wd-sk-body-short"></div></div>';
      panel.scrollTop = 0;
      hintShown = false;
      clearTimeout(closeTimer);
      if (sbThumb) { sbThumb.style.height = '0%'; sbThumb.classList.remove('wd-sb-closing'); }
      if (sbPct) sbPct.textContent = '0%';

      // ② モーダルをすぐ開く → CSSアニメーション先行
      // visibility:hidden ではなく opacity のみで制御 → GPUレイヤーが維持されラグなし
      modal.style.visibility = '';
      modal.classList.add('wd-open');
      document.getElementById('wd-fade-bottom').style.display = 'block';
      document.body.style.overflow = 'hidden';

      // ③ キャッシュ済みならすぐ、なければ次フレームで注入
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
      // GPUレイヤーを破棄しないよう visibility:hidden を使わない
      // opacity:0 + pointer-events:none (CSSで制御) のままにする
      // lb（ライトボックス）を強制クローズしてゴーストクリックを防ぐ
      const _lb = document.getElementById('wd-lb');
      if (_lb) { _lb.classList.remove('lb-open'); _lb.style.display = 'none'; }
      const _lbImg = document.querySelector('.lb-img');
      if (_lbImg) _lbImg.src = '';
      setTimeout(() => {
        document.body.style.overflow = '';
        if (_lb) _lb.style.display = '';
      }, 380);
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Scroll → grow bar height 0%→100%, auto-close at bottom
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



    /* ════════  LIGHTBOX  ════════ */
    (function() {
      // ライトボックスDOM（一度だけ生成）
      let lb = null;
      function ensureLB() {
        if (lb) return;
        lb = document.createElement('div');
        lb.id = 'wd-lb';
        lb.innerHTML = '<div class="lb-backdrop"></div><button class="lb-close" aria-label="閉じる">&times;</button><div class="lb-img-wrap"><img class="lb-img" src="" alt=""></div>';
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
          if (el.dataset.lbInit) return; // 二重登録防止
          el.dataset.lbInit = '1';
          const handler = () => {
            if (!document.querySelector('.wd-modal.wd-open')) return; // モーダルが開いていない時は無視
            const src = el.querySelector('img')?.src;
            if (src) openLB(src);
          };
          el.addEventListener('click', handler);
          el.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handler();
            }
          });
        });
      };
    })();


    /* ════════  WD INLINE SLIDER (wd-in-slider)  ════════ */
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

    /* ════════  DETAIL HTML  ════════ */
    function buildDetailHTML(work) {
      const heroSrc = work.img;
      const imgBase = work.img.replace(/\.[^.]+$/, '');
      const d = work.d || {};
      const toHTML = s => (s||'').replace(/\\n/g, '<br>');
      const tagsHTML = (work.tags||[]).map(t => `<span class="detail-tag">${t}</span>`).join('');

      // imgs フラグで各スロットの表示を制御
      // 例: imgs:{ a:true, b:true, c:true }
      // 未指定はすべて false（プレースホルダーなし）
      const imgs = work.imgs || {};
      // 単枚スロット
      const isWide = work.layout === 'wide';
      const imgCls = isWide ? 'wide-single' : 'split-single';
      const mkSlot = (src, cls) => `<div class="img-ph ${cls} lb-trigger" role="button" tabindex="0" aria-label="画像を拡大"><img src="${src}" alt="" decoding="async" loading="lazy" onerror="this.parentNode.style.display='none'"><span class="lb-zoom-icon">&#10532;</span></div>`;
      const slotA  = imgs.a  ? mkSlot(`${imgBase}_a.webp`,  imgCls) : '';
      const slotA2 = imgs.a2 ? mkSlot(`${imgBase}_a2.webp`, imgCls) : '';
      const slotB  = imgs.b  ? mkSlot(`${imgBase}_b.webp`,  imgCls) : '';
      const slotB2 = imgs.b2 ? mkSlot(`${imgBase}_b2.webp`, imgCls) : '';
      const slotC  = imgs.c  ? mkSlot(`${imgBase}_c.webp`,  'result-wide') : '';
      // スライダーラッパーを生成

      // sliderC: こだわりセクション用 s1-s5 スライダー
      // sliderA: strategy slider (work_04 a+a2+b+b2)
      const sliderASrcs = imgs.sliderA ? [slotA, slotA2, slotB, slotB2, slotC].filter(Boolean) : [];
      const colSliderA = (imgs.sliderA && sliderASrcs.length) ? mkSlider(sliderASrcs) : '';
      // sliderB: creative section slider (b + b2 + c merged)
      const sliderBSrcs = imgs.sliderB
        ? [slotB, slotB2, slotC].filter(Boolean)
        : [];
      const colSliderB = (imgs.sliderB && sliderBSrcs.length) ? mkSlider(sliderBSrcs) : '';
            const sliderCSrcs = imgs.sliderC
        ? ['s1','s2','s3','s4','s5'].map(function(s){ return mkSlot(imgBase+'_'+s+'.webp','slider-item'); })
        : [];
      const colSliderC = (imgs.sliderC && sliderCSrcs.length) ? mkSlider(sliderCSrcs) : '';
      const colSlides = (Array.isArray(work.slides) && work.slides.length)
        ? mkSlider(work.slides.map(function(src){ return mkSlot(src, 'slider-item'); }))
        : '';
      function mkSlider(slides) {
        if (!slides.length) return '';
        if (slides.length === 1) return slides[0]; // 1枚だけならそのまま
        const inner = slides.map((s,i) => `<div class="wis-slide${i===0?' wis-active':''}">${s}</div>`).join('');
        return `<div class="wd-in-slider" data-wis-total="${slides.length}">
          <div class="wis-track">${inner}</div>
          <button class="wis-btn wis-prev" aria-label="前の画像">&#8592;</button>
          <button class="wis-btn wis-next" aria-label="次の画像">&#8594;</button>
          <div class="wis-dots">${slides.map((_,i)=>`<span class="wis-dot${i===0?' wis-dot-on':''}"></span>`).join('')}</div>
        </div>`;
      }
      const colA = work.captionA2
        ? (slotA || '')
        : ((slotA || slotA2) ? (isWide ? `<div class="wide-img-row">${slotA}${slotA2}</div>` : mkSlider([slotA, slotA2].filter(Boolean))) : '');
      const colA2caption = work.captionA2 ? `<div class="img-caption-only"><p class="img-caption">${work.captionA2}</p></div>` : '';
            const colB = (slotB || slotB2) ? (isWide ? `<div class="wide-img-row">${slotB}${slotB2}</div>` : mkSlider([slotB, slotB2].filter(Boolean))) : '';
      // ヒーロー下のサブ横長画像
      const slotHero2 = work.youtubeHero2
        ? `<div class="video-wrapper hero2-video"><iframe src="https://www.youtube.com/embed/${work.youtubeHero2}?rel=0" title="${work.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
        : (imgs.hero2 ? `<div class="img-ph hero2-wide"><img src="${imgBase}_hero2.webp" alt="" decoding="async" loading="lazy"></div>` : '');

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
            <h2 class="section-title"><span class="num">1</span>課題と背景</h2>
            <div class="section-body"><p>${toHTML(d.challenge||'')}</p></div>
          </section>
          <section class="section">
            <p class="section-label">Strategy</p>
            <h2 class="section-title"><span class="num">2</span>戦略的アプローチ</h2>
            <div class="section-body"><p>${toHTML(d.approach||'')}</p></div>
            ${colSlides || colSliderA || colA}
            ${colA2caption}
            ${work.youtubeApproach ? `<div class="video-wrapper wd-approach-video"><iframe src="https://www.youtube.com/embed/${work.youtubeApproach}?rel=0" title="${work.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : ''}
          </section>
          <section class="section">
            <p class="section-label">Role</p>
            <h2 class="section-title"><span class="num">3</span>役割（責任範囲）</h2>
            <div class="section-body"><p>${toHTML(d.role||'')}</p></div>
          </section>
          <section class="section">
            <p class="section-label">Creative</p>
            <h2 class="section-title"><span class="num">4</span>こだわり</h2>
            ${colSliderC ? `<div class="section-body creative-slider-wrap"><p>${toHTML(d.creative||'')}</p></div>${colSliderC}` : colSliderB ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colSliderB}` : imgs.sliderA ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>` : colB ? (isWide ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}` : `<div class="split-layout"><div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}</div>`) : `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>`}
          </section>
          <section class="section" style="margin-bottom:48px;">
            <p class="section-label">Results &amp; Transferability</p>
            <h2 class="section-title"><span class="num">5</span>成果と貢献</h2>
            ${work.resultImgRight && slotC
              ? `<div class="result-split-right"><div class="result-split-text section-body"><p>${toHTML(d.result||'')}</p></div><div class="result-split-img">${slotC}</div></div>`
              : `<div class="section-body"><p>${toHTML(d.result||'')}</p></div>`
            }
            ${d.youtubeShort ? '<div class="yt-shorts-wrap"><iframe src="https://www.youtube.com/embed/' + d.youtubeShort + '?playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>' : ''}
            ${(imgs.sliderB || work.resultImgRight) ? '' : slotC}
          </section>
          <div class="content-bottom-spacer"></div>
        </div>`;
    }

    /* ════════  STATE  ════════ */
    function pfToggle(tag) { pfSelected.has(tag) ? pfSelected.delete(tag) : pfSelected.add(tag); pfUpdate(); }
    function pfUpdate() {
      const outer = document.getElementById('pf-outer');
      const outerAbsTop = outer.getBoundingClientRect().top + window.scrollY;
      const scrolledIn  = Math.max(0, window.scrollY - outerAbsTop);

      // ① 十分大きな高さにしてclampが起きない状態を作る
      outer.style.height = (outerAbsTop + window.innerHeight * 5) + 'px';

      // ② 再描画（pfRefreshは高さに触らない）
      pfTagToggling = true;
      pfRenderTags(); pfRenderWorks();
      pfTagToggling = false;

      const newDist = pfCfg.scrollDist || 0;

      // ③ 必要なら先にスクロール位置を安全な値へ（高さ設定の前に実施）
      const safeScrolledIn = Math.min(scrolledIn, newDist);
      window.scrollTo({ top: outerAbsTop + safeScrolledIn, behavior: 'instant' });

      // ④ scrollYが安全な値になってから高さを設定 → clampが起きない
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

/* ══════════════════════════════════
   Modal Scrollbar
══════════════════════════════════ */
  /* ══  Profile Section — Avatar Upload & Timeline Reveal  ══ */
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

/* ══════════════════════════════════
   Smooth Scroll Navigation
══════════════════════════════════ */
  /* ══  Custom Cursor — frosted glass  ══ */
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

/* ══════════════════════════════════
   Custom Cursor
══════════════════════════════════ */
  /* ══  Smooth Scroll Navigation  ══ */
  (function () {
    const TARGETS = {
      top:       () => ({ top: 0 }),
      work: () => {
        const el = document.getElementById('pf-outer');
        return el ? { top: el.getBoundingClientRect().top + window.scrollY - 0 } : { top: 0 };
      },
      strengths: () => {
        const el = document.getElementById('strong-section');
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
