/**
 * 文件说明：dictionary-download 模块服务层。
 * 职责：处理词库索引获取、下载、更新与缓存构建。
 */

/**
 * 从服务器获取词库索引。
 */
export async function fetchServerDictionaryIndex(serverUrl, noCache = true) {
    const cacheBust = noCache ? `?t=${Date.now()}` : '';
    const response = await fetch(`${serverUrl}/dict/index.json${cacheBust}`, {
        cache: 'no-store'
    });
    if (!response.ok) {
        return Promise.reject(new Error(`获取词库列表失败 (HTTP ${response.status})`));
    }
    const dictionaries = await response.json();
    return Array.isArray(dictionaries) ? dictionaries : [];
}

/**
 * 检查本地是否已存在同名词库。
 */
export function hasDuplicatedVocabulary(dictName, vocabList) {
    const normalizedName = String(dictName || '').trim();
    if (!normalizedName) {
        return false;
    }
    return vocabList.some((vocab) => String(vocab && vocab.name || '').trim() === normalizedName);
}

/**
 * 创建“已取消”错误对象。
 */
export function createCancelError() {
    const error = new Error('已取消');
    error.isCanceled = true;
    return error;
}

/**
 * 规范化词库名称。
 */
export function normalizeDictName(name) {
    return String(name || '').trim();
}

/**
 * 在服务端索引中按名称查找词库条目。
 */
export function findServerDictByName(dictionaries, name) {
    const target = normalizeDictName(name);
    return dictionaries.find((dict) => normalizeDictName(dict && dict.name) === target);
}

/**
 * 下载词库文件并返回解析后的 JSON 数组。
 */
export function downloadDictionaryData(serverUrl, dict, onProgress, options = {}) {
    const {
        cacheBust = false,
        onXhrCreate = null,
        onXhrRelease = null,
        cancelErrorFactory = createCancelError
    } = options;
    const bust = cacheBust ? `?t=${Date.now()}` : '';
    const url = `${serverUrl}/dict/${dict.filename || dict.name}${bust}`;
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (typeof onXhrCreate === 'function') {
            onXhrCreate(xhr);
        }
        xhr.open('GET', url, true);
        xhr.responseType = 'text';
        let lastPercent = 0;
        xhr.onprogress = (event) => {
            const total = event.lengthComputable ? event.total : (dict.size || 0);
            if (total <= 0) {
                return;
            }
            const rawPercent = Math.round((event.loaded / total) * 100);
            const percent = Math.min(99, Math.max(0, rawPercent));
            if (percent <= lastPercent) {
                return;
            }
            lastPercent = percent;
            if (typeof onProgress === 'function') {
                onProgress(percent);
            }
        };
        xhr.onload = () => {
            if (typeof onXhrRelease === 'function') {
                onXhrRelease();
            }
            if (xhr.status !== 200) {
                reject(new Error(`下载失败 (HTTP ${xhr.status})`));
                return;
            }
            let data = null;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (error) {
                reject(new Error(`词库解析失败: ${error.message}`));
                return;
            }
            if (!Array.isArray(data)) {
                reject(new Error('词库格式不正确'));
                return;
            }
            resolve(data);
        };
        xhr.onerror = () => {
            if (typeof onXhrRelease === 'function') {
                onXhrRelease();
            }
            reject(new Error('下载失败，请检查网络连接'));
        };
        xhr.onabort = () => {
            if (typeof onXhrRelease === 'function') {
                onXhrRelease();
            }
            reject(cancelErrorFactory());
        };
        xhr.send();
    });
}

/**
 * 保存下载后的词库，并重建中文 Trie 索引缓存。
 */
export async function saveDownloadedVocabulary({
    dict,
    data,
    generateId,
    buildChineseTrieIndex
}) {
    const vocabularies = await chrome.storage.local.get('vocabularies') || {};
    const vocabList = vocabularies.vocabularies || [];
    vocabList.push({
        id: generateId(),
        name: dict.name,
        uploadTime: new Date().toISOString(),
        wordCount: data.length,
        data
    });
    await chrome.storage.local.set({vocabularies: vocabList});
    const trieIndex = buildChineseTrieIndex(vocabList);
    await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
    return vocabList;
}

/**
 * 用服务端词库数据更新本地单个词库条目。
 */
export async function updateVocabularyEntry(vocabList, vocab, dict, fetchData) {
    const data = await fetchData(dict);
    const index = vocabList.findIndex((item) => item.id === vocab.id);
    if (index === -1) {
        return Promise.reject(new Error('本地词库不存在'));
    }
    vocabList[index] = {
        ...vocabList[index],
        name: dict.name || vocabList[index].name,
        uploadTime: new Date().toISOString(),
        wordCount: data.length,
        data
    };
    return vocabList;
}

/**
 * 将更新后的词库写回本地，并重建 Trie 索引缓存。
 */
export async function finalizeVocabulariesUpdate(vocabList, buildChineseTrieIndex) {
    await chrome.storage.local.set({ vocabularies: vocabList });
    if (vocabList.length > 0) {
        const trieIndex = buildChineseTrieIndex(vocabList);
        await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
    } else {
        await chrome.storage.local.remove('vocabularyTrieIndex');
    }
}

/**
 * 计算“当前更新进度 + 总进度”的合并百分比。
 */
export function calculateOverallPercent(processedCount, totalCount, currentPercent) {
    const safeTotal = Math.max(1, Number(totalCount) || 0);
    const safeProcessed = Math.max(0, Number(processedCount) || 0);
    const safePercent = Math.max(0, Math.min(100, Number(currentPercent) || 0));
    const combined = (safeProcessed + safePercent / 100) / safeTotal;
    return Math.round(Math.min(1, Math.max(0, combined)) * 100);
}

