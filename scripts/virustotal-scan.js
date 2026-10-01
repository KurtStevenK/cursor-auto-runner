#!/usr/bin/env node
/**
 * Upload release installers to VirusTotal and wait for analysis.
 * Requires VIRUSTOTAL_API_KEY (.env.local, .env, or environment).
 *
 * Usage:
 *   node scripts/virustotal-scan.js [--artifacts-dir artifacts] [--report virustotal-report.md]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openAsBlob } = require('node:fs');

const VT_BASE = 'https://www.virustotal.com/api/v3';
const SMALL_FILE_MAX = 32 * 1024 * 1024;
const RATE_LIMIT_MS = 16_000;
const POLL_MS = 15_000;
const POLL_MAX = 40;

function parseEnvFile(envPath) {
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function loadDotEnv() {
  const root = process.cwd();
  const merged = {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, '.env.local')),
  };
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs(argv) {
  let artifactsDir = 'artifacts';
  let reportPath = '';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--artifacts-dir' && argv[i + 1]) {
      artifactsDir = argv[++i];
    } else if (argv[i] === '--report' && argv[i + 1]) {
      reportPath = argv[++i];
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/virustotal-scan.js [--artifacts-dir DIR] [--report FILE]');
      process.exit(0);
    }
  }
  return { artifactsDir, reportPath };
}

function collectArtifacts(root) {
  const abs = path.resolve(root);
  if (!fs.existsSync(abs)) {
    throw new Error(`Artifacts directory not found: ${abs}`);
  }
  const patterns = [/\.exe$/i, /\.dmg$/i, /\.deb$/i, /\.AppImage$/i];
  const out = [];

  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (patterns.some((re) => re.test(name))) out.push(full);
    }
  }

  walk(abs);
  out.sort();
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function vtJson(res, context) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${context}: invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = body?.error?.message || text.slice(0, 300);
    throw new Error(`${context}: HTTP ${res.status} — ${msg}`);
  }
  return body;
}

async function uploadFile(filePath, apiKey) {
  const size = fs.statSync(filePath).size;
  const name = path.basename(filePath);
  const blob = await openAsBlob(filePath);

  if (size <= SMALL_FILE_MAX) {
    const form = new FormData();
    form.append('file', blob, name);
    const res = await fetch(`${VT_BASE}/files`, {
      method: 'POST',
      headers: { 'x-apikey': apiKey },
      body: form,
    });
    return vtJson(res, `upload ${name}`);
  }

  const urlRes = await fetch(`${VT_BASE}/files/upload_url`, {
    headers: { 'x-apikey': apiKey },
  });
  const urlBody = await vtJson(urlRes, `upload_url for ${name}`);
  const uploadUrl =
    typeof urlBody?.data === 'string'
      ? urlBody.data
      : urlBody?.data?.upload_url;
  if (!uploadUrl) {
    throw new Error(`No upload_url for ${name} (response: ${JSON.stringify(urlBody).slice(0, 200)})`);
  }

  const form = new FormData();
  form.append('file', blob, name);
  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'x-apikey': apiKey },
    body: form,
  });
  return vtJson(upRes, `large upload ${name}`);
}

async function waitForAnalysis(analysisId, apiKey) {
  for (let i = 0; i < POLL_MAX; i++) {
    const res = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
      headers: { 'x-apikey': apiKey },
    });
    const body = await vtJson(res, `analysis ${analysisId}`);
    const status = body?.data?.attributes?.status;
    if (status === 'completed') return body.data.attributes;
    if (status === 'failed') {
      throw new Error(`VirusTotal analysis failed for ${analysisId}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`VirusTotal analysis timed out for ${analysisId}`);
}

function guiLink(sha256) {
  return `https://www.virustotal.com/gui/file/${sha256}`;
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.error('VIRUSTOTAL_API_KEY is not set (.env.local, .env, or environment).');
    process.exit(1);
  }

  const { artifactsDir, reportPath } = parseArgs(process.argv);
  const files = collectArtifacts(artifactsDir);
  if (files.length === 0) {
    console.error(`No release artifacts found under ${artifactsDir}`);
    process.exit(1);
  }

  const failOnDetection = process.env.VIRUSTOTAL_FAIL_ON_DETECTION === '1';
  const rows = [];
  let anyMalicious = false;

  console.log(`[virustotal] Scanning ${files.length} file(s) from ${artifactsDir}`);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const base = path.basename(filePath);
    console.log(`[virustotal] (${i + 1}/${files.length}) Uploading ${base}…`);

    const uploadBody = await uploadFile(filePath, apiKey);
    const analysisId = uploadBody?.data?.id;
    if (!analysisId) {
      throw new Error(`No analysis id after upload for ${base}`);
    }

    const attrs = await waitForAnalysis(analysisId, apiKey);
    const stats = attrs.stats || {};
    const sha256 = attrs.sha256 || '';
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const undetected = stats.undetected ?? 0;
    if (malicious > 0) anyMalicious = true;

    rows.push({
      file: base,
      malicious,
      suspicious,
      undetected,
      link: sha256 ? guiLink(sha256) : '',
    });

    console.log(
      `[virustotal] ${base}: malicious=${malicious} suspicious=${suspicious} undetected=${undetected}`,
    );
    if (sha256) console.log(`[virustotal] ${guiLink(sha256)}`);

    if (i < files.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const lines = [
    '## VirusTotal',
    '',
    'Installers were submitted for multi-engine scanning (results may update on VT after publish).',
    '',
    '| File | Malicious | Suspicious | Undetected | Report |',
    '|---|---:|---:|---:|---|',
  ];
  for (const r of rows) {
    const linkCell = r.link ? `[view](${r.link})` : '—';
    lines.push(`| \`${r.file}\` | ${r.malicious} | ${r.suspicious} | ${r.undetected} | ${linkCell} |`);
  }
  lines.push('');

  const markdown = lines.join('\n');
  console.log('\n' + markdown);

  if (reportPath) {
    fs.writeFileSync(reportPath, markdown);
    console.log(`[virustotal] Wrote ${reportPath}`);
  }

  if (failOnDetection && anyMalicious) {
    console.error('[virustotal] VIRUSTOTAL_FAIL_ON_DETECTION=1 and malicious > 0 — failing.');
    process.exit(1);
  }
  if (anyMalicious) {
    console.warn('[virustotal] Warning: at least one file has malicious detections (not failing).');
  }
}

main().catch((err) => {
  console.error('[virustotal]', err.message || err);
  process.exit(1);
});
