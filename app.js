'use strict';
/* Ripasso v2 — quiz per studiare le lezioni. Vanilla JS, nessuna build. */

/* =========================================================
   Costanti
   ========================================================= */
const K = {
  local: 'ripasso.local.v1', stats: 'ripasso.stats.v1', prefs: 'ripasso.prefs.v1', meta: 'ripasso.meta.v1',
  tomb: 'ripasso.tomb.v1', sync: 'ripasso.sync.v1', quiz: 'ripasso.quiz.v1', dev: 'ripasso.device'
};
const TYPES = {
  multipla: 'Risposta multipla', vero_falso: 'Vero / Falso', completamento: 'Completamento', errore: "Trova l'errore",
  abbinamento: 'Abbinamento', ordina: 'Ordina i passi', aperta: 'Risposta aperta'
};
const TYPE_ALIAS = {
  multipla: 'multipla', crocette: 'multipla', crocetta: 'multipla', scelta_multipla: 'multipla', risposta_multipla: 'multipla',
  vero_falso: 'vero_falso', verofalso: 'vero_falso', vf: 'vero_falso', v_f: 'vero_falso',
  completamento: 'completamento', completa: 'completamento', cloze: 'completamento',
  errore: 'errore', trova_errore: 'errore', trova_l_errore: 'errore', trova_lerrore: 'errore',
  abbinamento: 'abbinamento', abbina: 'abbinamento', collega: 'abbinamento', matching: 'abbinamento',
  ordina: 'ordina', ordinamento: 'ordina', sequenza: 'ordina', ordine: 'ordina',
  aperta: 'aperta', risposta_aperta: 'aperta', domanda_aperta: 'aperta'
};
const DAY = 864e5;
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60]; // giorni per "scatola" del ripasso spaziato
const SUBJ_COLORS = ['#4f46e5', '#0e7490', '#c2410c', '#7c3aed', '#0f766e', '#be185d', '#a16207', '#475569'];
const LEVEL_TITLES = [[1, 'Matricola'], [3, 'Uditore'], [5, 'Studente'], [8, 'Secchione'], [12, 'Tutor'], [16, 'Ricercatore'], [22, 'Professore'], [30, 'Rettore']];
const SYNC_FILE = 'ripasso-sync.json';

/* =========================================================
   Utility
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const slug = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const enc = encodeURIComponent;
function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const range = n => [...Array(n).keys()];
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
function fmt(s) { return esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function typeset(el) {
  if (!window.renderMathInElement || !el) return;
  try {
    renderMathInElement(el, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false, ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'select', 'input']
    });
  } catch { }
}
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dayKey();
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endToday = () => startOfDay() + DAY - 1;
const pctTxt = v => v == null ? '—' : Math.round(v * 100) + '%';
const pctCls = v => v == null ? 'na' : v >= .75 ? 'hi' : v < .5 ? 'lo' : '';
const pbar = (f, cls = '') => `<div class="pbar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, f || 0)) * 100)}%"></i></div>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const cut = (t, n) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
const L = k => String.fromCharCode(65 + k);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtDate = (t, o = { day: 'numeric', month: 'short' }) => new Date(t).toLocaleDateString('it-IT', o);
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.innerHTML = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
function vibrate(p) { if (PREFS.vib && navigator.vibrate) try { navigator.vibrate(p); } catch { } }
function go(h) { if (location.hash === h) route(); else location.hash = h; }

/* =========================================================
   Stato persistente
   ========================================================= */
let DEVICE = localStorage.getItem(K.dev);
if (!DEVICE) { DEVICE = 'd' + Math.random().toString(36).slice(2, 9); localStorage.setItem(K.dev, DEVICE); }

let STATS = load(K.stats, null) || {};
let META = load(K.meta, null) || {};
let LOCAL = load(K.local, []);
let TOMB = load(K.tomb, {});
let PREFS = Object.assign({ n: 10, order: 'smart', vib: true, exN: 20, exMin: 30 }, load(K.prefs, {}));
let SYNC = load(K.sync, {});
function normalizeState() {
  STATS.q ||= {}; STATS.sessions ||= []; STATS.dev ||= {}; STATS.ach ||= {};
  if (STATS.days) { // migrazione dalla v1
    const me = STATS.dev[DEVICE] ||= { xp: 0, days: {} };
    for (const [d, o] of Object.entries(STATS.days)) me.days[d] = { ...o };
    delete STATS.days;
    let xp = 0;
    for (const s of Object.values(STATS.q)) {
      xp += s.ok * 10 + (s.n - s.ok);
      if (s.box == null) { s.box = s.last === false ? 0 : Math.min(s.streak || 0, 3); s.due = s.last === false ? (s.t || 0) : startOfDay(s.t || Date.now()) + INTERVALS[s.box] * DAY; }
    }
    me.xp = Math.max(me.xp || 0, xp);
  }
  META.subj ||= {}; META.flags ||= {}; META.goal ||= 20; META.goalT ||= 0;
}
normalizeState();
const ME = () => (STATS.dev[DEVICE] ||= { xp: 0, days: {} });
let DIRTY = false;
function saveStats() { save(K.stats, STATS); dirty(); }
function saveMeta() { save(K.meta, META); dirty(); }
function saveLocal() { save(K.local, LOCAL); save(K.tomb, TOMB); dirty(); }
function savePrefs() { save(K.prefs, PREFS); }
function dirty() { DIRTY = true; }

let REPO = [], LOAD_ERRORS = [], DB = new Map(), QUIZ = null, TICK = null;

/* =========================================================
   Parsing / validazione dei file di quiz
   ========================================================= */
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
  if (['vero', 'v', 'true', 'si', 't'].includes(s)) return true;
  if (['falso', 'f', 'false', 'no'].includes(s)) return false;
  throw '"risposta" deve essere true/false (oppure "vero"/"falso")';
}
function parsePair(p) {
  if (Array.isArray(p) && p.length === 2) return [String(p[0]), String(p[1])];
  if (p && typeof p === 'object') {
    const a = p.a ?? p.sx ?? p.termine, b = p.b ?? p.dx ?? p.definizione;
    if (a != null && b != null) return [String(a), String(b)];
  }
  throw 'ogni coppia deve essere ["termine", "definizione"]';
}

function normQuestion(q, ctx) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) throw 'non è un oggetto {...}';
  const tipo = TYPE_ALIAS[slug(q.tipo).replace(/-/g, '_')];
  if (!tipo) throw `"tipo" mancante o sconosciuto (${JSON.stringify(q.tipo ?? null)}). Usa: ${Object.keys(TYPES).join(', ')}`;
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
    out.testo = String(q.testo); out.parts = parseBlanks(out.testo);
    if (q.domanda) out.domanda = String(q.domanda);
    if (Array.isArray(q.distrattori) && q.distrattori.length) out.distrattori = q.distrattori.map(String);
    key = out.testo;
  } else if (tipo === 'errore') {
    if (!q.testo) throw 'manca "testo"';
    out.testo = String(q.testo); out.err = parseErr(out.testo);
    if (q.domanda) out.domanda = String(q.domanda);
    key = out.testo;
  } else if (tipo === 'abbinamento') {
    if (!Array.isArray(q.coppie) || q.coppie.length < 2) throw '"coppie" deve essere una lista con almeno 2 coppie';
    out.coppie = q.coppie.map(parsePair);
    if (new Set(out.coppie.map(c => norm(c[0]))).size !== out.coppie.length) throw 'ci sono termini ripetuti in "coppie"';
    out.domanda = String(q.domanda || 'Collega ogni termine alla sua descrizione');
    key = out.domanda + '|' + out.coppie.flat().join('|');
  } else if (tipo === 'ordina') {
    if (!Array.isArray(q.passi) || q.passi.length < 2) throw '"passi" deve essere una lista con almeno 2 voci, già nell\'ordine giusto';
    out.passi = q.passi.map(String);
    out.domanda = String(q.domanda || 'Metti i passi nell\'ordine giusto');
    key = out.domanda + '|' + out.passi.join('|');
  } else {
    if (!q.domanda) throw 'manca "domanda"';
    if (!q.risposta) throw 'manca "risposta" (la risposta modello)';
    Object.assign(out, { domanda: String(q.domanda), risposta: String(q.risposta) });
    if (Array.isArray(q.punti) && q.punti.length) out.punti = q.punti.map(String);
    key = out.domanda;
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
    const ordine = l.ordine != null && l.ordine !== '' && Number.isFinite(+l.ordine) ? +l.ordine : m ? +m[1] : 9999;
    lessons.push({ materia: String(l.materia).trim(), lezione: String(l.lezione).trim(), ordine, domande });
  });
  return { lessons, errors };
}
function exportQ(q) {
  const o = { tipo: q.tipo };
  if (q.tipo === 'multipla') Object.assign(o, { domanda: q.domanda, opzioni: q.opzioni, corretta: q.corrette.length > 1 ? q.corrette.map(L) : L(q.corrette[0]) }, q.mescola ? {} : { mescola: false });
  if (q.tipo === 'vero_falso') Object.assign(o, { affermazione: q.affermazione, risposta: q.risposta });
  if (q.tipo === 'completamento') Object.assign(o, q.domanda ? { domanda: q.domanda } : {}, { testo: q.testo }, q.distrattori ? { distrattori: q.distrattori } : {});
  if (q.tipo === 'errore') Object.assign(o, q.domanda ? { domanda: q.domanda } : {}, { testo: q.testo });
  if (q.tipo === 'abbinamento') Object.assign(o, { domanda: q.domanda, coppie: q.coppie });
  if (q.tipo === 'ordina') Object.assign(o, { domanda: q.domanda, passi: q.passi });
  if (q.tipo === 'aperta') Object.assign(o, { domanda: q.domanda, risposta: q.risposta }, q.punti ? { punti: q.punti } : {});
  if (q.codice) o.codice = q.codice;
  if (q.spiegazione) o.spiegazione = q.spiegazione;
  const u = q.id.split('/u:')[1]; if (u) o.id = u;
  return o;
}

/* =========================================================
   Database in memoria
   ========================================================= */
const lkey = l => slug(l.materia) + '/' + slug(l.lezione);
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
  try { const r = await fetch('data/index.json', { cache: 'no-cache' }); if (!r.ok) return; idx = await r.json(); } catch { return; }
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
const everyQ = () => [...DB.values()].flatMap(allQ);
const lessonOf = q => DB.get(q.sid)?.lessons.get(q.lid);
const subjName = sid => DB.get(sid)?.nome || sid;
function findQ(id) { for (const s of DB.values()) for (const l of s.lessons.values()) for (const q of l.domande) if (q.id === id) return q; return null; }
function initials(name) {
  const w = name.split(/[\s\-_]+/).filter(x => x.length > 2 || /^[A-Z0-9]+$/.test(x));
  return (w.length > 1 ? w.slice(0, 3).map(x => x[0]) : [name.slice(0, 2)]).join('').toUpperCase();
}
const subjColor = sid => SUBJ_COLORS[parseInt(hash(sid), 36) % SUBJ_COLORS.length];
const avatar = (s, size = '') => `<span class="avatar ${size}" style="background:${subjColor(s.id)}">${esc(initials(s.nome))}</span>`;

/* =========================================================
   Statistiche, ripasso spaziato, XP, traguardi
   ========================================================= */
function examTime(sid) { const e = META.subj[sid]?.exam; return e ? new Date(e + 'T09:00:00').getTime() : null; }
function daysTo(sid) { const t = examTime(sid); return t == null ? null : Math.round((startOfDay(t) - startOfDay()) / DAY); }
function countdownBadge(sid) {
  const d = daysTo(sid); if (d == null || d < 0) return '';
  return `<span class="cd ${d <= 7 ? 'hot' : ''}">📅 ${d === 0 ? 'oggi!' : d === 1 ? 'domani' : `tra ${d} gg`}</span>`;
}

function record(q, res, noCount) {
  const prev = STATS.q[q.id] ? { ...STATS.q[q.id] } : null;
  const s = STATS.q[q.id] || (STATS.q[q.id] = { n: 0, ok: 0, streak: 0, box: 0 });
  s.n++; if (res.ok) s.ok++;
  s.streak = res.ok ? s.streak + 1 : 0; s.last = !!res.ok; s.t = Date.now();
  const b = s.box || 0;
  s.box = res.ok ? Math.min(b + 1, INTERVALS.length - 1) : res.partial ? Math.max(0, b - 1) : 0;
  let due = res.ok ? startOfDay() + INTERVALS[s.box] * DAY : res.partial ? startOfDay() + DAY : Date.now();
  const ex = examTime(q.sid);
  if (ex && ex > Date.now() && due > ex - DAY) due = Math.max(startOfDay() + DAY, startOfDay(ex) - DAY);
  s.due = due;
  if (!noCount) { const me = ME(), d = today(); (me.days[d] ||= {}); me.days[d][q.sid] = (me.days[d][q.sid] || 0) + 1; }
  saveStats();
  return prev;
}
function unrecord(q, prev) {
  if (prev) STATS.q[q.id] = prev; else delete STATS.q[q.id];
  const d = ME().days[today()]; if (d?.[q.sid]) d[q.sid]--;
  saveStats();
}
const isDue = q => { const s = STATS.q[q.id]; return !!s && (s.due ?? 0) <= endToday(); };
const dueAll = () => everyQ().filter(isDue);
const needsReview = q => STATS.q[q.id]?.last === false;
function aggr(qs) {
  let n = 0, ok = 0, seen = 0, mastered = 0, review = 0, due = 0, ready = 0;
  const dist = [0, 0, 0, 0]; // nuove, fragili, in crescita, consolidate
  for (const q of qs) {
    const s = STATS.q[q.id];
    if (!s) { dist[0]++; continue; }
    seen++; n += s.n; ok += s.ok;
    const b = s.box || 0;
    if (b >= 3) { mastered++; dist[3]++; } else if (b === 2) dist[2]++; else dist[1]++;
    if (s.last === false) review++;
    if ((s.due ?? 0) <= endToday()) due++;
    ready += Math.min(b, 4) / 4;
  }
  return { total: qs.length, seen, n, ok, acc: n ? ok / n : null, mastered, review, due, ready: qs.length ? ready / qs.length : 0, dist };
}
function weight(q) { const s = STATS.q[q.id]; if (!s) return 3; if ((s.due ?? 0) <= endToday()) return 5; return 1.5 / (1 + (s.box || 0)); }
function smartSample(pool, n) { return pool.map(q => ({ q, k: Math.pow(Math.random(), 1 / weight(q)) })).sort((a, b) => b.k - a.k).slice(0, n).map(x => x.q); }

// giorni e XP (separati per dispositivo, così la sincronizzazione somma correttamente)
function dayTotal(d, sid) {
  let t = 0;
  for (const dev of Object.values(STATS.dev)) { const o = dev.days?.[d]; if (!o) continue; if (sid) t += o[sid] || 0; else for (const v of Object.values(o)) t += v; }
  return t;
}
function allDays() { const s = new Set(); for (const dev of Object.values(STATS.dev)) Object.keys(dev.days || {}).forEach(d => s.add(d)); return [...s].sort(); }
function streak() {
  const g = META.goal; const d = new Date();
  if (dayTotal(dayKey(d)) < g) d.setDate(d.getDate() - 1);
  let n = 0; while (dayTotal(dayKey(d)) >= g) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestStreak() {
  const g = META.goal; let best = 0, cur = 0, prev = null;
  for (const k of allDays()) {
    if (dayTotal(k) < g) { cur = 0; prev = k; continue; }
    const p = new Date(k + 'T12:00'); p.setDate(p.getDate() - 1);
    cur = prev === dayKey(p) && cur ? cur + 1 : 1; best = Math.max(best, cur); prev = k;
  }
  return Math.max(best, streak());
}
const xpTotal = () => Object.values(STATS.dev).reduce((a, d) => a + (d.xp || 0), 0);
const needXp = l => Math.round(60 * Math.pow(l - 1, 1.6));
function levelOf(xp) { let l = 1; while (xp >= needXp(l + 1)) l++; return l; }
function levelTitle(l) { let t = LEVEL_TITLES[0][1]; for (const [n, name] of LEVEL_TITLES) if (l >= n) t = name; return t; }
function addXp(n) {
  const before = levelOf(xpTotal());
  ME().xp = (ME().xp || 0) + n; saveStats();
  const after = levelOf(xpTotal());
  if (after > before) setTimeout(() => { confetti(); toast(`⬆️ Livello <b>${after}</b>!${levelTitle(after) !== levelTitle(before) ? `<br>Ora sei <b>${levelTitle(after)}</b>` : ''}`, 3200); }, 350);
}
function checkGoal() {
  const me = ME(), d = today();
  me.gb ||= {};
  if (!me.gb[d] && dayTotal(d) >= META.goal) {
    me.gb[d] = 1; addXp(30);
    setTimeout(() => toast(`🎯 Obiettivo di oggi raggiunto! <b>+30 XP</b>`, 3000), 700);
  }
}
function totals() { let n = 0, ok = 0; for (const s of Object.values(STATS.q)) { n += s.n; ok += s.ok; } return { n, ok }; }

const ACH = [
  { id: 'primo', e: '🎓', n: 'Primo passo', d: 'Completa il primo quiz', t: () => STATS.sessions.length >= 1 },
  { id: 'perfetto', e: '💯', n: 'Senza sbagli', d: 'Quiz perfetto con almeno 5 domande', t: c => c.quiz && c.quiz.tot >= 5 && c.quiz.ok === c.quiz.tot },
  { id: 'combo10', e: '⚡', n: 'Inarrestabile', d: '10 risposte giuste di fila', t: c => c.combo >= 10 },
  { id: 'combo25', e: '🌪️', n: 'Tornado', d: '25 risposte giuste di fila', t: c => c.combo >= 25 },
  { id: 'cento', e: '✅', n: 'Cento', d: '100 risposte giuste in totale', t: () => totals().ok >= 100 },
  { id: 'mille', e: '🏛️', n: 'Mille', d: '1000 risposte giuste in totale', t: () => totals().ok >= 1000 },
  { id: 'streak3', e: '🔥', n: 'Ci prendo gusto', d: 'Obiettivo raggiunto 3 giorni di fila', t: () => streak() >= 3 },
  { id: 'streak7', e: '🔥', n: 'Una settimana', d: 'Obiettivo raggiunto 7 giorni di fila', t: () => streak() >= 7 },
  { id: 'streak30', e: '☄️', n: 'Un mese intero', d: 'Obiettivo raggiunto 30 giorni di fila', t: () => streak() >= 30 },
  { id: 'esame18', e: '📝', n: 'Promosso', d: 'Supera una simulazione d\'esame', t: c => c.voto >= 18 },
  { id: 'esame28', e: '🎯', n: 'Dal 28 in su', d: 'Prendi almeno 28 in una simulazione', t: c => c.voto >= 28 },
  { id: 'lode', e: '👑', n: '30 e lode', d: 'Simulazione senza errori', t: c => c.lode },
  { id: 'lezione', e: '📚', n: 'Lezione dominata', d: 'Consolida tutte le domande di una lezione', t: c => c.lessonMastered },
  { id: 'pari', e: '🧹', n: 'Tutto in pari', d: 'Svuota il ripasso di oggi', t: c => c.dueCleared },
  { id: 'tuttofare', e: '🧩', n: 'Tuttofare', d: 'Rispondi giusto a tutti i 7 tipi di domanda', t: c => c.quiz && new Set(everyQ().filter(q => STATS.q[q.id]?.ok).map(q => q.tipo)).size >= 7 },
  { id: 'gufo', e: '🦉', n: 'Gufo', d: 'Studia tra mezzanotte e le 5', t: c => c.answered && new Date().getHours() < 5 },
  { id: 'alba', e: '🌅', n: 'Mattiniero', d: 'Studia tra le 5 e le 7', t: c => c.answered && new Date().getHours() >= 5 && new Date().getHours() < 7 },
  { id: 'livello10', e: '🚀', n: 'Doppia cifra', d: 'Raggiungi il livello 10', t: () => levelOf(xpTotal()) >= 10 }
];
const ACH_QUEUE = [];
function checkAch(c = {}) {
  let changed = false;
  for (const a of ACH) {
    if (STATS.ach[a.id]) continue;
    let ok = false; try { ok = !!a.t(c); } catch { }
    if (ok) { STATS.ach[a.id] = Date.now(); ACH_QUEUE.push(a); changed = true; }
  }
  if (changed) { saveStats(); flushAch(); }
}
function flushAch() {
  if (flushAch.busy || !ACH_QUEUE.length) return;
  flushAch.busy = true;
  const a = ACH_QUEUE.shift();
  addXp(50);
  setTimeout(() => {
    toast(`<span style="font-size:1.4em">${a.e}</span><br><b>Traguardo sbloccato: ${esc(a.n)}</b><br><small>${esc(a.d)} · +50 XP</small>`, 3200);
    setTimeout(() => { flushAch.busy = false; flushAch(); }, 3400);
  }, 900);
}

/* =========================================================
   Preferiti e segnalazioni
   ========================================================= */
const flagOf = id => META.flags[id] || {};
const isStar = id => !!flagOf(id).star;
const isFlag = id => !!flagOf(id).flag;
function setFlag(id, patch) { META.flags[id] = { ...flagOf(id), ...patch, t: Date.now() }; saveMeta(); scheduleSync(); }
const starBtn = q => `<button class="tool ${isStar(q.id) ? 'on' : ''}" data-star="${esc(q.id)}" aria-label="Preferita" title="Preferita">★</button>`;
const flagBtn = q => `<button class="tool flag ${isFlag(q.id) ? 'on' : ''}" data-flag="${esc(q.id)}" aria-label="Segnala" title="Segnala un problema">⚑</button>`;
function flagDialog(id, done) {
  const f = flagOf(id);
  const d = modal(`<h2>Segnala la domanda</h2><p class="hint" style="margin:4px 0 10px">Cosa non va? (risposta sbagliata, testo ambiguo, da approfondire…)</p>
    <textarea id="fl-note" style="min-height:90px" placeholder="Nota (facoltativa)">${esc(f.note || '')}</textarea>
    <div class="row" style="margin-top:12px">${f.flag ? '<button class="btn danger" data-a="rm">Togli segnalazione</button>' : ''}<button class="btn" data-a="x">Annulla</button><button class="btn primary" data-a="ok">Segnala</button></div>`);
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'ok') setFlag(id, { flag: true, note: $('#fl-note', d).value.trim() });
    if (a === 'rm') setFlag(id, { flag: false, note: '' });
    d.close(); done?.();
    if (a === 'ok') toast('⚑ Segnalata. La trovi nella materia, sotto "Segnalate".');
  });
}
app.addEventListener('click', e => {
  const s = e.target.closest('[data-star]');
  if (s) { const id = s.dataset.star; setFlag(id, { star: !isStar(id) }); $$(`[data-star="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('on', isStar(id))); if (isStar(id)) toast('★ Aggiunta ai preferiti'); return; }
  const f = e.target.closest('[data-flag]');
  if (f) { const id = f.dataset.flag; flagDialog(id, () => $$(`[data-flag="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('on', isFlag(id)))); }
});
function flaggedFor(sid) {
  const out = [];
  for (const s of DB.values()) { if (sid && s.id !== sid) continue; for (const l of sortedLessons(s)) for (const q of l.domande) if (isFlag(q.id)) out.push({ materia: s.nome, lezione: l.nome, nota: flagOf(q.id).note || '', domanda: exportQ(q) }); }
  return out;
}
function flaggedText(sid) {
  const items = flaggedFor(sid);
  return `Queste domande della mia app di quiz "Ripasso" sono state segnalate come problematiche (vedi "nota"). Correggile e restituiscimi, per ogni lezione, un JSON nel formato {"materia": ..., "lezione": ..., "domande": [...]} con le domande corrette (stesso formato; mantieni "id" se presente).\n\n${JSON.stringify(items, null, 2)}`;
}
async function copyText(t, okMsg = 'Copiato negli appunti') {
  try { await navigator.clipboard.writeText(t); toast(okMsg); } catch { download('ripasso.txt', t); }
}

/* =========================================================
   Effetti
   ========================================================= */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti() {
  if (reduceMotion()) return;
  const c = document.createElement('canvas'); c.className = 'confetti';
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const ctx = c.getContext('2d'), cols = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'];
  const P = range(140).map(() => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 6) * devicePixelRatio, s: (5 + Math.random() * 6) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
  let t0 = performance.now();
  (function f(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += .5 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    if (t - t0 < 2200) requestAnimationFrame(f); else c.remove();
  })(t0);
}
function ring(p, size = 76, stroke = 8, label) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, col = p >= .75 ? 'var(--good)' : p < .5 ? 'var(--bad)' : 'var(--acc)';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * Math.min(1, p)} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${size / 4.6}" font-weight="700" fill="var(--fg)">${label ?? Math.round(p * 100) + '%'}</text></svg>`;
}
function goalRing(p, size = 54) {
  const stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p >= 1 ? 'var(--good)' : 'var(--warn)'}" stroke-width="${stroke}" stroke-linecap="${p > 0 ? 'round' : 'butt'}" stroke-dasharray="${c * Math.min(1, p)} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="18">${p >= 1 ? '✓' : '🎯'}</text></svg>`;
}
function modal(html) {
  const d = document.createElement('dialog'); d.className = 'modal'; d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  d.showModal(); typeset(d);
  return d;
}

/* =========================================================
   Vista / router
   ========================================================= */
function view(title, back, html, o = {}) {
  clearInterval(TICK); TICK = null;
  $('#title').textContent = title;
  const b = $('#back'); b.hidden = !back;
  b.onclick = () => o.onBack ? o.onBack() : (location.hash = back);
  $('#bar-right').innerHTML = o.right || '';
  app.innerHTML = html;
  const tab = o.tab === undefined ? 'studia' : o.tab;
  document.body.classList.toggle('has-tabs', !!tab);
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  if (!o.keepScroll) window.scrollTo(0, 0);
  typeset(app);
}
function route() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean).map(decodeURIComponent);
  if (!p.length) return home();
  const [a, b, c, d, e] = p;
  if (a === 'm') {
    if (c === 'l' && e === 'sfoglia') return browseView(b, { lid: d });
    if (c === 'l') return lessonView(b, d);
    if (c === 'quiz') return setupView(b, 'quiz');
    if (c === 'esame') return setupView(b, 'esame');
    if (c === 'sfoglia') return browseView(b, { kind: d });
    return subjectView(b);
  }
  if (a === 'stats') return statsView(b);
  if (a === 'quiz') return quizView();
  if (a === 'profilo') return profileView();
  if (a === 'impostazioni') return settingsView();
  if (a === 'importa') return importView();
  if (a === 'formato') return formatView();
  if (a === 'dati') return dataView();
  home();
}
function notFound() { view('Non trovato', '#/', `<div class="empty">Questa pagina non esiste più.<br><a class="btn" href="#/">Torna alla home</a></div>`); }

/* =========================================================
   Home
   ========================================================= */
function heroHtml() {
  const xp = xpTotal(), lv = levelOf(xp), lo = needXp(lv), hi = needXp(lv + 1);
  const td = dayTotal(today()), goal = META.goal, stk = streak();
  return `<div class="hero">
    <div class="hero-top">
      <a class="lvl" href="#/profilo"><span class="lvl-badge">${lv}</span><span><b>${levelTitle(lv)}</b><span class="meta">${xp - lo} / ${hi - lo} XP · livello ${lv + 1}</span></span></a>
      <span class="streak ${stk ? 'on' : ''}" title="Giorni di fila con l'obiettivo raggiunto">🔥 <b>${stk}</b></span>
    </div>
    ${pbar((xp - lo) / (hi - lo), 'xp')}
    <div class="goal">${goalRing(td / goal)}<div><b>Obiettivo di oggi</b><div class="meta">${Math.min(td, goal)} / ${goal} domande${td >= goal ? ' · raggiunto!' : ''}</div></div></div>
  </div>`;
}
function home() {
  const subs = [...DB.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  let h = '';
  if (QUIZ && !QUIZ.finished && QUIZ.i < QUIZ.items.length)
    h += `<div class="card resume"><div><b>${QUIZ.mode === 'esame' ? 'Simulazione in corso' : 'Quiz in corso'}</b><div class="meta">${esc(QUIZ.title)} · ${QUIZ.items.filter(i => i.done || (QUIZ.mode === 'esame' && QT[i.q.tipo].answered(i.resp))).length}/${QUIZ.items.length}</div></div>
      <div class="row"><button class="btn sm" id="drop">Abbandona</button><a class="btn sm primary" href="#/quiz">Riprendi</a></div></div>`;
  if (LOAD_ERRORS.length) h += `<div class="warn"><b>Alcune domande dei file del repo non sono state caricate:</b><ul>${LOAD_ERRORS.slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('')}</ul>${LOAD_ERRORS.length > 6 ? `…e altre ${LOAD_ERRORS.length - 6}` : ''}</div>`;
  h += heroHtml();
  if (!subs.length) {
    h += `<div class="empty"><p><b>Nessuna materia ancora.</b><br>Importa un file di quiz oppure aggiungilo nella cartella <code>data/</code> del repo.</p>
      <a class="btn primary" href="#/importa">Importa quiz</a><p><a href="#/formato">Com'è fatto il formato?</a></p></div>`;
    return view('Ripasso', null, h);
  }
  const due = dueAll();
  h += due.length
    ? `<button class="cta" id="today"><span><b>Ripasso di oggi</b><span class="meta">domande che stanno per sfuggirti</span></span><span class="cta-n">${due.length}</span></button>`
    : `<div class="card soft">✨ <b>Sei in pari.</b> Niente da ripassare oggi: scegli una materia e impara domande nuove.</div>`;
  h += '<h3>Materie</h3><div class="list">' + subs.map(s => {
    const st = aggr(allQ(s));
    return `<a class="card subj" href="#/m/${enc(s.id)}">
      <div class="subj-top">${avatar(s)}<div class="grow"><h2>${esc(s.nome)}</h2>
      <div class="meta">${plural(s.lessons.size, 'lezione', 'lezioni')} · ${plural(st.total, 'domanda', 'domande')}${st.due ? ` · <b class="due">${st.due} da ripassare</b>` : ''}</div></div>${countdownBadge(s.id)}</div>
      <div class="ready"><span>Preparazione</span><b>${pctTxt(st.ready)}</b></div>${pbar(st.ready)}</a>`;
  }).join('') + '</div>';
  view('Ripasso', null, h);
  $('#today')?.addEventListener('click', () => startQuiz({ pool: due.sort((a, b) => (STATS.q[a.id].due || 0) - (STATS.q[b.id].due || 0)).slice(0, 60), order: 'random', title: 'Ripasso di oggi', ret: '#/', mode: 'ripasso' }));
  $('#drop')?.addEventListener('click', () => { if (confirm('Abbandonare il quiz in corso?')) { clearQuiz(); home(); } });
}

/* =========================================================
   Materia & lezione
   ========================================================= */
function examCard(s, st) {
  const d = daysTo(s.id);
  if (d == null || d < 0) return `<button class="card exam-card empty-exam" id="set-exam"><span>📅</span><span><b>${d != null ? 'Esame passato · ' : ''}Imposta la data dell'esame</b><span class="meta">Countdown, preparazione e ripasso calibrato sull'appello</span></span></button>`;
  const left = st.total - st.mastered;
  const perDay = d > 0 ? Math.ceil(left * 3 / d) : left;
  return `<button class="card exam-card" id="set-exam">${ring(st.ready, 64, 7)}<span class="grow"><b>Esame ${d === 0 ? 'oggi' : d === 1 ? 'domani' : `tra ${d} giorni`}</b>
    <span class="meta">${fmtDate(examTime(s.id), { weekday: 'short', day: 'numeric', month: 'long' })} · preparazione ${pctTxt(st.ready)}</span>
    <span class="meta">${left ? `Ritmo consigliato: ~${plural(perDay, 'domanda', 'domande')} al giorno` : 'Tutto consolidato: mantieni il ripasso!'}</span></span></button>`;
}
function examDialog(sid) {
  const cur = META.subj[sid]?.exam || '';
  const d = modal(`<h2>Data dell'esame</h2><p class="hint" style="margin:4px 0 12px">Il ripasso spaziato si adatta: le domande torneranno prima dell'appello.</p>
    <input type="date" id="ex-date" value="${esc(cur)}" min="${today()}">
    <div class="row" style="margin-top:14px">${cur ? '<button class="btn danger" data-a="rm">Rimuovi</button>' : ''}<button class="btn" data-a="x">Annulla</button><button class="btn primary" data-a="ok">Salva</button></div>`);
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'ok') { const v = $('#ex-date', d).value; if (!v) return toast('Scegli una data'); META.subj[sid] = { exam: v, t: Date.now() }; }
    if (a === 'rm') META.subj[sid] = { exam: '', t: Date.now() };
    if (a !== 'x') { saveMeta(); scheduleSync(); }
    d.close(); route();
  });
}
function tile(id, emoji, label, n, cls = '', href) {
  const inner = `<span class="t-e">${emoji}</span><span class="t-l">${label}</span>${n != null ? `<span class="t-n">${n}</span>` : ''}`;
  return href ? `<a class="tile ${cls}" href="${href}">${inner}</a>` : `<button class="tile ${cls}" id="${id}" ${n === 0 ? 'disabled' : ''}>${inner}</button>`;
}
function subjectView(sid) {
  const s = DB.get(sid); if (!s) return notFound();
  const qs = allQ(s), st = aggr(qs);
  const stars = qs.filter(q => isStar(q.id)).length, flags = qs.filter(q => isFlag(q.id)).length, unseen = st.total - st.seen;
  let h = examCard(s, st);
  h += `<div class="tiles">
    ${tile('t-due', '🔁', 'Ripasso di oggi', st.due, st.due ? 'hot' : '')}
    ${tile('', '🎲', 'Quiz', null, '', `#/m/${enc(sid)}/quiz`)}
    ${tile('', '📝', 'Simulazione d\'esame', null, '', `#/m/${enc(sid)}/esame`)}
    ${tile('t-new', '🌱', 'Domande nuove', unseen)}
    ${tile('t-err', '🩹', 'Errori recenti', st.review)}
    ${tile('', '📊', 'Statistiche', null, '', `#/stats/${enc(sid)}`)}
    ${tile('', '★', 'Preferiti', stars, '', `#/m/${enc(sid)}/sfoglia/preferiti`)}
    ${tile('', '⚑', 'Segnalate', flags, '', `#/m/${enc(sid)}/sfoglia/segnalate`)}
  </div>`;
  h += `<h3>Lezioni</h3><div class="list">` + sortedLessons(s).map(l => {
    const a = aggr(l.domande);
    return `<a class="card" href="#/m/${enc(sid)}/l/${enc(l.id)}"><div class="lrow"><div class="grow">
      <div class="name">${esc(l.nome)}</div>
      <div class="meta">${plural(l.domande.length, 'domanda', 'domande')} · viste ${a.seen}/${a.total}${a.due ? ` · <b class="due">${a.due} da ripassare</b>` : ''}</div></div>
      <span class="pct ${pctCls(a.ready)}">${pctTxt(a.ready)}</span></div>${pbar(a.ready)}</a>`;
  }).join('') + '</div>';
  view(s.nome, '#/', h);
  $('#set-exam').onclick = () => examDialog(sid);
  const ret = `#/m/${enc(sid)}`;
  $('#t-due').onclick = () => startQuiz({ pool: qs.filter(isDue), order: 'random', title: 'Ripasso · ' + s.nome, ret, mode: 'ripasso' });
  $('#t-new').onclick = () => startQuiz({ pool: qs.filter(q => !STATS.q[q.id]), n: PREFS.n || 10, order: 'seq', title: 'Nuove · ' + s.nome, ret });
  $('#t-err').onclick = () => startQuiz({ pool: qs.filter(needsReview), order: 'random', title: 'Errori · ' + s.nome, ret });
}
function lessonView(sid, lid) {
  const s = DB.get(sid), l = s?.lessons.get(lid); if (!l) return notFound();
  const st = aggr(l.domande);
  const src = l.sources.has('local') ? (l.sources.has('repo') ? 'repo + telefono' : 'importata sul telefono') : 'dal repo';
  let h = `<div class="meta" style="margin:0 2px 12px">${esc(s.nome)} · ${src} · ${plural(st.total, 'domanda', 'domande')}</div>` + kpis(st);
  h += `<div class="tiles" style="margin-top:12px">
    ${tile('t-due', '🔁', 'Da ripassare', st.due, st.due ? 'hot' : '')}
    ${tile('t-err', '🩹', 'Errori recenti', st.review)}
    ${tile('', '📖', 'Sfoglia domande', null, '', `#/m/${enc(sid)}/l/${enc(lid)}/sfoglia`)}
    ${tile('', '📝', 'Simulazione', null, '', `#/m/${enc(sid)}/esame`)}
  </div>`;
  h += `<h3>Nuovo quiz</h3>` + setupHtml(l.domande, null, 'quiz');
  view(l.nome, `#/m/${enc(sid)}`, h);
  const ret = `#/m/${enc(sid)}/l/${enc(lid)}`;
  bindSetup(() => l.domande, { sid, lid, title: l.nome, ret }, 'quiz');
  $('#t-due').onclick = () => startQuiz({ sid, lid, pool: l.domande.filter(isDue), order: 'random', title: 'Ripasso · ' + l.nome, ret, mode: 'ripasso' });
  $('#t-err').onclick = () => startQuiz({ sid, lid, pool: l.domande.filter(needsReview), order: 'random', title: 'Errori · ' + l.nome, ret });
}
function kpis(st) {
  return `<div class="kpis">
    <div class="kpi"><b class="pct ${pctCls(st.ready)}">${pctTxt(st.ready)}</b><span>preparazione</span></div>
    <div class="kpi"><b class="pct ${pctCls(st.acc)}">${pctTxt(st.acc)}</b><span>risposte giuste (${st.ok}/${st.n})</span></div>
    <div class="kpi"><b>${st.mastered}<small>/${st.total}</small></b><span>consolidate</span></div>
    <div class="kpi"><b>${st.due}</b><span>da ripassare oggi</span></div></div>`;
}

/* ---------- setup quiz / esame ---------- */
function seg(name, opts, cur) { return `<div class="seg" data-name="${name}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`; }
function setupHtml(qs, lessons, kind) {
  const counts = {}; qs.forEach(q => counts[q.tipo] = (counts[q.tipo] || 0) + 1);
  const types = Object.keys(TYPES).filter(t => counts[t] && !(kind === 'esame' && t === 'aperta'));
  let h = '';
  if (kind === 'esame') {
    h += `<div class="field"><label>Numero di domande</label>${seg('n', [[10, '10'], [20, '20'], [30, '30'], [0, 'Tutte']], PREFS.exN)}</div>
      <div class="field"><label>Tempo</label>${seg('min', [[15, '15′'], [30, '30′'], [45, '45′'], [60, '60′'], [0, '∞']], PREFS.exMin)}</div>`;
  } else {
    h += `<div class="field"><label>Numero di domande</label>${seg('n', [[5, '5'], [10, '10'], [20, '20'], [0, 'Tutte']], PREFS.n)}</div>`;
  }
  h += `<div class="field"><label>Tipi di domanda</label><div class="chips" data-name="types">${types.map(t => `<button class="chip on" data-v="${t}">${TYPES[t]} <small>${counts[t]}</small></button>`).join('')}</div>
    ${kind === 'esame' && counts.aperta ? '<p class="hint">Le risposte aperte sono escluse: non si possono correggere in automatico.</p>' : ''}</div>`;
  if (lessons) h += `<div class="field"><label>Lezioni <a href="#" id="toggle-all" class="mini-link">nessuna</a></label><div class="chips" data-name="lids">${lessons.map(l => `<button class="chip on" data-v="${esc(l.id)}">${esc(l.nome)}</button>`).join('')}</div></div>`;
  if (kind !== 'esame') h += `<div class="field"><label>Ordine</label>${seg('order', [['smart', 'Intelligente'], ['random', 'Casuale'], ['seq', 'In ordine']], PREFS.order)}
    <p class="hint">Intelligente: privilegia le domande da ripassare e quelle mai viste.</p></div>`;
  h += `<button class="btn primary big" id="start">${kind === 'esame' ? 'Inizia la simulazione' : 'Inizia'}</button>`;
  return h;
}
function bindSetup(getPool, base, kind) {
  $$('.seg').forEach(sg => sg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); }));
  $$('.chips').forEach(c => c.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); }));
  $('#toggle-all')?.addEventListener('click', e => {
    e.preventDefault(); const ch = $$('[data-name="lids"] .chip'); const any = ch.some(c => c.classList.contains('on'));
    ch.forEach(c => c.classList.toggle('on', !any)); e.target.textContent = any ? 'tutte' : 'nessuna';
  });
  $('#start').addEventListener('click', () => {
    const val = n => $(`.seg[data-name="${n}"] .on`)?.dataset.v;
    const on = n => $$(`[data-name="${n}"] .chip.on`).map(b => b.dataset.v);
    const types = on('types'), lids = $('[data-name="lids"]') ? on('lids') : null;
    const pool = getPool(lids).filter(q => types.includes(q.tipo));
    if (!pool.length) return toast('Nessuna domanda con questi filtri');
    if (kind === 'esame') {
      PREFS.exN = +val('n'); PREFS.exMin = +val('min'); savePrefs();
      startExam({ ...base, pool, n: PREFS.exN, minutes: PREFS.exMin });
    } else {
      PREFS.n = +val('n'); PREFS.order = val('order'); savePrefs();
      startQuiz({ ...base, pool, n: PREFS.n, order: PREFS.order });
    }
  });
}
function setupView(sid, kind) {
  const s = DB.get(sid); if (!s) return notFound();
  const lessons = sortedLessons(s);
  const intro = kind === 'esame' ? `<div class="card soft" style="margin-bottom:16px">📝 <b>Come all'esame:</b> nessuna correzione fino alla consegna, puoi saltare e tornare indietro. Alla fine ricevi il voto in trentesimi e la correzione completa.</div>` : '';
  view((kind === 'esame' ? 'Simulazione · ' : 'Quiz · ') + s.nome, `#/m/${enc(sid)}`, intro + setupHtml(allQ(s).filter(q => kind !== 'esame' || q.tipo !== 'aperta'), lessons, kind));
  bindSetup(lids => lessons.filter(l => lids.includes(l.id)).flatMap(l => l.domande), { sid, title: (kind === 'esame' ? 'Simulazione · ' : '') + s.nome, ret: `#/m/${enc(sid)}` }, kind);
}

/* =========================================================
   Motore delle domande: un modulo per tipo
   ========================================================= */
const qtext = s => `<div class="qtext">${fmt(s)}</div>`;
const qhint = s => `<p class="hint qhint">${s}</p>`;
const codeBlock = q => q.codice ? `<pre class="code"><code>${esc(q.codice)}</code></pre>` : '';
const toks = s => s.match(/\$[^$]+\$|\S+/g) || [];
function errInfo(q) {
  if (q._e) return q._e;
  const E = q.err, lineMode = (E.before + E.wrong + E.after).includes('\n');
  if (lineMode) { const lines = (E.before + '\u0000' + E.after).split('\n'); return q._e = { lineMode, lines, errIdx: lines.findIndex(l => l.includes('\u0000')) }; }
  const tb = toks(E.before), ta = toks(E.after);
  return q._e = { lineMode, tokens: [...tb, null, ...ta], errIdx: tb.length };
}
function shuffledNotIdentity(n) { let s = shuffle(range(n)); for (let k = 0; k < 6 && n > 1 && s.every((v, i) => v === i); k++) s = shuffle(range(n)); return s; }

const QT = {
  multipla: {
    init(it) { const idx = range(it.q.opzioni.length); it.order = it.q.mescola ? shuffle(idx) : idx; it.resp = []; },
    reveal(it) { it.order = range(it.q.opzioni.length); it.resp = it.q.corrette.slice(); },
    answered: r => Array.isArray(r) && r.length > 0,
    verify: q => q.corrette.length > 1,
    grade(q, r) { const s = [...r].sort((a, b) => a - b); return { ok: s.length === q.corrette.length && s.every((v, i) => v === q.corrette[i]) }; },
    render(it, done) {
      const q = it.q, multi = q.corrette.length > 1;
      let h = qtext(q.domanda) + codeBlock(q);
      if (multi && !done) h += qhint('Più risposte corrette: selezionale tutte');
      return h + '<div class="opts">' + it.order.map((oi, k) => {
        let c = 'opt'; const sel = it.resp.includes(oi);
        if (done) { const ok = q.corrette.includes(oi); if (ok) c += ' good' + (sel ? '' : ' missed'); else if (sel) c += ' bad'; }
        else if (sel) c += ' sel';
        return `<button class="${c}" data-oi="${oi}" ${done ? 'disabled' : ''}><span class="letter">${L(k)}</span><span>${fmt(q.opzioni[oi])}</span></button>`;
      }).join('') + '</div>';
    },
    bind(it, ctx) {
      const multi = it.q.corrette.length > 1;
      $$('.opt', ctx.el).forEach(b => b.onclick = () => {
        const oi = +b.dataset.oi;
        if (multi) { it.resp = it.resp.includes(oi) ? it.resp.filter(x => x !== oi) : [...it.resp, oi]; ctx.changed(false); }
        else { it.resp = [oi]; ctx.changed(true); }
      });
    }
  },
  vero_falso: {
    init(it) { it.resp = null; },
    reveal(it) { it.resp = it.q.risposta; },
    answered: r => r === true || r === false,
    verify: () => false,
    grade: (q, r) => ({ ok: r === q.risposta }),
    render(it, done) {
      const q = it.q;
      const b = (v, t) => { let c = 'opt'; if (done) { if (v === q.risposta) c += ' good'; else if (it.resp === v) c += ' bad'; } else if (it.resp === v) c += ' sel'; return `<button class="${c}" data-v="${v}" ${done ? 'disabled' : ''}>${t}</button>`; };
      return `${qhint('Vero o falso?')}${qtext(q.affermazione)}${codeBlock(q)}<div class="tf">${b(true, 'Vero')}${b(false, 'Falso')}</div>`;
    },
    bind(it, ctx) { $$('.opt', ctx.el).forEach(b => b.onclick = () => { it.resp = b.dataset.v === 'true'; ctx.changed(true); }); }
  },
  completamento: {
    init(it) {
      const bl = it.q.parts.filter(p => p.b); it.resp = bl.map(() => '');
      if (it.q.distrattori) it.bank = shuffle([...new Set([...bl.map(p => p.b[0]), ...it.q.distrattori])]);
    },
    reveal(it) { it.resp = it.q.parts.filter(p => p.b).map(p => p.b[0]); },
    answered: r => r.some(x => String(x).trim()),
    verify: () => true,
    grade(q, r) {
      let typo = false;
      const blankRes = q.parts.filter(p => p.b).map((p, i) => {
        const v = norm(r[i]); if (!v) return false;
        if (p.b.some(a => norm(a) === v)) return true;
        if (!q.distrattori && p.b.some(a => norm(a).length >= 5 && !/\d/.test(a) && lev(norm(a), v) <= 1)) { typo = true; return true; }
        return false;
      });
      const ok = blankRes.every(Boolean);
      return { ok, blankRes, typo: typo && ok, nOk: blankRes.filter(Boolean).length, n: blankRes.length };
    },
    render(it, done) {
      const q = it.q; let bi = 0;
      const body = q.parts.map(p => {
        if (!p.b) return fmt(p.t);
        const i = bi++;
        if (done) {
          const r = it.g?.blankRes?.[i];
          return r ? `<span class="blank good">${esc(it.resp[i])}</span>` : `<span class="blank bad">${esc(it.resp[i] || '—')}</span><span class="fix">${esc(p.b[0])}</span>`;
        }
        if (it.bank) return `<select class="blank-in" data-bi="${i}"><option value="">…</option>${it.bank.map(o => `<option ${o === it.resp[i] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        return `<input class="blank-in" data-bi="${i}" value="${esc(it.resp[i])}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" style="width:${Math.min(16, Math.max(5, p.b[0].length + 2))}ch">`;
      }).join('');
      return `${q.domanda ? qtext(q.domanda) : qhint('Completa gli spazi')}${codeBlock(q)}<div class="qtext cloze">${body}</div>`;
    },
    bind(it, ctx) {
      const inputs = $$('.blank-in', ctx.el);
      inputs.forEach((inp, i) => {
        const upd = () => { it.resp[+inp.dataset.bi] = inp.value; ctx.changed(false, true); };
        inp.addEventListener('input', upd); inp.addEventListener('change', upd);
        inp.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); else ctx.submit(); });
      });
      if (inputs[0] && inputs[0].tagName === 'INPUT' && matchMedia('(pointer:fine)').matches) inputs[0].focus();
    }
  },
  errore: {
    init(it) { it.resp = null; },
    reveal(it) { it.resp = errInfo(it.q).errIdx; },
    answered: r => r != null,
    verify: () => false,
    grade: (q, r) => ({ ok: r === errInfo(q).errIdx }),
    render(it, done) {
      const q = it.q, E = q.err, I = errInfo(q);
      const prompt = q.domanda || (I.lineMode ? 'Tocca la riga che contiene l\'errore' : 'Tocca la parte sbagliata');
      const fix = `<del>${esc(E.wrong)}</del>${E.right ? `<ins>${esc(E.right)}</ins>` : ''}`;
      const cls = i => done ? (i === I.errIdx ? ' good' : i === it.resp ? ' bad' : '') : (i === it.resp ? ' sel' : '');
      if (I.lineMode) {
        return `${qtext(prompt)}${codeBlock(q)}<div class="codeerr">` + I.lines.map((ln, i) => {
          let content;
          if (i === I.errIdx) { const [a, b] = ln.split('\u0000'); content = esc(a) + (done ? fix : esc(E.wrong)) + esc(b); } else content = esc(ln);
          return `<button class="ln${cls(i)}" data-t="${i}" ${done ? 'disabled' : ''}><span class="ln-n">${i + 1}</span><code>${content || ' '}</code></button>`;
        }).join('') + '</div>';
      }
      return `${qtext(prompt)}${codeBlock(q)}<div class="toks">` + I.tokens.map((t, i) =>
        `<button class="tok${cls(i)}" data-t="${i}" ${done ? 'disabled' : ''}>${t === null ? (done ? fix : fmt(E.wrong)) : fmt(t)}</button>`).join(' ') + '</div>';
    },
    bind(it, ctx) { $$('[data-t]', ctx.el).forEach(b => b.onclick = () => { it.resp = +b.dataset.t; ctx.changed(true); }); }
  },
  abbinamento: {
    init(it) { const n = it.q.coppie.length; it.tOrder = shuffle(range(n)); it.dOrder = shuffledNotIdentity(n); it.resp = Array(n).fill(null); it.pick = null; },
    reveal(it) { const n = it.q.coppie.length; it.tOrder = range(n); it.dOrder = range(n); it.resp = range(n); },
    answered: r => Array.isArray(r) && r.every(x => x != null),
    verify: () => true,
    grade(q, r) { const nOk = r.filter((t, i) => t === i).length; return { ok: nOk === r.length, nOk, n: r.length }; },
    render(it, done) {
      const q = it.q;
      let h = qtext(q.domanda) + codeBlock(q);
      if (!done) {
        h += qhint('Tocca un termine, poi la descrizione giusta');
        h += `<div class="terms">${it.tOrder.map(ti => { const used = it.resp.includes(ti); return `<button class="term ${used ? 'used' : ''} ${it.pick === ti ? 'on' : ''}" data-ti="${ti}">${fmt(q.coppie[ti][0])}</button>`; }).join('')}</div>`;
      }
      h += `<div class="defs">${it.dOrder.map(di => {
        const ti = it.resp[di];
        let c = 'def'; if (done) c += ti === di ? ' good' : ' bad'; else if (ti != null) c += ' filled';
        const slot = ti != null ? `<span class="slot">${fmt(q.coppie[ti][0])}</span>` : `<span class="slot empty">?</span>`;
        const fix = done && ti !== di ? `<span class="fix">${fmt(q.coppie[di][0])}</span>` : '';
        return `<button class="${c}" data-di="${di}" ${done ? 'disabled' : ''}><span class="slotwrap">${slot}${fix}</span><span class="dtext">${fmt(q.coppie[di][1])}</span></button>`;
      }).join('')}</div>`;
      return h;
    },
    bind(it, ctx) {
      $$('.term', ctx.el).forEach(b => b.onclick = () => {
        const ti = +b.dataset.ti, at = it.resp.indexOf(ti);
        if (at >= 0) it.resp[at] = null;
        it.pick = it.pick === ti ? null : ti; ctx.changed(false);
      });
      $$('.def', ctx.el).forEach(b => b.onclick = () => {
        const di = +b.dataset.di;
        if (it.pick != null) {
          const at = it.resp.indexOf(it.pick); if (at >= 0) it.resp[at] = null;
          it.resp[di] = it.pick; it.pick = null;
          const freeD = it.resp.map((t, i) => t == null ? i : -1).filter(i => i >= 0), freeT = range(it.resp.length).filter(t => !it.resp.includes(t));
          if (freeD.length === 1 && freeT.length === 1) it.resp[freeD[0]] = freeT[0];
        } else if (it.resp[di] != null) { it.pick = it.resp[di]; it.resp[di] = null; }
        ctx.changed(false);
      });
    }
  },
  ordina: {
    init(it) { it.sOrder = shuffledNotIdentity(it.q.passi.length); it.resp = []; },
    reveal(it) { it.sOrder = range(it.q.passi.length); it.resp = range(it.q.passi.length); },
    answered: r => Array.isArray(r) && r.length > 0,
    verify: () => true,
    grade(q, r) { const nOk = q.passi.filter((_, i) => r[i] === i).length; return { ok: nOk === q.passi.length, nOk, n: q.passi.length }; },
    render(it, done) {
      const q = it.q;
      let h = qtext(q.domanda) + codeBlock(q);
      if (!done) {
        h += qhint(`Tocca i passi nell'ordine giusto${it.resp.length ? ` · <a href="#" class="mini-link" data-reset>ricomincia</a>` : ''}`);
        return h + `<div class="steps">${it.sOrder.map(si => { const p = it.resp.indexOf(si) + 1; return `<button class="step ${p ? 'on' : ''}" data-si="${si}"><span class="num">${p || ''}</span><span>${fmt(q.passi[si])}</span></button>`; }).join('')}</div>`;
      }
      return h + `<div class="steps">${q.passi.map((t, i) => { const up = it.resp.indexOf(i); const ok = up === i; return `<div class="step ${ok ? 'good' : 'bad'}"><span class="num">${i + 1}</span><span class="grow">${fmt(t)}</span>${ok ? '' : `<small class="yours">tu: ${up >= 0 ? up + 1 + 'º' : '—'}</small>`}</div>`; }).join('')}</div>`;
    },
    bind(it, ctx) {
      $$('.step', ctx.el).forEach(b => b.onclick = () => { const si = +b.dataset.si; it.resp = it.resp.includes(si) ? it.resp.filter(x => x !== si) : [...it.resp, si]; ctx.changed(false); });
      $('[data-reset]', ctx.el)?.addEventListener('click', e => { e.preventDefault(); it.resp = []; ctx.changed(false); });
    }
  },
  aperta: {
    init(it) { it.resp = null; it.text = ''; it.revealed = false; },
    reveal(it) { it.revealed = true; it.resp = 'si'; it.text = ''; },
    answered: r => !!r,
    verify: () => false,
    grade: (q, r) => ({ ok: r === 'si', partial: r === 'parz' }),
    render(it, done) {
      const q = it.q;
      const model = `<div class="model"><div class="model-h">Risposta</div>${fmt(q.risposta)}${q.punti ? `<div class="model-h" style="margin-top:10px">Punti chiave</div><ul class="punti">${q.punti.map(p => `<li>${fmt(p)}</li>`).join('')}</ul>` : ''}</div>`;
      const mine = it.text ? `<div class="mine"><div class="model-h">La tua risposta</div>${fmt(it.text)}</div>` : '';
      let h = qtext(q.domanda) + codeBlock(q);
      if (done) return h + mine + model;
      if (!it.revealed) return h + `<textarea class="open-in" placeholder="Scrivi la tua risposta (facoltativo), poi confrontala…">${esc(it.text)}</textarea><button class="btn big" data-reveal style="margin-top:10px">Mostra la risposta</button>`;
      return h + mine + model + `<p class="hint" style="margin:14px 2px 8px">Come è andata?</p><div class="self">
        <button class="opt bad-soft" data-self="no">😵 Non la sapevo</button><button class="opt mid-soft" data-self="parz">🤔 In parte</button><button class="opt good-soft" data-self="si">😎 La sapevo</button></div>`;
    },
    bind(it, ctx) {
      const ta = $('.open-in', ctx.el); if (ta) ta.addEventListener('input', () => { it.text = ta.value; ctx.changed(false, true); });
      $('[data-reveal]', ctx.el)?.addEventListener('click', () => { if (ta) it.text = ta.value.trim(); it.revealed = true; ctx.changed(false); });
      $$('[data-self]', ctx.el).forEach(b => b.onclick = () => { it.resp = b.dataset.self; ctx.changed(true); });
    }
  }
};
function initItem(q) { const it = { q, done: false }; QT[q.tipo].init(it); return it; }
function revealHtml(q) { const it = { q, done: true }; QT[q.tipo].init(it); QT[q.tipo].reveal(it); it.g = QT[q.tipo].grade(q, it.resp); return QT[q.tipo].render(it, true); }

function fbHtml(it, compact) {
  const q = it.q, g = it.g || {};
  let head = it.ok ? '✓ Corretto' : it.skipped ? 'Ecco la risposta' : g.partial ? '≈ In parte' : '✗ Sbagliato';
  if (q.tipo === 'aperta' && !it.skipped) head = it.ok ? '😎 La sapevi' : g.partial ? '🤔 In parte: torna domani' : '😵 Da ripassare';
  let extra = '';
  if (!it.ok && q.tipo === 'vero_falso') extra = `<div>L'affermazione è <b>${q.risposta ? 'vera' : 'falsa'}</b>.</div>`;
  if (q.tipo === 'errore') extra = `<div>Correzione: <del>${esc(q.err.wrong)}</del>${q.err.right ? ` → <ins style="margin:0">${esc(q.err.right)}</ins>` : ''}</div>`;
  if (!it.ok && g.n > 1 && !it.skipped) extra = `<div>${g.nOk}/${g.n} giuste.</div>`;
  if (it.skipped && q.tipo === 'multipla') extra = `<div>Le risposte corrette sono evidenziate in verde.</div>`;
  const xp = !compact && it.xp ? `<span class="xpchip">+${it.xp} XP</span>` : '';
  const contest = !compact && !it.ok && !it.skipped && !it.contested && q.tipo === 'completamento' && QUIZ?.mode !== 'esame' ? `<button class="mini-link contest" id="contest">La mia risposta era giusta</button>` : '';
  const cls = it.ok ? 'ok' : g.partial ? 'mid' : 'ko';
  return `<div class="fb ${cls}" id="${compact ? '' : 'fb'}"><div class="fb-h"><span>${head}${g.typo ? ' <small>(errore di battitura perdonato)</small>' : ''}${it.contested ? ' <small>(corretta da te)</small>' : ''}</span>${xp}</div>
    ${extra}${q.spiegazione ? `<div class="expl">${fmt(q.spiegazione)}</div>` : ''}${contest}</div>`;
}

/* =========================================================
   Quiz (pratica)
   ========================================================= */
function saveQuiz() {
  if (!QUIZ || QUIZ.finished) { localStorage.removeItem(K.quiz); return; }
  save(K.quiz, { ...QUIZ, items: QUIZ.items.map(({ q, prev, ...r }) => ({ ...r, qid: q.id })) });
}
function restoreQuiz() {
  const s = load(K.quiz, null); if (!s || !s.items) return;
  const items = s.items.map(r => { const q = findQ(r.qid); return q ? { ...r, q } : null; }).filter(Boolean);
  if (!items.length) return localStorage.removeItem(K.quiz);
  QUIZ = { ...s, items }; QUIZ.i = Math.min(QUIZ.i, items.length);
}
function clearQuiz() { QUIZ = null; localStorage.removeItem(K.quiz); }
function startQuiz({ sid = null, lid = null, pool, n = 0, order = 'random', title, ret, mode = 'pratica' }) {
  if (!pool.length) return toast('Nessuna domanda da fare');
  const k = n || pool.length;
  const qs = order === 'smart' ? smartSample(pool, k) : order === 'seq' ? pool.slice(0, k) : shuffle(pool).slice(0, k);
  QUIZ = {
    mode, sid, lid, title, ret, i: 0, started: Date.now(), combo: 0, maxCombo: 0, xp: 0, saved: false,
    multi: new Set(qs.map(q => q.sid + '/' + q.lid)).size > 1, items: qs.map(initItem)
  };
  saveQuiz(); go('#/quiz');
}
function quitQuiz() {
  if (!QUIZ) return go('#/');
  const r = QUIZ.ret || '#/';
  const started = QUIZ.mode === 'esame' ? QUIZ.items.some(i => QT[i.q.tipo].answered(i.resp)) : QUIZ.items.some(i => i.done);
  if (!QUIZ.finished && started && !confirm(QUIZ.mode === 'esame' ? 'Abbandonare la simulazione? Non verrà valutata.' : 'Uscire dal quiz? Le risposte date restano nelle statistiche.')) return;
  clearQuiz(); go(r);
}
function qheadHtml(it, label) {
  const q = it.q, les = lessonOf(q);
  return `<div class="qhead"><span>${label}</span>${QUIZ.mode !== 'esame' && QUIZ.combo >= 2 ? `<span class="combo">🔥 ×${QUIZ.combo}</span>` : ''}<span class="qtools">${starBtn(q)}${flagBtn(q)}</span></div>
    ${QUIZ.multi && les ? `<div class="qles">${esc(subjName(q.sid))} › ${esc(les.nome)}</div>` : ''}`;
}
function bindLive(it, submit, exam) {
  const T = QT[it.q.tipo], area = $('#qarea');
  const ctx = {
    el: area, submit,
    changed(imm, soft) {
      if (imm && !exam) return submit();
      saveQuiz(); if (exam) updateNav();
      if (soft) return;
      area.innerHTML = T.render(it, false); typeset(area); T.bind(it, ctx);
    }
  };
  T.bind(it, ctx);
}
function quizView() {
  if (!QUIZ) { location.hash = '#/'; return; }
  if (QUIZ.mode === 'esame') return QUIZ.finished ? examResults() : examView();
  if (QUIZ.i >= QUIZ.items.length) return resultsView();
  const it = QUIZ.items[QUIZ.i], q = it.q, T = QT[q.tipo], N = QUIZ.items.length;
  let h = qheadHtml(it, `${QUIZ.i + 1} / ${N} · ${TYPES[q.tipo]}`) +
    `<div class="qprog"><i style="width:${(QUIZ.i + (it.done ? 1 : 0)) / N * 100}%"></i></div>
    <div id="qarea" class="${it.done ? (it.ok ? 'is-ok' : 'is-ko') : ''}">${T.render(it, it.done)}</div>${it.done ? fbHtml(it) : ''}`;
  h += `<div class="actbar"><div class="inner">`;
  if (!it.done) h += `<button class="btn ghost" id="skip">Non lo so</button>` + (T.verify(q) ? `<button class="btn primary" id="verify">Verifica</button>` : '');
  else h += `<button class="btn primary" id="next">${QUIZ.i + 1 < N ? 'Avanti →' : 'Vedi risultati'}</button>`;
  h += `</div></div>`;
  view(QUIZ.title, '#/', h, { onBack: quitQuiz, keepScroll: it.done, tab: false });
  if (it.done) {
    requestAnimationFrame(() => $('#fb')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }));
    $('#next').onclick = () => { QUIZ.i++; saveQuiz(); quizView(); };
    $('#contest')?.addEventListener('click', () => {
      unrecord(q, it.prev); it.prev = record(q, { ok: true });
      it.ok = true; it.g.ok = true; it.contested = true; addXp(9); it.xp += 9; QUIZ.xp += 9;
      QUIZ.combo += 1; saveQuiz(); quizView();
    });
    return;
  }
  window.scrollTo(0, 0);
  bindLive(it, () => submitPractice(it), false);
  $('#verify')?.addEventListener('click', () => submitPractice(it));
  $('#skip').onclick = () => { it.skipped = true; submitPractice(it, true); };
}
function finishItem(it, exam) {
  const q = it.q, T = QT[q.tipo];
  const blank = !T.answered(it.resp);
  it.g = !it.skipped && !blank ? T.grade(q, it.resp) : { ok: false };
  if (q.tipo === 'completamento' && !it.g.blankRes) it.g.blankRes = [];
  it.done = true; it.ok = it.g.ok;
  it.prev = record(q, it.g, exam && blank);
  if (!exam) { QUIZ.combo = it.ok ? QUIZ.combo + 1 : 0; QUIZ.maxCombo = Math.max(QUIZ.maxCombo, QUIZ.combo); }
  it.xp = it.ok ? (exam ? 6 : 10 + Math.min(Math.max(QUIZ.combo - 1, 0), 5) * 2) : it.g.partial ? 4 : exam && blank ? 0 : 1;
  QUIZ.xp += it.xp; addXp(it.xp);
  checkGoal();
}
function submitPractice(it, skip) {
  const T = QT[it.q.tipo];
  if (!skip && !T.answered(it.resp)) return toast(it.q.tipo === 'abbinamento' ? 'Collega tutti i termini' : 'Rispondi prima');
  if (!skip && it.q.tipo === 'ordina' && it.resp.length < it.q.passi.length) return toast('Ordina tutti i passi');
  finishItem(it, false);
  checkAch({ combo: QUIZ.combo, answered: true });
  saveQuiz(); quizView();
  vibrate(it.ok ? 12 : [30, 40, 30]);
}
function finishSession() {
  if (QUIZ.saved) return; QUIZ.saved = true;
  const by = {};
  QUIZ.items.forEach(i => {
    const s = by[i.q.sid] ||= { t: Date.now(), sid: i.q.sid, lid: QUIZ.lid, mode: QUIZ.mode, tot: 0, ok: 0, types: {} };
    s.tot++; if (i.ok) s.ok++;
    const t = s.types[i.q.tipo] ||= [0, 0]; t[1]++; if (i.ok) t[0]++;
  });
  Object.values(by).forEach((s, k) => { s.t += k; if (QUIZ.mode === 'esame') { s.voto = QUIZ.voto; s.lode = QUIZ.lode; s.dur = QUIZ.dur; } STATS.sessions.push(s); });
  if (STATS.sessions.length > 1500) STATS.sessions = STATS.sessions.slice(-1500);
  const N = QUIZ.items.length, ok = QUIZ.items.filter(i => i.ok).length;
  if (QUIZ.mode !== 'esame' && N >= 5 && ok === N) { addXp(25); QUIZ.xp += 25; }
  saveStats(); localStorage.removeItem(K.quiz);
  const touched = new Set(QUIZ.items.map(i => i.q.sid + '/' + i.q.lid));
  const lessonMastered = [...touched].some(k => { const [s, l] = k.split('/'); const le = DB.get(s)?.lessons.get(l); return le && le.domande.length >= 3 && le.domande.every(q => (STATS.q[q.id]?.box || 0) >= 3); });
  checkAch({ quiz: { tot: N, ok }, combo: QUIZ.maxCombo, voto: QUIZ.voto ?? 0, lode: QUIZ.lode, lessonMastered, dueCleared: QUIZ.mode === 'ripasso' && dueAll().length === 0, answered: true });
  scheduleSync(800);
}
function byTypeHtml(items) {
  const bt = {}; items.forEach(i => { const t = bt[i.q.tipo] ||= [0, 0]; t[1]++; if (i.ok) t[0]++; });
  return `<div class="card">` + Object.entries(bt).map(([t, [a, b]]) => `<div class="trow"><span>${TYPES[t]}</span><span class="r">${a}/${b}</span></div>`).join('') + '</div>';
}
function resultsView() {
  finishSession();
  const items = QUIZ.items, N = items.length, ok = items.filter(i => i.ok).length, p = ok / N;
  const msg = ok === N ? 'Perfetto! 🏆' : p >= .75 ? 'Ottimo lavoro 💪' : p >= .5 ? 'Ci sei quasi 👍' : 'Da ripassare 📚';
  const wrong = items.filter(i => !i.ok);
  let h = `<div class="score pop">${ring(p)}<div class="grow"><b>${msg}</b><div class="meta">${ok} corrette su ${N} · ${Math.max(1, Math.round((Date.now() - QUIZ.started) / 60000))} min</div>
    <div class="badges"><span class="badge xp">+${QUIZ.xp} XP</span>${QUIZ.maxCombo >= 3 ? `<span class="badge">🔥 combo ×${QUIZ.maxCombo}</span>` : ''}</div></div></div>`;
  h += `<h3>Per tipo</h3>` + byTypeHtml(items);
  if (wrong.length) h += `<h3>Da rivedere</h3><div class="card">` + wrong.map(i => `<div class="wrong-item">${fmt(cut(qLabel(i.q), 180))}${QUIZ.multi ? `<small>${esc(lessonOf(i.q)?.nome || '')}</small>` : ''}</div>`).join('') + '</div>';
  h += `<div class="stack" style="margin-top:18px">${wrong.length ? `<button class="btn primary big" id="again-wrong">Rifai le ${wrong.length} sbagliate</button>` : ''}
    <div class="row"><button class="btn" id="again">Fatto</button>${QUIZ.sid ? `<a class="btn" href="#/stats/${enc(QUIZ.sid)}">Statistiche</a>` : ''}</div></div>`;
  const q0 = QUIZ;
  view('Risultati', '#/', h, { onBack: () => { clearQuiz(); go(q0.ret); }, tab: false });
  if (ok === N && N >= 3) confetti();
  $('#again-wrong')?.addEventListener('click', () => startQuiz({ sid: q0.sid, lid: q0.lid, pool: wrong.map(i => i.q), order: 'random', title: 'Ripasso errori', ret: q0.ret }));
  $('#again').addEventListener('click', () => { clearQuiz(); go(q0.ret); });
}
function qLabel(q) {
  if (q.tipo === 'vero_falso') return q.affermazione;
  if (q.tipo === 'completamento') return (q.domanda ? q.domanda + ' — ' : '') + q.parts.map(p => p.b ? '____' : p.t).join('');
  if (q.tipo === 'errore') return (q.domanda ? q.domanda + ' — ' : '') + (q.err.before + q.err.wrong + q.err.after).replace(/\s+/g, ' ').trim();
  return q.domanda;
}

/* =========================================================
   Simulazione d'esame
   ========================================================= */
function startExam({ sid, pool, n, minutes, title, ret }) {
  const qs = shuffle(pool).slice(0, n || pool.length);
  QUIZ = { mode: 'esame', sid, title, ret, i: 0, started: Date.now(), deadline: minutes ? Date.now() + minutes * 60000 : null, minutes, combo: 0, maxCombo: 0, xp: 0, saved: false, multi: false, items: qs.map(initItem) };
  saveQuiz(); go('#/quiz');
}
function updateNav() {
  $$('.navg button').forEach((b, i) => b.classList.toggle('ans', QT[QUIZ.items[i].q.tipo].answered(QUIZ.items[i].resp)));
  const n = QUIZ.items.filter(i => QT[i.q.tipo].answered(i.resp)).length;
  const c = $('#ans-count'); if (c) c.textContent = `${n}/${QUIZ.items.length} risposte`;
}
function examView() {
  if (QUIZ.deadline && Date.now() >= QUIZ.deadline) return submitExam(true);
  const N = QUIZ.items.length, it = QUIZ.items[QUIZ.i], q = it.q;
  let h = qheadHtml(it, `Domanda ${QUIZ.i + 1} di ${N} · ${TYPES[q.tipo]}`) +
    `<div id="qarea">${QT[q.tipo].render(it, false)}</div>
    <h3>Domande <span id="ans-count" style="text-transform:none;letter-spacing:0;font-weight:500"></span></h3>
    <div class="navg">${QUIZ.items.map((x, i) => `<button class="${i === QUIZ.i ? 'cur' : ''}" data-go="${i}">${i + 1}</button>`).join('')}</div>
    <button class="btn big" id="hand-in" style="margin-top:16px">Consegna</button>
    <div class="actbar"><div class="inner"><button class="btn" id="prev" ${QUIZ.i === 0 ? 'disabled' : ''}>← Indietro</button>
    ${QUIZ.i + 1 < N ? '<button class="btn primary" id="nxt">Avanti →</button>' : '<button class="btn primary" id="hand-in2">Consegna</button>'}</div></div>`;
  const timer = QUIZ.deadline ? `<span id="timer" class="timer">${mmss(QUIZ.deadline - Date.now())}</span>` : `<span class="timer muted">∞</span>`;
  view(QUIZ.title, '#/', h, { onBack: quitQuiz, tab: false, right: timer });
  bindLive(it, () => { }, true);
  updateNav();
  const goTo = i => { QUIZ.i = i; saveQuiz(); examView(); };
  $$('.navg button').forEach(b => b.onclick = () => goTo(+b.dataset.go));
  $('#prev').onclick = () => goTo(QUIZ.i - 1);
  $('#nxt')?.addEventListener('click', () => goTo(QUIZ.i + 1));
  const handIn = () => {
    const miss = QUIZ.items.filter(i => !QT[i.q.tipo].answered(i.resp)).length;
    if (!confirm(miss ? `Ci sono ${miss} domande senza risposta (contano come sbagliate). Consegnare comunque?` : 'Consegnare la simulazione?')) return;
    submitExam(false);
  };
  $('#hand-in').onclick = handIn; $('#hand-in2')?.addEventListener('click', handIn);
  if (QUIZ.deadline) TICK = setInterval(() => {
    const left = QUIZ.deadline - Date.now(), t = $('#timer');
    if (left <= 0) { clearInterval(TICK); submitExam(true); return; }
    if (t) { t.textContent = mmss(left); t.classList.toggle('hot', left < 60000); }
  }, 500);
}
function submitExam(timeout) {
  clearInterval(TICK);
  if (QUIZ.finished) return quizView();
  QUIZ.items.forEach(it => { if (!it.done) finishItem(it, true); });
  const N = QUIZ.items.length, ok = QUIZ.items.filter(i => i.ok).length;
  QUIZ.voto = Math.round(ok / N * 30); QUIZ.lode = ok === N; QUIZ.dur = Date.now() - QUIZ.started; QUIZ.finished = true; QUIZ.i = 0;
  if (QUIZ.voto >= 18) { addXp(QUIZ.voto * 2); QUIZ.xp += QUIZ.voto * 2; }
  finishSession();
  if (timeout) toast('⏰ Tempo scaduto: compito consegnato');
  if (location.hash !== '#/quiz') location.hash = '#/quiz'; else quizView();
}
function examResults() {
  const items = QUIZ.items, N = items.length, ok = items.filter(i => i.ok).length;
  const v = QUIZ.voto, pass = v >= 18;
  const label = QUIZ.lode ? '30L' : String(v);
  let h = `<div class="score exam-score pop ${pass ? 'pass' : 'fail'}"><div class="voto"><b>${label}</b><span>/30</span></div><div class="grow">
    <b>${QUIZ.lode ? '30 e lode! 👑' : pass ? (v >= 27 ? 'Ottimo voto 🎉' : 'Promosso ✅') : 'Non superato ❌'}</b>
    <div class="meta">${ok} corrette su ${N} · ${Math.max(1, Math.round(QUIZ.dur / 60000))} min${QUIZ.minutes ? ` su ${QUIZ.minutes}` : ''}</div>
    <div class="badges"><span class="badge xp">+${QUIZ.xp} XP</span></div></div></div>`;
  h += `<h3>Per tipo</h3>` + byTypeHtml(items);
  h += `<h3>Correzione</h3><div class="stack">` + items.map((it, i) => `<div class="card review ${it.ok ? 'r-ok' : 'r-ko'}">
    <div class="qhead"><span>${i + 1}. ${TYPES[it.q.tipo]}</span><span class="qtools">${starBtn(it.q)}${flagBtn(it.q)}</span></div>
    ${QT[it.q.tipo].render(it, true)}${fbHtml(it, true)}</div>`).join('') + '</div>';
  const wrong = items.filter(i => !i.ok);
  h += `<div class="stack" style="margin-top:18px">${wrong.length ? `<button class="btn primary big" id="again-wrong">Esercitati sulle ${wrong.length} sbagliate</button>` : ''}
    <div class="row"><button class="btn" id="again">Fatto</button>${QUIZ.sid ? `<a class="btn" href="#/stats/${enc(QUIZ.sid)}">Statistiche</a>` : ''}</div></div>`;
  const q0 = QUIZ;
  view('Esito simulazione', '#/', h, { onBack: () => { clearQuiz(); go(q0.ret); }, tab: false });
  if (QUIZ.lode || v >= 28) confetti();
  $('#again-wrong')?.addEventListener('click', () => startQuiz({ sid: q0.sid, pool: wrong.map(i => i.q), order: 'random', title: 'Errori della simulazione', ret: q0.ret }));
  $('#again').addEventListener('click', () => { clearQuiz(); go(q0.ret); });
}

/* =========================================================
   Sfoglia (lezione, preferiti, segnalate)
   ========================================================= */
function browseView(sid, { lid, kind }) {
  const s = DB.get(sid); if (!s) return notFound();
  let qs, title, back = `#/m/${enc(sid)}`;
  if (lid) { const l = s.lessons.get(lid); if (!l) return notFound(); qs = l.domande; title = l.nome; back = `#/m/${enc(sid)}/l/${enc(lid)}`; }
  else if (kind === 'preferiti') { qs = allQ(s).filter(q => isStar(q.id)); title = 'Preferiti · ' + s.nome; }
  else if (kind === 'segnalate') { qs = allQ(s).filter(q => isFlag(q.id)); title = 'Segnalate · ' + s.nome; }
  else { qs = allQ(s); title = 'Tutte · ' + s.nome; }
  let h = '';
  if (!qs.length) h = `<div class="empty">${kind === 'preferiti' ? 'Nessuna preferita. Tocca ★ durante un quiz per salvarne una.' : kind === 'segnalate' ? 'Nessuna domanda segnalata. Tocca ⚑ durante un quiz se una domanda è sbagliata o ambigua.' : 'Nessuna domanda.'}</div>`;
  else {
    h += `<div class="row" style="margin-bottom:12px"><button class="btn primary" id="b-quiz">Fai un quiz su queste ${qs.length}</button>${kind === 'segnalate' ? '<button class="btn" id="b-copy">Copia per Claude</button>' : ''}</div>`;
    if (kind === 'segnalate') h += `<p class="hint" style="margin:-4px 2px 12px">"Copia per Claude" prepara un messaggio con le domande e le tue note: incollalo in chat per ricevere il JSON corretto da reimportare.</p>`;
    h += `<div class="stack">` + qs.map(q => {
      const f = flagOf(q.id), st = STATS.q[q.id];
      return `<div class="card qcard"><div class="qhead"><span>${TYPES[q.tipo]}${!lid ? ` · ${esc(lessonOf(q)?.nome || '')}` : ''}${st ? ` · ${st.ok}/${st.n}` : ''}</span><span class="qtools">${starBtn(q)}${flagBtn(q)}</span></div>
        ${revealHtml(q)}${q.spiegazione ? `<div class="expl-b">${fmt(q.spiegazione)}</div>` : ''}${f.flag && f.note ? `<div class="note">⚑ ${esc(f.note)}</div>` : ''}</div>`;
    }).join('') + '</div>';
  }
  view(title, back, h);
  $('#b-quiz')?.addEventListener('click', () => startQuiz({ sid, lid, pool: qs, order: 'random', title, ret: location.hash }));
  $('#b-copy')?.addEventListener('click', () => copyText(flaggedText(sid), 'Copiato: incollalo nella chat con Claude'));
}

/* =========================================================
   Statistiche materia
   ========================================================= */
function trendChart(sessions) {
  if (sessions.length < 2) return `<p class="hint">Completa almeno due quiz per vedere l'andamento.</p>`;
  const W = 340, H = 150, Lm = 30, R = 10, T = 12, B = 22;
  const xs = i => Lm + i * (W - Lm - R) / (sessions.length - 1);
  const ys = v => T + (1 - v) * (H - T - B);
  const pts = sessions.map((s, i) => [xs(i), ys(s.ok / s.tot)]);
  const grid = [0, .5, 1].map(v => `<line x1="${Lm}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)" stroke-width="1"/><text x="${Lm - 6}" y="${ys(v) + 4}" text-anchor="end" font-size="10" fill="var(--mut)">${v * 100}%</text>`).join('');
  const xl = `<text x="${Lm}" y="${H - 4}" font-size="10" fill="var(--mut)">${fmtDate(sessions[0].t)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end" font-size="10" fill="var(--mut)">${fmtDate(sessions.at(-1).t)}</text>`;
  const dots = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${sessions[i].mode === 'esame' ? 5 : 4}" fill="${sessions[i].mode === 'esame' ? 'var(--card)' : 'var(--acc)'}" stroke="${sessions[i].mode === 'esame' ? 'var(--acc)' : 'var(--card)'}" stroke-width="2"/><circle class="hit" data-i="${i}" cx="${x}" cy="${y}" r="14" fill="transparent"/>`).join('');
  return `<div class="chart" id="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento della percentuale di risposte giuste">${grid}${xl}
    <polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg><div class="tip"></div></div>
    <p class="hint">● quiz · ○ simulazione d'esame. Tocca un punto per i dettagli.</p>`;
}
function bindTrend(sessions) {
  const box = $('#trend'); if (!box) return;
  const tip = $('.tip', box), svg = $('svg', box);
  const show = el => {
    const s = sessions[+el.dataset.i], r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    tip.innerHTML = `${fmtDate(s.t)} · <b>${Math.round(s.ok / s.tot * 100)}%</b> (${s.ok}/${s.tot})${s.mode === 'esame' ? ` · voto ${s.lode ? '30L' : s.voto}` : ''}`;
    tip.style.left = (+el.getAttribute('cx')) * r.width / vb.width + 'px'; tip.style.top = (+el.getAttribute('cy')) * r.height / vb.height + 'px';
    tip.classList.add('on');
  };
  $$('.hit', box).forEach(c => { c.addEventListener('pointerenter', () => show(c)); c.addEventListener('click', () => show(c)); });
  box.addEventListener('pointerleave', () => tip.classList.remove('on'));
}
const DIST = [['Nuove', 'd0'], ['Fragili', 'd1'], ['In crescita', 'd2'], ['Consolidate', 'd3']];
function distBar(dist) {
  const tot = dist.reduce((a, b) => a + b, 0) || 1;
  return `<div class="dist">${dist.map((v, i) => v ? `<i class="${DIST[i][1]}" style="flex:${v}" title="${DIST[i][0]}: ${v}"></i>` : '').join('')}</div>
    <div class="legend">${dist.map((v, i) => `<span><i class="${DIST[i][1]}"></i>${DIST[i][0]} <b>${v}</b></span>`).join('')}</div>`;
}
function statsView(sid) {
  const s = DB.get(sid); if (!s) return notFound();
  const qs = allQ(s), st = aggr(qs);
  const sessions = STATS.sessions.filter(x => x.sid === sid).slice(-30);
  const exams = STATS.sessions.filter(x => x.sid === sid && x.mode === 'esame').slice(-6).reverse();
  let h = kpis(st);
  h += `<h3>Stato delle domande</h3><div class="card">${distBar(st.dist)}<p class="hint">Consolidate = risposte giuste in giorni diversi, tornano tra 4+ giorni.</p></div>`;
  h += `<h3>Andamento (ultimi ${sessions.length} quiz)</h3><div class="card">${trendChart(sessions)}</div>`;
  if (exams.length) h += `<h3>Simulazioni d'esame</h3><div class="card">` + exams.map(e => `<div class="trow"><span>${fmtDate(e.t, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span class="r"><b class="pct ${e.voto >= 18 ? 'hi' : 'lo'}">${e.lode ? '30L' : e.voto}</b> · ${e.ok}/${e.tot}</span></div>`).join('') + '</div>';
  const days = range(14).map(i => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
  const vals = days.map(d => dayTotal(dayKey(d), sid)), mx = Math.max(1, ...vals);
  h += `<h3>Domande risposte, ultimi 14 giorni · ${vals.reduce((a, b) => a + b, 0)}</h3><div class="card"><div class="days">${days.map((d, i) => `<div title="${vals[i]} domande"><i class="${vals[i] ? '' : 'zero'}" style="height:${vals[i] / mx * 100}%"></i><span>${d.getDate()}</span></div>`).join('')}</div></div>`;
  h += `<h3>Per lezione</h3><div class="card">` + sortedLessons(s).map(l => {
    const a = aggr(l.domande);
    return `<a class="trow block" href="#/m/${enc(sid)}/l/${enc(l.id)}"><div class="sp"><span>${esc(l.nome)}</span><span class="pct ${pctCls(a.ready)}">${pctTxt(a.ready)}</span></div>
      <div class="meta">giuste ${pctTxt(a.acc)} · viste ${a.seen}/${a.total} · consolidate ${a.mastered}</div>${pbar(a.ready)}</a>`;
  }).join('') + '</div>';
  const bt = {};
  qs.forEach(q => { const x = STATS.q[q.id]; if (!x) return; const t = bt[q.tipo] ||= [0, 0]; t[0] += x.ok; t[1] += x.n; });
  if (Object.keys(bt).length) h += `<h3>Per tipo di domanda</h3><div class="card">` + Object.entries(bt).map(([t, [a, b]]) => `<div class="trow"><span>${TYPES[t]}</span><span class="r"><span class="pct ${pctCls(a / b)}">${pctTxt(a / b)}</span> · ${a}/${b}</span></div>`).join('') + '</div>';
  const hard = qs.filter(q => STATS.q[q.id] && STATS.q[q.id].n > STATS.q[q.id].ok)
    .sort((a, b) => { const A = STATS.q[a.id], B = STATS.q[b.id]; return (B.n - B.ok) / B.n - (A.n - A.ok) / A.n || (B.n - B.ok) - (A.n - A.ok); }).slice(0, 8);
  if (hard.length) {
    h += `<h3>Domande più difficili</h3><div class="card">` + hard.map(q => { const x = STATS.q[q.id]; return `<div class="wrong-item">${fmt(cut(qLabel(q), 160))}<small>${esc(lessonOf(q)?.nome || '')} · giuste ${x.ok}/${x.n}</small></div>`; }).join('') + '</div>';
    h += `<div class="stack" style="margin-top:12px"><button class="btn primary" id="hard">Allenati su queste ${hard.length}</button></div>`;
  }
  h += `<h3>Azzera</h3><button class="btn danger sm" id="reset">Azzera statistiche di ${esc(s.nome)}</button>`;
  view('Statistiche · ' + s.nome, `#/m/${enc(sid)}`, h);
  bindTrend(sessions);
  $('#hard')?.addEventListener('click', () => startQuiz({ sid, pool: hard, order: 'random', title: 'Domande difficili', ret: `#/stats/${enc(sid)}` }));
  $('#reset').addEventListener('click', () => {
    if (!confirm(`Azzerare tutte le statistiche di ${s.nome}? Non si può annullare (XP e traguardi restano).`)) return;
    qs.forEach(q => delete STATS.q[q.id]);
    STATS.sessions = STATS.sessions.filter(x => x.sid !== sid);
    saveStats(); statsView(sid); toast('Statistiche azzerate');
  });
}

/* =========================================================
   Profilo
   ========================================================= */
function heatmap() {
  const weeks = 17, goal = META.goal, now = new Date();
  const start = new Date(now); start.setHours(12); start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - (weeks - 1) * 7);
  let cells = '';
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
    if (day > now) { cells += '<i class="h-x"></i>'; continue; }
    const v = dayTotal(dayKey(day)), l = v === 0 ? 0 : v < goal / 2 ? 1 : v < goal ? 2 : v < goal * 2 ? 3 : 4;
    cells += `<i class="h${l}" title="${fmtDate(day)}: ${v} domande"></i>`;
  }
  return `<div class="heat">${cells}</div><div class="legend heat-leg"><span>meno</span>${[0, 1, 2, 3, 4].map(l => `<i class="h${l}"></i>`).join('')}<span>più</span><span class="grow"></span><span>obiettivo = 3º livello</span></div>`;
}
function profileView() {
  const xp = xpTotal(), lv = levelOf(xp), lo = needXp(lv), hi = needXp(lv + 1), t = totals();
  let h = `<div class="hero profile"><div class="lvl big"><span class="lvl-badge">${lv}</span><span><b>${levelTitle(lv)}</b><span class="meta">${xp} XP totali · ${hi - xp} al livello ${lv + 1}</span></span></div>${pbar((xp - lo) / (hi - lo), 'xp')}</div>`;
  h += `<div class="kpis" style="margin-top:12px">
    <div class="kpi"><b>🔥 ${streak()}</b><span>giorni di fila (record ${bestStreak()})</span></div>
    <div class="kpi"><b>${t.n}</b><span>risposte date</span></div>
    <div class="kpi"><b class="pct ${pctCls(t.n ? t.ok / t.n : null)}">${pctTxt(t.n ? t.ok / t.n : null)}</b><span>risposte giuste</span></div>
    <div class="kpi"><b>${Object.keys(STATS.ach).length}<small>/${ACH.length}</small></b><span>traguardi</span></div></div>`;
  h += `<h3>Attività · ultime 17 settimane</h3><div class="card">${heatmap()}</div>`;
  h += `<h3>Traguardi</h3><div class="achs">` + ACH.map(a => { const got = STATS.ach[a.id]; return `<div class="ach ${got ? 'got' : ''}"><span class="ach-e">${got ? a.e : '🔒'}</span><b>${esc(a.n)}</b><small>${esc(a.d)}</small>${got ? `<small class="when">${fmtDate(got)}</small>` : ''}</div>`; }).join('') + '</div>';
  h += `<h3>Livelli</h3><div class="card">` + LEVEL_TITLES.map(([l, n]) => `<div class="trow"><span>${lv >= l ? '✅' : '▫️'} ${n}</span><span class="r">livello ${l}</span></div>`).join('') + '</div>';
  view('Profilo', null, h, { tab: 'profilo' });
}

/* =========================================================
   Impostazioni, sync, dati, import, formato
   ========================================================= */
function settingsView() {
  const synced = !!SYNC.token;
  let h = `<h3 style="margin-top:4px">Obiettivo giornaliero</h3><div class="card">${seg('goal', [[10, '10'], [20, '20'], [30, '30'], [50, '50'], [80, '80']], META.goal)}<p class="hint">Domande al giorno per tenere viva la 🔥 serie.</p></div>
    <h3>Feedback</h3><div class="card"><label class="switch"><span>Vibrazione alle risposte</span><input type="checkbox" id="vib" ${PREFS.vib ? 'checked' : ''}></label></div>
    <h3>Sincronizzazione tra dispositivi</h3><div class="card" id="sync-card">`;
  if (synced) h += `<div class="sync-on"><b>✅ Collegata a GitHub</b><div class="meta">${SYNC.last ? 'Ultima sincronizzazione: ' + fmtDate(SYNC.last, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Mai sincronizzata'}${SYNC.err ? `<br><span class="rep-ko">Ultimo errore: ${esc(SYNC.err)}</span>` : ''}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="sync-now">Sincronizza ora</button><button class="btn danger" id="sync-off">Scollega</button></div></div>`;
  else h += `<p style="margin-top:0">Statistiche, XP, preferiti, date d'esame e lezioni importate vengono salvati in un <b>Gist privato</b> del tuo account GitHub, così telefono e Mac restano allineati.</p>
      <ol class="steps-help"><li><a href="https://github.com/settings/tokens/new?scopes=gist&description=Ripasso%20sync" target="_blank" rel="noopener">Crea un token (classic)</a> con solo lo scope <b>gist</b> e scadenza a piacere.</li><li>Incollalo qui sotto e premi Collega.</li><li>Sugli altri dispositivi usa lo stesso token: il Gist viene trovato da solo.</li></ol>
      <input type="password" id="sync-token" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn primary" id="sync-on" style="width:100%;margin-top:10px">Collega</button>
      <p class="hint">Il token resta solo in questo browser. Se scade, riprendi da qui.</p>`;
  h += `</div><h3>Contenuti</h3><div class="list">
    <a class="card linkrow" href="#/importa"><span>＋ Importa quiz</span><span>›</span></a>
    <a class="card linkrow" href="#/formato"><span>📄 Formato e prompt per Claude</span><span>›</span></a>
    <button class="card linkrow" id="exp-flags"><span>⚑ Copia tutte le segnalate per Claude (${flaggedFor().length})</span><span>›</span></button>
    <a class="card linkrow" href="#/dati"><span>💾 Dati e backup</span><span>›</span></a></div>`;
  view('Impostazioni', null, h, { tab: 'impostazioni' });
  $('.seg[data-name="goal"]').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('.seg[data-name="goal"] button').forEach(x => x.classList.toggle('on', x === b));
    META.goal = +b.dataset.v; META.goalT = Date.now(); saveMeta(); scheduleSync(); toast('Obiettivo: ' + META.goal + ' domande al giorno');
  });
  $('#vib').onchange = e => { PREFS.vib = e.target.checked; savePrefs(); vibrate(20); };
  $('#exp-flags').onclick = () => flaggedFor().length ? copyText(flaggedText(), 'Copiato: incollalo nella chat con Claude') : toast('Nessuna domanda segnalata');
  $('#sync-on')?.addEventListener('click', async () => {
    const t = $('#sync-token').value.trim(); if (!t) return toast('Incolla il token');
    SYNC = { token: t }; saveSync();
    toast('Collegamento…'); await syncNow(false); settingsView();
    if (SYNC.err) { toast('Errore: ' + SYNC.err, 4000); }
  });
  $('#sync-now')?.addEventListener('click', async () => { await syncNow(false); settingsView(); });
  $('#sync-off')?.addEventListener('click', () => { if (!confirm('Scollegare la sincronizzazione su questo dispositivo? I dati restano sia qui sia sul Gist.')) return; SYNC = {}; saveSync(); settingsView(); });
}

/* ---------- sync via GitHub Gist ---------- */
function saveSync() { save(K.sync, SYNC); }
function snapshot() { return { app: 'ripasso', v: 2, local: LOCAL, tomb: TOMB, stats: STATS, meta: META }; }
function mergeSnap(a, b) {
  const A = a.stats, B = b.stats || {};
  const q = { ...A.q };
  for (const [id, s] of Object.entries(B.q || {})) { const x = q[id]; if (!x || s.n > x.n || (s.n === x.n && (s.t || 0) > (x.t || 0))) q[id] = s; }
  const ses = new Map(); [...(B.sessions || []), ...A.sessions].forEach(s => ses.set(s.t + '|' + s.sid, s));
  const dev = JSON.parse(JSON.stringify(A.dev));
  for (const [d, v] of Object.entries(B.dev || {})) {
    const m = dev[d] ||= { xp: 0, days: {} }; m.days ||= {};
    m.xp = Math.max(m.xp || 0, v.xp || 0);
    for (const [day, o] of Object.entries(v.days || {})) { const md = m.days[day] ||= {}; for (const [sid, n] of Object.entries(o)) md[sid] = Math.max(md[sid] || 0, n); }
    if (v.gb) m.gb = { ...v.gb, ...(m.gb || {}) };
  }
  const ach = { ...A.ach }; for (const [k, t] of Object.entries(B.ach || {})) ach[k] = Math.min(ach[k] || Infinity, t);
  const tomb = { ...(b.tomb || {}) }; for (const [k, t] of Object.entries(a.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, t);
  const les = new Map(); [...(b.local || []), ...a.local].forEach(l => { const k = lkey(l), x = les.get(k); if (!x || (l.t || 0) > (x.t || 0)) les.set(k, l); });
  const local = [...les.values()].filter(l => !(tomb[lkey(l)] >= (l.t || 0)));
  const MA = a.meta, MB = b.meta || {};
  const subj = { ...(MB.subj || {}) }; for (const [k, v] of Object.entries(MA.subj)) if (!subj[k] || (v.t || 0) >= (subj[k].t || 0)) subj[k] = v;
  const flags = { ...(MB.flags || {}) }; for (const [k, v] of Object.entries(MA.flags)) if (!flags[k] || (v.t || 0) >= (flags[k].t || 0)) flags[k] = v;
  const goalNewer = (MB.goalT || 0) > (MA.goalT || 0);
  return {
    app: 'ripasso', v: 2, local, tomb,
    stats: { q, sessions: [...ses.values()].sort((x, y) => x.t - y.t).slice(-1500), dev, ach },
    meta: { subj, flags, goal: goalNewer ? MB.goal : MA.goal, goalT: Math.max(MA.goalT || 0, MB.goalT || 0) }
  };
}
function applySnap(s) {
  LOCAL = s.local || []; TOMB = s.tomb || {}; STATS = s.stats; META = s.meta; normalizeState();
  save(K.local, LOCAL); save(K.tomb, TOMB); save(K.stats, STATS); save(K.meta, META);
}
async function gh(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, { ...opts, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + SYNC.token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) {
    const e = new Error(r.status === 401 ? 'token non valido o scaduto' : r.status === 403 ? 'accesso negato (il token ha lo scope "gist"?)' : r.status === 404 ? 'gist non trovato' : 'GitHub ha risposto ' + r.status);
    e.status = r.status; throw e;
  }
  return r.json();
}
async function findOrCreateGist() {
  for (let p = 1; p <= 10; p++) {
    const list = await gh(`/gists?per_page=100&page=${p}`);
    const g = list.find(g => g.files && g.files[SYNC_FILE]); if (g) return g.id;
    if (list.length < 100) break;
  }
  const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'Ripasso — dati sincronizzati (non modificare a mano)', public: false, files: { [SYNC_FILE]: { content: JSON.stringify(snapshot()) } } }) });
  return g.id;
}
let syncTimer = null, syncBusy = false;
function scheduleSync(ms = 3000) { if (!SYNC.token) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), ms); }
async function syncNow(silent) {
  if (!SYNC.token || syncBusy) return;
  syncBusy = true;
  try {
    if (!SYNC.gist) { SYNC.gist = await findOrCreateGist(); saveSync(); }
    let g;
    try { g = await gh('/gists/' + SYNC.gist); }
    catch (e) { if (e.status !== 404) throw e; SYNC.gist = await findOrCreateGist(); saveSync(); g = await gh('/gists/' + SYNC.gist); }
    const f = g.files?.[SYNC_FILE];
    if (f) {
      let c = f.content; if (f.truncated) c = await (await fetch(f.raw_url)).text();
      let remote = null; try { remote = JSON.parse(c); } catch { }
      if (remote?.app === 'ripasso' && remote.stats) { applySnap(mergeSnap(snapshot(), remote)); rebuild(); }
    }
    await gh('/gists/' + SYNC.gist, { method: 'PATCH', body: JSON.stringify({ files: { [SYNC_FILE]: { content: JSON.stringify(snapshot()) } } }) });
    SYNC.last = Date.now(); delete SYNC.err; saveSync(); DIRTY = false;
    if (!silent) toast('🔄 Sincronizzato');
    const h = location.hash;
    if (!h || h === '#/' || h === '#/profilo') route();
  } catch (e) {
    SYNC.err = e.message; saveSync();
    if (!silent) toast('Sync: ' + e.message, 3500);
  } finally { syncBusy = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && DIRTY) syncNow(true); else if (document.visibilityState === 'visible' && SYNC.token && Date.now() - (SYNC.last || 0) > 60000) syncNow(true); });

/* ---------- dati & backup ---------- */
function download(name, obj) {
  const isStr = typeof obj === 'string';
  const blob = new Blob([isStr ? obj : JSON.stringify(obj, null, 2)], { type: isStr ? 'text/plain' : 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function dataView() {
  const nQ = Object.keys(STATS.q).length;
  let h = `<h3 style="margin-top:6px">Lezioni importate su questo dispositivo</h3>`;
  h += LOCAL.length ? `<div class="card">` + LOCAL.map((l, i) => `<div class="trow" style="align-items:center"><span><b>${esc(l.materia)}</b> › ${esc(l.lezione)}<br><small class="meta">${plural(l.domande.length, 'domanda', 'domande')}</small></span>
      <span class="row" style="flex:none;gap:6px"><button class="btn sm" data-exp="${i}">Esporta</button><button class="btn sm danger" data-del="${i}">Elimina</button></span></div>`).join('') + '</div>'
    : `<p class="hint">Nessuna. Le lezioni nella cartella <code>data/</code> del repo non compaiono qui: si gestiscono su GitHub.</p>`;
  h += `<h3>Backup</h3><p class="hint" style="margin-top:0">Con la sincronizzazione attiva i dati sono già al sicuro su GitHub. Il backup manuale resta utile come copia di sicurezza.</p>
    <div class="row" style="margin-top:10px"><button class="btn" id="bk-exp">Esporta backup</button><label class="btn">Ripristina backup<input type="file" id="bk-imp" accept=".json,application/json" hidden></label></div>
    <h3>Statistiche</h3><p class="hint" style="margin-top:0">${nQ} domande con statistiche · ${STATS.sessions.length} quiz completati · ${xpTotal()} XP.</p>
    <button class="btn danger sm" id="st-reset" style="margin-top:8px">Azzera tutte le statistiche</button>
    <h3>App</h3><button class="btn sm" id="reload">Ricarica dati dal repo</button>`;
  view('Dati e backup', '#/impostazioni', h, { tab: 'impostazioni' });
  $$('[data-del]').forEach(b => b.onclick = () => {
    const l = LOCAL[+b.dataset.del];
    if (!confirm(`Eliminare "${l.lezione}" (${l.materia}) da questo dispositivo? Le statistiche restano.`)) return;
    TOMB[lkey(l)] = Date.now(); LOCAL.splice(+b.dataset.del, 1); saveLocal(); rebuild(); scheduleSync(); dataView();
  });
  $$('[data-exp]').forEach(b => b.onclick = () => { const l = LOCAL[+b.dataset.exp]; download(`${slug(l.materia)}-${slug(l.lezione)}.json`, { materia: l.materia, lezione: l.lezione, domande: l.domande.map(exportQ) }); });
  $('#bk-exp').onclick = () => download(`ripasso-backup-${today()}.json`, { ...snapshot(), creato: new Date().toISOString() });
  $('#bk-imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'ripasso' || !j.stats) throw new Error('non è un backup di Ripasso');
      if (!confirm('Il backup sostituirà statistiche e lezioni importate attuali. Continuare?')) return;
      applySnap({ local: j.local || [], tomb: j.tomb || {}, stats: j.stats, meta: j.meta || {} }); rebuild(); scheduleSync(); toast('Backup ripristinato'); dataView();
    } catch (err) { toast('Errore: ' + err.message); }
  };
  $('#st-reset').onclick = () => {
    if (!confirm(SYNC.token ? 'Con la sincronizzazione attiva i dati tornerebbero dal Gist: scollega prima la sync. Azzerare comunque le statistiche di questo dispositivo?' : 'Azzerare TUTTE le statistiche, XP e traguardi? Non si può annullare.')) return;
    STATS = { q: {}, sessions: [], dev: {}, ach: {} }; saveStats(); toast('Statistiche azzerate'); dataView();
  };
  $('#reload').onclick = async () => { await loadRepo(); rebuild(); restoreQuiz(); toast('Dati aggiornati'); go('#/'); };
}

/* ---------- import ---------- */
function stripFences(t) { return t.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, ''); }
function jsonErr(text, e) {
  const m = String(e.message).match(/position (\d+)/); if (!m) return e.message;
  const pos = +m[1], before = text.slice(0, pos), line = before.split('\n').length, col = pos - before.lastIndexOf('\n');
  return `${e.message.replace(/ in JSON at position \d+.*/, '')} (riga ${line}, colonna ${col})`;
}
function importView() {
  const h = `<p class="meta" style="margin:0 2px 12px">Incolla il JSON di una o più lezioni (anche direttamente dalla chat con Claude) oppure scegli dei file <code>.json</code>. Le lezioni importate restano su questo dispositivo${SYNC.token ? ' e vengono sincronizzate' : ''}. <a href="#/formato">Vedi il formato</a></p>
    <textarea id="imp-text" placeholder='{ "materia": "...", "lezione": "...", "domande": [ ... ] }'></textarea>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="imp-check">Controlla</button><label class="btn">Scegli file<input type="file" id="imp-file" accept=".json,application/json,text/plain" multiple hidden></label></div>
    <div class="field" style="margin-top:16px"><label>Se la lezione esiste già</label><div class="seg" id="imp-mode"><button data-v="add" class="on">Aggiungi domande</button><button data-v="replace">Sostituisci</button></div></div>
    <div id="imp-report"></div>`;
  view('Importa quiz', '#/impostazioni', h, { tab: 'impostazioni' });
  const sg = $('#imp-mode');
  sg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); });
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
        const key = lkey(l), ex = LOCAL.find(x => lkey(x) === key);
        if (ex && mode === 'add') { const ids = new Set(ex.domande.map(q => q.id)); l.domande.forEach(q => { if (!ids.has(q.id)) ex.domande.push(q); }); ex.t = Date.now(); }
        else { if (ex) LOCAL.splice(LOCAL.indexOf(ex), 1); LOCAL.push({ ...l, t: Date.now() }); }
        delete TOMB[key];
      });
      saveLocal(); rebuild(); scheduleSync(1000);
      toast(`Salvate ${plural(good.length, 'lezione', 'lezioni')}`);
      go(`#/m/${enc(slug(good[0].materia))}`);
    });
  };
  $('#imp-check').onclick = () => check([{ name: 'Testo incollato', text: $('#imp-text').value }]);
  $('#imp-file').onchange = async e => { const fs = [...e.target.files]; check(await Promise.all(fs.map(async f => ({ name: f.name, text: await f.text() })))); e.target.value = ''; };
}

/* ---------- formato ---------- */
const EXAMPLE = `{
  "materia": "Human Language Technologies",
  "lezione": "18 - Post-training e LoRA",
  "domande": [
    { "tipo": "multipla",
      "domanda": "Come viene parametrizzato l'aggiornamento in LoRA?",
      "opzioni": ["$\\\\Delta W = BA$ con rango $r$ piccolo", "Con una maschera sparsa", "Con la SVD di $W$"],
      "corretta": "A",
      "spiegazione": "B è d×r e A è r×k, con r ≪ min(d,k)." },
    { "tipo": "multipla",
      "domanda": "Quali affermazioni su LoRA sono vere?",
      "opzioni": ["I pesi originali sono congelati", "Aggiunge latenza in inferenza", "B è inizializzata a zero"],
      "corretta": ["A", "C"] },
    { "tipo": "vero_falso",
      "affermazione": "DPO richiede un reward model esplicito.",
      "risposta": false },
    { "tipo": "completamento",
      "testo": "In RLHF la policy è ottimizzata con [[PPO]] e una penalità [[KL|Kullback-Leibler]].",
      "distrattori": ["SGD", "entropia"] },
    { "tipo": "errore",
      "testo": "In LoRA la matrice A è inizializzata a {{zero|valori gaussiani}}." },
    { "tipo": "abbinamento",
      "domanda": "Collega ogni metodo alla sua idea",
      "coppie": [["SFT", "imitare risposte di esempio"], ["RLHF", "reward model + PPO"], ["DPO", "preferenze senza reward model"]] },
    { "tipo": "ordina",
      "domanda": "Ordina la pipeline di RLHF",
      "passi": ["Pre-training", "SFT", "Addestramento del reward model", "Ottimizzazione con PPO"] },
    { "tipo": "aperta",
      "domanda": "Perché LoRA non aggiunge latenza in inferenza?",
      "risposta": "Perché BA ha la stessa forma di W: dopo il training si somma a W e si usa un'unica matrice.",
      "punti": ["BA ha forma d×k", "merge W' = W + BA"] }
  ]
}`;
const PROMPT = `Crea un quiz per la mia app "Ripasso" a partire da questa lezione (te la incollo/allego sotto).

Restituisci SOLO un blocco JSON valido con questa struttura:
{"materia": "<nome materia, sempre uguale per tutte le lezioni>", "lezione": "<NN - titolo lezione>", "domande": [ ... ]}

Tipi di domanda (mescolali; circa 20-30 domande in totale, con prevalenza di multipla, completamento e trova l'errore):
1. Risposta multipla: {"tipo":"multipla","domanda":"...","opzioni":["...","...","...","..."],"corretta":"B","spiegazione":"..."}
   - "corretta" è una lettera ("A","B",...) oppure una lista di lettere se le risposte giuste sono più di una, es. ["A","C"].
   - Distrattori plausibili e di lunghezza simile alla risposta giusta.
2. Vero/Falso: {"tipo":"vero_falso","affermazione":"...","risposta":true,"spiegazione":"..."}
3. Completamento: {"tipo":"completamento","testo":"... [[risposta]] ... [[altra risposta|sinonimo accettato]] ...","spiegazione":"..."}
   - Ogni spazio è [[risposta]]; varianti accettate separate da |. Risposte brevi (1-3 parole).
   - Opzionale "distrattori": ["...","..."] per trasformare gli spazi in menu a tendina.
4. Trova l'errore: {"tipo":"errore","testo":"frase con UN errore marcato come {{parola sbagliata|parola corretta}}","spiegazione":"..."}
   - Esattamente un {{...|...}} per domanda; la parte sbagliata breve (idealmente una parola) e plausibile.
   - Per il codice: metti il codice in "testo" con gli a capo (\\n); la riga con {{...|...}} è quella da trovare; aggiungi "domanda" con la consegna.
5. Abbinamento: {"tipo":"abbinamento","domanda":"Collega ...","coppie":[["termine","descrizione"], ...],"spiegazione":"..."}
   - 3-6 coppie, termini brevi, descrizioni non banalmente riconoscibili.
6. Ordina: {"tipo":"ordina","domanda":"Ordina ...","passi":["primo","secondo","terzo", ...],"spiegazione":"..."}
   - "passi" va scritto GIÀ nell'ordine corretto (l'app li mescola). 3-6 passi: pipeline, algoritmi, derivazioni.
7. Risposta aperta: {"tipo":"aperta","domanda":"...","risposta":"risposta modello completa ma concisa","punti":["concetto chiave 1","concetto chiave 2"]}
   - Per domande da orale/scritto; mi autovaluto confrontandomi con la risposta modello.

Campi opzionali per ogni domanda: "codice" (snippet mostrato sopra la domanda), "spiegazione" (consigliata sempre).
Formule in LaTeX tra $...$ (nel JSON i backslash vanno raddoppiati: "$\\\\alpha$").
Copri tutti i concetti importanti della lezione: definizioni, formule, confronti, casi tipici d'esame. Scrivi in italiano.`;
function formatView() {
  const h = `<div class="doc">
  <p>Ogni lezione è un file JSON con <b>materia</b>, <b>lezione</b> e una lista di <b>domande</b>. Materie e lezioni vengono create in automatico dai nomi: usa sempre lo stesso nome di materia.</p>
  <button class="btn primary" id="copy-prompt" style="width:100%">Copia il prompt per generarli con Claude</button>
  <p class="hint">Incolla il prompt in chat insieme alle slide o agli appunti, poi incolla il JSON che ottieni in <a href="#/importa">Importa</a>.</p>
  <h3>Tipi di domanda</h3>
  <p><b>multipla</b>: <code>domanda</code>, <code>opzioni</code>, <code>corretta</code> (lettera, o lista se più risposte sono giuste). Le opzioni vengono mescolate; <code>"mescola": false</code> le tiene in ordine.</p>
  <p><b>vero_falso</b>: <code>affermazione</code>, <code>risposta</code> (true/false).</p>
  <p><b>completamento</b>: <code>testo</code> con spazi <code>[[risposta]]</code> o <code>[[risposta|variante]]</code>. Con <code>distrattori</code> diventano menu a tendina.</p>
  <p><b>errore</b>: <code>testo</code> con un solo <code>{{sbagliato|corretto}}</code>. Su più righe (codice) si tocca la riga.</p>
  <p><b>abbinamento</b>: <code>coppie</code> = lista di <code>["termine", "descrizione"]</code>.</p>
  <p><b>ordina</b>: <code>passi</code> già nell'ordine giusto; l'app li mescola.</p>
  <p><b>aperta</b>: <code>domanda</code>, <code>risposta</code> modello, <code>punti</code> chiave facoltativi. Ti autovaluti (escluse dalle simulazioni d'esame).</p>
  <p>Opzionali ovunque: <code>spiegazione</code>, <code>codice</code>, <code>id</code> (per non perdere le statistiche se modifichi il testo). Nei testi: <code>$formule$</code>, <code>**grassetto**</code>, <code>\`codice\`</code>.</p>
  <h3>Esempio</h3><pre><code>${esc(EXAMPLE)}</code></pre>
  <h3>Più lezioni in un file</h3><pre><code>${esc('{\n  "materia": "Computer Vision",\n  "lezioni": [\n    { "lezione": "01 - Intro", "domande": [ ... ] },\n    { "lezione": "02 - Filtri", "domande": [ ... ] }\n  ]\n}')}</code></pre>
  <h3>Nel repo GitHub</h3><p>Metti i file in <code>data/</code> e aggiungi il percorso a <code>data/index.json</code>:</p><pre><code>${esc('{ "file": ["hlt/18-lora.json", "cv/01-intro.json"] }')}</code></pre>
  </div>`;
  view('Formato dei quiz', '#/impostazioni', h, { tab: 'impostazioni' });
  $('#copy-prompt').onclick = () => copyText(PROMPT, 'Prompt copiato');
}

/* =========================================================
   Scorciatoie da tastiera (Mac)
   ========================================================= */
document.addEventListener('keydown', e => {
  if (location.hash !== '#/quiz' || !QUIZ || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (e.key === 'Enter' && tag !== 'TEXTAREA' && tag !== 'INPUT') { const b = $('#next') || $('#verify'); if (b) { e.preventDefault(); b.click(); } return; }
  if (/^[1-9]$/.test(e.key) && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    const opts = $$('#qarea .opt:not([disabled])'); const b = opts[+e.key - 1]; if (b) { e.preventDefault(); b.click(); }
  }
  if (e.key === 'ArrowRight' && QUIZ.mode === 'esame') $('#nxt')?.click();
  if (e.key === 'ArrowLeft' && QUIZ.mode === 'esame') $('#prev')?.click();
});

/* =========================================================
   Avvio
   ========================================================= */
window.addEventListener('hashchange', route);
(async () => {
  view('Ripasso', null, '<div class="loading">Caricamento…</div>');
  await loadRepo(); rebuild(); restoreQuiz();
  route();
  if (SYNC.token) syncNow(true);
})();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
