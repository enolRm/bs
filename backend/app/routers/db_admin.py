from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from ..db import get_db, engine

router = APIRouter(prefix="/db-admin", tags=["Database Admin"])

@router.get("/tables")
def list_tables():
    """列出数据库中的所有表名."""
    inspector = inspect(engine)
    return inspector.get_table_names()

@router.get("/tables/{table_name}/data")
def get_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取指定表的数据 (分页)."""
    # 安全性检查: 确保 table_name 是合法的表名，防止 SQL 注入
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")

    offset = (page - 1) * page_size
    
    # 获取总行数
    count_query = text(f"SELECT COUNT(*) FROM {table_name}")
    total_count = db.execute(count_query).scalar()
    
    # 获取列信息
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    
    # 获取分页数据
    data_query = text(f"SELECT * FROM {table_name} LIMIT :limit OFFSET :offset")
    rows = db.execute(data_query, {"limit": page_size, "offset": offset}).fetchall()
    
    # 转换为字典列表
    result = []
    for row in rows:
        result.append(dict(zip(columns, row)))
        
    return {
        "table_name": table_name,
        "columns": columns,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "data": result
    }

@router.delete("/tables/{table_name}/rows/{row_id}")
def delete_row(
    table_name: str,
    row_id: int,
    id_column: str = "id",
    db: Session = Depends(get_db)
):
    """从指定表中删除一行数据."""
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")
        
    delete_query = text(f"DELETE FROM {table_name} WHERE {id_column} = :id")
    try:
        result = db.execute(delete_query, {"id": row_id})
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        return {"message": "Row deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tables/{table_name}/rows/{row_id}")
def update_row(
    table_name: str,
    row_id: int,
    data: Dict[str, Any],
    id_column: str = "id",
    db: Session = Depends(get_db)
):
    """更新指定表中的一行数据."""
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")
    
    # 构造 SET 子句，排除 id 列
    cols = [col["name"] for col in inspector.get_columns(table_name)]
    update_parts = []
    params = {"id_val": row_id}
    
    for key, value in data.items():
        if key in cols and key != id_column:
            update_parts.append(f"{key} = :{key}")
            params[key] = value
            
    if not update_parts:
        raise HTTPException(status_code=400, detail="No valid columns to update")
        
    set_clause = ", ".join(update_parts)
    update_query = text(f"UPDATE {table_name} SET {set_clause} WHERE {id_column} = :id_val")
    
    try:
        result = db.execute(update_query, params)
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        return {"message": "Row updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
