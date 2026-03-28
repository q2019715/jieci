/**
 * 文件说明：sync 模块初始化入口。
 * 职责：管理数据同步设置页的渲染、状态刷新与用户交互。
 */
import { bindSyncEvents } from './bind.js';
import {
    requestSyncConflictRestore,
    requestSyncOverview,
    requestSyncPullNow,
    requestSyncPushNow,
    requestSyncToggle
} from './service.js';

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) {
        return `${value} B`;
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(2)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSyncStatus(status) {
    const safeStatus = status && typeof status === 'object' ? status : {};
    const rawReason = String(safeStatus.lastReason || '').trim();
    let reasonText = '-';
    if (rawReason === 'manual') {
        reasonText = '手动同步';
    } else if (rawReason === 'manual-pull') {
        reasonText = '手动拉取云端配置';
    } else if (rawReason === 'manual-restore') {
        reasonText = '手动恢复云端配置';
    } else if (rawReason === 'local-change' || rawReason === 'sync-enabled' || rawReason === 'worker-start') {
        reasonText = '自动同步';
    } else if (rawReason) {
        reasonText = rawReason;
    }

    let timeText = '-';
    const rawTime = String(safeStatus.lastSyncAt || '').trim();
    if (rawTime) {
        const parsed = new Date(rawTime);
        if (!Number.isNaN(parsed.getTime())) {
            timeText = parsed.toLocaleString('zh-CN', {
                hour12: false,
                timeZoneName: 'short'
            });
        }
    }
    return `上次同步模式：${reasonText}\n上次同步时间：${timeText}`;
}

function safePercent(value, total) {
    const safeTotal = Math.max(1, Number(total) || 0);
    const safeValue = Math.max(0, Number(value) || 0);
    return Math.max(0, Math.min(100, Math.round((safeValue / safeTotal) * 100)));
}

function formatConflictBackupStatus(backup) {
    const info = backup && typeof backup === 'object' ? backup : {};
    if (info.exists !== true) {
        return '当前没有可用的冲突备份。';
    }
    const domains = Array.isArray(info.domains) && info.domains.length > 0 ? info.domains.join('、') : '-';
    const capturedAt = info.capturedAt ? new Date(info.capturedAt) : null;
    const expiresAt = info.expiresAt ? new Date(info.expiresAt) : null;
    const capturedText = capturedAt && !Number.isNaN(capturedAt.getTime())
        ? capturedAt.toLocaleString('zh-CN', { hour12: false, timeZoneName: 'short' })
        : '-';
    const expiresText = expiresAt && !Number.isNaN(expiresAt.getTime())
        ? expiresAt.toLocaleString('zh-CN', { hour12: false, timeZoneName: 'short' })
        : '-';
    const count = Math.max(1, Number(info.conflictCount) || 1);
    const activeText = info.active === true ? '是' : '否';
    return `冲突备份可用：${activeText}\n首次备份时间：${capturedText}\n过期时间：${expiresText}\n冲突次数：${count}\n影响范围：${domains}`;
}

function formatNoRestorableBackupMessage() {
    return '暂无可恢复备份';
}

/**
 * 初始化同步设置功能。
 */
export function initSyncFeature({
    elements,
    actions
}) {
    const {
        pageSync,
        syncEnabledToggle,
        syncAdvancedOptions,
        syncStatusText,
        syncUsageSettingsText,
        syncUsageBlockedText,
        syncUsageFavoritesText,
        syncUsageSiteRulesText,
        syncUsageSettingsBar,
        syncUsageBlockedBar,
        syncUsageFavoritesBar,
        syncUsageSiteRulesBar,
        syncPushNowBtn,
        syncPullNowBtn,
        syncConflictEntryBtn,
        syncConflictModal,
        syncConflictModalClose,
        syncConflictCancelBtn,
        syncConflictRestoreBtn,
        syncConflictStatusText,
        syncEnableConfirmModal,
        syncEnableConfirmModalClose,
        syncEnableConfirmCancelBtn,
        syncEnableConfirmAcceptBtn,
        syncEnableConfirmChecks
    } = elements;
    const {
        showPage,
        pageMain,
        pageAdvanced
    } = actions;

    let busy = false;
    let syncEnabled = false;
    let entrySource = 'advanced';
    let confirmResolver = null;
    let latestConflictBackup = null;
    let enableConfirmFeedbackTimer = null;
    const defaultEnableConfirmAcceptText = syncEnableConfirmAcceptBtn
        ? (String(syncEnableConfirmAcceptBtn.textContent || '').trim() || '确认启用')
        : '确认启用';
    const defaultConflictRestoreBtnText = syncConflictRestoreBtn
        ? (String(syncConflictRestoreBtn.textContent || '').trim() || '恢复上次冲突前数据')
        : '恢复上次冲突前数据';

    function setBusy(nextBusy) {
        busy = nextBusy === true;
        const disabled = busy || !syncEnabled;
        if (syncPushNowBtn) {
            syncPushNowBtn.disabled = disabled;
        }
        if (syncPullNowBtn) {
            syncPullNowBtn.disabled = disabled;
        }
        if (syncEnabledToggle) {
            syncEnabledToggle.disabled = busy;
        }
    }

    function setAdvancedOptionsVisible(visible) {
        if (!syncAdvancedOptions) {
            return;
        }
        syncAdvancedOptions.style.display = visible ? 'block' : 'none';
    }

    function setConflictRestoreEnabled(enabled) {
        if (!syncConflictRestoreBtn) {
            return;
        }
        syncConflictRestoreBtn.disabled = enabled !== true;
    }

    function renderConflictRestoreButtonText() {
        if (!syncConflictRestoreBtn) {
            return;
        }
        syncConflictRestoreBtn.textContent = defaultConflictRestoreBtnText;
    }

    function openConflictModal() {
        if (!syncConflictModal) {
            return;
        }
        syncConflictModal.classList.add('show');
        if (document && document.body) {
            document.body.classList.add('sync-confirm-open');
        }
    }

    function closeConflictModal() {
        if (!syncConflictModal) {
            return;
        }
        syncConflictModal.classList.remove('show');
        if (document && document.body) {
            document.body.classList.remove('sync-confirm-open');
        }
    }

    function renderConflictBackupStatus() {
        if (!syncConflictStatusText) {
            return;
        }
        syncConflictStatusText.textContent = formatConflictBackupStatus(latestConflictBackup);
        renderConflictRestoreButtonText();
        setConflictRestoreEnabled(true);
    }

    function setEnableConfirmButtonState() {
        const allChecked = Array.isArray(syncEnableConfirmChecks)
            && syncEnableConfirmChecks.length > 0
            && syncEnableConfirmChecks.every((checkbox) => checkbox && checkbox.checked === true);
        if (syncEnableConfirmAcceptBtn) {
            syncEnableConfirmAcceptBtn.setAttribute('aria-disabled', allChecked ? 'false' : 'true');
        }
        return allChecked;
    }

    function clearEnableConfirmFeedbackTimer() {
        if (enableConfirmFeedbackTimer === null) {
            return;
        }
        clearTimeout(enableConfirmFeedbackTimer);
        enableConfirmFeedbackTimer = null;
    }

    function resetEnableConfirmAcceptButtonText() {
        if (!syncEnableConfirmAcceptBtn) {
            return;
        }
        clearEnableConfirmFeedbackTimer();
        syncEnableConfirmAcceptBtn.textContent = defaultEnableConfirmAcceptText;
    }

    function showEnableConfirmButtonValidation() {
        if (!syncEnableConfirmAcceptBtn) {
            return;
        }
        clearEnableConfirmFeedbackTimer();
        syncEnableConfirmAcceptBtn.textContent = '请勾选所有选项';
        enableConfirmFeedbackTimer = setTimeout(() => {
            syncEnableConfirmAcceptBtn.textContent = defaultEnableConfirmAcceptText;
            enableConfirmFeedbackTimer = null;
        }, 3000);
    }

    function resetEnableConfirmChecks() {
        if (!Array.isArray(syncEnableConfirmChecks)) {
            return;
        }
        syncEnableConfirmChecks.forEach((checkbox) => {
            if (checkbox) {
                checkbox.checked = false;
            }
        });
        setEnableConfirmButtonState();
        resetEnableConfirmAcceptButtonText();
    }

    function closeEnableConfirmModal() {
        if (syncEnableConfirmModal) {
            syncEnableConfirmModal.classList.remove('show');
        }
        if (document && document.body) {
            document.body.classList.remove('sync-confirm-open');
        }
        resetEnableConfirmAcceptButtonText();
    }

    function resolveEnableConfirm(result) {
        if (typeof confirmResolver === 'function') {
            const resolver = confirmResolver;
            confirmResolver = null;
            resolver(result === true);
        }
    }

    function bindEnableConfirmModalEvents() {
        if (Array.isArray(syncEnableConfirmChecks)) {
            syncEnableConfirmChecks.forEach((checkbox) => {
                if (!checkbox) {
                    return;
                }
                checkbox.addEventListener('change', () => {
                    const allChecked = setEnableConfirmButtonState();
                    if (allChecked) {
                        resetEnableConfirmAcceptButtonText();
                    }
                });
            });
        }
        if (syncEnableConfirmModalClose) {
            syncEnableConfirmModalClose.addEventListener('click', () => {
                closeEnableConfirmModal();
                resolveEnableConfirm(false);
            });
        }
        if (syncEnableConfirmCancelBtn) {
            syncEnableConfirmCancelBtn.addEventListener('click', () => {
                closeEnableConfirmModal();
                resolveEnableConfirm(false);
            });
        }
        if (syncEnableConfirmAcceptBtn) {
            syncEnableConfirmAcceptBtn.addEventListener('click', () => {
                const allChecked = setEnableConfirmButtonState();
                if (!allChecked) {
                    showEnableConfirmButtonValidation();
                    return;
                }
                resetEnableConfirmAcceptButtonText();
                closeEnableConfirmModal();
                resolveEnableConfirm(true);
            });
        }
        if (syncEnableConfirmModal) {
            syncEnableConfirmModal.addEventListener('click', (event) => {
                if (event.target === syncEnableConfirmModal) {
                    closeEnableConfirmModal();
                    resolveEnableConfirm(false);
                }
            });
        }
    }

    async function confirmEnableSyncBeforeToggle() {
        if (!syncEnableConfirmModal) {
            return true;
        }
        if (confirmResolver) {
            return false;
        }
        resetEnableConfirmChecks();
        if (document && document.body) {
            document.body.classList.add('sync-confirm-open');
        }
        syncEnableConfirmModal.classList.add('show');
        return new Promise((resolve) => {
            confirmResolver = resolve;
        });
    }

    function applyOverview(overview) {
        if (!overview) {
            return;
        }
        if (syncEnabledToggle) {
            syncEnabledToggle.checked = overview.enabled === true;
        }
        syncEnabled = overview.enabled === true;
        setAdvancedOptionsVisible(syncEnabled);
        if (syncStatusText) {
            syncStatusText.textContent = formatSyncStatus(overview.status);
        }
        latestConflictBackup = overview.conflictBackup || null;
        renderConflictBackupStatus();
        renderUsageBars(overview.usage);
        setBusy(busy);
    }

    function renderUsageBars(usage) {
        const byKey = usage && usage.byKey ? usage.byKey : {};
        const perItemQuota = Number(usage && usage.quotaBytesPerItem) || 1;
        const settingsBytes = Number(byKey.jc_sync_settings) || 0;
        const blockedBytes = Number(byKey.jc_sync_blocked_words) || 0;
        const favoritesBytes = Number(byKey.jc_sync_favorite_words) || 0;
        const siteRulesBytes = Number(byKey.jc_sync_site_block_rules) || 0;

        const settingsPercent = safePercent(settingsBytes, perItemQuota);
        const blockedPercent = safePercent(blockedBytes, perItemQuota);
        const favoritesPercent = safePercent(favoritesBytes, perItemQuota);
        const siteRulesPercent = safePercent(siteRulesBytes, perItemQuota);

        if (syncUsageSettingsText) {
            syncUsageSettingsText.textContent = `${settingsPercent}% (${formatBytes(settingsBytes)} / ${formatBytes(perItemQuota)})`;
        }
        if (syncUsageBlockedText) {
            syncUsageBlockedText.textContent = `${blockedPercent}% (${formatBytes(blockedBytes)} / ${formatBytes(perItemQuota)})`;
        }
        if (syncUsageFavoritesText) {
            syncUsageFavoritesText.textContent = `${favoritesPercent}% (${formatBytes(favoritesBytes)} / ${formatBytes(perItemQuota)})`;
        }
        if (syncUsageSiteRulesText) {
            syncUsageSiteRulesText.textContent = `${siteRulesPercent}% (${formatBytes(siteRulesBytes)} / ${formatBytes(perItemQuota)})`;
        }
        if (syncUsageSettingsBar) {
            syncUsageSettingsBar.style.width = `${settingsPercent}%`;
        }
        if (syncUsageBlockedBar) {
            syncUsageBlockedBar.style.width = `${blockedPercent}%`;
        }
        if (syncUsageFavoritesBar) {
            syncUsageFavoritesBar.style.width = `${favoritesPercent}%`;
        }
        if (syncUsageSiteRulesBar) {
            syncUsageSiteRulesBar.style.width = `${siteRulesPercent}%`;
        }
    }

    async function refreshOverview() {
        const overview = await requestSyncOverview();
        applyOverview(overview);
    }

    async function openSyncPage(source = 'advanced') {
        entrySource = source === 'main' ? 'main' : 'advanced';
        showPage(pageSync);
        await refreshOverview();
    }

    function closeSyncPage() {
        showPage(entrySource === 'main' ? pageMain : pageAdvanced);
    }

    async function toggleSyncEnabled(enabled) {
        setBusy(true);
        try {
            if (enabled === true) {
                const confirmed = await confirmEnableSyncBeforeToggle();
                if (!confirmed) {
                    if (syncEnabledToggle) {
                        syncEnabledToggle.checked = false;
                    }
                    return;
                }
            }
            const ok = await requestSyncToggle(enabled);
            void ok;
            await refreshOverview();
        } finally {
            setBusy(false);
        }
    }

    async function pushNow() {
        setBusy(true);
        try {
            const result = await requestSyncPushNow();
            void result;
            await refreshOverview();
        } finally {
            setBusy(false);
        }
    }

    async function pullNow() {
        setBusy(true);
        try {
            const result = await requestSyncPullNow();
            void result;
            await refreshOverview();
        } finally {
            setBusy(false);
        }
    }

    async function restoreConflictBackup() {
        if (!latestConflictBackup || latestConflictBackup.exists !== true) {
            if (syncConflictRestoreBtn) {
                syncConflictRestoreBtn.textContent = '当前无可用备份';
            }
            if (syncConflictStatusText) {
                syncConflictStatusText.textContent = formatNoRestorableBackupMessage();
            }
            return;
        }
        setBusy(true);
        try {
            const result = await requestSyncConflictRestore();
            if (!result || result.ok !== true) {
                if (syncConflictStatusText) {
                    syncConflictStatusText.textContent = '恢复失败，请稍后重试。';
                }
            }
            await refreshOverview();
        } finally {
            setBusy(false);
        }
    }

    function applySettings(result = {}) {
        syncEnabled = result.syncEnabled === true;
        if (syncEnabledToggle) {
            syncEnabledToggle.checked = syncEnabled;
        }
        setAdvancedOptionsVisible(syncEnabled);
        if (syncStatusText) {
            syncStatusText.textContent = formatSyncStatus(result.syncStatus || null);
        }
        setBusy(false);
    }

    bindSyncEvents({
        elements,
        actions: {
            openSyncPage,
            closeSyncPage,
            toggleSyncEnabled,
            pushNow,
            pullNow,
            refreshOverview
        }
    });
    if (syncConflictEntryBtn) {
        syncConflictEntryBtn.addEventListener('click', async () => {
            await refreshOverview();
            openConflictModal();
        });
    }
    if (syncConflictModalClose) {
        syncConflictModalClose.addEventListener('click', closeConflictModal);
    }
    if (syncConflictCancelBtn) {
        syncConflictCancelBtn.addEventListener('click', closeConflictModal);
    }
    if (syncConflictRestoreBtn) {
        syncConflictRestoreBtn.addEventListener('click', async () => {
            await restoreConflictBackup();
        });
    }
    if (syncConflictModal) {
        syncConflictModal.addEventListener('click', (event) => {
            if (event.target === syncConflictModal) {
                closeConflictModal();
            }
        });
    }
    bindEnableConfirmModalEvents();
    setEnableConfirmButtonState();
    renderConflictBackupStatus();

    return {
        applySettings,
        refreshOverview,
        openFromMain: async () => openSyncPage('main'),
        openFromAdvanced: async () => openSyncPage('advanced')
    };
}
