/**
 * 文件说明：working-site-setting 模块事件绑定。
 * 职责：绑定站点规则页导航、搜索、选择、批量删除、导入导出与规则新增事件。
 */

/**
 * 绑定站点规则设置相关事件。
 */
export function bindWorkingSiteSettingEvents({
    elements,
    state,
    deps,
    actions
}) {
    const {
        showPage,
        pageMain,
        pageAdvanced,
        pageSiteBlock,
        filterWords,
        readFileAsText,
        resetDeleteSelectedButton,
        updateDeleteSelectedButton,
        deleteSelectedConfirmDelay,
        deleteSelectedDoneDelay
    } = deps;
    const {
        siteBlockNav,
        siteBlockBack,
        siteRuleBack,
        siteBlockSearchInput,
        siteBlockSelectAll,
        siteBlockDeleteSelected,
        siteBlockImportBtn,
        siteBlockImportModal,
        siteBlockImportModalClose,
        siteBlockImportFromFileBtn,
        siteBlockImportManualBtn,
        siteBlockChooseFileBtn,
        siteBlockImportInput,
        siteBlockManualImportConfirm,
        siteBlockManualInput,
        siteBlockExportBtn,
        siteRuleHostInput,
        siteRuleAddBtn,
        siteBlockModeSlider,
        siteBlockModeLabels
    } = elements;
    const {
        renderSiteBlockRules,
        updateSiteBlockActions,
        persistSiteBlockMode,
        openSiteBlockImportModal,
        closeSiteBlockImportModal,
        showSiteBlockImportPane,
        setSiteBlockImportStatus,
        importSiteRules,
        exportRules,
        clearSiteRuleStatus,
        renderSiteRuleCandidates,
        normalizeSiteHostInput,
        showSiteRuleStatus,
        resolveSiteRuleCandidates,
        normalizeSiteRule,
        persistSiteBlockRules,
        updateBlockSiteButton,
        updateSiteBlockModeSliderUI
    } = actions;

    /**
     * 切换模式滑块并触发 input 事件。
     */
    function triggerModeSlider(index) {
        if (!siteBlockModeSlider) {
            return;
        }
        siteBlockModeSlider.value = index;
        siteBlockModeSlider.dispatchEvent(new Event('input'));
    }

    function triggerSiteBlockFileSelect() {
        if (!siteBlockImportInput) {
            return;
        }
        siteBlockImportInput.click();
    }

    if (siteBlockNav) {
        siteBlockNav.addEventListener('click', () => showPage(pageSiteBlock));
    }
    if (siteBlockBack) {
        siteBlockBack.addEventListener('click', () => showPage(pageAdvanced));
    }
    if (siteRuleBack) {
        siteRuleBack.addEventListener('click', () => showPage(pageMain));
    }
    if (siteBlockModeSlider) {
        siteBlockModeSlider.addEventListener('input', async () => {
            const value = parseInt(siteBlockModeSlider.value, 10);
            const mode = value === 1 ? 'whitelist' : 'blacklist';
            updateSiteBlockModeSliderUI(value);
            await persistSiteBlockMode(mode);
        });
    }
    siteBlockModeLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            triggerModeSlider(index);
        });
    });
    if (siteBlockSearchInput) {
        siteBlockSearchInput.addEventListener('input', () => {
            renderSiteBlockRules();
        });
    }
    if (siteBlockSelectAll) {
        siteBlockSelectAll.addEventListener('click', () => {
            const filtered = filterWords(state.rules, siteBlockSearchInput ? siteBlockSearchInput.value : '');
            const allSelected = filtered.length > 0 && filtered.every((item) => state.selected.has(item));
            if (allSelected) {
                filtered.forEach((item) => state.selected.delete(item));
            } else {
                filtered.forEach((item) => state.selected.add(item));
            }
            renderSiteBlockRules();
        });
    }
    if (siteBlockDeleteSelected) {
        siteBlockDeleteSelected.addEventListener('click', async () => {
            if (state.selected.size === 0) {
                return;
            }
            if (siteBlockDeleteSelected.dataset.state === 'confirm') {
                if (siteBlockDeleteSelected._confirmTimer) {
                    clearTimeout(siteBlockDeleteSelected._confirmTimer);
                    siteBlockDeleteSelected._confirmTimer = null;
                }
                siteBlockDeleteSelected.dataset.state = 'deleted';
                siteBlockDeleteSelected.textContent = '已删除';
                siteBlockDeleteSelected.disabled = true;
                state.rules = state.rules.filter((rule) => !state.selected.has(rule));
                state.selected = new Set();
                await persistSiteBlockRules();
                renderSiteBlockRules();
                await updateBlockSiteButton();
                siteBlockDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(siteBlockDeleteSelected);
                    updateSiteBlockActions(filterWords(state.rules, siteBlockSearchInput ? siteBlockSearchInput.value : ''));
                }, deleteSelectedDoneDelay);
                return;
            }
            if (siteBlockDeleteSelected.dataset.state === 'deleted') {
                return;
            }
            siteBlockDeleteSelected.dataset.state = 'confirm';
            siteBlockDeleteSelected.textContent = '确认吗？';
            siteBlockDeleteSelected._confirmTimer = setTimeout(() => {
                siteBlockDeleteSelected.dataset.state = 'idle';
                updateDeleteSelectedButton(siteBlockDeleteSelected, state.selected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (siteBlockImportBtn) {
        siteBlockImportBtn.addEventListener('click', openSiteBlockImportModal);
    }
    if (siteBlockImportModalClose) {
        siteBlockImportModalClose.addEventListener('click', closeSiteBlockImportModal);
    }
    if (siteBlockImportModal) {
        siteBlockImportModal.addEventListener('click', (event) => {
            if (event.target === siteBlockImportModal) {
                closeSiteBlockImportModal();
            }
        });
    }
    if (siteBlockImportFromFileBtn) {
        siteBlockImportFromFileBtn.addEventListener('click', () => {
            showSiteBlockImportPane('file');
            setSiteBlockImportStatus('');
            triggerSiteBlockFileSelect();
        });
    }
    if (siteBlockImportManualBtn) {
        siteBlockImportManualBtn.addEventListener('click', () => {
            showSiteBlockImportPane('manual');
            setSiteBlockImportStatus('');
            if (siteBlockManualInput) {
                siteBlockManualInput.focus();
            }
        });
    }
    if (siteBlockChooseFileBtn && siteBlockImportInput) {
        siteBlockChooseFileBtn.addEventListener('click', () => {
            setSiteBlockImportStatus('');
            triggerSiteBlockFileSelect();
        });
    }
    if (siteBlockImportInput) {
        siteBlockImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const rules = actions.parseSiteRuleBulkInput(content);
                const result = await importSiteRules(rules);
                if (result.total === 0) {
                    setSiteBlockImportStatus('导入失败：未识别到有效域名规则', true);
                    return;
                }
                setSiteBlockImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
            } catch (error) {
                setSiteBlockImportStatus(`导入失败：${error.message}`, true);
            } finally {
                siteBlockImportInput.value = '';
            }
        });
    }
    if (siteBlockManualImportConfirm && siteBlockManualInput) {
        siteBlockManualImportConfirm.addEventListener('click', async () => {
            const raw = siteBlockManualInput.value || '';
            const rules = actions.parseSiteRuleBulkInput(raw);
            if (rules.length === 0) {
                setSiteBlockImportStatus('请输入有效域名规则后再导入', true);
                return;
            }
            try {
                const result = await importSiteRules(rules);
                setSiteBlockImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
                siteBlockManualInput.value = '';
            } catch (error) {
                setSiteBlockImportStatus(`导入失败：${error.message}`, true);
            }
        });
    }
    if (siteBlockExportBtn) {
        siteBlockExportBtn.addEventListener('click', exportRules);
    }
    if (siteRuleHostInput) {
        siteRuleHostInput.addEventListener('input', () => {
            clearSiteRuleStatus();
            renderSiteRuleCandidates();
        });
    }
    if (siteRuleAddBtn) {
        siteRuleAddBtn.addEventListener('click', async () => {
            if (!siteRuleHostInput) {
                return;
            }
            const normalizedHost = normalizeSiteHostInput(siteRuleHostInput.value);
            if (!normalizedHost) {
                showSiteRuleStatus('Please enter a valid domain', true);
                return;
            }
            if (siteRuleHostInput.value !== normalizedHost) {
                siteRuleHostInput.value = normalizedHost;
            }
            const candidates = resolveSiteRuleCandidates(normalizedHost);
            if (!candidates) {
                showSiteRuleStatus('Failed to build rules, please check domain', true);
                return;
            }
            const selectedModes = Array.from(document.querySelectorAll('input[name="siteRuleMode"]:checked')).map((node) => node.value);
            if (selectedModes.length === 0) {
                showSiteRuleStatus('Select at least one rule scope', true);
                return;
            }
            const nextRules = [];
            selectedModes.forEach((mode) => {
                if (mode === 'parent-wildcard') {
                    nextRules.push(candidates.parentWildcard);
                } else if (mode === 'subdomain-wildcard') {
                    nextRules.push(candidates.subdomainWildcard);
                } else {
                    nextRules.push(candidates.exact);
                }
            });
            const normalizedNextRules = Array.from(new Set(nextRules.map((rule) => normalizeSiteRule(rule)).filter(Boolean)));
            if (normalizedNextRules.length === 0) {
                showSiteRuleStatus('Invalid rule format', true);
                return;
            }
            const existing = new Set(state.rules.map((rule) => normalizeSiteRule(rule)).filter(Boolean));
            let addedCount = 0;
            normalizedNextRules.forEach((rule) => {
                if (!existing.has(rule)) {
                    existing.add(rule);
                    addedCount += 1;
                }
            });
            if (addedCount === 0) {
                showSiteRuleStatus('Selected rules already exist');
                return;
            }
            state.rules = Array.from(existing);
            state.selected = new Set();
            await persistSiteBlockRules();
            renderSiteBlockRules();
            await updateBlockSiteButton();
            clearSiteRuleStatus();
            showPage(pageMain);
        });
    }
}
