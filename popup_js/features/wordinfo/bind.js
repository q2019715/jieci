/**
 * 文件说明：wordinfo 模块事件绑定层。
 */

export function bindWordInfoEvents({
    elements,
    actions
}) {
    const {
        wordInfoBack,
        wordInfoSearchBtn,
        wordInfoFavoriteBtn,
        wordInfoBlockBtn,
        wordInfoSpeakBtn
    } = elements;
    if (wordInfoBack) {
        wordInfoBack.addEventListener('click', actions.goBackToSearch);
    }
    if (wordInfoSpeakBtn) {
        wordInfoSpeakBtn.addEventListener('click', actions.speakCurrentWord);
    }
    if (wordInfoSearchBtn) {
        wordInfoSearchBtn.addEventListener('click', actions.searchCurrentWordOutside);
    }
    if (wordInfoFavoriteBtn) {
        wordInfoFavoriteBtn.addEventListener('click', actions.toggleFavoriteCurrentWord);
    }
    if (wordInfoBlockBtn) {
        wordInfoBlockBtn.addEventListener('click', actions.blockCurrentWord);
    }
}
