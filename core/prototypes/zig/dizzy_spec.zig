// Dizzy Core System Specification - Zig Port (Zero-Allocation Edition)
// No heap allocations during validation; all operations use stack buffers.

const std = @import("std");
const math = std.math;
const mem = std.mem;
const testing = std.testing;

// =========================================================================
// 1. Trust & Capabilities Specification
// =========================================================================

pub const TrustZone = enum {
    private_self,
    trusted_collaborator,
    outside_contact,
    paid_public,
    
    pub fn toString(self: TrustZone) []const u8 {
        return switch (self) {
            .private_self => "private_self",
            .trusted_collaborator => "trusted_collaborator",
            .outside_contact => "outside_contact",
            .paid_public => "paid_public",
        };
    }
};

pub const ContinuityMode = enum {
    client,
    ephemeral,
    default,
    
    pub fn toString(self: ContinuityMode) []const u8 {
        return switch (self) {
            .client => "client",
            .ephemeral => "ephemeral",
            .default => "default",
        };
    }
};

pub const Capabilities = struct {
    trust_zone: TrustZone,
    continuity_mode: ContinuityMode,
    retention_scope: []const u8,
    ephemeral_history: bool,
    repo_retrieval_allowed: bool,
    durable_memory_allowed: bool,
    expiry_policy: []const u8,
};

// Stack-optimized case folding and trimming
fn trimAndFoldToLower(input: []const u8, buffer: *std.BoundedArray(u8, 256)) !void {
    buffer.clear();
    const trimmed = mem.trim(u8, input, " \t\n\r");
    
    // Early return if empty or too large
    if (trimmed.len == 0 or trimmed.len > 256) return;
    
    for (trimmed) |c| {
        const lower = if (c >= 'A' and c <= 'Z') c + 32 else c;
        try buffer.append(lower);
    }
}

// Word-boundary keyword matcher using tokenization
fn containsKeywordAsWord(text: []const u8, keyword: []const u8) bool {
    if (text.len < keyword.len) return false;
    
    var i: usize = 0;
    while (i <= text.len - keyword.len) {
        // Find potential match
        if (mem.eql(u8, text[i..][0..keyword.len], keyword)) {
            // Check word boundaries
            const before_ok = (i == 0) or !isWordChar(text[i - 1]);
            const after_ok = (i + keyword.len == text.len) or !isWordChar(text[i + keyword.len]);
            
            if (before_ok and after_ok) {
                return true;
            }
        }
        i += 1;
    }
    return false;
}

fn isWordChar(c: u8) bool {
    return (c >= 'a' and c <= 'z') or 
           (c >= 'A' and c <= 'Z') or 
           (c >= '0' and c <= '9') or 
           c == '_' or c == '-';
}

pub fn getTrustZone(explicit: ?[]const u8, trusted_local: bool, channel: []const u8) TrustZone {
    var explicit_buffer = std.BoundedArray(u8, 256){};
    if (explicit) |e| {
        trimAndFoldToLower(e, &explicit_buffer) catch {};
    }
    const explicit_lower = explicit_buffer.constSlice();
    
    if (mem.eql(u8, explicit_lower, "private_self")) {
        return if (trusted_local) .private_self else .outside_contact;
    }
    
    if (mem.eql(u8, explicit_lower, "trusted_collaborator")) return .trusted_collaborator;
    if (mem.eql(u8, explicit_lower, "outside_contact")) return .outside_contact;
    if (mem.eql(u8, explicit_lower, "paid_public")) return .paid_public;
    
    var channel_buffer = std.BoundedArray(u8, 256){};
    trimAndFoldToLower(channel, &channel_buffer) catch {};
    const channel_lower = channel_buffer.constSlice();
    
    if (mem.eql(u8, channel_lower, "execute")) return .paid_public;
    if (mem.eql(u8, channel_lower, "local") and trusted_local) return .private_self;
    
    return .outside_contact;
}

pub fn getContinuityMode(explicit: ?[]const u8) ContinuityMode {
    var buffer = std.BoundedArray(u8, 256){};
    if (explicit) |e| {
        trimAndFoldToLower(e, &buffer) catch {};
    }
    const mode_str = buffer.constSlice();
    
    if (mem.eql(u8, mode_str, "client")) return .client;
    if (mem.eql(u8, mode_str, "ephemeral")) return .ephemeral;
    return .default;
}

pub fn getTrustZoneCapabilities(zone: TrustZone, mode: ContinuityMode) Capabilities {
    const paid_public = zone == .paid_public;
    const ephemeral_history = paid_public and mode != .client;
    
    const repo_allowed = zone == .private_self or zone == .trusted_collaborator;
    const durable_allowed = zone == .private_self or zone == .trusted_collaborator;
    
    const retention_scope = if (paid_public) 
        (if (ephemeral_history) "ephemeral" else "conversation_only")
    else 
        "local_conversation";
    
    const expiry_policy = if (paid_public and !ephemeral_history) 
        "7_days_inactivity_operator_deletable" 
    else 
        "none";
    
    return Capabilities{
        .trust_zone = zone,
        .continuity_mode = mode,
        .retention_scope = retention_scope,
        .ephemeral_history = ephemeral_history,
        .repo_retrieval_allowed = repo_allowed,
        .durable_memory_allowed = durable_allowed,
        .expiry_policy = expiry_policy,
    };
}

// =========================================================================
// 2. Dynamic Memory Decay Curves
// =========================================================================

pub const MemoryClass = enum {
    project_decision,
    user_claim,
    reusable_pattern,
    assistant_observation,
    unclassified,
};

pub const DocMetadata = struct {
    memory_class: MemoryClass,
    last_reviewed: ?u64,
    captured_at: ?u64,
};

pub const DecayResult = struct {
    factor: f64,
    policy: []const u8,
    age_in_days: ?f64,
    review_due: bool,
};

pub fn calculateDecay(meta: DocMetadata, now_ms: u64) DecayResult {
    const date_ms = meta.last_reviewed orelse meta.captured_at;
    
    const age_in_days: ?f64 = if (date_ms) |t| 
        (if (now_ms >= t) 
            @as(f64, @floatFromInt(now_ms - t)) / (1000.0 * 60.0 * 60.0 * 24.0)
        else 
            0.0)
    else 
        null;
    
    switch (meta.memory_class) {
        .project_decision, .user_claim => {
            const review_due = if (age_in_days) |age| age >= 365.0 else false;
            return DecayResult{
                .factor = 1.0,
                .policy = "authority_preserved_review_age_only",
                .age_in_days = age_in_days,
                .review_due = review_due,
            };
        },
        .reusable_pattern => {
            const factor = if (age_in_days) |age| 
                math.pow(f64, 0.5, age / 365.0)
            else 
                1.0;
            return DecayResult{
                .factor = factor,
                .policy = "relevance_half_life_365_days",
                .age_in_days = age_in_days,
                .review_due = false,
            };
        },
        .assistant_observation, .unclassified => {
            const factor = if (age_in_days) |age| 
                math.pow(f64, 0.5, age / 180.0)
            else 
                1.0;
            return DecayResult{
                .factor = factor,
                .policy = "relevance_half_life_180_days",
                .age_in_days = age_in_days,
                .review_due = false,
            };
        },
    }
}

// =========================================================================
// 3. Mechanism Sieve Verification (Zero-Allocation)
// =========================================================================

pub const SieveProposal = struct {
    title: []const u8,
    capability: []const u8,
    ownership: []const u8,
    funding: []const u8,
    governance: []const u8,
    enforcement: []const u8,
    exit: []const u8,
    capture_risk: []const u8,
    simplification: []const u8,
    wellbeing_metrics: []const u8,
};

pub const SieveResult = struct {
    ok: bool,
    errors: []const []const u8,  // String literals only, no allocation
    warnings: []const []const u8,
};

// Pre-computed error messages as static strings
const ERR_TITLE = "Missing or empty required sieve field: 'title'";
const ERR_CAPABILITY = "Missing or empty required sieve field: 'capability'";
const ERR_OWNERSHIP = "Missing or empty required sieve field: 'ownership'";
const ERR_FUNDING = "Missing or empty required sieve field: 'funding'";
const ERR_GOVERNANCE = "Missing or empty required sieve field: 'governance'";
const ERR_ENFORCEMENT = "Missing or empty required sieve field: 'enforcement'";
const ERR_EXIT = "Missing or empty required sieve field: 'exit'";
const ERR_CAPTURE_RISK = "Missing or empty required sieve field: 'captureRisk'";
const ERR_SIMPLIFICATION = "Missing or empty required sieve field: 'simplification'";
const ERR_WELLBEING = "Missing or empty required sieve field: 'wellbeingMetrics'";
const ERR_EXIT_STRATEGY = "Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.";
const ERR_CAPTURE = "Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.";
const ERR_METRICS = "Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.";
const WARN_GOVERNANCE = "Proposal lacks explicit dispute appeals or arbitration paths.";

fn isFieldEmpty(field: []const u8) bool {
    return mem.trim(u8, field, " \t\n\r").len == 0;
}

pub fn validateMechanismSieve(proposal: SieveProposal) SieveResult {
    // Stack-based error collection (max 16 errors)
    var error_list: [16][]const u8 = undefined;
    var error_count: usize = 0;
    var warning_list: [16][]const u8 = undefined;
    var warning_count: usize = 0;
    
    // Required fields check
    if (isFieldEmpty(proposal.title)) {
        error_list[error_count] = ERR_TITLE;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.capability)) {
        error_list[error_count] = ERR_CAPABILITY;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.ownership)) {
        error_list[error_count] = ERR_OWNERSHIP;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.funding)) {
        error_list[error_count] = ERR_FUNDING;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.governance)) {
        error_list[error_count] = ERR_GOVERNANCE;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.enforcement)) {
        error_list[error_count] = ERR_ENFORCEMENT;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.exit)) {
        error_list[error_count] = ERR_EXIT;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.capture_risk)) {
        error_list[error_count] = ERR_CAPTURE_RISK;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.simplification)) {
        error_list[error_count] = ERR_SIMPLIFICATION;
        error_count += 1;
    }
    if (isFieldEmpty(proposal.wellbeing_metrics)) {
        error_list[error_count] = ERR_WELLBEING;
        error_count += 1;
    }
    
    if (error_count > 0) {
        // Must make static assignments to return constant reference slices
        const static_errors = &error_list;
        return SieveResult{
            .ok = false,
            .errors = static_errors[0..error_count],
            .warnings = &[_][]const u8{},
        };
    }
    
    // Process each field with stack buffers
    var exit_buffer = std.BoundedArray(u8, 256){};
    var cap_risk_buffer = std.BoundedArray(u8, 256){};
    var ownership_buffer = std.BoundedArray(u8, 256){};
    var metrics_buffer = std.BoundedArray(u8, 256){};
    var gov_buffer = std.BoundedArray(u8, 256){};
    
    trimAndFoldToLower(proposal.exit, &exit_buffer) catch {};
    trimAndFoldToLower(proposal.capture_risk, &cap_risk_buffer) catch {};
    trimAndFoldToLower(proposal.ownership, &ownership_buffer) catch {};
    trimAndFoldToLower(proposal.wellbeing_metrics, &metrics_buffer) catch {};
    trimAndFoldToLower(proposal.governance, &gov_buffer) catch {};
    
    const exit_lower = exit_buffer.constSlice();
    const cap_risk_lower = cap_risk_buffer.constSlice();
    const ownership_lower = ownership_buffer.constSlice();
    const metrics_lower = metrics_buffer.constSlice();
    const gov_lower = gov_buffer.constSlice();
    
    // 1. Exit strategy check with word boundaries
    const no_exit_keywords = [_][]const u8{
        "none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"
    };
    
    var has_forbidden = false;
    for (no_exit_keywords) |kw| {
        if (containsKeywordAsWord(exit_lower, kw)) {
            has_forbidden = true;
            break;
        }
    }
    
    if (has_forbidden or exit_lower.len < 15) {
        error_list[error_count] = ERR_EXIT_STRATEGY;
        error_count += 1;
    }
    
    // 2. Capture risk check with word boundaries
    const capture_mitigations = [_][]const u8{
        "no mitigation", "operator absolute control"
    };
    
    var capture_violation = false;
    for (capture_mitigations) |m| {
        if (containsKeywordAsWord(cap_risk_lower, m)) {
            capture_violation = true;
            break;
        }
    }
    
    if (capture_violation or containsKeywordAsWord(ownership_lower, "absolute operator ownership")) {
        error_list[error_count] = ERR_CAPTURE;
        error_count += 1;
    }
    
    // 3. Wellbeing metrics check with word boundaries
    const bad_metrics = [_][]const u8{
        "tvl", "token price", "speculation", "market cap", 
        "transaction volume", "growth rate"
    };
    const good_metrics = [_][]const u8{
        "patients", "access", "stabilized", "waste", "carbon", 
        "well-being", "portability"
    };
    
    var has_bad = false;
    for (bad_metrics) |bm| {
        if (containsKeywordAsWord(metrics_lower, bm)) {
            has_bad = true;
            break;
        }
    }
    
    var has_good = false;
    for (good_metrics) |gm| {
        if (containsKeywordAsWord(metrics_lower, gm)) {
            has_good = true;
            break;
        }
    }
    
    const has_bad_only = has_bad and !has_good;
    if (has_bad_only or metrics_lower.len < 15) {
        error_list[error_count] = ERR_METRICS;
        error_count += 1;
    }
    
    // 4. Governance warning (non-fatal)
    if (!containsKeywordAsWord(gov_lower, "appeal") and 
        !containsKeywordAsWord(gov_lower, "arbitration")) {
        warning_list[warning_count] = WARN_GOVERNANCE;
        warning_count += 1;
    }
    
    const static_errors = &error_list;
    const static_warnings = &warning_list;
    return SieveResult{
        .ok = error_count == 0,
        .errors = static_errors[0..error_count],
        .warnings = static_warnings[0..warning_count],
    };
}

// =========================================================================
// 4. Declarative Ruleset & Configuration
// =========================================================================

pub const RawCapabilities = struct {
    repo_retrieval_allowed: bool,
    durable_memory_allowed: bool,
    retention_scope: []const u8,
    ephemeral_history: bool,
    expiry_policy: []const u8,
};

pub const OverrideCondition = struct {
    trust_zone: []const u8,
    continuity_mode_not: []const u8,
};

pub const RawCapabilitiesUpdate = struct {
    retention_scope: ?[]const u8,
    ephemeral_history: ?bool,
    expiry_policy: ?[]const u8,
};

pub const OverrideRule = struct {
    condition: OverrideCondition,
    updates: RawCapabilitiesUpdate,
};

pub const SieveRules = struct {
    exit_min_length: usize,
    exit_forbidden_keywords: [][]const u8,
    capture_forbidden_mitigations: [][]const u8,
    wellbeing_bad_metrics: [][]const u8,
    wellbeing_good_metrics: [][]const u8,
};

pub const DeclarativeRuleset = struct {
    capabilities: std.StringHashMap(RawCapabilities),
    overrides: []OverrideRule,
    sieve_rules: SieveRules,
    
    pub fn loadDefault(allocator: mem.Allocator) !DeclarativeRuleset {
        var capabilities = std.StringHashMap(RawCapabilities).init(allocator);
        
        try capabilities.put("private_self", RawCapabilities{
            .repo_retrieval_allowed = true,
            .durable_memory_allowed = true,
            .retention_scope = "local_conversation",
            .ephemeral_history = false,
            .expiry_policy = "none",
        });
        try capabilities.put("trusted_collaborator", RawCapabilities{
            .repo_retrieval_allowed = true,
            .durable_memory_allowed = true,
            .retention_scope = "local_conversation",
            .ephemeral_history = false,
            .expiry_policy = "none",
        });
        try capabilities.put("outside_contact", RawCapabilities{
            .repo_retrieval_allowed = false,
            .durable_memory_allowed = false,
            .retention_scope = "local_conversation",
            .ephemeral_history = false,
            .expiry_policy = "none",
        });
        try capabilities.put("paid_public", RawCapabilities{
            .repo_retrieval_allowed = false,
            .durable_memory_allowed = false,
            .retention_scope = "conversation_only",
            .ephemeral_history = false,
            .expiry_policy = "7_days_inactivity_operator_deletable",
        });
        
        const overrides = try allocator.alloc(OverrideRule, 1);
        overrides[0] = OverrideRule{
            .condition = OverrideCondition{
                .trust_zone = "paid_public",
                .continuity_mode_not = "client",
            },
            .updates = RawCapabilitiesUpdate{
                .retention_scope = "ephemeral",
                .ephemeral_history = true,
                .expiry_policy = "none",
            },
        };
        
        const sieve_rules = SieveRules{
            .exit_min_length = 15,
            .exit_forbidden_keywords = try allocator.dupe([][]const u8, &[_][]const u8{
                "none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"
            }),
            .capture_forbidden_mitigations = try allocator.dupe([][]const u8, &[_][]const u8{
                "no mitigation", "operator absolute control"
            }),
            .wellbeing_bad_metrics = try allocator.dupe([][]const u8, &[_][]const u8{
                "tvl", "token price", "speculation", "market cap", 
                "transaction volume", "growth rate"
            }),
            .wellbeing_good_metrics = try allocator.dupe([][]const u8, &[_][]const u8{
                "patients", "access", "stabilized", "waste", "carbon", 
                "well-being", "portability"
            }),
        };
        
        return DeclarativeRuleset{
            .capabilities = capabilities,
            .overrides = overrides,
            .sieve_rules = sieve_rules,
        };
    }
    
    pub fn getCapabilities(self: *const DeclarativeRuleset, zone: TrustZone, mode: ContinuityMode) !Capabilities {
        const zone_str = zone.toString();
        const mode_str = mode.toString();
        
        const raw = self.capabilities.get(zone_str) orelse RawCapabilities{
            .repo_retrieval_allowed = false,
            .durable_memory_allowed = false,
            .retention_scope = "local_conversation",
            .ephemeral_history = false,
            .expiry_policy = "none",
        };
        
        var final_scope = raw.retention_scope;
        var final_ephemeral = raw.ephemeral_history;
        var final_expiry = raw.expiry_policy;
        
        for (self.overrides) |rule| {
            if (mem.eql(u8, rule.condition.trust_zone, zone_str) and 
                !mem.eql(u8, rule.condition.continuity_mode_not, mode_str)) {
                if (rule.updates.retention_scope) |s| final_scope = s;
                if (rule.updates.ephemeral_history) |b| final_ephemeral = b;
                if (rule.updates.expiry_policy) |e| final_expiry = e;
            }
        }
        
        return Capabilities{
            .trust_zone = zone,
            .continuity_mode = mode,
            .retention_scope = final_scope,
            .ephemeral_history = final_ephemeral,
            .repo_retrieval_allowed = raw.repo_retrieval_allowed,
            .durable_memory_allowed = raw.durable_memory_allowed,
            .expiry_policy = final_expiry,
        };
    }
    
    pub fn validateSieve(self: *const DeclarativeRuleset, proposal: SieveProposal) SieveResult {
        var error_list: [16][]const u8 = undefined;
        var error_count: usize = 0;
        var warning_list: [16][]const u8 = undefined;
        var warning_count: usize = 0;
        
        // Required fields check
        if (isFieldEmpty(proposal.title)) { error_list[error_count] = ERR_TITLE; error_count += 1; }
        if (isFieldEmpty(proposal.capability)) { error_list[error_count] = ERR_CAPABILITY; error_count += 1; }
        if (isFieldEmpty(proposal.ownership)) { error_list[error_count] = ERR_OWNERSHIP; error_count += 1; }
        if (isFieldEmpty(proposal.funding)) { error_list[error_count] = ERR_FUNDING; error_count += 1; }
        if (isFieldEmpty(proposal.governance)) { error_list[error_count] = ERR_GOVERNANCE; error_count += 1; }
        if (isFieldEmpty(proposal.enforcement)) { error_list[error_count] = ERR_ENFORCEMENT; error_count += 1; }
        if (isFieldEmpty(proposal.exit)) { error_list[error_count] = ERR_EXIT; error_count += 1; }
        if (isFieldEmpty(proposal.capture_risk)) { error_list[error_count] = ERR_CAPTURE_RISK; error_count += 1; }
        if (isFieldEmpty(proposal.simplification)) { error_list[error_count] = ERR_SIMPLIFICATION; error_count += 1; }
        if (isFieldEmpty(proposal.wellbeing_metrics)) { error_list[error_count] = ERR_WELLBEING; error_count += 1; }
        
        if (error_count > 0) {
            const static_errors = &error_list;
            return SieveResult{
                .ok = false,
                .errors = static_errors[0..error_count],
                .warnings = &[_][]const u8{},
            };
        }
        
        // Process fields using stack-allocated fold buffers
        var exit_buffer = std.BoundedArray(u8, 256){};
        var cap_risk_buffer = std.BoundedArray(u8, 256){};
        var ownership_buffer = std.BoundedArray(u8, 256){};
        var metrics_buffer = std.BoundedArray(u8, 256){};
        var gov_buffer = std.BoundedArray(u8, 256){};
        
        trimAndFoldToLower(proposal.exit, &exit_buffer) catch {};
        trimAndFoldToLower(proposal.capture_risk, &cap_risk_buffer) catch {};
        trimAndFoldToLower(proposal.ownership, &ownership_buffer) catch {};
        trimAndFoldToLower(proposal.wellbeing_metrics, &metrics_buffer) catch {};
        trimAndFoldToLower(proposal.governance, &gov_buffer) catch {};
        
        const exit_lower = exit_buffer.constSlice();
        const cap_risk_lower = cap_risk_buffer.constSlice();
        const ownership_lower = ownership_buffer.constSlice();
        const metrics_lower = metrics_buffer.constSlice();
        const gov_lower = gov_buffer.constSlice();
        
        // Exit strategy validation
        var has_forbidden = false;
        for (self.sieve_rules.exit_forbidden_keywords) |kw| {
            if (containsKeywordAsWord(exit_lower, kw)) {
                has_forbidden = true;
                break;
            }
        }
        
        if (has_forbidden or exit_lower.len < self.sieve_rules.exit_min_length) {
            error_list[error_count] = ERR_EXIT_STRATEGY;
            error_count += 1;
        }
        
        // Capture mitigation validation
        var capture_violation = false;
        for (self.sieve_rules.capture_forbidden_mitigations) |m| {
            if (containsKeywordAsWord(cap_risk_lower, m)) {
                capture_violation = true;
                break;
            }
        }
        
        if (capture_violation or containsKeywordAsWord(ownership_lower, "absolute operator ownership")) {
            error_list[error_count] = ERR_CAPTURE;
            error_count += 1;
        }
        
        // Wellbeing metrics validation
        var has_bad = false;
        for (self.sieve_rules.wellbeing_bad_metrics) |bm| {
            if (containsKeywordAsWord(metrics_lower, bm)) {
                has_bad = true;
                break;
            }
        }
        
        var has_good = false;
        for (self.sieve_rules.wellbeing_good_metrics) |gm| {
            if (containsKeywordAsWord(metrics_lower, gm)) {
                has_good = true;
                break;
            }
        }
        
        const has_bad_only = has_bad and !has_good;
        if (has_bad_only or metrics_lower.len < 15) {
            error_list[error_count] = ERR_METRICS;
            error_count += 1;
        }
        
        // Governance warning
        if (!containsKeywordAsWord(gov_lower, "appeal") and !containsKeywordAsWord(gov_lower, "arbitration")) {
            warning_list[warning_count] = WARN_GOVERNANCE;
            warning_count += 1;
        }
        
        const static_errors = &error_list;
        const static_warnings = &warning_list;
        return SieveResult{
            .ok = error_count == 0,
            .errors = static_errors[0..error_count],
            .warnings = static_warnings[0..warning_count],
        };
    }
};

// Test suite
test "Dizzy Core validation tests" {
    // Test 1: Trust zone resolution
    try testing.expectEqual(TrustZone.private_self, getTrustZone(null, true, "local"));
    try testing.expectEqual(TrustZone.outside_contact, getTrustZone("private_self", false, "any"));
    try testing.expectEqual(TrustZone.paid_public, getTrustZone("PAID_PUBLIC", true, "any"));
    
    // Test 2: Decay curves with clock skew
    const meta = DocMetadata{
        .memory_class = MemoryClass.reusable_pattern,
        .last_reviewed = null,
        .captured_at = 1000,
    };
    const decay = calculateDecay(meta, 500);
    try testing.expect(decay.age_in_days != null and decay.age_in_days.? == 0.0);
    try testing.expect(decay.factor == 1.0);
    
    // Test 3: Authority-preserved review due
    const old_meta = DocMetadata{
        .memory_class = MemoryClass.project_decision,
        .last_reviewed = null,
        .captured_at = 1000,
    };
    const far_future: u64 = 1000 + 366 * 24 * 3600 * 1000;
    const old_decay = calculateDecay(old_meta, far_future);
    try testing.expect(old_decay.review_due == true);
    try testing.expect(old_decay.factor == 1.0);
    
    // Test 4: Sieve validation - good proposal
    const good_proposal = SieveProposal{
        .title = "Decentralized Storage",
        .capability = "Data replication",
        .ownership = "DAO with multisig",
        .funding = "Grant + fees",
        .governance = "Token-weighted with appeal board",
        .enforcement = "Smart contract slashing",
        .exit = "Data portability with 30-day export window",
        .capture_risk = "Multi-validator set prevents operator control",
        .simplification = "Reduces current overhead by 40%",
        .wellbeing_metrics = "Measured by access latency and carbon per GB",
    };
    const good_result = validateMechanismSieve(good_proposal);
    try testing.expect(good_result.ok == true);
    
    // Test 5: Sieve validation - bad exit
    const bad_exit = SieveProposal{
        .title = "Test",
        .capability = "X",
        .ownership = "Operator",
        .funding = "VC",
        .governance = "Top-down",
        .enforcement = "Central",
        .exit = "none",
        .capture_risk = "Mitigated",
        .simplification = "Simple",
        .wellbeing_metrics = "Patient outcomes + TVL",
    };
    const bad_result = validateMechanismSieve(bad_exit);
    try testing.expect(bad_result.ok == false);
    
    // Test 6: Ruleset overrides
    const allocator = testing.allocator;
    var ruleset = try DeclarativeRuleset.loadDefault(allocator);
    defer {
        ruleset.capabilities.deinit();
        allocator.free(ruleset.overrides);
        allocator.free(ruleset.sieve_rules.exit_forbidden_keywords);
        allocator.free(ruleset.sieve_rules.capture_forbidden_mitigations);
        allocator.free(ruleset.sieve_rules.wellbeing_bad_metrics);
        allocator.free(ruleset.sieve_rules.wellbeing_good_metrics);
    }
    const caps = try ruleset.getCapabilities(.paid_public, .ephemeral);
    try testing.expect(mem.eql(u8, caps.retention_scope, "ephemeral"));
    try testing.expect(caps.ephemeral_history == true);
}
