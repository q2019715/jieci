/**
 * 文件说明：文本与单词处理共享工具。
 * 职责：提供单词归一化、筛选与文本行解析能力。
 */

/**
 * 将输入值规范化为小写单词字符串。
 */
export function normalizeWord(word) {
    return String(word || '').trim().toLowerCase();
}

/**
 * 按查询关键词筛选单词列表。
 */
export function filterWords(words, query) {
    const normalized = normalizeWord(query);
    if (!normalized) {
        return words;
    }
    return words.filter((word) => word.includes(normalized));
}

/**
 * 将多行文本解析为规范化后的单词列表。
 */
export function parseWordLines(content) {
    return String(content || '')
        .split(/\r?\n/)
        .map((line) => normalizeWord(line))
        .filter(Boolean);
}
