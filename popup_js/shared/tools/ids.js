/**
 * 文件说明：ID 共享工具。
 * 职责：提供轻量级唯一 ID 生成能力。
 */

/**
 * 生成短随机 ID。
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
