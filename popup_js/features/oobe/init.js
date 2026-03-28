/**
 * 文件说明：oobe 模块初始化入口。
 * 职责：管理 OOBE 的步骤状态、完成状态、文案与事件。
 */
import { bindOobeEvents } from './bind.js';
import {
    applyOobeCopy,
    renderOobeVocabList,
    setOobeStep,
    setOobeVisible
} from './render.js';

/**
 * 初始化 oobe 模块。
 */
export function initOobeFeature({
    elements,
    deps,
    actions
}) {
    const {
        oobeCompletionKey,
        oobeStepKey,
        oobeRequiredCount
    } = deps;
    const {
        showMainPage,
        openDownloadModal,
        openExamplePage,
        deleteVocabulary,
        reportDeleteError
    } = actions;

    /**
     * 切换 OOBE 步骤并写入本地存储。
     */
    function showOobeStep(step) {
        setOobeStep(elements, step);
        chrome.storage.local.set({ [oobeStepKey]: step }).catch(() => {
        });
    }

    /**
     * 将 OOBE 标记为已完成。
     */
    async function markOobeCompleted() {
        const result = await chrome.storage.local.get(oobeCompletionKey);
        const current = Number.isFinite(result[oobeCompletionKey])
            ? result[oobeCompletionKey]
            : 0;
        const next = Math.min(oobeRequiredCount, current + 1);
        await chrome.storage.local.set({ [oobeCompletionKey]: next });
        await chrome.storage.local.remove(oobeStepKey);
        setOobeVisible(elements, false);
        showMainPage();
    }

    /**
     * 根据当前词库数据刷新 OOBE 词库区。
     */
    function updateOobeVocabList(vocabList) {
        renderOobeVocabList(elements, vocabList, {
            onDeleteVocabulary: deleteVocabulary,
            onDeleteError: reportDeleteError
        });
    }

    /**
     * 根据本地设置同步 OOBE 显示状态与步骤。
     */
    function applyOobeStateFromSettings(result, vocabList) {
        updateOobeVocabList(vocabList);
        const completionCount = Number.isFinite(result[oobeCompletionKey])
            ? result[oobeCompletionKey]
            : 0;
        const shouldShowOobe = completionCount < oobeRequiredCount;
        setOobeVisible(elements, shouldShowOobe);
        if (!shouldShowOobe) {
            return;
        }
        const storedStep = Number.isFinite(result[oobeStepKey])
            ? result[oobeStepKey]
            : 1;
        const step = Math.min(3, Math.max(1, storedStep));
        showOobeStep(step);
    }

    applyOobeCopy(elements);
    bindOobeEvents(elements, {
        showOobeStep,
        openDownloadModal,
        openExamplePage,
        markOobeCompleted
    });

    return {
        showOobeStep,
        markOobeCompleted,
        updateOobeVocabList,
        applyOobeStateFromSettings
    };
}

