# JEPA Second Opinion

Date: 2026-05-06

Purpose: review the copied JEPA/OpenClaw recipe, identify weak or likely-wrong parts, and merge it into a cleaner staged process for later OpenClaude review.

## Bottom line

The copied recipe is mixed quality.

Some parts are directionally right:

- use the official EB-JEPA library first
- keep the initial integration sidecar-shaped
- use OpenClaw as the control plane, not the vision runtime
- prefer small backbones on consumer hardware

Some parts are weak or likely wrong:

- `Q4_K_M quantization` for JEPA
- `EB_JEPA_Model.load_pretrained("vit-tiny")` in the sample script
- `continuous: true` as an OpenClaw config claim
- `hooks.onStateChange` as an obvious OpenClaw config path
- prescribing `/etc/systemd/system` as the default deployment path for OpenClaw on modern setups

So this should not be treated as a ready recipe.

## Repo-grounded corrections

## 1. EB-JEPA source

Use the official repo first:

- `facebookresearch/eb_jepa`

Reason:

- it is the current official library
- it includes image, video, and action-conditioned video JEPA examples
- it is a better ground truth than older or hobby forks

Community forks like `LumenPallidium/jepa` may still be useful as experimental references, especially for the Saccade JEPA idea, but they should not be the default base.

Important distinction:

- `Saccade JEPA` is not an official `eb_jepa` primitive
- it comes from the community repo, not the current official Meta library

So the original line that treats "Saccade JEPA or a small backbone included in EB-JEPA examples" as one interchangeable official choice is sloppy.

## 2. Windows / WSL2 / CUDA

This needs more precision.

OpenClaw itself currently recommends Windows via WSL2.
That part is real.

But for JEPA:

- installing NVIDIA drivers is necessary for GPU acceleration
- WSL2 + CUDA passthrough is often the cleanest path on Windows
- it is not mandatory for every possible inference workflow

What matters is verifying actual CUDA availability, not cargo-culting setup steps.

The real check is:

- does `nvidia-smi` work in the target environment?
- does PyTorch see CUDA?
- can a small EB-JEPA example run without OOM?

Without those checks, "Install NVIDIA drivers and WSL2/CUDA" is just ritual text.

## 3. Quantization claim

The `Q4_K_M` advice is the biggest obvious mismatch.

That is a llama.cpp / GGUF-style quantization label, not a standard JEPA/PyTorch vision-model prescription.

For JEPA on a laptop, the practical levers are more like:

- smaller backbone
- lower input resolution
- reduced batch size
- fp16 / bf16 inference where supported
- possibly int8 or ONNX/TensorRT style optimization if the model/export path supports it

So:

- do not carry `Q4_K_M` forward as if it belongs naturally to EB-JEPA

If quantization is revisited later, it should be justified by the actual export/runtime path, not copied from LLM folklore.

## 4. MCP integration claim

The copied idea is right in spirit but needs an OpenClaw-specific correction.

The good idea:

- wrap the JEPA sidecar behind a callable interface so the assistant can invoke it

The correction:

- current OpenClaw preference is MCP through `mcporter`, not building first-class MCP runtime into core

So the cleaner phrasing is:

- expose JEPA through a thin local tool bridge, ideally MCP-compatible through the existing OpenClaw bridge path, rather than treating JEPA as something OpenClaw natively absorbs

## 5. OpenClaw config claims

Several copied config lines look suspect or invented.

### `continuous: true`

I do not currently trust this as a canonical OpenClaw config instruction.

OpenClaw does have:

- daemon install
- gateway process
- cron jobs
- hooks/webhooks
- heartbeats in various runtime contexts

But the copied recipe phrases this like a direct config key without grounding.

That should be treated as unverified.

### `heartbeatInterval`

There are heartbeat concepts in OpenClaw, but the copied recipe presents this as if it is an obvious top-level config knob for this use case.

That is not grounded enough.

### `hooks.onStateChange`

This also reads like invented middleware syntax rather than repo-grounded OpenClaw configuration.

OpenClaw does support hooks and webhook surfaces.
That does not mean this exact config shape exists.

So this should be removed unless verified against current docs or code.

## 6. Systemd deployment

The copied recipe is too confident and too root-oriented.

Problems:

- `/etc/systemd/system` is not the natural default for modern per-user assistant installs
- OpenClaw already has an `openclaw onboard --install-daemon` path
- WSL2 systemd support is conditional and historically fragile

Better framing:

- prefer OpenClaw's own daemon install path first
- only write custom service units if the stock daemon model is insufficient
- if using Linux services, prefer user services before system-wide root-managed units unless there is a real reason not to

The copied systemd units are not useless.
They are just too early and too prescriptive.

## 7. Sidecar script

The sample `sidecar_observer.py` is conceptually fine as pseudocode, but not trustworthy as real code.

Weak points:

- `from eb_jepa import EB_JEPA_Model` is unverified
- `EB_JEPA_Model.load_pretrained("vit-tiny")` is unverified
- the "prediction error" logic shown is not real JEPA usage, just placeholder distance math
- `current_latent` is random noise in the sample

So this should be labeled as:

- bridge sketch
- not implementation

Do not treat it as runnable until the actual EB-JEPA API and chosen example path are verified.

## Recommended merged process

## Thread A: Environment reality check

Goal:

- prove the laptop can run a minimal JEPA path at all

Steps:

1. Clone `facebookresearch/eb_jepa`
2. Set up a clean Python environment
3. Verify GPU path:
   - `nvidia-smi`
   - PyTorch CUDA availability
4. Run a minimal official example locally
5. Record:
   - VRAM use
   - latency
   - whether WSL2 is actually needed for the chosen workflow

Exit condition:

- one official example runs reliably on the target machine

## Thread B: Model choice and runtime shape

Goal:

- choose a realistic JEPA footprint for consumer hardware

Steps:

1. Start with official EB-JEPA examples, not custom variants
2. Prefer smallest viable backbone and resolution
3. Only consider Saccade JEPA later if the official path is too mismatched to the desired use
4. Avoid LLM-derived quantization folklore unless the export/runtime path supports it directly

Exit condition:

- one concrete model/runtime combination is selected based on actual tests

## Thread C: OpenClaw integration shape

Goal:

- keep JEPA outside the assistant core and expose it as a callable sidecar

Steps:

1. Treat JEPA as a sidecar observer or analysis service
2. Expose one thin interface first:
   - JSON file
   - local WebSocket
   - or MCP-style bridge via `mcporter`
3. Do not modify OpenClaw core to become a JEPA runtime
4. Use a narrow tool contract such as:
   - `get_world_state`
   - `get_surprise_score`
   - `get_recent_latent_summary`

Exit condition:

- OpenClaw can query JEPA state without JEPA becoming tangled into core architecture

## Thread D: Agent behavior and prompting

Goal:

- make the agent know when JEPA matters without turning the whole persona into sensor mysticism

Steps:

1. Add narrow guidance in `SOUL.md` or `AGENTS.md`
2. Scope the guidance to:
   - visual anomaly review
   - sequence-change interpretation
   - environment monitoring
3. Avoid turning JEPA into a universal oracle

Exit condition:

- JEPA is treated as one input source, not the master worldview

## Thread E: Automation and always-on operation

Goal:

- only after Threads A-D work, make it persistent

Steps:

1. Prefer OpenClaw's native daemon install path first
2. Use cron/hooks/webhooks only where current docs actually support the flow
3. Add webhook or file-trigger wakeups only after the sidecar contract is stable
4. Only write custom systemd units if the built-in daemon path is insufficient

Exit condition:

- the system can survive restart and resume its loop reliably

## Practical revised order

1. official EB-JEPA clone + environment proof
2. smallest viable model path
3. thin sidecar output contract
4. OpenClaw-side tool bridge
5. only then daemonization / cron / wake triggers

## What should be handed to OpenClaude

OpenClaude should not review the copied recipe raw.

It should review:

- this second-opinion note
- the original copied recipe as source material
- current OpenClaw docs and repo state

And answer:

- which parts are genuinely viable?
- which parts are fake precision?
- what is the minimal proof-of-concept path on real consumer hardware?
