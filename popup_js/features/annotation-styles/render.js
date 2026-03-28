/**
 * 文件说明：annotation-styles 模块渲染层。
 * 职责：渲染段落内标注样式设置项的 UI 状态。
 */

/**
 * 根据高亮模式更新颜色输入控件可用性。
 */
export function updateHighlightControls(highlightColorInput, mode) {
    if (!highlightColorInput) {
        return;
    }
    const isCustomMode = mode === 'custom';
    highlightColorInput.disabled = !isCustomMode;
    highlightColorInput.style.display = isCustomMode ? '' : 'none';
}

/**
 * 根据存储设置将段落内标注样式选项回填到页面。
 */
export function applyAnnotationStylesSettings(elements, result) {
    const {
        highlightModeSelect,
        highlightColorInput,
        disableAnnotationUnderlineToggle
    } = elements;

    const highlightMode = result.highlightColorMode || 'none';
    const highlightColor = result.highlightColor || '#2196f3';
    const disableAnnotationUnderline = result.disableAnnotationUnderline === true;

    if (highlightModeSelect) {
        highlightModeSelect.value = highlightMode;
    }
    if (highlightColorInput) {
        highlightColorInput.value = highlightColor;
    }
    if (disableAnnotationUnderlineToggle) {
        disableAnnotationUnderlineToggle.checked = disableAnnotationUnderline;
    }
    updateHighlightControls(highlightColorInput, highlightMode);
}
