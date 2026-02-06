// content.js - 网页内容脚本，负责文本匹配和替换
// by q2019715 https://www.q2019.com
// for software https://jieci.top

// 跨浏览器 API 兼容 shim (Chrome/Edge 用 chrome.*, Safari 用 browser.*)
const api = globalThis.browser ?? globalThis.chrome;

// ===========常量定义================
let displayMode = 'off'; // 显示模式：'off'、'underline'、'annotation'
let searchProvider = 'youdao';
let phrasesExpanded = false;
let examplesExpanded = false;
let blockedWordsSet = new Set();
let favoriteWordsSet = new Set();
let blockedWordsTrie = null;
let siteBlockRules = [];
let siteBlockIndex = {exact: new Set(), wildcards: []};
let isSiteBlocked = false;
let vocabularyMap = new Map(); // 中文翻译 -> 英文单词的映射
let processedNodes = new WeakSet(); // 记录已处理的节点
let vocabularyTrie = null; // Trie树索引
let maxMatchesPerNode = 3; // 单个文本节点最多标注的词汇数量（可配置）
let blockQuotaRemaining = new WeakMap();
let blockGroupCache = new WeakMap();
let minTextLength = 10; // 容器最小字数，少于此数不添加标注
let annotationMode = 'auto'; // 标注模式：'cn-to-en'、'auto'、'en-to-cn'
let actualAnnotationMode = 'cn-to-en'; // 实际使用的标注模式（auto模式下自动检测）
let cnToEnOrder = 'source-first';
let enToCnOrder = 'source-first';
let speechVoiceURI = '';
let disableAnnotationUnderline = false;
let disableAnnotationTooltip = false;
let highlightColorMode = 'auto';
let highlightColor = '#2196f3';
let vocabularySet = new Set(); // 词汇集合，用于分词
let languageStats = null; // {chineseCount, englishCount, chineseRatio, englishRatio, totalUnits, detected}
let languageDetectDone = false;
let smartSkipCodeLinks = true;
let dedupeMode = 'page'; // off | page | count
let dedupeRepeatCount = 50;
let dedupeSaveTimer = null;
let debugModeEnabled = false;
const dedupeSeen = new Set();
const dedupeRemaining = new Map();
const MERGED_BLOCK_MIN_LENGTH = 40;
let pendingNodes = [];
let pendingNodesSet = new WeakSet();
let processingScheduled = false;
let processingHandle = null;
const PROCESS_BATCH_LIMIT = 200;
const PROCESS_IDLE_TIMEOUT_MS = 200;
let initialProcessingLogged = false;
let annotatedWordCount = 0; // 统计标注的词汇数量
let pendingAsyncCount = 0; // 追踪异步处理数量
let finalLogTimer = null; // 延迟输出最终日志
let spaRescanTimers = [];
let scrollRescanTimer = null;
let voicesReadyPromise = null;
let currentSpeakText = '';
let isSpeaking = false;
let speakToken = 0;
const SCROLL_RESCAN_DELAY_MS = 300;
let diagSkipReasons = {quota: 0, minLength: 0, overflow: 0, noMatch: 0};
let lastDiagReport = 0;

// ========== 工具函数 ==========
function normalizeWord(word) {
    return String(word || '').trim().toLowerCase();
}

function isBlockedWord(word) {
    const normalized = normalizeWord(word);
    if (!normalized) {
        return false;
    }
    if (blockedWordsTrie) {
        return isWordInTrie(normalized, blockedWordsTrie);
    }
    return blockedWordsSet.has(normalized);
}

// ========= 工具函数结束 ==========
// ========== 词库合并相关函数 ==========
// 标准化词性（去除空格、统一小写等）
function normalizeType(type) {
    if (!type) return '';
    return type.trim().toLowerCase();
}

// 分割翻译字符串为单独的词义
function splitMeanings(translation) {
    if (!translation) return [];
    return translation.split(/[,，、；;]/).map(m => m.trim()).filter(m => m.length > 0);
}

// 合并翻译：按词性分组，去重词义，记录来源
function mergeTranslations(existingData, newTranslations, sourceName) {
    if (!newTranslations || !Array.isArray(newTranslations)) return;
    newTranslations.forEach(trans => {
        const type = normalizeType(trans.type) || '_default';
        const meanings = splitMeanings(trans.translation);
        if (!existingData.byType[type]) {
            existingData.byType[type] = {
                type: trans.type || '', // 保留原始格式用于显示
                meanings: [],
                sources: []
            };
        }
        const typeData = existingData.byType[type];
        // 添加新的词义（去重）
        meanings.forEach(meaning => {
            if (!typeData.meanings.includes(meaning)) {
                typeData.meanings.push(meaning);
            }
        });
        // 添加来源（去重）
        if (sourceName && !typeData.sources.includes(sourceName)) {
            typeData.sources.push(sourceName);
        }
    });
}

// 合并短语：去重，记录来源
function mergePhonetics(existingPhonetics, newPhonetics) {
    if (!newPhonetics || typeof newPhonetics !== 'object') return;
    if (!existingPhonetics.uk && typeof newPhonetics.uk === 'string') {
        existingPhonetics.uk = newPhonetics.uk;
    }
    if (!existingPhonetics.us && typeof newPhonetics.us === 'string') {
        existingPhonetics.us = newPhonetics.us;
    }
}

function mergeSentenceExamples(existingExamples, newExamples) {
    if (!newExamples || !Array.isArray(newExamples)) return;
    newExamples.forEach(example => {
        if (!example || (!example.en && !example.zh)) {
            return;
        }
        const en = typeof example.en === 'string' ? example.en : '';
        const zh = typeof example.zh === 'string' ? example.zh : '';
        const exists = existingExamples.some(item => {
            if (en) {
                return item.en === en;
            }
            return item.zh === zh;
        });
        if (!exists) {
            existingExamples.push({en, zh});
        }
    });
}

function mergePhrases(existingPhrases, newPhrases, sourceName) {
    if (!newPhrases || !Array.isArray(newPhrases)) return;
    newPhrases.forEach(phrase => {
        const phraseText = phrase.phrase;
        if (!phraseText) return;
        // 查找是否已存在该短语
        let existing = existingPhrases.find(p => p.phrase === phraseText);
        if (!existing) {
            existing = {
                phrase: phraseText,
                translations: [],
                sources: []
            };
            existingPhrases.push(existing);
        }
        // 合并翻译（兼容不同字段命名）
        const translationCandidates = [];
        if (Array.isArray(phrase.translations)) {
            translationCandidates.push(...phrase.translations);
        } else if (Array.isArray(phrase.trans)) {
            translationCandidates.push(...phrase.trans);
        } else if (Array.isArray(phrase.meanings)) {
            translationCandidates.push(...phrase.meanings);
        } else if (typeof phrase.translation === 'string') {
            translationCandidates.push(phrase.translation);
        } else if (typeof phrase.trans === 'string') {
            translationCandidates.push(phrase.trans);
        }
        translationCandidates.forEach(t => {
            if (!t) {
                return;
            }
            if (!existing.translations.includes(t)) {
                existing.translations.push(t);
            }
        });
        // 添加来源
        if (sourceName && !existing.sources.includes(sourceName)) {
            existing.sources.push(sourceName);
        }
    });
}

// 创建空的合并数据结构
function createEmptyMergedData(word) {
    return {
        word: word,
        byType: {},           // { 'n': { type: 'n', meanings: [...], sources: [...] }, ... }
        phrases: [],          // [{ phrase, translations, sources }, ...]
        phonetics: {uk: '', us: ''},
        sentenceExamples: [],
        sources: [],          // 所有来源词库
        wordLength: word.length
    };
}

// 从合并后的数据中获取第一个词义（用于行内显示）
// preferredPOS: 优先使用的词性（可选）
function getFirstMeaning(data, preferredPOS = null) {
    if (!data || !data.byType) return '';
    // 如果指定了优先词性，先尝试匹配
    if (preferredPOS) {
        const matchedType = findMatchingType(data.byType, preferredPOS);
        if (matchedType && data.byType[matchedType] && data.byType[matchedType].meanings.length > 0) {
            return data.byType[matchedType].meanings[0];
        }
    }
    // 按词性优先级排序（名词 > 动词 > 形容词 > 其他）
    const typeOrder = ['n', 'v', 'vt', 'vi', 'adj', 'adv', '_default'];
    const types = Object.keys(data.byType);
    for (const t of typeOrder) {
        if (types.includes(t) && data.byType[t].meanings.length > 0) {
            return data.byType[t].meanings[0];
        }
    }
    // 如果没有匹配优先级，返回第一个可用的
    for (const t of types) {
        if (data.byType[t].meanings.length > 0) {
            return data.byType[t].meanings[0];
        }
    }
    return '';
}

// ========== 词库合并相关函数结束 ==========
// ================分词相关函数开始===============
const EN_SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', {granularity: 'word'}) : null;
const EN_STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'done', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'not', 'no', 'yes', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their', 'our', 'mine', 'yours', 'hers', 'theirs', 'ours']);

function requestJiebaTokens(text) {
    return requestJiebaPayload('jieba-tokenize', text, 'tokens');
}

function getWordSegments(text, segmenter) {
    if (!segmenter) {
        return [];
    }
    const segments = [];
    for (const part of segmenter.segment(text)) {
        if (!part.isWordLike) {
            continue;
        }
        segments.push({
            text: part.segment,
            start: part.index,
            end: part.index + part.segment.length
        });
    }
    return segments;
}

function segmentChinese(text) {
    const forward = segmentChineseForward(text);
    const backward = segmentChineseBackward(text);
    const chosen = chooseBetterSegments(forward, backward, text);
    return suppressSingleCharInRun(chosen, text);
}

function segmentChineseForward(text) {
    const segments = [];
    let i = 0;
    const maxLen = Math.max(...Array.from(vocabularySet).map(w => w.length), 4);
    while (i < text.length) {
        const char = text[i];
        if (isChinese(char)) {
            let matched = false;
            for (let len = Math.min(maxLen, text.length - i); len > 0; len--) {
                const word = text.substr(i, len);
                if (vocabularySet.has(word)) {
                    segments.push({
                        text: word,
                        start: i,
                        end: i + len,
                        isVocab: true
                    });
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                segments.push({
                    text: char,
                    start: i,
                    end: i + 1,
                    isVocab: false
                });
                i++;
            }
        } else {
            let j = i;
            while (j < text.length && !isChinese(text[j])) {
                j++;
            }
            segments.push({
                text: text.substring(i, j),
                start: i,
                end: j,
                isVocab: false
            });
            i = j;
        }
    }
    return segments;
}

function segmentChineseBackward(text) {
    const segments = [];
    let i = text.length - 1;
    const maxLen = Math.max(...Array.from(vocabularySet).map(w => w.length), 4);
    while (i >= 0) {
        const char = text[i];
        if (isChinese(char)) {
            let matched = false;
            for (let len = Math.min(maxLen, i + 1); len > 0; len--) {
                const start = i - len + 1;
                const word = text.substring(start, i + 1);
                if (vocabularySet.has(word)) {
                    segments.push({
                        text: word,
                        start,
                        end: i + 1,
                        isVocab: true
                    });
                    i -= len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                segments.push({
                    text: char,
                    start: i,
                    end: i + 1,
                    isVocab: false
                });
                i--;
            }
        } else {
            let j = i;
            while (j >= 0 && !isChinese(text[j])) {
                j--;
            }
            segments.push({
                text: text.substring(j + 1, i + 1),
                start: j + 1,
                end: i + 1,
                isVocab: false
            });
            i = j;
        }
    }
    return segments.reverse();
}

function chooseBetterSegments(forward, backward, text) {
    const forwardStats = getSegmentationStats(forward, text);
    const backwardStats = getSegmentationStats(backward, text);
    if (forwardStats.singleCharInRun !== backwardStats.singleCharInRun) {
        return forwardStats.singleCharInRun < backwardStats.singleCharInRun ? forward : backward;
    }
    if (forwardStats.segmentCount !== backwardStats.segmentCount) {
        return forwardStats.segmentCount < backwardStats.segmentCount ? forward : backward;
    }
    if (forwardStats.vocabCount !== backwardStats.vocabCount) {
        return forwardStats.vocabCount > backwardStats.vocabCount ? forward : backward;
    }
    return forward;
}

function getSegmentationStats(segments, text) {
    let singleCharInRun = 0;
    let vocabCount = 0;
    segments.forEach(segment => {
        if (segment.isVocab) {
            vocabCount++;
        }
        if (
            segment.isVocab &&
            segment.text.length === 1 &&
            isChinese(segment.text) &&
            hasChineseNeighbor(text, segment.start)
        ) {
            singleCharInRun++;
        }
    });
    return {
        singleCharInRun,
        segmentCount: segments.length,
        vocabCount
    };
}

function suppressSingleCharInRun(segments, text) {
    return segments.map(segment => {
        if (
            segment.isVocab &&
            segment.text.length === 1 &&
            isChinese(segment.text) &&
            hasChineseNeighbor(text, segment.start)
        ) {
            return {
                text: segment.text,
                start: segment.start,
                end: segment.end,
                isVocab: false
            };
        }
        return segment;
    });
}

function hasChineseNeighbor(text, index) {
    if (index > 0 && isChinese(text[index - 1])) {
        return true;
    }
    return !!(index + 1 < text.length && isChinese(text[index + 1]));
}

function isChinese(char) {
    const code = char.charCodeAt(0);
    // 中文字符 Unicode 范围：4E00-9FFF
    return code >= 0x4E00 && code <= 0x9FFF;
}

function normalizeMaxMatches(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return Infinity;
    }
    return Math.max(1, Math.floor(num));
}

// ================分词相关函数结束===============
// ========== 词性推断相关函数 ==========
async function requestJiebaPayload(messageType, text, resultKey) {
    if (!api.runtime || !api.runtime.sendMessage) {
        return null;
    }
    try {
        const response = await api.runtime.sendMessage({type: messageType, text});
        if (!response || !response.ok || !Array.isArray(response[resultKey])) {
            return null;
        }
        return response[resultKey];
    } catch (e) {
        diagLog('[jieba]', messageType, 'failed:', e);
        return null;
    }
}

// 请求 jieba 词性标注
function requestJiebaTags(text) {
    return requestJiebaPayload('jieba-tag', text, 'tags');
}

// 标准化 jieba 词性到简单词性
function normalizeJiebaTag(tag) {
    if (!tag) return '';
    const t = tag.toLowerCase();
    // jieba 词性映射：n=名词, v=动词, a=形容词, d=副词, r=代词, etc.
    if (t.startsWith('n')) return 'n';    // n, nr, ns, nt, nz...
    if (t.startsWith('v')) return 'v';    // v, vd, vn...
    if (t.startsWith('a')) return 'adj';  // a, ad, an...
    if (t === 'd') return 'adv';
    return t;
}

// 英文词性推断（基于上下文规则）
const EN_FUNCTION_WORDS = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'some', 'any', 'no', 'every', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did',
    'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'from', 'into', 'through', 'during', 'after',
    'before', 'above', 'below', 'between', 'under', 'over', 'and', 'or', 'but', 'if', 'then', 'than'
]);

// 英文词性推断（启发式规则）
function inferEnglishPOS(text, wordStart, wordEnd) {
    const prevText = text.substring(Math.max(0, wordStart - 15), wordStart).toLowerCase();
    const nextText = text.substring(wordEnd, Math.min(text.length, wordEnd + 10)).toLowerCase();
    const word = text.substring(wordStart, wordEnd).toLowerCase();
    const nextWordMatch = nextText.match(/^\s*([a-zA-Z]+)/);
    const nextWord = nextWordMatch ? nextWordMatch[1].toLowerCase() : '';
    const candidates = [];
    const addCandidate = (pos, score, rule, method = 'rule') => {
        candidates.push({pos, score, method, rule});
    };
    // 规则1：冠词/指示词/物主限定词 + word → 更可能是名词
    if (/\b(the|a|an|this|that|these|those|my|your|his|her|its|our|their|some|any|no|every)\s*$/.test(prevText)) {
        addCandidate('n', 0.6, '冠词/限定词');
    }
    // 规则2：to + word → 更可能是动词原形
    if (/\bto\s*$/.test(prevText)) {
        addCandidate('v', 0.95, '`to` 后');
    }
    // 规则3：情态/助动词 + word → 更可能是动词
    if (/\b(will|would|can|could|shall|should|may|might|must|do|does|did)\s*$/.test(prevText)) {
        addCandidate('v', 0.9, '情态/助动词后');
    }
    // 规则4：be 系动词/助动词 + word → -ing 更偏动词；否则可能是形容词（表语）
    if (/\b(am|is|are|was|were|be|been|being)\s*$/.test(prevText)) {
        if (word.endsWith('ing')) {
            addCandidate('v', 0.85, 'be + -ing');
        }
        addCandidate('adj', 0.7, 'be 后表语');
    }
    // have/has/had + -ed → 更可能是过去分词作动词
    if (/\b(have|has|had)\s*$/.test(prevText) && word.endsWith('ed')) {
        addCandidate('v', 0.85, 'have/has/had + -ed');
    }
    // 主语代词后面 → 更可能接动词
    if (/\b(i|you|he|she|it|we|they)\s*$/.test(prevText)) {
        addCandidate('v', 0.75, '主语代词后');
    }
    // 规则5：介词 + word → 更可能是名词/名词短语
    if (/\b(in|on|at|by|for|with|about|from|into|through|during|before|after|above|below|between|under|over)\s*$/.test(prevText)) {
        addCandidate('n', 0.7, '介词后');
    }
    // 规则6：-ly 结尾 → 更可能是副词
    if (word.endsWith('ly')) {
        addCandidate('adv', 0.7, '-ly 后缀');
    }
    // 程度副词（very/so/too...）后面通常接形容词或副词
    if (/\b(very|so|too|quite|rather|really|extremely)\s*$/.test(prevText)) {
        addCandidate(word.endsWith('ly') ? 'adv' : 'adj', 0.65, '程度副词后');
    }
    // -ing + 后面跟名词 → 更可能是形容词（现在分词作定语）
    if (word.endsWith('ing') && nextWord) {
        let strongNoun = false;
        if (vocabularyMap.has(nextWord)) {
            const nextData = vocabularyMap.get(nextWord);
            if (nextData && nextData.byType) {
                const nextTypes = Object.keys(nextData.byType).map(normalizeType);
                strongNoun = nextTypes.length === 1 && nextTypes[0] === 'n';
            }
        }
        if (strongNoun) {
            addCandidate('adj', 0.85, '-ing + 名词');
        } else if (!EN_FUNCTION_WORDS.has(nextWord)) {
            addCandidate('adj', 0.7, '-ing + 非功能词');
        }
    }
    // 常见后缀启发式
    if (/(tion|sion|ment|ness|ity|ism)$/.test(word)) {
        addCandidate('n', 0.55, '名词后缀');
    }
    if (/(ous|able|ible|ive|al|ful|less|ic)$/.test(word) && word.length > 3) {
        addCandidate('adj', 0.55, '形容词后缀');
    }
    if (/(ize|ise|ify)$/.test(word) && word.length > 3) {
        addCandidate('v', 0.55, '动词后缀');
    }
    // 规则7：句首/标点后，根据后面出现的模式做一个弱推断
    if (/^[\s]*$/.test(prevText) || /[,.!?]\s*$/.test(prevText)) {
        // 7a：后面紧跟介词（on/in/at/to...）→ 可能是祈使句里的动词（如 "Click on ..."）
        if (/^\s*(on|in|at|to|for|with|about|from|into|out|up|down|off|over|through)\b/i.test(nextText)) {
            addCandidate('v', 0.65, '句首 + 介词短语');
        }
        // 7b：后面紧跟 be/have/情态 → 当前词可能是名词（作主语）
        if (/^\s*(is|are|was|were|has|have|had|will|would|can|could|shall|should|may|might|must)\b/i.test(nextText)) {
            addCandidate('n', 0.6, '句首 + 助动/情态');
        }
        // 7c：后面紧跟限定词/代词 → 当前词可能是动词（祈使句 + 宾语）
        if (/^\s*(the|a|an|this|that|these|those|it|them|him|her|me|us|you|my|your|his|its|our|their)\b/i.test(nextText)) {
            addCandidate('v', 0.6, '句首 + 宾语');
        }
    }
    // 基于词表：利用前一个词的已知词性做弱约束
    const prevWord = extractPrevWord(text, wordStart);
    if (prevWord) {
        const prevWordLower = prevWord.toLowerCase();
        if (vocabularyMap.has(prevWordLower)) {
            const prevData = vocabularyMap.get(prevWordLower);
            if (prevData && prevData.byType) {
                const types = Object.keys(prevData.byType);
                if (types.length === 1) {
                    // 前一个词只有一种词性时，做简单搭配推断
                    const prevType = normalizeType(types[0]);
                    if (prevType === 'v' || prevType === 'vt' || prevType === 'vi') {
                        addCandidate('n', 0.55, `前一个词 "${prevWord}" 是动词`, 'vocab');
                    }
                    if (prevType === 'adj') {
                        addCandidate('n', 0.55, `前一个词 "${prevWord}" 是形容词`, 'vocab');
                    }
                    if (prevType === 'n') {
                        addCandidate('v', 0.55, `前一个词 "${prevWord}" 是名词`, 'vocab');
                    }
                }
            }
        }
    }
    if (candidates.length === 0) {
        return null;
    }
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate.score > best.score) {
            best = candidate;
        }
    }
    return {pos: best.pos, method: best.method, rule: best.rule};
}

function extractPrevWord(text, position) {
    // 向前找空格或标点，提取前一个单词
    let end = position;
    // 跳过空格
    while (end > 0 && /\s/.test(text[end - 1])) {
        end--;
    }
    if (end === 0) return null;
    let start = end;
    // 向前找单词边界
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
        start--;
    }
    if (start === end) return null;
    return text.substring(start, end);
}

// jieba 词性到词库词性的映射
const JIEBA_TO_VOCAB_POS = {
    'n': ['n', 'n.'],
    'v': ['v', 'v.', 'vt', 'vt.', 'vi', 'vi.'],
    'adj': ['adj', 'adj.', 'a', 'a.'],
    'adv': ['adv', 'adv.', 'd'],
};

// 查找匹配的词性
function findMatchingType(byType, posTag) {
    if (!posTag || !byType) return null;
    const normalizedTag = posTag.toLowerCase().replace('.', '');
    const candidates = JIEBA_TO_VOCAB_POS[normalizedTag] || [normalizedTag];
    for (const candidate of candidates) {
        // 直接匹配
        if (byType[candidate]) return candidate;
        // 尝试带点的版本
        if (byType[candidate + '.']) return candidate + '.';
        // 尝试不带点的版本
        const withoutDot = candidate.replace('.', '');
        if (byType[withoutDot]) return withoutDot;
    }
    return null;
}

// ========== 词性推断相关函数结束 ==========
// ===================页面修改相关函数开始===============
function applyHighlightColor(mode, color) {
    if (mode === 'none') {
        // 不更改颜色，设置为继承原文本颜色
        setHighlightCssVars('inherit');
        return;
    }
    const resolved = mode === 'custom' ? color : getHighContrastColor(getPageBackgroundColor());
    setHighlightCssVars(resolved || '#2196f3');
}

function getPageBackgroundColor() {
    const body = document.body;
    const bodyColor = body ? window.getComputedStyle(body).backgroundColor : '';
    const html = document.documentElement;
    const htmlColor = html ? window.getComputedStyle(html).backgroundColor : '';
    return pickOpaqueColor([bodyColor, htmlColor]) || 'rgb(255, 255, 255)';
}

function pickOpaqueColor(colors) {
    for (const color of colors) {
        const parsed = parseCssColor(color);
        if (parsed && parsed.a > 0.05) {
            return `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
        }
    }
    return null;
}

function getHighContrastColor(background) {
    const parsed = parseCssColor(background);
    if (!parsed) {
        return '#000000';
    }
    const luminance = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b);
    return luminance > 140 ? '#000000' : '#ffffff';
}

function setHighlightCssVars(color) {
    const root = document.documentElement;
    // 如果是 'inherit'，保持原文本颜色
    if (color === 'inherit') {
        root.style.setProperty('--vocab-highlight-color', 'inherit');
        root.style.setProperty('--vocab-highlight-bg', 'transparent');
        root.style.setProperty('--vocab-highlight-bg-strong', 'rgba(128, 128, 128, 0.1)');
        return;
    }
    const rgb = parseCssColor(color) || parseCssColor('#2196f3');
    if (!rgb) {
        return;
    }
    root.style.setProperty('--vocab-highlight-color', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    root.style.setProperty('--vocab-highlight-bg', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    root.style.setProperty('--vocab-highlight-bg-strong', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
}

function parseCssColor(value) {
    if (!value) {
        return null;
    }
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'transparent') {
        return {r: 0, g: 0, b: 0, a: 0};
    }
    const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10),
            a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
        };
    }
    const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                r: int(hex[0] + hex[0]),
                g: int(hex[1] + hex[1]),
                b: int(hex[2] + hex[2]),
                a: 1
            };
        }
        return {
            r: int(hex.slice(0, 2)),
            g: int(hex.slice(2, 4)),
            b: int(hex.slice(4, 6)),
            a: 1
        };
    }
    return null;

    function int(h) {
        return parseInt(h, 16);
    }
}

function formatInlineAnnotation(sourceText, targetText, order) {
    if (!targetText) {
        return sourceText;
    }
    if (order === 'target-first') {
        return `${targetText}(${sourceText})`;
    }
    return `${sourceText}(${targetText})`;
}

function createHighlightSpan(matchText, data, posTag = null) {
    if (isBlockedWord(matchText)) {
        return document.createTextNode(matchText);
    }
    const span = document.createElement('span');
    span.className = 'vocab-highlight';
    span.dataset.originalText = matchText;
    if (displayMode === 'annotation' && disableAnnotationUnderline) {
        span.classList.add('vocab-no-underline');
    }
    // 确定实际使用的标注模式
    const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;
    if (effectiveMode === 'cn-to-en' && data && isBlockedWord(data.word)) {
        diagLog('Blocked word skipped (cn-to-en render):', data.word);
        return document.createTextNode(matchText);
    }
    // 提取实际的词性字符串
    const actualPOS = posTag ? (typeof posTag === 'string' ? posTag : posTag.pos) : null;
    // 根据显示模式决定是否显示括号内容
    if (displayMode === 'underline') {
        // 下划线模式：只显示原文，不显示括号
        span.textContent = matchText;
    } else if (displayMode === 'annotation') {
        // 标注模式：显示原文和括号
        if (effectiveMode === 'cn-to-en') {
            const englishWord = data.word;
            span.textContent = formatInlineAnnotation(matchText, englishWord, cnToEnOrder);
        } else if (effectiveMode === 'en-to-cn') {
            // 从合并后的 byType 获取翻译，优先使用推断的词性
            const firstMeaning = getFirstMeaning(data, actualPOS);
            span.textContent = formatInlineAnnotation(matchText, firstMeaning, enToCnOrder);
        }
    }
    // 保存 posTag 到 data 中，供 tooltip 使用
    const dataWithPOS = {...data, _posTag: posTag};
    const showTooltip = () => {
        if (globalTooltipHideTimer) {
            clearTimeout(globalTooltipHideTimer);
            globalTooltipHideTimer = null;
        }
        const tooltip = getGlobalTooltip();
        globalTooltipOwner = span;
        isHoveringHighlight = true;
        isHoveringTooltip = false;
        const wasPinned = isTooltipPinned;
        if (!wasPinned) {
            isTooltipPinned = false;
            tooltipManualPositioned = false;
        } else {
            tooltipManualPositioned = true;
        }
        isTooltipDragging = false;
        tooltipDragOffset = null;
        tooltip.replaceChildren();
        const header = buildTooltipHeader();
        const content = document.createElement('div');
        content.className = 'vocab-tooltip-content';
        const contentBody = createTooltipContent(dataWithPOS, matchText);
        if (contentBody) {
            content.appendChild(contentBody);
        }
        tooltip.appendChild(header);
        tooltip.appendChild(content);
        ensureTooltipResizeHandles(tooltip);
        tooltipSize = applyTooltipSize(tooltip, tooltipSize);
        const pinButton = tooltip.querySelector('.vocab-tooltip-pin');
        if (pinButton) {
            pinButton.classList.toggle('is-pinned', isTooltipPinned);
            pinButton.setAttribute('aria-pressed', isTooltipPinned ? 'true' : 'false');
        }
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        const contentDiv = tooltip.querySelector('.vocab-tooltip-content');
        if (contentDiv) {
            contentDiv.scrollTop = 0;
        }
        isTooltipVisible = true;
        if (!isTooltipPinned) {
            positionTooltip(span, tooltip);
        }
        tooltip.style.visibility = 'visible';
    };
    const scheduleHide = () => {
        if (globalTooltipHideTimer) {
            clearTimeout(globalTooltipHideTimer);
        }
        globalTooltipHideTimer = setTimeout(() => {
            const hoveringHighlight = isElementHovered(span);
            const hoveringTooltip = isElementHovered(globalTooltip);
            const pointerInsideTooltip = isPointerInsideTooltip();
            if (hoveringHighlight || hoveringTooltip || pointerInsideTooltip || isHoveringHighlight || isHoveringTooltip) {
                return;
            }
            hideGlobalTooltip();
        }, TOOLTIP_HIDE_DELAY_MS);
    };
    const allowTooltip = !(displayMode === 'annotation' && disableAnnotationTooltip);
    if (allowTooltip) {
        span.addEventListener('mouseenter', showTooltip);
        span.addEventListener('mouseleave', () => {
            isHoveringHighlight = false;
            scheduleHide();
        });
    }
    return span;
}

function applyMatchesToTextNode(textNode, text, matches, effectiveMode, maxCount = maxMatchesPerNode) {
    if (!matches || matches.length === 0) {
        return {appliedCount: 0, reason: 'no-matches', selectedCount: 0, dedupedCount: 0};
    }
    const selectedMatches = selectMatchesWithDistribution(matches, text.length, maxCount);
    if (selectedMatches.length === 0) {
        return {appliedCount: 0, reason: 'selection-empty', selectedCount: 0, dedupedCount: 0};
    }
    const dedupedMatches = [];
    selectedMatches.forEach(match => {
        if (!shouldSkipAnnotationDueToParen(text, match) && shouldAllowDedupeMatch(match.matchText, effectiveMode)) {
            dedupedMatches.push(match);
        }
    });
    if (dedupedMatches.length === 0) {
        return {appliedCount: 0, reason: 'dedupe-filtered', selectedCount: selectedMatches.length, dedupedCount: 0};
    }
    diagLog(`Found ${matches.length} matches; selected ${dedupedMatches.length}.`, dedupedMatches.map(m => m.matchText));
    dedupedMatches.sort((a, b) => a.start - b.start);
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    dedupedMatches.forEach(match => {
        if (match.start > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
        }
        const span = createHighlightSpan(match.matchText, match.data, match.posTag);
        fragment.appendChild(span);
        lastIndex = match.end;
    });
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    try {
        if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
            diagLog('Replaced text node with annotations.');
            // 增加标注词汇统计
            annotatedWordCount += dedupedMatches.length;
        }
    } catch (error) {
        console.error('Failed to replace text node:', error);
    }
    return {
        appliedCount: dedupedMatches.length,
        reason: 'applied',
        selectedCount: selectedMatches.length,
        dedupedCount: dedupedMatches.length
    };
}

function processNode(node) {
    // 跳过不需要处理的节点
    if (!node || processedNodes.has(node)) return;
    const baseExcludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'];
    const smartExcludedTags = smartSkipCodeLinks ? ['A', 'CODE', 'PRE'] : [];
    const excludeTags = baseExcludedTags.concat(smartExcludedTags);
    if (node.nodeType === Node.ELEMENT_NODE && excludeTags.includes(node.tagName)) {
        return;
    }
    // 跳过已处理的标注
    if (node.classList && node.classList.contains('vocab-highlight')) {
        return;
    }
    // 跳过提示框（防止对提示框内容进行标注）
    if (node.classList && node.classList.contains('vocab-tooltip')) {
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        if (isInsideVocabTooltip(node)) {
            return;
        }
        if (isInsideExcludedElement(node, excludeTags)) {
            return;
        }
        processTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        // 递归处理子节点
        const children = Array.from(node.childNodes);
        children.forEach(child => enqueueNode(child));
    }
    processedNodes.add(node);
}

function isInsideExcludedElement(node, excludeTags) {
    let current = node.parentNode;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (excludeTags.includes(current.tagName)) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

function isInsideCooked(node) {
    let current = node.parentNode;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.classList && current.classList.contains('cooked')) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

function isInsideVocabTooltip(node) {
    let current = node.parentNode;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.classList && current.classList.contains('vocab-tooltip')) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

function isInsideVocabHighlight(node) {
    let current = node.parentNode;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.classList && current.classList.contains('vocab-highlight')) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

// 检测容器内容是否满足最小字数要求
function meetsMinTextLength(textNode) {
    try {
        // 找到最近的块级父容器
        let container = textNode.parentElement;
        if (!container) {
            return true; // 无容器时允许标注
        }
        // 向上查找合适的容器（最多3层）
        for (let i = 0; i < 3 && container; i++) {
            const style = window.getComputedStyle(container);
            const display = style.display;
            // 如果是块级容器，检查其文本长度
            if (display === 'block' || display === 'flex' || display === 'grid' ||
                display === 'list-item' || display === 'table-cell') {
                break;
            }
            container = container.parentElement;
        }
        if (!container) {
            return true;
        }
        // 获取容器的纯文本内容
        const containerText = container.textContent || '';
        const textLength = containerText.trim().length;
        // 如果容器文本长度小于最小要求，返回false
        return textLength >= minTextLength;
    } catch (error) {
        diagLog('最小字数检测出错:', error);
        return true; // 出错时允许标注
    }
}

function processTextNode(textNode) {
    const rawText = textNode.textContent || '';
    const diagPreview = formatDiagText(rawText);
    diagLog('Text node:', diagPreview);
    if (!rawText || rawText.trim().length === 0) {
        diagLog('Text node status:', 'dropped', 'reason:', 'empty');
        return;
    }
    // Ensure parent node exists.
    if (!textNode.parentNode) {
        diagLog('Text node status:', 'dropped', 'reason:', 'no-parent');
        return;
    }
    const blockGroupKey = getBlockGroupKey(textNode);
    if (getBlockQuotaRemaining(blockGroupKey) <= 0) {
        diagSkipReasons.quota++;
        diagLog('Text node status:', 'dropped', 'reason:', 'quota');
        return;
    }
    const insideCooked = isInsideCooked(textNode);
    // Minimum length check.
    if (minTextLength > 0 && !insideCooked && !meetsMinTextLength(textNode)) {
        diagSkipReasons.minLength++;
        // 添加详细诊断
        const container = getNearestBlockContainer(textNode);
        const textLen = container ? container.textContent.trim().length : 0;
        diagLog('Text node status:', 'dropped', 'reason:', `min-length (minTextLength=${minTextLength}, containerLength=${textLen})`);
        reportDiagSkipReasons();
        diagLog('Skipped annotation: container text below minimum length.');
        return;
    }
    const text = textNode.textContent;
    const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;
    if (effectiveMode === 'cn-to-en') {
        // 使用词性标注获取带词性的分词结果
        pendingAsyncCount++; // 追踪异步处理
        requestJiebaTags(text).then((tags) => {
            if (!textNode.parentNode || textNode.textContent !== text) {
                pendingAsyncCount--;
                diagLog('Text node status:', 'dropped', 'reason:', 'stale-node');
                return;
            }
            const remainingQuota = getBlockQuotaRemaining(blockGroupKey);
            if (remainingQuota <= 0) {
                pendingAsyncCount--;
                diagLog('Text node status:', 'dropped', 'reason:', 'quota');
                return;
            }
            const matches = [];
            if (tags && tags.length > 0) {
                const tagItems = tags.map(tag => `${tag.word}/${normalizeJiebaTag(tag.tag)}`);
                diagLog('Segmentation (jieba tags):', formatDiagList(tagItems));
                // 计算每个词的位置（jieba tag 返回的没有位置信息，需要自己计算）
                let currentPos = 0;
                tags.forEach((tag) => {
                    const word = tag.word;
                    const wordStart = text.indexOf(word, currentPos);
                    if (wordStart === -1) {
                        currentPos += word.length;
                        return;
                    }
                    const wordEnd = wordStart + word.length;
                    currentPos = wordEnd;
                    if (isBlockedWord(word)) {
                        diagLog('Blocked word skipped (jieba tag):', word);
                        return;
                    }
                    if (vocabularyTrie && vocabularyTrie.root && !isWordInVocabularyTrie(word)) {
                        return;
                    }
                    if (vocabularyMap.has(word)) {
                        const data = vocabularyMap.get(word);
                        if (data && isBlockedWord(data.word)) {
                            diagLog('Blocked word skipped (cn-to-en match):', data.word);
                            return;
                        }
                        const posTag = normalizeJiebaTag(tag.tag);
                        matches.push({
                            start: wordStart,
                            end: wordEnd,
                            matchText: word,
                            data: data,
                            posTag: posTag,  // 保存词性信息
                            priority: calculatePriority(word, data, wordStart, text.length)
                        });
                    }
                });
            } else {
                // Fallback: 使用 tokenize 或本地分词
                requestJiebaTokens(text).then((tokens) => {
                    if (!textNode.parentNode || textNode.textContent !== text) {
                        pendingAsyncCount--;
                        diagLog('Text node status:', 'dropped', 'reason:', 'stale-node');
                        return;
                    }
                    if (tokens && tokens.length > 0) {
                        const tokenItems = tokens.map(token => `${token.word}@${token.start}`);
                        diagLog('Segmentation (jieba tokens):', formatDiagList(tokenItems));
                        tokens.forEach((token) => {
                            if (isBlockedWord(token.word)) {
                                diagLog('Blocked word skipped (jieba token):', token.word);
                                return;
                            }
                            if (vocabularyTrie && vocabularyTrie.root && !isWordInVocabularyTrie(token.word)) {
                                return;
                            }
                            if (vocabularyMap.has(token.word)) {
                                const data = vocabularyMap.get(token.word);
                                if (data && isBlockedWord(data.word)) {
                                    diagLog('Blocked word skipped (cn-to-en match):', data.word);
                                    return;
                                }
                                matches.push({
                                    start: token.start,
                                    end: token.end,
                                    matchText: token.word,
                                    data: data,
                                    posTag: null,
                                    priority: calculatePriority(token.word, data, token.start, text.length)
                                });
                            }
                        });
                    } else {
                        // Fallback: use local segmentation when jieba tokens are unavailable.
                        const segments = segmentChinese(text);
                        const segmentItems = segments.map(segment => `${segment.text}${segment.isVocab ? '*' : ''}`);
                        diagLog('Segmentation (local):', formatDiagList(segmentItems));
                        segments.forEach((segment) => {
                            if (!segment.isVocab) {
                                return;
                            }
                            if (isBlockedWord(segment.text)) {
                                diagLog('Blocked word skipped (local segment):', segment.text);
                                return;
                            }
                            if (vocabularyTrie && vocabularyTrie.root && !isWordInVocabularyTrie(segment.text)) {
                                return;
                            }
                            if (vocabularyMap.has(segment.text)) {
                                const data = vocabularyMap.get(segment.text);
                                if (data && isBlockedWord(data.word)) {
                                    diagLog('Blocked word skipped (cn-to-en match):', data.word);
                                    return;
                                }
                                matches.push({
                                    start: segment.start,
                                    end: segment.end,
                                    matchText: segment.text,
                                    data: data,
                                    posTag: null,
                                    priority: calculatePriority(segment.text, data, segment.start, text.length)
                                });
                            }
                        });
                    }
                    const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
                    consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
                    diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
                    const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
                    diagLog('Matches (cn-to-en):', matches.length, 'items:', formatDiagList(matchItems));
                    pendingAsyncCount--;
                });
                return;
            }
            const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
            consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
            diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
            const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
            diagLog('Matches (cn-to-en):', matches.length, 'items:', formatDiagList(matchItems));
            pendingAsyncCount--;
        });
        return;
    }
    if (effectiveMode === 'en-to-cn') {
        if (!EN_SEGMENTER) {
            diagLog('Intl.Segmenter unavailable; skipping segmentation.');
            diagLog('Text node status:', 'dropped', 'reason:', 'segmenter-unavailable');
            return;
        }
        const remainingQuota = getBlockQuotaRemaining(blockGroupKey);
        if (remainingQuota <= 0) {
            diagLog('Text node status:', 'dropped', 'reason:', 'quota');
            return;
        }
        const matches = [];
        const segments = getWordSegments(text, EN_SEGMENTER);
        const segmentItems = segments.map(segment => `${segment.text}@${segment.start}`);
        diagLog('Segmentation (en):', formatDiagList(segmentItems));
        segments.forEach(segment => {
            const englishWord = segment.text.toLowerCase();
            if (EN_STOPWORDS.has(englishWord)) {
                return;
            }
            if (isBlockedWord(englishWord)) {
                diagLog('Blocked word skipped (en segment):', englishWord);
                return;
            }
            if (vocabularyMap.has(englishWord) && !isBlockedWord(englishWord)) {
                const data = vocabularyMap.get(englishWord);
                // 推断英文单词的词性
                const inferredPOS = inferEnglishPOS(text, segment.start, segment.end);
                matches.push({
                    start: segment.start,
                    end: segment.end,
                    matchText: segment.text,
                    data: data,
                    posTag: inferredPOS,  // 保存推断的词性
                    priority: calculatePriority(segment.text, data, segment.start, text.length)
                });
            }
        });
        const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
        consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
        diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
        const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
        diagLog('Matches (en-to-cn):', matches.length, 'items:', formatDiagList(matchItems));
    }
}

function isInternalAnnotationNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }
    const el = node;
    if (el.classList && (el.classList.contains('vocab-highlight') || el.classList.contains('vocab-tooltip') || el.classList.contains('vocab-tooltip-resize-handle'))) {
        return true;
    }
    return !!el.closest('.vocab-tooltip');
}

// ===================页面修改相关函数结束===============
// ====================弹窗相关的函数==============
let globalTooltip = null;
let globalTooltipOwner = null;
let isTooltipVisible = false;
let globalTooltipHideTimer = null;
let tooltipListenersAttached = false;
let isHoveringHighlight = false;
let isHoveringTooltip = false;
let isTooltipPinned = false;
let isTooltipDragging = false;
let tooltipDragOffset = null;
let tooltipManualPositioned = false;
let pointerTrackerAttached = false;
let lastPointerPosition = null;
const TOOLTIP_HIDE_DELAY_MS = 100;
const TOOLTIP_SIZE_STORAGE_KEY = 'tooltipSize';
const TOOLTIP_SIZE_DEFAULT = {width: 360, height: 280};
const TOOLTIP_SIZE_MIN = {width: 260, height: 200};
const TOOLTIP_SIZE_MAX = {width: 600, height: 480};
let tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
let tooltipResizeState = null;
let tooltipSizeSaveTimer = null;

function getSearchProviderConfig(word, provider) {
    const safeWord = String(word || '');
    const encodedWord = encodeURIComponent(safeWord);
    const slugWord = encodeURIComponent(safeWord.trim().toLowerCase().replace(/\s+/g, '-'));
    const queryWord = encodedWord.replace(/%20/g, '+');
    const providers = {
        youdao: {
            label: '有道词典',
            url: `https://www.youdao.com/result?word=${encodedWord}&lang=en`
        },
        bing: {
            label: '必应词典',
            url: `https://www.bing.com/dict/search?q=${encodedWord}`
        },
        cambridge: {
            label: '剑桥在线词典',
            url: `https://dictionary.cambridge.org/zhs/spellcheck/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/?q=${queryWord}`
        },
        collins: {
            label: '柯林斯在线词典',
            url: `https://www.collinsdictionary.com/dictionary/english/${slugWord}`
        }
    };
    return providers[provider] || providers.youdao;
}

function canSpeakWord() {
    return typeof window !== 'undefined'
        && 'speechSynthesis' in window
        && typeof window.SpeechSynthesisUtterance === 'function';
}

function stopSpeaking() {
    if (!canSpeakWord()) {
        return;
    }
    window.speechSynthesis.cancel();
    isSpeaking = false;
    currentSpeakText = '';
}

function waitForVoices() {
    if (!canSpeakWord()) {
        return Promise.resolve();
    }
    if (window.speechSynthesis.getVoices().length > 0) {
        return Promise.resolve();
    }
    if (voicesReadyPromise) {
        return voicesReadyPromise;
    }
    voicesReadyPromise = new Promise((resolve) => {
        let resolved = false;
        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            if ('onvoiceschanged' in window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
            }
            resolve();
        };
        if ('onvoiceschanged' in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => {
                cleanup();
            };
        }
        setTimeout(cleanup, 400);
    });
    return voicesReadyPromise;
}

function getSpeakLang(text) {
    if (!text) {
        return 'en-US';
    }
    for (const ch of text) {
        if (isChinese(ch)) {
            return 'zh-CN';
        }
    }
    return 'en-US';
}

async function speakWord(text) {
    if (!canSpeakWord() || !text) {
        return;
    }
    if (speechVoiceURI) {
        await waitForVoices();
    }
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = speechVoiceURI
        ? voices.find((voice) => voice.voiceURI === speechVoiceURI)
        : null;
    const utterance = new SpeechSynthesisUtterance(text);
    const token = ++speakToken;
    currentSpeakText = text;
    isSpeaking = true;
    if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || getSpeakLang(text);
    } else {
        utterance.lang = getSpeakLang(text);
    }
    utterance.onend = () => {
        if (token === speakToken) {
            isSpeaking = false;
            currentSpeakText = '';
        }
    };
    utterance.onerror = () => {
        if (token === speakToken) {
            isSpeaking = false;
            currentSpeakText = '';
        }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function toggleSpeak(text) {
    if (!canSpeakWord() || !text) {
        return;
    }
    const speaking = window.speechSynthesis.speaking || window.speechSynthesis.pending || isSpeaking;
    if (speaking && currentSpeakText === text) {
        stopSpeaking();
        return;
    }
    speakWord(text);
}

function createTooltipContent(data, matchText) {
    if (!data) {
        return null;
    }
    void matchText;
    const container = document.createElement('div');
    container.className = 'vocab-item';
    const wordRow = document.createElement('div');
    wordRow.className = 'vocab-word-row';
    const wordMain = document.createElement('div');
    wordMain.className = 'vocab-word-main';
    const rawWord = String(data.word || '').trim();
    const wordSpan = document.createElement('span');
    wordSpan.className = 'vocab-word';
    wordSpan.textContent = rawWord;
    const searchConfig = getSearchProviderConfig(rawWord, searchProvider);
    const searchLink = document.createElement('a');
    searchLink.className = 'vocab-search-btn';
    searchLink.href = searchConfig.url;
    searchLink.target = '_blank';
    searchLink.rel = 'noopener noreferrer';
    searchLink.title = searchConfig.label;
    searchLink.setAttribute('aria-label', searchConfig.label);
    searchLink.dataset.word = rawWord;
    const svgNs = 'http://www.w3.org/2000/svg';
    const searchSvg = document.createElementNS(svgNs, 'svg');
    searchSvg.classList.add('vocab-search-icon');
    searchSvg.setAttribute('viewBox', '0 0 24 24');
    searchSvg.setAttribute('aria-hidden', 'true');
    searchSvg.setAttribute('focusable', 'false');
    const searchCircle = document.createElementNS(svgNs, 'circle');
    searchCircle.setAttribute('cx', '11');
    searchCircle.setAttribute('cy', '11');
    searchCircle.setAttribute('r', '7');
    const searchLine = document.createElementNS(svgNs, 'line');
    searchLine.setAttribute('x1', '16.65');
    searchLine.setAttribute('y1', '16.65');
    searchLine.setAttribute('x2', '21');
    searchLine.setAttribute('y2', '21');
    searchSvg.appendChild(searchCircle);
    searchSvg.appendChild(searchLine);
    searchLink.appendChild(searchSvg);
    const normalizedWord = normalizeWord(rawWord);
    const blockButton = document.createElement('button');
    blockButton.className = 'vocab-action-btn vocab-block-btn';
    blockButton.type = 'button';
    blockButton.title = '屏蔽该词';
    blockButton.setAttribute('aria-label', '屏蔽该词');
    blockButton.dataset.word = normalizedWord;
    if (!normalizedWord) {
        blockButton.disabled = true;
    }
    if (blockedWordsSet.has(normalizedWord)) {
        blockButton.disabled = true;
    }
    const trashSvg = document.createElementNS(svgNs, 'svg');
    trashSvg.classList.add('vocab-action-icon');
    trashSvg.setAttribute('viewBox', '0 0 24 24');
    trashSvg.setAttribute('aria-hidden', 'true');
    const trashPath = document.createElementNS(svgNs, 'path');
    trashPath.setAttribute('d', 'M19 6h-3.5l-1-1h-5l-1 1H5v2h14V6zM6 9v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9H6z');
    trashSvg.appendChild(trashPath);
    blockButton.appendChild(trashSvg);
    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'vocab-action-btn vocab-favorite-btn';
    favoriteButton.type = 'button';
    favoriteButton.title = '收藏该词';
    favoriteButton.setAttribute('aria-label', '收藏该词');
    favoriteButton.dataset.word = normalizedWord;
    if (favoriteWordsSet.has(normalizedWord)) {
        favoriteButton.classList.add('is-active');
    }
    const starSvg = document.createElementNS(svgNs, 'svg');
    starSvg.classList.add('vocab-action-icon');
    starSvg.setAttribute('viewBox', '0 0 24 24');
    starSvg.setAttribute('aria-hidden', 'true');
    const starPath = document.createElementNS(svgNs, 'path');
    starPath.setAttribute('d', 'M12 3l2.9 6 6.6.9-4.8 4.4 1.2 6.5L12 17.8 6.1 20.8l1.2-6.5L2.5 9.9l6.6-.9L12 3z');
    starSvg.appendChild(starPath);
    favoriteButton.appendChild(starSvg);
    const speakButton = document.createElement('button');
    speakButton.className = 'vocab-action-btn vocab-speak-btn';
    speakButton.type = 'button';
    speakButton.title = '朗读该词';
    speakButton.setAttribute('aria-label', '朗读该词');
    if (!rawWord || !canSpeakWord()) {
        speakButton.disabled = true;
    }
    const speakSvg = document.createElementNS(svgNs, 'svg');
    speakSvg.classList.add('vocab-action-icon');
    speakSvg.setAttribute('viewBox', '0 0 24 24');
    speakSvg.setAttribute('aria-hidden', 'true');
    const speakPath = document.createElementNS(svgNs, 'path');
    speakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
    speakSvg.appendChild(speakPath);
    speakButton.appendChild(speakSvg);
    blockButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!normalizedWord || blockedWordsSet.has(normalizedWord)) {
            return;
        }
        blockedWordsSet.add(normalizedWord);
        blockButton.disabled = true;
        await persistBlockedWords();
        if (displayMode !== 'off') {
            stopProcessing();
            processedNodes = new WeakSet();
            startProcessing();
        }
    });
    favoriteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!normalizedWord) {
            return;
        }
        if (favoriteWordsSet.has(normalizedWord)) {
            favoriteWordsSet.delete(normalizedWord);
            favoriteButton.classList.remove('is-active');
        } else {
            favoriteWordsSet.add(normalizedWord);
            favoriteButton.classList.add('is-active');
        }
        await persistFavoriteWords();
    });
    speakButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!rawWord) {
            return;
        }
        toggleSpeak(rawWord);
    });
    wordMain.appendChild(wordSpan);
    wordMain.appendChild(searchLink);
    wordMain.appendChild(blockButton);
    wordMain.appendChild(favoriteButton);
    wordMain.appendChild(speakButton);
    wordRow.appendChild(wordMain);
    if (data._posTag) {
        const posTag = data._posTag;
        const posSpan = document.createElement('span');
        posSpan.className = 'vocab-inferred-pos';
        if (typeof posTag === 'object' && posTag.pos) {
            const methodText = posTag.method === 'rule' ? '插件根据上下文推测在当前段落中这个词的词性（可能不准确）。本次推测原因 :' : '词库推断';
            posSpan.title = posTag.rule ? `${methodText}: ${posTag.rule}` : methodText;
            posSpan.textContent = String(posTag.pos).toUpperCase();
            wordRow.appendChild(posSpan);
        } else if (typeof posTag === 'string') {
            posSpan.title = '插件根据上下文推测在当前段落中这个词的词性（可能不准确）。本次推测原因：使用jieba词性推导）';
            posSpan.textContent = posTag.toUpperCase();
            wordRow.appendChild(posSpan);
        }
    }
    container.appendChild(wordRow);
    if (data.phonetics && (data.phonetics.uk || data.phonetics.us)) {
        const phonetics = document.createElement('div');
        phonetics.className = 'vocab-phonetics';
        if (data.phonetics.uk) {
            const ukSpan = document.createElement('span');
            ukSpan.className = 'vocab-phonetic';
            ukSpan.textContent = `UK ${data.phonetics.uk}`;
            phonetics.appendChild(ukSpan);
        }
        if (data.phonetics.us) {
            const usSpan = document.createElement('span');
            usSpan.className = 'vocab-phonetic';
            usSpan.textContent = `US ${data.phonetics.us}`;
            phonetics.appendChild(usSpan);
        }
        container.appendChild(phonetics);
    }
    if (data.sources && data.sources.length > 0) {
        const sources = document.createElement('div');
        sources.className = 'vocab-sources';
        sources.textContent = data.sources.join(', ');
        container.appendChild(sources);
    }
    if (data.byType && Object.keys(data.byType).length > 0) {
        const translations = document.createElement('div');
        translations.className = 'vocab-translations';
        const typeOrder = ['n', 'v', 'vt', 'vi', 'adj', 'adv', '_default'];
        const types = Object.keys(data.byType);
        const sortedTypes = types.sort((a, b) => {
            const indexA = typeOrder.indexOf(a);
            const indexB = typeOrder.indexOf(b);
            const orderA = indexA === -1 ? typeOrder.length : indexA;
            const orderB = indexB === -1 ? typeOrder.length : indexB;
            return orderA - orderB;
        });
        const inferredPOS = data._posTag
            ? (typeof data._posTag === 'string' ? data._posTag : data._posTag.pos)
            : null;
        sortedTypes.forEach(typeKey => {
            const typeData = data.byType[typeKey];
            if (!typeData) {
                return;
            }
            const displayType = typeData.type || '';
            const meaningsText = Array.isArray(typeData.meanings) ? typeData.meanings.join('，') : '';
            const isMatched = inferredPOS && findMatchingType({[typeKey]: typeData}, inferredPOS) === typeKey;
            const item = document.createElement('div');
            item.className = `vocab-trans-item${isMatched ? ' vocab-trans-matched' : ''}`;
            if (displayType) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'vocab-type';
                typeSpan.textContent = displayType;
                item.appendChild(typeSpan);
                item.appendChild(document.createTextNode(' '));
            }
            if (meaningsText) {
                item.appendChild(document.createTextNode(meaningsText));
            }
            if (typeData.sources && typeData.sources.length > 0) {
                item.appendChild(document.createTextNode(' '));
                const sources = document.createElement('span');
                sources.className = 'vocab-type-sources';
                sources.textContent = `[${typeData.sources.join(', ')}]`;
                item.appendChild(sources);
            }
            translations.appendChild(item);
        });
        container.appendChild(translations);
    }
    if (data.phrases && data.phrases.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'vocab-phrases-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', phrasesExpanded ? 'true' : 'false');
        toggle.textContent = '常用短语';
        container.appendChild(toggle);
        const phrases = document.createElement('div');
        phrases.className = 'vocab-phrases';
        if (phrasesExpanded) {
            phrases.classList.add('is-open');
        }
        data.phrases.forEach(phrase => {
            if (!phrase) {
                return;
            }
            const phraseItem = document.createElement('div');
            phraseItem.className = 'vocab-phrase';
            const phraseRow = document.createElement('div');
            phraseRow.className = 'vocab-phrase-row';
            const phraseText = document.createElement('div');
            phraseText.className = 'vocab-phrase-text';
            phraseText.textContent = phrase.phrase || '';
            const phraseSearchConfig = getSearchProviderConfig(phrase.phrase || '', searchProvider);
            const phraseSearchLink = document.createElement('a');
            phraseSearchLink.className = 'vocab-search-btn vocab-phrase-search';
            phraseSearchLink.href = phraseSearchConfig.url;
            phraseSearchLink.target = '_blank';
            phraseSearchLink.rel = 'noopener noreferrer';
            phraseSearchLink.title = phraseSearchConfig.label;
            phraseSearchLink.setAttribute('aria-label', phraseSearchConfig.label);
            phraseSearchLink.dataset.word = phrase.phrase || '';
            const phraseSearchSvg = document.createElementNS(svgNs, 'svg');
            phraseSearchSvg.classList.add('vocab-search-icon');
            phraseSearchSvg.setAttribute('viewBox', '0 0 24 24');
            phraseSearchSvg.setAttribute('aria-hidden', 'true');
            phraseSearchSvg.setAttribute('focusable', 'false');
            const phraseSearchCircle = document.createElementNS(svgNs, 'circle');
            phraseSearchCircle.setAttribute('cx', '11');
            phraseSearchCircle.setAttribute('cy', '11');
            phraseSearchCircle.setAttribute('r', '7');
            const phraseSearchLine = document.createElementNS(svgNs, 'line');
            phraseSearchLine.setAttribute('x1', '16.65');
            phraseSearchLine.setAttribute('y1', '16.65');
            phraseSearchLine.setAttribute('x2', '21');
            phraseSearchLine.setAttribute('y2', '21');
            phraseSearchSvg.appendChild(phraseSearchCircle);
            phraseSearchSvg.appendChild(phraseSearchLine);
            phraseSearchLink.appendChild(phraseSearchSvg);
            const phraseSpeakButton = document.createElement('button');
            phraseSpeakButton.className = 'vocab-action-btn vocab-speak-btn';
            phraseSpeakButton.type = 'button';
            phraseSpeakButton.title = '朗读短语';
            phraseSpeakButton.setAttribute('aria-label', '朗读短语');
            if (!phrase.phrase || !canSpeakWord()) {
                phraseSpeakButton.disabled = true;
            }
            const phraseSpeakSvg = document.createElementNS(svgNs, 'svg');
            phraseSpeakSvg.classList.add('vocab-action-icon');
            phraseSpeakSvg.setAttribute('viewBox', '0 0 24 24');
            phraseSpeakSvg.setAttribute('aria-hidden', 'true');
            const phraseSpeakPath = document.createElementNS(svgNs, 'path');
            phraseSpeakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
            phraseSpeakSvg.appendChild(phraseSpeakPath);
            phraseSpeakButton.appendChild(phraseSpeakSvg);
            phraseSpeakButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!phrase.phrase) {
                    return;
                }
                toggleSpeak(phrase.phrase);
            });
            phraseRow.appendChild(phraseText);
            phraseRow.appendChild(phraseSearchLink);
            phraseRow.appendChild(phraseSpeakButton);
            phraseItem.appendChild(phraseRow);
            if (phrase.translations && phrase.translations.length > 0) {
                const phraseTrans = document.createElement('div');
                phraseTrans.className = 'vocab-phrase-trans';
                phraseTrans.textContent = phrase.translations.join('，');
                phraseItem.appendChild(phraseTrans);
            }
            if (phrase.sources && phrase.sources.length > 0) {
                const phraseSources = document.createElement('div');
                phraseSources.className = 'vocab-phrase-sources';
                phraseSources.textContent = `[${phrase.sources.join(', ')}]`;
                phraseItem.appendChild(phraseSources);
            }
            phrases.appendChild(phraseItem);
        });
        container.appendChild(phrases);
    }
    if (Array.isArray(data.sentenceExamples) && data.sentenceExamples.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'vocab-examples-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', examplesExpanded ? 'true' : 'false');
        toggle.textContent = '例句';
        container.appendChild(toggle);
        const examples = document.createElement('div');
        examples.className = 'vocab-examples';
        if (examplesExpanded) {
            examples.classList.add('is-open');
        }
        data.sentenceExamples.forEach((example) => {
            if (!example || (!example.en && !example.zh)) {
                return;
            }
            const item = document.createElement('div');
            item.className = 'vocab-example';
            if (example.en) {
                const enRow = document.createElement('div');
                enRow.className = 'vocab-example-row';
                const en = document.createElement('div');
                en.className = 'vocab-example-en';
                en.textContent = example.en;
                const exampleSpeakButton = document.createElement('button');
                exampleSpeakButton.className = 'vocab-action-btn vocab-example-speak';
                exampleSpeakButton.type = 'button';
                exampleSpeakButton.title = '朗读例句';
                exampleSpeakButton.setAttribute('aria-label', '朗读例句');
                if (!example.en || !canSpeakWord()) {
                    exampleSpeakButton.disabled = true;
                }
                const exampleSpeakSvg = document.createElementNS(svgNs, 'svg');
                exampleSpeakSvg.classList.add('vocab-action-icon');
                exampleSpeakSvg.setAttribute('viewBox', '0 0 24 24');
                exampleSpeakSvg.setAttribute('aria-hidden', 'true');
                const exampleSpeakPath = document.createElementNS(svgNs, 'path');
                exampleSpeakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
                exampleSpeakSvg.appendChild(exampleSpeakPath);
                exampleSpeakButton.appendChild(exampleSpeakSvg);
                exampleSpeakButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (!example.en) {
                        return;
                    }
                    toggleSpeak(example.en);
                });
                enRow.appendChild(en);
                enRow.appendChild(exampleSpeakButton);
                item.appendChild(enRow);
            }
            if (example.zh) {
                const zh = document.createElement('div');
                zh.className = 'vocab-example-zh';
                zh.textContent = example.zh;
                item.appendChild(zh);
            }
            examples.appendChild(item);
        });
        container.appendChild(examples);
    }
    return container;
}

function positionTooltip(span, tooltip) {
    if (!span || !span.isConnected || span.getClientRects().length === 0) {
        if (!isPointerInsideTooltip() && !isElementHovered(tooltip)) {
            hideGlobalTooltip(true);
        }
        return;
    }
    tooltip.classList.remove('show-above');
    const rect = span.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const gap = 6;
    const padding = 8;
    let left = rect.left;
    let top = rect.bottom + gap;
    const tipRect = tooltip.getBoundingClientRect();
    if (left + tipRect.width > viewportWidth - padding) {
        left = Math.max(padding, viewportWidth - tipRect.width - padding);
    }
    if (top + tipRect.height > viewportHeight - padding) {
        top = rect.top - tipRect.height - gap;
        tooltip.classList.add('show-above');
    }
    if (top < padding) {
        top = padding;
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
}

function isElementHovered(element) {
    if (!element || !element.isConnected) {
        return false;
    }
    try {
        return element.matches(':hover');
    } catch (error) {
        return false;
    }
}

function clampTooltipSize(size) {
    const rawWidth = size && typeof size.width === 'number' ? size.width : TOOLTIP_SIZE_DEFAULT.width;
    const rawHeight = size && typeof size.height === 'number' ? size.height : TOOLTIP_SIZE_DEFAULT.height;
    const width = Math.min(TOOLTIP_SIZE_MAX.width, Math.max(TOOLTIP_SIZE_MIN.width, Math.round(rawWidth)));
    const height = Math.min(TOOLTIP_SIZE_MAX.height, Math.max(TOOLTIP_SIZE_MIN.height, Math.round(rawHeight)));
    return {width, height};
}

function applyTooltipSize(tooltip, size) {
    if (!tooltip || !size) {
        return tooltipSize;
    }
    const clamped = clampTooltipSize(size);
    tooltip.style.width = `${clamped.width}px`;
    tooltip.style.height = `${clamped.height}px`;
    const content = tooltip.querySelector('.vocab-tooltip-content');
    if (content) {
        const contentHeight = Math.max(120, clamped.height - 36);
        content.style.maxHeight = `${contentHeight}px`;
    }
    return clamped;
}

function saveTooltipSize(size) {
    if (!size) {
        return;
    }
    const clamped = clampTooltipSize(size);
    tooltipSize = clamped;
    if (tooltipSizeSaveTimer) {
        clearTimeout(tooltipSizeSaveTimer);
    }
    tooltipSizeSaveTimer = setTimeout(() => {
        api.storage.local.set({[TOOLTIP_SIZE_STORAGE_KEY]: clamped}).catch(() => {
        });
    }, 200);
}

function ensureTooltipResizeHandles(tooltip) {
    if (!tooltip || tooltip.querySelector('.vocab-tooltip-resize-handle')) {
        return;
    }
    const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    directions.forEach((dir) => {
        const handle = document.createElement('div');
        handle.className = `vocab-tooltip-resize-handle handle-${dir}`;
        handle.dataset.dir = dir;
        tooltip.appendChild(handle);
    });
}

function getPointerPosition(event) {
    if (event.touches && event.touches.length > 0) {
        return {x: event.touches[0].clientX, y: event.touches[0].clientY};
    }
    return {x: event.clientX, y: event.clientY};
}

function startTooltipResize(event, direction) {
    if (!globalTooltip || !direction) {
        return;
    }
    event.preventDefault();
    const {x, y} = getPointerPosition(event);
    const rect = globalTooltip.getBoundingClientRect();
    tooltipResizeState = {
        direction: direction,
        startX: x,
        startY: y,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        startTop: rect.top
    };
    tooltipManualPositioned = true;
    isTooltipDragging = false;
    tooltipDragOffset = null;
}

function handleTooltipResizeMove(event) {
    if (!tooltipResizeState || !globalTooltip) {
        return;
    }
    event.preventDefault();
    const {x, y} = getPointerPosition(event);
    const deltaX = x - tooltipResizeState.startX;
    const deltaY = y - tooltipResizeState.startY;
    let width = tooltipResizeState.startWidth;
    let height = tooltipResizeState.startHeight;
    let left = tooltipResizeState.startLeft;
    let top = tooltipResizeState.startTop;
    if (tooltipResizeState.direction.includes('e')) {
        width = tooltipResizeState.startWidth + deltaX;
    }
    if (tooltipResizeState.direction.includes('w')) {
        width = tooltipResizeState.startWidth - deltaX;
    }
    if (tooltipResizeState.direction.includes('s')) {
        height = tooltipResizeState.startHeight + deltaY;
    }
    if (tooltipResizeState.direction.includes('n')) {
        height = tooltipResizeState.startHeight - deltaY;
    }
    const clamped = clampTooltipSize({width, height});
    if (tooltipResizeState.direction.includes('w')) {
        left = tooltipResizeState.startLeft + (tooltipResizeState.startWidth - clamped.width);
    }
    if (tooltipResizeState.direction.includes('n')) {
        top = tooltipResizeState.startTop + (tooltipResizeState.startHeight - clamped.height);
    }
    tooltipSize = applyTooltipSize(globalTooltip, clamped);
    globalTooltip.style.left = `${Math.round(left)}px`;
    globalTooltip.style.top = `${Math.round(top)}px`;
}

function finishTooltipResize() {
    if (!tooltipResizeState) {
        return;
    }
    tooltipResizeState = null;
    saveTooltipSize(tooltipSize);
}

function isPointerInsideTooltip() {
    if (!lastPointerPosition || !globalTooltip || !globalTooltip.isConnected) {
        return false;
    }
    const rect = globalTooltip.getBoundingClientRect();
    return (
        lastPointerPosition.x >= rect.left &&
        lastPointerPosition.x <= rect.right &&
        lastPointerPosition.y >= rect.top &&
        lastPointerPosition.y <= rect.bottom
    );
}

function getGlobalTooltip() {
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.className = 'vocab-tooltip';
        document.body.appendChild(globalTooltip);
    }
    if (!tooltipListenersAttached) {
        window.addEventListener('scroll', repositionGlobalTooltip, true);
        window.addEventListener('resize', repositionGlobalTooltip);
        globalTooltip.addEventListener('mouseenter', () => {
            if (globalTooltipHideTimer) {
                clearTimeout(globalTooltipHideTimer);
                globalTooltipHideTimer = null;
            }
            isHoveringTooltip = true;
        });
        globalTooltip.addEventListener('mousemove', () => {
            if (globalTooltipHideTimer) {
                clearTimeout(globalTooltipHideTimer);
                globalTooltipHideTimer = null;
            }
            isHoveringTooltip = true;
        });
        globalTooltip.addEventListener('mouseleave', () => {
            isHoveringTooltip = false;
            if (globalTooltipOwner) {
                const owner = globalTooltipOwner;
                if (!isElementHovered(owner)) {
                    if (globalTooltipHideTimer) {
                        clearTimeout(globalTooltipHideTimer);
                    }
                    globalTooltipHideTimer = setTimeout(() => {
                        const hoveringHighlight = isElementHovered(owner);
                        const hoveringTooltip = isElementHovered(globalTooltip);
                        const pointerInsideTooltip = isPointerInsideTooltip();
                        if (hoveringHighlight || hoveringTooltip || pointerInsideTooltip || isHoveringHighlight || isHoveringTooltip) {
                            return;
                        }
                        hideGlobalTooltip();
                    }, TOOLTIP_HIDE_DELAY_MS);
                }
            }
        });
        globalTooltip.addEventListener('click', (event) => {
            const target = event.target;
            if (!target || !target.closest) {
                return;
            }
            const closeButton = target.closest('.vocab-tooltip-close');
            if (closeButton) {
                hideGlobalTooltip(true);
                return;
            }
            const pinButton = target.closest('.vocab-tooltip-pin');
            if (pinButton) {
                isTooltipPinned = !isTooltipPinned;
                pinButton.classList.toggle('is-pinned', isTooltipPinned);
                pinButton.setAttribute('aria-pressed', isTooltipPinned ? 'true' : 'false');
                if (isTooltipPinned) {
                    tooltipManualPositioned = true;
                } else {
                    tooltipManualPositioned = false;
                    repositionGlobalTooltip();
                }
                return;
            }
            const phrasesToggle = target.closest('.vocab-phrases-toggle');
            if (phrasesToggle) {
                const phrasesBlock = phrasesToggle.parentElement?.querySelector('.vocab-phrases');
                if (!phrasesBlock) {
                    return;
                }
                const isOpen = phrasesBlock.classList.toggle('is-open');
                phrasesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                phrasesExpanded = isOpen;
                api.storage.local.set({phrasesExpanded: isOpen}).catch(() => {
                });
                if (event.detail > 0) {
                    phrasesToggle.blur();
                }
            }
            const examplesToggle = target.closest('.vocab-examples-toggle');
            if (examplesToggle) {
                const examplesBlock = examplesToggle.parentElement?.querySelector('.vocab-examples');
                if (!examplesBlock) {
                    return;
                }
                const isOpen = examplesBlock.classList.toggle('is-open');
                examplesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                examplesExpanded = isOpen;
                api.storage.local.set({examplesExpanded: isOpen}).catch(() => {
                });
                if (event.detail > 0) {
                    examplesToggle.blur();
                }
            }
        });
        globalTooltip.addEventListener('mousedown', (event) => {
            if (event.button !== 0) {
                return;
            }
            const target = event.target;
            if (!target || !target.closest) {
                return;
            }
            const resizeHandle = target.closest('.vocab-tooltip-resize-handle');
            if (resizeHandle) {
                startTooltipResize(event, resizeHandle.dataset.dir);
                return;
            }
            const dragHandle = target.closest('.vocab-tooltip-drag');
            if (!dragHandle) {
                return;
            }
            const rect = globalTooltip.getBoundingClientRect();
            if (!isTooltipPinned) {
                isTooltipPinned = true;
                const pinButton = globalTooltip.querySelector('.vocab-tooltip-pin');
                if (pinButton) {
                    pinButton.classList.add('is-pinned');
                    pinButton.setAttribute('aria-pressed', 'true');
                }
            }
            isTooltipDragging = true;
            tooltipManualPositioned = true;
            tooltipDragOffset = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            event.preventDefault();
        });
        document.addEventListener('mousemove', (event) => {
            if (tooltipResizeState) {
                handleTooltipResizeMove(event);
                return;
            }
            if (!isTooltipDragging || !globalTooltip || !tooltipDragOffset) {
                return;
            }
            const left = event.clientX - tooltipDragOffset.x;
            const top = event.clientY - tooltipDragOffset.y;
            globalTooltip.style.left = `${Math.round(left)}px`;
            globalTooltip.style.top = `${Math.round(top)}px`;
        });
        document.addEventListener('mouseup', () => {
            if (tooltipResizeState) {
                finishTooltipResize();
                return;
            }
            if (!isTooltipDragging) {
                return;
            }
            isTooltipDragging = false;
            tooltipDragOffset = null;
        });
        tooltipListenersAttached = true;
    }
    if (!pointerTrackerAttached) {
        document.addEventListener('mousemove', (event) => {
            lastPointerPosition = {x: event.clientX, y: event.clientY};
            // 如果提示框可见，检查鼠标是否在提示框或高亮元素外
            if (isTooltipVisible && globalTooltip && globalTooltipOwner) {
                const tooltipRect = globalTooltip.getBoundingClientRect();
                const ownerRect = globalTooltipOwner.getBoundingClientRect();
                const isInsideTooltip = (
                    event.clientX >= tooltipRect.left &&
                    event.clientX <= tooltipRect.right &&
                    event.clientY >= tooltipRect.top &&
                    event.clientY <= tooltipRect.bottom
                );
                const isInsideOwner = (
                    event.clientX >= ownerRect.left &&
                    event.clientX <= ownerRect.right &&
                    event.clientY >= ownerRect.top &&
                    event.clientY <= ownerRect.bottom
                );
                // 如果鼠标不在提示框和高亮元素内，延时关闭
                if (!isInsideTooltip && !isInsideOwner) {
                    // 清除旧计时器，设置新计时器
                    if (globalTooltipHideTimer) {
                        clearTimeout(globalTooltipHideTimer);
                    }
                    globalTooltipHideTimer = setTimeout(() => {
                        // 再次检查，确保鼠标仍然在外部
                        const currentTooltipRect = globalTooltip.getBoundingClientRect();
                        const currentOwnerRect = globalTooltipOwner.getBoundingClientRect();
                        const stillInsideTooltip = lastPointerPosition && (
                            lastPointerPosition.x >= currentTooltipRect.left &&
                            lastPointerPosition.x <= currentTooltipRect.right &&
                            lastPointerPosition.y >= currentTooltipRect.top &&
                            lastPointerPosition.y <= currentTooltipRect.bottom
                        );
                        const stillInsideOwner = lastPointerPosition && (
                            lastPointerPosition.x >= currentOwnerRect.left &&
                            lastPointerPosition.x <= currentOwnerRect.right &&
                            lastPointerPosition.y >= currentOwnerRect.top &&
                            lastPointerPosition.y <= currentOwnerRect.bottom
                        );
                        if (!stillInsideTooltip && !stillInsideOwner) {
                            hideGlobalTooltip();
                        }
                    }, TOOLTIP_HIDE_DELAY_MS);
                } else {
                    // 如果鼠标在内部，取消隐藏计时器
                    if (globalTooltipHideTimer) {
                        clearTimeout(globalTooltipHideTimer);
                        globalTooltipHideTimer = null;
                    }
                }
            }
        });
        // 监听鼠标离开文档,延时关闭提示框
        document.addEventListener('mouseleave', () => {
            if (!globalTooltip || !isTooltipVisible) {
                return;
            }
            if (globalTooltipHideTimer) {
                clearTimeout(globalTooltipHideTimer);
            }
            globalTooltipHideTimer = setTimeout(() => {
                // 再次检查是否真的离开了文档
                if (!isPointerInsideTooltip()) {
                    hideGlobalTooltip();
                }
            }, TOOLTIP_HIDE_DELAY_MS);
        });
        pointerTrackerAttached = true;
    }
    return globalTooltip;
}

function hideGlobalTooltip(force = false) {
    if (!globalTooltip) {
        return;
    }
    if (!force && isTooltipPinned) {
        return;
    }
    if (!force && isElementHovered(globalTooltip)) {
        return;
    }
    if (!force && isPointerInsideTooltip()) {
        return;
    }
    globalTooltip.style.display = 'none';
    globalTooltip.style.visibility = '';
    isTooltipVisible = false;
    isTooltipPinned = false;
    isTooltipDragging = false;
    tooltipDragOffset = null;
    tooltipManualPositioned = false;
    globalTooltipOwner = null;
    stopSpeaking();
    isHoveringHighlight = false;
    isHoveringTooltip = false;
}

function repositionGlobalTooltip() {
    if (!isTooltipVisible || !globalTooltip || !globalTooltipOwner) {
        return;
    }
    if (tooltipManualPositioned) {
        return;
    }
    positionTooltip(globalTooltipOwner, globalTooltip);
}

function buildTooltipHeader() {
    const header = document.createElement('div');
    header.className = 'vocab-tooltip-header';
    const pinButton = document.createElement('button');
    pinButton.className = 'vocab-tooltip-pin';
    pinButton.type = 'button';
    pinButton.setAttribute('aria-label', '图钉');
    pinButton.setAttribute('aria-pressed', 'false');
    const svgNs = 'http://www.w3.org/2000/svg';
    const pinSvg = document.createElementNS(svgNs, 'svg');
    pinSvg.setAttribute('viewBox', '0 0 16 16');
    pinSvg.setAttribute('aria-hidden', 'true');
    pinSvg.setAttribute('focusable', 'false');
    const pinPath = document.createElementNS(svgNs, 'path');
    pinPath.setAttribute('d', 'M6 0h4l1 1v3l2 2v1H3V6l2-2V1zM8 9c.6 0 1 .4 1 1v6H7v-6c0-.6.4-1 1-1z');
    pinSvg.appendChild(pinPath);
    pinButton.appendChild(pinSvg);
    const dragHandle = document.createElement('div');
    dragHandle.className = 'vocab-tooltip-drag';
    dragHandle.setAttribute('aria-label', '拖动');
    const closeButton = document.createElement('button');
    closeButton.className = 'vocab-tooltip-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.textContent = '×';
    header.appendChild(pinButton);
    header.appendChild(dragHandle);
    header.appendChild(closeButton);
    return header;
}

// ===================弹窗相关函数结束==================
// ==================语言检测相关函数==================
//从当前页面进行抽样，用来判断语言
function getSampleTextFromPage() {
    const bodyText = document.body ? (document.body.textContent || '') : '';
    const maxSampleLength = 5000;
    const textLength = bodyText.length;
    if (textLength <= maxSampleLength) {
        return bodyText;
    }
    const chunkSize = Math.floor(maxSampleLength / 3);
    const head = bodyText.substring(0, chunkSize);
    const midStart = Math.max(0, Math.floor(textLength / 2) - Math.floor(chunkSize / 2));
    const middle = bodyText.substring(midStart, midStart + chunkSize);
    const tail = bodyText.substring(Math.max(0, textLength - chunkSize));
    return `${head} ${middle} ${tail}`;
}

function getLanguageStatsFromText(sampleText) {
    // 统计中文字符数与英文单词数
    let chineseCount = 0;
    for (const char of sampleText) {
        if (isChinese(char)) {
            chineseCount++;
        }
    }
    const englishWords = sampleText.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
    const englishCount = englishWords ? englishWords.length : 0;
    const totalUnits = chineseCount + englishCount;
    if (totalUnits === 0) {
        return {
            chineseCount,
            englishCount,
            totalUnits,
            chineseRatio: 0,
            englishRatio: 0,
            detected: false
        };
    }
    const chineseRatio = chineseCount / totalUnits;
    const englishRatio = englishCount / totalUnits;
    return {
        chineseCount,
        englishCount,
        totalUnits,
        chineseRatio,
        englishRatio,
        detected: true
    };
}

// 自动检测页面主要语言
function detectPageLanguage() {
    if (annotationMode !== 'auto') {
        return false; // Only detect in auto mode.
    }
    if (languageDetectDone) {
        return false;
    }
    languageDetectDone = true;
    const previousMode = actualAnnotationMode;
    try {
        const sampleText = getSampleTextFromPage();
        languageStats = getLanguageStatsFromText(sampleText);
        if (!languageStats.detected) {
            actualAnnotationMode = 'cn-to-en'; // Default when no language detected.
            diagLog('No language detected, defaulting to cn-to-en');
            return false;
        }
        const {chineseCount, englishCount, chineseRatio, englishRatio} = languageStats;
        diagLog(`Language stats: cn=${chineseCount}(${(chineseRatio * 100).toFixed(1)}%), en=${englishCount}(${(englishRatio * 100).toFixed(1)}%)`);
        // Decide based on ratios.
        if (chineseRatio >= 0.1) {
            actualAnnotationMode = 'cn-to-en';
            diagLog('Mostly Chinese, select cn-to-en');
        } else if (englishRatio >= 0.9) {
            actualAnnotationMode = 'en-to-cn';
            diagLog('Mostly English, select en-to-cn');
        } else {
            // Mixed content: pick the dominant language.
            actualAnnotationMode = chineseRatio > englishRatio ? 'cn-to-en' : 'en-to-cn';
            diagLog('Mixed language, select', actualAnnotationMode);
        }
    } catch (error) {
        diagLog('Language detect failed:', error);
        languageStats = {
            chineseCount: 0,
            englishCount: 0,
            totalUnits: 0,
            chineseRatio: 0,
            englishRatio: 0,
            detected: false
        };
        actualAnnotationMode = 'cn-to-en'; // Fallback to cn-to-en.
        return false;
    }
    return actualAnnotationMode !== previousMode;
}

// ================语言检测相关函数结束==================
// ================日志相关函数=================
// 诊断日志（根据 debugMode 设置决定是否输出）
function diagLog(...args) {
    if (debugModeEnabled) {
        console.log('[jieci-diag]', ...args);
    }
}

function normalizeDiagText(text) {
    if (!text) {
        return '';
    }
    return text.replace(/\s+/g, ' ').trim();
}

function formatDiagText(text, maxLen = 160) {
    const cleaned = normalizeDiagText(text);
    if (cleaned.length <= maxLen) {
        return cleaned;
    }
    return `${cleaned.slice(0, maxLen)}...`;
}

function formatDiagList(items, maxLen = 200) {
    const joined = items.join(' | ');
    if (joined.length <= maxLen) {
        return joined;
    }
    return `${joined.slice(0, maxLen)}...`;
}

// Log helpers
function formatLogTime() {
    return new Date().toLocaleString();
}

function getEffectiveMode() {
    return annotationMode === 'auto' ? actualAnnotationMode : annotationMode;
}

function getLanguageResultLabel() {
    if (annotationMode !== 'auto') {
        return `${annotationMode} (manual)`;
    }
    if (languageStats && languageStats.detected) {
        return actualAnnotationMode;
    }
    return 'unknown';
}

function logPageStatus(label, value) {
    const time = formatLogTime();
    const url = location.href;
    const tail = value ? ` ${value}` : '';
    console.log(`[jieci] ${time} ${url} ${label}${tail}`);
}

function reportDiagSkipReasons() {
    const now = Date.now();
    if (now - lastDiagReport < 2000) return; // 每2秒最多报告一次
    lastDiagReport = now;
    const {quota, minLength, overflow, noMatch} = diagSkipReasons;
    if (quota + minLength + overflow + noMatch > 0) {
        diagLog('跳过原因统计 - 配额耗尽:', quota, '字数不足:', minLength, '(minTextLength=' + minTextLength + ')', '溢出:', overflow, '无匹配:', noMatch);
    }
}

function scheduleFinalLog() {
    if (finalLogTimer) {
        clearTimeout(finalLogTimer);
    }
    finalLogTimer = setTimeout(() => {
        finalLogTimer = null;
        if (initialProcessingLogged) {
            return;
        }
        // 如果还有异步处理在进行，继续等待
        if (pendingAsyncCount > 0) {
            scheduleFinalLog();
            return;
        }
        initialProcessingLogged = true;
        logPageStatus('修改完成 模式:', `${getEffectiveMode()} 标注词汇: ${annotatedWordCount}`);
    }, 500);
}

function clearFinalLogTimer() {
    if (finalLogTimer) {
        clearTimeout(finalLogTimer);
        finalLogTimer = null;
    }
}

// ================日志相关函数结束===============
// ================站点黑名单相关函数=============
function normalizeHost(host) {
    return String(host || '').trim().toLowerCase().replace(/\.+$/, '');
}

function compileSiteBlockIndex(rules) {
    const exact = new Set();
    const wildcards = [];
    rules.forEach((rule) => {
        const cleaned = String(rule || '').trim().toLowerCase();
        if (!cleaned) {
            return;
        }
        if (cleaned.startsWith('*.')) {
            const suffix = cleaned.slice(2);
            if (suffix) {
                wildcards.push({suffix, parts: suffix.split('.').length});
            }
            return;
        }
        exact.add(cleaned);
    });
    wildcards.sort((a, b) => b.parts - a.parts);
    return {exact, wildcards};
}

function evaluateSiteBlocked(hostname) {
    const host = normalizeHost(hostname);
    if (!host) {
        return false;
    }
    if (siteBlockIndex.exact.has(host)) {
        return true;
    }
    const hostParts = host.split('.').length;
    return siteBlockIndex.wildcards.some(({suffix, parts}) => {
        if (hostParts <= parts) {
            return false;
        }
        return host.endsWith(`.${suffix}`);
    });
}

function updateSiteBlockState() {
    const host = normalizeHost(window.location.hostname);
    isSiteBlocked = evaluateSiteBlocked(host);
    if (isSiteBlocked) {
        diagLog('Site blocked; skip annotation:', host);
    }
}

// ================站点黑名单相关函数结束===========
// ================加载储存数据相关函数，包含数据持久化=============
// 加载设置
async function loadSettings() {
    try {
        const result = await api.storage.local.get(['displayMode', 'maxMatchesPerNode', 'minTextLength', 'annotationMode', 'highlightColorMode', 'highlightColor', 'cnToEnOrder', 'enToCnOrder', 'disableAnnotationUnderline', 'disableAnnotationTooltip', 'speechVoiceURI', 'smartSkipCodeLinks', 'searchProvider', 'phrasesExpanded', 'examplesExpanded', 'blockedWords', 'blockedWordsTrieIndex', 'favoriteWords', 'siteBlockRules', 'siteBlockIndex', 'dedupeMode', 'dedupeRepeatCount', 'dedupeCooldownSeconds', 'dedupeGlobalState', 'debugMode', TOOLTIP_SIZE_STORAGE_KEY]);
        displayMode = result.displayMode || 'off';
        maxMatchesPerNode = normalizeMaxMatches(result.maxMatchesPerNode ?? maxMatchesPerNode);
        minTextLength = result.minTextLength ?? minTextLength;
        debugModeEnabled = result.debugMode === true;
        if (result[TOOLTIP_SIZE_STORAGE_KEY]) {
            tooltipSize = clampTooltipSize(result[TOOLTIP_SIZE_STORAGE_KEY]);
        } else {
            tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
        }
        annotationMode = result.annotationMode || 'auto';
        cnToEnOrder = result.cnToEnOrder || 'source-first';
        enToCnOrder = result.enToCnOrder || 'source-first';
        disableAnnotationUnderline = result.disableAnnotationUnderline === true;
        disableAnnotationTooltip = result.disableAnnotationTooltip === true;
        speechVoiceURI = result.speechVoiceURI || '';
        highlightColorMode = result.highlightColorMode ?? highlightColorMode;
        highlightColor = result.highlightColor ?? highlightColor;
        smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
        searchProvider = result.searchProvider || 'youdao';
        blockedWordsSet = new Set(
            Array.isArray(result.blockedWords)
                ? result.blockedWords.map(normalizeWord).filter(Boolean)
                : []
        );
        blockedWordsTrie = result.blockedWordsTrieIndex || null;
        siteBlockRules = Array.isArray(result.siteBlockRules)
            ? result.siteBlockRules.map(normalizeHost).filter(Boolean)
            : [];
        if (result.siteBlockIndex && Array.isArray(result.siteBlockIndex.exact) && Array.isArray(result.siteBlockIndex.wildcards)) {
            siteBlockIndex = {
                exact: new Set(result.siteBlockIndex.exact),
                wildcards: result.siteBlockIndex.wildcards
            };
        } else {
            siteBlockIndex = compileSiteBlockIndex(siteBlockRules);
        }
        updateSiteBlockState();
        favoriteWordsSet = new Set(
            Array.isArray(result.favoriteWords)
                ? result.favoriteWords.map(normalizeWord).filter(Boolean)
                : []
        );
        phrasesExpanded = result.phrasesExpanded === true;
        examplesExpanded = result.examplesExpanded === true;
        dedupeMode = result.dedupeMode || 'page';
        if (dedupeMode === 'cooldown') {
            dedupeMode = 'count';
        }
        dedupeRepeatCount = (typeof result.dedupeRepeatCount === 'number')
            ? result.dedupeRepeatCount
            : ((typeof result.dedupeCooldownSeconds === 'number') ? result.dedupeCooldownSeconds : 50);
        diagLog('加载设置 - 显示模式:', displayMode, '标注上限:', maxMatchesPerNode, '最小字数:', minTextLength, '标注模式:', annotationMode);
        await loadVocabularies();
        applyHighlightColor(highlightColorMode, highlightColor);
        if (dedupeMode === 'count') {
            await loadDedupeStateFromStorage(result.dedupeGlobalState);
            clampDedupeRemaining();
        } else {
            dedupeRemaining.clear();
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 加载词库
async function loadVocabularies() {
    try {
        const result = await api.storage.local.get(['vocabularies', 'vocabularyTrieIndex']);
        const vocabList = result.vocabularies || [];
        const cachedTrieIndex = result.vocabularyTrieIndex;
        diagLog('加载词库，文件数量:', vocabList.length, '模式:', annotationMode);
        vocabularyMap.clear();
        vocabularySet.clear();
        // 根据模式创建Trie树
        const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;
        if (effectiveMode === 'cn-to-en') {
            // 中文->英文模式：从缓存加载Trie树
            if (cachedTrieIndex) {
                vocabularyTrie = new Trie(cachedTrieIndex);
                diagLog('从缓存加载Trie树索引成功');
            } else {
                vocabularyTrie = null;
                diagLog('警告：未找到缓存的Trie树索引');
            }
        } else if (effectiveMode === 'en-to-cn') {
            // 英文->中文模式：不需要Trie树，使用正则匹配
            vocabularyTrie = null;
        }
        vocabList.forEach(vocab => {
            const sourceName = vocab.name || '未知词库';
            vocab.data.forEach(item => {
                const word = item.word;
                if (effectiveMode === 'cn-to-en') {
                    // 中文 -> 英文模式：构建映射 中文翻译 -> 合并后的英文词条
                    if (item.translations && Array.isArray(item.translations)) {
                        const chineseKeys = new Set();
                        item.translations.forEach(trans => {
                            const chinese = trans.translation;
                            if (!chinese) {
                                return;
                            }
                            chinese.split(/[,、，]/).forEach(cw => {
                                const cleanChinese = cw.trim();
                                if (cleanChinese) {
                                    chineseKeys.add(cleanChinese);
                                }
                            });
                        });
                        chineseKeys.forEach(cleanChinese => {
                            vocabularySet.add(cleanChinese);
                            if (!vocabularyMap.has(cleanChinese)) {
                                vocabularyMap.set(cleanChinese, createEmptyMergedData(word));
                            }
                            const mergedData = vocabularyMap.get(cleanChinese);
                            const isSameWord = mergedData.word === word;
                            // 合并翻译（按词性分组）
                            if (isSameWord) {
                                mergeTranslations(mergedData, item.translations, sourceName);
                            }
                            if (isSameWord) {
                                mergePhonetics(mergedData.phonetics, item.phonetics);
                                mergeSentenceExamples(mergedData.sentenceExamples, item.sentence_examples || item.sentenceExamples);
                            }
                            // 合并短语
                            if (isSameWord) {
                                mergePhrases(mergedData.phrases, item.phrases, sourceName);
                            }
                            // 记录来源
                            if (!mergedData.sources.includes(sourceName)) {
                                mergedData.sources.push(sourceName);
                            }
                        });
                    }
                } else if (effectiveMode === 'en-to-cn') {
                    // 英文 -> 中文模式：构建映射 英文单词 -> 合并后的翻译
                    if (word) {
                        const cleanWord = word.trim().toLowerCase();
                        if (cleanWord) {
                            vocabularySet.add(cleanWord);
                            if (!vocabularyMap.has(cleanWord)) {
                                vocabularyMap.set(cleanWord, createEmptyMergedData(word));
                            }
                            const mergedData = vocabularyMap.get(cleanWord);
                            // 合并翻译（按词性分组）
                            mergeTranslations(mergedData, item.translations, sourceName);
                            mergePhonetics(mergedData.phonetics, item.phonetics);
                            mergeSentenceExamples(mergedData.sentenceExamples, item.sentence_examples || item.sentenceExamples);
                            // 合并短语
                            mergePhrases(mergedData.phrases, item.phrases, sourceName);
                            // 记录来源
                            if (!mergedData.sources.includes(sourceName)) {
                                mergedData.sources.push(sourceName);
                            }
                        }
                    }
                }
            });
        });
        diagLog(`词库加载完成，共 ${vocabularyMap.size} 个词条，模式: ${annotationMode}`);
        if (vocabularyTrie) {
            diagLog('Trie树已就绪（从缓存加载）');
        }
    } catch (error) {
        console.error('加载词库失败:', error);
    }
}

async function persistFavoriteWords() {
    const words = Array.from(favoriteWordsSet).sort();
    await api.storage.local.set({favoriteWords: words});
}

async function persistBlockedWords() {
    const words = Array.from(blockedWordsSet).sort();
    const trieIndex = buildEnglishTrieIndex(words);
    blockedWordsTrie = trieIndex;
    await api.storage.local.set({
        blockedWords: words,
        blockedWordsTrieIndex: trieIndex
    });
}

//  ==============加载储存数据相关函数结束==============
// ===============读页面内容变化相关函数==================
// 滚动时检测并处理可见区域的新内容
function handleScrollRescan() {
    if (scrollRescanTimer) {
        clearTimeout(scrollRescanTimer);
    }
    scrollRescanTimer = setTimeout(() => {
        scrollRescanTimer = null;
        if (displayMode === 'off') {
            return;
        }
        // 获取视口内的主要内容容器（包含知乎、微博等常见网站的选择器）
        const selectors = [
            'article', 'main', '[role="main"]',
            // 知乎
            '.RichContent', '.RichText', '.ContentItem', '.List-item', '.AnswerItem', '.Post-content',
            // 通用
            '.post-stream', '.feed', '.timeline', '.content'
        ].join(',');
        const mainContainers = document.querySelectorAll(selectors);
        let processedCount = 0;
        // 滚动时清除配额缓存，让新内容有新配额
        resetBlockQuotaState();
        mainContainers.forEach(container => {
            const rect = container.getBoundingClientRect();
            // 检查容器是否在视口附近
            if (rect.bottom >= -500 && rect.top <= window.innerHeight + 500) {
                // 遍历容器内未处理的文本节点
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    if (!processedNodes.has(node) && node.textContent.trim().length > 0) {
                        enqueueNode(node);
                        processedCount++;
                    }
                }
            }
        });
        if (processedCount > 0) {
            diagLog('滚动检测到未处理节点:', processedCount);
        }
    }, SCROLL_RESCAN_DELAY_MS);
}

function clearScrollRescanTimer() {
    if (scrollRescanTimer) {
        clearTimeout(scrollRescanTimer);
        scrollRescanTimer = null;
    }
}

async function handleSpaNavigation(reason, _prevUrl, _nextUrl) {
    if (!isContentScriptActive()) {
        return;
    }
    languageDetectDone = false;
    logPageStatus('SPA nav ' + reason + ' mode:', getEffectiveMode());
    if (displayMode !== 'off') {
        await startProcessing({preserveDedupe: true});
        const root = document.querySelector('.post-stream') || document.body;
        scheduleSpaRescan(root);
    }
}

function setupSpaNavigationListener() {
    if (window.__jieciSpaListenerAttached) {
        return;
    }
    window.__jieciSpaListenerAttached = true;
    const notifyUrlChange = (reason) => {
        const current = location.href;
        if (current === lastSeenUrl) {
            return;
        }
        const prev = lastSeenUrl;
        lastSeenUrl = current;
        handleSpaNavigation(reason, prev, current);
    };
    const patchHistory = (method) => {
        const original = history[method];
        if (typeof original !== 'function') {
            return;
        }
        history[method] = function (...args) {
            const ret = original.apply(this, args);
            notifyUrlChange(method);
            return ret;
        };
    };
    patchHistory('pushState');
    patchHistory('replaceState');
    window.addEventListener('popstate', () => notifyUrlChange('popstate'));
    // Fallback: detect URL change even if history is manipulated elsewhere.
    setInterval(() => notifyUrlChange('interval'), 800);
}

let lastSeenUrl = location.href;

function scheduleSpaRescan(root) {
    clearSpaRescanTimers();
    spaRescanTimers.push(setTimeout(() => forceReprocessContainer(root), 600));
    spaRescanTimers.push(setTimeout(() => forceReprocessContainer(root), 1600));
}

function clearSpaRescanTimers() {
    spaRescanTimers.forEach(timer => clearTimeout(timer));
    spaRescanTimers = [];
}

function forceReprocessContainer(container) {
    if (!container) {
        return;
    }
    // Allow reprocessing of updated SPA content.
    processedNodes.delete(container);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL);
    let nodeCount = 0;
    let textNodeCount = 0;
    let sampleText = '';
    while (walker.nextNode()) {
        processedNodes.delete(walker.currentNode);
        nodeCount++;
        if (walker.currentNode.nodeType === Node.TEXT_NODE && walker.currentNode.textContent.trim().length > 5) {
            textNodeCount++;
            if (!sampleText && walker.currentNode.textContent.trim().length > 10) {
                sampleText = walker.currentNode.textContent.trim().substring(0, 30);
            }
        }
    }
    diagLog('forceReprocess 遍历节点:', nodeCount, '文本节点:', textNodeCount, '示例:', sampleText);
    enqueueNode(container);
}

function isContentScriptActive() {
    return typeof document !== 'undefined' && document.body;
}

function shouldSkipAnnotationDueToParen(text, match) {
    if (!text || !match) {
        return false;
    }
    const nextChar = text[match.end];
    return nextChar === '(';
}
// ===============读页面内容变化相关函数结束===============
// ==============Trie树相关代码==================
// Trie树（字典树）- 用于快速词汇匹配
class Trie {
    constructor(root = null) {
        if (root) {
            // 从序列化的数据恢复
            this.root = root;
        } else {
            this.root = {children: {}, isEnd: false, word: null};
        }
    }
}

function isWordInTrie(word, trie) {
    if (!trie) {
        return false;
    }
    let node = trie;
    for (const char of word) {
        if (!node[char]) {
            return false;
        }
        node = node[char];
    }
    return Boolean(node.$);
}

function isWordInVocabularyTrie(word) {
    if (!word || !vocabularyTrie || !vocabularyTrie.root) {
        return false;
    }
    let node = vocabularyTrie.root;
    for (const char of word) {
        if (!node.children || !node.children[char]) {
            return false;
        }
        node = node.children[char];
    }
    return Boolean(node.isEnd);
}

function buildEnglishTrieIndex(words) {
    const root = {};
    words.forEach((word) => {
        let node = root;
        for (const char of word) {
            if (!node[char]) {
                node[char] = {};
            }
            node = node[char];
        }
        node.$ = true;
    });
    return root;
}

// ==============Trie树相关代码结束==============
// ============ 去重相关函数 ====================
function getDedupeKey(matchText, effectiveMode) {
    if (!matchText) {
        return '';
    }
    if (effectiveMode === 'en-to-cn') {
        return matchText.toLowerCase();
    }
    return matchText;
}

async function loadDedupeStateFromStorage(cachedState) {
    let state = cachedState;
    if (!state) {
        const result = await api.storage.local.get(['dedupeGlobalState']);
        state = result.dedupeGlobalState;
    }
    if (!state || !state.remainingByWord) {
        return;
    }
    dedupeRemaining.clear();
    Object.keys(state.remainingByWord).forEach(key => {
        const value = state.remainingByWord[key];
        if (Number.isFinite(value) && value > 0) {
            dedupeRemaining.set(key, value);
        }
    });
}

function scheduleDedupeSave() {
    if (dedupeMode !== 'count') {
        return;
    }
    if (dedupeSaveTimer) {
        return;
    }
    dedupeSaveTimer = setTimeout(() => {
        dedupeSaveTimer = null;
        persistDedupeState();
    }, 1000);
}

function persistDedupeState() {
    if (dedupeMode !== 'count') {
        return;
    }
    const remainingByWord = {};
    dedupeRemaining.forEach((value, key) => {
        if (Number.isFinite(value) && value > 0) {
            remainingByWord[key] = value;
        }
    });
    api.storage.local.set({dedupeGlobalState: {remainingByWord}}).catch(() => {
    });
}

function shouldAllowDedupeMatch(matchText, effectiveMode) {
    if (dedupeMode === 'off') {
        return true;
    }
    const key = getDedupeKey(matchText, effectiveMode);
    if (!key) {
        return true;
    }
    if (dedupeMode === 'page') {
        if (dedupeSeen.has(key)) {
            return false;
        }
        dedupeSeen.add(key);
        return true;
    }
    if (dedupeMode === 'count') {
        const remaining = dedupeRemaining.get(key) || 0;
        if (remaining > 0) {
            dedupeRemaining.set(key, remaining - 1);
            scheduleDedupeSave();
            return false;
        }
        dedupeRemaining.set(key, dedupeRepeatCount);
        scheduleDedupeSave();
        return true;
    }
    return true;
}

function clampDedupeRemaining() {
    if (dedupeMode !== 'count') {
        return;
    }
    dedupeRemaining.forEach((value, key) => {
        if (!Number.isFinite(value) || value <= 0) {
            dedupeRemaining.delete(key);
            return;
        }
        if (value > dedupeRepeatCount) {
            dedupeRemaining.set(key, dedupeRepeatCount);
        }
    });
}

function resetDedupeState() {
    dedupeSeen.clear();
    if (dedupeMode !== 'count') {
        dedupeRemaining.clear();
    }
}

// ============ 去重相关函数结束 ================
// ==============配额与优先级相关函数=============
function isBlockDisplay(display) {
    return display === 'block' || display === 'flex' || display === 'grid' ||
        display === 'list-item' || display === 'table-cell';
}

function getNearestBlockContainer(textNode) {
    let container = textNode.parentElement;
    if (!container) {
        return null;
    }
    for (let i = 0; i < 20 && container; i++) {
        const style = window.getComputedStyle(container);
        if (isBlockDisplay(style.display)) {
            return container;
        }
        if (container === document.body) {
            return container;
        }
        container = container.parentElement;
    }
    return document.body || null;
}

function getSiblingBlockElement(start, direction) {
    let current = start;
    while (current) {
        current = direction === 'next' ? current.nextElementSibling : current.previousElementSibling;
        if (!current) {
            return null;
        }
        const style = window.getComputedStyle(current);
        if (isBlockDisplay(style.display)) {
            return current;
        }
    }
    return null;
}

function getBlockGroupKey(textNode) {
    const block = getNearestBlockContainer(textNode);
    if (!block) {
        return null;
    }
    if (blockGroupCache.has(block)) {
        return blockGroupCache.get(block);
    }
    const prevBlock = getSiblingBlockElement(block, 'previous');
    if (prevBlock) {
        const prevLength = (prevBlock.textContent || '').trim().length;
        if (prevLength > 0 && prevLength < MERGED_BLOCK_MIN_LENGTH) {
            blockGroupCache.set(block, block);
            return block;
        }
    }
    const currentLength = (block.textContent || '').trim().length;
    if (currentLength > 0 && currentLength < MERGED_BLOCK_MIN_LENGTH) {
        const nextBlock = getSiblingBlockElement(block, 'next');
        if (nextBlock) {
            blockGroupCache.set(block, nextBlock);
            return nextBlock;
        }
    }
    blockGroupCache.set(block, block);
    return block;
}

function getBlockQuotaRemaining(groupKey) {
    if (!groupKey) {
        return Infinity;
    }
    if (!Number.isFinite(maxMatchesPerNode)) {
        return Infinity;
    }
    if (!blockQuotaRemaining.has(groupKey)) {
        blockQuotaRemaining.set(groupKey, maxMatchesPerNode);
    }
    return blockQuotaRemaining.get(groupKey);
}

function consumeBlockQuota(groupKey, usedCount) {
    if (!groupKey) {
        return;
    }
    if (!Number.isFinite(maxMatchesPerNode)) {
        return;
    }
    if (!Number.isFinite(usedCount) || usedCount <= 0) {
        return;
    }
    const current = getBlockQuotaRemaining(groupKey);
    const next = Math.max(0, current - usedCount);
    blockQuotaRemaining.set(groupKey, next);
}

function resetProcessingQueue() {
    pendingNodes = [];
    pendingNodesSet = new WeakSet();
    cancelScheduledProcessing();
    resetBlockQuotaState();
}

function resetBlockQuotaState() {
    blockQuotaRemaining = new WeakMap();
    blockGroupCache = new WeakMap();
}

function resetBlockQuotaForElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return;
    }
    // 重置该元素本身的配额
    blockQuotaRemaining.delete(element);
    blockGroupCache.delete(element);
    // 重置所有子元素的配额缓存
    const children = element.querySelectorAll('*');
    children.forEach(child => {
        blockQuotaRemaining.delete(child);
        blockGroupCache.delete(child);
    });
}

// 计算优先级分数（多维度）
function calculatePriority(matchText, data, position, textLength) {
    // 1. 单词长度分数（长词优先）- 权重 40%
    const lengthScore = Math.min(data.wordLength / 15, 1) * 40;
    // 2. 位置分散度分数 - 权重 30%
    const positionRatio = position / textLength;
    // 中间位置的分数更高，避免全部集中在前面或后面
    const distributionScore = (1 - Math.abs(positionRatio - 0.5) * 2) * 30;
    // 3. 词汇复杂度分数 - 权重 30%
    // 基于单词长度和是否有短语
    const hasPhrasesBonus = (data.phrases && data.phrases.length > 0) ? 10 : 0;
    const complexityScore = Math.min((data.wordLength - 3) / 10 * 20, 20) + hasPhrasesBonus;
    return lengthScore + distributionScore + complexityScore;
}

// 智能选择匹配：平均分布算法
function selectMatchesWithDistribution(matches, textLength, maxCount) {
    if (!Number.isFinite(maxCount) || maxCount <= 0) {
        return matches;
    }
    if (matches.length <= maxCount) {
        return matches;
    }
    // 将文本分成若干个区域
    const regionCount = Math.min(maxCount, 5);
    const regionSize = textLength / regionCount;
    // 为每个区域分配匹配
    const selectedMatches = [];
    const regions = Array.from({length: regionCount}, () => []);
    // 将匹配分配到对应区域
    matches.forEach(match => {
        const regionIndex = Math.min(Math.floor(match.start / regionSize), regionCount - 1);
        regions[regionIndex].push(match);
    });
    // 从每个区域选择优先级最高的匹配
    let quotaPerRegion = Math.floor(maxCount / regionCount);
    let remainingQuota = maxCount - (quotaPerRegion * regionCount);
    regions.forEach((regionMatches) => {
        if (regionMatches.length === 0) return;
        // 按优先级排序
        regionMatches.sort((a, b) => b.priority - a.priority);
        // 分配配额
        let quota = quotaPerRegion;
        if (remainingQuota > 0 && regionMatches.length > quota) {
            quota++;
            remainingQuota--;
        }
        // 选择该区域的最佳匹配
        selectedMatches.push(...regionMatches.slice(0, quota));
    });
    // 如果还有剩余配额，从所有未选择的匹配中选择优先级最高的
    if (selectedMatches.length < maxCount) {
        const unselected = matches.filter(m => !selectedMatches.includes(m));
        unselected.sort((a, b) => b.priority - a.priority);
        selectedMatches.push(...unselected.slice(0, maxCount - selectedMatches.length));
    }
    return selectedMatches;
}

// ============== 配额与优先级相关函数结束=========
// ============== 调度相关函数=========
function enqueueNode(node) {
    if (!node || processedNodes.has(node) || pendingNodesSet.has(node)) {
        return;
    }
    pendingNodes.push(node);
    pendingNodesSet.add(node);
    scheduleProcessing();
}

function scheduleProcessing() {
    if (processingScheduled) {
        return;
    }
    processingScheduled = true;
    if (typeof requestIdleCallback === 'function') {
        processingHandle = requestIdleCallback(runProcessingQueue, {timeout: PROCESS_IDLE_TIMEOUT_MS});
    } else {
        processingHandle = setTimeout(() => {
            runProcessingQueue({didTimeout: true, timeRemaining: () => 0});
        }, 0);
    }
}

function cancelScheduledProcessing() {
    if (processingHandle == null) {
        return;
    }
    if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(processingHandle);
    } else {
        clearTimeout(processingHandle);
    }
    processingHandle = null;
    processingScheduled = false;
}

function runProcessingQueue(deadline) {
    processingScheduled = false;
    let processedCount = 0;
    while (pendingNodes.length > 0) {
        if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 5) {
            break;
        }
        const node = pendingNodes.shift();
        pendingNodesSet.delete(node);
        processNode(node);
        processedCount++;
        if (processedCount >= PROCESS_BATCH_LIMIT) {
            break;
        }
    }
    if (pendingNodes.length === 0 && !initialProcessingLogged) {
        // 延迟输出日志，等待异步处理完成
        scheduleFinalLog();
    }
    if (pendingNodes.length > 0) {
        scheduleProcessing();
    }
}

function resetAndReprocess() {
    stopProcessing();
    processedNodes = new WeakSet();
    startProcessing();
}

// 开始处理
async function startProcessing(options = {}) {
    diagLog('开始处理页面...');
    if (isSiteBlocked) {
        diagLog('站点在黑名单中，跳过标注');
        return;
    }
    const preserveDedupe = options && options.preserveDedupe === true;
    initialProcessingLogged = false;
    annotatedWordCount = 0; // 重置词汇统计
    pendingAsyncCount = 0; // 重置异步计数
    clearFinalLogTimer();
    processedNodes = new WeakSet();
    if (!preserveDedupe) {
        resetDedupeState();
    }
    resetProcessingQueue();
    // 如果是auto模式，先检测语言
    if (annotationMode === 'auto') {
        detectPageLanguage();
        // 重新加载词库以使用检测到的模式
        await loadVocabularies();
    }
    // 等待 DOM 完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            diagLog('DOM 加载完成，开始处理');
            diagLog('初始处理 body, 词库大小:', vocabularyMap.size, '模式:', getEffectiveMode(), 'minTextLength:', minTextLength);
            enqueueNode(document.body);
        });
    } else {
        diagLog('初始处理 body, 词库大小:', vocabularyMap.size, '模式:', getEffectiveMode(), 'minTextLength:', minTextLength);
        enqueueNode(document.body);
    }
    // 监听 DOM 变化
    if (!window.vocabularyObserver) {
        window.vocabularyObserver = new MutationObserver((mutations) => {
            let addedCount = 0;
            let hasNewElements = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData') {
                    // Text node updated in-place; allow reprocessing.
                    if (isInsideVocabHighlight(mutation.target) || isInsideVocabTooltip(mutation.target)) {
                        return;
                    }
                    processedNodes.delete(mutation.target);
                    enqueueNode(mutation.target);
                }
                mutation.addedNodes.forEach((node) => {
                    addedCount++;
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.closest && node.closest('.vocab-highlight, .vocab-tooltip')) {
                            return;
                        }
                        if (isInternalAnnotationNode(node)) {
                            return;
                        }
                        hasNewElements = true;
                        // 检查是否是内容容器
                        const className = typeof node.className === 'string'
                            ? node.className
                            : (node.className && typeof node.className.baseVal === 'string' ? node.className.baseVal : '');
                        const isContentContainer = className.includes('List-item') ||
                            className.includes('AnswerItem') ||
                            className.includes('ContentItem') ||
                            className.includes('RichContent');
                        if (isContentContainer) {
                            // 对于内容容器，延迟处理以确保内容渲染完成
                            setTimeout(() => {
                                resetBlockQuotaForElement(node);
                                forceReprocessContainer(node);
                                diagLog('延迟处理内容元素:', node.tagName, className.substring(0, 30));
                            }, 100);
                        } else {
                            // 对于其他元素，立即处理
                            resetBlockQuotaForElement(node);
                            forceReprocessContainer(node);
                        }
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        // 也处理新增的文本节点（如通过 innerHTML 或 textContent 更新的内容）
                        if (isInsideVocabHighlight(node) || isInsideVocabTooltip(node)) {
                            return;
                        }
                        processedNodes.delete(node);
                        enqueueNode(node);
                    }
                });
            });
            // 有新元素时重置所有配额，确保新内容有配额
            if (hasNewElements) {
                resetBlockQuotaState();
            }
            if (addedCount > 0) {
                diagLog('MutationObserver 检测到新增节点:', addedCount, '待处理队列:', pendingNodes.length);
            }
        });
        window.vocabularyObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        diagLog('MutationObserver 已启动');
    }
    // 添加滚动监听，处理懒加载内容
    if (!window.__jieciScrollListenerAttached) {
        window.addEventListener('scroll', handleScrollRescan, {passive: true});
        window.__jieciScrollListenerAttached = true;
        diagLog('滚动监听已启动');
    }
}

// 停止处理
function stopProcessing() {
    diagLog('停止处理页面');
    resetProcessingQueue();
    clearScrollRescanTimer();
    if (window.__jieciScrollListenerAttached) {
        window.removeEventListener('scroll', handleScrollRescan);
        window.__jieciScrollListenerAttached = false;
    }
    if (window.vocabularyObserver) {
        window.vocabularyObserver.disconnect();
        window.vocabularyObserver = null;
    }
    if (globalTooltip) {
        if (globalTooltipHideTimer) {
            clearTimeout(globalTooltipHideTimer);
            globalTooltipHideTimer = null;
        }
        stopSpeaking();
        globalTooltip.remove();
        globalTooltip = null;
        globalTooltipOwner = null;
        isTooltipVisible = false;
        isTooltipPinned = false;
        isTooltipDragging = false;
        tooltipDragOffset = null;
        tooltipManualPositioned = false;
        isHoveringHighlight = false;
        isHoveringTooltip = false;
        if (tooltipListenersAttached) {
            window.removeEventListener('scroll', repositionGlobalTooltip, true);
            window.removeEventListener('resize', repositionGlobalTooltip);
            tooltipListenersAttached = false;
        }
    }
    document.querySelectorAll('.vocab-tooltip').forEach(el => {
        el.remove();
    });
    // 移除所有标注
    document.querySelectorAll('.vocab-highlight').forEach(el => {
        const originalText = el.dataset.originalText;
        const text = originalText || el.textContent.replace(/\([^)]+\)$/, '');
        el.replaceWith(text);
    });
}

// ============== 调度相关函数结束=======
// 初始化，在这里开始执行
(async function init() {
    await loadSettings();
    setupSpaNavigationListener();
    if (annotationMode === 'auto') {
        detectPageLanguage();
    }
    logPageStatus('Language detection result:', getLanguageResultLabel());
    diagLog('初始化完成，显示模式:', displayMode, '词库大小:', vocabularyMap.size);
    if (displayMode !== 'off') {
        await startProcessing();
    }
})();
// 监听来自 popup 的消息,如有变动进行更新
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    diagLog('收到消息:', message);
    if (message.action === 'updateDisplayMode') {
        displayMode = message.mode;
        diagLog('切换显示模式:', displayMode);
        if (displayMode === 'off') {
            stopProcessing();
        } else {
            resetAndReprocess();
        }
    } else if (message.action === 'reloadVocabularies') {
        diagLog('重新加载词库');
        loadVocabularies();
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateMaxMatches') {
        maxMatchesPerNode = normalizeMaxMatches(message.maxMatches);
        diagLog('更新标注上限:', maxMatchesPerNode);
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateMinTextLength') {
        minTextLength = message.minLength || 0;
        diagLog('更新容器最小字数:', minTextLength);
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateMode') {
        annotationMode = message.mode;
        diagLog('更新标注模式:', annotationMode);
        // 重新加载词库以更新映射
        loadVocabularies();
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAnnotationOrder') {
        cnToEnOrder = message.cnToEnOrder || 'source-first';
        enToCnOrder = message.enToCnOrder || 'source-first';
        diagLog('更新标注顺序:', cnToEnOrder, enToCnOrder);
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAnnotationUnderline') {
        disableAnnotationUnderline = message.disabled === true;
        if (displayMode === 'annotation') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAnnotationTooltip') {
        disableAnnotationTooltip = message.disabled === true;
        if (displayMode === 'annotation') {
            hideGlobalTooltip();
            resetAndReprocess();
        }
    } else if (message.action === 'updateSpeechVoice') {
        speechVoiceURI = message.speechVoiceURI || '';
    } else if (message.action === 'updateHighlightColor') {
        highlightColorMode = message.mode || 'auto';
        highlightColor = message.color || '#2196f3';
        applyHighlightColor(highlightColorMode, highlightColor);
    } else if (message.action === 'updateSmartSkipCodeLinks') {
        smartSkipCodeLinks = message.enabled !== false;
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateSearchProvider') {
        searchProvider = message.provider || 'youdao';
        if (globalTooltip) {
            const searchLinks = globalTooltip.querySelectorAll('.vocab-search-btn[data-word]');
            searchLinks.forEach((searchLink) => {
                const word = searchLink.dataset.word || '';
                const searchConfig = getSearchProviderConfig(word, searchProvider);
                searchLink.href = searchConfig.url;
                searchLink.title = searchConfig.label;
                searchLink.setAttribute('aria-label', searchConfig.label);
            });
        }
    } else if (message.action === 'updateBlockedWords') {
        blockedWordsSet = new Set(
            Array.isArray(message.words)
                ? message.words.map(normalizeWord).filter(Boolean)
                : []
        );
        blockedWordsTrie = message.trieIndex || buildEnglishTrieIndex(Array.from(blockedWordsSet));
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateSiteBlacklist') {
        siteBlockRules = Array.isArray(message.rules)
            ? message.rules.map(normalizeHost).filter(Boolean)
            : [];
        if (message.index && Array.isArray(message.index.exact) && Array.isArray(message.index.wildcards)) {
            siteBlockIndex = {
                exact: new Set(message.index.exact),
                wildcards: message.index.wildcards
            };
        } else {
            siteBlockIndex = compileSiteBlockIndex(siteBlockRules);
        }
        updateSiteBlockState();
        if (isSiteBlocked) {
            stopProcessing();
            return;
        }
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'getPageHost') {
        sendResponse({host: window.location.hostname || ''});
    } else if (message.action === 'updateDedupeMode') {
        dedupeMode = message.mode || 'page';
        resetDedupeState();
        if (dedupeMode === 'count') {
            loadDedupeStateFromStorage();
        } else {
            dedupeRemaining.clear();
        }
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDedupeRepeatCount') {
        dedupeRepeatCount = Number(message.repeatCount) || 50;
        clampDedupeRemaining();
        scheduleDedupeSave();
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'clearDedupeCounts') {
        dedupeRemaining.clear();
        api.storage.local.remove('dedupeGlobalState').catch(() => {
        });
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDebugMode') {
        debugModeEnabled = message.enabled === true;
        console.log('[jieci] 调试模式:', debugModeEnabled ? '开启' : '关闭');
    } else if (message.action === 'resetTooltipSize') {
        tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
        if (globalTooltip) {
            applyTooltipSize(globalTooltip, tooltipSize);
        }
    } else if (message.action === 'getLanguageStats') {
        const sampleText = getSampleTextFromPage();
        languageStats = getLanguageStatsFromText(sampleText);
        sendResponse({
            stats: languageStats,
            annotationMode,
            actualAnnotationMode
        });
    }
});
// 页面加载完成后的额外检查
window.addEventListener('load', () => {
    diagLog('页面完全加载完成');
    if (displayMode !== 'off' && vocabularyMap.size > 0) {
        diagLog('重新处理页面内容');
        processedNodes = new WeakSet();
        enqueueNode(document.body);
    }
});

