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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { ok: false, error: text || response.statusText };
  }
  if (!response.ok) {
    throw new Error(body?.error || response.statusText || `HTTP ${response.status}`);
  }
  return body;
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

function setTrace(value) {
  document.getElementById("console-trace").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setReceipt(value) {
  document.getElementById("console-receipt").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function renderRecords(report) {
  const body = document.getElementById("console-records-body");
  if (!report.records?.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No retained client continuity records.</td></tr>';
    return;
  }
  body.innerHTML = report.records.map((record) => {
    const expiry = record.expiry?.expired
      ? '<span class="badge badge-rose">Expired</span>'
      : `${Number(record.expiry?.remaining_hours ?? 0)}h`;
    return `
      <tr>
        <td><span class="file-path">${escapeHtml(record.conversation_key)}</span></td>
        <td>${escapeHtml(record.client_id || "unknown")}</td>
        <td>${escapeHtml(record.service_id || "unknown")}</td>
        <td>${Number(record.history?.rows ?? 0)}</td>
        <td>${expiry}</td>
        <td>
          <div class="record-actions">
            <button class="btn btn-secondary btn-small" data-continuity-export="${escapeHtml(record.conversation_key)}">Export</button>
            <button class="btn btn-danger btn-small" data-continuity-delete="${escapeHtml(record.conversation_key)}">Revoke</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function loadContinuityRecords() {
  const body = document.getElementById("console-records-body");
  body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading...</td></tr>';
  try {
    const report = await fetchJson("/api/operator-continuity");
    renderRecords(report);
  } catch (error) {
    body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--rose);">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function runOperatorExecute() {
  const brief = document.getElementById("console-brief").value.trim();
  const continuityMode = document.getElementById("console-continuity-mode").value;
  const payload = {
    brief,
    continuity_mode: continuityMode,
    client_id: document.getElementById("console-client-id").value.trim(),
    service_id: document.getElementById("console-service-id").value.trim(),
  };
  setTrace({ status: "running", request: payload });
  setReceipt("Running...");
  try {
    const result = await fetchJson("/api/operator-execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setTrace({
      status: "completed",
      response: {
        ok: result.ok,
        kind: result.kind,
        continuity_mode: result.continuity_mode,
        retention_scope: result.retention_scope,
        conversation_key: result.conversation_key,
        text: result.text,
      },
    });
    setReceipt({
      capability_receipt: result.capability_receipt || null,
      retrieval_audit: result.capability_receipt?.retrieval_audit || null,
      skills: result.capability_receipt?.skills || null,
    });
    await loadContinuityRecords();
  } catch (error) {
    setTrace({ status: "failed", error: error.message });
    setReceipt("No receipt.");
  }
}

async function exportContinuityRecord(key) {
  setTrace({ status: "exporting", conversation_key: key });
  try {
    const result = await fetchJson(`/api/operator-continuity/export?conversation_key=${encodeURIComponent(key)}`);
    setTrace({ status: "exported", export: result });
  } catch (error) {
    setTrace({ status: "export_failed", conversation_key: key, error: error.message });
  }
}

async function deleteContinuityRecord(key) {
  if (!window.confirm(`Revoke continuity record ${key}?`)) return;
  setTrace({ status: "revoking", conversation_key: key });
  try {
    const result = await fetchJson("/api/operator-continuity/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_key: key }),
    });
    setTrace({ status: "revoked", result });
    await loadContinuityRecords();
  } catch (error) {
    setTrace({ status: "revoke_failed", conversation_key: key, error: error.message });
  }
}

document.querySelectorAll("[data-tab-target]").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tabTarget));
});
document.getElementById("search-button").addEventListener("click", runSearch);
document.getElementById("search-query").addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
document.getElementById("console-execute-button").addEventListener("click", runOperatorExecute);
document.getElementById("console-refresh-records").addEventListener("click", loadContinuityRecords);
document.getElementById("console-records-body").addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-continuity-export]");
  if (exportButton) {
    exportContinuityRecord(exportButton.dataset.continuityExport);
    return;
  }
  const deleteButton = event.target.closest("[data-continuity-delete]");
  if (deleteButton) deleteContinuityRecord(deleteButton.dataset.continuityDelete);
});
loadData();
loadContinuityRecords();
