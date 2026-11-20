/* PLTFRM Team Tools: output analyzer for AMC queries.
   Paste or upload a query's results to get headline numbers, a chart, grouped and raw tables,
   and PDF / Excel downloads. Each query can carry saved settings (q.viz) with derived columns,
   KPIs and default chart settings; queries without them get sensible automatic defaults.
   Ported from the AMC Query Library; the calculations are unchanged. */
(function () {
  'use strict';
  var Hub = window.Hub;
  const esc = s => Hub.esc(s);
  const toast = (m, bad) => Hub.toast(m, bad);

  const LIBS = {
    chart: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js",
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
  };
  const libs = {};
  function loadLib(k) {
    return libs[k] || (libs[k] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = LIBS[k]; s.onload = res;
      s.onerror = () => { delete libs[k]; rej(new Error("Couldn't load " + k)); };
      document.head.appendChild(s);
    }));
  }

  // Pasted or uploaded results are remembered per query on this browser
  const store = {};
  const LS = id => "amcql.out." + id;
  function persist(id, A) { if (A.text.length < 2e6) Hub.store.set(LS(id), JSON.stringify({ text: A.text, source: A.source })); }
  function restore(id) { try { const v = Hub.store.get(LS(id)); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function forget(id) { Hub.store.remove(LS(id)); }

  // CSV / TSV parser (same rules as the library: tab if the header has a tab, otherwise comma)
  function parseTable(text) {
    text = String(text || "").replace(/\r/g, "").trim();
    if (!text) return null;
    const delim = text.split("\n")[0].includes("\t") ? "\t" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === "") q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    row.push(cell); rows.push(row);
    const columns = rows.shift().map(s => s.trim());
    return { columns, rows: rows.filter(r => r.some(v => v.trim() !== "")).map(r => columns.map((_, i) => (r[i] ?? "").trim())) };
  }
  function tableToText(ex) {
    if (!ex || !ex.columns) return "";
    return [ex.columns, ...(ex.rows || [])].map(r => r.join("\t")).join("\n");
  }
  const typeLabel = q => String(q.type || "").trim() || "Other";
  const ICON_UP = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6M2.5 10.5v3h11v-3"/></svg>';
  const ICON_DL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5V11M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11"/></svg>';

  // ---- calculations (unchanged from the library)
    const num = v => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return isFinite(v) ? v : null;
      const s = String(v).trim().replace(/[$,%\s]/g, "");
      if (!s || !/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
      return parseFloat(s);
    };
    const isIdCol = c => /(^|_)id$|(^|_)id_|rank|sort_order/i.test(c);
    const ACR = { ntb: "NTB", asin: "ASIN", asins: "ASINs", cac: "CAC", ltv: "LTV", roas: "ROAS", dsp: "DSP", sp: "SP", sb: "SB", sd: "SD", id: "ID", pct: "%", adv: "advertised" };
    const humanize = c => { const w = String(c).replace(/_/g, " ").replace(/\s+/g, " ").trim().split(" ").map(x => ACR[x.toLowerCase()] || x); const s = w.join(" "); return s.charAt(0).toUpperCase() + s.slice(1); };
    const round = v => typeof v === "number" ? Math.round(v * 100) / 100 : v;

    function fmtV(kind, v) {
      if (v === null || v === undefined || v === "" || (typeof v === "number" && !isFinite(v))) return "–";
      if (kind === "text" || typeof v !== "number") return String(v);
      const a = Math.abs(v);
      if (kind === "money") return (v < 0 ? "-$" : "$") + a.toLocaleString(undefined, { minimumFractionDigits: a >= 1000 ? 0 : 2, maximumFractionDigits: a >= 1000 ? 0 : 2 });
      if (kind === "pct") return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
      if (kind === "num1") return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      if (kind === "num2") return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (kind === "x") return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "x";
      if (kind === "int") return Math.round(v).toLocaleString();
      return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function load(text, source) {
      const t = parseTable(text);
      if (!t || !t.columns.length || !t.columns.some(Boolean) || !t.rows.length) return { err: "No rows found. Paste the header row followed by the data rows, or upload the CSV from AMC." };
      t.rows = t.rows.map(r => r.map(v => (v === "null" || v === "NULL") ? "" : v)); // AMC writes empty values as "null"
      return { text, source, data: t, settings: null, tab: "group", sort: {} };
    }

    // ---- model: column types, derived columns, labels, defaults
    // Reads an AMC path like [[1, NB], [2, B]] (or [{order=1, campaign_group=NB}, ...]),
    // treats Other as branded, keeps each group at its first appearance and names the result.
    const PATH_NAMES = { "NB": "Non-branded only", "B": "Branded only", "NB>B": "Non-branded then Branded", "B>NB": "Branded then Non-branded" };
    function pathGroup(v, opt) {
      const toks = (String(v || "").match(/\b(nb|b|other)\b/gi) || []).map(t => {
        t = t.toUpperCase(); return t === "OTHER" ? (opt.other || "B") : t;
      });
      const seq = []; toks.forEach(t => { if (!seq.includes(t)) seq.push(t); });
      if (!seq.length) return "Unrecognized path";
      if (opt.mode === "side") return seq[0] === "NB" ? "Non-branded first" : "Branded first";
      return PATH_NAMES[seq.join(">")] || seq.join(" then ");
    }
    function buildModel(q, A) {
      const spec = q.viz || {};
      const cols = A.data.columns, rows = A.data.rows;
      const idx = {}; cols.forEach((c, i) => { if (!(c in idx)) idx[c] = i; });
      const step = Math.max(1, Math.ceil(rows.length / 3000));
      const sample = rows.filter((_, i) => i % step === 0);
      const types = {}, monthly = {};
      cols.forEach((c, i) => {
        const vals = sample.map(r => r[i]).filter(v => v !== "" && v != null);
        if (!vals.length) { types[c] = "text"; return; }
        const dates = vals.filter(v => /^\d{4}-\d{2}-\d{2}/.test(v)).length / vals.length;
        const nums = vals.filter(v => num(v) !== null).length / vals.length;
        types[c] = dates >= .9 ? "date" : nums >= .95 ? (isIdCol(c) ? "id" : "num") : "text";
        if (types[c] === "date") monthly[c] = vals.every(v => String(v).slice(5, 10) === "01-01") ? "year" : vals.every(v => String(v).slice(8, 10) === "01");
      });
      const derived = (spec.derived || []).filter(d => {
        const need = d.ratio ? [d.ratio[0], d.ratio[1]].flat() : d.concat ? d.concat : d.map ? [d.map.col] : d.path ? [d.path.col] : [];
        return d.name && need.length && need.every(c => c in idx) && !(d.name in idx);
      });
      const dmap = {}; derived.forEach(d => { dmap[d.name] = d; types[d.name] = d.ratio ? "num" : "text"; });
      const all = [...cols, ...derived.map(d => d.name)];
      const hidden = new Set(spec.hide || []);
      const sumOf = (r, x) => [x].flat().reduce((s, c) => s + (num(r[idx[c]]) || 0), 0);
      const get = (r, c) => {
        if (c in idx) return r[idx[c]];
        const d = dmap[c]; if (!d) return "";
        if (d.concat) return d.concat.map(x => r[idx[x]]).join(d.sep || " · ");
        if (d.map) return r[idx[d.map.col]] === d.map.eq ? d.map.then : d.map.else;
        if (d.path) return pathGroup(r[idx[d.path.col]], d.path);
        const b = sumOf(r, d.ratio[1]); return b ? sumOf(r, d.ratio[0]) / b * (d.scale || 1) : null;
      };
      const label = (c, v) => {
        if (v === null || v === undefined) return "";
        if (types[c] === "date" && /^\d{4}-\d{2}-\d{2}/.test(v)) return monthly[c] === "year" ? String(v).slice(0, 4) : monthly[c] ? String(v).slice(0, 7) : String(v).slice(0, 10);
        return String(v);
      };
      const baseNums = cols.filter(c => types[c] === "num");
      const agg = {};
      baseNums.forEach(c => { agg[c] = (spec.agg && spec.agg[c]) || (/pct|percent|rate|share|avg|days|ltv|cac|roas|_per_/i.test(c) ? "avg" : "sum"); });
      const kind = c => (spec.formats && spec.formats[c]) || (dmap[c] && dmap[c].fmt) ||
        (types[c] !== "num" ? "text" : /pct|percent|rate|share/i.test(c) ? "pct" : /sales|revenue|cost|spend|ltv|cac|price|aov/i.test(c) ? "money" : /days/i.test(c) ? "num1" : /roas/i.test(c) ? "num2" : "auto");
      const lab = c => (dmap[c] && dmap[c].label) || (spec.labels && spec.labels[c]) || humanize(c);
      const measures = all.filter(c => types[c] === "num" && !hidden.has(c));
      const distinct = c => { const s = new Set(); for (const r of sample) { s.add(get(r, c)); if (s.size > 60) break; } return s.size; };
      const groups = all.filter(c => types[c] !== "num" && !hidden.has(c) && distinct(c) > 1);
      if (!groups.length) groups.push(...all.filter(c => types[c] !== "num"));
      const xOpts = all.filter(c => types[c] === "date" || (types[c] !== "num" && distinct(c) <= 40 && distinct(c) > 1));
      const filter = spec.filter && spec.filter.col in idx ? spec.filter : null;

      const d = spec.defaults || {};
      const prefG = groups.find(c => types[c] !== "date" && /campaign|asin|category|product|target|line|pair|keyword/i.test(c)) || groups.find(c => types[c] !== "date") || groups[0] || "";
      const prefM = measures.find(c => agg[c] === "sum" && /ntb|new_to_brand|purchas|sales|spend|cost|users|customers/i.test(c)) || measures[0] || "";
      const group = groups.includes(d.group) ? d.group : prefG;
      let x = d.x !== undefined ? (xOpts.includes(d.x) ? d.x : "") : (all.find(c => types[c] === "date" && c !== group) || "");
      if (x === group) x = "";
      const defaults = { group, measure: measures.includes(d.measure) ? d.measure : prefM, x,
        chart: d.chart || (x ? "line" : "bar"), top: String(d.top || (x ? 6 : 15)), dir: d.dir || "desc", filterOn: true };

      const rowsFor = s => (filter && s.filterOn) ? rows.filter(r => r[idx[filter.col]] === filter.value) : rows;
      return { spec, cols, all, idx, types, dmap, hidden, get, label, baseNums, agg, kind, lab, measures, groups, xOpts, filter, defaults, rowsFor };
    }

    function groupRows(M, rows, keyFn) {
      const m = new Map();
      const bi = M.baseNums.map(c => [c, M.idx[c]]);
      for (const r of rows) {
        const k = keyFn(r);
        let g = m.get(k);
        if (!g) { g = { key: k, n: 0, sum: {}, cnt: {}, max: {} }; m.set(k, g); }
        g.n++;
        for (const [c, i] of bi) {
          const v = num(r[i]); if (v === null) continue;
          g.sum[c] = (g.sum[c] || 0) + v; g.cnt[c] = (g.cnt[c] || 0) + 1;
          if (!(c in g.max) || v > g.max[c]) g.max[c] = v;
        }
      }
      return m;
    }
    function val(M, g, c) {
      if (!g) return null;
      const d = M.dmap[c];
      if (d && d.ratio) {
        const s = x => [x].flat().reduce((a, k) => a + (g.sum[k] || 0), 0);
        const b = s(d.ratio[1]); return b ? s(d.ratio[0]) / b * (d.scale || 1) : null;
      }
      if (!(c in g.sum)) return null;
      const a = M.agg[c];
      return a === "avg" ? g.sum[c] / g.cnt[c] : a === "max" ? g.max[c] : g.sum[c];
    }

    function kpis(M, A, rows) {
      const s = A.settings;
      const tot = groupRows(M, rows, () => "all").get("all");
      const totWhere = w => groupRows(M, rows.filter(r => w.in.includes(M.get(r, w.col))), () => "all").get("all");
      let list = M.spec.kpis && M.spec.kpis.length ? M.spec.kpis : null;
      if (!list) {
        list = [{ label: "Rows", rows: true }];
        if (s.group) list.push({ label: M.lab(s.group) + " values", distinct: s.group });
        [s.measure, ...M.measures.filter(c => c !== s.measure)].filter(c => M.agg[c] === "sum").slice(0, 2).forEach(c => list.push({ label: M.lab(c), sum: c }));
      }
      const sumT = x => [x].flat().reduce((a, c) => a + (tot && tot.sum[c] || 0), 0);
      return list.map(k => {
        let v = null, kind = k.fmt;
        if (k.rows) { v = rows.length; kind = kind || "int"; }
        else if (k.sum) { v = sumT(k.sum); kind = kind || M.kind(k.sum); }
        else if (k.ratio && k.where) { const t = totWhere(k.where); const sw = x => [x].flat().reduce((a, c) => a + (t && t.sum[c] || 0), 0); const b = sw(k.ratio[1]); v = b ? sw(k.ratio[0]) / b * (k.scale || 1) : null; }
        else if (k.ratio) { const b = sumT(k.ratio[1]); v = b ? sumT(k.ratio[0]) / b * (k.scale || 1) : null; }
        else if (k.distinct) { const set = new Set(); for (const r of rows) { const x = M.get(r, k.distinct); if (x !== "" && x !== null) set.add(x); } v = set.size; kind = kind || "int"; }
        else if (k.wavg) { let a = 0, w = 0; for (const r of rows) { const x = num(M.get(r, k.wavg[0])), y = num(M.get(r, k.wavg[1])); if (x !== null && y) { a += x * y; w += y; } } v = w ? a / w : null; }
        else if (k.top) {
          const g = groupRows(M, rows, r => M.label(k.top[0], M.get(r, k.top[0])));
          let best = null; for (const x of g.values()) if (!best || (x.sum[k.top[1]] || 0) > (best.sum[k.top[1]] || 0)) best = x;
          v = best ? best.key : null; kind = "text";
        }
        return { label: k.label, value: v, text: fmtV(kind || "auto", v), note: k.note || "" };
      });
    }

    function chartModel(M, A, rows) {
      const s = A.settings, top = s.top === "all" ? Infinity : (+s.top || 15);
      const gl = r => M.label(s.group, M.get(r, s.group));
      // with an x axis, series can be chosen by a volume column (e.g. customers) instead of the charted measure
      const rk = s.x && M.spec.rankBy && M.baseNums.includes(M.spec.rankBy) ? M.spec.rankBy : s.measure;
      const totals = [...groupRows(M, rows, gl).values()].map(g => ({ key: g.key, v: val(M, g, rk) })).filter(t => t.v !== null && t.key !== "");
      if (chrono(M, s)) { const cmp = orderCmp(M, s); totals.sort((a, b) => cmp(a.key, b.key)); }
      else totals.sort((a, b) => s.dir === "asc" ? a.v - b.v : b.v - a.v);
      const keep = totals.slice(0, top);
      if (!s.x) return { mode: "rank", labels: keep.map(t => t.key), series: [{ name: M.lab(s.measure), data: keep.map(t => t.v) }], shown: keep.length, total: totals.length };
      const xl = r => M.label(s.x, M.get(r, s.x));
      const keepSet = new Set(keep.map(t => t.key));
      const sub = rows.filter(r => keepSet.has(gl(r)));
      const xs = [...new Set(sub.map(xl))].filter(v => v !== "").sort();
      const cells = groupRows(M, sub, r => gl(r) + "\u0001" + xl(r));
      return { mode: "x", labels: xs, series: keep.map(t => ({ name: t.key, data: xs.map(x => val(M, cells.get(t.key + "\u0001" + x), s.measure)) })), shown: keep.length, total: totals.length };
    }

    const LIGHT = ["#1f8a57", "#3d5bd9", "#a8641c", "#93479a", "#18808a", "#b33a55", "#7d7a1c", "#77705f"];
    function chartConfig(M, A, cm, forPdf) {
      const cs = getComputedStyle(document.documentElement);
      const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
      const ink = forPdf ? "#4a4a50" : tok("--gray", "#A5A5A3"), grid = forPdf ? "#e4e4df" : tok("--ana-grid", "#2a2a2a");
      const pal = forPdf ? LIGHT : [1, 2, 3, 4, 5, 6, 7, 8].map((i, j) => tok("--ana-c" + i, LIGHT[j]));
      const k = M.kind(A.settings.measure);
      const tick = v => k === "money" ? (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString() : fmtV(k, v);
      const font = { family: "Geist, system-ui, sans-serif", size: forPdf ? 19 : 12 };
      const cut = v => { const s = String(v); return s.length > 40 ? s.slice(0, 38) + "…" : s; };
      const anim = forPdf || matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 250 };
      if (cm.mode === "rank") return {
        type: "bar",
        data: { labels: cm.labels, datasets: [{ label: cm.series[0].name, data: cm.series[0].data, backgroundColor: pal[0], borderRadius: 3, maxBarThickness: forPdf ? 40 : 24 }] },
        options: { indexAxis: "y", responsive: !forPdf, maintainAspectRatio: false, animation: anim, devicePixelRatio: forPdf ? 1 : undefined,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => " " + tick(c.parsed.x) } } },
          scales: { x: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: ink, font, callback: tick } },
                    y: { grid: { display: false }, ticks: { color: ink, font, callback(v) { return cut(this.getLabelForValue(v)); } } } } },
      };
      const line = A.settings.chart !== "bar";
      return {
        type: line ? "line" : "bar",
        data: { labels: cm.labels, datasets: cm.series.map((s, i) => ({ label: cut(s.name), data: s.data, borderColor: pal[i % 8], backgroundColor: pal[i % 8],
          pointRadius: cm.labels.length > 45 ? 0 : (forPdf ? 4 : 2.5), borderWidth: forPdf ? 3 : 2, tension: .25, maxBarThickness: forPdf ? 36 : 22, borderRadius: line ? 0 : 2 })) },
        options: { responsive: !forPdf, maintainAspectRatio: false, animation: anim, devicePixelRatio: forPdf ? 1 : undefined, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom", labels: { color: ink, font, boxWidth: forPdf ? 18 : 10, boxHeight: forPdf ? 18 : 10 } },
                     tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${tick(c.parsed.y)}` } } },
          scales: { x: { grid: { display: false }, ticks: { color: ink, font, maxRotation: cm.labels.length > 12 ? 0 : 35, autoSkip: cm.labels.length > 12 } },
                    y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: ink, font, callback: tick } } } },
      };
    }

    // Grouped and raw tables as plain values (formatted only when displayed)
    function buildTables(M, A, rows) {
      const s = A.settings, gl = r => M.label(s.group, M.get(r, s.group));
      const ms = [s.measure, ...M.measures.filter(c => c !== s.measure)].filter(Boolean);
      const gs = [...groupRows(M, rows, gl).values()];
      const group = {
        head: [{ label: M.lab(s.group), kind: "text" }, { label: "Rows", kind: "int" }, ...ms.map(c => ({ label: M.lab(c), kind: M.kind(c) }))],
        rows: gs.map(g => [g.key, g.n, ...ms.map(c => val(M, g, c))]),
      };
      const rc = M.all;
      const raw = {
        head: rc.map(c => ({ label: M.dmap[c] ? M.lab(c) : c, kind: M.types[c] === "num" ? M.kind(c) : "text" })),
        rows: rows.map(r => rc.map(c => { const v = M.get(r, c); return M.types[c] === "num" ? num(v) : M.types[c] === "date" ? M.label(c, v) : v; })),
      };
      return { group, raw };
    }
    const fixedOrder = (M, s) => M.spec.groupOrder && M.spec.groupOrder.col === s.group && !s.x ? M.spec.groupOrder.values : null;
    const chrono = (M, s) => (!!M.spec.chronological || !!fixedOrder(M, s)) && !s.x;
    const orderCmp = (M, s) => { const o = fixedOrder(M, s); return o ? (a, b) => ((o.indexOf(a) + 1 || 99) - (o.indexOf(b) + 1 || 99)) : (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }); };
    const defSort = (M, s) => chrono(M, s) ? { i: 0, dir: "asc" } : { i: 2, dir: s.dir };
    function groupSorted(M, s, rows) {
      if (fixedOrder(M, s)) { const cmp = orderCmp(M, s); return rows.slice().sort((a, b) => cmp(a[0], b[0])); }
      const d = defSort(M, s); return sortRows(rows, d.i, d.dir);
    }
    function sortRows(rows, i, dir) {
      const m = dir === "asc" ? 1 : -1;
      return rows.slice().sort((a, b) => {
        const x = a[i], y = b[i];
        const xe = x === null || x === "" || x === undefined, ye = y === null || y === "" || y === undefined;
        if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * m;
      });
    }

  // ---- rendering
  function mount(el, q) {
    if (!el) return;
    let A = store[q.id];
    if (!A) { const saved = restore(q.id); if (saved && saved.text) { const r = load(saved.text, saved.source); if (!r.err) A = store[q.id] = r; } }
    if (A && A.chart) { A.chart.destroy(); A.chart = null; }
    A ? renderAnalysis(el, q, A) : renderInput(el, q);
  }

  function renderInput(el, q) {
    el.onclick = null;
    const hasEx = q.example && q.example.columns && q.example.rows && q.example.rows.length;
    el.innerHTML = `
      <div class="ana-drop" data-role="ana-drop">
        <div class="ana-row">
          <label class="btn btn-primary" for="anaFile">${ICON_UP}Upload CSV</label>
          <input type="file" id="anaFile" accept=".csv,.tsv,.txt,text/csv" hidden>
          <span class="muted">or drop the file here, or paste the rows below.</span>
        </div>
        <textarea class="textarea code" id="anaPaste" spellcheck="false" placeholder="Paste the output here, header row first. Cells copied from Excel or the AMC results table work too." aria-label="Paste query output"></textarea>
        <div class="ana-row">
          <button class="btn btn-secondary" type="button" id="anaGo">Analyze pasted rows</button>
          ${hasEx ? `<button class="btn btn-secondary" type="button" id="anaEx">Try it with the example output</button>` : ""}
          <span class="ana-err" id="anaErr" role="alert"></span>
        </div>
      </div>`;
    const err = m => { el.querySelector("#anaErr").textContent = m; };
    const take = (text, source) => {
      const r = load(text, source);
      if (r.err) return err(r.err);
      store[q.id] = r;
      if (source !== "example output") persist(q.id, r);
      renderAnalysis(el, q, r);
    };
    const readFile = f => {
      const rd = new FileReader();
      rd.onload = () => take(String(rd.result), f.name);
      rd.onerror = () => err("Couldn't read that file. Try downloading it from AMC again.");
      rd.readAsText(f);
    };
    el.querySelector("#anaFile").addEventListener("change", e => { const f = e.target.files[0]; if (f) readFile(f); });
    el.querySelector("#anaGo").addEventListener("click", () => take(el.querySelector("#anaPaste").value, "pasted rows"));
    const ex = el.querySelector("#anaEx");
    if (ex) ex.addEventListener("click", () => take(tableToText(q.example), "example output"));
    const dz = el.querySelector('[data-role="ana-drop"]');
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("is-over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-over"));
    dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("is-over"); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });
  }

  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(l)}</option>`;

  function tableHtml(T, which, A, M) {
    const srt = A.sort[which] || (which === "group" ? defSort(M, A.settings) : null);
    let rows = which === "group" && !A.sort[which] ? groupSorted(M, A.settings, T.rows) : srt ? sortRows(T.rows, srt.i, srt.dir) : T.rows;
    const cap = 300, total = rows.length;
    rows = rows.slice(0, cap);
    const head = T.head.map((h, i) => `<th class="sortable${h.kind === "text" ? " l" : ""}" data-sort="${i}" aria-sort="${srt && srt.i === i ? (srt.dir === "asc" ? "ascending" : "descending") : "none"}">${esc(h.label)}${srt && srt.i === i ? `<span class="arr">${srt.dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`).join("");
    const body = rows.map(r => `<tr>${r.map((v, i) => `<td class="${T.head[i].kind === "text" ? "l" : ""}">${esc(fmtV(T.head[i].kind, v))}</td>`).join("")}</tr>`).join("");
    return { html: `<table class="ana-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`, note: total > cap ? `Showing ${cap.toLocaleString()} of ${total.toLocaleString()} rows. Downloads include all of them.` : `${total.toLocaleString()} rows.` };
  }

  function srcLine(A, rows) {
    const nCols = A.data.columns.length;
    return `<span class="ana-src"><strong>${rows.length.toLocaleString()}</strong> ${rows.length === 1 ? "row" : "rows"}, ${nCols} columns, from ${esc(A.source)}${A.source === "example output" ? " (illustrative values)" : ""}</span>`;
  }
  const ACTIONS = `<span class="ana-actions">
      <button class="btn btn-secondary btn-small" type="button" data-a="pdf">${ICON_DL}PDF</button>
      <button class="btn btn-secondary btn-small" type="button" data-a="xlsx">${ICON_DL}Excel</button>
      <button class="btn btn-secondary btn-small" type="button" data-a="clear">Replace data</button></span>`;
  const kpiHtml = ks => `<div class="ana-kpis n${ks.length}">${ks.map(k => `<div class="ana-kpi"><span class="kl">${esc(k.label)}</span><span class="kv">${esc(k.text)}</span>${k.note ? `<span class="kn">${esc(k.note)}</span>` : ""}</div>`).join("")}</div>`;

  function renderAnalysis(el, q, A) {
    if (A.chart) { A.chart.destroy(); A.chart = null; }
    const M = buildModel(q, A);
    if (!A.settings) A.settings = { ...M.defaults };
    const s = A.settings;
    if (!M.groups.includes(s.group)) s.group = M.defaults.group;
    if (!M.measures.includes(s.measure)) s.measure = M.defaults.measure;
    if (s.x && (!M.xOpts.includes(s.x) || s.x === s.group)) s.x = "";
    const rows = M.rowsFor(s);
    const src = srcLine(A, rows);

    if (!M.measures.length) {
      el.innerHTML = `<div class="ana-bar">${src}${ACTIONS}</div><p class="ana-err">This output has no number columns to chart. Check that the header row was included.</p>`;
      wire(el, q, A, M, rows); return;
    }
    if (!M.groups.length) return renderSummary(el, q, A, M, rows, src);
    const ks = kpis(M, A, rows);
    const cm = chartModel(M, A, rows);
    const T = buildTables(M, A, rows);
    const tab = A.tab === "raw" ? "raw" : "group";
    const tbl = tableHtml(tab === "raw" ? T.raw : T.group, tab, A, M);
    const topOpts = s.x ? ["3", "5", "6", "8", "10"] : ["10", "15", "25", "50", "all"];
    if (!topOpts.includes(String(s.top))) topOpts.push(String(s.top));
    const h = cm.mode === "rank" ? Math.max(200, cm.labels.length * 28 + 50) : 340;
    const capt = `<strong>${esc(M.lab(s.measure))}</strong> by ${esc(M.lab(s.group))}${s.x ? ` across ${esc(M.lab(s.x))}` : ""}` +
      (cm.total > cm.shown ? (chrono(M, s) ? `, first ${cm.shown} of ${cm.total.toLocaleString()}` : `, ${s.dir === "asc" ? "lowest" : "top"} ${cm.shown} of ${cm.total.toLocaleString()}`) : "");

    el.innerHTML = `
      <div class="ana-bar">${src}${ACTIONS}</div>
      <div class="ana-controls">
        <label class="ana-ctl">Group by<select class="select" id="a-group">${M.groups.map(c => opt(c, M.lab(c), s.group)).join("")}</select></label>
        <label class="ana-ctl">Measure<select class="select" id="a-measure">${M.measures.map(c => opt(c, M.lab(c), s.measure)).join("")}</select></label>
        <label class="ana-ctl">Across<select class="select" id="a-x">${opt("", "Nothing (ranked bars)", s.x)}${M.xOpts.filter(c => c !== s.group).map(c => opt(c, M.lab(c), s.x)).join("")}</select></label>
        ${s.x ? `<span class="ana-ctl">Chart<span class="ana-seg"><button type="button" data-chart="line" aria-pressed="${s.chart !== "bar"}">Lines</button><button type="button" data-chart="bar" aria-pressed="${s.chart === "bar"}">Bars</button></span></span>` : ""}
        <label class="ana-ctl">${s.x ? "Series" : "Show"}<select class="select" id="a-top">${topOpts.map(v => opt(v, v === "all" ? "All" : (s.x ? v : "Top " + v), s.top)).join("")}</select></label>
        ${chrono(M, s) ? "" : `<span class="ana-ctl">Order<span class="ana-seg"><button type="button" data-dir="desc" aria-pressed="${s.dir !== "asc"}">Highest</button><button type="button" data-dir="asc" aria-pressed="${s.dir === "asc"}">Lowest</button></span></span>`}
        ${M.filter ? `<label class="ana-toggle"><input type="checkbox" id="a-filter"${s.filterOn ? " checked" : ""}>${esc(M.filter.label || ("Only " + M.filter.col + " = " + M.filter.value))}</label>` : ""}
      </div>
      ${kpiHtml(ks)}
      <div class="ana-chart">
        <div class="ana-chart-title">${capt}</div>
        <div class="ana-chart-wrap" style="height:${h}px"><canvas id="anaChart" role="img" aria-label="${esc(M.lab(s.measure) + " by " + M.lab(s.group))}"></canvas></div>
      </div>
      <div class="ana-tabs" role="tablist">
        <button type="button" role="tab" data-tab="group" aria-selected="${tab === "group"}">By ${esc(M.lab(s.group))}</button>
        <button type="button" role="tab" data-tab="raw" aria-selected="${tab === "raw"}">All rows</button>
      </div>
      <div class="ana-table">${tbl.html}</div>
      <p class="ana-note">${tbl.note} Click a column to sort.</p>`;
    wire(el, q, A, M, rows);
    const cv = el.querySelector("#anaChart");
    loadLib("chart").then(() => {
      if (!el.contains(cv) || store[q.id] !== A) return;
      if (A.chart) A.chart.destroy();
      A.chart = new Chart(cv, chartConfig(M, A, cm, false));
    }).catch(() => { const b = el.querySelector(".ana-chart-wrap"); if (b) b.innerHTML = `<p class="ana-err">The chart couldn't load. Check your connection and reload the page.</p>`; });
  }

  // Outputs with no text or date column (e.g. one summary row): headline numbers and a metric table, no chart
  function summaryTable(M, A, rows) {
    const T = buildTables(M, A, rows);
    const keep = M.all.map((c, i) => [c, i]).filter(([c]) => !M.hidden.has(c));
    if (rows.length !== 1) return { head: keep.map(([c, i]) => ({ ...T.raw.head[i], label: M.lab(c) })), rows: T.raw.rows.map(r => keep.map(([, i]) => r[i])) };
    return { head: [{ label: "Metric", kind: "text" }, { label: "Value", kind: "text" }],
      rows: keep.map(([c, i]) => [M.lab(c), fmtV(T.raw.head[i].kind, T.raw.rows[0][i])]) };
  }
  function renderSummary(el, q, A, M, rows, src) {
    const ks = kpis(M, A, rows), T = summaryTable(M, A, rows);
    const head = T.head.map((h, i) => `<th class="${h.kind === "text" && !(rows.length === 1 && i === 1) ? "l" : ""}">${esc(h.label)}</th>`).join("");
    const body = T.rows.map(r => `<tr>${r.map((v, i) => `<td class="${T.head[i].kind === "text" && !(rows.length === 1 && i === 1) ? "l" : ""}">${esc(rows.length === 1 ? v : fmtV(T.head[i].kind, v))}</td>`).join("")}</tr>`).join("");
    el.innerHTML = `
      <div class="ana-bar">${src}${ACTIONS}</div>
      ${kpiHtml(ks)}
      <div class="ana-table"><table class="ana-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="ana-note">${rows.length === 1 ? "This query returns one summary row, so there's no chart." : rows.length.toLocaleString() + " rows. There's no text or date column to group or chart by."}</p>`;
    wire(el, q, A, M, rows);
  }

  function wire(el, q, A, M, rows) {
    const rerender = () => renderAnalysis(el, q, A);
    const s = A.settings;
    const on = (id, fn) => { const n = el.querySelector(id); if (n) n.addEventListener("change", fn); };
    on("#a-group", e => { s.group = e.target.value; if (s.x === s.group) s.x = ""; A.sort.group = null; rerender(); });
    on("#a-measure", e => { s.measure = e.target.value; A.sort.group = null; rerender(); });
    on("#a-x", e => { s.x = e.target.value; s.top = s.x ? "6" : "15"; s.chart = s.x ? (s.chart || "line") : s.chart; rerender(); });
    on("#a-top", e => { s.top = e.target.value; rerender(); });
    on("#a-filter", e => { s.filterOn = e.target.checked; rerender(); });
    el.onclick = async e => {
      const b = e.target.closest("[data-a],[data-chart],[data-dir],[data-tab],th[data-sort]");
      if (!b || !el.contains(b)) return;
      if (b.dataset.chart) { s.chart = b.dataset.chart; return rerender(); }
      if (b.dataset.dir) { s.dir = b.dataset.dir; A.sort.group = null; return rerender(); }
      if (b.dataset.tab) { A.tab = b.dataset.tab; return rerender(); }
      if (b.dataset.sort !== undefined) {
        const which = A.tab === "raw" ? "raw" : "group", i = +b.dataset.sort;
        const cur = A.sort[which] || (which === "group" ? defSort(M, s) : null);
        A.sort[which] = { i, dir: cur && cur.i === i && cur.dir === "desc" ? "asc" : "desc" };
        return rerender();
      }
      const a = b.dataset.a;
      if (a === "clear") { if (A.chart) A.chart.destroy(); delete store[q.id]; forget(q.id); renderInput(el, q); return; }
      if (a === "pdf" || a === "xlsx") {
        const label = b.innerHTML; b.disabled = true; b.textContent = "Preparing…";
        try { await (a === "pdf" ? exportPdf : exportXlsx)(q, A, M, rows); }
        catch (err) { console.error(err); toast(err && err.message && /load/i.test(err.message) ? "The export tools couldn't load. Check your connection." : "Couldn't build the file.", true); }
        finally { b.disabled = false; b.innerHTML = label; }
      }
    };
  }

  // ---- exports
  const slugName = (q, ext) => String(q.title || "amc-query").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + new Date().toISOString().slice(0, 10) + "." + ext;
  function saveFile(filename, data) {
    Hub.download(filename, data instanceof Blob ? data : new Blob([data]));
    toast("Downloaded " + filename);
  }

    async function exportXlsx(q, A, M, rows) {
      await loadLib("xlsx");
      const s = A.settings, T = buildTables(M, A, rows), ks = kpis(M, A, rows), flat = !M.groups.length;
      const wb = XLSX.utils.book_new();
      const sheetName = n => n.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31);
      const widths = aoa => aoa[0].map((_, i) => ({ wch: Math.min(48, Math.max(8, ...aoa.slice(0, 200).map(r => String(r[i] ?? "").length + 2))) }));
      const summary = [[q.title], ["Generated", new Date().toLocaleString()], ["Source", A.source], ["Rows", rows.length],
        ...(flat ? [] : [["Grouped by", M.lab(s.group)], ["Measure", M.lab(s.measure)]]), ...(M.filter && s.filterOn ? [["Filter", M.filter.label || `${M.filter.col} = ${M.filter.value}`]] : []),
        [], ["Metric", "Value"], ...ks.map(k => [k.label, typeof k.value === "number" ? round(k.value) : k.text])];
      const ws1 = XLSX.utils.aoa_to_sheet(summary); ws1["!cols"] = [{ wch: 30 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Summary");
      if (!flat) {
        const gAoa = [T.group.head.map(h => h.label), ...groupSorted(M, s, T.group.rows).map(r => r.map(round))];
        const ws2 = XLSX.utils.aoa_to_sheet(gAoa); ws2["!cols"] = widths(gAoa);
        XLSX.utils.book_append_sheet(wb, ws2, sheetName("By " + M.lab(s.group)));
      }
      if (s.x && !flat) {
        const cm = chartModel(M, A, rows);
        const cAoa = [[M.lab(s.x), ...cm.series.map(x => x.name)], ...cm.labels.map((l, i) => [l, ...cm.series.map(x => round(x.data[i]))])];
        const ws3 = XLSX.utils.aoa_to_sheet(cAoa); ws3["!cols"] = widths(cAoa);
        XLSX.utils.book_append_sheet(wb, ws3, "Chart data");
      }
      const rAoa = [T.raw.head.map(h => h.label), ...T.raw.rows.map(r => r.map(round))];
      const ws4 = XLSX.utils.aoa_to_sheet(rAoa); ws4["!cols"] = widths(rAoa);
      XLSX.utils.book_append_sheet(wb, ws4, "Data");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveFile(slugName(q, "xlsx"), new Blob([out]));
    }

    async function exportPdf(q, A, M, rows) {
      await loadLib("chart"); await loadLib("jspdf"); await loadLib("autotable");
      const s = A.settings, ks = kpis(M, A, rows), flat = !M.groups.length;
      const cm = flat ? null : chartModel(M, A, rows), T = buildTables(M, A, rows);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), mx = 40;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(17, 17, 18);
      doc.text(String(q.title), mx, 48);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 110, 116);
      const meta = `${typeLabel(q)}  ·  ${rows.length.toLocaleString()} rows from ${A.source}${M.filter && s.filterOn ? "  ·  " + (M.filter.label || "") : ""}  ·  Generated ${new Date().toLocaleDateString()}`;
      doc.text(meta, mx, 64, { maxWidth: W - 2 * mx });
      let y = 84;
      const shown = ks.slice(0, 6), bw = (W - 2 * mx) / Math.max(1, shown.length);
      shown.forEach((k, i) => {
        const x = mx + i * bw;
        doc.setDrawColor(222, 222, 216); doc.setFillColor(248, 248, 245); doc.roundedRect(x, y, bw - 8, 52, 3, 3, "FD");
        doc.setFontSize(7); doc.setTextColor(110, 110, 116); doc.text(k.label.toUpperCase(), x + 9, y + 15, { maxWidth: bw - 24 });
        doc.setFontSize(15); doc.setTextColor(17, 17, 18); doc.text(k.text, x + 9, y + 39, { maxWidth: bw - 24 });
      });
      y += 72;
      if (flat) {
        const ST = summaryTable(M, A, rows), one = rows.length === 1;
        const cs = {}; ST.head.forEach((h, i) => { if (h.kind !== "text" || (one && i === 1)) cs[i] = { halign: "right" }; });
        doc.autoTable({ startY: y + 6, head: [ST.head.map(h => h.label)], margin: { left: mx, right: one ? W / 2 : mx },
          body: ST.rows.slice(0, 400).map(r => r.map((v, i) => one ? v : fmtV(ST.head[i].kind, v))),
          styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 30, 32], lineColor: [228, 228, 222], lineWidth: .4 },
          headStyles: { fillColor: [17, 17, 18], textColor: 255, fontStyle: "bold" }, alternateRowStyles: { fillColor: [247, 247, 244] }, columnStyles: cs });
        const pgs = doc.getNumberOfPages();
        for (let p = 1; p <= pgs; p++) { doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150); doc.text(`PLTFRM Team Tools, AMC Queries, page ${p} of ${pgs}`, W - mx, H - 18, { align: "right" }); }
        return saveFile(slugName(q, "pdf"), doc.output("arraybuffer"));
      }
      const title = `${M.lab(s.measure)} by ${M.lab(s.group)}${s.x ? " across " + M.lab(s.x) : ""}${cm.total > cm.shown ? ` (${s.dir === "asc" ? "lowest" : "top"} ${cm.shown} of ${cm.total})` : ""}`;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(17, 17, 18); doc.text(title, mx, y); y += 8;
      const holder = document.createElement("div"); holder.className = "offscreen";
      const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 720; holder.appendChild(cv); document.body.appendChild(holder);
      const cfg = chartConfig(M, A, cm, true);
      cfg.plugins = [{ id: "paper", beforeDraw: c => { const x = c.ctx; x.save(); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.restore(); } }];
      const ch = new Chart(cv, cfg); ch.draw();
      const img = cv.toDataURL("image/jpeg", 0.92); ch.destroy(); holder.remove();
      const cw = W - 2 * mx, chh = Math.min(cw * 720 / 1600, H - y - 36);
      doc.addImage(img, "JPEG", mx, y, chh * 1600 / 720, chh);
      // grouped table on the next page; the widest measure set lives in the Excel file
      doc.addPage();
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(17, 17, 18); doc.text(`By ${M.lab(s.group)}`, mx, 44);
      const maxCols = 9, head = T.group.head.slice(0, maxCols);
      const body = groupSorted(M, s, T.group.rows).slice(0, 400).map(r => r.slice(0, maxCols).map((v, i) => fmtV(head[i].kind, v)));
      const colStyles = {}; head.forEach((h, i) => { if (h.kind !== "text") colStyles[i] = { halign: "right" }; });
      doc.autoTable({ startY: 56, head: [head.map(h => h.label)], body, margin: { left: mx, right: mx },
        styles: { fontSize: 7.5, cellPadding: 3.5, textColor: [30, 30, 32], lineColor: [228, 228, 222], lineWidth: .4 },
        headStyles: { fillColor: [17, 17, 18], textColor: 255, fontStyle: "bold" }, alternateRowStyles: { fillColor: [247, 247, 244] }, columnStyles: colStyles });
      const notes = [];
      if (T.group.rows.length > 400) notes.push(`Showing 400 of ${T.group.rows.length.toLocaleString()} groups.`);
      if (T.group.head.length > maxCols) notes.push("More columns are in the Excel download.");
      if (notes.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 110, 116); doc.text(notes.join(" "), mx, Math.min(doc.lastAutoTable.finalY + 16, H - 20)); }
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150); doc.text(`PLTFRM Team Tools, AMC Queries, page ${p} of ${pages}`, W - mx, H - 18, { align: "right" }); }
      saveFile(slugName(q, "pdf"), doc.output("arraybuffer"));
    }


  Hub.Analyzer = { mount: mount, parseTable: parseTable };
})();
