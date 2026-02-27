import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import knowledge as knowledge_router
from .routers import qa as qa_router
from .routers import verification as verification_router
from .routers import vector as vector_router


def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)

    # 配置日志
    logging.basicConfig(level=logging.INFO)

    # 创建数据库表（演示环境可直接在启动时创建，生产建议使用 Alembic 迁移）
    Base.metadata.create_all(bind=engine)

    # CORS，方便前端本地开发
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", summary="健康检查")
    async def health_check() -> dict:
        return {"status": "ok"}

    # 挂载实际业务路由：
    app.include_router(knowledge_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(verification_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(qa_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(vector_router.router, prefix=settings.API_V1_PREFIX)

    # TODO:

    return app


app = create_app()

