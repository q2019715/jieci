/**
 * 文件说明：annotation-styles 模块初始化入口。
 * 职责：组装段落内标注样式设置的渲染、事件绑定与存储同步。
 */
import { bindAnnotationStylesEvents } from './bind.js';
import {
    applyAnnotationStylesSettings,
    updateHighlightControls
} from './render.js';
import {
    saveHighlightSettings,
    saveDisableAnnotationUnderline
} from './service.js';

/**
 * 初始化段落内标注样式设置模块。
 */
export function initAnnotationStylesFeature({
    elements,
    deps
}) {
    const { notifyActiveTabs } = deps;

    /**
     * 应用来自存储的段落内标注样式设置。
     */
    function applySettings(result) {
        applyAnnotationStylesSettings(elements, result);
    }

    bindAnnotationStylesEvents({
        elements,
        actions: {
            saveHighlightSettings: async (mode, color) => saveHighlightSettings(mode, color, notifyActiveTabs),
            saveDisableAnnotationUnderline: async (disabled) => saveDisableAnnotationUnderline(disabled, notifyActiveTabs)
        },
        renderers: {
            updateHighlightControls
        }
    });

    return {
        applySettings
    };
}
