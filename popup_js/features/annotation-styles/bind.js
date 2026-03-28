/**
 * 文件说明：annotation-styles 模块事件绑定。
 * 职责：绑定段落内标注样式相关控件事件并调用持久化逻辑。
 */

/**
 * 绑定段落内标注样式设置事件。
 */
export function bindAnnotationStylesEvents({
    elements,
    actions,
    renderers
}) {
    const {
        highlightModeSelect,
        highlightColorInput,
        disableAnnotationUnderlineToggle
    } = elements;
    const {
        saveHighlightSettings,
        saveDisableAnnotationUnderline
    } = actions;
    const { updateHighlightControls } = renderers;

    if (highlightModeSelect && highlightColorInput) {
        highlightModeSelect.addEventListener('change', async () => {
            const mode = highlightModeSelect.value;
            updateHighlightControls(highlightColorInput, mode);
            await saveHighlightSettings(mode, highlightColorInput.value);
        });
        highlightColorInput.addEventListener('change', async () => {
            await saveHighlightSettings(highlightModeSelect.value, highlightColorInput.value);
        });
    }

    if (disableAnnotationUnderlineToggle) {
        disableAnnotationUnderlineToggle.addEventListener('change', async () => {
            await saveDisableAnnotationUnderline(disableAnnotationUnderlineToggle.checked);
        });
    }
}
