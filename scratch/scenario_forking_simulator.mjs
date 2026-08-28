/**
 * Prototype for Bounded Scenario Forking and Time-Travel Replay Simulator.
 * Simulates a baseline state trajectory and compares it with a "what-if"
 * forked parameter set, calculating divergence metrics over time.
 */

// Simple state simulation step for the two-treasury model
function simulateStep(state, parameters) {
  const nextState = { ...state };
  
  // 1. Calculate reserves decay based on decay_rate
  const decayAmount = nextState.reserves * parameters.decay_rate;
  nextState.reserves = Math.max(0, nextState.reserves - decayAmount);
  
  // 2. Allocate basic needs to participants
  const totalAllocation = nextState.participants * parameters.basic_needs_allocation;
  nextState.reserves = Math.max(0, nextState.reserves - totalAllocation);
  nextState.allocated_amount += totalAllocation;

  // 3. Exit rate increases if reserves are low (precariousness)
  const exitThreshold = parameters.reserves_exit_threshold || 100;
  if (nextState.reserves < exitThreshold) {
    const exitFraction = (exitThreshold - nextState.reserves) / exitThreshold;
    const exits = Math.round(nextState.participants * exitFraction * parameters.base_exit_rate);
    nextState.participants = Math.max(0, nextState.participants - exits);
    nextState.exited_count += exits;
  }

  return nextState;
}

/**
 * Runs a full time-travel simulation over N steps
 */
export function runSimulation(initialState, parameters, steps = 30) {
  let state = { ...initialState };
  const history = [ { ...state } ];

  for (let t = 1; t <= steps; t++) {
    state = simulateStep(state, parameters);
    history.push({ ...state });
  }

  return history;
}

/**
 * Computes Euclidean divergence metric between baseline and fork history
 */
export function calculateDivergence(baselineHistory, forkedHistory) {
  const steps = Math.min(baselineHistory.length, forkedHistory.length);
  const divergenceHistory = [];
  let cumulativeDivergence = 0;

  for (let t = 0; t < steps; t++) {
    const b = baselineHistory[t];
    const f = forkedHistory[t];

    // Compute normalized difference of key state components
    const dReserves = (f.reserves - b.reserves) / (b.reserves || 1);
    const dParticipants = (f.participants - b.participants) / (b.participants || 1);
    
    // Euclidean divergence at step t
    const stepDivergence = Math.sqrt(dReserves * dReserves + dParticipants * dParticipants);
    cumulativeDivergence += stepDivergence;

    divergenceHistory.push({
      step: t,
      reserves_delta: Number((f.reserves - b.reserves).toFixed(2)),
      participants_delta: f.participants - b.participants,
      step_divergence: Number(stepDivergence.toFixed(4)),
      cumulative_divergence: Number(cumulativeDivergence.toFixed(4))
    });
  }

  return {
    total_steps: steps,
    cumulative_divergence: Number(cumulativeDivergence.toFixed(4)),
    average_divergence: Number((cumulativeDivergence / steps).toFixed(4)),
    history: divergenceHistory
  };
}

// --- Test Harness ---

const initialSystemState = {
  reserves: 1000,
  participants: 50,
  allocated_amount: 0,
  exited_count: 0
};

// 1. Baseline parameters (standard policy settings)
const baselineParams = {
  decay_rate: 0.02,               // 2% decay per step
  basic_needs_allocation: 2.0,    // 2 units per participant
  reserves_exit_threshold: 200,   // exits trigger below 200 reserves
  base_exit_rate: 0.1             // 10% exit rate multiplier
};

// 2. Forked parameters (aggressive policy - double the basic needs allocation)
const forkedParams = {
  ...baselineParams,
  basic_needs_allocation: 4.5,    // increase allocation significantly (depleting reserves faster)
};

console.log("Running baseline trajectory simulation...");
const baselineRuns = runSimulation(initialSystemState, baselineParams, 15);

console.log("Running forked trajectory simulation...");
const forkedRuns = runSimulation(initialSystemState, forkedParams, 15);

console.log("\nCalculating trajectory divergence...");
const divergence = calculateDivergence(baselineRuns, forkedRuns);

console.log(JSON.stringify({
  summary: {
    cumulative_divergence: divergence.cumulative_divergence,
    average_divergence: divergence.average_divergence,
    final_reserves_delta: divergence.history[divergence.history.length - 1].reserves_delta,
    final_participants_delta: divergence.history[divergence.history.length - 1].participants_delta
  },
  detailed_steps: divergence.history.slice(0, 5) // Show first few steps of divergence
}, null, 2));
