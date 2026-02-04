from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, projects, samples, audit, global_params, statistics, deviations_v2 as deviations, archive, tasks, user_access, storage, roles, test_groups, labels, special_samples

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(roles.router, prefix="/roles", tags=["角色管理"])
api_router.include_router(projects.router, prefix="/projects", tags=["项目管理"])
api_router.include_router(test_groups.router, tags=["试验组管理"])
api_router.include_router(samples.router, prefix="/samples", tags=["样本管理"])
api_router.include_router(storage.router, prefix="/storage", tags=["存储管理"])
api_router.include_router(audit.router, prefix="/audit", tags=["审计日志"])
api_router.include_router(global_params.router, prefix="/global-params", tags=["全局参数"])
api_router.include_router(statistics.router, prefix="/statistics", tags=["统计查询"])
api_router.include_router(deviations.router, prefix="/deviations", tags=["偏差管理"])
api_router.include_router(archive.router, prefix="/archive", tags=["项目归档"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["任务中心"])
api_router.include_router(user_access.router, prefix="/user-access", tags=["用户访问记录"])
api_router.include_router(labels.router, prefix="/labels", tags=["标签管理"])
api_router.include_router(special_samples.router, prefix="/special-samples", tags=["特殊样本管理"])