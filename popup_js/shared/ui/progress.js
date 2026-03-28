/**
 * 文件说明：进度条渲染工具。
 */

/**
 * 更新进度条宽度与百分比文本。
 */
export function renderProgress(progressBar, percentLabel, percentValue) {
    const safeValue = Math.max(0, Math.min(100, Number(percentValue) || 0));
    if (progressBar) {
        progressBar.style.width = `${safeValue}%`;
    }
    if (percentLabel) {
        percentLabel.textContent = `${safeValue}%`;
    }
}
