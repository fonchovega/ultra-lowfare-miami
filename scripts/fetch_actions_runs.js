// scripts/fetch_actions_runs.js
// Descarga TODOS los runs del workflow farebot.yml y los guarda en data/actions_runs.json

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const OWNER = process.env.GITHUB_OWNER || "fonchovega";
const REPO  = process.env.GITHUB_REPO  || "ultra-lowfare-miami";
const WORKFLOW_FILE_NAME = "farebot.yml"; // exacto al de .github/workflows
const OUT_FILE = path.join("data", "actions_runs.json");

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN; // token repo scope

async function getWorkflowId() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" }});
  if (!res.ok) throw new Error(`Error listando workflows: ${res.status}`);
  const data = await res.json();
  const wf = data.workflows.find(w => w.path.endsWith(`/${WORKFLOW_FILE_NAME}`));
  if (!wf) throw new Error(`No se encontró workflow ${WORKFLOW_FILE_NAME}`);
  return wf.id;
}

async function getAllRuns(workflowId) {
  let page = 1;
  const per_page = 100;
  const runs = [];
  while (true) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowId}/runs?per_page=${per_page}&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" }});
    if (!res.ok) throw new Error(`Error listando runs p${page}: ${res.status}`);
    const data = await res.json();
    if (!data.workflow_runs || data.workflow_runs.length === 0) break;
    runs.push(...data.workflow_runs.map(r => ({
      id: r.id,
      status: r.status,
      conclusion: r.conclusion,
      event: r.event,
      duration_seconds: r.run_started_at && r.updated_at ? Math.max(0, (new Date(r.updated_at)-new Date(r.run_started_at))/1000|0) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      head_sha: r.head_sha,
      html_url: r.html_url
    })));
    page++;
  }
  return runs;
}

async function main() {
  if (!TOKEN) {
    console.error("❌ Falta GITHUB_TOKEN o GH_TOKEN en variables de entorno.");
    process.exit(1);
  }
  if (!fs.existsSync("data")) fs.mkdirSync("data");
  const workflowId = await getWorkflowId();
  const runs = await getAllRuns(workflowId);
  fs.writeFileSync(OUT_FILE, JSON.stringify({ total: runs.length, runs }, null, 2));
  console.log(`✅ Guardados ${runs.length} runs en ${OUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
