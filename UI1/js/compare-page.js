import { compareSides, getToken } from "./api.js";

const $ = (id) => document.getElementById(id);

const SIDES = ["front", "back", "left", "right"];
const GROUPS = ["listing", "incoming"];
const cap = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const inputId = (group, side) => `cmp${cap(group)}${cap(side)}`;
const prevId = (group, side) => `prev${cap(group)}${cap(side)}`;

const objectUrls = new WeakMap();

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function label(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function verdictColor(value) {
  return {
    SAME_ITEM: "#16a34a",
    SAME_PRODUCT: "#2563eb",
    SAME_TYPE: "#d97706",
    DIFFERENT: "#dc2626",
    REVIEW: "#7c3aed",
  }[value] || "#6b7280";
}

function previewFile(input, preview) {
  const previousUrl = objectUrls.get(input);
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    objectUrls.delete(input);
  }

  const file = input.files?.[0];
  if (!file) {
    preview.innerHTML = "";
    return;
  }

  const url = URL.createObjectURL(file);
  objectUrls.set(input, url);
  preview.innerHTML = `<img src="${url}" alt="${esc(file.name)} preview" />`;
}

function collect(group) {
  return SIDES.reduce((files, side) => {
    const file = $(inputId(group, side))?.files?.[0];
    if (file) {
      files[side] = file;
    }
    return files;
  }, {});
}

function missingSlots(listing, incoming) {
  const missing = [];
  SIDES.forEach((side) => {
    if (!listing[side]) missing.push(`Listing ${label(side)}`);
    if (!incoming[side]) missing.push(`Item received ${label(side)}`);
  });
  return missing;
}

function renderSide(side, result) {
  const color = verdictColor(result.verdict);
  const attrRows = (result.matched_attributes || [])
    .map(
      (attribute) => `
    <tr>
      <td>${esc(attribute.attribute)}</td>
      <td>${esc(attribute.image1_value)}</td>
      <td>${esc(attribute.image2_value)}</td>
      <td style="text-align:center">${attribute.matches ? "✓" : "✗"}</td>
    </tr>`
    )
    .join("");
  const list = (items) =>
    (items || []).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>-</li>";

  return `
    <div class="cmp-side">
      <div class="cmp-side-head">
        <span class="cmp-pill" style="background:${color}">${esc(side)} · ${label(result.verdict)}</span>
        <span class="cmp-conf">${esc(result.same_item_confidence)}% same-item · ${esc(result.overall_similarity)}% similar</span>
      </div>
      <p class="cmp-reason">${esc(result.reasoning)}</p>
      <table class="cmp-table">
        <thead>
          <tr><th>Attribute</th><th>Listing</th><th>Received</th><th>Match</th></tr>
        </thead>
        <tbody>${attrRows || `<tr><td colspan="4">No attributes returned.</td></tr>`}</tbody>
      </table>
      <div class="cmp-lists">
        <div><h5>Distinguishing details</h5><ul>${list(result.distinguishing_details)}</ul></div>
        <div><h5>Differences</h5><ul>${list(result.differences)}</ul></div>
      </div>
    </div>`;
}

function renderResult(data) {
  const el = $("compareResult");
  if (!el) return;
  el.hidden = false;

  if (!data || data.error) {
    el.innerHTML = `<p class="cmp-err">Error: ${esc(data?.message || "Something went wrong")}</p>`;
    return;
  }

  const finalVerdict = data.final_verdict || "UNKNOWN";
  const color = verdictColor(finalVerdict);
  const flags = [];

  (data.diff_sides || []).forEach((side) =>
    flags.push(`<span class="cmp-flag" style="background:#dc2626">differs: ${esc(side)}</span>`)
  );
  (data.detail_sides || []).forEach((side) =>
    flags.push(`<span class="cmp-flag" style="background:#16a34a">confirmed: ${esc(side)}</span>`)
  );
  Object.keys(data.errors || {}).forEach((side) =>
    flags.push(`<span class="cmp-flag" style="background:#6b7280">error: ${esc(side)}</span>`)
  );

  const perSide = data.per_side || {};
  const sideCards = SIDES.filter((side) => perSide[side])
    .map((side) => renderSide(side, perSide[side]))
    .join("");

  el.innerHTML = `
    <div class="cmp-final" style="border-color:${color}">
      <strong style="color:${color}">${label(finalVerdict)}</strong>
      <div class="cmp-final-meta">
        <span>min ${esc(data.min_confidence ?? "-")}%</span>
        <span>mean ${esc(data.mean_confidence ?? "-")}%</span>
      </div>
    </div>
    ${flags.length ? `<div class="cmp-flags">${flags.join("")}</div>` : ""}
    ${sideCards || `<p class="cmp-err">${esc(data.reason || "No comparison result was returned.")}</p>`}
  `;
}

async function runCompare() {
  if (!getToken()) {
    alert("Please sign in on the marketplace before running image verification.");
    return;
  }

  const listing = collect("listing");
  const incoming = collect("incoming");
  const missing = missingSlots(listing, incoming);

  if (missing.length) {
    alert(`Please add all 8 photos. Missing:\n- ${missing.join("\n- ")}`);
    return;
  }

  const btn = $("runCompareBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Analyzing...</span>";

  try {
    const result = await compareSides(listing, incoming);
    renderResult(result);
  } catch (err) {
    renderResult({ error: true, message: err?.message || "Network error" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
    if (window.lucide) window.lucide.createIcons();
  }
}

function wireUp() {
  GROUPS.forEach((group) => {
    SIDES.forEach((side) => {
      const input = $(inputId(group, side));
      const preview = $(prevId(group, side));
      if (input && preview) {
        input.addEventListener("change", (event) => previewFile(event.target, preview));
      }
    });
  });

  $("runCompareBtn")?.addEventListener("click", runCompare);
  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUp);
} else {
  wireUp();
}
