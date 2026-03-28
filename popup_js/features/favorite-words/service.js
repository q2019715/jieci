/**
 * 文件说明：favorite-words 模块服务层。
 * 职责：处理收藏词的归一化、持久化、导入与导出。
 */

/**
 * 将收藏词数组规范化为去重、排序后的列表。
 */
export function normalizeFavoriteWords(words, normalizeWord) {
    return Array.from(new Set((Array.isArray(words) ? words : []).map(normalizeWord).filter(Boolean))).sort();
}

/**
 * 将收藏词写入本地存储，并返回写入后的规范化结果。
 */
export async function persistFavoriteWords(words, normalizeWord) {
    const normalized = normalizeFavoriteWords(words, normalizeWord);
    await chrome.storage.local.set({ favoriteWords: normalized });
    return normalized;
}

/**
 * 合并导入结果与现有收藏词。
 */
export function mergeFavoriteWords(currentWords, importedWords) {
    return Array.from(new Set([...(currentWords || []), ...(importedWords || [])]));
}

/**
 * 导出收藏词到文本文件。
 */
export function exportFavoriteWords(words, filename) {
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

