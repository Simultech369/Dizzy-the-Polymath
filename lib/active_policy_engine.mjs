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

export class ActivePolicyEngine {
  constructor(opts = {}) {
    this.configPathOpts = opts.configPath;
    this.statePathOpts = opts.statePath;
    this.ledgerPathOpts = opts.ledgerPath;
    this.quarantinePathOpts = opts.quarantinePath;
    this.config = this.loadConfig();
    this.state = this.loadState();
  }

  getConfigPath() {
    return this.configPathOpts || process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH || path.resolve(process.cwd(), "runtime", "active_policy_config.json");
  }

  getStatePath() {
    return this.statePathOpts || process.env.DIZZY_ACTIVE_POLICY_STATE_PATH || path.resolve(process.cwd(), "runtime", "active_policy_state.json");
  }

  getLedgerPath() {
    return this.ledgerPathOpts || process.env.DIZZY_FRICTION_PATH || path.resolve(process.cwd(), "runtime/friction/ledger.jsonl");
  }

  getQuarantinePath() {
    return this.quarantinePathOpts || process.env.DIZZY_QUARANTINE_PATH || path.resolve(process.cwd(), "runtime", "quarantine");
  }

  loadConfig() {
    const defaults = {
      enabled: true,
      z_score_threshold: 3.0,
      min_history_entries: 5,
      containment_actions: {
        suspend_durable_writes: true,
        veto_quarantined_bridges: true
      },
      escalation_contact: "operator@localhost"
    };
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (parsed && typeof parsed === "object") {
          return {
            enabled: parsed.enabled !== undefined ? !!parsed.enabled : defaults.enabled,
            z_score_threshold: typeof parsed.z_score_threshold === "number" ? parsed.z_score_threshold : defaults.z_score_threshold,
            min_history_entries: typeof parsed.min_history_entries === "number" ? parsed.min_history_entries : defaults.min_history_entries,
            containment_actions: {
              suspend_durable_writes: parsed.containment_actions?.suspend_durable_writes !== undefined ? !!parsed.containment_actions.suspend_durable_writes : defaults.containment_actions.suspend_durable_writes,
              veto_quarantined_bridges: parsed.containment_actions?.veto_quarantined_bridges !== undefined ? !!parsed.containment_actions.veto_quarantined_bridges : defaults.containment_actions.veto_quarantined_bridges
            },
            escalation_contact: parsed.escalation_contact || defaults.escalation_contact
          };
        }
      }
    } catch (e) {
      console.warn(`[policy_engine] Failed to load config: ${e.message}. Using defaults.`);
    }
    return defaults;
  }

  loadState() {
    const defaults = {
      last_evaluated_at: new Date().toISOString(),
      containment_active: false,
      trigger_reason: null,
      latest_metrics: { robust_z: 0, median: 0, mad: 0, scale: 0.1 },
      containment_history: []
    };
    try {
      const statePath = this.getStatePath();
      if (fs.existsSync(statePath)) {
        const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
        if (parsed && typeof parsed === "object") {
          return {
            last_evaluated_at: parsed.last_evaluated_at || defaults.last_evaluated_at,
            containment_active: parsed.containment_active !== undefined ? !!parsed.containment_active : defaults.containment_active,
            trigger_reason: parsed.trigger_reason || defaults.trigger_reason,
            latest_metrics: {
              robust_z: typeof parsed.latest_metrics?.robust_z === "number" ? parsed.latest_metrics.robust_z : defaults.latest_metrics.robust_z,
              median: typeof parsed.latest_metrics?.median === "number" ? parsed.latest_metrics.median : defaults.latest_metrics.median,
              mad: typeof parsed.latest_metrics?.mad === "number" ? parsed.latest_metrics.mad : defaults.latest_metrics.mad,
              scale: typeof parsed.latest_metrics?.scale === "number" ? parsed.latest_metrics.scale : defaults.latest_metrics.scale
            },
            containment_history: Array.isArray(parsed.containment_history) ? parsed.containment_history : defaults.containment_history
          };
        }
      }
    } catch (e) {
      console.warn(`[policy_engine] Failed to load state: ${e.message}. Initializing empty.`);
    }
    return defaults;
  }

  saveState() {
    try {
      const statePath = this.getStatePath();
      const dir = path.dirname(statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), "utf8");
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
      const filePath = path.resolve(process.cwd(), this.getLedgerPath());
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
    this.config = this.loadConfig();
    this.state = this.loadState();

    if (!this.config.enabled) {
      return this.state;
    }

    const history = historyOverride || this.readLedgerHistory() || [];
    // Exclude the new entry itself from the historical baseline to prevent self-dilution (AP-02)
    const baselineHistory = history.filter(item => item.id !== newFrictionEntry.id);

    const report = detectFrictionAnomaly(baselineHistory, newFrictionEntry, {
      min_history_entries: this.config.min_history_entries,
      z_score_threshold: this.config.z_score_threshold
    });

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
  vetoQuarantinedBridges(quarantinePathOverride = null) {
    const quarantineDir = quarantinePathOverride || this.getQuarantinePath();
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
  resolveContainment(reason) {
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      throw new Error("A non-empty containment resolution reason is required.");
    }
    this.refreshState();
    if (this.state.containment_active) {
      this.state.containment_active = false;
      this.state.trigger_reason = null;

      const lastHistory = this.state.containment_history[this.state.containment_history.length - 1];
      if (lastHistory && !lastHistory.resolved_at) {
        lastHistory.resolved_at = new Date().toISOString();
        lastHistory.resolved_by_operator = true;
        lastHistory.resolved_reason = reason.trim();
      }
      this.saveState();
      console.log(`[policy_engine] Active containment has been manually resolved by the operator. Reason: ${reason}`);
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
