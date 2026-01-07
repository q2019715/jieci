// content.js - 网页内容脚本，负责文本匹配和替换



let displayMode = 'off'; // 显示模式：'off'、'underline'、'annotation'

let vocabularyMap = new Map(); // 中文翻译 -> 英文单词的映射

let processedNodes = new WeakSet(); // 记录已处理的节点

let vocabularyTrie = null; // Trie树索引

const EN_STOPWORDS = new Set([

  'a',

  'an',

  'the',

  'and',

  'or',

  'but',

  'if',

  'then',

  'than',

  'to',

  'of',

  'in',

  'on',

  'at',

  'by',

  'for',

  'from',

  'with',

  'as',

  'is',

  'are',

  'was',

  'were',

  'be',

  'been',

  'being',

  'do',

  'does',

  'did',

  'done',

  'can',

  'could',

  'will',

  'would',

  'shall',

  'should',

  'may',

  'might',

  'must',

  'not',

  'no',

  'yes',

  'this',

  'that',

  'these',

  'those',

  'it',

  'its',

  'i',

  'you',

  'he',

  'she',

  'we',

  'they',

  'me',

  'him',

  'her',

  'us',

  'them',

  'my',

  'your',

  'his',

  'their',

  'our',

  'mine',

  'yours',

  'hers',

  'theirs',

  'ours'

]);

const DEBUG = false; // 调试模式

let maxMatchesPerNode = 3; // 单个文本节点最多标注的词汇数量（可配置）
const MERGED_BLOCK_MIN_LENGTH = 40;
let blockQuotaRemaining = new WeakMap();
let blockGroupCache = new WeakMap();

let minTextLength = 10; // 容器最小字数，少于此数不添加标注

let annotationMode = 'auto'; // 标注模式：'cn-to-en'、'auto'、'en-to-cn'

let actualAnnotationMode = 'cn-to-en'; // 实际使用的标注模式（auto模式下自动检测）

let highlightColorMode = 'auto';

let highlightColor = '#2196f3';

let vocabularySet = new Set(); // 词汇集合，用于分词

let languageStats = null; // {chineseCount, englishCount, chineseRatio, englishRatio, totalUnits, detected}
let languageDetectTimer = null;
let languageDetectAttempts = 0;
let languageDetectDone = false;
const LANGUAGE_DETECT_RETRY_MS = 1200;
const LANGUAGE_DETECT_MAX_ATTEMPTS = 8;

let smartSkipCodeLinks = true;

let dedupeMode = 'page'; // off | page | count

let dedupeRepeatCount = 50;

const dedupeSeen = new Set();

const dedupeRemaining = new Map();

let dedupeSaveTimer = null;

const EN_SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'word' }) : null;



let globalTooltip = null;

let globalTooltipOwner = null;

let isTooltipVisible = false;

let globalTooltipHideTimer = null;

let tooltipListenersAttached = false;

let isHoveringHighlight = false;

let isHoveringTooltip = false;

let pointerTrackerAttached = false;

let lastPointerPosition = null;

const TOOLTIP_HIDE_DELAY_MS = 100;





let pendingNodes = [];

let pendingNodesSet = new WeakSet();

let processingScheduled = false;

let processingHandle = null;

const PROCESS_BATCH_LIMIT = 200;

const PROCESS_IDLE_TIMEOUT_MS = 200;

let initialProcessingLogged = false;

let spaRescanTimers = [];





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

    processingHandle = requestIdleCallback(runProcessingQueue, { timeout: PROCESS_IDLE_TIMEOUT_MS });

  } else {

    processingHandle = setTimeout(() => {

      runProcessingQueue({ didTimeout: true, timeRemaining: () => 0 });

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
    initialProcessingLogged = true;
    logPageStatus('修改完成 模式:', getEffectiveMode());
  }


  if (pendingNodes.length > 0) {

    scheduleProcessing();

  }

}



// Trie树（字典树）- 用于快速词汇匹配

class Trie {

  constructor(root = null) {

    if (root) {

      // 从序列化的数据恢复

      this.root = root;

    } else {

      this.root = { children: {}, isEnd: false, word: null };

    }

  }



  // 在文本中查找所有匹配的词汇（最大正向匹配）

  // 返回: [{word, start, end}, ...]

  findAllMatches(text, checkChar = null) {

    const matches = [];

    const len = text.length;



    for (let i = 0; i < len; i++) {

      const char = text[i];



      // 如果提供了字符检查函数，先检查

      if (checkChar && !checkChar(char)) {

        continue;

      }



      // 从当前位置开始尝试匹配

      let node = this.root;

      let lastMatch = null;

      let j = i;



      while (j < len && node.children && node.children[text[j]]) {

        node = node.children[text[j]];

        if (node.isEnd) {

          // 记录最长匹配

          lastMatch = { word: node.word, start: i, end: j + 1 };

        }

        j++;

      }



      // 如果找到匹配，添加到结果并跳过已匹配的部分

      if (lastMatch) {

        matches.push(lastMatch);

        i = lastMatch.end - 1; // -1 因为for循环会i++

      }

    }



    return matches;

  }

}



// 调试日志

function debugLog(...args) {

  if (DEBUG) {

    console.log('[截词英语学习助手]', ...args);

  }

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
  while (walker.nextNode()) {
    processedNodes.delete(walker.currentNode);
  }
  enqueueNode(container);
}

function scheduleSpaRescan(root) {
  clearSpaRescanTimers();
  spaRescanTimers.push(setTimeout(() => forceReprocessContainer(root), 600));
  spaRescanTimers.push(setTimeout(() => forceReprocessContainer(root), 1600));
}

let lastSeenUrl = location.href;

function isContentScriptActive() {
  return typeof document !== 'undefined' && document.body;
}

async function handleSpaNavigation(reason) {
  if (!isContentScriptActive()) {
    return;
  }
  languageDetectDone = false;
  resetLanguageDetectRetry();
  logPageStatus('SPA nav ' + reason + ' mode:', getEffectiveMode());

  if (displayMode !== 'off') {
    await startProcessing();
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
    lastSeenUrl = current;
    handleSpaNavigation(reason);
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


// 初始化

(async function init() {

  debugLog('插件初始化...');

  await loadSettings();

  setupSpaNavigationListener();

  if (annotationMode === 'auto') {
    detectPageLanguage();
  }
  logPageStatus('当前语言判断结果:', getLanguageResultLabel());

  debugLog('初始化完成，显示模式:', displayMode, '词库大小:', vocabularyMap.size);

  if (displayMode !== 'off') {

    await startProcessing();

  }

})();



// 监听来自 popup 的消息

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  debugLog('收到消息:', message);

  if (message.action === 'updateDisplayMode') {

    displayMode = message.mode;

    debugLog('切换显示模式:', displayMode);

    if (displayMode !== 'off') {

      startProcessing();

    } else {

      stopProcessing();

    }

  } else if (message.action === 'reloadVocabularies') {

    debugLog('重新加载词库');

    loadVocabularies();

    if (displayMode !== 'off') {

      // 清除已处理标记，重新处理页面

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateMaxMatches') {

    maxMatchesPerNode = normalizeMaxMatches(message.maxMatches);

    debugLog('更新标注上限:', maxMatchesPerNode);

    if (displayMode !== 'off') {

      // 清除已处理标记，重新处理页面

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateMinTextLength') {

    minTextLength = message.minLength || 0;

    debugLog('更新容器最小字数:', minTextLength);

    if (displayMode !== 'off') {

      // 清除已处理标记，重新处理页面

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateMode') {

    annotationMode = message.mode;

    debugLog('更新标注模式:', annotationMode);

    // 重新加载词库以更新映射

    loadVocabularies();

    if (displayMode !== 'off') {

      // 清除已处理标记，重新处理页面

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateHighlightColor') {

    highlightColorMode = message.mode || 'auto';

    highlightColor = message.color || '#2196f3';

    applyHighlightColor(highlightColorMode, highlightColor);

  } else if (message.action === 'updateSmartSkipCodeLinks') {

    smartSkipCodeLinks = message.enabled !== false;

    if (displayMode !== 'off') {

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateDedupeMode') {

    dedupeMode = message.mode || 'page';

    resetDedupeState();

    if (dedupeMode === 'count') {

      loadDedupeStateFromStorage();

    } else {

      dedupeRemaining.clear();

    }

    if (displayMode !== 'off') {

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'updateDedupeRepeatCount') {

    dedupeRepeatCount = Number(message.repeatCount) || 50;

    clampDedupeRemaining();

    scheduleDedupeSave();

    if (displayMode !== 'off') {

      processedNodes = new WeakSet();

      startProcessing();

    }

  } else if (message.action === 'clearDedupeCounts') {

    dedupeRemaining.clear();

    chrome.storage.local.remove('dedupeGlobalState').catch(() => {});

    if (displayMode !== 'off') {

      processedNodes = new WeakSet();

      startProcessing();

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



// 加载设置

async function loadSettings() {

  try {

    const result = await chrome.storage.local.get(['displayMode', 'vocabularies', 'maxMatchesPerNode', 'minTextLength', 'annotationMode', 'highlightColorMode', 'highlightColor', 'smartSkipCodeLinks', 'dedupeMode', 'dedupeRepeatCount', 'dedupeCooldownSeconds', 'dedupeGlobalState']);

    displayMode = result.displayMode || 'off';

    maxMatchesPerNode = normalizeMaxMatches(result.maxMatchesPerNode);

    minTextLength = result.minTextLength || 10;

    annotationMode = result.annotationMode || 'auto';

    highlightColorMode = result.highlightColorMode || 'none';

    highlightColor = result.highlightColor || '#2196f3';

    smartSkipCodeLinks = result.smartSkipCodeLinks !== false;

    dedupeMode = result.dedupeMode || 'page';

    if (dedupeMode === 'cooldown') {

      dedupeMode = 'count';

    }

    dedupeRepeatCount = (typeof result.dedupeRepeatCount === 'number')

      ? result.dedupeRepeatCount

      : ((typeof result.dedupeCooldownSeconds === 'number') ? result.dedupeCooldownSeconds : 50);

    debugLog('加载设置 - 显示模式:', displayMode, '标注上限:', maxMatchesPerNode, '最小字数:', minTextLength, '标注模式:', annotationMode);

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

    const result = await chrome.storage.local.get(['vocabularies', 'vocabularyTrieIndex']);

    const vocabList = result.vocabularies || [];

    const cachedTrieIndex = result.vocabularyTrieIndex;



    debugLog('加载词库，文件数量:', vocabList.length, '模式:', annotationMode);



    vocabularyMap.clear();

    vocabularySet.clear();



    // 根据模式创建Trie树

    const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;



    if (effectiveMode === 'cn-to-en') {

      // 中文->英文模式：从缓存加载Trie树

      if (cachedTrieIndex) {

        vocabularyTrie = new Trie(cachedTrieIndex);

        debugLog('从缓存加载Trie树索引成功');

      } else {

        vocabularyTrie = null;

        debugLog('警告：未找到缓存的Trie树索引');

      }

    } else if (effectiveMode === 'en-to-cn') {

      // 英文->中文模式：不需要Trie树，使用正则匹配

      vocabularyTrie = null;

    }



    vocabList.forEach(vocab => {

      vocab.data.forEach(item => {

        const word = item.word;



        if (effectiveMode === 'cn-to-en') {

          // 中文 -> 英文模式：构建映射 中文翻译 -> { word, translations, phrases }

          if (item.translations && Array.isArray(item.translations)) {

            item.translations.forEach(trans => {

              const chinese = trans.translation;

              if (chinese) {

                // 可能有多个中文翻译，用逗号或顿号分隔

                const chineseWords = chinese.split(/[,、，]/);

                chineseWords.forEach(cw => {

                  const cleanChinese = cw.trim();

                  if (cleanChinese) {

                    // 添加到词汇集合（用于兼容性）

                    vocabularySet.add(cleanChinese);



                    if (!vocabularyMap.has(cleanChinese)) {

                      vocabularyMap.set(cleanChinese, []);

                    }

                    vocabularyMap.get(cleanChinese).push({

                      word: word,

                      type: trans.type || '',

                      allTranslations: item.translations,

                      phrases: item.phrases || [],

                      wordLength: word.length // 用于计算优先级

                    });

                  }

                });

              }

            });

          }

        } else if (effectiveMode === 'en-to-cn') {

          // 英文 -> 中文模式：构建映射 英文单词 -> { translations, phrases }

          if (word) {

            const cleanWord = word.trim().toLowerCase();

            if (cleanWord) {

              vocabularySet.add(cleanWord);



              if (!vocabularyMap.has(cleanWord)) {

                vocabularyMap.set(cleanWord, []);

              }

              vocabularyMap.get(cleanWord).push({

                word: word,

                allTranslations: item.translations || [],

                phrases: item.phrases || [],

                wordLength: word.length

              });

            }

          }

        }

      });

    });



    debugLog(`词库加载完成，共 ${vocabularyMap.size} 个词条，模式: ${annotationMode}`);

    if (vocabularyTrie) {

      debugLog('Trie树已就绪（从缓存加载）');

    }



    // 调试：显示前10个词条

    if (DEBUG) {

      const entries = Array.from(vocabularyMap.entries()).slice(0, 10);

      debugLog('词库示例（前10个）:', entries);

    }

  } catch (error) {

    console.error('加载词库失败:', error);

  }

}



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
      debugLog('No language detected, defaulting to cn-to-en');
      return false;
    }

    const { chineseCount, englishCount, chineseRatio, englishRatio } = languageStats;
    debugLog(`Language stats: cn=${chineseCount}(${(chineseRatio*100).toFixed(1)}%), en=${englishCount}(${(englishRatio*100).toFixed(1)}%)`);

    // Decide based on ratios.
    if (chineseRatio >= 0.1) {
      actualAnnotationMode = 'cn-to-en';
      debugLog('Mostly Chinese, select cn-to-en');
    } else if (englishRatio >= 0.9) {
      actualAnnotationMode = 'en-to-cn';
      debugLog('Mostly English, select en-to-cn');
    } else {
      // Mixed content: pick the dominant language.
      actualAnnotationMode = chineseRatio > englishRatio ? 'cn-to-en' : 'en-to-cn';
      debugLog('Mixed language, select', actualAnnotationMode);
    }
  } catch (error) {
    debugLog('Language detect failed:', error);
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

function resetLanguageDetectRetry() {
  if (languageDetectTimer) {
    clearTimeout(languageDetectTimer);
    languageDetectTimer = null;
  }
  languageDetectAttempts = 0;
}

function scheduleLanguageDetectRetry() {
  if (annotationMode !== 'auto') {
    return;
  }
  if (languageDetectDone) {
    return;
  }
  if (languageStats && languageStats.detected) {
    return;
  }
  if (languageDetectTimer) {
    return;
  }
  if (languageDetectAttempts >= LANGUAGE_DETECT_MAX_ATTEMPTS) {
    return;
  }
  languageDetectAttempts += 1;
  languageDetectTimer = setTimeout(async () => {
    languageDetectTimer = null;
    const modeChanged = detectPageLanguage();
    if (modeChanged) {
      await loadVocabularies();
      processedNodes = new WeakSet();
      resetProcessingQueue();
      if (document.body) {
        enqueueNode(document.body);
      }
    }
    if (!languageStats || !languageStats.detected) {
      scheduleLanguageDetectRetry();
    }
  }, LANGUAGE_DETECT_RETRY_MS);
}




// 开始处理

async function startProcessing() {

  debugLog('开始处理页面...');

  initialProcessingLogged = false;

  processedNodes = new WeakSet();

  resetDedupeState();

  resetProcessingQueue();
  resetLanguageDetectRetry();





  // 如果是auto模式，先检测语言

  if (annotationMode === 'auto') {

    detectPageLanguage();

    // 重新加载词库以使用检测到的模式

    await loadVocabularies();
    if (!languageStats || !languageStats.detected) {
      scheduleLanguageDetectRetry();
    }

  }



  // 等待 DOM 完全加载

  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', () => {

      debugLog('DOM 加载完成，开始处理');

      enqueueNode(document.body);

    });

  } else {

    enqueueNode(document.body);

  }



  // 监听 DOM 变化

  if (!window.vocabularyObserver) {

    window.vocabularyObserver = new MutationObserver((mutations) => {

      mutations.forEach((mutation) => {

        if (mutation.type === 'characterData') {
          // Text node updated in-place; allow reprocessing.
          processedNodes.delete(mutation.target);
          enqueueNode(mutation.target);
        }

        mutation.addedNodes.forEach((node) => {

          if (node.nodeType === Node.ELEMENT_NODE) {

            enqueueNode(node);

          }

        });
        if (annotationMode === 'auto' && (!languageStats || !languageStats.detected)) {
          scheduleLanguageDetectRetry();
        }
      });

    });



    window.vocabularyObserver.observe(document.body, {

      childList: true,

      subtree: true,

      characterData: true

    });

    debugLog('MutationObserver 已启动');

  }

}



// 停止处理

function stopProcessing() {

  debugLog('停止处理页面');

  resetProcessingQueue();

  if (window.vocabularyObserver) {

    window.vocabularyObserver.disconnect();

    window.vocabularyObserver = null;

  }

  if (globalTooltip) {

    if (globalTooltipHideTimer) {

      clearTimeout(globalTooltipHideTimer);

      globalTooltipHideTimer = null;

    }

    globalTooltip.remove();

    globalTooltip = null;

    globalTooltipOwner = null;

    isTooltipVisible = false;

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

    const text = el.textContent.replace(/\([^)]+\)$/, '');

    el.replaceWith(text);

  });

}



function resetDedupeState() {

  dedupeSeen.clear();

  if (dedupeMode !== 'count') {

    dedupeRemaining.clear();

  }

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



// 处理节点

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

    const result = await chrome.storage.local.get(['dedupeGlobalState']);

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

  chrome.storage.local.set({ dedupeGlobalState: { remainingByWord } }).catch(() => {});

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



// 中文分词算法 - 最大正向匹配（Maximum Forward Matching）



function normalizeMaxMatches(value) {

  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) {

    return Infinity;

  }

  return Math.max(1, Math.floor(num));

}



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

function isBlockDisplay(display) {
  return display === 'block' || display === 'flex' || display === 'grid' ||
    display === 'list-item' || display === 'table-cell';
}

function getNearestBlockContainer(textNode) {
  let container = textNode.parentElement;
  if (!container) {
    return null;
  }

  for (let i = 0; i < 6 && container; i++) {
    const style = window.getComputedStyle(container);
    if (isBlockDisplay(style.display)) {
      return container;
    }
    container = container.parentElement;
  }

  return null;
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

    return { r: 0, g: 0, b: 0, a: 0 };

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

    if (hex.length == 3) {

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

  if (index + 1 < text.length && isChinese(text[index + 1])) {

    return true;

  }

  return false;

}



function isChinese(char) {

  const code = char.charCodeAt(0);

  // 中文字符 Unicode 范围：4E00-9FFF

  return code >= 0x4E00 && code <= 0x9FFF;

}




function requestJiebaTokens(text) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve(null);
      return;
    }
    chrome.runtime.sendMessage({ type: 'jieba-tokenize', text }, (response) => {
      if (chrome.runtime.lastError) {
        debugLog('jieba tokenization failed:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      if (!response || !response.ok || !Array.isArray(response.tokens)) {
        resolve(null);
        return;
      }
      resolve(response.tokens);
    });
  });
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



// 检测添加标注是否会导致容器溢出

function wouldCauseOverflow(textNode) {

  try {

    // 找到最近的块级父容器

    let container = textNode.parentElement;

    if (!container) {

      return false;

    }



    // 向上查找，直到找到有尺寸限制的容器

    let checkElement = container;

    let foundConstrainedContainer = false;



    for (let i = 0; i < 5 && checkElement; i++) {

      const style = window.getComputedStyle(checkElement);



      // 检查是否有overflow隐藏或尺寸限制

      const hasOverflowHidden = style.overflow === 'hidden' ||

                                 style.overflowX === 'hidden' ||

                                 style.textOverflow === 'ellipsis';

      const hasFixedWidth = style.width && !style.width.includes('auto') &&

                           (style.maxWidth && !style.maxWidth.includes('none'));

      const hasWhiteSpaceNoWrap = style.whiteSpace === 'nowrap';



      if (hasOverflowHidden || hasFixedWidth || hasWhiteSpaceNoWrap) {

        container = checkElement;

        foundConstrainedContainer = true;

        break;

      }



      checkElement = checkElement.parentElement;

    }



    // 如果没有找到受限容器，不需要检查

    if (!foundConstrainedContainer) {

      return false;

    }



    const containerStyle = window.getComputedStyle(container);



    // 检查容器是否有严格的尺寸限制

    const hasStrictLimit =

      containerStyle.overflow === 'hidden' ||

      containerStyle.overflowX === 'hidden' ||

      containerStyle.textOverflow === 'ellipsis' ||

      containerStyle.whiteSpace === 'nowrap';



    if (!hasStrictLimit) {

      return false;

    }



    // 获取容器当前的尺寸使用情况

    const containerWidth = container.clientWidth;

    const scrollWidth = container.scrollWidth;



    // 如果已经溢出，不添加标注

    if (scrollWidth > containerWidth) {

      return true;

    }



    // 估算标注会增加的长度

    // 标注格式：原文(translation)，大约会增加原文50%-100%的长度

    const textLength = textNode.textContent.length;

    const estimatedIncrease = textLength * 0.5; // 保守估计增加50%



    // 计算增加后的预估宽度比例

    const usageRatio = scrollWidth / containerWidth;

    const estimatedNewRatio = (scrollWidth + estimatedIncrease * 8) / containerWidth; // 假设每个字符8px



    // 如果预估会超过容器宽度的95%，跳过标注

    if (estimatedNewRatio > 0.95) {

      return true;

    }



    return false;

  } catch (error) {

    // 出错时保守处理，不跳过

    debugLog('溢出检测出错:', error);

    return false;

  }

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

    if (textLength < minTextLength) {

      return false;

    }



    return true;

  } catch (error) {

    debugLog('最小字数检测出错:', error);

    return true; // 出错时允许标注

  }

}



// 处理文本节点

function processTextNode(textNode) {

  if (!textNode.textContent || textNode.textContent.trim().length === 0) {

    return;

  }



  // Ensure parent node exists.

  if (!textNode.parentNode) {

    return;

  }

  const blockGroupKey = getBlockGroupKey(textNode);
  if (getBlockQuotaRemaining(blockGroupKey) <= 0) {
    debugLog('Skipped annotation: block quota exhausted.');
    return;
  }



  const insideCooked = isInsideCooked(textNode);

  // Minimum length check.

  if (minTextLength > 0 && !insideCooked && !meetsMinTextLength(textNode)) {

    debugLog('Skipped annotation: container text below minimum length.');

    return;

  }



  if (!insideCooked && wouldCauseOverflow(textNode)) {

    debugLog('Skipped annotation: would cause overflow.');

    return;

  }



  const text = textNode.textContent;

  const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;



  if (effectiveMode === 'cn-to-en') {

    requestJiebaTokens(text).then((tokens) => {

      if (!textNode.parentNode || textNode.textContent !== text) {

        return;

      }
      const remainingQuota = getBlockQuotaRemaining(blockGroupKey);
      if (remainingQuota <= 0) {
        return;
      }

      const matches = [];

      if (tokens && tokens.length > 0) {

        tokens.forEach((token) => {

          if (vocabularyMap.has(token.word)) {

            const data = vocabularyMap.get(token.word);

            matches.push({

              start: token.start,

              end: token.end,

              matchText: token.word,

              data: data,

              priority: calculatePriority(token.word, data, token.start, text.length)

            });

          }

        });

      } else {

        // Fallback: use local segmentation when jieba tokens are unavailable.

        const segments = segmentChinese(text);

        segments.forEach((segment) => {

          if (!segment.isVocab) {

            return;

          }

          if (vocabularyMap.has(segment.text)) {

            const data = vocabularyMap.get(segment.text);

            matches.push({

              start: segment.start,

              end: segment.end,

              matchText: segment.text,

              data: data,

              priority: calculatePriority(segment.text, data, segment.start, text.length)

            });

          }

        });

      }

      const appliedCount = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
      consumeBlockQuota(blockGroupKey, appliedCount);

    });

    return;

  }



  if (effectiveMode === 'en-to-cn') {

    if (!EN_SEGMENTER) {

      debugLog('Intl.Segmenter unavailable; skipping segmentation.');

      return;

    }
    const remainingQuota = getBlockQuotaRemaining(blockGroupKey);
    if (remainingQuota <= 0) {
      return;
    }

    const matches = [];

    const segments = getWordSegments(text, EN_SEGMENTER);

    segments.forEach(segment => {

      const englishWord = segment.text.toLowerCase();

      if (EN_STOPWORDS.has(englishWord)) {

        return;

      }

      if (vocabularyMap.has(englishWord)) {

        const data = vocabularyMap.get(englishWord);

        matches.push({

          start: segment.start,

          end: segment.end,

          matchText: segment.text,

          data: data,

          priority: calculatePriority(segment.text, data, segment.start, text.length)

        });

      }

    });

    const appliedCount = applyMatchesToTextNode(textNode, text, matches, effectiveMode, remainingQuota);
    consumeBlockQuota(blockGroupKey, appliedCount);

  }

}



function applyMatchesToTextNode(textNode, text, matches, effectiveMode, maxCount = maxMatchesPerNode) {

  if (!matches || matches.length === 0) {

    return 0;

  }



  const selectedMatches = selectMatchesWithDistribution(matches, text.length, maxCount);

  if (selectedMatches.length === 0) {

    return 0;

  }



  const dedupedMatches = [];

  selectedMatches.forEach(match => {

    if (shouldAllowDedupeMatch(match.matchText, effectiveMode)) {

      dedupedMatches.push(match);

    }

  });



  if (dedupedMatches.length === 0) {

    return 0;

  }



  debugLog(`Found ${matches.length} matches; selected ${dedupedMatches.length}.`, dedupedMatches.map(m => m.matchText));



  dedupedMatches.sort((a, b) => a.start - b.start);



  const fragment = document.createDocumentFragment();

  let lastIndex = 0;



  dedupedMatches.forEach(match => {

    if (match.start > lastIndex) {

      fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));

    }

    const span = createHighlightSpan(match.matchText, match.data);

    fragment.appendChild(span);

    lastIndex = match.end;

  });



  if (lastIndex < text.length) {

    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));

  }



  try {

    if (textNode.parentNode) {

      textNode.parentNode.replaceChild(fragment, textNode);

      debugLog('Replaced text node with annotations.');

    }

  } catch (error) {

    console.error('Failed to replace text node:', error);

  }
  return dedupedMatches.length;

}



// 计算优先级分数（多维度）

function calculatePriority(matchText, dataList, position, textLength) {

  const firstData = dataList[0];



  // 1. 单词长度分数（长词优先）- 权重 40%

  const lengthScore = Math.min(firstData.wordLength / 15, 1) * 40;



  // 2. 位置分散度分数 - 权重 30%

  const positionRatio = position / textLength;

  // 中间位置的分数更高，避免全部集中在前面或后面

  const distributionScore = (1 - Math.abs(positionRatio - 0.5) * 2) * 30;



  // 3. 词汇复杂度分数 - 权重 30%

  // 基于单词长度和是否有短语

  const hasPhrasesBonus = (firstData.phrases && firstData.phrases.length > 0) ? 10 : 0;

  const complexityScore = Math.min((firstData.wordLength - 3) / 10 * 20, 20) + hasPhrasesBonus;



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

  const regions = Array.from({ length: regionCount }, () => []);



  // 将匹配分配到对应区域

  matches.forEach(match => {

    const regionIndex = Math.min(Math.floor(match.start / regionSize), regionCount - 1);

    regions[regionIndex].push(match);

  });



  // 从每个区域选择优先级最高的匹配

  let quotaPerRegion = Math.floor(maxCount / regionCount);

  let remainingQuota = maxCount - (quotaPerRegion * regionCount);



  regions.forEach((regionMatches, index) => {

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



// 创建高亮标注元素

function createHighlightSpan(matchText, dataList) {

  const span = document.createElement('span');

  span.className = 'vocab-highlight';



  const firstData = dataList[0];



  // 确定实际使用的标注模式

  const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;



  // 根据显示模式决定是否显示括号内容

  if (displayMode === 'underline') {

    // 下划线模式：只显示原文，不显示括号

    span.textContent = matchText;

  } else if (displayMode === 'annotation') {

    // 标注模式：显示原文和括号

    if (effectiveMode === 'cn-to-en') {

      const englishWord = firstData.word;

      span.textContent = `${matchText}(${englishWord})`;

    } else if (effectiveMode === 'en-to-cn') {

      const chineseText = firstData.allTranslations && firstData.allTranslations.length > 0

        ? firstData.allTranslations[0].translation

        : '';

      // 只显示第一个中文翻译（逗号或顿号之前的部分）

      const firstChinese = chineseText.split(/[,，、]/)[0].trim();

      span.textContent = `${matchText}(${firstChinese})`;

    }

  }



  const showTooltip = () => {

    if (globalTooltipHideTimer) {

      clearTimeout(globalTooltipHideTimer);

      globalTooltipHideTimer = null;

    }

    const tooltip = getGlobalTooltip();

    globalTooltipOwner = span;

    isHoveringHighlight = true;

    isHoveringTooltip = false;

    tooltip.innerHTML = `<button class="vocab-tooltip-close" type="button" aria-label="关闭">×</button><div class="vocab-tooltip-content">${createTooltipHTML(dataList, matchText)}</div>`;

    tooltip.style.display = 'block';

    tooltip.style.visibility = 'hidden';

    const contentDiv = tooltip.querySelector('.vocab-tooltip-content');

    if (contentDiv) {

      contentDiv.scrollTop = 0;

    }

    isTooltipVisible = true;

    positionTooltip(span, tooltip);

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



  span.addEventListener('mouseenter', showTooltip);

  span.addEventListener('mouseleave', () => {

    isHoveringHighlight = false;

    scheduleHide();

  });



  return span;

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

      if (target && target.classList && target.classList.contains('vocab-tooltip-close')) {

        hideGlobalTooltip(true);

      }

    });

    tooltipListenersAttached = true;

  }

  if (!pointerTrackerAttached) {

    document.addEventListener('mousemove', (event) => {

      lastPointerPosition = { x: event.clientX, y: event.clientY };



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

  if (!force && isElementHovered(globalTooltip)) {

    return;

  }

  if (!force && isPointerInsideTooltip()) {

    return;

  }

  globalTooltip.style.display = 'none';

  globalTooltip.style.visibility = '';

  isTooltipVisible = false;

  globalTooltipOwner = null;

  isHoveringHighlight = false;

  isHoveringTooltip = false;

}



function repositionGlobalTooltip() {

  if (!isTooltipVisible || !globalTooltip || !globalTooltipOwner) {

    return;

  }

  positionTooltip(globalTooltipOwner, globalTooltip);

}



function createTooltipHTML(dataList, matchText) {

  let tooltipHTML = '';



  // 确定实际使用的标注模式

  const effectiveMode = annotationMode === 'auto' ? actualAnnotationMode : annotationMode;



  dataList.forEach((data, index) => {

    if (index > 0) {

      tooltipHTML += '<hr class="vocab-divider">';

    }



    tooltipHTML += '<div class="vocab-item">';



    if (effectiveMode === 'cn-to-en') {

      tooltipHTML += `<div class="vocab-word">${data.word} ${data.type ? `<span class="vocab-type">${data.type}</span>` : ''}</div>`;



      if (data.allTranslations && data.allTranslations.length > 0) {

        tooltipHTML += '<div class="vocab-translations">';

        data.allTranslations.forEach(trans => {

          tooltipHTML += `<div>- ${trans.translation} <span class="vocab-type-small">${trans.type || ''}</span></div>`;

        });

        tooltipHTML += '</div>';

      }

    } else if (effectiveMode === 'en-to-cn') {

      tooltipHTML += `<div class="vocab-word">${data.word}</div>`;



      if (data.allTranslations && data.allTranslations.length > 0) {

        tooltipHTML += '<div class="vocab-translations">';

        data.allTranslations.forEach(trans => {

          tooltipHTML += `<div>- ${trans.translation} <span class="vocab-type-small">${trans.type || ''}</span></div>`;

        });

        tooltipHTML += '</div>';

      }

    }



    if (data.phrases && data.phrases.length > 0) {

      tooltipHTML += '<div class="vocab-phrases-title">常用短语</div>';

      tooltipHTML += '<div class="vocab-phrases">';

      data.phrases.forEach(phrase => {

        tooltipHTML += '<div class="vocab-phrase">';

        tooltipHTML += `<div class="vocab-phrase-text">${phrase.phrase}</div>`;

        if (phrase.translations && phrase.translations.length > 0) {

          tooltipHTML += `<div class="vocab-phrase-trans">${phrase.translations.join('；')}</div>`;

        }

        tooltipHTML += '</div>';

      });

      tooltipHTML += '</div>';

    }



    tooltipHTML += '</div>';

  });



  return tooltipHTML;

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



// 页面加载完成后的额外检查

window.addEventListener('load', () => {

  debugLog('页面完全加载完成');

  if (displayMode !== 'off' && vocabularyMap.size > 0) {

    debugLog('重新处理页面内容');

    processedNodes = new WeakSet();

    enqueueNode(document.body);

  }

});

