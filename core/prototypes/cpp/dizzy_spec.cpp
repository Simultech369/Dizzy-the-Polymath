// Dizzy Core System Specification - C++20 Port (Zero-Heap Validation)
#include <string>
#include <string_view>
#include <vector>
#include <unordered_map>
#include <optional>
#include <cmath>
#include <algorithm>
#include <cctype>
#include <cassert>
#include <iostream>

namespace dizzy {

// =========================================================================
// Error & Warning message constants
// =========================================================================
static constexpr std::string_view ERR_TITLE = "Missing or empty required sieve field: 'title'";
static constexpr std::string_view ERR_CAPABILITY = "Missing or empty required sieve field: 'capability'";
static constexpr std::string_view ERR_OWNERSHIP = "Missing or empty required sieve field: 'ownership'";
static constexpr std::string_view ERR_FUNDING = "Missing or empty required sieve field: 'funding'";
static constexpr std::string_view ERR_GOVERNANCE = "Missing or empty required sieve field: 'governance'";
static constexpr std::string_view ERR_ENFORCEMENT = "Missing or empty required sieve field: 'enforcement'";
static constexpr std::string_view ERR_EXIT = "Missing or empty required sieve field: 'exit'";
static constexpr std::string_view ERR_CAPTURE_RISK = "Missing or empty required sieve field: 'captureRisk'";
static constexpr std::string_view ERR_SIMPLIFICATION = "Missing or empty required sieve field: 'simplification'";
static constexpr std::string_view ERR_WELLBEING = "Missing or empty required sieve field: 'wellbeingMetrics'";
static constexpr std::string_view ERR_EXIT_STRATEGY = "Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.";
static constexpr std::string_view ERR_CAPTURE = "Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.";
static constexpr std::string_view ERR_METRICS = "Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.";
static constexpr std::string_view WARN_GOVERNANCE = "Proposal lacks explicit dispute appeals or arbitration paths.";

// =========================================================================
// Utility: Case-insensitive comparison with string_view (no allocations)
// =========================================================================

inline std::string_view trim(std::string_view sv) {
    auto start = sv.find_first_not_of(" \t\n\r");
    if (start == std::string_view::npos) return "";
    auto end = sv.find_last_not_of(" \t\n\r");
    return sv.substr(start, end - start + 1);
}

// Case-insensitive equality using std::equal (no heap)
inline bool iequals(std::string_view a, std::string_view b) {
    if (a.size() != b.size()) return false;
    return std::equal(a.begin(), a.end(), b.begin(), b.end(),
        [](char ca, char cb) { return std::tolower(static_cast<unsigned char>(ca)) == std::tolower(static_cast<unsigned char>(cb)); });
}

// Word-boundary check for a keyword within text
inline bool containsKeywordAsWord(std::string_view text, std::string_view keyword) {
    if (text.size() < keyword.size()) return false;
    
    for (size_t i = 0; i <= text.size() - keyword.size(); ++i) {
        if (std::equal(keyword.begin(), keyword.end(), text.begin() + i,
            [](char a, char b) { return std::tolower(static_cast<unsigned char>(a)) == std::tolower(static_cast<unsigned char>(b)); })) {
            
            // Check word boundaries
            bool before_ok = (i == 0) || !std::isalnum(static_cast<unsigned char>(text[i-1]));
            bool after_ok = (i + keyword.size() == text.size()) || !std::isalnum(static_cast<unsigned char>(text[i+keyword.size()]));
            
            if (before_ok && after_ok) return true;
        }
    }
    return false;
}

// =========================================================================
// 1. Trust & Capabilities Specification
// =========================================================================

enum class TrustZone { PrivateSelf, TrustedCollaborator, OutsideContact, PaidPublic };
enum class ContinuityMode { Client, Ephemeral, Default };

struct Capabilities {
    TrustZone trust_zone;
    ContinuityMode continuity_mode;
    std::string retention_scope;
    bool ephemeral_history;
    bool repo_retrieval_allowed;
    bool durable_memory_allowed;
    std::string expiry_policy;
};

inline std::string_view trustZoneToStr(TrustZone z) {
    switch(z) {
        case TrustZone::PrivateSelf: return "private_self";
        case TrustZone::TrustedCollaborator: return "trusted_collaborator";
        case TrustZone::OutsideContact: return "outside_contact";
        case TrustZone::PaidPublic: return "paid_public";
        default: return "";
    }
}

inline std::string_view continuityModeToStr(ContinuityMode m) {
    switch(m) {
        case ContinuityMode::Client: return "client";
        case ContinuityMode::Ephemeral: return "ephemeral";
        case ContinuityMode::Default: return "default";
        default: return "";
    }
}

inline TrustZone getTrustZone(std::optional<std::string_view> explicit_zone, 
                               bool trusted_local, 
                               std::string_view channel) {
    if (explicit_zone) {
        auto explicit_trimmed = trim(*explicit_zone);
        if (iequals(explicit_trimmed, "private_self")) {
            return trusted_local ? TrustZone::PrivateSelf : TrustZone::OutsideContact;
        }
        if (iequals(explicit_trimmed, "trusted_collaborator")) return TrustZone::TrustedCollaborator;
        if (iequals(explicit_trimmed, "outside_contact")) return TrustZone::OutsideContact;
        if (iequals(explicit_trimmed, "paid_public")) return TrustZone::PaidPublic;
    }
    
    auto channel_trimmed = trim(channel);
    if (iequals(channel_trimmed, "execute")) return TrustZone::PaidPublic;
    if (iequals(channel_trimmed, "local") && trusted_local) return TrustZone::PrivateSelf;
    
    return TrustZone::OutsideContact;
}

inline ContinuityMode getContinuityMode(std::optional<std::string_view> explicit_mode) {
    if (explicit_mode) {
        auto mode_trimmed = trim(*explicit_mode);
        if (iequals(mode_trimmed, "client")) return ContinuityMode::Client;
        if (iequals(mode_trimmed, "ephemeral")) return ContinuityMode::Ephemeral;
    }
    return ContinuityMode::Default;
}

inline Capabilities getTrustZoneCapabilities(TrustZone zone, ContinuityMode mode) {
    bool paid_public = (zone == TrustZone::PaidPublic);
    bool ephemeral_history = paid_public && (mode != ContinuityMode::Client);
    
    bool repo_allowed = (zone == TrustZone::PrivateSelf || zone == TrustZone::TrustedCollaborator);
    bool durable_allowed = repo_allowed;
    
    std::string retention_scope;
    if (paid_public) {
        retention_scope = ephemeral_history ? "ephemeral" : "conversation_only";
    } else {
        retention_scope = "local_conversation";
    }
    
    std::string expiry_policy = (paid_public && !ephemeral_history) 
                                ? "7_days_inactivity_operator_deletable" 
                                : "none";
    
    return Capabilities{zone, mode, std::move(retention_scope), ephemeral_history,
                        repo_allowed, durable_allowed, std::move(expiry_policy)};
}

// =========================================================================
// 2. Dynamic Memory Decay Curves
// =========================================================================

enum class MemoryClass { ProjectDecision, UserClaim, ReusablePattern, AssistantObservation, Unclassified };

struct DocMetadata {
    MemoryClass memory_class;
    std::optional<uint64_t> last_reviewed;
    std::optional<uint64_t> captured_at;
};

struct DecayResult {
    double factor;
    std::string policy;
    std::optional<double> age_in_days;
    bool review_due;
};

inline DecayResult calculateDecay(const DocMetadata& meta, uint64_t now_ms) {
    std::optional<uint64_t> date_ms = meta.last_reviewed ? meta.last_reviewed : meta.captured_at;
    
    std::optional<double> age_in_days;
    if (date_ms) {
        if (now_ms >= *date_ms) {
            age_in_days = static_cast<double>(now_ms - *date_ms) / (86400000.0);
        } else {
            age_in_days = 0.0;  // Clamp negative age
        }
    }
    
    switch (meta.memory_class) {
        case MemoryClass::ProjectDecision:
        case MemoryClass::UserClaim:
            return DecayResult{1.0, "authority_preserved_review_age_only", age_in_days,
                               age_in_days && *age_in_days >= 365.0};
        case MemoryClass::ReusablePattern:
            return DecayResult{age_in_days ? std::pow(0.5, *age_in_days / 365.0) : 1.0,
                               "relevance_half_life_365_days", age_in_days, false};
        default:
            return DecayResult{age_in_days ? std::pow(0.5, *age_in_days / 180.0) : 1.0,
                               "relevance_half_life_180_days", age_in_days, false};
    }
}

// =========================================================================
// 3. Mechanism Sieve Verification (Zero-Heap)
// =========================================================================

struct SieveProposal {
    std::string_view title;
    std::string_view capability;
    std::string_view ownership;
    std::string_view funding;
    std::string_view governance;
    std::string_view enforcement;
    std::string_view exit;
    std::string_view capture_risk;
    std::string_view simplification;
    std::string_view wellbeing_metrics;
};

struct SieveResult {
    bool ok;
    std::vector<std::string_view> errors;    // String views into static strings
    std::vector<std::string_view> warnings;
};

inline bool isEmptyField(std::string_view field) {
    return trim(field).empty();
}

inline SieveResult validateMechanismSieve(const SieveProposal& proposal) {
    std::vector<std::string_view> errors;
    std::vector<std::string_view> warnings;
    errors.reserve(16);
    warnings.reserve(4);
    
    // Required fields check
    if (isEmptyField(proposal.title)) errors.push_back(ERR_TITLE);
    if (isEmptyField(proposal.capability)) errors.push_back(ERR_CAPABILITY);
    if (isEmptyField(proposal.ownership)) errors.push_back(ERR_OWNERSHIP);
    if (isEmptyField(proposal.funding)) errors.push_back(ERR_FUNDING);
    if (isEmptyField(proposal.governance)) errors.push_back(ERR_GOVERNANCE);
    if (isEmptyField(proposal.enforcement)) errors.push_back(ERR_ENFORCEMENT);
    if (isEmptyField(proposal.exit)) errors.push_back(ERR_EXIT);
    if (isEmptyField(proposal.capture_risk)) errors.push_back(ERR_CAPTURE_RISK);
    if (isEmptyField(proposal.simplification)) errors.push_back(ERR_SIMPLIFICATION);
    if (isEmptyField(proposal.wellbeing_metrics)) errors.push_back(ERR_WELLBEING);
    
    if (!errors.empty()) {
        return SieveResult{false, std::move(errors), std::move(warnings)};
    }
    
    auto exit_trimmed = trim(proposal.exit);
    auto cap_risk_trimmed = trim(proposal.capture_risk);
    auto ownership_trimmed = trim(proposal.ownership);
    auto metrics_trimmed = trim(proposal.wellbeing_metrics);
    auto gov_trimmed = trim(proposal.governance);
    
    // 1. Exit strategy check with word boundaries
    const std::vector<std::string_view> no_exit_keywords = {
        "none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"
    };
    
    bool has_forbidden = false;
    for (auto kw : no_exit_keywords) {
        if (containsKeywordAsWord(exit_trimmed, kw)) {
            has_forbidden = true;
            break;
        }
    }
    
    if (has_forbidden || exit_trimmed.size() < 15) {
        errors.push_back(ERR_EXIT_STRATEGY);
    }
    
    // 2. Capture risk check
    const std::vector<std::string_view> capture_mitigations = {
        "no mitigation", "operator absolute control"
    };
    
    bool capture_violation = false;
    for (auto m : capture_mitigations) {
        if (containsKeywordAsWord(cap_risk_trimmed, m)) {
            capture_violation = true;
            break;
        }
    }
    
    if (capture_violation || containsKeywordAsWord(ownership_trimmed, "absolute operator ownership")) {
        errors.push_back(ERR_CAPTURE);
    }
    
    // 3. Wellbeing metrics check
    const std::vector<std::string_view> bad_metrics = {
        "tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"
    };
    const std::vector<std::string_view> good_metrics = {
        "patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"
    };
    
    bool has_bad = false;
    for (auto bm : bad_metrics) {
        if (containsKeywordAsWord(metrics_trimmed, bm)) {
            has_bad = true;
            break;
        }
    }
    
    bool has_good = false;
    for (auto gm : good_metrics) {
        if (containsKeywordAsWord(metrics_trimmed, gm)) {
            has_good = true;
            break;
        }
    }
    
    if ((has_bad && !has_good) || metrics_trimmed.size() < 15) {
        errors.push_back(ERR_METRICS);
    }
    
    // 4. Governance warning
    if (!containsKeywordAsWord(gov_trimmed, "appeal") && !containsKeywordAsWord(gov_trimmed, "arbitration")) {
        warnings.push_back(WARN_GOVERNANCE);
    }
    
    return SieveResult{errors.empty(), std::move(errors), std::move(warnings)};
}

// =========================================================================
// 4. Declarative Ruleset
// =========================================================================

struct RawCapabilities {
    bool repo_retrieval_allowed;
    bool durable_memory_allowed;
    std::string retention_scope;
    bool ephemeral_history;
    std::string expiry_policy;
};

struct OverrideCondition {
    std::string trust_zone;
    std::string continuity_mode_not;
};

struct RawCapabilitiesUpdate {
    std::optional<std::string> retention_scope;
    std::optional<bool> ephemeral_history;
    std::optional<std::string> expiry_policy;
};

struct OverrideRule {
    OverrideCondition condition;
    RawCapabilitiesUpdate updates;
};

struct SieveRules {
    size_t exit_min_length;
    std::vector<std::string_view> exit_forbidden_keywords;
    std::vector<std::string_view> capture_forbidden_mitigations;
    std::vector<std::string_view> wellbeing_bad_metrics;
    std::vector<std::string_view> wellbeing_good_metrics;
};

class DeclarativeRuleset {
public:
    std::unordered_map<std::string, RawCapabilities> capabilities;
    std::vector<OverrideRule> overrides;
    SieveRules sieve_rules;
    
    static DeclarativeRuleset load_default() {
        DeclarativeRuleset ruleset;
        
        ruleset.capabilities["private_self"] = RawCapabilities{true, true, "local_conversation", false, "none"};
        ruleset.capabilities["trusted_collaborator"] = RawCapabilities{true, true, "local_conversation", false, "none"};
        ruleset.capabilities["outside_contact"] = RawCapabilities{false, false, "local_conversation", false, "none"};
        ruleset.capabilities["paid_public"] = RawCapabilities{false, false, "conversation_only", false, "7_days_inactivity_operator_deletable"};
        
        OverrideRule override_rule;
        override_rule.condition = OverrideCondition{"paid_public", "client"};
        override_rule.updates.retention_scope = std::optional<std::string>("ephemeral");
        override_rule.updates.ephemeral_history = std::optional<bool>(true);
        override_rule.updates.expiry_policy = std::optional<std::string>("none");
        ruleset.overrides.push_back(std::move(override_rule));
        
        ruleset.sieve_rules.exit_min_length = 15;
        ruleset.sieve_rules.exit_forbidden_keywords = {"none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"};
        ruleset.sieve_rules.capture_forbidden_mitigations = {"no mitigation", "operator absolute control"};
        ruleset.sieve_rules.wellbeing_bad_metrics = {"tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"};
        ruleset.sieve_rules.wellbeing_good_metrics = {"patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"};
        
        return ruleset;
    }
    
    Capabilities get_capabilities(TrustZone zone, ContinuityMode mode) const {
        std::string_view zone_str = trustZoneToStr(zone);
        std::string_view mode_str = continuityModeToStr(mode);
        
        auto it = capabilities.find(std::string(zone_str));
        RawCapabilities raw;
        if (it != capabilities.end()) {
            raw = it->second;
        } else {
            raw = RawCapabilities{false, false, "local_conversation", false, "none"};
        }
        
        std::string final_scope = raw.retention_scope;
        bool final_ephemeral = raw.ephemeral_history;
        std::string final_expiry = raw.expiry_policy;
        
        for (const auto& rule : overrides) {
            if (rule.condition.trust_zone == zone_str && 
                rule.condition.continuity_mode_not != mode_str) {
                if (rule.updates.retention_scope.has_value()) {
                    final_scope = rule.updates.retention_scope.value();
                }
                if (rule.updates.ephemeral_history.has_value()) {
                    final_ephemeral = rule.updates.ephemeral_history.value();
                }
                if (rule.updates.expiry_policy.has_value()) {
                    final_expiry = rule.updates.expiry_policy.value();
                }
            }
        }
        
        return Capabilities{
            zone, mode,
            final_scope,
            final_ephemeral,
            raw.repo_retrieval_allowed,
            raw.durable_memory_allowed,
            final_expiry
        };
    }
    
    SieveResult validateSieve(const SieveProposal& proposal) const {
        std::vector<std::string_view> errors;
        std::vector<std::string_view> warnings;
        errors.reserve(16);
        warnings.reserve(4);
        
        if (isEmptyField(proposal.title)) errors.push_back(ERR_TITLE);
        if (isEmptyField(proposal.capability)) errors.push_back(ERR_CAPABILITY);
        if (isEmptyField(proposal.ownership)) errors.push_back(ERR_OWNERSHIP);
        if (isEmptyField(proposal.funding)) errors.push_back(ERR_FUNDING);
        if (isEmptyField(proposal.governance)) errors.push_back(ERR_GOVERNANCE);
        if (isEmptyField(proposal.enforcement)) errors.push_back(ERR_ENFORCEMENT);
        if (isEmptyField(proposal.exit)) errors.push_back(ERR_EXIT);
        if (isEmptyField(proposal.capture_risk)) errors.push_back(ERR_CAPTURE_RISK);
        if (isEmptyField(proposal.simplification)) errors.push_back(ERR_SIMPLIFICATION);
        if (isEmptyField(proposal.wellbeing_metrics)) errors.push_back(ERR_WELLBEING);
        
        if (!errors.empty()) {
            return SieveResult{false, std::move(errors), std::move(warnings)};
        }
        
        auto exit_trimmed = trim(proposal.exit);
        auto cap_risk_trimmed = trim(proposal.capture_risk);
        auto ownership_trimmed = trim(proposal.ownership);
        auto metrics_trimmed = trim(proposal.wellbeing_metrics);
        auto gov_trimmed = trim(proposal.governance);
        
        bool has_forbidden = false;
        for (auto kw : sieve_rules.exit_forbidden_keywords) {
            if (containsKeywordAsWord(exit_trimmed, kw)) {
                has_forbidden = true;
                break;
            }
        }
        
        if (has_forbidden || exit_trimmed.size() < sieve_rules.exit_min_length) {
            errors.push_back(ERR_EXIT_STRATEGY);
        }
        
        bool capture_violation = false;
        for (auto m : sieve_rules.capture_forbidden_mitigations) {
            if (containsKeywordAsWord(cap_risk_trimmed, m)) {
                capture_violation = true;
                break;
            }
        }
        
        if (capture_violation || containsKeywordAsWord(ownership_trimmed, "absolute operator ownership")) {
            errors.push_back(ERR_CAPTURE);
        }
        
        bool has_bad = false;
        for (auto bm : sieve_rules.wellbeing_bad_metrics) {
            if (containsKeywordAsWord(metrics_trimmed, bm)) {
                has_bad = true;
                break;
            }
        }
        
        bool has_good = false;
        for (auto gm : sieve_rules.wellbeing_good_metrics) {
            if (containsKeywordAsWord(metrics_trimmed, gm)) {
                has_good = true;
                break;
            }
        }
        
        if ((has_bad && !has_good) || metrics_trimmed.size() < 15) {
            errors.push_back(ERR_METRICS);
        }
        
        if (!containsKeywordAsWord(gov_trimmed, "appeal") && !containsKeywordAsWord(gov_trimmed, "arbitration")) {
            warnings.push_back(WARN_GOVERNANCE);
        }
        
        return SieveResult{errors.empty(), std::move(errors), std::move(warnings)};
    }
};

} // namespace dizzy

// Test runner
int main() {
    using namespace dizzy;
    std::cout << "Running Dizzy Core C++20 Zero-Heap validation tests...\n";
    
    // Test 1: Trust zone resolution
    assert(getTrustZone(std::nullopt, true, "local") == TrustZone::PrivateSelf);
    assert(getTrustZone(std::optional<std::string_view>("private_self"), false, "any") == TrustZone::OutsideContact);
    assert(getTrustZone(std::optional<std::string_view>("PAID_PUBLIC"), true, "any") == TrustZone::PaidPublic);
    
    // Test 2: Decay curves with clock skew
    DocMetadata meta{MemoryClass::ReusablePattern, std::nullopt, std::optional<uint64_t>(1000)};
    DecayResult decay = calculateDecay(meta, 500);  // now < captured_at
    assert(decay.age_in_days.has_value() && decay.age_in_days.value() == 0.0);
    assert(decay.factor == 1.0);
    
    // Test 3: Authority-preserved review due
    DocMetadata old_meta{MemoryClass::ProjectDecision, std::nullopt, std::optional<uint64_t>(1000)};
    uint64_t far_future = 1000 + 366ULL * 24 * 3600 * 1000;  // >365 days
    decay = calculateDecay(old_meta, far_future);
    assert(decay.review_due == true);
    assert(decay.factor == 1.0);
    
    // Test 4: Sieve validation - good proposal
    SieveProposal good{
        "Decentralized Storage",
        "Data replication",
        "DAO with multisig",
        "Grant + fees",
        "Token-weighted with appeal board",
        "Smart contract slashing",
        "Data portability with 30-day export window",
        "Multi-validator set prevents operator control",
        "Reduces current overhead by 40%",
        "Measured by access latency and carbon per GB"
    };
    SieveResult result = validateMechanismSieve(good);
    assert(result.ok == true);
    
    // Test 5: Sieve validation - bad exit
    SieveProposal bad_exit{
        "Test", "X", "Operator", "VC", "Top-down", "Central",
        "none", "Mitigated", "Simple", "Patient outcomes + TVL"
    };
    result = validateMechanismSieve(bad_exit);
    assert(result.ok == false);
    
    // Test 6: Ruleset overrides
    DeclarativeRuleset ruleset = DeclarativeRuleset::load_default();
    Capabilities caps = ruleset.get_capabilities(TrustZone::PaidPublic, ContinuityMode::Ephemeral);
    assert(caps.retention_scope == "ephemeral");
    assert(caps.ephemeral_history == true);
    
    std::cout << "All C++20 Zero-Heap tests passed successfully!\n";
    return 0;
}
