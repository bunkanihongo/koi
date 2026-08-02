/* ==========================================================================
   takanote 読解ルーム — v3（改良版）
   Interactive Japanese reading room with audio, translation, and grammar
   ========================================================================== */
(function () {
  'use strict';

  // ---- 状態 ----
  let currentData = null;
  let currentAudio = null;
  let currentParaIdx = -1;
  let isPlaying = false;
  let audioQueue = [];
  let isAutoMode = false;

  // ---- DOM 参照 ----
  let container, progressBar;

  // ======================================================================
  //  初期化
  // ======================================================================
  document.addEventListener('DOMContentLoaded', () => {
    container = document.getElementById('reading-room-container');
    if (!container) return;

    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/koi/assets/css/reading-room.css?v4';
    document.head.appendChild(link);

    // プログレスバー
    progressBar = document.createElement('div');
    progressBar.className = 'rr-progress-bar';
    document.body.appendChild(progressBar);

    // スクロール進捗
    window.addEventListener('scroll', updateProgress, { passive: true });

    // ルート（?read=slug パラメータ）
    const params = new URLSearchParams(window.location.search);
    const readingId = params.get('read');
    if (readingId) {
      loadReading(readingId);
    } else {
      renderList();
    }

    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(window.location.search);
      const id = p.get('read');
      if (id) {
        loadReading(id);
      } else {
        renderList();
      }
    });
  });

  // ======================================================================
  //  プログレスバー
  // ======================================================================
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(scrollTop / docHeight * 100, 100) : 0;
    if (progressBar) progressBar.style.width = pct + '%';
  }

  // ======================================================================
  //  読解リスト
  // ======================================================================
  const READING_LIST = [
    { id: 'story-001-ripperakugaki', title: 'トオルってどんな字書くのって聞いたら「徹底の…', kicker: '初級〜中級', desc: '@ripperakugaki', badge: '1段落', file: '/koi/assets/readings/story-001-ripperakugaki.json' },
    { id: 'story-002-_babyhotate', title: 'なんか忘れたけど、話の流れで大倉士門が出てき…', kicker: '初級〜中級', desc: '@_babyhotate', badge: '1段落', file: '/koi/assets/readings/story-002-_babyhotate.json' },
    { id: 'story-003-allgreen_24', title: 'バレンタインの時期にガナッシュという言葉を初…', kicker: '初級〜中級', desc: '@allgreen_24', badge: '2段落', file: '/koi/assets/readings/story-003-allgreen_24.json' },
    { id: 'story-004-chanmomo_happy', title: 'SNSで出会った夫と初めて会ってご飯行った時…', kicker: '初級〜中級', desc: '@chanmomo_happy', badge: '3段落', file: '/koi/assets/readings/story-004-chanmomo_happy.json' },
    { id: 'story-005-0wc3q1', title: '小学生時代、1人で指パッチンの練習中に全然鳴…', kicker: '初級〜中級', desc: '@0wc3q1', badge: '3段落', file: '/koi/assets/readings/story-005-0wc3q1.json' },
    { id: 'story-006-happy_chan____', title: '散歩中にザリガニを見つけてテンション上がって…', kicker: '初級〜中級', desc: '@happy_chan____', badge: '1段落', file: '/koi/assets/readings/story-006-happy_chan____.json' },
    { id: 'story-007-nocopyk39', title: '「手綺麗だね〜」て言ったら「苦労してないから…', kicker: '初級〜中級', desc: '@nocopyk39', badge: '1段落', file: '/koi/assets/readings/story-007-nocopyk39.json' },
    { id: 'story-008-8963aisiteru', title: '当時、知り合いの知り合いだった人と飲み会で一…', kicker: '初級〜中級', desc: '@8963aisiteru', badge: '1段落', file: '/koi/assets/readings/story-008-8963aisiteru.json' },
    { id: 'story-009-chawanmushino1', title: '手相占い行った話したら、「手相ぐちゃぐちゃな…', kicker: '初級〜中級', desc: '@chawanmushino1', badge: '1段落', file: '/koi/assets/readings/story-009-chawanmushino1.json' },
    { id: 'story-010-tonshichan', title: '※自分語り失礼します。片思いしてる男とハイキ…', kicker: '初級〜中級', desc: '@tonshichan', badge: '2段落', file: '/koi/assets/readings/story-010-tonshichan.json' },
    { id: 'story-011-con_suono15', title: '小学生の時に隣の席になった男の子が、羊の腸が…', kicker: '初級〜中級', desc: '@con_suono15', badge: '1段落', file: '/koi/assets/readings/story-011-con_suono15.json' },
    { id: 'story-012-estate_chan', title: '前の職場の飲み会で席にゴキブリが出て、男性社…', kicker: '初級〜中級', desc: '@estate_chan', badge: '1段落', file: '/koi/assets/readings/story-012-estate_chan.json' },
    { id: 'story-013-_WANTCHU', title: '頑張ってねーって言ったら、ありがとうでも頑張…', kicker: '初級〜中級', desc: '@_WANTCHU', badge: '1段落', file: '/koi/assets/readings/story-013-_WANTCHU.json' },
    { id: 'story-014-CorianderSUKI', title: '中学生の時グランドの掃除中にスポンジを見つけ…', kicker: '初級〜中級', desc: '@CorianderSUKI', badge: '2段落', file: '/koi/assets/readings/story-014-CorianderSUKI.json' },
    { id: 'story-015-longer_longer', title: '高一の春、生物部の体験入部で水槽見てたら、こ…', kicker: '初級〜中級', desc: '@longer_longer', badge: '1段落', file: '/koi/assets/readings/story-015-longer_longer.json' },
    { id: 'story-016-nnnx94', title: 'デート中にくしゃみしたら鼻水を伴うタイプのく…', kicker: '初級〜中級', desc: '@nnnx94', badge: '1段落', file: '/koi/assets/readings/story-016-nnnx94.json' },
    { id: 'story-017-amakomTRPG', title: '一人暮らし始めて好きなものが好きなだけ食べら…', kicker: '初級〜中級', desc: '@amakomTRPG', badge: '1段落', file: '/koi/assets/readings/story-017-amakomTRPG.json' },
    { id: 'story-018-uuuuuuniiiiiii', title: '昔バイト帰りのバス停で新人バイトとバス待ちの…', kicker: '初級〜中級', desc: '@uuuuuuniiiiiii', badge: '2段落', file: '/koi/assets/readings/story-018-uuuuuuniiiiiii.json' },
    { id: 'story-019-va_hirg', title: 'サークルの飲み会の二次会で端っこで大人しくな…', kicker: '初級〜中級', desc: '@va_hirg', badge: '1段落', file: '/koi/assets/readings/story-019-va_hirg.json' },
    { id: 'story-020-ayugiri_ayura', title: '保育園の時に男の子に誕生日聞かれて、答えたら…', kicker: '初級〜中級', desc: '@ayugiri_ayura', badge: '2段落', file: '/koi/assets/readings/story-020-ayugiri_ayura.json' },
    { id: 'story-021-sparc_p', title: '逆に冷めてしまった話で申し訳なんだけど小学生…', kicker: '初級〜中級', desc: '@sparc_p', badge: '1段落', file: '/koi/assets/readings/story-021-sparc_p.json' },
    { id: 'story-022-__8rulm', title: '小学2年生の時に軍手を数える場面で「一双」っ…', kicker: '初級〜中級', desc: '@__8rulm', badge: '1段落', file: '/koi/assets/readings/story-022-__8rulm.json' },
    { id: 'story-023-MarAyKlee_96', title: '冬、仕事中に乾燥して甘皮がちょい裂けてミリ程…', kicker: '初級〜中級', desc: '@MarAyKlee_96', badge: '2段落', file: '/koi/assets/readings/story-023-MarAyKlee_96.json' },
    { id: 'story-024-kawchange', title: 'mbtiを当て合いしてた時に、。 。私「なん…', kicker: '初級〜中級', desc: '@kawchange', badge: '3段落', file: '/koi/assets/readings/story-024-kawchange.json' },
    { id: 'story-025-su_na_ba_', title: '12月24日生まれで「じゃあ誕生日とクリスマ…', kicker: '初級〜中級', desc: '@su_na_ba_', badge: '1段落', file: '/koi/assets/readings/story-025-su_na_ba_.json' },
    { id: 'story-026-unb_irthday', title: '中高男子校の人に「やっぱり思春期は女子に飢え…', kicker: '初級〜中級', desc: '@unb_irthday', badge: '2段落', file: '/koi/assets/readings/story-026-unb_irthday.json' },
    { id: 'story-027-nsy_bb4', title: 'アプリでマッチングした人、私から一通目送って…', kicker: '初級〜中級', desc: '@nsy_bb4', badge: '3段落', file: '/koi/assets/readings/story-027-nsy_bb4.json' },
    { id: 'story-028-__myfavorite__k', title: '秋に男友達とドライブ中、西陽に照らされて金髪…', kicker: '初級〜中級', desc: '@__myfavorite__k', badge: '3段落', file: '/koi/assets/readings/story-028-__myfavorite__k.json' },
    { id: 'story-029-mashirou25', title: '旦那くんが朝食インスタント味噌汁のお湯を入れ…', kicker: '初級〜中級', desc: '@mashirou25', badge: '3段落', file: '/koi/assets/readings/story-029-mashirou25.json' },
    { id: 'story-030-pikatyusuger', title: '高校の時、前の席の子がこれ食べる？ってたまご…', kicker: '初級〜中級', desc: '@pikatyusuger', badge: '1段落', file: '/koi/assets/readings/story-030-pikatyusuger.json' },
    { id: 'story-031-sumeshi_555', title: '元彼の年齢聞かれて「42…」って言ったら秒で…', kicker: '初級〜中級', desc: '@sumeshi_555', badge: '1段落', file: '/koi/assets/readings/story-031-sumeshi_555.json' },
    { id: 'story-032-PUffw8MOz781212', title: '小学校中学年の頃、魚の皮が苦手で鮭の皮をお皿…', kicker: '初級〜中級', desc: '@PUffw8MOz781212', badge: '3段落', file: '/koi/assets/readings/story-032-PUffw8MOz781212.json' },
    { id: 'story-033-stk__555', title: '出かけてる時に急にどっか行ったと思ったらスト…', kicker: '初級〜中級', desc: '@stk__555', badge: '1段落', file: '/koi/assets/readings/story-033-stk__555.json' },
    { id: 'story-034-p_s8v', title: '最近10年来の男友達と車乗ってたら、スマホを…', kicker: '初級〜中級', desc: '@p_s8v', badge: '1段落', file: '/koi/assets/readings/story-034-p_s8v.json' },
    { id: 'story-035-p_s8v', title: '彼氏の家で遊んでて、初めてのキスした。もう帰…', kicker: '初級〜中級', desc: '@p_s8v', badge: '3段落', file: '/koi/assets/readings/story-035-p_s8v.json' },
    { id: 'story-036-kiii67265837', title: 'アプリで出会って、7つ目ぐらいの質問で急に。…', kicker: '初級〜中級', desc: '@kiii67265837', badge: '2段落', file: '/koi/assets/readings/story-036-kiii67265837.json' },
    { id: 'story-037-Ryo211170', title: '職場の人で、自分のデスクにガチャガチャの動物…', kicker: '初級〜中級', desc: '@Ryo211170', badge: '1段落', file: '/koi/assets/readings/story-037-Ryo211170.json' },
    { id: 'story-038-Ryo211170', title: 'ちょっと違うけど、今の旦那と付き合ってた時に…', kicker: '初級〜中級', desc: '@Ryo211170', badge: '1段落', file: '/koi/assets/readings/story-038-Ryo211170.json' },
    { id: 'story-039-_______nono02', title: '高校時代、部活の休み時間に落ちてた板で何か作…', kicker: '初級〜中級', desc: '@_______nono02', badge: '1段落', file: '/koi/assets/readings/story-039-_______nono02.json' },
    { id: 'story-040-hachi_80design', title: '夫が同級生。普段は秀才タイプであんまり話した…', kicker: '初級〜中級', desc: '@hachi_80design', badge: '3段落', file: '/koi/assets/readings/story-040-hachi_80design.json' },
    { id: 'story-041-y1uecdf11', title: '飲み会で何故かタイタニックの話になった時に、…', kicker: '初級〜中級', desc: '@y1uecdf11', badge: '1段落', file: '/koi/assets/readings/story-041-y1uecdf11.json' },
    { id: 'story-042-mogu_hakumai_', title: '相場男性は「任せろ」って言う所を「まかせて」…', kicker: '初級〜中級', desc: '@mogu_hakumai_', badge: '1段落', file: '/koi/assets/readings/story-042-mogu_hakumai_.json' },
    { id: 'story-043-_yokmok', title: '小学生の頃、完璧主義で要領の悪い子だったんだ…', kicker: '初級〜中級', desc: '@_yokmok', badge: '1段落', file: '/koi/assets/readings/story-043-_yokmok.json' },
    { id: 'story-044-9i4daHOFMa7202', title: '言葉のやりとりじゃないけど再現性的に難しいっ…', kicker: '初級〜中級', desc: '@9i4daHOFMa7202', badge: '3段落', file: '/koi/assets/readings/story-044-9i4daHOFMa7202.json' },
    { id: 'story-045-shobooon_danyo', title: '保育園の頃一個上の子と一緒に折り紙折ってて、…', kicker: '初級〜中級', desc: '@shobooon_danyo', badge: '2段落', file: '/koi/assets/readings/story-045-shobooon_danyo.json' },
    { id: 'story-046-icedaisuki_club', title: '中学校の頃、横の席の子に突然、。「世間話しよ…', kicker: '初級〜中級', desc: '@icedaisuki_club', badge: '3段落', file: '/koi/assets/readings/story-046-icedaisuki_club.json' },
    { id: 'story-047-73Gfl', title: '高校生のとき予備校でいつもお調子者のやかまし…', kicker: '初級〜中級', desc: '@73Gfl', badge: '1段落', file: '/koi/assets/readings/story-047-73Gfl.json' },
    { id: 'story-048-runrun1051', title: '私が、「長女だから我慢できた。」って言ったら…', kicker: '初級〜中級', desc: '@runrun1051', badge: '3段落', file: '/koi/assets/readings/story-048-runrun1051.json' },
    { id: 'story-049-__nebou', title: '高3の時知り合った一個上の大学生に有機化学を…', kicker: '初級〜中級', desc: '@__nebou', badge: '2段落', file: '/koi/assets/readings/story-049-__nebou.json' },
    { id: 'story-050-laaa_chan', title: 'にんにく注射打つのに看護師3人やっても刺さら…', kicker: '初級〜中級', desc: '@laaa_chan', badge: '1段落', file: '/koi/assets/readings/story-050-laaa_chan.json' },
  ];

  function renderList() {
    container.innerHTML = '';
    document.title = '読解ルーム | たかのーと';

    const wrapper = document.createElement('div');
    wrapper.id = 'page-category';
    wrapper.className = 'reading-room-layout';

    // 見出し
    const h1 = document.createElement('h1');
    h1.className = 'ps-lg-2';
    h1.innerHTML = `
      <i class="far fa-book-open fa-fw text-muted"></i>
      読解ルーム
      <span class="lead text-muted ps-2">${READING_LIST.length} 記事</span>
    `;
    wrapper.appendChild(h1);

    // サブタイトル
    const sub = document.createElement('p');
    sub.className = 'text-muted ps-lg-2';
    sub.textContent = '短い文章で日本語を深く読む。逐語訳・文法解説・音声練習付き。';
    wrapper.appendChild(sub);

    // 記事リスト
    const ul = document.createElement('ul');
    ul.className = 'content ps-0';

    READING_LIST.forEach(r => {
      const li = document.createElement('li');
      li.className = 'd-flex justify-content-between px-md-3';
      li.style.cursor = 'pointer';

      const a = document.createElement('a');
      a.textContent = r.title;
      a.href = `/koi/reading-room/?read=${r.id}`;

      const dash = document.createElement('span');
      dash.className = 'dash flex-grow-1';

      const level = document.createElement('span');
      level.className = 'text-muted small text-nowrap';
      level.textContent = r.kicker;

      li.appendChild(a);
      li.appendChild(dash);
      li.appendChild(level);

      li.addEventListener('click', (e) => {
        e.preventDefault();
        loadReading(r.id);
        history.pushState({}, '', `/koi/reading-room/?read=${r.id}`);
      });

      ul.appendChild(li);
    });

    wrapper.appendChild(ul);
    container.appendChild(wrapper);
  }

  // ======================================================================
  //  読解ロード
  // ======================================================================
  function loadReading(id) {
    const reading = READING_LIST.find(r => r.id === id);
    if (!reading) { renderList(); return; }

    container.innerHTML = '<div class="rr-loading">読み込み中…</div>';

    fetch(reading.file)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const doc = Array.isArray(data) ? data[0] : data;
        renderReader(doc);
      })
      .catch(err => {
        container.innerHTML = `<div class="rr-error">❌ 読み込みエラー: ${escHtml(err.message)}</div>`;
      });
  }

  // ======================================================================
  //  読解表示
  // ======================================================================
  function renderReader(data) {
    currentData = data;
    currentParaIdx = -1;
    currentAudio = null;
    isPlaying = false;
    audioQueue = [];
    isAutoMode = false;

    container.innerHTML = '';

    // タイトル
    document.title = `${escHtml(data.title)} | 読解ルーム | たかのーと`;

    const wrapper = document.createElement('div');
    wrapper.className = 'rr-reader';

    // 戻る
    const backWrap = document.createElement('div');
    backWrap.className = 'rr-back-wrap';

    const backBtn = document.createElement('button');
    backBtn.className = 'rr-back-btn';
    backBtn.innerHTML = '← 一覧へ戻る';
    backBtn.addEventListener('click', () => {
      stopAudio();
      renderList();
      history.pushState({}, '', '/koi/reading-room/');
    });
    backWrap.appendChild(backBtn);

    // 残段落表示
    const paraCount = document.createElement('span');
    paraCount.className = 'rr-para-count';
    paraCount.textContent = `${data.paragraphs.length}段落`;
    backWrap.appendChild(paraCount);

    wrapper.appendChild(backWrap);

    // タイトル
    const hdr = document.createElement('div');
    hdr.className = 'rr-reader-header';
    hdr.innerHTML = `<h1 class="rr-reader-title">${escHtml(data.title)}</h1>`;
    wrapper.appendChild(hdr);

    // ツールバー
    wrapper.appendChild(buildToolbar());

    // 凡例
    wrapper.appendChild(buildLegend());

    // 本文
    const article = document.createElement('div');
    article.className = 'rr-article';
    article.id = 'rr-article';

    data.paragraphs.forEach((para, idx) => {
      article.appendChild(buildParagraph(para, idx));
    });

    wrapper.appendChild(article);



    container.appendChild(wrapper);

    // ツールバー状態復元
    restoreToolbarState();

    // キーボードバインド
    if (!window._rrKeyBound) {
      window._rrKeyBound = true;
      document.addEventListener('keydown', handleKeydown);
    }

    // 最初の段落にスクロール
    setTimeout(() => {
      const firstPara = document.querySelector('.rr-para');
      if (firstPara) firstPara.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ======================================================================
  //  ツールバー
  // ======================================================================
  const TOOLBAR_TOGGLES = [
    { id: 'ruby',    label: '🔤 ルビ',        cls: 'rr-hide-ruby',  default: false },
    { id: 'gap',     label: '📏 間隔なし',    cls: 'rr-no-gap',     default: false },
    { id: 'color',   label: '🎨 品詞色',      cls: 'rr-no-color',   default: false },
    { id: 'compact', label: '📄 コンパクト',  cls: 'rr-compact',    default: false },
    { id: 'large',   label: '🔍 拡大',        cls: 'rr-large',      default: false },
  ];

  function buildToolbar() {
    const tb = document.createElement('div');
    tb.className = 'rr-toolbar';
    const inner = document.createElement('div');
    inner.className = 'rr-toolbar-inner';

    TOOLBAR_TOGGLES.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'rr-toolbar-btn' + (t.default ? ' active' : '');
      btn.textContent = t.label;
      btn.dataset.toggleId = t.id;
      btn.addEventListener('click', () => {
        const isActive = document.body.classList.toggle(t.cls);
        btn.classList.toggle('active', isActive);
        saveToolbarState();
      });
      inner.appendChild(btn);
    });

    inner.appendChild(sep());

    // 停止
    const stopBtn = document.createElement('button');
    stopBtn.className = 'rr-toolbar-btn';
    stopBtn.textContent = '⏹ 停止';
    stopBtn.addEventListener('click', stopAudio);
    inner.appendChild(stopBtn);

    // 自動再生
    const autoBtn = document.createElement('button');
    autoBtn.className = 'rr-toolbar-btn';
    autoBtn.textContent = '▶ 全再生';
    autoBtn.addEventListener('click', () => playAll());
    inner.appendChild(autoBtn);

    inner.appendChild(sep());

    // ループ
    const loopLabel = document.createElement('label');
    loopLabel.className = 'rr-loop-toggle';
    loopLabel.innerHTML = `<input type="checkbox" id="rr-loop-cb"> 🔁 ループ`;
    inner.appendChild(loopLabel);

    tb.appendChild(inner);
    return tb;
  }

  function sep() {
    const el = document.createElement('span');
    el.className = 'rr-toolbar-sep';
    return el;
  }

  function buildLegend() {
    const l = document.createElement('div');
    l.className = 'rr-legend';
    [
      ['名詞', 'noun'],
      ['動詞', 'verb'],
      ['助詞', 'particle'],
      ['形容詞', 'adj'],
      ['副詞', 'adverb'],
      ['接続', 'connector'],
      ['文法', 'grammar'],
    ].forEach(([label, cls]) => {
      const span = document.createElement('span');
      span.className = `rr-legend-item`;
      span.style.color = `var(--rr-${cls})`;
      const dot = document.createElement('span');
      dot.className = 'rr-legend-dot';
      dot.style.background = `var(--rr-${cls})`;
      span.appendChild(dot);
      span.appendChild(document.createTextNode(label));
      l.appendChild(span);
    });
    return l;
  }

  // ---- ツールバー状態保存 ----
  function saveToolbarState() {
    const state = {};
    TOOLBAR_TOGGLES.forEach(t => {
      state[t.id] = document.body.classList.contains(t.cls);
    });
    try { localStorage.setItem('rr-toolbar', JSON.stringify(state)); } catch (e) {}
  }

  function restoreToolbarState() {
    try {
      const raw = localStorage.getItem('rr-toolbar');
      if (!raw) return;
      const state = JSON.parse(raw);
      TOOLBAR_TOGGLES.forEach(t => {
        const val = state[t.id];
        if (val === undefined) return;
        document.body.classList.toggle(t.cls, val);
        const btn = document.querySelector(`[data-toggle-id="${t.id}"]`);
        if (btn) btn.classList.toggle('active', val);
      });
    } catch (e) {}
  }

  // ======================================================================
  //  段落構築
  // ======================================================================
  function buildParagraph(para, idx) {
    const sec = document.createElement('section');
    sec.className = 'rr-para';
    sec.id = para.id || ('p' + (idx + 1));
    sec.dataset.idx = idx;

    // 段ヘッダー
    const head = document.createElement('div');
    head.className = 'rr-para-head';

    const no = document.createElement('span');
    no.className = 'rr-para-no';
    no.textContent = `§ ${String(idx + 1).padStart(2, '0')}`;
    head.appendChild(no);

    // 音声ボタン
    const ab = document.createElement('div');
    ab.className = 'rr-audio-btns';

    const text4audio = escAttr(para.ja);

    const normalBtn = document.createElement('button');
    normalBtn.className = 'rr-audio-btn normal';
    normalBtn.innerHTML = '▶ 普通';
    normalBtn.dataset.text = text4audio;
    normalBtn.dataset.speed = '1';
    normalBtn.dataset.audio = para.audio || '';
    normalBtn.dataset.paraIdx = idx;

    const slowBtn = document.createElement('button');
    slowBtn.className = 'rr-audio-btn slow';
    slowBtn.innerHTML = '▶ ゆっくり';
    slowBtn.dataset.text = text4audio;
    slowBtn.dataset.speed = '0.65';
    slowBtn.dataset.audio = para.audio || '';
    slowBtn.dataset.paraIdx = idx;

    ab.appendChild(normalBtn);
    ab.appendChild(slowBtn);
    head.appendChild(ab);
    sec.appendChild(head);

    // ナビボタン（段落間）
    const prevBtn = document.createElement('button');
    prevBtn.className = 'rr-para-nav-btn';
    prevBtn.textContent = '↑ 前';
    prevBtn.addEventListener('click', () => scrollToPara(idx - 1));
    if (idx === 0) prevBtn.style.visibility = 'hidden';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'rr-para-nav-btn';
    nextBtn.textContent = '↓ 次';
    nextBtn.addEventListener('click', () => scrollToPara(idx + 1));
    if (idx === currentData.paragraphs.length - 1) nextBtn.style.visibility = 'hidden';

    const navInline = document.createElement('div');
    navInline.className = 'rr-nav-inline';
    navInline.appendChild(prevBtn);
    navInline.appendChild(nextBtn);
    head.appendChild(navInline);

    // 本文
    const jpDiv = document.createElement('div');
    jpDiv.className = 'rr-jp-text';
    jpDiv.appendChild(buildTokens(para.words));
    sec.appendChild(jpDiv);

    // 詳細パネル
    sec.appendChild(buildDetail(para));

    // 音声バインド
    ab.querySelectorAll('.rr-audio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pIdx = parseInt(btn.dataset.paraIdx);
        playPara(pIdx, btn);
      });
    });

    return sec;
  }

  // ---- トークン構築（CSS ツールチップ対応） ----
  function buildTokens(words) {
    const frag = document.createDocumentFragment();
    (words || []).forEach(w => {
      if (!w.s) return;

      // 句読点/空白はそのまま
      if (/^[　 　、。．，！？\n\r]+$/.test(w.s)) {
        frag.appendChild(document.createTextNode(w.s));
        return;
      }

      const span = document.createElement('span');
      span.className = 'rr-tok';
      if (w.p && ['noun','verb','particle','adj','adverb','connector','grammar'].includes(w.p)) {
        span.classList.add(w.p);
      }

      // 注釈 → data-note（CSSツールチップ）
      if (w.n) {
        span.setAttribute('data-note', w.n);
      }

      // Ruby 注音
      if (w.r && /[\u4e00-\u9fff]/.test(w.s)) {
        const ruby = document.createElement('ruby');
        ruby.textContent = w.s;
        const rt = document.createElement('rt');
        rt.textContent = w.r;
        ruby.appendChild(rt);
        span.appendChild(ruby);
      } else {
        span.textContent = w.s;
        if (w.r) {
          const sup = document.createElement('sup');
          sup.textContent = `(${w.r})`;
          sup.style.cssText = 'font-size:0.5em;color:var(--rr-muted);';
          span.appendChild(sup);
        }
      }

      frag.appendChild(span);
    });
    return frag;
  }

  // ---- 詳細パネル ----
  function buildDetail(para) {
    const dt = document.createElement('details');
    dt.className = 'rr-detail';

    const sum = document.createElement('summary');
    sum.className = 'rr-detail-summary';
    sum.textContent = ' 翻訳・文法・語彙';
    dt.appendChild(sum);

    const body = document.createElement('div');
    body.className = 'rr-detail-body';

    // 翻訳
    if (para.en) {
      const block = document.createElement('div');
      block.className = 'rr-trans-block';
      block.innerHTML = `
        <span class="rr-trans-label">Translation</span>
        <div class="rr-trans-text">${escHtml(para.en)}</div>
      `;
      body.appendChild(block);
    }

    // 直訳
    if (para.literal) {
      const lit = document.createElement('div');
      lit.className = 'rr-literal';
      lit.textContent = '直訳: ' + para.literal;
      body.appendChild(lit);
    }

    // 文法
    if (para.grammar) {
      const gs = document.createElement('div');
      gs.className = 'rr-grammar-section';
      gs.innerHTML = `
        <span class="rr-grammar-label">Grammar</span>
        <div>${escHtml(para.grammar)}</div>
      `;
      body.appendChild(gs);
    }

    // 語彙
    if (para.vocab && para.vocab.length) {
      const vl = document.createElement('div');
      vl.className = 'rr-vocab-list';
      para.vocab.forEach(v => {
        const item = document.createElement('div');
        item.className = 'rr-vocab-item';
        const reading = v[1] ? ` <span class="rr-vocab-reading">（${escHtml(v[1])}）</span>` : '';
        item.innerHTML = `<strong>${escHtml(v[0])}</strong>${reading} — ${escHtml(v[2])}`;
        vl.appendChild(item);
      });
      body.appendChild(vl);
    }

    dt.appendChild(body);
    return dt;
  }

  // ======================================================================
  //  音声再生
  // ======================================================================
  function playPara(idx, btn) {
    if (!currentData || !currentData.paragraphs[idx]) return;
    stopAudio();
    currentParaIdx = idx;

    const para = currentData.paragraphs[idx];
    const audioSrc = btn.dataset.audio;
    const text = btn.dataset.text;
    const speed = parseFloat(btn.dataset.speed) || 1;

    // スクロール
    const section = document.getElementById(para.id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // ハイライト
    document.querySelectorAll('.rr-para.playing').forEach(p => p.classList.remove('playing'));
    if (section) section.classList.add('playing');

    btn.classList.add('playing');

    if (audioSrc) {
      const audio = new Audio('/koi/' + audioSrc);
      audio.playbackRate = speed;
      audio.loop = document.getElementById('rr-loop-cb').checked;

      audio.addEventListener('ended', () => {
        btn.classList.remove('playing');
        if (audio.loop) {
          audio.currentTime = 0;
          audio.play();
          return;
        }
        if (isAutoMode) {
          playNextInQueue();
        }
      });

      audio.addEventListener('error', () => {
        btn.classList.remove('playing');
        fallbackTTS(text, speed, idx);
      });

      currentAudio = audio;
      isPlaying = true;
      audio.play().catch(() => {
        btn.classList.remove('playing');
        fallbackTTS(text, speed, idx);
      });
    } else {
      fallbackTTS(text, speed, idx);
    }
  }

  function fallbackTTS(text, rate, idx) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate / 1.2;
    u.onend = () => {
      const loop = document.getElementById('rr-loop-cb');
      if (loop && loop.checked) {
        setTimeout(() => fallbackTTS(text, rate, idx), 400);
        return;
      }
      if (isAutoMode) {
        playNextInQueue();
      }
    };
    u.onerror = () => {
      if (isAutoMode) playNextInQueue();
    };
    window.speechSynthesis.speak(u);
    isPlaying = true;
  }

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    window.speechSynthesis.cancel();
    isPlaying = false;
    isAutoMode = false;
    audioQueue = [];
    document.querySelectorAll('.rr-audio-btn.playing').forEach(b => b.classList.remove('playing'));
    document.querySelectorAll('.rr-para.playing').forEach(p => p.classList.remove('playing'));
  }

  // ---- 全段落自動再生 ----
  function playAll() {
    if (!currentData || !currentData.paragraphs.length) return;
    stopAudio();

    isAutoMode = true;
    audioQueue = currentData.paragraphs.map((_, idx) => idx);

    // 最初の段落の「普通」ボタンを探す
    playNextInQueue();
  }

  function playNextInQueue() {
    if (!isAutoMode || audioQueue.length === 0) {
      isAutoMode = false;
      return;
    }

    const nextIdx = audioQueue.shift();
    const section = document.getElementById(currentData.paragraphs[nextIdx].id);
    if (!section) return;

    // この段落の「普通」ボタンを探して再生
    const normalBtn = section.querySelector('.rr-audio-btn.normal');
    if (normalBtn) {
      playPara(nextIdx, normalBtn);
    }
  }

  // ======================================================================
  //  キーボードショートカット
  // ======================================================================
  function handleKeydown(e) {
    // テキスト入力中は無視
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        nextPara();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        prevPara();
        break;
      case ' ':
        e.preventDefault();
        toggleCurrentParaAudio();
        break;
    }
  }

  function scrollToPara(idx) {
    if (!currentData || idx < 0 || idx >= currentData.paragraphs.length) return;
    const section = document.getElementById(currentData.paragraphs[idx].id);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function nextPara() {
    if (currentParaIdx < 0) { scrollToPara(0); currentParaIdx = 0; return; }
    scrollToPara(currentParaIdx + 1);
    if (currentParaIdx + 1 < currentData.paragraphs.length) currentParaIdx++;
  }

  function prevPara() {
    scrollToPara(currentParaIdx - 1);
    if (currentParaIdx > 0) currentParaIdx--;
  }

  function toggleCurrentParaAudio() {
    if (isPlaying) {
      stopAudio();
      return;
    }
    // 現在表示中の最初の段落に「普通」ボタンがあれば再生
    const firstSection = document.querySelector('.rr-para');
    if (!firstSection) return;
    const btn = currentParaIdx >= 0
      ? document.querySelector(`.rr-para[data-idx="${currentParaIdx}"] .rr-audio-btn.normal`)
      : firstSection.querySelector('.rr-audio-btn.normal');
    if (btn) {
      playPara(parseInt(btn.dataset.paraIdx), btn);
    }
  }

  // ======================================================================
  //  ユーティリティ
  // ======================================================================
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
