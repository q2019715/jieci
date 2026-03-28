/**
 * 文件说明：网络请求封装，统一请求入口。
 */

/**
 * 发起 fetch 请求。
 */
export async function request(url, options = {}) {
    return fetch(url, options);
}
