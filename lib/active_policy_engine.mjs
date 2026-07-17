/**
 * lib/active_policy_engine.mjs
 * ----------------------------
 * Active Policy Engine for Dizzy.
 * Computes robust Z-scores from the friction ledger and manages containment status.
 * Reads ledger files directly to prevent ES module circular dependencies.
 */

import fs from "fs";
import path from "path";
import { detectFrictionAnomaly } from "./friction_anomaly_detector.mjs";

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), "runtime", "active_policy_config.json");
const DEFAULT_STATE_PATH = path.resolve(process.cwd(), "runtime", "active_policy_state.json");
const DEFAULT_LEDGER_PATH = path.resolve(process.cwd(), "runtime/friction/ledger.jsonl");

export class ActivePolicyEngine {
  constructor(opts = {}) {
    this.configPath = opts.configPath || DEFAULT_CONFIG_PATH;
    this.statePath = opts.statePath || DEFAULT_STATE_PATH;
    this.ledgerPath = opts.ledgerPath || DEFAULT_LEDGER_PATH;
    this.config = this.loadConfig();
    this.state = this.loadState();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      }
    } catch (e) {
      console.warn(`[policy_engine] Failed to load config: ${e.message}. Using defaults.`);
    }
    return {
      enabled: true,
      z_score_threshold: 3.0,
      min_history_entries: 5,
      containment_actions: {
        suspend_durable_writes: true,
        veto_quarantined_bridges: true
      },
      escalation_contact: "operator@localhost"
    };
  }

  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
      }
    } catch (e) {
      console.warn(`[policy_engine] Failed to load state: ${e.message}. Initializing empty.`);
    }
    return {
      last_evaluated_at: new Date().toISOString(),
      containment_active: false,
      trigger_reason: null,
      latest_metrics: { robust_z: 0, median: 0, mad: 0, scale: 0.1 },
      containment_history: []
    };
  }

  saveState() {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (e) {
      console.error(`[policy_engine] Failed to save state: ${e.message}`);
    }
  }

  refreshState() {
    this.state = this.loadState();
    return this.state;
  }

  readLedgerHistory() {
    try {
      const filePath = path.resolve(process.cwd(), process.env.DIZZY_FRICTION_PATH || this.ledgerPath);
      if (!fs.existsSync(filePath)) return [];
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      const out = [];
      for (const line of lines) {
        try {
          out.push(JSON.parse(line));
        } catch {
          // ignore malformed
        }
      }
      return out;
    } catch (e) {
      console.error(`[policy_engine] Failed to read ledger history: ${e.message}`);
      return [];
    }
  }

  /**
   * Evaluate policy rules against a newly recorded friction entry
   * @param {Object} newFrictionEntry - The newly added friction log
   * @param {Array} historyOverride - Optional historical logs (for testing)
   */
  evaluate(newFrictionEntry, historyOverride = null) {
    if (!this.config.enabled) {
      return this.state;
    }

    const history = historyOverride || this.readLedgerHistory() || [];
    const report = detectFrictionAnomaly(history, newFrictionEntry);

    this.state.last_evaluated_at = new Date().toISOString();
    this.state.latest_metrics = {
      robust_z: report.robust_z,
      median: report.median,
      mad: report.mad,
      scale: report.scale
    };

    const threshold = this.config.z_score_threshold;
    if (report.robust_z >= threshold) {
      // Containment triggered
      if (!this.state.containment_active) {
        this.state.containment_active = true;
        this.state.trigger_reason = `Friction anomaly detected: Robust Z-score ${report.robust_z} >= threshold ${threshold}. Type: "${newFrictionEntry.friction_type}"`;

        // Log to containment history
        this.state.containment_history.push({
          triggered_at: new Date().toISOString(),
          resolved_at: null,
          trigger_z: report.robust_z,
          friction_type: newFrictionEntry.friction_type,
          resolved_by_operator: false
        });

        // Trigger side-effect actions (like bridge vetoing)
        if (this.config.containment_actions.veto_quarantined_bridges) {
          this.vetoQuarantinedBridges();
        }
      }
    }

    this.saveState();
    return this.state;
  }

  /**
   * Scan the quarantine directory and transition all non-approved bridges to "vetoed"
   */
  vetoQuarantinedBridges() {
    const quarantineDir = path.resolve(process.cwd(), "runtime", "quarantine");
    if (!fs.existsSync(quarantineDir)) return;

    try {
      const files = fs.readdirSync(quarantineDir).filter(f => f.startsWith("bridge_") && f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(quarantineDir, file);
        const bridge = JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (!bridge.approved_by_operator && bridge.status !== "vetoed") {
          bridge.status = "vetoed";
          bridge.vetoed_at = new Date().toISOString();
          bridge.veto_reason = `Active Policy Engine containment active (Z-score anomaly).`;
          fs.writeFileSync(filePath, JSON.stringify(bridge, null, 2), "utf8");
          console.log(`[policy_engine] Quarantined bridge ${bridge.id} has been VETOED.`);
        }
      }
    } catch (e) {
      console.error(`[policy_engine] Failed to veto quarantined bridges: ${e.message}`);
    }
  }

  /**
   * Manually resolve containment status (Operator override)
   */
  resolveContainment() {
    this.refreshState();
    if (this.state.containment_active) {
      this.state.containment_active = false;
      this.state.trigger_reason = null;

      const lastHistory = this.state.containment_history[this.state.containment_history.length - 1];
      if (lastHistory && !lastHistory.resolved_at) {
        lastHistory.resolved_at = new Date().toISOString();
        lastHistory.resolved_by_operator = true;
      }
      this.saveState();
      console.log(`[policy_engine] Active containment has been manually resolved by the operator.`);
    }
  }

  /**
   * Check if durable write capabilities are suspended
   */
  isWriteSuspended() {
    this.refreshState();
    return this.config.enabled &&
           this.state.containment_active &&
           this.config.containment_actions.suspend_durable_writes;
  }

  /**
   * Check if quarantined bridge submissions are vetoed
   */
  isBridgeVetoActive() {
    this.refreshState();
    return this.config.enabled &&
           this.state.containment_active &&
           this.config.containment_actions.veto_quarantined_bridges;
  }
}
