import fs from 'node:fs';

const repos = [
  'ClaudioDrews/memory-os',
  'ClaudioDrews/project-samantha',
  'ClaudioDrews/icarus-plugin',
  'quarqlabs/agent-oss',
  'polyxmedia/mnemos',
  'EurekaClaw/EurekaClaw',
  'cmxdev1/MNEMOS',
  'Panniantong/Agent-Reach',
  'OpenPipe/ART',
  'henryqin1997/statem',
  'aeonfun/aeon',
  'MiroShark/MiroShark'
];

async function checkLicenses() {
  const results = {};
  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/license`, {
        headers: { 'User-Agent': 'Node-Fetch' }
      });
      if (!res.ok) {
        if (res.status === 404) {
          results[repo] = 'Not Found / No License';
        } else {
          results[repo] = `Error: ${res.status}`;
        }
        continue;
      }
      const data = await res.json();
      results[repo] = data.license ? data.license.spdx_id : 'No License Object';
    } catch (e) {
      results[repo] = `Network Error: ${e.message}`;
    }
    // Rate limit delay
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(JSON.stringify(results, null, 2));
}

checkLicenses();
