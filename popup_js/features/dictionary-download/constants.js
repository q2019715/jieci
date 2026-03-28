/**
 * 文件说明：dictionary-download 模块文案常量。
 * 职责：集中维护词库下载与更新流程中的用户可见文案。
 */

/**
 * 通用文案。
 */
export const DICT_DOWNLOAD_UNNAMED_TEXT = '未命名词库';
export const DICT_DOWNLOAD_FAILED_PREFIX = '下载失败: ';
export const DICT_DOWNLOAD_LOADING_FAILED_PREFIX = '加载失败: ';
export const DICT_DOWNLOAD_SUCCESS_PREFIX = '成功下载并导入 ';
export const DICT_DOWNLOAD_PROGRESS_PREFIX = '正在下载: ';
export const DICT_DOWNLOAD_DUPLICATED_TEXT = '已存在同名词库，请先删除本地词库再重新下载';
export const DICT_DOWNLOAD_EMPTY_TEXT = '暂无可用词库';
export const DICT_DOWNLOAD_COUNT_PREFIX = '词条数: ';
export const DICT_DOWNLOAD_UPDATED_AT_PREFIX = '更新: ';

/**
 * 更新弹窗与进度文案。
 */
export const DICT_UPDATE_PROGRESS_TITLE_TEXT = '更新进度';
export const DICT_UPDATE_MERGING_TEXT = '正在合并词库 请稍后';
export const DICT_UPDATE_FAILED_TEXT = '更新失败';
export const DICT_UPDATE_CANCELED_TEXT = '已取消更新';
export const DICT_UPDATE_PREPARING_TEXT = '准备更新...';
export const DICT_UPDATE_RUNNING_TEXT = '正在更新词库...';
export const DICT_UPDATE_NONE_LOCAL_TEXT = '暂无可更新的本地词库';
export const DICT_UPDATE_SERVER_NOT_FOUND_TEXT = '服务器未找到';
export const DICT_UPDATE_LOCAL_NOT_FOUND_TEXT = '本地词库不存在';
export const DICT_UPDATE_CURRENT_PREFIX = '更新中: ';
export const DICT_UPDATE_TOTAL_PROGRESS_PREFIX = '总进度: ';
export const DICT_UPDATE_SUCCESS_PREFIX = '更新成功: ';
export const DICT_UPDATE_DONE_SUCCESS_PREFIX = '更新完成，成功 ';
export const DICT_UPDATE_DONE_FAILED_SEGMENT_PREFIX = '，失败 ';
export const DICT_UPDATE_DONE_FAILED_SEGMENT_SUFFIX = ': ';
export const DICT_UPDATE_FAILED_PREFIX = '更新失败: ';
export const DICT_UPDATE_RUNNING_PLACEHOLDER_TEXT = '更新中: ...';
export const DICT_UPDATE_RUNNING_PLACEHOLDER_STATUS_TEXT = '正在更新: ...';
export const DICT_UPDATE_SEPARATOR_TEXT = '；';

/**
 * 按钮文案。
 */
export const DICT_UPDATE_BUTTON_RUNNING_TEXT = '更新中...';

/**
 * 状态提示自动隐藏时长（毫秒）。
 */
export const DICT_STATUS_TIP_AUTO_HIDE_DELAY_MS = 3000;

/**
 * 下载弹窗关闭延时（毫秒）。
 */
export const DICT_DOWNLOAD_MODAL_CLOSE_SUCCESS_DELAY_MS = 500;
export const DICT_DOWNLOAD_MODAL_CLOSE_ERROR_DELAY_MS = 2000;

/**
 * 更新弹窗自动关闭延时（毫秒）。
 */
export const DICT_UPDATE_MODAL_CLOSE_SHORT_DELAY_MS = 3000;
export const DICT_UPDATE_MODAL_CLOSE_LONG_DELAY_MS = 5000;
