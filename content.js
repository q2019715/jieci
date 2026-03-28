// content.js - 网页内容脚本，负责文本匹配和替换
// by q2019715 https://www.q2019.com
// for software https://jieci.top

const tooltipRuntime = (typeof window !== 'undefined' && window.JieciTooltip) ? window.JieciTooltip : null;
if (!tooltipRuntime || typeof tooltipRuntime.createTooltipController !== 'function') {
    throw new Error('[jieci] tooltip runtime is not ready: content_js/tooltip.js');
}
const createTooltipController = tooltipRuntime.createTooltipController;
const WORD_CARD_POPUP_SIZE_STORAGE_KEY = tooltipRuntime.WORD_CARD_POPUP_SIZE_STORAGE_KEY;
const aiRuntime = (typeof window !== 'undefined' && window.JieciAI) ? window.JieciAI : null;
if (!aiRuntime || typeof aiRuntime.createAIController !== 'function') {
    throw new Error('[jieci] ai runtime is not ready: content_js/ai.js');
}
const createAIController = aiRuntime.createAIController;
const wordlistStoreRuntime = (typeof window !== 'undefined' && window.JieciWordlistStore) ? window.JieciWordlistStore : null;
if (!wordlistStoreRuntime || typeof wordlistStoreRuntime.createWordlistStore !== 'function') {
    throw new Error('[jieci] wordlist store runtime is not ready: content_js/wordlist-store.js');
}
const createWordlistStore = wordlistStoreRuntime.createWordlistStore;
const siteCheckRuntime = (typeof window !== 'undefined' && window.JieciSiteCheck) ? window.JieciSiteCheck : null;
if (!siteCheckRuntime || typeof siteCheckRuntime.createSiteChecker !== 'function') {
    throw new Error('[jieci] site check runtime is not ready: content_js/site-check.js');
}
const createSiteChecker = siteCheckRuntime.createSiteChecker;
const wordToolsRuntime = (typeof window !== 'undefined' && window.JieciWordTools) ? window.JieciWordTools : null;
if (!wordToolsRuntime || typeof wordToolsRuntime.createWordTools !== 'function') {
    throw new Error('[jieci] word tools runtime is not ready: content_js/wordtools.js');
}
const createWordTools = wordToolsRuntime.createWordTools;
const annotationEngineRuntime = (typeof window !== 'undefined' && window.JieciAnnotationEngine) ? window.JieciAnnotationEngine : null;
if (!annotationEngineRuntime || typeof annotationEngineRuntime.createAnnotationEngine !== 'function') {
    throw new Error('[jieci] annotation engine runtime is not ready: content_js/annotation-engine.js');
}
const createAnnotationEngine = annotationEngineRuntime.createAnnotationEngine;

// ===========常量定义================
let displayMode = 'off'; // 当前页面生效的显示模式：'off'、'underline'、'annotation'、'replace'
let displayModeUnified = 'off'; // 统一显示模式（分语言关闭时使用）
let displayModeChinese = 'off'; // 中文网页显示模式
let displayModeEnglish = 'off'; // 英文网页显示模式
let displayModeSplitByLanguage = true; // 是否开启分语言显示模式
let pageLanguage = 'chinese'; // 当前页面语言：chinese | english
let phrasesExpanded = false;
let examplesExpanded = false;
let blockedWordsSet = new Set();
let favoriteWordsSet = new Set();
let blockedWordsTrie = null;
let siteBlockRules = [];
let siteBlockIndex = {exact: new Set(), wildcards: []};
let siteBlockMode = 'blacklist';
let isSiteBlocked = false;
let vocabularyMap = new Map(); // 中文翻译 -> 英文单词的映射
let processedNodes = new WeakSet(); // 记录已处理的节点
let vocabularyTrie = null; // Trie树索引
let maxMatchesPerNode = 3; // 单个文本节点最多标注的词汇数量（可配置）
let minTextLength = 10; // 容器最小字数，少于此数不添加标注
let annotationMode = 'auto'; // 标注模式：'cn-to-en'、'auto'、'en-to-cn'
let actualAnnotationMode = 'cn-to-en'; // 实际使用的标注模式（auto模式下自动检测）
let cnToEnOrder = 'source-first';
let enToCnOrder = 'source-first';
let disableAnnotationUnderline = false;
let annotationWordCardPopupEnabled = true;
let wordCardHighlightMatchedChinese = true;
let highlightColorMode = 'none';
let highlightColor = '#2196f3';
let vocabularySet = new Set(); // 词汇集合，用于分词
let languageStats = null; // {chineseCount, englishCount, chineseRatio, englishRatio, totalUnits, detected}
let languageDetectDone = false;
let smartSkipCodeLinks = true;
let smartSkipEditableTextboxes = true;
let dedupeMode = 'page'; // off | page | count
let dedupeRepeatCount = 50;
let dedupeSaveTimer = null;
let debugModeEnabled = false;
let analyzedTextNodeSignatures = new WeakMap();
const PROCESS_BATCH_LIMIT = 200;
const PROCESS_IDLE_TIMEOUT_MS = 200;
let initialProcessingLogged = false;
let annotatedWordCount = 0; // 统计标注的词汇数量
let pendingAsyncCount = 0; // 追踪异步处理数量
let finalLogTimer = null; // 延迟输出最终日志
let spaRescanTimers = [];
let scrollRescanTimer = null;
const SCROLL_RESCAN_DELAY_MS = 300;
let diagSkipReasons = {quota: 0, minLength: 0, overflow: 0, noMatch: 0};
let lastDiagReport = 0;

// ========== 工具函数 ==========
function normalizeWord(word) {
    return String(word || '').trim().toLowerCase();
}

function normalizeDisplayMode(mode) {
    const safe = String(mode || '').trim();
    if (safe === 'underline' || safe === 'annotation' || safe === 'replace') {
        return safe;
    }
    return 'off';
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

const wordTools = createWordTools({
    diagLog: (...args) => diagLog(...args),
    getVocabularySet: () => vocabularySet
});
const {
    EN_SEGMENTER,
    EN_STOPWORDS,
    requestJiebaTokens,
    getWordSegments,
    segmentChinese,
    requestJiebaTags,
    normalizeJiebaTag,
    inferEnglishPOS,
    findMatchingType,
    isChinese,
    normalizeMaxMatches
} = wordTools;
const siteChecker = createSiteChecker({
    diagLog: (...args) => diagLog(...args),
    isChinese
});
const normalizeHost = siteChecker.normalizeHost;
const compileSiteBlockIndex = siteChecker.compileSiteBlockIndex;
const wordlistStore = createWordlistStore({
    findMatchingType,
    deserializeTrie: (root) => new Trie(root),
    buildEnglishTrieIndex,
    diagLog: (...args) => diagLog(...args)
});
const formatSourceList = wordlistStore.formatSourceList;
const getFirstMeaning = wordlistStore.getFirstMeaning;
const aiController = createAIController({
    diagLog: (...args) => diagLog(...args),
    shouldSkipAnnotationDueToParen: (text, match) => annotationEngine.shouldSkipAnnotationDueToParen(text, match),
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    isDebugEnabled: () => debugModeEnabled
});

// ===================页面修改相关函数开始===============
function formatInlineAnnotation(sourceText, targetText, order) {
    if (!targetText) {
        return sourceText;
    }
    if (order === 'target-first') {
        return `${targetText}(${sourceText})`;
    }
    return `${sourceText}(${targetText})`;
}

const tooltipController = createTooltipController({
    setPhrasesExpanded: (value) => {
        phrasesExpanded = value === true;
    },
    setExamplesExpanded: (value) => {
        examplesExpanded = value === true;
    },
    getPhrasesExpanded: () => phrasesExpanded === true,
    getExamplesExpanded: () => examplesExpanded === true,
    normalizeWord,
    getBlockedWordsSet: () => blockedWordsSet,
    getFavoriteWordsSet: () => favoriteWordsSet,
    persistBlockedWords,
    persistFavoriteWords,
    getDisplayMode: () => displayMode,
    getIsSiteBlocked: () => isSiteBlocked,
    getWordCardHighlightMatchedChinese: () => wordCardHighlightMatchedChinese,
    findMatchingType,
    formatSourceList,
    isChinese
});

function createHighlightSpan(matchText, data, posTag = null, selectedMeaning = null, aiScore = null) {
    if (isBlockedWord(matchText)) {
        return document.createTextNode(matchText);
    }
    const span = document.createElement('span');
    span.className = 'vocab-highlight';
    span.dataset.originalText = matchText;
    if ((displayMode === 'annotation' || displayMode === 'replace') && disableAnnotationUnderline) {
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
            // 如果有 AI 选择的最佳释义，优先使用
            const firstMeaning = selectedMeaning || getFirstMeaning(data, actualPOS);
            span.textContent = formatInlineAnnotation(matchText, firstMeaning, enToCnOrder);
        }
    } else if (displayMode === 'replace') {
        if (effectiveMode === 'cn-to-en') {
            const replacedWord = data.word || matchText;
            span.textContent = replacedWord;
        } else if (effectiveMode === 'en-to-cn') {
            const firstMeaning = selectedMeaning || getFirstMeaning(data, actualPOS);
            span.textContent = firstMeaning || matchText;
        } else {
            span.textContent = matchText;
        }
    }
    // 保存 posTag 到 data 中，供 tooltip 使用
    const matchedMeaning = effectiveMode === 'cn-to-en'
        ? String(matchText || '').trim()
        : String(selectedMeaning || '').trim();
    const dataWithPOS = {
        ...data,
        _posTag: posTag,
        _aiScore: aiScore,
        _selectedMeaning: selectedMeaning || '',
        _matchedMeaning: matchedMeaning,
        _effectiveMode: effectiveMode
    };
    const allowTooltip = displayMode !== 'annotation' || annotationWordCardPopupEnabled;
    tooltipController.bindHighlightTooltip({
        span,
        dataWithPOS,
        matchText,
        allowTooltip
    });
    return span;
}

const annotationEngine = createAnnotationEngine({
    diagLog: (...args) => diagLog(...args),
    getDisplayMode: () => displayMode,
    getIsSiteBlocked: () => isSiteBlocked,
    getMaxMatchesPerNode: () => maxMatchesPerNode,
    getSmartSkipCodeLinks: () => smartSkipCodeLinks,
    getSmartSkipEditableTextboxes: () => smartSkipEditableTextboxes,
    createHighlightSpan,
    formatDiagText,
    formatDiagList,
    mergedBlockMinLength: 40,
    getMinTextLength: () => minTextLength,
    getContainerTextLength: (node) => {
        const container = annotationEngine.getNearestBlockContainer(node);
        return container ? (container.textContent || '').trim().length : 0;
    },
    incrementSkipReason: (reason) => {
        if (Object.prototype.hasOwnProperty.call(diagSkipReasons, reason)) {
            diagSkipReasons[reason]++;
        }
    },
    reportDiagSkipReasons: () => reportDiagSkipReasons(),
    getEffectiveMode: () => getEffectiveMode(),
    getAnalysisSignature: (mode, text) => `${mode}|${text}`,
    isAnalysisCacheHit: (node, signature) => analyzedTextNodeSignatures.get(node) === signature,
    setAnalysisSignature: (node, signature) => {
        analyzedTextNodeSignatures.set(node, signature);
    },
    schedulePersistDedupeState: () => {
        scheduleDedupeSave();
    },
    requestJiebaTags: (text) => requestJiebaTags(text),
    requestJiebaTokens: (text) => requestJiebaTokens(text),
    normalizeJiebaTag: (tag) => normalizeJiebaTag(tag),
    segmentChinese: (text) => segmentChinese(text),
    getWordSegments: (text, segmenter) => getWordSegments(text, segmenter),
    getENSegmenter: () => EN_SEGMENTER,
    getENStopwords: () => EN_STOPWORDS,
    inferEnglishPOS: (text, start, end) => inferEnglishPOS(text, start, end),
    isBlockedWord: (word) => isBlockedWord(word),
    getVocabularyTrie: () => vocabularyTrie,
    getVocabularyMap: () => vocabularyMap,
    processMatchesWithAI: (text, matches, mode) => aiController.processMatchesWithAI(text, matches, mode),
    getAIMode: () => aiController.getConfig().mode,
    increasePendingAsync: () => {
        pendingAsyncCount++;
    },
    decreasePendingAsync: () => {
        pendingAsyncCount--;
    },
    isProcessedNode: (node) => processedNodes.has(node),
    markProcessedNode: (node) => {
        processedNodes.add(node);
    },
    onAppliedCount: (count) => {
        annotatedWordCount += count;
    },
    scheduleFinalLog: () => {
        if (!initialProcessingLogged) {
            scheduleFinalLog();
        }
    },
    processBatchLimit: PROCESS_BATCH_LIMIT,
    processIdleTimeoutMs: PROCESS_IDLE_TIMEOUT_MS
});

// ===================页面修改相关函数结束===============
// ==================语言检测相关函数==================
// 从当前页面进行抽样，用来判断语言
function getSampleTextFromPage() {
    const bodyText = document.body ? (document.body.textContent || '') : '';
    return siteChecker.getSampleTextFromPage(bodyText);
}

function getLanguageStatsFromText(sampleText) {
    return siteChecker.getLanguageStatsFromText(sampleText);
}

function detectPageLanguageForDisplayMode() {
    const sampleText = getSampleTextFromPage();
    const stats = getLanguageStatsFromText(sampleText);
    if (stats && stats.detected) {
        languageStats = stats;
        pageLanguage = stats.chineseRatio >= 0.1 ? 'chinese' : 'english';
        return pageLanguage;
    }
    pageLanguage = actualAnnotationMode === 'en-to-cn' ? 'english' : 'chinese';
    return pageLanguage;
}

function refreshDisplayModeByPageLanguage() {
    if (displayModeSplitByLanguage !== true) {
        displayMode = displayModeUnified;
        return;
    }
    displayMode = pageLanguage === 'english' ? displayModeEnglish : displayModeChinese;
}

// 自动检测页面主要语言
function detectPageLanguage() {
    const result = siteChecker.detectPageLanguageState({
        annotationMode,
        languageDetectDone,
        actualAnnotationMode,
        bodyText: document.body ? (document.body.textContent || '') : ''
    });
    if (result.languageDetectDone !== undefined) {
        languageDetectDone = result.languageDetectDone;
    }
    if (result.languageStats) {
        languageStats = result.languageStats;
    }
    if (result.actualAnnotationMode) {
        actualAnnotationMode = result.actualAnnotationMode;
    }
    detectPageLanguageForDisplayMode();
    refreshDisplayModeByPageLanguage();
    return result.changed === true;
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
function updateSiteBlockState() {
    const result = siteChecker.updateSiteBlockState(window.location.hostname, siteBlockIndex, siteBlockMode);
    isSiteBlocked = result.blocked;
}

// ================站点黑名单相关函数结束===========
// ================加载储存数据相关函数，包含数据持久化=============
// 加载设置
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['displayMode', 'displayModeChinese', 'displayModeEnglish', 'displayModeSplitByLanguage', 'maxMatchesPerNode', 'minTextLength', 'annotationMode', 'highlightColorMode', 'highlightColor', 'cnToEnOrder', 'enToCnOrder', 'disableAnnotationUnderline', 'annotationWordCardPopupEnabled', 'wordCardHighlightMatchedChinese', 'speechVoiceURI', 'smartSkipCodeLinks', 'smartSkipEditableTextboxes', 'searchProvider', 'phrasesExpanded', 'examplesExpanded', 'blockedWords', 'blockedWordsTrieIndex', 'favoriteWords', 'siteBlockRules', 'siteBlockIndex', 'siteBlockMode', 'dedupeMode', 'dedupeRepeatCount', 'dedupeCooldownSeconds', 'dedupeGlobalState', 'debugMode', WORD_CARD_POPUP_SIZE_STORAGE_KEY, 'aiMode', 'aiModelSource', 'aiModelInfoUrl', 'aiTrigger', 'aiSimilarityThreshold', 'aiProcessingDelay']);
        const fallbackDisplayMode = normalizeDisplayMode(result.displayMode || 'off');
        displayModeUnified = fallbackDisplayMode;
        displayModeChinese = normalizeDisplayMode(result.displayModeChinese || fallbackDisplayMode);
        displayModeEnglish = normalizeDisplayMode(result.displayModeEnglish || fallbackDisplayMode);
        displayModeSplitByLanguage = result.displayModeSplitByLanguage !== false;
        maxMatchesPerNode = normalizeMaxMatches(result.maxMatchesPerNode ?? maxMatchesPerNode);
        minTextLength = result.minTextLength ?? minTextLength;
        debugModeEnabled = result.debugMode === true;
        // AI Settings
        aiController.setConfig({
            mode: result.aiMode || 'none',
            source: result.aiModelSource || 'cloud',
            infoUrl: result.aiModelInfoUrl || 'https://api.jieci.top/model/onnx/info.json',
            trigger: result.aiTrigger || 'all',
            threshold: result.aiSimilarityThreshold !== undefined ? Number(result.aiSimilarityThreshold) : 0.25,
            delay: result.aiProcessingDelay !== undefined ? Number(result.aiProcessingDelay) : 0
        });
        tooltipController.setTooltipSizeFromStorage(result[WORD_CARD_POPUP_SIZE_STORAGE_KEY]);
        annotationMode = result.annotationMode || 'auto';
        cnToEnOrder = result.cnToEnOrder || 'source-first';
        enToCnOrder = result.enToCnOrder || 'source-first';
        disableAnnotationUnderline = result.disableAnnotationUnderline === true;
        annotationWordCardPopupEnabled = result.annotationWordCardPopupEnabled !== false;
        wordCardHighlightMatchedChinese = result.wordCardHighlightMatchedChinese !== false;
        tooltipController.setSpeechVoiceURI(result.speechVoiceURI || '');
        highlightColorMode = result.highlightColorMode ?? highlightColorMode;
        highlightColor = result.highlightColor ?? highlightColor;
        smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
        smartSkipEditableTextboxes = result.smartSkipEditableTextboxes !== false;
        tooltipController.setSearchProvider(result.searchProvider || 'youdao');
        blockedWordsSet = new Set(
            Array.isArray(result.blockedWords)
                ? result.blockedWords.map(normalizeWord).filter(Boolean)
                : []
        );
        blockedWordsTrie = result.blockedWordsTrieIndex || null;
        siteBlockRules = Array.isArray(result.siteBlockRules)
            ? result.siteBlockRules.map(normalizeHost).filter(Boolean)
            : [];
        siteBlockMode = result.siteBlockMode === 'whitelist' ? 'whitelist' : 'blacklist';
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
        annotationEngine.setDedupeConfig({
            mode: dedupeMode,
            repeatCount: dedupeRepeatCount
        });
        detectPageLanguageForDisplayMode();
        refreshDisplayModeByPageLanguage();
        diagLog('加载设置 - 页面语言:', pageLanguage, '分语言:', displayModeSplitByLanguage, '显示模式(统一/中/英):', `${displayModeUnified}/${displayModeChinese}/${displayModeEnglish}`, '当前模式:', displayMode, '标注上限:', maxMatchesPerNode, '最小字数:', minTextLength, '标注模式:', annotationMode);
        await loadVocabularies();
        annotationEngine.applyHighlightColor(highlightColorMode, highlightColor);
        if (dedupeMode === 'count') {
            await loadDedupeStateFromStorage(result.dedupeGlobalState);
            annotationEngine.clampDedupeRemaining();
        } else {
            annotationEngine.clearDedupeRemaining();
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 加载词库
async function loadVocabularies() {
    try {
        const result = await wordlistStore.loadVocabularies(annotationMode, actualAnnotationMode);
        vocabularyMap = result.vocabularyMap;
        vocabularySet = result.vocabularySet;
        vocabularyTrie = result.vocabularyTrie;
    } catch (error) {
        console.error('加载词库失败:', error);
    }
}

async function persistFavoriteWords() {
    await wordlistStore.persistFavoriteWords(favoriteWordsSet);
}

async function persistBlockedWords() {
    blockedWordsTrie = await wordlistStore.persistBlockedWords(blockedWordsSet);
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
        if (displayMode === 'off' || isSiteBlocked) {
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
        annotationEngine.resetBlockQuotaState();
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
    updateSiteBlockState();
    if (isSiteBlocked || displayMode === 'off') {
        stopProcessing();
        return;
    }
    languageDetectDone = false;
    logPageStatus('SPA nav ' + reason + ' mode:', getEffectiveMode());
    await startProcessing({preserveDedupe: true});
    const root = document.querySelector('.post-stream') || document.body;
    scheduleSpaRescan(root);
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
        void handleSpaNavigation(reason, prev, current);
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
    if (displayMode === 'off' || isSiteBlocked) {
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

aiController.setConfig({
    mode: 'none',
    trigger: 'all',
    source: 'cloud',
    infoUrl: 'https://api.jieci.top/model/onnx/info.json',
    threshold: 0.25,
    delay: 0
});
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

function buildEnglishTrieIndex(words) {
    const root = {};
    words.forEach((word) => {
        const cleanWord = normalizeWord(word);
        if (!cleanWord) {
            return;
        }
        let node = root;
        for (const char of cleanWord) {
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
async function loadDedupeStateFromStorage(cachedState) {
    let state = cachedState;
    if (!state) {
        const result = await chrome.storage.local.get(['dedupeGlobalState']);
        state = result.dedupeGlobalState;
    }
    if (!state || !state.remainingByWord) {
        return;
    }
    annotationEngine.setDedupeRemainingFromObject(state.remainingByWord);
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
    const remainingByWord = annotationEngine.exportDedupeRemainingObject();
    chrome.storage.local.set({dedupeGlobalState: {remainingByWord}}).catch(() => {
    });
}

// ============ 去重相关函数结束 ================
// ============== 调度相关函数=========
function enqueueNode(node) {
    if (!node || processedNodes.has(node)) {
        return;
    }
    annotationEngine.enqueueNode(node);
}

function resetAndReprocess() {
    detectPageLanguageForDisplayMode();
    refreshDisplayModeByPageLanguage();
    if (displayMode === 'off' || isSiteBlocked) {
        stopProcessing();
        return;
    }
    stopProcessing();
    processedNodes = new WeakSet();
    analyzedTextNodeSignatures = new WeakMap();
    void startProcessing();
}

// 开始处理
async function startProcessing(options = {}) {
    diagLog('开始处理页面...');
    detectPageLanguageForDisplayMode();
    refreshDisplayModeByPageLanguage();
    if (displayMode === 'off') {
        diagLog('当前页面显示模式为关闭，跳过标注');
        return;
    }
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
    analyzedTextNodeSignatures = new WeakMap();
    if (!preserveDedupe) {
        annotationEngine.resetDedupeState();
    }
    annotationEngine.resetProcessingQueue();
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
                    if (annotationEngine.isInsideVocabHighlight(mutation.target) || annotationEngine.isInsideVocabTooltip(mutation.target)) {
                        return;
                    }
                    analyzedTextNodeSignatures.delete(mutation.target);
                    processedNodes.delete(mutation.target);
                    enqueueNode(mutation.target);
                }
                mutation.addedNodes.forEach((node) => {
                    addedCount++;
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.closest && node.closest('.vocab-highlight, .vocab-tooltip')) {
                            return;
                        }
                        if (annotationEngine.isInternalAnnotationNode(node)) {
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
                                annotationEngine.resetBlockQuotaForElement(node);
                                forceReprocessContainer(node);
                                diagLog('延迟处理内容元素:', node.tagName, className.substring(0, 30));
                            }, 100);
                        } else {
                            // 对于其他元素，立即处理
                            annotationEngine.resetBlockQuotaForElement(node);
                            forceReprocessContainer(node);
                        }
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        // 也处理新增的文本节点（如通过 innerHTML 或 textContent 更新的内容）
                        if (annotationEngine.isInsideVocabHighlight(node) || annotationEngine.isInsideVocabTooltip(node)) {
                            return;
                        }
                        processedNodes.delete(node);
                        enqueueNode(node);
                    }
                });
            });
            // 有新元素时重置所有配额，确保新内容有配额
            if (hasNewElements) {
                annotationEngine.resetBlockQuotaState();
            }
            if (addedCount > 0) {
                diagLog('MutationObserver 检测到新增节点:', addedCount, '待处理队列:', annotationEngine.getPendingCount());
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
    annotationEngine.resetProcessingQueue();
    clearScrollRescanTimer();
    if (window.__jieciScrollListenerAttached) {
        window.removeEventListener('scroll', handleScrollRescan);
        window.__jieciScrollListenerAttached = false;
    }
    if (window.vocabularyObserver) {
        window.vocabularyObserver.disconnect();
        window.vocabularyObserver = null;
    }
    tooltipController.dispose();
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
    } else {
        detectPageLanguageForDisplayMode();
        refreshDisplayModeByPageLanguage();
    }
    logPageStatus('Language detection result:', getLanguageResultLabel());
    diagLog('初始化完成，显示模式:', displayMode, '词库大小:', vocabularyMap.size);
    if (displayMode !== 'off') {
        await startProcessing();
    }
})();
// 监听来自 popup 的消息,如有变动进行更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    diagLog('收到消息:', message);
    if (message.action === 'updateDisplayMode') {
        const mode = normalizeDisplayMode(message.mode);
        displayModeUnified = mode;
        displayModeChinese = mode;
        displayModeEnglish = mode;
        refreshDisplayModeByPageLanguage();
        diagLog('切换显示模式:', displayMode);
        if (displayMode === 'off') {
            stopProcessing();
        } else {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDisplayModeByLanguage') {
        displayModeChinese = normalizeDisplayMode(message.chineseMode || displayModeChinese);
        displayModeEnglish = normalizeDisplayMode(message.englishMode || displayModeEnglish);
        refreshDisplayModeByPageLanguage();
        diagLog('切换按语言显示模式:', `中=${displayModeChinese} 英=${displayModeEnglish} 当前=${displayMode}`);
        if (displayMode === 'off') {
            stopProcessing();
        } else {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDisplayModeSplitSetting') {
        displayModeSplitByLanguage = message.enabled !== false;
        refreshDisplayModeByPageLanguage();
        diagLog('更新分语言显示模式开关:', displayModeSplitByLanguage, '当前模式:', displayMode);
        if (displayMode === 'off') {
            stopProcessing();
        } else {
            resetAndReprocess();
        }
    } else if (message.action === 'reloadVocabularies') {
        diagLog('重新加载词库');
        void loadVocabularies();
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
        void loadVocabularies();
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
        if (displayMode === 'annotation' || displayMode === 'replace') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAnnotationWordCardPopup') {
        annotationWordCardPopupEnabled = message.enabled !== false;
        if (displayMode === 'annotation') {
            tooltipController.hideGlobalTooltip();
            resetAndReprocess();
        }
    } else if (message.action === 'updateWordCardMeaningHighlight') {
        wordCardHighlightMatchedChinese = message.enabled !== false;
    } else if (message.action === 'updateSpeechVoice') {
        tooltipController.setSpeechVoiceURI(message.speechVoiceURI || '');
    } else if (message.action === 'updateHighlightColor') {
        highlightColorMode = message.mode || 'none';
        highlightColor = message.color || '#2196f3';
        annotationEngine.applyHighlightColor(highlightColorMode, highlightColor);
    } else if (message.action === 'updateSmartSkipCodeLinks') {
        smartSkipCodeLinks = message.enabled !== false;
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateSmartSkipEditableTextboxes') {
        smartSkipEditableTextboxes = message.enabled !== false;
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateSearchProvider') {
        tooltipController.setSearchProvider(message.provider || 'youdao');
        tooltipController.refreshTooltipSearchLinks();
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
            clearSpaRescanTimers();
            stopProcessing();
            return;
        }
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateSiteBlockMode') {
        siteBlockMode = message.mode === 'whitelist' ? 'whitelist' : 'blacklist';
        updateSiteBlockState();
        if (isSiteBlocked) {
            clearSpaRescanTimers();
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
        annotationEngine.setDedupeConfig({
            mode: dedupeMode,
            repeatCount: dedupeRepeatCount
        });
        annotationEngine.resetDedupeState();
        if (dedupeMode === 'count') {
            void loadDedupeStateFromStorage();
        } else {
            annotationEngine.clearDedupeRemaining();
        }
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDedupeRepeatCount') {
        dedupeRepeatCount = Number(message.repeatCount) || 50;
        annotationEngine.setDedupeConfig({
            mode: dedupeMode,
            repeatCount: dedupeRepeatCount
        });
        annotationEngine.clampDedupeRemaining();
        scheduleDedupeSave();
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'clearDedupeCounts') {
        annotationEngine.clearDedupeRemaining();
        chrome.storage.local.remove('dedupeGlobalState').catch(() => {
        });
        if (displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateDebugMode') {
        debugModeEnabled = message.enabled === true;
        console.log('[jieci] 调试模式:', debugModeEnabled ? '开启' : '关闭');
    } else if (message.action === 'resetWordCardPopupSize') {
        tooltipController.resetTooltipSize();
    } else if (message.action === 'getLanguageStats') {
        const sampleText = getSampleTextFromPage();
        languageStats = getLanguageStatsFromText(sampleText);
        sendResponse({
            stats: languageStats,
            annotationMode,
            actualAnnotationMode
        });
    } else if (message.action === 'updateAIMode') {
        const prevConfig = aiController.getConfig();
        const prevMode = prevConfig.mode;
        const nextMode = message.mode;
        aiController.setConfig({mode: nextMode});
        diagLog('?? AI ??:', nextMode);
        if (prevMode !== nextMode) {
            aiController.terminateAIWorker();
        }
        if (prevMode !== nextMode && displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAITrigger') {
        aiController.setConfig({trigger: message.trigger});
        diagLog('更新 AI 触发条件:', message.trigger);
        if (aiController.getConfig().mode !== 'none' && displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAIThreshold') {
        aiController.setConfig({threshold: message.threshold});
        diagLog('更新 AI 阈值:', message.threshold);
        if (aiController.getConfig().mode !== 'none' && displayMode !== 'off') {
            resetAndReprocess();
        }
    } else if (message.action === 'updateAIDelay') {
        aiController.setConfig({delay: message.delay});
        diagLog('更新 AI 延迟:', message.delay);
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

window.addEventListener('beforeunload', () => {
    aiController.terminateAIWorker();
});
