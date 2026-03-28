/**
 * 文件作用：
 * 提供站点相关检测能力，统一管理站点黑白名单判定与页面语言检测。
 * 通过 window.JieciSiteCheck 暴露 createSiteChecker 工厂供 content.js 调用。
 */
(function initSiteCheckGlobal(global) {
    /**
     * 作用：创建站点检测器，封装 host 规则判断与语言识别逻辑。
     * 输入：deps（可选日志函数、中文字符判断函数）
     * 输出：站点检测器对象
     */
    function createSiteChecker(deps) {
        const safeDiagLog = deps && typeof deps.diagLog === 'function' ? deps.diagLog : () => {};
        const isChinese = deps && typeof deps.isChinese === 'function'
            ? deps.isChinese
            : (ch) => /[\u4E00-\u9FFF]/.test(String(ch || ''));

        /**
         * 作用：标准化主机名或规则文本。
         * 输入：host
         * 输出：标准化后的主机名
         */
        function normalizeHost(host) {
            return String(host || '').trim().toLowerCase().replace(/\.+$/, '');
        }

        /**
         * 作用：将规则数组编译为可快速匹配的索引结构。
         * 输入：rules
         * 输出：{exact, wildcards}
         */
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

        /**
         * 作用：根据主机名、索引和模式判断站点是否被屏蔽。
         * 输入：hostname、index、mode
         * 输出：是否屏蔽
         */
        function evaluateSiteBlocked(hostname, index, mode) {
            const host = normalizeHost(hostname);
            if (!host) {
                return false;
            }
            const safeIndex = index || {exact: new Set(), wildcards: []};
            const matchedExact = safeIndex.exact.has(host);
            const hostParts = host.split('.').length;
            const matchedWildcard = (safeIndex.wildcards || []).some(({suffix, parts}) => {
                if (hostParts <= parts) {
                    return false;
                }
                return host.endsWith(`.${suffix}`);
            });
            const matched = matchedExact || matchedWildcard;
            if (mode === 'whitelist') {
                return !matched;
            }
            return matched;
        }

        /**
         * 作用：综合更新站点屏蔽状态并记录必要日志。
         * 输入：hostname、index、mode
         * 输出：{host, blocked}
         */
        function updateSiteBlockState(hostname, index, mode) {
            const host = normalizeHost(hostname);
            const blocked = evaluateSiteBlocked(host, index, mode);
            if (blocked) {
                safeDiagLog('Site blocked; skip annotation:', host);
            }
            return {host, blocked};
        }

        /**
         * 作用：从页面文本中抽样，减少超长正文带来的检测开销。
         * 输入：bodyText
         * 输出：抽样文本
         */
        function getSampleTextFromPage(bodyText) {
            const fullText = String(bodyText || '');
            const maxSampleLength = 5000;
            const textLength = fullText.length;
            if (textLength <= maxSampleLength) {
                return fullText;
            }
            const chunkSize = Math.floor(maxSampleLength / 3);
            const head = fullText.substring(0, chunkSize);
            const midStart = Math.max(0, Math.floor(textLength / 2) - Math.floor(chunkSize / 2));
            const middle = fullText.substring(midStart, midStart + chunkSize);
            const tail = fullText.substring(Math.max(0, textLength - chunkSize));
            return `${head} ${middle} ${tail}`;
        }

        /**
         * 作用：统计文本中的中英文占比，用于自动判断页面语言。
         * 输入：sampleText
         * 输出：语言统计对象
         */
        function getLanguageStatsFromText(sampleText) {
            let chineseCount = 0;
            for (const char of String(sampleText || '')) {
                if (isChinese(char)) {
                    chineseCount++;
                }
            }
            const englishWords = String(sampleText || '').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
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

        /**
         * 作用：执行自动语言检测流程并返回新的语言状态。
         * 输入：annotationMode、languageDetectDone、actualAnnotationMode、bodyText
         * 输出：{changed, languageDetectDone, languageStats, actualAnnotationMode}
         */
        function detectPageLanguageState({annotationMode, languageDetectDone, actualAnnotationMode, bodyText}) {
            if (annotationMode !== 'auto') {
                return {
                    changed: false,
                    languageDetectDone,
                    languageStats: null,
                    actualAnnotationMode
                };
            }
            if (languageDetectDone) {
                return {
                    changed: false,
                    languageDetectDone,
                    languageStats: null,
                    actualAnnotationMode
                };
            }

            const previousMode = actualAnnotationMode;
            let nextActualMode = actualAnnotationMode;
            let nextStats;
            try {
                const sampleText = getSampleTextFromPage(bodyText);
                nextStats = getLanguageStatsFromText(sampleText);
                if (!nextStats.detected) {
                    nextActualMode = 'cn-to-en';
                    safeDiagLog('No language detected, defaulting to cn-to-en');
                    return {
                        changed: nextActualMode !== previousMode,
                        languageDetectDone: true,
                        languageStats: nextStats,
                        actualAnnotationMode: nextActualMode
                    };
                }
                const {chineseCount, englishCount, chineseRatio, englishRatio} = nextStats;
                safeDiagLog(`Language stats: cn=${chineseCount}(${(chineseRatio * 100).toFixed(1)}%), en=${englishCount}(${(englishRatio * 100).toFixed(1)}%)`);
                if (chineseRatio >= 0.1) {
                    nextActualMode = 'cn-to-en';
                    safeDiagLog('Mostly Chinese, select cn-to-en');
                } else if (englishRatio >= 0.9) {
                    nextActualMode = 'en-to-cn';
                    safeDiagLog('Mostly English, select en-to-cn');
                } else {
                    nextActualMode = chineseRatio > englishRatio ? 'cn-to-en' : 'en-to-cn';
                    safeDiagLog('Mixed language, select', nextActualMode);
                }
            } catch (error) {
                safeDiagLog('Language detect failed:', error);
                nextStats = {
                    chineseCount: 0,
                    englishCount: 0,
                    totalUnits: 0,
                    chineseRatio: 0,
                    englishRatio: 0,
                    detected: false
                };
                nextActualMode = 'cn-to-en';
            }

            return {
                changed: nextActualMode !== previousMode,
                languageDetectDone: true,
                languageStats: nextStats,
                actualAnnotationMode: nextActualMode
            };
        }

        return {
            normalizeHost,
            compileSiteBlockIndex,
            updateSiteBlockState,
            getSampleTextFromPage,
            getLanguageStatsFromText,
            detectPageLanguageState
        };
    }

    global.JieciSiteCheck = {
        createSiteChecker
    };
})(window);
