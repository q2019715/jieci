/**
 * 文件说明：quick-annotation-behavior-setting 初始化入口。
 * 职责：组装快捷页面入口、双拉杆渲染回填与交互事件绑定。
 */

import { bindQuickAnnotationBehaviorEvents } from './bind.js';
import {
    applyQuickAnnotationSettings,
    setLanguageModeControlsEnabled,
    updateModeSliderUI
} from './render.js';
import {
    normalizeDisplayMode,
    normalizeSplitModeEnabled,
    saveDisplayModeSplitSetting,
    saveDisplayModeByLanguage
} from './service.js';

/**
 * 初始化快捷标注模式功能。
 */
export function initQuickAnnotationBehaviorSettingFeature({ elements, deps }) {
    const { notifyActiveTabs, showPage, pageMain, pageAnnotation, pageQuickAnnotationBehavior } = deps;
    const state = {
        returnPage: 'main',
        splitEnabled: true,
        chineseMode: 'off',
        englishMode: 'off'
    };

    function getCurrentModes() {
        return {
            splitEnabled: state.splitEnabled,
            chineseMode: state.chineseMode,
            englishMode: state.englishMode
        };
    }

    function openQuickPage(returnPage = 'main') {
        if (!pageQuickAnnotationBehavior || !showPage) {
            return;
        }
        state.returnPage = returnPage === 'annotation' ? 'annotation' : 'main';
        showPage(pageQuickAnnotationBehavior);
    }

    function openQuickPageFromAnnotation() {
        openQuickPage('annotation');
    }

    function closeQuickPage() {
        if (!showPage) {
            return;
        }
        if (state.returnPage === 'annotation' && pageAnnotation) {
            showPage(pageAnnotation);
            return;
        }
        if (pageMain) {
            showPage(pageMain);
        }
    }

    function updateByLanguageSliderUI(value, language) {
        if (language === 'split') {
            updateModeSliderUI(
                elements.quickSplitModeSlider,
                elements.quickSplitModeThumb,
                elements.quickSplitModeLabels,
                value
            );
            return;
        }
        if (language === 'en') {
            updateModeSliderUI(
                elements.quickDisplayModeEnSlider,
                elements.quickDisplayModeEnThumb,
                elements.quickDisplayModeEnLabels,
                value
            );
            return;
        }
        updateModeSliderUI(
            elements.quickDisplayModeCnSlider,
            elements.quickDisplayModeCnThumb,
            elements.quickDisplayModeCnLabels,
            value
        );
    }

    async function saveModes(next) {
        const chineseMode = normalizeDisplayMode(next.chineseMode || state.chineseMode);
        const englishMode = normalizeDisplayMode(next.englishMode || state.englishMode);
        state.chineseMode = chineseMode;
        state.englishMode = englishMode;
        await saveDisplayModeByLanguage({
            chineseMode,
            englishMode,
            notifyActiveTabs
        });
    }

    async function saveSplitSetting(enabled) {
        const normalizedEnabled = normalizeSplitModeEnabled(enabled);
        state.splitEnabled = normalizedEnabled;
        await saveDisplayModeSplitSetting({
            enabled: normalizedEnabled,
            notifyActiveTabs
        });
        setLanguageModeControlsEnabled(elements, normalizedEnabled);
    }

    function applySettings(result = {}) {
        const fallback = normalizeDisplayMode(result.displayMode || 'off');
        state.splitEnabled = normalizeSplitModeEnabled(result.displayModeSplitByLanguage);
        state.chineseMode = normalizeDisplayMode(result.displayModeChinese || fallback);
        state.englishMode = normalizeDisplayMode(result.displayModeEnglish || fallback);
        applyQuickAnnotationSettings(elements, result);
    }

    bindQuickAnnotationBehaviorEvents({
        elements,
        actions: {
            openQuickPage,
            openQuickPageFromAnnotation,
            closeQuickPage,
            saveSplitSetting,
            saveModes,
            getCurrentModes
        },
        renderers: {
            updateModeSliderUI: updateByLanguageSliderUI
        }
    });

    return {
        applySettings
    };
}
