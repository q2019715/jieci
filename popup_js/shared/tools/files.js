/**
 * 文件说明：文件读取共享工具。
 * 职责：提供浏览器 File 对象的文本读取能力。
 */

/**
 * 以 UTF-8 读取文件文本内容。
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsText(file, 'UTF-8');
    });
}
