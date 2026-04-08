import fs from "fs";
import path from "path";

import { getMemoryGraph } from "../lib/memory_graph.mjs";

const outPath = path.resolve(process.cwd(), "runtime", "memory_graph.json");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(getMemoryGraph(), null, 2)}\n`, "utf8");
console.log(`MEMORY_GRAPH_SYNC_OK wrote ${path.relative(process.cwd(), outPath).replace(/\\/g, "/")}`);
