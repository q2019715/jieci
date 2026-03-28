/**
 * 文件说明：annotation-behavior 模块服务层。
 * 职责：处理段落内标注行为设置的映射、持久化与消息通知。
 */

/**
 * 标注模式滑块值到存储值的映射表。
 */
export const annotationModeMap = {
    0: 'cn-to-en',
    1: 'auto',
    2: 'en-to-cn'
};

/**
 * 标注模式存储值到滑块值的反向映射表。
 */
export const reverseAnnotationModeMap = {
    'cn-to-en': 0,
    'auto': 1,
    'en-to-cn': 2
};

/**
 * 去重模式滑块值到存储值的映射表。
 */
export const dedupeModeMap = {
    0: 'off',
    1: 'page',
    2: 'count'
};

/**
 * 去重模式存储值到滑块值的反向映射表。
 */
export const reverseDedupeModeMap = {
    'off': 0,
    'page': 1,
    'count': 2
};

/**
 * 保存标注模式并通知内容脚本更新。
 */
export async function saveAnnotationMode(mode, notifyActiveTabs) {
    await chrome.storage.local.set({ annotationMode: mode });
    await notifyActiveTabs({
        action: 'updateMode',
        mode
    });
}

/**
 * 保存中英释义展示顺序并通知内容脚本更新。
 */
export async function saveAnnotationOrder(cnToEnOrder, enToCnOrder, notifyActiveTabs) {
    await chrome.storage.local.set({
        cnToEnOrder,
        enToCnOrder
    });
    await notifyActiveTabs({
        action: 'updateAnnotationOrder',
        cnToEnOrder,
        enToCnOrder
    });
}

/**
 * 保存去重模式并通知内容脚本更新。
 */
export async function saveDedupeMode(mode, notifyActiveTabs) {
    await chrome.storage.local.set({ dedupeMode: mode });
    await notifyActiveTabs({
        action: 'updateDedupeMode',
        mode
    });
}

/**
 * 保存去重重复次数并通知内容脚本更新。
 */
export async function saveDedupeRepeatCount(repeatCount, notifyActiveTabs) {
    await chrome.storage.local.set({ dedupeRepeatCount: repeatCount });
    await notifyActiveTabs({
        action: 'updateDedupeRepeatCount',
        repeatCount
    });
}

/**
 * 清空全局去重计数并通知内容脚本更新。
 */
export async function clearDedupeCounts(notifyActiveTabs) {
    await chrome.storage.local.remove('dedupeGlobalState');
    await notifyActiveTabs({
        action: 'clearDedupeCounts'
    });
}

/**
 * 保存单节点最大匹配数并通知内容脚本更新。
 */
export async function saveMaxMatchesPerNode(maxMatches, notifyActiveTabs) {
    await chrome.storage.local.set({ maxMatchesPerNode: maxMatches });
    await notifyActiveTabs({
        action: 'updateMaxMatches',
        maxMatches
    });
}

/**
 * 保存最小文本长度并通知内容脚本更新。
 */
export async function saveMinTextLength(minLength, notifyActiveTabs) {
    await chrome.storage.local.set({ minTextLength: minLength });
    await notifyActiveTabs({
        action: 'updateMinTextLength',
        minLength
    });
}

/**
 * 保存 smartSkipCodeLinks 开关并通知内容脚本更新。
 */
export async function saveSmartSkipCodeLinks(enabled, notifyActiveTabs) {
    await chrome.storage.local.set({ smartSkipCodeLinks: enabled });
    await notifyActiveTabs({
        action: 'updateSmartSkipCodeLinks',
        enabled
    });
}

/**
 * 保存 smartSkipEditableTextboxes 开关并通知内容脚本更新。
 */
export async function saveSmartSkipEditableTextboxes(enabled, notifyActiveTabs) {
    await chrome.storage.local.set({ smartSkipEditableTextboxes: enabled });
    await notifyActiveTabs({
        action: 'updateSmartSkipEditableTextboxes',
        enabled
    });
}
