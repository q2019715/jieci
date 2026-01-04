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
  const advancedContent = document.getElementById('advancedContent');
  const toggleIcon = advancedToggle.querySelector('.toggle-icon');

  const vocabularyToggle = document.getElementById('vocabularyToggle');
  const vocabularyContent = document.getElementById('vocabularyContent');
  const vocabularyToggleIcon = vocabularyToggle.querySelector('.toggle-icon');

  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');
  const importStatus = document.getElementById('importStatus');
  const filesList = document.getElementById('filesList');
  const fileCount = document.getElementById('fileCount');
  const totalWords = document.getElementById('totalWords');
  const languageRatioRow = document.getElementById('languageRatioRow');
  const languageRatioRowEn = document.getElementById('languageRatioRowEn');
  const chineseRatio = document.getElementById('chineseRatio');
  const englishRatio = document.getElementById('englishRatio');
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

  // 加载高级设置折叠状态（默认折叠）
  const advancedCollapsed = localStorage.getItem('advancedCollapsed') !== 'false';
  if (advancedCollapsed) {
    advancedContent.style.display = 'none';
    toggleIcon.textContent = '▶';
  }

  // 加载词库管理折叠状态（默认折叠）
  const vocabularyCollapsed = localStorage.getItem('vocabularyCollapsed') !== 'false';
  if (vocabularyCollapsed) {
    vocabularyContent.style.display = 'none';
    vocabularyToggleIcon.textContent = '▶';
  }

  // 高级设置折叠切换
  advancedToggle.addEventListener('click', () => {
    const isCollapsed = advancedContent.style.display === 'none';
    advancedContent.style.display = isCollapsed ? 'block' : 'none';
    toggleIcon.textContent = isCollapsed ? '▼' : '▶';
    localStorage.setItem('advancedCollapsed', !isCollapsed);
  });

  // 词库管理折叠切换
  vocabularyToggle.addEventListener('click', () => {
    const isCollapsed = vocabularyContent.style.display === 'none';
    vocabularyContent.style.display = isCollapsed ? 'block' : 'none';
    vocabularyToggleIcon.textContent = isCollapsed ? '▼' : '▶';
    localStorage.setItem('vocabularyCollapsed', !isCollapsed);
  });

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
    updateLanguageStats(mode);

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
    const minLength = parseInt(minTextLengthSlider.value, 10) || 0;
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
    await chrome.storage.local.remove('dedupeGlobalState');

    await notifyActiveTabs({
      action: 'clearDedupeCounts'
    });
  });

  smartSkipCodeLinksToggle.addEventListener('change', async () => {
    const enabled = smartSkipCodeLinksToggle.checked;
    await chrome.storage.local.set({ smartSkipCodeLinks: enabled });

    await notifyActiveTabs({
      action: 'updateSmartSkipCodeLinks',
      enabled: enabled
    });
  });

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
      dictItem.innerHTML = `
        <div class="dict-name">${dict.name || '未命名词库'}</div>
        <div class="dict-info">
          <span>词条数: ${dict.wordCount || 0}</span>
          <span class="dict-size">${formatFileSize(dict.size || 0)}</span>
        </div>
      `;

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
      const url = `${SERVER_URL}/dict/${dict.filename || dict.name}`;

      // 使用XMLHttpRequest以支持进度跟踪
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';


      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          progressPercent.textContent = `${percent}%`;
          progressBar.style.width = `${percent}%`;

          // 计算下载速度



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

    importStatus.textContent = '\u5bfc\u5165\u4e2d...';
    importStatus.className = 'import-status importing';

    try {
      const vocabularies = await chrome.storage.local.get('vocabularies') || {};
      let vocabList = vocabularies.vocabularies || [];

      for (const file of files) {
        const content = await readFileAsText(file);
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          throw new Error(file.name + ' \u683c\u5f0f\u4e0d\u6b63\u786e');
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

      importStatus.textContent = '\u6210\u529f\u5bfc\u5165 ' + files.length + ' \u4e2a\u6587\u4ef6';
      importStatus.className = 'import-status success';

      await loadSettings();

      notifyContentScripts();

      setTimeout(() => {
        importStatus.textContent = '';
      }, 3000);

    } catch (error) {
      importStatus.textContent = '\u5bfc\u5165\u5931\u8d25: ' + error.message;
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
      'dedupeCooldownSeconds'
    ]);
    const displayMode = result.displayMode || 'off';
    const vocabList = result.vocabularies || [];
    const maxMatches = (typeof result.maxMatchesPerNode === 'number') ? result.maxMatchesPerNode : 3;
    const minLength = (typeof result.minTextLength === 'number') ? result.minTextLength : 10;
    const annotationMode = result.annotationMode || 'auto';
    const highlightMode = result.highlightColorMode || 'none';
    const highlightColor = result.highlightColor || '#2196f3';
    const smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
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
    dedupeRepeatCountSlider.value = dedupeRepeatCount;
    dedupeRepeatCountLabel.textContent = dedupeRepeatCount;
    highlightModeSelect.value = highlightMode;
    highlightColorInput.value = highlightColor;
    updateHighlightControls(highlightMode);
    smartSkipCodeLinksToggle.checked = smartSkipCodeLinks;

    displayFilesList(vocabList);
    updateStats(vocabList);
    updateLanguageStats(annotationMode);
  }

  function displayFilesList(vocabList) {
    fileCount.textContent = vocabList.length;
    filesList.innerHTML = '';

    if (vocabList.length === 0) {
      filesList.innerHTML = '<div class="empty-state">\u6682\u65e0\u5bfc\u5165\u7684\u8bcd\u5e93\u6587\u4ef6</div>';
      return;
    }

    vocabList.forEach(vocab => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML =
        '<div class="file-info">' +
          '<div class="file-name">' + vocab.name + '</div>' +
          '<div class="file-meta">' +
            '\u8bcd\u6761\u6570: ' + vocab.wordCount + ' | ' +
            '\u5bfc\u5165\u65f6\u95f4: ' + formatDate(vocab.uploadTime) +
          '</div>' +
        '</div>' +
        '<button class="btn btn-delete" data-id="' + vocab.id + '">\u5220\u9664</button>';

      fileItem.querySelector('.btn-delete').addEventListener('click', async () => {
        await deleteVocabulary(vocab.id);
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

  async function updateLanguageStats(annotationMode) {
    const isAuto = annotationMode === 'auto';
    const displayValue = isAuto ? 'flex' : 'none';
    languageRatioRow.style.display = displayValue;
    languageRatioRowEn.style.display = displayValue;
    chineseRatio.textContent = '-';
    englishRatio.textContent = '-';
    if (!isAuto) {
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || tabs[0].id == null) {
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'getLanguageStats'
      });
      if (!response || !response.stats) {
        return;
      }
      const cnRatio = response.stats.chineseRatio;
      const enRatio = response.stats.englishRatio;
      if (typeof cnRatio === 'number') {
        chineseRatio.textContent = `${(cnRatio * 100).toFixed(1)}%`;
      }
      if (typeof enRatio === 'number') {
        englishRatio.textContent = `${(enRatio * 100).toFixed(1)}%`;
      }
    } catch (error) {
      // 忽略无法访问内容脚本的页面
    }
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
