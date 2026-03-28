/**
 * 文件说明：列表批量勾选行为工具。
 */

/**
 * 设置列表中所有复选框的勾选状态。
 */
export function setAllChecked(checkboxes, checked) {
    checkboxes.forEach((checkbox) => {
        checkbox.checked = Boolean(checked);
    });
}
