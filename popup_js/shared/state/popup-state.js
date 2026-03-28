/**
 * 文件说明：popup 运行时状态容器。
 */

/**
 * 创建 popup 的运行时状态对象。
 */
export function createPopupState() {
    return {
        updateAbortXhr: null,
        updateCancelRequested: false,
        updateInProgress: false,
        updateModalCloseTimer: null,
        lastUpdateAction: null,
        siteRuleHoverTimer: null
    };
}
