package main

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strings"
	"sync"
	"time"
)

// =========================================================================
// 1. Trust & Capabilities Specification
// =========================================================================

type TrustZone string

const (
	PrivateSelf        TrustZone = "private_self"
	TrustedCollaborator TrustZone = "trusted_collaborator"
	OutsideContact      TrustZone = "outside_contact"
	PaidPublic         TrustZone = "paid_public"
)

type ContinuityMode string

const (
	Client    ContinuityMode = "client"
	Ephemeral ContinuityMode = "ephemeral"
	Default   ContinuityMode = "default"
)

type Capabilities struct {
	TrustZone             TrustZone
	ContinuityMode        ContinuityMode
	RetentionScope        string
	EphemeralHistory      bool
	RepoRetrievalAllowed  bool
	DurableMemoryAllowed  bool
	ExpiryPolicy          string
}

func GetTrustZone(explicit *string, trustedLocal bool, channel string) TrustZone {
	var explicitClean string
	if explicit != nil {
		explicitClean = strings.ToLower(strings.TrimSpace(*explicit))
	}

	if explicitClean == "private_self" {
		if trustedLocal {
			return PrivateSelf
		}
		return OutsideContact
	}

	switch explicitClean {
	case "trusted_collaborator":
		return TrustedCollaborator
	case "outside_contact":
		return OutsideContact
	case "paid_public":
		return PaidPublic
	default:
		channelClean := strings.ToLower(strings.TrimSpace(channel))
		if channelClean == "execute" {
			return PaidPublic
		} else if channelClean == "local" && trustedLocal {
			return PrivateSelf
		}
		return OutsideContact
	}
}

func GetContinuityMode(explicit *string) ContinuityMode {
	if explicit == nil {
		return Default
	}
	switch strings.ToLower(strings.TrimSpace(*explicit)) {
	case "client":
		return Client
	case "ephemeral":
		return Ephemeral
	default:
		return Default
	}
}

func GetTrustZoneCapabilities(zone TrustZone, mode ContinuityMode) Capabilities {
	paidPublic := zone == PaidPublic
	ephemeralHistory := paidPublic && mode != Client

	repoAllowed := zone == PrivateSelf || zone == TrustedCollaborator
	durableAllowed := zone == PrivateSelf || zone == TrustedCollaborator

	var retentionScope string
	if paidPublic {
		if ephemeralHistory {
			retentionScope = "ephemeral"
		} else {
			retentionScope = "conversation_only"
		}
	} else {
		retentionScope = "local_conversation"
	}

	var expiryPolicy string
	if paidPublic && !ephemeralHistory {
		expiryPolicy = "7_days_inactivity_operator_deletable"
	} else {
		expiryPolicy = "none"
	}

	return Capabilities{
		TrustZone:            zone,
		ContinuityMode:       mode,
		RetentionScope:       retentionScope,
		EphemeralHistory:     ephemeralHistory,
		RepoRetrievalAllowed: repoAllowed,
		DurableMemoryAllowed: durableAllowed,
		ExpiryPolicy:         expiryPolicy,
	}
}

// =========================================================================
// 2. Dynamic Memory Decay Curves
// =========================================================================

type MemoryClass string

const (
	ProjectDecision      MemoryClass = "project_decision"
	UserClaim            MemoryClass = "user_claim"
	ReusablePattern      MemoryClass = "reusable_pattern"
	AssistantObservation MemoryClass = "assistant_observation"
	Unclassified         MemoryClass = "unclassified"
)

type DocMetadata struct {
	MemoryClass  MemoryClass
	LastReviewed *uint64 // Unix timestamp in milliseconds
	CapturedAt   *uint64 // Unix timestamp in milliseconds
}

type DecayResult struct {
	Factor      float64
	Policy      string
	AgeInDays   *float64
	ReviewDue   bool
}

func CalculateDecay(meta DocMetadata, nowMs uint64) DecayResult {
	var dateMs *uint64
	if meta.LastReviewed != nil {
		dateMs = meta.LastReviewed
	} else {
		dateMs = meta.CapturedAt
	}

	var ageInDays *float64
	if dateMs != nil {
		if nowMs >= *dateMs {
			days := float64(nowMs-*dateMs) / (1000.0 * 60.0 * 60.0 * 24.0)
			ageInDays = &days
		} else {
			days := 0.0 // Clamp clock skew
			ageInDays = &days
		}
	}

	switch meta.MemoryClass {
	case ProjectDecision, UserClaim:
		reviewDue := false
		if ageInDays != nil && *ageInDays >= 365.0 {
			reviewDue = true
		}
		return DecayResult{
			Factor:    1.0,
			Policy:    "authority_preserved_review_age_only",
			AgeInDays: ageInDays,
			ReviewDue: reviewDue,
		}
	case ReusablePattern:
		factor := 1.0
		if ageInDays != nil {
			factor = math.Pow(0.5, *ageInDays/365.0)
		}
		return DecayResult{
			Factor:    factor,
			Policy:    "relevance_half_life_365_days",
			AgeInDays: ageInDays,
			ReviewDue: false,
		}
	default:
		factor := 1.0
		if ageInDays != nil {
			factor = math.Pow(0.5, *ageInDays/180.0)
		}
		return DecayResult{
			Factor:    factor,
			Policy:    "relevance_half_life_180_days",
			AgeInDays: ageInDays,
			ReviewDue: false,
		}
	}
}

// =========================================================================
// 3. Mechanism Sieve Verification (Regex Word Boundaries)
// =========================================================================

type SieveProposal struct {
	Title            string
	Capability       string
	Ownership        string
	Funding          string
	Governance       string
	Enforcement      string
	Exit             string
	CaptureRisk      string
	Simplification   string
	WellbeingMetrics string
}

type SieveResult struct {
	Ok       bool
	Errors   []string
	Warnings []string
}

// Thread-safe pattern cache
var (
	patternCache = make(map[string]*regexp.Regexp)
	cacheMutex   sync.RWMutex
)

func containsKeywordAsWord(text, keyword string) bool {
	cacheMutex.RLock()
	re, ok := patternCache[keyword]
	cacheMutex.RUnlock()

	if !ok {
		// Compile case-insensitive word boundary regex
		escaped := regexp.QuoteMeta(keyword)
		var err error
		re, err = regexp.Compile(`(?i)\b` + escaped + `\b`)
		if err != nil {
			return false
		}
		cacheMutex.Lock()
		patternCache[keyword] = re
		cacheMutex.Unlock()
	}

	return re.MatchString(text)
}

func ValidateMechanismSieve(proposal SieveProposal) SieveResult {
	var errors []string
	var warnings []string

	// Required fields check
	if strings.TrimSpace(proposal.Title) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'title'")
	}
	if strings.TrimSpace(proposal.Capability) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'capability'")
	}
	if strings.TrimSpace(proposal.Ownership) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'ownership'")
	}
	if strings.TrimSpace(proposal.Funding) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'funding'")
	}
	if strings.TrimSpace(proposal.Governance) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'governance'")
	}
	if strings.TrimSpace(proposal.Enforcement) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'enforcement'")
	}
	if strings.TrimSpace(proposal.Exit) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'exit'")
	}
	if strings.TrimSpace(proposal.CaptureRisk) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'captureRisk'")
	}
	if strings.TrimSpace(proposal.Simplification) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'simplification'")
	}
	if strings.TrimSpace(proposal.WellbeingMetrics) == "" {
		errors = append(errors, "Missing or empty required sieve field: 'wellbeingMetrics'")
	}

	if len(errors) > 0 {
		return SieveResult{Ok: false, Errors: errors, Warnings: warnings}
	}

	// 1. Exit strategy check
	exitText := strings.TrimSpace(strings.ToLower(proposal.Exit))
	noExitKeywords := []string{"none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"}
	
	hasForbiddenExit := false
	for _, kw := range noExitKeywords {
		if containsKeywordAsWord(exitText, kw) {
			hasForbiddenExit = true;
			break
		}
	}
	if hasForbiddenExit || len(exitText) < 15 {
		errors = append(errors, "Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability.")
	}

	// 2. Chokepoint & Capture risk check
	capRisk := strings.TrimSpace(strings.ToLower(proposal.CaptureRisk))
	ownershipText := strings.TrimSpace(strings.ToLower(proposal.Ownership))

	if containsKeywordAsWord(capRisk, "no mitigation") ||
		containsKeywordAsWord(capRisk, "operator absolute control") ||
		containsKeywordAsWord(ownershipText, "absolute operator ownership") {
		errors = append(errors, "Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control.")
	}

	// 3. Wellbeing metrics check
	metrics := strings.TrimSpace(strings.ToLower(proposal.WellbeingMetrics))
	badMetrics := []string{"tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"}
	goodMetrics := []string{"patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"}

	hasBad := false
	for _, bm := range badMetrics {
		if containsKeywordAsWord(metrics, bm) {
			hasBad = true
			break
		}
	}
	hasGood := false
	for _, gm := range goodMetrics {
		if containsKeywordAsWord(metrics, gm) {
			hasGood = true
			break
		}
	}
	hasBadOnly := hasBad && !hasGood

	if hasBadOnly || len(metrics) < 15 {
		errors = append(errors, "Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics.")
	}

	// 4. Governance check (non-fatal warning)
	gov := strings.TrimSpace(strings.ToLower(proposal.Governance))
	if !containsKeywordAsWord(gov, "appeal") && !containsKeywordAsWord(gov, "arbitration") {
		warnings = append(warnings, "Proposal lacks explicit dispute appeals or arbitration paths.")
	}

	return SieveResult{
		Ok:       len(errors) == 0,
		Errors:   errors,
		Warnings: warnings,
	}
}

// =========================================================================
// 5. Supervisor Concurrency Multiplexer (Process Isolation Demo)
// =========================================================================

type TaskResult struct {
	ProposalTitle string
	SieveRes      SieveResult
	Err           error
}

// TaskSupervisor multiplexes multiple sieve evaluations concurrently,
// isolating crashes (panics) and timeouts on a per-task basis.
type TaskSupervisor struct {
	timeout time.Duration
}

func NewTaskSupervisor(timeout time.Duration) *TaskSupervisor {
	return &TaskSupervisor{timeout: timeout}
}

// EvaluateConcurrently runs multiple proposals in isolated goroutines
// with timeout and panic recovery protection.
func (s *TaskSupervisor) EvaluateConcurrently(proposals []SieveProposal) []TaskResult {
	results := make([]TaskResult, len(proposals))
	var wg sync.WaitGroup

	for i, prop := range proposals {
		wg.Add(1)
		go func(index int, p SieveProposal) {
			defer wg.Done()
			
			// Isolated channels for timeout control
			resChan := make(chan TaskResult, 1)

			go func() {
				// PANIC RECOVERY BOUNDARY
				defer func() {
					if r := recover(); r != nil {
						resChan <- TaskResult{
							ProposalTitle: p.Title,
							Err:           fmt.Errorf("panic recovered during evaluation: %v", r),
						}
					}
				}()

				// Simulate dynamic CPU processing time
				if p.Title == "Simulate Crash" {
					panic("segmentation fault: nil pointer dereference")
				}
				if p.Title == "Simulate Timeout" {
					time.Sleep(100 * time.Millisecond) // Exceeds context
				}

				res := ValidateMechanismSieve(p)
				resChan <- TaskResult{
					ProposalTitle: p.Title,
					SieveRes:      res,
				}
			}()

			// Evaluate with timeout
			ctx, cancel := context.WithTimeout(context.Background(), s.timeout)
			defer cancel()

			select {
			case res := <-resChan:
				results[index] = res
			case <-ctx.Done():
				results[index] = TaskResult{
					ProposalTitle: p.Title,
					Err:           fmt.Errorf("evaluation timed out after %v", s.timeout),
				}
			}
		}(i, prop)
	}

	wg.Wait()
	return results
}

// =========================================================================
// Test Suite Runner
// =========================================================================

func main() {
	fmt.Println("Running Dizzy Core Go validation and supervisor tests...")

	// 1. Trust zone resolution checks
	pSelf := "private_self"
	assert(GetTrustZone(&pSelf, true, "local") == PrivateSelf, "Trust private_self local")
	assert(GetTrustZone(&pSelf, false, "local") == OutsideContact, "Trust private_self non-local")
	
	// 2. Decay curves checks
	captured := uint64(1000)
	meta := DocMetadata{
		MemoryClass: ReusablePattern,
		CapturedAt:  &captured,
	}
	decaySkew := CalculateDecay(meta, 500) // Clock skew: now < captured
	assert(*decaySkew.AgeInDays == 0.0, "Decay age clamp to 0.0")
	assert(decaySkew.Factor == 1.0, "Decay factor clamp to 1.0")

	// 3. Word boundaries sieve check
	proposalGood := SieveProposal{
		Title:            "Decentralized Storage",
		Capability:       "Data replication",
		Ownership:        "DAO with multisig",
		Funding:          "Grant + fees",
		Governance:       "Token-weighted with appeal board",
		Enforcement:      "Smart contract slashing",
		Exit:             "Data portability with 30-day export window",
		CaptureRisk:      "Multi-validator set prevents operator control",
		Simplification:   "Reduces current overhead by 40%",
		WellbeingMetrics: "Measured by access latency and carbon per GB",
	}
	resGood := ValidateMechanismSieve(proposalGood)
	assert(resGood.Ok == true, "Good proposal check")

	proposalSub := SieveProposal{
		Title:            "Test Substring Trap",
		Capability:       "Data",
		Ownership:        "DAO",
		Funding:          "VC",
		Governance:       "Multisig",
		Enforcement:      "Contract",
		Exit:             "We have a nonexistent withdrawal system", // "none" inside nonexistent
		CaptureRisk:      "Anonomitigation is planned",            // "no mitigation" inside Anonomitigation
		Simplification:   "Simple",
		WellbeingMetrics: "Patients access stabilizer metrics",
	}
	resSub := ValidateMechanismSieve(proposalSub)
	assert(resSub.Ok == true, "Sieve should ignore substring matches (nonexistent/Anonomitigation)")

	// 4. Supervisor Concurrency Multiplexing
	supervisor := NewTaskSupervisor(30 * time.Millisecond)
	concurrentProposals := []SieveProposal{
		proposalGood,
		{Title: "Simulate Crash", Capability: "X", Ownership: "O"},
		{Title: "Simulate Timeout", Capability: "X", Ownership: "O"},
	}

	fmt.Println("Dispatching isolated background tasks...")
	results := supervisor.EvaluateConcurrently(concurrentProposals)

	// Verify Good Sieve Task
	assert(results[0].Err == nil, "Task 1 completed without error")
	assert(results[0].SieveRes.Ok == true, "Task 1 sieve is Ok")

	// Verify Crash Isolated Task
	assert(results[1].Err != nil, "Task 2 (Crash) returned error")
	assert(strings.Contains(results[1].Err.Error(), "panic recovered"), "Task 2 returned panic error description")

	// Verify Timeout Isolated Task
	assert(results[2].Err != nil, "Task 3 (Timeout) returned error")
	assert(strings.Contains(results[2].Err.Error(), "timed out"), "Task 3 returned timeout error description")

	fmt.Println("All Go validation and supervisor multiplexer tests passed successfully!")
}

func assert(cond bool, msg string) {
	if !cond {
		panic(fmt.Sprintf("Assertion failed: %s", msg))
	}
}
