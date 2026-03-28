/**
 * 文件说明：about 模块渲染逻辑。
 * 职责：处理 about 页面中的静态展示内容。
 */

/**
 * 渲染扩展版本号。
 */
export function renderAboutVersion(aboutVersionElement) {
    if (!aboutVersionElement) {
        return;
    }
    if (!chrome.runtime?.getManifest) {
        aboutVersionElement.textContent = '-';
        return;
    }
    aboutVersionElement.textContent = chrome.runtime.getManifest().version || '-';
}

/**
 * 回填调试模式开关状态。
 */
export function applyAboutSettings(elements, result) {
    const { debugModeToggle } = elements;
    const debugMode = result.debugMode === true;
    if (debugModeToggle) {
        debugModeToggle.checked = debugMode;
    }
}

