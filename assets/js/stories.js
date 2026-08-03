/* ==========================================================================
   koi 物語一覧 — 评论 / 引用分享 浏览页
   数据: /koi/assets/data/{comments,quotes,root}.json
   分页: 30 条/页
   ========================================================================== */
(function () {
  'use strict';

  var PER_PAGE = 30;
  var CATS = {
    comments: { label: '评论', file: 'comments.json', icon: 'fa-comment' },
    quotes: { label: '引用分享', file: 'quotes.json', icon: 'fa-retweet' }
  };

  var container, state = { cat: 'comments', page: 1 };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return '';
    var jst = new Date(d.getTime() + 9 * 3600 * 1000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return jst.getUTCFullYear() + '-' + p(jst.getUTCMonth() + 1) + '-' + p(jst.getUTCDate()) +
      ' ' + p(jst.getUTCHours()) + ':' + p(jst.getUTCMinutes());
  }

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var m = h.match(/^(comments|quotes)(?:-(\d+))?$/);
    if (m) {
      state.cat = m[1];
      state.page = parseInt(m[2], 10) || 1;
    }
  }

  function renderTabs(total) {
    var html = '';
    Object.keys(CATS).forEach(function (k) {
      var c = CATS[k];
      var n = total[k] || 0;
      html += '<button class="st-tab' + (state.cat === k ? ' active' : '') + '" data-cat="' + k + '">' +
        '<i class="fas ' + c.icon + '"></i> ' + c.label + ' <span class="st-count">' + n + '</span></button>';
    });
    return html;
  }

  function cardHtml(it, isReply) {
    var h = '<div class="st-card' + (isReply ? ' st-reply' : '') + '">' +
      '<div class="st-meta">' +
      '<span class="st-author"><i class="fas fa-user"></i> @' + esc(it.author || '?') + '</span>' +
      '<span class="st-ts"><i class="far fa-clock"></i> ' + esc(fmtTs(it.ts)) + '</span>' +
      '<a class="st-link" href="' + esc(it.url) + '" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> 查看原帖</a>' +
      '</div>' +
      '<div class="st-text">' + esc(it.text) + '</div>';
    // 引用帖的续写（同作者 thread）
    var rp = it.replies;
    if (rp && rp.length) {
      h += '<div class="st-thread">';
      rp.forEach(function (r) {
        h += '<div class="st-thread-item">' +
          '<div class="st-meta">' +
          '<span class="st-author"><i class="fas fa-reply"></i> @' + esc(r.author || '?') + '</span>' +
          '<span class="st-ts"><i class="far fa-clock"></i> ' + esc(fmtTs(r.ts)) + '</span>' +
          '<a class="st-link" href="' + esc(r.url) + '" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> 查看原帖</a>' +
          '</div>' +
          '<div class="st-text">' + esc(r.text) + '</div>' +
          '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderList(items, cat) {
    var total = items.length;
    var pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PER_PAGE;
    var slice = items.slice(start, start + PER_PAGE);
    var html = '';
    slice.forEach(function (it) {
      html += cardHtml(it, false);
    });
    if (!slice.length) {
      html = '<div class="st-empty">暂无数据</div>';
    }
    // 分页条
    var pageHtml = '<div class="st-pager">' +
      '<button class="st-pg" data-go="prev" ' + (state.page <= 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i> 上一页</button>' +
      '<span class="st-pageinfo">第 ' + state.page + ' / ' + pages + ' 页（共 ' + total + ' 条）</span>' +
      '<button class="st-pg" data-go="next" ' + (state.page >= pages ? 'disabled' : '') + '>下一页 <i class="fas fa-chevron-right"></i></button>' +
      '</div>';
    return html + pageHtml;
  }

  function render() {
    var data = window.__koiData || {};
    var items = data[state.cat] || [];
    var el = document.getElementById('st-app');
    if (!el) return;
    el.innerHTML =
      '<div class="st-tabs">' + renderTabs({ comments: (data.comments || []).length, quotes: (data.quotes || []).length }) + '</div>' +
      '<div class="st-list">' + renderList(items, state.cat) + '</div>';
    location.hash = '/' + state.cat + '-' + state.page;
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('.st-tab');
      if (tab) {
        state.cat = tab.getAttribute('data-cat');
        state.page = 1;
        render();
        return;
      }
      var pg = e.target.closest('.st-pg');
      if (pg) {
        var items = (window.__koiData || {})[state.cat] || [];
        var pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
        if (pg.getAttribute('data-go') === 'prev') state.page = Math.max(1, state.page - 1);
        else state.page = Math.min(pages, state.page + 1);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    });
  }

  function load() {
    if (window.__koiData) { render(); return; }
    Promise.all([
      fetch('/koi/assets/data/comments.json').then(function (r) { return r.json(); }),
      fetch('/koi/assets/data/quotes.json').then(function (r) { return r.json(); })
    ]).then(function (arr) {
      window.__koiData = { comments: arr[0], quotes: arr[1] };
      render();
    }).catch(function (err) {
      var el = document.getElementById('st-app');
      if (el) el.innerHTML = '<div class="st-empty">数据加载失败: ' + esc(err) + '</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    parseHash();
    bind();
    load();
  });
})();
