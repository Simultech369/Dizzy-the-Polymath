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
    const runtimeBadge = document.getElementById("runtime-status-badge");
    if (runtimeBadge) {
      runtimeBadge.className = "badge badge-emerald";
      runtimeBadge.innerHTML = '<span class="status-dot"></span>Runtime Online';
    }
    const chatBackendBadge = document.getElementById("chat-backend-badge");
    if (chatBackendBadge) {
      const backend = data.runtime?.chat_backend || data.runtime?.chat_backend_status || "Local route available";
      chatBackendBadge.className = "badge badge-primary";
      chatBackendBadge.textContent = backend;
    }
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
    } else {
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
                <div class="bar-container"><div class="bar-fill" style="width: ${confidencePct}%; background-color: var(--cyan);"></div></div>
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
    }
    await loadReceiptsTelemetry();
  } catch (error) {
    console.error(error);
    const runtimeBadge = document.getElementById("runtime-status-badge");
    if (runtimeBadge) {
      runtimeBadge.className = "badge badge-rose";
      runtimeBadge.innerHTML = '<span class="status-dot"></span>Local API unavailable';
    }
    const chatBackendBadge = document.getElementById("chat-backend-badge");
    if (chatBackendBadge) {
      chatBackendBadge.className = "badge badge-rose";
      chatBackendBadge.textContent = "Route unavailable";
    }
    document.getElementById("active-pack").innerText = "Unavailable";
    document.getElementById("prompt-sources-list").innerHTML = `
      <li class="prompt-item">
        <span class="prompt-path">Local API unavailable</span>
        <span class="badge badge-rose">offline</span>
      </li>
    `;
    document.getElementById("memory-docs-list").innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 2rem;">
        Local dashboard data is unavailable.
      </div>
    `;
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
    const data = await fetchJson(`/api/dashboard-query?q=${encodeURIComponent(query)}`);
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

function rawDetails(label, value, open = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return `
    <details class="raw-json"${open ? " open" : ""}>
      <summary>${escapeHtml(label)}</summary>
      <pre class="console-pre">${escapeHtml(text)}</pre>
    </details>
  `;
}

function summaryCard({ title, tone = "", lines = [], facts = [] }) {
  const lineHtml = lines.length
    ? `<div class="summary-lines">${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>`
    : "";
  const factHtml = facts.length
    ? `<div class="summary-grid">${facts.map((fact) => `
        <div class="summary-item">
          <span class="summary-label">${escapeHtml(fact.label)}</span>
          <span class="summary-value">${escapeHtml(fact.value)}</span>
        </div>
      `).join("")}</div>`
    : "";
  return `
    <div class="summary-card ${escapeHtml(tone)}">
      <div class="summary-title">${escapeHtml(title)}</div>
      ${lineHtml}
      ${factHtml}
    </div>
  `;
}

function setPanel(id, html, { focus = false } = {}) {
  const el = document.getElementById(id);
  el.innerHTML = html;
  if (focus) {
    el.closest(".console-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function setTrace(value) {
  setPanel("console-trace", `${summaryCard({
    title: typeof value === "string" ? value : "Trace updated",
    lines: typeof value === "string" ? [] : [String(value?.status || "Raw trace available.")],
  })}${rawDetails("Raw JSON", value, true)}`);
}

function setReceipt(value) {
  setPanel("console-receipt", `${summaryCard({
    title: typeof value === "string" ? value : "Receipt updated",
    lines: typeof value === "string" ? [] : ["Raw receipt details are available below."],
  })}${rawDetails("Raw JSON", value, true)}`);
}

function boolLabel(value, yes, no) {
  return value ? yes : no;
}

function previewText(value, maxChars = 360) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

function formatExpiry(expiry) {
  if (expiry?.expired) return "Expired";
  if (expiry?.remaining_hours == null) return "Unknown";
  const hours = Math.max(0, Number(expiry.remaining_hours) || 0);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days <= 0) return `expires in ${remHours}h`;
  return `expires in ${days}d ${remHours}h`;
}

function formatIso(value) {
  if (!value) return "unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function renderReceiptSummary(receipt, raw = receipt, { focus = false } = {}) {
  if (!receipt) {
    setPanel("console-receipt", summaryCard({
      title: "No receipt returned",
      tone: "warning",
      lines: ["The run completed without a capability receipt."],
    }), { focus });
    return;
  }

  const skills = receipt.skills || {};
  const loadedSkills = Array.isArray(skills.loaded) && skills.loaded.length
    ? skills.loaded.join(", ")
    : "none";
  const blocked = Array.isArray(receipt.blocked_context) && receipt.blocked_context.length
    ? receipt.blocked_context.join(", ")
    : "none";

  setPanel("console-receipt", `
    ${summaryCard({
      title: "Capability receipt",
      tone: "success",
      lines: [
        `Trust zone: ${receipt.trust_zone || "unknown"}`,
        `Retention: ${receipt.retention_scope || "unknown"}`,
      ],
      facts: [
        { label: "Repo retrieval", value: boolLabel(receipt.repo_retrieval_allowed, "allowed", "blocked") },
        { label: "Durable memory", value: boolLabel(receipt.durable_memory_allowed, "allowed", "blocked") },
        { label: "Private memory", value: boolLabel(receipt.private_memory_access, "accessed", "not accessed") },
        { label: "Skills", value: loadedSkills },
        { label: "Blocked context", value: blocked },
        { label: "Deletion path", value: receipt.boundary_crossing?.revocation_or_deletion_path || "unknown" },
      ],
    })}
    ${rawDetails("Raw receipt JSON", raw)}
  `, { focus });
}

function renderExecutionTrace(result, raw = result) {
  const retained = result.retention_scope === "conversation_only";
  const failedText = String(result.text || "").toLowerCase().includes("failed");
  const tone = result.ok === false ? "danger" : failedText ? "warning" : "success";
  const title = result.ok === false
    ? "Execution failed"
    : retained
      ? "Client continuity record created"
      : "Ephemeral execution complete";
  setPanel("console-trace", `
    ${summaryCard({
      title,
      tone,
      lines: [
        retained ? "This run was retained as client-scoped continuity." : "No continuity record was retained.",
        result.text ? `Assistant result: ${previewText(result.text)}` : `Result kind: ${result.kind || "unknown"}`,
      ],
      facts: [
        { label: "Mode", value: result.continuity_mode || "unknown" },
        { label: "Retention", value: result.retention_scope || "unknown" },
        { label: "Record", value: retained ? result.conversation_key : "none retained" },
      ],
    })}
    ${rawDetails("Raw response JSON", raw)}
  `, { focus: true });
}

function renderConversationRows(rows = []) {
  if (!rows.length) {
    return summaryCard({
      title: "No conversation rows",
      tone: "warning",
      lines: ["The export did not include transcript rows."],
    });
  }
  return `
    <div class="conversation-list">
      ${rows.map((row) => {
        const role = String(row.role || "entry").toLowerCase();
        const klass = role === "user" ? "bubble-user" : "bubble-assistant";
        return `
          <div class="bubble ${klass}">
            <div class="bubble-meta">${escapeHtml(role)} - ${escapeHtml(formatIso(row.t))}</div>
            <div>${escapeHtml(row.text || JSON.stringify(row))}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderExportTrace(result, raw = result) {
  const exclusions = result.redaction?.excludes?.length
    ? result.redaction.excludes.join(", ")
    : "standard private/sensitive exclusions";
  setPanel("console-trace", `
    ${summaryCard({
      title: "Export complete",
      tone: "success",
      lines: [
        "The retained client continuity record was exported for inspection.",
        `Redaction excludes: ${exclusions}`,
      ],
      facts: [
        { label: "Record", value: result.conversation_key || "unknown" },
        { label: "History rows", value: String(result.counts?.history_rows ?? 0) },
        { label: "Conversation rows", value: String(result.counts?.conversation_rows ?? 0) },
        { label: "Format", value: result.format || "json" },
      ],
    })}
    ${renderConversationRows(result.conversation || [])}
    ${rawDetails("Raw export JSON", raw)}
  `, { focus: true });
}

function renderAuditList(title, items, formatter) {
  if (!items?.length) {
    return summaryCard({
      title,
      lines: ["None reported in persisted audit sources."],
    });
  }
  return `
    <div class="summary-card">
      <div class="summary-title">${escapeHtml(title)}</div>
      <div class="summary-lines">
        ${items.map((item) => `<div>${escapeHtml(formatter(item))}</div>`).join("")}
      </div>
    </div>
  `;
}

function renderAuditTrace(audit, raw = audit) {
  const recordState = audit.record_state || audit.integrity?.status || "unknown";
  const retrievalStatus = audit.retrieval?.status || "unknown";
  const tone = recordState === "failed"
    ? "danger"
    : recordState === "review_anomalies" || recordState === "deleted"
      ? "warning"
      : "";
  const anomalies = audit.integrity?.anomalies || [];
  setPanel("console-trace", `
    ${summaryCard({
      title: "Continuity audit",
      tone,
      lines: [
        "Best-effort reconstruction from local logs and persisted receipts.",
        `Proof limit: ${audit.proof_limit || "unknown"}`,
        `Certainty: ${audit.certainty || "unknown"}`,
      ],
      facts: [
        { label: "Record", value: audit.conversation_key || "unknown" },
        { label: "Lifecycle", value: recordState },
        { label: "Retrieval status", value: retrievalStatus },
        { label: "History rows", value: String(audit.counts?.history_rows ?? 0) },
        { label: "Conversation rows", value: String(audit.counts?.conversation_rows ?? 0) },
        { label: "Deletion events", value: String(audit.counts?.deletion_events ?? 0) },
        { label: "Anomalies", value: String(audit.counts?.anomalies ?? anomalies.length) },
        { label: "Repo retrieval", value: boolLabel(audit.boundary?.repo_retrieval_allowed, "allowed", "blocked") },
        { label: "Private memory", value: boolLabel(audit.boundary?.private_memory_access, "accessed", "not accessed") },
      ],
    })}
    ${summaryCard({
      title: "Audit sources",
      lines: [
        `History: ${audit.source?.history_path || "unknown"}`,
        `Conversation: ${audit.source?.conversation_path || "none"} (${audit.source?.conversation_file_exists ? "exists" : "missing"})`,
        `Deletion log: ${audit.revocation?.deletion_log_path || "unknown"}`,
        `Revocation command: ${audit.revocation?.delete_command || "unknown"}`,
      ],
    })}
    ${renderAuditList("Retrieved files reported by receipts", audit.retrieval?.retrieved_files || [], (item) => item)}
    ${renderAuditList("Filtered retrieval decisions (query token matches only)", audit.retrieval?.filtered_files || [], (item) => `${item.path || "unknown"} - ${item.reason || "unknown"}${item.details ? ` - ${item.details}` : ""}`)}
    ${renderAuditList("Anomalies", anomalies, (item) => `${item.kind || "unknown"} from ${item.source || "unknown"} (${item.severity || "notice"})`)}
    ${rawDetails("Raw audit JSON", raw, true)}
  `, { focus: true });
}

function renderRevocationTrace(result, raw = result) {
  setPanel("console-trace", `
    ${summaryCard({
      title: result.deleted ? "Record revoked" : "Record not found",
      tone: result.deleted ? "success" : "warning",
      lines: [
        result.deleted
          ? "The selected client continuity record was removed."
          : "No retained file was removed for this key.",
      ],
      facts: [
        { label: "Record", value: result.conversation_key || "unknown" },
        { label: "Conversation file", value: result.removed_conversation_file ? "removed" : "not removed" },
        { label: "History rows", value: String(result.removed_history_rows ?? 0) },
        { label: "Deletion log", value: result.deletion_log_path || "unknown" },
      ],
    })}
    ${rawDetails("Raw revocation JSON", raw)}
  `, { focus: true });
}

function setButtonBusy(button, text) {
  if (!button) return;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.disabled = true;
  button.textContent = text;
}

function flashButtonDone(button, text, className = "btn-success") {
  if (!button) return;
  const original = button.dataset.originalText || button.textContent;
  button.textContent = text;
  button.classList.add(className);
  window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove(className);
    button.disabled = false;
  }, 1500);
}

function resetButton(button) {
  if (!button) return;
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
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
      : escapeHtml(formatExpiry(record.expiry));
    return `
      <tr>
        <td><span class="file-path">${escapeHtml(record.conversation_key)}</span></td>
        <td>${escapeHtml(record.client_id || "unknown")}</td>
        <td>${escapeHtml(record.service_id || "unknown")}</td>
        <td>${Number(record.history?.rows ?? 0)}</td>
        <td>${expiry}</td>
        <td>
          <div class="record-actions">
            <button class="btn btn-secondary btn-small" data-continuity-audit="${escapeHtml(record.conversation_key)}">Audit</button>
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
  body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Retrieving records...</td></tr>';
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
    const responseSummary = {
      ok: result.ok,
      kind: result.kind,
      continuity_mode: result.continuity_mode,
      retention_scope: result.retention_scope,
      conversation_key: result.conversation_key,
      text: result.text,
    };
    renderExecutionTrace(responseSummary, result);
    renderReceiptSummary(result.capability_receipt, {
      capability_receipt: result.capability_receipt || null,
      retrieval_audit: result.capability_receipt?.retrieval_audit || null,
      skills: result.capability_receipt?.skills || null,
    });
    await loadContinuityRecords();
  } catch (error) {
    setPanel("console-trace", `${summaryCard({
      title: "Execution failed",
      tone: "danger",
      lines: [error.message],
    })}${rawDetails("Raw error", { status: "failed", error: error.message }, true)}`, { focus: true });
    setReceipt("No receipt.");
  }
}

async function auditContinuityRecord(key, button) {
  setButtonBusy(button, "Auditing...");
  setTrace({ status: "auditing", conversation_key: key });
  try {
    const result = await fetchJson(`/api/operator-continuity/audit?conversation_key=${encodeURIComponent(key)}`);
    renderAuditTrace(result);
    flashButtonDone(button, "Audited");
  } catch (error) {
    resetButton(button);
    setPanel("console-trace", `${summaryCard({
      title: "Audit failed",
      tone: "danger",
      lines: [error.message],
      facts: [{ label: "Record", value: key }],
    })}${rawDetails("Raw error", { status: "audit_failed", conversation_key: key, error: error.message }, true)}`, { focus: true });
  }
}

async function exportContinuityRecord(key, button) {
  setButtonBusy(button, "Exporting...");
  setTrace({ status: "exporting", conversation_key: key });
  try {
    const result = await fetchJson(`/api/operator-continuity/export?conversation_key=${encodeURIComponent(key)}`);
    renderExportTrace(result);
    flashButtonDone(button, "Exported");
  } catch (error) {
    resetButton(button);
    setPanel("console-trace", `${summaryCard({
      title: "Export failed",
      tone: "danger",
      lines: [error.message],
      facts: [{ label: "Record", value: key }],
    })}${rawDetails("Raw error", { status: "export_failed", conversation_key: key, error: error.message }, true)}`, { focus: true });
  }
}

async function deleteContinuityRecord(key, button) {
  if (!window.confirm(`Revoke continuity record ${key}?`)) return;
  setButtonBusy(button, "Revoking...");
  setTrace({ status: "revoking", conversation_key: key });
  try {
    const result = await fetchJson("/api/operator-continuity/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_key: key }),
    });
    renderRevocationTrace(result);
    flashButtonDone(button, "Revoked");
    await loadContinuityRecords();
  } catch (error) {
    resetButton(button);
    setPanel("console-trace", `${summaryCard({
      title: "Revoke failed",
      tone: "danger",
      lines: [error.message],
      facts: [{ label: "Record", value: key }],
    })}${rawDetails("Raw error", { status: "revoke_failed", conversation_key: key, error: error.message }, true)}`, { focus: true });
  }
}

async function loadGovernanceData() {
  try {
    const hw = await fetchJson("/api/operator/hardware-status");
    const memoryUsedPct = Math.max(0, Math.min(100, Math.round(((hw.total_memory_gb - hw.free_memory_gb) / Math.max(hw.total_memory_gb, 0.01)) * 100)));
    document.getElementById("memory-bar-fill").style.width = `${memoryUsedPct}%`;
    document.getElementById("memory-val").textContent = `${hw.free_memory_gb} GB Free / ${hw.total_memory_gb} GB Total (${memoryUsedPct}% Used)`;
    document.getElementById("active-model-route").textContent = hw.active_model_route;
    document.getElementById("active-routing-basis").textContent = hw.active_routing_basis;

    const compPct = Math.round(hw.context_compression_ratio * 100);
    document.getElementById("compression-bar-fill").style.width = `${compPct}%`;
    document.getElementById("compression-val").textContent = `${compPct}% of Original`;

    const warningBanner = document.getElementById("routing-warning-banner");
    if (hw.context_compression_ratio < 0.50) {
      warningBanner.innerHTML = `
        <div class="warning-banner">
          <span style="font-weight: 700;">WARNING:</span>
          Context compression active - potential minor coherence loss on deep history.
        </div>
      `;
    } else {
      warningBanner.innerHTML = "";
    }

    const con = await fetchJson("/api/operator/consensus-map");
    
    // Update SVG Chain Nodes
    updateSvgNode("node-circle-codex", "node-text-codex", con.signing_chain.codex);
    updateSvgNode("node-circle-openclaude", "node-text-openclaude", con.signing_chain.openclaude);
    updateSvgNode("node-circle-antigravity", "node-text-antigravity", con.signing_chain.antigravity);

    // Update SVG Connection lines
    updateSvgLine("line-codex-openclaude", con.signing_chain.codex, con.signing_chain.openclaude);
    updateSvgLine("line-openclaude-antigravity", con.signing_chain.openclaude, con.signing_chain.antigravity);

    const statusBadge = document.getElementById("consensus-status-badge");
    statusBadge.textContent = con.consensus_status;
    statusBadge.className = "badge " + (con.consensus_status === "Consensus Reached" ? "badge-emerald" : con.consensus_status === "Vetoed" ? "badge-rose" : "badge-amber");
    document.getElementById("consensus-proof-limit").textContent = con.proof_limit || "not_cryptographic_not_live_multi_agent_protocol";

    // Render 2D Options Coordinates Map
    const coordMap = document.getElementById("coordinate-map");
    // Clear old nodes (keep grid and tooltip)
    const oldNodes = coordMap.querySelectorAll(".consensus-node");
    oldNodes.forEach(node => node.remove());

    const tooltip = document.getElementById("node-tooltip-element");

    // Coordinates mapping presets
    const coords = [
      { left: "25%", top: "35%", color: "#10b981" }, // Low friction
      { left: "60%", top: "65%", color: "#f59e0b" }, // Medium friction
      { left: "80%", top: "20%", color: "#f43f5e" }  // High friction
    ];

    con.options.forEach((opt, idx) => {
      const coord = coords[idx] || { left: `${20 + idx * 25}%`, top: `${30 + (idx % 2) * 30}%`, color: "#6366f1" };
      const dot = document.createElement("div");
      dot.className = "consensus-node";
      dot.style.left = coord.left;
      dot.style.top = coord.top;
      dot.style.color = coord.color;
      dot.style.backgroundColor = coord.color;
      
      dot.addEventListener("mouseenter", () => {
        tooltip.innerHTML = `
          <strong style="color: ${coord.color};">${escapeHtml(opt.option_id.toUpperCase())}</strong>: 
          ${escapeHtml(opt.description)} 
          (<span style="color: ${coord.color}; font-weight: bold;">${escapeHtml(opt.friction)} friction</span>)
        `;
        tooltip.style.opacity = "1";
      });

      dot.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
      });

      coordMap.appendChild(dot);
    });

    const pre = await fetchJson("/api/operator/sandbox-preflight");
    document.getElementById("sandbox-terminal-log").textContent = pre.logs;

  } catch (error) {
    console.error("Failed to load governance details:", error);
    document.getElementById("memory-val").textContent = "Unavailable";
    document.getElementById("active-model-route").textContent = "Offline";
    document.getElementById("active-model-route").className = "badge badge-rose";
    document.getElementById("active-routing-basis").textContent = "Local telemetry unavailable";
    document.getElementById("compression-val").textContent = "Unavailable";
    document.getElementById("routing-warning-banner").innerHTML = `
      <div class="warning-banner">
        <span style="font-weight: 700;">LOCAL DATA UNAVAILABLE:</span>
        Operator telemetry could not be loaded.
      </div>
    `;
  }
}

function updateSvgNode(circleId, textId, status) {
  const circle = document.getElementById(circleId);
  const text = document.getElementById(textId);
  if (!circle || !text) return;

  text.textContent = status;

  if (status === "SIGNED") {
    circle.setAttribute("fill", "#064e3b");
    circle.setAttribute("stroke", "#10b981");
    circle.removeAttribute("filter");
    text.setAttribute("fill", "#34d399");
  } else if (status === "VETOED") {
    circle.setAttribute("fill", "#4c0519");
    circle.setAttribute("stroke", "#f43f5e");
    circle.removeAttribute("filter");
    text.setAttribute("fill", "#fda4af");
  } else {
    circle.setAttribute("fill", "#161e31");
    circle.setAttribute("stroke", "#f59e0b");
    circle.removeAttribute("filter");
    text.setAttribute("fill", "#9ca3af");
  }
}

function updateSvgLine(lineId, leftStatus, rightStatus) {
  const line = document.getElementById(lineId);
  if (!line) return;

  if (leftStatus === "SIGNED" && rightStatus === "SIGNED") {
    line.setAttribute("stroke", "#10b981");
  } else if (leftStatus === "VETOED" || rightStatus === "VETOED") {
    line.setAttribute("stroke", "#f43f5e");
  } else if (leftStatus === "SIGNED") {
    line.setAttribute("stroke", "#6366f1");
  } else {
    line.setAttribute("stroke", "#22304d");
  }
}

document.querySelectorAll("[data-tab-target]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tabTarget;
    switchTab(target);
    if (target === "tab-governance") {
      loadGovernanceData();
    }
  });
});
document.getElementById("search-button").addEventListener("click", runSearch);
document.getElementById("search-query").addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
document.getElementById("console-execute-button").addEventListener("click", runOperatorExecute);
document.getElementById("console-refresh-records").addEventListener("click", loadContinuityRecords);
document.getElementById("console-records-body").addEventListener("click", (event) => {
  const auditButton = event.target.closest("[data-continuity-audit]");
  if (auditButton) {
    auditContinuityRecord(auditButton.dataset.continuityAudit, auditButton);
    return;
  }
  const exportButton = event.target.closest("[data-continuity-export]");
  if (exportButton) {
    exportContinuityRecord(exportButton.dataset.continuityExport, exportButton);
    return;
  }
  const deleteButton = event.target.closest("[data-continuity-delete]");
  if (deleteButton) deleteContinuityRecord(deleteButton.dataset.continuityDelete, deleteButton);
});

document.getElementById("btn-operator-signoff").addEventListener("click", async () => {
  try {
    const res = await fetchJson("/api/operator/signoff", { method: "POST" });
    alert(res.message);
    await loadGovernanceData();
  } catch (e) {
    alert("Sign-off failed: " + e.message);
  }
});

document.getElementById("btn-veto-override").addEventListener("click", async () => {
  try {
    const res = await fetchJson("/api/operator/veto", { method: "POST" });
    alert(res.message);
    await loadGovernanceData();
  } catch (e) {
    alert("Veto failed: " + e.message);
  }
});

document.getElementById("btn-run-simulation").addEventListener("click", async () => {
  const btn = document.getElementById("btn-run-simulation");
  const terminal = document.getElementById("sandbox-terminal-log");
  terminal.textContent += "\n[terminal] Starting bounded static smoke harness...\n";
  btn.disabled = true;
  try {
    const res = await fetchJson("/api/operator/run-simulation", { method: "POST" });
    terminal.textContent += res.logs;
  } catch (e) {
    terminal.textContent += `\n[error] Static smoke failed: ${e.message}\n`;
  } finally {
    btn.disabled = false;
    terminal.scrollTop = terminal.scrollHeight;
  }
});

loadData();
loadContinuityRecords();
loadGovernanceData();

// Developer Mode Toggle initialization
const devModeCheckbox = document.getElementById("dev-mode-checkbox");
if (devModeCheckbox) {
  // Default to off (add dev-mode-off class to body)
  document.body.classList.add("dev-mode-off");
  devModeCheckbox.addEventListener("change", () => {
    if (devModeCheckbox.checked) {
      document.body.classList.remove("dev-mode-off");
    } else {
      document.body.classList.add("dev-mode-off");
    }
  });
}

// Download Audit Report listener
const downloadBtn = document.getElementById("btn-download-audit-report");
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    try {
      const data = await fetchJson("/api/dashboard-data");
      const consensus = await fetchJson("/api/operator/consensus-map");
      const report = {
        disclaimer: "WARNING: THIS REPORT IS A BEST-EFFORT RECONSTRUCTION AND IS NOT TAMPER-PROOF OR CRYPTOGRAPHICALLY SECURE.",
        generated_at: new Date().toISOString(),
        projection: data.projection,
        prompt_sources: data.prompt_sources,
        docs: data.docs,
        consensus_state: consensus
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dizzy-audit-report-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Failed to download audit report: " + error.message);
    }
  });
}

const btnResolveContainment = document.getElementById("btn-resolve-containment");
if (btnResolveContainment) {
  btnResolveContainment.addEventListener("click", async () => {
    const reason = prompt("Enter a reason for manually resolving active policy containment:");
    if (!reason || !reason.trim()) {
      alert("A non-empty reason is required to resolve active policy containment.");
      return;
    }
    btnResolveContainment.disabled = true;
    try {
      const res = await fetchJson("/api/operator/resolve-containment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        await loadFrictionTelemetry();
        await loadGovernanceData();
      } else {
        throw new Error(res.error || "Failed to resolve");
      }
    } catch (e) {
      alert("Resolution failed: " + e.message);
    } finally {
      btnResolveContainment.disabled = false;
    }
  });
}

// Interactive Chat Surface Controller
let chatSurfaceInitialized = false;

function initChatSurface() {
  if (chatSurfaceInitialized) return;
  chatSurfaceInitialized = true;

  const chatMessagesList = document.getElementById("chat-messages-list");
  const chatInputText = document.getElementById("chat-input-text");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatClearBtn = document.getElementById("chat-clear-btn");
  const suggestionChips = document.querySelectorAll(".suggestion-chip");

  if (!chatMessagesList || !chatInputText || !chatSendBtn) return;

  function scrollToBottom() {
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  }

  function saveMessageToHistory(role, text, receipt) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem("dizzy_chat_history") || "[]");
    } catch {}
    history.push({ role, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), receipt });
    if (history.length > 50) history = history.slice(-50);
    localStorage.setItem("dizzy_chat_history", JSON.stringify(history));
  }

  function createBubbleHtml(role, text, time = "Just now", receipt = null) {
    const isUser = role === "user";
    const bubbleClass = isUser ? "user-bubble" : "assistant-bubble";
    const avatar = isUser ? "US" : "DZ";
    const speaker = isUser ? "Operator" : "Dizzy";
    
    let formattedText = escapeHtml(text)
      .replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.5); padding: 0.75rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; font-family: monospace; border: 1px solid rgba(255,255,255,0.1);">$1</pre>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.4); padding: 0.2rem 0.4rem; border-radius: 4px; color: var(--cyan); font-family: monospace;">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    let receiptHtml = "";
    if (receipt) {
      receiptHtml = `
        <details style="margin-top: 0.65rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.5rem; font-size: 0.78rem;">
          <summary style="cursor: pointer; color: var(--text-muted); font-family: monospace;">Capability Proof (${escapeHtml(receipt.trust_zone || "private_self")})</summary>
          <div style="margin-top: 0.4rem; color: var(--text-dim); line-height: 1.4;">
            <div>Mode: <code>${escapeHtml(receipt.retention_scope || "ephemeral")}</code></div>
            <div>Model Route: <code>${escapeHtml(receipt.chosen_model || "local")}</code></div>
          </div>
        </details>
      `;
    }

    return `
      <div class="chat-bubble ${bubbleClass}">
        <div class="chat-bubble-header">
          <span class="avatar-badge">${avatar}</span>
          <span class="speaker-name">${speaker}</span>
          <span class="bubble-timestamp">${escapeHtml(time)}</span>
        </div>
        <div class="chat-bubble-body">${formattedText}</div>
        ${receiptHtml}
      </div>
    `;
  }

  // Load chat history from localStorage
  const savedHistory = localStorage.getItem("dizzy_chat_history");
  if (savedHistory) {
    try {
      const messages = JSON.parse(savedHistory);
      if (Array.isArray(messages) && messages.length > 0) {
        chatMessagesList.innerHTML = messages.map(msg => createBubbleHtml(msg.role, msg.text, msg.time, msg.receipt)).join("");
        scrollToBottom();
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }
  }

  async function handleSend() {
    const text = chatInputText.value.trim();
    if (!text) return;

    chatInputText.value = "";
    chatInputText.style.height = "auto";
    chatSendBtn.disabled = true;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    chatMessagesList.insertAdjacentHTML("beforeend", createBubbleHtml("user", text, timeStr));
    saveMessageToHistory("user", text);
    scrollToBottom();

    const typingId = "typing-" + Date.now();
    chatMessagesList.insertAdjacentHTML("beforeend", `
      <div id="${typingId}" class="chat-bubble assistant-bubble" style="opacity: 0.85;">
        <div class="chat-bubble-header">
          <span class="avatar-badge">DZ</span>
          <span class="speaker-name">Dizzy</span>
          <span class="bubble-timestamp">Thinking...</span>
        </div>
        <div class="chat-bubble-body">
          <span class="status-dot" style="color: var(--cyan); display: inline-block;"></span> Reasoning over prompt pack &amp; memory graph...
        </div>
      </div>
    `);
    scrollToBottom();

    try {
      const response = await fetch("/dispatch/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "dashboard_chat", text })
      }).then(r => r.json());

      const typingElem = document.getElementById(typingId);
      if (typingElem) typingElem.remove();

      const isUnauthorized = response.status === 401 || response.error === "Unauthorized" || response.error === "Dashboard requires DIZZY_AUTH_TOKEN";
      const assistantText = isUnauthorized 
        ? 'Session expired or unauthorized. Please <a href="/dashboard/login" style="color: var(--cyan); text-decoration: underline; font-weight: bold;">click here to log in</a> with your operator token.'
        : (response.text || (response.ok ? "Task acknowledged and processed." : ("Execution issue: " + (response.error || "Unknown error"))));
      const receipt = response.capability_receipt || response.router_receipt || null;

      chatMessagesList.insertAdjacentHTML("beforeend", createBubbleHtml("assistant", assistantText, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), receipt));
      saveMessageToHistory("assistant", assistantText, receipt);
      scrollToBottom();

    } catch (err) {
      const typingElem = document.getElementById(typingId);
      if (typingElem) typingElem.remove();

      const errorMsg = "Dispatch error: " + err.message;
      chatMessagesList.insertAdjacentHTML("beforeend", createBubbleHtml("assistant", errorMsg));
      saveMessageToHistory("assistant", errorMsg);
      scrollToBottom();
    } finally {
      chatSendBtn.disabled = false;
    }
  }

  chatSendBtn.addEventListener("click", handleSend);
  chatInputText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  chatInputText.addEventListener("input", () => {
    chatInputText.style.height = "auto";
    chatInputText.style.height = Math.min(chatInputText.scrollHeight, 120) + "px";
  });

  suggestionChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const promptText = chip.getAttribute("data-prompt");
      if (promptText) {
        chatInputText.value = promptText;
        chatInputText.focus();
      }
    });
  });

  if (chatClearBtn) {
    chatClearBtn.addEventListener("click", () => {
      if (confirm("Clear live chat history?")) {
        localStorage.removeItem("dizzy_chat_history");
        chatMessagesList.innerHTML = createBubbleHtml("assistant", "Local chat history cleared. Route health remains dependent on the local API response.");
      }
    });
  }
}

async function loadReceiptsTelemetry() {
  try {
    const data = await fetchJson("/api/operator/receipts-telemetry");
    const totalElem = document.getElementById("receipts-summary-total");
    const latencyElem = document.getElementById("receipts-summary-latency");
    const cycleElem = document.getElementById("latest-review-cycle-verdict");
    const councilElem = document.getElementById("latest-council-verdict-badge");
    const modelsElem = document.getElementById("receipts-models-breakdown");
    const trustElem = document.getElementById("receipts-trust-zones");
    const latencyBandsElem = document.getElementById("receipts-latency-bands");
    const costBandsElem = document.getElementById("receipts-cost-bands");
    const historyElem = document.getElementById("receipts-history-list");

    if (totalElem) totalElem.innerText = String(data.receipt_count || 0);
    if (latencyElem) latencyElem.innerText = `${data.summary?.avg_latency_ms || 0} ms`;

    if (cycleElem) {
      const cycleState = data.latest_review_cycle?.state_transition || "none";
      cycleElem.innerText = escapeHtml(cycleState);
    }

    if (councilElem) {
      const verdict = data.latest_council_verdict?.verdict || "UNKNOWN";
      councilElem.innerText = escapeHtml(verdict);
    }

    if (modelsElem) {
      const models = data.summary?.models || {};
      const keys = Object.keys(models);
      if (!keys.length) {
        modelsElem.innerHTML = '<div style="color: var(--text-muted);">No model dispatch data available.</div>';
      } else {
        modelsElem.innerHTML = keys.map((m) => `
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-main);">${escapeHtml(m)}</span>
            <span class="badge badge-primary">${models[m]} calls</span>
          </div>
        `).join("");
      }
    }

    if (trustElem) {
      const zones = data.summary?.trust_zones || {};
      const keys = Object.keys(zones);
      if (!keys.length) {
        trustElem.innerHTML = '<div style="color: var(--text-muted);">No trust zone data available.</div>';
      } else {
        trustElem.innerHTML = keys.map((tz) => `
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--amber);">${escapeHtml(tz)}</span>
            <span class="badge badge-amber">${zones[tz]} requests</span>
          </div>
        `).join("");
      }
    }

    if (latencyBandsElem) {
      const bands = data.summary?.latency_bands || {};
      const keys = Object.keys(bands);
      if (!keys.length) {
        latencyBandsElem.innerHTML = '<div style="color: var(--text-muted);">No latency band data available.</div>';
      } else {
        latencyBandsElem.innerHTML = keys.map((band) => `
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--emerald);">${escapeHtml(band)}</span>
            <span class="badge badge-primary">${bands[band]} receipts</span>
          </div>
        `).join("");
      }
    }

    if (costBandsElem) {
      const bands = data.summary?.cost_bands || {};
      const keys = Object.keys(bands);
      if (!keys.length) {
        costBandsElem.innerHTML = '<div style="color: var(--text-muted);">No cost band data available.</div>';
      } else {
        costBandsElem.innerHTML = keys.map((band) => `
          <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--rose);">${escapeHtml(band)}</span>
            <span class="badge badge-amber">${bands[band]} receipts</span>
          </div>
        `).join("");
      }
    }

    if (historyElem) {
      const receipts = data.recent_receipts || [];
      if (!receipts.length) {
        historyElem.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 1rem;">No recent receipts logged.</div>';
      } else {
        historyElem.innerHTML = receipts.map((r) => `
          <div style="padding: 0.65rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; margin-bottom: 0.2rem;">
              <span style="color: var(--cyan); font-weight: 600;">${escapeHtml(r.chosen_model || r.model || "receipt")}</span>
              <span style="color: var(--text-muted);">${escapeHtml(r.created_at || r.timestamp || "")}</span>
            </div>
            <div style="display: flex; gap: 0.75rem; color: var(--text-dim); font-size: 0.775rem;">
              <span>Zone: <strong style="color: var(--text-muted);">${escapeHtml(r.trust_zone || "private_self")}</strong></span>
              <span>Cost Band: <strong style="color: var(--text-muted);">${escapeHtml(r.estimated_cost_band || r.cost_band || "unknown")}</strong></span>
              <span>Latency: <strong style="color: var(--text-muted);">${r.latency_ms || 0}ms</strong></span>
            </div>
          </div>
        `).join("");
      }
    }

    renderParetoHud(data.pareto_frontier || []);
    renderVerificationSummaries(data);
    renderCircuitBreakers(data.circuit_breakers || []);
  } catch (err) {
    console.error("Receipts telemetry error:", err);
    const councilElem = document.getElementById("latest-council-verdict-badge");
    const cycleElem = document.getElementById("latest-review-cycle-verdict");
    if (councilElem) councilElem.innerText = "UNREACHABLE";
    if (cycleElem) cycleElem.innerText = "UNREACHABLE";
    renderParetoHud([]);
    renderVerificationSummaries({});
    renderCircuitBreakers([]);
  }
}

function renderParetoHud(paretoModels = []) {
  const svgGroup = document.getElementById("pareto-nodes-group");
  const frontierPath = document.getElementById("pareto-frontier-line");
  const tooltip = document.getElementById("pareto-node-tooltip");
  const countBadge = document.getElementById("pareto-frontier-count");
  if (!svgGroup || !frontierPath) return;

  if (countBadge) {
    countBadge.textContent = paretoModels.length ? `${paretoModels.length} Models Mapped` : "No telemetry";
    countBadge.className = `badge ${paretoModels.length ? "badge-primary" : "badge-amber"}`;
  }
  svgGroup.innerHTML = "";

  if (!paretoModels.length) return;

  const minX = 60, maxX = 560;
  const minY = 200, maxY = 30;

  const points = paretoModels.map((m) => {
    const x = minX + (m.spend * (maxX - minX));
    const y = minY - (((m.accuracy - 0.8) / 0.2) * (minY - maxY));
    const radius = Math.max(5, Math.min(12, Math.round(m.latency_ms / 250)));
    const color = m.tier === 0 ? "var(--purple)" : m.tier === 1 ? "var(--cyan)" : m.tier === 3 ? "var(--rose)" : "var(--emerald)";
    return { ...m, x, y, radius, color };
  });

  points.forEach((pt) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(pt.x));
    circle.setAttribute("cy", String(pt.y));
    circle.setAttribute("r", String(pt.radius));
    circle.setAttribute("fill", pt.color);
    circle.setAttribute("fill-opacity", "0.75");
    circle.setAttribute("stroke", pt.color);
    circle.setAttribute("stroke-width", "2");

    circle.addEventListener("mouseenter", () => {
      if (tooltip) {
        tooltip.innerHTML = `
          <strong style="color: ${pt.color};">${escapeHtml(pt.name)}</strong> (Tier ${pt.tier})<br>
          Accuracy: <strong>${Math.round(pt.accuracy * 100)}%</strong> &bull; Latency: <strong>${pt.latency_ms}ms</strong><br>
          Cost Band: <strong>${escapeHtml(pt.spend === 0 ? "Free Local" : "$" + pt.spend + "/1M")}</strong> &bull; Zone: <code>${escapeHtml(pt.zone)}</code>
        `;
        tooltip.style.opacity = "1";
      }
    });

    circle.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.style.opacity = "0";
    });

    svgGroup.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(pt.x + pt.radius + 4));
    label.setAttribute("y", String(pt.y + 4));
    label.setAttribute("fill", "#9ca3af");
    label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "JetBrains Mono");
    label.textContent = pt.id;
    svgGroup.appendChild(label);
  });

  const sorted = [...points].sort((a, b) => a.spend - b.spend);
  let d = "";
  let highestAcc = -1;
  sorted.forEach((pt) => {
    if (pt.accuracy >= highestAcc) {
      d += (d === "" ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
      highestAcc = pt.accuracy;
    }
  });
  frontierPath.setAttribute("d", d);
}

function renderVerificationSummaries(data) {
  const advVer = data.latest_adversarial_verification;
  const negCap = data.latest_negative_capability;

  const advBadge = document.getElementById("adversarial-summary-verdict");
  const negBadge = document.getElementById("negative-capability-score");
  const advStatus = document.getElementById("adversarial-status-badge");
  const negStatus = document.getElementById("negative-capability-badge");
  const advList = document.getElementById("adversarial-gates-list");
  const negList = document.getElementById("negative-capability-list");

  if (!advVer) {
    if (advBadge) {
      advBadge.textContent = "No current receipt";
      advBadge.style.color = "var(--text-muted)";
    }
    if (advStatus) {
      advStatus.textContent = "No current receipt";
      advStatus.className = "badge badge-amber";
    }
    if (advList) {
      advList.innerHTML = '<div style="color: var(--text-muted); padding: 0.5rem 0;">No adversarial receipt available.</div>';
    }
  }

  if (!negCap) {
    if (negBadge) {
      negBadge.textContent = "No current receipt";
      negBadge.style.color = "var(--text-muted)";
    }
    if (negStatus) {
      negStatus.textContent = "No current receipt";
      negStatus.className = "badge badge-amber";
    }
    if (negList) {
      negList.innerHTML = '<div style="color: var(--text-muted); padding: 0.5rem 0;">No restraint receipt available.</div>';
    }
  }

  if (advBadge && advVer) {
    advBadge.textContent = `${advVer.deterministic_blocks || 0}/${advVer.scenarios_tested || 0} BLOCKED`;
    advBadge.style.color = advVer.bypasses_allowed === 0 ? "var(--emerald)" : "var(--rose)";
  }

  if (advStatus && advVer) {
    const blocked = Number.isFinite(Number(advVer.deterministic_blocks)) ? Number(advVer.deterministic_blocks) : null;
    const tested = Number.isFinite(Number(advVer.scenarios_tested)) ? Number(advVer.scenarios_tested) : null;
    const blockedLabel = blocked !== null && tested !== null && tested > 0 ? `${blocked}/${tested} Blocked` : "Blocked";
    advStatus.textContent = advVer.verdict === "ADVERSARIAL_VERIFICATION_PASSED" ? blockedLabel : "Bypass Detected";
    advStatus.className = `badge ${advVer.bypasses_allowed === 0 ? "badge-emerald" : "badge-rose"}`;
  }

  if (negBadge && negCap) {
    negBadge.textContent = `${Math.round((negCap.average_restraint_score || 0) * 100)}% RESTRAINT`;
  }

  if (negStatus && negCap) {
    negStatus.textContent = `Score: ${negCap.average_restraint_score || 1.0}`;
  }

  if (advList && advVer) {
    const list = advVer.who_caught_what || [];
    advList.innerHTML = list.map((item) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
        <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-main);">${escapeHtml(item.scenario_id)}</span>
        <span class="badge ${item.deterministic_intercepted ? "badge-emerald" : "badge-rose"}">${escapeHtml(item.intercepting_gate || "PASSED")}</span>
      </div>
    `).join("");
  }

  if (negList && negCap) {
    const evals = negCap.evaluations || [];
    negList.innerHTML = evals.map((item) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
        <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-main);">${escapeHtml(item.test_id)}</span>
        <span class="badge badge-primary">${escapeHtml(item.refusal_type)}</span>
      </div>
    `).join("");
  }
}

function renderCircuitBreakers(breakers = []) {
  const grid = document.getElementById("circuit-breakers-grid");
  const aggBadge = document.getElementById("circuit-breaker-aggregate-badge");
  if (!grid) return;

  if (!breakers.length) {
    if (aggBadge) {
      aggBadge.textContent = "No telemetry";
      aggBadge.className = "badge badge-amber";
    }
    grid.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 1rem;">No circuit breaker data available.</div>';
    return;
  }

  const allClosed = breakers.every((b) => b.state === "CLOSED");
  if (aggBadge) {
    aggBadge.textContent = allClosed ? "All Reported Routes Closed" : "Circuit Breaker Active";
    aggBadge.className = `badge ${allClosed ? "badge-emerald" : "badge-amber"}`;
  }

  grid.innerHTML = breakers.map((route) => {
    const isClosed = route.state === "CLOSED";
    const isHalfOpen = route.state === "HALF_OPEN";
    const badgeClass = isClosed ? "badge-emerald" : isHalfOpen ? "badge-amber" : "badge-rose";
    const failPct = Math.min(100, Math.round(((route.consecutive_failures || 0) / 3) * 100));
    const failBarColor = isClosed ? "var(--emerald)" : isHalfOpen ? "var(--amber)" : "var(--rose)";

    return `
      <div class="summary-card" style="border: 1px solid rgba(255,255,255,0.08); padding: 1rem; border-radius: 8px; background: rgba(11, 16, 28, 0.6);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${escapeHtml(route.route_id)}</span>
          <span class="badge ${badgeClass}"><span class="status-dot"></span>${escapeHtml(route.state)}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8rem; color: var(--text-muted);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Failure Threshold:</span>
            <div class="progress-wrap">
              <div class="bar-container" style="width: 70px; height: 8px;">
                <div class="bar-fill" style="width: ${failPct}%; background: ${failBarColor};"></div>
              </div>
              <span class="metric-value" style="font-size: 0.75rem;">${route.consecutive_failures || 0}/3</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Tripped Total:</span>
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-main);">${route.tripped_count || 0}</span>
          </div>
          ${route.last_failure_reason ? `
            <div style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--rose);">
              <span>Reason: <code>${escapeHtml(route.last_failure_reason)}</code></span>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initChatSurface();
  loadReceiptsTelemetry();
});
initChatSurface();
