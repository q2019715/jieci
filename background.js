// background.js - 后台服务脚本
import initJieba, * as jieba from './vendor/jieba_rs_wasm.js';

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
    'highlightColorMode',
    'highlightColor'
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

  if (!result.highlightColorMode) {
    await chrome.storage.local.set({ highlightColorMode: 'none' });
  }

  if (!result.highlightColor) {
    await chrome.storage.local.set({ highlightColor: '#2196f3' });
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

  return false;
});

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

// SPA navigation is handled inside the page (content script) to avoid webNavigation permission.
