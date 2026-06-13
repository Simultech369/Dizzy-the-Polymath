pub mod trust;
pub mod decay;
pub mod sieve;
pub mod rules;
pub mod dizzy_core_spec;

#[cfg(test)]
mod tests {
    use super::trust::*;
    use super::decay::*;
    use super::sieve::*;
    use super::rules::*;

    #[test]
    fn test_trust_zone_resolution() {
        // Test explicit zone resolution
        assert_eq!(
            get_trust_zone(Some("private_self"), true, "local"),
            TrustZone::PrivateSelf
        );
        assert_eq!(
            get_trust_zone(Some("private_self"), false, "local"),
            TrustZone::OutsideContact // Fails safe if not trusted local
        );
        assert_eq!(
            get_trust_zone(Some("trusted_collaborator"), false, "local"),
            TrustZone::TrustedCollaborator
        );
        assert_eq!(
            get_trust_zone(Some("paid_public"), false, "local"),
            TrustZone::PaidPublic
        );

        // Test channel-based fallback resolution
        assert_eq!(
            get_trust_zone(None, false, "execute"),
            TrustZone::PaidPublic
        );
        assert_eq!(
            get_trust_zone(None, true, "local"),
            TrustZone::PrivateSelf
        );
        assert_eq!(
            get_trust_zone(None, false, "local"),
            TrustZone::OutsideContact
        );
    }

    #[test]
    fn test_trust_zone_capabilities() {
        // PrivateSelf capabilities
        let caps_private = get_trust_zone_capabilities(TrustZone::PrivateSelf, ContinuityMode::Default);
        assert_eq!(caps_private.repo_retrieval_allowed, true);
        assert_eq!(caps_private.durable_memory_allowed, true);
        assert_eq!(caps_private.retention_scope, "local_conversation");
        assert_eq!(caps_private.ephemeral_history, false);
        assert_eq!(caps_private.expiry_policy, "none");

        // PaidPublic (default) capabilities
        let caps_paid_default = get_trust_zone_capabilities(TrustZone::PaidPublic, ContinuityMode::Default);
        assert_eq!(caps_paid_default.repo_retrieval_allowed, false);
        assert_eq!(caps_paid_default.durable_memory_allowed, false);
        assert_eq!(caps_paid_default.retention_scope, "ephemeral");
        assert_eq!(caps_paid_default.ephemeral_history, true);
        assert_eq!(caps_paid_default.expiry_policy, "none");

        // PaidPublic (client continuity) capabilities
        let caps_paid_client = get_trust_zone_capabilities(TrustZone::PaidPublic, ContinuityMode::Client);
        assert_eq!(caps_paid_client.repo_retrieval_allowed, false);
        assert_eq!(caps_paid_client.durable_memory_allowed, false);
        assert_eq!(caps_paid_client.retention_scope, "conversation_only");
        assert_eq!(caps_paid_client.ephemeral_history, false);
        assert_eq!(caps_paid_client.expiry_policy, "7_days_inactivity_operator_deletable");
    }

    #[test]
    fn test_memory_decay() {
        // Standard time: 10 days in ms (10 * 24 * 60 * 60 * 1000)
        let ten_days_ms = 10 * 24 * 60 * 60 * 1000;
        let now = 100_000_000_000u64;
        let captured = now - ten_days_ms;

        // 1. Authority Preserved (ProjectDecision / UserClaim)
        let meta_decision = DocMetadata {
            memory_class: MemoryClass::ProjectDecision,
            last_reviewed: Some(captured),
            captured_at: None,
        };
        let res_decision = calculate_decay(&meta_decision, now);
        assert_eq!(res_decision.factor, 1.0);
        assert_eq!(res_decision.review_due, false);
        assert_eq!(res_decision.age_in_days, Some(10.0));

        // Over 365 days review due
        let one_year_ms = 366 * 24 * 60 * 60 * 1000;
        let captured_old = now - one_year_ms;
        let meta_decision_old = DocMetadata {
            memory_class: MemoryClass::ProjectDecision,
            last_reviewed: Some(captured_old),
            captured_at: None,
        };
        let res_decision_old = calculate_decay(&meta_decision_old, now);
        assert_eq!(res_decision_old.factor, 1.0);
        assert_eq!(res_decision_old.review_due, true);

        // 2. ReusablePattern (365 days half-life)
        let captured_pattern = now - (365 * 24 * 60 * 60 * 1000);
        let meta_pattern = DocMetadata {
            memory_class: MemoryClass::ReusablePattern,
            last_reviewed: None,
            captured_at: Some(captured_pattern),
        };
        let res_pattern = calculate_decay(&meta_pattern, now);
        assert!((res_pattern.factor - 0.5).abs() < 1e-5);
        assert_eq!(res_pattern.review_due, false);

        // 3. AssistantObservation (180 days half-life)
        let captured_obs = now - (180 * 24 * 60 * 60 * 1000);
        let meta_obs = DocMetadata {
            memory_class: MemoryClass::AssistantObservation,
            last_reviewed: None,
            captured_at: Some(captured_obs),
        };
        let res_obs = calculate_decay(&meta_obs, now);
        assert!((res_obs.factor - 0.5).abs() < 1e-5);
    }

    #[test]
    fn test_mechanism_sieve() {
        // 1. Valid proposal
        let valid = SieveProposal {
            title: "Fiduciary Commons".to_string(),
            capability: "Enables distributed pharmacy routing.".to_string(),
            ownership: "Multi-party cooperative ownership floor.".to_string(),
            funding: "Subsidized through transaction fees routing surplus.".to_string(),
            governance: "Liquid democracy rules with arbitration and appeal paths.".to_string(),
            enforcement: "Graduated sanctions backed by multi-sig lockup.".to_string(),
            exit: "Portability of all history and keys is guaranteed at any time.".to_string(),
            capture_risk: "Chokepoints mitigated by decentralized hosting.".to_string(),
            simplification: "Removes third-party clearing brokers.".to_string(),
            wellbeing_metrics: "Portability checks and stabilized patient access metrics.".to_string(),
        };
        let res_valid = validate_mechanism_sieve(&valid);
        assert_eq!(res_valid.ok, true);
        assert_eq!(res_valid.errors.is_empty(), true);
        assert_eq!(res_valid.warnings.is_empty(), true);

        // 2. Missing fields
        let mut invalid = valid.clone();
        invalid.exit = "".to_string();
        let res_invalid = validate_mechanism_sieve(&invalid);
        assert_eq!(res_invalid.ok, false);
        assert_eq!(res_invalid.errors.len(), 1);
        assert!(res_invalid.errors[0].contains("required sieve field: 'exit'"));

        // 3. Bad exit strategy
        let mut bad_exit = valid.clone();
        bad_exit.exit = "No exit allowed for users.".to_string();
        let res_bad_exit = validate_mechanism_sieve(&bad_exit);
        assert_eq!(res_bad_exit.ok, false);
        assert!(res_bad_exit.errors[0].contains("Exit strategy is missing"));

        // 4. Speculation metrics capture detection
        let mut bad_metrics = valid.clone();
        bad_metrics.wellbeing_metrics = "Optimize for tvl and token price.".to_string();
        let res_bad_metrics = validate_mechanism_sieve(&bad_metrics);
        assert_eq!(res_bad_metrics.ok, false);
        assert!(res_bad_metrics.errors[0].contains("Metrics capture detected"));

        // 5. Governance warning
        let mut no_appeal_gov = valid.clone();
        no_appeal_gov.governance = "Board of directors has absolute rule.".to_string();
        let res_no_appeal = validate_mechanism_sieve(&no_appeal_gov);
        assert_eq!(res_no_appeal.ok, true); // Still ok (warning only)
        assert_eq!(res_no_appeal.warnings.len(), 1);
        assert!(res_no_appeal.warnings[0].contains("lacks explicit dispute appeals"));
    }

    #[test]
    fn test_declarative_ruleset() {
        let ruleset = DeclarativeRuleset::load_default();

        // 1. Verify capabilities evaluation matching trust.rs
        let caps_private = ruleset.get_capabilities(TrustZone::PrivateSelf, ContinuityMode::Default);
        assert_eq!(caps_private.repo_retrieval_allowed, true);
        assert_eq!(caps_private.durable_memory_allowed, true);
        assert_eq!(caps_private.retention_scope, "local_conversation");

        let caps_paid_default = ruleset.get_capabilities(TrustZone::PaidPublic, ContinuityMode::Default);
        assert_eq!(caps_paid_default.repo_retrieval_allowed, false);
        assert_eq!(caps_paid_default.durable_memory_allowed, false);
        assert_eq!(caps_paid_default.retention_scope, "ephemeral");
        assert_eq!(caps_paid_default.ephemeral_history, true);
        assert_eq!(caps_paid_default.expiry_policy, "none");

        let caps_paid_client = ruleset.get_capabilities(TrustZone::PaidPublic, ContinuityMode::Client);
        assert_eq!(caps_paid_client.retention_scope, "conversation_only");
        assert_eq!(caps_paid_client.ephemeral_history, false);
        assert_eq!(caps_paid_client.expiry_policy, "7_days_inactivity_operator_deletable");

        // 2. Verify sieve validation matching sieve.rs
        let valid = SieveProposal {
            title: "Fiduciary Commons".to_string(),
            capability: "Enables distributed pharmacy routing.".to_string(),
            ownership: "Multi-party cooperative ownership floor.".to_string(),
            funding: "Subsidized through transaction fees routing surplus.".to_string(),
            governance: "Liquid democracy rules with arbitration and appeal paths.".to_string(),
            enforcement: "Graduated sanctions backed by multi-sig lockup.".to_string(),
            exit: "Portability of all history and keys is guaranteed at any time.".to_string(),
            capture_risk: "Chokepoints mitigated by decentralized hosting.".to_string(),
            simplification: "Removes third-party clearing brokers.".to_string(),
            wellbeing_metrics: "Portability checks and stabilized patient access metrics.".to_string(),
        };
        let res_valid = ruleset.validate_sieve(&valid);
        assert_eq!(res_valid.ok, true);

        let mut bad_exit = valid.clone();
        bad_exit.exit = "No exit allowed.".to_string();
        let res_bad_exit = ruleset.validate_sieve(&bad_exit);
        assert_eq!(res_bad_exit.ok, false);
    }

    #[test]
    fn test_dizzy_core_spec_equivalence() {
        use super::dizzy_core_spec;

        // 1. Verify decay spec equivalence
        let now = 100_000_000_000u64;
        let ten_days_ms = 10 * 24 * 60 * 60 * 1000;
        let meta = DocMetadata {
            memory_class: MemoryClass::ReusablePattern,
            last_reviewed: None,
            captured_at: Some(now - ten_days_ms),
        };
        let res_base = calculate_decay(&meta, now);

        let spec_meta = dizzy_core_spec::DocMetadata {
            memory_class: dizzy_core_spec::MemoryClass::ReusablePattern,
            last_reviewed: None,
            captured_at: Some(now - ten_days_ms),
        };
        let res_spec = dizzy_core_spec::calculate_decay(&spec_meta, now);
        assert_eq!(res_base.factor, res_spec.factor);
        assert_eq!(res_base.policy, res_spec.policy);

        // 2. Verify capability ruleset equivalence
        let ruleset_base = DeclarativeRuleset::load_default();
        let ruleset_spec = dizzy_core_spec::DeclarativeRuleset::load_default();

        let caps_base = ruleset_base.get_capabilities(TrustZone::PrivateSelf, ContinuityMode::Default);
        let caps_spec = ruleset_spec.get_capabilities(
            dizzy_core_spec::TrustZone::PrivateSelf,
            dizzy_core_spec::ContinuityMode::Default,
        );
        assert_eq!(caps_base.repo_retrieval_allowed, caps_spec.repo_retrieval_allowed);
        assert_eq!(caps_base.durable_memory_allowed, caps_spec.durable_memory_allowed);
        assert_eq!(caps_base.retention_scope, caps_spec.retention_scope);
    }
}
