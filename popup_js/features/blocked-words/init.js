/**
 * 文件说明：blocked-words 模块初始化入口。
 * 职责：维护屏蔽词状态并协调渲染、存储与交互事件。
 */
import { bindBlockedWordsEvents } from './bind.js';
import { updateBlockedWordActions } from './render.js';
import {
    normalizeBlockedWords,
    persistBlockedWords,
    exportBlockedWords
} from './service.js';

/**
 * 初始化屏蔽词模块。
 */
export function initBlockedWordsFeature({
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
    } = deps;
    const {
        blockedList,
        blockedSearchInput,
        blockedSelectAll,
        blockedDeleteSelected
    } = elements;

    /**
     * 持久化当前屏蔽词列表。
     */
    async function persist() {
        state.words = await persistBlockedWords(state.words, normalizeWord, buildEnglishTrieIndex, notifyActiveTabs);
    }

    /**
     * 删除单个屏蔽词并刷新列表。
     */
    async function deleteWord(word) {
        state.selected.delete(word);
        state.words = state.words.filter((itemWord) => itemWord !== word);
        await persist();
        render();
    }

    /**
     * 根据筛选结果更新顶部操作按钮。
     */
    function updateActions() {
        const filtered = filterWords(state.words, blockedSearchInput ? blockedSearchInput.value : '');
        updateBlockedWordActions({
            blockedSelectAll,
            blockedDeleteSelected,
            blockedSelected: state.selected,
            filteredWords: filtered,
            updateDeleteSelectedButton
        });
        return filtered;
    }

    /**
     * 渲染屏蔽词列表。
     */
    function render() {
        const filtered = updateActions();
        renderWordSelectionList({
            listElement: blockedList,
            filteredItems: filtered,
            selectedItems: state.selected,
            emptyText: '暂无屏蔽词',
            onToggleSelection: () => updateActions(),
            onOpenItem: async (word) => {
                if (typeof openWordInfoByWord === 'function') {
                    await openWordInfoByWord(word, 'blocked');
                }
            },
            onDeleteItem: async (word) => {
                await deleteWord(word);
            }
        });
    }

    /**
     * 用存储中的屏蔽词刷新模块状态。
     */
    function applyBlockedWords(words) {
        state.words = normalizeBlockedWords(words, normalizeWord);
        state.selected = new Set();
        if (blockedSearchInput) {
            blockedSearchInput.value = '';
        }
        render();
    }

    /**
     * 用外部最新屏蔽词同步列表状态（不重置搜索框）。
     */
    function syncBlockedWords(words) {
        state.words = normalizeBlockedWords(words, normalizeWord);
        const wordSet = new Set(state.words);
        state.selected = new Set(Array.from(state.selected).filter((word) => wordSet.has(word)));
        render();
    }

    bindBlockedWordsEvents({
        elements,
        actions: {
            showPage,
            render,
            persist,
            parseWordLines,
            readFileAsText,
            exportWords: exportBlockedWords,
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
        applyBlockedWords,
        syncBlockedWords,
        render
    };
}

