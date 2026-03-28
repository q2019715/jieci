/**
 * 文件说明：favorite-words 模块渲染逻辑。
 * 职责：渲染收藏词列表与相关操作按钮状态。
 */

/**
 * 根据筛选结果和选择状态更新收藏词操作按钮。
 */
export function updateFavoriteWordActions({
    favoritesSelectAll,
    favoritesDeleteSelected,
    favoritesSelected,
    filteredWords,
    updateDeleteSelectedButton
}) {
    if (!favoritesSelectAll || !favoritesDeleteSelected) {
        return;
    }
    const allSelected = filteredWords.length > 0 && filteredWords.every((word) => favoritesSelected.has(word));
    favoritesSelectAll.textContent = allSelected ? '取消全选' : '全选';
    updateDeleteSelectedButton(favoritesDeleteSelected, favoritesSelected.size > 0);
}

