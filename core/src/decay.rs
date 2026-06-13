use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryClass {
    ProjectDecision,
    UserClaim,
    ReusablePattern,
    AssistantObservation,
    Unclassified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocMetadata {
    pub memory_class: MemoryClass,
    pub last_reviewed: Option<u64>, // timestamp in ms
    pub captured_at: Option<u64>,    // timestamp in ms
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecayResult {
    pub factor: f64,
    pub policy: String,
    pub age_in_days: Option<f64>,
    pub review_due: bool,
}

pub fn calculate_decay(meta: &DocMetadata, now_ms: u64) -> DecayResult {
    let date_ms = meta.last_reviewed.or(meta.captured_at);
    
    let age_in_days = match date_ms {
        None => None,
        Some(t) => {
            if now_ms >= t {
                Some((now_ms - t) as f64 / (1000.0 * 60.0 * 60.0 * 24.0))
            } else {
                Some(0.0) // Clamp to 0 to avoid negative age in testing or clock skew
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
                factor: 1.0,
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
