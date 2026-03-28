/**
 * 文件说明：blocked-words 模块事件绑定。
 * 职责：绑定屏蔽词页面导航、搜索、选择、批量删除、导入导出事件。
 */

/**
 * 绑定屏蔽词页面相关事件。
 */
export function bindBlockedWordsEvents({
    elements,
    actions,
    state,
    deps
}) {
    const {
        quickBlocked,
        blockedNav,
        blockedBack,
        pageMain,
        pageAdvanced,
        pageBlocked,
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
    } = elements;
    const {
        showPage,
        render,
        persist,
        parseWordLines,
        readFileAsText,
        exportWords,
        updateActions,
        resetDeleteSelectedButton,
        updateDeleteSelectedButton
    } = actions;
    const { deleteSelectedConfirmDelay, deleteSelectedDoneDelay } = deps;

    /**
     * 进入屏蔽词页面（从主页面入口）。
     */
    function openFromMain() {
        state.entrySource = 'main';
        showPage(pageBlocked);
    }

    /**
     * 进入屏蔽词页面（从高级页面入口）。
     */
    function openFromAdvanced() {
        state.entrySource = 'advanced';
        showPage(pageBlocked);
    }

    /**
     * 从屏蔽词页面返回来源页面。
     */
    function backFromBlocked() {
        showPage(state.entrySource === 'advanced' ? pageAdvanced : pageMain);
    }

    function setImportStatus(message, isError = false) {
        if (!blockedImportStatus) {
            return;
        }
        blockedImportStatus.textContent = message || '';
        blockedImportStatus.classList.toggle('error', isError === true);
    }

    function switchImportPane(mode) {
        if (blockedImportFilePane) {
            blockedImportFilePane.style.display = mode === 'file' ? 'block' : 'none';
        }
        if (blockedImportManualPane) {
            blockedImportManualPane.style.display = mode === 'manual' ? 'block' : 'none';
        }
    }

    function parseManualWords(content) {
        return String(content || '')
            .split(/[\r\n,，\s;；]+/)
            .map((word) => String(word || '').trim().toLowerCase())
            .filter(Boolean);
    }

    async function importWords(words) {
        const normalized = Array.from(new Set((words || []).map((word) => String(word || '').trim().toLowerCase()).filter(Boolean)));
        if (normalized.length === 0) {
            return { added: 0, total: 0 };
        }
        const existing = new Set(state.words || []);
        let added = 0;
        normalized.forEach((word) => {
            if (!existing.has(word)) {
                existing.add(word);
                added += 1;
            }
        });
        state.words = Array.from(existing);
        state.selected = new Set();
        await persist();
        render();
        return { added, total: normalized.length };
    }

    function openImportModal() {
        if (!blockedImportModal) {
            if (blockedImportInput) {
                blockedImportInput.click();
            }
            return;
        }
        setImportStatus('');
        switchImportPane('choice');
        blockedImportModal.classList.add('show');
    }

    function closeImportModal() {
        if (!blockedImportModal) {
            return;
        }
        blockedImportModal.classList.remove('show');
        setImportStatus('');
        switchImportPane('choice');
        if (blockedImportInput) {
            blockedImportInput.value = '';
        }
        if (blockedManualInput) {
            blockedManualInput.value = '';
        }
    }

    function triggerBlockedFileSelect() {
        if (!blockedImportInput) {
            return;
        }
        blockedImportInput.click();
    }

    if (quickBlocked) {
        quickBlocked.addEventListener('click', openFromMain);
    }
    if (blockedNav) {
        blockedNav.addEventListener('click', openFromAdvanced);
    }
    if (blockedBack) {
        blockedBack.addEventListener('click', backFromBlocked);
    }
    if (blockedSearchInput) {
        blockedSearchInput.addEventListener('input', () => {
            render();
        });
    }
    if (blockedSelectAll) {
        blockedSelectAll.addEventListener('click', () => {
            const filtered = updateActions();
            const allSelected = filtered.length > 0 && filtered.every((item) => state.selected.has(item));
            if (allSelected) {
                filtered.forEach((item) => state.selected.delete(item));
            } else {
                filtered.forEach((item) => state.selected.add(item));
            }
            render();
        });
    }
    if (blockedDeleteSelected) {
        blockedDeleteSelected.addEventListener('click', async () => {
            if (state.selected.size === 0) {
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
                state.words = state.words.filter((word) => !state.selected.has(word));
                state.selected = new Set();
                await persist();
                render();
                blockedDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(blockedDeleteSelected);
                    updateActions();
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
                updateDeleteSelectedButton(blockedDeleteSelected, state.selected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (blockedImportBtn) {
        blockedImportBtn.addEventListener('click', openImportModal);
    }
    if (blockedImportModalClose) {
        blockedImportModalClose.addEventListener('click', closeImportModal);
    }
    if (blockedImportModal) {
        blockedImportModal.addEventListener('click', (event) => {
            if (event.target === blockedImportModal) {
                closeImportModal();
            }
        });
    }
    if (blockedImportFromFileBtn) {
        blockedImportFromFileBtn.addEventListener('click', () => {
            switchImportPane('file');
            setImportStatus('');
            triggerBlockedFileSelect();
        });
    }
    if (blockedImportManualBtn) {
        blockedImportManualBtn.addEventListener('click', () => {
            switchImportPane('manual');
            setImportStatus('');
            if (blockedManualInput) {
                blockedManualInput.focus();
            }
        });
    }
    if (blockedChooseFileBtn && blockedImportInput) {
        blockedChooseFileBtn.addEventListener('click', () => {
            setImportStatus('');
            triggerBlockedFileSelect();
        });
    }
    if (blockedImportInput) {
        blockedImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }
            try {
                const content = await readFileAsText(file);
                const words = parseWordLines(content);
                const result = await importWords(words);
                if (result.total === 0) {
                    setImportStatus('导入失败：未识别到有效单词', true);
                    return;
                }
                setImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
            } catch (error) {
                setImportStatus(`导入失败：${error.message}`, true);
            } finally {
                blockedImportInput.value = '';
            }
        });
    }
    if (blockedManualImportConfirm && blockedManualInput) {
        blockedManualImportConfirm.addEventListener('click', async () => {
            const words = parseManualWords(blockedManualInput.value);
            if (words.length === 0) {
                setImportStatus('请输入有效单词后再导入', true);
                return;
            }
            try {
                const result = await importWords(words);
                setImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
                blockedManualInput.value = '';
            } catch (error) {
                setImportStatus(`导入失败：${error.message}`, true);
            }
        });
    }
    if (blockedExportBtn) {
        blockedExportBtn.addEventListener('click', () => {
            exportWords(state.words, 'blocked-words.txt');
        });
    }
}

