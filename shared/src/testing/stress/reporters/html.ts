import type { ProfileTreeNode } from "../profile-tree";
import type { BudgetFailure, RegressionFinding, StressArtifact, StressRunReport } from "../types";

// Self-contained HTML report — opens in any browser offline (and prints to PDF).
// Carries the same tables as the Markdown report plus an interactive flame chart
// of the CPU profile (the headline: see hot paths without DevTools) and a bar
// view of stage timings. CSS + the flame renderer are inlined; the call tree is
// inlined as JSON. Mirrors tools/change-report's single-file approach.

function round(value: number, places = 1): number {
	if (!Number.isFinite(value)) return value;
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

function esc(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A literal `</script>`/`</style>` inside inlined text would close the tag early. */
function inlineSafe(text: string): string {
	return text.replace(/<\/(script|style)/gi, "<\\/$1");
}

function fmtPct(value: number | null): string {
	if (value === null) return "—";
	if (!Number.isFinite(value)) return "∞";
	return `${value > 0 ? "+" : ""}${round(value)}%`;
}

type Align = "left" | "right";

function htmlTable(
	header: readonly string[],
	rows: readonly (readonly string[])[],
	align: readonly Align[] = []
): string {
	if (rows.length === 0) return `<p class="muted">—</p>`;
	const th = header.map((h, i) => `<th class="${align[i] ?? "left"}">${esc(h)}</th>`).join("");
	const body = rows
		.map((row) => `<tr>${row.map((cell, i) => `<td class="${align[i] ?? "left"}">${cell}</td>`).join("")}</tr>`)
		.join("");
	return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

function cardsHtml(report: StressRunReport): string {
	const navP95 = report.timings["scenario.navigateStep"]?.p95Ms;
	const cards: [string, string][] = [
		["Status", report.status.toUpperCase()],
		["Scenario", report.scenario],
		["Profile", report.profile],
		["Repeats", `${report.config.repeats} (warmup ${report.config.warmup})`],
		["Budget failures", String(report.budgetFailures.length)],
		["Regressions", String(report.regressions.filter((r) => r.regressed).length)],
	];
	if (navP95 !== undefined) cards.push(["navigateStep p95", `${round(navP95)} ms`]);
	const cls = (label: string): string => (label === "Status" ? (report.status === "pass" ? "ok" : "bad") : "");
	return cards
		.map(([l, v]) => `<div class="card ${cls(l)}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`)
		.join("");
}

function timingsHtml(timings: StressRunReport["timings"]): string {
	const entries = Object.entries(timings).sort((a, b) => b[1].p95Ms - a[1].p95Ms);
	if (entries.length === 0) return `<p class="muted">No timing stages recorded.</p>`;
	const maxP95 = Math.max(...entries.map(([, s]) => s.p95Ms), 1);
	const rows = entries.map(([name, s]) => [
		`<code>${esc(name)}</code>`,
		String(s.count),
		String(round(s.avgMs)),
		String(round(s.p50Ms)),
		`<div class="bar"><span style="width:${round((s.p95Ms / maxP95) * 100)}%"></span><b>${round(s.p95Ms)}</b></div>`,
		String(round(s.maxMs)),
	]);
	return htmlTable(["Stage", "Count", "Avg ms", "P50 ms", "P95 ms", "Max ms"], rows, [
		"left",
		"right",
		"right",
		"right",
		"left",
		"right",
	]);
}

function digestHtml(digest: StressRunReport["profileDigest"]): string {
	if (!digest) return `<p class="muted">No CPU profile captured.</p>`;
	if (digest.topSelfTime.length === 0) {
		return `<p class="muted">CPU profile captured, but no non-idle frames were sampled (action too fast — try a larger profile).</p>`;
	}
	const rows = digest.topSelfTime.map((e, i) => [
		String(i + 1),
		`<code>${esc(e.functionName)}</code>`,
		`<code>${esc(e.location)}</code>`,
		`${round(e.selfPct)}%`,
		String(round(e.selfTimeMs)),
		String(e.hitCount),
	]);
	return (
		`<p class="muted">Profiled ${round(digest.durationMs)} ms · ${digest.sampleCount} samples</p>` +
		htmlTable(["#", "Function", "Location", "Self %", "Self ms", "Hits"], rows, [
			"right",
			"left",
			"left",
			"right",
			"right",
			"right",
		])
	);
}

function heapHtml(digest: StressRunReport["heapDigest"]): string {
	if (!digest) return `<p class="muted">No heap snapshot captured.</p>`;
	const mb = (bytes: number): string => `${round(bytes / 1_000_000)} MB`;
	const parts = [
		`<p class="muted">Nodes ${digest.nodeCount} · Edges ${digest.edgeCount} · Retained ${mb(digest.totalSizeBytes)} · Detached nodes ${digest.detachedNodeCount}</p>`,
	];
	if (digest.topTypes.length > 0) {
		parts.push(
			"<h3>Top types</h3>",
			htmlTable(
				["#", "Type", "Count", "Self size"],
				digest.topTypes.map((e, i) => [
					String(i + 1),
					`<code>${esc(e.type)}</code>`,
					String(e.count),
					mb(e.selfSizeBytes),
				]),
				["right", "left", "right", "right"]
			)
		);
	}
	if (digest.topRetainers.length > 0) {
		parts.push(
			"<h3>Top retainers of detached nodes</h3>",
			htmlTable(
				["#", "Holder.edge", "Detached held"],
				digest.topRetainers.map((e, i) => [String(i + 1), `<code>${esc(e.retainer)}</code>`, String(e.count)]),
				["right", "left", "right"]
			)
		);
	}
	return parts.join("\n");
}

function regressionsHtml(regressions: readonly RegressionFinding[]): string {
	if (regressions.length === 0) return `<p class="muted">No baseline comparison (no baseline committed yet).</p>`;
	return htmlTable(
		["Metric", "Kind", "Baseline", "Candidate", "Delta", "Status"],
		regressions.map((r) => [
			`<code>${esc(r.metric)}</code>`,
			r.kind,
			String(round(r.baseline)),
			String(round(r.candidate)),
			`${round(r.delta)} (${fmtPct(r.deltaPct)})`,
			r.regressed ? `<span class="bad">❌ REGRESSED</span>` : "✅",
		]),
		["left", "left", "right", "right", "right", "left"]
	);
}

function budgetsHtml(failures: readonly BudgetFailure[]): string {
	if (failures.length === 0) return `<p class="muted">All budgets within limits.</p>`;
	return htmlTable(
		["Metric", "Rule", "Actual", "Expected", "Delta"],
		failures.map((f) => [
			`<code>${esc(f.metric)}</code>`,
			f.comparison,
			String(round(f.actual)),
			String(round(f.expected)),
			`${round(f.delta)} (${fmtPct(f.deltaPct)})`,
		]),
		["left", "left", "right", "right", "right"]
	);
}

function countsHtml(counts: StressRunReport["counts"]): string {
	const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
	if (entries.length === 0) return `<p class="muted">No counts recorded.</p>`;
	return htmlTable(
		["Metric", "Value"],
		entries.map(([name, value]) => [`<code>${esc(name)}</code>`, String(value)]),
		["left", "right"]
	);
}

function artifactsHtml(artifacts: readonly StressArtifact[]): string {
	if (artifacts.length === 0) return `<p class="muted">No artifacts.</p>`;
	return htmlTable(
		["Kind", "Path", "Description"],
		artifacts.map((a) => [
			a.kind,
			`<a href="file://${esc(a.path)}"><code>${esc(a.path)}</code></a>`,
			esc(a.description ?? ""),
		]),
		["left", "left", "left"]
	);
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 13px/1.5 -apple-system, system-ui, "Segoe UI", sans-serif; color: #c9d1d9; background: #0d1117; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
.flamewrap { max-width: none; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 1px solid #21262d; padding-bottom: 6px; }
h3 { font-size: 13px; margin: 16px 0 6px; color: #8b949e; }
.meta { color: #8b949e; font-size: 12px; }
.muted { color: #8b949e; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
.cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
.card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 10px 14px; min-width: 110px; }
.card .v { font-size: 18px; font-weight: 600; }
.card .l { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: .04em; }
.card.ok .v { color: #3fb950; }
.card.bad .v { color: #f85149; }
.bad { color: #f85149; }
table { border-collapse: collapse; width: 100%; margin: 4px 0; font-size: 12px; }
th, td { padding: 5px 9px; border-bottom: 1px solid #21262d; vertical-align: middle; }
th { color: #8b949e; font-weight: 600; text-align: left; }
td.right, th.right { text-align: right; }
tbody tr:hover { background: #161b22; }
.bar { position: relative; min-width: 90px; height: 16px; background: #161b22; border-radius: 3px; }
.bar span { position: absolute; left: 0; top: 0; bottom: 0; background: #1f6feb; border-radius: 3px; }
.bar b { position: relative; padding: 0 5px; font-weight: 600; }
.flametools { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.flametools button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.flametools button:hover { background: #30363d; }
#crumb { color: #8b949e; font-size: 12px; }
#crumb span { cursor: pointer; color: #58a6ff; }
#flame { width: 100%; border: 1px solid #21262d; border-radius: 6px; overflow: hidden; user-select: none; }
.fl-node { display: flex; flex-direction: column; min-width: 0; }
.fl-label { height: 19px; line-height: 19px; font-size: 11px; padding: 0 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; border: 1px solid rgba(13,17,23,.55); cursor: pointer; color: #0d1117; }
.fl-label:hover { outline: 1px solid #fff; outline-offset: -1px; }
.fl-children { display: flex; flex-direction: row; align-items: flex-start; }
#tip { position: fixed; pointer-events: none; z-index: 10; background: #1c2128; border: 1px solid #30363d; border-radius: 6px; padding: 6px 9px; font-size: 12px; max-width: 460px; display: none; box-shadow: 0 4px 14px rgba(0,0,0,.5); }
#tip .n { font-weight: 600; color: #fff; }
#tip .loc { color: #8b949e; }
`;

// Client flame-chart renderer. Authored with string concatenation (no template
// literals) so it can live inside this TS module's backtick block without `${}`
// being interpolated at build time, and using only safe DOM APIs (textContent /
// createElement / replaceChildren — never innerHTML). Reads window.__STRESS__.tree.
const FLAME_JS = `
(function () {
  var data = window.__STRESS__;
  if (!data || !data.tree) return;
  var root = data.tree;
  var flame = document.getElementById("flame");
  var tip = document.getElementById("tip");
  var crumb = document.getElementById("crumb");
  var path = [root];

  function colorFor(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    var hue = ((h % 360) + 360) % 360;
    return "hsl(" + hue + ", 58%, 62%)";
  }
  function fmt(n) { return Math.round(n * 10) / 10; }

  function div(cls) { var d = document.createElement("div"); if (cls) d.className = cls; return d; }

  function showTip(e, node) {
    var pct = path[0].totalMs > 0 ? fmt((node.totalMs / path[0].totalMs) * 100) : 0;
    var n = div("n"); n.textContent = node.name;
    var loc = div("loc"); loc.textContent = node.location;
    var stat = div(); stat.textContent = "total " + fmt(node.totalMs) + " ms · self " + fmt(node.selfMs) + " ms · " + pct + "% of view";
    tip.replaceChildren(n, loc, stat);
    tip.style.display = "block";
    moveTip(e);
  }
  function moveTip(e) {
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + tip.offsetWidth > window.innerWidth) x = e.clientX - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > window.innerHeight) y = e.clientY - tip.offsetHeight - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.style.display = "none"; }

  function makeNode(node, parentTotal) {
    var el = div("fl-node");
    var pct = parentTotal > 0 ? (node.totalMs / parentTotal) * 100 : 100;
    el.style.flex = "0 0 " + pct + "%";

    var label = div("fl-label");
    label.style.background = colorFor(node.location || node.name);
    label.textContent = node.name;
    label.title = node.name + "  " + node.location;
    label.addEventListener("mouseenter", function (e) { showTip(e, node); });
    label.addEventListener("mousemove", moveTip);
    label.addEventListener("mouseleave", hideTip);
    label.addEventListener("click", function () { zoom(node); });
    el.appendChild(label);

    if (node.children && node.children.length) {
      var kids = div("fl-children");
      var sorted = node.children.slice().sort(function (a, b) { return b.totalMs - a.totalMs; });
      for (var i = 0; i < sorted.length; i++) { kids.appendChild(makeNode(sorted[i], node.totalMs)); }
      el.appendChild(kids);
    }
    return el;
  }

  function findPathTo(node) {
    var out = [];
    (function walk(n, trail) {
      var t = trail.concat([n]);
      if (n === node) { out = t; return true; }
      if (n.children) { for (var i = 0; i < n.children.length; i++) { if (walk(n.children[i], t)) return true; } }
      return false;
    })(root, []);
    return out.length ? out : [root];
  }

  function zoom(node) { path = findPathTo(node); draw(); }

  function draw() {
    var view = path[path.length - 1];
    flame.replaceChildren(makeNode(view, view.totalMs));
    var crumbNodes = [];
    path.forEach(function (n, i) {
      if (i > 0) crumbNodes.push(document.createTextNode(" › "));
      var s = document.createElement("span");
      s.textContent = n.name;
      s.addEventListener("click", function () { path = path.slice(0, i + 1); draw(); });
      crumbNodes.push(s);
    });
    crumb.replaceChildren.apply(crumb, crumbNodes);
  }

  var reset = document.getElementById("flreset");
  if (reset) reset.addEventListener("click", function () { path = [root]; draw(); });
  draw();
})();
`;

function flameSection(tree: ProfileTreeNode | undefined): string {
	if (!tree) return "";
	return `
  <h2>Flame chart — call tree</h2>
  <p class="muted">Width ∝ total time; the gap under a frame is its own self time. Click a frame to zoom, the breadcrumb to step back, hover for detail.</p>
  <div class="flametools">
    <button id="flreset">Reset zoom</button>
    <span id="crumb"></span>
  </div>
  <div id="flame"></div>
  <div id="tip"></div>`;
}

export interface HtmlReportOptions {
	/** The CPU-profile call tree, prune-ready, for the inlined flame chart. */
	profileTree?: ProfileTreeNode;
}

export function renderHtmlReport(report: StressRunReport, options: HtmlReportOptions = {}): string {
	const env = report.environment;
	const git = report.git;
	const flame = flameSection(options.profileTree);
	const treeBlob = options.profileTree
		? JSON.stringify({ tree: options.profileTree }).replace(/</g, "\\u003c")
		: "null";
	const wrapClass = options.profileTree ? "wrap flamewrap" : "wrap";

	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stress Report — ${esc(report.scenario)} (${esc(report.profile)})</title>
<style>${inlineSafe(STYLE)}</style>
</head>
<body>
  <div class="${wrapClass}">
    <h1>Stress Report — ${esc(report.scenario)} <span class="muted">(${esc(report.profile)})</span></h1>
    <div class="meta">Run ${esc(report.runId)} · ${esc(report.startedAt)} → ${esc(report.finishedAt)}</div>
    <div class="meta">Git ${esc(git.branch)} @ ${esc(git.commit.slice(0, 8))}${git.dirty ? " (dirty)" : ""} · ${esc(env.os)} · ${esc(env.arch)} · ${esc(env.cpuModel)} ×${env.cpuCount} · node ${esc(env.nodeVersion)}${env.pluginVersion ? ` · plugin ${esc(env.pluginVersion)}` : ""}</div>
    <div class="cards">${cardsHtml(report)}</div>
    ${flame}
    <h2>Stage timings (load &amp; loops)</h2>
    ${timingsHtml(report.timings)}
    <h2>Top self-time (CPU profile)</h2>
    ${digestHtml(report.profileDigest)}
    <h2>Heap</h2>
    ${heapHtml(report.heapDigest)}
    <h2>Regressions vs baseline (same machine)</h2>
    ${regressionsHtml(report.regressions)}
    <h2>Budget failures</h2>
    ${budgetsHtml(report.budgetFailures)}
    <h2>Counts</h2>
    ${countsHtml(report.counts)}
    <h2>Artifacts</h2>
    ${artifactsHtml(report.artifacts)}
  </div>
  <script>window.__STRESS__ = ${treeBlob};</script>
  <script>${inlineSafe(FLAME_JS)}</script>
</body></html>
`;
}
