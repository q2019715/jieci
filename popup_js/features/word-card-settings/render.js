/**
 * 文件说明：word-card-settings 模块渲染层。
 * 职责：渲染单词卡片设置项的 UI 状态。
 */
import { BUTTON_FEEDBACK_RESET_DELAY_MS } from '../../shared/constants/keys.js';
import {
    WORD_CARD_RESET_DONE_TEXT,
    WORD_CARD_RESET_FALLBACK_TEXT,
    WORD_CARD_SPEECH_DEFAULT_OPTION_TEXT,
    WORD_CARD_SPEECH_LOCAL_SUFFIX_TEXT
} from './constants.js';
import { DEFAULT_SEARCH_PROVIDER } from '../../shared/constants/keys.js';

/**
 * 根据存储设置将单词卡片相关开关回填到页面。
 */
export function applyWordCardSettings(elements, result) {
    const {
        annotationWordCardPopupEnabledToggle,
        wordCardHighlightMatchedChineseToggle,
        speechVoiceSelect,
        searchProviderSelect
    } = elements;
    const annotationWordCardPopupEnabled = result.annotationWordCardPopupEnabled !== false;
    const wordCardHighlightMatchedChinese = result.wordCardHighlightMatchedChinese !== false;
    const speechVoiceURI = result.speechVoiceURI || '';
    const searchProvider = result.searchProvider || DEFAULT_SEARCH_PROVIDER;

    if (annotationWordCardPopupEnabledToggle) {
        annotationWordCardPopupEnabledToggle.checked = annotationWordCardPopupEnabled;
    }
    if (wordCardHighlightMatchedChineseToggle) {
        wordCardHighlightMatchedChineseToggle.checked = wordCardHighlightMatchedChinese;
    }
    if (speechVoiceSelect) {
        speechVoiceSelect.dataset.selectedValue = speechVoiceURI;
    }
    if (searchProviderSelect) {
        searchProviderSelect.value = searchProvider;
    }
}

/**
 * 显示“重置尺寸”完成反馈并自动恢复按钮状态。
 */
export function flashResetDone(resetPopupSizeButton) {
    if (!resetPopupSizeButton) {
        return;
    }
    const originalText = resetPopupSizeButton.textContent;
    resetPopupSizeButton.textContent = WORD_CARD_RESET_DONE_TEXT;
    resetPopupSizeButton.disabled = true;
    setTimeout(() => {
        resetPopupSizeButton.textContent = originalText || WORD_CARD_RESET_FALLBACK_TEXT;
        resetPopupSizeButton.disabled = false;
    }, BUTTON_FEEDBACK_RESET_DELAY_MS);
}

/**
 * 渲染语音发音人下拉选项。
 */
export function renderSpeechVoiceOptions(speechVoiceSelect) {
    if (!speechVoiceSelect || typeof speechSynthesis === 'undefined') {
        return;
    }
    const voices = speechSynthesis.getVoices();
    const selectedValue = speechVoiceSelect.dataset.selectedValue || '';
    speechVoiceSelect.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = WORD_CARD_SPEECH_DEFAULT_OPTION_TEXT;
    speechVoiceSelect.appendChild(defaultOption);
    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.localService) {
            option.textContent += WORD_CARD_SPEECH_LOCAL_SUFFIX_TEXT;
        }
        speechVoiceSelect.appendChild(option);
    });
    speechVoiceSelect.value = selectedValue;
    if (speechVoiceSelect.value !== selectedValue) {
        speechVoiceSelect.value = '';
    }
}
