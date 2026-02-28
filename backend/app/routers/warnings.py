from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Set
from ..db import get_db
from ..models import WarningMessage
from ..schemas import WarningMessageSchema

router = APIRouter(
    prefix="/warnings",
    tags=["warnings"],
)

# 简单的 WebSocket 连接管理器
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_count(self, db: Session):
        count = db.query(WarningMessage).filter(WarningMessage.is_processed == 0).count()
        message = {"type": "unprocessed_count", "count": count}
        # 需要在协程中广播，或者使用更复杂的消息队列。这里简化处理。
        # 注意：在 FastAPI router 中调用此方法需小心并发。
        import json
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    try:
        # 初始发送一次
        count = db.query(WarningMessage).filter(WarningMessage.is_processed == 0).count()
        await websocket.send_json({"type": "unprocessed_count", "count": count})
        
        while True:
            # 保持连接，处理心跳等（此处简化）
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.get("/", response_model=List[WarningMessageSchema])
def get_warnings(db: Session = Depends(get_db)):
    warnings = db.query(WarningMessage).order_by(WarningMessage.created_at.desc()).all()
    return warnings

@router.get("/unprocessed_count")
def get_unprocessed_count(db: Session = Depends(get_db)):
    count = db.query(WarningMessage).filter(WarningMessage.is_processed == 0).count()
    return {"count": count}

@router.delete("/{warning_id}")
def delete_warning(warning_id: int, db: Session = Depends(get_db)):
    warning = db.query(WarningMessage).filter(WarningMessage.id == warning_id).first()
    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")
    db.delete(warning)
    db.commit()
    return {"message": "Warning deleted"}

@router.post("/{warning_id}/process")
async def process_warning(warning_id: int, db: Session = Depends(get_db)):
    warning = db.query(WarningMessage).filter(WarningMessage.id == warning_id).first()
    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")
    warning.is_processed = 1
    db.commit()
    # 广播最新计数
    await manager.broadcast_count(db)
    return {"message": "Warning marked as processed"}
