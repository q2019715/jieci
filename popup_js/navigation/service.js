/**
 * 文件说明：popup 导航模块服务层。
 * 职责：提供页面返回目标等纯逻辑计算能力。
 */
import {
    VOCAB_ENTRY_SOURCE_ADVANCED,
    VOCAB_ENTRY_SOURCE_MAIN
} from './constants.js';

/**
 * 根据词库页入口来源，计算词库返回页。
 */
export function resolveVocabBackTarget(vocabEntrySource, pages) {
    if (vocabEntrySource === VOCAB_ENTRY_SOURCE_ADVANCED) {
        return pages.pageAdvanced;
    }
    return pages.pageMain;
}

/**
 * 创建导航状态对象。
 */
export function createNavigationState() {
    return {
        vocabEntrySource: VOCAB_ENTRY_SOURCE_ADVANCED
    };
}

/**
 * 标记词库页来源为主页面。
 */
export function markVocabEntryFromMain(state) {
    state.vocabEntrySource = VOCAB_ENTRY_SOURCE_MAIN;
}

/**
 * 标记词库页来源为高级设置页面。
 */
export function markVocabEntryFromAdvanced(state) {
    state.vocabEntrySource = VOCAB_ENTRY_SOURCE_ADVANCED;
}
