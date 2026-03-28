/**
 * 文件作用：
 * 提供内容脚本使用的词汇工具能力，包括分词、词性推断、jieba 请求封装等。
 * 通过 window.JieciWordTools 暴露 createWordTools 工厂，供 content.js 按需注入依赖后调用。
 */
(function initJieciWordToolsGlobal(global) {
    /**
     * 作用：创建词汇工具集合，并注入运行依赖（如日志函数、词表访问器）。
     * 输入：deps
     * 输出：词汇工具对象
     */
    function createWordTools(deps) {
        const safeDiagLog = typeof deps.diagLog === 'function' ? deps.diagLog : () => {};
        const getVocabularySet = typeof deps.getVocabularySet === 'function' ? deps.getVocabularySet : () => new Set();

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
    const maxLen = Math.max(...Array.from(getVocabularySet()).map(w => w.length), 4);
    while (i < text.length) {
        const char = text[i];
        if (isChinese(char)) {
            let matched = false;
            for (let len = Math.min(maxLen, text.length - i); len > 0; len--) {
                const word = text.substr(i, len);
                if (getVocabularySet().has(word)) {
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
    const maxLen = Math.max(...Array.from(getVocabularySet()).map(w => w.length), 4);
    while (i >= 0) {
        const char = text[i];
        if (isChinese(char)) {
            let matched = false;
            for (let len = Math.min(maxLen, i + 1); len > 0; len--) {
                const start = i - len + 1;
                const word = text.substring(start, i + 1);
                if (getVocabularySet().has(word)) {
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
function requestJiebaPayload(messageType, text, resultKey) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            resolve(null);
            return;
        }
        chrome.runtime.sendMessage({type: messageType, text}, (response) => {
            if (chrome.runtime.lastError) {
                safeDiagLog('[jieba]', messageType, 'failed:', chrome.runtime.lastError);
                resolve(null);
                return;
            }
            if (!response || !response.ok || !Array.isArray(response[resultKey])) {
                resolve(null);
                return;
            }
            resolve(response[resultKey]);
        });
    });
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

// 统一词性字符串格式，避免大小写/句点导致匹配失败。
function normalizeType(type) {
    return String(type || '').trim().toLowerCase().replace(/\.$/, '');
}

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

        return {
            EN_SEGMENTER,
            EN_STOPWORDS,
            requestJiebaTokens,
            getWordSegments,
            segmentChinese,
            isChinese,
            normalizeMaxMatches,
            requestJiebaTags,
            normalizeJiebaTag,
            EN_FUNCTION_WORDS,
            inferEnglishPOS,
            JIEBA_TO_VOCAB_POS,
            findMatchingType
        };
    }

    global.JieciWordTools = {
        createWordTools
    };
})(window);

