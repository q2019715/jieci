/**
 * 文件说明：sync 模块事件绑定层。
 * 职责：绑定同步页面导航与操作事件。
 */

/**
 * 绑定同步页面相关事件。
 */
export function bindSyncEvents({
    elements,
    actions
}) {
    const {
        syncNav,
        syncBack,
        syncEnabledToggle,
        syncPushNowBtn,
        syncPullNowBtn
    } = elements;
    const {
        openSyncPage,
        closeSyncPage,
        toggleSyncEnabled,
        pushNow,
        pullNow
    } = actions;

    if (syncNav) {
        syncNav.addEventListener('click', openSyncPage);
    }
    if (syncBack) {
        syncBack.addEventListener('click', closeSyncPage);
    }
    if (syncEnabledToggle) {
        syncEnabledToggle.addEventListener('change', () => {
            toggleSyncEnabled(syncEnabledToggle.checked);
        });
    }
    if (syncPushNowBtn) {
        syncPushNowBtn.addEventListener('click', pushNow);
    }
    if (syncPullNowBtn) {
        syncPullNowBtn.addEventListener('click', pullNow);
    }
}
