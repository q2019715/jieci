/**
 * 文件说明：about 模块事件绑定层。
 * 职责：绑定 about 页面导航与调试模式开关事件。
 */

/**
 * 绑定 about 页面相关事件。
 */
export function bindAboutEvents({
    elements,
    actions
}) {
    const {
        aboutNav,
        aboutBack,
        debugModeToggle
    } = elements;
    const {
        showAboutPage,
        showAdvancedPage,
        saveDebugMode
    } = actions;

    if (aboutNav) {
        aboutNav.addEventListener('click', () => {
            showAboutPage();
        });
    }
    if (aboutBack) {
        aboutBack.addEventListener('click', () => {
            showAdvancedPage();
        });
    }
    if (debugModeToggle) {
        debugModeToggle.addEventListener('change', async () => {
            await saveDebugMode(debugModeToggle.checked);
        });
    }
}
