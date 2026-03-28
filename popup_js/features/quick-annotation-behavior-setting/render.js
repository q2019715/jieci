/**
 * 文件说明：quick-annotation-behavior-setting 渲染层。
 * 职责：维护双拉杆显示状态。
 */

import {
    REVERSE_DISPLAY_MODE_MAP,
    normalizeDisplayMode,
    normalizeSplitModeEnabled
} from './service.js';

/**
 * 更新滑杆 UI。
 */
export function updateModeSliderUI(slider, thumb, labels, value) {
    if (!slider || !thumb) {
        return;
    }
    const max = parseInt(slider.max, 10) || 1;
    const stepWidth = 100 / (max + 1);
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    thumb.style.width = `${stepWidth}%`;
    thumb.style.left = `${safeValue * stepWidth}%`;
    (labels || []).forEach((label, index) => {
        if (index === safeValue) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
}

/**
 * 根据设置回填双拉杆。
 */
export function applyQuickAnnotationSettings(elements, result = {}) {
    const fallbackMode = normalizeDisplayMode(result.displayMode || 'off');
    const splitEnabled = normalizeSplitModeEnabled(result.displayModeSplitByLanguage);
    const cnMode = normalizeDisplayMode(result.displayModeChinese || fallbackMode);
    const enMode = normalizeDisplayMode(result.displayModeEnglish || fallbackMode);
    const splitValue = splitEnabled ? 1 : 0;
    const cnValue = REVERSE_DISPLAY_MODE_MAP[cnMode];
    const enValue = REVERSE_DISPLAY_MODE_MAP[enMode];

    if (elements.quickSplitModeSlider) {
        elements.quickSplitModeSlider.value = String(splitValue);
    }
    if (elements.quickDisplayModeCnSlider) {
        elements.quickDisplayModeCnSlider.value = String(cnValue);
    }
    if (elements.quickDisplayModeEnSlider) {
        elements.quickDisplayModeEnSlider.value = String(enValue);
    }

    updateModeSliderUI(
        elements.quickSplitModeSlider,
        elements.quickSplitModeThumb,
        elements.quickSplitModeLabels,
        splitValue
    );
    updateModeSliderUI(
        elements.quickDisplayModeCnSlider,
        elements.quickDisplayModeCnThumb,
        elements.quickDisplayModeCnLabels,
        cnValue
    );
    updateModeSliderUI(
        elements.quickDisplayModeEnSlider,
        elements.quickDisplayModeEnThumb,
        elements.quickDisplayModeEnLabels,
        enValue
    );

    setLanguageModeControlsEnabled(elements, splitEnabled);
}

/**
 * 设置中英模式滑杆是否可交互。
 */
export function setLanguageModeControlsEnabled(elements, enabled) {
    const active = enabled === true;
    const controls = [
        elements.quickDisplayModeCnSlider,
        elements.quickDisplayModeEnSlider
    ];
    controls.forEach((slider) => {
        if (!slider) {
            return;
        }
        slider.disabled = !active;
        const row = slider.closest('.setting-item');
        if (row) {
            row.classList.toggle('is-disabled', !active);
        }
    });
}
