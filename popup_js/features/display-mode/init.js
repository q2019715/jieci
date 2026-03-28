/**
 * 文件说明：display-mode 模块初始化入口。
 * 职责：组装显示模式设置的渲染、事件绑定与持久化同步。
 */
import { bindDisplayModeEvents } from './bind.js';
import {
    applyDisplayModeSettings,
    updateDisplayModeSliderUI
} from './render.js';
import {
    fetchCurrentPageLanguage,
    normalizeDisplayMode,
    saveDisplayMode,
    saveDisplayModeByLanguage
} from './service.js';

/**
 * 初始化显示模式模块。
 */
export function initDisplayModeFeature({
    elements,
    deps
}) {
    const { notifyActiveTabs } = deps;
    const {
        displayModeSlider,
        displayModeThumb,
        displayModeLabels
    } = elements;
    const state = {
        pageLanguage: 'chinese',
        splitEnabled: true
    };

    async function resolveRuntimeSettings(baseResult = {}) {
        const splitEnabled = baseResult.displayModeSplitByLanguage !== false;
        let pageLanguage = 'chinese';
        if (splitEnabled) {
            pageLanguage = await fetchCurrentPageLanguage().catch(() => 'chinese');
        }
        state.pageLanguage = pageLanguage;
        state.splitEnabled = splitEnabled;
        return {
            ...baseResult,
            pageLanguage,
            splitEnabled
        };
    }

    /**
     * 应用存储中的显示模式设置。
     */
    async function applySettings(result) {
        const merged = await resolveRuntimeSettings(result || {});
        applyDisplayModeSettings(elements, merged);
    }

    async function saveModeWithContext(mode) {
        const normalizedMode = normalizeDisplayMode(mode);
        const splitEnabled = state.splitEnabled === true;
        if (splitEnabled) {
            await saveDisplayModeByLanguage(state.pageLanguage, normalizedMode, notifyActiveTabs);
        } else {
            await saveDisplayMode(normalizedMode, notifyActiveTabs);
        }
    }

    chrome.storage.onChanged.addListener(async (changes, namespace) => {
        if (namespace !== 'local') {
            return;
        }
        const watched = ['displayMode', 'displayModeChinese', 'displayModeEnglish', 'displayModeSplitByLanguage'];
        const hit = watched.some((key) => Object.prototype.hasOwnProperty.call(changes, key));
        if (!hit) {
            return;
        }
        const result = await chrome.storage.local.get(watched);
        await applySettings(result);
    });

    bindDisplayModeEvents({
        elements,
        actions: {
            saveDisplayMode: async (mode) => saveModeWithContext(mode)
        },
        renderers: {
            updateDisplayModeSliderUI: (value) => {
                updateDisplayModeSliderUI(displayModeSlider, displayModeThumb, displayModeLabels, value);
            }
        }
    });

    return {
        applySettings
    };
}
