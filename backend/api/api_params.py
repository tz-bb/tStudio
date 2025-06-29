from fastapi import APIRouter, HTTPException
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

# --- 分类配置API路由（优先级更高，放在前面） ---
@router.get("/configs/category/{category}")
async def list_configs_by_category(category: str):
    """获取指定类别的配置文件列表"""
    try:
        configs = await param_manager.get_configs_list(category)
        return {"category": category, "configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list configs for category '{category}': {str(e)}")

@router.get("/configs/category/{category}/{name}")
async def get_config_by_category(category: str, name: str):
    """加载指定类别和名称的配置文件"""
    try:
        config_data = await param_manager.get_config_data(name, category)
        if config_data is None:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' in category '{category}' not found")
        return config_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get config '{name}' in category '{category}': {str(e)}")

@router.post("/configs/category/{category}")
async def save_config_by_category(category: str, request: SaveConfigRequest):
    """保存指定类别的配置文件"""
    try:
        success = await param_manager.save_config_data(request.name, request.data, category)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save configuration '{request.name}' in category '{category}'")
        return {"success": True, "message": f"Configuration '{request.name}' in category '{category}' saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config '{request.name}' in category '{category}': {str(e)}")

@router.delete("/configs/category/{category}/{name}")
async def delete_config_by_category(category: str, name: str):
    """删除指定类别和名称的配置文件"""
    try:
        adapter = param_manager.get_adapter(category)
        config_path = adapter._get_path(name)
        
        import os
        if os.path.exists(config_path):
            os.remove(config_path)
            return {"success": True, "message": f"Configuration '{name}' in category '{category}' deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' in category '{category}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration '{name}' in category '{category}': {str(e)}")

# --- 兼容旧API的路由 ---
@router.get("/configs")
async def list_configs():
    """获取所有可用的配置文件列表（默认system类别）。"""
    try:
        configs = await param_manager.get_configs_list('system')
        return {"configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list configs: {str(e)}")

@router.get("/configs/{name}")
async def get_config(name: str):
    """加载指定名称的配置文件（默认system类别）。"""
    try:
        config_data = await param_manager.get_config_data(name, 'system')
        if config_data is None:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' not found")
        return config_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get config '{name}': {str(e)}")

@router.post("/configs")
async def save_config(request: SaveConfigRequest):
    """保存或更新一个配置文件（默认system类别）。"""
    try:
        success = await param_manager.save_config_data('system', request.name, request.data)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save configuration '{request.name}'")
        return {"success": True, "message": f"Configuration '{request.name}' saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config '{request.name}': {str(e)}")

@router.delete("/configs/{name}")
async def delete_config(name: str):
    """删除指定的配置文件（默认system类别）。"""
    try:
        adapter = param_manager.get_adapter('system')
        config_path = adapter._get_path(name)
        
        import os
        if os.path.exists(config_path):
            os.remove(config_path)
            return {"success": True, "message": f"Configuration '{name}' deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration '{name}': {str(e)}")

# --- 参数操作API ---
@router.post("/configs/{name}/params")
async def add_parameter(name: str, request: ParamAddRequest):
    """向配置中添加一个新参数"""
    try:
        success = param_manager.add_parameter('system', name, request.path, request.type)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to add parameter")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add parameter: {str(e)}")

@router.patch("/configs/{name}/params")
async def update_parameter(name: str, request: ParamUpdateRequest):
    """更新一个参数的值"""
    try:
        success = param_manager.update_parameter_value('system', name, request.path, request.value)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update parameter value")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update parameter: {str(e)}")

@router.api_route("/configs/{name}/params", methods=["DELETE"])
async def delete_parameter(name: str, request: ParamDeleteRequest):
    """从配置中删除一个参数"""
    try:
        success = param_manager.delete_parameter('system', name, request.path)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete parameter")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete parameter: {str(e)}")

# --- 备份与恢复API ---
@router.post("/configs/{name}/backups")
async def create_backup(name: str):
    """创建一个手动备份"""
    try:
        backup_name = param_manager.create_manual_backup('system', name)
        if not backup_name:
            raise HTTPException(status_code=500, detail="Failed to create backup")
        return {"success": True, "backup_name": backup_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")

@router.get("/configs/{name}/backups")
async def list_backups(name: str):
    """列出所有手动备份"""
    try:
        backups = param_manager.get_backup_list('system', name)
        return {"backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")

@router.post("/configs/{name}/restore")
async def restore_backup(name: str, request: BackupRestoreRequest):
    """从手动备份恢复"""
    try:
        success = param_manager.restore_from_manual_backup('system', name, request.backup_filename)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to restore from backup")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")

@router.post("/configs/{name}/confirm-start")
async def start_confirmable_edit(name: str):
    """开始一个可确认的编辑会话（创建自动备份）"""
    try:
        param_manager.create_auto_backup('system', name)
        return {"success": True, "message": "Auto backup created. You can now make changes."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create auto backup: {str(e)}")

@router.post("/configs/{name}/confirm-revert")
async def revert_confirmable_edit(name: str):
    """撤销所有未确认的修改（从自动备份恢复）"""
    try:
        success = param_manager.restore_from_auto_backup('system', name)
        if not success:
            raise HTTPException(status_code=400, detail="No auto backup to restore from or failed to restore.")
        return {"success": True, "message": "Changes have been reverted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revert changes: {str(e)}")