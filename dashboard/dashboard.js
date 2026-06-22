function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadData() {
  try {
    const data = await fetch("/api/dashboard-data").then((response) => response.json());
    document.getElementById("active-pack").innerText = data.prompt_sources.length ? "Custom/Core" : "None";
    document.getElementById("prompt-sources-list").innerHTML = data.prompt_sources.map((source) => `
      <li class="prompt-item">
        <span class="prompt-path">${escapeHtml(source.id)}</span>
        <span class="badge ${source.role === "constitutional" ? "badge-primary" : "badge-amber"}">${escapeHtml(source.role)}</span>
      </li>
    `).join("");

    const memoryList = document.getElementById("memory-docs-list");
    if (!data.docs?.length) {
      memoryList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 2rem;">No indexed memory items found.</div>';
      return;
    }

    memoryList.innerHTML = data.docs.map((doc) => {
      const confidencePct = Math.round(doc.confidence * 100);
      const decayPct = Math.round(doc.decay * 100);
      return `
        <div class="doc-item">
          <div class="doc-header">
            <span class="doc-path">${escapeHtml(doc.id)}</span>
            <span class="badge badge-primary">${escapeHtml(doc.kind)}</span>
          </div>
          <div class="doc-metrics">
            <div class="doc-metric">
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Confidence:</span>
              <div class="bar-container"><div class="bar-fill" style="width: ${confidencePct}%; background-color: var(--primary);"></div></div>
              <span class="metric-value">${confidencePct}%</span>
            </div>
            <div class="doc-metric">
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Decay Factor:</span>
              <div class="bar-container"><div class="bar-fill" style="width: ${decayPct}%; background-color: ${doc.decay < 0.5 ? "var(--rose)" : "var(--emerald)"};"></div></div>
              <span class="metric-value">${decayPct}% (${Math.round(doc.ageInDays)}d old)</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tabTarget === tabId));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.toggle("active", content.id === tabId));
}

async function runSearch() {
  const query = document.getElementById("search-query").value.trim();
  if (!query) return;
  const body = document.getElementById("search-results-body");
  body.innerHTML = '<tr><td colspan="5" style="text-align: center;">Retrieving...</td></tr>';
  try {
    const data = await fetch(`/api/dashboard-query?q=${encodeURIComponent(query)}`).then((response) => response.json());
    if (!data.snippets?.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No matching snippets returned from the sieve.</td></tr>';
      return;
    }
    body.innerHTML = data.snippets.map((snippet) => {
      const reasons = snippet.reasons.map((reason) => `<span class="badge badge-amber" style="margin-right: 0.25rem;">${escapeHtml(reason)}</span>`).join("");
      return `
        <tr>
          <td><span class="file-path">${escapeHtml(snippet.id)}</span></td>
          <td>${Math.round((snippet.confidence ?? 1) * 100)}%</td>
          <td>${Math.round((snippet.decay ?? 1) * 100)}%</td>
          <td style="font-weight: bold; color: var(--emerald);">${Number(snippet.score).toFixed(2)}</td>
          <td>${reasons || '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>'}</td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--rose);">Error running query: ${escapeHtml(error.message)}</td></tr>`;
  }
}

document.querySelectorAll("[data-tab-target]").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tabTarget));
});
document.getElementById("search-button").addEventListener("click", runSearch);
document.getElementById("search-query").addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
loadData();
