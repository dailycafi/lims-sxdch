from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="实验室信息管理系统(LIMS) API"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 允许前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册API路由
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """根路径"""
    return {"message": "欢迎使用LIMS系统API"}


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}
