/**
 * 文件说明：通用弹窗显示与隐藏。
 */

/**
 * 打开弹窗。
 */
export function openModal(modal) {
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * 关闭弹窗。
 */
export function closeModal(modal) {
    if (modal) {
        modal.style.display = 'none';
    }
}
