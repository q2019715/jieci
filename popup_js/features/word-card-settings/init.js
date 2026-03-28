/**
 * 文件说明：word-card-settings 模块初始化入口。
 * 职责：组装单词卡片设置的渲染、事件绑定与存储同步。
 */
import { bindWordCardSettingsEvents } from './bind.js';
import {
    applyWordCardSettings,
    flashResetDone,
    renderSpeechVoiceOptions
} from './render.js';
import {
    saveAnnotationWordCardPopupEnabled,
    saveWordCardHighlightMatchedChinese,
    resetWordCardPopupSize,
    saveSpeechVoiceURI,
    saveSearchProvider,
    previewSpeech
} from './service.js';

/**
 * 初始化单词卡片设置模块。
 */
export function initWordCardSettingsFeature({
    elements,
    deps
}) {
    const {
        notifyActiveTabs,
        wordCardPopupSizeStorageKey
    } = deps;

    /**
     * 应用来自存储的单词卡片设置。
     */
    function applySettings(result) {
        applyWordCardSettings(elements, result);
        renderSpeechVoiceOptions(elements.speechVoiceSelect);
    }

    bindWordCardSettingsEvents({
        elements,
        actions: {
            saveAnnotationWordCardPopupEnabled: async (enabled) => saveAnnotationWordCardPopupEnabled(enabled, notifyActiveTabs),
            saveWordCardHighlightMatchedChinese: async (enabled) => saveWordCardHighlightMatchedChinese(enabled, notifyActiveTabs),
            resetWordCardPopupSize: async () => resetWordCardPopupSize(wordCardPopupSizeStorageKey, notifyActiveTabs),
            saveSpeechVoiceURI: async (speechVoiceURI) => saveSpeechVoiceURI(speechVoiceURI, notifyActiveTabs),
            saveSearchProvider: async (provider) => saveSearchProvider(provider, notifyActiveTabs),
            previewSpeech
        },
        renderers: {
            flashResetDone,
            renderSpeechVoiceOptions
        }
    });

    return {
        applySettings
    };
}
