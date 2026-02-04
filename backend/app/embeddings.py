from typing import List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


# 使用 TF-IDF 作为简单的 embedding 方案（完全本地，无需下载模型）
_vectorizer: TfidfVectorizer | None = None
_target_dim = 384  # 目标向量维度


def _get_vectorizer() -> TfidfVectorizer:
    """获取或创建向量化器（单例模式）"""
    global _vectorizer
    if _vectorizer is None:
        # TF-IDF 向量化（最大特征数设为 512，适合中文和英文）
        _vectorizer = TfidfVectorizer(
            max_features=512,
            ngram_range=(1, 2),  # 支持 1-gram 和 2-gram
            stop_words=None,  # 中文可以不用停用词，或后续可扩展
        )
    return _vectorizer


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    使用 TF-IDF 生成文本向量（完全本地，无需网络下载模型）。
    适合毕设演示，效果虽不如 transformer 模型，但足够展示 RAG 流程。
    
    处理逻辑：
    - 如果 vectorizer 已 fit，直接 transform
    - 如果未 fit，先 fit 再 transform
    - 将 TF-IDF 向量填充/截断到固定维度（384维），然后归一化
    """
    vectorizer = _get_vectorizer()
    
    # 判断是否需要 fit
    if not hasattr(vectorizer, "vocabulary_") or len(vectorizer.vocabulary_) == 0:
        # 首次调用，需要 fit
        tfidf_matrix = vectorizer.fit_transform(texts)
    else:
        # 已 fit 过，直接 transform
        tfidf_matrix = vectorizer.transform(texts)
    
    # 转换为稠密矩阵
    dense_matrix = tfidf_matrix.toarray() if hasattr(tfidf_matrix, "toarray") else np.array(tfidf_matrix)
    
    # 调整到目标维度：如果特征数少于目标维度，用零填充；如果多于，截断
    current_dim = dense_matrix.shape[1]
    if current_dim < _target_dim:
        # 填充零到目标维度
        padding = np.zeros((dense_matrix.shape[0], _target_dim - current_dim))
        dense_matrix = np.hstack([dense_matrix, padding])
    elif current_dim > _target_dim:
        # 截断到目标维度
        dense_matrix = dense_matrix[:, :_target_dim]
    
    # L2 归一化（类似常见 embedding）
    norms = np.linalg.norm(dense_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)  # 避免除零
    normalized = dense_matrix / norms
    
    return normalized.tolist()

