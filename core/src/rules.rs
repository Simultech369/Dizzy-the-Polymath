use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::trust::{TrustZone, ContinuityMode, Capabilities};
use crate::sieve::{SieveProposal, SieveResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawCapabilities {
    pub repo_retrieval_allowed: bool,
    pub durable_memory_allowed: bool,
    pub retention_scope: String,
    pub ephemeral_history: bool,
    pub expiry_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverrideCondition {
    pub trust_zone: String,
    pub continuity_mode_not: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawCapabilitiesUpdate {
    pub retention_scope: Option<String>,
    pub ephemeral_history: Option<bool>,
    pub expiry_policy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverrideRule {
    pub condition: OverrideCondition,
    pub updates: RawCapabilitiesUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SieveRules {
    pub exit_min_length: usize,
    pub exit_forbidden_keywords: Vec<String>,
    pub capture_forbidden_mitigations: Vec<String>,
    pub wellbeing_bad_metrics: Vec<String>,
    pub wellbeing_good_metrics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeclarativeRuleset {
    pub capabilities: HashMap<String, RawCapabilities>,
    pub overrides: Vec<OverrideRule>,
    pub sieve_rules: SieveRules,
}

impl DeclarativeRuleset {
    pub fn load_default() -> Self {
        let json_str = include_str!("../rules.json");
        serde_json::from_str(json_str).expect("Failed to parse default rules.json")
    }

    pub fn get_capabilities(&self, zone: TrustZone, mode: ContinuityMode) -> Capabilities {
        let zone_str = match zone {
            TrustZone::PrivateSelf => "private_self",
            TrustZone::TrustedCollaborator => "trusted_collaborator",
            TrustZone::OutsideContact => "outside_contact",
            TrustZone::PaidPublic => "paid_public",
        };
        
        let mode_str = match mode {
            ContinuityMode::Client => "client",
            ContinuityMode::Ephemeral => "ephemeral",
            ContinuityMode::Default => "default",
        };

        // Fetch baseline capabilities
        let raw = self.capabilities.get(zone_str)
            .cloned()
            .unwrap_or_else(|| RawCapabilities {
                repo_retrieval_allowed: false,
                durable_memory_allowed: false,
                retention_scope: "local_conversation".to_string(),
                ephemeral_history: false,
                expiry_policy: "none".to_string(),
            });

        let mut final_scope = raw.retention_scope;
        let mut final_ephemeral = raw.ephemeral_history;
        let mut final_expiry = raw.expiry_policy;

        // Apply matching overrides
        for r in &self.overrides {
            if r.condition.trust_zone == zone_str && r.condition.continuity_mode_not != mode_str {
                if let Some(ref s) = r.updates.retention_scope { final_scope = s.clone(); }
                if let Some(b) = r.updates.ephemeral_history { final_ephemeral = b; }
                if let Some(ref e) = r.updates.expiry_policy { final_expiry = e.clone(); }
            }
        }

        Capabilities {
            trust_zone: zone,
            continuity_mode: mode,
            retention_scope: final_scope,
            ephemeral_history: final_ephemeral,
            repo_retrieval_allowed: raw.repo_retrieval_allowed,
            durable_memory_allowed: raw.durable_memory_allowed,
            expiry_policy: final_expiry,
        }
    }

    pub fn validate_sieve(&self, proposal: &SieveProposal) -> SieveResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // 1. Required fields validation
        if proposal.title.trim().is_empty() { errors.push("Missing or empty required sieve field: 'title'".to_string()); }
        if proposal.capability.trim().is_empty() { errors.push("Missing or empty required sieve field: 'capability'".to_string()); }
        if proposal.ownership.trim().is_empty() { errors.push("Missing or empty required sieve field: 'ownership'".to_string()); }
        if proposal.funding.trim().is_empty() { errors.push("Missing or empty required sieve field: 'funding'".to_string()); }
        if proposal.governance.trim().is_empty() { errors.push("Missing or empty required sieve field: 'governance'".to_string()); }
        if proposal.enforcement.trim().is_empty() { errors.push("Missing or empty required sieve field: 'enforcement'".to_string()); }
        if proposal.exit.trim().is_empty() { errors.push("Missing or empty required sieve field: 'exit'".to_string()); }
        if proposal.capture_risk.trim().is_empty() { errors.push("Missing or empty required sieve field: 'captureRisk'".to_string()); }
        if proposal.simplification.trim().is_empty() { errors.push("Missing or empty required sieve field: 'simplification'".to_string()); }
        if proposal.wellbeing_metrics.trim().is_empty() { errors.push("Missing or empty required sieve field: 'wellbeingMetrics'".to_string()); }

        if !errors.is_empty() {
            return SieveResult { ok: false, errors, warnings };
        }

        // 2. Exit strategy validation
        let exit_text = proposal.exit.to_lowercase();
        let exit_trimmed = exit_text.trim();
        if self.sieve_rules.exit_forbidden_keywords.iter().any(|kw| exit_trimmed.contains(kw)) 
            || exit_trimmed.len() < self.sieve_rules.exit_min_length {
            errors.push("Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.".to_string());
        }

        // 3. Capture mitigation validation
        let cap_risk = proposal.capture_risk.to_lowercase();
        let cap_risk_trimmed = cap_risk.trim();
        let ownership_text = proposal.ownership.to_lowercase();
        let ownership_trimmed = ownership_text.trim();
        if self.sieve_rules.capture_forbidden_mitigations.iter().any(|m| cap_risk_trimmed.contains(m)) 
            || ownership_trimmed.contains("absolute operator ownership") {
            errors.push("Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.".to_string());
        }

        // 4. Wellbeing metrics validation
        let metrics = proposal.wellbeing_metrics.to_lowercase();
        let metrics_trimmed = metrics.trim();
        let has_bad_metric = self.sieve_rules.wellbeing_bad_metrics.iter().any(|bm| metrics_trimmed.contains(bm));
        let has_good_metric = self.sieve_rules.wellbeing_good_metrics.iter().any(|gm| metrics_trimmed.contains(gm));
        let has_bad_metric_only = has_bad_metric && !has_good_metric;

        if has_bad_metric_only || metrics_trimmed.len() < 15 {
            errors.push("Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.".to_string());
        }

        // 5. Governance warning
        let gov = proposal.governance.to_lowercase();
        let gov_trimmed = gov.trim();
        if !gov_trimmed.contains("appeal") && !gov_trimmed.contains("arbitration") {
            warnings.push("Proposal lacks explicit dispute appeals or arbitration paths.".to_string());
        }

        SieveResult {
            ok: errors.is_empty(),
            errors,
            warnings,
        }
    }
}
