from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, projects, samples, audit, global_params

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(projects.router, prefix="/projects", tags=["项目管理"])
api_router.include_router(samples.router, prefix="/samples", tags=["样本管理"])
api_router.include_router(audit.router, prefix="/audit", tags=["审计日志"])
api_router.include_router(global_params.router, prefix="/global-params", tags=["全局参数"])
