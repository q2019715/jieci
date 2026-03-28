/**
 * 文件说明：dictionary-download 模块事件绑定。
 * 职责：集中绑定词库下载与更新相关交互事件。
 */

/**
 * 绑定 dictionary-download 相关事件。
 */
export function bindDictionaryDownloadEvents({
    elements,
    handlers
}) {
    const {
        downloadBtn,
        updateAllBtn,
        modalClose,
        downloadModal,
        downloadErrorOk,
        dictSearchInput,
        dictTagFilters,
        updateModalClose,
        updateCancelBtn,
        updateRetryBtn,
        updateModal
    } = elements;
    const {
        openDownloadModal,
        closeDownloadModal,
        startUpdateAll,
        refreshDictList,
        requestUpdateCancel,
        retryLastUpdate
    } = handlers;

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            openDownloadModal();
        });
    }
    if (updateAllBtn) {
        updateAllBtn.addEventListener('click', async () => {
            await startUpdateAll();
        });
    }
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            closeDownloadModal();
        });
    }
    if (downloadModal) {
        downloadModal.addEventListener('click', (event) => {
            if (event.target === downloadModal) {
                closeDownloadModal();
            }
        });
    }
    if (downloadErrorOk) {
        downloadErrorOk.addEventListener('click', () => {
            closeDownloadModal();
        });
    }
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', () => {
            refreshDictList();
        });
    }
    if (dictTagFilters) {
        dictTagFilters.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            const target = event.target;
            if (!target || !target.classList || !target.classList.contains('dict-tag-chip')) {
                return;
            }
            event.preventDefault();
            target.click();
        });
    }
    if (updateModalClose) {
        updateModalClose.addEventListener('click', () => {
            requestUpdateCancel();
        });
    }
    if (updateCancelBtn) {
        updateCancelBtn.addEventListener('click', () => {
            requestUpdateCancel();
        });
    }
    if (updateRetryBtn) {
        updateRetryBtn.addEventListener('click', async () => {
            await retryLastUpdate();
        });
    }
    if (updateModal) {
        updateModal.addEventListener('click', (event) => {
            if (event.target === updateModal) {
                requestUpdateCancel();
            }
        });
    }
}

