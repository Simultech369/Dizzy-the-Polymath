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
    const vramPct = Math.round((16.0 - hw.free_memory_gb) / 16.0 * 100);
    document.getElementById("vram-bar-fill").style.width = `${vramPct}%`;
    document.getElementById("vram-val").textContent = `${hw.free_memory_gb} GB Free / ${hw.total_memory_gb} GB Total (${vramPct}% Used)`;
    document.getElementById("active-model-route").textContent = hw.active_model_route;
    document.getElementById("active-routing-basis").textContent = hw.active_routing_basis;

    const compPct = Math.round(hw.context_compression_ratio * 100);
    document.getElementById("compression-bar-fill").style.width = `${compPct}%`;
    document.getElementById("compression-val").textContent = `${compPct}% of Original`;

    const warningBanner = document.getElementById("routing-warning-banner");
    if (hw.context_compression_ratio < 0.50) {
      warningBanner.innerHTML = `
        <div class="warning-banner">
          <span style="font-weight: 700;">⚠ WARNING:</span>
          Context compression active — potential minor coherence loss on deep history.
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
    circle.setAttribute("filter", "url(#neon-glow)");
    text.setAttribute("fill", "#34d399");
  } else if (status === "VETOED") {
    circle.setAttribute("fill", "#4c0519");
    circle.setAttribute("stroke", "#f43f5e");
    circle.setAttribute("filter", "url(#neon-glow)");
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
  terminal.textContent += "\n[terminal] Starting live simulation run...\n";
  btn.disabled = true;
  try {
    const res = await fetchJson("/api/operator/run-simulation", { method: "POST" });
    terminal.textContent += res.logs;
  } catch (e) {
    terminal.textContent += `\n[error] Simulation failed: ${e.message}\n`;
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
