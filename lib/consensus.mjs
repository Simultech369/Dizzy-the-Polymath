import fs from "fs";
import path from "path";

const STATE_FILE = path.resolve(process.cwd(), "runtime", "consensus_state.json");

const DEFAULT_OPTIONS = [
  { option_id: "opt-1", description: "Local speculative serving path (preferred)", friction: "low" },
  { option_id: "opt-2", description: "Quantized fall-back path", friction: "medium" },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getConsensusState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to read consensus state, resetting to default:", error.message);
  }

  // Default state initialization
  const defaultState = {
    ok: true,
    signing_chain: {
      codex: "SIGNED",
      openclaude: "SIGNED",
      antigravity: "PENDING",
    },
    consensus_status: "Awaiting Operator",
    options: DEFAULT_OPTIONS,
    basis: "operator_reported_review_state",
    proof_limit: "not_cryptographic_not_live_multi_agent_protocol",
  };
  saveConsensusState(defaultState);
  return defaultState;
}

export function saveConsensusState(state) {
  try {
    ensureDir(path.dirname(STATE_FILE));
    // Write atomically using a temporary file to prevent torn-writes
    const tmpFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmpFile, STATE_FILE);
    return true;
  } catch (error) {
    console.error("Failed to save consensus state:", error);
    return false;
  }
}

export function signOffOperator() {
  const state = getConsensusState();
  state.signing_chain.antigravity = "SIGNED";
  state.consensus_status = "Consensus Reached";
  saveConsensusState(state);
  return {
    ok: true,
    message: "Operator signed off successfully. Consensus reached.",
    signing_chain: state.signing_chain,
    consensus_status: state.consensus_status,
    basis: state.basis || "operator_reported_review_state",
    proof_limit: state.proof_limit || "not_cryptographic_not_live_multi_agent_protocol",
  };
}

export function vetoOperator() {
  const state = getConsensusState();
  state.signing_chain.codex = "VETOED";
  state.signing_chain.openclaude = "VETOED";
  state.signing_chain.antigravity = "VETOED";
  state.consensus_status = "Vetoed";
  saveConsensusState(state);
  return {
    ok: true,
    message: "Operator veto override initiated. Reverting state commit...",
    signing_chain: state.signing_chain,
    consensus_status: state.consensus_status,
    basis: state.basis || "operator_reported_review_state",
    proof_limit: state.proof_limit || "not_cryptographic_not_live_multi_agent_protocol",
  };
}

export function initializeNewProposal(options = DEFAULT_OPTIONS) {
  const newState = {
    ok: true,
    signing_chain: {
      codex: "SIGNED",
      openclaude: "SIGNED",
      antigravity: "PENDING",
    },
    consensus_status: "Awaiting Operator",
    options: options,
    basis: "operator_reported_review_state",
    proof_limit: "not_cryptographic_not_live_multi_agent_protocol",
  };
  saveConsensusState(newState);
  return newState;
}
