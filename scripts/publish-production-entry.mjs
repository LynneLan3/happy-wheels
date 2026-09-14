#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { generateAutoUpdateReceipt } from './lib/auto-update-receipt.mjs';
import { validateVercelOnlyProductionUrl } from './lib/deployment-identity.mjs';
import { runProductionPublish } from './publish-production.mjs';

function asString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function parsePublishArgs(argv) {
  let receiptPath = '';
  let checkOnly = false;
  let skipBuild = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--receipt') { receiptPath = argv[++i] || ''; continue; }
    if (arg.startsWith('--receipt=')) { receiptPath = arg.slice('--receipt='.length); continue; }
    if (arg === '--check') { checkOnly = true; continue; }
    if (arg === '--skip-build') { skipBuild = true; continue; }
    if (arg === '--help' || arg === '-h') {
      return { help: true, receiptPath: '', checkOnly, skipBuild };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return {
    help: false,
    receiptPath: receiptPath ? path.resolve(receiptPath) : '',
    checkOnly,
    skipBuild,
  };
}

function gitRepositoryUrl(rootDir) {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.status !== 0) throw new Error('SITE_LAUNCH requires git origin');
  const remote = asString(result.stdout);
  const ssh = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/i);
  if (ssh) return `https://github.com/${ssh[1].replace(/\.git$/i, '')}`;
  const https = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/i);
  if (https) return `https://github.com/${https[1].replace(/\.git$/i, '')}`;
  throw new Error(`SITE_LAUNCH origin must be a GitHub repository: ${remote}`);
}

function launchPageCount(receipt, productionUrl) {
  const explicit = Number(receipt.common?.launchPageCount);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const paths = new Set();
  for (const intervention of receipt.interventions ?? []) {
    if (asString(intervention.action).toUpperCase() !== 'SITE_LAUNCH') continue;
    for (const value of intervention.affectedUrls ?? []) {
      try {
        const pathname = new URL(value, productionUrl).pathname;
        if (pathname === '/' || pathname === '/guides/' || pathname === '/routes/' || pathname === '/robots.txt' || pathname.startsWith('/sitemap')) continue;
        paths.add(pathname);
      } catch {}
    }
  }
  return paths.size;
}

function enrichLaunchReceipt(rootDir, receiptPath) {
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const launch = Array.isArray(receipt.interventions)
    && receipt.interventions.some((item) => asString(item?.action).toUpperCase() === 'SITE_LAUNCH');
  if (!launch) return { receipt, enriched: false };

  receipt.common = receipt.common || {};
  const required = ['steamAppId', 'decisionId', 'opportunityId'];
  const missing = required.filter((field) => !asString(receipt.common[field]));
  if (missing.length) throw new Error(`SITE_LAUNCH receipt missing required attribution: ${missing.map((x) => `common.${x}`).join(', ')}`);

  const spec = YAML.parse(readFileSync(path.join(rootDir, 'site-spec.yaml'), 'utf8')) || {};
  const siteId = asString(spec.site?.id);
  const productionUrl = asString(spec.deployment?.productionUrl || spec.site?.siteUrl);
  if (!siteId) throw new Error('SITE_LAUNCH requires site.id in site-spec.yaml');
  if (asString(receipt.common.siteId) && asString(receipt.common.siteId) !== siteId) {
    throw new Error(`SITE_LAUNCH siteId conflict: receipt=${receipt.common.siteId} site-spec=${siteId}`);
  }

  receipt.common.siteId = siteId;
  receipt.common.repositoryUrl = gitRepositoryUrl(rootDir);
  receipt.common.templateVersion = asString(spec.templateVersion);
  if (productionUrl) {
    const productionUrlCheck = validateVercelOnlyProductionUrl(productionUrl);
    if (productionUrlCheck.ok) {
      receipt.common.sitemapUrl = new URL('/sitemap-index.xml', productionUrl).href;
      receipt.common.launchPageCount = launchPageCount(receipt, productionUrl);
    }
  }
  return { receipt, enriched: true };
}

export function preparePublishReceipt(rootDir, receiptPath, options = {}) {
  if (receiptPath) {
    const { receipt, enriched } = enrichLaunchReceipt(rootDir, receiptPath);
    return { receipt, source: 'EXPLICIT', needsTempFile: enriched };
  }
  const generate = options.generateAutoReceipt || generateAutoUpdateReceipt;
  const receipt = generate(rootDir);
  return { receipt, source: 'AUTO_UPDATE', needsTempFile: true };
}

export async function runPublishEntry(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const receiptPath = options.receiptPath || '';
  let tempDir = '';
  try {
    const prepared = preparePublishReceipt(rootDir, receiptPath, options);
    let effectiveReceipt = receiptPath;
    if (prepared.needsTempFile) {
      tempDir = mkdtempSync(path.join(os.tmpdir(), 'hotword-publish-receipt-'));
      effectiveReceipt = path.join(tempDir, prepared.source === 'AUTO_UPDATE' ? 'auto-update-receipt.json' : 'enriched-receipt.json');
      writeFileSync(effectiveReceipt, `${JSON.stringify(prepared.receipt, null, 2)}\n`, 'utf8');
    }
    return await (options.runProduction || runProductionPublish)({
      rootDir,
      receiptPath: effectiveReceipt,
      checkOnly: Boolean(options.checkOnly),
      skipBuild: Boolean(options.skipBuild),
    });
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parsePublishArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run publish:production -- [--receipt <path>] [--check] [--skip-build]');
    console.log('Without --receipt, ordinary updates auto-generate a receipt from site-spec.yaml and the committed HEAD^..HEAD diff. SITE_LAUNCH still requires an explicit receipt.');
    return;
  }
  const result = await runPublishEntry(options);
  process.exitCode = result.status === 'PUBLISH_COMPLETE' || result.status === 'CHECK_ONLY' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`PUBLISH FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
