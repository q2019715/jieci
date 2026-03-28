/**
 * 文件说明：AI 模块事件绑定层。
 * 职责：绑定 AI 页面跳转相关事件。
 */

/**
 * 绑定 AI 设置页面导航事件。
 */
export function bindAINavigation(elements, actions) {
    const { annotationToAISettingsBtn, aiSettingsBack } = elements;
    const { showAISettingsPage, showAnnotationPage } = actions;

    if (annotationToAISettingsBtn) {
        annotationToAISettingsBtn.addEventListener('click', () => {
            showAISettingsPage();
        });
    }
    if (aiSettingsBack) {
        aiSettingsBack.addEventListener('click', () => {
            showAnnotationPage();
        });
    }
}
