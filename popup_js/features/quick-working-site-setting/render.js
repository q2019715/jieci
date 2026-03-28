/**
 * 文件说明：quick-working-site-setting 模块渲染层。
 * 职责：维护主页站点快捷卡片的悬停进度样式状态。
 */

/**
 * 设置快捷卡片是否显示悬停进度动画。
 */
export function setQuickCardHoverProgress(siteBlockQuickCard, active) {
    if (!siteBlockQuickCard) {
        return;
    }
    if (active) {
        siteBlockQuickCard.classList.add('is-hover-progress');
    } else {
        siteBlockQuickCard.classList.remove('is-hover-progress');
    }
}
