/**
 * 文件说明：display-mode 模块渲染层。
 * 职责：渲染显示模式滑块与标签激活态。
 */
import { reverseDisplayModeMap } from './service.js';

/**
 * 更新显示模式滑块位置和标签状态。
 */
export function updateDisplayModeSliderUI(displayModeSlider, displayModeThumb, displayModeLabels, value) {
    if (!displayModeSlider || !displayModeThumb) {
        return;
    }
    const max = parseInt(displayModeSlider.max, 10) || 1;
    const stepWidth = 100 / (max + 1);
    displayModeThumb.style.width = `${stepWidth}%`;
    displayModeThumb.style.left = `${parseInt(value, 10) * stepWidth}%`;
    displayModeLabels.forEach((label, index) => {
        if (index === parseInt(value, 10)) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
}

/**
 * 更新首页显示模式标题。
 */
export function updateDisplayModeLabel(displayModeLabelText, splitEnabled, pageLanguage) {
    if (!displayModeLabelText) {
        return;
    }
    if (splitEnabled !== true) {
        displayModeLabelText.textContent = '插件工作模式';
        return;
    }
    displayModeLabelText.textContent = pageLanguage === 'english' ? '英语网页工作模式' : '中文网页工作模式';
}

/**
 * 根据存储设置回填显示模式控件。
 */
export function applyDisplayModeSettings(elements, result) {
    const {
        displayModeLabelText,
        displayModeSlider,
        displayModeThumb,
        displayModeLabels
    } = elements;
    const splitEnabled = result.displayModeSplitByLanguage !== false;
    const pageLanguage = result.pageLanguage === 'english' ? 'english' : 'chinese';
    const displayMode = splitEnabled
        ? (pageLanguage === 'english' ? (result.displayModeEnglish || result.displayMode) : (result.displayModeChinese || result.displayMode))
        : (result.displayMode || 'off');
    const sliderValue = displayMode in reverseDisplayModeMap ? reverseDisplayModeMap[displayMode] : 0;
    if (displayModeSlider) {
        displayModeSlider.value = sliderValue;
    }
    updateDisplayModeSliderUI(displayModeSlider, displayModeThumb, displayModeLabels, sliderValue);
    updateDisplayModeLabel(displayModeLabelText, splitEnabled, pageLanguage);
}
