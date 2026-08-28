/**
 * Integration Draft: MDS Layout and Quarantine Bridges API/Frontend
 * Shows the exact code structures to be integrated into lib/dashboard.mjs
 * and dashboard/dashboard.js.
 */

// ==========================================
// 1. BACKEND INTEGRATION (lib/dashboard.mjs)
// ==========================================

import fs from "fs";
import path from "path";
import { projectCoordinates } from "./mds_sketch.mjs";

const QUARANTINE_DIR = path.resolve(process.cwd(), "runtime", "quarantine");
const MEMORY_GRAPH_FILE = path.resolve(process.cwd(), "runtime", "memory_graph.json");

/**
 * Express router snippet for lib/dashboard.mjs
 */
export function registerDashboardIntegrationRoutes(app, guard) {
  // Overwrite the consensus-map endpoint to dynamically project coordinates via MDS
  app.get("/api/operator/consensus-map", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const rawState = getConsensusState(); // From consensus.mjs
    
    // Project coordinates on-the-fly using semantic MDS force layout
    if (rawState.options && rawState.options.length > 0) {
      rawState.options = projectCoordinates(rawState.options, 100);
    }
    
    return res.json(rawState);
  });

  // Get all staged/quarantined bridging memory suggestions
  app.get("/api/operator/quarantined-bridges", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!fs.existsSync(QUARANTINE_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(QUARANTINE_DIR).filter(f => f.endsWith(".json"));
    const list = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(QUARANTINE_DIR, file), "utf8");
        return {
          id: file,
          ...JSON.parse(content)
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.json(list);
  });

  // Accept/merge a quarantined bridge suggestion
  app.post("/api/operator/quarantined-bridges/accept", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { bridgeId } = req.body;
    if (!bridgeId) {
      return res.status(400).json({ ok: false, error: "bridgeId is required" });
    }

    const bridgePath = path.join(QUARANTINE_DIR, bridgeId);
    if (!fs.existsSync(bridgePath)) {
      return res.status(404).json({ ok: false, error: "Bridge suggestion not found" });
    }

    try {
      const bridge = JSON.parse(fs.readFileSync(bridgePath, "utf8"));
      
      // Merge into the main memory_graph.json
      let graph = { nodes: [], edges: [] };
      if (fs.existsSync(MEMORY_GRAPH_FILE)) {
        graph = JSON.parse(fs.readFileSync(MEMORY_GRAPH_FILE, "utf8"));
      }

      // Add a new node representing the bridged concept connection
      const newNodeId = `bridge_${Date.now()}`;
      graph.nodes.push({
        id: newNodeId,
        label: `Bridge: ${bridge.bridge_concepts.join(", ")}`,
        source_file: bridge.source_file,
        confidence: bridge.score,
        freshness: new Date().toISOString().split("T")[0],
        freshness_fresh: true,
        scope: "trusted_collaborator"
      });

      fs.writeFileSync(MEMORY_GRAPH_FILE, JSON.stringify(graph, null, 2), "utf8");

      // Remove from quarantine list
      fs.rmSync(bridgePath, { force: true });
      return res.json({ ok: true, message: "Bridge merged to memory graph successfully." });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Reject/remove a quarantined bridge suggestion
  app.post("/api/operator/quarantined-bridges/reject", guard, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { bridgeId } = req.body;
    if (!bridgeId) {
      return res.status(400).json({ ok: false, error: "bridgeId is required" });
    }

    const bridgePath = path.join(QUARANTINE_DIR, bridgeId);
    if (fs.existsSync(bridgePath)) {
      fs.rmSync(bridgePath, { force: true });
    }
    return res.json({ ok: true, message: "Bridge suggestion rejected and removed." });
  });
}

// ==========================================
// 2. FRONTEND INTEGRATION (dashboard/dashboard.js)
// ==========================================

/**
 * Frontend JavaScript snippet for dashboard.js
 */
const frontendSnippet = `
// Fetch and render quarantined bridges in the governance tab
async function loadQuarantinedBridges() {
  const container = document.getElementById("quarantined-bridges-list");
  if (!container) return;

  try {
    const list = await fetchJson("/api/operator/quarantined-bridges");
    if (list.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); padding: 1rem 0;">No quarantined bridges awaiting review.</div>';
      return;
    }

    container.innerHTML = list.map(bridge => \`
      <div class="bridge-card" style="background: var(--bg-surface-nested); border: 1px solid var(--border-color); padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <strong style="color: var(--text-heading);">Bridge -> \${escapeHtml(bridge.source_file)}</strong>
          <span class="badge badge-amber" style="font-size: 0.75rem;">\${bridge.score.toFixed(3)} overlap</span>
        </div>
        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Concepts: \${bridge.bridge_concepts.map(c => \`<span class="badge" style="background: var(--bg-hover); margin-right: 0.25rem;">\${escapeHtml(c)}</span>\`).join('')}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-success btn-sm" onclick="handleBridgeAction('\${bridge.id}', 'accept')">Accept & Merge</button>
          <button class="btn btn-danger btn-sm" onclick="handleBridgeAction('\${bridge.id}', 'reject')">Reject</button>
        </div>
      </div>
    \`).join('');
  } catch (e) {
    container.innerHTML = '<div style="color: var(--color-rose);">Failed to load memory bridges: ' + escapeHtml(e.message) + '</div>';
  }
}

async function handleBridgeAction(bridgeId, action) {
  try {
    const res = await fetchJson(\`/api/operator/quarantined-bridges/\${action}\`, {
      method: "POST",
      body: JSON.stringify({ bridgeId })
    });
    alert(res.message);
    await loadQuarantinedBridges();
    await loadGovernanceData(); // reload graph if visualizer is open
  } catch (e) {
    alert("Bridge action failed: " + e.message);
  }
}
`;
