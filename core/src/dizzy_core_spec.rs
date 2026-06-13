//! Dizzy Core System Specification (Reference Implementation)
//!
//! This file aggregates all the core system invariants, trust zone capabilities,
//! memory decay policies, and mechanism validation sieves into a single, self-contained,
//! strongly-typed reference file.
//!
//! It is designed to be easily read by other LLMs (like DeepSeek) to produce correct,
//! memory-safe, and logic-equivalent ports in Python, Go, C++, or Zig.

use serde::{Serialize, Deserialize};
use std::collections::HashMap;

// =========================================================================
// 1. Trust & Capabilities Specification
// =========================================================================

/// Defines the security boundaries of execution or communication contexts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrustZone {
    /// Deeply trusted execution space with full local capabilities.
    PrivateSelf,
    /// Semi-trusted external collaborator with access to repository/memory.
    TrustedCollaborator,
    /// Unverified external contact (no local repository access).
    OutsideContact,
    /// Public channels or untrusted API environments.
    PaidPublic,
}

/// Controls history persistence constraints and lifecycle policies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContinuityMode {
    /// Strict client-managed context persistence.
    Client,
    /// No persistence; history is discarded after execution.
    Ephemeral,
    /// Default capability resolution.
    Default,
}

/// Evaluated capabilities for a given context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    /// Context's trust classification.
    pub trust_zone: TrustZone,
    /// Persistence and history mode.
    pub continuity_mode: ContinuityMode,
    /// Scope of retained memory: "ephemeral", "conversation_only", or "local_conversation".
    pub retention_scope: String,
    /// If true, past conversation history is treated as transient.
    pub ephemeral_history: bool,
    /// Determines whether the agent can retrieve or inspect files from the repository.
    pub repo_retrieval_allowed: bool,
    /// Determines whether the agent can write to long-term memory.
    pub durable_memory_allowed: bool,
    /// Expiry policy applied (e.g., "7_days_inactivity_operator_deletable", "none").
    pub expiry_policy: String,
}

/// Resolves a trust zone based on context parameters.
/// Falls back safely if authorization details are missing or mismatched.
pub fn get_trust_zone(explicit: Option<&str>, trusted_local: bool, channel: &str) -> TrustZone {
    let explicit_clean = explicit.unwrap_or("").trim().to_lowercase();
    
    if explicit_clean == "private_self" {
        return if trusted_local {
            TrustZone::PrivateSelf
        } else {
            TrustZone::OutsideContact // Safe fallback if not on trusted local host
        };
    }
    
    match explicit_clean.as_str() {
        "trusted_collaborator" => TrustZone::TrustedCollaborator,
        "outside_contact" => TrustZone::OutsideContact,
        "paid_public" => TrustZone::PaidPublic,
        _ => {
            let channel_clean = channel.trim().to_lowercase();
            if channel_clean == "execute" {
                TrustZone::PaidPublic
            } else if channel_clean == "local" && trusted_local {
                TrustZone::PrivateSelf
            } else {
                TrustZone::OutsideContact
            }
        }
    }
}

/// Parses a raw string into a ContinuityMode.
pub fn get_continuity_mode(explicit: Option<&str>) -> ContinuityMode {
    match explicit.unwrap_or("").trim().to_lowercase().as_str() {
        "client" => ContinuityMode::Client,
        "ephemeral" => ContinuityMode::Ephemeral,
        _ => ContinuityMode::Default,
    }
}

/// Hardcoded baseline capabilities (procedural implementation).
pub fn get_trust_zone_capabilities(zone: TrustZone, mode: ContinuityMode) -> Capabilities {
    let paid_public = zone == TrustZone::PaidPublic;
    let ephemeral_history = paid_public && mode != ContinuityMode::Client;
    
    let repo_retrieval_allowed = zone == TrustZone::PrivateSelf || zone == TrustZone::TrustedCollaborator;
    let durable_memory_allowed = zone == TrustZone::PrivateSelf || zone == TrustZone::TrustedCollaborator;
    
    let retention_scope = if paid_public {
        if ephemeral_history {
            "ephemeral"
        } else {
            "conversation_only"
        }
    } else {
        "local_conversation"
    };
    
    let expiry_policy = if paid_public && !ephemeral_history {
        "7_days_inactivity_operator_deletable"
    } else {
        "none"
    };
    
    Capabilities {
        trust_zone: zone,
        continuity_mode: mode,
        retention_scope: retention_scope.to_string(),
        ephemeral_history,
        repo_retrieval_allowed,
        durable_memory_allowed,
        expiry_policy: expiry_policy.to_string(),
    }
}


// =========================================================================
// 2. Dynamic Memory Decay Curves
// =========================================================================

/// Defines classes of saved memories, each decaying under distinct half-life curves.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryClass {
    /// Concrete architectural and design decisions (authority-preserved, no decay, review only).
    ProjectDecision,
    /// Explicit statements or facts claimed by the user (authority-preserved, no decay, review only).
    UserClaim,
    /// Abstract code structures, strategies, or patterns (half-life of 365 days).
    ReusablePattern,
    /// Empirical observations made by the assistant (half-life of 180 days).
    AssistantObservation,
    /// Default fallback class (half-life of 180 days).
    Unclassified,
}

/// Metadata attached to a memory fragment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocMetadata {
    pub memory_class: MemoryClass,
    /// Epoch timestamp (in milliseconds) of the last review.
    pub last_reviewed: Option<u64>,
    /// Epoch timestamp (in milliseconds) of memory creation.
    pub captured_at: Option<u64>,
}

/// Results computed from the exponential decay curve.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecayResult {
    /// Calculated weight factor (between 0.0 and 1.0).
    pub factor: f64,
    /// The mathematical decay policy applied.
    pub policy: String,
    /// Age of the memory in fractional days.
    pub age_in_days: Option<f64>,
    /// True if an authority-preserved memory is older than 365 days and needs review.
    pub review_due: bool,
}

/// Calculates memory weight decay using the half-life formula:
///
///   `Factor = 0.5 ^ (age_in_days / half_life_in_days)`
///
/// Under clock skew or negative time differences, age is clamped to 0.0.
pub fn calculate_decay(meta: &DocMetadata, now_ms: u64) -> DecayResult {
    let date_ms = meta.last_reviewed.or(meta.captured_at);
    
    let age_in_days = match date_ms {
        None => None,
        Some(t) => {
            if now_ms >= t {
                Some((now_ms - t) as f64 / (1000.0 * 60.0 * 60.0 * 24.0))
            } else {
                Some(0.0) // Clamp to avoid negative age from clock skew
            }
        }
    };
    
    match meta.memory_class {
        MemoryClass::ProjectDecision | MemoryClass::UserClaim => {
            let review_due = match age_in_days {
                None => false,
                Some(age) => age >= 365.0,
            };
            DecayResult {
                factor: 1.0, // Decay-immune
                policy: "authority_preserved_review_age_only".to_string(),
                age_in_days,
                review_due,
            }
        }
        MemoryClass::ReusablePattern => {
            let factor = match age_in_days {
                None => 1.0,
                Some(age) => 0.5f64.powf(age / 365.0),
            };
            DecayResult {
                factor,
                policy: "relevance_half_life_365_days".to_string(),
                age_in_days,
                review_due: false,
            }
        }
        MemoryClass::AssistantObservation | MemoryClass::Unclassified => {
            let factor = match age_in_days {
                None => 1.0,
                Some(age) => 0.5f64.powf(age / 180.0),
            };
            DecayResult {
                factor,
                policy: "relevance_half_life_180_days".to_string(),
                age_in_days,
                review_due: false,
            }
        }
    }
}


// =========================================================================
// 3. Mechanism Sieve Verification
// =========================================================================

/// Structured proposal for a system mechanism.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SieveProposal {
    pub title: String,
    pub capability: String,
    pub ownership: String,
    pub funding: String,
    pub governance: String,
    pub enforcement: String,
    pub exit: String,
    pub capture_risk: String,
    pub simplification: String,
    pub wellbeing_metrics: String,
}

/// Sieve validation outcomes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SieveResult {
    /// True if no fatal errors were detected.
    pub ok: bool,
    /// Blockers that reject the mechanism.
    pub errors: Vec<String>,
    /// Warnings or recommended improvements.
    pub warnings: Vec<String>,
}

/// Validates a mechanism proposal against structural safety requirements (procedural logic).
pub fn validate_mechanism_sieve(proposal: &SieveProposal) -> SieveResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Required fields check
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

    // 1. Exit strategy check
    let exit_text = proposal.exit.to_lowercase();
    let exit_trimmed = exit_text.trim();
    let no_exit_keywords = ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"];
    if no_exit_keywords.iter().any(|&kw| exit_trimmed.contains(kw)) || exit_trimmed.len() < 15 {
        errors.push("Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.".to_string());
    }

    // 2. Chokepoint & Capture risk check
    let cap_risk = proposal.capture_risk.to_lowercase();
    let cap_risk_trimmed = cap_risk.trim();
    let ownership_text = proposal.ownership.to_lowercase();
    let ownership_trimmed = ownership_text.trim();
    if cap_risk_trimmed.contains("no mitigation") ||
       cap_risk_trimmed.contains("operator absolute control") ||
       ownership_trimmed.contains("absolute operator ownership") {
        errors.push("Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.".to_string());
    }

    // 3. Wellbeing metrics check (Anti-metric capture check)
    let metrics = proposal.wellbeing_metrics.to_lowercase();
    let metrics_trimmed = metrics.trim();
    let bad_metrics = ["tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"];
    let good_metrics = ["patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"];

    let has_bad_metric = bad_metrics.iter().any(|&bm| metrics_trimmed.contains(bm));
    let has_good_metric = good_metrics.iter().any(|&gm| metrics_trimmed.contains(gm));
    let has_bad_metric_only = has_bad_metric && !has_good_metric;

    if has_bad_metric_only || metrics_trimmed.len() < 15 {
        errors.push("Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.".to_string());
    }

    // 4. Governance check (non-fatal warning)
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


// =========================================================================
// 4. Declarative Ruleset & Configuration Specification
// =========================================================================

/// Configuration schema representing capability overrides and rules.
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

/// The main declarative ruleset loaded from JSON, mapping spec to runtime execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeclarativeRuleset {
    pub capabilities: HashMap<String, RawCapabilities>,
    pub overrides: Vec<OverrideRule>,
    pub sieve_rules: SieveRules,
}

// Default configuration ruleset JSON data embedded directly as a string.
// This matches the baseline `rules.json` spec.
const DEFAULT_RULES_JSON: &str = r#"{
  "capabilities": {
    "private_self": {
      "repo_retrieval_allowed": true,
      "durable_memory_allowed": true,
      "retention_scope": "local_conversation",
      "ephemeral_history": false,
      "expiry_policy": "none"
    },
    "trusted_collaborator": {
      "repo_retrieval_allowed": true,
      "durable_memory_allowed": true,
      "retention_scope": "local_conversation",
      "ephemeral_history": false,
      "expiry_policy": "none"
    },
    "outside_contact": {
      "repo_retrieval_allowed": false,
      "durable_memory_allowed": false,
      "retention_scope": "local_conversation",
      "ephemeral_history": false,
      "expiry_policy": "none"
    },
    "paid_public": {
      "repo_retrieval_allowed": false,
      "durable_memory_allowed": false,
      "retention_scope": "conversation_only",
      "ephemeral_history": false,
      "expiry_policy": "7_days_inactivity_operator_deletable"
    }
  },
  "overrides": [
    {
      "condition": {
        "trust_zone": "paid_public",
        "continuity_mode_not": "client"
      },
      "updates": {
        "retention_scope": "ephemeral",
        "ephemeral_history": true,
        "expiry_policy": "none"
      }
    }
  ],
  "sieve_rules": {
    "exit_min_length": 15,
    "exit_forbidden_keywords": ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"],
    "capture_forbidden_mitigations": ["no mitigation", "operator absolute control", "absolute operator ownership"],
    "wellbeing_bad_metrics": ["tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"],
    "wellbeing_good_metrics": ["patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"]
  }
}"#;

impl DeclarativeRuleset {
    /// Loads the declarative ruleset from the embedded default JSON string.
    pub fn load_default() -> Self {
        serde_json::from_str(DEFAULT_RULES_JSON).expect("Failed to parse embedded rules.json")
    }

    /// Evaluates capabilities using the loaded ruleset and override lists.
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

        // Fetch baseline rules
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

        // Apply matching override rules
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

    /// Evaluates a SieveProposal against the declarative sieve parameters.
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
