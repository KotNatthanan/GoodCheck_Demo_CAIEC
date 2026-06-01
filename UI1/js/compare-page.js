import { compareImages } from "./api.js";

const $ = (id) => document.getElementById(id);

function previewFile(input, previewEl) {

  const file = input.files && input.files[0];
  if (!file) {
    previewEl.innerHTML = "";
    return;
  }

  previewEl.innerHTML = `
    <img src="${URL.createObjectURL(file)}"
         alt="preview"
         style="width:100%;max-height:240px;object-fit:cover;">
  `;
}
function verdictColor(v) {
  return { SAME_ITEM:"#16a34a", SAME_PRODUCT:"#2563eb", SAME_TYPE:"#d97706", DIFFERENT:"#dc2626" }[v] || "#6b7280";
}

function renderResult(data) {
  const el = $("compareResult");
  el.hidden = false;
  if (data.error) {
    el.innerHTML = `<p style="color:#dc2626">Error: ${data.message || "Something went wrong"}</p>`;
    return;
  }
  const attrRows = (data.matched_attributes || []).map(a => `
    <tr><td>${a.attribute}</td><td>${a.image1_value}</td><td>${a.image2_value}</td>
    <td style="text-align:center">${a.matches ? "✓" : "✗"}</td></tr>`).join("");
  const list = (arr) => (arr || []).map(x => `<li>${x}</li>`).join("") || "<li>—</li>";
  el.innerHTML = `
    <div class="compare-verdict" style="border-color:${verdictColor(data.verdict)}">
      <strong style="color:${verdictColor(data.verdict)}">${data.verdict.replace(/_/g," ")}</strong>
      <span>${data.product_category || ""}</span>
    </div>
    <div class="compare-scores">
      <div><label>Overall similarity</label><strong>${data.overall_similarity}%</strong></div>
      <div><label>Same-item confidence</label><strong>${data.same_item_confidence}%</strong></div>
      <div><label>Same physical item?</label><strong>${data.is_same_item ? "Yes" : "No"}</strong></div>
    </div>
    <p class="compare-reasoning">${data.reasoning || ""}</p>
    <table class="compare-table">
      <thead><tr><th>Attribute</th><th>Image 1</th><th>Image 2</th><th>Match</th></tr></thead>
      <tbody>${attrRows}</tbody>
    </table>
    <div class="compare-lists">
      <div><h4>Distinguishing details</h4><ul>${list(data.distinguishing_details)}</ul></div>
      <div><h4>Differences</h4><ul>${list(data.differences)}</ul></div>
    </div>`;
}

async function runCompare() {
  const f1 = $("compareImage1").files && $("compareImage1").files[0];
  const f2 = $("compareImage2").files && $("compareImage2").files[0];
  if (!f1 || !f2) { alert("Please select both images."); return; }

  const btn = $("runCompareBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Analyzing…</span>";
  const result = await compareImages(f1, f2);
  renderResult(result);

  btn.disabled = false;
  btn.innerHTML = original;
  if (window.lucide) window.lucide.createIcons();
}

function wireUp() {
  const i1 = $("compareImage1");
  const i2 = $("compareImage2");
  if (i1) i1.addEventListener("change", (e) => previewFile(e.target, $("comparePreview1")));
  if (i2) i2.addEventListener("change", (e) => previewFile(e.target, $("comparePreview2")));
  const btn = $("runCompareBtn");
  if (btn) btn.addEventListener("click", runCompare);
  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUp);
} else {
  wireUp();
}