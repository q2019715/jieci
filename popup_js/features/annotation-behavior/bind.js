/**
 * 文件说明：annotation-behavior 模块事件绑定。
 * 职责：绑定段落内标注行为设置相关控件事件。
 */
import {
    annotationModeMap,
    dedupeModeMap
} from './service.js';
import { DEDUPE_CLEAR_BUSY_TEXT } from './constants.js';
import { DEFAULT_MIN_TEXT_LENGTH } from '../../shared/constants/keys.js';

/**
 * 绑定段落内标注行为设置事件。
 */
export function bindAnnotationBehaviorEvents({
    elements,
    actions,
    renderers
}) {
    const {
        annotationModeSlider,
        annotationModeLabels,
        cnToEnOrderSelect,
        enToCnOrderSelect,
        dedupeModeSlider,
        dedupeModeLabels,
        dedupeRepeatCountSlider,
        dedupeRepeatCountLabel,
        clearDedupeCountsButton,
        maxMatchesSlider,
        maxMatchesInput,
        minTextLengthSlider,
        minTextLengthLabel,
        smartSkipCodeLinksToggle,
        smartSkipEditableTextboxesToggle
    } = elements;
    const {
        saveAnnotationMode,
        saveAnnotationOrder,
        saveDedupeMode,
        saveDedupeRepeatCount,
        clearDedupeCounts,
        saveMaxMatches,
        saveMinTextLength,
        saveSmartSkipCodeLinks,
        saveSmartSkipEditableTextboxes
    } = actions;
    const {
        updateAnnotationModeSliderUI,
        updateDedupeModeSliderUI,
        flashClearDedupeDone,
        resetClearDedupeButton
    } = renderers;

    if (annotationModeSlider) {
        annotationModeSlider.addEventListener('input', async () => {
            const value = parseInt(annotationModeSlider.value, 10);
            const mode = annotationModeMap[value];
            updateAnnotationModeSliderUI(value);
            await saveAnnotationMode(mode);
        });
    }

    annotationModeLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!annotationModeSlider) {
                return;
            }
            annotationModeSlider.value = index;
            annotationModeSlider.dispatchEvent(new Event('input'));
        });
    });

    const handleOrderChange = async () => {
        if (!cnToEnOrderSelect || !enToCnOrderSelect) {
            return;
        }
        await saveAnnotationOrder(cnToEnOrderSelect.value, enToCnOrderSelect.value);
    };
    if (cnToEnOrderSelect) {
        cnToEnOrderSelect.addEventListener('change', handleOrderChange);
    }
    if (enToCnOrderSelect) {
        enToCnOrderSelect.addEventListener('change', handleOrderChange);
    }

    if (dedupeModeSlider) {
        dedupeModeSlider.addEventListener('input', async () => {
            const value = parseInt(dedupeModeSlider.value, 10);
            const mode = dedupeModeMap[value];
            updateDedupeModeSliderUI(value);
            await saveDedupeMode(mode);
        });
    }
    dedupeModeLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!dedupeModeSlider) {
                return;
            }
            dedupeModeSlider.value = index;
            dedupeModeSlider.dispatchEvent(new Event('input'));
        });
    });
    if (dedupeRepeatCountSlider && dedupeRepeatCountLabel) {
        dedupeRepeatCountSlider.addEventListener('input', async () => {
            const repeatCount = parseInt(dedupeRepeatCountSlider.value, 10) || 10;
            dedupeRepeatCountLabel.textContent = repeatCount;
            await saveDedupeRepeatCount(repeatCount);
        });
    }
    if (clearDedupeCountsButton) {
        clearDedupeCountsButton.addEventListener('click', async () => {
            clearDedupeCountsButton.dataset.originalText = clearDedupeCountsButton.textContent;
            clearDedupeCountsButton.disabled = true;
            clearDedupeCountsButton.textContent = DEDUPE_CLEAR_BUSY_TEXT;
            try {
                await clearDedupeCounts();
                flashClearDedupeDone(clearDedupeCountsButton);
            } catch {
                resetClearDedupeButton(clearDedupeCountsButton);
            }
        });
    }

    if (maxMatchesSlider) {
        maxMatchesSlider.addEventListener('input', () => {
            const sliderMax = parseInt(maxMatchesSlider.max, 10);
            const rawValue = parseInt(maxMatchesSlider.value, 10);
            const maxMatches = rawValue >= sliderMax ? 0 : rawValue;
            saveMaxMatches(maxMatches);
        });
    }
    if (maxMatchesInput) {
        maxMatchesInput.addEventListener('change', () => {
            const inputValue = parseInt(maxMatchesInput.value, 10);
            const maxMatches = Number.isFinite(inputValue) ? inputValue : 0;
            saveMaxMatches(maxMatches);
        });
    }
    if (minTextLengthSlider && minTextLengthLabel) {
        minTextLengthSlider.addEventListener('input', async () => {
            const rawLength = parseInt(minTextLengthSlider.value, 10) || 0;
            const minLength = Math.max(DEFAULT_MIN_TEXT_LENGTH, rawLength);
            minTextLengthLabel.textContent = minLength;
            await saveMinTextLength(minLength);
        });
    }
    if (smartSkipCodeLinksToggle) {
        smartSkipCodeLinksToggle.addEventListener('change', async () => {
            await saveSmartSkipCodeLinks(smartSkipCodeLinksToggle.checked);
        });
    }
    if (smartSkipEditableTextboxesToggle) {
        smartSkipEditableTextboxesToggle.addEventListener('change', async () => {
            await saveSmartSkipEditableTextboxes(smartSkipEditableTextboxesToggle.checked);
        });
    }
}
