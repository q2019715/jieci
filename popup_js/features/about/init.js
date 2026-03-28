/**
 * 文件说明：about 模块初始化入口。
 * 职责：初始化 about 页面版本信息、导航与调试模式设置。
 */
import {
    renderAboutVersion,
    applyAboutSettings
} from './render.js';
import { bindAboutEvents } from './bind.js';
import { saveDebugMode } from './service.js';

/**
 * 初始化 about 模块。
 */
export function initAboutFeature({
    elements,
    actions,
    deps
}) {
    const {
        aboutVersion,
        aboutNav,
        aboutBack,
        debugModeToggle
    } = elements;
    const {
        showAboutPage,
        showAdvancedPage
    } = actions;
    const { notifyActiveTabs } = deps;

    /**
     * 应用 about 页面相关设置。
     */
    function applySettings(result) {
        applyAboutSettings({ debugModeToggle }, result);
    }

    renderAboutVersion(aboutVersion);
    bindAboutEvents({
        elements: {
            aboutNav,
            aboutBack,
            debugModeToggle
        },
        actions: {
            showAboutPage,
            showAdvancedPage,
            saveDebugMode: async (enabled) => saveDebugMode(enabled, notifyActiveTabs)
        }
    });

    return {
        applySettings
    };
}

