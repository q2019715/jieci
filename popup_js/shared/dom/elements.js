/**
 * 文件说明：DOM 查询工具与元素收集入口。
 */

/**
 * 按 id 获取 DOM 节点。
 */
export function byId(id) {
    return document.getElementById(id);
}

/**
 * 收集基础页面元素。
 */
export function collectBaseElements() {
    return {
        mainSearchInput: byId('mainSearchInput'),
        mainSearchButton: byId('mainSearchButton')
    };
}
