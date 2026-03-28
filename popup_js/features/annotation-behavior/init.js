/**
 * 文件说明：annotation-behavior 模块初始化入口。
 * 职责：组装段落内标注行为设置的渲染、事件绑定与存储同步。
 */
import { bindAnnotationBehaviorEvents } from './bind.js';
import {
    applyAnnotationBehaviorSettings,
    updateAnnotationModeSliderUI,
    updateDedupeModeSliderUI,
    flashClearDedupeDone,
    resetClearDedupeButton,
    updateMaxMatchesUI
} from './render.js';
import {
    saveAnnotationMode,
    saveAnnotationOrder,
    saveDedupeMode,
    saveDedupeRepeatCount,
    clearDedupeCounts,
    saveMaxMatchesPerNode,
    saveMinTextLength,
    saveSmartSkipCodeLinks,
    saveSmartSkipEditableTextboxes
} from './service.js';
import { DEFAULT_MIN_TEXT_LENGTH } from '../../shared/constants/keys.js';

/**
 * 初始化段落内标注行为设置模块。
 */
export function initAnnotationBehaviorFeature({
    elements,
    deps
}) {
    const {
        annotationModeSlider,
        annotationModeThumb,
        annotationModeLabels,
        dedupeModeSlider,
        dedupeModeThumb,
        dedupeModeLabels,
        dedupeRepeatCountSetting,
        clearDedupeCountsSetting,
        maxMatchesSlider,
        maxMatchesLabel,
        maxMatchesInput
    } = elements;
    const { notifyActiveTabs } = deps;

    /**
     * 应用来自存储的段落内标注行为设置。
     */
    async function applySettings(result) {
        applyAnnotationBehaviorSettings(elements, result);
        const storedMinLength = (typeof result.minTextLength === 'number') ? result.minTextLength : DEFAULT_MIN_TEXT_LENGTH;
        const minLength = Math.max(DEFAULT_MIN_TEXT_LENGTH, storedMinLength);
        if (storedMinLength < DEFAULT_MIN_TEXT_LENGTH) {
            await saveMinTextLength(minLength, notifyActiveTabs);
        }
        if (result.smartSkipEditableTextboxes === undefined) {
            await saveSmartSkipEditableTextboxes(true, notifyActiveTabs);
        }
    }

    bindAnnotationBehaviorEvents({
        elements,
        actions: {
            saveAnnotationMode: async (mode) => saveAnnotationMode(mode, notifyActiveTabs),
            saveAnnotationOrder: async (cnToEnOrder, enToCnOrder) => saveAnnotationOrder(cnToEnOrder, enToCnOrder, notifyActiveTabs),
            saveDedupeMode: async (mode) => saveDedupeMode(mode, notifyActiveTabs),
            saveDedupeRepeatCount: async (repeatCount) => saveDedupeRepeatCount(repeatCount, notifyActiveTabs),
            clearDedupeCounts: async () => clearDedupeCounts(notifyActiveTabs),
            saveMaxMatches: async (value) => {
                const maxMatches = (!Number.isFinite(value) || value <= 0) ? 0 : Math.max(1, Math.floor(value));
                updateMaxMatchesUI(maxMatchesSlider, maxMatchesLabel, maxMatchesInput, maxMatches);
                await saveMaxMatchesPerNode(maxMatches, notifyActiveTabs);
            },
            saveMinTextLength: async (minLength) => saveMinTextLength(minLength, notifyActiveTabs),
            saveSmartSkipCodeLinks: async (enabled) => saveSmartSkipCodeLinks(enabled, notifyActiveTabs),
            saveSmartSkipEditableTextboxes: async (enabled) => saveSmartSkipEditableTextboxes(enabled, notifyActiveTabs)
        },
        renderers: {
            updateAnnotationModeSliderUI: (value) => {
                updateAnnotationModeSliderUI(annotationModeSlider, annotationModeThumb, annotationModeLabels, value);
            },
            updateDedupeModeSliderUI: (value) => {
                updateDedupeModeSliderUI(
                    dedupeModeSlider,
                    dedupeModeThumb,
                    dedupeModeLabels,
                    dedupeRepeatCountSetting,
                    clearDedupeCountsSetting,
                    value
                );
            },
            flashClearDedupeDone,
            resetClearDedupeButton
        }
    });

    return {
        applySettings
    };
}
