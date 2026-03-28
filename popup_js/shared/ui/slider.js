/**
 * 文件说明：通用滑块 UI 行为。
 */

/**
 * 根据模式值更新滑块位置。
 */
export function updateSliderPosition(slider, value, min = 0, max = 2) {
    if (!slider) {
        return;
    }
    const ratio = (Number(value) - min) / (max - min);
    slider.style.setProperty('--slider-ratio', String(Math.max(0, Math.min(1, ratio))));
}
