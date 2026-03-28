/**
 * 文件说明：oobe 模块渲染逻辑。
 * 职责：处理 OOBE 文案、步骤显隐与词库列表渲染。
 */

/**
 * 设置 OOBE 固定文案。
 */
export function applyOobeCopy(elements) {
    const {
        oobeTitle1,
        oobeText1,
        oobeNext1,
        oobeTitle2,
        oobeText2,
        oobeOpenDownload,
        oobeNext2,
        oobeTitle3,
        oobeText3,
        oobeGoExample,
        oobeSkip
    } = elements;
    if (oobeTitle1) {
        oobeTitle1.textContent = 'Hello 你好 ⌯･ᴗ･⌯';
    }
    if (oobeText1) {
        oobeText1.textContent = '欢迎使用本插件。本插件通过将您浏览的网页中的单词标注为对应的外语单词，让您在日常阅读中看到更多的外语，记住更多的单词！';
    }
    if (oobeNext1) {
        oobeNext1.textContent = '让我们开始吧';
    }
    if (oobeTitle2) {
        oobeTitle2.textContent = '让我们决定下要背的单词吧';
    }
    if (oobeText2) {
        oobeText2.textContent = '点击下载词库，选择您想要背诵的单词列表。我们会依照这个词库里头的词，在网页上进行对应的标注。您可以后续在插件中添加或者删除词库。';
    }
    if (oobeOpenDownload) {
        oobeOpenDownload.textContent = '让我看看（下载词库）';
    }
    if (oobeNext2) {
        oobeNext2.textContent = '我选好了，下一步';
    }
    if (oobeTitle3) {
        oobeTitle3.textContent = '大功告成！感谢您的使用';
    }
    if (oobeText3) {
        oobeText3.textContent = '您可以前往我们的示例页面，看下插件工作的怎么样。如果您在使用的时候有任何问题，请一定要跟我们反馈哦~';
    }
    if (oobeGoExample) {
        oobeGoExample.textContent = '带我去示例页面看看';
    }
    if (oobeSkip) {
        oobeSkip.textContent = '谢了~暂时不必';
    }
}

/**
 * 切换 OOBE 可见性。
 */
export function setOobeVisible(elements, visible) {
    if (!elements.oobe) {
        return;
    }
    elements.oobe.classList.toggle('is-hidden', !visible);
}

/**
 * 切换 OOBE 当前步骤。
 */
export function setOobeStep(elements, step) {
    const oobeSteps = Array.isArray(elements.oobeSteps) ? elements.oobeSteps : [];
    oobeSteps.forEach((item) => {
        if (!item) {
            return;
        }
        const isActive = item.dataset.step === String(step);
        item.classList.toggle('is-active', isActive);
    });
}

/**
 * 渲染 OOBE 词库列表。
 */
export function renderOobeVocabList(elements, vocabList, handlers) {
    const { oobeVocabList, oobeVocabEmpty } = elements;
    const { onDeleteVocabulary, onDeleteError } = handlers;
    if (!oobeVocabList || !oobeVocabEmpty) {
        return;
    }
    oobeVocabList.replaceChildren();
    const items = Array.isArray(vocabList) ? vocabList : [];
    if (items.length === 0) {
        oobeVocabEmpty.style.display = 'block';
        return;
    }
    oobeVocabEmpty.style.display = 'none';
    items.forEach((vocab) => {
        const item = document.createElement('div');
        item.className = 'oobe-vocab-item';
        const name = document.createElement('div');
        name.className = 'oobe-vocab-name';
        name.textContent = vocab && vocab.name ? vocab.name : '未命名词库';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'oobe-vocab-delete';
        deleteButton.textContent = 'x';
        deleteButton.setAttribute('aria-label', '删除词库');
        deleteButton.title = '删除词库';
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!vocab || vocab.id == null) {
                return;
            }
            const originalText = deleteButton.textContent;
            deleteButton.disabled = true;
            deleteButton.textContent = '...';
            try {
                await onDeleteVocabulary(vocab.id);
            } catch (error) {
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
                onDeleteError(error);
            }
        });
        item.appendChild(name);
        item.appendChild(deleteButton);
        oobeVocabList.appendChild(item);
    });
}

