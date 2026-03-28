// background_js/ai.js - 管理 AI 模型加载、缓存、下载和语义分析流程。

import {pipeline, env} from '../vendor/transformers.js';

const DEFAULT_AI_INFO_URL = 'https://api.jieci.top/model/onnx/info.json';
const ALLOWED_MODEL_BASE_URL = 'https://api.jieci.top/model/onnx/';
const AI_LOCAL_MODEL_KEY = 'paraphrase-multilingual-MiniLM-L12-v2/onnx/model_quantized.onnx';
const AI_CLOUD_CACHE_NAME = 'jieci-ai-model-cache';
const AI_CLOUD_CACHE_KEY = 'https://api.jieci.top/model/onnx/model_quantized.onnx';
const AI_VECTOR_CACHE_MAX_SIZE = 2400;

let aiExtractor = null;
let aiReady = null;
let aiModeLoaded = null;
let aiSourceLoaded = null;
let aiInfoUrlLoaded = null;
let aiCloudOnnxBuffer = null;
let aiCloudInfoLoading = null;

let aiDownloadState = {
    inProgress: false,
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    done: false,
    error: ''
};

let messageSourceContext = {
    source: 'local',
    infoUrl: DEFAULT_AI_INFO_URL
};

const aiVectorCache = new Map();

function toErrorMessage(error) {
    if (error && error.message) {
        return error.message;
    }
    return String(error);
}

function throwIfResponseNotOk(response, messagePrefix) {
    if (response && response.ok) {
        return;
    }
    const status = response ? response.status : 'unknown';
    throw new Error(`${messagePrefix}: ${status}`);
}

// 限制远程模型相关 URL 只能来自固定白名单前缀。
function assertAllowedModelUrl(rawUrl, label = 'model-url') {
    const url = String(rawUrl || '').trim();
    if (!url) {
        throw new Error(`[AI cloud model] empty ${label}`);
    }
    let parsed = null;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`[AI cloud model] invalid ${label}`);
    }
    const normalized = parsed.href;
    if (!normalized.startsWith(ALLOWED_MODEL_BASE_URL)) {
        throw new Error(`[AI cloud model] disallowed ${label}: ${normalized}`);
    }
    return normalized;
}

// 根据运行模式选择可用的推理后端。
function resolveAIDevice(mode) {
    if (mode === 'gpu' && self.navigator && self.navigator.gpu) {
        return 'webgpu';
    }
    if (mode === 'npu' && self.navigator && self.navigator.ml) {
        return 'webnn';
    }
    return 'wasm';
}

// 计算两个向量的余弦相似度。
function cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) {
        return 0;
    }

    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < v1.length; i += 1) {
        dot += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }

    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// 清洗候选释义文本，去掉前缀序号并裁剪空白。
function normalizeCandidateText(text) {
    return String(text || '').replace(/^[a-z]+\.\s*/i, '').trim();
}

// 生成调试日志使用的中英词对摘要。
function resolveDebugWordPair(word, meanings) {
    const normalizedWord = String(word || '').trim();
    const cleanedMeanings = (Array.isArray(meanings) ? meanings : [])
        .map(normalizeCandidateText)
        .filter(Boolean);
    const limitedMeanings = cleanedMeanings.slice(0, 4);
    const hasChineseInWord = /[\u3400-\u9fff]/.test(normalizedWord);

    if (hasChineseInWord) {
        return {
            chineseWord: normalizedWord,
            englishWord: limitedMeanings.join('|')
        };
    }

    const chineseCandidates = limitedMeanings.filter((item) => /[\u3400-\u9fff]/.test(item));
    return {
        chineseWord: chineseCandidates.join('|'),
        englishWord: normalizedWord
    };
}

// 从向量缓存读取并刷新 LRU 顺序。
function getAIVectorCache(text) {
    if (!aiVectorCache.has(text)) {
        return null;
    }

    const vec = aiVectorCache.get(text);
    aiVectorCache.delete(text);
    aiVectorCache.set(text, vec);
    return vec;
}

// 写入向量缓存并控制容量上限。
function setAIVectorCache(text, vec) {
    if (!text || !vec) {
        return;
    }

    if (aiVectorCache.has(text)) {
        aiVectorCache.delete(text);
    }
    aiVectorCache.set(text, vec);

    if (aiVectorCache.size > AI_VECTOR_CACHE_MAX_SIZE) {
        const oldestKey = aiVectorCache.keys().next().value;
        if (oldestKey !== undefined) {
            aiVectorCache.delete(oldestKey);
        }
    }
}

// 批量补齐文本向量，仅编码缓存缺失文本。
async function ensureAIVectors(extractor, texts) {
    if (!extractor || !Array.isArray(texts) || texts.length === 0) {
        return;
    }

    const pendingTexts = [];
    const seen = new Set();
    for (const raw of texts) {
        const text = String(raw || '');
        if (!text || seen.has(text) || aiVectorCache.has(text)) {
            continue;
        }
        seen.add(text);
        pendingTexts.push(text);
    }

    if (pendingTexts.length === 0) {
        return;
    }

    const output = await extractor(pendingTexts, {pooling: 'mean', normalize: true});
    const rawData = output && output.data ? output.data : null;
    if (!rawData || rawData.length === 0) {
        return;
    }

    const hiddenSize = Math.floor(rawData.length / pendingTexts.length);
    if (hiddenSize <= 0) {
        return;
    }

    for (let i = 0; i < pendingTexts.length; i += 1) {
        const start = i * hiddenSize;
        const end = start + hiddenSize;
        const vec = new Float32Array(hiddenSize);
        if (typeof rawData.subarray === 'function') {
            vec.set(rawData.subarray(start, end));
        } else {
            vec.set(rawData.slice(start, end));
        }
        setAIVectorCache(pendingTexts[i], vec);
    }
}

// 基于 info.json 解析云模型下载地址。
function resolveCloudOnnxUrl(infoUrl, infoJson) {
    const direct =
        (infoJson && typeof infoJson === 'object' && (
            infoJson.onnxUrl ||
            infoJson.url ||
            infoJson.downloadUrl ||
            (infoJson.model && infoJson.model.onnxUrl) ||
            (infoJson.files && infoJson.files.onnx)
        )) || '';

    if (typeof direct === 'string' && direct.trim()) {
        return direct.trim();
    }

    return infoUrl.replace(/\/info\.json(\?.*)?$/i, '/model_quantized.onnx');
}

// 从 Cache Storage 读取云模型二进制。
async function loadCloudOnnxFromCache() {
    try {
        const cache = await caches.open(AI_CLOUD_CACHE_NAME);
        const response = await cache.match(AI_CLOUD_CACHE_KEY);
        if (!response) {
            return null;
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.warn('[AI-bg] load cloud cache failed:', error);
        return null;
    }
}

// 将云模型二进制写入 Cache Storage。
async function saveCloudOnnxToCache(buffer) {
    const cache = await caches.open(AI_CLOUD_CACHE_NAME);
    await cache.put(AI_CLOUD_CACHE_KEY, new Response(buffer.slice(0), {
        headers: {
            'content-type': 'application/octet-stream'
        }
    }));
}

// 确保云模型二进制可用，优先使用缓存。
async function ensureCloudOnnxBuffer(infoUrl) {
    const effectiveInfoUrl = assertAllowedModelUrl(infoUrl || DEFAULT_AI_INFO_URL, 'info-url');
    if (aiCloudOnnxBuffer && aiInfoUrlLoaded === effectiveInfoUrl) {
        return aiCloudOnnxBuffer;
    }

    const cached = await loadCloudOnnxFromCache();
    if (cached) {
        aiCloudOnnxBuffer = cached;
        aiInfoUrlLoaded = effectiveInfoUrl;
        return cached;
    }

    if (aiCloudInfoLoading) {
        return aiCloudInfoLoading;
    }

    aiCloudInfoLoading = (async () => {
        try {
            const infoResp = await fetch(effectiveInfoUrl, {cache: 'no-store'});
            throwIfResponseNotOk(infoResp, 'AI info fetch failed');

            const infoJson = await infoResp.json();
            const onnxUrl = assertAllowedModelUrl(
                resolveCloudOnnxUrl(effectiveInfoUrl, infoJson),
                'onnx-url'
            );
            const onnxResp = await fetch(onnxUrl, {cache: 'no-store'});
            throwIfResponseNotOk(onnxResp, 'AI onnx fetch failed');

            return await onnxResp.arrayBuffer();
        } catch (error) {
            throw new Error(`[AI cloud model] ${toErrorMessage(error)}`);
        }
    })().finally(() => {
        aiCloudInfoLoading = null;
    });

    return aiCloudInfoLoading;
}

// 按当前模式和来源初始化 AI 提取器并返回可用实例。
async function ensureAIReady(mode) {
    const source = messageSourceContext.source || 'local';
    const infoUrl = messageSourceContext.infoUrl || DEFAULT_AI_INFO_URL;

    if (aiExtractor && aiModeLoaded === mode && aiSourceLoaded === source && aiInfoUrlLoaded === infoUrl) {
        return aiExtractor;
    }
    if (aiReady) {
        return aiReady;
    }

    const device = resolveAIDevice(mode);
    aiReady = (async () => {
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        env.allowRemoteModels = false;
        env.useCustomCache = false;
        env.customCache = null;
        env.localModelPath = chrome.runtime.getURL('vendor/models/');
        env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
        env.backends.onnx.wasm.proxy = false;
        env.backends.onnx.wasm.numThreads = 1;

        if (source === 'cloud') {
            const onnxBuffer = await ensureCloudOnnxBuffer(infoUrl);
            if (onnxBuffer) {
                aiCloudOnnxBuffer = onnxBuffer;
                env.useCustomCache = true;
                env.customCache = {
                    async match(name) {
                        if (typeof name === 'string' && name.includes(AI_LOCAL_MODEL_KEY)) {
                            return new Response(aiCloudOnnxBuffer.slice(0), {
                                headers: {'content-type': 'application/octet-stream'}
                            });
                        }
                        return undefined;
                    },
                    async put() {
                    }
                };
            }
        }

        aiExtractor = await pipeline('feature-extraction', 'paraphrase-multilingual-MiniLM-L12-v2', {
            device
        });
        aiModeLoaded = mode;
        aiSourceLoaded = source;
        aiInfoUrlLoaded = infoUrl;
        aiVectorCache.clear();
        return aiExtractor;
    })().catch((error) => {
        console.error('[AI-bg] init failed:', error);
        aiExtractor = null;
        return null;
    }).finally(() => {
        aiReady = null;
    });

    return aiReady;
}

// 检查扩展包内置模型文件是否存在。
async function localModelExists() {
    try {
        const resp = await fetch(chrome.runtime.getURL(`vendor/models/${AI_LOCAL_MODEL_KEY}`), {cache: 'no-store'});
        return resp.ok;
    } catch {
        return false;
    }
}

// 检查云模型是否已缓存到本地。
async function cloudModelDownloaded() {
    try {
        const cache = await caches.open(AI_CLOUD_CACHE_NAME);
        const response = await cache.match(AI_CLOUD_CACHE_KEY);
        return !!response;
    } catch {
        return false;
    }
}

// 返回 AI 模型状态（本地存在与云端缓存）。
export async function getAIModelStatus(infoUrl) {
    const localExists = await localModelExists();
    const cloudReady = await cloudModelDownloaded();
    return {
        localExists,
        cloudReady,
        infoUrl: infoUrl || DEFAULT_AI_INFO_URL
    };
}

// 返回当前下载状态快照。
export function getAIDownloadStatus() {
    return {...aiDownloadState};
}

// 启动云模型下载并更新进度状态。
export async function startCloudModelDownload(infoUrl) {
    if (aiDownloadState.inProgress) {
        return;
    }

    aiDownloadState = {
        inProgress: true,
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        done: false,
        error: ''
    };

    try {
        const effectiveInfoUrl = assertAllowedModelUrl(infoUrl || DEFAULT_AI_INFO_URL, 'info-url');
        const infoResp = await fetch(effectiveInfoUrl, {cache: 'no-store'});
        throwIfResponseNotOk(infoResp, 'info fetch failed');

        const infoJson = await infoResp.json();
        const onnxUrl = assertAllowedModelUrl(
            resolveCloudOnnxUrl(effectiveInfoUrl, infoJson),
            'onnx-url'
        );
        const onnxResp = await fetch(onnxUrl, {cache: 'no-store'});
        throwIfResponseNotOk(onnxResp, 'onnx fetch failed');

        const contentLength = Number(onnxResp.headers.get('content-length') || 0);
        const reader = onnxResp.body && onnxResp.body.getReader ? onnxResp.body.getReader() : null;

        if (!reader) {
            const arr = await onnxResp.arrayBuffer();
            aiDownloadState.receivedBytes = arr.byteLength;
            aiDownloadState.totalBytes = arr.byteLength;
            aiDownloadState.percent = 100;
            await saveCloudOnnxToCache(arr);
            aiCloudOnnxBuffer = arr;
            aiInfoUrlLoaded = effectiveInfoUrl;
        } else {
            const chunks = [];
            let received = 0;
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    chunks.push(value);
                    received += value.byteLength;
                    aiDownloadState.receivedBytes = received;
                    aiDownloadState.totalBytes = contentLength;
                    aiDownloadState.percent = contentLength > 0 ? Math.min(99, Math.floor((received / contentLength) * 100)) : 0;
                }
            }

            const blob = new Blob(chunks, {type: 'application/octet-stream'});
            const arr = await blob.arrayBuffer();
            await saveCloudOnnxToCache(arr);
            aiCloudOnnxBuffer = arr;
            aiInfoUrlLoaded = effectiveInfoUrl;
            aiDownloadState.receivedBytes = arr.byteLength;
            aiDownloadState.totalBytes = contentLength || arr.byteLength;
            aiDownloadState.percent = 100;
        }

        aiDownloadState.done = true;
        aiDownloadState.inProgress = false;
        aiDownloadState.error = '';
    } catch (error) {
        aiDownloadState.inProgress = false;
        aiDownloadState.done = false;
        aiDownloadState.error = error && error.message ? error.message : String(error);
    }
}

// 卸载云模型并重置相关内存状态。
export async function uninstallCloudModel() {
    try {
        const cache = await caches.open(AI_CLOUD_CACHE_NAME);
        await cache.delete(AI_CLOUD_CACHE_KEY);
    } catch (error) {
        console.warn('[AI-bg] uninstall cache failed:', error);
    }

    aiCloudOnnxBuffer = null;
    aiInfoUrlLoaded = null;
    aiExtractor = null;
    aiReady = null;
    aiModeLoaded = null;
    aiSourceLoaded = null;
    aiVectorCache.clear();
}

// 执行批量语义分析并返回每项匹配结果。
export async function analyzeBatchWithAIBackground(message) {
    const mode = message.mode || 'cpu';
    const debug = message.debug === true;
    const startedAt = Date.now();

    messageSourceContext = {
        source: message.source || 'local',
        infoUrl: message.infoUrl || DEFAULT_AI_INFO_URL
    };

    const defaultThreshold = Number(message.threshold);
    const requests = Array.isArray(message.requests) ? message.requests : [];
    if (!requests.length) {
        return [];
    }

    const extractor = await ensureAIReady(mode);
    if (!extractor) {
        return requests.map(() => ({skipped: true}));
    }

    const textsToEncode = [];
    for (const req of requests) {
        const safeContext = String(req && req.contextText ? req.contextText : '').substring(0, 512);
        if (safeContext) {
            textsToEncode.push(safeContext);
        }

        const meanings = Array.isArray(req && req.meanings) ? req.meanings : [];
        for (const meaning of meanings) {
            const cleaned = normalizeCandidateText(meaning);
            if (cleaned) {
                textsToEncode.push(cleaned);
            }
        }
    }

    await ensureAIVectors(extractor, textsToEncode);

    const results = [];
    for (const req of requests) {
        const threshold = Number(req && req.threshold);
        const effectiveThreshold = Number.isFinite(threshold) ? threshold : defaultThreshold;
        const word = String(req && req.word ? req.word : '');
        const wordPair = resolveDebugWordPair(word, req && req.meanings);
        const safeContext = String(req && req.contextText ? req.contextText : '').substring(0, 512);
        const contextForLog = safeContext.replace(/\s+/g, ' ').trim().substring(0, 200);
        const meanings = Array.isArray(req && req.meanings) ? req.meanings : [];

        if (!safeContext || !meanings.length) {
            if (debug) {
                console.log(
                    '[jieci-ai-bg]',
                    `chinese_word=${wordPair.chineseWord}`,
                    `english_word=${wordPair.englishWord}`,
                    `context=${contextForLog}`,
                    'result=skipped',
                    'reason=no-meanings'
                );
            }
            results.push({skipped: true});
            continue;
        }

        const contextEmb = getAIVectorCache(safeContext);
        if (!contextEmb) {
            results.push({skipped: true});
            continue;
        }

        let maxScore = -1;
        let bestIndex = -1;
        for (let i = 0; i < meanings.length; i += 1) {
            const candidateText = normalizeCandidateText(meanings[i]);
            const meaningEmb = candidateText ? getAIVectorCache(candidateText) : null;
            if (!meaningEmb) {
                continue;
            }

            const score = cosineSimilarity(contextEmb, meaningEmb);
            if (score > maxScore) {
                maxScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex === -1) {
            results.push({skipped: true});
            continue;
        }

        if (maxScore < effectiveThreshold) {
            if (debug) {
                console.log(
                    '[jieci-ai-bg]',
                    `chinese_word=${wordPair.chineseWord}`,
                    `english_word=${wordPair.englishWord}`,
                    `context=${contextForLog}`,
                    `score=${maxScore.toFixed(4)}`,
                    `threshold=${effectiveThreshold}`,
                    'low-confidence=true',
                    `cost=${Date.now() - startedAt}ms`
                );
            }
            results.push({index: -1, score: maxScore, lowConfidence: true});
            continue;
        }

        if (debug) {
            console.log(
                '[jieci-ai-bg]',
                `chinese_word=${wordPair.chineseWord}`,
                `english_word=${wordPair.englishWord}`,
                `context=${contextForLog}`,
                `index=${bestIndex}`,
                `score=${maxScore.toFixed(4)}`,
                `threshold=${effectiveThreshold}`,
                'low-confidence=false',
                `cost=${Date.now() - startedAt}ms`
            );
        }
        results.push({index: bestIndex, score: maxScore});
    }

    return results;
}

// 执行单条语义分析，返回首条匹配结果。
export async function analyzeWithAIBackground(message) {
    const requests = [{
        contextText: message.contextText,
        word: message.word,
        meanings: message.meanings,
        threshold: message.threshold
    }];

    const result = await analyzeBatchWithAIBackground({...message, requests});
    if (!Array.isArray(result) || result.length === 0) {
        return {skipped: true};
    }

    return result[0];
}

// 运行 AI 基准测试并返回推理速度。
export async function runAIBenchmark(message) {
    try {
        const mode = message.mode || 'cpu';
        messageSourceContext = {
            source: 'cloud',
            infoUrl: message.infoUrl || DEFAULT_AI_INFO_URL
        };

        const extractor = await ensureAIReady(mode);
        if (!extractor) {
            const wrapped = '[AI benchmark] AI model not ready';
            console.warn('[AI-bg] benchmark failed:', wrapped);
            return Promise.reject(new Error(wrapped));
        }

        const text = String(message.text || '');
        const startInference = performance.now();
        await extractor(text, {pooling: 'mean', normalize: true});
        const endInference = performance.now();
        const durationSeconds = Math.max(0.001, (endInference - startInference) / 1000);
        const speed = Math.round(text.length / durationSeconds);

        return {
            speed,
            durationSeconds
        };
    } catch (error) {
        const wrapped = `[AI benchmark] ${toErrorMessage(error)}`;
        console.warn('[AI-bg] benchmark failed:', wrapped);
        throw new Error(wrapped);
    }
}
