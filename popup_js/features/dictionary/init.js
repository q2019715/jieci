/**
 * 文件说明：dictionary（词库管理）模块初始化入口。
 * 职责：组装词库导入、搜索、列表渲染、删除与存储同步。
 */
import { bindDictionaryEvents } from './bind.js';
import { renderDictionaryList } from './render.js';
import { STATUS_TIP_AUTO_HIDE_DELAY_MS } from '../../shared/constants/keys.js';
import {
    DICTIONARY_DELETE_FAILED_PREFIX,
    DICTIONARY_IMPORTING_TEXT,
    DICTIONARY_IMPORT_SUCCESS_PREFIX,
    DICTIONARY_IMPORT_SUCCESS_SUFFIX,
    DICTIONARY_IMPORT_FAILED_PREFIX
} from './constants.js';
import {
    parseAndAppendVocabularyFiles,
    persistVocabulariesAndIndex,
    removeVocabularyById
} from './service.js';

/**
 * 初始化 dictionary（词库管理）模块。
 */
export function initDictionaryFeature({
    elements,
    deps
}) {
    const state = {
        vocabList: []
    };
    const {
        normalizeWord,
        readFileAsText,
        buildChineseTrieIndex,
        reloadSettings,
        notifyContentScripts,
        onUpdateVocabulary
    } = deps;
    const { importStatus, fileInput } = elements;

    /**
     * 渲染当前词库列表。
     */
    function render() {
        renderDictionaryList({
            elements,
            vocabList: state.vocabList,
            normalizeWord,
            onUpdateVocabulary: async (id, updateButton) => onUpdateVocabulary(id, updateButton),
            onDeleteVocabulary: async (id) => deleteVocabulary(id),
            onDeleteError: (error) => {
                if (!importStatus) {
                    return;
                }
                importStatus.textContent = `${DICTIONARY_DELETE_FAILED_PREFIX}${error.message}`;
                importStatus.className = 'import-status error';
            }
        });
    }

    /**
     * 导入词库文件并刷新全局设置。
     */
    async function importFiles(files) {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }
        if (importStatus) {
            importStatus.textContent = DICTIONARY_IMPORTING_TEXT;
            importStatus.className = 'import-status importing';
        }
        try {
            const vocabularies = await chrome.storage.local.get('vocabularies') || {};
            const existingList = vocabularies.vocabularies || [];
            const nextList = await parseAndAppendVocabularyFiles(files, existingList, readFileAsText);
            await persistVocabulariesAndIndex(nextList, buildChineseTrieIndex);
            if (importStatus) {
                importStatus.textContent = `${DICTIONARY_IMPORT_SUCCESS_PREFIX}${files.length}${DICTIONARY_IMPORT_SUCCESS_SUFFIX}`;
                importStatus.className = 'import-status success';
            }
            await reloadSettings();
            await notifyContentScripts();
            if (importStatus) {
                setTimeout(() => {
                    importStatus.textContent = '';
                }, STATUS_TIP_AUTO_HIDE_DELAY_MS);
            }
        } catch (error) {
            if (importStatus) {
                importStatus.textContent = `${DICTIONARY_IMPORT_FAILED_PREFIX}${error.message}`;
                importStatus.className = 'import-status error';
            }
        }
        if (fileInput) {
            fileInput.value = '';
        }
    }

    /**
     * 删除指定词库并刷新全局设置。
     */
    async function deleteVocabulary(id) {
        const result = await chrome.storage.local.get('vocabularies');
        const vocabList = removeVocabularyById(result.vocabularies || [], id);
        await persistVocabulariesAndIndex(vocabList, buildChineseTrieIndex);
        await reloadSettings();
        await notifyContentScripts();
    }

    /**
     * 应用 settings 中的词库数据到当前模块。
     */
    function applySettings(result) {
        state.vocabList = Array.isArray(result && result.vocabularies) ? result.vocabularies : [];
        if (elements.vocabSearchInput) {
            elements.vocabSearchInput.value = '';
        }
        render();
    }

    bindDictionaryEvents({
        elements,
        actions: {
            render,
            importFiles
        }
    });

    return {
        applySettings,
        deleteVocabulary
    };
}
