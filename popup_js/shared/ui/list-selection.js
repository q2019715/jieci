/**
 * 文件说明：列表选择通用 UI 工具。
 * 职责：提供批量删除按钮状态与可选择列表渲染能力。
 */

/**
 * 重置“删除选中”按钮到初始状态。
 */
export function resetDeleteSelectedButton(button) {
    if (!button) {
        return;
    }
    if (button._confirmTimer) {
        clearTimeout(button._confirmTimer);
        button._confirmTimer = null;
    }
    if (button._doneTimer) {
        clearTimeout(button._doneTimer);
        button._doneTimer = null;
    }
    button.dataset.state = 'idle';
    button.textContent = '删除选中';
    button.disabled = true;
}

/**
 * 根据是否有选中项更新“删除选中”按钮状态。
 */
export function updateDeleteSelectedButton(button, hasSelection) {
    if (!button) {
        return;
    }
    if (button.dataset.state === 'deleted') {
        button.textContent = '已删除';
        button.disabled = true;
        return;
    }
    if (!hasSelection) {
        resetDeleteSelectedButton(button);
        return;
    }
    if (!button.dataset.state || button.dataset.state === 'idle') {
        button.textContent = '删除选中';
    }
    button.disabled = false;
}

/**
 * 渲染支持勾选与单项删除的列表。
 */
export function renderWordSelectionList({
    listElement,
    filteredItems,
    selectedItems,
    emptyText,
    onToggleSelection,
    onDeleteItem,
    onOpenItem,
    doc = document
}) {
    if (!listElement) {
        return;
    }
    listElement.replaceChildren();
    if (filteredItems.length === 0) {
        const empty = doc.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = emptyText;
        listElement.appendChild(empty);
        return;
    }
    filteredItems.forEach((itemText) => {
        const item = doc.createElement('div');
        item.className = 'word-item';
        const left = doc.createElement('div');
        left.className = 'word-left';
        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'word-checkbox';
        checkbox.checked = selectedItems.has(itemText);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedItems.add(itemText);
            } else {
                selectedItems.delete(itemText);
            }
            onToggleSelection();
        });
        const text = doc.createElement('div');
        text.className = 'word-text';
        text.textContent = itemText;
        if (typeof onOpenItem === 'function') {
            text.classList.add('is-clickable');
            text.addEventListener('click', async () => {
                await onOpenItem(itemText);
            });
        }
        left.appendChild(checkbox);
        left.appendChild(text);
        const deleteButton = doc.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'word-delete';
        deleteButton.textContent = 'x';
        deleteButton.addEventListener('click', async () => {
            await onDeleteItem(itemText);
        });
        item.appendChild(left);
        item.appendChild(deleteButton);
        listElement.appendChild(item);
    });
}
