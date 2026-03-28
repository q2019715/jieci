/**
 * 文件说明：blocked-words 模块服务层。
 * 职责：处理屏蔽词的归一化、持久化、导入导出与索引更新。
 */

/**
 * 将屏蔽词数组规范化为去重、排序后的列表。
 */
export function normalizeBlockedWords(words, normalizeWord) {
    return Array.from(new Set((Array.isArray(words) ? words : []).map(normalizeWord).filter(Boolean))).sort();
}

/**
 * 将屏蔽词写入本地并同步 Trie 索引与内容脚本。
 */
export async function persistBlockedWords(words, normalizeWord, buildEnglishTrieIndex, notifyActiveTabs) {
    const normalized = normalizeBlockedWords(words, normalizeWord);
    const trieIndex = buildEnglishTrieIndex(normalized);
    await chrome.storage.local.set({
        blockedWords: normalized,
        blockedWordsTrieIndex: trieIndex
    });
    await notifyActiveTabs({
        action: 'updateBlockedWords',
        words: normalized,
        trieIndex
    });
    return normalized;
}

/**
 * 导出屏蔽词到文本文件。
 */
export function exportBlockedWords(words, filename) {
    const content = (words || []).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

