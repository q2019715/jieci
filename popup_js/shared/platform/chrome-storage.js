/**
 * 文件说明：chrome.storage 的最小封装，便于后续替换与测试。
 */

/**
 * 读取本地存储。
 */
export async function getLocalStorage(keys) {
    return chrome.storage.local.get(keys);
}

/**
 * 写入本地存储。
 */
export async function setLocalStorage(payload) {
    return chrome.storage.local.set(payload);
}

/**
 * 删除本地存储字段。
 */
export async function removeLocalStorage(keys) {
    return chrome.storage.local.remove(keys);
}
