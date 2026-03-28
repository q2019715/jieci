/**
 * 文件说明：word-card-settings 模块服务层。
 * 职责：处理单词卡片设置的持久化与消息通知。
 */
import { WORD_CARD_SPEECH_UNSUPPORTED_TEXT } from './constants.js';

/**
 * 保存“段落内词卡开关”设置并通知内容脚本。
 */
export async function saveAnnotationWordCardPopupEnabled(enabled, notifyActiveTabs) {
    await chrome.storage.local.set({ annotationWordCardPopupEnabled: enabled });
    await notifyActiveTabs({
        action: 'updateAnnotationWordCardPopup',
        enabled
    });
}

/**
 * 保存“词卡高亮匹配中文释义”设置并通知内容脚本。
 */
export async function saveWordCardHighlightMatchedChinese(enabled, notifyActiveTabs) {
    await chrome.storage.local.set({ wordCardHighlightMatchedChinese: enabled });
    await notifyActiveTabs({
        action: 'updateWordCardMeaningHighlight',
        enabled
    });
}

/**
 * 重置词卡弹窗尺寸设置并通知内容脚本。
 */
export async function resetWordCardPopupSize(wordCardPopupSizeStorageKey, notifyActiveTabs) {
    await chrome.storage.local.remove(wordCardPopupSizeStorageKey);
    await notifyActiveTabs({ action: 'resetWordCardPopupSize' });
}

/**
 * 保存语音发音人设置并通知内容脚本。
 */
export async function saveSpeechVoiceURI(speechVoiceURI, notifyActiveTabs) {
    await chrome.storage.local.set({ speechVoiceURI });
    await notifyActiveTabs({
        action: 'updateSpeechVoice',
        speechVoiceURI
    });
}

/**
 * 保存查询服务提供商并通知内容脚本。
 */
export async function saveSearchProvider(provider, notifyActiveTabs) {
    await chrome.storage.local.set({ searchProvider: provider });
    await notifyActiveTabs({
        action: 'updateSearchProvider',
        provider
    });
}

/**
 * 预览语音朗读。
 */
export function previewSpeech(text, fallbackLang, selectedVoiceURI) {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
        alert(WORD_CARD_SPEECH_UNSUPPORTED_TEXT);
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    if (selectedVoiceURI) {
        const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang || fallbackLang;
        } else {
            utterance.lang = fallbackLang;
        }
    } else {
        utterance.lang = fallbackLang;
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}
