// background.js - 后台服务脚本
import initJieba, * as jieba from './vendor/jieba_rs_wasm.js';
import { pipeline, env } from './vendor/transformers.js';

// Trie树构建（用于预处理词库）
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
    this.word = null;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEnd = true;
    node.word = word;
  }

  serialize() {
    return this.root;
  }
}

// 从词库构建中文Trie树索引
// 从词库数据构建中文 Trie 索引，用于后续高效匹配。
function buildChineseTrieIndex(vocabularies) {
  const trie = new Trie();
  const vocabSet = new Set();

  vocabularies.forEach(vocab => {
    vocab.data.forEach(item => {
      if (item.translations && Array.isArray(item.translations)) {
        item.translations.forEach(trans => {
          const chinese = trans.translation;
          if (chinese) {
            const chineseWords = chinese.split(/[,、，]/);
            chineseWords.forEach(cw => {
              const cleanChinese = cw.trim();
              if (cleanChinese && !vocabSet.has(cleanChinese)) {
                trie.insert(cleanChinese);
                vocabSet.add(cleanChinese);
              }
            });
          }
        });
      }
    });
  });

  return trie.serialize();
}

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('\u622a\u8bcd\u8bb0\u5fc6\u5df2\u5b89\u88c5');

  // 初始化默认设置
  const result = await chrome.storage.local.get([
    'displayMode',
    'vocabularies',
    'vocabularyTrieIndex',
    'maxMatchesPerNode',
    'minTextLength',
    'annotationMode',
    'cnToEnOrder',
    'enToCnOrder',
    'disableAnnotationUnderline',
    'annotationWordCardPopupEnabled',
    'wordCardHighlightMatchedChinese',
    'speechVoiceURI',
    'highlightColorMode',
    'highlightColor',
    'siteBlockMode',
    'aiSimilarityThreshold',
    'aiProcessingDelay'
  ]);

  if (!result.displayMode) {
    await chrome.storage.local.set({ displayMode: 'off' });
  }

  if (!result.vocabularies) {
    await chrome.storage.local.set({ vocabularies: [] });
  }

  // 检查是否需要构建Trie树索引
  if (result.vocabularies && result.vocabularies.length > 0 && !result.vocabularyTrieIndex) {
    console.log('检测到词库但无Trie树索引，开始构建...');
    const trieIndex = buildChineseTrieIndex(result.vocabularies);
    await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
    console.log('Trie树索引构建完成');
  }

  if (result.maxMatchesPerNode === undefined) {
    await chrome.storage.local.set({ maxMatchesPerNode: 3 });
  }

  if (result.minTextLength === undefined) {
    await chrome.storage.local.set({ minTextLength: 10 });
  }

  if (!result.annotationMode) {
    await chrome.storage.local.set({ annotationMode: 'auto' });
  }

  if (result.speechVoiceURI === undefined) {
    await chrome.storage.local.set({ speechVoiceURI: '' });
  }

  if (!result.cnToEnOrder) {
    await chrome.storage.local.set({ cnToEnOrder: 'source-first' });
  }

  if (!result.enToCnOrder) {
    await chrome.storage.local.set({ enToCnOrder: 'source-first' });
  }

  if (result.disableAnnotationUnderline === undefined) {
    await chrome.storage.local.set({ disableAnnotationUnderline: false });
  }

  if (result.annotationWordCardPopupEnabled === undefined) {
    await chrome.storage.local.set({ annotationWordCardPopupEnabled: true });
  }

  if (result.wordCardHighlightMatchedChinese === undefined) {
    await chrome.storage.local.set({ wordCardHighlightMatchedChinese: true });
  }

  if (!result.highlightColorMode) {
    await chrome.storage.local.set({ highlightColorMode: 'none' });
  }

  if (!result.highlightColor) {
    await chrome.storage.local.set({ highlightColor: '#2196f3' });
  }

  if (!result.siteBlockMode) {
    await chrome.storage.local.set({ siteBlockMode: 'blacklist' });
  }

  if (result.aiSimilarityThreshold === undefined) {
    await chrome.storage.local.set({ aiSimilarityThreshold: 0.25 });
  }

  if (result.aiProcessingDelay === undefined) {
    await chrome.storage.local.set({ aiProcessingDelay: 0 });
  }
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    console.log('存储已更新:', changes);
  }
});

// 保持 service worker 活跃（如果需要）

// Jieba wasm loader runs in the extension context to avoid page CSP/COEP issues.
const JIEBA_ERROR_UNAVAILABLE = 'jieba-unavailable';
const JIEBA_ERROR_FAILED = 'jieba-failed';
let jiebaModule = null;
let jiebaReady = null;
let aiExtractor = null;
let aiReady = null;
let aiModeLoaded = null;
let aiSourceLoaded = null;
let aiInfoUrlLoaded = null;
let aiCloudOnnxBuffer = null;
let aiCloudInfoLoading = null;
const DEFAULT_AI_INFO_URL = 'https://api.jieci.top/model/onnx/info.json';
const AI_LOCAL_MODEL_KEY = 'paraphrase-multilingual-MiniLM-L12-v2/onnx/model_quantized.onnx';
const AI_CLOUD_CACHE_NAME = 'jieci-ai-model-cache';
const AI_CLOUD_CACHE_KEY = 'https://api.jieci.top/model/onnx/model_quantized.onnx';
let aiDownloadState = {
  inProgress: false,
  percent: 0,
  receivedBytes: 0,
  totalBytes: 0,
  done: false,
  error: ''
};
const AI_VECTOR_CACHE_MAX_SIZE = 2400;
const aiVectorCache = new Map();

// 根据用户选择的运行模式解析 AI 推理后端（WebGPU/WebNN/WASM）。
function resolveAIDevice(mode) {
  if (mode === 'gpu' && self.navigator && self.navigator.gpu) {
    return 'webgpu';
  }
  if (mode === 'npu' && self.navigator && self.navigator.ml) {
    return 'webnn';
  }
  return 'wasm';
}

// 计算两个向量的余弦相似度，用于语义匹配打分。
function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) {
    return 0;
  }
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// 规范化候选释义文本，去掉前缀编号并裁剪空白。
function normalizeCandidateText(text) {
  return String(text || '').replace(/^[a-z]+\.\s*/i, '').trim();
}

// 生成调试日志中使用的中英词对摘要。
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

// 从 AI 向量缓存中读取并刷新 LRU 顺序。
function getAIVectorCache(text) {
  if (!aiVectorCache.has(text)) {
    return null;
  }
  const vec = aiVectorCache.get(text);
  aiVectorCache.delete(text);
  aiVectorCache.set(text, vec);
  return vec;
}

// 写入 AI 向量缓存并维持最大容量（LRU 淘汰）。
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

// 批量补齐文本向量，只编码缓存中不存在的文本。
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

  const output = await extractor(pendingTexts, { pooling: 'mean', normalize: true });
  const rawData = output && output.data ? output.data : null;
  if (!rawData || rawData.length === 0) {
    return;
  }
  const hiddenSize = Math.floor(rawData.length / pendingTexts.length);
  if (hiddenSize <= 0) {
    return;
  }

  for (let i = 0; i < pendingTexts.length; i++) {
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

// 确保 AI 模型已按当前模式/来源初始化完成并可用。
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
                headers: { 'content-type': 'application/octet-stream' }
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

let messageSourceContext = {
  source: 'local',
  infoUrl: DEFAULT_AI_INFO_URL
};

// 从 info.json 中解析云端 onnx 下载地址，解析不到则用默认规则。
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

// 确保云端 onnx 二进制可用（优先内存/缓存，其次网络拉取）。
async function ensureCloudOnnxBuffer(infoUrl) {
  const effectiveInfoUrl = infoUrl || DEFAULT_AI_INFO_URL;
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
    const infoResp = await fetch(effectiveInfoUrl, { cache: 'no-store' });
    if (!infoResp.ok) {
      throw new Error(`AI info fetch failed: ${infoResp.status}`);
    }
    const infoJson = await infoResp.json();
    const onnxUrl = resolveCloudOnnxUrl(effectiveInfoUrl, infoJson);
    const onnxResp = await fetch(onnxUrl, { cache: 'no-store' });
    if (!onnxResp.ok) {
      throw new Error(`AI onnx fetch failed: ${onnxResp.status}`);
    }
    const arr = await onnxResp.arrayBuffer();
    return arr;
  })().finally(() => {
    aiCloudInfoLoading = null;
  });
  return aiCloudInfoLoading;
}

// 从 Cache Storage 读取已下载的云模型文件。
async function loadCloudOnnxFromCache() {
  try {
    const cache = await caches.open(AI_CLOUD_CACHE_NAME);
    const response = await cache.match(AI_CLOUD_CACHE_KEY);
    if (!response) {
      return null;
    }
    return await response.arrayBuffer();
  } catch (e) {
    console.warn('[AI-bg] load cloud cache failed:', e);
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

// 卸载云模型并清理相关内存状态与缓存。
async function uninstallCloudModel() {
  try {
    const cache = await caches.open(AI_CLOUD_CACHE_NAME);
    await cache.delete(AI_CLOUD_CACHE_KEY);
  } catch (e) {
    console.warn('[AI-bg] uninstall cache failed:', e);
  }
  aiCloudOnnxBuffer = null;
  aiInfoUrlLoaded = null;
  aiExtractor = null;
  aiReady = null;
  aiModeLoaded = null;
  aiSourceLoaded = null;
  aiVectorCache.clear();
}

// 检查扩展包内置本地模型文件是否存在。
async function localModelExists() {
  try {
    const resp = await fetch(chrome.runtime.getURL(`vendor/models/${AI_LOCAL_MODEL_KEY}`), { cache: 'no-store' });
    return resp.ok;
  } catch (_) {
    return false;
  }
}

// 检查云模型是否已经下载到本地缓存。
async function cloudModelDownloaded() {
  try {
    const cache = await caches.open(AI_CLOUD_CACHE_NAME);
    const response = await cache.match(AI_CLOUD_CACHE_KEY);
    return !!response;
  } catch (_) {
    return false;
  }
}

// 汇总并返回 AI 模型状态（本地是否存在/云端是否已下载）。
async function getAIModelStatus(infoUrl) {
  const localExists = await localModelExists();
  const cloudReady = await cloudModelDownloaded();
  return {
    localExists,
    cloudReady,
    infoUrl: infoUrl || DEFAULT_AI_INFO_URL
  };
}

// 返回当前云模型下载任务的进度快照。
function getAIDownloadStatus() {
  return { ...aiDownloadState };
}

// 启动云模型下载并实时更新下载状态。
async function startCloudModelDownload(infoUrl) {
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
    const effectiveInfoUrl = infoUrl || DEFAULT_AI_INFO_URL;
    const infoResp = await fetch(effectiveInfoUrl, { cache: 'no-store' });
    if (!infoResp.ok) {
      throw new Error(`info fetch failed: ${infoResp.status}`);
    }
    const infoJson = await infoResp.json();
    const onnxUrl = resolveCloudOnnxUrl(effectiveInfoUrl, infoJson);
    const onnxResp = await fetch(onnxUrl, { cache: 'no-store' });
    if (!onnxResp.ok) {
      throw new Error(`onnx fetch failed: ${onnxResp.status}`);
    }
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
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          aiDownloadState.receivedBytes = received;
          aiDownloadState.totalBytes = contentLength;
          aiDownloadState.percent = contentLength > 0 ? Math.min(99, Math.floor((received / contentLength) * 100)) : 0;
        }
      }
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
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
  } catch (e) {
    aiDownloadState.inProgress = false;
    aiDownloadState.done = false;
    aiDownloadState.error = e && e.message ? e.message : String(e);
  }
}

// 背景侧批量语义判定主流程（编码、匹配、阈值过滤、调试日志）。
async function analyzeBatchWithAIBackground(message) {
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
    return requests.map(() => ({ skipped: true }));
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
      results.push({ skipped: true });
      continue;
    }

    const contextEmb = getAIVectorCache(safeContext);
    if (!contextEmb) {
      results.push({ skipped: true });
      continue;
    }

    let maxScore = -1;
    let bestIndex = -1;
    for (let i = 0; i < meanings.length; i++) {
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
      results.push({ skipped: true });
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
      results.push({ index: -1, score: maxScore, lowConfidence: true });
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
    results.push({ index: bestIndex, score: maxScore });
  }

  return results;
}

// 单条语义判定包装器，复用批量接口返回首项结果。
async function analyzeWithAIBackground(message) {
  const requests = [{
    contextText: message.contextText,
    word: message.word,
    meanings: message.meanings,
    threshold: message.threshold
  }];
  const result = await analyzeBatchWithAIBackground({ ...message, requests });
  if (!Array.isArray(result) || result.length === 0) {
    return { skipped: true };
  }
  return result[0];
}

// 运行 AI 基准测试并返回推理速度指标。
async function runAIBenchmark(message) {
  const mode = message.mode || 'cpu';
  messageSourceContext = {
    source: 'cloud',
    infoUrl: message.infoUrl || DEFAULT_AI_INFO_URL
  };
  const extractor = await ensureAIReady(mode);
  if (!extractor) {
    throw new Error('AI model not ready');
  }
  const text = String(message.text || '');
  const startInference = performance.now();
  await extractor(text, { pooling: 'mean', normalize: true });
  const endInference = performance.now();
  const durationSeconds = Math.max(0.001, (endInference - startInference) / 1000);
  const speed = Math.round(text.length / durationSeconds);
  return {
    speed,
    durationSeconds
  };
}


// 确保 jieba wasm 模块已初始化并可用于分词/词性。
async function ensureJiebaReady() {
  if (jiebaReady) {
    return jiebaReady;
  }
  const wasmUrl = chrome.runtime.getURL('vendor/jieba_rs_wasm_bg.wasm');
  jiebaReady = (async () => {
    const resp = await fetch(wasmUrl);
    const bytes = await resp.arrayBuffer();
    await initJieba({ module_or_path: bytes });
    jiebaModule = jieba;
    return jieba;
  })().catch((error) => {
    console.error('Failed to initialize jieba-wasm in background:', error);
    jiebaModule = null;
    return null;
  });
  return jiebaReady;
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === 'jieba-tokenize') {
    return handleJiebaRequest(
      message,
      sendResponse,
      (mod, text) => mod.tokenize(text, 'default', true),
      'tokens'
    );
  }

  if (message.type === 'jieba-tag') {
    return handleJiebaRequest(
      message,
      sendResponse,
      (mod, text) => mod.tag(text, true),
      'tags'
    );
  }

  if (message.type === 'ai-analyze') {
    return handleAIAnalyzeRequest(message, sendResponse);
  }

  if (message.type === 'ai-analyze-batch') {
    return handleAIBatchAnalyzeRequest(message, sendResponse);
  }

  if (message.type === 'ai-model-status') {
    (async () => {
      const status = await getAIModelStatus(message.infoUrl);
      sendResponse({ ok: true, status });
    })().catch((error) => {
      sendResponse({ ok: false, error: String(error) });
    });
    return true;
  }

  if (message.type === 'ai-download-status') {
    sendResponse({ ok: true, status: getAIDownloadStatus() });
    return true;
  }

  if (message.type === 'ai-download-cloud-model') {
    startCloudModelDownload(message.infoUrl || DEFAULT_AI_INFO_URL).then(() => {
      // no-op
    }).catch(() => {
      // status contains error
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'ai-uninstall-cloud-model') {
    uninstallCloudModel().then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({ ok: false, error: String(error) });
    });
    return true;
  }

  if (message.type === 'ai-benchmark') {
    runAIBenchmark(message).then((result) => {
      sendResponse({ ok: true, result });
    }).catch((error) => {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });
    return true;
  }

  return false;
});

// 统一处理 jieba 请求并返回指定键名的结果。
function handleJiebaRequest(message, sendResponse, execute, resultKey) {
  if (typeof message.text !== 'string' || message.text.length === 0) {
    sendResponse({ ok: true, [resultKey]: [] });
    return true;
  }

  (async () => {
    const mod = await ensureJiebaReady();
    if (!mod) {
      sendResponse({ ok: false, error: JIEBA_ERROR_UNAVAILABLE });
      return;
    }
    try {
      const result = execute(mod, message.text);
      sendResponse({ ok: true, [resultKey]: result });
    } catch (error) {
      console.error('[jieba]', message.type, 'failed:', error);
      sendResponse({ ok: false, error: JIEBA_ERROR_FAILED });
    }
  })();

  return true;
}

// 处理单条 AI 分析消息请求。
function handleAIAnalyzeRequest(message, sendResponse) {
  (async () => {
    try {
      const result = await analyzeWithAIBackground(message);
      sendResponse({ ok: true, result });
    } catch (error) {
      console.error('[AI-bg] analyze failed:', error);
      sendResponse({ ok: false, error: 'ai-failed' });
    }
  })();
  return true;
}

// 处理批量 AI 分析消息请求。
function handleAIBatchAnalyzeRequest(message, sendResponse) {
  (async () => {
    try {
      const result = await analyzeBatchWithAIBackground(message);
      sendResponse({ ok: true, result });
    } catch (error) {
      console.error('[AI-bg] batch analyze failed:', error);
      sendResponse({ ok: false, error: 'ai-batch-failed' });
    }
  })();
  return true;
}

// SPA navigation is handled inside the page (content script) to avoid webNavigation permission.
