/**
 * 文件作用：
 * 提供词库数据的读取、合并、索引构建与写回能力，统一管理词表存储逻辑。
 * 通过 window.JieciWordlistStore 暴露 createWordlistStore 工厂供 content.js 调用。
 */
(function initWordlistStoreGlobal(global) {
    /**
     * 作用：创建词库存储器，并注入依赖函数。
     * 输入：deps（词性匹配、Trie 反序列化、日志等依赖）
     * 输出：词库存储器对象
     */
    function createWordlistStore(deps) {
        const findMatchingType = typeof deps.findMatchingType === 'function'
            ? deps.findMatchingType
            : (() => null);
        const deserializeTrie = typeof deps.deserializeTrie === 'function'
            ? deps.deserializeTrie
            : ((root) => ({root: root || null}));
        const buildEnglishTrieIndex = typeof deps.buildEnglishTrieIndex === 'function'
            ? deps.buildEnglishTrieIndex
            : (() => ({}));
        const diagLog = typeof deps.diagLog === 'function'
            ? deps.diagLog
            : (() => {});

        /**
         * 作用：标准化词性字符串。
         * 输入：type
         * 输出：标准化后的词性
         */
        function normalizeType(type) {
            if (!type) return '';
            return String(type).trim().toLowerCase();
        }

        /**
         * 作用：将翻译文本拆分为多个词义。
         * 输入：translation
         * 输出：词义数组
         */
        function splitMeanings(translation) {
            if (!translation) return [];
            return String(translation).split(/[,，、；;]/).map(m => m.trim()).filter(Boolean);
        }

        /**
         * 作用：格式化来源名称（去掉 .json 后缀）。
         * 输入：name
         * 输出：格式化后的来源名
         */
        function formatSourceName(name) {
            return String(name || '').trim().replace(/\.json$/i, '');
        }

        /**
         * 作用：格式化并去重来源列表。
         * 输入：sources
         * 输出：去重后的来源名数组
         */
        function formatSourceList(sources) {
            if (!Array.isArray(sources)) {
                return [];
            }
            const seen = new Set();
            return sources
                .map(formatSourceName)
                .filter((name) => {
                    if (!name || seen.has(name)) {
                        return false;
                    }
                    seen.add(name);
                    return true;
                });
        }

        /**
         * 作用：创建空的合并词条结构。
         * 输入：word
         * 输出：词条对象
         */
        function createEmptyMergedData(word) {
            return {
                word: word,
                byType: {},
                phrases: [],
                phonetics: {uk: '', us: ''},
                sentenceExamples: [],
                sources: [],
                wordLength: String(word || '').length
            };
        }

        /**
         * 作用：合并翻译（按词性分组并去重）。
         * 输入：existingData, newTranslations, sourceName
         * 输出：无
         */
        function mergeTranslations(existingData, newTranslations, sourceName) {
            if (!newTranslations || !Array.isArray(newTranslations)) return;
            newTranslations.forEach(trans => {
                const type = normalizeType(trans.type) || '_default';
                const meanings = splitMeanings(trans.translation);
                if (!existingData.byType[type]) {
                    existingData.byType[type] = {
                        type: trans.type || '',
                        meanings: [],
                        sources: []
                    };
                }
                const typeData = existingData.byType[type];
                meanings.forEach(meaning => {
                    if (!typeData.meanings.includes(meaning)) {
                        typeData.meanings.push(meaning);
                    }
                });
                if (sourceName && !typeData.sources.includes(sourceName)) {
                    typeData.sources.push(sourceName);
                }
            });
        }

        /**
         * 作用：合并音标信息。
         * 输入：existingPhonetics, newPhonetics
         * 输出：无
         */
        function mergePhonetics(existingPhonetics, newPhonetics) {
            if (!newPhonetics || typeof newPhonetics !== 'object') return;
            if (!existingPhonetics.uk && typeof newPhonetics.uk === 'string') {
                existingPhonetics.uk = newPhonetics.uk;
            }
            if (!existingPhonetics.us && typeof newPhonetics.us === 'string') {
                existingPhonetics.us = newPhonetics.us;
            }
        }

        /**
         * 作用：合并例句并去重。
         * 输入：existingExamples, newExamples
         * 输出：无
         */
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

        /**
         * 作用：合并短语并兼容不同字段命名。
         * 输入：existingPhrases, newPhrases, sourceName
         * 输出：无
         */
        function mergePhrases(existingPhrases, newPhrases, sourceName) {
            if (!newPhrases || !Array.isArray(newPhrases)) return;
            newPhrases.forEach(phrase => {
                const phraseText = phrase.phrase;
                if (!phraseText) return;
                let existing = existingPhrases.find(p => p.phrase === phraseText);
                if (!existing) {
                    existing = {
                        phrase: phraseText,
                        translations: [],
                        sources: []
                    };
                    existingPhrases.push(existing);
                }
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
                if (sourceName && !existing.sources.includes(sourceName)) {
                    existing.sources.push(sourceName);
                }
            });
        }

        /**
         * 作用：获取词条首个可显示词义（可带优先词性）。
         * 输入：data, preferredPOS
         * 输出：词义文本
         */
        function getFirstMeaning(data, preferredPOS) {
            if (!data || !data.byType) return '';
            if (preferredPOS) {
                const matchedType = findMatchingType(data.byType, preferredPOS);
                if (matchedType && data.byType[matchedType] && data.byType[matchedType].meanings.length > 0) {
                    return data.byType[matchedType].meanings[0];
                }
            }
            const typeOrder = ['n', 'v', 'vt', 'vi', 'adj', 'adv', '_default'];
            const types = Object.keys(data.byType);
            for (const t of typeOrder) {
                if (types.includes(t) && data.byType[t].meanings.length > 0) {
                    return data.byType[t].meanings[0];
                }
            }
            for (const t of types) {
                if (data.byType[t].meanings.length > 0) {
                    return data.byType[t].meanings[0];
                }
            }
            return '';
        }

        /**
         * 作用：加载词库并返回构建后的映射、集合与 Trie。
         * 输入：annotationMode, actualAnnotationMode
         * 输出：{vocabularyMap, vocabularySet, vocabularyTrie}
         */
        async function loadVocabularies(annotationMode, actualAnnotationMode) {
            const result = await chrome.storage.local.get(['vocabularies', 'vocabularyTrieIndex']);
            const vocabList = result.vocabularies || [];
            const cachedTrieIndex = result.vocabularyTrieIndex;
            const vocabularyMap = new Map();
            const vocabularySet = new Set();
            let vocabularyTrie = null;
            const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;

            diagLog('加载词库，文件数量:', vocabList.length, '模式:', annotationMode);
            if (effectiveMode === 'cn-to-en') {
                if (cachedTrieIndex) {
                    vocabularyTrie = deserializeTrie(cachedTrieIndex);
                    diagLog('从缓存加载Trie树索引成功');
                } else {
                    vocabularyTrie = null;
                    diagLog('警告：未找到缓存的Trie树索引');
                }
            }

            vocabList.forEach(vocab => {
                const sourceName = vocab.name || '未知词库';
                (vocab.data || []).forEach(item => {
                    const word = item.word;
                    if (effectiveMode === 'cn-to-en') {
                        if (!Array.isArray(item.translations)) {
                            return;
                        }
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
                            if (isSameWord) {
                                mergeTranslations(mergedData, item.translations, sourceName);
                                mergePhonetics(mergedData.phonetics, item.phonetics);
                                mergeSentenceExamples(mergedData.sentenceExamples, item.sentence_examples || item.sentenceExamples);
                                mergePhrases(mergedData.phrases, item.phrases, sourceName);
                            }
                            if (!mergedData.sources.includes(sourceName)) {
                                mergedData.sources.push(sourceName);
                            }
                        });
                    } else if (effectiveMode === 'en-to-cn') {
                        if (!word) {
                            return;
                        }
                        const cleanWord = String(word).trim().toLowerCase();
                        if (!cleanWord) {
                            return;
                        }
                        vocabularySet.add(cleanWord);
                        if (!vocabularyMap.has(cleanWord)) {
                            vocabularyMap.set(cleanWord, createEmptyMergedData(word));
                        }
                        const mergedData = vocabularyMap.get(cleanWord);
                        mergeTranslations(mergedData, item.translations, sourceName);
                        mergePhonetics(mergedData.phonetics, item.phonetics);
                        mergeSentenceExamples(mergedData.sentenceExamples, item.sentence_examples || item.sentenceExamples);
                        mergePhrases(mergedData.phrases, item.phrases, sourceName);
                        if (!mergedData.sources.includes(sourceName)) {
                            mergedData.sources.push(sourceName);
                        }
                    }
                });
            });

            diagLog(`词库加载完成，共 ${vocabularyMap.size} 个词条，模式: ${annotationMode}`);
            if (vocabularyTrie) {
                diagLog('Trie树已就绪（从缓存加载）');
            }
            return {vocabularyMap, vocabularySet, vocabularyTrie};
        }

        /**
         * 作用：持久化收藏词集合。
         * 输入：favoriteWordsSet
         * 输出：无
         */
        async function persistFavoriteWords(favoriteWordsSet) {
            const words = Array.from(favoriteWordsSet || []).sort();
            await chrome.storage.local.set({favoriteWords: words});
        }

        /**
         * 作用：持久化屏蔽词集合并返回最新 Trie 索引。
         * 输入：blockedWordsSet
         * 输出：trieIndex
         */
        async function persistBlockedWords(blockedWordsSet) {
            const words = Array.from(blockedWordsSet || []).sort();
            const trieIndex = buildEnglishTrieIndex(words);
            await chrome.storage.local.set({
                blockedWords: words,
                blockedWordsTrieIndex: trieIndex
            });
            return trieIndex;
        }

        return {
            formatSourceList,
            getFirstMeaning,
            loadVocabularies,
            persistFavoriteWords,
            persistBlockedWords
        };
    }

    global.JieciWordlistStore = {
        createWordlistStore
    };
})(window);
