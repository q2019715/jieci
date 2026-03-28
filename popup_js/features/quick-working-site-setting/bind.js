/**
 * 文件说明：quick-working-site-setting 模块事件绑定。
 * 职责：绑定主页快捷站点按钮点击与悬停自动打开规则页逻辑。
 */

/**
 * 绑定快捷站点设置事件。
 */
export function bindQuickWorkingSiteSettingEvents({
    elements,
    actions
}) {
    const { blockSiteBtn, blockSiteRuleBtn, siteBlockQuickCard } = elements;
    const {
        cancelHoverOpen,
        toggleCurrentSiteRule,
        openSiteRulePage,
        onQuickCardMouseEnter,
        onQuickCardMouseLeave
    } = actions;

    if (blockSiteBtn) {
        blockSiteBtn.addEventListener('click', async () => {
            cancelHoverOpen();
            await toggleCurrentSiteRule();
        });
    }

    if (blockSiteRuleBtn) {
        blockSiteRuleBtn.addEventListener('click', async () => {
            cancelHoverOpen();
            await openSiteRulePage();
        });
    }

    if (siteBlockQuickCard) {
        siteBlockQuickCard.addEventListener('mouseenter', async () => {
            await onQuickCardMouseEnter();
        });
        siteBlockQuickCard.addEventListener('mouseleave', () => {
            onQuickCardMouseLeave();
        });

        const helpNodes = siteBlockQuickCard.querySelectorAll('.help-icon, .help-tooltip');
        helpNodes.forEach((node) => {
            node.addEventListener('mouseenter', () => {
                cancelHoverOpen();
            });
            node.addEventListener('mouseleave', async () => {
                if (!siteBlockQuickCard.matches(':hover')) {
                    return;
                }
                await onQuickCardMouseEnter();
            });
        });
    }
}
