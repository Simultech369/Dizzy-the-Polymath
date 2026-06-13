use serde::{Serialize, Deserialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SieveResult {
    pub ok: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn validate_mechanism_sieve(proposal: &SieveProposal) -> SieveResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Required core keys validation
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
        return SieveResult {
            ok: false,
            errors,
            warnings,
        };
    }

    // 1. Exit & Portability validation
    let exit_text = proposal.exit.to_lowercase();
    let exit_trimmed = exit_text.trim();
    let no_exit_keywords = ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"];
    if no_exit_keywords.iter().any(|&kw| exit_trimmed.contains(kw)) || exit_trimmed.len() < 15 {
        errors.push("Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.".to_string());
    }

    // 2. Anti-chokepoint / Rent-seeking validation
    let cap_risk = proposal.capture_risk.to_lowercase();
    let cap_risk_trimmed = cap_risk.trim();
    let ownership_text = proposal.ownership.to_lowercase();
    let ownership_trimmed = ownership_text.trim();
    if cap_risk_trimmed.contains("no mitigation") ||
       cap_risk_trimmed.contains("operator absolute control") ||
       ownership_trimmed.contains("absolute operator ownership") {
        errors.push("Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.".to_string());
    }

    // 3. Wellbeing Metrics check (Anti-metric capture)
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

    // Warnings / Recommendations
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
