/**
 * 文件说明：display-mode 模块服务层。
 * 职责：处理显示模式映射、持久化与前台通知。
 */
import {
    getActiveTabs,
    sendMessageToTab
} from '../../shared/platform/chrome-tabs.js';

/**
 * 显示模式滑块值到存储值映射。
 */
export const displayModeMap = {
    0: 'off',
    1: 'underline',
    2: 'annotation',
    3: 'replace'
};

/**
 * 显示模式存储值到滑块值映射。
 */
export const reverseDisplayModeMap = {
    off: 0,
    underline: 1,
    annotation: 2,
    replace: 3
};

/**
 * 归一化显示模式。
 */
export function normalizeDisplayMode(mode) {
    const safe = String(mode || '').trim();
    return Object.prototype.hasOwnProperty.call(reverseDisplayModeMap, safe) ? safe : 'off';
}

/**
 * 从 content 端结果推断当前页面语言。
 */
export function resolvePageLanguageFromStats(response) {
    const annotationMode = response && response.annotationMode ? String(response.annotationMode) : '';
    const actual = response && response.actualAnnotationMode ? String(response.actualAnnotationMode) : '';
    const effectiveMode = annotationMode === 'auto' ? actual : annotationMode;
    if (effectiveMode === 'en-to-cn') {
        return 'english';
    }
    if (effectiveMode === 'cn-to-en') {
        return 'chinese';
    }

    const stats = response && response.stats ? response.stats : null;
    if (stats && stats.detected) {
        return Number(stats.chineseRatio || 0) >= 0.1 ? 'chinese' : 'english';
    }
    return actual === 'en-to-cn' ? 'english' : 'chinese';
}

/**
 * 获取当前激活页语言。
 */
export async function fetchCurrentPageLanguage() {
    const tabs = await getActiveTabs();
    const tab = tabs && tabs[0] ? tabs[0] : null;
    if (!tab || tab.id == null) {
        return 'chinese';
    }
    const response = await sendMessageToTab(tab.id, { action: 'getLanguageStats' });
    return resolvePageLanguageFromStats(response);
}

/**
 * 保存显示模式并通知前台脚本。
 */
export async function saveDisplayMode(mode, notifyActiveTabs) {
    await chrome.storage.local.set({
        displayMode: mode,
        displayModeChinese: mode,
        displayModeEnglish: mode
    });
    await notifyActiveTabs({
        action: 'updateDisplayMode',
        mode
    });
}

/**
 * 按语言保存显示模式并通知前台脚本。
 */
export async function saveDisplayModeByLanguage(language, mode, notifyActiveTabs) {
    const normalizedLanguage = language === 'english' ? 'english' : 'chinese';
    const normalizedMode = normalizeDisplayMode(mode);
    const key = normalizedLanguage === 'english' ? 'displayModeEnglish' : 'displayModeChinese';
    await chrome.storage.local.set({ [key]: normalizedMode });
    const result = await chrome.storage.local.get(['displayModeChinese', 'displayModeEnglish']);
    await notifyActiveTabs({
        action: 'updateDisplayModeByLanguage',
        chineseMode: normalizeDisplayMode(result.displayModeChinese),
        englishMode: normalizeDisplayMode(result.displayModeEnglish)
    });
}
