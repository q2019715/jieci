/**
 * 文件说明：dictionary（词库管理）模块渲染层。
 * 职责：渲染词库列表与空状态，并绑定每一项的操作事件。
 */
import {
    filterVocabularies,
    formatVocabularyDate
} from './service.js';
import {
    DICTIONARY_EMPTY_TEXT,
    DICTIONARY_UNNAMED_TEXT,
    DICTIONARY_WORD_COUNT_PREFIX,
    DICTIONARY_IMPORTED_AT_PREFIX,
    DICTIONARY_UPDATE_BUTTON_TEXT,
    DICTIONARY_DELETE_BUTTON_TEXT,
    DICTIONARY_DELETE_BUSY_TEXT
} from './constants.js';

/**
 * 渲染词库列表。
 */
export function renderDictionaryList({
    elements,
    vocabList,
    normalizeWord,
    onUpdateVocabulary,
    onDeleteVocabulary,
    onDeleteError
}) {
    const {
        vocabSearchInput,
        fileCount,
        filesList
    } = elements;
    if (!filesList || !fileCount) {
        return;
    }
    const query = vocabSearchInput ? vocabSearchInput.value : '';
    const filteredList = filterVocabularies(vocabList, query, normalizeWord);
    fileCount.textContent = filteredList.length;
    filesList.innerHTML = '';

    if (filteredList.length === 0) {
        filesList.innerHTML = `<div class="empty-state">${DICTIONARY_EMPTY_TEXT}</div>`;
        return;
    }

    filteredList.forEach((vocab) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = vocab.name || DICTIONARY_UNNAMED_TEXT;

        const fileMeta = document.createElement('div');
        fileMeta.className = 'file-meta';
        fileMeta.textContent = `${DICTIONARY_WORD_COUNT_PREFIX}${vocab.wordCount} | ${DICTIONARY_IMPORTED_AT_PREFIX}${formatVocabularyDate(vocab.uploadTime)}`;

        const fileActions = document.createElement('div');
        fileActions.className = 'file-actions';

        const updateButton = document.createElement('button');
        updateButton.className = 'btn btn-secondary';
        updateButton.textContent = DICTIONARY_UPDATE_BUTTON_TEXT;
        updateButton.addEventListener('click', async () => {
            await onUpdateVocabulary(vocab.id, updateButton);
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-delete';
        deleteButton.dataset.id = vocab.id;
        deleteButton.textContent = DICTIONARY_DELETE_BUTTON_TEXT;
        deleteButton.addEventListener('click', async () => {
            deleteButton.disabled = true;
            deleteButton.textContent = DICTIONARY_DELETE_BUSY_TEXT;
            try {
                await onDeleteVocabulary(vocab.id);
            } catch (error) {
                deleteButton.disabled = false;
                deleteButton.textContent = DICTIONARY_DELETE_BUTTON_TEXT;
                onDeleteError(error);
            }
        });

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileMeta);
        fileActions.appendChild(updateButton);
        fileActions.appendChild(deleteButton);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(fileActions);
        filesList.appendChild(fileItem);
    });
}
