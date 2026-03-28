/**
 * 文件说明：popup 页面切换相关逻辑。
 */

/**
 * 切换页面显隐。
 */
export function showPage(targetPage, pages = []) {
    pages.forEach((page) => {
        if (!page) {
            return;
        }
        page.style.display = page === targetPage ? 'block' : 'none';
    });
}

/**
 * 通过 class 激活态切换页面显隐。
 */
export function showActivePage(targetPage, pages = [], onChanged) {
    pages.forEach((page) => {
        if (!page) {
            return;
        }
        page.classList.toggle('is-active', page === targetPage);
    });
    if (typeof onChanged === 'function') {
        onChanged(targetPage);
    }
}

/**
 * 创建用于根据页面内容高度切换滚动条的调度函数。
 */
export function createOverflowScheduler(doc = document, win = window) {
    return () => {
        win.requestAnimationFrame(() => {
            const viewportHeight = doc.documentElement.clientHeight;
            const contentHeight = doc.body.scrollHeight;
            doc.body.style.overflowY = contentHeight > viewportHeight ? 'auto' : 'hidden';
        });
    };
}

/**
 * 创建基于 is-active 的页面切换函数。
 */
export function createActivePageNavigator(pages = [], onChanged) {
    return (targetPage) => {
        showActivePage(targetPage, pages, onChanged);
    };
}
