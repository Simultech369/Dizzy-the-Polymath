# Dizzy Core System Specification - Elixir Port
# Fault-tolerant BEAM actor processes, supervisor trees, and native regex boundaries.

# =========================================================================
# 1. Trust & Capabilities Specification
# =========================================================================

defmodule DizzySpec.Trust do
  # TrustZone atoms: :private_self, :trusted_collaborator, :outside_contact, :paid_public
  # ContinuityMode atoms: :client, :ephemeral, :default

  def get_trust_zone(explicit, trusted_local?, channel) do
    explicit_clean = 
      if explicit do
        explicit |> String.trim() |> String.downcase()
      else
        ""
      end

    case explicit_clean do
      "private_self" ->
        if trusted_local?, do: :private_self, else: :outside_contact
      "trusted_collaborator" -> :trusted_collaborator
      "outside_contact" -> :outside_contact
      "paid_public" -> :paid_public
      _ ->
        channel_clean = channel |> String.trim() |> String.downcase()
        cond do
          channel_clean == "execute" -> :paid_public
          channel_clean == "local" and trusted_local? -> :private_self
          true -> :outside_contact
        end
    end
  end

  def get_continuity_mode(explicit) do
    case explicit && explicit |> String.trim() |> String.downcase() do
      "client" -> :client
      "ephemeral" -> :ephemeral
      _ -> :default
    end
  end

  def get_trust_zone_capabilities(zone, mode) do
    paid_public? = zone == :paid_public
    ephemeral_history? = paid_public? and mode != :client

    repo_allowed? = zone == :private_self or zone == :trusted_collaborator
    durable_allowed? = zone == :private_self or zone == :trusted_collaborator

    retention_scope = 
      if paid_public? do
        if ephemeral_history?, do: "ephemeral", else: "conversation_only"
      else
        "local_conversation"
      end

    expiry_policy = 
      if paid_public? and not ephemeral_history? do
        "7_days_inactivity_operator_deletable"
      else
        "none"
      end

    %{
      trust_zone: zone,
      continuity_mode: mode,
      retention_scope: retention_scope,
      ephemeral_history: ephemeral_history?,
      repo_retrieval_allowed: repo_allowed?,
      durable_memory_allowed: durable_allowed?,
      expiry_policy: expiry_policy
    }
  end
end

# =========================================================================
# 2. Dynamic Memory Decay Curves
# =========================================================================

defmodule DizzySpec.Decay do
  # MemoryClass atoms: :project_decision, :user_claim, :reusable_pattern, :assistant_observation, :unclassified

  def calculate_decay(meta, now_ms) do
    date_ms = meta[:last_reviewed] || meta[:captured_at]

    age_in_days = 
      if date_ms do
        if now_ms >= date_ms do
          (now_ms - date_ms) / (1000.0 * 60 * 60 * 24)
        else
          0.0 # Clamp clock skew
        end
      else
        nil
      end

    case meta[:memory_class] do
      class when class in [:project_decision, :user_claim] ->
        review_due = if age_in_days, do: age_in_days >= 365.0, else: false
        %{
          factor: 1.0,
          policy: "authority_preserved_review_age_only",
          age_in_days: age_in_days,
          review_due: review_due
        }

      :reusable_pattern ->
        factor = if age_in_days, do: :math.pow(0.5, age_in_days / 365.0), else: 1.0
        %{
          factor: factor,
          policy: "relevance_half_life_365_days",
          age_in_days: age_in_days,
          review_due: false
        }

      _ -> # :assistant_observation or :unclassified
        factor = if age_in_days, do: :math.pow(0.5, age_in_days / 180.0), else: 1.0
        %{
          factor: factor,
          policy: "relevance_half_life_180_days",
          age_in_days: age_in_days,
          review_due: false
        }
    end
  end
end

# =========================================================================
# 3. Mechanism Sieve Verification (Regex Word Boundaries)
# =========================================================================

defmodule DizzySpec.Sieve do
  def contains_keyword_as_word?(text, keyword) do
    # Build case-insensitive regex pattern with word boundaries \b
    pattern = ~r/\b#{Regex.escape(keyword)}\b/i
    Regex.match?(pattern, text)
  end

  def validate_mechanism_sieve(proposal) do
    errors = []
    errors = if blank?(proposal[:title]), do: ["Missing or empty required sieve field: 'title'" | errors], else: errors
    errors = if blank?(proposal[:capability]), do: ["Missing or empty required sieve field: 'capability'" | errors], else: errors
    errors = if blank?(proposal[:ownership]), do: ["Missing or empty required sieve field: 'ownership'" | errors], else: errors
    errors = if blank?(proposal[:funding]), do: ["Missing or empty required sieve field: 'funding'" | errors], else: errors
    errors = if blank?(proposal[:governance]), do: ["Missing or empty required sieve field: 'governance'" | errors], else: errors
    errors = if blank?(proposal[:enforcement]), do: ["Missing or empty required sieve field: 'enforcement'" | errors], else: errors
    errors = if blank?(proposal[:exit]), do: ["Missing or empty required sieve field: 'exit'" | errors], else: errors
    errors = if blank?(proposal[:capture_risk]), do: ["Missing or empty required sieve field: 'captureRisk'" | errors], else: errors
    errors = if blank?(proposal[:simplification]), do: ["Missing or empty required sieve field: 'simplification'" | errors], else: errors
    errors = if blank?(proposal[:wellbeing_metrics]), do: ["Missing or empty required sieve field: 'wellbeingMetrics'" | errors], else: errors

    if length(errors) > 0 do
      %{ok: false, errors: Enum.reverse(errors), warnings: []}
    else
      exit_text = proposal[:exit] |> String.trim() |> String.downcase()
      no_exit_keywords = ["none", "no exit", "not allowed", "lock-in", "impossible to leave", "restricted"]
      has_forbidden_exit = Enum.any?(no_exit_keywords, &contains_keyword_as_word?(exit_text, &1))
      
      exit_errors = 
        if has_forbidden_exit or String.length(exit_text) < 15 do
          ["Sieve Fail: Exit strategy is missing, restricted, or too brief. Participants must have clear data/asset portability."]
        else
          []
        end

      cap_risk = proposal[:capture_risk] |> String.trim() |> String.downcase()
      ownership = proposal[:ownership] |> String.trim() |> String.downcase()
      capture_errors = 
        if contains_keyword_as_word?(cap_risk, "no mitigation") or
           contains_keyword_as_word?(cap_risk, "operator absolute control") or
           contains_keyword_as_word?(ownership, "absolute operator ownership") do
          ["Sieve Fail: High capture risk. Mechanism does not mitigate chokepoints or absolute operator control."]
        else
          []
        end

      metrics = proposal[:wellbeing_metrics] |> String.trim() |> String.downcase()
      bad_metrics = ["tvl", "token price", "speculation", "market cap", "transaction volume", "growth rate"]
      good_metrics = ["patients", "access", "stabilized", "waste", "carbon", "well-being", "portability"]
      has_bad = Enum.any?(bad_metrics, &contains_keyword_as_word?(metrics, &1))
      has_good = Enum.any?(good_metrics, &contains_keyword_as_word?(metrics, &1))
      has_bad_only = has_bad and not has_good

      metric_errors = 
        if has_bad_only or String.length(metrics) < 15 do
          ["Sieve Fail: Metrics capture detected. Optimization targets financial speculation/volume instead of real-world well-being metrics."]
        else
          []
        end

      gov = proposal[:governance] |> String.trim() |> String.downcase()
      gov_warnings = 
        if not String.contains?(gov, "appeal") and not String.contains?(gov, "arbitration") do
          ["Proposal lacks explicit dispute appeals or arbitration paths."]
        else
          []
        end

      all_errors = exit_errors ++ capture_errors ++ metric_errors

      %{
        ok: length(all_errors) == 0,
        errors: all_errors,
        warnings: gov_warnings
      }
    end
  end

  defp blank?(nil), do: true
  defp blank?(str), do: str |> String.trim() == ""
end

# =========================================================================
# 4. Supervisor Concurrency Multiplexer (Process Isolation Demo)
# =========================================================================

defmodule DizzySpec.TaskSupervisor do
  @doc """
  Runs multiple sieve validations concurrently, spawning each inside an isolated
  BEAM process. Monitors each process to catch exits (crashes) or timeouts,
  ensuring the supervisor itself never crashes.
  """
  def evaluate_concurrently(proposals, timeout_ms \\ 50) do
    proposals
    .map(fn prop -> spawn_worker(prop, timeout_ms) end)
    .map(&collect_result/1)
  end

  # Pipeline helper
  defp spawn_worker(proposal, timeout_ms) do
    parent = self()
    
    # Spawn and monitor the worker process (isolated boundary)
    {pid, ref} = Process.spawn(fn ->
      # Simulate a crash if Title is specified
      if proposal[:title] == "Simulate Crash" do
        exit(:segmentation_fault_nil_pointer)
      end

      # Simulate a timeout
      if proposal[:title] == "Simulate Timeout" do
        :timer.sleep(100)
      end

      res = DizzySpec.Sieve.validate_mechanism_sieve(proposal)
      send(parent, {ref, :ok, res})
    end, [:monitor])

    {pid, ref, proposal[:title]}
  end

  defp collect_result({pid, ref, title}) do
    receive do
      {^ref, :ok, res} ->
        # Normal return
        Process.demonitor(ref, [:flush])
        {:ok, title, res}

      {:DOWN, ^ref, :process, ^pid, reason} ->
        # Crash detected and isolated
        {:error, title, :crashed, reason}
    after
      50 ->
        # Timeout boundary reached
        Process.exit(pid, :kill)
        {:error, title, :timeout, :deadline_exceeded}
    end
  end
end

# =========================================================================
# Test Suite Runner
# =========================================================================

defmodule DizzySpec.Runner do
  def run_all_tests do
    IO.puts "Running Dizzy Core Elixir validation and process isolation tests..."

    # 1. Trust zone resolution checks
    assert(DizzySpec.Trust.get_trust_zone("private_self", true, "local") == :private_self)
    assert(DizzySpec.Trust.get_trust_zone("private_self", false, "any") == :outside_contact)
    assert(DizzySpec.Trust.get_trust_zone("PAID_PUBLIC", true, "any") == :paid_public)

    # 2. Decay curve clock skew clamp
    meta = %{memory_class: :reusable_pattern, captured_at: 1000}
    decay = DizzySpec.Decay.calculate_decay(meta, 500)
    assert(decay[:age_in_days] == 0.0)
    assert(decay[:factor] == 1.0)

    # 3. Sieve keyword substring trap checks
    good_prop = %{
      title: "Decentralized Storage",
      capability: "Data replication",
      ownership: "DAO with multisig",
      funding: "Grant + fees",
      governance: "Token-weighted with appeal board",
      enforcement: "Smart contract slashing",
      exit: "Data portability with 30-day export window",
      capture_risk: "Multi-validator set prevents operator control",
      simplification: "Reduces current overhead by 40%",
      wellbeing_metrics: "Measured by access latency and carbon per GB"
    }
    assert(DizzySpec.Sieve.validate_mechanism_sieve(good_prop)[:ok] == true)

    sub_prop = %{
      title: "Substring Trap",
      capability: "X",
      ownership: "DAO",
      funding: "VC",
      governance: "Multisig",
      enforcement: "Contract",
      exit: "We have a nonexistent withdrawal system",
      capture_risk: "Anonomitigation is planned",
      simplification: "Simple",
      wellbeing_metrics: "Patients access stabilizer metrics"
    }
    assert(DizzySpec.Sieve.validate_mechanism_sieve(sub_prop)[:ok] == true)

    # 4. Supervisor Crash Recovery Verification
    concurrent_props = [
      good_prop,
      %{title: "Simulate Crash", capability: "X", ownership: "DAO"},
      %{title: "Simulate Timeout", capability: "X", ownership: "DAO"}
    ]

    IO.puts "Spawning supervised BEAM actor processes..."
    results = DizzySpec.TaskSupervisor.evaluate_concurrently(concurrent_props)

    # Verify task 1 (Good)
    {:ok, _, res} = Enum.at(results, 0)
    assert(res[:ok] == true)

    # Verify task 2 (Crash isolated)
    {:error, _, :crashed, reason} = Enum.at(results, 1)
    assert(reason == :segmentation_fault_nil_pointer)
    IO.puts "-> Worker crash caught: #{inspect(reason)} (Process isolated)"

    # Verify task 3 (Timeout isolated)
    {:error, _, :timeout, _} = Enum.at(results, 2)
    IO.puts "-> Worker timeout caught: deadline exceeded (Process isolated)"

    IO.puts "All Elixir validation and fault isolation tests passed successfully!"
  end

  defp assert(true), do: :ok
  defp assert(false), do: raise "Assertion failed!"
end

# Run the suite
DizzySpec.Runner.run_all_tests()
