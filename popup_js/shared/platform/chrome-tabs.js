/**
 * 文件说明：chrome.tabs 的最小封装。
 */

/**
 * 在新标签页打开指定链接。
 */
export function openTab(url) {
    chrome.tabs.create({ url });
}

/**
 * 获取当前窗口激活标签页列表。
 */
export async function getActiveTabs() {
    return chrome.tabs.query({ active: true, currentWindow: true });
}

/**
 * 向当前窗口激活标签页广播消息。
 */
export async function notifyActiveTabs(message) {
    const tabs = await getActiveTabs();
    tabs.forEach((tab) => {
        if (tab.id == null) {
            return;
        }
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
        });
    });
}

/**
 * 向指定标签页发送消息。
 */
export async function sendMessageToTab(tabId, message) {
    if (tabId == null) {
        return null;
    }
    try {
        return await chrome.tabs.sendMessage(tabId, message);
    } catch {
        return null;
    }
}
