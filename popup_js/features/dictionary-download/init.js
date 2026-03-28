/**
 * 文件说明：dictionary-download 模块初始化入口。
 * 职责：组装词库下载与词库更新相关状态、渲染与事件绑定。
 */
import { bindDictionaryDownloadEvents } from './bind.js';
import { renderDictList, renderDictTagFilters } from './render.js';
import {
    DICT_DOWNLOAD_UNNAMED_TEXT,
    DICT_DOWNLOAD_FAILED_PREFIX,
    DICT_DOWNLOAD_LOADING_FAILED_PREFIX,
    DICT_DOWNLOAD_SUCCESS_PREFIX,
    DICT_DOWNLOAD_PROGRESS_PREFIX,
    DICT_DOWNLOAD_DUPLICATED_TEXT,
    DICT_UPDATE_PROGRESS_TITLE_TEXT,
    DICT_UPDATE_MERGING_TEXT,
    DICT_UPDATE_FAILED_TEXT,
    DICT_UPDATE_CANCELED_TEXT,
    DICT_UPDATE_PREPARING_TEXT,
    DICT_UPDATE_RUNNING_TEXT,
    DICT_UPDATE_NONE_LOCAL_TEXT,
    DICT_UPDATE_SERVER_NOT_FOUND_TEXT,
    DICT_UPDATE_LOCAL_NOT_FOUND_TEXT,
    DICT_UPDATE_CURRENT_PREFIX,
    DICT_UPDATE_TOTAL_PROGRESS_PREFIX,
    DICT_UPDATE_SUCCESS_PREFIX,
    DICT_UPDATE_DONE_SUCCESS_PREFIX,
    DICT_UPDATE_DONE_FAILED_SEGMENT_PREFIX,
    DICT_UPDATE_DONE_FAILED_SEGMENT_SUFFIX,
    DICT_UPDATE_FAILED_PREFIX,
    DICT_UPDATE_RUNNING_PLACEHOLDER_TEXT,
    DICT_UPDATE_RUNNING_PLACEHOLDER_STATUS_TEXT,
    DICT_UPDATE_BUTTON_RUNNING_TEXT,
    DICT_UPDATE_SEPARATOR_TEXT,
    DICT_STATUS_TIP_AUTO_HIDE_DELAY_MS,
    DICT_DOWNLOAD_MODAL_CLOSE_SUCCESS_DELAY_MS,
    DICT_DOWNLOAD_MODAL_CLOSE_ERROR_DELAY_MS,
    DICT_UPDATE_MODAL_CLOSE_SHORT_DELAY_MS,
    DICT_UPDATE_MODAL_CLOSE_LONG_DELAY_MS
} from './constants.js';
import {
    fetchServerDictionaryIndex,
    hasDuplicatedVocabulary,
    downloadDictionaryData,
    saveDownloadedVocabulary,
    createCancelError,
    findServerDictByName,
    updateVocabularyEntry,
    finalizeVocabulariesUpdate,
    calculateOverallPercent
} from './service.js';

/**
 * 初始化 dictionary-download 模块。
 */
export function initDictionaryDownloadFeature({
    elements,
    deps
}) {
    const state = {
        serverDictList: [],
        selectedDictTags: new Set(),
        updateAbortXhr: null,
        updateCancelRequested: false,
        updateInProgress: false,
        updateModalCloseTimer: null,
        lastUpdateAction: null
    };
    const {
        downloadModal,
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
        updateAllBtn,
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
        updateErrorMessage
    } = elements;
    const {
        serverUrl,
        normalizeWord,
        generateId,
        buildChineseTrieIndex,
        loadSettings,
        notifyContentScripts
    } = deps;

    /**
     * 刷新当前词库列表渲染。
     */
    function refreshDictList() {
        renderDictList({
            dictList,
            dictionaries: state.serverDictList,
            query: dictSearchInput ? dictSearchInput.value : '',
            normalizeWord,
            selectedDictTags: state.selectedDictTags,
            onDictionaryClick: downloadDictionary
        });
    }

    /**
     * 打开下载弹窗并加载服务端词库索引。
     */
    async function openDownloadModal() {
        downloadModal.classList.add('show');
        if (dictSearchInput) {
            dictSearchInput.value = '';
            dictSearchInput.style.display = 'none';
        }
        state.selectedDictTags = new Set();
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
            state.serverDictList = await fetchServerDictionaryIndex(serverUrl, true);
            loadingSpinner.style.display = 'none';
            if (dictSearchInput) {
                dictSearchInput.style.display = 'block';
            }
            renderDictTagFilters({
                dictTagFilters,
                dictionaries: state.serverDictList,
                selectedDictTags: state.selectedDictTags,
                onTagChange: refreshDictList
            });
            refreshDictList();
        } catch (error) {
            loadingSpinner.textContent = `${DICT_DOWNLOAD_LOADING_FAILED_PREFIX}${error.message}`;
            console.error('获取词库列表失败:', error);
        }
    }

    /**
     * 关闭下载弹窗。
     */
    function closeDownloadModal() {
        downloadModal.classList.remove('show');
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
    }

    /**
     * 下载并导入指定词库。
     */
    async function downloadDictionary(dict) {
        if (dictSearchInput) {
            dictSearchInput.style.display = 'none';
        }
        if (dictTagFilters) {
            dictTagFilters.style.display = 'none';
        }
        dictList.style.display = 'none';
        downloadProgress.style.display = 'block';
        downloadingDict.textContent = `${DICT_DOWNLOAD_PROGRESS_PREFIX}${dict.name}`;
        progressPercent.textContent = '0%';
        progressBar.style.width = '0%';
        if (downloadErrorOk) {
            downloadErrorOk.style.display = 'none';
        }
        try {
            const vocabularies = await chrome.storage.local.get('vocabularies') || {};
            const vocabList = vocabularies.vocabularies || [];
            if (hasDuplicatedVocabulary(dict.name, vocabList)) {
                downloadingDict.textContent = DICT_DOWNLOAD_DUPLICATED_TEXT;
                progressPercent.textContent = '';
                if (downloadErrorOk) {
                    downloadErrorOk.style.display = 'inline-flex';
                }
                return;
            }
            const data = await downloadDictionaryData(serverUrl, dict, (percent) => {
                progressPercent.textContent = `${percent}%`;
                progressBar.style.width = `${percent}%`;
            });
            await saveDownloadedVocabulary({
                dict,
                data,
                generateId,
                buildChineseTrieIndex
            });
            progressPercent.textContent = '100%';
            progressBar.style.width = '100%';
            setTimeout(async () => {
                closeDownloadModal();
                await loadSettings();
                notifyContentScripts();
                importStatus.textContent = `${DICT_DOWNLOAD_SUCCESS_PREFIX}${dict.name}`;
                importStatus.className = 'import-status success';
                setTimeout(() => {
                    importStatus.textContent = '';
                }, DICT_STATUS_TIP_AUTO_HIDE_DELAY_MS);
            }, DICT_DOWNLOAD_MODAL_CLOSE_SUCCESS_DELAY_MS);
        } catch (error) {
            downloadingDict.textContent = `${DICT_DOWNLOAD_FAILED_PREFIX}${error.message}`;
            progressPercent.textContent = '';
            console.error('下载词库失败:', error);
            setTimeout(() => {
                closeDownloadModal();
            }, DICT_DOWNLOAD_MODAL_CLOSE_ERROR_DELAY_MS);
        }
    }

    /**
     * 打开词库更新弹窗。
     */
    function openUpdateModal() {
        if (!updateModal) {
            return;
        }
        updateModal.classList.add('show');
        if (state.updateModalCloseTimer) {
            clearTimeout(state.updateModalCloseTimer);
            state.updateModalCloseTimer = null;
        }
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'none';
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = false;
        }
        setUpdateError('');
        setUpdateProgressVisible(true);
        updateCurrentProgress(DICT_UPDATE_PROGRESS_TITLE_TEXT, 0);
        if (updateOverall) {
            updateOverall.style.display = 'none';
        }
    }

    /**
     * 关闭词库更新弹窗。
     */
    function closeUpdateModal() {
        if (!updateModal) {
            return;
        }
        updateModal.classList.remove('show');
    }

    /**
     * 设置更新弹窗错误信息。
     */
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

    /**
     * 根据导入状态文本同步更新弹窗错误信息。
     */
    function syncUpdateErrorFromImportStatus() {
        if (!updateModal || !updateModal.classList.contains('show')) {
            return;
        }
        if (!importStatus) {
            return;
        }
        if (String(importStatus.className || '').includes('error')) {
            setUpdateError(importStatus.textContent || DICT_UPDATE_FAILED_TEXT);
            return;
        }
        setUpdateError('');
    }

    /**
     * 计算当前弹窗是否可自动关闭。
     */
    function shouldAutoCloseUpdateModal() {
        return !updateRetryBtn || updateRetryBtn.style.display === 'none';
    }

    /**
     * 延迟关闭更新弹窗。
     */
    function scheduleUpdateModalClose(delayMs) {
        if (!updateModal) {
            return;
        }
        if (state.updateModalCloseTimer) {
            clearTimeout(state.updateModalCloseTimer);
        }
        state.updateModalCloseTimer = setTimeout(() => {
            setUpdateProgressVisible(false);
            closeUpdateModal();
        }, delayMs);
    }

    /**
     * 设置更新进度区域显示状态。
     */
    function setUpdateProgressVisible(visible) {
        if (!updateProgress) {
            return;
        }
        updateProgress.style.display = visible ? 'block' : 'none';
        if (!visible && updateOverall) {
            updateOverall.style.display = 'none';
        }
    }

    /**
     * 更新“当前词库”进度条显示。
     */
    function updateCurrentProgress(label, percent) {
        if (!updateProgressLabel || !updateProgressPercent || !updateProgressBar) {
            return;
        }
        if (percent >= 100) {
            updateProgressLabel.textContent = DICT_UPDATE_MERGING_TEXT;
        } else {
            updateProgressLabel.textContent = label;
        }
        updateProgressPercent.textContent = `${percent}%`;
        updateProgressBar.style.width = `${percent}%`;
    }

    /**
     * 更新“全部词库”进度条显示。
     */
    function updateOverallProgress(label, percent) {
        if (!updateOverall || !updateOverallLabel || !updateOverallPercent || !updateOverallBar) {
            return;
        }
        updateOverall.style.display = 'block';
        updateOverallLabel.textContent = label;
        updateOverallPercent.textContent = `${percent}%`;
        updateOverallBar.style.width = `${percent}%`;
    }

    /**
     * 显示更新错误信息并允许重试。
     */
    function showUpdateError(message) {
        importStatus.textContent = message;
        importStatus.className = 'import-status error';
        setUpdateError(message);
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'inline-flex';
        }
    }

    /**
     * 显示“更新已取消”状态。
     */
    function showUpdateCanceled() {
        showUpdateError(DICT_UPDATE_CANCELED_TEXT);
    }

    /**
     * 拉取指定词库数据，支持取消与进度回调。
     */
    async function fetchDictionaryDataForUpdate(dict, onProgress) {
        return downloadDictionaryData(serverUrl, dict, onProgress, {
            cacheBust: true,
            onXhrCreate: (xhr) => {
                state.updateAbortXhr = xhr;
            },
            onXhrRelease: () => {
                state.updateAbortXhr = null;
            },
            cancelErrorFactory: createCancelError
        });
    }

    /**
     * 取消当前更新流程。
     */
    function requestUpdateCancel() {
        if (!state.updateInProgress) {
            closeUpdateModal();
            return;
        }
        state.updateCancelRequested = true;
        if (state.updateAbortXhr) {
            state.updateAbortXhr.abort();
        }
        if (updateCancelBtn) {
            updateCancelBtn.disabled = true;
        }
        updateCurrentProgress(DICT_UPDATE_CANCELED_TEXT, 0);
        if (updateRetryBtn) {
            updateRetryBtn.style.display = 'inline-flex';
        }
        importStatus.textContent = DICT_UPDATE_CANCELED_TEXT;
        importStatus.className = 'import-status error';
        scheduleUpdateModalClose(DICT_UPDATE_MODAL_CLOSE_SHORT_DELAY_MS);
    }

    /**
     * 启动“更新全部词库”流程。
     */
    async function startUpdateAll() {
        state.lastUpdateAction = { type: 'all' };
        state.updateCancelRequested = false;
        openUpdateModal();
        await updateAllVocabularies();
    }

    /**
     * 启动“更新单个词库”流程。
     */
    async function startUpdateSingle(vocabId, updateButton) {
        state.lastUpdateAction = { type: 'single', vocabId };
        state.updateCancelRequested = false;
        openUpdateModal();
        await updateSingleVocabulary(vocabId, updateButton);
    }

    /**
     * 重试上一次更新动作。
     */
    async function retryLastUpdate() {
        if (!state.lastUpdateAction) {
            return;
        }
        if (state.lastUpdateAction.type === 'all') {
            await startUpdateAll();
            return;
        }
        await startUpdateSingle(state.lastUpdateAction.vocabId);
    }

    /**
     * 处理“更新全部词库”主流程。
     */
    async function updateAllVocabularies() {
        if (!updateAllBtn) {
            return;
        }
        state.updateInProgress = true;
        setUpdateError('');
        updateAllBtn.disabled = true;
        importStatus.textContent = DICT_UPDATE_RUNNING_TEXT;
        importStatus.className = 'import-status importing';
        updateCurrentProgress(DICT_UPDATE_PREPARING_TEXT, 0);
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
            const dictionaries = await fetchServerDictionaryIndex(serverUrl, false);
            const result = await chrome.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            if (vocabList.length === 0) {
                importStatus.textContent = DICT_UPDATE_NONE_LOCAL_TEXT;
                importStatus.className = 'import-status error';
                return;
            }
            const failures = [];
            let successCount = 0;
            let processedCount = 0;
            for (const vocab of vocabList) {
                if (state.updateCancelRequested) {
                    showUpdateCanceled();
                    return;
                }
                const dict = findServerDictByName(dictionaries, vocab.name);
                if (!dict) {
                    failures.push(`${vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}: ${DICT_UPDATE_SERVER_NOT_FOUND_TEXT}`);
                    processedCount += 1;
                    updateOverallProgress(`${DICT_UPDATE_TOTAL_PROGRESS_PREFIX}${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                    continue;
                }
                try {
                    updateCurrentProgress(`${DICT_UPDATE_CURRENT_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`, 0);
                    vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (targetDict) => {
                        return fetchDictionaryDataForUpdate(targetDict, (percent) => {
                            updateCurrentProgress(`${DICT_UPDATE_CURRENT_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`, percent);
                            updateOverallProgress(
                                `${DICT_UPDATE_TOTAL_PROGRESS_PREFIX}${processedCount}/${vocabList.length}`,
                                calculateOverallPercent(processedCount, vocabList.length, percent)
                            );
                        });
                    });
                    successCount += 1;
                    importStatus.textContent = `${DICT_UPDATE_RUNNING_TEXT} (${successCount}/${vocabList.length})`;
                } catch (error) {
                    if (error && error.isCanceled) {
                        showUpdateCanceled();
                        return;
                    }
                    failures.push(`${vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}: ${error.message}`);
                } finally {
                    processedCount += 1;
                    updateOverallProgress(`${DICT_UPDATE_TOTAL_PROGRESS_PREFIX}${processedCount}/${vocabList.length}`, Math.round((processedCount / vocabList.length) * 100));
                }
            }
            if (state.updateCancelRequested) {
                showUpdateCanceled();
                return;
            }
            await finalizeVocabulariesUpdate(vocabList, buildChineseTrieIndex);
            await loadSettings();
            notifyContentScripts();
            if (failures.length > 0) {
                importStatus.textContent = `${DICT_UPDATE_DONE_SUCCESS_PREFIX}${successCount}${DICT_UPDATE_DONE_FAILED_SEGMENT_PREFIX}${failures.length}${DICT_UPDATE_DONE_FAILED_SEGMENT_SUFFIX}${failures.join(DICT_UPDATE_SEPARATOR_TEXT)}`;
                importStatus.className = 'import-status error';
                if (updateRetryBtn) {
                    updateRetryBtn.style.display = 'inline-flex';
                }
            } else {
                importStatus.textContent = `${DICT_UPDATE_DONE_SUCCESS_PREFIX}${successCount}`;
                importStatus.className = 'import-status success';
            }
        } catch (error) {
            if (error && error.isCanceled) {
                importStatus.textContent = DICT_UPDATE_CANCELED_TEXT;
                importStatus.className = 'import-status error';
            } else {
                importStatus.textContent = `${DICT_UPDATE_FAILED_PREFIX}${error.message}`;
                importStatus.className = 'import-status error';
            }
            if (updateRetryBtn) {
                updateRetryBtn.style.display = 'inline-flex';
            }
        } finally {
            updateAllBtn.disabled = false;
            state.updateInProgress = false;
            state.updateAbortXhr = null;
            if (shouldAutoCloseUpdateModal()) {
                scheduleUpdateModalClose(DICT_UPDATE_MODAL_CLOSE_LONG_DELAY_MS);
            }
        }
    }

    /**
     * 处理“更新单个词库”主流程。
     */
    async function updateSingleVocabulary(vocabId, updateButton) {
        const originalText = updateButton ? updateButton.textContent : '';
        if (updateButton) {
            updateButton.disabled = true;
            updateButton.textContent = DICT_UPDATE_BUTTON_RUNNING_TEXT;
        }
        state.updateInProgress = true;
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
        updateCurrentProgress(DICT_UPDATE_RUNNING_PLACEHOLDER_TEXT, 0);
        importStatus.textContent = DICT_UPDATE_RUNNING_PLACEHOLDER_STATUS_TEXT;
        importStatus.className = 'import-status importing';
        try {
            const dictionaries = await fetchServerDictionaryIndex(serverUrl, false);
            const result = await chrome.storage.local.get('vocabularies');
            let vocabList = result.vocabularies || [];
            const vocab = vocabList.find((item) => item.id === vocabId);
            if (!vocab) {
                showUpdateError(DICT_UPDATE_LOCAL_NOT_FOUND_TEXT);
                return;
            }
            const dict = findServerDictByName(dictionaries, vocab.name);
            if (!dict) {
                showUpdateError(DICT_UPDATE_SERVER_NOT_FOUND_TEXT);
                return;
            }
            updateCurrentProgress(`${DICT_UPDATE_CURRENT_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`, 0);
            importStatus.textContent = `${DICT_UPDATE_CURRENT_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`;
            vocabList = await updateVocabularyEntry(vocabList, vocab, dict, (targetDict) => {
                return fetchDictionaryDataForUpdate(targetDict, (percent) => {
                    updateCurrentProgress(`${DICT_UPDATE_CURRENT_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`, percent);
                });
            });
            if (state.updateCancelRequested) {
                showUpdateCanceled();
                return;
            }
            await finalizeVocabulariesUpdate(vocabList, buildChineseTrieIndex);
            await loadSettings();
            notifyContentScripts();
            importStatus.textContent = `${DICT_UPDATE_SUCCESS_PREFIX}${dict.name || vocab.name || DICT_DOWNLOAD_UNNAMED_TEXT}`;
            importStatus.className = 'import-status success';
        } catch (error) {
            if (error && error.isCanceled) {
                importStatus.textContent = DICT_UPDATE_CANCELED_TEXT;
                importStatus.className = 'import-status error';
            } else {
                importStatus.textContent = `${DICT_UPDATE_FAILED_PREFIX}${error.message}`;
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
            state.updateInProgress = false;
            state.updateAbortXhr = null;
            if (shouldAutoCloseUpdateModal()) {
                scheduleUpdateModalClose(DICT_UPDATE_MODAL_CLOSE_LONG_DELAY_MS);
            }
        }
    }

    bindDictionaryDownloadEvents({
        elements,
        handlers: {
            openDownloadModal,
            closeDownloadModal,
            startUpdateAll,
            refreshDictList,
            requestUpdateCancel,
            retryLastUpdate
        }
    });

    /**
     * 监听 importStatus 变化，同步更新弹窗错误展示。
     */
    function bindUpdateErrorObserver() {
        if (!importStatus || typeof MutationObserver === 'undefined') {
            return;
        }
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

    bindUpdateErrorObserver();

    return {
        openDownloadModal,
        closeDownloadModal,
        startUpdateAll,
        startUpdateSingle,
        requestUpdateCancel
    };
}
