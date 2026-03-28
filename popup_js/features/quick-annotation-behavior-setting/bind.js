/**
 * 文件说明：quick-annotation-behavior-setting 事件绑定层。
 * 职责：绑定快捷页面开关、悬停触发和双拉杆更新事件。
 */

import { DISPLAY_MODE_MAP, SPLIT_MODE_MAP } from './service.js';

const HOVER_OPEN_DELAY_MS = 3000;

/**
 * 绑定快捷标注面板相关事件。
 */
export function bindQuickAnnotationBehaviorEvents({
    elements,
    actions,
    renderers
}) {
    const {
        displayModeQuickCard,
        openQuickAnnotationBehaviorPageBtn,
        quickAnnotationBehaviorBack,
        annotationQuickLanguageModeNav,
        quickSplitModeSlider,
        quickSplitModeLabels,
        quickDisplayModeCnSlider,
        quickDisplayModeCnLabels,
        quickDisplayModeEnSlider,
        quickDisplayModeEnLabels
    } = elements;
    const {
        openQuickPage,
        openQuickPageFromAnnotation,
        closeQuickPage,
        saveSplitSetting,
        saveModes,
        getCurrentModes
    } = actions;
    const {
        updateModeSliderUI
    } = renderers;

    let hoverTimer = null;
    let hoverSuppressed = false;

    function clearHoverTimer() {
        if (!hoverTimer) {
            if (displayModeQuickCard) {
                displayModeQuickCard.classList.remove('is-hover-progress');
            }
            return;
        }
        clearTimeout(hoverTimer);
        hoverTimer = null;
        if (displayModeQuickCard) {
            displayModeQuickCard.classList.remove('is-hover-progress');
        }
    }

    function startHoverOpen() {
        if (hoverSuppressed) {
            return;
        }
        clearHoverTimer();
        if (displayModeQuickCard) {
            displayModeQuickCard.classList.add('is-hover-progress');
        }
        hoverTimer = setTimeout(() => {
            hoverTimer = null;
            if (displayModeQuickCard) {
                displayModeQuickCard.classList.remove('is-hover-progress');
            }
            openQuickPage();
        }, HOVER_OPEN_DELAY_MS);
    }

    if (displayModeQuickCard) {
        displayModeQuickCard.addEventListener('mouseenter', startHoverOpen);
        displayModeQuickCard.addEventListener('mouseleave', clearHoverTimer);

        const suppressNodes = displayModeQuickCard.querySelectorAll('.help-icon, .help-tooltip, .mode-slider-container');
        suppressNodes.forEach((node) => {
            node.addEventListener('mouseenter', () => {
                hoverSuppressed = true;
                clearHoverTimer();
            });
            node.addEventListener('mouseleave', () => {
                hoverSuppressed = false;
                if (!displayModeQuickCard.matches(':hover')) {
                    return;
                }
                startHoverOpen();
            });
        });
    }

    if (openQuickAnnotationBehaviorPageBtn) {
        openQuickAnnotationBehaviorPageBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            clearHoverTimer();
            openQuickPage();
        });
    }

    if (quickAnnotationBehaviorBack) {
        quickAnnotationBehaviorBack.addEventListener('click', () => {
            closeQuickPage();
        });
    }

    if (annotationQuickLanguageModeNav) {
        annotationQuickLanguageModeNav.addEventListener('click', () => {
            openQuickPageFromAnnotation();
        });
    }

    if (quickDisplayModeCnSlider) {
        quickDisplayModeCnSlider.addEventListener('input', async () => {
            const value = parseInt(quickDisplayModeCnSlider.value, 10);
            const mode = DISPLAY_MODE_MAP[value] || 'off';
            const current = getCurrentModes();
            updateModeSliderUI(value, 'cn');
            await saveModes({
                chineseMode: mode,
                englishMode: current.englishMode
            });
        });
    }

    if (quickDisplayModeEnSlider) {
        quickDisplayModeEnSlider.addEventListener('input', async () => {
            const value = parseInt(quickDisplayModeEnSlider.value, 10);
            const mode = DISPLAY_MODE_MAP[value] || 'off';
            const current = getCurrentModes();
            updateModeSliderUI(value, 'en');
            await saveModes({
                chineseMode: current.chineseMode,
                englishMode: mode
            });
        });
    }

    if (quickSplitModeSlider) {
        quickSplitModeSlider.addEventListener('input', async () => {
            const value = parseInt(quickSplitModeSlider.value, 10);
            const enabled = SPLIT_MODE_MAP[value] === true;
            updateModeSliderUI(value, 'split');
            await saveSplitSetting(enabled);
        });
    }

    (quickDisplayModeCnLabels || []).forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!quickDisplayModeCnSlider) {
                return;
            }
            if (!getCurrentModes().splitEnabled) {
                return;
            }
            quickDisplayModeCnSlider.value = String(index);
            quickDisplayModeCnSlider.dispatchEvent(new Event('input'));
        });
    });

    (quickDisplayModeEnLabels || []).forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!quickDisplayModeEnSlider) {
                return;
            }
            if (!getCurrentModes().splitEnabled) {
                return;
            }
            quickDisplayModeEnSlider.value = String(index);
            quickDisplayModeEnSlider.dispatchEvent(new Event('input'));
        });
    });

    (quickSplitModeLabels || []).forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!quickSplitModeSlider) {
                return;
            }
            quickSplitModeSlider.value = String(index);
            quickSplitModeSlider.dispatchEvent(new Event('input'));
        });
    });

}
