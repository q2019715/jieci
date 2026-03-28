/**
 * 文件说明：favorite-words 模块事件绑定。
 * 职责：绑定收藏词页面导航、选择、批量删除、导入导出事件。
 */

/**
 * 绑定收藏词页面相关事件。
 */
export function bindFavoriteWordsEvents({
    elements,
    actions,
    state,
    deps
}) {
    const {
        quickFavorites,
        favoritesNav,
        favoritesBack,
        pageMain,
        pageAdvanced,
        pageFavorites,
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
     * 进入收藏词页面（从主页面入口）。
     */
    function openFromMain() {
        state.entrySource = 'main';
        showPage(pageFavorites);
    }

    /**
     * 进入收藏词页面（从高级页面入口）。
     */
    function openFromAdvanced() {
        state.entrySource = 'advanced';
        showPage(pageFavorites);
    }

    /**
     * 返回到收藏词来源页面。
     */
    function backFromFavorites() {
        showPage(state.entrySource === 'advanced' ? pageAdvanced : pageMain);
    }

    function setImportStatus(message, isError = false) {
        if (!favoritesImportStatus) {
            return;
        }
        favoritesImportStatus.textContent = message || '';
        favoritesImportStatus.classList.toggle('error', isError === true);
    }

    function switchImportPane(mode) {
        if (favoritesImportFilePane) {
            favoritesImportFilePane.style.display = mode === 'file' ? 'block' : 'none';
        }
        if (favoritesImportManualPane) {
            favoritesImportManualPane.style.display = mode === 'manual' ? 'block' : 'none';
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
        if (!favoritesImportModal) {
            if (favoritesImportInput) {
                favoritesImportInput.click();
            }
            return;
        }
        setImportStatus('');
        switchImportPane('choice');
        favoritesImportModal.classList.add('show');
    }

    function closeImportModal() {
        if (!favoritesImportModal) {
            return;
        }
        favoritesImportModal.classList.remove('show');
        setImportStatus('');
        switchImportPane('choice');
        if (favoritesImportInput) {
            favoritesImportInput.value = '';
        }
        if (favoritesManualInput) {
            favoritesManualInput.value = '';
        }
    }

    function triggerFavoritesFileSelect() {
        if (!favoritesImportInput) {
            return;
        }
        favoritesImportInput.click();
    }

    if (quickFavorites) {
        quickFavorites.addEventListener('click', openFromMain);
    }
    if (favoritesNav) {
        favoritesNav.addEventListener('click', openFromAdvanced);
    }
    if (favoritesBack) {
        favoritesBack.addEventListener('click', backFromFavorites);
    }
    if (favoritesSearchInput) {
        favoritesSearchInput.addEventListener('input', () => {
            render();
        });
    }
    if (favoritesSelectAll) {
        favoritesSelectAll.addEventListener('click', () => {
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
    if (favoritesDeleteSelected) {
        favoritesDeleteSelected.addEventListener('click', async () => {
            if (state.selected.size === 0) {
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
                state.words = state.words.filter((word) => !state.selected.has(word));
                state.selected = new Set();
                await persist();
                render();
                favoritesDeleteSelected._doneTimer = setTimeout(() => {
                    resetDeleteSelectedButton(favoritesDeleteSelected);
                    updateActions();
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
                updateDeleteSelectedButton(favoritesDeleteSelected, state.selected.size > 0);
            }, deleteSelectedConfirmDelay);
        });
    }
    if (favoritesImportBtn) {
        favoritesImportBtn.addEventListener('click', openImportModal);
    }
    if (favoritesImportModalClose) {
        favoritesImportModalClose.addEventListener('click', closeImportModal);
    }
    if (favoritesImportModal) {
        favoritesImportModal.addEventListener('click', (event) => {
            if (event.target === favoritesImportModal) {
                closeImportModal();
            }
        });
    }
    if (favoritesImportFromFileBtn) {
        favoritesImportFromFileBtn.addEventListener('click', () => {
            switchImportPane('choice');
            setImportStatus('');
            triggerFavoritesFileSelect();
        });
    }
    if (favoritesImportManualBtn) {
        favoritesImportManualBtn.addEventListener('click', () => {
            switchImportPane('manual');
            setImportStatus('');
            if (favoritesManualInput) {
                favoritesManualInput.focus();
            }
        });
    }
    if (favoritesChooseFileBtn && favoritesImportInput) {
        favoritesChooseFileBtn.addEventListener('click', () => {
            setImportStatus('');
            triggerFavoritesFileSelect();
        });
    }
    if (favoritesImportInput) {
        favoritesImportInput.addEventListener('change', async (event) => {
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
                favoritesImportInput.value = '';
            }
        });
    }
    if (favoritesManualImportConfirm && favoritesManualInput) {
        favoritesManualImportConfirm.addEventListener('click', async () => {
            const words = parseManualWords(favoritesManualInput.value);
            if (words.length === 0) {
                setImportStatus('请输入有效单词后再导入', true);
                return;
            }
            try {
                const result = await importWords(words);
                setImportStatus(`导入完成：新增 ${result.added} 条，识别 ${result.total} 条`);
                favoritesManualInput.value = '';
            } catch (error) {
                setImportStatus(`导入失败：${error.message}`, true);
            }
        });
    }
    if (favoritesExportBtn) {
        favoritesExportBtn.addEventListener('click', () => {
            exportWords(state.words, 'favorite-words.txt');
        });
    }
}

