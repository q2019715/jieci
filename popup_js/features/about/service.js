/**
 * 文件说明：about 模块服务层。
 * 职责：处理 about 页面内调试模式设置的持久化与通知。
 */

/**
 * 保存调试模式并通知内容脚本更新。
 */
export async function saveDebugMode(enabled, notifyActiveTabs) {
    await chrome.storage.local.set({ debugMode: enabled });
    await notifyActiveTabs({
        action: 'updateDebugMode',
        enabled
    });
}
