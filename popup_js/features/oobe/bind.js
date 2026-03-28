/**
 * 文件说明：oobe 模块事件绑定。
 * 职责：集中绑定 OOBE 页面按钮事件。
 */

/**
 * 绑定 oobe 相关事件。
 */
export function bindOobeEvents(elements, handlers) {
    const {
        oobeNext1,
        oobeOpenDownload,
        oobeNext2,
        oobeGoExample,
        oobeSkip
    } = elements;
    const {
        showOobeStep,
        openDownloadModal,
        openExamplePage,
        markOobeCompleted
    } = handlers;
    if (oobeNext1) {
        oobeNext1.addEventListener('click', () => {
            showOobeStep(2);
        });
    }
    if (oobeOpenDownload) {
        oobeOpenDownload.addEventListener('click', () => {
            openDownloadModal();
        });
    }
    if (oobeNext2) {
        oobeNext2.addEventListener('click', () => {
            showOobeStep(3);
        });
    }
    if (oobeGoExample) {
        oobeGoExample.addEventListener('click', async () => {
            openExamplePage();
            await markOobeCompleted();
        });
    }
    if (oobeSkip) {
        oobeSkip.addEventListener('click', async () => {
            await markOobeCompleted();
        });
    }
}

