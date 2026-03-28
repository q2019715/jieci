/**
 * 文件说明：annotation-styles 模块服务层。
 * 职责：处理段落内标注样式设置的持久化与消息通知。
 */

/**
 * 保存高亮配色设置并通知内容脚本刷新样式。
 */
export async function saveHighlightSettings(mode, color, notifyActiveTabs) {
    await chrome.storage.local.set({
        highlightColorMode: mode,
        highlightColor: color
    });
    await notifyActiveTabs({
        action: 'updateHighlightColor',
        mode,
        color
    });
}

/**
 * 保存“禁用段落内下划线”设置并通知内容脚本。
 */
export async function saveDisableAnnotationUnderline(disabled, notifyActiveTabs) {
    await chrome.storage.local.set({ disableAnnotationUnderline: disabled });
    await notifyActiveTabs({
        action: 'updateAnnotationUnderline',
        disabled
    });
}
