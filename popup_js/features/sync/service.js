/**
 * 文件说明：sync 模块服务层。
 * 职责：封装与后台同步引擎通信的 runtime 消息调用。
 */
import { sendRuntimeMessage } from '../../shared/platform/runtime-msg.js';

/**
 * 查询同步概览信息（开关、状态、容量）。
 */
export async function requestSyncOverview() {
    const response = await sendRuntimeMessage({ type: 'sync-overview' }).catch(() => null);
    if (!response || response.ok !== true || !response.overview) {
        return null;
    }
    return response.overview;
}

/**
 * 更新同步开关状态。
 */
export async function requestSyncToggle(enabled) {
    const response = await sendRuntimeMessage({
        type: 'sync-toggle',
        enabled: enabled === true
    }).catch(() => null);
    return response && response.ok === true;
}

/**
 * 立即将本地数据推送到云端。
 */
export async function requestSyncPushNow() {
    return sendRuntimeMessage({ type: 'sync-push-now' }).catch(() => null);
}

/**
 * 尝试将云端数据拉取到本地。
 */
export async function requestSyncPullNow() {
    return sendRuntimeMessage({ type: 'sync-pull-now' }).catch(() => null);
}

/**
 * 恢复最近一次冲突前的本地数据快照。
 */
export async function requestSyncConflictRestore() {
    return sendRuntimeMessage({ type: 'sync-conflict-restore' }).catch(() => null);
}
