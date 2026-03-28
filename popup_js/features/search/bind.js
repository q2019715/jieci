/**
 * 文件说明：search 模块事件绑定层。
 */

export function bindSearchEvents({
    elements,
    actions
}) {
    const {
        pageMain,
        mainSearchInput,
        mainSearchButton
    } = elements;
    const {
        handleMainInputChange,
        handleMainEnter,
        handleMoveSelection,
        handleMainButtonClick
    } = actions;

    if (mainSearchButton) {
        mainSearchButton.addEventListener('click', () => {
            handleMainButtonClick(mainSearchInput ? mainSearchInput.value : '');
        });
    }
    if (mainSearchInput) {
        mainSearchInput.addEventListener('input', () => {
            handleMainInputChange(mainSearchInput.value || '');
        });
        mainSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                handleMoveSelection(event.shiftKey ? -1 : 1);
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                handleMoveSelection(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                handleMoveSelection(-1);
                return;
            }
            if (event.key !== 'Enter') {
                return;
            }
            if (event.isComposing === true) {
                return;
            }
            const handled = handleMainEnter(mainSearchInput.value || '');
            if (handled) {
                event.preventDefault();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (!mainSearchInput || !pageMain || !pageMain.classList.contains('is-active')) {
            return;
        }
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const active = document.activeElement;
        const isTypingElement = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable
        );
        if (isTypingElement) {
            return;
        }
        if (typeof event.key !== 'string' || event.key.length !== 1) {
            return;
        }
        event.preventDefault();
        const nextValue = `${mainSearchInput.value || ''}${event.key}`;
        mainSearchInput.focus();
        mainSearchInput.value = nextValue;
        mainSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
