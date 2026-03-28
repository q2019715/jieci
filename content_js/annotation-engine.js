/**
 * 文件作用：
 * 提供标注引擎核心能力（节点过滤、匹配应用、队列调度）。
 * 通过 window.JieciAnnotationEngine 暴露 createAnnotationEngine 工厂供 content.js 调用。
 */
(function initAnnotationEngineGlobal(global) {
    function createAnnotationEngine(deps) {
        const diagLog = typeof deps.diagLog === 'function' ? deps.diagLog : () => {
        };
        const getDisplayMode = typeof deps.getDisplayMode === 'function' ? deps.getDisplayMode : () => 'off';
        const getIsSiteBlocked = typeof deps.getIsSiteBlocked === 'function' ? deps.getIsSiteBlocked : () => false;
        const getMaxMatchesPerNode = typeof deps.getMaxMatchesPerNode === 'function' ? deps.getMaxMatchesPerNode : () => 3;
        const getSmartSkipCodeLinks = typeof deps.getSmartSkipCodeLinks === 'function' ? deps.getSmartSkipCodeLinks : () => true;
        const getSmartSkipEditableTextboxes = typeof deps.getSmartSkipEditableTextboxes === 'function'
            ? deps.getSmartSkipEditableTextboxes
            : () => true;
        const externalShouldSkipAnnotationDueToParen = typeof deps.shouldSkipAnnotationDueToParen === 'function'
            ? deps.shouldSkipAnnotationDueToParen
            : null;
        const schedulePersistDedupeState = typeof deps.schedulePersistDedupeState === 'function'
            ? deps.schedulePersistDedupeState
            : () => {
            };
        const createHighlightSpan = typeof deps.createHighlightSpan === 'function'
            ? deps.createHighlightSpan
            : ((text) => document.createTextNode(text));
        const formatDiagText = typeof deps.formatDiagText === 'function' ? deps.formatDiagText : (text) => String(text || '');
        const formatDiagList = typeof deps.formatDiagList === 'function' ? deps.formatDiagList : (items) => (Array.isArray(items) ? items.join(' | ') : '');
        const getMinTextLength = typeof deps.getMinTextLength === 'function' ? deps.getMinTextLength : () => 0;
        const externalIsInsideCooked = typeof deps.isInsideCooked === 'function' ? deps.isInsideCooked : null;
        const externalMeetsMinTextLength = typeof deps.meetsMinTextLength === 'function' ? deps.meetsMinTextLength : null;
        const getContainerTextLength = typeof deps.getContainerTextLength === 'function' ? deps.getContainerTextLength : () => 0;
        const incrementSkipReason = typeof deps.incrementSkipReason === 'function' ? deps.incrementSkipReason : () => {
        };
        const reportDiagSkipReasons = typeof deps.reportDiagSkipReasons === 'function' ? deps.reportDiagSkipReasons : () => {
        };
        const getEffectiveMode = typeof deps.getEffectiveMode === 'function' ? deps.getEffectiveMode : () => 'cn-to-en';
        const getAnalysisSignature = typeof deps.getAnalysisSignature === 'function'
            ? deps.getAnalysisSignature
            : (mode, text) => `${mode}|${text}`;
        const isAnalysisCacheHit = typeof deps.isAnalysisCacheHit === 'function' ? deps.isAnalysisCacheHit : () => false;
        const setAnalysisSignature = typeof deps.setAnalysisSignature === 'function' ? deps.setAnalysisSignature : () => {
        };
        const requestJiebaTags = typeof deps.requestJiebaTags === 'function' ? deps.requestJiebaTags : (() => Promise.resolve([]));
        const requestJiebaTokens = typeof deps.requestJiebaTokens === 'function' ? deps.requestJiebaTokens : (() => Promise.resolve([]));
        const normalizeJiebaTag = typeof deps.normalizeJiebaTag === 'function' ? deps.normalizeJiebaTag : (tag) => tag;
        const segmentChinese = typeof deps.segmentChinese === 'function' ? deps.segmentChinese : (() => []);
        const getWordSegments = typeof deps.getWordSegments === 'function' ? deps.getWordSegments : (() => []);
        const getENSegmenter = typeof deps.getENSegmenter === 'function' ? deps.getENSegmenter : () => null;
        const getENStopwords = typeof deps.getENStopwords === 'function' ? deps.getENStopwords : () => new Set();
        const inferEnglishPOS = typeof deps.inferEnglishPOS === 'function' ? deps.inferEnglishPOS : () => null;
        const isBlockedWord = typeof deps.isBlockedWord === 'function' ? deps.isBlockedWord : () => false;
        const getVocabularyTrie = typeof deps.getVocabularyTrie === 'function' ? deps.getVocabularyTrie : () => null;
        const getVocabularyMap = typeof deps.getVocabularyMap === 'function' ? deps.getVocabularyMap : () => new Map();
        const processMatchesWithAI = typeof deps.processMatchesWithAI === 'function'
            ? deps.processMatchesWithAI
            : (() => Promise.resolve());
        const getAIMode = typeof deps.getAIMode === 'function' ? deps.getAIMode : () => 'none';
        const increasePendingAsync = typeof deps.increasePendingAsync === 'function' ? deps.increasePendingAsync : () => {
        };
        const decreasePendingAsync = typeof deps.decreasePendingAsync === 'function' ? deps.decreasePendingAsync : () => {
        };
        const isProcessedNode = typeof deps.isProcessedNode === 'function' ? deps.isProcessedNode : () => false;
        const markProcessedNode = typeof deps.markProcessedNode === 'function' ? deps.markProcessedNode : () => {
        };
        const onAppliedCount = typeof deps.onAppliedCount === 'function' ? deps.onAppliedCount : () => {
        };
        const scheduleFinalLog = typeof deps.scheduleFinalLog === 'function' ? deps.scheduleFinalLog : () => {
        };

        const processBatchLimit = Number.isFinite(deps.processBatchLimit) ? deps.processBatchLimit : 200;
        const processIdleTimeoutMs = Number.isFinite(deps.processIdleTimeoutMs) ? deps.processIdleTimeoutMs : 200;

        let pendingNodes = [];
        let pendingNodesSet = new WeakSet();
        let processingScheduled = false;
        let processingHandle = null;
        const mergedBlockMinLength = Number.isFinite(deps.mergedBlockMinLength) ? deps.mergedBlockMinLength : 40;
        let blockQuotaRemaining = new WeakMap();
        let blockGroupCache = new WeakMap();
        let dedupeMode = 'page';
        let dedupeRepeatCount = 50;
        const dedupeSeen = new Set();
        const dedupeRemaining = new Map();

        function isEditableElement(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            if (element.isContentEditable === true) {
                return true;
            }
            const role = typeof element.getAttribute === 'function' ? (element.getAttribute('role') || '') : '';
            return role.toLowerCase() === 'textbox';
        }

        function isInsideExcludedElement(node, excludeTags) {
            let current = node.parentNode;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                if (getSmartSkipEditableTextboxes() && isEditableElement(current)) {
                    return true;
                }
                if (excludeTags.includes(current.tagName)) {
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

        function applyHighlightColor(mode, color) {
            if (mode === 'none') {
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

        function isInsideCooked(node) {
            if (externalIsInsideCooked) {
                return externalIsInsideCooked(node);
            }
            let current = node.parentNode;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                if (current.classList && current.classList.contains('cooked')) {
                    return true;
                }
                current = current.parentNode;
            }
            return false;
        }

        function meetsMinTextLength(textNode) {
            if (externalMeetsMinTextLength) {
                return externalMeetsMinTextLength(textNode);
            }
            try {
                const minTextLength = getMinTextLength();
                let container = textNode.parentElement;
                if (!container) {
                    return true;
                }
                for (let i = 0; i < 3 && container; i++) {
                    const style = window.getComputedStyle(container);
                    const display = style.display;
                    if (display === 'block' || display === 'flex' || display === 'grid' ||
                        display === 'list-item' || display === 'table-cell') {
                        break;
                    }
                    container = container.parentElement;
                }
                if (!container) {
                    return true;
                }
                const containerText = container.textContent || '';
                const textLength = containerText.trim().length;
                return textLength >= minTextLength;
            } catch (error) {
                diagLog('最小字数检测出错:', error);
                return true;
            }
        }

        function shouldSkipAnnotationDueToParen(text, match) {
            if (externalShouldSkipAnnotationDueToParen !== null) {
                return externalShouldSkipAnnotationDueToParen(text, match);
            }
            if (!text || !match) {
                return false;
            }
            const tail = text.slice(match.end);
            return /^\s*[(（]/.test(tail);
        }

        function removeMatchesFollowedByParen(text, matches) {
            if (!Array.isArray(matches) || matches.length === 0) {
                return 0;
            }
            let removed = 0;
            for (let i = matches.length - 1; i >= 0; i--) {
                if (shouldSkipAnnotationDueToParen(text, matches[i])) {
                    matches.splice(i, 1);
                    removed++;
                }
            }
            return removed;
        }

        function prepareMatchesForAI(text, matches, blockGroupKey, enableQuotaTrim = true) {
            removeMatchesFollowedByParen(text, matches);
            if (!enableQuotaTrim || matches.length === 0) {
                return;
            }
            const quota = getBlockQuotaRemaining(blockGroupKey);
            const limit = Math.max(6, quota * 2);
            if (matches.length > limit) {
                matches.sort((a, b) => b.priority - a.priority);
                matches.splice(limit);
            }
        }

        function isWordInVocabularyTrie(word) {
            const vocabularyTrie = getVocabularyTrie();
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

        function processNode(node) {
            if (!node || isProcessedNode(node)) {
                return;
            }
            const baseExcludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'];
            const smartExcludedTags = getSmartSkipCodeLinks() ? ['A', 'CODE', 'PRE'] : [];
            const excludeTags = baseExcludedTags.concat(smartExcludedTags);

            if (getSmartSkipEditableTextboxes() && node.nodeType === Node.ELEMENT_NODE && isEditableElement(node)) {
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE && excludeTags.includes(node.tagName)) {
                return;
            }
            if (node.classList && node.classList.contains('vocab-highlight')) {
                return;
            }
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
                const children = Array.from(node.childNodes);
                children.forEach(child => enqueueNode(child));
            }
            markProcessedNode(node);
        }

        function processTextNode(textNode) {
            const rawText = textNode.textContent || '';
            const diagPreview = formatDiagText(rawText);
            diagLog('Text node:', diagPreview);
            if (!rawText || rawText.trim().length === 0) {
                diagLog('Text node status:', 'dropped', 'reason:', 'empty');
                return;
            }
            if (!textNode.parentNode) {
                diagLog('Text node status:', 'dropped', 'reason:', 'no-parent');
                return;
            }
            const blockGroupKey = getBlockGroupKey(textNode);
            if (getBlockQuotaRemaining(blockGroupKey) <= 0) {
                incrementSkipReason('quota');
                diagLog('Text node status:', 'dropped', 'reason:', 'quota');
                return;
            }
            const minTextLength = getMinTextLength();
            if (minTextLength > 0 && !isInsideCooked(textNode) && !meetsMinTextLength(textNode)) {
                incrementSkipReason('minLength');
                const textLen = getContainerTextLength(textNode);
                diagLog('Text node status:', 'dropped', 'reason:', `min-length (minTextLength=${minTextLength}, containerLength=${textLen})`);
                reportDiagSkipReasons();
                diagLog('Skipped annotation: container text below minimum length.');
                return;
            }
            const text = textNode.textContent || '';
            const effectiveMode = getEffectiveMode();
            const analysisSignature = getAnalysisSignature(effectiveMode, text);
            if (isAnalysisCacheHit(textNode, analysisSignature)) {
                diagLog('Text node status:', 'dropped', 'reason:', 'analysis-cache-hit');
                return;
            }
            setAnalysisSignature(textNode, analysisSignature);
            processTextNodeByMode(textNode, text, effectiveMode, blockGroupKey);
        }

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
                if (prevLength > 0 && prevLength < mergedBlockMinLength) {
                    blockGroupCache.set(block, block);
                    return block;
                }
            }
            const currentLength = (block.textContent || '').trim().length;
            if (currentLength > 0 && currentLength < mergedBlockMinLength) {
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
            const maxMatchesPerNode = getMaxMatchesPerNode();
            if (!Number.isFinite(maxMatchesPerNode)) {
                return Infinity;
            }
            if (!blockQuotaRemaining.has(groupKey)) {
                blockQuotaRemaining.set(groupKey, maxMatchesPerNode);
            }
            return blockQuotaRemaining.get(groupKey);
        }

        function calculatePriority(matchText, data, position, textLength) {
            const safeData = data || {};
            const safeWordLength = Number.isFinite(safeData.wordLength) ? safeData.wordLength : String(matchText || '').length;
            const safeTextLength = Number.isFinite(textLength) && textLength > 0 ? textLength : 1;
            const lengthScore = Math.min(safeWordLength / 15, 1) * 40;
            const positionRatio = Math.max(0, Math.min(1, position / safeTextLength));
            const distributionScore = (1 - Math.abs(positionRatio - 0.5) * 2) * 30;
            const hasPhrasesBonus = (safeData.phrases && safeData.phrases.length > 0) ? 10 : 0;
            const complexityScore = Math.min((safeWordLength - 3) / 10 * 20, 20) + hasPhrasesBonus;
            return lengthScore + distributionScore + complexityScore;
        }

        function getDedupeKey(matchText, effectiveMode) {
            if (!matchText) {
                return '';
            }
            if (effectiveMode === 'en-to-cn') {
                return matchText.toLowerCase();
            }
            return matchText;
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
                    schedulePersistDedupeState();
                    return false;
                }
                dedupeRemaining.set(key, dedupeRepeatCount);
                schedulePersistDedupeState();
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

        function setDedupeConfig(next) {
            const conf = next || {};
            if (Object.prototype.hasOwnProperty.call(conf, 'mode')) {
                const rawMode = conf.mode || 'page';
                dedupeMode = rawMode === 'cooldown' ? 'count' : rawMode;
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'repeatCount')) {
                dedupeRepeatCount = Number(conf.repeatCount) || 50;
            }
            clampDedupeRemaining();
        }


        function setDedupeRemainingFromObject(stateObj) {
            dedupeRemaining.clear();
            if (!stateObj || typeof stateObj !== 'object') {
                return;
            }
            Object.keys(stateObj).forEach((key) => {
                const value = stateObj[key];
                if (Number.isFinite(value) && value > 0) {
                    dedupeRemaining.set(key, value);
                }
            });
            clampDedupeRemaining();
        }

        function exportDedupeRemainingObject() {
            const remainingByWord = {};
            dedupeRemaining.forEach((value, key) => {
                if (Number.isFinite(value) && value > 0) {
                    remainingByWord[key] = value;
                }
            });
            return remainingByWord;
        }

        function clearDedupeRemaining() {
            dedupeRemaining.clear();
        }

        function consumeBlockQuota(groupKey, usedCount) {
            if (!groupKey) {
                return;
            }
            const maxMatchesPerNode = getMaxMatchesPerNode();
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

        function resetBlockQuotaState() {
            blockQuotaRemaining = new WeakMap();
            blockGroupCache = new WeakMap();
        }

        function resetBlockQuotaForElement(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            blockQuotaRemaining.delete(element);
            blockGroupCache.delete(element);
            const children = element.querySelectorAll('*');
            children.forEach(child => {
                blockQuotaRemaining.delete(child);
                blockGroupCache.delete(child);
            });
        }

        function processTextNodeByMode(textNode, text, effectiveMode, blockGroupKey) {
            if (effectiveMode === 'cn-to-en') {
                handleCnToEnTextNode(textNode, text, effectiveMode, blockGroupKey);
                return;
            }
            if (effectiveMode === 'en-to-cn') {
                handleEnToCnTextNode(textNode, text, effectiveMode, blockGroupKey);
            }
        }

        function handleCnToEnTextNode(textNode, text, effectiveMode, blockGroupKey) {
            increasePendingAsync();
            requestJiebaTags(text).then(async (tags) => {
                if (!textNode.parentNode || textNode.textContent !== text) {
                    decreasePendingAsync();
                    diagLog('Text node status:', 'dropped', 'reason:', 'stale-node');
                    return;
                }
                const remainingQuota = getBlockQuotaRemaining(blockGroupKey);
                if (remainingQuota <= 0) {
                    decreasePendingAsync();
                    diagLog('Text node status:', 'dropped', 'reason:', 'quota');
                    return;
                }
                const matches = [];
                const vocabularyMap = getVocabularyMap();
                const vocabularyTrie = getVocabularyTrie();
                if (tags && tags.length > 0) {
                    const tagItems = tags.map(tag => `${tag.word}/${normalizeJiebaTag(tag.tag)}`);
                    diagLog('Segmentation (jieba tags):', formatDiagList(tagItems));
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
                                data,
                                posTag,
                                priority: calculatePriority(word, data, wordStart, text.length)
                            });
                        }
                    });
                    prepareMatchesForAI(text, matches, blockGroupKey);
                    await processMatchesWithAI(text, matches, effectiveMode);
                } else {
                    requestJiebaTokens(text).then(async (tokens) => {
                        if (!textNode.parentNode || textNode.textContent !== text) {
                            decreasePendingAsync();
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
                                        data,
                                        posTag: null,
                                        priority: calculatePriority(token.word, data, token.start, text.length)
                                    });
                                }
                            });
                            prepareMatchesForAI(text, matches, blockGroupKey);
                            await processMatchesWithAI(text, matches, effectiveMode);
                        } else {
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
                                        data,
                                        posTag: null,
                                        priority: calculatePriority(segment.text, data, segment.start, text.length)
                                    });
                                }
                            });
                            prepareMatchesForAI(text, matches, blockGroupKey);
                            await processMatchesWithAI(text, matches, effectiveMode);
                        }
                        const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
                        consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
                        diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
                        const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
                        diagLog('Matches (cn-to-en):', matches.length, 'items:', formatDiagList(matchItems));
                        decreasePendingAsync();
                    });
                    return;
                }
                const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
                consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
                diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
                const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
                diagLog('Matches (cn-to-en):', matches.length, 'items:', formatDiagList(matchItems));
                decreasePendingAsync();
            });
        }

        function handleEnToCnTextNode(textNode, text, effectiveMode, blockGroupKey) {
            const segmenter = getENSegmenter();
            if (!segmenter) {
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
            const segments = getWordSegments(text, segmenter);
            const segmentItems = segments.map(segment => `${segment.text}@${segment.start}`);
            diagLog('Segmentation (en):', formatDiagList(segmentItems));
            const EN_STOPWORDS = getENStopwords();
            const vocabularyMap = getVocabularyMap();
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
                    const inferredPOS = inferEnglishPOS(text, segment.start, segment.end);
                    matches.push({
                        start: segment.start,
                        end: segment.end,
                        matchText: segment.text,
                        data,
                        posTag: inferredPOS,
                        priority: calculatePriority(segment.text, data, segment.start, text.length)
                    });
                }
            });

            const shouldTrimByQuota = getAIMode() !== 'none';
            prepareMatchesForAI(text, matches, blockGroupKey, shouldTrimByQuota);
            if (shouldTrimByQuota && matches.length > 0) {

                increasePendingAsync();
                (async () => {
                    try {
                        await processMatchesWithAI(text, matches, effectiveMode);
                        const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
                        consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
                        diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
                        const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
                        diagLog('Matches (en-to-cn):', matches.length, 'items:', formatDiagList(matchItems));
                    } finally {
                        decreasePendingAsync();
                    }
                })();
            } else {
                const applyResult = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
                consumeBlockQuota(blockGroupKey, applyResult.appliedCount);
                diagLog('Text node status:', applyResult.appliedCount > 0 ? 'kept' : 'dropped', 'reason:', applyResult.reason, 'applied:', applyResult.appliedCount);
                const matchItems = matches.map(match => `${match.matchText}@${match.start}`);
                diagLog('Matches (en-to-cn):', matches.length, 'items:', formatDiagList(matchItems));
            }
        }

        function selectMatchesWithDistribution(matches, textLength, maxCount) {
            if (!Number.isFinite(maxCount) || maxCount <= 0) {
                return matches;
            }
            if (matches.length <= maxCount) {
                return matches;
            }
            const regionCount = Math.min(maxCount, 5);
            const regionSize = textLength / regionCount;
            const selectedMatches = [];
            const regions = Array.from({length: regionCount}, () => []);
            matches.forEach(match => {
                const regionIndex = Math.min(Math.floor(match.start / regionSize), regionCount - 1);
                regions[regionIndex].push(match);
            });
            let quotaPerRegion = Math.floor(maxCount / regionCount);
            let remainingQuota = maxCount - (quotaPerRegion * regionCount);
            regions.forEach((regionMatches) => {
                if (regionMatches.length === 0) {
                    return;
                }
                regionMatches.sort((a, b) => b.priority - a.priority);
                let quota = quotaPerRegion;
                if (remainingQuota > 0 && regionMatches.length > quota) {
                    quota++;
                    remainingQuota--;
                }
                selectedMatches.push(...regionMatches.slice(0, quota));
            });
            if (selectedMatches.length < maxCount) {
                const unselected = matches.filter(m => !selectedMatches.includes(m));
                unselected.sort((a, b) => b.priority - a.priority);
                selectedMatches.push(...unselected.slice(0, maxCount - selectedMatches.length));
            }
            return selectedMatches;
        }

        function hasSpacingConflict(existingMatch, candidateMatch, minGapChars) {
            const gap = Number.isFinite(minGapChars) ? Math.max(0, Math.floor(minGapChars)) : 0;
            return !(
                existingMatch.end + gap <= candidateMatch.start ||
                candidateMatch.end + gap <= existingMatch.start
            );
        }

        function selectMatchesPreferSpacing(orderedCandidates, targetCount, minGapChars) {
            if (!Array.isArray(orderedCandidates) || orderedCandidates.length === 0 || targetCount <= 0) {
                return [];
            }
            const selected = [];
            const selectedSet = new Set();
            orderedCandidates.forEach((match) => {
                if (!match || selected.length >= targetCount || selectedSet.has(match)) {
                    return;
                }
                const conflict = selected.some((existing) => hasSpacingConflict(existing, match, minGapChars));
                if (!conflict) {
                    selected.push(match);
                    selectedSet.add(match);
                }
            });
            if (selected.length < targetCount) {
                orderedCandidates.forEach((match) => {
                    if (!match || selected.length >= targetCount || selectedSet.has(match)) {
                        return;
                    }
                    selected.push(match);
                    selectedSet.add(match);
                });
            }
            selected.sort((a, b) => a.start - b.start);
            return selected;
        }

        function applyMatchesToTextNode(textNode, text, matches, effectiveMode, maxCount = getMaxMatchesPerNode()) {
            if (!matches || matches.length === 0) {
                return {appliedCount: 0, reason: 'no-matches', selectedCount: 0, dedupedCount: 0};
            }
            const selectedMatches = selectMatchesWithDistribution(matches, text.length, maxCount);
            if (selectedMatches.length === 0) {
                return {appliedCount: 0, reason: 'selection-empty', selectedCount: 0, dedupedCount: 0};
            }
            const selectedSet = new Set(selectedMatches);
            const remainingMatches = matches
                .filter((match) => !selectedSet.has(match))
                .sort((a, b) => b.priority - a.priority);
            const spacingCandidates = selectedMatches
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .concat(remainingMatches);
            const spacingPreferredMatches = selectMatchesPreferSpacing(
                spacingCandidates,
                selectedMatches.length,
                1
            );
            const dedupedMatches = [];
            spacingPreferredMatches.forEach(match => {
                if (!shouldSkipAnnotationDueToParen(text, match) && shouldAllowDedupeMatch(match.matchText, effectiveMode)) {
                    dedupedMatches.push(match);
                }
            });
            if (dedupedMatches.length === 0) {
                return {
                    appliedCount: 0,
                    reason: 'dedupe-filtered',
                    selectedCount: selectedMatches.length,
                    dedupedCount: 0
                };
            }
            diagLog(`Found ${matches.length} matches; selected ${dedupedMatches.length}.`, dedupedMatches.map(m => m.matchText));
            dedupedMatches.sort((a, b) => a.start - b.start);
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            const displayMode = getDisplayMode();
            const shouldInsertLeadingSpace = displayMode === 'annotation' || displayMode === 'replace';
            dedupedMatches.forEach(match => {
                if (match.start > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
                }
                if (shouldInsertLeadingSpace) {
                    const prevChar = match.start > 0 ? text.charAt(match.start - 1) : '';
                    if (!/\s/.test(prevChar)) {
                        fragment.appendChild(document.createTextNode(' '));
                    }
                }
                const span = createHighlightSpan(match.matchText, match.data, match.posTag, match.selectedMeaning, match.aiScore);
                fragment.appendChild(span);
                if (shouldInsertLeadingSpace) {
                    const nextChar = match.end < text.length ? text.charAt(match.end) : '';
                    if (!/\s/.test(nextChar)) {
                        fragment.appendChild(document.createTextNode(' '));
                    }
                }
                lastIndex = match.end;
            });
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            try {
                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(fragment, textNode);
                    diagLog('Replaced text node with annotations.');
                    onAppliedCount(dedupedMatches.length);
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

        function scheduleProcessing() {
            if (processingScheduled) {
                return;
            }
            processingScheduled = true;
            if (typeof requestIdleCallback === 'function') {
                processingHandle = requestIdleCallback(runProcessingQueue, {timeout: processIdleTimeoutMs});
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

        function enqueueNode(node) {
            if (getDisplayMode() === 'off' || getIsSiteBlocked()) {
                return;
            }
            if (!node || pendingNodesSet.has(node)) {
                return;
            }
            pendingNodes.push(node);
            pendingNodesSet.add(node);
            scheduleProcessing();
        }

        function runProcessingQueue(deadline) {
            if (getDisplayMode() === 'off' || getIsSiteBlocked()) {
                resetQueueOnly();
                return;
            }
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
                if (processedCount >= processBatchLimit) {
                    break;
                }
            }
            if (pendingNodes.length === 0) {
                scheduleFinalLog();
            }
            if (pendingNodes.length > 0) {
                scheduleProcessing();
            }
        }

        function resetQueueOnly() {
            pendingNodes = [];
            pendingNodesSet = new WeakSet();
            cancelScheduledProcessing();
        }

        function resetProcessingQueue() {
            resetQueueOnly();
            resetBlockQuotaState();
        }

        function getPendingCount() {
            return pendingNodes.length;
        }

        return {
            getNearestBlockContainer,
            isInsideCooked,
            meetsMinTextLength,
            shouldSkipAnnotationDueToParen,
            isInsideVocabTooltip,
            isInsideVocabHighlight,
            isInternalAnnotationNode,
            applyHighlightColor,
            enqueueNode,
            resetProcessingQueue,
            resetBlockQuotaState,
            resetBlockQuotaForElement,
            setDedupeConfig,
            resetDedupeState,
            clampDedupeRemaining,
            setDedupeRemainingFromObject,
            exportDedupeRemainingObject,
            clearDedupeRemaining,
            getPendingCount
        };
    }

    global.JieciAnnotationEngine = {
        createAnnotationEngine
    };
})(typeof window !== 'undefined' ? window : globalThis);
