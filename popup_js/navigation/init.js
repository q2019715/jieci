/**
 * 文件说明：popup 导航模块初始化入口。
 * 职责：组装导航状态、跳转策略与事件绑定。
 */
import { bindNavigationEvents } from './bind.js';
import {
    createNavigationState,
    markVocabEntryFromMain,
    markVocabEntryFromAdvanced,
    resolveVocabBackTarget
} from './service.js';

/**
 * 初始化 popup 导航模块。
 */
export function initNavigation({
    elements,
    pages,
    showPage
}) {
    const state = createNavigationState();

    /**
     * 从主页面进入词库页。
     */
    function openVocabFromMain() {
        markVocabEntryFromMain(state);
        showPage(pages.pageVocab);
    }

    /**
     * 从高级设置页面进入词库页。
     */
    function openVocabFromAdvanced() {
        markVocabEntryFromAdvanced(state);
        showPage(pages.pageVocab);
    }

    /**
     * 从词库页返回来源页。
     */
    function goBackFromVocab() {
        const target = resolveVocabBackTarget(state.vocabEntrySource, pages);
        showPage(target);
    }

    bindNavigationEvents({
        elements,
        pages,
        actions: {
            showPage,
            openVocabFromMain,
            openVocabFromAdvanced,
            goBackFromVocab
        }
    });

    return {
        openVocabFromMain,
        openVocabFromAdvanced,
        goBackFromVocab
    };
}
