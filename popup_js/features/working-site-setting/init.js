/**
 * 文件说明：working-site-setting 功能模块初始化入口。
 * 职责：组装站点规则状态、渲染逻辑、持久化流程与事件绑定。
 */
import { bindWorkingSiteSettingEvents } from './bind.js';
import {
    updateSiteBlockCopy,
    renderSiteRuleCandidates as renderSiteRuleCandidatesView,
    resetSiteRuleSelection,
    showSiteRuleStatus,
    clearSiteRuleStatus,
    updateSiteBlockActions as updateSiteBlockActionsView,
    setSiteBlockImportStatus,
    showSiteBlockImportPane,
    updateSiteBlockModeSliderUI as updateSiteBlockModeSliderUIView
} from './render.js';
import {
    normalizeHost,
    normalizeSiteRule,
    normalizeSiteHostInput,
    compileSiteRules,
    isHostBlocked as isHostBlockedByMode,
    findBestMatchingRule,
    resolveSiteRuleCandidates,
    parseSiteRuleBulkInput,
    exportSiteRules,
    fetchCurrentSiteHost
} from './service.js';

/**
 * 初始化站点列表设置功能。
 */
export function initWorkingSiteSettingFeature({ elements, deps }) {
    const state = {
        rules: [],
        mode: 'blacklist',
        selected: new Set(),
        currentHost: ''
    };

    const {
        showPage,
        pageMain,
        pageAdvanced,
        pageSiteBlock,
        pageSiteRule,
        notifyActiveTabs,
        filterWords,
        renderWordSelectionList,
        updateDeleteSelectedButton,
        resetDeleteSelectedButton,
        readFileAsText,
        deleteSelectedConfirmDelay,
        deleteSelectedDoneDelay,
        scheduleOverflowUpdate
    } = deps;
    const {
        siteBlockSearchInput,
        siteBlockSelectAll,
        siteBlockDeleteSelected,
        siteBlockList,
        siteBlockImportModal,
        siteBlockImportInput,
        siteBlockImportStatus,
        siteBlockImportFilePane,
        siteBlockImportManualPane,
        siteBlockModeSlider,
        siteBlockModeThumb,
        siteBlockModeLabels,
        siteRuleHostInput,
        siteRuleStatus,
        blockSiteBtn
    } = elements;

    /**
     * 根据当前规则与筛选条件更新顶部操作按钮状态。
     */
    function updateSiteBlockActions(filtered) {
        updateSiteBlockActionsView(
            siteBlockSelectAll,
            siteBlockDeleteSelected,
            state.selected,
            filtered,
            updateDeleteSelectedButton
        );
    }

    /**
     * 根据当前模式更新页面文案。
     */
    function refreshSiteBlockCopy() {
        updateSiteBlockCopy(state.mode, elements);
    }

    /**
     * 渲染规则页候选标签文案。
     */
    function renderSiteRuleCandidates() {
        return renderSiteRuleCandidatesView(
            state.mode,
            elements,
            normalizeSiteHostInput,
            resolveSiteRuleCandidates
        );
    }

    /**
     * 渲染站点规则列表。
     */
    function renderSiteBlockRules() {
        const filtered = filterWords(state.rules, siteBlockSearchInput ? siteBlockSearchInput.value : '');
        updateSiteBlockActions(filtered);
        renderWordSelectionList({
            listElement: siteBlockList,
            filteredItems: filtered,
            selectedItems: state.selected,
            emptyText: '暂无黑名单网站',
            onToggleSelection: () => updateSiteBlockActions(filtered),
            onDeleteItem: async (rule) => {
                state.selected.delete(rule);
                state.rules = state.rules.filter((itemRule) => itemRule !== rule);
                await persistSiteBlockRules();
                renderSiteBlockRules();
                await updateBlockSiteButton();
            }
        });
    }

    /**
     * 持久化站点规则并通知内容脚本更新。
     */
    async function persistSiteBlockRules() {
        const normalized = Array.from(new Set(state.rules.map(normalizeSiteRule).filter(Boolean))).sort();
        state.rules = normalized;
        const index = compileSiteRules(normalized);
        await chrome.storage.local.set({
            siteBlockRules: normalized,
            siteBlockIndex: index
        });
        await notifyActiveTabs({
            action: 'updateSiteBlacklist',
            rules: normalized,
            index
        });
    }

    /**
     * 持久化黑白名单模式并刷新相关视图。
     */
    async function persistSiteBlockMode(mode) {
        state.mode = mode === 'whitelist' ? 'whitelist' : 'blacklist';
        await chrome.storage.local.set({ siteBlockMode: state.mode });
        await notifyActiveTabs({
            action: 'updateSiteBlockMode',
            mode: state.mode
        });
        refreshSiteBlockCopy();
        renderSiteRuleCandidates();
        await updateBlockSiteButton();
    }

    /**
     * 设置导入状态提示文案。
     */
    function setImportStatus(message, isError = false) {
        setSiteBlockImportStatus(siteBlockImportStatus, message, isError);
    }

    /**
     * 切换导入面板展示模式。
     */
    function switchImportPane(mode) {
        showSiteBlockImportPane(mode, {
            siteBlockImportFilePane,
            siteBlockImportManualPane
        });
    }

    /**
     * 打开站点规则导入弹窗。
     */
    function openSiteBlockImportModal() {
        if (!siteBlockImportModal) {
            return;
        }
        setImportStatus('');
        switchImportPane('choice');
        siteBlockImportModal.classList.add('show');
    }

    /**
     * 关闭站点规则导入弹窗。
     */
    function closeSiteBlockImportModal() {
        if (!siteBlockImportModal) {
            return;
        }
        siteBlockImportModal.classList.remove('show');
        setImportStatus('');
        switchImportPane('choice');
        if (siteBlockImportInput) {
            siteBlockImportInput.value = '';
        }
    }

    /**
     * 导入规则集合并合并到当前状态。
     */
    async function importSiteRules(rules) {
        const normalized = Array.from(new Set((rules || []).map(normalizeSiteRule).filter(Boolean)));
        if (normalized.length === 0) {
            return { added: 0, total: 0 };
        }
        const existing = new Set(state.rules.map(normalizeSiteRule).filter(Boolean));
        let added = 0;
        normalized.forEach((rule) => {
            if (!existing.has(rule)) {
                existing.add(rule);
                added += 1;
            }
        });
        state.rules = Array.from(existing);
        state.selected = new Set();
        await persistSiteBlockRules();
        renderSiteBlockRules();
        await updateBlockSiteButton();
        return { added, total: normalized.length };
    }

    /**
     * 导出当前规则列表。
     */
    function exportRules() {
        exportSiteRules(state.rules, 'site-blacklist.txt');
    }

    /**
     * 刷新当前页面主机名。
     */
    async function loadCurrentSiteHost() {
        state.currentHost = await fetchCurrentSiteHost();
        return state.currentHost;
    }

    /**
     * 判断主机是否被当前规则模式拦截。
     */
    function isHostBlocked(host, rules = state.rules, mode = state.mode) {
        return isHostBlockedByMode(host, rules, mode);
    }

    /**
     * 刷新主页快捷站点按钮文案。
     */
    async function updateBlockSiteButton() {
        refreshSiteBlockCopy();
        if (!blockSiteBtn) {
            return;
        }
        if (!state.currentHost) {
            await loadCurrentSiteHost();
        }
        if (!state.currentHost) {
            blockSiteBtn.disabled = true;
            blockSiteBtn.textContent = '当前页面受浏览器保护';
            return;
        }
        const blocked = isHostBlocked(state.currentHost, state.rules, state.mode);
        blockSiteBtn.disabled = false;
        if (state.mode === 'whitelist') {
            const allowed = !blocked;
            blockSiteBtn.textContent = allowed ? '此网站已允许标注 点此取消' : '标注此网站';
            return;
        }
        blockSiteBtn.textContent = blocked ? '此网站已禁用标注 点此取消' : '以后不再标注此网站';
    }

    /**
     * 快捷按钮切换当前站点规则状态。
     */
    async function toggleCurrentSiteRule() {
        await loadCurrentSiteHost();
        if (!state.currentHost) {
            return;
        }
        const rule = normalizeHost(state.currentHost);
        if (!rule) {
            return;
        }
        const blocked = isHostBlocked(state.currentHost, state.rules, state.mode);
        if (state.mode === 'whitelist') {
            const allowed = !blocked;
            if (allowed) {
                const ruleToRemove = findBestMatchingRule(state.currentHost, state.rules);
                if (!ruleToRemove) {
                    return;
                }
                state.rules = state.rules.filter((item) => normalizeSiteRule(item) !== normalizeSiteRule(ruleToRemove));
            } else {
                state.rules = Array.from(new Set([...state.rules, rule]));
            }
        } else if (blocked) {
            const ruleToRemove = findBestMatchingRule(state.currentHost, state.rules);
            if (!ruleToRemove) {
                return;
            }
            state.rules = state.rules.filter((item) => normalizeSiteRule(item) !== normalizeSiteRule(ruleToRemove));
        } else {
            state.rules = Array.from(new Set([...state.rules, rule]));
        }
        state.selected = new Set();
        await persistSiteBlockRules();
        renderSiteBlockRules();
        await updateBlockSiteButton();
    }

    /**
     * 判断快捷悬停是否应自动进入规则页。
     */
    function canTriggerQuickSiteRuleOpen() {
        if (!blockSiteBtn || blockSiteBtn.disabled) {
            return false;
        }
        if (!state.currentHost) {
            return false;
        }
        const blocked = isHostBlocked(state.currentHost, state.rules, state.mode);
        return state.mode === 'whitelist' ? blocked : !blocked;
    }

    /**
     * 打开规则页并填入当前域名。
     */
    async function openSiteRulePage() {
        await loadCurrentSiteHost();
        if (siteRuleHostInput && state.currentHost) {
            siteRuleHostInput.value = state.currentHost;
        }
        resetSiteRuleSelection();
        clearSiteRuleStatus(siteRuleStatus);
        renderSiteRuleCandidates();
        showPage(pageSiteRule);
    }

    /**
     * 更新模式滑块样式状态。
     */
    function updateSiteBlockModeSliderUI(value) {
        updateSiteBlockModeSliderUIView(
            siteBlockModeSlider,
            siteBlockModeThumb,
            siteBlockModeLabels,
            value
        );
    }

    /**
     * 设置规则页状态提示。
     */
    function setRuleStatus(message, isError = false) {
        showSiteRuleStatus(siteRuleStatus, message, isError);
    }

    /**
     * 清空规则页状态提示。
     */
    function resetRuleStatus() {
        clearSiteRuleStatus(siteRuleStatus);
    }

    /**
     * 将存储中的站点规则与模式应用到 UI。
     */
    async function applySettings(result) {
        state.rules = Array.isArray(result.siteBlockRules)
            ? result.siteBlockRules.map(normalizeSiteRule).filter(Boolean)
            : [];
        state.mode = result.siteBlockMode === 'whitelist' ? 'whitelist' : 'blacklist';
        state.selected = new Set();
        if (siteBlockSearchInput) {
            siteBlockSearchInput.value = '';
        }
        if (siteBlockModeSlider) {
            const value = state.mode === 'whitelist' ? 1 : 0;
            siteBlockModeSlider.value = value;
            updateSiteBlockModeSliderUI(value);
        }
        renderSiteBlockRules();
        await updateBlockSiteButton();
        scheduleOverflowUpdate();
    }

    bindWorkingSiteSettingEvents({
        elements,
        state,
        deps: {
            showPage,
            pageMain,
            pageAdvanced,
            pageSiteBlock,
            pageSiteRule,
            filterWords,
            readFileAsText,
            resetDeleteSelectedButton,
            updateDeleteSelectedButton,
            deleteSelectedConfirmDelay,
            deleteSelectedDoneDelay
        },
        actions: {
            renderSiteBlockRules,
            updateSiteBlockActions,
            persistSiteBlockMode,
            openSiteBlockImportModal,
            closeSiteBlockImportModal,
            showSiteBlockImportPane: switchImportPane,
            setSiteBlockImportStatus: setImportStatus,
            importSiteRules,
            exportRules,
            clearSiteRuleStatus: resetRuleStatus,
            renderSiteRuleCandidates,
            normalizeSiteHostInput,
            showSiteRuleStatus: setRuleStatus,
            resolveSiteRuleCandidates,
            normalizeSiteRule,
            persistSiteBlockRules,
            updateBlockSiteButton,
            updateSiteBlockModeSliderUI,
            parseSiteRuleBulkInput
        }
    });

    return {
        applySettings,
        updateBlockSiteButton,
        loadCurrentSiteHost,
        canTriggerQuickSiteRuleOpen,
        openSiteRulePage,
        toggleCurrentSiteRule,
        isHostBlocked,
        findBestMatchingRule,
        normalizeSiteRule
    };
}
