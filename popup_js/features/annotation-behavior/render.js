/**
 * 文件说明：annotation-behavior 模块渲染层。
 * 职责：渲染段落内标注行为设置控件状态。
 */
import {
    reverseAnnotationModeMap,
    reverseDedupeModeMap
} from './service.js';
import { BUTTON_FEEDBACK_RESET_DELAY_MS } from '../../shared/constants/keys.js';
import {
    DEDUPE_CLEAR_DONE_TEXT,
    DEDUPE_CLEAR_FALLBACK_TEXT
} from './constants.js';
import {
    DEFAULT_MAX_MATCHES_PER_NODE,
    DEFAULT_MIN_TEXT_LENGTH
} from '../../shared/constants/keys.js';

/**
 * 更新标注模式滑块位置与标签激活态。
 */
export function updateAnnotationModeSliderUI(annotationModeSlider, annotationModeThumb, annotationModeLabels, value) {
    if (!annotationModeSlider || !annotationModeThumb) {
        return;
    }
    const percentage = (value / 2) * 100;
    annotationModeThumb.style.left = `${percentage * 0.6667}%`;
    annotationModeLabels.forEach((label, index) => {
        if (index === parseInt(value, 10)) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
}

/**
 * 将存储中的段落内标注行为设置回填到页面。
 */
export function applyAnnotationBehaviorSettings(elements, result) {
    const {
        annotationModeSlider,
        annotationModeThumb,
        annotationModeLabels,
        cnToEnOrderSelect,
        enToCnOrderSelect,
        dedupeModeSlider,
        dedupeModeThumb,
        dedupeModeLabels,
        dedupeRepeatCountSlider,
        dedupeRepeatCountLabel,
        dedupeRepeatCountSetting,
        clearDedupeCountsSetting,
        maxMatchesSlider,
        maxMatchesLabel,
        maxMatchesInput,
        minTextLengthSlider,
        minTextLengthLabel,
        smartSkipCodeLinksToggle,
        smartSkipEditableTextboxesToggle
    } = elements;
    const annotationMode = result.annotationMode || 'auto';
    const cnToEnOrder = result.cnToEnOrder || 'source-first';
    const enToCnOrder = result.enToCnOrder || 'source-first';
    let dedupeMode = result.dedupeMode || 'page';
    if (dedupeMode === 'cooldown') {
        dedupeMode = 'count';
    }
    const dedupeRepeatCount = (typeof result.dedupeRepeatCount === 'number')
        ? result.dedupeRepeatCount
        : ((typeof result.dedupeCooldownSeconds === 'number') ? result.dedupeCooldownSeconds : 50);
    const maxMatches = (typeof result.maxMatchesPerNode === 'number') ? result.maxMatchesPerNode : DEFAULT_MAX_MATCHES_PER_NODE;
    const storedMinLength = (typeof result.minTextLength === 'number') ? result.minTextLength : DEFAULT_MIN_TEXT_LENGTH;
    const minLength = Math.max(DEFAULT_MIN_TEXT_LENGTH, storedMinLength);
    const smartSkipCodeLinks = result.smartSkipCodeLinks !== false;
    const smartSkipEditableTextboxes = result.smartSkipEditableTextboxes !== false;

    if (annotationModeSlider) {
        const sliderValue = annotationMode in reverseAnnotationModeMap ? reverseAnnotationModeMap[annotationMode] : 1;
        annotationModeSlider.value = sliderValue;
        updateAnnotationModeSliderUI(annotationModeSlider, annotationModeThumb, annotationModeLabels, sliderValue);
    }
    if (cnToEnOrderSelect) {
        cnToEnOrderSelect.value = cnToEnOrder;
    }
    if (enToCnOrderSelect) {
        enToCnOrderSelect.value = enToCnOrder;
    }
    if (dedupeModeSlider) {
        const sliderValue = dedupeMode in reverseDedupeModeMap ? reverseDedupeModeMap[dedupeMode] : 1;
        dedupeModeSlider.value = sliderValue;
        updateDedupeModeSliderUI(
            dedupeModeSlider,
            dedupeModeThumb,
            dedupeModeLabels,
            dedupeRepeatCountSetting,
            clearDedupeCountsSetting,
            sliderValue
        );
    }
    if (dedupeRepeatCountSlider) {
        dedupeRepeatCountSlider.value = dedupeRepeatCount;
    }
    if (dedupeRepeatCountLabel) {
        dedupeRepeatCountLabel.textContent = dedupeRepeatCount;
    }
    updateMaxMatchesUI(maxMatchesSlider, maxMatchesLabel, maxMatchesInput, maxMatches);
    if (minTextLengthSlider) {
        minTextLengthSlider.value = minLength;
    }
    if (minTextLengthLabel) {
        minTextLengthLabel.textContent = minLength;
    }
    if (smartSkipCodeLinksToggle) {
        smartSkipCodeLinksToggle.checked = smartSkipCodeLinks;
    }
    if (smartSkipEditableTextboxesToggle) {
        smartSkipEditableTextboxesToggle.checked = smartSkipEditableTextboxes;
    }
}

/**
 * 更新去重模式滑块位置、标签激活态与附属设置显隐。
 */
export function updateDedupeModeSliderUI(
    dedupeModeSlider,
    dedupeModeThumb,
    dedupeModeLabels,
    dedupeRepeatCountSetting,
    clearDedupeCountsSetting,
    value
) {
    if (!dedupeModeSlider || !dedupeModeThumb) {
        return;
    }
    const percentage = (value / 2) * 100;
    dedupeModeThumb.style.left = `${percentage * 0.6667}%`;
    dedupeModeLabels.forEach((label, index) => {
        if (index === parseInt(value, 10)) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
    const isCountMode = parseInt(value, 10) === 2;
    if (dedupeRepeatCountSetting) {
        dedupeRepeatCountSetting.style.display = isCountMode ? '' : 'none';
    }
    if (clearDedupeCountsSetting) {
        clearDedupeCountsSetting.style.display = isCountMode ? '' : 'none';
    }
}

/**
 * 显示“清空去重计数”完成反馈并自动恢复按钮状态。
 */
export function flashClearDedupeDone(clearDedupeCountsButton) {
    if (!clearDedupeCountsButton) {
        return;
    }
    const originalText = clearDedupeCountsButton.textContent;
    clearDedupeCountsButton.textContent = DEDUPE_CLEAR_DONE_TEXT;
    setTimeout(() => {
        clearDedupeCountsButton.textContent = originalText || DEDUPE_CLEAR_FALLBACK_TEXT;
        clearDedupeCountsButton.disabled = false;
    }, BUTTON_FEEDBACK_RESET_DELAY_MS);
}

/**
 * 显示“清空去重计数失败”后的按钮恢复状态。
 */
export function resetClearDedupeButton(clearDedupeCountsButton) {
    if (!clearDedupeCountsButton) {
        return;
    }
    const originalText = clearDedupeCountsButton.dataset.originalText || clearDedupeCountsButton.textContent;
    clearDedupeCountsButton.textContent = originalText || DEDUPE_CLEAR_FALLBACK_TEXT;
    clearDedupeCountsButton.disabled = false;
}

/**
 * 更新单节点最大匹配数控件显示状态。
 */
export function updateMaxMatchesUI(maxMatchesSlider, maxMatchesLabel, maxMatchesInput, value) {
    if (!maxMatchesSlider || !maxMatchesLabel || !maxMatchesInput) {
        return;
    }
    const sliderMax = parseInt(maxMatchesSlider.max, 10);
    const isUnlimited = !Number.isFinite(value) || value <= 0;
    maxMatchesLabel.textContent = isUnlimited ? '无限' : String(value);
    maxMatchesInput.value = isUnlimited ? 0 : value;
    if (isUnlimited) {
        maxMatchesSlider.value = sliderMax;
        return;
    }
    if (value >= sliderMax) {
        maxMatchesSlider.value = sliderMax - 1;
    } else {
        maxMatchesSlider.value = Math.max(1, value);
    }
}
