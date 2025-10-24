/* --- Globals --- */
let natoData = [];
let yearMap = new Map();
let commitmentData = new Map();
let commitYears = [];

// Vega View Instances
let growthView = null;
let commitmentView = null;
let commitmentPersonnelView = null; // <-- new
let comparisonPersonnelView = null;
// Add view instance variables for other static charts if they become interactive later
// let comparisonNukesView = null;

// State Variables
let showFoundersFilter = false;
let activeCommitmentSubView = 'spending';
let growthPlaying = false;
let growthTimer = null;

// DOM Element References
const historyContentEl = document.getElementById('historyContent');
// Growth
const growthYearSlider = document.getElementById('growthYearSlider');
const growthYearLabel = document.getElementById('growthYearLabel');
const playPauseGrowthBtn = document.getElementById('playPauseGrowth');
const toggleFoundersBtn = document.getElementById('toggleFounders');
const milestoneTextEl = document.getElementById('milestoneText');
const memberListGrowthEl = document.getElementById('memberListGrowth');
// Commitment
const commitYearSlider = document.getElementById('commitYearSlider');
const commitYearLabel = document.getElementById('commitYearLabel');
const commitmentSidebarEl = document.getElementById('commitmentSidebar');
// Comparison
const comparisonYearSlider = document.getElementById('comparisonPersonnelYearSlider');
const comparisonYearLabel = document.getElementById('comparisonPersonnelYearLabel');
const comparisonAnnotationEl = document.getElementById('comparisonPersonnelAnnotations');

/* --- Utils --- */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function normalizeCountryName(name) { if (!name) return ''; const n = String(name).trim(); const map = { "United States of America": "United States", "USA": "United States", "US": "United States", "Czech Republic": "Czechia", "Slovak Republic": "Slovakia", "Slovakia": "Slovakia", "Republic of North Macedonia": "North Macedonia", "FYR Macedonia": "North Macedonia", "Macedonia": "North Macedonia", "United Kingdom of Great Britain and Northern Ireland": "United Kingdom", "UK": "United Kingdom", "Great Britain": "United Kingdom", "Ireland": "Ireland" }; return map[n] || n; }
function codeToFlagEmoji(code) { if (!code || String(code).length !== 2) return ''; const base = 0x1F1E6; return Array.from(String(code).toUpperCase()).map(ch => String.fromCodePoint(base + ch.charCodeAt(0) - 65)).join(''); }
function countryFlag(name) { if (!name) return ''; const map = { "United States":"🇺🇸","United States of America":"🇺🇸","USA":"🇺🇸", "United Kingdom":"🇬🇧","UK":"🇬🇧","Great Britain":"🇬🇧", "Canada":"🇨🇦","France":"🇫🇷","Germany":"🇩🇪","West Germany":"🇩🇪", "Italy":"🇮🇹","Spain":"🇪🇸","Portugal":"🇵🇹", "Norway":"🇳🇴","Denmark":"🇩🇰", "Netherlands":"🇳🇱","Belgium":"🇧🇪","Luxembourg":"🇱🇺","Greece":"🇬🇷","Iceland":"🇮🇸", "Turkey":"🇹🇷","Poland":"🇵🇱","Hungary":"🇭🇺","Czechia":"🇨🇿","Slovakia":"🇸🇰", "Slovenia":"🇸🇮","Romania":"🇷🇴", "Bulgaria":"🇧🇬","Estonia":"🇪🇪","Latvia":"🇱🇻","Lithuania":"🇱🇹", "Albania":"🇦🇱","Croatia":"🇭🇷","Montenegro":"🇲🇪", "North Macedonia":"🇲🇰","Finland":"🇫🇮","Sweden":"🇸🇪" }; const key = String(name).trim(); if (map[key]) return map[key]; const m = key.match(/\(([A-Za-z]{2})\)$/); if (m) return codeToFlagEmoji(m[1]); return ''; }
function topoNameFor(name) { if (!name) return ''; const map = { "United States": "United States of America", "USA": "United States of America", "United States of America": "United States of America", "Czechia": "Czech Republic" }; return map[name] || name; }
// Global helper needed by sidebars
window.nationsJoinedUpTo = function(year) { const y = Number(year); const out = []; yearMap.forEach((countries, yr) => { if (yr <= y) out.push(...countries); }); return out.slice().sort(); };

/* --- Data Loaders --- */
async function loadNatoCsv() { 
  try {
    const res = await fetch('NATO.csv'); if (!res.ok) throw new Error('NATO.csv fetch failed');
    const text = await res.text(); const lines = text.trim().split(/\r?\n/).filter(Boolean); if (lines.length < 1) { natoData = []; yearMap = new Map(); return; }
    function p(l) { const o=[]; let c='', iQ=false; for (let i=0; i<l.length; i++) { const h=l[i]; if (h==='"'){if(iQ&&l[i+1]==='"'){c+='"';i++;}else{iQ=!iQ;}}else if(h===','&&!iQ){o.push(c);c='';}else{c+=h;}} o.push(c); return o.map(s=>s.trim().replace(/^"|"$/g,'')); }
    const hp=p(lines.shift()), hl=hp.map(h=>String(h||'').toLowerCase());
    let cI=hl.findIndex(h=>h.includes('country')); if(cI===-1)cI=hl.findIndex(h=>h.includes('name'));
    const yK=['year joined','yearjoined','year','year_joined','joined','join year']; let yI=-1;
    for(const k of yK){yI=hl.findIndex(h=>h.includes(k));if(yI!==-1)break;}
    if(yI===-1)yI=hl.findIndex(h=>/year/.test(h)||/\b(19|20)\d{2}\b/.test(h));

   // Normalize country names here so they match other datasets (e.g. NATOSpending.csv)
   natoData=lines.map(l=>{const cs=p(l); const rawCountry=(cs[cI]||'').trim(); const cy=normalizeCountryName(rawCountry); const yRw=(yI>=0?(cs[yI]||'').trim():''); const y=yRw===''?null:Number(yRw); return {Country:cy, Year:Number.isFinite(y)?y:null};}).filter(d=>d.Country);

     yearMap=new Map(); natoData.forEach(d=>{if(d.Year==null)return; if(!yearMap.has(d.Year))yearMap.set(d.Year,[]); yearMap.get(d.Year).push(d.Country);}); console.log("NATO.csv loaded."); } catch (err) { console.error('Error loading NATO.csv:', err); natoData = []; yearMap = new Map(); } }
async function loadCommitmentCsv() { try { const res = await fetch('NATOSpending.csv'); if (!res.ok) throw new Error('NATOSpending.csv fetch failed'); const text = await res.text(); const lines = text.trim().split(/\r?\n/).filter(Boolean); if (lines.length < 2) return; const header = lines.shift().split(',').map(h=>h.trim()); const yearCols = header.slice(2).map(h=>Number(String(h).replace(/[^0-9]/g,''))); commitmentData = new Map(); function pV(r){ if(r==null)return null; const s=String(r).trim(); if(s==='')return null; const cl=s.replace(/[%\u2009\s]/g,'').replace(/,/g,''); const n=Number(cl); if(Number.isFinite(n))return n; const m=cl.match(/-?\d+(\.\d+)?/); return m?Number(m[0]):null; } lines.forEach(l=>{const cs=l.split(',').map(c=>c.trim().replace(/^"|"$/g,'')); const ind=cs[0]; const rC=(cs[1]||'').trim(); const cy=normalizeCountryName(rC); if(ind!=='Share_of_GDP')return; yearCols.forEach((yr,i)=>{if(!yr)return; const raw=cs[i+2]; const val=pV(raw); if(!commitmentData.has(yr))commitmentData.set(yr, new Map()); commitmentData.get(yr).set(cy,Number.isFinite(val)?val:null);});}); commitYears=Array.from(commitmentData.keys()).sort((a,b)=>a-b); if(commitYearSlider&&commitYears.length){commitYearSlider.min=String(commitYears[0]); commitYearSlider.max=String(commitYears[commitYears.length-1]); const cV=commitYearSlider.value; if(commitYearLabel)commitYearLabel.textContent=cV; if(Number(cV)<commitYears[0])commitYearSlider.value=commitYears[0]; if(Number(cV)>commitYears[commitYears.length-1])commitYearSlider.value=commitYears[commitYears.length-1];} console.log("NATOSpending.csv loaded."); } catch (err) { console.warn('loadCommitmentCsv error:', err); commitmentData = new Map(); commitYears = []; } }

/* --- Spec Builders --- */
function buildCommitmentSpendingSpec() { 
    const minYear = commitYears.length > 0 ? commitYears[0] : 2014; const maxYear = commitYears.length > 0 ? commitYears[commitYears.length - 1] : 2024; let overallMaxVal = 0; commitmentData.forEach(yearMap => { yearMap.forEach(value => { if (value != null && value > overallMaxVal) { overallMaxVal = value; } }); }); const maxDomain = Math.max(4, Math.ceil(overallMaxVal)); const colors = ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"];
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": "container",
        "height": "container",
        "autosize": { "type": "fit", "contains": "padding" },
        "background": null,
        "params": [ { "name": "commit_year", "value": minYear }, { "name": "hover_country", "value": "" } ],
        "title": { "text": {"expr": "'Defence Spending — Share of GDP (' + commit_year + ')'"}, "subtitle": "Countries with no data shown in gray.", "anchor": "start", "fontSize": 16, "subtitleFontSize": 12 },
        "projection": { "type": "equalEarth", "center": [-100, 45], "scale": 250, "translate": [200, 150] },

        // expose top-level datasets so JS can update them
        "datasets": {
            "spendingData": [],
            "incidentData": []
        },

        "data": { "url": "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", "format": { "type": "topojson", "feature": "countries" } },
        "transform": [ { "lookup": "properties.name", "from": { "data": { "name": "spendingData" }, "key": "country", "fields": ["value"] }}, { "calculate": "datum.value != null ? ('' + format(datum.value, '.2f') + '%') : 'No data'", "as": "tooltipValue" } ],
        "layer": [
            { "transform": [ { "filter": "datum.value == null" } ], "mark": { "type": "geoshape", "fill": "#dcdcdc", "stroke": "#bfc7cc", "strokeWidth": 0.35 } },
            { "transform": [ { "filter": "datum.value != null" } ], "mark": { "type": "geoshape", "stroke": "#757575", "strokeWidth": 0.5 }, "encoding": { "color": { "field": "value", "type": "quantitative", "scale": { "domain": [0, maxDomain], "range": colors, "nice": false }, "legend": { "title": "% GDP", "orient": "bottom-left", "direction": "horizontal", "gradientLength": 200, "format": ".1f" } }, "tooltip": [ { "field": "properties.name", "type": "nominal", "title": "Country" }, { "field": "tooltipValue", "type": "nominal", "title": "Defence % GDP" } ] } },
            { "mark": { "type": "geoshape", "fill": "transparent", "stroke": "#ffb74d", "strokeWidth": 2 }, "encoding": { "opacity": { "condition": { "test": "hover_country && datum.properties && datum.properties.name == hover_country", "value": 1 }, "value": 0 }, "tooltip": [ { "field": "properties.name", "type": "nominal", "title": "Country" }, { "field": "tooltipValue", "type": "nominal", "title": "Defense Spending (% of GDP)" } ] } },

            // INCIDENT HIGHLIGHT LAYER: outline countries marked in incidentData
            {
              "transform": [
                {
                  "lookup": "properties.name",
                  "from": {
                    "data": { "name": "incidentData" },
                    "key": "country",
                    "fields": ["incident"]
                  }
                },
                { "filter": "datum.incident == true" }
              ],
              "mark": { "type": "geoshape", "fill": "transparent", "stroke": "#d9534f", "strokeWidth": 2.5 },
              "encoding": {
                "tooltip": [
                  { "field": "properties.name", "type": "nominal", "title": "Country" },
                  { "value": "Affected by major incident", "type": "nominal", "title": "Note" }
                ]
              }
            }
        ]
    };
}
function buildCommitmentSpec(valuesForYear = [], maxDomain = 4, year = null, minYear = 2014, maxYear = 2024) {
  const colors = ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"];
  return {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "width": "container",
    "height": "container",
    "autosize": { "type": "fit", "contains": "padding" },
    "background": null,
    "params": [
      { "name": "commit_year", "value": minYear },
      { "name": "hover_country", "value": "" }
    ],
    "title": {
      "text": {"expr": "'Defence Commitment Personnel (k) — ' + commit_year"},
      "anchor": "start",
      "fontSize": 16
    },
    "projection": { "type": "equalEarth", "scale": 250, "center": [-100, 45], "translate": [280, 300] },
    "data": {
      "url": "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
      "format": { "type": "topojson", "feature": "countries" }
    },
    "transform": [
      {
        "lookup": "properties.name",
        "from": { "data": { "name": "commitmentData" }, "key": "country", "fields": ["value"] }
      },
      { "calculate": "datum.value != null ? format(datum.value, ',') : 'No data'", "as": "tooltipValue" }
    ],
    "layer": [
      {
        "transform": [ { "filter": "datum.value == null" } ],
        "mark": { "type": "geoshape", "fill": "#dcdcdc", "stroke": "#bfc7cc", "strokeWidth": 0.35 }
      },
      {
        "transform": [ { "filter": "datum.value != null" } ],
        "mark": { "type": "geoshape", "stroke": "#757575", "strokeWidth": 0.5 },
        "encoding": {
          "color": {
            "field": "value",
            "type": "quantitative",
            "scale": { "domain": [0, maxDomain], "range": colors, "nice": false },
            "legend": { "title": "Personnel (k)", "orient": "bottom-left", "direction": "horizontal", "gradientLength": 200 }
          },
          "tooltip": [
            { "field": "properties.name", "type": "nominal", "title": "Country" },
            { "field": "tooltipValue", "type": "nominal", "title": "Personnel (k)" }
          ]
        }
      },
      {
        "mark": { "type": "geoshape", "fill": "transparent", "stroke": "#ffb74d", "strokeWidth": 2 },
        "encoding": {
          "opacity": { "condition": { "test": "hover_country && datum.properties && datum.properties.name == hover_country", "value": 1 }, "value": 0 },
          "tooltip": [
            { "field": "properties.name", "type": "nominal", "title": "Country" },
            { "field": "tooltipValue", "type": "nominal", "title": "Personnel (k)" }
          ]
        }
      }
    ],
    "datasets": { "commitmentData": [] }
  };
}

// --- NEW: Render personnel bar chart for Commitment (Top 10 + Sum Others) ---
async function parseCsvText(text) {
	// simple robust CSV parser that supports quoted fields with commas
	const lines = text.trim().split(/\r?\n/).filter(Boolean);
	function parseLine(line) {
		const out = []; let cur = '', inQ = false;
		for (let i=0;i<line.length;i++){
			const ch = line[i];
			if (ch === '"') {
				if (inQ && line[i+1] === '"') { cur += '"'; i++; }
				else { inQ = !inQ; }
			} else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
			else { cur += ch; }
		}
		out.push(cur);
		return out.map(s => s.trim().replace(/^"|"$/g,''));
	}
	const header = parseLine(lines.shift());
	const rows = lines.map(l => {
		const cols = parseLine(l);
		const obj = {};
		for (let i=0;i<header.length;i++) obj[header[i]] = cols[i] !== undefined ? cols[i] : '';
		return obj;
	});
	return { header, rows };
}

async function renderCommitmentPersonnelChart(year) {
	// finalize previous view if present
	try { if (commitmentPersonnelView && typeof commitmentPersonnelView.finalize === 'function') commitmentPersonnelView.finalize(); } catch(e){}

	try {
		const res = await fetch('NatoMilitaryPersonnel.csv');
		if (!res.ok) throw new Error('Failed to fetch NatoMilitaryPersonnel.csv: ' + res.status);
		const text = await res.text();
		const parsed = await parseCsvText(text);
		const hdr = parsed.header;
		const rows = parsed.rows;

		// find the column header that matches the requested year (allow numeric or string form)
		const yearKey = hdr.find(h => String(h).replace(/[^0-9]/g,'') === String(year)) || String(year);
		// filter indicator rows that contain 'Personnel' (case-insensitive)
		const personnelRows = rows.filter(r => {
			const ind = r['Indicator'] || r['indicator'] || r.Indicator;
			return ind && /personnel/i.test(ind);
		});

		// build array of {Country, Value} excluding aggregate rows like "NATO Total"
		const data = personnelRows.map(r => {
			const countryRaw = (r['Country'] || r.Country || '').trim();
			const country = normalizeCountryName(countryRaw) || countryRaw;
			const rawVal = r[yearKey] || r[String(year)] || '';
			const v = rawVal === '' ? null : Number(String(rawVal).replace(/,/g,'').trim());
			return { Country: country, Value: Number.isFinite(v) ? v : null };
		}).filter(d => d.Country && !/^nato\s+/i.test(String(d.Country))); // drop aggregate rows that start with "NATO "

		// sort descending by Value, nulls go last
		data.sort((a,b) => {
			if (a.Value == null && b.Value == null) return a.Country.localeCompare(b.Country);
			if (a.Value == null) return 1;
			if (b.Value == null) return -1;
			return b.Value - a.Value;
		});

		// top 10 and sum others
		const topN = 10;
		const top = data.slice(0, topN);
		const others = data.slice(topN);
		const othersSum = others.reduce((s,d) => s + (Number.isFinite(d.Value) ? d.Value : 0), 0);
		const values = top.map(d => ({ Display: d.Country, Value: d.Value }));
		if (others.length) values.push({ Display: 'Sum Others', Value: othersSum });

		// build ordered domain for y (largest to smallest, Sum Others last)
		const orderLabels = values.map(v => v.Display);

		// descriptive title for the chart
		const chartTitle = `Top 10 Militaries of NATO in Number of Personnel (${year})`;

		// build Vega-Lite spec
		const spec = {
			"title": { "text": chartTitle, "anchor": "start", "fontSize": 14 },
			"$schema": "https://vega.github.io/schema/vega-lite/v5.json",
			"width": "container",
			"height": 220,
			"autosize": { "type": "fit", "contains": "padding" },
			"background": null,
			"data": { "values": values },
			"mark": { "type": "bar", "tooltip": true, "cornerRadius": 4 },
			"encoding": {
				"y": { "field": "Display", "type": "nominal", "sort": orderLabels, "title": "" },
				"x": { "field": "Value", "type": "quantitative", "title": "Personnel (thousands)", "axis": { "format": ",.1f" } },
				"color": {
					"condition": { "test": "datum.Display == 'Sum Others'", "value": "#b0b0b0" },
					"value": "#1f77b4"
				},
				"tooltip": [
					{ "field": "Display", "type": "nominal", "title": "Country / Group" },
					{ "field": "Value", "type": "quantitative", "title": "Personnel (thousands)", "format": ",.1f" }
				]
			},
			"config": { "view": { "stroke": "transparent" }, "axis": { "domain": false, "tickColor": "#ccc" } }
		};

		// embed and store view
		const result = await vegaEmbed('#commitmentPersonnelVis', spec, { actions: false, renderer: 'svg' });
		commitmentPersonnelView = result.view;
		return commitmentPersonnelView;
	} catch (err) {
		console.error('Failed to render commitment personnel chart:', err);
		const el = document.getElementById('commitmentPersonnelVis');
		if (el) el.innerHTML = `<div style="padding:12px;color:#b00020">Error loading personnel chart: ${escapeHtml(err.message)}</div>`;
		commitmentPersonnelView = null;
		return null;
	}
}

/* --- NEW: resolve commitment value for possible country name variants --- */
function resolveCommitmentValue(mapForYear, country) {
	// Try as-is
	if (!mapForYear) return null;
	if (mapForYear.has(country)) return mapForYear.get(country);
	// Try normalized name (matches loader normalization)
	try {
		const norm = typeof normalizeCountryName === 'function' ? normalizeCountryName(country) : country;
		if (mapForYear.has(norm)) return mapForYear.get(norm);
	} catch (e) { /* ignore */ }
	// Try topo name variant
	try {
		const topo = typeof topoNameFor === 'function' ? topoNameFor(country) : country;
		if (mapForYear.has(topo)) return mapForYear.get(topo);
	} catch (e) { /* ignore */ }
	// Also try the reverse (some sheets use "United States of America")
	try {
		const alt = country.replace(/\s*\(.*\)$/, '').trim();
		if (mapForYear.has(alt)) return mapForYear.get(alt);
	} catch (e) { /* ignore */ }
	return null;
}

/* --- Helpers for commitment value lookup (handle naming mismatches) --- */
function getCommitmentValue(mapForYear, country) {
	// Try several variants so "United States", "United States of America", "USA" etc. match
	if (!mapForYear || !country) return null;
	const candidates = [
		country,
		normalizeCountryName(country),
		topoNameFor(country),
		topoNameFor(normalizeCountryName(country))
	];
	for (const k of candidates) {
		if (k == null) continue;
		if (mapForYear.has(k)) return mapForYear.get(k);
	}
	return null;
}

/* --- Helper: robust lookup for commitment values by country name variants --- */
function lookupCommitmentValue(mapObj, country) {
	// mapObj: Map(year) -> Map(country -> value)
	if (!mapObj || !country) return null;
	const tries = [
		country,
		normalizeCountryName(country),
		topoNameFor(country),
		"United States",
		"United States of America",
		"USA",
		"US"
	];
	for (const k of tries) {
		if (k == null) continue;
		if (mapObj.has(k)) return mapObj.get(k);
	}
	return null;
}

/* --- NEW: Major incidents metadata and helpers --- */
const MAJOR_INCIDENTS = [
  { year: 2001, title: "9/11 Attacks", desc: "Global counter‑terror operations; increased US/UK posture.", countries: ["United States", "United Kingdom", "Canada"] },
  { year: 2014, title: "Crimea annexation (2014)", desc: "Regional security focus; eastern Allies bolster deterrence.", countries: ["Poland","Estonia","Latvia","Lithuania","Romania"] },
  { year: 2022, title: "Russia invades Ukraine (2022)", desc: "Major regional rearmament and increased commitments across Europe.", countries: ["Finland","Sweden","Poland","Germany","United Kingdom","United States","Estonia","Latvia","Lithuania"] }
];

function getIncidentsUpTo(year) {
  const y = Number(year);
  // Only include incidents that began in 2014 or later and are still "active"
  // for up to 2 years after their origin year.
  return MAJOR_INCIDENTS
    .filter(i => i.year >= 2014 && i.year <= y && y <= (i.year + 2))
    .sort((a, b) => a.year - b.year);
}
function incidentCountriesForYear(year) {
  const inc = getIncidentsUpTo(year);
  const set = new Set();
  inc.forEach(i => i.countries.forEach(c => set.add(c)));
  return Array.from(set);
}

/* --- NEW: update incident dataset in the embedded commitment view --- */
function updateIncidentDataInVega(countryList = []) {
    if (!commitmentView) return;
    try {
        const rows = (countryList || []).map(c => ({ country: topoNameFor(c) || c, incident: true }));
        const uniq = []; const seen = new Set();
        rows.forEach(r => { const k = String(r.country); if (!seen.has(k)) { seen.add(k); uniq.push(r); }});
        const changeset = vega.changeset().remove(() => true).insert(uniq);
        try { commitmentView.change('incidentData', changeset); } catch (e) { console.warn('Could not update incidentData on commitment view', e); }
        if (typeof commitmentView.runAsync === 'function') commitmentView.runAsync();
    } catch (err) {
        console.error('Failed to update incidentData in commitment view', err);
    }
}

/* --- UI Renderers & Updaters --- */
function updateCommitmentSpendingData(year) {
  if (!commitmentView) return;
  const mapForYear = commitmentData.get(Number(year)) || new Map();
  const valuesForVega = [];
  mapForYear.forEach((value, country) => {
    const lookupName = topoNameFor(country);
    const numValue = (value === null || value === '') ? null : Number(value);
    if (Number.isFinite(numValue) || numValue === null) {
      valuesForVega.push({ country: lookupName, value: numValue });
      if (country !== lookupName) valuesForVega.push({ country: country, value: numValue });
    }
  });
  try {
    commitmentView.change('spendingData', vega.changeset().remove(() => true).insert(valuesForVega));
  } catch (err) { console.error(`Error updating spending data for year ${year}`, err); }

  // Update incidents UI and dataset for the current view
  try {
    const incidentCountries = incidentCountriesForYear(year);
    // render cards in sidebar (commitment sidebar)
    renderIncidentCards(year);
    updateIncidentDataInVega(incidentCountries);
  } catch (e) { console.warn('Failed to update incidents for year', e); }

  // keep the embedded commit slider in sync
  try { commitmentView.signal('commit_year', Number(year)).runAsync(); } catch (e) {}
}

/* --- NEW: render incident annotation cards into the commitment sidebar --- */
function renderIncidentCards(year) {
  if (!commitmentSidebarEl) return;
  const incidents = getIncidentsUpTo(year);
  if (!incidents || !incidents.length) {
    // remove any existing incident block (if present) by ensuring sidebar shows just the list (renderCommitmentSidebar will overwrite)
    // No-op here; renderCommitmentSidebar will handle full content.
    return;
  }
  // Build concise incident cards HTML and prepend to the ranking list (renderCommitmentSidebar calls this)
  const cardsHtml = incidents.map(i => {
    return `<div class="chart-annotation" style="margin-bottom:10px;padding:10px;">
      <div style="font-weight:900;color:#d9534f;margin-bottom:6px">${escapeHtml(String(i.year))} — ${escapeHtml(i.title)}</div>
      <div style="color:#345a6a;">${escapeHtml(i.desc)}</div>
      <div style="margin-top:8px;font-weight:700;color:#083a57;">Affected / responding members: ${escapeHtml(i.countries.join(', '))}</div>
    </div>`;
  }).join('');
  // temporarily store on sidebar element so renderCommitmentSidebar can include it
  commitmentSidebarEl.__incidentHtml = cardsHtml;
}

/* --- Update renderCommitmentSidebar to include incident cards at top --- */
function renderCommitmentSidebar(year) {
  const y = Number(year);
  const members = window.nationsJoinedUpTo(y);
  let dataMap = new Map();
  let title = `Ranked Members (${y})`;
  let isSpending = (activeCommitmentSubView === 'spending');
  if (isSpending) {
    dataMap = commitmentData.get(y) || new Map();
    title = `Defence Spending (% GDP, ${y})`;
  } else {
    dataMap = new Map();
    title = `Personnel (k, ${y}) - [Data Placeholder]`;
  }

  // Recompute incident cards for this year (will store HTML on commitmentSidebarEl.__incidentHtml)
  renderIncidentCards(y);

  const rows = members.map(country => {
    const val = getCommitmentValue(dataMap, country);
    return { country, value: val, meets: isSpending && val != null && Number(val) >= 2 };
  }).filter(r => r.value !== null);

  rows.sort((a,b) => (b.value ?? -1) - (a.value ?? -1));
  if (!commitmentSidebarEl) return;
  if (!rows.length) {
    commitmentSidebarEl.innerHTML = `<div style="padding:10px;color:#577b8b;font-weight:700">No data available for ${y}</div>`;
    return;
  }

  // assemble member list HTML
  let lastMeetIdx = -1;
  if (isSpending) { rows.forEach((r,i) => { if (r.meets) lastMeetIdx = i; }); }
  const htmlParts = [];
  // include incident cards HTML if available
  if (commitmentSidebarEl.__incidentHtml) {
    htmlParts.push(commitmentSidebarEl.__incidentHtml);
  }
  htmlParts.push(`<div style="font-weight:900; color:#083a57; margin-bottom:8px; padding: 0 6px;">${escapeHtml(title)}</div>`);
  rows.forEach((r, i) => {
    const rank = i + 1;
    const flag = countryFlag(r.country);
    const safe = escapeHtml(r.country);
    const valText = (r.value == null) ? 'NO DATA' : (Number(r.value).toFixed(2) + (isSpending ? '%' : 'k'));
    htmlParts.push(`<div class="member-item" data-country="${safe}" tabindex="0" title="${safe} — ${valText}"><div class="row-left"><div class="rank">${rank}</div><div><div style="display:flex;align-items:center;gap:6px">${flag ? `<span class="flag">${flag}</span>` : ''}<strong style="color:#083a57; font-size: 14px;">${safe}</strong></div></div></div><div class="value">${valText}</div></div>`);
    if (isSpending && i === lastMeetIdx && lastMeetIdx !== -1 && lastMeetIdx !== rows.length - 1) {
      htmlParts.push(`<div class="threshold-divider"><span>2% threshold</span></div>`);
    }
  });
  commitmentSidebarEl.innerHTML = `<div class="member-list">${htmlParts.join('')}</div>`;

  // Attach hover listeners
  Array.from(commitmentSidebarEl.querySelectorAll('.member-item')).forEach(item => {
    const country = item.getAttribute('data-country');
    const topoCountry = topoNameFor(country);
    item.addEventListener('mouseenter', () => setHoverCountry(commitmentView, topoCountry));
    item.addEventListener('mouseleave', () => setHoverCountry(commitmentView, ''));
    item.addEventListener('focus', () => setHoverCountry(commitmentView, topoCountry));
    item.addEventListener('blur', () => setHoverCountry(commitmentView, ''));
  });
}
async function setHoverCountry(view, countryName) { try { if (view && typeof view.signal === 'function') { await view.signal('hover_country', countryName || '').runAsync(); } } catch (err) { /* ignore */ } }

const MILESTONES = { 1949: ['1949 - NATO FOUNDED'], 1952: ['1952 - 🇬🇷 GREECE & 🇹🇷 TURKEY JOIN'], 1955: ['1955 - 🇩🇪 WEST GERMANY JOINS'], 1982: ['1982 - 🇪🇸 SPAIN JOINS'], 1989: ['1989 - FALL OF BERLIN WALL'], 1990: ['1990 - GERMAN REUNIFICATION'], 1991: ['1991 - DISSOLUTION OF USSR'], 1999: ['1999 - 🇵🇱 POLAND, 🇭🇺 HUNGARY, 🇨🇿 CZECHIA JOIN'], 2001: ['2001 - 9/11 ATTACKS (Article 5 Invoked)'], 2004: ['2004 - MAJOR EASTERN ENLARGEMENT (7 nations)'], 2009: ['2009 - 🇦🇱 ALBANIA & 🇭🇷 CROATIA JOINS'], 2014: ['2014 - RUSSIA ANNEXES CRIMEA'], 2017: ['2017 - 🇲🇪 MONTENEGRO JOINS'], 2020: ['2020 - 🇲🇰 NORTH MACEDONIA JOINS'], 2022: ['2022 - RUSSIA INVADES UKRAINE'], 2023: ['2023 - 🇫🇮 FINLAND JOINS'], 2024: ['2024 - 🇸🇪 SWEDEN JOINS'] };
function renderMilestoneForYear(year) { if (!milestoneTextEl) return; let displayYear = year; while (!MILESTONES[displayYear] && displayYear >= 1949) { displayYear--; } const lines = MILESTONES[displayYear] || ['Use slider to explore']; milestoneTextEl.innerHTML = lines.map(l => escapeHtml(l)).join('<br>'); }

// Use COMPARISON_ANNOTATIONS for the comparison chart
const COMPARISON_ANNOTATIONS = {
  2014: "<strong>2014: Ukraine Crisis Begins</strong><br>Russia annexes Crimea. NATO reinforces Eastern flank.",
  2016: "<strong>2016: China Military Reforms</strong><br>China continues major restructuring.",
  2020: "<strong>2020: COVID-19 Pandemic</strong><br>Impacts training and operations worldwide.",
  2022: "<strong>2022: Russia Invades Ukraine</strong><br>Major impact on European security, NATO increases readiness."
};
function renderComparisonAnnotation(year) { if (!comparisonAnnotationEl) return; const annotationText = COMPARISON_ANNOTATIONS[year]; if (annotationText) { comparisonAnnotationEl.innerHTML = annotationText; comparisonAnnotationEl.style.display = 'block'; } else { comparisonAnnotationEl.style.display = 'none'; } }

// Render Growth Member List
function renderGrowthMemberList(year = 1949) {
    if (!memberListGrowthEl) return;
    const members = window.nationsJoinedUpTo(year);
    const filteredMembers = members.filter(country => !showFoundersFilter || (natoData.find(d => d.Country === country)?.Year === 1949));
    if (!filteredMembers.length) { memberListGrowthEl.innerHTML = '<div style="padding:10px;color:#577b8b;font-style:italic;">No members joined by this year (or matching filter).</div>'; return; }
    filteredMembers.sort((a,b) => { const yearA = natoData.find(d => d.Country === a)?.Year ?? Infinity; const yearB = natoData.find(d => d.Country === b)?.Year ?? Infinity; if (yearA !== yearB) return yearA - yearB; return a.localeCompare(b); });
    memberListGrowthEl.innerHTML = filteredMembers.map(m => { const memberData = natoData.find(d => d.Country === m); const flag = countryFlag(m); const joinYear = memberData?.Year ?? '??'; const safe = escapeHtml(m); return `<div class="member-item" data-country="${safe}" tabindex="0" title="${safe} — Joined ${joinYear}"><div class="label">${flag ? `<span class="flag">${flag}</span>` : ''}<span style="margin-left:6px;">${safe}</span></div><div class="join-year">${escapeHtml(String(joinYear))}</div></div>`; }).join('');
    Array.from(memberListGrowthEl.querySelectorAll('.member-item')).forEach(item => { const country = item.getAttribute('data-country'); const topoCountry = topoNameFor(country); item.addEventListener('mouseenter', () => setHoverCountry(growthView, topoCountry)); item.addEventListener('mouseleave', () => setHoverCountry(growthView, '')); });
}

/* --- Vega Embedding Function --- */
async function embedChart(elementId, specUrlOrSpecObject, addSignalListener = null) { try { let spec = specUrlOrSpecObject; if (typeof specUrlOrSpecObject === 'string') { const response = await fetch(specUrlOrSpecObject); if (!response.ok) throw new Error(`Fetch failed for ${specUrlOrSpecObject}`); spec = await response.json(); } const container = document.getElementById(elementId); if (container) container.innerHTML = ''; else { throw new Error(`Container #${elementId} not found`); } const result = await vegaEmbed(`#${elementId}`, spec, { actions: false, renderer: 'svg' }); if (result && result.view && typeof addSignalListener === 'function') { addSignalListener(result.view); } console.log(`Chart embedded successfully into #${elementId}`); return result.view; } catch (err) { console.error(`Failed to load/embed into #${elementId}:`, err); const el = document.getElementById(elementId); if (el) el.innerHTML = `<p style='color:red;'>Error loading chart: ${err.message}</p>`; return null; } }

/* --- Control Setup Functions --- */
function setupGrowthControls() {
    if (growthYearSlider) {
        growthYearSlider.addEventListener('input', async (event) => {
            const year = Number(event.target.value);
            if (growthYearLabel) growthYearLabel.textContent = year;
            if (growthView) { try { 
                // sync to the Vega param used by the embedded spec
                await growthView.signal('year_slider', year).runAsync();
                renderMilestoneForYear(year);
                renderGrowthMemberList(year);
            } catch (e) {} }
        });
    }
    if (playPauseGrowthBtn) {
        playPauseGrowthBtn.addEventListener('click', () => { if (growthPlaying) stopGrowthAnimation(); else startGrowthAnimation(); });
    }
    if (toggleFoundersBtn) {
        toggleFoundersBtn.addEventListener('click', async () => {
            showFoundersFilter = !showFoundersFilter; toggleFoundersBtn.setAttribute('aria-pressed', String(showFoundersFilter)); toggleFoundersBtn.textContent = showFoundersFilter ? 'Show All Members' : 'Show Founders';
            if (growthView) { try { await growthView.signal('show_founders', showFoundersFilter).runAsync(); } catch(e) {} }
            renderGrowthMemberList(Number(growthYearSlider?.value || 1949)); // Re-render list with filter
        });
         toggleFoundersBtn.setAttribute('aria-pressed', 'false'); toggleFoundersBtn.textContent = 'Show Founders';
    }
}
function startGrowthAnimation() { if (growthPlaying || !growthView) return; growthPlaying = true; if (playPauseGrowthBtn) playPauseGrowthBtn.textContent = 'Pause'; growthTimer = setInterval(async () => { try { const current = Number(growthYearSlider.value); const next = current + 1; if (next > 2024) { stopGrowthAnimation(); return; } growthYearSlider.value = String(next); if (growthYearLabel) growthYearLabel.textContent = next; // use the embedded spec's slider signal name
        await growthView.signal('year_slider', next).runAsync(); renderMilestoneForYear(next); renderGrowthMemberList(next); } catch(e) { stopGrowthAnimation(); } }, 650); }
function stopGrowthAnimation() { growthPlaying = false; if (playPauseGrowthBtn) playPauseGrowthBtn.textContent = 'Play'; if (growthTimer) { clearInterval(growthTimer); growthTimer = null; } }

function setupCommitmentControls() {
    if (commitYearSlider) {
        commitYearSlider.addEventListener('input', async (event) => {
            const year = Number(event.target.value);
            if (commitYearLabel) commitYearLabel.textContent = year;
            // Always update both spending map and personnel chart (both displayed)
            if (commitmentView) updateCommitmentSpendingData(year);
            try { await renderCommitmentPersonnelChart(year); } catch (e) { console.warn('Failed to update personnel chart', e); }
            renderCommitmentSidebar(year);
        });
    }

    // Removed sub-nav/button click handlers — both visualizations are shown by default.
}

function setupComparisonControls() {
    if (comparisonYearSlider) {
        comparisonYearSlider.addEventListener('input', async (event) => {
            const year = Number(event.target.value); if (comparisonYearLabel) comparisonYearLabel.textContent = year;
            // re-render the three domain charts for the selected year
            try { await renderComparisonForceCharts(year); } catch (e) { console.warn('Failed to update comparison force charts', e); }
            renderComparisonAnnotation(year);
        });
    }
}

/* --- HELPERS: small two‑bar comparison spec builder --- */
function buildTwoBarSpec(title, values, xTitle = '') {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height: 160,
    autosize: { type: 'fit', 'contains': 'padding' },
    background: null,
    title: { text: title, anchor: 'start', fontSize: 13 },
    data: { values },
    mark: { type: 'bar', tooltip: true, cornerRadius: 4 },
    encoding: {
      y: { field: 'entity', type: 'nominal', title: '', sort: null },
      x: {
        field: 'value',
        type: 'quantitative',
        title: xTitle,
        axis: {
          labelExpr: "datum.value >= 1000000 ? (format(datum.value/1000000, '.1f') + 'M') : (datum.value >= 1000 ? (format(datum.value/1000, '.1f') + 'k') : format(datum.value, ','))",
          grid: true
        }
      },
      color: {
        field: 'entity',
        type: 'nominal',
        legend: null,
        scale: { domain: ['NATO', 'Russia'], range: ['#0072B2', '#FF6A00'] }
      },
      tooltip: [
        { field: 'entity', type: 'nominal', title: 'Entity' },
        { field: 'value', type: 'quantitative', title: xTitle, format: ',' }
      ]
    },
    config: { view: { stroke: 'transparent' }, axis: { labelFontSize: 11, titleFontSize: 12 } }
  };
}

async function renderComparisonForceCharts(year) {
  try {
    // militaryComparison.csv is a single snapshot file (no year dimension)
    const res = await fetch('militaryComparison.csv');
    if (!res.ok) throw new Error('Failed to fetch militaryComparison.csv');
    const text = await res.text();
    const parsed = await parseCsvText(text);
    const rows = parsed.rows;

    // map rows by entity name for robust lookup
    const rowByEntity = new Map();
    rows.forEach(r => {
      const ent = (r['Entity'] || r.Entity || '').trim();
      if (ent) rowByEntity.set(ent, r);
    });

    const getVal = (r, col) => {
      if (!r) return null;
      const raw = r[col] ?? r[col.trim()] ?? '';
      if (raw === '' || raw == null) return null;
      const n = Number(String(raw).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };

    // find NATO and Russia rows (support common variants)
    const rowNATO = rowByEntity.get('NATO') || rowByEntity.get('NATO Total') || rowByEntity.get('NATO Europe and Canada') || null;
    const rowRUS = rowByEntity.get('Russia') || rowByEntity.get('Russian Federation') || null;

    // small helper to build safe DOM id from domain + metric
    const idFor = (prefix, metric) => {
      return `${prefix}_${String(metric).replace(/[^a-z0-9]+/gi, '_').replace(/_+/g,'_').replace(/^_|_$/g,'')}`;
    };

    // 1) Render three separate summary charts for Totals (unchanged)
    const summaries = [
      { id: 'summaryActiveVis', label: 'Active soldiers', col: 'Active soldiers', xTitle: 'Personnel (count)' },
      { id: 'summaryAircraftVis', label: 'Total aircraft', col: 'Total aircraft', xTitle: 'Aircraft (count)' },
      { id: 'summaryShipsVis', label: 'Total military ships', col: 'Total military ships', xTitle: 'Ships (count)' }
    ];

    for (const s of summaries) {
      const vN = getVal(rowNATO, s.col);
      const vR = getVal(rowRUS, s.col);
      const vals = [
        { entity: 'NATO', value: vN == null ? 0 : vN, raw: vN },
        { entity: 'Russia', value: vR == null ? 0 : vR, raw: vR }
      ];
      // keep title concise (section header already provides context)
      const title = s.label;
      // reuse the small two-bar builder
      const spec = buildTwoBarSpec(title, vals, s.xTitle);
      spec.height = 120;
      try {
        await embedChart(s.id, spec);
      } catch (e) {
        const el = document.getElementById(s.id);
        if (el) el.innerHTML = `<div style="padding:8px;color:#b00020">Error rendering ${s.label}: ${escapeHtml(e.message)}</div>`;
      }
    }

    // 2) Render each metric as its own small two‑bar chart inside the per‑domain grids
    const domains = [
      {
        prefix: 'comparisonLand',
        container: 'comparisonLandGrid',
        metrics: [
          // Key land metrics only
          { key: 'Main battle tanks', col: 'Main battle tanks' },
          { key: 'Armored vehicles', col: 'Armored vehicles' },
          { key: 'Self-propelled artillery', col: 'Self-propelled artillery' }
        ],
        xTitle: 'Count'
      },
      {
        prefix: 'comparisonAir',
        container: 'comparisonAirGrid',
        metrics: [
          // Key air metrics only
          { key: 'Fighters/interceptors', col: 'Fighters/interceptors' },
          { key: 'Transport aircraft', col: 'Transport aircraft' },
          { key: 'Total helicopters', col: 'Total helicopters' }
        ],
        xTitle: 'Count'
      },
      {
        prefix: 'comparisonSea',
        container: 'comparisonNavyGrid',
        metrics: [
          // Key naval metrics only
          { key: 'Aircraft carriers', col: 'Aircraft carriers' },
          { key: 'Destroyers', col: 'Destroyers' },
          { key: 'Submarines', col: 'Submarines' }
        ],
        xTitle: 'Count'
      }
    ];

    for (const d of domains) {
      for (const m of d.metrics) {
        const vN = getVal(rowNATO, m.col);
        const vR = getVal(rowRUS, m.col);
        const id = idFor(d.prefix, m.key);
        // ensure container exists (defensive)
        const containerEl = document.getElementById(id);
        if (!containerEl) {
          // skip if container not present
          console.warn(`Container not found for metric: ${id}`);
          continue;
        }
        const vals = [
          { entity: 'NATO', value: vN == null ? 0 : vN, raw: vN },
          { entity: 'Russia', value: vR == null ? 0 : vR, raw: vR }
        ];
        // metric title: concise (section provides full context)
        const spec = buildTwoBarSpec(m.key, vals, d.xTitle);
        // make the small metric cards tall enough to fit (match CSS min-height)
        spec.height = 120;
        try {
          await embedChart(id, spec);
        } catch (e) {
          const el = document.getElementById(id);
          if (el) el.innerHTML = `<div style="padding:6px;color:#b00020">Error rendering ${m.key}: ${escapeHtml(e.message)}</div>`;
        }
      }
    }

    return true;
  } catch (err) {
    console.error('renderComparisonForceCharts error:', err);
    ['summaryActiveVis','summaryAircraftVis','summaryShipsVis','comparisonLandVis','comparisonAirVis','comparisonNavyVis'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div style="padding:8px;color:#b00020">Error loading data: ${escapeHtml(err.message)}</div>`;
    });
    return null;
  }
}

/* --- App Initialization --- */
async function init() {
    console.log("Initializing Visualization...");

    // Load Data First
    await loadNatoCsv();
    await loadCommitmentCsv();

    // Setup Controls (before embedding)
    setupGrowthControls();
    setupCommitmentControls();
    setupComparisonControls();

    // Embed History Content (Static)
    try {
        const historyRes = await fetch('founding-purpose.json');
        if (!historyRes.ok) throw new Error('fetch failed');
        const historyData = await historyRes.json();
        if (historyContentEl && Array.isArray(historyData.content)) {
            // build simple safe HTML blocks from the content array
            const html = historyData.content.map(block => {
                const cls = block.emphasis ? 'purpose-block article5-emphasis' : 'purpose-block';
                const icon = block.icon ? `<div class="icon" aria-hidden="true">${escapeHtml(block.icon)}</div>` : '';
                const title = block.title ? `<h3>${escapeHtml(block.title)}</h3>` : '';
                const text = block.text ? `<p>${escapeHtml(block.text)}</p>` : '';
                return `<div class="${cls}">${icon}${title}${text}</div>`;
            }).join('');
            historyContentEl.innerHTML = html;
        } else if (historyContentEl) {
            historyContentEl.innerHTML = '<p style="color:#577b8b;"><em>No history content available.</em></p>';
        }
    } catch (e) {
        console.error("Failed to load founding-purpose content", e);
        if (historyContentEl) historyContentEl.innerHTML = '<p style="color:red">Error loading history.</p>';
    }

    // Embed Initial Interactive Views
    // Growth Map
    growthView = await embedChart('growthVis', 'growth.json');
    const initialGrowthYear = Number(growthYearSlider?.value || 1949);
    if (growthView) {
        try {
            // set the embedded spec's year_slider signal (matches growth.json param)
            await growthView.signal('year_slider', initialGrowthYear).runAsync();
        } catch(e) {}
        // add a listener so internal (vega) slider changes update the page controls & sidebar
        try {
            if (typeof growthView.addSignalListener === 'function' && !growthView.__yearListener) {
                growthView.addSignalListener('year_slider', (name, value) => {
                    try {
                        const v = Number(value);
                        if (growthYearSlider) growthYearSlider.value = String(v);
                        if (growthYearLabel) growthYearLabel.textContent = v;
                        renderMilestoneForYear(v);
                        renderGrowthMemberList(v);
                    } catch (e) { /* ignore */ }
                });
                growthView.__yearListener = true;
            }
        } catch (e) { /* ignore */ }

        renderMilestoneForYear(initialGrowthYear);
        renderGrowthMemberList(initialGrowthYear);
    }

    // Commitment View (Default to Spending Map + personnel card)
    const initialCommitYear = Number(commitYearSlider?.value || 2014);

    // ensure both map and personnel chart are embedded initially
    // embed map
    commitmentView = await embedChart('commitmentVis', buildCommitmentSpendingSpec());
    if (commitmentView) updateCommitmentSpendingData(initialCommitYear);

    // embed personnel bar chart (card under the map)
    await renderCommitmentPersonnelChart(initialCommitYear);

    renderCommitmentSidebar(initialCommitYear);
    // sub-nav removed

    // Comparison Force Charts (Land / Air / Navy)
    const initialComparisonYear = Number(comparisonYearSlider?.value || 2024);
    await renderComparisonForceCharts(initialComparisonYear);
    renderComparisonAnnotation(initialComparisonYear);

    // Nuclear comparison: replace the static embed with the dynamic NATO vs Russia vs China chart
    await renderNuclearComparisonChart();

    console.log("App initialized.");
}

async function renderNuclearComparisonChart() {
  try {
    const res = await fetch('nuclear-warhead-inventories.csv');
    if (!res.ok) throw new Error('Failed to fetch nuclear-warhead-inventories.csv');
    const text = await res.text();
    const parsed = await parseCsvText(text);
    const rows = parsed.rows;

    // Only compare NATO vs Russia now
    const targets = new Set(['NATO','Russia']);
    const yearField = parsed.header.find(h => /Year/i.test(h)) || 'Year';
    const latestYear = rows.map(r => Number(r[yearField]) || 0).reduce((a,b)=>Math.max(a,b), 0);

    const fStrategic = 'Number of deployed strategic nuclear warheads';
    const fNonstrategic = 'Number of deployed nonstrategic nuclear warheads';
    const fReserve = 'Number of nondeployed nuclear warheads in reserve';
    const fRetired = 'Number of retired nuclear warheads';

    const filtered = rows.filter(r => targets.has(String(r['Entity']).trim()) && Number(r[yearField]) === latestYear);
    if (!filtered.length) {
      const el = document.getElementById('comparisonNukesVis');
      if (el) el.innerHTML = `<div style="padding:12px;color:#577b8b">No data available for ${latestYear}</div>`;
      return null;
    }

    const values = filtered.map(r => {
      const entity = String(r['Entity']).trim();
      const s = Number(String(r[fStrategic]||'').replace(/,/g,'')) || 0;
      const ns = Number(String(r[fNonstrategic]||'').replace(/,/g,'')) || 0;
      const resv = Number(String(r[fReserve]||'').replace(/,/g,'')) || 0;
      const retired = Number(String(r[fRetired]||'').replace(/,/g,'')) || 0;
      const total = s + ns + resv;
      return { entity, strategic: s, nonstrategic: ns, reserve: resv, retired, total };
    });

    // Extra safety: ensure China (and variants) are removed
    const valuesFiltered = values.filter(v => !/china/i.test(String(v.entity)));

    const titleText = `☢️ Estimated Stockpiled Nuclear Warheads (deployed + reserve) — NATO vs Russia (${latestYear})`;
    const titleTextSimple = `☢️ Estimated Stockpiled Nuclear Warheads (deployed + reserve) — Latest (${latestYear})`;
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: 'container',
      height: 260,
      autosize: { type: 'fit', contains: 'padding' },
      background: null,
      title: { text: titleTextSimple, anchor: 'start', fontSize: 16 },
      data: { values: valuesFiltered },
      mark: { type: 'bar', tooltip: true, cornerRadius: 6, size: 22 },
      encoding: {
        x: {
          field: 'total',
          type: 'quantitative',
          title: 'Estimated stockpiled warheads (deployed + reserve)',
          axis: {
            labelExpr: "datum.value >= 1000000 ? (format(datum.value/1000000, '.1f') + 'M') : (datum.value >= 1000 ? (format(datum.value/1000, '.1f') + 'k') : format(datum.value, ','))",
            grid: true
          }
        },
        y: { field: 'entity', type: 'nominal', sort: '-x', title: '' },
        color: {
          field: 'entity',
          type: 'nominal',
          legend: null,
          scale: {
            domain: ['NATO', 'Russia'],
            range: ['#0072B2', '#FF6A00']
          }
        },
        tooltip: [
          { field: 'entity', type: 'nominal', title: 'Entity' },
          { field: 'total', type: 'quantitative', title: 'Total (deployed + reserve)', format: ',' },
          { field: 'strategic', type: 'quantitative', title: 'Deployed strategic', format: ',' },
          { field: 'nonstrategic', type: 'quantitative', title: 'Deployed nonstrategic', format: ',' },
          { field: 'reserve', type: 'quantitative', title: 'Reserve (non-deployed)', format: ',' },
          { field: 'retired', type: 'quantitative', title: 'Retired (not included in total)', format: ',' }
        ]
      },
      config: {
        view: { stroke: 'transparent' },
        axis: { labelFontSize: 12, titleFontSize: 13 },
        bar: { discreteBandSize: 26 }
      }
    };

    try {
      const r = await vegaEmbed('#comparisonNukesVis', spec, { actions: false, renderer: 'svg' });
      return r.view;
    } catch (e) {
      console.error('Failed to embed nuclear comparison spec', e);
      const el = document.getElementById('comparisonNukesVis');
      if (el) el.innerHTML = `<div style="padding:12px;color:#b00020">Error rendering nuclear comparison: ${escapeHtml(e.message)}</div>`;
      return null;
    }
  } catch (err) {
    console.error('renderNuclearComparisonChart error:', err);
    const el = document.getElementById('comparisonNukesVis');
    if (el) el.innerHTML = `<div style="padding:12px;color:#b00020">Error loading nuclear data: ${escapeHtml(err.message)}</div>`;
    return null;
  }
}

// Run the app
init();