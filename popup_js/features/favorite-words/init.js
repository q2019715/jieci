/**
 * 文件说明：favorite-words 模块初始化入口。
 * 职责：维护收藏词状态并协调渲染、存储与交互事件。
 */
import { bindFavoriteWordsEvents } from './bind.js';
import { updateFavoriteWordActions } from './render.js';
import {
    normalizeFavoriteWords,
    persistFavoriteWords,
    exportFavoriteWords
} from './service.js';

/**
 * 初始化收藏词模块。
 */
export function initFavoriteWordsFeature({
    elements,
    deps
}) {
    const state = {
        words: [],
        selected: new Set(),
        entrySource: 'advanced'
    };
    const {
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
    } = deps;
    const {
        favoritesList,
        favoritesSearchInput,
        favoritesSelectAll,
        favoritesDeleteSelected
    } = elements;

    /**
     * 持久化当前收藏词列表。
     */
    async function persist() {
        state.words = await persistFavoriteWords(state.words, normalizeWord);
    }

    /**
     * 删除单个收藏词。
     */
    async function deleteWord(word) {
        state.selected.delete(word);
        state.words = state.words.filter((itemWord) => itemWord !== word);
        await persist();
        render();
    }

    /**
     * 根据当前筛选结果更新顶部操作按钮。
     */
    function updateActions() {
        const filtered = filterWords(state.words, favoritesSearchInput ? favoritesSearchInput.value : '');
        updateFavoriteWordActions({
            favoritesSelectAll,
            favoritesDeleteSelected,
            favoritesSelected: state.selected,
            filteredWords: filtered,
            updateDeleteSelectedButton
        });
        return filtered;
    }

    /**
     * 渲染收藏词列表。
     */
    function render() {
        const filtered = updateActions();
        renderWordSelectionList({
            listElement: favoritesList,
            filteredItems: filtered,
            selectedItems: state.selected,
            emptyText: '暂无收藏的单词',
            onToggleSelection: () => updateActions(),
            onOpenItem: async (word) => {
                if (typeof openWordInfoByWord === 'function') {
                    await openWordInfoByWord(word, 'favorites');
                }
            },
            onDeleteItem: async (word) => {
                await deleteWord(word);
            }
        });
    }

    /**
     * 用存储中的收藏词刷新模块状态。
     */
    function applyFavoriteWords(words) {
        state.words = normalizeFavoriteWords(words, normalizeWord);
        state.selected = new Set();
        if (favoritesSearchInput) {
            favoritesSearchInput.value = '';
        }
        render();
    }

    /**
     * 用外部最新收藏词同步列表状态（不重置搜索框）。
     */
    function syncFavoriteWords(words) {
        state.words = normalizeFavoriteWords(words, normalizeWord);
        const wordSet = new Set(state.words);
        state.selected = new Set(Array.from(state.selected).filter((word) => wordSet.has(word)));
        render();
    }

    bindFavoriteWordsEvents({
        elements,
        actions: {
            showPage,
            render,
            persist,
            parseWordLines,
            readFileAsText,
            exportWords: exportFavoriteWords,
            updateActions,
            resetDeleteSelectedButton,
            updateDeleteSelectedButton
        },
        state,
        deps: {
            deleteSelectedConfirmDelay,
            deleteSelectedDoneDelay
        }
    });

    return {
        applyFavoriteWords,
        syncFavoriteWords,
        render
    };
}

