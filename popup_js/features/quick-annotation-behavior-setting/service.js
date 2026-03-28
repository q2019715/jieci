/**
 * 文件说明：quick-annotation-behavior-setting 服务层。
 * 职责：处理模式映射、状态归一化、持久化和消息通知。
 */

export const DISPLAY_MODE_MAP = {
    0: 'off',
    1: 'underline',
    2: 'annotation',
    3: 'replace'
};

export const REVERSE_DISPLAY_MODE_MAP = {
    off: 0,
    underline: 1,
    annotation: 2,
    replace: 3
};

export const SPLIT_MODE_MAP = {
    0: false,
    1: true
};

/**
 * 归一化显示模式值。
 */
export function normalizeDisplayMode(mode) {
    const safe = String(mode || '').trim();
    if (Object.prototype.hasOwnProperty.call(REVERSE_DISPLAY_MODE_MAP, safe)) {
        return safe;
    }
    return 'off';
}

/**
 * 归一化分语言设置开关值。
 */
export function normalizeSplitModeEnabled(enabled) {
    return enabled === true;
}

/**
 * 持久化双语页面显示模式并通知内容脚本更新。
 */
export async function saveDisplayModeByLanguage({ chineseMode, englishMode, notifyActiveTabs }) {
    const cn = normalizeDisplayMode(chineseMode);
    const en = normalizeDisplayMode(englishMode);
    await chrome.storage.local.set({
        displayModeChinese: cn,
        displayModeEnglish: en
    });
    await notifyActiveTabs({
        action: 'updateDisplayModeByLanguage',
        chineseMode: cn,
        englishMode: en
    });
}

/**
 * 持久化分语言设置开关并通知内容脚本更新。
 */
export async function saveDisplayModeSplitSetting({ enabled, notifyActiveTabs }) {
    const normalizedEnabled = normalizeSplitModeEnabled(enabled);
    await chrome.storage.local.set({
        displayModeSplitByLanguage: normalizedEnabled
    });
    await notifyActiveTabs({
        action: 'updateDisplayModeSplitSetting',
        enabled: normalizedEnabled
    });
}
