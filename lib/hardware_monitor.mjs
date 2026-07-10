import os from "os";

/**
 * Checks the current hardware state, focusing on available system memory.
 * This is a lightweight monitor intended to inform routing decisions without
 * requiring heavy dependencies.
 *
 * In the future, this could be expanded to check VRAM using platform-specific
 * tools like `nvidia-smi` if required.
 *
 * @returns {{
 *   ok: boolean,
 *   free_memory_gb: number,
 *   total_memory_gb: number,
 *   memory_usage_percent: number
 * }}
 */
export function getHardwareState() {
  const total_memory = os.totalmem();
  const free_memory = os.freemem();
  const used_memory = total_memory - free_memory;

  const total_memory_gb = total_memory / (1024 ** 3);
  const free_memory_gb = free_memory / (1024 ** 3);
  const memory_usage_percent = (used_memory / total_memory) * 100;

  return {
    ok: true,
    free_memory_gb: parseFloat(free_memory_gb.toFixed(2)),
    total_memory_gb: parseFloat(total_memory_gb.toFixed(2)),
    memory_usage_percent: parseFloat(memory_usage_percent.toFixed(2)),
  };
}
