/**
 * 文件说明：display-mode 模块事件绑定层。
 * 职责：绑定显示模式滑块与标签点击行为。
 */
import { displayModeMap } from './service.js';

/**
 * 绑定显示模式相关事件。
 */
export function bindDisplayModeEvents({
    elements,
    actions,
    renderers
}) {
    const {
        displayModeSlider,
        displayModeLabels
    } = elements;
    const { saveDisplayMode } = actions;
    const { updateDisplayModeSliderUI } = renderers;

    if (displayModeSlider) {
        displayModeSlider.addEventListener('input', async () => {
            const value = parseInt(displayModeSlider.value, 10);
            const mode = displayModeMap[value];
            updateDisplayModeSliderUI(value);
            await saveDisplayMode(mode);
        });
    }

    displayModeLabels.forEach((label, index) => {
        label.addEventListener('click', () => {
            if (!displayModeSlider) {
                return;
            }
            displayModeSlider.value = index;
            displayModeSlider.dispatchEvent(new Event('input'));
        });
    });
}
