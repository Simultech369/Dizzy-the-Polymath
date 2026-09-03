/**
 * lib/scenario_simulator.mjs
 * ---------------------------
 * Bounded Scenario Forking and Time-Travel Replay Simulator.
 * Simulates a baseline state trajectory and compares it with a "what-if"
 * forked parameter set, calculating Euclidean divergence metrics over time.
 *
 * Safety invariant:
 * All simulation runs are strictly ephemeral in-memory calculations.
 * They do not mutate or write to active runtime/ or memory/ state.
 */

export const SCENARIO_SIMULATION_SCHEMA = "dizzy.scenario_simulation.v1";

/**
 * Executes a single state simulation step under given parameters.
 * @param {Object} state - Current simulation state
 * @param {Object} parameters - Step parameters (decay_rate, basic_needs_allocation, etc.)
 * @returns {Object} Next simulation state
 */
export function simulateStep(state, parameters = {}) {
  const safeNum = (val, fallback) => {
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };

  const nextState = { 
    reserves: safeNum(state?.reserves, 0),
    participants: safeNum(state?.participants, 0),
    allocated_amount: safeNum(state?.allocated_amount, 0),
    exited_count: safeNum(state?.exited_count, 0)
  };
  const decayRate = typeof parameters.decay_rate === "number" ? parameters.decay_rate : 0.02;
  const basicNeeds = typeof parameters.basic_needs_allocation === "number" ? parameters.basic_needs_allocation : 2.0;
  const exitThreshold = typeof parameters.reserves_exit_threshold === "number" ? parameters.reserves_exit_threshold : 100;
  const baseExitRate = typeof parameters.base_exit_rate === "number" ? parameters.base_exit_rate : 0.1;

  // 1. Reserves decay
  const decayAmount = nextState.reserves * decayRate;
  nextState.reserves = Math.max(0, nextState.reserves - decayAmount);

  // 2. Allocate basic needs to active participants
  const totalAllocation = (nextState.participants || 0) * basicNeeds;
  nextState.reserves = Math.max(0, nextState.reserves - totalAllocation);
  nextState.allocated_amount = (nextState.allocated_amount || 0) + totalAllocation;

  // 3. Exit rate triggered if reserves drop below exitThreshold
  if (nextState.reserves < exitThreshold && nextState.participants > 0) {
    const exitFraction = (exitThreshold - nextState.reserves) / exitThreshold;
    const exits = Math.min(nextState.participants, Math.round(nextState.participants * exitFraction * baseExitRate));
    nextState.participants = Math.max(0, nextState.participants - exits);
    nextState.exited_count = (nextState.exited_count || 0) + exits;
  }

  return nextState;
}

/**
 * Runs a multi-step simulation trajectory.
 * @param {Object} initialState - Starting state { reserves, participants, allocated_amount, exited_count }
 * @param {Object} parameters - Scenario parameters
 * @param {number} steps - Number of steps to simulate
 * @returns {Array<Object>} History of state snapshots
 */
export function runSimulation(initialState, parameters = {}, steps = 30) {
  const safeNum = (val, fallback) => {
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };

  let state = {
    reserves: safeNum(initialState?.reserves, 1000),
    participants: safeNum(initialState?.participants, 50),
    allocated_amount: safeNum(initialState?.allocated_amount, 0),
    exited_count: safeNum(initialState?.exited_count, 0),
  };
  const history = [{ ...state, step: 0 }];

  for (let t = 1; t <= steps; t++) {
    state = simulateStep(state, parameters);
    history.push({ ...state, step: t });
  }

  return history;
}

/**
 * Computes Euclidean divergence metric between baseline and forked trajectory histories.
 * @param {Array<Object>} baselineHistory - Baseline trajectory
 * @param {Array<Object>} forkedHistory - Forked trajectory
 * @returns {Object} Divergence analysis report
 */
export function calculateDivergence(baselineHistory = [], forkedHistory = []) {
  const steps = Math.min(baselineHistory.length, forkedHistory.length);
  const divergenceHistory = [];
  let cumulativeDivergence = 0;

  for (let t = 0; t < steps; t++) {
    const b = baselineHistory[t];
    const f = forkedHistory[t];

    const dReserves = (f.reserves - b.reserves) / (b.reserves || 1);
    const dParticipants = (f.participants - b.participants) / (b.participants || 1);

    const stepDivergence = Math.sqrt(dReserves * dReserves + dParticipants * dParticipants);
    cumulativeDivergence += stepDivergence;

    divergenceHistory.push({
      step: t,
      reserves_delta: Number((f.reserves - b.reserves).toFixed(2)),
      participants_delta: f.participants - b.participants,
      step_divergence: Number(stepDivergence.toFixed(4)),
      cumulative_divergence: Number(cumulativeDivergence.toFixed(4)),
    });
  }

  return {
    schema_version: SCENARIO_SIMULATION_SCHEMA,
    total_steps: steps,
    cumulative_divergence: Number(cumulativeDivergence.toFixed(4)),
    average_divergence: Number((cumulativeDivergence / (steps || 1)).toFixed(4)),
    history: divergenceHistory,
    authority: "scenario_simulation_is_ephemeral_model_not_authority",
  };
}

/**
 * High-level helper to fork a scenario against a baseline and generate divergence report.
 */
export function forkScenario({
  initialState,
  baselineParams = {},
  forkedParams = {},
  steps = 15,
} = {}) {
  const baselineRuns = runSimulation(initialState, baselineParams, steps);
  const forkedRuns = runSimulation(initialState, forkedParams, steps);
  const divergence = calculateDivergence(baselineRuns, forkedRuns);

  return {
    schema_version: SCENARIO_SIMULATION_SCHEMA,
    created_at: new Date().toISOString(),
    steps,
    baseline_summary: baselineRuns[baselineRuns.length - 1],
    forked_summary: forkedRuns[forkedRuns.length - 1],
    divergence,
  };
}
