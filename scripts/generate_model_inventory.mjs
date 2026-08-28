import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProviderCapabilityMatrixReceipt } from '../lib/provider_capability_matrix.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inventoryPath = path.resolve(__dirname, '../MODEL_INVENTORY.md');

const receipt = buildProviderCapabilityMatrixReceipt({
  installedModels: ['gemma3:4b', 'deepseek-r1:7b'], // Mock local install for now
  testedModels: ['llama-3.1-8b-instant', 'qwen2.5-coder:7b'],
});

let markdownTable = `## 5. Active Model Capability Matrix (Auto-Generated)\n\n`;
markdownTable += `*Generated at: ${receipt.created_at}*\n\n`;
markdownTable += `| Model | Provider | Boundary | Installed | Callable | JSON Usable | Status |\n`;
markdownTable += `| :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n`;

for (const p of receipt.profiles) {
  const installedIcon = p.installed ? '✅' : '❌';
  const callableIcon = p.callable ? '✅' : '❌';
  const jsonIcon = p.json_review_usable ? '✅' : '❌';
  markdownTable += `| \`${p.model_id}\` | ${p.provider} | ${p.provider_boundary} | ${installedIcon} | ${callableIcon} | ${jsonIcon} | ${p.availability_status} |\n`;
}

markdownTable += `\n`;

let content = fs.readFileSync(inventoryPath, 'utf8');

// Replace everything from ## 5. Active Model Capability Matrix onwards
const sectionSplit = content.indexOf('## 5. Active Model Capability Matrix');
if (sectionSplit !== -1) {
    content = content.substring(0, sectionSplit);
} else {
    content += '\n\n';
}

content += markdownTable;

fs.writeFileSync(inventoryPath, content, 'utf8');
console.log('MODEL_INVENTORY.md updated successfully.');
