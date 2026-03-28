/**
 * 文件说明：word-card-settings 模块事件绑定。
 * 职责：绑定单词卡片设置相关控件事件并调用持久化逻辑。
 */
import {
    WORD_CARD_TEST_CHINESE_TEXT,
    WORD_CARD_TEST_ENGLISH_TEXT
} from './constants.js';

/**
 * 绑定单词卡片设置事件。
 */
export function bindWordCardSettingsEvents({
    elements,
    actions,
    renderers
}) {
    const {
        annotationWordCardPopupEnabledToggle,
        wordCardHighlightMatchedChineseToggle,
        resetPopupSizeButton,
        speechVoiceSelect,
        searchProviderSelect,
        testChineseVoiceBtn,
        testEnglishVoiceBtn
    } = elements;
    const {
        saveAnnotationWordCardPopupEnabled,
        saveWordCardHighlightMatchedChinese,
        resetWordCardPopupSize,
        saveSpeechVoiceURI,
        saveSearchProvider,
        previewSpeech
    } = actions;
    const { flashResetDone, renderSpeechVoiceOptions } = renderers;

    if (annotationWordCardPopupEnabledToggle) {
        annotationWordCardPopupEnabledToggle.addEventListener('change', async () => {
            await saveAnnotationWordCardPopupEnabled(annotationWordCardPopupEnabledToggle.checked);
        });
    }
    if (wordCardHighlightMatchedChineseToggle) {
        wordCardHighlightMatchedChineseToggle.addEventListener('change', async () => {
            await saveWordCardHighlightMatchedChinese(wordCardHighlightMatchedChineseToggle.checked);
        });
    }
    if (resetPopupSizeButton) {
        resetPopupSizeButton.addEventListener('click', async () => {
            await resetWordCardPopupSize();
            flashResetDone(resetPopupSizeButton);
        });
    }
    if (speechVoiceSelect) {
        speechVoiceSelect.addEventListener('change', async () => {
            const speechVoiceURI = speechVoiceSelect.value || '';
            await saveSpeechVoiceURI(speechVoiceURI);
        });
        renderSpeechVoiceOptions(speechVoiceSelect);
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', () => {
                renderSpeechVoiceOptions(speechVoiceSelect);
            });
        }
    }
    if (searchProviderSelect) {
        searchProviderSelect.addEventListener('change', async () => {
            await saveSearchProvider(searchProviderSelect.value);
        });
    }
    if (testChineseVoiceBtn) {
        testChineseVoiceBtn.addEventListener('click', () => {
            const selectedVoiceURI = speechVoiceSelect ? (speechVoiceSelect.value || '') : '';
            previewSpeech(WORD_CARD_TEST_CHINESE_TEXT, 'zh-CN', selectedVoiceURI);
        });
    }
    if (testEnglishVoiceBtn) {
        testEnglishVoiceBtn.addEventListener('click', () => {
            const selectedVoiceURI = speechVoiceSelect ? (speechVoiceSelect.value || '') : '';
            previewSpeech(WORD_CARD_TEST_ENGLISH_TEXT, 'en-US', selectedVoiceURI);
        });
    }
}
