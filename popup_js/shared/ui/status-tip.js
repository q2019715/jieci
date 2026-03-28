/**
 * 文件说明：状态提示文本渲染工具。
 */

/**
 * 设置状态提示文本。
 */
export function setStatusText(element, text) {
    if (element) {
        element.textContent = text;
    }
}
