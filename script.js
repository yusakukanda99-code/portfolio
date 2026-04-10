/* ══════════════════════════════════
   Ink Reveal Animation
══════════════════════════════════ */
    // ── 画像リスト（仮画像 / 本番は実ファイルパスに差し替え） ──
    const IMAGE_SRCS = [
      "img/top/top_01.webp",
      "img/top/top_02.webp",
      "img/top/top_03.webp",
      "img/top/top_04.webp",
      "img/top/top_05.webp",
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

      // Strong section + 見出し: bg-overlayが白くなった後半でフェードイン
      const strongP = Math.min(1, Math.max(0, (progress - 0.6) / 0.4));
      sSectionEl.style.opacity = strongP;

      // 遷移完了後に白背景を付与
      if (progress >= 1 && !bgReadyDone) {
        bgReadyDone = true;
        sSectionEl.classList.add('s-bg-ready');
      } else if (progress < 1 && bgReadyDone) {
        bgReadyDone = false;
        sSectionEl.classList.remove('s-bg-ready');
      }

      // コンテンツアニメーション発火（一度だけ）
      if (progress > 0.75 && !sContentRevealed) {
        sContentRevealed = true;
        revealStrongContent();
      }
      }); // rAF
    }, { passive: true });

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
        id:1, year:'2025',
        youtube:'Ll2MaM-uSSI',
        title:'企業動画 ー オーナーの一生に伴走する',
        category:'Branding / Video',
        tags:['ブランディング','動画制作','メールマガジン','ディレクション'],
        img:'img/works/work_01/work_01.webp',
        client:'ミカタグループ・株式会社グラッドキューブ',
        imgs:{ a:false, b:false, c:false },
        d:{
          overview:'「経営と、人生の、味方になる。」というビジョンのもと、中小企業オーナーの法人・個人資産を一体でサポートするミカタ税理士法人にて認知向上を目的とした動画の作成及び配信に携わりました。2026年1月15日（木）より各エリアにてブランディング動画を配信しております。',
          challenge:'「税理士＝事務的・過去の数字を扱う仕事」という世間の固執したイメージを払拭し、ミカタグループの真の強みである「オーナーの人生（ライフステージ）そのものに深く寄り添う姿勢」を、潜在顧客の記憶に残る形で提示する必要がありました。機能的な説明ではなく、感情に訴えかけ「この人たちをパートナーにしたい」と思わせるブランド認知が求められました。',
          approach:'広報・マーケティングの視点から、視聴者のインサイトを突き、ブランドへの共感を生むための設計を行いました。\n\nコンセプトの象徴化（コミュニケーションコンセプト）：\n「人生にリタイアは存在しない」という力強いメッセージを掲げ、経営者の挑戦を「走る」という行為で表現。税理士を、表舞台の主役ではなく「二人三脚で生涯並走し続けるパートナー」として描き、ブランドの立ち位置を明確化しました。\n\nターゲットへの心理的アプローチ：\n「数字は過去を記録するためではなく、未来を描くもの」というフレーズを用い、守りのイメージが強い士業を「未来を創る挑戦の側にある存在」へと昇華させました。これは、ゲストの夢を支えるOLCの「ストーリーテリング」の考え方にも通じる、本質的なアプローチです。',
          creative:'ビジュアルとナレーションのシンクロ：\nモノクロームや光のコントラストを活かしたシネマティックな映像表現（GRAPHIC / STILL）に、重厚感のあるナレーションを融合。視聴者の没入感を高め、ブランドに対する「誠実さ」と「プロフェッショナリズム」を15〜30秒という短時間で直感的に伝えました。\n\nトータルブランディングの展開：\n動画制作にとどまらず、Web・スチール・グラフィックへと世界観を横展開（BRANDING INTEGRATION）。あらゆる接点で一貫したブランド体験（魔法が解けない設計）を提供することを徹底しました。',
          result:'「経営者としての孤独に寄り添ってくれる」という共感の声を得るとともに、既存の士業の枠を超えたクリエイティブな企業姿勢が、新たな層への認知拡大に大きく寄与しました。<br><br><strong>配信媒体・エリア</strong><ul class=\"d-list\"><li><span class=\"d-label\">動画プラットフォーム</span>YouTube、TVer</li><li><span class=\"d-label\">Web媒体</span>東洋経済、朝日新聞デジタル等（DSP配信）</li><li><span class=\"d-label\">モビリティ</span>タクシー広告（近畿・東海エリア／GOタクシー中心）</li><li><span class=\"d-label\">屋外大型ビジョン</span>鹿児島（Li-Kaビジョン・センテラスビジョン・天文館ビジョン）、沖縄（あしびビジョン・那覇てんぷすビジョン）</li></ul>',
          role:'制作全体の取りまとめおよび品質確認。'
        }
      },
      {
        id:2, year:'2023–2026',
        youtubeApproach:'nGfB2WvLpgQ',
        title:'YouTubeチャンネル ミカタチャンネル',
        category:'Digital / SNS',
        tags:['SNS','動画制作','広報','ディレクション','デジタル運用'],
        img:'img/works/work_02/work_02.webp',
        imgs: { b:true, b2:true, sliderC:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'税務・会計という難解なテーマを誰もが理解できる映像コンテンツに変換し、YouTubeで継続発信。専門家の知見を「受け身」から「積極発信」へと転換し、幅広い層のファン獲得に貢献したプロジェクトです。',
          challenge:'専門家が持つ知識の発信がこれまで受け身になりがちで、自ら情報を探している見込み客との接点が限られていました。税務・会計という難解なテーマを誰もが理解できる言葉と映像に置き換え、会社自ら積極的に情報を届ける仕組みの構築が求められました。',
          approach:'視聴者が実際に気になっているテーマ（法改正・節税・会社設立など）を起点に企画を立案。専門家の説明を図や動くイラストで補足し、難しい内容でも最後まで飽きずに見られる構成を追求しました。また、動画ごとの再生データを継続的に分析し、見出し画像の訴求内容や文字の大きさ・配置を日々見直すことで、より多くの方に動画を見てもらえるよう改善し続けました。',
          creative:'図解や動きのある演出を随所に盛り込むことで、長時間視聴しても単調に感じさせない画面設計を徹底しました。効果音も場面に応じて使い分け、説明の流れに自然なリズムが生まれるよう工夫しました。また、見出し画像（サムネイル）は「思わず押したくなる」一枚を目指し、文字の配置・色・人物の表情まで細かく調整しています。',
          result:'担当者や各コンサルタント任せになりがちだった情報発信を、会社全体で取り組む仕組みへと転換。難しい専門知識を親しみやすい体験として届けることで、幅広い層のファン獲得に貢献しました。<br><br>また、Youtubeショートも実験的に投稿したところ視聴率が良かったため、こちらも作成させていただき、お客様から手軽に見ることができて良いとご好評でした。',
          youtubeShort:'rFJLmQVPnyI',
          role:'企画立案、撮影、動画編集、見出し画像制作、視聴データの分析と改善まで一貫して担当。'
        }
      },
      {
        id:3, year:'2026',
        title:'ミカタの相続サイト & パンフレット制作',
        category:'Web / Print',
        tags:['広報','ウェブデザイン','印刷物','ディレクション'],
        img:'img/works/work_03/work_03.webp',
        imgs: { a:true },
        layout: 'wide',
        captionA2: 'ミカタの相続サービスロゴ<br><a href="https://mikata-souzoku.jp/" target="_blank" rel="noopener">公式サイト：https://mikata-souzoku.jp/</a>',
        client:'ミカタグループ・大日本印刷株式会社・クラウドサーカス株式会社',
        d:{
          overview:'相続という複雑なテーマに不安を抱えるご家族へ「安心できる」「何をすればいいかわかる」と感じてもらえるウェブサイト＆パンフレットを制作。外部制作会社と連携しながら、ブランドとしての統一感を保つプロジェクト。',
          challenge:'大切な方を亡くされた直後のご家族は、深い悲しみの中で複雑な手続きや厳しい期限に追われることになります。既存の資料は文字量が多く、かえって不安をあおる傾向がありました。手に取った瞬間に「安心できる」「何をすればいいかわかる」と感じてもらえる資料が必要でした。',
          approach:'申告期限など見落としがちな重要な日程をカレンダー形式で見える化し、ご自身で行うべきことと専門家に任せるべきことの区別を明確にしました。パンフレットでは、読みやすさに定評のある書体（UDフォント）を採用し、文字の大きさや行間のバランスを細かく指定することで、高齢の方も含めた幅広い方が読みやすい紙面を追求。ウェブサイトについては外部の制作会社と連携しながら、パンフレットと色使いや雰囲気がずれないよう丁寧に調整し、ブランドとしての統一感を保ちました。',
          creative:'「相続は難しい」という先入観を取り除くため、全体を緑色を基調とした柔らかい印象でまとめました。内容が複雑になりやすい分、文字の太さに変化をつけることで情報に強弱を生み出し、読み進めやすい誌面を目指しました。サイトとパンフレットが別のサービスに見えないよう、表紙のイメージや全体の雰囲気を揃え、どちらに触れても同じ安心感を届けられるよう細部まで管理しました。',
          result:'窓口での説明にかかる手間を大幅に削減し、相談から成約までの流れをスムーズにしました。また、2026年2月からの広告出稿開始後、現時点で5件のお問い合わせを獲得。外部の制作会社を取りまとめながら、自社ブランドの品質を最高水準で守り抜く力を発揮しました。',
          role:'制作全体の取りまとめ。外部協力会社への指示、品質・進行の管理。'
        }
      },
      {
        id:4, year:'2023–2026',
        title:'ミカタ税理士法人 ビジネスセミナー運営',
        category:'Event Management',
        tags:['セミナー','イベント','ウェブデザイン','メールマガジン','印刷物','資料制作','写真','広報','ディレクション'],
        img:'img/works/work_04/work_04.webp',
        client:'ミカタグループ・九段会館テラス（東京）・ホテルグランヴィア（大阪）・名古屋マリオットアソシアホテル・アークヒルズクラブ（六本木）等',
        youtubeHero2: 'YtF9PEItdBE',
        imgs:{ a:true, a2:true, b:true, b2:true, c:true },
        d:{
          overview:'全国の経営者を対象としたビジネスセミナーをゼロから設計・運営。東京・大阪・名古屋・鹿児島・沖縄・軽井沢・六本木など年間を通じて全国各地で満員御礼を達成したプロジェクト。',
          challenge:'多忙な経営者に足を運んでいただくには、情報の価値だけでなく「この場に来る意味がある」と感じてもらえる期待感の演出が不可欠でした。対面と配信を同時に行うかたちは社内で前例がなく、進行の仕組みや資料のひな形もゼロから作り上げる必要があり、関係各所との調整を繰り返しながら、再現できる体制へと整えていきました。',
          approach:'集客のための案内資料・メール・チラシと当日の発表資料のデザインを統一し、参加前から当日まで一貫した印象を届けることで集客と認知を最大化。当日は秒単位の進行表を作成し、会場設営・配信会社との調整・カメラ撮影・食事の手配・アンケート管理まで、すべての業務を総合的に取りまとめました。',
          creative:'税務・労務という目に見えないサービスを扱うため、金融機関や信頼感を連想させる背景画像を取り入れながら、文字を大きく使った力強いデザインで表現しました。年に複数回開催するため、毎回似た印象にならないよう変化をつけながらも、重厚感と信頼感は一貫して守るよう丁寧に調整。参加者に「大切にされている」と感じてもらえるよう、細かな心配りを随所に盛り込みました。',
          result:'東京・大阪・名古屋・鹿児島・沖縄・軽井沢・六本木など全国各地で満員御礼を達成し、多くの新規見込み客を獲得。\\n\\n【セミナー運営の実績】\\n2023〜2025年 東京（各300名程度）・大阪（各300名程度）\\n2024〜2025年 名古屋（各80名程度）\\n2024年 ミカタグループ創立30周年パーティ（700名程度）\\n2025年 鹿児島（100名）・六本木（90名）・沖縄（100名）・軽井沢（50名）',
          role:'総合運営責任者。資料・案内物の制作、配信会社・会場・食事の手配、当日の進行指揮、カメラ撮影、アンケート管理まで一貫して担当。'
        }
      },
      {
        id:5, year:'2025', layout:'wide',
        title:'社内ポータルサイト 企画案',
        category:'Inner Branding / Web',
        tags:['ウェブデザイン','資料制作'],
        img:'img/works/work_05/work_05.webp',
        client:'ミカタ税理法人（ミカタグループ）',
        imgs:{ hero2:false, a:true, a2:true, b:true, b2:true, c:true },
        d:{
          overview:'拠点増加に伴う情報分断・帰属感の希薄化という組織課題を解決するため、社内ポータルサイトの構想を短期・中期・長期の3段階で設計し提案したプロジェクト。',
          challenge:'拠点の増加に伴い、「必要な情報がどこにあるかわからない」「情報が古いまま更新されていない」「担当者が退職すると情報が消えてしまう」といった問題が各所で起きていました。情報を探すことに時間を取られることで業務効率が下がり、社員が会社への関わりに意欲を感じにくくなるという悪循環が生まれていました。また、M&Aによって拠点ごとに文化や人が異なる中、離れた拠点同士のつながりや一体感の醸成も急務でした。',
          approach:'課題を「短期・中期・長期」の3段階に整理し、段階を追って実現できる計画として社内に提案しました。まず短期では社内情報の整理と、探しやすい導線の設計に着手。中期では社内の活動を発信できる場の整備と、社員が自主的に動ける仕組み作りへと発展させ、長期では拠点を超えた交流の場と、社員一人ひとりの得意分野や知見を全社で共有できる体制の構築を目指しました。',
          creative:'事務的な情報の整理にとどまらず、「人にフォーカスした情報」を届けることを意識しました。どの拠点の社員がどんな得意分野を持っているかを知ってもらうことで、拠点を超えて相談しやすくなり、会社全体の力が高まると考えました。また、情報を見る場としてだけでなく、社員自身が学べる動画や勉強会の記録なども充実させることで、日常的に使いたくなるサイトを目指しました。',
          result:'問い合わせ対応の削減と、組織としての一体感の醸成に寄与。社員一人ひとりの仕事への意欲を高めることが、お客様への対応品質の向上へとつながるという考えのもと、社内からの変革を推進しました。',
          role:'課題の分析・整理から改善計画の策定、社内への提案まで一貫して担当。サイトの使いやすさの改善および社内向け発信の企画立案。'
        }
      },
      {
        id:6, year:'2025',
        title:'ながくてアートブック（あいちトリエンナーレ パートナーシップ）',
        category:'Event / Community Art',
        tags:['SNS','イベント','資料制作','広報','動画制作','ディレクション','プライベート','デジタル運用'],
        img:'img/works/work_06/work_06.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'あいちトリエンナーレ・ながくてアートフェスティバル実行委員・名古屋芸術大学・日東工業株式会社',
        d:{
          overview:'地域活性化とアーティスト支援を目的に、大学・自治体・イベント事務局など多様な関係者を巻き込みながら公共の場に賑わいを生み出したプロジェクト。目標を上回る動員を達成し、ゼロから企画を立ち上げて安全かつ円滑な運営を実現しました。',
          challenge:'地域活性化とアーティスト支援を目的に、大学・自治体・イベント事務局など多様な関係者を巻き込みながら、公共の場に賑わいを生み出す必要がありました。愛知トリエンナーレのパートナーとして参加するにあたり、一定の品質水準を満たすことも求められており、出展者・来場者・運営関係者それぞれに向けた丁寧な対応と、安全かつ公正な運営体制の構築が不可欠でした。',
          approach:'制作過程をインスタグラムで発信する「見せながら広げる」手法で認知と応募を同時に拡大。出展者が安心して参加できるよう、搬入・搬出の案内や著作権に関する規約など、必要な情報を整理してわかりやすく届けました。また、来場者が自然と写真を撮って発信したくなる空間づくりや、投稿してくれた方へのプレゼント企画など、口コミが広がる仕掛けも盛り込みました。インスタグラムでは写真だけでなく動画も制作・投稿し、親しみやすさと世界観の伝達を両立しました。',
          creative:'愛知トリエンナーレのアート性の高さに合わせつつ、幅広い人に親しんでもらえるよう、あえて親しみやすいポップなキャラクターを制作。目を引く明るいオレンジ色を採用し、動画ではキャラクターを大きく動かし効果音もつけることで、初めて見る方にも気軽に手に取ってもらいやすい雰囲気を演出しました。一回限りのイベントではなく継続的な活動を見据え、今回の運営データや反応を記録・蓄積することで、次回以降に活かせる基盤作りも意識しました。',
          result:'目標を上回る動員を達成し、地域のアートイベントとしての基盤構築に成功。規約・案内の整備から会場設営まで一貫して取りまとめ、ゼロから企画を立ち上げて安全かつ円滑な運営を実現しました。',
          role:'企画・実行責任者。SNS運用、出展者選考から会場設営までの運営指揮。'
        }
      },
      {
        id:7, year:'2024',
        title:'ミカタグループ 創業30周年式典',
        category:'Event Management',
        tags:['イベント','資料制作','ディレクション','動画制作'],
        img:'img/works/work_07/work_07.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'全国に分散する従業員・家族約700名が参加した創業30周年式典を、ゼロから企画・設計・運営。分単位の進行設計、投影資料・映像・BGM制作、会場との調整全般を担当し、無事完遂したプロジェクト。',
          challenge:'全国に従業員が分散する中、創立30周年という節目に「会社への感謝」を形にし、全員が同じ喜びを共有できる場を作ることが求められました。家族も含めた関係者全員に会社の歩みと敬意を届けるとともに、普段は離れている拠点同士が一体感を感じられる演出が必要でした。',
          approach:'代表の想いを物語として届けるスライドを作成し、各拠点の社員が主役として登場できる発表の場を設けました。タイムテーブルを分単位で設計し、開会から記念撮影・退場まで約4時間の進行を細部まで組み立てました。会場となったリーガロイヤルホテルの照明・音響担当・司会者などさまざまなスタッフと綿密に打ち合わせを重ね、投影資料も進行の変化に合わせてその都度作り替えるなど、現場の状況に柔軟に対応し続けました。BGMも場面ごとに編集し、会場全体の雰囲気が自然に盛り上がるよう音の流れにまでこだわりました。',
          creative:'会場に入った瞬間から退場まで、視覚に映るすべての情報（スライド・サイン・映像）を一貫したデザインで統一し、30年の歴史に恥じない重厚感と誇りを演出しました。各拠点からのクイズや名産品抽選、吉本興業とのコラボ企画など、参加者が「見る側」だけでなく「参加する側」になれる場面を随所に盛り込み、約700名が一つの空間で楽しめる体験を設計しました。',
          result:'約700名が参加した大規模なパーティを、進行の乱れなく無事完遂。従業員の会社への帰属意識を大きく高め、組織としての一体感の醸成に貢献しました。大規模な組織を動かす情熱と、細部まで行き届いた緻密な設計・心配りの両立を体現した取り組みです。',
          role:'総合進行管理。分単位の進行設計、投影資料・映像・BGMの制作と編集、会場各担当者との調整全般を担当。'
        }
      },
      {
        id:8, year:'2025',
        title:'ひのてり訪問看護ステーション 会社案内パンフレット',
        category:'Print / Branding',
        tags:['資料制作','写真','印刷物','ディレクション','ブランディング'],
        img:'img/works/work_08/work_08.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'株式会社輪奏',
        d:{
          overview:'訪問看護という馴染みの薄い仕組みへの不安を解消し、「ひのてり」の強みを地域に伝えるパンフレットを制作。自ら現場に足を運んで撮影を行い、温かみのある実際の現場の表情を誌面に盛り込んだプロジェクト。',
          challenge:'訪問看護という、多くの方にとってなじみの薄い仕組みへの不安を解消し、「ひのてり」の強みである「心のケアまで寄り添う姿勢」を地域に伝える必要がありました。利用者だけでなくその家族も含めた不安や悩みに応える内容を届けながら、手に取った瞬間に安心感を感じてもらえる資料づくりが求められました。',
          approach:'自ら現場に足を運んで写真撮影を行い、温かみのある実際の現場の表情を誌面に盛り込みました。「利用者の悩み」と「家族の悩み」をそれぞれ丁寧に整理して掲載することで、どちらの立場の方が手に取っても「自分ごと」として読み進められる構成を設計。サービスの流れや専門スタッフの連携図を大きく描き起こし、複雑な仕組みをひと目で理解できるよう視覚的に整理しました。',
          creative:'会社のイメージカラーであるオレンジ色を基調に、温かく近づきやすい印象を全体に統一しました。内容が専門的になりがちな分、写真やイラストを多用しながら図を大きく掲載することで、病院や専門家との連携体制を「見るだけでわかる」誌面を目指しました。企業理念から代表挨拶の文章まで、会社の想いを言葉として丁寧に整理・執筆し、単なる説明資料ではなく、信頼と温もりを同時に伝えられる一冊に仕上げました。',
          result:'窓口での説明にかかる手間を大きく削減し、相談から利用開始までの流れをスムーズに。現場の熱量をそのまま切り取り、複雑な情報を温かな体験へと変える制作力を発揮しました。',
          role:'企画・撮影・作図・デザイン・執筆まで一貫して担当。'
        }
      },
      {
        id:9, year:'2024',
        title:'マンガでカンタン！相続は7日間でわかります。',
        category:'Publishing / PR',
        tags:['広報','ディレクション','印刷物','ブランディング'],
        img:'img/works/work_09/work_09.webp',
        imgs: { a:true },
        client:'ミカタ税理士法人・株式会社学研ホールディングス',
        d:{
          overview:'相続というテーマを「7日間の講義形式の漫画本」に落とし込み、学研より全国出版・販売を実現。複雑な専門知識を親しみやすい形で届け、ミカタグループのブランド信頼性向上に大きく貢献したプロジェクト。',
          challenge:'相続は誰もがいつか直面するテーマでありながら、「難しそう」「自分には関係ない」と後回しにされがちな分野です。税理士が書く専門書では手に取ってもらいにくく、難しい内容をいかに身近に感じてもらうかが最大の課題でした。また、大手出版社との共同制作という性質上、品質・スケジュール・関係者間の調整を高い水準でやりきることが求められました。',
          approach:'相続を「7日間の講義形式」に構成し直すことで、読者が無理なく段階的に理解できる流れを設計しました。漫画という表現形式を選んだことで、堅くなりがちなテーマに親しみやすさを加え、手に取るきっかけを作ることに成功。漫画家の選定・絵柄のイメージ合わせにも関与し、親しみやすくかつ情報量を損なわない表現を追求しました。学研との打ち合わせ・スケジュール管理・原稿確認など、出版に向けた一連の進行を社内側でとりまとめました。',
          creative:'登場キャラクターに「面倒くさがりのマンガ家」「すご腕税理士」「好奇心旺盛な編集者」を設定し、読者が自分を重ねやすい等身大の人物が学んでいく構成にこだわりました。相続手続きをすごろく形式で図解するなど、情報を読ませるのではなく「見てわかる」形に整理することで、専門知識のない読者でも迷わず読み進められるよう工夫しました。',
          result:'学研より書籍として全国出版・販売を実現。複雑な専門知識を「7日間で読める漫画本」という形に落とし込み、ミカタグループの知見を広く一般の方へ届ける媒体として機能しています。ブランドの信頼性向上にも大きく貢献しました。',
          role:'出版プロジェクトの社内ディレクター。内容の整理・構成案への関与、絵柄調整、学研との進行管理・日程調整・打ち合わせ対応を一貫して担当。'
        }
      },
      {
        id:10, year:'2023–2026',
        title:'採用ブランディング 基盤構築と撮影',
        category:'Recruiting / PR',
        tags:['採用','資料制作','写真','広報','ディレクション'],
        img:'img/works/work_10/work_10.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'税務会計・経営コンサルティング領域における採用競争に勝つため、「ミカタで働くとはどういうことか」を求職者に具体的・魅力的に伝える採用ブランディングをゼロから構築。写真撮影・バナー制作・資料作成まで一貫して担当したプロジェクト。',
          challenge:'税務会計・経営コンサルティング領域における採用競争は激しく、「ミカタで働くとはどういうことか」を求職者に具体的かつ魅力的に伝えることが求められました。外部の採用支援会社（Hupro）とのコラボ企画も含め、対外向けに発信するビジュアルの質が応募数と会社の印象を直接左右するため、素材の品質に妥協できない状況でした。',
          approach:'「経営者の意思決定を支える仕事」という仕事の本質的な魅力を一言で表すコンセプトを設定し、それを軸に資料・バナーの内容を整理しました。写真撮影は実際の社員を被写体として行い、リアルな働く姿を素材として確保。オンラインセミナーの集客用バナーでは、タイポグラフィに強弱をつけ「意思決定」という言葉を視覚的に際立たせることで、一目で内容が伝わるデザインに仕上げました。',
          creative:'未経験者採用を主軸とするため、親しみやすい「明るさ」と「清潔感」を重視して撮影。透明感を意識したレタッチを施し、資料デザインではコーポレートカラーの黒を基調に、赤を差し色として活用しました。内容の難しさをカバーするため、イラストやアニメーションを積極的に取り入れ、硬い印象を払拭する工夫を凝らしました。担当者様からは「若年層の採用率が上がった」との嬉しいお声をいただいています。',
          result:'採用セミナーへの参加申し込み獲得に貢献し、外部連携も含めた採用広報の基盤を整備。採用活動に使える写真素材を内製で確保したことで、今後の広告・資料制作のコストと工数の削減にも寄与しました。',
          role:'採用広報の企画・制作全般。写真撮影・選定、セミナー集客用バナー制作、採用関連資料の作成を担当。'
        }
      },
      {
        id:11, year:'2019',
        title:'抗菌アロマスプレー ランディングページ',
        category:'Web Design / EC',
        tags:['ウェブデザイン'],
        img:'img/works/work_11/work_11.webp',
        imgs: { a:true },
        client:'株式会社アロマクリエイト',
        d:{
          overview:'コロナ禍によりマスク着用が日常化する中、「マスクに吹きかけるアロマスプレー」という新しい生活習慣を提案する商品のLP制作。「これが自分の生活に必要だ」と感じさせる世界観を視覚で設計しました。',
          challenge:'コロナ禍により、マスク着用が日常化する中、「マスクに吹きかけるアロマスプレー」という新しい生活習慣を提案する商品のため、まず「そういう使い方があるのか」という気づきを与えながら購買意欲につなげる必要がありました。商品の良さを伝えるだけでなく、「これが自分の生活に必要だ」と感じさせる世界観の設計が求められました。',
          approach:'ページ全体を通じて、香りや植物の清涼感を視覚で体験できるよう設計しました。白・薄緑・水色を基調とした爽やかな配色と、ハーブや精油・ガラス瓶などの写真を大きく配置することで、画面を見た瞬間に「心地よさ」が伝わる誌面を構築。使用している素材（ラベンダー・レモン・ユーカリなど）をひとつずつ丁寧に紹介する構成にし、成分への安心感と納得感を同時に醸成しました。',
          creative:'購入をためらう人の「なぜ必要なの？」という疑問に先回りして答える流れを意識し、「こんなお悩みありませんか？」から始まり商品説明・成分紹介・使い方・購入へと自然に誘導する構成を設計しました。テキストは最小限に抑え、写真とレイアウトの力で読まずとも伝わるページを目指しました。全体のトーンを統一することで、ブランドとしての信頼感と上品さも同時に表現しています。',
          result:'商品の世界観を一枚のページに凝縮し、新規顧客への認知と購買につながる導線を構築。ページ経由での問い合わせ・購入獲得に貢献しました。',
          role:'ランディングページのデザイン全般。構成設計、レイアウト、配色、素材選定まで一貫して担当。'
        }
      },
      {
        id:12, year:'2023–2026',
        title:'ディスプレイ広告 デジタル広告の制作と改善運用',
        category:'Digital Advertising',
        tags:['ディスプレイ広告','デジタル運用'],
        img:'img/works/work_12/work_12.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'ターゲットごとの異なるニーズに対し、最適な訴求とデザインを使い分け、問い合わせ獲得効率（成約率）を最大化。AI生成画像の活用と日々のABテストによりデザインを継続改善し続けたデジタル広告運用プロジェクト。',
          challenge:'ターゲットごとの異なるニーズに対し、最適な訴求とデザインを使い分け、問い合わせ獲得効率（成約率）を最大化させることが課題でした。設立期の起業家と既存中小企業では関心軸が異なり、それぞれに刺さるビジュアルと言葉を常に探し続ける必要がありました。',
          approach:'AI生成画像をレタッチし、ターゲットごとに最適化したビジュアルを採用。日々ABテストを行い、人物の配置やテキストなどのレイアウトをデータから厳選し続けました。心理的な配色を駆使し、設立のタイミングや中小企業の切り替えというターゲット特性に合わせたクリエイティブを制作しました。',
          creative:'人物画像はAIで生成し、Photoshopでレタッチ後にIllustratorで作成。比較的若い男性・専門家感がある年配の男性・女性・対談風など複数バリエーションを展開。カラーは設立＝初心者という点からグリーンを使用（初心者マークから着想）。ビジネス感を感じるブルーと、目立つマゼンタ・オレンジバナーも作成し、継続的に最適解を追求しました。',
          result:'クリック率（CTR）の向上と獲得コスト（CPA）の最適化を実現。最新技術とデータを融合させ、顧客の意欲を高める視覚体験を創造しました。',
          role:'クリエイティブデザイナー。AI活用、レタッチ、データに基づく改善提案。'
        }
      },
      {
        id:13, year:'2023–2026',
        title:'オウンドメディア 自社運用と情報発信',
        category:'Digital / Content',
        tags:['デジタル運用','ウェブデザイン','広報','メールマガジン'],
        img:'img/works/work_13/work_13.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'税理士法人の専門知識をオウンドメディアとメールマガジンで継続発信し、検索流入の増加と既存顧客との関係強化を実現。代表コラムの整理・掲載も担当し、会社の対外的な信頼向上に貢献したプロジェクト。',
          challenge:'税理士法人として専門知識を持つ一方、その知見が社外にほとんど届いていない状況でした。検索からの流入を増やし、新規顧客との接点を作るとともに、代表の考え方や会社の姿勢を言葉として発信することで、問い合わせ前から信頼を積み上げる場が必要でした。',
          approach:'税制改正（定額減税・年収の壁など）や実務で迷いやすいテーマを中心に、検索されやすいテーマを選定してコンテンツを継続的に発信しました。記事の流し込みにとどまらず、一覧での視認性を高めるためサムネイルを毎回デザイン制作。また代表コラム「柴田昇の眼」を設け、日々の経営への視点や考えを継続的に発信することで、専門知識だけでは伝わらない「人となり」を届ける場を作りました。メールマガジンとも連動させ、既存の接点を活かした定期的な接触を実現しました。',
          creative:'サムネイルはテーマごとにデザインを変えながらも、ミカタグループとしてのブランドイメージを崩さない統一感を保つことを意識しました。難しい税務テーマを「思わず読みたくなる」見出しと構成に落とし込み、専門家でない読者にも届く記事づくりにこだわりました。代表コラムは内容の整理・文章化にも関与し、経営者の言葉を読みやすい形に整えることで会社の対外的な信頼向上に貢献しました。',
          result:'継続的な発信により検索経由での流入増加に貢献。メールマガジンとの連動で既存顧客へのリーチも強化し、接触頻度の向上と関係維持につなげました。代表コラムは対外的な発信の柱となり、会社の考えを広く伝える媒体として機能しています。',
          role:'自社メディアの運用全般。テーマ選定、記事の流し込み・校正、図解・作図、サムネイルデザイン制作、メールマガジン配信、代表コラムの整理・掲載まで一貫して担当。'
        }
      },
      {
        id:14, year:'2024',
        title:'IT関連 会社設立向けランディングページ',
        category:'Web / UX',
        tags:['デジタル運用','ディスプレイ広告','ディレクション','ウェブデザイン'],
        img:'img/works/work_14/work_14.webp',
        imgs: { a:true, a2:true },
        client:'ミカタグループ・クラウドサーカス株式会社',
        d:{
          overview:'IT関連事業で会社設立を考えている方向けのLP制作。バナーからサイト流入、面談日程調整までをGoogle Workspaceと連携させた自動化フローで設計し、申し込みから面談日程までのリードタイムを大幅に短縮したプロジェクト。',
          challenge:'デジタルネイティブな起業家層の行動特性や、会社設立・創業融資・税務DXという複合ニーズに対し、最適な訴求とUXを設計することが課題でした。メールや電話による問い合わせを削減しつつ、成約率を高める顧客動線の構築が求められました。',
          approach:'バナーからサイト流入、日程調整までの流れ（UX）を最適化。申し込みから面談日程までをGoogle Workspaceと連携させることで自動化フローを実現しました。メールや電話による問い合わせを削減できる顧客動線を設計しました。',
          creative:'グラデーションを「配色」と「視線誘導」の両面で活用し、実績数値の視覚化による安心感の醸成を図りました。ターゲット（IT関連の起業家層）に刺さるコピーと、一目で価値が伝わるレイアウトを追求しました。',
          result:'「自動連動する集客モデルの確立」と「リードタイム短縮」を実現。営業担当者の問い合わせ対応工数を大幅に削減しました。',
          role:'Google Workspace連携設計（面談予約フロー）を含む、LP制作・UX設計全般の担当。'
        }
      },
      {
        id:15, year:'2023–2026',
        title:'コーポレートサイト運用 & メルマガ配信',
        category:'Digital / PR',
        tags:['広報','デジタル運用','メールマガジン','ウェブデザイン'],
        img:'img/works/work_15/work_15.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'コーポレートサイトの継続運用とSalesforce Pardotを活用したメルマガ配信を統合。「実益型」と「情緒型」の2種類のメルマガを設計し、HTMLコーディングから配信設計まで一貫して担当。属人的だった情報発信を仕組み化したプロジェクト。',
          challenge:'ミカタグループは税理士・会計・法務など複数の専門領域を持つ総合グループですが、お客様への情報発信は各現場の担当者任せになっており、会社として一貫したタイミング・内容での発信ができていませんでした。税制改正・法改正といった時事性の高い情報や、季節の挨拶・年末年始スケジュールといった顧客関係維持に不可欠なコミュニケーションが、体系的に管理されていないことが課題でした。',
          approach:'コーポレートサイトにお知らせ・事例・セミナー情報を継続掲載しながら、SalesforceのPardotを活用したメルマガ配信と連動させる統合運用体制を構築。メルマガは①「実益型」（税制改正大綱の概略・法改正ポイントなど）と②「情緒型」（暑中見舞い・年末年始告知など）の2種類で設計。配信曜日・時刻は自社データと業界データを分析し、開封率が高い火〜木曜日の午前8時台に統一しました。',
          creative:'代理店から引き継いだメルマガテンプレートはdivの枠組みのみの最小構成でした。そこから自身でHTMLコーディングとテストを重ね、背景色・リスト・枠線・カラムレイアウトなど複数のデザインパターンを段階的に拡充。季節ごとにビジュアルを刷新（夏：風鈴・朝顔のイラスト、冬：クリスマスリースなど）しながら、MIKATAブランドのトンマナを損なわないデザイン統一を徹底しました。',
          result:'会社として情報を体系的・継続的にお客様へ届ける広報基盤を社内に構築。タイムリーな専門情報の発信により、既存顧客からの高い信頼と「頼れる専門家」としてのブランド認知を獲得。属人的だった情報発信を仕組み化し、組織として一貫したコミュニケーションができる体制を確立しました。',
          role:'広報プロデューサー。コーポレートサイトの運用管理、メルマガの企画・コンテンツ制作・HTMLコーディング・配信設計（Pardot運用）、開封率・クリック率データの分析と改善。'
        }
      },
      {
        id:16, year:'2023–2025',
        title:'インナーブランディング 備品・社内報の制作',
        category:'Inner Branding / Print',
        tags:['印刷物','ディレクション','ブランディング','広報'],
        img:'img/works/work_16/work_16.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'M&Aによる拠点拡大が続く中、全国各地に分散した従業員の帰属意識・一体感を醸成するため、社内報「お元氣様です」（年3回）の定期発行とノベルティ制作を推進。ゼロからインナーブランディングの仕組みを構築したプロジェクト。',
          challenge:'M&Aによる拠点拡大が続く中、全国各地に分散した従業員が増加し、「ミカタグループの一員である」という帰属意識・一体感の醸成が急務でした。①情報の分断（拠点間が離れているため、他拠点の活動・表彰・新入社員情報が伝わらない）と②帰属感の希薄化（日常的に身に着け・触れる「モノ」のデザインを通じた可視化が不足）という2つの課題に対応しました。',
          approach:'社内報「お元氣様です」を年3回（春・夏・冬）企画・デザイン・制作。代表挨拶・社員交流会・年間表彰・新入社員紹介など、グループ全体の活動を網羅的にカバー。各号でテーマカラー・装飾を季節に合わせてリニューアルし、毎号「読みたくなる」誌面を設計しました。また社章は3DソフトMayaでモデリング＆レンダリングし、完成イメージを高精度に可視化した上で経営層へ提案しました。',
          creative:'単なる備品制作にとどまらず、「ミカタグループに誇りを持って働きたい」と感じさせるデザインであることを最重要視しました。コーポレートカラー（黒）を軸にしながら、社章は金・銀の縁取りや立体加工を検討し、「プロフェッショナル」「信頼感」「高級感」を兼ね備えたデザインに仕上げました。30周年記念号（Vol.61・冬号）では、600名規模の大感謝祭特集として会場写真・各拠点の催しを見開きダイナミック構成で表現しました。',
          result:'社内報の定期発行により、全国に分散する拠点間の情報格差を解消。他拠点の活動・表彰・新メンバーを「自分事」として知れる文化が生まれ、グループとしての一体感と帰属意識の向上に貢献。社章導入後は「社章をつけると仕事への意識が変わった」という声が上がるなど、日常の行動変容につながる成果が得られました。',
          role:'社内報「お元氣様です」の定期発行（企画〜制作〜納品）、ノベルティ・備品のデザイン企画・制作、経営層への提案全般を担当。インナーブランディングの継続的な仕組みをゼロから構築。'
        }
      },
      {
        id:17, year:'2018',
        title:'Sony FES Watch U デザインコンペ',
        category:'Design Competition',
        tags:['プライベート','ブランディング'],
        img:'img/works/work_17/work_17.webp',
        imgs: { a:true },
        client:'Sony Fashion Entertainments（個人応募）',
        d:{
          overview:'ソニーの電子ペーパー製ウォッチ「FES Watch U」のデザインコンペに個人応募。全国から集まった応募作品の中から32組の公認クリエイターに選出され、採用デザインはソニー公式サイト・専用アプリ・全国の百貨店での展示販売に展開されました。',
          challenge:'ソニーの「Fashion Entertainments」が主催したクリエイター公募プロジェクト。電子ペーパー製の文字盤とベルトのデザインを着せ替えできるディスプレイウォッチ「FES Watch U」のデザインを、テーマ「多様性」のもと世界に向けて発信するクリエイターを広く募集。単なる装飾デザインではなく、電子デバイスという最先端技術の上に「文化的な物語性」を宿らせ、ファッションと感性が交差する新たな価値を生み出すことが求められました。',
          approach:'「時間」という普遍的なテーマに、日本人ならではの感性を掛け合わせたコンセプトを設計。文字盤が電子ペーパー（紙）でできているという素材の特性に着目し、「水面」や「静寂」など日本的な美意識（間・余白・侘び寂び）を重ねることで、「時の流れを感じる装置」としての作品世界を構築しました。デザインは極限まで要素を削ぎ落としたミニマル構成で、黒と白の強いコントラスト、波紋を連想させるグリッドパターンのベルト、水面に映る月のような円形モチーフで「動かない中に時間が流れている」という矛盾した美を表現しました。',
          creative:'FES Watch Uの文字盤が「紙（電子ペーパー）」という素材であることに深く共鳴し、日本の伝統美術や水墨画が持つ「余白の力」をデジタルデバイスの上で再現することにこだわりました。文字盤はモノクロームに徹し、大きな余白と最小限の線・形だけで構成。ベルトには水面の波紋・格子を想起させるグリッドパターンを採用し、「静の中にある動き」を視覚的に表現しました。',
          result:'全国から集まった応募作品の中から、32組の公認クリエイターに選出（PR TIMES掲載・公式発表）。採用デザインはソニー公式サイト・専用アプリ「FES Closet」を通じて世界へ配信。阪急メンズ東京・高島屋横浜店・静岡伊勢丹・大丸神戸店での展示販売にも展開されました。',
          role:'公認クリエイター（個人応募）。コンセプト立案、グラフィックデザイン制作（文字盤・ベルト）、作品世界観の構築。'
        }
      },
      {
        id:18, year:'2018',
        title:'プレゼンテーション映像 業務支援ツールの企画・予算獲得',
        category:'Motion / Presentation',
        tags:['動画制作','資料制作'],
        img:'img/works/work_18/work_18.webp',
        client:'ARアドバンストテクノロジ・株式会社ファーストリテイリング',
        d:{
          overview:'大手ファッション企業（ファーストリテイリング）へのシステム導入継続に向けた経営層向けプレゼン映像を制作。「現状の混乱→集約→将来像」という3段階のストーリー設計と、After Effectsによるアニメーションで経営層の意思決定を動かすことに貢献。半年間のプロジェクト継続承認と予算確保を実現しました。',
          challenge:'大手ファッション企業（ファーストリテイリング）では、グローバル複数拠点にまたがる情報連携においてツールが統一されておらず、各国・各部門間のやり取りで手違いや確認作業が多発。無駄なコミュニケーションコストが恒常的に発生していました。これらを解決する独自システムの開発・導入を継続するために、経営層を納得させる論理的根拠と説得力のあるビジュアルコミュニケーションが不可欠でした。',
          approach:'プロジェクト責任者と綿密にヒアリングを行い、「現状の混乱」→「システム導入後の整理」→「将来の可能性」という3段階のストーリー構成でプレゼン動画を設計しました。①「現状の問題」：世界各拠点が乱立し、メール・Excel・発注ツール・地図情報が錯綜する混乱した情報フローをアニメーションで視覚化。②「導入後の変化」：情報が一か所に集約される世界を表現。③「将来像」：店舗空間での情報の見える化をCG映像で具体化。',
          creative:'抽象的な「情報の混乱」を、世界地図上に各国拠点・ツール・人員が複雑に絡み合うアニメーションとして可視化。見た瞬間に「確かにこれは問題だ」と直感させるビジュアルの論理設計にこだわりました。現状（混沌）→集約（整理）という対比を動きと色彩で表現し、「導入前後の差」を言葉なしでも理解できる映像構成を実現しました。将来像のパートでは、実際の店舗空間にCGアバターや情報UIを組み合わせ、「完成後もさらに発展できる」という可能性を感じさせる映像に仕上げました。',
          result:'プレゼンテーションは成功し、半年間のプロジェクトの継続承認と予算確保を実現。「現状の課題」を感情と論理の両面から伝えるビジュアルにより、経営層の即断を引き出すことに貢献しました。現場の課題を「経営層が理解できる言語（映像・ビジュアル）」に翻訳し、大規模な意思決定を動かす推進力として機能した実績です。',
          role:'プレゼンテーション映像・図解制作担当。プロジェクト責任者へのヒアリング、ストーリー構成設計、After Effectsによるアニメーション・CG映像制作、全スライドのビジュアルディレクション。'
        }
      },
      {
        id:19, year:'2019',
        title:'Zidoma サービスサイト リブランディング',
        category:'Web / Branding',
        tags:['ウェブデザイン','デジタル運用','ブランディング'],
        img:'img/works/work_19/work_19.webp',
        imgs: { a:true, a2:true },
        client:'ARアドバンストテクノロジ',
        d:{
          overview:'ファイル管理システム「ZIDOMA data」を「誰でも使える、頼れるパートナー」として再定義するリブランディング提案を策定。自らオリジナルイラストを制作し、取材・撮影で初の顧客事例をゼロから獲得したプロジェクト。',
          challenge:'「ZIDOMA data」は企業のファイルサーバー間のデータ移行を支援するBtoBツール。競合製品が存在する中で、機能の優位性だけでなく「ITに詳しくない担当者でも使いこなせる」という安心感と親しみやすさの訴求が不足していました。また、導入事例がゼロという状態からのリブランディングという、非常にハードルの高い課題でもありました。',
          approach:'難解なITツールを「誰でも使える、頼れるパートナー」として再定義するリブランディング提案を策定。サイト構成は「課題の共感」→「機能紹介」→「導入事例」→「トライアル誘導」というUX設計を採用。自らオリジナルイラストを制作し、複雑なファイルサーバー構成やデータ移行フローを誰でも理解できるビジュアルで表現。取材のために名古屋まで出張・撮影を実施し、初のお客様インタビューをゼロから獲得しました。',
          creative:'既存サイトはIT感が強く専門用語も多いため、初めて訪れた担当者が「難しそう」と離脱しやすい設計でした。リブランディング提案では、オレンジを基調とした温かみのあるカラーリングと、親しみやすいイラストを多用することで「IT初心者でも任せられる」という安心感を演出。「ファイルサーバーの問題に悩んでいませんか？」という共感訴求をトップに据え、ユーザーが自分事として捉えられる導線設計を徹底しました。',
          result:'既存サイト運用フェーズでは、SEGA等の大手企業のグループ会社への導入実績を獲得。自ら取材・撮影して制作した顧客事例コンテンツが成約率の向上に寄与しました。リブランディング提案については、コロナ禍による事業方針の変更と退職により実装には至りませんでしたが、ゼロ事例の状態からコンテンツを自力で開拓する行動力と、複雑なITプロダクトを非IT層に伝わるビジュアルへ翻訳する企画・制作力を発揮した取り組みです。',
          role:'クリエイティブプロデューサー。イラスト制作、サイト構築、動画制作。'
        }
      },
      {
        id:20, year:'2024',
        title:'会社案内・営業資材 トータル制作',
        category:'Branding / Print',
        tags:['印刷物','ブランディング','ディレクション','写真'],
        img:'img/works/work_20/work_20.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'創業30周年を迎えるミカタグループに向けて、会社案内（全16ページ）・営業チラシ・各種資材をトータルで統一制作。戦略立案からフォトディレクション・作図・ライティング・デザインまでを社内で一貫して完結させた大型プロジェクト。',
          challenge:'創業30周年を迎えるミカタグループには、グループ全体のビジョン・ミッション・バリューや「ビジネス＆ライフ・コンサルティング」という独自サービスの全貌を体系的に伝える統一されたクリエイティブが存在しませんでした。各担当者が個別に作成した資料は品質・トンマナがバラバラで、「信頼できるプロフェッショナル集団」という第一印象を与えられていませんでした。',
          approach:'代表挨拶の写真撮影ディレクションから、全ページの作図・デザイン・ライティングまでを一貫して担当。会社案内（全16ページ）では、ミッション・ビジョン・バリューの体系的な整理から始め、「ビジネス＆ライフ・コンサルティング」の独自性をわかりやすく図解化（法人・個人の2つの財布の可視化、6ステップの成長支援ロードマップ、4つのソリューション体系など）。営業チラシは、ターゲット（中小企業オーナー）の課題感に直結したキャッチコピー設計と、フローチャート・Q&Aを用いた分かりやすい情報設計を採用しました。',
          creative:'代表の写真撮影では、「経営者のパートナー」という信頼感を伝えるため、表情・姿勢・照明・背景まで細かくディレクション。会社案内の表紙は「山を登る経営者たち」という墨絵風のイラストを採用し、「ひ孫の世代まで伴走する」というブランドの世界観を視覚的に表現しました。コーポレートカラーの黒を軸に、グレーのグラデーション・差し色の赤を精緻に調整し、重厚感と親しみやすさが共存するデザインシステムを構築しました。',
          result:'グループ全体で統一されたクリエイティブ資産を確立し、対外的なブランド信頼性と成約率の向上に貢献しました。会社案内は営業担当者の説明ツールとして活用されるとともに、従業員への企業理念・サービス内容の認識統一（インナーブランディング）にも機能しています。',
          role:'クリエイティブディレクター（全工程を単独担当）。代表撮影のフォトディレクション、全ページのデザイン・作図・ライティング、カラー・フォントの選定・管理、営業チラシのコンテンツ設計。'
        }
      },
      {
        id:21, year:'2024',
        title:'M&A 会社案内動画',
        category:'Video / Branding',
        tags:['動画制作','写真','ブランディング','ディレクション'],
        img:'img/works/work_21/work_21.webp',
        imgs: { a:true, a2:true, b:true, b2:true, c:true },
        client:'ミカタ税理法人（ミカタグループ）',
        d:{
          overview:'M&A商談時に売主様・従業員様へ「どんな会社に入るのか」を伝えるための会社案内動画を約3週間・単独で制作。撮影から編集・納品まで全工程を一人で完遂し、グループインへの不安解消と承継プロセスの円滑化に貢献したプロジェクト。',
          challenge:'ミカタグループがM&Aにより新たな拠点・事務所を承継する際、売主側の経営者・従業員にとって最大の不安は「どんな会社に入るのか」という点でした。商談の場では口頭や資料での説明が中心となりますが、「ミカタグループの雰囲気・文化・代表の人柄・一緒に働く仲間の声」を直接感じてもらえる機会が不足しており、承継への心理的ハードルが生じていました。',
          approach:'会社案内素材の流用で期間短縮しつつブランド統一を保つという工夫、「共感→信頼→安心」という3段階のストーリー設計で制作。動画の構成は「ミカタグループとは何か（会社案内パート）」→「代表からのメッセージ」→「実際に働く従業員の声」という流れで設計し、視聴者が段階的に安心感を感じられるストーリー構成にしました。代表挨拶および従業員インタビューの撮影・セッティングは自分一人で担当しました。',
          creative:'既存の会社案内（パンフレット）の素材・ビジュアルを動画に流用することで制作期間を大幅に短縮しながら、ブランドの一貫性も担保する設計を採用しました。撮影機材のセッティング・ライティング・カメラワーク・収録・編集まで全工程を単独で行い、依頼から納品まで約3週間という短期間で制作を完遂しました。',
          result:'M&A商談時の説明ツールとして活用され、売主様・従業員様の「グループインへの不安解消」に貢献。約3週間という短納期で、撮影・編集・納品まで一人で完遂。外部委託ゼロで高品質な動画コンテンツを内製化した実績として、組織内のクリエイティブ制作力を示しました。',
          role:'プロデューサー兼ディレクター兼カメラマン（全工程単独担当）。企画・構成設計、撮影セッティング（照明・機材）、代表および従業員インタビュー収録、動画編集・仕上げ、納品。'
        }
      },
    ];

    const ALL_PF_TAGS = [
      // デザイン関係
      'ウェブデザイン','ディスプレイ広告','印刷物','ブランディング','写真',
      // 企画
      'ディレクション','資料制作','セミナー','イベント',
      // 運用
      'SNS','メールマガジン','デジタル運用','広報','採用','動画制作',
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
      setTimeout(() => {
        document.body.style.overflow = '';
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
      const sliderCSrcs = imgs.sliderC
        ? ['s1','s2','s3','s4','s5'].map(function(s){ return mkSlot(imgBase+'_'+s+'.webp','slider-item'); })
        : [];
      const colSliderC = (imgs.sliderC && sliderCSrcs.length) ? mkSlider(sliderCSrcs) : '';
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
            ${colA}
            ${colA2caption}
            ${work.youtubeApproach ? `<div class="video-wrapper wd-approach-video"><iframe src="https://www.youtube.com/embed/${work.youtubeApproach}?rel=0" title="${work.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : ''}
          </section>
          <section class="section">
            <p class="section-label">Creative</p>
            <h2 class="section-title"><span class="num">3</span>こだわり</h2>
            ${colSliderC ? `<div class="section-body creative-slider-wrap"><p>${toHTML(d.creative||'')}</p></div>${colSliderC}` : colB ? (isWide ? `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}` : `<div class="split-layout"><div class="section-body"><p>${toHTML(d.creative||'')}</p></div>${colB}</div>`) : `<div class="section-body"><p>${toHTML(d.creative||'')}</p></div>`}
          </section>
          <section class="section">
            <p class="section-label">Results &amp; Transferability</p>
            <h2 class="section-title"><span class="num">4</span>成果と貢献</h2>
            <div class="section-body"><p>${toHTML(d.result||'')}</p></div>
            ${d.youtubeShort ? '<div class="yt-shorts-wrap"><iframe src="https://www.youtube.com/embed/' + d.youtubeShort + '?playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>' : ''}
            ${slotC}
          </section>
          <section class="section" style="margin-bottom:48px;">
            <p class="section-label">Role</p>
            <h2 class="section-title"><span class="num">5</span>役割（責任範囲）</h2>
            <div class="section-body"><p>${toHTML(d.role||'')}</p></div>
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

