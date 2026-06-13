use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrustZone {
    PrivateSelf,
    TrustedCollaborator,
    OutsideContact,
    PaidPublic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContinuityMode {
    Client,
    Ephemeral,
    Default,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    pub trust_zone: TrustZone,
    pub continuity_mode: ContinuityMode,
    pub retention_scope: String,
    pub ephemeral_history: bool,
    pub repo_retrieval_allowed: bool,
    pub durable_memory_allowed: bool,
    pub expiry_policy: String,
}

pub fn get_trust_zone(explicit: Option<&str>, trusted_local: bool, channel: &str) -> TrustZone {
    let explicit_clean = explicit.unwrap_or("").trim().to_lowercase();
    
    // Explicit overrides must be checked
    if explicit_clean == "private_self" {
        return if trusted_local {
            TrustZone::PrivateSelf
        } else {
            TrustZone::OutsideContact
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

pub fn get_continuity_mode(explicit: Option<&str>) -> ContinuityMode {
    match explicit.unwrap_or("").trim().to_lowercase().as_str() {
        "client" => ContinuityMode::Client,
        "ephemeral" => ContinuityMode::Ephemeral,
        _ => ContinuityMode::Default,
    }
}

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
