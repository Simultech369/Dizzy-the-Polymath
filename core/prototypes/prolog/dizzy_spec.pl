% Dizzy Core System Specification - Prolog Port
% Pure logic engine: specification rules mapped directly to logical relations.

% =========================================================================
% 1. Trust & Capabilities Declarative Specification
% =========================================================================

% baseline_capabilities(Zone, RepoAllowed, DurableAllowed, RetentionScope, EphemeralHistory, ExpiryPolicy)
baseline_capabilities(private_self, true, true, local_conversation, false, none).
baseline_capabilities(trusted_collaborator, true, true, local_conversation, false, none).
baseline_capabilities(outside_contact, false, false, local_conversation, false, none).
baseline_capabilities(paid_public, false, false, conversation_only, false, '7_days_inactivity_operator_deletable').

% trust_zone(ExplicitZone, TrustedLocal, Channel, ResolvedZone)
trust_zone(private_self, true, _, private_self) :- !.
trust_zone(private_self, false, _, outside_contact) :- !.
trust_zone(trusted_collaborator, _, _, trusted_collaborator) :- !.
trust_zone(outside_contact, _, _, outside_contact) :- !.
trust_zone(paid_public, _, _, paid_public) :- !.
% Fallback resolution
trust_zone(none, _, execute, paid_public) :- !.
trust_zone(none, true, local, private_self) :- !.
trust_zone(none, false, local, outside_contact) :- !.
trust_zone(_, _, _, outside_contact).

% continuity_mode(ExplicitMode, ResolvedMode)
continuity_mode(client, client) :- !.
continuity_mode(ephemeral, ephemeral) :- !.
continuity_mode(_, default).

% override_rules(Zone, Mode, ScopeInput, EphemeralInput, ExpiryInput, ScopeOutput, EphemeralOutput, ExpiryOutput)
override_rule(paid_public, Mode, _, _, _, ephemeral, true, none) :- 
    Mode \= client, !.
override_rule(_, _, Scope, Ephemeral, Expiry, Scope, Ephemeral, Expiry).

% capabilities(Zone, Mode, Repo, Durable, Scope, Ephemeral, Expiry)
% Combines baseline capability facts and overrides.
capabilities(Zone, Mode, Repo, Durable, Scope, Ephemeral, Expiry) :-
    baseline_capabilities(Zone, Repo, Durable, BaseScope, BaseEphemeral, BaseExpiry),
    override_rule(Zone, Mode, BaseScope, BaseEphemeral, BaseExpiry, Scope, Ephemeral, Expiry).

% =========================================================================
% 2. Dynamic Memory Decay Curves
% =========================================================================

% age_in_days(NowMs, TimestampMs, AgeInDays)
age_in_days(Now, Ts, Age) :- 
    nonvar(Ts), Now >= Ts, !, 
    Age is (Now - Ts) / (1000.0 * 60 * 60 * 24).
age_in_days(Now, Ts, 0.0) :- 
    nonvar(Ts), Now < Ts, !. % Clamp clock skew
age_in_days(_, _, nil).

% decay(MemoryClass, AgeInDays, WeightFactor, Policy, ReviewDue)
decay(project_decision, Age, 1.0, authority_preserved_review_age_only, true) :- 
    Age \= nil, Age >= 365.0, !.
decay(project_decision, Age, 1.0, authority_preserved_review_age_only, false) :- !.

decay(user_claim, Age, 1.0, authority_preserved_review_age_only, true) :- 
    Age \= nil, Age >= 365.0, !.
decay(user_claim, Age, 1.0, authority_preserved_review_age_only, false) :- !.

decay(reusable_pattern, nil, 1.0, relevance_half_life_365_days, false) :- !.
decay(reusable_pattern, Age, Factor, relevance_half_life_365_days, false) :- 
    Factor is 0.5 ** (Age / 365.0), !.

decay(assistant_observation, nil, 1.0, relevance_half_life_180_days, false) :- !.
decay(assistant_observation, Age, Factor, relevance_half_life_180_days, false) :- 
    Factor is 0.5 ** (Age / 180.0), !.

decay(unclassified, nil, 1.0, relevance_half_life_180_days, false) :- !.
decay(unclassified, Age, Factor, relevance_half_life_180_days, false) :- 
    Factor is 0.5 ** (Age / 180.0), !.

% =========================================================================
% 3. Mechanism Sieve Verification (Pure Logic Errors and Rules)
% =========================================================================

% Word-boundary helper (splits text into lowercase tokens for exact matching)
word_match(Text, Keyword) :-
    downcase_atom(Text, LText),
    downcase_atom(Keyword, LKeyword),
    % Tokenize using common separators
    split_string(LText, " \t\n\r.,();-", " \t\n\r.,();-", Words),
    member(LKeyword, Words).

% Sieve errors declaration (A proposal has an error IF any clause unifies)
sieve_error(Proposal, title_missing) :- field_empty(Proposal, title).
sieve_error(Proposal, capability_missing) :- field_empty(Proposal, capability).
sieve_error(Proposal, ownership_missing) :- field_empty(Proposal, ownership).
sieve_error(Proposal, funding_missing) :- field_empty(Proposal, funding).
sieve_error(Proposal, governance_missing) :- field_empty(Proposal, governance).
sieve_error(Proposal, enforcement_missing) :- field_empty(Proposal, enforcement).
sieve_error(Proposal, exit_missing) :- field_empty(Proposal, exit).
sieve_error(Proposal, capture_risk_missing) :- field_empty(Proposal, capture_risk).
sieve_error(Proposal, simplification_missing) :- field_empty(Proposal, simplification).
sieve_error(Proposal, wellbeing_metrics_missing) :- field_empty(Proposal, wellbeing_metrics).

% Exit strategy errors
sieve_error(Proposal, exit_forbidden_word) :-
    field(Proposal, exit, Exit),
    forbidden_exit_keyword(Kw),
    word_match(Exit, Kw).
sieve_error(Proposal, exit_too_short) :-
    field(Proposal, exit, Exit),
    string_length(Exit, Len),
    Len < 15.

% Capture risk errors
sieve_error(Proposal, capture_forbidden_mitigation) :-
    field(Proposal, capture_risk, CR),
    forbidden_capture_keyword(Kw),
    word_match(CR, Kw).
sieve_error(Proposal, absolute_operator_ownership) :-
    field(Proposal, ownership, Owner),
    word_match(Owner, "absolute operator ownership").

% Wellbeing metrics errors
sieve_error(Proposal, wellbeing_bad_metrics_only) :-
    field(Proposal, wellbeing_metrics, M),
    has_bad_metric(M),
    \+ has_good_metric(M).
sieve_error(Proposal, wellbeing_metrics_too_short) :-
    field(Proposal, wellbeing_metrics, M),
    string_length(M, Len),
    Len < 15.

% Governance warning (not an error, but checked separately)
sieve_warning(Proposal, no_dispute_resolution) :-
    field(Proposal, governance, Gov),
    \+ word_match(Gov, "appeal"),
    \+ word_match(Gov, "arbitration").

% Sieve facts data
forbidden_exit_keyword("none").
forbidden_exit_keyword("no exit").
forbidden_exit_keyword("not allowed").
forbidden_exit_keyword("lock-in").
forbidden_exit_keyword("impossible to leave").
forbidden_exit_keyword("restricted").

forbidden_capture_keyword("no mitigation").
forbidden_capture_keyword("operator absolute control").

bad_metric("tvl").
bad_metric("token price").
bad_metric("speculation").
bad_metric("market cap").
bad_metric("transaction volume").
bad_metric("growth rate").

good_metric("patients").
good_metric("access").
good_metric("stabilized").
good_metric("waste").
good_metric("carbon").
good_metric("well-being").
good_metric("portability").

has_bad_metric(Text) :- bad_metric(M), word_match(Text, M).
has_good_metric(Text) :- good_metric(M), word_match(Text, M).

% helper predicates
field_empty(Proposal, Name) :-
    field(Proposal, Name, Value),
    split_string(Value, " \t\n\r", " \t\n\r", [""]).
field_empty(Proposal, Name) :-
    \+ field(Proposal, Name, _).

% Mock Proposal Maps using key-value functors
field(proposal(Title, _, _, _, _, _, _, _, _, _), title, Title).
field(proposal(_, Cap, _, _, _, _, _, _, _, _), capability, Cap).
field(proposal(_, _, Owner, _, _, _, _, _, _, _), ownership, Owner).
field(proposal(_, _, _, Fund, _, _, _, _, _, _), funding, Fund).
field(proposal(_, _, _, _, Gov, _, _, _, _, _), governance, Gov).
field(proposal(_, _, _, _, _, Enforce, _, _, _, _), enforcement, Enforce).
field(proposal(_, _, _, _, _, _, Exit, _, _, _), exit, Exit).
field(proposal(_, _, _, _, _, _, _, CR, _, _), capture_risk, CR).
field(proposal(_, _, _, _, _, _, _, _, Simp, _), simplification, Simp).
field(proposal(_, _, _, _, _, _, _, _, _, Metrics), wellbeing_metrics, Metrics).

% =========================================================================
% Sieve Validator Entry point
% =========================================================================

% validate_proposal(Proposal, Status, Errors, Warnings)
% Evaluates proposal and gathers all satisfied logic errors/warnings.
validate_proposal(Proposal, ok, [], Warnings) :-
    \+ sieve_error(Proposal, _), !,
    findall(W, sieve_warning(Proposal, W), Warnings).
validate_proposal(Proposal, error, Errors, Warnings) :-
    findall(E, sieve_error(Proposal, E), Errors),
    findall(W, sieve_warning(Proposal, W), Warnings).

% =========================================================================
% Test Suite
% =========================================================================

run_tests :-
    writeln("Running Dizzy Core Prolog validation rules..."),

    % Test 1: Trust zone resolution unifications
    trust_zone(none, true, local, Zone1), Zone1 = private_self,
    trust_zone(private_self, false, any, Zone2), Zone2 = outside_contact,
    trust_zone(paid_public, true, any, Zone3), Zone3 = paid_public,

    % Test 2: Override capabilities unifications
    capabilities(paid_public, ephemeral, Repo1, Durable1, Scope1, Ephemeral1, Expiry1),
    Repo1 = false, Durable1 = false, Scope1 = ephemeral, Ephemeral1 = true, Expiry1 = none,

    capabilities(paid_public, client, Repo2, Durable2, Scope2, Ephemeral2, Expiry2),
    Repo2 = false, Durable2 = false, Scope2 = conversation_only, Ephemeral2 = false, Expiry2 = '7_days_inactivity_operator_deletable',

    % Test 3: Decay curve clock skew clamp
    age_in_days(500, 1000, AgeSkew), AgeSkew = 0.0,
    decay(reusable_pattern, AgeSkew, Factor1, _, _), Factor1 = 1.0,

    % Test 4: Sieve Substring Trap verification
    % proposal(Title, Capability, Ownership, Funding, Governance, Enforcement, Exit, CaptureRisk, Simplification, WellbeingMetrics)
    GoodProp = proposal(
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
    ),
    validate_proposal(GoodProp, StatusGood, [], _), StatusGood = ok,

    % Substring trap: exit has 'nonexistent' (contains none), capture has 'Anonomitigation' (contains no mitigation)
    SubProp = proposal(
        "Substring Trap",
        "Data processing",
        "DAO",
        "Grants",
        "Multisig with appeal",
        "Smart contract",
        "We have a nonexistent withdrawal system",
        "Anonomitigation is planned",
        "Simple design",
        "Patients access stabilizer metrics"
    ),
    validate_proposal(SubProp, StatusSub, [], _), StatusSub = ok,

    % Sieve failure verification
    BadProp = proposal(
        "Bad",
        "X",
        "Absolute operator ownership",
        "VC",
        "Top-down",
        "Central",
        "none",
        "Mitigated",
        "Simple",
        "TVL and token price only"
    ),
    validate_proposal(BadProp, StatusBad, ErrorsBad, _), StatusBad = error,
    member(exit_forbidden_word, ErrorsBad),
    member(absolute_operator_ownership, ErrorsBad),
    member(wellbeing_bad_metrics_only, ErrorsBad),

    writeln("All Prolog logical specification tests passed successfully!").
