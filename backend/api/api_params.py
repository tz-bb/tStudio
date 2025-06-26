from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

# 导入共享对象
from app_state import param_manager

router = APIRouter()

# --- 请求模型 ---
class SaveConfigRequest(BaseModel):
    name: str
    data: Dict[str, Any]

class ParamUpdateRequest(BaseModel):
    path: str
    value: Any

class ParamAddRequest(BaseModel):
    path: str
    type: str

class ParamDeleteRequest(BaseModel):
    path: str

class BackupRestoreRequest(BaseModel):
    backup_filename: str

# --- 参数管理API ---
@router.get("/configs")
async def list_configs():
    """获取所有可用的配置文件列表。"""
    configs = await param_manager.get_configs_list()
    return {"configs": configs}

@router.get("/configs/{name}")
async def get_config(name: str):
    """加载指定名称的配置文件。"""
    config_data = await param_manager.get_config_data(name)
    if config_data is None:
        raise HTTPException(status_code=404, detail=f"Configuration '{name}' not found")
    return config_data

@router.post("/configs")
async def save_config(request: SaveConfigRequest):
    """保存或更新一个配置文件。"""
    success = await param_manager.save_config_data(request.name, request.data)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration '{request.name}'")
    return {"success": True, "message": f"Configuration '{request.name}' saved successfully"}

@router.post("/configs/{name}/params")
async def add_parameter(name: str, request: ParamAddRequest):
    """向配置中添加一个新参数"""
    success = await param_manager.add_parameter(name, request.path, request.type)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to add parameter")
    return {"success": True}

@router.patch("/configs/{name}/params")
async def update_parameter(name: str, request: ParamUpdateRequest):
    """更新一个参数的值"""
    success = await param_manager.update_parameter_value(name, request.path, request.value)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update parameter value")
    return {"success": True}

@router.api_route("/configs/{name}/params", methods=["DELETE"])
async def delete_parameter(name: str, request: ParamDeleteRequest):
    """从配置中删除一个参数"""
    success = await param_manager.delete_parameter(name, request.path)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete parameter")
    return {"success": True}

# --- 备份与恢复API ---

@router.post("/configs/{name}/backups")
async def create_backup(name: str):
    """创建一个手动备份"""
    backup_name = await param_manager.create_manual_backup(name)
    if not backup_name:
        raise HTTPException(status_code=500, detail="Failed to create backup")
    return {"success": True, "backup_name": backup_name}

@router.get("/configs/{name}/backups")
async def list_backups(name: str):
    """列出所有手动备份"""
    backups = await param_manager.get_backup_list(name)
    return {"backups": backups}

@router.post("/configs/{name}/restore")
async def restore_backup(name: str, request: BackupRestoreRequest):
    """从手动备份恢复"""
    success = await param_manager.restore_from_manual_backup(name, request.backup_filename)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore from backup")
    return {"success": True}

@router.post("/configs/{name}/confirm-start")
async def start_confirmable_edit(name: str):
    """开始一个可确认的编辑会话（创建自动备份）"""
    await param_manager.create_auto_backup(name)
    return {"success": True, "message": "Auto backup created. You can now make changes."}

@router.post("/configs/{name}/confirm-revert")
async def revert_confirmable_edit(name: str):
    """撤销所有未确认的修改（从自动备份恢复）"""
    success = await param_manager.restore_from_auto_backup(name)
    if not success:
        raise HTTPException(status_code=400, detail="No auto backup to restore from or failed to restore.")
    return {"success": True, "message": "Changes have been reverted."}