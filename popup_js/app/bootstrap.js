/**
 * 文件说明：popup 页面装配引导层。
 * 职责：基于已收集元素初始化各业务 feature 并完成设置回填。
 */
import {
    buildChineseTrieIndex,
    buildEnglishTrieIndex
} from '../shared/tools/trie.js';
import {readFileAsText} from '../shared/tools/files.js';
import {generateId} from '../shared/tools/ids.js';
import {
    normalizeWord,
    filterWords,
    parseWordLines
} from '../shared/tools/words.js';
import {initDictionaryFeature} from '../features/dictionary/init.js';
import {initDictionaryDownloadFeature} from '../features/dictionary-download/init.js';
import {initAboutFeature} from '../features/about/init.js';
import {initOobeFeature} from '../features/oobe/init.js';
import {initAIFeature} from '../features/ai/init.js';
import {initFavoriteWordsFeature} from '../features/favorite-words/init.js';
import {initBlockedWordsFeature} from '../features/blocked-words/init.js';
import {initWorkingSiteSettingFeature} from '../features/working-site-setting/init.js';
import {initQuickWorkingSiteSettingFeature} from '../features/quick-working-site-setting/init.js';
import {initQuickAnnotationBehaviorSettingFeature} from '../features/quick-annotation-behavior-setting/init.js';
import {initAnnotationStylesFeature} from '../features/annotation-styles/init.js';
import {initAnnotationBehaviorFeature} from '../features/annotation-behavior/init.js';
import {initWordCardSettingsFeature} from '../features/word-card-settings/init.js';
import {initDisplayModeFeature} from '../features/display-mode/init.js';
import {initSearchFeature} from '../features/search/init.js';
import {initWordInfoFeature} from '../features/wordinfo/init.js';
import {initSyncFeature} from '../features/sync/init.js';
import { buildWordIndex } from '../features/search/service.js';
import {
    WORD_CARD_POPUP_SIZE_STORAGE_KEY,
    OOBE_COMPLETION_KEY,
    OOBE_STEP_KEY,
    OOBE_REQUIRED_COUNT,
    DELETE_SELECTED_CONFIRM_DELAY_MS,
    DELETE_SELECTED_DONE_DELAY_MS
} from '../shared/constants/keys.js';
import {
    SERVER_URL,
    SITE_EXAMPLE_TEST_URL
} from '../shared/constants/urls.js';
import {initHelpTooltips} from '../shared/ui/tooltip.js';
import {
    openTab,
    notifyActiveTabs
} from '../shared/platform/chrome-tabs.js';
import {initNavigation} from '../navigation/init.js';
import {
    createOverflowScheduler,
    createActivePageNavigator
} from '../shared/dom/page-router.js';
import {
    resetDeleteSelectedButton,
    updateDeleteSelectedButton,
    renderWordSelectionList
} from '../shared/ui/list-selection.js';
import { createPopupSettingsLoader } from './settings-loader.js';

/**
 * 启动 popup 页面应用并完成各功能模块装配。
 */
export async function bootstrapPopupApp(context = {}) {
    const { elements } = context;
    if (!elements) {
        throw new Error('bootstrapPopupApp requires context.elements');
    }
    const doc = context.document || document;
    const win = doc.defaultView || window;
    const {
        mainSearchInput,
        mainSearchButton,
        mainSyncPlaceholderBtn,
        mainSearchPanel,
        mainSearchResultMeta,
        mainSearchResults,
        displayModeLabelText,
        displayModeSlider,
        displayModeQuickCard,
        openQuickAnnotationBehaviorPageBtn,
        displayModeThumb,
        displayModeLabels,
        annotationModeSlider,
        annotationModeThumb,
        annotationModeLabels,
        dedupeModeSlider,
        dedupeModeThumb,
        dedupeModeLabels,
        siteBlockModeSlider,
        siteBlockModeThumb,
        siteBlockModeLabels,
        advancedToggle,
        vocabularyToggle,
        vocabularyContent,
        pageMain,
        pageVocab,
        pageAdvanced,
        pageStyle,
        pageAnnotation,
        pageWordInfo,
        pageWordCardSettings,
        pageBlocked,
        pageFavorites,
        pageSiteBlock,
        pageSiteRule,
        pageSync,
        pageAbout,
        pageAISettings,
        pageQuickAnnotationBehavior,
        vocabBack,
        advancedBack,
        styleNav,
        annotationNav,
        wordCardSettingsNav,
        blockedNav,
        favoritesNav,
        vocabularyNav,
        siteBlockNav,
        syncNav,
        aboutNav,
        syncBack,
        aiSettingsBack,
        styleBack,
        annotationBack,
        wordCardSettingsBack,
        wordInfoBack,
        blockedBack,
        favoritesBack,
        siteBlockBack,
        siteRuleBack,
        aboutBack,
        aboutVersion,
        oobe,
        oobeNext1,
        oobeNext2,
        oobeOpenDownload,
        oobeGoExample,
        oobeSkip,
        oobeSteps,
        oobeTitle1,
        oobeText1,
        oobeTitle2,
        oobeText2,
        oobeTitle3,
        oobeText3,
        oobeVocabList,
        oobeVocabEmpty,
        importBtn,
        fileInput,
        importStatus,
        vocabSearchInput,
        updateProgress,
        updateProgressLabel,
        updateProgressPercent,
        updateProgressBar,
        updateOverall,
        updateOverallLabel,
        updateOverallPercent,
        updateOverallBar,
        updateModal,
        updateModalClose,
        updateCancelBtn,
        updateRetryBtn,
        updateErrorMessage,
        filesList,
        fileCount,
        maxMatchesSlider,
        maxMatchesLabel,
        maxMatchesInput,
        minTextLengthSlider,
        minTextLengthLabel,
        dedupeRepeatCountSlider,
        dedupeRepeatCountLabel,
        clearDedupeCountsButton,
        dedupeRepeatCountSetting,
        clearDedupeCountsSetting,
        highlightModeSelect,
        highlightColorInput,
        cnToEnOrderSelect,
        enToCnOrderSelect,
        disableAnnotationUnderlineToggle,
        annotationWordCardPopupEnabledToggle,
        wordCardHighlightMatchedChineseToggle,
        speechVoiceSelect,
        testChineseVoiceBtn,
        testEnglishVoiceBtn,
        searchProviderSelect,
        wordInfoSearchBtn,
        wordInfoFavoriteBtn,
        wordInfoBlockBtn,
        wordInfoWord,
        wordInfoSpeakBtn,
        wordInfoPhonetics,
        wordInfoMeanings,
        wordInfoPhrases,
        wordInfoExamples,
        wordInfoSources,
        wordInfoEmpty,
        blockedSearchInput,
        blockedSelectAll,
        blockedDeleteSelected,
        blockedList,
        blockedImportBtn,
        blockedExportBtn,
        blockedImportInput,
        blockedImportModal,
        blockedImportModalClose,
        blockedImportFromFileBtn,
        blockedImportManualBtn,
        blockedChooseFileBtn,
        blockedImportFilePane,
        blockedImportManualPane,
        blockedManualInput,
        blockedManualImportConfirm,
        blockedImportStatus,
        favoritesSearchInput,
        favoritesSelectAll,
        favoritesDeleteSelected,
        favoritesList,
        favoritesImportBtn,
        favoritesExportBtn,
        favoritesImportInput,
        favoritesImportModal,
        favoritesImportModalClose,
        favoritesImportFromFileBtn,
        favoritesImportManualBtn,
        favoritesChooseFileBtn,
        favoritesImportFilePane,
        favoritesImportManualPane,
        favoritesManualInput,
        favoritesManualImportConfirm,
        favoritesImportStatus,
        siteBlockSearchInput,
        siteBlockSelectAll,
        siteBlockDeleteSelected,
        siteBlockList,
        siteBlockImportBtn,
        siteBlockExportBtn,
        siteBlockImportInput,
        siteBlockImportModal,
        siteBlockImportModalClose,
        siteBlockImportFromFileBtn,
        siteBlockImportManualBtn,
        siteBlockChooseFileBtn,
        siteBlockImportFilePane,
        siteBlockImportManualPane,
        siteBlockManualInput,
        siteBlockManualImportConfirm,
        siteBlockImportStatus,
        siteBlockTipText,
        smartSkipCodeLinksToggle,
        smartSkipEditableTextboxesToggle,
        debugModeToggle,
        resetPopupSizeButton,
        blockSiteBtn,
        siteBlockQuickCard,
        blockSiteRuleBtn,
        quickAnnotationBehaviorBack,
        quickSplitModeSlider,
        quickSplitModeThumb,
        quickSplitModeLabels,
        quickDisplayModeCnSlider,
        quickDisplayModeCnThumb,
        quickDisplayModeCnLabels,
        quickDisplayModeEnSlider,
        quickDisplayModeEnThumb,
        quickDisplayModeEnLabels,
        siteRuleHostInput,
        siteRulePageTitle,
        siteRuleTipText,
        siteRuleParentLabel,
        siteRuleExactLabel,
        siteRuleSubdomainLabel,
        siteRuleAddBtn,
        siteRuleStatus,
        siteBlockQuickTitle,
        siteBlockQuickTooltip,
        syncEnabledToggle,
        syncAdvancedOptions,
        syncStatusText,
        syncUsageSettingsText,
        syncUsageBlockedText,
        syncUsageFavoritesText,
        syncUsageSiteRulesText,
        syncUsageSettingsBar,
        syncUsageBlockedBar,
        syncUsageFavoritesBar,
        syncUsageSiteRulesBar,
        syncPushNowBtn,
        syncPullNowBtn,
        syncConflictEntryBtn,
        syncConflictModal,
        syncConflictModalClose,
        syncConflictCancelBtn,
        syncConflictRestoreBtn,
        syncConflictStatusText,
        syncEnableConfirmModal,
        syncEnableConfirmModalClose,
        syncEnableConfirmCancelBtn,
        syncEnableConfirmAcceptBtn,
        syncEnableConfirmChecks,
        annotationToAISettingsBtn,
        annotationQuickLanguageModeNav,
        quickFavorites,
        quickBlocked,
        quickVocab,
        quickSettings,
        downloadBtn,
        updateAllBtn,
        downloadModal,
        modalClose,
        loadingSpinner,
        dictList,
        dictSearchInput,
        dictTagFilters,
        downloadProgress,
        downloadingDict,
        downloadErrorOk,
        progressPercent,
        progressBar
    } = elements;

    const scheduleOverflowUpdate = createOverflowScheduler(doc, win);
    initHelpTooltips('.help-icon');
    win.addEventListener('resize', scheduleOverflowUpdate);
    const pages = [
        pageMain,
        pageVocab,
        pageAdvanced,
        pageStyle,
        pageAnnotation,
        pageWordInfo,
        pageWordCardSettings,
        pageBlocked,
        pageFavorites,
        pageSiteBlock,
        pageSiteRule,
        pageSync,
        pageAbout,
        pageAISettings,
        pageQuickAnnotationBehavior
    ];
    const rawShowPage = createActivePageNavigator(pages, scheduleOverflowUpdate);
    const pageHistoryStack = [];
    let currentPage = pages.find((page) => page && page.classList.contains('is-active')) || null;
    let suppressHistoryPush = false;

    function showPage(targetPage) {
        if (!targetPage || targetPage === currentPage) {
            return;
        }
        if (!suppressHistoryPush && currentPage) {
            pageHistoryStack.push(currentPage);
        }
        rawShowPage(targetPage);
        currentPage = targetPage;
        if (targetPage === pageMain && searchFeature && typeof searchFeature.focusMainSearchInput === 'function') {
            searchFeature.focusMainSearchInput();
        }
    }

    function goBack(fallbackPage = pageMain) {
        let targetPage = null;
        while (pageHistoryStack.length > 0) {
            const candidate = pageHistoryStack.pop();
            if (candidate && candidate !== currentPage) {
                targetPage = candidate;
                break;
            }
        }
        if (!targetPage) {
            targetPage = fallbackPage;
        }
        suppressHistoryPush = true;
        try {
            showPage(targetPage);
        } finally {
            suppressHistoryPush = false;
        }
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const backButton = target.closest('.page-back-btn');
        if (!backButton || backButton.id === 'wordInfoBack') {
            return;
        }
        const activePage = backButton.closest('.page');
        if (!activePage || !activePage.classList.contains('is-active')) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        goBack(pageMain);
    }, true);

    const deleteSelectedConfirmDelay = DELETE_SELECTED_CONFIRM_DELAY_MS;
    const deleteSelectedDoneDelay = DELETE_SELECTED_DONE_DELAY_MS;
    let loadSettings = async () => {
    };
    let wordInfoFeature = null;
    let searchFeature = null;

    async function openWordInfoByWord(rawWord, source = 'main') {
        const normalized = String(rawWord || '').trim().toLowerCase();
        if (!normalized) {
            return;
        }
        let entry = null;
        try {
            const result = await chrome.storage.local.get(['vocabularies']);
            const index = buildWordIndex(Array.isArray(result.vocabularies) ? result.vocabularies : []);
            entry = index.get(normalized) || null;
        } catch {
            entry = null;
        }
        const fallbackEntry = {
            word: normalized,
            byType: {},
            phonetics: { uk: '', us: '' },
            phrases: [],
            sentenceExamples: [],
            sources: []
        };
        const finalEntry = entry || fallbackEntry;
        if (wordInfoFeature && typeof wordInfoFeature.openWordInfo === 'function') {
            await wordInfoFeature.openWordInfo(finalEntry, { backTarget: source });
            showPage(pageWordInfo);
        }
    }
    const dictionaryDownloadFeature = initDictionaryDownloadFeature({
        elements: {
            downloadBtn,
            updateAllBtn,
            downloadModal,
            modalClose,
            loadingSpinner,
            dictList,
            dictSearchInput,
            dictTagFilters,
            downloadProgress,
            downloadingDict,
            downloadErrorOk,
            progressPercent,
            progressBar,
            importStatus,
            updateProgress,
            updateProgressLabel,
            updateProgressPercent,
            updateProgressBar,
            updateOverall,
            updateOverallLabel,
            updateOverallPercent,
            updateOverallBar,
            updateModal,
            updateCancelBtn,
            updateRetryBtn,
            updateErrorMessage,
            updateModalClose
        },
        deps: {
            serverUrl: SERVER_URL,
            normalizeWord,
            generateId,
            buildChineseTrieIndex,
            loadSettings: async () => loadSettings(),
            notifyContentScripts
        }
    });
    const dictionaryFeature = initDictionaryFeature({
        elements: {
            importBtn,
            fileInput,
            importStatus,
            vocabSearchInput,
            filesList,
            fileCount
        },
        deps: {
            normalizeWord,
            readFileAsText,
            buildChineseTrieIndex,
            reloadSettings: async () => loadSettings(),
            notifyContentScripts,
            onUpdateVocabulary: async (vocabId, updateButton) => dictionaryDownloadFeature.startUpdateSingle(vocabId, updateButton)
        }
    });
    const oobeFeature = initOobeFeature({
        elements: {
            oobe,
            oobeSteps,
            oobeTitle1,
            oobeText1,
            oobeNext1,
            oobeTitle2,
            oobeText2,
            oobeOpenDownload,
            oobeNext2,
            oobeTitle3,
            oobeText3,
            oobeGoExample,
            oobeSkip,
            oobeVocabList,
            oobeVocabEmpty
        },
        deps: {
            oobeCompletionKey: OOBE_COMPLETION_KEY,
            oobeStepKey: OOBE_STEP_KEY,
            oobeRequiredCount: OOBE_REQUIRED_COUNT
        },
        actions: {
            showMainPage: () => showPage(pageMain),
            openDownloadModal: () => dictionaryDownloadFeature.openDownloadModal(),
            openExamplePage: () => openTab(SITE_EXAMPLE_TEST_URL),
            deleteVocabulary: (id) => dictionaryFeature.deleteVocabulary(id),
            reportDeleteError: (error) => {
                importStatus.textContent = '删除失败: ' + error.message;
                importStatus.className = 'import-status error';
            }
        }
    });
    const aboutFeature = initAboutFeature({
        elements: {
            aboutVersion,
            aboutNav,
            aboutBack,
            debugModeToggle
        },
        actions: {
            showAboutPage: () => showPage(pageAbout),
            showAdvancedPage: () => showPage(pageAdvanced)
        },
        deps: {
            notifyActiveTabs
        }
    });
    const syncFeature = initSyncFeature({
        elements: {
            syncNav,
            syncBack,
            pageSync,
            syncEnabledToggle,
            syncAdvancedOptions,
            syncStatusText,
            syncUsageSettingsText,
            syncUsageBlockedText,
            syncUsageFavoritesText,
            syncUsageSiteRulesText,
            syncUsageSettingsBar,
            syncUsageBlockedBar,
            syncUsageFavoritesBar,
            syncUsageSiteRulesBar,
            syncPushNowBtn,
            syncPullNowBtn,
            syncConflictEntryBtn,
            syncConflictModal,
            syncConflictModalClose,
            syncConflictCancelBtn,
            syncConflictRestoreBtn,
            syncConflictStatusText,
            syncEnableConfirmModal,
            syncEnableConfirmModalClose,
            syncEnableConfirmCancelBtn,
            syncEnableConfirmAcceptBtn,
            syncEnableConfirmChecks
        },
        actions: {
            showPage,
            pageMain,
            pageAdvanced
        }
    });
    if (mainSyncPlaceholderBtn) {
        mainSyncPlaceholderBtn.addEventListener('click', async () => {
            await syncFeature.openFromMain();
        });
    }
    const favoriteWordsFeature = initFavoriteWordsFeature({
        elements: {
            quickFavorites,
            favoritesNav,
            favoritesBack,
            pageMain,
            pageAdvanced,
            pageFavorites,
            favoritesList,
            favoritesSearchInput,
            favoritesSelectAll,
            favoritesDeleteSelected,
            favoritesImportBtn,
            favoritesImportInput,
            favoritesExportBtn,
            favoritesImportModal,
            favoritesImportModalClose,
            favoritesImportFromFileBtn,
            favoritesImportManualBtn,
            favoritesChooseFileBtn,
            favoritesImportFilePane,
            favoritesImportManualPane,
            favoritesManualInput,
            favoritesManualImportConfirm,
            favoritesImportStatus
        },
        deps: {
            normalizeWord,
            openWordInfoByWord,
            filterWords,
            renderWordSelectionList,
            updateDeleteSelectedButton,
            resetDeleteSelectedButton,
            readFileAsText,
            parseWordLines,
            showPage,
            deleteSelectedConfirmDelay,
            deleteSelectedDoneDelay
        }
    });
    const blockedWordsFeature = initBlockedWordsFeature({
        elements: {
            quickBlocked,
            blockedNav,
            blockedBack,
            pageMain,
            pageAdvanced,
            pageBlocked,
            blockedList,
            blockedSearchInput,
            blockedSelectAll,
            blockedDeleteSelected,
            blockedImportBtn,
            blockedImportInput,
            blockedExportBtn,
            blockedImportModal,
            blockedImportModalClose,
            blockedImportFromFileBtn,
            blockedImportManualBtn,
            blockedChooseFileBtn,
            blockedImportFilePane,
            blockedImportManualPane,
            blockedManualInput,
            blockedManualImportConfirm,
            blockedImportStatus
        },
        deps: {
            normalizeWord,
            openWordInfoByWord,
            buildEnglishTrieIndex,
            notifyActiveTabs,
            filterWords,
            renderWordSelectionList,
            updateDeleteSelectedButton,
            resetDeleteSelectedButton,
            readFileAsText,
            parseWordLines,
            showPage,
            deleteSelectedConfirmDelay,
            deleteSelectedDoneDelay
        }
    });
    const workingSiteSettingFeature = initWorkingSiteSettingFeature({
        elements: {
            siteBlockNav,
            siteBlockBack,
            siteRuleBack,
            siteBlockSearchInput,
            siteBlockSelectAll,
            siteBlockDeleteSelected,
            siteBlockList,
            siteBlockImportBtn,
            siteBlockExportBtn,
            siteBlockImportInput,
            siteBlockImportModal,
            siteBlockImportModalClose,
            siteBlockImportFromFileBtn,
            siteBlockImportManualBtn,
            siteBlockChooseFileBtn,
            siteBlockImportFilePane,
            siteBlockImportManualPane,
            siteBlockManualInput,
            siteBlockManualImportConfirm,
            siteBlockImportStatus,
            siteBlockTipText,
            siteBlockModeSlider,
            siteBlockModeThumb,
            siteBlockModeLabels,
            siteRuleHostInput,
            siteRulePageTitle,
            siteRuleTipText,
            siteRuleParentLabel,
            siteRuleExactLabel,
            siteRuleSubdomainLabel,
            siteRuleAddBtn,
            siteRuleStatus,
            siteBlockQuickTitle,
            siteBlockQuickTooltip,
            blockSiteBtn
        },
        deps: {
            showPage,
            pageMain,
            pageAdvanced,
            pageSiteBlock,
            pageSiteRule,
            notifyActiveTabs,
            filterWords,
            renderWordSelectionList,
            updateDeleteSelectedButton,
            resetDeleteSelectedButton,
            readFileAsText,
            deleteSelectedConfirmDelay,
            deleteSelectedDoneDelay,
            scheduleOverflowUpdate
        }
    });
    initQuickWorkingSiteSettingFeature({
        elements: {
            blockSiteBtn,
            blockSiteRuleBtn,
            siteBlockQuickCard
        },
        workingFeature: workingSiteSettingFeature
    });
    const quickAnnotationBehaviorFeature = initQuickAnnotationBehaviorSettingFeature({
        elements: {
            displayModeQuickCard,
            openQuickAnnotationBehaviorPageBtn,
            quickAnnotationBehaviorBack,
            annotationQuickLanguageModeNav,
            quickSplitModeSlider,
            quickSplitModeThumb,
            quickSplitModeLabels,
            quickDisplayModeCnSlider,
            quickDisplayModeCnThumb,
            quickDisplayModeCnLabels,
            quickDisplayModeEnSlider,
            quickDisplayModeEnThumb,
            quickDisplayModeEnLabels
        },
        deps: {
            notifyActiveTabs,
            showPage,
            pageMain,
            pageAnnotation,
            pageQuickAnnotationBehavior
        }
    });
    const annotationStylesFeature = initAnnotationStylesFeature({
        elements: {
            highlightModeSelect,
            highlightColorInput,
            disableAnnotationUnderlineToggle
        },
        deps: {
            notifyActiveTabs
        }
    });
    const annotationBehaviorFeature = initAnnotationBehaviorFeature({
        elements: {
            annotationModeSlider,
            annotationModeThumb,
            annotationModeLabels,
            cnToEnOrderSelect,
            enToCnOrderSelect,
            dedupeModeSlider,
            dedupeModeThumb,
            dedupeModeLabels,
            dedupeRepeatCountSlider,
            dedupeRepeatCountLabel,
            clearDedupeCountsButton,
            dedupeRepeatCountSetting,
            clearDedupeCountsSetting,
            maxMatchesSlider,
            maxMatchesLabel,
            maxMatchesInput,
            minTextLengthSlider,
            minTextLengthLabel,
            smartSkipCodeLinksToggle,
            smartSkipEditableTextboxesToggle
        },
        deps: {
            notifyActiveTabs
        }
    });
    const wordCardSettingsFeature = initWordCardSettingsFeature({
        elements: {
            annotationWordCardPopupEnabledToggle,
            wordCardHighlightMatchedChineseToggle,
            resetPopupSizeButton,
            speechVoiceSelect,
            searchProviderSelect,
            testChineseVoiceBtn,
            testEnglishVoiceBtn
        },
        deps: {
            notifyActiveTabs,
            wordCardPopupSizeStorageKey: WORD_CARD_POPUP_SIZE_STORAGE_KEY
        }
    });
    const displayModeFeature = initDisplayModeFeature({
        elements: {
            displayModeLabelText,
            displayModeSlider,
            displayModeThumb,
            displayModeLabels
        },
        deps: {
            notifyActiveTabs
        }
    });
    wordInfoFeature = initWordInfoFeature({
        elements: {
            wordInfoBack,
            wordInfoSearchBtn,
            wordInfoFavoriteBtn,
            wordInfoBlockBtn,
            wordInfoWord,
            wordInfoSpeakBtn,
            wordInfoPhonetics,
            wordInfoMeanings,
            wordInfoPhrases,
            wordInfoExamples,
            wordInfoSources,
            wordInfoEmpty
        },
        actions: {
            openExternalUrl: (url) => openTab(url),
            notifyFavoriteWordsUpdated: async (words) => {
                if (favoriteWordsFeature && typeof favoriteWordsFeature.syncFavoriteWords === 'function') {
                    favoriteWordsFeature.syncFavoriteWords(words);
                }
            },
            notifyBlockedWordsUpdated: async (words, trieIndex) => {
                await notifyActiveTabs({
                    action: 'updateBlockedWords',
                    words,
                    trieIndex
                });
                if (blockedWordsFeature && typeof blockedWordsFeature.syncBlockedWords === 'function') {
                    blockedWordsFeature.syncBlockedWords(words);
                }
            },
            navigateBack: () => goBack(pageMain)
        }
    });
    searchFeature = initSearchFeature({
        elements: {
            pageMain,
            mainSearchInput,
            mainSearchButton,
            mainSearchPanel,
            mainSearchResultMeta,
            mainSearchResults
        },
        actions: {
            openExternalUrl: (url) => openTab(url),
            openSettingPage: (targetPage) => {
                const targetPageMap = {
                    main: pageMain,
                    style: pageStyle,
                    annotation: pageAnnotation,
                    wordCardSettings: pageWordCardSettings,
                    aiSettings: pageAISettings,
                    vocab: pageVocab,
                    blocked: pageBlocked,
                    favorites: pageFavorites,
                    siteBlock: pageSiteBlock,
                    siteRule: pageSiteRule,
                    sync: pageSync,
                    about: pageAbout,
                    quickAnnotationBehavior: pageQuickAnnotationBehavior
                };
                const target = targetPageMap[targetPage] || pageMain;
                showPage(target);
            },
            openWordInfo: (entry) => {
                wordInfoFeature.openWordInfo(entry, { backTarget: 'main' });
                showPage(pageWordInfo);
            }
        }
    });
    const popupSettingsLoader = createPopupSettingsLoader({
        displayModeFeature,
        annotationBehaviorFeature,
        annotationStylesFeature,
        wordCardSettingsFeature,
        aboutFeature,
        dictionaryFeature,
        blockedWordsFeature,
        favoriteWordsFeature,
        workingSiteSettingFeature,
        searchFeature,
        quickAnnotationBehaviorFeature,
        syncFeature,
        oobeFeature,
        scheduleOverflowUpdate
    });
    loadSettings = popupSettingsLoader.loadSettings;
    if (vocabularyContent) {
        vocabularyContent.style.display = 'block';
    }
    showPage(pageMain);
    initNavigation({
        elements: {
            vocabularyToggle,
            advancedToggle,
            quickVocab,
            quickSettings,
            styleNav,
            annotationNav,
            wordCardSettingsNav,
            vocabularyNav,
            vocabBack,
            advancedBack,
            styleBack,
            annotationBack,
            wordCardSettingsBack
        },
        pages: {
            pageMain,
            pageVocab,
            pageAdvanced,
            pageStyle,
            pageAnnotation,
            pageWordCardSettings
        },
        showPage
    });
    await loadSettings();
    await initAIFeature({
        elements: {
            annotationToAISettingsBtn,
            aiSettingsBack
        },
        actions: {
            showAISettingsPage: () => showPage(pageAISettings),
            showAnnotationPage: () => showPage(pageAnnotation)
        },
        notifyActiveTabs
    });

    /**
     * 通知当前激活标签页中的内容脚本刷新词库。
     */
    async function notifyContentScripts() {
        await notifyActiveTabs({
            action: 'reloadVocabularies'
        });
    }

}
