// background_js/trie.js - 构建和序列化中文释义匹配用的 Trie 索引。

// Trie 节点结构，保存子节点、词尾标记和完整词。
class TrieNode {
    // 初始化空节点。
    constructor() {
        this.children = {};
        this.isEnd = false;
        this.word = null;
    }
}

// Trie 树结构，支持插入词条与导出序列化结果。
class Trie {
    // 初始化 Trie 根节点。
    constructor() {
        this.root = new TrieNode();
    }

    // 将一个词写入 Trie 中。
    insert(word) {
        let node = this.root;
        for (const char of word) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEnd = true;
        node.word = word;
    }

    // 返回可存储到 chrome.storage 的根节点对象。
    serialize() {
        return this.root;
    }
}

// 从词库数据构建中文 Trie 索引，供 content 脚本快速匹配。
export function buildChineseTrieIndex(vocabularies) {
    const trie = new Trie();
    const vocabSet = new Set();

    vocabularies.forEach((vocab) => {
        vocab.data.forEach((item) => {
            if (!item.translations || !Array.isArray(item.translations)) {
                return;
            }

            item.translations.forEach((trans) => {
                const chinese = trans.translation;
                if (!chinese) {
                    return;
                }

                const chineseWords = chinese.split(/[,、，]/);
                chineseWords.forEach((cw) => {
                    const cleanChinese = cw.trim();
                    if (cleanChinese && !vocabSet.has(cleanChinese)) {
                        trie.insert(cleanChinese);
                        vocabSet.add(cleanChinese);
                    }
                });
            });
        });
    });

    return trie.serialize();
}
