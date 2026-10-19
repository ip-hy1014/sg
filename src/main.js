const STORE = 'sg-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.results ||= {};
      return parsed;
    }
  } catch (_) {}
  return { results: {} };
}

const state = loadState();

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) {}
}

function resultOf(id) {
  return state.results[id] || null;
}

function record(id, ok) {
  const r = state.results[id] || { ok: 0, ng: 0 };
  if (ok) r.ok += 1; else r.ng += 1;
  r.last = Date.now();
  r.lastOk = ok;
  state.results[id] = r;
  save();
}

// ---------- 集計 ----------

function areaList() {
  return Object.keys(AREA_WEIGHT);
}

function areaStats(area) {
  const qs = QUESTIONS.filter(q => q.area === area);
  let ok = 0, ng = 0, done = 0;
  qs.forEach(q => {
    const r = resultOf(q.id);
    if (!r) return;
    done += 1;
    ok += r.ok;
    ng += r.ng;
  });
  const total = ok + ng;
  return { area, count: qs.length, done, ok, ng, rate: total ? Math.round((ok / total) * 100) : null };
}

function wrongQuestions() {
  return QUESTIONS.filter(q => {
    const r = resultOf(q.id);
    return r && r.lastOk === false;
  });
}

function unseenQuestions() {
  return QUESTIONS.filter(q => !resultOf(q.id));
}

// ---------- 絞り込み ----------

function params() {
  return new URLSearchParams((location.hash.split('?')[1] || ''));
}

function activeArea() { return params().get('area') || ''; }
function activeFind() { return (params().get('find') || '').trim(); }
function activeMode() { return params().get('mode') || ''; }

function pool() {
  const area = activeArea();
  const word = activeFind();
  const mode = activeMode();
  let list = QUESTIONS;
  if (area) list = list.filter(q => q.area === area);
  if (word) { const ts = tokens(word); if (ts.length) list = list.filter(q => matchAll(norm(String(q.tag || '') + String(q.q || '')), ts)); }
  if (mode === 'wrong') list = list.filter(q => { const r = resultOf(q.id); return r && r.lastOk === false; });
  if (mode === 'new') list = list.filter(q => !resultOf(q.id));
  return list;
}

function playHash(extra) {
  const p = params();
  Object.entries(extra || {}).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
  const qs = p.toString();
  return '#/play' + (qs ? '?' + qs : '');
}

// ---------- 出題 ----------

let current = null;
let answered = null;

function pickNext() {
  const list = pool();
  if (!list.length) return null;
  const unseen = list.filter(q => !resultOf(q.id));
  const wrong = list.filter(q => { const r = resultOf(q.id); return r && r.lastOk === false; });
  const rest = list.filter(q => resultOf(q.id));
  const bucket = unseen.length ? unseen : (wrong.length ? wrong : rest);
  const avoid = current ? current.id : null;
  const pickable = bucket.length > 1 ? bucket.filter(q => q.id !== avoid) : bucket;
  return pickable[Math.floor(Math.random() * pickable.length)] || null;
}

// ---------- 画面 ----------

// 検索の表記ゆれを吸収する。大小文字、全角半角、カタカナひらがな、区切り記号。
// 空白で区切った語を全部含むものだけを拾う
function tokens(q) {
  return String(q || '').trim().split(/[\s\u3000]+/).map(norm).filter(Boolean);
}

function matchAll(hay, ts) {
  return ts.every(t => hay.includes(t));
}

function norm(s) {
  return String(s || '')
    .replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\u3000・･‐‑‒–—―ー\-_/]/g, '')
    .toLowerCase();
}

function esc(s) {
  return String(s).replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function header(view) {
  const tabs = [
    ['/', 'ホーム'],
    ['/play', '問題'],
    ['/guide', '論点'],
    ['/terms', '用語'],
    ['/weak', '弱点']
  ];
  return `
    <div class="navwrap">
      <div class="navinner">
        <a class="brand" href="#/">SG</a>
        <nav>
          ${tabs.map(([p, n]) => `<a class="${view === p ? 'active' : ''}" href="#${p}" ${view === p ? 'data-totop' : ''}>${n}</a>`).join('')}
        </nav>
      </div>
    </div>
  `;
}

function homePage() {
  const rows = areaList().map(a => {
    const s = areaStats(a);
    const rate = s.rate === null ? '—' : s.rate + '%';
    const cls = s.rate === null ? '' : (s.rate >= 75 ? 'good' : (s.rate >= 50 ? '' : 'bad'));
    return `<tr>
      <td><a href="${playHash({ area: a, find: '', mode: '' })}">${esc(a)}</a></td>
      <td class="num">${s.count}</td>
      <td class="num">${s.done}</td>
      <td class="num ${cls}">${rate}</td>
    </tr>`;
  }).join('');

  const totalOk = Object.values(state.results).reduce((n, r) => n + r.ok, 0);
  const totalNg = Object.values(state.results).reduce((n, r) => n + r.ng, 0);
  const overall = (totalOk + totalNg) ? Math.round((totalOk / (totalOk + totalNg)) * 100) : null;
  const seen = Object.keys(state.results).length;
  const wrong = wrongQuestions().length;

  return `${header('/')}
    <main>
      <h1>ホーム</h1>
      <p class="lead">全${QUESTIONS.length}問のうち${seen}問に解答。通算正答率${overall === null ? '—' : overall + '%'}。直近で間違えたまま${wrong}問。</p>
      <p class="actions">
        <a class="btn" href="${playHash({ area: '', find: '', mode: 'new' })}">未出題を解く</a>
        <a class="btn" href="${playHash({ area: '', find: '', mode: 'wrong' })}">間違えた問題を解く</a>
        <a class="btn" href="#/guide">論点を読む</a>
      </p>
      <div class="tablewrap"><table>
        <caption>分野別</caption>
        <thead><tr><th>分野</th><th class="num">問題数</th><th class="num">解答済</th><th class="num">正答率</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="note">分野名を押すと、その分野だけを出題します。</p>
      <p class="note"><button class="link" data-reset>解答の記録を消す</button></p>
    </main>`;
}

function filterBar() {
  const area = activeArea();
  const word = activeFind();
  const mode = activeMode();
  const chips = [['', 'すべて']].concat(areaList().map(a => [a, a]));
  return `
    <div class="filters">
      <div class="chips">
        ${chips.map(([v, label]) => `<a class="chip ${area === v ? 'on' : ''}" href="${playHash({ area: v })}">${esc(label)}</a>`).join('')}
      </div>
      <div class="chips">
        ${[['', 'すべて'], ['new', '未出題'], ['wrong', '間違えたもの']].map(([v, label]) =>
          `<a class="chip ${mode === v ? 'on' : ''}" href="${playHash({ mode: v })}">${esc(label)}</a>`).join('')}
      </div>
      <form class="findbar" id="findform">
        <input id="findword" type="search" placeholder="語で絞る" value="${esc(word)}"/>
        <button type="submit">絞る</button>
        ${word ? `<a class="link" href="${playHash({ find: '' })}">解除</a>` : ''}
      </form>
    </div>`;
}

function playPage() {
  const list = pool();
  if (!current || !list.some(q => q.id === current.id)) {
    current = pickNext();
    answered = null;
  }
  if (!current) {
    return `${header('/play')}
      <main>
        ${filterBar()}
        <p class="empty">条件に合う問題がありません。絞り込みを変えてください。</p>
      </main>`;
  }

  const q = current;
  const r = resultOf(q.id);
  const meta = `${esc(q.area)}${q.tag ? ' · ' + esc(q.tag) : ''}${r ? ` · 正${r.ok}/誤${r.ng}` : ' · 未出題'}`;

  let body;
  if (q.a) {
    body = `<ol class="choices">${q.a.map((c, i) => {
      let cls = '';
      if (answered !== null) {
        if (i === q.correct) cls = 'right';
        else if (i === answered) cls = 'wrong';
      }
      return `<li><button class="choice ${cls}" data-choice="${i}" ${answered !== null ? 'disabled' : ''}>${esc(c)}</button></li>`;
    }).join('')}</ol>`;
  } else {
    body = answered === null
      ? `<p class="actions"><button class="btn" data-reveal>答えを見る</button></p>`
      : `<p class="answer">${esc(q.ans || '')}</p>`;
  }

  const result = answered === null ? '' : `
    <div class="result ${q.a ? (answered === q.correct ? 'ok' : 'ng') : ''}">
      ${q.a ? `<p class="verdict">${answered === q.correct ? '正解' : '不正解'}</p>` : ''}
      <p class="why">${esc(q.why || '')}</p>
      ${q.a ? `<p class="actions"><button class="btn" data-mark="1">わかっていた</button><button class="btn" data-mark="0">あやしい</button></p>` : ''}
      <p class="actions"><button class="btn primary" data-next>次の問題</button></p>
    </div>`;

  return `${header('/play')}
    <main>
      ${filterBar()}
      <p class="count">残り ${list.length} 問が対象</p>
      <article class="card">
        <p class="meta">${meta}</p>
        <p class="qtext">${esc(q.q)}</p>
        ${body}
        ${result}
      </article>
    </main>`;
}

function guidePage() {
  const html = window.SG_GUIDE || '';
  const inner = html
    .replace(/[\s\S]*?<main>/, '')
    .replace(/<\/main>[\s\S]*/, '')
    // 文書内リンクはハッシュを書き換えずにスクロールさせる。
    // そのままだとルーターが反応して別の画面に飛ぶ。
    .replace(/href="#([^"\/][^"]*)"/g, 'data-jump="$1" href="#/guide"')
    // 表が画面幅を超えてページ全体を押し広げないよう、箱に入れて横スクロールさせる
    .replace(/<table>/g, '<div class="tablewrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return `${header('/guide')}
    <main class="guide">
      ${inner || '<p class="empty">論点が読み込めませんでした。</p>'}
    </main>`;
}

function termsPage() {
  const list = (typeof GLOSSARY !== 'undefined' && GLOSSARY) || [];
  if (!list.length) {
    return `${header('/terms')}<main><p class="empty">用語集が読み込めませんでした。</p></main>`;
  }
  const p = params();
  const word = (p.get('q') || '').trim();
  const group = p.get('g') || '';
  const groups = [];
  list.forEach(x => { if (!groups.includes(x.a)) groups.push(x.a); });

  const inGroup = group ? list.filter(x => x.a === group) : list;

  const chip = (v, label, key) => {
    const q = new URLSearchParams(p.toString());
    if (v) q.set(key, v); else q.delete(key);
    const qs = q.toString();
    return `<a class="chip ${(p.get(key) || '') === v ? 'on' : ''}" href="#/terms${qs ? '?' + qs : ''}">${esc(label)}</a>`;
  };

  // 全件を描画しておき、入力に応じて表示を切り替える。再描画しないので入力欄の焦点が外れない。
  const items = inGroup.map(x => `
    <div class="term" data-s="${esc(norm(x.t + (x.f || '') + x.d + (x.n || '')))}">
      <dt>${esc(x.t)}<span class="tag">${esc(x.a)}</span></dt>
      ${x.f ? `<p class="full">${esc(x.f)}</p>` : ''}
      <dd>${esc(x.d)}${x.n ? `<em>${esc(x.n)}</em>` : ''}</dd>
    </div>`).join('');

  return `${header('/terms')}
    <main>
      <h1>用語集</h1>
      <p class="lead">論点と問題に出てくる用語を集めています。全${list.length}語。</p>
      <div class="filters">
        <div class="chips">${[chip('', 'すべて', 'g')].concat(groups.map(g => chip(g, g, 'g'))).join('')}</div>
        <div class="findbar">
          <input id="termword" type="search" placeholder="用語を探す" value="${esc(word)}" autocomplete="off" autocapitalize="off" spellcheck="false"/>
          <button type="button" id="termclear" class="link" ${word ? '' : 'hidden'}>消す</button>
        </div>
      </div>
      <p class="count"><span id="termcount">${inGroup.length}</span> 語</p>
      <dl class="terms">${items}</dl>
      <p class="empty" id="termempty" hidden>該当する用語がありません。</p>
    </main>`;
}

function weakPage() {
  const wrong = wrongQuestions();
  const byArea = {};
  wrong.forEach(q => { (byArea[q.area] ||= []).push(q); });
  const blocks = areaList().filter(a => byArea[a]).map(a => `
    <section>
      <h2>${esc(a)}<span class="badge">${byArea[a].length}</span></h2>
      <ul class="weaklist">
        ${byArea[a].map(q => `<li>
          <b>${esc(q.tag || '')}</b>
          <span>${esc(q.q)}</span>
          <em>${esc(q.why || '')}</em>
        </li>`).join('')}
      </ul>
    </section>`).join('');

  const rows = areaList().map(a => {
    const s = areaStats(a);
    if (s.rate === null) return '';
    return `<tr><td>${esc(a)}</td><td class="num">${s.ok}</td><td class="num">${s.ng}</td><td class="num ${s.rate >= 75 ? 'good' : (s.rate < 50 ? 'bad' : '')}">${s.rate}%</td></tr>`;
  }).join('');

  return `${header('/weak')}
    <main>
      <h1>弱点</h1>
      ${rows ? `<div class="tablewrap"><table><caption>分野別の正誤</caption>
        <thead><tr><th>分野</th><th class="num">正</th><th class="num">誤</th><th class="num">正答率</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : ''}
      ${wrong.length
        ? `<p class="lead">直近の解答で間違えたままの${wrong.length}問です。<a href="${playHash({ area: '', find: '', mode: 'wrong' })}">まとめて解く</a></p>${blocks}`
        : '<p class="empty">間違えたまま残っている問題はありません。</p>'}
    </main>`;
}

// ---------- ルーティング ----------

function route() {
  return (location.hash.replace(/^#/, '').split('?')[0]) || '/';
}

function mount() {
  const path = route();
  const app = document.getElementById('app');
  const page =
      path === '/play' ? playPage()
    : path === '/guide' ? guidePage()
    : path === '/terms' ? termsPage()
    : path === '/weak' ? weakPage()
    : homePage();
  app.innerHTML = page + '<button class="totop" data-top title="先頭へ戻る" aria-label="先頭へ戻る">↑</button>';
  bind(path);
  window.scrollTo(0, 0);
}

function bind(path) {
  const app = document.getElementById('app');

  app.querySelectorAll('[data-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      answered = Number(btn.dataset.choice);
      record(current.id, answered === current.correct);
      mount();
    });
  });

  const reveal = app.querySelector('[data-reveal]');
  if (reveal) reveal.addEventListener('click', () => { answered = 1; mount(); });

  app.querySelectorAll('[data-mark]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = state.results[current.id];
      if (r) { r.lastOk = btn.dataset.mark === '1'; save(); }
      current = pickNext();
      answered = null;
      mount();
    });
  });

  const next = app.querySelector('[data-next]');
  if (next) next.addEventListener('click', () => {
    current = pickNext();
    answered = null;
    mount();
  });

  const form = app.querySelector('#findform');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = app.querySelector('#findword').value.trim();
    current = null;
    answered = null;
    location.hash = playHash({ find: word });
    if (path === '/play') mount();
  });

  app.querySelectorAll('[data-jump]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(a.dataset.jump);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const top = app.querySelector('[data-top]');
  if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  app.querySelectorAll('[data-totop]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  const tinput = app.querySelector('#termword');
  if (tinput) {
    const nodes = Array.from(app.querySelectorAll('.term'));
    const countEl = app.querySelector('#termcount');
    const emptyEl = app.querySelector('#termempty');
    const clearBtn = app.querySelector('#termclear');
    const apply = () => {
      const ts = tokens(tinput.value);
      let hit = 0;
      nodes.forEach(n => {
        const ok = !ts.length || matchAll(n.dataset.s, ts);
        n.hidden = !ok;
        if (ok) hit += 1;
      });
      if (countEl) countEl.textContent = String(hit);
      if (emptyEl) emptyEl.hidden = hit !== 0;
      if (clearBtn) clearBtn.hidden = !tinput.value;
      // 再読み込みしても同じ状態に戻るよう、画面を描き直さずにURLだけ更新する
      const q = params();
      if (tinput.value) q.set('q', tinput.value); else q.delete('q');
      const qs = q.toString();
      history.replaceState(null, '', '#/terms' + (qs ? '?' + qs : ''));
    };
    tinput.addEventListener('input', apply);
    if (clearBtn) clearBtn.addEventListener('click', () => { tinput.value = ''; apply(); tinput.focus(); });
    if (tinput.value) apply();
  }

  const reset = app.querySelector('[data-reset]');
  if (reset) reset.addEventListener('click', () => {
    if (!confirm('解答の記録をすべて消します。よろしいですか。')) return;
    state.results = {};
    save();
    mount();
  });
}

window.addEventListener('hashchange', () => {
  current = null;
  answered = null;
  mount();
});

mount();
