/**
 * 文件说明：dictionary（词库管理）模块服务层。
 * 职责：处理词库导入、删除、过滤、索引重建与展示格式化。
 */
import { generateId } from '../../shared/tools/ids.js';

/**
 * 将时间格式化为中文本地展示字符串。
 */
export function formatVocabularyDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 按搜索词过滤词库列表。
 */
export function filterVocabularies(vocabList, query, normalizeWord) {
    const normalizedQuery = normalizeWord(query || '');
    if (!normalizedQuery) {
        return Array.isArray(vocabList) ? vocabList : [];
    }
    return (Array.isArray(vocabList) ? vocabList : [])
        .filter((vocab) => normalizeWord(vocab && vocab.name).includes(normalizedQuery));
}

/**
 * 读取并解析导入文件，合并到词库列表。
 */
export async function parseAndAppendVocabularyFiles(files, existingList, readFileAsText) {
    const list = Array.isArray(existingList) ? [...existingList] : [];
    for (const file of files) {
        const content = await readFileAsText(file);
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
            throw new Error(`${file.name} 格式不正确`);
        }
        list.push({
            id: generateId(),
            name: file.name,
            uploadTime: new Date().toISOString(),
            wordCount: data.length,
            data
        });
    }
    return list;
}

/**
 * 持久化词库并重建中文 Trie 索引。
 */
export async function persistVocabulariesAndIndex(vocabList, buildChineseTrieIndex) {
    await chrome.storage.local.set({ vocabularies: vocabList });
    if (Array.isArray(vocabList) && vocabList.length > 0) {
        const trieIndex = buildChineseTrieIndex(vocabList);
        await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
        return;
    }
    await chrome.storage.local.remove('vocabularyTrieIndex');
}

/**
 * 从词库中删除指定 ID 并返回新列表。
 */
export function removeVocabularyById(vocabList, id) {
    return (Array.isArray(vocabList) ? vocabList : []).filter((vocab) => vocab.id !== id);
}
