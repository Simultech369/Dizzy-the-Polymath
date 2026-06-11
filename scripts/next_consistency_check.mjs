import { validateNextConsistency } from "../lib/next_consistency.mjs";

const result = validateNextConsistency();

if (!result.ok) {
  console.error("NEXT_CONSISTENCY_FAIL");
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`NEXT_CONSISTENCY_OK checked=${result.checked}`);
