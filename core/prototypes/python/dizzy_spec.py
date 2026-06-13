"""Dizzy Core System Specification - Python Port
Idiomatic Python with dataclasses, strong type hints, regex word boundaries, and identical logic.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, List
import json
import re

# Pre-compile regex patterns for word boundaries to optimize search
_WORD_BOUNDARY_PATTERNS = {}

def keyword_pattern(keyword: str) -> re.Pattern:
    """Get or create a word-boundary regex pattern for a keyword."""
    if keyword not in _WORD_BOUNDARY_PATTERNS:
        escaped = re.escape(keyword)
        _WORD_BOUNDARY_PATTERNS[keyword] = re.compile(rf'\b{escaped}\b', re.IGNORECASE)
    return _WORD_BOUNDARY_PATTERNS[keyword]

def contains_keyword_as_word(text: str, keyword: str) -> bool:
    """Check if text contains keyword as a whole word (not substring)."""
    pattern = keyword_pattern(keyword)
    return bool(pattern.search(text))

# =========================================================================
# 1. Trust & Capabilities Specification
# =========================================================================

class TrustZone(str, Enum):
    """Defines security boundaries of execution contexts."""
    PRIVATE_SELF = "private_self"
    TRUSTED_COLLABORATOR = "trusted_collaborator"
    OUTSIDE_CONTACT = "outside_contact"
    PAID_PUBLIC = "paid_public"

class ContinuityMode(str, Enum):
    """Controls history persistence constraints."""
    CLIENT = "client"
    EPHEMERAL = "ephemeral"
    DEFAULT = "default"

@dataclass
class Capabilities:
    """Evaluated capabilities for a given context."""
    trust_zone: TrustZone
    continuity_mode: ContinuityMode
    retention_scope: str
    ephemeral_history: bool
    repo_retrieval_allowed: bool
    durable_memory_allowed: bool
    expiry_policy: str

def get_trust_zone(explicit: Optional[str], trusted_local: bool, channel: str) -> TrustZone:
    """Resolves trust zone with safe fallbacks."""
    explicit_clean = (explicit or "").strip().lower()
    
    if explicit_clean == "private_self":
        return TrustZone.PRIVATE_SELF if trusted_local else TrustZone.OUTSIDE_CONTACT
    
    match explicit_clean:
        case "trusted_collaborator":
            return TrustZone.TRUSTED_COLLABORATOR
        case "outside_contact":
            return TrustZone.OUTSIDE_CONTACT
        case "paid_public":
            return TrustZone.PAID_PUBLIC
        case _:
            channel_clean = channel.strip().lower()
            if channel_clean == "execute":
                return TrustZone.PAID_PUBLIC
            elif channel_clean == "local" and trusted_local:
                return TrustZone.PRIVATE_SELF
            else:
                return TrustZone.OUTSIDE_CONTACT

def get_continuity_mode(explicit: Optional[str]) -> ContinuityMode:
    """Parses raw string into ContinuityMode."""
    match (explicit or "").strip().lower():
        case "client":
            return ContinuityMode.CLIENT
        case "ephemeral":
            return ContinuityMode.EPHEMERAL
        case _:
            return ContinuityMode.DEFAULT

def get_trust_zone_capabilities(zone: TrustZone, mode: ContinuityMode) -> Capabilities:
    """Hardcoded baseline capabilities (procedural implementation)."""
    paid_public = (zone == TrustZone.PAID_PUBLIC)
    ephemeral_history = paid_public and (mode != ContinuityMode.CLIENT)
    
    repo_allowed = zone in (TrustZone.PRIVATE_SELF, TrustZone.TRUSTED_COLLABORATOR)
    durable_allowed = zone in (TrustZone.PRIVATE_SELF, TrustZone.TRUSTED_COLLABORATOR)
    
    if paid_public:
        retention_scope = "ephemeral" if ephemeral_history else "conversation_only"
    else:
        retention_scope = "local_conversation"
    
    expiry_policy = "7_days_inactivity_operator_deletable" if (paid_public and not ephemeral_history) else "none"
    
    return Capabilities(
        trust_zone=zone,
        continuity_mode=mode,
        retention_scope=retention_scope,
        ephemeral_history=ephemeral_history,
        repo_retrieval_allowed=repo_allowed,
        durable_memory_allowed=durable_allowed,
        expiry_policy=expiry_policy,
    )

# =========================================================================
# 2. Dynamic Memory Decay Curves
# =========================================================================

class MemoryClass(str, Enum):
    """Classes of saved memories with distinct half-life curves."""
    PROJECT_DECISION = "project_decision"
    USER_CLAIM = "user_claim"
    REUSABLE_PATTERN = "reusable_pattern"
    ASSISTANT_OBSERVATION = "assistant_observation"
    UNCLASSIFIED = "unclassified"

@dataclass
class DocMetadata:
    """Metadata attached to a memory fragment."""
    memory_class: MemoryClass
    last_reviewed: Optional[int] = None  # epoch timestamp in milliseconds
    captured_at: Optional[int] = None    # epoch timestamp in milliseconds

@dataclass
class DecayResult:
    """Results computed from exponential decay curve."""
    factor: float  # between 0.0 and 1.0
    policy: str
    age_in_days: Optional[float]
    review_due: bool

def calculate_decay(meta: DocMetadata, now_ms: int) -> DecayResult:
    """Calculates memory weight decay using half-life formula."""
    # Get the reference timestamp (last_reviewed falls back to captured_at)
    date_ms = meta.last_reviewed or meta.captured_at
    
    # Age calculation with clock-skew clamping
    age_in_days: Optional[float] = None
    if date_ms is not None:
        if now_ms >= date_ms:
            age_in_days = (now_ms - date_ms) / (1000.0 * 60.0 * 60.0 * 24.0)
        else:
            age_in_days = 0.0  # Clamp negative age from clock skew
    
    # Decay logic based on memory class
    if meta.memory_class in (MemoryClass.PROJECT_DECISION, MemoryClass.USER_CLAIM):
        review_due = bool(age_in_days is not None and age_in_days >= 365.0)
        return DecayResult(
            factor=1.0,
            policy="authority_preserved_review_age_only",
            age_in_days=age_in_days,
            review_due=review_due,
        )
    elif meta.memory_class == MemoryClass.REUSABLE_PATTERN:
        factor = 1.0 if age_in_days is None else 0.5 ** (age_in_days / 365.0)
        return DecayResult(
            factor=factor,
            policy="relevance_half_life_365_days",
            age_in_days=age_in_days,
            review_due=False,
        )
    else:  # AssistantObservation or Unclassified
        factor = 1.0 if age_in_days is None else 0.5 ** (age_in_days / 180.0)
        return DecayResult(
            factor=factor,
            policy="relevance_half_life_180_days",
            age_in_days=age_in_days,
            review_due=False,
        )

# =========================================================================
# 3. Mechanism Sieve Verification
# =========================================================================

@dataclass
class SieveProposal:
    """Structured proposal for a system mechanism."""
    title: str
    capability: str
    ownership: str
    funding: str
    governance: str
    enforcement: str
    exit: str
    capture_risk: str
    simplification: str
    wellbeing_metrics: str

@dataclass
class SieveResult:
    """Sieve validation outcomes."""
    ok: bool
    errors: List[str]
    warnings: List[str]

def validate_mechanism_sieve(proposal: SieveProposal) -> SieveResult:
    """Validates a mechanism proposal against structural safety requirements."""
    errors: List[str] = []
    warnings: List[str] = []
    
    # Required fields check
    if not proposal.title.strip():
        errors.append("Missing or empty required sieve field: 'title'")
    if not proposal.capability.strip():
        errors.append("Missing or empty required sieve field: 'capability'")
    if not proposal.ownership.strip():
        errors.append("Missing or empty required sieve field: 'ownership'")
    if not proposal.funding.strip():
        errors.append("Missing or empty required sieve field: 'funding'")
    if not proposal.governance.strip():
        errors.append("Missing or empty required sieve field: 'governance'")
    if not proposal.enforcement.strip():
        errors.append("Missing or empty required sieve field: 'enforcement'")
    if not proposal.exit.strip():
        errors.append("Missing or empty required sieve field: 'exit'")
    if not proposal.capture_risk.strip():
        errors.append("Missing or empty required sieve field: 'captureRisk'")
    if not proposal.simplification.strip():
        errors.append("Missing or empty required sieve field: 'simplification'")
    if not proposal.wellbeing_metrics.strip():
        errors.append("Missing or empty required sieve field: 'wellbeingMetrics'")
    
    if errors:
        return SieveResult(ok=False, errors=errors, warnings=warnings)
    
    # 1. Exit strategy check with word boundaries
    exit_text = proposal.exit.lower().strip()
    no_exit_keywords = ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"]
    
    if any(contains_keyword_as_word(exit_text, kw) for kw in no_exit_keywords) or len(exit_text) < 15:
        errors.append("Sieve Fail: Exit strategy is missing, restricted, or too brief. "
                     "Participants must have clear data/asset portability.")
    
    # 2. Chokepoint & Capture risk check with word boundaries
    cap_risk = proposal.capture_risk.lower().strip()
    ownership_text = proposal.ownership.lower().strip()
    
    if (contains_keyword_as_word(cap_risk, "no mitigation") or 
        contains_keyword_as_word(cap_risk, "operator absolute control") or 
        contains_keyword_as_word(ownership_text, "absolute operator ownership")):
        errors.append("Sieve Fail: High capture risk. Mechanism does not mitigate "
                     "chokepoints or absolute operator control.")
    
    # 3. Wellbeing metrics check with word boundaries
    metrics = proposal.wellbeing_metrics.lower().strip()
    bad_metrics = ["tvl", "token price", "speculation", "market cap", 
                   "transaction volume", "growth rate"]
    good_metrics = ["patients", "access", "stabilized", "waste", "carbon", 
                    "well-being", "portability"]
    
    has_bad = any(contains_keyword_as_word(metrics, bm) for bm in bad_metrics)
    has_good = any(contains_keyword_as_word(metrics, gm) for gm in good_metrics)
    has_bad_only = has_bad and not has_good
    
    if has_bad_only or len(metrics) < 15:
        errors.append("Sieve Fail: Metrics capture detected. Optimization targets "
                     "financial speculation/volume instead of real-world well-being metrics.")
    
    # 4. Governance check (non-fatal warning)
    gov = proposal.governance.lower().strip()
    if "appeal" not in gov and "arbitration" not in gov:
        warnings.append("Proposal lacks explicit dispute appeals or arbitration paths.")
    
    return SieveResult(ok=len(errors) == 0, errors=errors, warnings=warnings)

# =========================================================================
# 4. Declarative Ruleset & Configuration
# =========================================================================

@dataclass
class RawCapabilities:
    repo_retrieval_allowed: bool
    durable_memory_allowed: bool
    retention_scope: str
    ephemeral_history: bool
    expiry_policy: str

@dataclass
class OverrideCondition:
    trust_zone: str
    continuity_mode_not: str

@dataclass
class RawCapabilitiesUpdate:
    retention_scope: Optional[str] = None
    ephemeral_history: Optional[bool] = None
    expiry_policy: Optional[str] = None

@dataclass
class OverrideRule:
    condition: OverrideCondition
    updates: RawCapabilitiesUpdate

@dataclass
class SieveRules:
    exit_min_length: int
    exit_forbidden_keywords: List[str]
    capture_forbidden_mitigations: List[str]
    wellbeing_bad_metrics: List[str]
    wellbeing_good_metrics: List[str]

@dataclass
class DeclarativeRuleset:
    capabilities: Dict[str, RawCapabilities]
    overrides: List[OverrideRule]
    sieve_rules: SieveRules
    
    @classmethod
    def load_default(cls) -> 'DeclarativeRuleset':
        """Loads the declarative ruleset from embedded JSON."""
        default_json = """{
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
    "capture_forbidden_mitigations": ["no mitigation", "operator absolute control"],
    "wellbeing_bad_metrics": ["tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"],
    "wellbeing_good_metrics": ["patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"]
  }
}"""
        data = json.loads(default_json)
        
        capabilities = {}
        for key, val in data["capabilities"].items():
            capabilities[key] = RawCapabilities(**val)
        
        overrides = []
        for ov in data["overrides"]:
            condition = OverrideCondition(**ov["condition"])
            updates = RawCapabilitiesUpdate(**ov["updates"])
            overrides.append(OverrideRule(condition=condition, updates=updates))
        
        sieve_rules = SieveRules(**data["sieve_rules"])
        
        return cls(capabilities=capabilities, overrides=overrides, sieve_rules=sieve_rules)
    
    def get_capabilities(self, zone: TrustZone, mode: ContinuityMode) -> Capabilities:
        """Evaluates capabilities using loaded ruleset and overrides."""
        zone_str = zone.value
        mode_str = mode.value
        
        raw = self.capabilities.get(zone_str)
        if raw is None:
            raw = RawCapabilities(
                repo_retrieval_allowed=False,
                durable_memory_allowed=False,
                retention_scope="local_conversation",
                ephemeral_history=False,
                expiry_policy="none",
            )
        
        final_scope = raw.retention_scope
        final_ephemeral = raw.ephemeral_history
        final_expiry = raw.expiry_policy
        
        for rule in self.overrides:
            if (rule.condition.trust_zone == zone_str and 
                rule.condition.continuity_mode_not != mode_str):
                if rule.updates.retention_scope is not None:
                    final_scope = rule.updates.retention_scope
                if rule.updates.ephemeral_history is not None:
                    final_ephemeral = rule.updates.ephemeral_history
                if rule.updates.expiry_policy is not None:
                    final_expiry = rule.updates.expiry_policy
        
        return Capabilities(
            trust_zone=zone,
            continuity_mode=mode,
            retention_scope=final_scope,
            ephemeral_history=final_ephemeral,
            repo_retrieval_allowed=raw.repo_retrieval_allowed,
            durable_memory_allowed=raw.durable_memory_allowed,
            expiry_policy=final_expiry,
        )
    
    def validate_sieve(self, proposal: SieveProposal) -> SieveResult:
        """Evaluates a SieveProposal against declarative sieve parameters."""
        errors: List[str] = []
        warnings: List[str] = []
        
        if not proposal.title.strip():
            errors.append("Missing or empty required sieve field: 'title'")
        if not proposal.capability.strip():
            errors.append("Missing or empty required sieve field: 'capability'")
        if not proposal.ownership.strip():
            errors.append("Missing or empty required sieve field: 'ownership'")
        if not proposal.funding.strip():
            errors.append("Missing or empty required sieve field: 'funding'")
        if not proposal.governance.strip():
            errors.append("Missing or empty required sieve field: 'governance'")
        if not proposal.enforcement.strip():
            errors.append("Missing or empty required sieve field: 'enforcement'")
        if not proposal.exit.strip():
            errors.append("Missing or empty required sieve field: 'exit'")
        if not proposal.capture_risk.strip():
            errors.append("Missing or empty required sieve field: 'captureRisk'")
        if not proposal.simplification.strip():
            errors.append("Missing or empty required sieve field: 'simplification'")
        if not proposal.wellbeing_metrics.strip():
            errors.append("Missing or empty required sieve field: 'wellbeingMetrics'")
        
        if errors:
            return SieveResult(ok=False, errors=errors, warnings=warnings)
        
        exit_text = proposal.exit.lower().strip()
        if (any(contains_keyword_as_word(exit_text, kw) for kw in self.sieve_rules.exit_forbidden_keywords) or
            len(exit_text) < self.sieve_rules.exit_min_length):
            errors.append("Sieve Fail: Exit strategy is missing, restricted, or too brief. "
                         "Participants must have clear data/asset portability.")
        
        cap_risk = proposal.capture_risk.lower().strip()
        ownership_text = proposal.ownership.lower().strip()
        if (any(contains_keyword_as_word(cap_risk, m) for m in self.sieve_rules.capture_forbidden_mitigations) or
            contains_keyword_as_word(ownership_text, "absolute operator ownership")):
            errors.append("Sieve Fail: High capture risk. Mechanism does not mitigate "
                         "chokepoints or absolute operator control.")
        
        metrics = proposal.wellbeing_metrics.lower().strip()
        has_bad = any(contains_keyword_as_word(metrics, bm) for bm in self.sieve_rules.wellbeing_bad_metrics)
        has_good = any(contains_keyword_as_word(metrics, gm) for gm in self.sieve_rules.wellbeing_good_metrics)
        has_bad_only = has_bad and not has_good
        
        if has_bad_only or len(metrics) < 15:
            errors.append("Sieve Fail: Metrics capture detected. Optimization targets "
                         "financial speculation/volume instead of real-world well-being metrics.")
        
        gov = proposal.governance.lower().strip()
        if not contains_keyword_as_word(gov, "appeal") and not contains_keyword_as_word(gov, "arbitration"):
            warnings.append("Proposal lacks explicit dispute appeals or arbitration paths.")
        
        return SieveResult(ok=len(errors) == 0, errors=errors, warnings=warnings)
