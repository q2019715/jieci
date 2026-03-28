// background_js/sync.js - 管理本地数据与 chrome.storage.sync 的同步流程。

const SYNC_ENABLED_KEY = 'syncEnabled';
const SYNC_STATUS_KEY = 'syncStatus';
const SYNC_DIRTY_KEY = 'syncDirty';
const SYNC_LOCAL_META_KEY = 'syncLocalMeta';
const SYNC_DEVICE_ID_KEY = 'syncDeviceId';
const SYNC_CONFLICT_BACKUP_KEY = 'syncConflictBackup';

const SYNC_KEY_SETTINGS = 'jc_sync_settings';
const SYNC_KEY_BLOCKED_WORDS = 'jc_sync_blocked_words';
const SYNC_KEY_FAVORITE_WORDS = 'jc_sync_favorite_words';
const SYNC_KEY_SITE_BLOCK_RULES = 'jc_sync_site_block_rules';
const SYNC_KEY_META = 'jc_sync_meta';

const DOMAIN_SETTINGS = 'settings';
const DOMAIN_BLOCKED_WORDS = 'blockedWords';
const DOMAIN_FAVORITE_WORDS = 'favoriteWords';
const DOMAIN_SITE_BLOCK_RULES = 'siteBlockRules';
const SYNC_DOMAINS = [
    DOMAIN_SETTINGS,
    DOMAIN_BLOCKED_WORDS,
    DOMAIN_FAVORITE_WORDS,
    DOMAIN_SITE_BLOCK_RULES
];

const DOMAIN_TO_SYNC_KEY = {
    [DOMAIN_SETTINGS]: SYNC_KEY_SETTINGS,
    [DOMAIN_BLOCKED_WORDS]: SYNC_KEY_BLOCKED_WORDS,
    [DOMAIN_FAVORITE_WORDS]: SYNC_KEY_FAVORITE_WORDS,
    [DOMAIN_SITE_BLOCK_RULES]: SYNC_KEY_SITE_BLOCK_RULES
};

const SETTINGS_KEYS_FOR_SYNC = [
    'displayMode',
    'displayModeChinese',
    'displayModeEnglish',
    'displayModeSplitByLanguage',
    'maxMatchesPerNode',
    'minTextLength',
    'annotationMode',
    'cnToEnOrder',
    'enToCnOrder',
    'disableAnnotationUnderline',
    'annotationWordCardPopupEnabled',
    'wordCardHighlightMatchedChinese',
    'speechVoiceURI',
    'highlightColorMode',
    'highlightColor',
    'siteBlockMode',
    'smartSkipCodeLinks',
    'smartSkipEditableTextboxes',
    'searchProvider',
    'wordCardPopupSize',
    'phrasesExpanded',
    'examplesExpanded',
    'wordInfoPhrasesExpanded',
    'wordInfoExamplesExpanded',
    'dedupeMode',
    'dedupeRepeatCount',
    'dedupeCooldownSeconds',
    'dedupeGlobalState',
    'debugMode',
    'aiSimilarityThreshold',
    'aiProcessingDelay'
];

const LOCAL_DATA_KEYS = [
    ...SETTINGS_KEYS_FOR_SYNC,
    DOMAIN_BLOCKED_WORDS,
    DOMAIN_FAVORITE_WORDS,
    DOMAIN_SITE_BLOCK_RULES
];

const SYNC_STORAGE_KEYS = [
    SYNC_KEY_SETTINGS,
    SYNC_KEY_BLOCKED_WORDS,
    SYNC_KEY_FAVORITE_WORDS,
    SYNC_KEY_SITE_BLOCK_RULES,
    SYNC_KEY_META
];

const SETTING_KEY_SET = new Set(SETTINGS_KEYS_FOR_SYNC);
const WATCHED_LOCAL_KEYS = new Set(LOCAL_DATA_KEYS);
const MIN_AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const CONFLICT_BACKUP_RETENTION_MS = 24 * 60 * 60 * 1000;

let syncInFlight = false;
let applyingCloudPatch = false;

function nowISO() {
    return new Date().toISOString();
}

function nowMillis() {
    return Date.now();
}

function createDomainMeta() {
    return {
        updatedAt: 0,
        deviceId: ''
    };
}

function createDefaultDomainsMeta() {
    return {
        [DOMAIN_SETTINGS]: createDomainMeta(),
        [DOMAIN_BLOCKED_WORDS]: createDomainMeta(),
        [DOMAIN_FAVORITE_WORDS]: createDomainMeta(),
        [DOMAIN_SITE_BLOCK_RULES]: createDomainMeta()
    };
}

function normalizeTextArray(values) {
    if (!Array.isArray(values)) {
        return [];
    }
    const seen = new Set();
    const output = [];
    values.forEach((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        output.push(normalized);
    });
    return output;
}

function uniqueDomainList(domains) {
    if (!Array.isArray(domains)) {
        return [];
    }
    const seen = new Set();
    const result = [];
    domains.forEach((domain) => {
        const normalized = String(domain || '').trim();
        if (!SYNC_DOMAINS.includes(normalized) || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        result.push(normalized);
    });
    return result;
}

function normalizeDomainMeta(meta, fallbackDeviceId = '') {
    const normalized = createDomainMeta();
    if (meta && typeof meta === 'object') {
        const updatedAt = Number(meta.updatedAt);
        normalized.updatedAt = Number.isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : 0;
        normalized.deviceId = String(meta.deviceId || '').trim();
    }
    if (!normalized.deviceId && fallbackDeviceId) {
        normalized.deviceId = fallbackDeviceId;
    }
    return normalized;
}

function normalizeLocalMeta(meta, fallbackDeviceId = '') {
    const domains = createDefaultDomainsMeta();
    const sourceDomains = meta && typeof meta === 'object' && meta.domains && typeof meta.domains === 'object'
        ? meta.domains
        : {};
    SYNC_DOMAINS.forEach((domain) => {
        domains[domain] = normalizeDomainMeta(sourceDomains[domain], fallbackDeviceId);
    });
    return {domains};
}

function normalizeCloudMeta(meta, fallbackDeviceId = '') {
    const domains = createDefaultDomainsMeta();
    const sourceDomains = meta && typeof meta === 'object' && meta.domains && typeof meta.domains === 'object'
        ? meta.domains
        : {};
    SYNC_DOMAINS.forEach((domain) => {
        domains[domain] = normalizeDomainMeta(sourceDomains[domain], fallbackDeviceId);
    });
    return {domains};
}

function cloneMeta(meta) {
    return JSON.parse(JSON.stringify(meta));
}

function buildSettingsPayload(localData) {
    const settings = {};
    SETTINGS_KEYS_FOR_SYNC.forEach((key) => {
        if (localData[key] !== undefined) {
            settings[key] = localData[key];
        }
    });
    return settings;
}

function buildCloudPayload(localData, localMeta) {
    return {
        [SYNC_KEY_SETTINGS]: buildSettingsPayload(localData),
        [SYNC_KEY_BLOCKED_WORDS]: normalizeTextArray(localData[DOMAIN_BLOCKED_WORDS]),
        [SYNC_KEY_FAVORITE_WORDS]: normalizeTextArray(localData[DOMAIN_FAVORITE_WORDS]),
        [SYNC_KEY_SITE_BLOCK_RULES]: normalizeTextArray(localData[DOMAIN_SITE_BLOCK_RULES]),
        [SYNC_KEY_META]: {
            version: 2,
            updatedAt: nowMillis(),
            domains: localMeta.domains
        }
    };
}

function resolveDomainByLocalKey(key) {
    if (SETTING_KEY_SET.has(key)) {
        return DOMAIN_SETTINGS;
    }
    if (key === DOMAIN_BLOCKED_WORDS) {
        return DOMAIN_BLOCKED_WORDS;
    }
    if (key === DOMAIN_FAVORITE_WORDS) {
        return DOMAIN_FAVORITE_WORDS;
    }
    if (key === DOMAIN_SITE_BLOCK_RULES) {
        return DOMAIN_SITE_BLOCK_RULES;
    }
    return '';
}

function pickLocalDomainData(localData, domain) {
    if (domain === DOMAIN_SETTINGS) {
        return buildSettingsPayload(localData);
    }
    if (domain === DOMAIN_BLOCKED_WORDS) {
        return normalizeTextArray(localData[DOMAIN_BLOCKED_WORDS]);
    }
    if (domain === DOMAIN_FAVORITE_WORDS) {
        return normalizeTextArray(localData[DOMAIN_FAVORITE_WORDS]);
    }
    if (domain === DOMAIN_SITE_BLOCK_RULES) {
        return normalizeTextArray(localData[DOMAIN_SITE_BLOCK_RULES]);
    }
    return null;
}

function pickCloudDomainData(syncData, domain) {
    const syncKey = DOMAIN_TO_SYNC_KEY[domain];
    const raw = syncData ? syncData[syncKey] : null;
    if (domain === DOMAIN_SETTINGS) {
        return raw && typeof raw === 'object' ? raw : {};
    }
    return normalizeTextArray(raw);
}

function buildDomainSnapshot(sourceData, pickFn, domains) {
    const snapshot = {};
    uniqueDomainList(domains).forEach((domain) => {
        snapshot[domain] = pickFn(sourceData, domain);
    });
    return snapshot;
}

function normalizeConflictBackup(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const capturedAt = Number(raw.capturedAt);
    const expiresAt = Number(raw.expiresAt);
    if (!Number.isFinite(capturedAt) || capturedAt <= 0 || !Number.isFinite(expiresAt) || expiresAt <= 0) {
        return null;
    }
    const domains = uniqueDomainList(raw.domains);
    return {
        capturedAt: Math.floor(capturedAt),
        expiresAt: Math.floor(expiresAt),
        firstReason: String(raw.firstReason || ''),
        lastReason: String(raw.lastReason || ''),
        lastConflictAt: Number(raw.lastConflictAt) > 0 ? Math.floor(Number(raw.lastConflictAt)) : Math.floor(capturedAt),
        conflictCount: Math.max(1, Number(raw.conflictCount) || 1),
        domains,
        localBefore: raw.localBefore && typeof raw.localBefore === 'object' ? raw.localBefore : {},
        localMetaBefore: raw.localMetaBefore && typeof raw.localMetaBefore === 'object' ? raw.localMetaBefore : {},
        cloudIncoming: raw.cloudIncoming && typeof raw.cloudIncoming === 'object' ? raw.cloudIncoming : {}
    };
}

function buildConflictBackupSummary(raw) {
    const backup = normalizeConflictBackup(raw);
    if (!backup) {
        return {
            exists: false
        };
    }
    const now = nowMillis();
    const remainingMs = Math.max(0, backup.expiresAt - now);
    return {
        exists: true,
        active: backup.expiresAt > now,
        capturedAt: new Date(backup.capturedAt).toISOString(),
        expiresAt: new Date(backup.expiresAt).toISOString(),
        lastConflictAt: new Date(backup.lastConflictAt).toISOString(),
        conflictCount: backup.conflictCount,
        domains: backup.domains,
        remainingMs
    };
}

async function maybeCaptureConflictBackup({
                                              reason,
                                              conflictDomains,
                                              localData,
                                              localMeta,
                                              cloudData
                                          }) {
    const domains = uniqueDomainList(conflictDomains);
    if (domains.length === 0) {
        return;
    }
    const result = await chrome.storage.local.get([SYNC_CONFLICT_BACKUP_KEY]);
    const current = normalizeConflictBackup(result[SYNC_CONFLICT_BACKUP_KEY]);
    const now = nowMillis();

    if (current && current.expiresAt > now) {
        const existingDomains = uniqueDomainList(current.domains);
        const missingDomains = domains.filter((domain) => !existingDomains.includes(domain));
        const mergedLocalBefore = {
            ...current.localBefore
        };
        const mergedCloudIncoming = {
            ...current.cloudIncoming
        };
        if (missingDomains.length > 0) {
            const missingLocalBefore = buildDomainSnapshot(localData, pickLocalDomainData, missingDomains);
            const missingCloudIncoming = buildDomainSnapshot(cloudData, pickCloudDomainData, missingDomains);
            Object.assign(mergedLocalBefore, missingLocalBefore);
            Object.assign(mergedCloudIncoming, missingCloudIncoming);
        }
        const nextDomains = uniqueDomainList([
            ...existingDomains,
            ...domains
        ]);
        await chrome.storage.local.set({
            [SYNC_CONFLICT_BACKUP_KEY]: {
                ...current,
                domains: nextDomains,
                localBefore: mergedLocalBefore,
                cloudIncoming: mergedCloudIncoming,
                lastReason: String(reason || ''),
                lastConflictAt: now,
                conflictCount: current.conflictCount + 1
            }
        });
        return;
    }

    const localBefore = buildDomainSnapshot(localData, pickLocalDomainData, domains);
    const cloudIncoming = buildDomainSnapshot(cloudData, pickCloudDomainData, domains);
    await chrome.storage.local.set({
        [SYNC_CONFLICT_BACKUP_KEY]: {
            capturedAt: now,
            expiresAt: now + CONFLICT_BACKUP_RETENTION_MS,
            firstReason: String(reason || ''),
            lastReason: String(reason || ''),
            lastConflictAt: now,
            conflictCount: 1,
            domains,
            localBefore,
            localMetaBefore: localMeta,
            cloudIncoming
        }
    });
}

function applyCloudDomainToLocalPatch(localPatch, domain, value) {
    if (domain === DOMAIN_SETTINGS) {
        const settings = value && typeof value === 'object' ? value : {};
        SETTINGS_KEYS_FOR_SYNC.forEach((key) => {
            if (settings[key] !== undefined) {
                localPatch[key] = settings[key];
            }
        });
        return;
    }
    localPatch[domain] = normalizeTextArray(value);
}

function applyLocalDomainToCloudPatch(cloudPatch, domain, value) {
    const syncKey = DOMAIN_TO_SYNC_KEY[domain];
    if (domain === DOMAIN_SETTINGS) {
        cloudPatch[syncKey] = value && typeof value === 'object' ? value : {};
        return;
    }
    cloudPatch[syncKey] = normalizeTextArray(value);
}

function compareDomainMeta(localMeta, cloudMeta) {
    const localTime = Number(localMeta && localMeta.updatedAt) || 0;
    const cloudTime = Number(cloudMeta && cloudMeta.updatedAt) || 0;
    if (localTime > cloudTime) {
        return 1;
    }
    if (localTime < cloudTime) {
        return -1;
    }
    const localDevice = String(localMeta && localMeta.deviceId || '');
    const cloudDevice = String(cloudMeta && cloudMeta.deviceId || '');
    if (localDevice === cloudDevice) {
        return 0;
    }
    // 时间相同的时候用 deviceId 做稳定裁决，避免来回覆盖。
    return localDevice > cloudDevice ? 1 : -1;
}

async function getOrCreateDeviceId(existingDeviceId = '') {
    const known = String(existingDeviceId || '').trim();
    if (known) {
        return known;
    }
    const next = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    await chrome.storage.local.set({[SYNC_DEVICE_ID_KEY]: next});
    return next;
}

async function markSyncDirty(value) {
    await chrome.storage.local.set({[SYNC_DIRTY_KEY]: value === true});
}

async function writeSyncStatus(partial) {
    const result = await chrome.storage.local.get([SYNC_STATUS_KEY]);
    const prev = result[SYNC_STATUS_KEY] && typeof result[SYNC_STATUS_KEY] === 'object'
        ? result[SYNC_STATUS_KEY]
        : {};
    const next = {
        ...prev,
        ...partial
    };
    await chrome.storage.local.set({[SYNC_STATUS_KEY]: next});
    return next;
}

async function setSyncSuccess(reason, usageBytes) {
    await markSyncDirty(false);
    return writeSyncStatus({
        lastSyncAt: nowISO(),
        lastSyncStatus: 'success',
        lastReason: reason,
        lastError: '',
        lastUsageBytes: Number(usageBytes) || 0
    });
}

async function setSyncError(reason, error) {
    return writeSyncStatus({
        lastSyncAt: nowISO(),
        lastSyncStatus: 'error',
        lastReason: reason,
        lastError: error && error.message ? error.message : String(error || 'unknown')
    });
}

async function getSyncFlags() {
    const result = await chrome.storage.local.get([SYNC_ENABLED_KEY, SYNC_DIRTY_KEY, SYNC_STATUS_KEY]);
    return {
        enabled: result[SYNC_ENABLED_KEY] === true,
        dirty: result[SYNC_DIRTY_KEY] === true,
        status: result[SYNC_STATUS_KEY] && typeof result[SYNC_STATUS_KEY] === 'object'
            ? result[SYNC_STATUS_KEY]
            : {}
    };
}

function canRunAutoSyncByInterval(lastAutoSyncAt) {
    if (!lastAutoSyncAt) {
        return true;
    }
    const last = Date.parse(lastAutoSyncAt);
    if (!Number.isFinite(last)) {
        return true;
    }
    return (Date.now() - last) >= MIN_AUTO_SYNC_INTERVAL_MS;
}

async function guardedSyncOperation(operation) {
    if (syncInFlight) {
        return {ok: false, error: 'sync-busy'};
    }
    syncInFlight = true;
    try {
        return await operation();
    } finally {
        syncInFlight = false;
    }
}

async function runDomainLevelAutoMergeSync(reason = 'auto') {
    return guardedSyncOperation(async () => {
        try {
            const localSnapshot = await chrome.storage.local.get([
                ...LOCAL_DATA_KEYS,
                SYNC_LOCAL_META_KEY,
                SYNC_DEVICE_ID_KEY
            ]);
            const deviceId = await getOrCreateDeviceId(localSnapshot[SYNC_DEVICE_ID_KEY]);
            const localMeta = normalizeLocalMeta(localSnapshot[SYNC_LOCAL_META_KEY], deviceId);
            const syncData = await chrome.storage.sync.get(SYNC_STORAGE_KEYS);
            const cloudMeta = normalizeCloudMeta(syncData[SYNC_KEY_META], deviceId);

            const nextLocalMeta = cloneMeta(localMeta);
            const nextCloudMeta = cloneMeta(cloudMeta);
            const localPatch = {};
            const cloudPatch = {};
            const localConflictDomains = [];
            let localChanged = false;
            let cloudChanged = false;

            SYNC_DOMAINS.forEach((domain) => {
                const localDomainMeta = normalizeDomainMeta(localMeta.domains[domain], deviceId);
                const cloudDomainMeta = normalizeDomainMeta(cloudMeta.domains[domain], deviceId);
                const winner = compareDomainMeta(localDomainMeta, cloudDomainMeta);

                if (winner > 0) {
                    const localValue = pickLocalDomainData(localSnapshot, domain);
                    applyLocalDomainToCloudPatch(cloudPatch, domain, localValue);
                    nextCloudMeta.domains[domain] = {
                        updatedAt: localDomainMeta.updatedAt,
                        deviceId: localDomainMeta.deviceId || deviceId
                    };
                    cloudChanged = true;
                    return;
                }

                if (winner < 0) {
                    const cloudValue = pickCloudDomainData(syncData, domain);
                    applyCloudDomainToLocalPatch(localPatch, domain, cloudValue);
                    nextLocalMeta.domains[domain] = {
                        updatedAt: cloudDomainMeta.updatedAt,
                        deviceId: cloudDomainMeta.deviceId || deviceId
                    };
                    localConflictDomains.push(domain);
                    localChanged = true;
                }
            });

            if (cloudChanged) {
                cloudPatch[SYNC_KEY_META] = {
                    version: 2,
                    updatedAt: nowMillis(),
                    domains: nextCloudMeta.domains
                };
                await chrome.storage.sync.set(cloudPatch);
            }

            if (localChanged) {
                await maybeCaptureConflictBackup({
                    reason,
                    conflictDomains: localConflictDomains,
                    localData: localSnapshot,
                    localMeta,
                    cloudData: syncData
                });
                localPatch[SYNC_LOCAL_META_KEY] = nextLocalMeta;
                applyingCloudPatch = true;
                await chrome.storage.local.set(localPatch);
                applyingCloudPatch = false;
            } else {
                await chrome.storage.local.set({[SYNC_LOCAL_META_KEY]: nextLocalMeta});
            }

            const usageBytes = await chrome.storage.sync.getBytesInUse(null);
            const status = await setSyncSuccess(reason, usageBytes);
            await writeSyncStatus({lastAutoSyncAt: nowISO()});
            return {ok: true, usageBytes, status};
        } catch (error) {
            applyingCloudPatch = false;
            const status = await setSyncError(reason, error);
            return {ok: false, error: String(error), status};
        }
    });
}

async function triggerGuardedAutoSync(reason) {
    const {enabled, dirty, status} = await getSyncFlags();
    if (!enabled || !dirty) {
        return {ok: false, skipped: true, reason: !enabled ? 'sync-disabled' : 'not-dirty'};
    }
    const lastAutoSyncAt = status && status.lastAutoSyncAt ? status.lastAutoSyncAt : '';
    if (!canRunAutoSyncByInterval(lastAutoSyncAt)) {
        return {ok: false, skipped: true, reason: 'interval-not-reached'};
    }
    return runDomainLevelAutoMergeSync(reason);
}

export function handleLocalStorageChangedForSync(changes, namespace) {
    if (namespace !== 'local' || !changes) {
        return;
    }
    if (applyingCloudPatch) {
        return;
    }
    const changedKeys = Object.keys(changes);
    if (!changedKeys.some((key) => WATCHED_LOCAL_KEYS.has(key))) {
        return;
    }
    getSyncFlags().then(async ({enabled}) => {
        if (!enabled) {
            return;
        }
        const identity = await chrome.storage.local.get([SYNC_LOCAL_META_KEY, SYNC_DEVICE_ID_KEY]);
        const deviceId = await getOrCreateDeviceId(identity[SYNC_DEVICE_ID_KEY]);
        const localMeta = normalizeLocalMeta(identity[SYNC_LOCAL_META_KEY], deviceId);
        const ts = nowMillis();

        changedKeys.forEach((key) => {
            const domain = resolveDomainByLocalKey(key);
            if (!domain) {
                return;
            }
            localMeta.domains[domain] = {
                updatedAt: ts,
                deviceId
            };
        });

        await chrome.storage.local.set({
            [SYNC_LOCAL_META_KEY]: localMeta,
            [SYNC_DIRTY_KEY]: true
        });
        await triggerGuardedAutoSync('local-change');
    }).catch(() => {
        // ignore
    });
}

export async function pushLocalDataToSync(reason = 'manual') {
    return guardedSyncOperation(async () => {
        return pushLocalDataToSyncCore(reason, false);
    });
}

async function pushLocalDataToSyncCore(reason = 'manual', allowWhenDisabled = false) {
    try {
        const flags = await getSyncFlags();
        if (!flags.enabled && !allowWhenDisabled && reason !== 'manual-force') {
            return {ok: false, skipped: true, reason: 'sync-disabled'};
        }
        const localData = await chrome.storage.local.get([
            ...LOCAL_DATA_KEYS,
            SYNC_LOCAL_META_KEY,
            SYNC_DEVICE_ID_KEY
        ]);
        const deviceId = await getOrCreateDeviceId(localData[SYNC_DEVICE_ID_KEY]);
        const localMeta = normalizeLocalMeta(localData[SYNC_LOCAL_META_KEY], deviceId);
        const touchedAt = nowMillis();
        SYNC_DOMAINS.forEach((domain) => {
            const meta = normalizeDomainMeta(localMeta.domains[domain], deviceId);
            if (!meta.updatedAt) {
                localMeta.domains[domain] = {
                    updatedAt: touchedAt,
                    deviceId
                };
            }
        });

        const payload = buildCloudPayload(localData, localMeta);
        await chrome.storage.sync.set(payload);
        await chrome.storage.local.set({[SYNC_LOCAL_META_KEY]: localMeta});
        const usageBytes = await chrome.storage.sync.getBytesInUse(null);
        const status = await setSyncSuccess(reason, usageBytes);
        return {ok: true, usageBytes, status};
    } catch (error) {
        const status = await setSyncError(reason, error);
        return {ok: false, error: String(error), status};
    }
}

export async function pullSyncDataToLocal(reason = 'manual-pull') {
    return guardedSyncOperation(async () => {
        try {
            const flags = await getSyncFlags();
            if (!flags.enabled && reason !== 'manual-force') {
                return {ok: false, skipped: true, reason: 'sync-disabled'};
            }

            const localSnapshot = await chrome.storage.local.get([
                ...LOCAL_DATA_KEYS,
                SYNC_LOCAL_META_KEY,
                SYNC_DEVICE_ID_KEY
            ]);
            const deviceId = await getOrCreateDeviceId(localSnapshot[SYNC_DEVICE_ID_KEY]);
            const syncData = await chrome.storage.sync.get(SYNC_STORAGE_KEYS);
            const cloudMeta = normalizeCloudMeta(syncData[SYNC_KEY_META], deviceId);
            const localMeta = normalizeLocalMeta(localSnapshot[SYNC_LOCAL_META_KEY], deviceId);
            const localPatch = {};

            await maybeCaptureConflictBackup({
                reason,
                conflictDomains: SYNC_DOMAINS,
                localData: localSnapshot,
                localMeta,
                cloudData: syncData
            });

            applyCloudDomainToLocalPatch(localPatch, DOMAIN_SETTINGS, pickCloudDomainData(syncData, DOMAIN_SETTINGS));
            applyCloudDomainToLocalPatch(localPatch, DOMAIN_BLOCKED_WORDS, pickCloudDomainData(syncData, DOMAIN_BLOCKED_WORDS));
            applyCloudDomainToLocalPatch(localPatch, DOMAIN_FAVORITE_WORDS, pickCloudDomainData(syncData, DOMAIN_FAVORITE_WORDS));
            applyCloudDomainToLocalPatch(localPatch, DOMAIN_SITE_BLOCK_RULES, pickCloudDomainData(syncData, DOMAIN_SITE_BLOCK_RULES));
            localPatch[SYNC_LOCAL_META_KEY] = cloudMeta;

            applyingCloudPatch = true;
            await chrome.storage.local.set(localPatch);
            applyingCloudPatch = false;

            const usageBytes = await chrome.storage.sync.getBytesInUse(null);
            const status = await setSyncSuccess(reason, usageBytes);
            return {ok: true, usageBytes, status};
        } catch (error) {
            applyingCloudPatch = false;
            const status = await setSyncError(reason, error);
            return {ok: false, error: String(error), status};
        }
    });
}

export async function setSyncEnabled(enabled) {
    const nextEnabled = enabled === true;
    await chrome.storage.local.set({[SYNC_ENABLED_KEY]: nextEnabled});
    if (nextEnabled) {
        await markSyncDirty(true);
        triggerGuardedAutoSync('sync-enabled').catch(() => {
            // ignore
        });
    }
    return {ok: true, enabled: nextEnabled};
}

export async function restoreSyncConflictBackup(reason = 'manual-restore') {
    return guardedSyncOperation(async () => {
        try {
            const result = await chrome.storage.local.get([
                SYNC_CONFLICT_BACKUP_KEY,
                SYNC_LOCAL_META_KEY,
                SYNC_DEVICE_ID_KEY
            ]);
            const backup = normalizeConflictBackup(result[SYNC_CONFLICT_BACKUP_KEY]);
            if (!backup) {
                return {ok: false, error: 'no-conflict-backup'};
            }
            const deviceId = await getOrCreateDeviceId(result[SYNC_DEVICE_ID_KEY]);
            const localMeta = normalizeLocalMeta(result[SYNC_LOCAL_META_KEY], deviceId);
            const restoredDomains = uniqueDomainList(backup.domains);
            if (restoredDomains.length === 0) {
                return {ok: false, error: 'empty-backup-domains'};
            }

            const ts = nowMillis();
            const localPatch = {
                [SYNC_DIRTY_KEY]: true
            };
            restoredDomains.forEach((domain) => {
                const domainValue = backup.localBefore ? backup.localBefore[domain] : null;
                applyCloudDomainToLocalPatch(localPatch, domain, domainValue);
                localMeta.domains[domain] = {
                    updatedAt: ts,
                    deviceId
                };
            });
            localPatch[SYNC_LOCAL_META_KEY] = localMeta;

            applyingCloudPatch = true;
            await chrome.storage.local.set(localPatch);
            applyingCloudPatch = false;
            const pushResult = await pushLocalDataToSyncCore(reason, true);
            return {
                ok: pushResult.ok === true,
                restoredDomains,
                pushResult
            };
        } catch (error) {
            applyingCloudPatch = false;
            const status = await setSyncError(reason, error);
            return {ok: false, error: String(error), status};
        }
    });
}

async function getSyncUsageBreakdown() {
    const byKey = {};
    await Promise.all(SYNC_STORAGE_KEYS.map(async (key) => {
        byKey[key] = await chrome.storage.sync.getBytesInUse(key);
    }));
    const total = await chrome.storage.sync.getBytesInUse(null);
    return {
        totalBytes: total,
        byKey,
        quotaBytes: chrome.storage.sync.QUOTA_BYTES,
        quotaBytesPerItem: chrome.storage.sync.QUOTA_BYTES_PER_ITEM,
        maxItems: chrome.storage.sync.MAX_ITEMS
    };
}

export async function getSyncOverview() {
    const result = await chrome.storage.local.get([
        SYNC_ENABLED_KEY,
        SYNC_STATUS_KEY,
        SYNC_DIRTY_KEY,
        SYNC_CONFLICT_BACKUP_KEY
    ]);
    const usage = await getSyncUsageBreakdown();
    return {
        enabled: result[SYNC_ENABLED_KEY] === true,
        dirty: result[SYNC_DIRTY_KEY] === true,
        status: result[SYNC_STATUS_KEY] || null,
        usage,
        conflictBackup: buildConflictBackupSummary(result[SYNC_CONFLICT_BACKUP_KEY])
    };
}

export function triggerStartupSync() {
    triggerGuardedAutoSync('worker-start').catch(() => {
        // ignore
    });
}
