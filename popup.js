// popup.js - settings logic

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

  // 序列化为可存储的对象
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

document.addEventListener('DOMContentLoaded', async () => {
  const titleLink = document.getElementById('titleLink');
  if (titleLink) {
    titleLink.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://jieci.top' });
    });
  }
  const displayModeSlider = document.getElementById('displayModeSlider');
  const displayModeThumb = displayModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
  const displayModeLabels = displayModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');

  const annotationModeSlider = document.getElementById('annotationModeSlider');
  const annotationModeThumb = annotationModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
  const annotationModeLabels = annotationModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');

  const dedupeModeSlider = document.getElementById('dedupeModeSlider');
  const dedupeModeThumb = dedupeModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
  const dedupeModeLabels = dedupeModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');

  const advancedToggle = document.getElementById('advancedToggle');
  const vocabularyToggle = document.getElementById('vocabularyToggle');
  const vocabularyContent = document.getElementById('vocabularyContent');
  const pageMain = document.getElementById('pageMain');
  const pageVocab = document.getElementById('pageVocab');
  const pageAdvanced = document.getElementById('pageAdvanced');
  const pageStyle = document.getElementById('pageStyle');
  const pageAnnotation = document.getElementById('pageAnnotation');
  const pageAbout = document.getElementById('pageAbout');
  const vocabBack = document.getElementById('vocabBack');
  const advancedBack = document.getElementById('advancedBack');
  const styleNav = document.getElementById('styleNav');
  const annotationNav = document.getElementById('annotationNav');
  const aboutNav = document.getElementById('aboutNav');
  const styleBack = document.getElementById('styleBack');
  const annotationBack = document.getElementById('annotationBack');
  const aboutBack = document.getElementById('aboutBack');
  const aboutVersion = document.getElementById('aboutVersion');
  const oobe = document.getElementById('oobe');
  const oobeNext1 = document.getElementById('oobeNext1');
  const oobeNext2 = document.getElementById('oobeNext2');
  const oobeOpenDownload = document.getElementById('oobeOpenDownload');
  const oobeGoExample = document.getElementById('oobeGoExample');
  const oobeSkip = document.getElementById('oobeSkip');
  const oobeSteps = Array.from(document.querySelectorAll('.oobe-step'));
  const oobeTitle1 = document.getElementById('oobeTitle1');
  const oobeText1 = document.getElementById('oobeText1');
  const oobeTitle2 = document.getElementById('oobeTitle2');
  const oobeText2 = document.getElementById('oobeText2');
  const oobeTitle3 = document.getElementById('oobeTitle3');
  const oobeText3 = document.getElementById('oobeText3');
  const oobeVocabList = document.getElementById('oobeVocabList');
  const oobeVocabEmpty = document.getElementById('oobeVocabEmpty');

  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');
  const importStatus = document.getElementById('importStatus');
  const filesList = document.getElementById('filesList');
  const fileCount = document.getElementById('fileCount');
  const totalWords = document.getElementById('totalWords');
  const maxMatchesSlider = document.getElementById('maxMatchesSlider');
  const maxMatchesLabel = document.getElementById('maxMatchesLabel');
  const maxMatchesInput = document.getElementById('maxMatchesInput');
  const minTextLengthSlider = document.getElementById('minTextLength');
  const minTextLengthLabel = document.getElementById('minTextLengthLabel');
  const dedupeRepeatCountSlider = document.getElementById('dedupeRepeatCount');
  const dedupeRepeatCountLabel = document.getElementById('dedupeRepeatCountLabel');
  const clearDedupeCountsButton = document.getElementById('clearDedupeCounts');
  const highlightModeSelect = document.getElementById('highlightMode');
  const highlightColorInput = document.getElementById('highlightColor');
  const smartSkipCodeLinksToggle = document.getElementById('smartSkipCodeLinks');
  const resetPopupSizeButton = document.getElementById('resetPopupSize');
  const resetPopupSizeStatus = document.getElementById('resetPopupSizeStatus');

  // 下载相关元素
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadModal = document.getElementById('downloadModal');
  const modalClose = document.getElementById('modalClose');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const dictList = document.getElementById('dictList');
  const downloadProgress = document.getElementById('downloadProgress');
  const downloadingDict = document.getElementById('downloadingDict');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');

  const SERVER_URL = 'https://api.jieci.top';
  const TOOLTIP_SIZE_STORAGE_KEY = 'tooltipSize';
  const OOBE_COMPLETION_KEY = 'oobeCompletedCount';
  const OOBE_STEP_KEY = 'oobeStep';
  const OOBE_REQUIRED_COUNT = 1;

  const scheduleOverflowUpdate = () => {
    requestAnimationFrame(() => {
      const viewportHeight = document.documentElement.clientHeight;
      const contentHeight = document.body.scrollHeight;
      document.body.style.overflowY = contentHeight > viewportHeight ? 'auto' : 'hidden';
    });
  };

  const helpIcons = document.querySelectorAll('.help-icon');

  const updateHelpTooltipPosition = (icon) => {
    const tooltip = icon.querySelector('.help-tooltip');
    if (!tooltip) {
      return;
    }
    const iconRect = icon.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 8;
    const spaceBelow = window.innerHeight - iconRect.bottom;
    const spaceAbove = iconRect.top;
    let top;
    if (spaceBelow < tooltipRect.height + padding && spaceAbove > spaceBelow) {
      top = iconRect.top - tooltipRect.height - 6;
    } else {
      top = iconRect.bottom + 6;
    }
    let left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - padding - tooltipRect.width));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  };

  const showHelpTooltip = (icon) => {
    icon.classList.add('is-visible');
    requestAnimationFrame(() => updateHelpTooltipPosition(icon));
  };

  const hideHelpTooltip = (icon) => {
    icon.classList.remove('is-visible');
    icon.classList.remove('tooltip-up');
  };

  helpIcons.forEach((icon) => {
    icon.addEventListener('mouseenter', () => showHelpTooltip(icon));
    icon.addEventListener('mouseleave', () => hideHelpTooltip(icon));
    icon.addEventListener('focusin', () => showHelpTooltip(icon));
    icon.addEventListener('focusout', () => hideHelpTooltip(icon));
    icon.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  window.addEventListener('resize', scheduleOverflowUpdate);

  const pages = [pageMain, pageVocab, pageAdvanced, pageStyle, pageAnnotation, pageAbout];
  const showPage = (page) => {
    pages.forEach((item) => {
      if (!item) {
        return;
      }
      item.classList.toggle('is-active', item === page);
    });
    scheduleOverflowUpdate();
  };

  if (aboutVersion && chrome.runtime?.getManifest) {
    aboutVersion.textContent = chrome.runtime.getManifest().version || '-';
  }

  if (oobeTitle1) {
    oobeTitle1.textContent = 'Hello 你好 ⌯･ᴗ･⌯';
  }
  if (oobeText1) {
    oobeText1.textContent = '欢迎使用本插件。本插件通过将您浏览的网页中的单词标注为对应的外语单词，让您在日常阅读中看到更多的外语，记住更多的单词！';
  }
  if (oobeNext1) {
    oobeNext1.textContent = '让我们开始吧';
  }
  if (oobeTitle2) {
    oobeTitle2.textContent = '让我们决定下要背的单词吧';
  }
  if (oobeText2) {
    oobeText2.textContent = '点击下载词库，选择您想要背诵的单词列表。我们会依照这个词库里头的词，在网页上进行对应的标注。您可以后续在插件中添加或者删除词库。';
  }
  if (oobeOpenDownload) {
    oobeOpenDownload.textContent = '让我看看（下载词库）';
  }
  if (oobeNext2) {
    oobeNext2.textContent = '我选好了，下一步';
  }
  if (oobeTitle3) {
    oobeTitle3.textContent = '大功告成！感谢您的使用';
  }
  if (oobeText3) {
    oobeText3.textContent = '您可以前往我们的实例页面，看下插件工作的怎么样。如果您在使用的时候有任何问题，请一定要跟我们反馈哦~';
  }
  if (oobeGoExample) {
    oobeGoExample.textContent = '带我去示例页面看看';
  }
  if (oobeSkip) {
    oobeSkip.textContent = '谢了~暂时不必';
  }


  const showOobeStep = (step) => {
    oobeSteps.forEach((item) => {
      if (!item) {
        return;
      }
      const isActive = item.dataset.step === String(step);
      item.classList.toggle('is-active', isActive);
    });
    chrome.storage.local.set({ [OOBE_STEP_KEY]: step }).catch(() => {});
  };

  const setOobeVisible = (visible) => {
    if (!oobe) {
      return;
    }
    oobe.classList.toggle('is-hidden', !visible);
  };

  const updateOobeVocabList = (vocabList) => {
    if (!oobeVocabList || !oobeVocabEmpty) {
      return;
    }
    oobeVocabList.replaceChildren();
    const items = Array.isArray(vocabList) ? vocabList : [];
    if (items.length === 0) {
      oobeVocabEmpty.style.display = 'block';
      return;
    }
    oobeVocabEmpty.style.display = 'none';
    items.forEach((vocab) => {
      const item = document.createElement('div');
      item.className = 'oobe-vocab-item';
      item.textContent = vocab && vocab.name ? vocab.name : '未命名词库';
      oobeVocabList.appendChild(item);
    });
  };

  const markOobeCompleted = async () => {
    const result = await chrome.storage.local.get(OOBE_COMPLETION_KEY);
    const current = Number.isFinite(result[OOBE_COMPLETION_KEY])
      ? result[OOBE_COMPLETION_KEY]
      : 0;
    const next = Math.min(OOBE_REQUIRED_COUNT, current + 1);
    await chrome.storage.local.set({ [OOBE_COMPLETION_KEY]: next });
    await chrome.storage.local.remove(OOBE_STEP_KEY);
    setOobeVisible(false);
    showPage(pageMain);
  };


  const getActiveTabs = async () => {
    return chrome.tabs.query({ active: true, currentWindow: true });
  };

  const notifyActiveTabs = async (message, reload = true) => {
    const tabs = await getActiveTabs();
    tabs.forEach(tab => {
      if (tab.id == null) {
        return;
      }
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });

    if (!reload) {
      return;
    }

    tabs.forEach(tab => {
      if (tab.id == null) {
        return;
      }
      chrome.tabs.reload(tab.id, {}, () => {});
    });
  };

  // 显示模式值映射
  const displayModeMap = {
    0: 'off',
    1: 'underline',
    2: 'annotation'
  };

  const reverseDisplayModeMap = {
    'off': 0,
    'underline': 1,
    'annotation': 2
  };

  // 标注模式值映射
  const annotationModeMap = {
    0: 'cn-to-en',
    1: 'auto',
    2: 'en-to-cn'
  };

  const reverseAnnotationModeMap = {
    'cn-to-en': 0,
    'auto': 1,
    'en-to-cn': 2
  };

  const dedupeModeMap = {
    0: 'off',
    1: 'page',
    2: 'count'
  };

  const reverseDedupeModeMap = {
    'off': 0,
    'page': 1,
    'count': 2
  };

  if (vocabularyContent) {
    vocabularyContent.style.display = 'block';
  }
  showPage(pageMain);

  if (vocabularyToggle) {
    vocabularyToggle.addEventListener('click', () => showPage(pageVocab));
  }
  if (advancedToggle) {
    advancedToggle.addEventListener('click', () => showPage(pageAdvanced));
  }
  if (styleNav) {
    styleNav.addEventListener('click', () => showPage(pageStyle));
  }
  if (annotationNav) {
    annotationNav.addEventListener('click', () => showPage(pageAnnotation));
  }
  if (aboutNav) {
    aboutNav.addEventListener('click', () => showPage(pageAbout));
  }
  if (vocabBack) {
    vocabBack.addEventListener('click', () => showPage(pageMain));
  }
  if (advancedBack) {
    advancedBack.addEventListener('click', () => showPage(pageMain));
  }
  if (styleBack) {
    styleBack.addEventListener('click', () => showPage(pageAdvanced));
  }
  if (annotationBack) {
    annotationBack.addEventListener('click', () => showPage(pageAdvanced));
  }
  if (aboutBack) {
    aboutBack.addEventListener('click', () => showPage(pageAdvanced));
  }

  if (oobeNext1) {
    oobeNext1.addEventListener('click', () => showOobeStep(2));
  }
  if (oobeOpenDownload) {
    oobeOpenDownload.addEventListener('click', () => openDownloadModal());
  }
  if (oobeNext2) {
    oobeNext2.addEventListener('click', () => showOobeStep(3));
  }
  if (oobeGoExample) {
    oobeGoExample.addEventListener('click', async () => {
      chrome.tabs.create({ url: 'https://jieci.top/testplugin.html' });
      await markOobeCompleted();
    });
  }
  if (oobeSkip) {
    oobeSkip.addEventListener('click', async () => {
      await markOobeCompleted();
    });
  }

  // 更新显示模式滑块位置和标签状态
  function updateDisplayModeSliderUI(value) {
    const percentage = (value / 2) * 100;
    displayModeThumb.style.left = `${percentage * 0.6667}%`;

    displayModeLabels.forEach((label, index) => {
      if (index === parseInt(value)) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  // 更新标注模式滑块位置和标签状态
  function updateAnnotationModeSliderUI(value) {
    const percentage = (value / 2) * 100;
    annotationModeThumb.style.left = `${percentage * 0.6667}%`;

    annotationModeLabels.forEach((label, index) => {
      if (index === parseInt(value)) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  function updateDedupeModeSliderUI(value) {
    const percentage = (value / 2) * 100;
    dedupeModeThumb.style.left = `${percentage * 0.6667}%`;

    dedupeModeLabels.forEach((label, index) => {
      if (index === parseInt(value)) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  // 监听显示模式滑动条变化
  displayModeSlider.addEventListener('input', async () => {
    const value = parseInt(displayModeSlider.value);
    const mode = displayModeMap[value];

    updateDisplayModeSliderUI(value);

    await chrome.storage.local.set({ displayMode: mode });

    await notifyActiveTabs({
      action: 'updateDisplayMode',
      mode: mode
    });
  });

  displayModeLabels.forEach((label, index) => {
    label.addEventListener('click', () => {
      displayModeSlider.value = index;
      displayModeSlider.dispatchEvent(new Event('input'));
    });
  });

  // 监听标注模式滑动条变化
  annotationModeSlider.addEventListener('input', async () => {
    const value = parseInt(annotationModeSlider.value);
    const mode = annotationModeMap[value];

    updateAnnotationModeSliderUI(value);

    await chrome.storage.local.set({ annotationMode: mode });

    await notifyActiveTabs({
      action: 'updateMode',
      mode: mode
    });
  });

  annotationModeLabels.forEach((label, index) => {
    label.addEventListener('click', () => {
      annotationModeSlider.value = index;
      annotationModeSlider.dispatchEvent(new Event('input'));
    });
  });

  // 监听智能去重滑动条变化
  dedupeModeSlider.addEventListener('input', async () => {
    const value = parseInt(dedupeModeSlider.value);
    const mode = dedupeModeMap[value];

    updateDedupeModeSliderUI(value);

    await chrome.storage.local.set({ dedupeMode: mode });

    await notifyActiveTabs({
      action: 'updateDedupeMode',
      mode: mode
    });
  });

  dedupeModeLabels.forEach((label, index) => {
    label.addEventListener('click', () => {
      dedupeModeSlider.value = index;
      dedupeModeSlider.dispatchEvent(new Event('input'));
    });
  });

  const sliderMax = parseInt(maxMatchesSlider.max, 10);
  const updateMaxMatchesUI = (value) => {
    const isUnlimited = !Number.isFinite(value) || value <= 0;
    maxMatchesLabel.textContent = isUnlimited ? '\u65e0\u9650' : String(value);
    maxMatchesInput.value = isUnlimited ? 0 : value;

    if (isUnlimited) {
      maxMatchesSlider.value = sliderMax;
      return;
    }

    if (value >= sliderMax) {
      maxMatchesSlider.value = sliderMax - 1;
    } else {
      maxMatchesSlider.value = Math.max(1, value);
    }
  };

  const saveMaxMatches = async (value) => {
    const maxMatches = (!Number.isFinite(value) || value <= 0) ? 0 : Math.max(1, Math.floor(value));
    updateMaxMatchesUI(maxMatches);

    await chrome.storage.local.set({ maxMatchesPerNode: maxMatches });

    await notifyActiveTabs({
      action: 'updateMaxMatches',
      maxMatches: maxMatches
    });
  };

  maxMatchesSlider.addEventListener('input', () => {
    const rawValue = parseInt(maxMatchesSlider.value, 10);
    const maxMatches = rawValue >= sliderMax ? 0 : rawValue;
    saveMaxMatches(maxMatches);
  });

  maxMatchesInput.addEventListener('change', () => {
    const inputValue = parseInt(maxMatchesInput.value, 10);
    const maxMatches = Number.isFinite(inputValue) ? inputValue : 0;
    saveMaxMatches(maxMatches);
  });

  minTextLengthSlider.addEventListener('input', async () => {
    const rawLength = parseInt(minTextLengthSlider.value, 10) || 0;
    const minLength = Math.max(5, rawLength);
    minTextLengthLabel.textContent = minLength;
    await chrome.storage.local.set({ minTextLength: minLength });

    await notifyActiveTabs({
      action: 'updateMinTextLength',
      minLength: minLength
    });
  });

  dedupeRepeatCountSlider.addEventListener('input', async () => {
    const repeatCount = parseInt(dedupeRepeatCountSlider.value, 10) || 10;
    dedupeRepeatCountLabel.textContent = repeatCount;
    await chrome.storage.local.set({ dedupeRepeatCount: repeatCount });

    await notifyActiveTabs({
      action: 'updateDedupeRepeatCount',
      repeatCount: repeatCount
    });
  });

  clearDedupeCountsButton.addEventListener('click', async () => {
    const originalText = clearDedupeCountsButton.textContent;
    clearDedupeCountsButton.disabled = true;
    clearDedupeCountsButton.textContent = '删除中...';
    try {
      await chrome.storage.local.remove('dedupeGlobalState');
      await notifyActiveTabs({
        action: 'clearDedupeCounts'
      });
      clearDedupeCountsButton.textContent = '已删除';
      setTimeout(() => {
        clearDedupeCountsButton.textContent = originalText || '删除';
        clearDedupeCountsButton.disabled = false;
      }, 1500);
    } catch (error) {
      clearDedupeCountsButton.textContent = originalText || '删除';
      clearDedupeCountsButton.disabled = false;
    }
  });

  smartSkipCodeLinksToggle.addEventListener('change', async () => {
    const enabled = smartSkipCodeLinksToggle.checked;
    await chrome.storage.local.set({ smartSkipCodeLinks: enabled });

    await notifyActiveTabs({
      action: 'updateSmartSkipCodeLinks',
      enabled: enabled
    });
  });

  const debugModeToggle = document.getElementById('debugMode');
  debugModeToggle.addEventListener('change', async () => {
    const enabled = debugModeToggle.checked;
    await chrome.storage.local.set({ debugMode: enabled });

    await notifyActiveTabs({
      action: 'updateDebugMode',
      enabled: enabled
    });
  });
  if (resetPopupSizeButton) {
    resetPopupSizeButton.addEventListener('click', async () => {
      const originalText = resetPopupSizeButton.textContent;
      await chrome.storage.local.remove(TOOLTIP_SIZE_STORAGE_KEY);
      await notifyActiveTabs({ action: 'resetTooltipSize' }, false);
      if (resetPopupSizeButton) {
        resetPopupSizeButton.textContent = '已重置';
        resetPopupSizeButton.disabled = true;
        setTimeout(() => {
          resetPopupSizeButton.textContent = originalText || '重置';
          resetPopupSizeButton.disabled = false;
        }, 1500);
      }
    });
  }

  const updateHighlightControls = (mode) => {
    highlightColorInput.disabled = mode !== 'custom';
  };

  const saveHighlightSettings = async (mode, color) => {
    const settings = {
      highlightColorMode: mode,
      highlightColor: color
    };
    await chrome.storage.local.set(settings);

    await notifyActiveTabs({
      action: 'updateHighlightColor',
      mode: mode,
      color: color
    });
  };

  await loadSettings();

  highlightModeSelect.addEventListener('change', () => {
    const mode = highlightModeSelect.value;
    updateHighlightControls(mode);
    saveHighlightSettings(mode, highlightColorInput.value);
  });

  highlightColorInput.addEventListener('change', () => {
    saveHighlightSettings(highlightModeSelect.value, highlightColorInput.value);
  });

  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // 下载按钮点击
  downloadBtn.addEventListener('click', async () => {
    openDownloadModal();
  });

  // 关闭模态框
  modalClose.addEventListener('click', () => {
    closeDownloadModal();
  });

  // 点击模态框背景关闭
  downloadModal.addEventListener('click', (e) => {
    if (e.target === downloadModal) {
      closeDownloadModal();
    }
  });

  // 打开下载模态框
  async function openDownloadModal() {
    downloadModal.classList.add('show');
    loadingSpinner.style.display = 'block';
    dictList.style.display = 'none';
    dictList.classList.remove('show');
    downloadProgress.style.display = 'none';

    try {
      const response = await fetch(`${SERVER_URL}/dict/index.json`);
      if (!response.ok) {
        throw new Error('获取词库列表失败');
      }
      const dictionaries = await response.json();

      loadingSpinner.style.display = 'none';
      displayDictList(dictionaries);
    } catch (error) {
      loadingSpinner.textContent = '加载失败: ' + error.message;
      console.error('获取词库列表失败:', error);
    }
  }

  // 关闭下载模态框
  function closeDownloadModal() {
    downloadModal.classList.remove('show');
  }

  // 显示词库列表
  function displayDictList(dictionaries) {
    dictList.innerHTML = '';

    if (!Array.isArray(dictionaries) || dictionaries.length === 0) {
      dictList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无可用词库</div>';
      dictList.style.display = 'block';
      dictList.classList.add('show');
      return;
    }

    dictionaries.forEach(dict => {
      const dictItem = document.createElement('div');
      dictItem.className = 'dict-item';
      const dictName = document.createElement('div');
      dictName.className = 'dict-name';
      dictName.textContent = dict.name || '未命名词库';
      const dictInfo = document.createElement('div');
      dictInfo.className = 'dict-info';
      const dictCount = document.createElement('span');
      dictCount.textContent = `词条数: ${dict.wordCount || 0}`;
      const dictSize = document.createElement('span');
      dictSize.className = 'dict-size';
      dictSize.textContent = formatFileSize(dict.size || 0);
      dictInfo.appendChild(dictCount);
      dictInfo.appendChild(dictSize);
      dictItem.appendChild(dictName);
      dictItem.appendChild(dictInfo);

      dictItem.addEventListener('click', () => {
        downloadDictionary(dict);
      });

      dictList.appendChild(dictItem);
    });

    dictList.style.display = 'block';
    dictList.classList.add('show');
  }

  // 下载词库
  async function downloadDictionary(dict) {
    dictList.style.display = 'none';
    downloadProgress.style.display = 'block';
    downloadingDict.textContent = `正在下载: ${dict.name}`;
    progressPercent.textContent = '0%';
    progressBar.style.width = '0%';

    try {
      const vocabularies = await chrome.storage.local.get('vocabularies') || {};
      const vocabList = vocabularies.vocabularies || [];
      const dictName = (dict.name || '').trim();
      if (dictName && vocabList.some(vocab => (vocab.name || '').trim() === dictName)) {
        downloadingDict.textContent = '抱歉，已经有一个同名词库了，您可以删除本地词库，再重新进行下载';
        progressPercent.textContent = '';
        setTimeout(() => {
          closeDownloadModal();
        }, 2000);
        return;
      }

      const url = `${SERVER_URL}/dict/${dict.filename || dict.name}`;

      // 使用XMLHttpRequest以支持进度跟踪
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';
      let lastPercent = 0;


      xhr.onprogress = (event) => {
        const total = event.lengthComputable ? event.total : (dict.size || 0);
        if (total > 0) {
          const rawPercent = Math.round((event.loaded / total) * 100);
          const percent = Math.min(99, Math.max(0, rawPercent));
          if (percent > lastPercent) {
            lastPercent = percent;
            progressPercent.textContent = `${percent}%`;
            progressBar.style.width = `${percent}%`;
          }
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);

            if (!Array.isArray(data)) {
              throw new Error('词库格式不正确');
            }

            // 导入词库
            const vocabularies = await chrome.storage.local.get('vocabularies') || {};
            let vocabList = vocabularies.vocabularies || [];

            vocabList.push({
              id: generateId(),
              name: dict.name,
              uploadTime: new Date().toISOString(),
              wordCount: data.length,
              data: data
            });

            await chrome.storage.local.set({ vocabularies: vocabList });

            // 构建并缓存Trie树索引
            console.log('构建Trie树索引...');
            const trieIndex = buildChineseTrieIndex(vocabList);
            await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
            console.log('Trie树索引构建完成');

            progressPercent.textContent = '100%';
            progressBar.style.width = '100%';

            setTimeout(() => {
              closeDownloadModal();
              loadSettings();
              notifyContentScripts();
              importStatus.textContent = `成功下载并导入 ${dict.name}`;
              importStatus.className = 'import-status success';
              setTimeout(() => {
                importStatus.textContent = '';
              }, 3000);
            }, 500);

          } catch (error) {
            throw new Error('词库解析失败: ' + error.message);
          }
        } else {
          throw new Error(`下载失败 (HTTP ${xhr.status})`);
        }
      };

      xhr.onerror = () => {
        downloadingDict.textContent = '下载失败，请检查网络连接';
        progressPercent.textContent = '';
        setTimeout(() => {
          closeDownloadModal();
        }, 2000);
      };

      xhr.send();

    } catch (error) {
      downloadingDict.textContent = '下载失败: ' + error.message;
      progressPercent.textContent = '';
      console.error('下载词库失败:', error);
      setTimeout(() => {
        closeDownloadModal();
      }, 2000);
    }
  }

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // 格式化下载速度

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    importStatus.textContent = '导入中...';
    importStatus.className = 'import-status importing';

    try {
      const vocabularies = await chrome.storage.local.get('vocabularies') || {};
      let vocabList = vocabularies.vocabularies || [];

      for (const file of files) {
        const content = await readFileAsText(file);
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          throw new Error(file.name + ' 格式不正确');
        }

        vocabList.push({
          id: generateId(),
          name: file.name,
          uploadTime: new Date().toISOString(),
          wordCount: data.length,
          data: data
        });
      }

      await chrome.storage.local.set({ vocabularies: vocabList });

      // 构建并缓存Trie树索引（中文->英文模式）
      console.log('构建Trie树索引...');
      const trieIndex = buildChineseTrieIndex(vocabList);
      await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
      console.log('Trie树索引构建完成并已缓存');

      importStatus.textContent = '导入成功' + files.length + '一份';
      importStatus.className = 'import-status success';

      await loadSettings();

      notifyContentScripts();

      setTimeout(() => {
        importStatus.textContent = '';
      }, 3000);

    } catch (error) {
      importStatus.textContent = '导入失败: ' + error.message;
      importStatus.className = 'import-status error';
    }

    fileInput.value = '';
  });

  async function loadSettings() {
    const result = await chrome.storage.local.get([
      'displayMode',
      'vocabularies',
      'maxMatchesPerNode',
      'minTextLength',
      'annotationMode',
      'highlightColorMode',
      'highlightColor',
      'smartSkipCodeLinks',
      'dedupeMode',
      'dedupeRepeatCount',
      'dedupeCooldownSeconds',
      'debugMode',
      OOBE_COMPLETION_KEY,
      OOBE_STEP_KEY
    ]);
    const displayMode = result.displayMode || 'off';
    const vocabList = result.vocabularies || [];
    const maxMatches = (typeof result.maxMatchesPerNode === 'number') ? result.maxMatchesPerNode : 3;
    const storedMinLength = (typeof result.minTextLength === 'number') ? result.minTextLength : 5;
    const minLength = Math.max(5, storedMinLength);
    const annotationMode = result.annotationMode || 'auto';
    const highlightMode = result.highlightColorMode || 'none';
    const highlightColor = result.highlightColor || '#2196f3';
    const smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
    const debugMode = result.debugMode === true;
    let dedupeMode = result.dedupeMode || 'page';
    if (dedupeMode === 'cooldown') {
      dedupeMode = 'count';
    }
    const dedupeRepeatCount = (typeof result.dedupeRepeatCount === 'number')
      ? result.dedupeRepeatCount
      : ((typeof result.dedupeCooldownSeconds === 'number') ? result.dedupeCooldownSeconds : 50);

    // 设置显示模式滑块位置
    const displaySliderValue = displayMode in reverseDisplayModeMap ? reverseDisplayModeMap[displayMode] : 0;
    displayModeSlider.value = displaySliderValue;
    updateDisplayModeSliderUI(displaySliderValue);

    // 设置标注模式滑块位置
    const annotationSliderValue = annotationMode in reverseAnnotationModeMap ? reverseAnnotationModeMap[annotationMode] : 0;
    annotationModeSlider.value = annotationSliderValue;
    updateAnnotationModeSliderUI(annotationSliderValue);

    const dedupeSliderValue = dedupeMode in reverseDedupeModeMap ? reverseDedupeModeMap[dedupeMode] : 1;
    dedupeModeSlider.value = dedupeSliderValue;
    updateDedupeModeSliderUI(dedupeSliderValue);

    updateMaxMatchesUI(maxMatches);
    minTextLengthSlider.value = minLength;
    minTextLengthLabel.textContent = minLength;
    if (storedMinLength < 5) {
      await chrome.storage.local.set({ minTextLength: minLength });
      await notifyActiveTabs({
        action: 'updateMinTextLength',
        minLength: minLength
      });
    }
    dedupeRepeatCountSlider.value = dedupeRepeatCount;
    dedupeRepeatCountLabel.textContent = dedupeRepeatCount;
    highlightModeSelect.value = highlightMode;
    highlightColorInput.value = highlightColor;
    updateHighlightControls(highlightMode);
    smartSkipCodeLinksToggle.checked = smartSkipCodeLinks;
    debugModeToggle.checked = debugMode;
    displayFilesList(vocabList);
    updateStats(vocabList);
    updateOobeVocabList(vocabList);
    const completionCount = Number.isFinite(result[OOBE_COMPLETION_KEY])
      ? result[OOBE_COMPLETION_KEY]
      : 0;
    const shouldShowOobe = completionCount < OOBE_REQUIRED_COUNT;
    setOobeVisible(shouldShowOobe);
    if (shouldShowOobe) {
      const storedStep = Number.isFinite(result[OOBE_STEP_KEY])
        ? result[OOBE_STEP_KEY]
        : 1;
      const step = Math.min(3, Math.max(1, storedStep));
      showOobeStep(step);
    }
    scheduleOverflowUpdate();
  }

  function displayFilesList(vocabList) {
    fileCount.textContent = vocabList.length;
    filesList.innerHTML = '';

    if (vocabList.length === 0) {
      filesList.innerHTML = '<div class="empty-state">暂无导入的词库文件</div>';
      return;
    }

    vocabList.forEach(vocab => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = vocab.name || '未命名词库';
      const fileMeta = document.createElement('div');
      fileMeta.className = 'file-meta';
      fileMeta.textContent = `词条数: ${vocab.wordCount} | 导入时间: ${formatDate(vocab.uploadTime)}`;
      const deleteButton = document.createElement('button');
      deleteButton.className = 'btn btn-delete';
      deleteButton.dataset.id = vocab.id;
      deleteButton.textContent = '删除';
      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileMeta);
      fileItem.appendChild(fileInfo);
      fileItem.appendChild(deleteButton);
      deleteButton.addEventListener('click', async () => {
        deleteButton.disabled = true;
        deleteButton.textContent = '删除中...';
        try {
          await deleteVocabulary(vocab.id);
        } catch (error) {
          deleteButton.disabled = false;
          deleteButton.textContent = '删除';
          importStatus.textContent = '删除失败: ' + error.message;
          importStatus.className = 'import-status error';
        }
      });

      filesList.appendChild(fileItem);
    });
  }

  async function deleteVocabulary(id) {
    const result = await chrome.storage.local.get('vocabularies');
    let vocabList = result.vocabularies || [];
    vocabList = vocabList.filter(v => v.id !== id);

    await chrome.storage.local.set({ vocabularies: vocabList });

    // 重新构建Trie树索引
    if (vocabList.length > 0) {
      const trieIndex = buildChineseTrieIndex(vocabList);
      await chrome.storage.local.set({ vocabularyTrieIndex: trieIndex });
    } else {
      // 如果没有词库了，清空索引
      await chrome.storage.local.remove('vocabularyTrieIndex');
    }

    await loadSettings();

    notifyContentScripts();
  }

  function updateStats(vocabList) {
    const total = vocabList.reduce((sum, vocab) => sum + vocab.wordCount, 0);
    totalWords.textContent = total;
  }

  async function notifyContentScripts() {
    await notifyActiveTabs({
      action: 'reloadVocabularies'
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
});
