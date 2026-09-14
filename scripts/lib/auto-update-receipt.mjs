import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const AUTO_RECEIPT_SCHEMA_VERSION = 'hotword-publish-receipt-v1';

function asString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeFilePath(value) {
  return asString(value).replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeRoute(value) {
  const clean = asString(value).replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : '/';
}

function pageRoute(page) {
  return normalizeRoute(page?.slug || page?.id);
}

function stripContentExtension(value) {
  return value.replace(/\.(md|mdx|markdown)$/i, '');
}

function pageIndex(document) {
  return (Array.isArray(document?.pages) ? document.pages : []).map((page) => {
    const source = normalizeFilePath(page?.source);
    const sourceLeaf = stripContentExtension(path.posix.basename(source));
    const slug = asString(page?.slug || page?.id).replace(/^\/+|\/+$/g, '');
    const slugLeaf = slug.split('/').filter(Boolean).at(-1) || '';
    return {
      route: pageRoute(page),
      source,
      sourceLeaf,
      slugLeaf,
      id: asString(page?.id),
    };
  });
}

export function parseGitNameStatus(text) {
  return asString(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const fields = line.split('\t');
    const rawStatus = fields[0] || 'M';
    const status = rawStatus[0].toUpperCase();
    if (status === 'R' || status === 'C') {
      return { status, oldPath: normalizeFilePath(fields[1]), path: normalizeFilePath(fields[2]) };
    }
    return { status, path: normalizeFilePath(fields[1]) };
  }).filter((item) => item.path);
}

function homepageFile(filePath) {
  const value = normalizeFilePath(filePath).toLowerCase();
  return [
    'src/content/docs/index.md',
    'src/content/docs/index.mdx',
    'src/pages/index.astro',
    'site-input/pages/index.md',
    'site-input/pages/index.mdx',
    'site-input/home.md',
    'site-input/home.mdx',
  ].includes(value);
}

function generatedIndexRoute(filePath) {
  const value = normalizeFilePath(filePath);
  const match = value.match(/^src\/content\/docs\/(.+)\/index\.mdx?$/i);
  return match ? normalizeRoute(match[1]) : '';
}

function routesForChange(change, index) {
  const current = normalizeFilePath(change.path);
  const leaf = stripContentExtension(path.posix.basename(current));
  const routes = new Set();

  for (const item of index) {
    if (item.source && current === item.source) routes.add(item.route);
  }

  if (current.startsWith('site-input/pages/') || current.startsWith('src/content/docs/')) {
    for (const item of index) {
      if (leaf && [item.sourceLeaf, item.slugLeaf, item.id].includes(leaf)) routes.add(item.route);
    }
  }

  if (homepageFile(current)) routes.add('/');
  const generatedHub = generatedIndexRoute(current);
  if (generatedHub) routes.add(generatedHub);
  return [...routes];
}

function actionForStatus(status) {
  return String(status).toUpperCase() === 'A' ? 'CREATE_PAGE' : 'UPDATE_PAGE';
}

export function buildAutoUpdateReceipt({ document, head, baseSha, changes, commitSubject }) {
  const siteId = asString(document?.site?.id);
  const site = asString(document?.site?.shortName || document?.site?.title || document?.game?.name);
  const game = asString(document?.game?.name || site);
  if (!siteId || !site || !game) throw new Error('auto Update Receipt requires site.id, site title/shortName, and game.name in site-spec.yaml');
  if (!asString(head) || !asString(baseSha)) throw new Error('auto Update Receipt requires head and base commit SHAs');

  const index = pageIndex(document);
  const routes = new Map();
  for (const change of Array.isArray(changes) ? changes : []) {
    for (const route of routesForChange(change, index)) {
      const existing = routes.get(route);
      const nextAction = actionForStatus(change.status);
      routes.set(route, {
        action: existing?.action === 'CREATE_PAGE' || nextAction === 'CREATE_PAGE' ? 'CREATE_PAGE' : 'UPDATE_PAGE',
        files: [...new Set([...(existing?.files || []), change.path])],
      });
    }
  }

  if (routes.size === 0) {
    routes.set('/', {
      action: 'UPDATE_PAGE',
      files: (Array.isArray(changes) ? changes : []).map((item) => item.path).filter(Boolean),
    });
  }

  const batchId = `auto-${siteId}-${String(head).slice(0, 12)}`;
  const summary = asString(commitSubject) || `Production update ${String(head).slice(0, 12)}`;
  const interventions = [...routes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, meta]) => ({
      action: meta.action,
      primaryUrl: route,
      affectedUrls: [route],
      triggerType: 'AUTO_GIT_DIFF',
      triggerQueries: [],
      triggerSummary: summary,
      sourceRefs: [`git:${head}`, ...meta.files],
      reason: `Auto-generated from committed production diff ${baseSha}..${head}.`,
    }));

  return {
    schemaVersion: AUTO_RECEIPT_SCHEMA_VERSION,
    common: {
      site,
      siteId,
      game,
      batchId,
      commitSha: head,
      attributionMode: 'AUTO_DIFF',
      recordedMode: 'RECEIPT_AUTO',
      autoReceiptBaseSha: baseSha,
    },
    interventions,
  };
}

function git(rootDir, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if ((result.status ?? 1) !== 0) {
    if (options.allowFailure) return '';
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }
  return String(result.stdout || '').trim();
}

export function generateAutoUpdateReceipt(rootDir, options = {}) {
  const specPath = path.join(rootDir, 'site-spec.yaml');
  const document = options.document || YAML.parse(readFileSync(specPath, 'utf8')) || {};
  const status = git(rootDir, ['status', '--porcelain']);
  if (status) {
    throw new Error('auto Update Receipt requires a clean working tree so the recorded diff exactly matches the Production deploy; commit changes first or pass an explicit --receipt');
  }

  const head = git(rootDir, ['rev-parse', 'HEAD']);
  const baseSha = asString(process.env.HOTWORD_RECEIPT_BASE_SHA) || git(rootDir, ['rev-parse', 'HEAD^']);
  const parentSpecText = git(rootDir, ['show', `${baseSha}:site-spec.yaml`], { allowFailure: true });
  if (!parentSpecText) {
    throw new Error('auto Update Receipt is only for updates to an existing site; parent commit has no site-spec.yaml, so use an explicit SITE_LAUNCH receipt');
  }
  const parentDocument = YAML.parse(parentSpecText) || {};
  if (asString(parentDocument?.site?.id) !== asString(document?.site?.id)) {
    throw new Error('auto Update Receipt is only for updates to the same site; site.id changed from the parent commit, so use an explicit SITE_LAUNCH receipt');
  }

  const diffText = git(rootDir, ['diff', '--name-status', '-M', baseSha, head]);
  const changes = parseGitNameStatus(diffText);
  if (changes.length === 0) throw new Error('auto Update Receipt found no committed changes between base and HEAD');
  const commitSubject = git(rootDir, ['log', '-1', '--pretty=%s', head]);
  return buildAutoUpdateReceipt({ document, head, baseSha, changes, commitSubject });
}
