/**
 * 文件作用：
 * 提供 AI 标注辅助能力，统一管理 AI 配置状态、后台批量分析通信与匹配过滤逻辑。
 * 通过 window.JieciAI 暴露 createAIController 工厂供 content.js 调用。
 */
(function initAIControllerGlobal(global) {
    /**
     * 作用：创建 AI 控制器并注入外部依赖。
     * 输入：deps（日志、括号跳过判断、延时函数）
     * 输出：AI 控制器对象
     */
    function createAIController(deps) {
        const diagLog = typeof deps.diagLog === 'function' ? deps.diagLog : () => {
        };
        const shouldSkipAnnotationDueToParen = typeof deps.shouldSkipAnnotationDueToParen === 'function'
            ? deps.shouldSkipAnnotationDueToParen
            : (() => false);
        const sleep = typeof deps.sleep === 'function'
            ? deps.sleep
            : ((ms) => new Promise(r => setTimeout(r, ms)));

        let aiMode = 'none';
        let aiTrigger = 'all';
        let aiModelSource = 'cloud';
        let aiModelInfoUrl = 'https://api.jieci.top/model/onnx/info.json';
        let aiSimilarityThreshold = 0.25;
        let aiProcessingDelay = 0;

        /**
         * 作用：设置 AI 配置（支持部分更新）。
         * 输入：next
         * 输出：无
         */
        function setConfig(next) {
            const conf = next || {};
            if (Object.prototype.hasOwnProperty.call(conf, 'mode')) {
                aiMode = conf.mode || 'none';
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'trigger')) {
                aiTrigger = conf.trigger || 'all';
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'source')) {
                aiModelSource = conf.source || 'cloud';
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'infoUrl')) {
                aiModelInfoUrl = conf.infoUrl || aiModelInfoUrl || 'https://api.jieci.top/model/onnx/info.json';
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'threshold')) {
                aiSimilarityThreshold = conf.threshold !== undefined ? Number(conf.threshold) : aiSimilarityThreshold;
            }
            if (Object.prototype.hasOwnProperty.call(conf, 'delay')) {
                aiProcessingDelay = conf.delay !== undefined ? Number(conf.delay) : aiProcessingDelay;
            }
        }

        /**
         * 作用：获取当前 AI 配置快照。
         * 输入：无
         * 输出：配置对象
         */
        function getConfig() {
            return {
                mode: aiMode,
                trigger: aiTrigger,
                source: aiModelSource,
                infoUrl: aiModelInfoUrl,
                threshold: aiSimilarityThreshold,
                delay: aiProcessingDelay
            };
        }

        /**
         * 作用：终止 AI worker（当前实现统一在 background，无本地 worker 需终止）。
         * 输入：无
         * 输出：无
         */
        function terminateAIWorker() {
            // AI inference is unified in background.js.
        }

        /**
         * 作用：向 background 发送 AI 批量分析请求。
         * 输入：contextText, entries
         * 输出：Promise<分析结果>
         */
        function callAIBackgroundAnalyzeBatch(contextText, entries) {
            return new Promise((resolve) => {
                if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                    resolve({skipped: true});
                    return;
                }
                const requests = Array.isArray(entries)
                    ? entries.map((entry) => ({
                        contextText,
                        word: entry.word,
                        meanings: Array.isArray(entry.meanings) ? entry.meanings : [],
                        threshold: aiSimilarityThreshold
                    }))
                    : [];
                chrome.runtime.sendMessage({
                    type: 'ai-analyze-batch',
                    mode: aiMode,
                    source: aiModelSource,
                    infoUrl: aiModelInfoUrl,
                    threshold: aiSimilarityThreshold,
                    requests,
                    debug: deps.isDebugEnabled ? deps.isDebugEnabled() : false
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        diagLog('[AI-bg-batch] failed:', chrome.runtime.lastError);
                        resolve({error: true});
                        return;
                    }
                    if (!response || !response.ok || !Array.isArray(response.result)) {
                        resolve({error: true});
                        return;
                    }
                    resolve(response.result);
                });
            });
        }

        /**
         * 作用：封装 AI 批量分析并兜底异常。
         * 输入：contextText, entries
         * 输出：Promise<分析结果>
         */
        async function analyzeWordsWithAIBatch(contextText, entries) {
            try {
                const result = await callAIBackgroundAnalyzeBatch(contextText, entries);
                if (!result || result.skipped || result.error || !Array.isArray(result)) {
                    return result || {error: true};
                }
                return result;
            } catch (e) {
                console.error('AI Batch Analysis Error:', e);
                return {error: true};
            }
        }

        /**
         * 作用：对匹配结果执行 AI 二次筛选与释义选择。
         * 输入：text, matches, mode
         * 输出：Promise<void>
         */
        async function processMatchesWithAI(text, matches, mode) {
            if (aiMode === 'none' || !Array.isArray(matches) || matches.length === 0) return;

            const batchEntries = [];
            const batchTargets = [];

            for (const match of matches) {
                if (shouldSkipAnnotationDueToParen(text, match)) {
                    continue;
                }

                const data = match.data;
                if (!data) continue;

                let candidates = [];
                if (mode === 'en-to-cn') {
                    if (!data.byType) continue;
                    const typeKeys = Object.keys(data.byType);
                    typeKeys.forEach(type => {
                        const meanings = data.byType[type].meanings;
                        if (meanings) candidates.push(...meanings);
                    });
                } else if (mode === 'cn-to-en') {
                    if (data.word) candidates.push(data.word);
                }

                if (candidates.length === 0) continue;

                let shouldRunAI = false;
                if (aiTrigger === 'all') {
                    shouldRunAI = true;
                } else if (aiTrigger === 'conflict') {
                    if (mode === 'en-to-cn') {
                        const typeKeys = Object.keys(data.byType || {});
                        shouldRunAI = typeKeys.length > 1 || candidates.length > 3;
                    } else {
                        shouldRunAI = true;
                    }
                }

                if (!shouldRunAI) {
                    continue;
                }

                batchEntries.push({
                    word: match.matchText,
                    meanings: candidates
                });
                batchTargets.push({match, candidates});
            }

            if (batchEntries.length > 0) {
                await sleep(aiProcessingDelay);
                const results = await analyzeWordsWithAIBatch(text, batchEntries);
                if (Array.isArray(results)) {
                    for (let i = 0; i < batchTargets.length; i++) {
                        const target = batchTargets[i];
                        const result = results[i] || {error: true};

                        if (result.skipped || result.error) {
                            continue;
                        }

                        if (result.lowConfidence) {
                            target.match.shouldSkip = true;
                        } else if (result.index !== -1 && typeof result.score === 'number') {
                            target.match.aiScore = result.score;
                            if (mode === 'en-to-cn') {
                                target.match.selectedMeaning = target.candidates[result.index];
                            }
                        }
                    }
                }
            }

            for (let i = matches.length - 1; i >= 0; i--) {
                if (matches[i].shouldSkip) {
                    matches.splice(i, 1);
                }
            }
        }

        return {
            setConfig,
            getConfig,
            terminateAIWorker,
            processMatchesWithAI
        };
    }

    global.JieciAI = {
        createAIController
    };
})(window);
