from fastapi import APIRouter
from ..vector_store import vector_store

router = APIRouter(prefix="/vector", tags=["vector"])

@router.get("/", summary="获取向量库所有数据")
async def get_vector_list(page: int = 1, size: int = 10) -> dict:
    """分页获取向量库中的所有数据（不包含 embeddings）."""
    offset = (page - 1) * size
    data = vector_store.get_all(offset=offset, limit=size)
    
    # 统一元数据的 key 顺序
    if "metadatas" in data and data["metadatas"]:
        new_metadatas = []
        for m in data["metadatas"]:
            # 按 db_id, title, source 的顺序构建新字典
            ordered_m = {}
            # 优先顺序
            for key in ["db_id", "title", "source"]:
                if key in m:
                    ordered_m[key] = m[key]
            # 补齐其他可能存在的 key
            for key, val in m.items():
                if key not in ordered_m:
                    ordered_m[key] = val
            new_metadatas.append(ordered_m)
        data["metadatas"] = new_metadatas
        
    return data
