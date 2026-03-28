/**
 * 文件说明：blocked-words 模块渲染逻辑。
 * 职责：渲染屏蔽词页面操作按钮状态。
 */

/**
 * 根据筛选结果和选择状态更新屏蔽词操作按钮。
 */
export function updateBlockedWordActions({
    blockedSelectAll,
    blockedDeleteSelected,
    blockedSelected,
    filteredWords,
    updateDeleteSelectedButton
}) {
    if (!blockedSelectAll || !blockedDeleteSelected) {
        return;
    }
    const allSelected = filteredWords.length > 0 && filteredWords.every((word) => blockedSelected.has(word));
    blockedSelectAll.textContent = allSelected ? '取消全选' : '全选';
    updateDeleteSelectedButton(blockedDeleteSelected, blockedSelected.size > 0);
}

