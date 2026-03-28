/**
 * 文件说明：quick-working-site-setting 模块服务层。
 * 职责：管理快捷卡片悬停延时打开规则页的定时器生命周期。
 */

/**
 * 创建悬停定时控制器。
 */
export function createQuickHoverController() {
    return {
        timer: null
    };
}

/**
 * 清理悬停定时器。
 */
export function clearQuickHoverTimer(controller) {
    if (!controller || !controller.timer) {
        return;
    }
    clearTimeout(controller.timer);
    controller.timer = null;
}

/**
 * 启动悬停定时器。
 */
export function startQuickHoverTimer(controller, delayMs, callback) {
    clearQuickHoverTimer(controller);
    controller.timer = setTimeout(async () => {
        controller.timer = null;
        await callback();
    }, delayMs);
}
