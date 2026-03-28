/**
 * 文件说明：dictionary（词库管理）模块事件绑定。
 * 职责：绑定词库搜索、导入按钮与文件选择事件。
 */

/**
 * 绑定词库管理相关事件。
 */
export function bindDictionaryEvents({
    elements,
    actions
}) {
    const {
        importBtn,
        fileInput,
        vocabSearchInput
    } = elements;
    const {
        render,
        importFiles
    } = actions;

    if (vocabSearchInput) {
        vocabSearchInput.addEventListener('input', () => {
            render();
        });
    }
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', async (event) => {
            const files = Array.from((event.target && event.target.files) || []);
            await importFiles(files);
        });
    }
}
