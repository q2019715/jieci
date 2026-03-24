// popup.js - settings logic
// https://www.q2019.com
// by q2019
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
    const byId = (id) => document.getElementById(id);
    const titleLink = byId('titleLink');
    if (titleLink) {
        titleLink.addEventListener('click', () => {
            chrome.tabs.create({url: 'https://jieci.top'});
        });
    }
    const displayModeSlider = byId('displayModeSlider');
    const displayModeThumb = displayModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
    const displayModeLabels = displayModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');
    const annotationModeSlider = byId('annotationModeSlider');
    const annotationModeThumb = annotationModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
    const annotationModeLabels = annotationModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');
    const dedupeModeSlider = byId('dedupeModeSlider');
    const dedupeModeThumb = dedupeModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb');
    const dedupeModeLabels = dedupeModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label');
    const siteBlockModeSlider = byId('siteBlockModeSlider');
    const siteBlockModeThumb = siteBlockModeSlider ? siteBlockModeSlider.closest('.mode-slider-container').querySelector('.mode-slider-thumb') : null;
    const siteBlockModeLabels = siteBlockModeSlider ? siteBlockModeSlider.closest('.mode-slider-container').querySelectorAll('.mode-label') : [];
    const advancedToggle = byId('advancedToggle');
    const vocabularyToggle = byId('vocabularyToggle');
    const vocabularyContent = byId('vocabularyContent');
    const [pageMain, pageVocab, pageAdvanced, pageStyle, pageAnnotation, pageSearch, pageBlocked, pageFavorites, pageSiteBlock, pageSiteRule, pageAbout, pageAISettings] =
        ['pageMain', 'pageVocab', 'pageAdvanced', 'pageStyle', 'pageAnnotation', 'pageSearch', 'pageBlocked', 'pageFavorites', 'pageSiteBlock', 'pageSiteRule', 'pageAbout', 'pageAISettings'].map(byId);
    const [vocabBack, advancedBack, styleNav, annotationNav, searchNav, blockedNav, favoritesNav, vocabularyNav, siteBlockNav, aboutNav, aiSettingsBack, styleBack, annotationBack, searchBack, blockedBack, favoritesBack, siteBlockBack, siteRuleBack, aboutBack] =
        ['vocabBack', 'advancedBack', 'styleNav', 'annotationNav', 'searchNav', 'blockedNav', 'favoritesNav', 'vocabularyNav', 'siteBlockNav', 'aboutNav', 'aiSettingsBack', 'styleBack', 'annotationBack', 'searchBack', 'blockedBack', 'favoritesBack', 'siteBlockBack', 'siteRuleBack', 'aboutBack'].map(byId);
    const aboutVersion = byId('aboutVersion');
    const oobe = byId('oobe');
    const oobeNext1 = byId('oobeNext1');
    const oobeNext2 = byId('oobeNext2');
    const oobeOpenDownload = byId('oobeOpenDownload');
    const oobeGoExample = byId('oobeGoExample');
    const oobeSkip = byId('oobeSkip');
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
    const vocabSearchInput = document.getElementById('vocabSearchInput');
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
    const updateErrorMessage = document.getElementById('updateErrorMessage');
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
    const dedupeRepeatCountSetting = document.getElementById('dedupeRepeatCountSetting');
    const clearDedupeCountsSetting = document.getElementById('clearDedupeCountsSetting');
    const highlightModeSelect = document.getElementById('highlightMode');
    const highlightColorInput = document.getElementById('highlightColor');
    const cnToEnOrderSelect = document.getElementById('cnToEnOrder');
    const enToCnOrderSelect = document.getElementById('enToCnOrder');
    const disableAnnotationUnderlineToggle = document.getElementById('disableAnnotationUnderline');
    const annotationWordCardPopupEnabledToggle = document.getElementById('annotationWordCardPopupEnabled');
    const wordCardHighlightMatchedChineseToggle = document.getElementById('wordCardHighlightMatchedChinese');
    const speechVoiceSelect = document.getElementById('speechVoiceSelect');
    const testChineseVoiceBtn = document.getElementById('testChineseVoiceBtn');
    const testEnglishVoiceBtn = document.getElementById('testEnglishVoiceBtn');
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
    const siteBlockImportModal = document.getElementById('siteBlockImportModal');
    const siteBlockImportModalClose = document.getElementById('siteBlockImportModalClose');
    const siteBlockImportFromFileBtn = document.getElementById('siteBlockImportFromFileBtn');
    const siteBlockImportManualBtn = document.getElementById('siteBlockImportManualBtn');
    const siteBlockChooseFileBtn = document.getElementById('siteBlockChooseFileBtn');
    const siteBlockImportFilePane = document.getElementById('siteBlockImportFilePane');
    const siteBlockImportManualPane = document.getElementById('siteBlockImportManualPane');
    const siteBlockManualInput = document.getElementById('siteBlockManualInput');
    const siteBlockManualImportConfirm = document.getElementById('siteBlockManualImportConfirm');
    const siteBlockImportStatus = document.getElementById('siteBlockImportStatus');
    const siteBlockTipText = document.getElementById('siteBlockTipText');
    const smartSkipCodeLinksToggle = document.getElementById('smartSkipCodeLinks');
    const smartSkipEditableTextboxesToggle = document.getElementById('smartSkipEditableTextboxes');
    const resetPopupSizeButton = document.getElementById('resetPopupSize');
    const blockSiteBtn = document.getElementById('blockSiteBtn');
    const siteBlockQuickCard = document.getElementById('siteBlockQuickCard');
    const blockSiteRuleBtn = document.getElementById('blockSiteRuleBtn');
    const siteRuleHostInput = document.getElementById('siteRuleHostInput');
    const siteRulePageTitle = document.getElementById('siteRulePageTitle');
    const siteRuleTipText = document.getElementById('siteRuleTipText');
    const siteRuleParentLabel = document.getElementById('siteRuleParentLabel');
    const siteRuleExactLabel = document.getElementById('siteRuleExactLabel');
    const siteRuleSubdomainLabel = document.getElementById('siteRuleSubdomainLabel');
    const siteRuleAddBtn = document.getElementById('siteRuleAddBtn');
    const siteRuleStatus = document.getElementById('siteRuleStatus');
    const siteBlockQuickTitle = document.getElementById('siteBlockQuickTitle');
    const siteBlockQuickTooltip = document.getElementById('siteBlockQuickTooltip');
    const annotationToAISettingsBtn = document.getElementById('annotationToAISettingsBtn');
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
    let siteRuleHoverTimer = null;
    // 下载相关元素
    const downloadBtn = document.getElementById('downloadBtn');
    const updateAllBtn = document.getElementById('updateAllBtn');
    const downloadModal = document.getElementById('downloadModal');
    const modalClose = document.getElementById('modalClose');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const dictList = document.getElementById('dictList');
    const dictSearchInput = document.getElementById('dictSearchInput');
    const dictTagFilters = document.getElementById('dictTagFilters');
    const downloadProgress = document.getElementById('downloadProgress');
    const downloadingDict = document.getElementById('downloadingDict');
    const downloadErrorOk = document.getElementById('downloadErrorOk');
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const SERVER_URL = 'https://api.jieci.top';
    const WORD_CARD_POPUP_SIZE_STORAGE_KEY = 'wordCardPopupSize';
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
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const spaceBelow = window.innerHeight - iconRect.bottom;
        const spaceAbove = iconRect.top;
        if (spaceBelow < tooltipRect.height + padding && spaceAbove > spaceBelow) {
            icon.classList.add('tooltip-up');
        } else {
            icon.classList.remove('tooltip-up');
        }
        icon.classList.remove('tooltip-align-left', 'tooltip-align-right');
        const centeredLeft = iconRect.left + (iconRect.width - tooltipRect.width) / 2;
        const centeredRight = centeredLeft + tooltipRect.width;
        const shouldPreferRightAlign = iconRect.left > (viewportWidth / 2);
        if (centeredRight >= viewportWidth - padding || shouldPreferRightAlign) {
            icon.classList.add('tooltip-align-right');
        } else if (centeredLeft < padding) {
            icon.classList.add('tooltip-align-left');
        }
        tooltip.style.left = '';
        tooltip.style.top = '';
    };
    const showHelpTooltip = (icon) => {
        icon.classList.add('is-visible');
        requestAnimationFrame(() => updateHelpTooltipPosition(icon));
    };
    const hideHelpTooltip = (icon) => {
        icon.classList.remove('is-visible');
        icon.classList.remove('tooltip-up');
        icon.classList.remove('tooltip-align-left', 'tooltip-align-right');
    };
    helpIcons.forEach((icon) => {
        icon.addEventListener('mouseenter', () => showHelpTooltip(icon));
        icon.addEventListener('mouseleave', () => hideHelpTooltip(icon));
        icon.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    });
    window.addEventListener('resize', scheduleOverflowUpdate);
    const pages = [pageMain, pageVocab, pageAdvanced, pageStyle, pageAnnotation, pageSearch, pageBlocked, pageFavorites, pageSiteBlock, pageSiteRule, pageAbout, pageAISettings];
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
        chrome.storage.local.set({[OOBE_STEP_KEY]: step}).catch(() => {
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
        const result = await chrome.storage.local.get(OOBE_COMPLETION_KEY);
        const current = Number.isFinite(result[OOBE_COMPLETION_KEY])
            ? result[OOBE_COMPLETION_KEY]
            : 0;
        const next = Math.min(OOBE_REQUIRED_COUNT, current + 1);
        await chrome.storage.local.set({[OOBE_COMPLETION_KEY]: next});
        await chrome.storage.local.remove(OOBE_STEP_KEY);
        setOobeVisible(false);
        showPage(pageMain);
    };
    const getActiveTabs = async () => {
        return chrome.tabs.query({active: true, currentWindow: true});
    };
    const notifyActiveTabs = async (message) => {
        const tabs = await getActiveTabs();
        tabs.forEach(tab => {
            if (tab.id == null) {
                return;
            }
            chrome.tabs.sendMessage(tab.id, message).catch(() => {
            });
        });
    };
    // 显示模式值映射
    const displayModeMap = {
        0: 'off',
        1: 'underline',
        2: 'annotation',
        3: 'replace'
    };
    const reverseDisplayModeMap = {
        'off': 0,
        'underline': 1,
        'annotation': 2,
        'replace': 3
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
    const siteBlockModeMap = {
        0: 'blacklist',
        1: 'whitelist'
    };
    const reverseSiteBlockModeMap = {
        'blacklist': 0,
        'whitelist': 1
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
    let siteBlockMode = 'blacklist';
    let siteBlockSelected = new Set();
    let currentSiteHost = '';
    let currentVocabList = [];
    let serverDictList = [];
    let selectedDictTags = new Set();
    const filterWords = (words, query) => {
        const normalized = normalizeWord(query);
        if (!normalized) {
            return words;
        }
        return words.filter(word => word.includes(normalized));
    };
    const normalizeHost = (host) => String(host || '').trim().toLowerCase().replace(/\.+$/, '');
    const normalizeSiteHostInput = (input) => {
        const cleaned = normalizeSiteRule(input);
        if (!cleaned) {
            return '';
        }
        return normalizeHost(cleaned.startsWith('*.') ? cleaned.slice(2) : cleaned);
    };
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
    const isHostMatchedByRules = (host, rules) => {
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
    const isHostBlocked = (host, rules, mode = 'blacklist') => {
        const matched = isHostMatchedByRules(host, rules);
        if (mode === 'whitelist') {
            return !matched;
        }
        return matched;
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
    const resolveSiteRuleCandidates = (host) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) {
            return null;
        }
        const parts = normalizedHost.split('.').filter(Boolean);
        const parentSuffix = parts.length >= 2
            ? parts.slice(-2).join('.')
            : normalizedHost;
        return {
            parentWildcard: `*.${parentSuffix}`,
            exact: normalizedHost,
            subdomainWildcard: `*.${normalizedHost}`
        };
    };
    const renderSiteRuleCandidates = () => {
        if (!siteRuleHostInput || !siteRuleParentLabel || !siteRuleExactLabel || !siteRuleSubdomainLabel) {
            return null;
        }
        const actionText = siteBlockMode === 'whitelist' ? '启用' : '禁用';
        const normalizedHost = normalizeSiteHostInput(siteRuleHostInput.value);
        const candidates = resolveSiteRuleCandidates(normalizedHost);
        if (!candidates) {
            siteRuleParentLabel.textContent = `在 *.example.com 中${actionText}`;
            siteRuleExactLabel.textContent = `在 example.com 中${actionText}`;
            siteRuleSubdomainLabel.textContent = `在 *.example.com 中${actionText}`;
            return null;
        }
        siteRuleParentLabel.textContent = `在 ${candidates.parentWildcard} 中${actionText}`;
        siteRuleExactLabel.textContent = `在 ${candidates.exact} 中${actionText}`;
        siteRuleSubdomainLabel.textContent = `在 ${candidates.subdomainWildcard} 中${actionText}`;
        return candidates;
    };
    const resetSiteRuleSelection = () => {
        const exactOption = document.querySelector('input[name="siteRuleMode"][value="exact"]');
        if (exactOption) {
            exactOption.checked = true;
        }
    };
    const clearSiteRuleStatus = () => {
        if (!siteRuleStatus) {
            return;
        }
        siteRuleStatus.textContent = '';
        siteRuleStatus.classList.remove('error');
    };
    const showSiteRuleStatus = (message, isError = false) => {
        if (!siteRuleStatus) {
            return;
        }
        siteRuleStatus.textContent = message;
        siteRuleStatus.classList.toggle('error', isError);
    };
    const updateSiteBlockCopy = () => {
        const whitelist = siteBlockMode === 'whitelist';
        if (siteBlockQuickTitle) {
            siteBlockQuickTitle.textContent = whitelist ? '想让插件标注此网站？' : '想让插件不标注此网站？';
        }
        if (siteBlockQuickTooltip) {
            siteBlockQuickTooltip.textContent = whitelist
                ? '点击右侧“标注此网站”按钮，即可将当前网站加入白名单。再次点击可移出白名单。'
                : '点击右侧“以后不再标注此网站”按钮，即可让插件在此网站上禁用。再次点击可取消。';
        }
        if (siteBlockTipText) {
            siteBlockTipText.textContent = whitelist
                ? '可以配置哪些网站允许插件工作；不在列表中的网站将不进行标注。'
                : '可以配置在哪些网站上插件不进行工作。';
        }
        if (siteRulePageTitle) {
            siteRulePageTitle.textContent = whitelist ? '添加白名单规则' : '添加黑名单规则';
        }
        if (siteRuleTipText) {
            siteRuleTipText.textContent = whitelist
                ? '输入域名后，选择启用范围并添加到网站白名单。'
                : '输入域名后，选择禁用范围并添加到网站黑名单。';
        }
    };
    const canTriggerQuickSiteRuleOpen = () => {
        if (!blockSiteBtn || blockSiteBtn.disabled) {
            return false;
        }
        if (!currentSiteHost) {
            return false;
        }
        const blocked = isHostBlocked(currentSiteHost, siteBlockRules, siteBlockMode);
        if (siteBlockMode === 'whitelist') {
            return blocked;
        }
        return !blocked;
    };
    const cancelSiteRuleHoverOpen = () => {
        if (siteRuleHoverTimer) {
            clearTimeout(siteRuleHoverTimer);
            siteRuleHoverTimer = null;
        }
        if (siteBlockQuickCard) {
            siteBlockQuickCard.classList.remove('is-hover-progress');
        }
    };
    const openSiteRulePage = async () => {
        await loadCurrentSiteHost();
        if (siteRuleHostInput && currentSiteHost) {
            siteRuleHostInput.value = currentSiteHost;
        }
        resetSiteRuleSelection();
        clearSiteRuleStatus();
        renderSiteRuleCandidates();
        showPage(pageSiteRule);
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
    const renderWordSelectionList = ({
                                         listElement,
                                         filteredItems,
                                         selectedItems,
                                         emptyText,
                                         onToggleSelection,
                                         onDeleteItem
                                     }) => {
        if (!listElement) {
            return;
        }
        listElement.replaceChildren();
        if (filteredItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = emptyText;
            listElement.appendChild(empty);
            return;
        }
        filteredItems.forEach((itemText) => {
            const item = document.createElement('div');
            item.className = 'word-item';
            const left = document.createElement('div');
            left.className = 'word-left';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'word-checkbox';
            checkbox.checked = selectedItems.has(itemText);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedItems.add(itemText);
                } else {
                    selectedItems.delete(itemText);
                }
                onToggleSelection();
            });
            const text = document.createElement('div');
            text.className = 'word-text';
            text.textContent = itemText;
            left.appendChild(checkbox);
            left.appendChild(text);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'word-delete';
            deleteButton.textContent = 'x';
            deleteButton.addEventListener('click', async () => {
                await onDeleteItem(itemText);
            });
            item.appendChild(left);
            item.appendChild(deleteButton);
            listElement.appendChild(item);
        });
    };
    const renderBlockedWords = () => {
        const filtered = filterWords(blockedWords, blockedSearchInput ? blockedSearchInput.value : '');
        updateBlockedActions(filtered);
        renderWordSelectionList({
            listElement: blockedList,
            filteredItems: filtered,
            selectedItems: blockedSelected,
            emptyText: '暂无屏蔽词',
            onToggleSelection: () => updateBlockedActions(filtered),
            onDeleteItem: async (word) => {
                blockedSelected.delete(word);
                blockedWords = blockedWords.filter(itemWord => itemWord !== word);
                await persistBlockedWords();
                renderBlockedWords();
            }
        });
    };
    const renderFavorites = () => {
        const filtered = filterWords(favoriteWords, favoritesSearchInput ? favoritesSearchInput.value : '');
        updateFavoritesActions(filtered);
        renderWordSelectionList({
            listElement: favoritesList,
            filteredItems: filtered,
            selectedItems: favoritesSelected,
            emptyText: '暂无收藏的单词',
            onToggleSelection: () => updateFavoritesActions(filtered),
            onDeleteItem: async (word) => {
                favoritesSelected.delete(word);
                favoriteWords = favoriteWords.filter(itemWord => itemWord !== word);
                await persistFavoriteWords();
                renderFavorites();
            }
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
        const filtered = filterWords(siteBlockRules, siteBlockSearchInput ? siteBlockSearchInput.value : '');
        updateSiteBlockActions(filtered);
        renderWordSelectionList({
            listElement: siteBlockList,
            filteredItems: filtered,
            selectedItems: siteBlockSelected,
            emptyText: '暂无黑名单网站',
            onToggleSelection: () => updateSiteBlockActions(filtered),
            onDeleteItem: async (rule) => {
                siteBlockSelected.delete(rule);
                siteBlockRules = siteBlockRules.filter(itemRule => itemRule !== rule);
                await persistSiteBlockRules();
                renderSiteBlockRules();
                updateBlockSiteButton();
            }
        });
    };
    const persistBlockedWords = async () => {
        const normalized = Array.from(new Set(blockedWords.map(normalizeWord).filter(Boolean))).sort();
        blockedWords = normalized;
        const trieIndex = buildEnglishTrieIndex(normalized);
        await chrome.storage.local.set({
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
        await chrome.storage.local.set({favoriteWords: normalized});
    };
    const persistSiteBlockRules = async () => {
        const normalized = Array.from(new Set(siteBlockRules.map(normalizeSiteRule).filter(Boolean))).sort();
        siteBlockRules = normalized;
        const index = compileSiteRules(normalized);
        await chrome.storage.local.set({
            siteBlockRules: normalized,
            siteBlockIndex: index
        });
        await notifyActiveTabs({
            action: 'updateSiteBlacklist',
            rules: normalized,
            index: index
        });
    };
    const persistSiteBlockMode = async (mode) => {
        siteBlockMode = mode === 'whitelist' ? 'whitelist' : 'blacklist';
        await chrome.storage.local.set({siteBlockMode});
        await notifyActiveTabs({
            action: 'updateSiteBlockMode',
            mode: siteBlockMode
        });
        updateSiteBlockCopy();
        renderSiteRuleCandidates();
        await updateBlockSiteButton();
    };
    const parseWordLines = (content) => {
        return content
            .split(/\r?\n/)
            .map(line => normalizeWord(line))
            .filter(Boolean);
    };
    const setSiteBlockImportStatus = (message, isError = false) => {
        if (!siteBlockImportStatus) {
            return;
        }
        siteBlockImportStatus.textContent = message || '';
        siteBlockImportStatus.classList.toggle('error', isError);
    };
    const showSiteBlockImportPane = (mode) => {
        const showManual = mode === 'manual';
        if (siteBlockImportFilePane) {
            siteBlockImportFilePane.style.display = showManual ? 'none' : 'block';
        }
        if (siteBlockImportManualPane) {
            siteBlockImportManualPane.style.display = showManual ? 'block' : 'none';
        }
    };
    const openSiteBlockImportModal = () => {
        if (!siteBlockImportModal) {
            return;
        }
        setSiteBlockImportStatus('');
        showSiteBlockImportPane('file');
        siteBlockImportModal.classList.add('show');
    };
    const closeSiteBlockImportModal = () => {
        if (!siteBlockImportModal) {
            return;
        }
        siteBlockImportModal.classList.remove('show');
        if (siteBlockImportInput) {
            siteBlockImportInput.value = '';
        }
    };
    const parseSiteRuleBulkInput = (content) => {
        return String(content || '')
            .split(/[\r\n,，\s;；]+/)
            .map(token => normalizeSiteRule(token))
            .filter(Boolean);
    };
    const importSiteRules = async (rules) => {
        const normalized = Array.from(new Set((rules || []).map(normalizeSiteRule).filter(Boolean)));
        if (normalized.length === 0) {
            return {added: 0, total: 0};
        }
        const existing = new Set(siteBlockRules.map(normalizeSiteRule).filter(Boolean));
        let added = 0;
        normalized.forEach((rule) => {
            if (!existing.has(rule)) {
                added += 1;
                existing.add(rule);
            }
        });
        siteBlockRules = Array.from(existing);
        siteBlockSelected = new Set();
        await persistSiteBlockRules();
        renderSiteBlockRules();
        await updateBlockSiteButton();
        return {added, total: normalized.length};
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
    const requestTabHost = (tabId) => {
        return new Promise((resolve) => {
            if (tabId == null) {
                resolve('');
                return;
            }
            chrome.tabs.sendMessage(tabId, {action: 'getPageHost'}, (response) => {
                if (chrome.runtime.lastError) {
                    resolve('');
                    return;
                }
                resolve(response && response.host ? response.host : '');
            });
        });
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
        updateSiteBlockCopy();
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
        const blocked = isHostBlocked(currentSiteHost, siteBlockRules, siteBlockMode);
        blockSiteBtn.disabled = false;
        if (siteBlockMode === 'whitelist') {
            const allowed = !blocked;
            blockSiteBtn.textContent = allowed
                ? '此网站已允许标注 点此取消'
                : '标注此网站';
            return;
        }
        blockSiteBtn.textContent = blocked
            ? '此网站已禁用标注 点此取消'
            : '以后不再标注此网站';
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
    if (aiSettingsBack) {
        aiSettingsBack.addEventListener('click', () => showPage(pageAnnotation));
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
    if (siteRuleBack) {
        siteRuleBack.addEventListener('click', () => {
            cancelSiteRuleHoverOpen();
            showPage(pageMain);
        });
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
            chrome.tabs.create({url: 'https://jieci.top/testplugin.html'});
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
        const max = parseInt(displayModeSlider.max, 10) || 1;
        const stepWidth = 100 / (max + 1);
        displayModeThumb.style.width = `${stepWidth}%`;
        displayModeThumb.style.left = `${parseInt(value, 10) * stepWidth}%`;
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
        const isCountMode = parseInt(value, 10) === 2;
        if (dedupeRepeatCountSetting) {
            dedupeRepeatCountSetting.style.display = isCountMode ? '' : 'none';
        }
        if (clearDedupeCountsSetting) {
            clearDedupeCountsSetting.style.display = isCountMode ? '' : 'none';
        }
    }

    function updateSiteBlockModeSliderUI(value) {
        if (!siteBlockModeSlider || !siteBlockModeThumb) {
            return;
        }
        const max = parseInt(siteBlockModeSlider.max, 10) || 1;
        const stepWidth = 100 / (max + 1);
        siteBlockModeThumb.style.width = `${stepWidth}%`;
        siteBlockModeThumb.style.left = `${parseInt(value, 10) * stepWidth}%`;
        siteBlockModeLabels.forEach((label, index) => {
            if (index === parseInt(value, 10)) {
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
        await chrome.storage.local.set({displayMode: mode});
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
        await chrome.storage.local.set({annotationMode: mode});
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
        await chrome.storage.local.set({dedupeMode: mode});
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
    if (siteBlockModeSlider) {
        siteBlockModeSlider.addEventListener('input', async () => {
            const value = parseInt(siteBlockModeSlider.value, 10);
            const mode = siteBlockModeMap[value] || 'blacklist';
            updateSiteBlockModeSliderUI(value);
            await persistSiteBlockMode(mode);
        });
    }
    siteBlockModeLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!siteBlockModeSlider) {
                return;
            }
            siteBlockModeSlider.value = index;
            siteBlockModeSlider.dispatchEvent(new Event('input'));
        });
    });
    if (blockSiteBtn) {
        blockSiteBtn.addEventListener('click', async () => {
            cancelSiteRuleHoverOpen();
            await loadCurrentSiteHost();
            if (!currentSiteHost) {
                return;
            }
            const rule = normalizeHost(currentSiteHost);
            if (!rule) {
                return;
            }
            const blocked = isHostBlocked(currentSiteHost, siteBlockRules, siteBlockMode);
            if (siteBlockMode === 'whitelist') {
                const allowed = !blocked;
                if (allowed) {
                    const ruleToRemove = findBestMatchingRule(currentSiteHost, siteBlockRules);
                    if (!ruleToRemove) {
                        return;
                    }
                    siteBlockRules = siteBlockRules.filter(item => normalizeSiteRule(item) !== normalizeSiteRule(ruleToRemove));
                } else {
                    siteBlockRules = Array.from(new Set([...siteBlockRules, rule]));
                }
            } else if (blocked) {
                const ruleToRemove = findBestMatchingRule(currentSiteHost, siteBlockRules);
                if (!ruleToRemove) {
                    return;
                }
                siteBlockRules = siteBlockRules.filter(item => normalizeSiteRule(item) !== normalizeSiteRule(ruleToRemove));
            } else {
                siteBlockRules = Array.from(new Set([...siteBlockRules, rule]));
            }
            siteBlockSelected = new Set();
            await persistSiteBlockRules();
            renderSiteBlockRules();
            await updateBlockSiteButton();
        });
    }
    if (blockSiteRuleBtn) {
        blockSiteRuleBtn.addEventListener('click', async () => {
            cancelSiteRuleHoverOpen();
            await openSiteRulePage();
        });
    }
    if (siteBlockQuickCard) {
        siteBlockQuickCard.addEventListener('mouseenter', async () => {
            cancelSiteRuleHoverOpen();
            await loadCurrentSiteHost();
            await updateBlockSiteButton();
            if (!canTriggerQuickSiteRuleOpen()) {
                return;
            }
            siteBlockQuickCard.classList.add('is-hover-progress');
            siteRuleHoverTimer = setTimeout(async () => {
                siteRuleHoverTimer = null;
                siteBlockQuickCard.classList.remove('is-hover-progress');
                await openSiteRulePage();
            }, 2000);
        });
        siteBlockQuickCard.addEventListener('mouseleave', () => {
            cancelSiteRuleHoverOpen();
        });
    }
    if (siteRuleHostInput) {
        siteRuleHostInput.addEventListener('input', () => {
            clearSiteRuleStatus();
            renderSiteRuleCandidates();
        });
    }
    if (siteRuleAddBtn) {
        siteRuleAddBtn.addEventListener('click', async () => {
            if (!siteRuleHostInput) {
                return;
            }
            const normalizedHost = normalizeSiteHostInput(siteRuleHostInput.value);
            if (!normalizedHost) {
                showSiteRuleStatus('请输入有效域名', true);
                return;
            }
            if (siteRuleHostInput.value !== normalizedHost) {
                siteRuleHostInput.value = normalizedHost;
            }
            const candidates = resolveSiteRuleCandidates(normalizedHost);
            if (!candidates) {
                showSiteRuleStatus('无法生成规则，请检查域名', true);
                return;
            }
            const selected = document.querySelector('input[name="siteRuleMode"]:checked');
            const mode = selected ? selected.value : 'exact';
            let nextRule = candidates.exact;
            if (mode === 'parent-wildcard') {
                nextRule = candidates.parentWildcard;
            } else if (mode === 'subdomain-wildcard') {
                nextRule = candidates.subdomainWildcard;
            }
            const normalizedRule = normalizeSiteRule(nextRule);
            if (!normalizedRule) {
                showSiteRuleStatus('规则格式无效', true);
                return;
            }
            const ruleExists = siteBlockRules.some((rule) => normalizeSiteRule(rule) === normalizedRule);
            if (ruleExists) {
                showSiteRuleStatus('规则已存在');
                return;
            }
            siteBlockRules = Array.from(new Set([...siteBlockRules, normalizedRule]));
            siteBlockSelected = new Set();
            await persistSiteBlockRules();
            renderSiteBlockRules();
            await updateBlockSiteButton();
            clearSiteRuleStatus();
            cancelSiteRuleHoverOpen();
            showPage(pageMain);
        });
    }
    if (annotationToAISettingsBtn) {
        annotationToAISettingsBtn.addEventListener('click', () => showPage(pageAISettings));
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
        await chrome.storage.local.set({maxMatchesPerNode: maxMatches});
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
        await chrome.storage.local.set({minTextLength: minLength});
        await notifyActiveTabs({
            action: 'updateMinTextLength',
            minLength: minLength
        });
    });
    dedupeRepeatCountSlider.addEventListener('input', async () => {
        const repeatCount = parseInt(dedupeRepeatCountSlider.value, 10) || 10;
        dedupeRepeatCountLabel.textContent = repeatCount;
        await chrome.storage.local.set({dedupeRepeatCount: repeatCount});
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
        await chrome.storage.local.set({smartSkipCodeLinks: enabled});
        await notifyActiveTabs({
            action: 'updateSmartSkipCodeLinks',
            enabled: enabled
        });
    });
    if (smartSkipEditableTextboxesToggle) {
        smartSkipEditableTextboxesToggle.addEventListener('change', async () => {
            const enabled = smartSkipEditableTextboxesToggle.checked;
            await chrome.storage.local.set({smartSkipEditableTextboxes: enabled});
            await notifyActiveTabs({
                action: 'updateSmartSkipEditableTextboxes',
                enabled: enabled
            });
        });
    }
    if (disableAnnotationUnderlineToggle) {
        disableAnnotationUnderlineToggle.addEventListener('change', async () => {
            const disabled = disableAnnotationUnderlineToggle.checked;
            await chrome.storage.local.set({disableAnnotationUnderline: disabled});
            await notifyActiveTabs({
                action: 'updateAnnotationUnderline',
                disabled: disabled
            });
        });
    }
    if (annotationWordCardPopupEnabledToggle) {
        annotationWordCardPopupEnabledToggle.addEventListener('change', async () => {
            const enabled = annotationWordCardPopupEnabledToggle.checked;
            await chrome.storage.local.set({annotationWordCardPopupEnabled: enabled});
            await notifyActiveTabs({
                action: 'updateAnnotationWordCardPopup',
                enabled: enabled
            });
        });
    }
    if (wordCardHighlightMatchedChineseToggle) {
        wordCardHighlightMatchedChineseToggle.addEventListener('change', async () => {
            const enabled = wordCardHighlightMatchedChineseToggle.checked;
            await chrome.storage.local.set({wordCardHighlightMatchedChinese: enabled});
            await notifyActiveTabs({
                action: 'updateWordCardMeaningHighlight',
                enabled: enabled
            });
        });
    }
    const debugModeToggle = document.getElementById('debugMode');
    debugModeToggle.addEventListener('change', async () => {
        const enabled = debugModeToggle.checked;
        await chrome.storage.local.set({debugMode: enabled});
        await notifyActiveTabs({
            action: 'updateDebugMode',
            enabled: enabled
        });
    });
    if (resetPopupSizeButton) {
        resetPopupSizeButton.addEventListener('click', async () => {
            const originalText = resetPopupSizeButton.textContent;
            await chrome.storage.local.remove(WORD_CARD_POPUP_SIZE_STORAGE_KEY);
            await notifyActiveTabs({action: 'resetWordCardPopupSize'});
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
        const isCustomMode = mode === 'custom';
        highlightColorInput.disabled = !isCustomMode;
        highlightColorInput.style.display = isCustomMode ? '' : 'none';
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

    async function initAI() {
        const aiModeSelect = document.getElementById('aiModeSelect');
        const aiModeErrorHint = document.getElementById('aiModeErrorHint');
        const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');
        const speedValue = document.getElementById('speedValue');
        const aiModelSourceSection = document.getElementById('aiModelSourceSection');
        const aiModelStatus = document.getElementById('aiModelStatus');
        const aiDownloadSection = document.getElementById('aiDownloadSection');
        const aiDownloadBtn = document.getElementById('aiDownloadBtn');
        const aiUninstallBtn = document.getElementById('aiUninstallBtn');
        const aiDownloadProgressWrap = document.getElementById('aiDownloadProgressWrap');
        const aiDownloadText = document.getElementById('aiDownloadText');
        const aiDownloadPercent = document.getElementById('aiDownloadPercent');
        const aiDownloadBar = document.getElementById('aiDownloadBar');
        const aiTriggerSelect = document.getElementById('aiTriggerSelect');
        const aiTriggerDivider = document.getElementById('aiTriggerDivider');
        const aiTriggerSection = document.getElementById('aiTriggerSection');
        const aiParamsDivider = document.getElementById('aiParamsDivider');
        const aiThresholdSection = document.getElementById('aiThresholdSection');
        const aiThresholdSlider = document.getElementById('aiThresholdSlider');
        const aiThresholdLabel = document.getElementById('aiThresholdLabel');
        const aiDelaySection = document.getElementById('aiDelaySection');
        const aiDelaySlider = document.getElementById('aiDelaySlider');
        const aiDelayLabel = document.getElementById('aiDelayLabel');
        const aiTimeoutSection = document.getElementById('aiTimeoutSection');
        const aiTimeoutSlider = document.getElementById('aiTimeoutSlider');
        const aiTimeoutLabel = document.getElementById('aiTimeoutLabel');
        const aiBenchmarkDivider = document.getElementById('aiBenchmarkDivider');
        const aiBenchmarkSection = document.getElementById('aiBenchmarkSection');
        const benchmarkSuggestion = document.getElementById('benchmarkSuggestion');
        const AI_DOWNLOAD_PROGRESS_AUTO_HIDE_MS = 5000;
        let modelReady = false;
        let aiModeErrorTimer = null;
        let aiDownloadProgressHideTimer = null;

        if (!aiModeSelect || !runBenchmarkBtn || !aiTriggerSelect) {
            return;
        }

        const settings = await chrome.storage.local.get([
            'aiMode',
            'aiModelSource',
            'aiModelInfoUrl',
            'aiTrigger',
            'aiSimilarityThreshold',
            'aiProcessingDelay',
            'aiSessionTimeoutMs'
        ]);
        const currentAiMode = settings.aiMode || 'none';
        const currentModelSource = 'cloud';
        const currentModelInfoUrl = settings.aiModelInfoUrl || 'https://api.jieci.top/model/onnx/info.json';
        const currentAiTrigger = settings.aiTrigger || 'all';
        const currentThreshold = settings.aiSimilarityThreshold !== undefined ? settings.aiSimilarityThreshold : 0.25;
        const currentDelay = settings.aiProcessingDelay !== undefined ? settings.aiProcessingDelay : 0;
        const currentTimeoutMs = settings.aiSessionTimeoutMs !== undefined ? Number(settings.aiSessionTimeoutMs) : 5000;
        const currentTimeoutSec = Math.max(1, Math.min(15, Math.round(currentTimeoutMs / 1000)));

        aiModeSelect.value = currentAiMode;
        aiTriggerSelect.value = currentAiTrigger;
        if (aiThresholdSlider) {
            aiThresholdSlider.value = currentThreshold;
            if (aiThresholdLabel) aiThresholdLabel.textContent = parseFloat(currentThreshold).toFixed(2);
        }
        if (aiDelaySlider) {
            aiDelaySlider.value = currentDelay;
            if (aiDelayLabel) aiDelayLabel.textContent = `${currentDelay}ms`;
        }
        if (aiTimeoutSlider) {
            aiTimeoutSlider.value = currentTimeoutSec;
            if (aiTimeoutLabel) aiTimeoutLabel.textContent = `${currentTimeoutSec}s`;
        }

        updateAIUI(currentAiMode);
        await chrome.storage.local.set({
            aiModelSource: currentModelSource,
            aiModelInfoUrl: currentModelInfoUrl
        });
        await notifyActiveTabs({
            action: 'updateAIModelSource',
            source: currentModelSource,
            infoUrl: currentModelInfoUrl
        });
        await notifyActiveTabs({
            action: 'updateAITimeout',
            timeoutMs: currentTimeoutSec * 1000
        });
        await refreshModelStatus();
        if (currentAiMode !== 'none' && !modelReady) {
            aiModeSelect.value = 'none';
            await chrome.storage.local.set({aiMode: 'none'});
            updateAIUI('none');
            await notifyActiveTabs({action: 'updateAIMode', mode: 'none'});
        }

        aiModeSelect.addEventListener('change', async () => {
            const mode = aiModeSelect.value;
            if (mode !== 'none' && !modelReady) {
                showAiModeError('请先下载AI模型');
                aiModeSelect.value = 'none';
                await chrome.storage.local.set({aiMode: 'none'});
                updateAIUI('none');
                await notifyActiveTabs({action: 'updateAIMode', mode: 'none'});
                return;
            }
            await chrome.storage.local.set({aiMode: mode});
            updateAIUI(mode);
            await notifyActiveTabs({action: 'updateAIMode', mode});
        });

        if (aiDownloadBtn) {
            aiDownloadBtn.addEventListener('click', async () => {
                clearAiDownloadProgressHideTimer();
                aiDownloadBtn.disabled = true;
                await chrome.runtime.sendMessage({
                    type: 'ai-download-cloud-model',
                    infoUrl: currentModelInfoUrl
                }).catch(() => ({}));
                await trackDownloadProgress();
                aiDownloadBtn.disabled = false;
                await refreshModelStatus();
            });
        }

        if (aiUninstallBtn) {
            aiUninstallBtn.addEventListener('click', async () => {
                aiUninstallBtn.disabled = true;
                await chrome.runtime.sendMessage({type: 'ai-uninstall-cloud-model'}).catch(() => ({}));
                clearAiDownloadProgressHideTimer();
                if (aiDownloadProgressWrap) {
                    aiDownloadProgressWrap.style.display = 'none';
                }
                aiModeSelect.value = 'none';
                await chrome.storage.local.set({aiMode: 'none'});
                updateAIUI('none');
                await notifyActiveTabs({action: 'updateAIMode', mode: 'none'});
                await refreshModelStatus();
                aiUninstallBtn.disabled = false;
            });
        }

        aiTriggerSelect.addEventListener('change', async () => {
            const trigger = aiTriggerSelect.value;
            await chrome.storage.local.set({aiTrigger: trigger});
            await notifyActiveTabs({action: 'updateAITrigger', trigger});
        });

        if (aiThresholdSlider) {
            aiThresholdSlider.addEventListener('input', async () => {
                const val = parseFloat(aiThresholdSlider.value);
                if (aiThresholdLabel) aiThresholdLabel.textContent = val.toFixed(2);
                await chrome.storage.local.set({aiSimilarityThreshold: val});
                await notifyActiveTabs({action: 'updateAIThreshold', threshold: val});
            });
        }

        if (aiDelaySlider) {
            aiDelaySlider.addEventListener('input', async () => {
                const val = parseInt(aiDelaySlider.value, 10);
                if (aiDelayLabel) aiDelayLabel.textContent = `${val}ms`;
                await chrome.storage.local.set({aiProcessingDelay: val});
                await notifyActiveTabs({action: 'updateAIDelay', delay: val});
            });
        }

        if (aiTimeoutSlider) {
            aiTimeoutSlider.addEventListener('input', async () => {
                const sec = parseInt(aiTimeoutSlider.value, 10);
                const timeoutMs = Math.max(1000, Math.min(15000, sec * 1000));
                if (aiTimeoutLabel) aiTimeoutLabel.textContent = `${sec}s`;
                await chrome.storage.local.set({aiSessionTimeoutMs: timeoutMs});
                await notifyActiveTabs({action: 'updateAITimeout', timeoutMs});
            });
        }

        runBenchmarkBtn.addEventListener('click', async () => {
            await runBenchmark();
        });

        function updateAIUI(mode) {
            const isEnabled = mode !== 'none';
            if (aiModelSourceSection) aiModelSourceSection.style.display = 'block';
            if (aiTriggerDivider) aiTriggerDivider.style.display = isEnabled ? 'block' : 'none';
            if (aiTriggerSection) aiTriggerSection.style.display = isEnabled ? 'block' : 'none';
            if (aiParamsDivider) aiParamsDivider.style.display = isEnabled ? 'block' : 'none';
            if (aiThresholdSection) aiThresholdSection.style.display = isEnabled ? 'block' : 'none';
            if (aiDelaySection) aiDelaySection.style.display = isEnabled ? 'block' : 'none';
            if (aiTimeoutSection) aiTimeoutSection.style.display = isEnabled ? 'block' : 'none';
            if (aiBenchmarkDivider) aiBenchmarkDivider.style.display = isEnabled ? 'block' : 'none';
            if (aiBenchmarkSection) aiBenchmarkSection.style.display = isEnabled ? 'block' : 'none';
        }

        function showAiModeError(message) {
            if (!aiModeErrorHint) return;
            if (aiModeErrorTimer) {
                clearTimeout(aiModeErrorTimer);
                aiModeErrorTimer = null;
            }
            aiModeErrorHint.textContent = message;
            aiModeErrorHint.style.display = 'block';
            aiModeErrorTimer = setTimeout(() => {
                aiModeErrorHint.style.display = 'none';
                aiModeErrorTimer = null;
            }, 3000);
        }

        function clearAiDownloadProgressHideTimer() {
            if (aiDownloadProgressHideTimer) {
                clearTimeout(aiDownloadProgressHideTimer);
                aiDownloadProgressHideTimer = null;
            }
        }

        function scheduleAiDownloadProgressHide() {
            clearAiDownloadProgressHideTimer();
            aiDownloadProgressHideTimer = setTimeout(() => {
                if (aiDownloadProgressWrap) {
                    aiDownloadProgressWrap.style.display = 'none';
                }
                aiDownloadProgressHideTimer = null;
            }, AI_DOWNLOAD_PROGRESS_AUTO_HIDE_MS);
        }

        async function refreshModelStatus() {
            if (!aiModelStatus || !aiDownloadSection) return;
            aiModelStatus.textContent = '';
            aiModelStatus.style.display = 'none';
            const resp = await chrome.runtime.sendMessage({
                type: 'ai-model-status',
                infoUrl: currentModelInfoUrl
            }).catch(() => null);
            if (!resp || !resp.ok || !resp.status) {
                modelReady = false;
                aiDownloadSection.style.display = 'block';
                if (aiDownloadBtn) aiDownloadBtn.style.display = 'inline-flex';
                if (aiUninstallBtn) aiUninstallBtn.style.display = 'none';
                return;
            }
            const {cloudReady} = resp.status;
            modelReady = !!cloudReady;
            aiDownloadSection.style.display = 'block';
            if (aiDownloadBtn) aiDownloadBtn.textContent = '下载模型';
            if (aiUninstallBtn) aiUninstallBtn.textContent = '模型已经下载 点击卸载';
            if (aiDownloadBtn) aiDownloadBtn.style.display = cloudReady ? 'none' : 'inline-flex';
            if (aiUninstallBtn) aiUninstallBtn.style.display = cloudReady ? 'inline-flex' : 'none';
            if (aiUninstallBtn) aiUninstallBtn.disabled = !cloudReady;
        }

        async function trackDownloadProgress() {
            if (!aiDownloadProgressWrap || !aiDownloadPercent || !aiDownloadBar || !aiDownloadText) return;
            clearAiDownloadProgressHideTimer();
            aiDownloadProgressWrap.style.display = 'block';
            const start = Date.now();
            while (Date.now() - start < 10 * 60 * 1000) {
                const resp = await chrome.runtime.sendMessage({type: 'ai-download-status'}).catch(() => null);
                if (!resp || !resp.ok || !resp.status) {
                    break;
                }
                const st = resp.status;
                const pct = Number(st.percent || 0);
                aiDownloadPercent.textContent = `${pct}%`;
                aiDownloadBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
                if (st.error) {
                    aiDownloadText.textContent = `下载失败: ${st.error}`;
                    return;
                }
                if (st.done) {
                    aiDownloadText.textContent = '下载完成';
                    aiDownloadPercent.textContent = '100%';
                    aiDownloadBar.style.width = '100%';
                    scheduleAiDownloadProgressHide();
                    return;
                }
                aiDownloadText.textContent = '下载中...';
                await new Promise((r) => setTimeout(r, 250));
            }
            aiDownloadText.textContent = '下载状态超时，请重试';
        }

        async function runBenchmark() {
            const mode = aiModeSelect.value;
            if (mode === 'none') return;

            runBenchmarkBtn.disabled = true;
            const originalText = runBenchmarkBtn.textContent;
            runBenchmarkBtn.textContent = '测速中...';
            speedValue.textContent = '--';

            try {
                if (mode === 'gpu') {
                    if (!navigator.gpu) {
                        alert('当前浏览器不支持 WebGPU');
                        return;
                    }
                    const adapter = await navigator.gpu.requestAdapter();
                    if (!adapter) {
                        alert('WebGPU 请求适配器失败');
                        return;
                    }
                } else if (mode === 'npu') {
                    if (!navigator.ml) {
                        alert('当前浏览器不支持 WebNN (NPU)');
                        return;
                    }
                }

                const liSao = `
帝高阳之苗裔兮，朕皇考曰伯庸。 摄提贞于孟陬兮，惟庚寅吾以降。 皇览揆余初度兮，肇锡余以嘉名。 名余曰正则兮，字余曰灵均。 纷吾既有此内美兮，又重之以修能。 扈江离与辟芷兮，纫秋兰以为佩。 汩余若将不及兮，恐年岁之不吾与。 朝搴阰之木兰兮，夕揽洲之宿莽。
日月忽其不淹兮，春与秋其代序。 惟草木之零落兮，恐美人之迟暮。 不抚壮而弃秽兮，何不改乎此度？ 乘骐骥以驰骋兮，来吾道夫先路！ 昔三后之纯粹兮，固众芳之所在。 杂申椒与菌桂兮，岂惟纫夫蕙茝！ 彼尧、舜之耿介兮，既遵道而得路。 何桀纣之昌披兮，夫唯捷径以窘步。
惟夫党人之偷乐兮，路幽昧以险隘。 岂余身之惮殃兮，恐皇舆之败绩。 忽奔走以先后兮，及前王之踵武。 荃不查余之中情兮，反信谗而齌怒。 余固知謇謇之为患兮，忍而不能舍也。 指九天以为正兮，夫唯灵修之故也。 曰黄昏以为期兮，羌中道而改路。 初既与余成言兮，后悔遁而有他。
余既不难夫离别兮，伤灵修之数化。 余既滋兰之九畹兮，又树蕙之百亩。 畦留夷与揭车兮，杂杜衡与芳芷。 冀枝叶之峻茂兮，愿俟时乎吾将刈。 虽萎绝其亦何伤兮，哀众芳之芜秽。 众皆竞进以贪婪兮，凭不厌乎求索。 羌内恕己以量人兮，各兴心而嫉妒。 忽驰骛以追逐兮，非余心之所急。
老冉冉其将至兮，恐修名之不立。 朝饮木兰之坠露兮，夕餐秋菊之落英。 苟余情其信姱以练要兮，长顑颔亦何伤。 掔木根以结茝兮，贯薜荔之落蕊。 矫菌桂以纫蕙兮，索胡绳之纚纚。 謇吾法夫前修兮，非世俗之所服。 虽不周于今之人兮，愿依彭咸之遗则。 长太息以掩涕兮，哀民生之多艰。
余虽好修姱以鞿羁兮，謇朝谇而夕替。 既替余以蕙纕兮，又申之以揽茝。 亦余心之所善兮，虽九死其犹未悔。 怨灵修之浩荡兮，终不察夫民心。 众女嫉余之蛾眉兮，谣诼谓余以善淫。 固时俗之工巧兮，偭规矩而改错。 背绳墨以追曲兮，竞周容以为度。 忳郁邑余侘傺兮，吾独穷困乎此时也。
宁溘死以流亡兮，余不忍为此态也。 鸷鸟之不群兮，自前世而固然。 何方圜之能周兮，夫孰异道而相安？ 屈心而抑志兮，忍尤而攘诟。 伏清白以死直兮，固前圣之所厚。 悔相道之不察兮，延伫乎吾将反。 回朕车以复路兮，及行迷之未远。 步余马于兰皋兮，驰椒丘且焉止息。
进不入以离尤兮，退将复修吾初服。 制芰荷以为衣兮，集芙蓉以为裳。 不吾知其亦已兮，苟余情其信芳。 高余冠之岌岌兮，长余佩之陆离。 芳与泽其杂糅兮，唯昭质其犹未亏。 忽反顾以游目兮，将往观乎四荒。 佩缤纷其繁饰兮，芳菲菲其弥章。 民生各有所乐兮，余独好修以为常。
虽体解吾犹未变兮，岂余心之可惩。 女嬃之婵媛兮，申申其詈予。 曰：“鲧婞直以亡身兮，终然夭乎羽之野。 汝何博謇而好修兮，纷独有此姱节。 薋菉葹以盈室兮，判独离而不服。 众不可户说兮，孰云察余之中情。 世并举而好朋兮，夫何茕独而不予听？ 依前圣以节中兮，喟凭心而历兹。
济沅、湘以南征兮，就重华而敶词： 启《九辩》与《九歌》兮，夏康娱以自纵。 不顾难以图后兮，五子用失乎家衖。 羿淫游以佚畋兮，又好射夫封狐。 固乱流其鲜终兮，浞又贪夫厥家。 浇身被服强圉兮，纵欲而不忍。 日康娱而自忘兮，厥首用夫颠陨。 夏桀之常违兮，乃遂焉而逢殃。
后辛之菹醢兮，殷宗用而不长。 汤、禹俨而祗敬兮，周论道而莫差。 举贤才而授能兮，循绳墨而不颇。 皇天无私阿兮，览民德焉错辅。 夫维圣哲以茂行兮，苟得用此下土。 瞻前而顾后兮，相观民之计极。 夫孰非义而可用兮？孰非善而可服？ 阽余身而危死兮，览余初其犹未悔。
不量凿而正枘兮，固前修以菹醢。 曾歔欷余郁邑兮，哀朕时之不当。 揽茹蕙以掩涕兮，沾余襟之浪浪。 跪敷衽以陈辞兮，耿吾既得此中正。 驷玉虬以桀鹥兮，溘埃风余上征。 朝发轫于苍梧兮，夕余至乎县圃。 欲少留此灵琐兮，日忽忽其将暮。 吾令羲和弭节兮，望崦嵫而勿迫。
路漫漫其修远兮，吾将上下而求索。 饮余马于咸池兮，总余辔乎扶桑。 折若木以拂日兮，聊逍遥以相羊。 前望舒使先驱兮，后飞廉使奔属。 鸾皇为余先戒兮，雷师告余以未具。 吾令凤鸟飞腾兮，继之以日夜。 飘风屯其相离兮，帅云霓而来御。 纷总总其离合兮，斑陆离其上下。
吾令帝阍开关兮，倚阊阖而望予。 时暧暧其将罢兮，结幽兰而延伫。 世溷浊而不分兮，好蔽美而嫉妒。 朝吾将济于白水兮，登阆风而绁马。 忽反顾以流涕兮，哀高丘之无女。 溘吾游此春宫兮，折琼枝以继佩。 及荣华之未落兮，相下女之可诒。 吾令丰隆乘云兮，求宓妃之所在。
解佩纕以结言兮，吾令謇修以为理。 纷总总其离合兮，忽纬繣其难迁。 夕归次于穷石兮，朝濯发乎洧盘。 保厥美以骄傲兮，日康娱以淫游。 虽信美而无礼兮，来违弃而改求。 览相观于四极兮，周流乎天余乃下。 望瑶台之偃蹇兮，见有娀之佚女。 吾令鸩为媒兮，鸩告余以不好。
雄鸠之鸣逝兮，余犹恶其佻巧。 心犹豫而狐疑兮，欲自适而不可。 凤皇既受诒兮，恐高辛之先我。 欲远集而无所止兮，聊浮游以逍遥。 及少康之未家兮，留有虞之二姚。 理弱而媒拙兮，恐导言之不固。 世溷浊而嫉贤兮，好蔽美而称恶。 闺中既以邃远兮，哲王又不寤。
怀朕情而不发兮，余焉能忍而与此终古？ 索琼茅以筳篿兮，命灵氛为余占之。 曰：“两美其必合兮，孰信修而慕之？ 思九州之博大兮，岂惟是其有女？” 曰：“勉远逝而无狐疑兮，孰求美而释女？ 何所独无芳草兮，尔何怀乎故宇？” 世幽昧以昡曜兮，孰云察余之善恶？ 民好恶其不同兮，惟此党人其独异！
户服艾以盈要兮，谓幽兰其不可佩。 览察草木其犹未得兮，岂珵美之能当？ 苏粪壤以充祎兮，谓申椒其不芳。 欲从灵氛之吉占兮，心犹豫而狐疑。 巫咸将夕降兮，怀椒糈而要之。 百神翳其备降兮，九疑缤其并迎。 皇剡剡其扬灵兮，告余以吉故。 曰：“勉升降以上下兮，求矩矱之所同。
汤、禹俨而求合兮，挚、咎繇而能调。 苟中情其好修兮，又何必用夫行媒？ 说操筑于傅岩兮，武丁用而不疑。 吕望之鼓刀兮，遭周文而得举。 宁戚之讴歌兮，齐桓闻以该辅。 及年岁之未晏兮，时亦犹其未央。 恐鹈鴃之先鸣兮，使夫百草为之不芳。” 何琼佩之偃蹇兮，众薆然而蔽之。
惟此党人之不谅兮，恐嫉妒而折之。 时缤纷其变易兮，又何可以淹留？ 兰芷变而不芳兮，荃蕙化而为茅。 何昔日之芳草兮，今直为此萧艾也？ 岂其有他故兮，莫好修之害也！ 余以兰为可恃兮，羌无实而容长。 委厥美以从俗兮，苟得列乎众芳。 椒专佞以慢慆兮，樧又欲充夫佩帏。
既干进而务入兮，又何芳之能祗？ 固时俗之流从兮，又孰能无变化？ 览椒兰其若兹兮，又况揭车与江离？ 惟兹佩之可贵兮，委厥美而历兹。 芳菲菲而难亏兮，芬至今犹未沬。 和调度以自娱兮，聊浮游而求女。 及余饰之方壮兮，周流观乎上下。 灵氛既告余以吉占兮，历吉日乎吾将行。
折琼枝以为羞兮，精琼爢以为粻。 为余驾飞龙兮，杂瑶象以为车。 何离心之可同兮？吾将远逝以自疏。 邅吾道夫昆仑兮，路修远以周流。 扬云霓之晻蔼兮，鸣玉鸾之啾啾。 朝发轫于天津兮，夕余至乎西极。 凤皇翼其承旗兮，高翱翔之翼翼。 忽吾行此流沙兮，遵赤水而容与。
麾蛟龙使梁津兮，诏西皇使涉予。 路修远以多艰兮，腾众车使径待。 路不周以左转兮，指西海以为期。 屯余车其千乘兮，齐玉轪而并驰。 驾八龙之婉婉兮，载云旗之委蛇。 抑志而弭节兮，神高驰之邈邈。 奏《九歌》而舞《韶》兮，聊假日以偷乐。 陟升皇之赫戏兮，忽临睨夫旧乡。
仆夫悲余马怀兮，蜷局顾而不行。 乱曰：已矣哉！ 国无人莫我知兮，又何怀乎故都！ 既莫足与为美政兮，吾将从彭咸之所居！                `;
                // Repeat to ensure sufficient length (~1000 chars)
                const text = (liSao + liSao).substring(0, 1000);
                const resp = await chrome.runtime.sendMessage({
                    type: 'ai-benchmark',
                    mode,
                    infoUrl: currentModelInfoUrl,
                    text
                }).catch((error) => {
                    throw new Error(error && error.message ? error.message : 'benchmark request failed');
                });
                if (!resp || !resp.ok) {
                    const message = resp && resp.error ? String(resp.error) : 'benchmark failed';
                    console.warn('Benchmark rejected:', message, resp);
                    speedValue.textContent = 'Error';
                    alert(`测速失败: ${message}`);
                    return;
                }
                if (!resp.result || typeof resp.result !== 'object') {
                    console.warn('Benchmark invalid response:', resp);
                    speedValue.textContent = 'Error';
                    alert('测速失败: benchmark response invalid');
                    return;
                }
                const speed = Number(resp.result.speed || 0);
                speedValue.textContent = String(speed);
                if (benchmarkSuggestion) {
                    benchmarkSuggestion.style.display = 'block';
                    if (speed < 500) {
                        benchmarkSuggestion.textContent = 'AI 推理速度较低，不建议开启端侧AI';
                        benchmarkSuggestion.style.color = '#f44336';
                    } else {
                        benchmarkSuggestion.textContent = 'AI 推理速度良好，可以开启端侧AI';
                        benchmarkSuggestion.style.color = '#4caf50';
                    }
                }
            } catch (error) {
                console.error('Benchmark failed:', error);
                speedValue.textContent = 'Error';
                alert(`测速失败: ${error && error.message ? error.message : String(error)}`);
            } finally {
                runBenchmarkBtn.disabled = false;
                runBenchmarkBtn.textContent = originalText;
            }
        }
    }

    await loadSettings();
    await initAI();
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
        await chrome.storage.local.set({
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
            await chrome.storage.local.set({searchProvider: provider});
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
        await chrome.storage.local.set({speechVoiceURI});
        await notifyActiveTabs({
            action: 'updateSpeechVoice',
            speechVoiceURI
        });
    };
    const previewSpeech = (text, fallbackLang) => {
        if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
            alert('当前浏览器不支持语音朗读');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        const selectedVoiceURI = speechVoiceSelect ? (speechVoiceSelect.value || '') : '';
        const voices = speechSynthesis.getVoices();
        if (selectedVoiceURI) {
            const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang || fallbackLang;
            } else {
                utterance.lang = fallbackLang;
            }
        } else {
            utterance.lang = fallbackLang;
        }
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    };
    if (speechVoiceSelect) {
        speechVoiceSelect.addEventListener('change', saveSpeechVoiceSetting);
        renderSpeechVoiceOptions();
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', renderSpeechVoiceOptions);
        }
    }
    if (testChineseVoiceBtn) {
        testChineseVoiceBtn.addEventListener('click', () => {
            previewSpeech('您好，欢迎使用本插件，希望您用的愉快。', 'zh-CN');
        });
    }
    if (testEnglishVoiceBtn) {
        testEnglishVoiceBtn.addEventListener('click', () => {
            previewSpeech('Hello, welcome to this extension. Hope you enjoy using it.', 'en-US');
        });
    }
    const bindSearchAndSelectAll = ({searchInput, selectAllButton, render, getFiltered, getSelected}) => {
        if (searchInput) {
            searchInput.addEventListener('input', render);
        }
        if (selectAllButton) {
            selectAllButton.addEventListener('click', () => {
                const filtered = getFiltered();
                const selected = getSelected();
                const allSelected = filtered.length > 0 && filtered.every(item => selected.has(item));
                if (allSelected) {
                    filtered.forEach(item => selected.delete(item));
                } else {
                    filtered.forEach(item => selected.add(item));
                }
                render();
            });
        }
    };
    bindSearchAndSelectAll({
        searchInput: blockedSearchInput,
        selectAllButton: blockedSelectAll,
        render: renderBlockedWords,
        getFiltered: () => filterWords(blockedWords, blockedSearchInput ? blockedSearchInput.value : ''),
        getSelected: () => blockedSelected
    });
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
    bindSearchAndSelectAll({
        searchInput: favoritesSearchInput,
        selectAllButton: favoritesSelectAll,
        render: renderFavorites,
        getFiltered: () => filterWords(favoriteWords, favoritesSearchInput ? favoritesSearchInput.value : ''),
        getSelected: () => favoritesSelected
    });
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', () => {
            displayDictList(serverDictList);
        });
    }
    if (dictTagFilters) {
        dictTagFilters.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                const target = event.target;
                if (target && target.classList && target.classList.contains('dict-tag-chip')) {
                    event.preventDefault();
                    target.click();
                }
            }
        });
    }
    if (vocabSearchInput) {
        vocabSearchInput.addEventListener('input', () => {
            displayFilesList(currentVocabList);
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
    bindSearchAndSelectAll({
        searchInput: siteBlockSearchInput,
        selectAllButton: siteBlockSelectAll,
        render: renderSiteBlockRules,
        getFiltered: () => filterWords(siteBlockRules, siteBlockSearchInput ? siteBlockSearchInput.value : ''),
        getSelected: () => siteBlockSelected
    });
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
    if (siteBlockImportBtn) {
        siteBlockImportBtn.addEventListener('click', openSiteBlockImportModal);
    }
    if (siteBlockImportModalClose) {
        siteBlockImportModalClose.addEventListener('click', closeSiteBlockImportModal);
    }
    if (siteBlockImportModal) {
        siteBlockImportModal.addEventListener('click', (event) => {
            if (event.target === siteBlockImportModal) {
                closeSiteBlockImportModal();
            }
        });
    }
    if (siteBlockImportFromFileBtn) {
        siteBlockImportFromFileBtn.addEventListener('click', () => {
            showSiteBlockImportPane('file');
            setSiteBlockImportStatus('');
        });
    }
    if (siteBlockImportManualBtn) {
        siteBlockImportManualBtn.addEventListener('click', () => {
            showSiteBlockImportPane('manual');
            setSiteBlockImportStatus('');
            if (siteBlockManualInput) {
                siteBlockManualInput.focus();
            }
        });
    }
    if (siteBlockChooseFileBtn && siteBlockImportInput) {
        siteBlockChooseFileBtn.addEventListener('click', () => {
            setSiteBlockImportStatus('');
            siteBlockImportInput.click();
        });
    }
    if (siteBlockImportInput) {
        siteBlockImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const rules = parseSiteRuleBulkInput(content);
                const result = await importSiteRules(rules);
                if (result.total === 0) {
                    setSiteBlockImportStatus('导入失败：未识别到有效域名规则', true);
                    return;
                }
                setSiteBlockImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
            } catch (error) {
                setSiteBlockImportStatus(`导入失败：${error.message}`, true);
            } finally {
                siteBlockImportInput.value = '';
            }
        });
    }
    if (siteBlockManualImportConfirm && siteBlockManualInput) {
        siteBlockManualImportConfirm.addEventListener('click', async () => {
            const raw = siteBlockManualInput.value || '';
            const rules = parseSiteRuleBulkInput(raw);
            if (rules.length === 0) {
                setSiteBlockImportStatus('请输入有效域名规则后再导入', true);
                return;
            }
            try {
                const result = await importSiteRules(rules);
                setSiteBlockImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
                siteBlockManualInput.value = '';
            } catch (error) {
                setSiteBlockImportStatus(`导入失败：${error.message}`, true);
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
        if (dictSearchInput) {
            dictSearchInput.value = '';
            dictSearchInput.style.display = 'none';
        }
        selectedDictTags = new Set();
        if (dictTagFilters) {
            dictTagFilters.innerHTML = '';
            dictTagFilters.style.display = 'none';
        }
        loadingSpinner.style.display = 'block';
        dictList.style.display = 'none';
        dictList.classList.remove('show');
        downloadProgress.style.display = 'none';
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
        try {
            const cacheBust = `t=${Date.now()}`;
            const response = await fetch(`${SERVER_URL}/dict/index.json?${cacheBust}`, {
                cache: 'no-store'
            });
            if (!response.ok) {
                loadingSpinner.textContent = '加载失败: 获取词库列表失败';
                console.error('获取词库列表失败:', response.status);
                return;
            }
            const dictionaries = await response.json();
            serverDictList = Array.isArray(dictionaries) ? dictionaries : [];
            loadingSpinner.style.display = 'none';
            if (dictSearchInput) {
                dictSearchInput.style.display = 'block';
            }
            renderDictTagFilters(serverDictList);
            displayDictList(serverDictList);
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
        const sourceList = Array.isArray(dictionaries) ? dictionaries : [];
        const query = normalizeWord(dictSearchInput ? dictSearchInput.value : '');
        const filtered = sourceList.filter((dict) => {
            const name = normalizeWord(dict && dict.name);
            const desc = normalizeWord(dict && dict.description);
            const filename = normalizeWord(dict && dict.filename);
            const searchMatched = !query || name.includes(query) || desc.includes(query) || filename.includes(query);
            if (!searchMatched) {
                return false;
            }
            if (selectedDictTags.size === 0) {
                return true;
            }
            const tags = Array.isArray(dict && dict.tags) ? dict.tags : [];
            const tagSet = new Set(tags.map(tag => String(tag || '').trim()).filter(Boolean));
            for (const tag of selectedDictTags) {
                if (!tagSet.has(tag)) {
                    return false;
                }
            }
            return true;
        });
        dictList.innerHTML = '';
        if (filtered.length === 0) {
            dictList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无可用词库</div>';
            dictList.style.display = 'block';
            dictList.classList.add('show');
            return;
        }
        filtered.forEach(dict => {
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
            const dictLastModify = document.createElement('span');
            dictLastModify.className = 'dict-size';
            dictLastModify.textContent = `更新: ${dict['last-modify'] || '-'}`;
            dictInfo.appendChild(dictCount);
            dictInfo.appendChild(dictSize);
            dictInfo.appendChild(dictLastModify);
            dictItem.appendChild(dictName);
            dictItem.appendChild(dictInfo);
            const dictDescription = String(dict.description || '').trim();
            if (dictDescription) {
                const desc = document.createElement('div');
                desc.className = 'dict-description';
                desc.textContent = dictDescription;
                dictItem.appendChild(desc);
            }
            dictItem.addEventListener('click', () => {
                downloadDictionary(dict);
            });
            dictList.appendChild(dictItem);
        });
        dictList.style.display = 'block';
        dictList.classList.add('show');
    }

    function renderDictTagFilters(dictionaries) {
        if (!dictTagFilters) {
            return;
        }
        dictTagFilters.innerHTML = '';
        const tagSet = new Set();
        const sourceList = Array.isArray(dictionaries) ? dictionaries : [];
        sourceList.forEach((dict) => {
            const tags = Array.isArray(dict && dict.tags) ? dict.tags : [];
            tags.forEach((tag) => {
                const normalizedTag = String(tag || '').trim();
                if (normalizedTag) {
                    tagSet.add(normalizedTag);
                }
            });
        });
        const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
        if (tags.length === 0) {
            dictTagFilters.style.display = 'none';
            return;
        }
        tags.forEach((tag) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'dict-tag-chip';
            chip.textContent = tag;
            chip.addEventListener('click', () => {
                if (selectedDictTags.has(tag)) {
                    selectedDictTags.delete(tag);
                    chip.classList.remove('active');
                } else {
                    selectedDictTags.add(tag);
                    chip.classList.add('active');
                }
                displayDictList(serverDictList);
            });
            dictTagFilters.appendChild(chip);
        });
        dictTagFilters.style.display = 'flex';
    }

    // 下载词库
    async function downloadDictionary(dict) {
        if (dictSearchInput) {
            dictSearchInput.style.display = 'none';
        }
        if (dictTagFilters) {
            dictTagFilters.style.display = 'none';
        }
        dictList.style.display = 'none';
        downloadProgress.style.display = 'block';
        downloadingDict.textContent = `正在下载: ${dict.name}`;
        progressPercent.textContent = '0%';
        progressBar.style.width = '0%';
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
        try {
            const vocabularies = await chrome.storage.local.get('vocabularies') || {};
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
                    const vocabularies = await chrome.storage.local.get('vocabularies') || {};
                    let vocabList = vocabularies.vocabularies || [];
                    vocabList.push({
                        id: generateId(),
                        name: dict.name,
                        uploadTime: new Date().toISOString(),
                        wordCount: data.length,
                        data: data
                    });
                    await chrome.storage.local.set({vocabularies: vocabList});
                    // 构建并缓存Trie树索引
                    console.log('构建Trie树索引...');
                    const trieIndex = buildChineseTrieIndex(vocabList);
                    await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
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
        setUpdateError('');
        setUpdateProgressVisible(true);
        updateCurrentProgress('更新进度', 0);
        if (updateOverall) {
            updateOverall.style.display = 'none';
        }
    }

    function shouldAutoCloseUpdateModal() {
        return !updateRetryBtn || updateRetryBtn.style.display === 'none';
    }

    function setUpdateError(message) {
        if (!updateErrorMessage) {
            return;
        }
        const text = String(message || '').trim();
        if (!text) {
            updateErrorMessage.textContent = '';
            updateErrorMessage.style.display = 'none';
            return;
        }
        updateErrorMessage.textContent = text;
        updateErrorMessage.style.display = 'block';
    }

    function syncUpdateErrorFromImportStatus() {
        if (!updateModal || !updateModal.classList.contains('show')) {
            return;
        }
        if (!importStatus) {
            return;
        }
        if (String(importStatus.className || '').includes('error')) {
            setUpdateError(importStatus.textContent || '更新失败');
            return;
        }
        setUpdateError('');
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
        await chrome.storage.local.set({vocabularies: vocabList});
        if (vocabList.length > 0) {
            const trieIndex = buildChineseTrieIndex(vocabList);
            await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
        } else {
            await chrome.storage.local.remove('vocabularyTrieIndex');
        }
        await loadSettings();
        notifyContentScripts();
    }


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
        setUpdateError(message);
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'inline-flex';
        }
    };

    const showUpdateCanceled = () => {
        showUpdateError('已取消更新');
    };

    if (importStatus && typeof MutationObserver !== 'undefined') {
        const updateErrorObserver = new MutationObserver(() => {
            syncUpdateErrorFromImportStatus();
        });
        updateErrorObserver.observe(importStatus, {
            attributes: true,
            attributeFilter: ['class'],
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    async function updateAllVocabulariesNew() {
        if (!updateAllBtn) {
            return;
        }
        updateInProgress = true;
        setUpdateError('');
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
            const result = await chrome.storage.local.get('vocabularies');
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
            const result = await chrome.storage.local.get('vocabularies');
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
            const vocabularies = await chrome.storage.local.get('vocabularies') || {};
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
            await chrome.storage.local.set({vocabularies: vocabList});
            // 构建并缓存Trie树索引（中文->英文模式）
            console.log('构建Trie树索引...');
            const trieIndex = buildChineseTrieIndex(vocabList);
            await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
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
            'cnToEnOrder',
            'enToCnOrder',
            'disableAnnotationUnderline',
            'annotationWordCardPopupEnabled',
            'wordCardHighlightMatchedChinese',
            'smartSkipCodeLinks',
            'smartSkipEditableTextboxes',
            'searchProvider',
            'speechVoiceURI',
            'blockedWords',
            'favoriteWords',
            'siteBlockRules',
            'siteBlockMode',
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
        const annotationWordCardPopupEnabled = result.annotationWordCardPopupEnabled !== false;
        const wordCardHighlightMatchedChinese = result.wordCardHighlightMatchedChinese !== false;
        const smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
        const smartSkipEditableTextboxes = result.smartSkipEditableTextboxes !== false;
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
        siteBlockMode = result.siteBlockMode === 'whitelist' ? 'whitelist' : 'blacklist';
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
        if (siteBlockModeSlider) {
            const siteBlockModeSliderValue = siteBlockMode in reverseSiteBlockModeMap ? reverseSiteBlockModeMap[siteBlockMode] : 0;
            siteBlockModeSlider.value = siteBlockModeSliderValue;
            updateSiteBlockModeSliderUI(siteBlockModeSliderValue);
        }
        updateMaxMatchesUI(maxMatches);
        minTextLengthSlider.value = minLength;
        minTextLengthLabel.textContent = minLength;
        if (storedMinLength < 5) {
            await chrome.storage.local.set({minTextLength: minLength});
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
        if (annotationWordCardPopupEnabledToggle) {
            annotationWordCardPopupEnabledToggle.checked = annotationWordCardPopupEnabled;
        }
        if (wordCardHighlightMatchedChineseToggle) {
            wordCardHighlightMatchedChineseToggle.checked = wordCardHighlightMatchedChinese;
        }
        updateHighlightControls(highlightMode);
        smartSkipCodeLinksToggle.checked = smartSkipCodeLinks;
        if (smartSkipEditableTextboxesToggle) {
            smartSkipEditableTextboxesToggle.checked = smartSkipEditableTextboxes;
        }
        if (result.smartSkipEditableTextboxes === undefined) {
            await chrome.storage.local.set({smartSkipEditableTextboxes: true});
            await notifyActiveTabs({
                action: 'updateSmartSkipEditableTextboxes',
                enabled: true
            });
        }
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
        if (vocabSearchInput) {
            vocabSearchInput.value = '';
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
        currentVocabList = Array.isArray(vocabList) ? vocabList : [];
        const query = vocabSearchInput ? normalizeWord(vocabSearchInput.value) : '';
        const filteredList = query
            ? currentVocabList.filter(vocab => normalizeWord(vocab && vocab.name).includes(query))
            : currentVocabList;
        fileCount.textContent = filteredList.length;
        filesList.innerHTML = '';
        if (filteredList.length === 0) {
            filesList.innerHTML = '<div class="empty-state">暂无导入的词库文件</div>';
            return;
        }
        filteredList.forEach(vocab => {
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
        const result = await chrome.storage.local.get('vocabularies');
        let vocabList = result.vocabularies || [];
        vocabList = vocabList.filter(v => v.id !== id);
        await chrome.storage.local.set({vocabularies: vocabList});
        // 重新构建Trie树索引
        if (vocabList.length > 0) {
            const trieIndex = buildChineseTrieIndex(vocabList);
            await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
        } else {
            // 如果没有词库了，清空索引
            await chrome.storage.local.remove('vocabularyTrieIndex');
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
