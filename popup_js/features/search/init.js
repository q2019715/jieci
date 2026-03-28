/**
 * 文件说明：search 模块初始化入口。
 */
import { bindSearchEvents } from './bind.js';
import { renderSearchMeta, renderSearchResults } from './render.js';
import {
    analyzeQuery,
    buildWordIndex,
    searchSettings,
    searchWords
} from './service.js';
import { SEARCH_SETTING_ITEMS } from './constants.js';

export function initSearchFeature({
    elements,
    actions
}) {
    const state = {
        wordIndex: new Map(),
        selectedResultIndex: -1
    };

    const {
        pageMain,
        mainSearchInput,
        mainSearchButton,
        mainSearchPanel,
        mainSearchResultMeta,
        mainSearchResults
    } = elements;

    const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"></circle><path d="M16 16L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
    const CLEAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle><path d="M9 9L15 15M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

    function hasQueryValue(value) {
        return String(value || '').trim().length > 0;
    }

    function buildExternalSearchUrl(provider, query) {
        const safeQuery = String(query || '').trim();
        const encodedQuery = encodeURIComponent(safeQuery);
        const slugWord = safeQuery.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        if (provider === 'bing') {
            return `https://www.bing.com/dict/search?q=${encodedQuery}`;
        }
        if (provider === 'cambridge') {
            return `https://dictionary.cambridge.org/zhs/spellcheck/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/?q=${encodedQuery}`;
        }
        if (provider === 'collins') {
            if (slugWord) {
                return `https://www.collinsdictionary.com/dictionary/english/${slugWord}`;
            }
            return `https://www.collinsdictionary.com/search/?dictCode=english&q=${encodedQuery}`;
        }
        return `https://www.youdao.com/result?word=${encodedQuery}&lang=en`;
    }

    async function openExternalSearch(query) {
        const safeQuery = String(query || '').trim();
        if (!safeQuery) {
            return;
        }
        let provider = 'youdao';
        try {
            const result = await chrome.storage.local.get(['searchProvider']);
            provider = String(result && result.searchProvider || 'youdao');
        } catch {
            provider = 'youdao';
        }
        const url = buildExternalSearchUrl(provider, safeQuery);
        actions.openExternalUrl(url);
    }

    function updateMainButtonMode(rawQuery) {
        if (!mainSearchButton) {
            return;
        }
        if (hasQueryValue(rawQuery)) {
            mainSearchButton.dataset.mode = 'clear';
            mainSearchButton.setAttribute('aria-label', '清空');
            mainSearchButton.innerHTML = CLEAR_ICON;
            return;
        }
        mainSearchButton.dataset.mode = 'search';
        mainSearchButton.setAttribute('aria-label', '搜索');
        mainSearchButton.innerHTML = SEARCH_ICON;
    }

    function focusMainSearchInput() {
        if (!mainSearchInput) {
            return;
        }
        requestAnimationFrame(() => {
            mainSearchInput.focus();
        });
    }

    function showMainInlinePanel() {
        if (mainSearchPanel) {
            mainSearchPanel.classList.remove('is-hidden');
        }
        if (pageMain) {
            pageMain.classList.add('search-overlay-active');
        }
    }

    function hideMainInlinePanel() {
        if (mainSearchPanel) {
            mainSearchPanel.classList.add('is-hidden');
        }
        if (pageMain) {
            pageMain.classList.remove('search-overlay-active');
        }
        state.selectedResultIndex = -1;
    }

    function getResultButtons() {
        if (!mainSearchResults) {
            return [];
        }
        return Array.from(mainSearchResults.querySelectorAll('.search-result-item'));
    }

    function applySelectedResultState() {
        const buttons = getResultButtons();
        buttons.forEach((button, index) => {
            const selected = index === state.selectedResultIndex;
            button.classList.toggle('is-key-selected', selected);
            if (selected) {
                button.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function moveSelection(step) {
        const buttons = getResultButtons();
        if (buttons.length === 0) {
            state.selectedResultIndex = -1;
            return;
        }
        if (state.selectedResultIndex < 0) {
            state.selectedResultIndex = step > 0 ? 0 : buttons.length - 1;
        } else {
            const next = state.selectedResultIndex + step;
            if (next < 0) {
                state.selectedResultIndex = buttons.length - 1;
            } else if (next >= buttons.length) {
                state.selectedResultIndex = 0;
            } else {
                state.selectedResultIndex = next;
            }
        }
        applySelectedResultState();
    }

    function activateSelectedOrFirstResult() {
        const buttons = getResultButtons();
        if (buttons.length === 0) {
            return false;
        }
        const index = state.selectedResultIndex >= 0 ? state.selectedResultIndex : 0;
        const target = buttons[index];
        if (!target) {
            return false;
        }
        target.click();
        return true;
    }

    function renderMainInlineSearch(rawQuery) {
        const { normalized, hasChinese } = analyzeQuery(rawQuery);
        if (!normalized) {
            renderSearchMeta(mainSearchResultMeta, '');
            if (mainSearchResults) {
                mainSearchResults.replaceChildren();
            }
            hideMainInlinePanel();
            return;
        }

        showMainInlinePanel();

        const settingMatches = searchSettings(SEARCH_SETTING_ITEMS, normalized);
        const wordMatches = searchWords(state.wordIndex, normalized);
        renderSearchMeta(mainSearchResultMeta, '');
        renderSearchResults({
            doc: document,
            resultsElement: mainSearchResults,
            settingsResults: settingMatches,
            wordResults: wordMatches,
            hasChinese,
            onSettingClick: (item) => {
                clearSearchState();
                actions.openSettingPage(item.targetPage);
            },
            onWordClick: (entry) => {
                clearSearchState();
                actions.openWordInfo(entry);
            },
            noResultAction: {
                title: '暂无结果，点此在插件外进行查询',
                subtitle: '使用已设置的一键查词站点打开',
                onClick: () => {
                    clearSearchState();
                    void openExternalSearch(rawQuery);
                }
            }
        });
        state.selectedResultIndex = -1;
        applySelectedResultState();
    }

    function handleMainInputChange(rawQuery) {
        const query = String(rawQuery || '');
        updateMainButtonMode(query);
        renderMainInlineSearch(query);
    }

    function handleMainEnter(rawQuery) {
        const query = String(rawQuery || '');
        const usedExistingResult = activateSelectedOrFirstResult();
        if (usedExistingResult) {
            return true;
        }
        renderMainInlineSearch(query);
        return activateSelectedOrFirstResult();
    }

    function handleMainButtonClick(rawQuery) {
        if (hasQueryValue(rawQuery)) {
            if (mainSearchInput) {
                mainSearchInput.value = '';
                mainSearchInput.focus();
            }
            updateMainButtonMode('');
            hideMainInlinePanel();
            return;
        }
        if (mainSearchInput) {
            mainSearchInput.focus();
        }
    }

    function applySettings(result) {
        const vocabularies = result && Array.isArray(result.vocabularies) ? result.vocabularies : [];
        state.wordIndex = buildWordIndex(vocabularies);
    }

    function clearSearchState() {
        if (mainSearchInput) {
            mainSearchInput.value = '';
        }
        if (mainSearchResults) {
            mainSearchResults.replaceChildren();
        }
        renderSearchMeta(mainSearchResultMeta, '');
        hideMainInlinePanel();
        updateMainButtonMode('');
    }

    bindSearchEvents({
        elements,
        actions: {
            handleMainInputChange,
            handleMainEnter,
            handleMoveSelection: (step) => moveSelection(step),
            handleMainButtonClick
        }
    });

    clearSearchState();
    focusMainSearchInput();

    return {
        applySettings,
        hideMainInlinePanel,
        clearSearchState,
        focusMainSearchInput
    };
}
