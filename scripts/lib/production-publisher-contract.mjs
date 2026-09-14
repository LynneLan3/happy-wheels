/**
 * Machine-readable Production publisher contract marker.
 *
 * game-wiki-starter is the unique source of truth for the shared publisher.
 * Repo capability (this marker + required files/scripts) is authoritative —
 * do not add registry fields such as publisher_migrated.
 *
 * version history:
 *   1 — original Hotword OS Publishing Completion (deploy + IndexNow + Ledger)
 *   2 — adds indexingSync consumer + GSC Manual Request Indexing reporting
 */
export const PRODUCTION_PUBLISHER_CONTRACT = Object.freeze({
	id: 'hotword-production-publisher',
	version: 2,
});

export const PRODUCTION_PUBLISHER_CONTRACT_ID = PRODUCTION_PUBLISHER_CONTRACT.id;
export const PRODUCTION_PUBLISHER_CONTRACT_VERSION = PRODUCTION_PUBLISHER_CONTRACT.version;
