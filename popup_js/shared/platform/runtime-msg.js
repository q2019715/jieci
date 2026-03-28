/**
 * 文件说明：chrome.runtime 消息发送封装。
 */

/**
 * 向后台发送消息。
 */
export function sendRuntimeMessage(message) {
    return chrome.runtime.sendMessage(message);
}
