// popup.js - settings logic

// 跨浏览器 API 兼容 shim (Chrome/Edge 用 chrome.*, Safari 用 browser.*)
const api = globalThis.browser ?? globalThis.chrome;

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
            api.tabs.create({url: 'https://jieci.top'});
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
    const pageSearch = document.getElementById('pageSearch');
    const pageBlocked = document.getElementById('pageBlocked');
    const pageFavorites = document.getElementById('pageFavorites');
    const pageSiteBlock = document.getElementById('pageSiteBlock');
    const pageAbout = document.getElementById('pageAbout');
    const vocabBack = document.getElementById('vocabBack');
    const advancedBack = document.getElementById('advancedBack');
    const styleNav = document.getElementById('styleNav');
    const annotationNav = document.getElementById('annotationNav');
    const searchNav = document.getElementById('searchNav');
    const blockedNav = document.getElementById('blockedNav');
    const favoritesNav = document.getElementById('favoritesNav');
    const vocabularyNav = document.getElementById('vocabularyNav');
    const siteBlockNav = document.getElementById('siteBlockNav');
    const aboutNav = document.getElementById('aboutNav');
    const styleBack = document.getElementById('styleBack');
    const annotationBack = document.getElementById('annotationBack');
    const searchBack = document.getElementById('searchBack');
    const blockedBack = document.getElementById('blockedBack');
    const favoritesBack = document.getElementById('favoritesBack');
    const siteBlockBack = document.getElementById('siteBlockBack');
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
    const updateProgress = document.getElementById('updateProgress');
    const updateProgressLabel = document.getElementById('updateProgressLabel');
    const updateProgressPercent = document.getElementById('updateProgressPercent');
    const updateProgressBar = document.getElementById('updateProgressBar');
    const updateOverall = document.getElementById('updateOverall');
    const updateOverallLabel = document.getElementById('updateOverallLabel');
    const updateOverallPercent = document.getElementById('updateOverallPercent');
    const updateOverallBar = document.getElementById('updateOverallBar');
    const updateModal = document.getElementById('updateModal');
    const updateModalClose = document.getElementById('updateModalClose');
    const updateCancelBtn = document.getElementById('updateCancelBtn');
    const updateRetryBtn = document.getElementById('updateRetryBtn');
    const filesList = document.getElementById('filesList');
    const fileCount = document.getElementById('fileCount');
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
    const cnToEnOrderSelect = document.getElementById('cnToEnOrder');
    const enToCnOrderSelect = document.getElementById('enToCnOrder');
    const disableAnnotationUnderlineToggle = document.getElementById('disableAnnotationUnderline');
    const disableAnnotationTooltipToggle = document.getElementById('disableAnnotationTooltip');
    const speechVoiceSelect = document.getElementById('speechVoiceSelect');
    const searchProviderSelect = document.getElementById('searchProviderSelect');
    const blockedSearchInput = document.getElementById('blockedSearchInput');
    const blockedSelectAll = document.getElementById('blockedSelectAll');
    const blockedDeleteSelected = document.getElementById('blockedDeleteSelected');
    const blockedList = document.getElementById('blockedList');
    const blockedImportBtn = document.getElementById('blockedImportBtn');
    const blockedExportBtn = document.getElementById('blockedExportBtn');
    const blockedImportInput = document.getElementById('blockedImportInput');
    const favoritesSearchInput = document.getElementById('favoritesSearchInput');
    const favoritesSelectAll = document.getElementById('favoritesSelectAll');
    const favoritesDeleteSelected = document.getElementById('favoritesDeleteSelected');
    const favoritesList = document.getElementById('favoritesList');
    const favoritesImportBtn = document.getElementById('favoritesImportBtn');
    const favoritesExportBtn = document.getElementById('favoritesExportBtn');
    const favoritesImportInput = document.getElementById('favoritesImportInput');
    const siteBlockSearchInput = document.getElementById('siteBlockSearchInput');
    const siteBlockSelectAll = document.getElementById('siteBlockSelectAll');
    const siteBlockDeleteSelected = document.getElementById('siteBlockDeleteSelected');
    const siteBlockList = document.getElementById('siteBlockList');
    const siteBlockImportBtn = document.getElementById('siteBlockImportBtn');
    const siteBlockExportBtn = document.getElementById('siteBlockExportBtn');
    const siteBlockImportInput = document.getElementById('siteBlockImportInput');
    const smartSkipCodeLinksToggle = document.getElementById('smartSkipCodeLinks');
    const resetPopupSizeButton = document.getElementById('resetPopupSize');
    const blockSiteBtn = document.getElementById('blockSiteBtn');
    const quickFavorites = document.getElementById('quickFavorites');
    const quickBlocked = document.getElementById('quickBlocked');
    const quickVocab = document.getElementById('quickVocab');
    const quickSettings = document.getElementById('quickSettings');
    let vocabEntrySource = 'advanced';
    let favoritesEntrySource = 'advanced';
    let blockedEntrySource = 'advanced';
    let updateAbortXhr = null;
    let updateCancelRequested = false;
    let updateInProgress = false;
    let updateModalCloseTimer = null;
    let lastUpdateAction = null;
    // 下载相关元素
    const downloadBtn = document.getElementById('downloadBtn');
    const updateAllBtn = document.getElementById('updateAllBtn');
    const downloadModal = document.getElementById('downloadModal');
    const modalClose = document.getElementById('modalClose');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const dictList = document.getElementById('dictList');
    const downloadProgress = document.getElementById('downloadProgress');
    const downloadingDict = document.getElementById('downloadingDict');
    const downloadErrorOk = document.getElementById('downloadErrorOk');
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
    const pages = [pageMain, pageVocab, pageAdvanced, pageStyle, pageAnnotation, pageSearch, pageBlocked, pageFavorites, pageSiteBlock, pageAbout];
    const showPage = (page) => {
        pages.forEach((item) => {
            if (!item) {
                return;
            }
            item.classList.toggle('is-active', item === page);
        });
        scheduleOverflowUpdate();
    };
    if (aboutVersion && api.runtime?.getManifest) {
        aboutVersion.textContent = api.runtime.getManifest().version || '-';
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
        oobeText3.textContent = '您可以前往我们的示例页面，看下插件工作的怎么样。如果您在使用的时候有任何问题，请一定要跟我们反馈哦~';
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
        api.storage.local.set({[OOBE_STEP_KEY]: step}).catch(() => {
        });
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
            const name = document.createElement('div');
            name.className = 'oobe-vocab-name';
            name.textContent = vocab && vocab.name ? vocab.name : '未命名词库';
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            const updateButton = document.createElement('button');
            updateButton.className = 'btn btn-secondary';
            updateButton.textContent = '更新';
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'oobe-vocab-delete';
            deleteButton.textContent = 'x';
            deleteButton.setAttribute('aria-label', '删除词库');
            deleteButton.title = '删除词库';
            deleteButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!vocab || vocab.id == null) {
                    return;
                }
                const originalText = deleteButton.textContent;
                deleteButton.disabled = true;
                deleteButton.textContent = '...';
                try {
                    await deleteVocabulary(vocab.id);
                } catch (error) {
                    deleteButton.disabled = false;
                    deleteButton.textContent = originalText;
                    importStatus.textContent = '删除失败: ' + error.message;
                    importStatus.className = 'import-status error';
                }
            });
            item.appendChild(name);
            item.appendChild(deleteButton);
            oobeVocabList.appendChild(item);
        });
    };
    const markOobeCompleted = async () => {
        const result = await api.storage.local.get(OOBE_COMPLETION_KEY);
        const current = Number.isFinite(result[OOBE_COMPLETION_KEY])
            ? result[OOBE_COMPLETION_KEY]
            : 0;
        const next = Math.min(OOBE_REQUIRED_COUNT, current + 1);
        await api.storage.local.set({[OOBE_COMPLETION_KEY]: next});
        await api.storage.local.remove(OOBE_STEP_KEY);
        setOobeVisible(false);
        showPage(pageMain);
    };
    const getActiveTabs = async () => {
        return api.tabs.query({active: true, currentWindow: true});
    };
    const notifyActiveTabs = async (message) => {
        const tabs = await getActiveTabs();
        tabs.forEach(tab => {
            if (tab.id == null) {
                return;
            }
            api.tabs.sendMessage(tab.id, message).catch(() => {
            });
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
    const normalizeWord = (word) => String(word || '').trim().toLowerCase();
    const buildEnglishTrieIndex = (words) => {
        const trie = new Trie();
        words.forEach((word) => {
            const clean = normalizeWord(word);
            if (clean) {
                trie.insert(clean);
            }
        });
        return trie.serialize();
    };
    let blockedWords = [];
    let favoriteWords = [];
    let blockedSelected = new Set();
    let favoritesSelected = new Set();
    let siteBlockRules = [];
    let siteBlockSelected = new Set();
    let currentSiteHost = '';
    const filterWords = (words, query) => {
        const normalized = normalizeWord(query);
        if (!normalized) {
            return words;
        }
        return words.filter(word => word.includes(normalized));
    };
    const normalizeHost = (host) => String(host || '').trim().toLowerCase().replace(/\.+$/, '');
    const normalizeSiteRule = (rule) => {
        if (!rule) {
            return '';
        }
        let cleaned = String(rule).trim().toLowerCase();
        cleaned = cleaned.replace(/^(https?:)?\/\//, '');
        cleaned = cleaned.split(/[/?#]/)[0];
        if (cleaned.startsWith('*.')) {
            cleaned = '*.' + cleaned.slice(2).split(':')[0];
        } else {
            cleaned = cleaned.split(':')[0];
        }
        return cleaned.replace(/\.+$/, '');
    };
    const compileSiteRules = (rules) => {
        const exact = new Set();
        const wildcards = [];
        rules.forEach((rule) => {
            const cleaned = normalizeSiteRule(rule);
            if (!cleaned) {
                return;
            }
            if (cleaned.startsWith('*.')) {
                const suffix = cleaned.slice(2);
                if (suffix) {
                    wildcards.push({suffix, parts: suffix.split('.').length});
                }
            } else {
                exact.add(cleaned);
            }
        });
        return {
            exact: Array.from(exact),
            wildcards: wildcards.sort((a, b) => b.parts - a.parts)
        };
    };
    const isHostBlocked = (host, rules) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) {
            return false;
        }
        const {exact, wildcards} = compileSiteRules(rules);
        if (exact.includes(normalizedHost)) {
            return true;
        }
        const hostParts = normalizedHost.split('.').length;
        return wildcards.some(({suffix, parts}) => {
            if (hostParts <= parts) {
                return false;
            }
            return normalizedHost.endsWith(`.${suffix}`);
        });
    };
    const findBestMatchingRule = (host, rules) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) {
            return '';
        }
        const normalizedRules = rules.map(normalizeSiteRule).filter(Boolean);
        const exactMatch = normalizedRules.find(rule => !rule.startsWith('*.') && rule === normalizedHost);
        if (exactMatch) {
            return exactMatch;
        }
        const hostParts = normalizedHost.split('.').length;
        const wildcardMatches = normalizedRules.filter((rule) => {
            if (!rule.startsWith('*.')) {
                return false;
            }
            const suffix = rule.slice(2);
            const parts = suffix.split('.').length;
            if (hostParts <= parts) {
                return false;
            }
            return normalizedHost.endsWith(`.${suffix}`);
        });
        wildcardMatches.sort((a, b) => b.length - a.length);
        return wildcardMatches[0] || '';
    };
    const deleteSelectedConfirmDelay = 3000;
    const deleteSelectedDoneDelay = 3000;
    const resetDeleteSelectedButton = (button) => {
        if (!button) {
            return;
        }
        if (button._confirmTimer) {
            clearTimeout(button._confirmTimer);
            button._confirmTimer = null;
        }
        if (button._doneTimer) {
            clearTimeout(button._doneTimer);
            button._doneTimer = null;
        }
        button.dataset.state = 'idle';
        button.textContent = '删除选中';
        button.disabled = true;
    };
    const updateDeleteSelectedButton = (button, hasSelection) => {
        if (!button) {
            return;
        }
        if (button.dataset.state === 'deleted') {
            button.textContent = '已删除';
            button.disabled = true;
            return;
        }
        if (!hasSelection) {
            resetDeleteSelectedButton(button);
            return;
        }
        if (!button.dataset.state || button.dataset.state === 'idle') {
            button.textContent = '删除选中';
        }
        button.disabled = false;
    };
    const updateBlockedActions = (filtered) => {
        if (!blockedSelectAll || !blockedDeleteSelected) {
            return;
        }
        const allSelected = filtered.length > 0 && filtered.every(word => blockedSelected.has(word));
        blockedSelectAll.textContent = allSelected ? '取消全选' : '全选';
        updateDeleteSelectedButton(blockedDeleteSelected, blockedSelected.size > 0);
    };
    const updateFavoritesActions = (filtered) => {
        if (!favoritesSelectAll || !favoritesDeleteSelected) {
            return;
        }
        const allSelected = filtered.length > 0 && filtered.every(word => favoritesSelected.has(word));
        favoritesSelectAll.textContent = allSelected ? '取消全选' : '全选';
        updateDeleteSelectedButton(favoritesDeleteSelected, favoritesSelected.size > 0);
    };
    const renderBlockedWords = () => {
        if (!blockedList) {
            return;
        }
        blockedList.replaceChildren();
        const filtered = filterWords(blockedWords, blockedSearchInput ? blockedSearchInput.value : '');
        updateBlockedActions(filtered);
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '暂无屏蔽词';
            blockedList.appendChild(empty);
            return;
        }
        filtered.forEach((word) => {
            const item = document.createElement('div');
            item.className = 'word-item';
            const left = document.createElement('div');
            left.className = 'word-left';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'word-checkbox';
            checkbox.checked = blockedSelected.has(word);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    blockedSelected.add(word);
                } else {
                    blockedSelected.delete(word);
                }
                updateBlockedActions(filtered);
            });
            const text = document.createElement('div');
            text.className = 'word-text';
            text.textContent = word;
            left.appendChild(checkbox);
            left.appendChild(text);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'word-delete';
            deleteButton.textContent = 'x';
            deleteButton.addEventListener('click', async () => {
                blockedSelected.delete(word);
                blockedWords = blockedWords.filter(itemWord => itemWord !== word);
                await persistBlockedWords();
                renderBlockedWords();
            });
            item.appendChild(left);
            item.appendChild(deleteButton);
            blockedList.appendChild(item);
        });
    };
    const renderFavorites = () => {
        if (!favoritesList) {
            return;
        }
        favoritesList.replaceChildren();
        const filtered = filterWords(favoriteWords, favoritesSearchInput ? favoritesSearchInput.value : '');
        updateFavoritesActions(filtered);
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '暂无收藏的单词';
            favoritesList.appendChild(empty);
            return;
        }
        filtered.forEach((word) => {
            const item = document.createElement('div');
            item.className = 'word-item';
            const left = document.createElement('div');
            left.className = 'word-left';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'word-checkbox';
            checkbox.checked = favoritesSelected.has(word);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    favoritesSelected.add(word);
                } else {
                    favoritesSelected.delete(word);
                }
                updateFavoritesActions(filtered);
            });
            const text = document.createElement('div');
            text.className = 'word-text';
            text.textContent = word;
            left.appendChild(checkbox);
            left.appendChild(text);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'word-delete';
            deleteButton.textContent = 'x';
            deleteButton.addEventListener('click', async () => {
                favoritesSelected.delete(word);
                favoriteWords = favoriteWords.filter(itemWord => itemWord !== word);
                await persistFavoriteWords();
                renderFavorites();
            });
            item.appendChild(left);
            item.appendChild(deleteButton);
            favoritesList.appendChild(item);
        });
    };
    const updateSiteBlockActions = (filtered) => {
        if (!siteBlockSelectAll || !siteBlockDeleteSelected) {
            return;
        }
        const allSelected = filtered.length > 0 && filtered.every(rule => siteBlockSelected.has(rule));
        siteBlockSelectAll.textContent = allSelected ? '取消全选' : '全选';
        updateDeleteSelectedButton(siteBlockDeleteSelected, siteBlockSelected.size > 0);
    };
    const renderSiteBlockRules = () => {
        if (!siteBlockList) {
            return;
        }
        siteBlockList.replaceChildren();
        const filtered = filterWords(siteBlockRules, siteBlockSearchInput ? siteBlockSearchInput.value : '');
        updateSiteBlockActions(filtered);
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '暂无黑名单网站';
            siteBlockList.appendChild(empty);
            return;
        }
        filtered.forEach((rule) => {
            const item = document.createElement('div');
            item.className = 'word-item';
            const left = document.createElement('div');
            left.className = 'word-left';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'word-checkbox';
            checkbox.checked = siteBlockSelected.has(rule);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    siteBlockSelected.add(rule);
                } else {
                    siteBlockSelected.delete(rule);
                }
                updateSiteBlockActions(filtered);
            });
            const text = document.createElement('div');
            text.className = 'word-text';
            text.textContent = rule;
            left.appendChild(checkbox);
            left.appendChild(text);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'word-delete';
            deleteButton.textContent = 'x';
            deleteButton.addEventListener('click', async () => {
                siteBlockSelected.delete(rule);
                siteBlockRules = siteBlockRules.filter(itemRule => itemRule !== rule);
                await persistSiteBlockRules();
                renderSiteBlockRules();
                updateBlockSiteButton();
            });
            item.appendChild(left);
            item.appendChild(deleteButton);
            siteBlockList.appendChild(item);
        });
    };
    const persistBlockedWords = async () => {
        const normalized = Array.from(new Set(blockedWords.map(normalizeWord).filter(Boolean))).sort();
        blockedWords = normalized;
        const trieIndex = buildEnglishTrieIndex(normalized);
        await api.storage.local.set({
            blockedWords: normalized,
            blockedWordsTrieIndex: trieIndex
        });
        await notifyActiveTabs({
            action: 'updateBlockedWords',
            words: normalized,
            trieIndex: trieIndex
        });
    };
    const persistFavoriteWords = async () => {
        const normalized = Array.from(new Set(favoriteWords.map(normalizeWord).filter(Boolean))).sort();
        favoriteWords = normalized;
        await api.storage.local.set({favoriteWords: normalized});
    };
    const persistSiteBlockRules = async () => {
        const normalized = Array.from(new Set(siteBlockRules.map(normalizeSiteRule).filter(Boolean))).sort();
        siteBlockRules = normalized;
        const index = compileSiteRules(normalized);
        await api.storage.local.set({
            siteBlockRules: normalized,
            siteBlockIndex: index
        });
        await notifyActiveTabs({
            action: 'updateSiteBlacklist',
            rules: normalized,
            index: index
        });
    };
    const parseWordLines = (content) => {
        return content
            .split(/\r?\n/)
            .map(line => normalizeWord(line))
            .filter(Boolean);
    };
    const exportWords = (words, filename) => {
        const content = words.join('\n');
        const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
    const requestTabHost = async (tabId) => {
        if (tabId == null) {
            return '';
        }
        try {
            const response = await api.tabs.sendMessage(tabId, {action: 'getPageHost'});
            return response && response.host ? response.host : '';
        } catch (e) {
            return '';
        }
    };
    const loadCurrentSiteHost = async () => {
        try {
            const tabs = await getActiveTabs();
            const tab = tabs[0];
            let host = '';
            if (tab && tab.url) {
                try {
                    host = new URL(tab.url).hostname;
                } catch (error) {
                    host = '';
                }
            }
            if (!host && tab && tab.id != null) {
                host = await requestTabHost(tab.id);
            }
            currentSiteHost = normalizeHost(host);
        } catch (error) {
            currentSiteHost = '';
        }
    };
    const updateBlockSiteButton = async () => {
        if (!blockSiteBtn) {
            return;
        }
        if (!currentSiteHost) {
            await loadCurrentSiteHost();
        }
        if (!currentSiteHost) {
            blockSiteBtn.disabled = true;
            blockSiteBtn.textContent = '当前页面受浏览器保护';
            return;
        }
        const blocked = isHostBlocked(currentSiteHost, siteBlockRules);
        blockSiteBtn.disabled = false;
        blockSiteBtn.textContent = blocked ? '此网站已禁用标注 点此取消' : '以后不再标注此网站';
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
    if (quickFavorites) {
        quickFavorites.addEventListener('click', () => {
            favoritesEntrySource = 'main';
            showPage(pageFavorites);
        });
    }
    if (quickBlocked) {
        quickBlocked.addEventListener('click', () => {
            blockedEntrySource = 'main';
            showPage(pageBlocked);
        });
    }
    if (quickVocab) {
        quickVocab.addEventListener('click', () => {
            vocabEntrySource = 'main';
            showPage(pageVocab);
        });
    }
    if (quickSettings) {
        quickSettings.addEventListener('click', () => showPage(pageAdvanced));
    }
    if (styleNav) {
        styleNav.addEventListener('click', () => showPage(pageStyle));
    }
    if (annotationNav) {
        annotationNav.addEventListener('click', () => showPage(pageAnnotation));
    }
    if (searchNav) {
        searchNav.addEventListener('click', () => showPage(pageSearch));
    }
    if (blockedNav) {
        blockedNav.addEventListener('click', () => {
            blockedEntrySource = 'advanced';
            showPage(pageBlocked);
        });
    }
    if (favoritesNav) {
        favoritesNav.addEventListener('click', () => {
            favoritesEntrySource = 'advanced';
            showPage(pageFavorites);
        });
    }
    if (vocabularyNav) {
        vocabularyNav.addEventListener('click', () => {
            vocabEntrySource = 'advanced';
            showPage(pageVocab);
        });
    }
    if (siteBlockNav) {
        siteBlockNav.addEventListener('click', () => showPage(pageSiteBlock));
    }
    if (aboutNav) {
        aboutNav.addEventListener('click', () => showPage(pageAbout));
    }
    if (vocabBack) {
        vocabBack.addEventListener('click', () => {
            showPage(vocabEntrySource === 'advanced' ? pageAdvanced : pageMain);
        });
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
    if (searchBack) {
        searchBack.addEventListener('click', () => showPage(pageAdvanced));
    }
    if (blockedBack) {
        blockedBack.addEventListener('click', () => {
            showPage(blockedEntrySource === 'advanced' ? pageAdvanced : pageMain);
        });
    }
    if (favoritesBack) {
        favoritesBack.addEventListener('click', () => {
            showPage(favoritesEntrySource === 'advanced' ? pageAdvanced : pageMain);
        });
    }
    if (siteBlockBack) {
        siteBlockBack.addEventListener('click', () => showPage(pageAdvanced));
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
            api.tabs.create({url: 'https://jieci.top/testplugin.html'});
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
        await api.storage.local.set({displayMode: mode});
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
        await api.storage.local.set({annotationMode: mode});
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
        await api.storage.local.set({dedupeMode: mode});
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
    if (blockSiteBtn) {
        blockSiteBtn.addEventListener('click', async () => {
            await loadCurrentSiteHost();
            if (!currentSiteHost) {
                return;
            }
            const blocked = isHostBlocked(currentSiteHost, siteBlockRules);
            if (blocked) {
                const ruleToRemove = findBestMatchingRule(currentSiteHost, siteBlockRules);
                if (!ruleToRemove) {
                    return;
                }
                siteBlockRules = siteBlockRules.filter(rule => normalizeSiteRule(rule) !== normalizeSiteRule(ruleToRemove));
                siteBlockSelected = new Set();
                await persistSiteBlockRules();
                renderSiteBlockRules();
                updateBlockSiteButton();
                return;
            }
            const rule = normalizeHost(currentSiteHost);
            if (!rule) {
                return;
            }
            siteBlockRules = Array.from(new Set([...siteBlockRules, rule]));
            siteBlockSelected = new Set();
            await persistSiteBlockRules();
            renderSiteBlockRules();
            updateBlockSiteButton();
        });
    }
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
        await api.storage.local.set({maxMatchesPerNode: maxMatches});
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
        await api.storage.local.set({minTextLength: minLength});
        await notifyActiveTabs({
            action: 'updateMinTextLength',
            minLength: minLength
        });
    });
    dedupeRepeatCountSlider.addEventListener('input', async () => {
        const repeatCount = parseInt(dedupeRepeatCountSlider.value, 10) || 10;
        dedupeRepeatCountLabel.textContent = repeatCount;
        await api.storage.local.set({dedupeRepeatCount: repeatCount});
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
            await api.storage.local.remove('dedupeGlobalState');
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
        await api.storage.local.set({smartSkipCodeLinks: enabled});
        await notifyActiveTabs({
            action: 'updateSmartSkipCodeLinks',
            enabled: enabled
        });
    });
    if (disableAnnotationUnderlineToggle) {
        disableAnnotationUnderlineToggle.addEventListener('change', async () => {
            const disabled = disableAnnotationUnderlineToggle.checked;
            await api.storage.local.set({disableAnnotationUnderline: disabled});
            await notifyActiveTabs({
                action: 'updateAnnotationUnderline',
                disabled: disabled
            });
        });
    }
    if (disableAnnotationTooltipToggle) {
        disableAnnotationTooltipToggle.addEventListener('change', async () => {
            const disabled = disableAnnotationTooltipToggle.checked;
            await api.storage.local.set({disableAnnotationTooltip: disabled});
            await notifyActiveTabs({
                action: 'updateAnnotationTooltip',
                disabled: disabled
            });
        });
    }
    const debugModeToggle = document.getElementById('debugMode');
    debugModeToggle.addEventListener('change', async () => {
        const enabled = debugModeToggle.checked;
        await api.storage.local.set({debugMode: enabled});
        await notifyActiveTabs({
            action: 'updateDebugMode',
            enabled: enabled
        });
    });
    if (resetPopupSizeButton) {
        resetPopupSizeButton.addEventListener('click', async () => {
            const originalText = resetPopupSizeButton.textContent;
            await api.storage.local.remove(TOOLTIP_SIZE_STORAGE_KEY);
            await notifyActiveTabs({action: 'resetTooltipSize'});
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
        await api.storage.local.set(settings);
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
    const saveAnnotationOrderSettings = async () => {
        if (!cnToEnOrderSelect || !enToCnOrderSelect) {
            return;
        }
        const cnToEnOrder = cnToEnOrderSelect.value;
        const enToCnOrder = enToCnOrderSelect.value;
        await api.storage.local.set({
            cnToEnOrder,
            enToCnOrder
        });
        await notifyActiveTabs({
            action: 'updateAnnotationOrder',
            cnToEnOrder,
            enToCnOrder
        });
    };
    if (cnToEnOrderSelect) {
        cnToEnOrderSelect.addEventListener('change', saveAnnotationOrderSettings);
    }
    if (enToCnOrderSelect) {
        enToCnOrderSelect.addEventListener('change', saveAnnotationOrderSettings);
    }
    if (searchProviderSelect) {
        searchProviderSelect.addEventListener('change', async () => {
            const provider = searchProviderSelect.value;
            await api.storage.local.set({searchProvider: provider});
            await notifyActiveTabs({
                action: 'updateSearchProvider',
                provider: provider
            });
        });
    }
    const renderSpeechVoiceOptions = () => {
        if (!speechVoiceSelect || typeof speechSynthesis === 'undefined') {
            return;
        }
        const voices = speechSynthesis.getVoices();
        const selectedValue = speechVoiceSelect.dataset.selectedValue || '';
        speechVoiceSelect.replaceChildren();
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '系统默认';
        speechVoiceSelect.appendChild(defaultOption);
        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.localService) {
                option.textContent += ' - 本地';
            }
            speechVoiceSelect.appendChild(option);
        });
        speechVoiceSelect.value = selectedValue;
        if (speechVoiceSelect.value !== selectedValue) {
            speechVoiceSelect.value = '';
        }
    };
    const saveSpeechVoiceSetting = async () => {
        if (!speechVoiceSelect) {
            return;
        }
        const speechVoiceURI = speechVoiceSelect.value || '';
        await api.storage.local.set({speechVoiceURI});
        await notifyActiveTabs({
            action: 'updateSpeechVoice',
            speechVoiceURI
        });
    };
    if (speechVoiceSelect) {
        speechVoiceSelect.addEventListener('change', saveSpeechVoiceSetting);
        renderSpeechVoiceOptions();
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', renderSpeechVoiceOptions);
        }
    }
    if (blockedSearchInput) {
        blockedSearchInput.addEventListener('input', () => {
            renderBlockedWords();
        });
    }
    if (blockedSelectAll) {
        blockedSelectAll.addEventListener('click', () => {
            const filtered = filterWords(blockedWords, blockedSearchInput ? blockedSearchInput.value : '');
            const allSelected = filtered.length > 0 && filtered.every(word => blockedSelected.has(word));
            if (allSelected) {
                filtered.forEach(word => blockedSelected.delete(word));
            } else {
                filtered.forEach(word => blockedSelected.add(word));
            }
            renderBlockedWords();
        });
    }
    if (blockedDeleteSelected) {
        blockedDeleteSelected.addEventListener('click', async () => {
            if (blockedSelected.size === 0) {
                return;
            }
            if (blockedDeleteSelected.dataset.state === 'confirm') {
                if (blockedDeleteSelected._confirmTimer) {
                    clearTimeout(blockedDeleteSelected._confirmTimer);
                    blockedDeleteSelected._confirmTimer = null;
                }
                blockedDeleteSelected.dataset.state = 'deleted';
                blockedDeleteSelected.textContent = '已删除';
                blockedDeleteSelected.disabled = true;
                blockedWords = blockedWords.filter(word => !blockedSelected.has(word));
                blockedSelected = new Set();
                await persistBlockedWords();
                renderBlockedWords();
                blockedDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(blockedDeleteSelected);
                    updateBlockedActions(filterWords(blockedWords, blockedSearchInput ? blockedSearchInput.value : ''));
                }, deleteSelectedDoneDelay);
                return;
            }
            if (blockedDeleteSelected.dataset.state === 'deleted') {
                return;
            }
            blockedDeleteSelected.dataset.state = 'confirm';
            blockedDeleteSelected.textContent = '确认吗？';
            blockedDeleteSelected._confirmTimer = setTimeout(() => {
                blockedDeleteSelected.dataset.state = 'idle';
                updateDeleteSelectedButton(blockedDeleteSelected, blockedSelected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (favoritesSearchInput) {
        favoritesSearchInput.addEventListener('input', () => {
            renderFavorites();
        });
    }
    if (favoritesSelectAll) {
        favoritesSelectAll.addEventListener('click', () => {
            const filtered = filterWords(favoriteWords, favoritesSearchInput ? favoritesSearchInput.value : '');
            const allSelected = filtered.length > 0 && filtered.every(word => favoritesSelected.has(word));
            if (allSelected) {
                filtered.forEach(word => favoritesSelected.delete(word));
            } else {
                filtered.forEach(word => favoritesSelected.add(word));
            }
            renderFavorites();
        });
    }
    if (favoritesDeleteSelected) {
        favoritesDeleteSelected.addEventListener('click', async () => {
            if (favoritesSelected.size === 0) {
                return;
            }
            if (favoritesDeleteSelected.dataset.state === 'confirm') {
                if (favoritesDeleteSelected._confirmTimer) {
                    clearTimeout(favoritesDeleteSelected._confirmTimer);
                    favoritesDeleteSelected._confirmTimer = null;
                }
                favoritesDeleteSelected.dataset.state = 'deleted';
                favoritesDeleteSelected.textContent = '已删除';
                favoritesDeleteSelected.disabled = true;
                favoriteWords = favoriteWords.filter(word => !favoritesSelected.has(word));
                favoritesSelected = new Set();
                await persistFavoriteWords();
                renderFavorites();
                favoritesDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(favoritesDeleteSelected);
                    updateFavoritesActions(filterWords(favoriteWords, favoritesSearchInput ? favoritesSearchInput.value : ''));
                }, deleteSelectedDoneDelay);
                return;
            }
            if (favoritesDeleteSelected.dataset.state === 'deleted') {
                return;
            }
            favoritesDeleteSelected.dataset.state = 'confirm';
            favoritesDeleteSelected.textContent = '确认吗？';
            favoritesDeleteSelected._confirmTimer = setTimeout(() => {
                favoritesDeleteSelected.dataset.state = 'idle';
                updateDeleteSelectedButton(favoritesDeleteSelected, favoritesSelected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (siteBlockSearchInput) {
        siteBlockSearchInput.addEventListener('input', () => {
            renderSiteBlockRules();
        });
    }
    if (siteBlockSelectAll) {
        siteBlockSelectAll.addEventListener('click', () => {
            const filtered = filterWords(siteBlockRules, siteBlockSearchInput ? siteBlockSearchInput.value : '');
            const allSelected = filtered.length > 0 && filtered.every(rule => siteBlockSelected.has(rule));
            if (allSelected) {
                filtered.forEach(rule => siteBlockSelected.delete(rule));
            } else {
                filtered.forEach(rule => siteBlockSelected.add(rule));
            }
            renderSiteBlockRules();
        });
    }
    if (siteBlockDeleteSelected) {
        siteBlockDeleteSelected.addEventListener('click', async () => {
            if (siteBlockSelected.size === 0) {
                return;
            }
            if (siteBlockDeleteSelected.dataset.state === 'confirm') {
                if (siteBlockDeleteSelected._confirmTimer) {
                    clearTimeout(siteBlockDeleteSelected._confirmTimer);
                    siteBlockDeleteSelected._confirmTimer = null;
                }
                siteBlockDeleteSelected.dataset.state = 'deleted';
                siteBlockDeleteSelected.textContent = '已删除';
                siteBlockDeleteSelected.disabled = true;
                siteBlockRules = siteBlockRules.filter(rule => !siteBlockSelected.has(rule));
                siteBlockSelected = new Set();
                await persistSiteBlockRules();
                renderSiteBlockRules();
                updateBlockSiteButton();
                siteBlockDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(siteBlockDeleteSelected);
                    updateSiteBlockActions(filterWords(siteBlockRules, siteBlockSearchInput ? siteBlockSearchInput.value : ''));
                }, deleteSelectedDoneDelay);
                return;
            }
            if (siteBlockDeleteSelected.dataset.state === 'deleted') {
                return;
            }
            siteBlockDeleteSelected.dataset.state = 'confirm';
            siteBlockDeleteSelected.textContent = '确认吗？';
            siteBlockDeleteSelected._confirmTimer = setTimeout(() => {
                siteBlockDeleteSelected.dataset.state = 'idle';
                updateDeleteSelectedButton(siteBlockDeleteSelected, siteBlockSelected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (siteBlockImportBtn && siteBlockImportInput) {
        siteBlockImportBtn.addEventListener('click', () => {
            siteBlockImportInput.click();
        });
        siteBlockImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const rules = parseWordLines(content).map(normalizeSiteRule).filter(Boolean);
                siteBlockRules = Array.from(new Set([...siteBlockRules, ...rules]));
                siteBlockSelected = new Set();
                await persistSiteBlockRules();
                renderSiteBlockRules();
                updateBlockSiteButton();
            } finally {
                siteBlockImportInput.value = '';
            }
        });
    }
    if (siteBlockExportBtn) {
        siteBlockExportBtn.addEventListener('click', () => {
            exportWords(siteBlockRules, 'site-blacklist.txt');
        });
    }
    if (blockedImportBtn && blockedImportInput) {
        blockedImportBtn.addEventListener('click', () => {
            blockedImportInput.click();
        });
        blockedImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const words = parseWordLines(content);
                blockedWords = Array.from(new Set([...blockedWords, ...words]));
                blockedSelected = new Set();
                await persistBlockedWords();
                renderBlockedWords();
            } finally {
                blockedImportInput.value = '';
            }
        });
    }
    if (blockedExportBtn) {
        blockedExportBtn.addEventListener('click', () => {
            exportWords(blockedWords, 'blocked-words.txt');
        });
    }
    if (favoritesImportBtn && favoritesImportInput) {
        favoritesImportBtn.addEventListener('click', () => {
            favoritesImportInput.click();
        });
        favoritesImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const words = parseWordLines(content);
                favoriteWords = Array.from(new Set([...favoriteWords, ...words]));
                favoritesSelected = new Set();
                await persistFavoriteWords();
                renderFavorites();
            } finally {
                favoritesImportInput.value = '';
            }
        });
    }
    if (favoritesExportBtn) {
        favoritesExportBtn.addEventListener('click', () => {
            exportWords(favoriteWords, 'favorite-words.txt');
        });
    }
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    // 下载按钮点击
    downloadBtn.addEventListener('click', async () => {
        openDownloadModal();
    });
    if (updateAllBtn) {
        updateAllBtn.addEventListener('click', async () => {
            await startUpdateAll();
        });
    }
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
    if (downloadErrorOk) {
        downloadErrorOk.addEventListener('click', closeDownloadModal);
    }
    if (updateModalClose) {
        updateModalClose.addEventListener('click', requestUpdateCancel);
    }
    if (updateCancelBtn) {
        updateCancelBtn.addEventListener('click', requestUpdateCancel);
    }
    if (updateRetryBtn) {
        updateRetryBtn.addEventListener('click', async () => {
            if (!lastUpdateAction) {
                return;
            }
            if (lastUpdateAction.type === 'all') {
                await startUpdateAll();
            } else if (lastUpdateAction.type === 'single') {
                await startUpdateSingle(lastUpdateAction.vocabId);
            }
        });
    }
    if (updateModal) {
        updateModal.addEventListener('click', (e) => {
            if (e.target === updateModal) {
                requestUpdateCancel();
            }
        });
    }

    // 打开下载模态框
    async function openDownloadModal() {
        downloadModal.classList.add('show');
        loadingSpinner.style.display = 'block';
        dictList.style.display = 'none';
        dictList.classList.remove('show');
        downloadProgress.style.display = 'none';
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
        try {
            const response = await fetch(`${SERVER_URL}/dict/index.json`);
            if (!response.ok) {
                loadingSpinner.textContent = '加载失败: 获取词库列表失败';
                console.error('获取词库列表失败:', response.status);
                return;
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
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
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
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
        try {
            const vocabularies = await api.storage.local.get('vocabularies') || {};
            const vocabList = vocabularies.vocabularies || [];
            const dictName = (dict.name || '').trim();
            if (dictName && vocabList.some(vocab => (vocab.name || '').trim() === dictName)) {
                downloadingDict.textContent = '已存在同名词库，请先删除本地词库再重新下载';
                progressPercent.textContent = '';
                if (downloadErrorOk) {
                    downloadErrorOk.style.display = 'inline-flex';
                }
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
            const handleDownloadError = (message, error) => {
                downloadingDict.textContent = `下载失败: ${message}`;
                progressPercent.textContent = '';
                if (error) {
                    console.error('下载词库失败:', error);
                }
                setTimeout(() => {
                    closeDownloadModal();
                }, 2000);
            };
            xhr.onload = async () => {
                if (xhr.status !== 200) {
                    handleDownloadError(`下载失败 (HTTP ${xhr.status})`);
                    return;
                }
                let data = null;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (error) {
                    handleDownloadError('词库解析失败: ' + error.message, error);
                    return;
                }
                if (!Array.isArray(data)) {
                    handleDownloadError('词库格式不正确');
                    return;
                }
                try {
                    // 导入词库
                    const vocabularies = await api.storage.local.get('vocabularies') || {};
                    let vocabList = vocabularies.vocabularies || [];
                    vocabList.push({
                        id: generateId(),
                        name: dict.name,
                        uploadTime: new Date().toISOString(),
                        wordCount: data.length,
                        data: data
                    });
                    await api.storage.local.set({vocabularies: vocabList});
                    // 构建并缓存Trie树索引
                    console.log('构建Trie树索引...');
                    const trieIndex = buildChineseTrieIndex(vocabList);
                    await api.storage.local.set({vocabularyTrieIndex: trieIndex});
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
                    handleDownloadError(error.message, error);
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

    function normalizeDictName(name) {
        return (name || '').trim();
    }

    function openUpdateModal() {
        if (!updateModal) {
            return;
        }
        updateModal.classList.add('show');
        if (updateModalCloseTimer) {
            clearTimeout(updateModalCloseTimer);
            updateModalCloseTimer = null;
        }
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'none';
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = false;
        }
        setUpdateProgressVisible(true);
        updateCurrentProgress('更新进度', 0);
        if (updateOverall) {
            updateOverall.style.display = 'none';
        }
    }

    function shouldAutoCloseUpdateModal() {
        return !updateRetryBtn || updateRetryBtn.style.display === 'none';
    }

    function closeUpdateModal() {
        if (!updateModal) {
            return;
        }
        updateModal.classList.remove('show');
    }

    function scheduleUpdateModalClose(delayMs) {
        if (!updateModal) {
            return;
        }
        if (updateModalCloseTimer) {
            clearTimeout(updateModalCloseTimer);
        }
        updateModalCloseTimer = setTimeout(() => {
            setUpdateProgressVisible(false);
            closeUpdateModal();
        }, delayMs);
    }

    function createCancelError() {
        const error = new Error('已取消');
        error.isCanceled = true;
        return error;
    }

    function requestUpdateCancel() {
        if (!updateInProgress) {
            closeUpdateModal();
            return;
        }
        updateCancelRequested = true;
        if (updateAbortXhr) {
            updateAbortXhr.abort();
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = true;
        }
        updateCurrentProgress('已取消', 0);
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'inline-flex';
        }
        importStatus.textContent = '已取消更新';
        importStatus.className = 'import-status error';
        scheduleUpdateModalClose(3000);
    }

    function setUpdateProgressVisible(visible) {
        if (!updateProgress) {
            return;
        }
        updateProgress.style.display = visible ? 'block' : 'none';
        if (!visible && updateOverall) {
            updateOverall.style.display = 'none';
        }
    }

    function updateCurrentProgress(label, percent) {
        if (!updateProgressLabel || !updateProgressPercent || !updateProgressBar) {
            return;
        }
        if (percent >= 100) {
            updateProgressLabel.textContent = '正在合并词库 请稍后';
        } else {
            updateProgressLabel.textContent = label;
        }
        updateProgressPercent.textContent = `${percent}%`;
        updateProgressBar.style.width = `${percent}%`;
    }

    function calculateOverallPercent(processedCount, totalCount, currentPercent) {
        const safeTotal = Math.max(1, Number(totalCount) || 0);
        const safeProcessed = Math.max(0, Number(processedCount) || 0);
        const safePercent = Math.max(0, Math.min(100, Number(currentPercent) || 0));
        const combined = (safeProcessed + safePercent / 100) / safeTotal;
        return Math.round(Math.min(1, Math.max(0, combined)) * 100);
    }

    function updateOverallProgress(label, percent) {
        if (!updateOverall || !updateOverallLabel || !updateOverallPercent || !updateOverallBar) {
            return;
        }
        updateOverall.style.display = 'block';
        updateOverallLabel.textContent = label;
        updateOverallPercent.textContent = `${percent}%`;
        updateOverallBar.style.width = `${percent}%`;
    }

    async function fetchServerDictionaryIndex() {
        const response = await fetch(`${SERVER_URL}/dict/index.json`, {
            cache: 'no-store'
        });
        if (!response.ok) {
            return Promise.reject(new Error(`获取词库列表失败 (HTTP ${response.status})`));
        }
        const dictionaries = await response.json();
        if (!Array.isArray(dictionaries)) {
            return Promise.reject(new Error('词库列表格式不正确'));
        }
        return dictionaries;
    }

    function findServerDictByName(dictionaries, name) {
        const target = normalizeDictName(name);
        return dictionaries.find((dict) => normalizeDictName(dict.name) === target);
    }

    async function fetchDictionaryData(dict, onProgress) {
        const cacheBust = `t=${Date.now()}`;
        const url = `${SERVER_URL}/dict/${dict.filename || dict.name}?${cacheBust}`;
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            updateAbortXhr = xhr;
            xhr.open('GET', url, true);
            xhr.responseType = 'text';
            xhr.onprogress = (event) => {
                const total = event.lengthComputable ? event.total : (dict.size || 0);
                if (total > 0 && typeof onProgress === 'function') {
                    const rawPercent = Math.round((event.loaded / total) * 100);
                    const percent = Math.min(99, Math.max(0, rawPercent));
                    onProgress(percent);
                }
            };
            xhr.onload = () => {
                updateAbortXhr = null;
                if (xhr.status !== 200) {
                    reject(new Error(`下载失败 (HTTP ${xhr.status})`));
                    return;
                }
                let data = null;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (error) {
                    reject(new Error('词库解析失败: ' + error.message));
                    return;
                }
                if (!Array.isArray(data)) {
                    reject(new Error('词库格式不正确'));
                    return;
                }
                if (typeof onProgress === 'function') {
                    onProgress(100);
                }
                resolve(data);
            };
            xhr.onerror = () => {
                updateAbortXhr = null;
                reject(new Error('下载失败，请检查网络连接'));
            };
            xhr.onabort = () => {
                updateAbortXhr = null;
                reject(createCancelError());
            };
            xhr.send();
        });
    }

    async function updateVocabularyEntry(vocabList, vocab, dict, onProgress) {
        const data = await fetchDictionaryData(dict, onProgress);
        const index = vocabList.findIndex(item => item.id === vocab.id);
        if (index === -1) {
            return Promise.reject(new Error('本地词库不存在'));
        }
        vocabList[index] = {
            ...vocabList[index],
            name: dict.name || vocabList[index].name,
            uploadTime: new Date().toISOString(),
            wordCount: data.length,
            data
        };
        return vocabList;
    }

    async function finalizeVocabulariesUpdate(vocabList) {
        await api.storage.local.set({vocabularies: vocabList});
        if (vocabList.length > 0) {
            const trieIndex = buildChineseTrieIndex(vocabList);
            await api.storage.local.set({vocabularyTrieIndex: trieIndex});
        } else {
            await api.storage.local.remove('vocabularyTrieIndex');
        }
        await loadSettings();
        notifyContentScripts();
    }

    /*
    async function updateAllVocabularies() {
        if (!updateAllBtn) {
            return;
        }
        updateAllBtn.disabled = true;
        importStatus.textContent = '正在更新词库...';
        importStatus.className = 'import-status importing';
        setUpdateProgressVisible(true);
        updateCurrentProgress('准备更新...', 0);
        if (updateOverall) {
            updateOverall.style.display = 'block';
        }
        try {
            const dictionaries = await fetchServerDictionaryIndex();
            const result = await api.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            if (vocabList.length === 0) {
                importStatus.textContent = '暂无可更新的本地词库';
                importStatus.className = 'import-status error';
                setUpdateProgressVisible(false);
                return;
            }
            const failures = [];
            let successCount = 0;
            let processedCount = 0;
            for (const vocab of vocabList) {
                const dict = findServerDictByName(dictionaries, vocab.name);
                if (!dict) {
                    failures.push(`${vocab.name || '未命名词库'}: 服务器未找到`);
                    processedCount += 1;
                    updateOverallProgress(`总进度: ${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                    continue;
                }
                try {
                    updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, 0);
                    vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (percent) => {
                        updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, percent);
                        updateOverallProgress(
                            `总进度: ${processedCount}/${vocabList.length}`,
                            calculateOverallPercent(processedCount, vocabList.length, percent)
                        );
                    });
                    successCount += 1;
                    importStatus.textContent = `正在更新词库... (${successCount}/${vocabList.length})`;
                } catch (error) {
                    failures.push(`${vocab.name || '未命名词库'}: ${error.message}`);
                } finally {
                    processedCount += 1;
                    updateOverallProgress(`总进度: ${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                }
            }
            await finalizeVocabulariesUpdate(vocabList);
            if (failures.length > 0) {
                importStatus.textContent = `更新完成，成功 ${successCount}，失败 ${failures.length}: ${failures.join('；')}`;
                importStatus.className = 'import-status error';
            } else {
                importStatus.textContent = `更新完成，成功 ${successCount}`;
                importStatus.className = 'import-status success';
            }
        } catch (error) {
            importStatus.textContent = '更新失败: ' + error.message;
            importStatus.className = 'import-status error';
        } finally {
            updateAllBtn.disabled = false;
            setTimeout(() => {
                setUpdateProgressVisible(false);
            }, 5000);
        }
    }

    async function updateSingleVocabulary(vocab, updateButton) {
        const originalText = updateButton.textContent;
        updateButton.disabled = true;
        updateButton.textContent = '更新中...';
        if (updateAllBtn) {
            updateAllBtn.disabled = true;
        }
        setUpdateProgressVisible(true);
        if (updateOverall) {
            updateOverall.style.display = 'none';
        }
        updateCurrentProgress(`更新中: ${vocab.name || '未命名词库'}`, 0);
        importStatus.textContent = `正在更新: ${vocab.name || '未命名词库'}`;
        importStatus.className = 'import-status importing';
        try {
            const dictionaries = await fetchServerDictionaryIndex();
            const dict = findServerDictByName(dictionaries, vocab.name);
            if (!dict) {
                throw new Error('服务器未找到该词库');
            }
            const result = await api.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (percent) => {
                updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, percent);
            });
            await finalizeVocabulariesUpdate(vocabList);
            importStatus.textContent = `更新成功: ${dict.name || vocab.name || '未命名词库'}`;
            importStatus.className = 'import-status success';
        } catch (error) {
            importStatus.textContent = '更新失败: ' + error.message;
            importStatus.className = 'import-status error';
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = originalText;
            if (updateAllBtn) {
                updateAllBtn.disabled = false;
            }
            setTimeout(() => {
                setUpdateProgressVisible(false);
            }, 5000);
        }
    }

    // 格式化文件大小
    */
    async function startUpdateAll() {
        lastUpdateAction = {type: 'all'};
        updateCancelRequested = false;
        openUpdateModal();
        await updateAllVocabulariesNew();
    }

    async function startUpdateSingle(vocabId, updateButton) {
        lastUpdateAction = {type: 'single', vocabId};
        updateCancelRequested = false;
        openUpdateModal();
        await updateSingleVocabularyNew(vocabId, updateButton);
    }

    const showUpdateError = (message) => {
        importStatus.textContent = message;
        importStatus.className = 'import-status error';
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'inline-flex';
        }
    };

    const showUpdateCanceled = () => {
        showUpdateError('已取消更新');
    };

    async function updateAllVocabulariesNew() {
        if (!updateAllBtn) {
            return;
        }
        updateInProgress = true;
        updateAllBtn.disabled = true;
        importStatus.textContent = '正在更新词库...';
        importStatus.className = 'import-status importing';
        updateCurrentProgress('准备更新...', 0);
        if (updateOverall) {
            updateOverall.style.display = 'block';
        }
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'none';
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = false;
        }
        try {
            const dictionaries = await fetchServerDictionaryIndex();
            const result = await api.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            if (vocabList.length === 0) {
                importStatus.textContent = '暂无可更新的本地词库';
                importStatus.className = 'import-status error';
                return;
            }
            const failures = [];
            let successCount = 0;
            let processedCount = 0;
            for (const vocab of vocabList) {
                if (updateCancelRequested) {
                    showUpdateCanceled();
                    return;
                }
                const dict = findServerDictByName(dictionaries, vocab.name);
                if (!dict) {
                    failures.push(`${vocab.name || '未命名词库'}: 服务器未找到`);
                    processedCount += 1;
                    updateOverallProgress(`总进度: ${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                    continue;
                }
                try {
                    updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, 0);
                    vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (percent) => {
                        updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, percent);
                        updateOverallProgress(
                            `总进度: ${processedCount}/${vocabList.length}`,
                            calculateOverallPercent(processedCount, vocabList.length, percent)
                        );
                    });
                    successCount += 1;
                    importStatus.textContent = `正在更新词库... (${successCount}/${vocabList.length})`;
                } catch (error) {
                    if (error && error.isCanceled) {
                        showUpdateCanceled();
                        return;
                    }
                    failures.push(`${vocab.name || '未命名词库'}: ${error.message}`);
                } finally {
                    processedCount += 1;
                    updateOverallProgress(`总进度: ${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                }
            }
            if (updateCancelRequested) {
                showUpdateCanceled();
                return;
            }
            await finalizeVocabulariesUpdate(vocabList);
            if (failures.length > 0) {
                importStatus.textContent = `更新完成，成功 ${successCount}，失败 ${failures.length}: ${failures.join('；')}`;
                importStatus.className = 'import-status error';
                if (updateRetryBtn) {
                    updateRetryBtn.style.display = 'inline-flex';
                }
            } else {
                importStatus.textContent = `更新完成，成功 ${successCount}`;
                importStatus.className = 'import-status success';
            }
        } catch (error) {
            if (error.isCanceled) {
                importStatus.textContent = '已取消更新';
                importStatus.className = 'import-status error';
            } else {
                importStatus.textContent = '更新失败: ' + error.message;
                importStatus.className = 'import-status error';
            }
            if (updateRetryBtn) {
                updateRetryBtn.style.display = 'inline-flex';
            }
        } finally {
            updateAllBtn.disabled = false;
            updateInProgress = false;
            updateAbortXhr = null;
            if (shouldAutoCloseUpdateModal()) {
                scheduleUpdateModalClose(5000);
            }
        }
    }

    async function updateSingleVocabularyNew(vocabId, updateButton) {
        const originalText = updateButton ? updateButton.textContent : '';
        if (updateButton) {
            updateButton.disabled = true;
            updateButton.textContent = '更新中...';
        }
        updateInProgress = true;
        if (updateAllBtn) {
            updateAllBtn.disabled = true;
        }
        if (updateOverall) {
            updateOverall.style.display = 'none';
        }
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'none';
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = false;
        }
        updateCurrentProgress('更新中: ...', 0);
        importStatus.textContent = '正在更新: ...';
        importStatus.className = 'import-status importing';
        try {
            const dictionaries = await fetchServerDictionaryIndex();
            const result = await api.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            const vocab = vocabList.find(item => item.id === vocabId);
            if (!vocab) {
                showUpdateError('本地词库不存在');
                return;
            }
            const dict = findServerDictByName(dictionaries, vocab.name);
            if (!dict) {
                showUpdateError('服务器未找到该词库');
                return;
            }
            updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, 0);
            importStatus.textContent = `正在更新: ${dict.name || vocab.name || '未命名词库'}`;
            vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (percent) => {
                updateCurrentProgress(`更新中: ${dict.name || vocab.name || '未命名词库'}`, percent);
            });
            if (updateCancelRequested) {
                showUpdateCanceled();
                return;
            }
            await finalizeVocabulariesUpdate(vocabList);
            importStatus.textContent = `更新成功: ${dict.name || vocab.name || '未命名词库'}`;
            importStatus.className = 'import-status success';
        } catch (error) {
            if (error.isCanceled) {
                importStatus.textContent = '已取消更新';
                importStatus.className = 'import-status error';
            } else {
                importStatus.textContent = '更新失败: ' + error.message;
                importStatus.className = 'import-status error';
            }
            if (updateRetryBtn) {
                updateRetryBtn.style.display = 'inline-flex';
            }
        } finally {
            if (updateButton) {
                updateButton.disabled = false;
                updateButton.textContent = originalText;
            }
            if (updateAllBtn) {
                updateAllBtn.disabled = false;
            }
            updateInProgress = false;
            updateAbortXhr = null;
            if (shouldAutoCloseUpdateModal()) {
                scheduleUpdateModalClose(5000);
            }
        }
    }

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
            const vocabularies = await api.storage.local.get('vocabularies') || {};
            let vocabList = vocabularies.vocabularies || [];
            for (const file of files) {
                const content = await readFileAsText(file);
                const data = JSON.parse(content);
                if (!Array.isArray(data)) {
                    importStatus.textContent = '导入失败: ' + file.name + ' 格式不正确';
                    importStatus.className = 'import-status error';
                    fileInput.value = '';
                    return;
                }
                vocabList.push({
                    id: generateId(),
                    name: file.name,
                    uploadTime: new Date().toISOString(),
                    wordCount: data.length,
                    data: data
                });
            }
            await api.storage.local.set({vocabularies: vocabList});
            // 构建并缓存Trie树索引（中文->英文模式）
            console.log('构建Trie树索引...');
            const trieIndex = buildChineseTrieIndex(vocabList);
            await api.storage.local.set({vocabularyTrieIndex: trieIndex});
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
        const result = await api.storage.local.get([
            'displayMode',
            'vocabularies',
            'maxMatchesPerNode',
            'minTextLength',
            'annotationMode',
            'highlightColorMode',
            'highlightColor',
            'cnToEnOrder',
            'enToCnOrder',
            'disableAnnotationUnderline',
            'disableAnnotationTooltip',
            'smartSkipCodeLinks',
            'searchProvider',
            'speechVoiceURI',
            'blockedWords',
            'favoriteWords',
            'siteBlockRules',
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
        const cnToEnOrder = result.cnToEnOrder || 'source-first';
        const enToCnOrder = result.enToCnOrder || 'source-first';
        const disableAnnotationUnderline = result.disableAnnotationUnderline === true;
        const disableAnnotationTooltip = result.disableAnnotationTooltip === true;
        const smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
        const searchProvider = result.searchProvider || 'youdao';
        const speechVoiceURI = result.speechVoiceURI || '';
        blockedWords = Array.isArray(result.blockedWords)
            ? result.blockedWords.map(normalizeWord).filter(Boolean)
            : [];
        favoriteWords = Array.isArray(result.favoriteWords)
            ? result.favoriteWords.map(normalizeWord).filter(Boolean)
            : [];
        siteBlockRules = Array.isArray(result.siteBlockRules)
            ? result.siteBlockRules.map(normalizeSiteRule).filter(Boolean)
            : [];
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
            await api.storage.local.set({minTextLength: minLength});
            await notifyActiveTabs({
                action: 'updateMinTextLength',
                minLength: minLength
            });
        }
        dedupeRepeatCountSlider.value = dedupeRepeatCount;
        dedupeRepeatCountLabel.textContent = dedupeRepeatCount;
        highlightModeSelect.value = highlightMode;
        highlightColorInput.value = highlightColor;
        if (cnToEnOrderSelect) {
            cnToEnOrderSelect.value = cnToEnOrder;
        }
        if (enToCnOrderSelect) {
            enToCnOrderSelect.value = enToCnOrder;
        }
        if (disableAnnotationUnderlineToggle) {
            disableAnnotationUnderlineToggle.checked = disableAnnotationUnderline;
        }
        if (disableAnnotationTooltipToggle) {
            disableAnnotationTooltipToggle.checked = disableAnnotationTooltip;
        }
        updateHighlightControls(highlightMode);
        smartSkipCodeLinksToggle.checked = smartSkipCodeLinks;
        if (searchProviderSelect) {
            searchProviderSelect.value = searchProvider;
        }
        if (speechVoiceSelect) {
            speechVoiceSelect.dataset.selectedValue = speechVoiceURI;
        }
        if (blockedSearchInput) {
            blockedSearchInput.value = '';
        }
        if (favoritesSearchInput) {
            favoritesSearchInput.value = '';
        }
        blockedSelected = new Set();
        favoritesSelected = new Set();
        siteBlockSelected = new Set();
        renderBlockedWords();
        renderFavorites();
        renderSiteBlockRules();
        await updateBlockSiteButton();
        debugModeToggle.checked = debugMode;
        displayFilesList(vocabList);
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
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            const updateButton = document.createElement('button');
            updateButton.className = 'btn btn-secondary';
            updateButton.textContent = '更新';
            updateButton.addEventListener('click', async () => {
                await startUpdateSingle(vocab.id, updateButton);
            });
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileMeta);
            fileItem.appendChild(fileInfo);
            fileActions.appendChild(updateButton);
            fileActions.appendChild(deleteButton);
            fileItem.appendChild(fileActions);
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
        const result = await api.storage.local.get('vocabularies');
        let vocabList = result.vocabularies || [];
        vocabList = vocabList.filter(v => v.id !== id);
        await api.storage.local.set({vocabularies: vocabList});
        // 重新构建Trie树索引
        if (vocabList.length > 0) {
            const trieIndex = buildChineseTrieIndex(vocabList);
            await api.storage.local.set({vocabularyTrieIndex: trieIndex});
        } else {
            // 如果没有词库了，清空索引
            await api.storage.local.remove('vocabularyTrieIndex');
        }
        await loadSettings();
        notifyContentScripts();
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
