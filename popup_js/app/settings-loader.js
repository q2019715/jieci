/**
 * 文件说明：popup 设置加载编排层。
 * 职责：读取 popup 所需设置并分发给各功能模块应用到 UI。
 */
import { POPUP_SETTINGS_STORAGE_KEYS } from '../shared/constants/keys.js';
import { getLocalStorage } from '../shared/platform/chrome-storage.js';

/**
 * 创建 popup 设置加载器。
 */
export function createPopupSettingsLoader({
    displayModeFeature,
    annotationBehaviorFeature,
    annotationStylesFeature,
    wordCardSettingsFeature,
    aboutFeature,
    dictionaryFeature,
    blockedWordsFeature,
    favoriteWordsFeature,
    workingSiteSettingFeature,
    searchFeature,
    quickAnnotationBehaviorFeature,
    syncFeature,
    oobeFeature,
    scheduleOverflowUpdate
}) {
    /**
     * 读取并应用 popup 设置到各功能模块。
     */
    async function loadSettings() {
        const result = await getLocalStorage(POPUP_SETTINGS_STORAGE_KEYS);
        const vocabList = result.vocabularies || [];
        await displayModeFeature.applySettings(result);
        await annotationBehaviorFeature.applySettings(result);
        annotationStylesFeature.applySettings(result);
        wordCardSettingsFeature.applySettings(result);
        aboutFeature.applySettings(result);
        dictionaryFeature.applySettings(result);
        blockedWordsFeature.applyBlockedWords(result.blockedWords);
        favoriteWordsFeature.applyFavoriteWords(result.favoriteWords);
        await workingSiteSettingFeature.applySettings(result);
        searchFeature.applySettings(result);
        quickAnnotationBehaviorFeature.applySettings(result);
        syncFeature.applySettings(result);
        oobeFeature.applyOobeStateFromSettings(result, vocabList);
        scheduleOverflowUpdate();
    }

    return {
        loadSettings
    };
}
