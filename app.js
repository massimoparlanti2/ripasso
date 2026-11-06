'use strict';
/* Ripasso — quiz per studiare le lezioni. Vanilla JS, nessuna dipendenza (KaTeX opzionale da CDN). */

const LS_LOCAL = 'ripasso.local.v1', LS_STATS = 'ripasso.stats.v1', LS_PREFS = 'ripasso.prefs.v1';
const TYPES = { multipla: 'Risposta multipla', vero_falso: 'Vero / Falso', completamento: 'Completamento', errore: "Trova l'errore" };
const TYPE_ALIAS = {
  multipla: 'multipla', crocette: 'multipla', crocetta: 'multipla', scelta_multipla: 'multipla', risposta_multipla: 'multipla',
  vero_falso: 'vero_falso', verofalso: 'vero_falso', vf: 'vero_falso', v_f: 'vero_falso',
  completamento: 'completamento', completa: 'completamento', cloze: 'completamento',
  errore: 'errore', trova_errore: 'errore', trova_l_errore: 'errore', trova_lerrore: 'errore'
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');

/* ---------- utils ---------- */
const slug = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const enc = encodeURIComponent;
function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Memoria del browser piena: esporta un backup'); } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400); }
function fmt(s) {
  return esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}
function typeset(el) {
  if (!window.renderMathInElement) return;
  try {
    renderMathInElement(el, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false, ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'select', 'input']
    });
  } catch { }
}
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pctTxt = v => v == null ? '—' : Math.round(v * 100) + '%';
const pctCls = v => v == null ? 'na' : v >= .75 ? 'hi' : v < .5 ? 'lo' : '';
const pbar = f => `<div class="pbar"><i style="width:${Math.round(Math.max(0, Math.min(1, f || 0)) * 100)}%"></i></div>`;
const cut = (t, n) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- stato ---------- */
let STATS = load(LS_STATS, null) || { q: {}, sessions: [], days: {} };
STATS.q ||= {}; STATS.sessions ||= []; STATS.days ||= {};
let LOCAL = load(LS_LOCAL, []);
let PREFS = Object.assign({ n: 10, order: 'smart' }, load(LS_PREFS, {}));
let REPO = [], LOAD_ERRORS = [], DB = new Map(), QUIZ = null;

/* ---------- parsing / validazione ---------- */
const BL_RE = /\[\[([\s\S]*?)\]\]/g;
const ER_RE = /\{\{([\s\S]*?)\}\}/g;

function parseBlanks(testo) {
  const parts = []; let last = 0;
  for (const m of testo.matchAll(BL_RE)) {
    parts.push({ t: testo.slice(last, m.index) });
    const ans = m[1].split('|').map(s => s.trim()).filter(Boolean);
    if (!ans.length) throw 'c\'è uno spazio [[ ]] senza risposta';
    parts.push({ b: ans });
    last = m.index + m[0].length;
  }
  parts.push({ t: testo.slice(last) });
  if (!parts.some(p => p.b)) throw '"testo" deve contenere almeno uno spazio [[risposta]]';
  return parts.filter(p => p.b || p.t);
}
function parseErr(testo) {
  const m = [...testo.matchAll(ER_RE)];
  if (m.length !== 1) throw `"testo" deve contenere esattamente un {{sbagliato|corretto}} (trovati ${m.length})`;
  const inner = m[0][1], p = inner.indexOf('|');
  const wrong = p < 0 ? inner : inner.slice(0, p), right = p < 0 ? '' : inner.slice(p + 1);
  if (!wrong.trim()) throw 'la parte sbagliata dentro {{ }} è vuota';
  return { before: testo.slice(0, m[0].index), wrong, right, after: testo.slice(m[0].index + m[0][0].length) };
}
function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = norm(v);
  if (['vero', 'v', 'true', 'si', 'sì', 't'].includes(s)) return true;
  if (['falso', 'f', 'false', 'no'].includes(s)) return false;
  throw '"risposta" deve essere true/false (oppure "vero"/"falso")';
}

function normQuestion(q, ctx) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) throw 'non è un oggetto {...}';
  const tipo = TYPE_ALIAS[slug(q.tipo).replace(/-/g, '_')];
  if (!tipo) throw `"tipo" mancante o sconosciuto (${JSON.stringify(q.tipo ?? null)}). Usa: multipla, vero_falso, completamento, errore`;
  const out = { tipo };
  if (q.spiegazione) out.spiegazione = String(q.spiegazione);
  if (q.codice) out.codice = String(q.codice);
  let key;
  if (tipo === 'multipla') {
    if (!q.domanda) throw 'manca "domanda"';
    if (!Array.isArray(q.opzioni) || q.opzioni.length < 2) throw '"opzioni" deve essere una lista con almeno 2 voci';
    const c = q.corretta ?? q.corrette;
    if (c == null || (Array.isArray(c) && !c.length)) throw 'manca "corretta"';
    const idx = (Array.isArray(c) ? c : [c]).map(x => {
      if (typeof x === 'string' && /^[A-Za-z]$/.test(x.trim())) return x.trim().toUpperCase().charCodeAt(0) - 65;
      if (typeof x === 'string') { const i = q.opzioni.findIndex(o => norm(o) === norm(x)); if (i >= 0) return i; }
      throw `"corretta" non valida: ${JSON.stringify(x)} (usa le lettere "A", "B", …)`;
    });
    if (idx.some(i => i < 0 || i >= q.opzioni.length)) throw `"corretta" indica un'opzione che non esiste (ci sono ${q.opzioni.length} opzioni)`;
    Object.assign(out, { domanda: String(q.domanda), opzioni: q.opzioni.map(String), corrette: [...new Set(idx)].sort((a, b) => a - b), mescola: q.mescola !== false });
    key = out.domanda + '|' + out.opzioni.join('|');
  } else if (tipo === 'vero_falso') {
    const a = q.affermazione ?? q.domanda;
    if (!a) throw 'manca "affermazione"';
    if (q.risposta == null) throw 'manca "risposta" (true/false)';
    Object.assign(out, { affermazione: String(a), risposta: parseBool(q.risposta) });
    key = out.affermazione;
  } else if (tipo === 'completamento') {
    if (!q.testo) throw 'manca "testo"';
    out.testo = String(q.testo);
    out.parts = parseBlanks(out.testo);
    if (q.domanda) out.domanda = String(q.domanda);
    if (Array.isArray(q.distrattori) && q.distrattori.length) out.distrattori = q.distrattori.map(String);
    key = out.testo;
  } else {
    if (!q.testo) throw 'manca "testo"';
    out.testo = String(q.testo);
    out.err = parseErr(out.testo);
    if (q.domanda) out.domanda = String(q.domanda);
    key = out.testo;
  }
  out.id = ctx + '/' + (q.id != null ? 'u:' + String(q.id) : hash(tipo + '|' + key));
  return out;
}

/** Accetta: una lezione {materia, lezione, domande}, una lista di lezioni, o {materia, lezioni:[{lezione, domande}]} */
function parsePayload(json) {
  const errors = [], lessons = [];
  let items;
  if (Array.isArray(json)) items = json;
  else if (json && Array.isArray(json.lezioni)) items = json.lezioni.map(l => ({ materia: json.materia, ...l }));
  else items = [json];
  items.forEach((l, li) => {
    const where = items.length > 1 ? `Lezione ${li + 1}` : 'File';
    if (!l || typeof l !== 'object') { errors.push(`${where}: non è un oggetto`); return; }
    if (!l.materia) { errors.push(`${where}: manca "materia"`); return; }
    if (!l.lezione) { errors.push(`${where}: manca "lezione"`); return; }
    if (!Array.isArray(l.domande)) { errors.push(`${l.materia} › ${l.lezione}: manca la lista "domande"`); return; }
    const ctx = slug(l.materia) + '/' + slug(l.lezione);
    const domande = [], seen = new Set();
    l.domande.forEach((q, qi) => {
      try {
        const n = normQuestion(q, ctx);
        if (seen.has(n.id)) { errors.push(`${l.lezione}, domanda ${qi + 1}: duplicata, ignorata`); return; }
        seen.add(n.id); domande.push(n);
      } catch (e) { errors.push(`${l.lezione}, domanda ${qi + 1}: ${e.message || e}`); }
    });
    const m = String(l.lezione).match(/^\s*[A-Za-z]{0,2}\s*(\d+(?:\.\d+)?)/);
    const ordine = Number.isFinite(+l.ordine) && l.ordine !== '' && l.ordine != null ? +l.ordine : m ? +m[1] : 9999;
    lessons.push({ materia: String(l.materia).trim(), lezione: String(l.lezione).trim(), ordine, domande });
  });
  return { lessons, errors };
}

/* ---------- database in memoria ---------- */
function addLesson(l, source) {
  const sid = slug(l.materia), lid = slug(l.lezione);
  let s = DB.get(sid);
  if (!s) { s = { id: sid, nome: l.materia, lessons: new Map() }; DB.set(sid, s); }
  let le = s.lessons.get(lid);
  if (!le) { le = { id: lid, sid, nome: l.lezione, ordine: l.ordine, sources: new Set(), domande: [] }; s.lessons.set(lid, le); }
  le.sources.add(source);
  const ids = new Set(le.domande.map(q => q.id));
  for (const q of l.domande) if (!ids.has(q.id)) { le.domande.push({ ...q, sid, lid }); ids.add(q.id); }
}
function rebuild() {
  DB = new Map();
  REPO.forEach(l => addLesson(l, 'repo'));
  LOCAL.forEach(l => addLesson(l, 'local'));
}
async function loadRepo() {
  LOAD_ERRORS = []; REPO = [];
  let idx;
  try { const r = await fetch('data/index.json', { cache: 'no-cache' }); if (!r.ok) return; idx = await r.json(); }
  catch { return; }
  const files = idx.file || idx.files || [];
  const res = await Promise.all(files.map(async f => {
    try {
      const r = await fetch('data/' + f, { cache: 'no-cache' });
      if (!r.ok) throw new Error('file non trovato (HTTP ' + r.status + ')');
      const p = parsePayload(await r.json());
      p.errors.forEach(e => LOAD_ERRORS.push(`${f} — ${e}`));
      return p.lessons;
    } catch (e) { LOAD_ERRORS.push(`${f} — ${e.message || e}`); return []; }
  }));
  REPO = res.flat();
}
const sortedLessons = s => [...s.lessons.values()].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome, 'it', { numeric: true }));
const allQ = s => sortedLessons(s).flatMap(l => l.domande);
function findQ(id) { for (const s of DB.values()) for (const l of s.lessons.values()) for (const q of l.domande) if (q.id === id) return q; return null; }

/* ---------- statistiche ---------- */
function record(q, ok) {
  const s = STATS.q[q.id] || (STATS.q[q.id] = { n: 0, ok: 0, streak: 0 });
  s.n++; if (ok) s.ok++;
  s.streak = ok ? s.streak + 1 : 0; s.last = ok; s.t = Date.now();
  const d = today(); (STATS.days[d] ||= {}); STATS.days[d][q.sid] = (STATS.days[d][q.sid] || 0) + 1;
  save(LS_STATS, STATS);
}
function aggr(qs) {
  let n = 0, ok = 0, seen = 0, mastered = 0, review = 0;
  for (const q of qs) {
    const s = STATS.q[q.id]; if (!s) continue;
    seen++; n += s.n; ok += s.ok;
    if (s.streak >= 2) mastered++;
    if (s.last === false) review++;
  }
  return { total: qs.length, seen, n, ok, acc: n ? ok / n : null, mastered, review };
}
const needsReview = q => STATS.q[q.id]?.last === false;
function weight(q) { const s = STATS.q[q.id]; if (!s) return 3; if (s.last === false) return 5; if (s.streak >= 3) return .35; if (s.streak >= 2) return 1; return 2; }
function smartSample(pool, n) { return pool.map(q => ({ q, k: Math.pow(Math.random(), 1 / weight(q)) })).sort((a, b) => b.k - a.k).slice(0, n).map(x => x.q); }

/* ---------- vista / router ---------- */
function view(title, back, html, o = {}) {
  $('#title').textContent = title;
  const b = $('#back'); b.hidden = !back;
  b.onclick = () => o.onBack ? o.onBack() : (location.hash = back);
  $('#bar-right').innerHTML = o.right || '';
  app.innerHTML = html;
  if (!o.keepScroll) window.scrollTo(0, 0);
  typeset(app);
}
function route() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean).map(decodeURIComponent);
  if (QUIZ && p[0] !== 'quiz') QUIZ = null;
  if (!p.length) return home();
  if (p[0] === 'm' && p[2] === 'l') return lessonView(p[1], p[3]);
  if (p[0] === 'm' && p[2] === 'quiz') return subjectSetup(p[1]);
  if (p[0] === 'm') return subjectView(p[1]);
  if (p[0] === 'stats') return statsView(p[1]);
  if (p[0] === 'quiz') return quizView();
  if (p[0] === 'importa') return importView();
  if (p[0] === 'formato') return formatView();
  if (p[0] === 'dati') return dataView();
  home();
}
function notFound() { view('Non trovato', '#/', `<div class="empty">Questa pagina non esiste più.<br><a class="btn" href="#/">Torna alla home</a></div>`); }

/* ---------- home ---------- */
function home() {
  const subs = [...DB.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  let h = '';
  if (LOAD_ERRORS.length) h += `<div class="warn"><b>Alcune domande dei file del repo non sono state caricate:</b><ul>${LOAD_ERRORS.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join('')}</ul>${LOAD_ERRORS.length > 8 ? `…e altre ${LOAD_ERRORS.length - 8}` : ''}</div>`;
  if (!subs.length) {
    h += `<div class="empty"><p><b>Nessuna materia ancora.</b><br>Importa un file di quiz oppure aggiungilo nella cartella <code>data/</code> del repo.</p>
      <a class="btn primary" href="#/importa">Importa quiz</a><p><a href="#/formato">Com'è fatto il formato?</a></p></div>`;
  } else {
    h += '<div class="list">' + subs.map(s => {
      const st = aggr(allQ(s));
      return `<a class="card" href="#/m/${enc(s.id)}">
        <div class="card-top"><h2>${esc(s.nome)}</h2><span class="pct ${pctCls(st.acc)}">${pctTxt(st.acc)}</span></div>
        <div class="meta">${plural(s.lessons.size, 'lezione', 'lezioni')} · ${plural(st.total, 'domanda', 'domande')} · ${st.mastered} consolidate${st.review ? ` · <b>${st.review} da ripassare</b>` : ''}</div>
        ${pbar(st.total ? st.mastered / st.total : 0)}</a>`;
    }).join('') + '</div>';
  }
  h += `<h3>Gestione</h3><div class="row"><a class="btn" href="#/importa">＋ Importa</a><a class="btn" href="#/formato">Formato</a><a class="btn" href="#/dati">Dati</a></div>`;
  view('Ripasso', null, h);
}

/* ---------- materia ---------- */
function subjectView(sid) {
  const s = DB.get(sid); if (!s) return notFound();
  const qs = allQ(s), st = aggr(qs);
  let h = kpis(st);
  h += `<div class="stack" style="margin-top:14px">
    <a class="btn primary big" href="#/m/${enc(sid)}/quiz">Quiz su tutta la materia</a>
    <div class="row"><button class="btn" id="rev" ${st.review ? '' : 'disabled'}>Ripassa errori (${st.review})</button><a class="btn" href="#/stats/${enc(sid)}">Statistiche</a></div></div>`;
  h += `<h3>Lezioni</h3><div class="list">` + sortedLessons(s).map(l => {
    const a = aggr(l.domande);
    return `<a class="card" href="#/m/${enc(sid)}/l/${enc(l.id)}"><div class="lrow"><div class="grow">
      <div class="name">${esc(l.nome)}</div>
      <div class="meta">${plural(l.domande.length, 'domanda', 'domande')} · viste ${a.seen}/${a.total}${a.review ? ` · ${a.review} da ripassare` : ''}</div></div>
      <span class="pct ${pctCls(a.acc)}">${pctTxt(a.acc)}</span></div>${pbar(a.total ? a.mastered / a.total : 0)}</a>`;
  }).join('') + '</div>';
  view(s.nome, '#/', h);
  $('#rev')?.addEventListener('click', () => startQuiz({ sid, pool: qs.filter(needsReview), order: 'random', title: 'Ripasso errori', ret: `#/m/${enc(sid)}` }));
}
function kpis(st) {
  return `<div class="kpis">
    <div class="kpi"><b class="pct ${pctCls(st.acc)}">${pctTxt(st.acc)}</b><span>precisione (${st.ok}/${st.n} risposte)</span></div>
    <div class="kpi"><b>${st.seen}<small style="font-size:.9rem;color:var(--mut)">/${st.total}</small></b><span>domande viste</span></div>
    <div class="kpi"><b>${st.mastered}</b><span>consolidate (2+ giuste di fila)</span></div>
    <div class="kpi"><b>${st.review}</b><span>da ripassare (ultima sbagliata)</span></div></div>`;
}

/* ---------- setup quiz ---------- */
function setupHtml(qs, lessons) {
  const counts = {}; qs.forEach(q => counts[q.tipo] = (counts[q.tipo] || 0) + 1);
  const nOpts = [5, 10, 20, 0];
  let h = `<div class="field"><label>Numero di domande</label><div class="seg" data-name="n">${nOpts.map(n => `<button data-v="${n}" class="${PREFS.n === n ? 'on' : ''}">${n || 'Tutte'}</button>`).join('')}</div></div>`;
  h += `<div class="field"><label>Tipi di domanda</label><div class="chips" data-name="types">${Object.keys(TYPES).filter(t => counts[t]).map(t => `<button class="chip on" data-v="${t}">${TYPES[t]} <small>${counts[t]}</small></button>`).join('')}</div></div>`;
  if (lessons) h += `<div class="field"><label>Lezioni <a href="#" id="toggle-all" style="font-weight:400;font-size:.85rem;margin-left:6px">nessuna</a></label><div class="chips" data-name="lids">${lessons.map(l => `<button class="chip on" data-v="${esc(l.id)}">${esc(l.nome)}</button>`).join('')}</div></div>`;
  h += `<div class="field"><label>Ordine</label><div class="seg" data-name="order">${[['smart', 'Intelligente'], ['random', 'Casuale'], ['seq', 'In ordine']].map(([v, t]) => `<button data-v="${v}" class="${PREFS.order === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="hint">Intelligente: privilegia le domande mai viste e quelle sbagliate l'ultima volta.</p></div>
    <button class="btn primary big" id="start">Inizia</button>`;
  return h;
}
function bindSetup(getPool, base) {
  $$('.seg').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); }));
  $$('.chips').forEach(c => c.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); }));
  $('#toggle-all')?.addEventListener('click', e => {
    e.preventDefault(); const ch = $$('[data-name="lids"] .chip'); const any = ch.some(c => c.classList.contains('on'));
    ch.forEach(c => c.classList.toggle('on', !any)); e.target.textContent = any ? 'tutte' : 'nessuna';
  });
  $('#start').addEventListener('click', () => {
    const val = n => $(`.seg[data-name="${n}"] .on`)?.dataset.v;
    const on = n => $$(`[data-name="${n}"] .chip.on`).map(b => b.dataset.v);
    const n = +val('n'), order = val('order'), types = on('types');
    const lids = $('[data-name="lids"]') ? on('lids') : null;
    PREFS.n = n; PREFS.order = order; save(LS_PREFS, PREFS);
    const pool = getPool(lids).filter(q => types.includes(q.tipo));
    if (!pool.length) return toast('Nessuna domanda con questi filtri');
    startQuiz({ ...base, pool, n, order });
  });
}
function subjectSetup(sid) {
  const s = DB.get(sid); if (!s) return notFound();
  const lessons = sortedLessons(s);
  view('Quiz · ' + s.nome, `#/m/${enc(sid)}`, setupHtml(allQ(s), lessons));
  bindSetup(lids => lessons.filter(l => lids.includes(l.id)).flatMap(l => l.domande), { sid, title: s.nome, ret: `#/m/${enc(sid)}/quiz` });
}
function lessonView(sid, lid) {
  const s = DB.get(sid), l = s?.lessons.get(lid); if (!l) return notFound();
  const st = aggr(l.domande);
  const src = l.sources.has('local') ? (l.sources.has('repo') ? 'repo + telefono' : 'importata sul telefono') : 'dal repo';
  let h = `<div class="meta" style="margin:0 2px 12px">${esc(s.nome)} · ${src}</div>` + kpis(st);
  h += `<div class="row" style="margin-top:12px"><button class="btn" id="rev" ${st.review ? '' : 'disabled'}>Ripassa errori (${st.review})</button></div>`;
  h += `<h3>Nuovo quiz</h3>` + setupHtml(l.domande, null);
  view(l.nome, `#/m/${enc(sid)}`, h);
  bindSetup(() => l.domande, { sid, lid, title: l.nome, ret: `#/m/${enc(sid)}/l/${enc(lid)}` });
  $('#rev').addEventListener('click', () => startQuiz({ sid, lid, pool: l.domande.filter(needsReview), order: 'random', title: 'Ripasso errori', ret: `#/m/${enc(sid)}/l/${enc(lid)}` }));
}

/* ---------- quiz ---------- */
function startQuiz({ sid, lid = null, pool, n = 0, order = 'random', title, ret }) {
  if (!pool.length) return toast('Nessuna domanda da fare');
  let qs = order === 'smart' ? smartSample(pool, n || pool.length) : order === 'seq' ? pool.slice(0, n || pool.length) : shuffle(pool).slice(0, n || pool.length);
  const multiLesson = new Set(qs.map(q => q.lid)).size > 1;
  QUIZ = {
    sid, lid, title, ret, multiLesson, i: 0, saved: false, started: Date.now(),
    items: qs.map(q => {
      const it = { q, done: false };
      if (q.tipo === 'multipla') it.order = q.mescola ? shuffle(q.opzioni.map((_, i) => i)) : q.opzioni.map((_, i) => i);
      if (q.tipo === 'completamento' && q.distrattori) it.bank = shuffle([...new Set([...q.parts.filter(p => p.b).map(p => p.b[0]), ...q.distrattori])]);
      return it;
    })
  };
  if (location.hash === '#/quiz') quizView(); else location.hash = '#/quiz';
}
function quitQuiz() {
  const answered = QUIZ.items.some(i => i.done);
  if (answered && QUIZ.i < QUIZ.items.length && !confirm('Uscire dal quiz? Le risposte già date restano nelle statistiche.')) return;
  const r = QUIZ.ret; QUIZ = null; location.hash = r;
}
const codeBlock = q => q.codice ? `<pre class="code"><code>${esc(q.codice)}</code></pre>` : '';
const toks = s => s.match(/\$[^$]+\$|\S+/g) || [];

function qLabel(q) {
  if (q.tipo === 'multipla') return q.domanda;
  if (q.tipo === 'vero_falso') return q.affermazione;
  if (q.tipo === 'completamento') return q.parts.map(p => p.b ? '____' : p.t).join('');
  return q.domanda ? q.domanda + ' — ' + (q.err.before + q.err.wrong + q.err.after).replace(/\s+/g, ' ').trim() : (q.err.before + q.err.wrong + q.err.after);
}

function renderQ(it) {
  const q = it.q, d = it.done;
  if (q.tipo === 'multipla') {
    const multi = q.corrette.length > 1;
    let h = `<div class="qtext">${fmt(q.domanda)}</div>${codeBlock(q)}`;
    if (multi && !d) h += `<p class="hint" style="margin:-8px 2px 12px">Più risposte corrette: selezionale tutte</p>`;
    return h + '<div class="opts">' + it.order.map((oi, k) => {
      let c = 'opt';
      if (d) { const ok = q.corrette.includes(oi), sel = it.resp.includes(oi); if (ok) c += ' good' + (sel ? '' : ' missed'); else if (sel) c += ' bad'; }
      return `<button class="${c}" data-oi="${oi}" ${d ? 'disabled' : ''}><span class="letter">${String.fromCharCode(65 + k)}</span><span>${fmt(q.opzioni[oi])}</span></button>`;
    }).join('') + '</div>';
  }
  if (q.tipo === 'vero_falso') {
    const b = (v, t) => { let c = 'opt'; if (d) { if (v === q.risposta) c += ' good'; else if (it.resp === v) c += ' bad'; } return `<button class="${c}" data-v="${v}" ${d ? 'disabled' : ''}>${t}</button>`; };
    return `<p class="hint" style="margin:0 2px 8px">Vero o falso?</p><div class="qtext">${fmt(q.affermazione)}</div>${codeBlock(q)}<div class="tf">${b(true, 'Vero')}${b(false, 'Falso')}</div>`;
  }
  if (q.tipo === 'completamento') {
    let bi = 0;
    const body = q.parts.map(p => {
      if (!p.b) return fmt(p.t);
      const i = bi++;
      if (d) {
        const r = it.blankRes[i];
        return r ? `<span class="blank good">${esc(it.resp[i])}</span>` : `<span class="blank bad">${esc(it.resp[i] || '—')}</span><span class="fix">${esc(p.b[0])}</span>`;
      }
      if (it.bank) return `<select class="blank-in" data-bi="${i}"><option value="">…</option>${it.bank.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
      return `<input class="blank-in" data-bi="${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" style="width:${Math.min(16, Math.max(5, p.b[0].length + 2))}ch">`;
    }).join('');
    return `${q.domanda ? `<div class="qtext">${fmt(q.domanda)}</div>` : '<p class="hint" style="margin:0 2px 8px">Completa gli spazi</p>'}${codeBlock(q)}<div class="qtext cloze">${body}</div>`;
  }
  // errore
  const E = q.err, full = E.before + E.wrong + E.after, lineMode = full.includes('\n');
  const prompt = q.domanda || (lineMode ? 'Tocca la riga che contiene l\'errore' : 'Tocca la parte sbagliata');
  const fix = `<del>${esc(E.wrong)}</del>${E.right ? `<ins>${esc(E.right)}</ins>` : ''}`;
  if (lineMode) {
    const lines = (E.before + '\u0000' + E.after).split('\n');
    const errLine = lines.findIndex(l => l.includes('\u0000'));
    it.errIdx = errLine;
    return `<div class="qtext">${fmt(prompt)}</div>${codeBlock(q)}<div class="codeerr">` + lines.map((ln, i) => {
      let c = 'ln', content;
      if (i === errLine) { const [a, b] = ln.split('\u0000'); content = esc(a) + (d ? fix : esc(E.wrong)) + esc(b); }
      else content = esc(ln);
      if (d) { if (i === errLine) c += ' good'; else if (i === it.resp) c += ' bad'; }
      return `<button class="${c}" data-t="${i}" ${d ? 'disabled' : ''}><span class="ln-n">${i + 1}</span><code>${content || ' '}</code></button>`;
    }).join('') + '</div>';
  }
  const tb = toks(E.before), ta = toks(E.after);
  it.errIdx = tb.length;
  const all = [...tb, null, ...ta];
  return `<div class="qtext">${fmt(prompt)}</div>${codeBlock(q)}<div class="toks">` + all.map((t, i) => {
    let c = 'tok';
    if (d) { if (i === it.errIdx) c += ' good'; else if (i === it.resp) c += ' bad'; }
    const inner = t === null ? (d ? fix : fmt(E.wrong)) : fmt(t);
    return `<button class="${c}" data-t="${i}" ${d ? 'disabled' : ''}>${inner}</button>`;
  }).join(' ') + '</div>';
}

function feedbackHtml(it) {
  const q = it.q;
  let extra = '';
  if (!it.ok && q.tipo === 'vero_falso') extra = `<div>L'affermazione è <b>${q.risposta ? 'vera' : 'falsa'}</b>.</div>`;
  if (q.tipo === 'errore') extra = `<div>Correzione: <del>${esc(q.err.wrong)}</del>${q.err.right ? ` → <ins style="margin:0">${esc(q.err.right)}</ins>` : ''}</div>`;
  if (it.skipped && q.tipo === 'multipla') extra = `<div>Le risposte corrette sono evidenziate in verde.</div>`;
  return `<div class="fb ${it.ok ? 'ok' : 'ko'}" id="fb"><div class="fb-h">${it.ok ? '✓ Corretto' : it.skipped ? 'Ecco la risposta' : '✗ Sbagliato'}${it.typo ? ' <small style="font-weight:500">(accettata con un errore di battitura)</small>' : ''}</div>
    ${extra}${q.spiegazione ? `<div class="expl">${fmt(q.spiegazione)}</div>` : ''}</div>`;
}

function quizView() {
  if (!QUIZ) { location.hash = '#/'; return; }
  if (QUIZ.i >= QUIZ.items.length) return resultsView();
  const it = QUIZ.items[QUIZ.i], q = it.q, N = QUIZ.items.length;
  const les = DB.get(q.sid)?.lessons.get(q.lid);
  const needsVerify = !it.done && (q.tipo === 'completamento' || (q.tipo === 'multipla' && q.corrette.length > 1));
  let h = `<div class="qhead"><span>${QUIZ.i + 1} / ${N} · ${TYPES[q.tipo]}</span>${QUIZ.multiLesson && les ? `<span>${esc(les.nome)}</span>` : ''}</div>
    <div class="qprog"><i style="width:${(QUIZ.i + (it.done ? 1 : 0)) / N * 100}%"></i></div>${renderQ(it)}`;
  if (it.done) h += feedbackHtml(it);
  h += `<div class="actbar"><div class="inner">`;
  if (!it.done) h += `<button class="btn ghost" id="skip">Non lo so</button>` + (needsVerify ? `<button class="btn primary" id="verify">Verifica</button>` : '');
  else h += `<button class="btn primary" id="next">${QUIZ.i + 1 < N ? 'Avanti →' : 'Vedi risultati'}</button>`;
  h += `</div></div>`;
  view(QUIZ.title, '#/', h, { onBack: quitQuiz, keepScroll: it.done });
  if (it.done) { requestAnimationFrame(() => $('#fb')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); $('#next').onclick = () => { QUIZ.i++; quizView(); }; return; }
  window.scrollTo(0, 0);
  bindQ(it);
  $('#skip').onclick = () => { it.skipped = true; answer(it, q.tipo === 'multipla' ? [] : q.tipo === 'completamento' ? q.parts.filter(p => p.b).map(() => '') : null, false); };
}

function answer(it, resp, ok, extra = {}) {
  if (it.done) return;
  Object.assign(it, { done: true, resp, ok }, extra);
  if (it.q.tipo === 'completamento' && !it.blankRes) it.blankRes = resp.map(() => false);
  record(it.q, ok);
  if (!ok && navigator.vibrate) try { navigator.vibrate(35); } catch { }
  quizView();
}

function bindQ(it) {
  const q = it.q;
  if (q.tipo === 'multipla') {
    const multi = q.corrette.length > 1;
    $$('.opt').forEach(b => b.addEventListener('click', () => {
      const oi = +b.dataset.oi;
      if (multi) b.classList.toggle('sel');
      else answer(it, [oi], q.corrette[0] === oi);
    }));
    if (multi) $('#verify').onclick = () => {
      const sel = $$('.opt.sel').map(b => +b.dataset.oi).sort((a, b) => a - b);
      if (!sel.length) return toast('Seleziona almeno una risposta');
      answer(it, sel, sel.length === q.corrette.length && sel.every((v, i) => v === q.corrette[i]));
    };
  } else if (q.tipo === 'vero_falso') {
    $$('.opt').forEach(b => b.addEventListener('click', () => { const v = b.dataset.v === 'true'; answer(it, v, v === q.risposta); }));
  } else if (q.tipo === 'completamento') {
    const inputs = $$('.blank-in');
    const verify = () => {
      const blanks = q.parts.filter(p => p.b);
      const resp = inputs.map(i => i.value.trim());
      let typo = false;
      const res = blanks.map((p, i) => {
        const v = norm(resp[i]); if (!v) return false;
        if (p.b.some(a => norm(a) === v)) return true;
        if (!it.bank && p.b.some(a => norm(a).length >= 5 && lev(norm(a), v) <= 1)) { typo = true; return true; }
        return false;
      });
      answer(it, resp, res.every(Boolean), { blankRes: res, typo: typo && res.every(Boolean) });
    };
    $('#verify').onclick = verify;
    inputs.forEach((inp, i) => inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return; e.preventDefault();
      if (inputs[i + 1]) inputs[i + 1].focus(); else verify();
    }));
    if (inputs[0] && inputs[0].tagName === 'INPUT' && matchMedia('(pointer:fine)').matches) inputs[0].focus();
  } else {
    $$('[data-t]').forEach(b => b.addEventListener('click', () => { const t = +b.dataset.t; answer(it, t, t === it.errIdx); }));
  }
}

function ring(p) {
  const r = 30, c = 2 * Math.PI * r;
  return `<svg class="ring" width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="var(--card2)" stroke-width="8"/>
    <circle cx="38" cy="38" r="${r}" fill="none" stroke="${p >= .75 ? 'var(--good)' : p < .5 ? 'var(--bad)' : 'var(--acc)'}" stroke-width="8" stroke-linecap="round"
    stroke-dasharray="${c * p} ${c}" transform="rotate(-90 38 38)"/><text x="38" y="43" text-anchor="middle" font-size="16" font-weight="700" fill="var(--fg)">${Math.round(p * 100)}%</text></svg>`;
}
function resultsView() {
  const items = QUIZ.items, N = items.length, ok = items.filter(i => i.ok).length;
  const byType = {};
  items.forEach(i => { const t = byType[i.q.tipo] ||= [0, 0]; t[1]++; if (i.ok) t[0]++; });
  if (!QUIZ.saved) {
    STATS.sessions.push({ t: Date.now(), sid: QUIZ.sid, lid: QUIZ.lid, tot: N, ok, types: byType });
    if (STATS.sessions.length > 600) STATS.sessions = STATS.sessions.slice(-600);
    save(LS_STATS, STATS); QUIZ.saved = true;
  }
  const wrong = items.filter(i => !i.ok);
  const msg = ok === N ? 'Perfetto!' : ok / N >= .75 ? 'Ottimo lavoro' : ok / N >= .5 ? 'Ci sei quasi' : 'Da ripassare';
  let h = `<div class="score">${ring(ok / N)}<div><b>${msg}</b><div class="meta">${ok} corrette su ${N} · ${Math.max(1, Math.round((Date.now() - QUIZ.started) / 60000))} min</div></div></div>`;
  h += `<h3>Per tipo</h3><div class="card">` + Object.entries(byType).map(([t, [a, b]]) => `<div class="trow"><span>${TYPES[t]}</span><span class="r">${a}/${b}</span></div>`).join('') + '</div>';
  if (wrong.length) h += `<h3>Da rivedere</h3><div class="card">` + wrong.map(i => `<div class="wrong-item">${fmt(cut(qLabel(i.q), 180))}${QUIZ.multiLesson ? `<small>${esc(DB.get(i.q.sid)?.lessons.get(i.q.lid)?.nome || '')}</small>` : ''}</div>`).join('') + '</div>';
  h += `<div class="stack" style="margin-top:18px">${wrong.length ? `<button class="btn primary big" id="again-wrong">Rifai le ${wrong.length} sbagliate</button>` : ''}
    <div class="row"><button class="btn" id="again">Nuovo quiz</button><a class="btn" href="#/stats/${enc(QUIZ.sid)}">Statistiche</a></div></div>`;
  const q0 = QUIZ;
  view('Risultati', '#/', h, { onBack: () => { QUIZ = null; location.hash = q0.ret; } });
  $('#again-wrong')?.addEventListener('click', () => startQuiz({ sid: q0.sid, lid: q0.lid, pool: wrong.map(i => i.q), order: 'random', title: 'Ripasso errori', ret: q0.ret }));
  $('#again').addEventListener('click', () => { QUIZ = null; location.hash = q0.ret; });
}

/* ---------- statistiche ---------- */
function trendChart(sessions) {
  if (sessions.length < 2) return `<p class="hint">Completa almeno due quiz per vedere l'andamento.</p>`;
  const W = 340, H = 150, L = 30, R = 10, T = 12, B = 22;
  const xs = i => L + (sessions.length === 1 ? 0 : i * (W - L - R) / (sessions.length - 1));
  const ys = v => T + (1 - v) * (H - T - B);
  const pts = sessions.map((s, i) => [xs(i), ys(s.ok / s.tot)]);
  const grid = [0, .5, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${ys(v) + 4}" text-anchor="end" font-size="10" fill="var(--mut)">${v * 100}%</text>`).join('');
  const dt = t => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const xl = `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mut)">${dt(sessions[0].t)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end" font-size="10" fill="var(--mut)">${dt(sessions.at(-1).t)}</text>`;
  const dots = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="var(--acc)" stroke="var(--card)" stroke-width="2"/><circle class="hit" data-i="${i}" cx="${x}" cy="${y}" r="14" fill="transparent"/>`).join('');
  return `<div class="chart" id="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento della precisione nei quiz">${grid}${xl}
    <polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg><div class="tip"></div></div>`;
}
function bindTrend(sessions) {
  const box = $('#trend'); if (!box) return;
  const tip = $('.tip', box), svg = $('svg', box);
  const show = el => {
    const s = sessions[+el.dataset.i]; const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    tip.innerHTML = `${new Date(s.t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · <b>${Math.round(s.ok / s.tot * 100)}%</b> (${s.ok}/${s.tot})`;
    tip.style.left = (+el.getAttribute('cx')) * r.width / vb.width + 'px'; tip.style.top = (+el.getAttribute('cy')) * r.height / vb.height + 'px';
    tip.classList.add('on');
  };
  $$('.hit', box).forEach(c => { c.addEventListener('pointerenter', () => show(c)); c.addEventListener('click', () => show(c)); });
  box.addEventListener('pointerleave', () => tip.classList.remove('on'));
}
function statsView(sid) {
  const s = DB.get(sid); if (!s) return notFound();
  const qs = allQ(s), st = aggr(qs);
  const sessions = STATS.sessions.filter(x => x.sid === sid).slice(-30);
  let h = kpis(st);
  h += `<h3>Andamento (ultimi ${sessions.length} quiz)</h3><div class="card">${trendChart(sessions)}</div>`;
  // attività 14 giorni
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
  const vals = days.map(d => STATS.days[today(d)]?.[sid] || 0), mx = Math.max(1, ...vals);
  h += `<h3>Domande risposte, ultimi 14 giorni · ${vals.reduce((a, b) => a + b, 0)}</h3><div class="card"><div class="days">${days.map((d, i) => `<div title="${vals[i]} domande"><i class="${vals[i] ? '' : 'zero'}" style="height:${vals[i] / mx * 100}%"></i><span>${d.getDate()}</span></div>`).join('')}</div></div>`;
  h += `<h3>Per lezione</h3><div class="card">` + sortedLessons(s).map(l => {
    const a = aggr(l.domande);
    return `<a class="trow" style="color:inherit;display:block" href="#/m/${enc(sid)}/l/${enc(l.id)}"><div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(l.nome)}</span><span class="pct ${pctCls(a.acc)}">${pctTxt(a.acc)}</span></div>
      <div class="meta">viste ${a.seen}/${a.total} · consolidate ${a.mastered}${a.review ? ` · da ripassare ${a.review}` : ''}</div>${pbar(a.total ? a.seen / a.total : 0)}</a>`;
  }).join('') + '</div>';
  const bt = {};
  qs.forEach(q => { const x = STATS.q[q.id]; if (!x) return; const t = bt[q.tipo] ||= [0, 0]; t[0] += x.ok; t[1] += x.n; });
  if (Object.keys(bt).length) h += `<h3>Per tipo di domanda</h3><div class="card">` + Object.entries(bt).map(([t, [a, b]]) => `<div class="trow"><span>${TYPES[t]}</span><span class="r"><span class="pct ${pctCls(a / b)}">${pctTxt(a / b)}</span> · ${a}/${b}</span></div>`).join('') + '</div>';
  const hard = qs.filter(q => STATS.q[q.id] && STATS.q[q.id].n > STATS.q[q.id].ok)
    .sort((a, b) => { const A = STATS.q[a.id], B = STATS.q[b.id]; return (B.n - B.ok) / B.n - (A.n - A.ok) / A.n || (B.n - B.ok) - (A.n - A.ok); }).slice(0, 8);
  if (hard.length) {
    h += `<h3>Domande più difficili</h3><div class="card">` + hard.map(q => { const x = STATS.q[q.id]; return `<div class="wrong-item">${fmt(cut(qLabel(q), 160))}<small>${esc(s.lessons.get(q.lid)?.nome || '')} · giuste ${x.ok}/${x.n}</small></div>`; }).join('') + '</div>';
    h += `<div class="stack" style="margin-top:12px"><button class="btn primary" id="hard">Allenati su queste ${hard.length}</button></div>`;
  }
  h += `<h3>Azzera</h3><button class="btn danger sm" id="reset">Azzera statistiche di ${esc(s.nome)}</button>`;
  view('Statistiche · ' + s.nome, `#/m/${enc(sid)}`, h);
  bindTrend(sessions);
  $('#hard')?.addEventListener('click', () => startQuiz({ sid, pool: hard, order: 'random', title: 'Domande difficili', ret: `#/stats/${enc(sid)}` }));
  $('#reset').addEventListener('click', () => {
    if (!confirm(`Azzerare tutte le statistiche di ${s.nome}? Non si può annullare.`)) return;
    qs.forEach(q => delete STATS.q[q.id]);
    STATS.sessions = STATS.sessions.filter(x => x.sid !== sid);
    Object.values(STATS.days).forEach(d => delete d[sid]);
    save(LS_STATS, STATS); statsView(sid); toast('Statistiche azzerate');
  });
}

/* ---------- import ---------- */
function stripFences(t) { return t.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, ''); }
function jsonErr(text, e) {
  const m = String(e.message).match(/position (\d+)/); if (!m) return e.message;
  const pos = +m[1], before = text.slice(0, pos), line = before.split('\n').length, col = pos - before.lastIndexOf('\n');
  return `${e.message.replace(/ in JSON at position \d+.*/, '')} (riga ${line}, colonna ${col})`;
}
function importView() {
  const h = `<p class="meta" style="margin:0 2px 12px">Incolla il JSON di una o più lezioni (anche direttamente dalla chat con Claude) oppure scegli dei file <code>.json</code>. Le lezioni importate restano salvate su questo dispositivo. <a href="#/formato">Vedi il formato</a></p>
    <textarea id="imp-text" placeholder='{ "materia": "...", "lezione": "...", "domande": [ ... ] }'></textarea>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="imp-check">Controlla</button><label class="btn">Scegli file<input type="file" id="imp-file" accept=".json,application/json,text/plain" multiple hidden></label></div>
    <div class="field" style="margin-top:16px"><label>Se la lezione esiste già</label><div class="seg" id="imp-mode"><button data-v="add" class="on">Aggiungi domande</button><button data-v="replace">Sostituisci</button></div></div>
    <div id="imp-report"></div>`;
  view('Importa quiz', '#/', h);
  const seg = $('#imp-mode');
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); });
  const check = texts => {
    const lessons = [], errors = [];
    texts.forEach(({ name, text }) => {
      let j; text = stripFences(text);
      if (!text) return;
      try { j = JSON.parse(text); } catch (e) { errors.push(`${name}: JSON non valido — ${jsonErr(text, e)}`); return; }
      const p = parsePayload(j); lessons.push(...p.lessons); p.errors.forEach(x => errors.push(`${name}: ${x}`));
    });
    const good = lessons.filter(l => l.domande.length);
    let r = '';
    if (good.length) r += `<div class="card rep"><b class="rep-ok">✓ Pronte da salvare</b><ul>${good.map(l => `<li><b>${esc(l.materia)}</b> › ${esc(l.lezione)}: ${plural(l.domande.length, 'domanda', 'domande')} (${Object.entries(l.domande.reduce((a, q) => (a[q.tipo] = (a[q.tipo] || 0) + 1, a), {})).map(([t, n]) => `${n} ${TYPES[t].toLowerCase()}`).join(', ')})</li>`).join('')}</ul></div>`;
    if (errors.length) r += `<div class="card rep" style="margin-top:10px"><b class="rep-ko">✗ Problemi (${errors.length})</b><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>${good.length ? '<p class="hint">Le domande con problemi verranno saltate.</p>' : ''}</div>`;
    if (!good.length && !errors.length) r = '<p class="hint">Niente da importare.</p>';
    if (good.length) r += `<button class="btn primary big" id="imp-save" style="margin-top:12px">Salva ${plural(good.length, 'lezione', 'lezioni')}</button>`;
    $('#imp-report').innerHTML = r;
    $('#imp-save')?.addEventListener('click', () => {
      const mode = $('#imp-mode .on').dataset.v;
      good.forEach(l => {
        const key = slug(l.materia) + '/' + slug(l.lezione);
        const ex = LOCAL.find(x => slug(x.materia) + '/' + slug(x.lezione) === key);
        if (ex && mode === 'add') { const ids = new Set(ex.domande.map(q => q.id)); l.domande.forEach(q => { if (!ids.has(q.id)) ex.domande.push(q); }); ex.t = Date.now(); }
        else { if (ex) LOCAL.splice(LOCAL.indexOf(ex), 1); LOCAL.push({ ...l, t: Date.now() }); }
      });
      save(LS_LOCAL, LOCAL); rebuild();
      toast(`Salvate ${plural(good.length, 'lezione', 'lezioni')}`);
      location.hash = `#/m/${enc(slug(good[0].materia))}`;
    });
  };
  $('#imp-check').onclick = () => check([{ name: 'Testo incollato', text: $('#imp-text').value }]);
  $('#imp-file').onchange = async e => { const fs = [...e.target.files]; check(await Promise.all(fs.map(async f => ({ name: f.name, text: await f.text() })))); e.target.value = ''; };
}

/* ---------- dati & backup ---------- */
function download(name, obj) {
  const isStr = typeof obj === 'string';
  const blob = new Blob([isStr ? obj : JSON.stringify(obj, null, 2)], { type: isStr ? 'text/plain' : 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportLesson(l) {
  const strip = q => {
    const o = { tipo: q.tipo };
    if (q.tipo === 'multipla') Object.assign(o, { domanda: q.domanda, opzioni: q.opzioni, corretta: q.corrette.length > 1 ? q.corrette.map(i => String.fromCharCode(65 + i)) : String.fromCharCode(65 + q.corrette[0]) }, q.mescola ? {} : { mescola: false });
    if (q.tipo === 'vero_falso') Object.assign(o, { affermazione: q.affermazione, risposta: q.risposta });
    if (q.tipo === 'completamento') Object.assign(o, q.domanda ? { domanda: q.domanda } : {}, { testo: q.testo }, q.distrattori ? { distrattori: q.distrattori } : {});
    if (q.tipo === 'errore') Object.assign(o, q.domanda ? { domanda: q.domanda } : {}, { testo: q.testo });
    if (q.codice) o.codice = q.codice;
    if (q.spiegazione) o.spiegazione = q.spiegazione;
    const u = q.id.split('/u:')[1]; if (u) o.id = u;
    return o;
  };
  return { materia: l.materia, lezione: l.lezione, domande: l.domande.map(strip) };
}
function dataView() {
  const nQ = Object.keys(STATS.q).length;
  let h = `<h3 style="margin-top:6px">Lezioni importate su questo dispositivo</h3>`;
  h += LOCAL.length ? `<div class="card">` + LOCAL.map((l, i) => `<div class="trow" style="align-items:center"><span><b>${esc(l.materia)}</b> › ${esc(l.lezione)}<br><small class="meta">${plural(l.domande.length, 'domanda', 'domande')}</small></span>
      <span class="row" style="flex:none;gap:6px"><button class="btn sm" data-exp="${i}">Esporta</button><button class="btn sm danger" data-del="${i}">Elimina</button></span></div>`).join('') + '</div>'
    : `<p class="hint">Nessuna. Le lezioni nella cartella <code>data/</code> del repo non compaiono qui: si gestiscono su GitHub.</p>`;
  h += `<h3>Backup</h3><p class="hint" style="margin-top:0">Statistiche e lezioni importate vivono nel browser di questo telefono. Esporta un backup ogni tanto (o prima di cambiare telefono/browser).</p>
    <div class="row" style="margin-top:10px"><button class="btn" id="bk-exp">Esporta backup</button><label class="btn">Ripristina backup<input type="file" id="bk-imp" accept=".json,application/json" hidden></label></div>
    <h3>Statistiche</h3><p class="hint" style="margin-top:0">${nQ} domande con statistiche · ${STATS.sessions.length} quiz completati.</p>
    <button class="btn danger sm" id="st-reset" style="margin-top:8px">Azzera tutte le statistiche</button>
    <h3>App</h3><button class="btn sm" id="reload">Ricarica dati dal repo</button>`;
  view('Dati e backup', '#/', h);
  $$('[data-del]').forEach(b => b.onclick = () => {
    const l = LOCAL[+b.dataset.del];
    if (!confirm(`Eliminare "${l.lezione}" (${l.materia}) da questo dispositivo? Le statistiche restano.`)) return;
    LOCAL.splice(+b.dataset.del, 1); save(LS_LOCAL, LOCAL); rebuild(); dataView();
  });
  $$('[data-exp]').forEach(b => b.onclick = () => { const l = LOCAL[+b.dataset.exp]; download(`${slug(l.materia)}-${slug(l.lezione)}.json`, exportLesson(l)); });
  $('#bk-exp').onclick = () => download(`ripasso-backup-${today()}.json`, { app: 'ripasso', v: 1, creato: new Date().toISOString(), local: LOCAL, stats: STATS });
  $('#bk-imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'ripasso' || !j.stats) throw new Error('non è un backup di Ripasso');
      if (!confirm('Il backup sostituirà statistiche e lezioni importate attuali. Continuare?')) return;
      LOCAL = j.local || []; STATS = j.stats; STATS.q ||= {}; STATS.sessions ||= []; STATS.days ||= {};
      save(LS_LOCAL, LOCAL); save(LS_STATS, STATS); rebuild(); toast('Backup ripristinato'); dataView();
    } catch (err) { toast('Errore: ' + err.message); }
  };
  $('#st-reset').onclick = () => { if (!confirm('Azzerare TUTTE le statistiche?')) return; STATS = { q: {}, sessions: [], days: {} }; save(LS_STATS, STATS); toast('Statistiche azzerate'); dataView(); };
  $('#reload').onclick = async () => { await loadRepo(); rebuild(); toast('Dati aggiornati'); location.hash = '#/'; };
}

/* ---------- formato ---------- */
const EXAMPLE = `{
  "materia": "Human Language Technologies",
  "lezione": "18 - Post-training e LoRA",
  "domande": [
    {
      "tipo": "multipla",
      "domanda": "Come viene parametrizzato l'aggiornamento in LoRA?",
      "opzioni": ["$\\\\Delta W = BA$ con rango $r$ piccolo", "Con una maschera sparsa", "Con la SVD di $W$"],
      "corretta": "A",
      "spiegazione": "B è d×r e A è r×k, con r ≪ min(d,k)."
    },
    {
      "tipo": "multipla",
      "domanda": "Quali affermazioni su LoRA sono vere?",
      "opzioni": ["I pesi originali sono congelati", "Aggiunge latenza in inferenza", "B è inizializzata a zero"],
      "corretta": ["A", "C"]
    },
    {
      "tipo": "vero_falso",
      "affermazione": "DPO richiede un reward model esplicito.",
      "risposta": false,
      "spiegazione": "DPO ottimizza direttamente la policy sulle coppie di preferenze."
    },
    {
      "tipo": "completamento",
      "testo": "In RLHF la policy è ottimizzata con [[PPO]] e una penalità [[KL|Kullback-Leibler]] verso il modello di riferimento.",
      "distrattori": ["SGD", "entropia"]
    },
    {
      "tipo": "errore",
      "testo": "In LoRA la matrice A è inizializzata a {{zero|valori gaussiani}}.",
      "spiegazione": "È B a essere inizializzata a zero, così all'inizio ΔW = 0."
    }
  ]
}`;
const PROMPT = `Crea un quiz per l'app "Ripasso" a partire da questa lezione (te la incollo/allego sotto).

Restituisci SOLO un blocco JSON valido con questa struttura:
{"materia": "<nome materia, sempre uguale per tutte le lezioni>", "lezione": "<NN - titolo lezione>", "domande": [ ... ]}

Tipi di domanda ammessi (mescolali, circa 15-25 domande in totale):
1. Risposta multipla: {"tipo":"multipla","domanda":"...","opzioni":["...","...","...","..."],"corretta":"B","spiegazione":"..."}
   - "corretta" è una lettera ("A","B",...) oppure una lista di lettere se le risposte giuste sono più di una, es. ["A","C"].
   - Distrattori plausibili, tutti di lunghezza simile alla risposta giusta.
2. Vero/Falso: {"tipo":"vero_falso","affermazione":"...","risposta":true,"spiegazione":"..."}
3. Completamento: {"tipo":"completamento","testo":"... [[risposta]] ... [[altra risposta|sinonimo accettato]] ...","spiegazione":"..."}
   - Ogni spazio è [[risposta]]; varianti accettate separate da |. Risposte brevi (1-3 parole).
   - Opzionale "distrattori": ["...","..."] per trasformare gli spazi in menu a tendina.
4. Trova l'errore: {"tipo":"errore","testo":"frase con UN errore marcato come {{parola sbagliata|parola corretta}}","spiegazione":"..."}
   - Esattamente un {{...|...}} per domanda; la parte sbagliata deve essere breve (idealmente una parola) e plausibile.
   - Per il codice: metti il codice in "testo" con gli a capo (\\n); la riga con {{...|...}} è quella da trovare. Aggiungi "domanda" con la consegna.

Campi opzionali per ogni domanda: "codice" (snippet mostrato sopra la domanda), "spiegazione" (consigliata sempre).
Formule in LaTeX tra $...$ (nel JSON i backslash vanno raddoppiati: "$\\\\alpha$").
Copri tutti i concetti importanti della lezione, includi domande su definizioni, formule, confronti e casi tipici d'esame. Scrivi in italiano.`;

function formatView() {
  const h = `<div class="doc">
  <p>Ogni lezione è un file JSON con <b>materia</b>, <b>lezione</b> e una lista di <b>domande</b>. La materia e la lezione vengono create automaticamente in base ai nomi: usa sempre lo stesso nome di materia.</p>
  <button class="btn primary" id="copy-prompt" style="width:100%">Copia il prompt per generarli con Claude</button>
  <p class="hint">Incolla il prompt in chat insieme alle slide o agli appunti della lezione, poi incolla il JSON che ottieni in <a href="#/importa">Importa</a>.</p>
  <h3>Tipi di domanda</h3>
  <p><b>multipla</b> — <code>domanda</code>, <code>opzioni</code>, <code>corretta</code> (lettera, o lista di lettere se più risposte sono giuste). Le opzioni vengono mescolate; metti <code>"mescola": false</code> per tenerle in ordine.</p>
  <p><b>vero_falso</b> — <code>affermazione</code>, <code>risposta</code> (true/false).</p>
  <p><b>completamento</b> — <code>testo</code> con gli spazi scritti come <code>[[risposta]]</code> o <code>[[risposta|variante]]</code>. Con <code>distrattori</code> gli spazi diventano menu a tendina, altrimenti si scrive (perdona un errore di battitura sulle parole lunghe).</p>
  <p><b>errore</b> — <code>testo</code> con un solo <code>{{sbagliato|corretto}}</code>. Se il testo ha più righe (codice) si tocca la riga sbagliata, altrimenti la parola.</p>
  <p>Opzionali ovunque: <code>spiegazione</code>, <code>codice</code> (snippet mostrato sopra), <code>id</code> (per non perdere le statistiche se modifichi il testo). Formule tra <code>$...$</code>, <code>**grassetto**</code> e <code>\`codice\`</code> funzionano nei testi.</p>
  <h3>Esempio</h3><pre><code>${esc(EXAMPLE)}</code></pre>
  <h3>Più lezioni in un file</h3><pre><code>${esc('{\n  "materia": "Computer Vision",\n  "lezioni": [\n    { "lezione": "01 - Intro", "domande": [ ... ] },\n    { "lezione": "02 - Filtri", "domande": [ ... ] }\n  ]\n}')}</code></pre>
  <h3>Nel repo GitHub</h3><p>Metti i file in <code>data/</code> e aggiungi il percorso a <code>data/index.json</code>:</p><pre><code>${esc('{ "file": ["hlt/18-lora.json", "cv/01-intro.json"] }')}</code></pre>
  </div>`;
  view('Formato dei quiz', '#/', h);
  $('#copy-prompt').onclick = async () => {
    try { await navigator.clipboard.writeText(PROMPT); toast('Prompt copiato'); }
    catch { download('prompt-ripasso.txt', PROMPT); }
  };
}

/* ---------- avvio ---------- */
window.addEventListener('hashchange', route);
(async () => {
  view('Ripasso', null, '<div class="loading">Caricamento…</div>');
  await loadRepo(); rebuild(); route();
})();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
// pulizia attività vecchie
(() => { const lim = today(new Date(Date.now() - 120 * 864e5)); let ch = false; for (const k of Object.keys(STATS.days)) if (k < lim) { delete STATS.days[k]; ch = true; } if (ch) save(LS_STATS, STATS); })();
