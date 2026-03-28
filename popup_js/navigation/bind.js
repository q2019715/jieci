/**
 * 文件说明：popup 导航模块事件绑定层。
 * 职责：集中绑定页面跳转与返回按钮事件。
 */

/**
 * 绑定 popup 页面导航事件。
 */
export function bindNavigationEvents({
    elements,
    pages,
    actions
}) {
    const {
        vocabularyToggle,
        advancedToggle,
        quickVocab,
        quickSettings,
        styleNav,
        annotationNav,
        wordCardSettingsNav,
        vocabularyNav,
        vocabBack,
        advancedBack,
        styleBack,
        annotationBack,
        wordCardSettingsBack
    } = elements;
    const {
        showPage,
        openVocabFromMain,
        openVocabFromAdvanced,
        goBackFromVocab
    } = actions;

    if (vocabularyToggle) {
        vocabularyToggle.addEventListener('click', () => showPage(pages.pageVocab));
    }
    if (advancedToggle) {
        advancedToggle.addEventListener('click', () => showPage(pages.pageAdvanced));
    }
    if (quickVocab) {
        quickVocab.addEventListener('click', openVocabFromMain);
    }
    if (quickSettings) {
        quickSettings.addEventListener('click', () => showPage(pages.pageAdvanced));
    }
    if (styleNav) {
        styleNav.addEventListener('click', () => showPage(pages.pageStyle));
    }
    if (annotationNav) {
        annotationNav.addEventListener('click', () => showPage(pages.pageAnnotation));
    }
    if (wordCardSettingsNav) {
        wordCardSettingsNav.addEventListener('click', () => showPage(pages.pageWordCardSettings));
    }
    if (vocabularyNav) {
        vocabularyNav.addEventListener('click', openVocabFromAdvanced);
    }
    if (vocabBack) {
        vocabBack.addEventListener('click', goBackFromVocab);
    }
    if (advancedBack) {
        advancedBack.addEventListener('click', () => showPage(pages.pageMain));
    }
    if (styleBack) {
        styleBack.addEventListener('click', () => showPage(pages.pageAdvanced));
    }
    if (annotationBack) {
        annotationBack.addEventListener('click', () => showPage(pages.pageAdvanced));
    }
    if (wordCardSettingsBack) {
        wordCardSettingsBack.addEventListener('click', () => showPage(pages.pageAdvanced));
    }
}
