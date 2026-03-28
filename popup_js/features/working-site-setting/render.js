/**
 * 文件说明：working-site-setting 模块渲染层。
 * 职责：更新站点设置页面文案、状态提示与交互控件展示。
 */

/**
 * 根据黑白名单模式刷新站点设置相关文案。
 */
export function updateSiteBlockCopy(mode, elements) {
    const {
        siteBlockQuickTitle,
        siteBlockQuickTooltip,
        siteBlockTipText,
        siteRulePageTitle,
        siteRuleTipText
    } = elements;
    const whitelist = mode === 'whitelist';

    if (siteBlockQuickTitle) {
        siteBlockQuickTitle.textContent = whitelist ? '想让插件标注此网站？' : '想让插件不标注此网站？';
    }
    if (siteBlockQuickTooltip) {
        siteBlockQuickTooltip.textContent = whitelist
            ? '点击右侧“标注此网站”按钮，即可将当前网站加入白名单。再次点击可移出白名单。'
            : '点击右侧“以后不再标注此网站”按钮，即可让插件在此网站上禁用。再次点击可取消。';
    }
    if (siteBlockTipText) {
        siteBlockTipText.textContent = whitelist
            ? '可以配置哪些网站允许插件工作；不在列表中的网站将不进行标注。'
            : '可以配置在哪些网站上插件不进行工作。';
    }
    if (siteRulePageTitle) {
        siteRulePageTitle.textContent = whitelist ? '添加白名单规则' : '添加黑名单规则';
    }
    if (siteRuleTipText) {
        siteRuleTipText.textContent = whitelist
            ? '选择将哪些网址（可以多选）添加到插件允许标记的列表'
            : '选择将哪些网址（可以多选）添加到插件停止标记的列表';
    }
}

/**
 * 渲染规则页候选规则文案。
 */
export function renderSiteRuleCandidates(mode, elements, normalizeSiteHostInput, resolveSiteRuleCandidates) {
    const {
        siteRuleHostInput,
        siteRuleParentLabel,
        siteRuleExactLabel,
        siteRuleSubdomainLabel
    } = elements;
    if (!siteRuleHostInput || !siteRuleParentLabel || !siteRuleExactLabel || !siteRuleSubdomainLabel) {
        return null;
    }
    const actionText = mode === 'whitelist' ? '启用' : '禁用';
    const normalizedHost = normalizeSiteHostInput(siteRuleHostInput.value);
    const candidates = resolveSiteRuleCandidates(normalizedHost);
    if (!candidates) {
        siteRuleParentLabel.textContent = `在 *.example.com 中${actionText}`;
        siteRuleExactLabel.textContent = `在 example.com 中${actionText}`;
        siteRuleSubdomainLabel.textContent = `在 *.example.com 中${actionText}`;
        return null;
    }
    siteRuleParentLabel.textContent = `在 ${candidates.parentWildcard} 中${actionText}`;
    siteRuleExactLabel.textContent = `在 ${candidates.exact} 中${actionText}`;
    siteRuleSubdomainLabel.textContent = `在 ${candidates.subdomainWildcard} 中${actionText}`;
    return candidates;
}

/**
 * 重置规则页单选框勾选状态。
 */
export function resetSiteRuleSelection() {
    const exactOption = document.querySelector('input[name="siteRuleMode"][value="exact"]');
    const parentOption = document.querySelector('input[name="siteRuleMode"][value="parent-wildcard"]');
    const subdomainOption = document.querySelector('input[name="siteRuleMode"][value="subdomain-wildcard"]');
    if (exactOption) {
        exactOption.checked = true;
    }
    if (parentOption) {
        parentOption.checked = false;
    }
    if (subdomainOption) {
        subdomainOption.checked = false;
    }
}

/**
 * 设置规则页提示状态文本。
 */
export function showSiteRuleStatus(siteRuleStatus, message, isError = false) {
    if (!siteRuleStatus) {
        return;
    }
    siteRuleStatus.textContent = message;
    siteRuleStatus.classList.toggle('error', isError);
}

/**
 * 清空规则页提示状态文本。
 */
export function clearSiteRuleStatus(siteRuleStatus) {
    if (!siteRuleStatus) {
        return;
    }
    siteRuleStatus.textContent = '';
    siteRuleStatus.classList.remove('error');
}

/**
 * 更新站点规则列表顶部操作按钮状态。
 */
export function updateSiteBlockActions(siteBlockSelectAll, siteBlockDeleteSelected, selected, filtered, updateDeleteSelectedButton) {
    if (!siteBlockSelectAll || !siteBlockDeleteSelected) {
        return;
    }
    const allSelected = filtered.length > 0 && filtered.every((rule) => selected.has(rule));
    siteBlockSelectAll.textContent = allSelected ? '取消全选' : '全选';
    updateDeleteSelectedButton(siteBlockDeleteSelected, selected.size > 0);
}

/**
 * 设置站点规则导入状态文本。
 */
export function setSiteBlockImportStatus(siteBlockImportStatus, message, isError = false) {
    if (!siteBlockImportStatus) {
        return;
    }
    siteBlockImportStatus.textContent = message || '';
    siteBlockImportStatus.classList.toggle('error', isError);
}

/**
 * 切换站点规则导入面板显示。
 */
export function showSiteBlockImportPane(mode, elements) {
    const { siteBlockImportFilePane, siteBlockImportManualPane } = elements;
    const showManual = mode === 'manual';
    const showFile = mode === 'file';
    if (siteBlockImportFilePane) {
        siteBlockImportFilePane.style.display = showFile ? 'block' : 'none';
    }
    if (siteBlockImportManualPane) {
        siteBlockImportManualPane.style.display = showManual ? 'block' : 'none';
    }
}

/**
 * 更新黑白名单模式滑块 UI。
 */
export function updateSiteBlockModeSliderUI(siteBlockModeSlider, siteBlockModeThumb, siteBlockModeLabels, value) {
    if (!siteBlockModeSlider || !siteBlockModeThumb) {
        return;
    }
    const max = parseInt(siteBlockModeSlider.max, 10) || 1;
    const numericValue = parseInt(value, 10);
    const stepWidth = 100 / (max + 1);
    siteBlockModeThumb.style.width = `${stepWidth}%`;
    siteBlockModeThumb.style.left = `${numericValue * stepWidth}%`;
    siteBlockModeLabels.forEach((label, index) => {
        if (index === numericValue) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
}
