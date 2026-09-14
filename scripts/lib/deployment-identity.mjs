/**
 * Vercel deployment helpers for hotword sites.
 *
 * Provides the primary-team default and wires `deploy:production` to
 * `vercel deploy --prod --yes --scope lynnelan3s-projects`.
 *
 * site-spec.yaml supplies org/project ids. Local `.vercel/project.json` is
 * rewritten from the spec when needed. No multi-layer deploy gates.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/** Primary Vercel team for all new hotword site create / preview / production. */
export const PRIMARY_VERCEL_TEAM_SLUG = 'lynnelan3s-projects';
export const PRIMARY_VERCEL_ORG_ID = 'team_yAOizMTSVuT0RJATgFdAlQuG';

export const DEPLOYMENT_FIELDS = [
	'provider',
	'orgId',
	'projectId',
	'projectName',
	'productionUrl',
	'productionBranch',
];

export const SITE_SPEC_FILENAME = 'site-spec.yaml';
export const LOCAL_VERCEL_PROJECT = '.vercel/project.json';

function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value) {
	if (value === undefined || value === null) return '';
	if (typeof value !== 'string') return '';
	return value.trim();
}

export function normalizePublicUrl(value) {
	const parsed = new URL(value);
	parsed.hash = '';
	parsed.search = '';
	if (parsed.pathname === '/' || parsed.pathname === '') {
		return `${parsed.protocol}//${parsed.host}`;
	}
	return parsed.href.replace(/\/+$/, '');
}

export function isBlockedProductionHostname(hostname) {
	const host = String(hostname || '').toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1') {
		return true;
	}
	if (host === 'example' || host.endsWith('.example')) {
		return true;
	}
	if (host.endsWith('.vercel.app') && host.includes('-git-')) {
		return true;
	}
	return false;
}

export function validateVercelOnlyProductionUrl(value, options = {}) {
	const raw = asString(value);
	if (!raw || raw === 'MISSING') return { ok: false, reason: 'an explicitly configured canonical Production alias is required' };
	let parsed;
	try {
		parsed = new URL(raw);
	} catch {
		return { ok: false, reason: 'canonical Production URL must be an absolute URL' };
	}
	const host = parsed.hostname.toLowerCase();
	if (parsed.protocol !== 'https:' || !host.endsWith('.vercel.app')) {
		if (!options.requireVercel) return { ok: true, url: normalizePublicUrl(raw) };
		return { ok: false, reason: 'VERCEL_ONLY canonical Production URL must be an HTTPS .vercel.app alias' };
	}
	const teamSlug = asString(options.teamSlug) || PRIMARY_VERCEL_TEAM_SLUG;
	const hostWithoutSuffix = host.slice(0, -'.vercel.app'.length);
	const tokens = hostWithoutSuffix.split('-');
	const generatedToken = tokens.some((token) =>
		(token.startsWith('dpl_') || (token.length >= 6 && /[a-z]/.test(token) && /\d/.test(token))),
	);
	if (
		host.endsWith(`-${teamSlug}.vercel.app`) ||
		host.includes('-git-') ||
		host.includes('-preview-') ||
		host.endsWith('-preview.vercel.app') ||
		generatedToken
	) {
		return {
			ok: false,
			reason: 'preview, immutable deployment, random, or Vercel team/default hostname cannot be canonical Production identity',
		};
	}
	return { ok: true, url: normalizePublicUrl(raw) };
}

function aliasSlug(value) {
	return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function vercelCanonicalAliasCandidates({ projectName, siteId }) {
	const project = aliasSlug(projectName);
	const site = aliasSlug(siteId);
	return [...new Set([project, site && `${site}-game`, site && `${site}-guide`].filter(Boolean))]
		.map((slug) => `https://${slug}.vercel.app`);
}

export function spawnVercelAliasSet(deploymentUrl, alias, options = {}) {
	const result = spawnSync('vercel', ['alias', 'set', deploymentUrl, new URL(alias).hostname, '--scope', PRIMARY_VERCEL_TEAM_SLUG], {
		cwd: options.rootDir,
		encoding: 'utf8',
		env: { ...process.env, ...(options.env || {}) },
	});
	return {
		ok: result.status === 0,
		output: `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
	};
}

export async function bindVercelCanonicalAlias({ deploymentUrl, candidates, aliasFn = spawnVercelAliasSet, rootDir, maxAttemptsPerAlias = aliasFn === spawnVercelAliasSet ? 3 : 1 } = {}) {
	const target = asString(deploymentUrl);
	const aliases = Array.isArray(candidates) ? candidates : [];
	const attempts = [];
	for (const candidate of aliases) {
		for (let attempt = 1; attempt <= maxAttemptsPerAlias; attempt += 1) {
			const result = await aliasFn(target, candidate, { rootDir });
			attempts.push({ alias: candidate, attempt, ok: Boolean(result?.ok), output: result?.output || '' });
			if (result?.ok) return { ok: true, productionUrl: normalizePublicUrl(candidate), alias: candidate, attempts };
			if (attempt < maxAttemptsPerAlias) await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
	const error = new Error(`CANONICAL_ALIAS_EXHAUSTED: no deterministic Vercel alias could be bound (${aliases.join(', ')})`);
	error.code = 'CANONICAL_ALIAS_EXHAUSTED';
	error.attempts = attempts;
	throw error;
}

function blockedReason(reason, extraLines = []) {
	return {
		ok: false,
		blockedReason: reason,
		extraLines,
	};
}

export function readSiteSpecDocument(rootDir) {
	const specPath = path.join(rootDir, SITE_SPEC_FILENAME);
	if (!existsSync(specPath)) {
		return { specPath, missing: true, document: null, parseError: null };
	}
	const raw = readFileSync(specPath, 'utf8');
	try {
		return { specPath, missing: false, document: parseYaml(raw), parseError: null };
	} catch (error) {
		return { specPath, missing: false, document: null, parseError: String(error) };
	}
}

export function readLocalVercelLink(rootDir) {
	const file = path.join(rootDir, LOCAL_VERCEL_PROJECT);
	if (!existsSync(file)) return null;
	try {
		const parsed = JSON.parse(readFileSync(file, 'utf8'));
		if (!isRecord(parsed)) return null;
		const orgId = asString(parsed.orgId);
		const projectId = asString(parsed.projectId);
		const projectName = asString(parsed.projectName);
		if (!orgId && !projectId) return null;
		return { orgId, projectId, projectName };
	} catch {
		return null;
	}
}

export function writeLocalVercelLink(rootDir, deployment) {
	const dir = path.join(rootDir, '.vercel');
	mkdirSync(dir, { recursive: true });
	const body = `${JSON.stringify(
		{
			orgId: deployment.orgId,
			projectId: deployment.projectId,
			projectName: deployment.projectName,
		},
		null,
		2,
	)}\n`;
	writeFileSync(path.join(dir, 'project.json'), body, 'utf8');
}

export function readCurrentGitBranch(rootDir) {
	const result = spawnSync('git', ['branch', '--show-current'], {
		cwd: rootDir,
		encoding: 'utf8',
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	});
	if (result.status !== 0) {
		return { branch: '', error: (result.stderr || result.stdout || 'git branch --show-current failed').trim() };
	}
	return { branch: (result.stdout || '').trim(), error: null };
}

function extractDeployment(document) {
	if (!isRecord(document) || !isRecord(document.deployment)) {
		return {
			present: Boolean(isRecord(document) && document.deployment !== undefined),
			fields: Object.fromEntries(DEPLOYMENT_FIELDS.map((field) => [field, ''])),
		};
	}
	const raw = document.deployment;
	const orgId = asString(raw.orgId) || PRIMARY_VERCEL_ORG_ID;
	const provider = asString(raw.provider) || 'vercel';
	return {
		present: true,
		fields: {
			provider,
			orgId,
			projectId: asString(raw.projectId),
			projectName: asString(raw.projectName),
			productionUrl: asString(raw.productionUrl),
			productionBranch: asString(raw.productionBranch),
		},
	};
}

function localLinkStatus(localLink, deployment) {
	if (!localLink) return 'ABSENT';
	// projectName differences are ignored — only orgId + projectId matter.
	if (localLink.orgId === deployment.orgId && localLink.projectId === deployment.projectId) {
		return 'MATCH';
	}
	return 'MISMATCH';
}

/**
 * Minimal readiness check: site-spec exists, provider is vercel, projectId set.
 * Defaults empty orgId to the primary team. Does not gate on branch, URL, or projectName.
 */
export function checkDeploymentIdentity(options) {
	const rootDir = options.rootDir;
	const loaded = options.specFile ?? readSiteSpecDocument(rootDir);
	const currentBranch =
		options.currentBranch !== undefined
			? { branch: options.currentBranch, error: null }
			: options.readBranch
				? options.readBranch(rootDir)
				: readCurrentGitBranch(rootDir);
	const localLink =
		options.localLink !== undefined
			? options.localLink
			: options.readLink
				? options.readLink(rootDir)
				: readLocalVercelLink(rootDir);

	const base = {
		ok: false,
		blockedReason: null,
		extraLines: [],
		missingFields: [],
		siteName: '',
		siteUrl: '',
		deployment: null,
		currentBranch: currentBranch.branch || '',
		localLink,
		localLinkStatus: 'ABSENT',
		willRelink: false,
		checks: {
			specExists: 'FAIL',
			provider: 'FAIL',
			branch: 'SKIP',
			urlIdentity: 'SKIP',
			orgId: 'FAIL',
			projectId: 'FAIL',
			productionUrl: 'SKIP',
		},
	};

	if (loaded.missing) {
		return {
			...base,
			...blockedReason('site-spec.yaml not found'),
		};
	}
	if (loaded.parseError) {
		return {
			...base,
			...blockedReason('failed to parse site-spec.yaml'),
			extraLines: [loaded.parseError],
		};
	}

	base.checks.specExists = 'PASS';
	const document = loaded.document;
	const site = isRecord(document) && isRecord(document.site) ? document.site : {};
	const game = isRecord(document) && isRecord(document.game) ? document.game : {};
	base.siteName = asString(game.name) || asString(site.shortName) || asString(site.title);
	base.siteUrl = asString(site.siteUrl);

	const fields = extractDeployment(document).fields;
	base.deployment = fields;

	if (fields.provider !== 'vercel') {
		return {
			...base,
			...blockedReason('unsupported deployment provider'),
			extraLines: [`provider: ${fields.provider}`],
			checks: { ...base.checks, specExists: 'PASS', provider: 'FAIL' },
		};
	}
	base.checks.provider = 'PASS';
	base.checks.orgId = fields.orgId ? 'PASS' : 'FAIL';
	if (fields.productionUrl) {
		const productionUrlCheck = validateVercelOnlyProductionUrl(fields.productionUrl);
		if (!productionUrlCheck.ok && productionUrlCheck.reason.includes('absolute URL')) {
			return {
				...base,
				...blockedReason('invalid Vercel production identity'),
				extraLines: [productionUrlCheck.reason],
				checks: { ...base.checks, specExists: 'PASS', provider: 'PASS', orgId: base.checks.orgId, productionUrl: 'FAIL' },
			};
		}
		base.checks.productionUrl = productionUrlCheck.ok ? 'PASS' : 'WARN';
	}

	if (!fields.projectId) {
		return {
			...base,
			...blockedReason('incomplete deployment identity'),
			extraLines: ['Missing: projectId'],
			missingFields: ['projectId'],
			checks: {
				...base.checks,
				specExists: 'PASS',
				provider: 'PASS',
				orgId: base.checks.orgId,
				projectId: 'FAIL',
			},
		};
	}

	if (!fields.projectId.startsWith('prj_')) {
		return {
			...base,
			...blockedReason('invalid Vercel project id'),
			extraLines: ['projectId must start with prj_'],
			checks: {
				...base.checks,
				specExists: 'PASS',
				provider: 'PASS',
				orgId: 'PASS',
				projectId: 'FAIL',
			},
		};
	}

	const linkStatus = localLinkStatus(localLink, fields);
	return {
		...base,
		ok: true,
		blockedReason: null,
		extraLines: [],
		missingFields: [],
		localLinkStatus: linkStatus,
		willRelink: linkStatus !== 'MATCH',
		checks: {
			specExists: 'PASS',
			provider: 'PASS',
			branch: 'SKIP',
			urlIdentity: 'SKIP',
			orgId: 'PASS',
			projectId: 'PASS',
			productionUrl: base.checks.productionUrl,
		},
	};
}

export function formatBlocked(result) {
	const lines = ['DEPLOY BLOCKED'];
	if (result.extraLines.length > 0) {
		lines.push('');
		lines.push(...result.extraLines);
		lines.push('');
	}
	lines.push(`Reason: ${result.blockedReason}`);
	return lines.join('\n');
}

export function formatCheckReport(result) {
	const linkLabel =
		result.localLinkStatus === 'MATCH'
			? 'MATCH'
			: result.localLinkStatus === 'MISMATCH'
				? 'MISMATCH'
				: 'ABSENT';
	const lines = [
		'DEPLOYMENT IDENTITY CHECK',
		'',
		`site-spec: ${result.checks.specExists}`,
		`provider: ${result.checks.provider}`,
		`orgId: ${result.checks.orgId}`,
		`projectId: ${result.checks.projectId}`,
		`primary team: ${PRIMARY_VERCEL_TEAM_SLUG}`,
		`local .vercel link: ${linkLabel}`,
	];

	if (result.ok && result.localLinkStatus === 'MISMATCH') {
		lines.push('Will rewrite .vercel/project.json from site-spec.yaml during deploy.');
	} else if (result.ok && result.localLinkStatus === 'ABSENT') {
		lines.push('Will write .vercel/project.json from site-spec.yaml during deploy.');
	}

	if (result.deployment) {
		lines.push(
			'',
			'TARGET',
			'',
			'Project:',
			result.deployment.projectName || '(optional)',
			'',
			'Project ID:',
			result.deployment.projectId || '(missing)',
			'',
			'Org:',
			result.deployment.orgId || '(missing)',
			'',
			'Production:',
			result.deployment.productionUrl || '(optional)',
		);
	}

	lines.push('', 'RESULT:');
	if (result.ok) {
		lines.push('READY TO DEPLOY');
	} else {
		lines.push(formatBlocked(result));
	}
	return lines.join('\n');
}

export function formatTargetSummary(result) {
	return [
		'========================================',
		'PRODUCTION DEPLOY TARGET',
		'',
		'Site:',
		result.siteName,
		'',
		'Vercel Team:',
		PRIMARY_VERCEL_TEAM_SLUG,
		'',
		'Vercel Org:',
		result.deployment.orgId,
		'',
		'Vercel Project:',
		result.deployment.projectName || '(unnamed)',
		'',
		'Project ID:',
		result.deployment.projectId,
		'',
		'Production URL:',
		result.deployment.productionUrl || '(unset)',
		'========================================',
	].join('\n');
}

export function createVercelDeployEnv(deployment, baseEnv = process.env) {
	return {
		...baseEnv,
		VERCEL_ORG_ID: deployment.orgId || PRIMARY_VERCEL_ORG_ID,
		VERCEL_PROJECT_ID: deployment.projectId,
	};
}

function extractDeploymentUrl(output, fallback = '') {
	const lines = String(output || '').split(/\r?\n/);
	const preferred = lines.find((line) => /production|url/i.test(line) && /https?:\/\//i.test(line));
	const match = String(preferred || output || '').match(/https?:\/\/[^\s)]+/i);
	return (match?.[0] || fallback).replace(/[.,]+$/, '');
}

/**
 * Spawn Vercel's production deploy. The default preserves the low-level CLI's
 * inherited output; capture mode is used by the standard publisher so the
 * deployment URL can be written to the normalized receipt.
 */
export function spawnVercelDeploy(rootDir, deployment, options = {}) {
	const capture = Boolean(options.capture);
	return new Promise((resolve, reject) => {
		const stdout = [];
		const stderr = [];
		const child = spawn(
			'vercel',
			['deploy', '--prod', '--yes', '--scope', PRIMARY_VERCEL_TEAM_SLUG],
			{
				cwd: rootDir,
				env: createVercelDeployEnv(deployment),
				stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
			},
		);
		if (capture) {
			child.stdout.on('data', (chunk) => {
				const text = String(chunk);
				stdout.push(text);
				process.stdout.write(text);
			});
			child.stderr.on('data', (chunk) => {
				const text = String(chunk);
				stderr.push(text);
				process.stderr.write(text);
			});
		}
		child.on('error', (error) => {
			if (error && error.code === 'ENOENT') {
				if (capture) {
					resolve({ code: 1, output: '', error: 'DEPLOY BLOCKED\nReason: vercel CLI not found' });
					return;
				}
				reject(new Error('DEPLOY BLOCKED\nReason: vercel CLI not found'));
				return;
			}
			reject(error);
		});
		child.on('close', (code) => {
			if (!capture) {
				resolve(code ?? 1);
				return;
			}
			const output = `${stdout.join('')}\n${stderr.join('')}`.trim();
			resolve({
				code: code ?? 1,
				output,
				deploymentUrl: extractDeploymentUrl(output, deployment.productionUrl),
			});
		});
	});
}

export async function runDeployCli(options) {
	const rootDir = options.rootDir;
	const checkOnly = Boolean(options.checkOnly);
	const result = checkDeploymentIdentity(options);
	const log = options.log ?? console.log;
	const error = options.error ?? console.error;

	if (checkOnly) {
		log(formatCheckReport(result));
		return { code: result.ok ? 0 : 1, result, deployed: false, relinked: false, deployCalls: [] };
	}

	if (!result.ok) {
		error(formatBlocked(result));
		return { code: 1, result, deployed: false, relinked: false, deployCalls: [] };
	}

	log(formatTargetSummary(result));

	let relinked = false;
	if (result.localLinkStatus !== 'MATCH') {
		log(
			result.localLinkStatus === 'MISMATCH'
				? 'Local Vercel link: MISMATCH — rewriting .vercel/project.json from site-spec.yaml.'
				: 'Local Vercel link: ABSENT — writing .vercel/project.json from site-spec.yaml.',
		);
		writeLocalVercelLink(rootDir, result.deployment);
		const after = readLocalVercelLink(rootDir);
		if (!after || after.orgId !== result.deployment.orgId || after.projectId !== result.deployment.projectId) {
			error(
				[
					'DEPLOY BLOCKED',
					'',
					'Reason: failed to bind local Vercel link to site-spec project',
				].join('\n'),
			);
			return { code: 1, result, deployed: false, relinked: true, deployCalls: [] };
		}
		relinked = true;
	} else {
		log('Local Vercel link: MATCH');
	}

	const deployFn = options.deployFn ?? spawnVercelDeploy;
	const deployEnv = createVercelDeployEnv(result.deployment);
	const code = await deployFn(rootDir, result.deployment, deployEnv);
	return { code: code ?? 1, result, deployed: true, relinked, deployCalls: [{ env: deployEnv }] };
}
