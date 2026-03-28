/**
 * 文件说明：quick-working-site-setting 模块初始化入口。
 * 职责：组装主页快捷站点设置的悬停状态与事件绑定。
 */
import { bindQuickWorkingSiteSettingEvents } from './bind.js';
import { setQuickCardHoverProgress } from './render.js';
import { QUICK_SITE_RULE_HOVER_OPEN_DELAY_MS } from './constants.js';
import {
    createQuickHoverController,
    clearQuickHoverTimer,
    startQuickHoverTimer
} from './service.js';

/**
 * 初始化快捷站点规则功能。
 */
export function initQuickWorkingSiteSettingFeature({ elements, workingFeature }) {
    const { siteBlockQuickCard } = elements;
    const hoverController = createQuickHoverController();
    let hoverSequence = 0;

    /**
     * 取消当前悬停打开流程并重置样式。
     */
    function cancelHoverOpen() {
        hoverSequence += 1;
        clearQuickHoverTimer(hoverController);
        setQuickCardHoverProgress(siteBlockQuickCard, false);
    }

    /**
     * 处理快捷卡片鼠标移入逻辑。
     */
    async function onQuickCardMouseEnter() {
        const sequence = ++hoverSequence;
        clearQuickHoverTimer(hoverController);
        setQuickCardHoverProgress(siteBlockQuickCard, false);
        await workingFeature.loadCurrentSiteHost();
        if (sequence !== hoverSequence || !siteBlockQuickCard || !siteBlockQuickCard.matches(':hover')) {
            return;
        }
        await workingFeature.updateBlockSiteButton();
        if (sequence !== hoverSequence || !siteBlockQuickCard.matches(':hover')) {
            return;
        }
        if (!workingFeature.canTriggerQuickSiteRuleOpen()) {
            return;
        }
        setQuickCardHoverProgress(siteBlockQuickCard, true);
        startQuickHoverTimer(hoverController, QUICK_SITE_RULE_HOVER_OPEN_DELAY_MS, async () => {
            if (sequence !== hoverSequence || !siteBlockQuickCard.matches(':hover')) {
                return;
            }
            setQuickCardHoverProgress(siteBlockQuickCard, false);
            await workingFeature.openSiteRulePage();
        });
    }

    /**
     * 处理快捷卡片鼠标移出逻辑。
     */
    function onQuickCardMouseLeave() {
        cancelHoverOpen();
    }

    bindQuickWorkingSiteSettingEvents({
        elements,
        actions: {
            cancelHoverOpen,
            toggleCurrentSiteRule: async () => workingFeature.toggleCurrentSiteRule(),
            openSiteRulePage: async () => workingFeature.openSiteRulePage(),
            onQuickCardMouseEnter,
            onQuickCardMouseLeave
        }
    });

    return {
        cancelHoverOpen
    };
}
