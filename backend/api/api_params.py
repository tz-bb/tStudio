from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

# 导入共享对象
from app_state import param_manager
from params.parameter_types import get_type_definitions, create_parameter

router = APIRouter()

# --- 参数类型API ---
@router.get("/types")
async def get_param_types():
    """获取所有支持的参数类型及其定义。"""
    try:
        return get_type_definitions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get parameter types: {str(e)}")

@router.get("/types/{type_name}")
async def get_param_type_template(type_name: str):
    """获取指定参数类型的完整模板。"""
    try:
        template = create_parameter(type_name)
        return template.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get template for type '{type_name}': {str(e)}")

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

# --- 分类配置API路由 ---
@router.get("/configs/{category}")
async def list_configs_by_category(category: str):
    """获取指定类别的配置文件列表"""
    try:
        configs = await param_manager.get_configs_list(category)
        return {"category": category, "configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list configs for category '{category}': {str(e)}")

@router.get("/configs/{category}/{name}")
async def get_config_by_category(category: str, name: str):
    """加载指定类别和名称的配置文件"""
    try:
        config_data = await param_manager.get_config_data(name, category)
        if config_data is None:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' in category '{category}' not found")
        return config_data
    except HTTPException as e:
        raise e # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get config '{name}' in category '{category}': {str(e)}")

@router.post("/configs/{category}")
async def save_config_by_category(category: str, request: SaveConfigRequest):
    """保存指定类别的配置文件"""
    try:
        success = await param_manager.save_config_data(request.name, request.data, category)
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save configuration '{request.name}' in category '{category}'")
        return {"success": True, "message": f"Configuration '{request.name}' in category '{category}' saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config '{request.name}' in category '{category}': {str(e)}")

@router.delete("/configs/{category}/{name}")
async def delete_config_by_category(category: str, name: str):
    """删除指定类别和名称的配置文件"""
    try:
        success = await param_manager.delete_config(name, category)
        if not success:
            raise HTTPException(status_code=404, detail=f"Configuration '{name}' in category '{category}' not found or could not be deleted.")
        return {"success": True, "message": f"Configuration '{name}' in category '{category}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration '{name}' in category '{category}': {str(e)}")

# --- 参数操作API ---
@router.post("/configs/{category}/{name}/params")
async def add_parameter(category: str, name: str, request: ParamAddRequest):
    """向配置中添加一个新参数"""
    try:
        success = await param_manager.add_parameter(name, request.path, request.type, category)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to add parameter")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add parameter: {str(e)}")

@router.patch("/configs/{category}/{name}/params")
async def update_parameter(category: str, name: str, request: ParamUpdateRequest):
    """更新一个参数的值"""
    try:
        success = await param_manager.update_parameter_value(name, request.path, request.value, category)
        if not success:
            raise HTTPException(status_code=400, detail="Parameter path or config not found")
        return {"success": True}
    except HTTPException as e:
        raise e # 重新抛出HTTPException以保留原始状态码
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update parameter: {str(e)}")

@router.api_route("/configs/{category}/{name}/params", methods=["DELETE"])
async def delete_parameter(category: str, name: str, request: ParamDeleteRequest):
    """从配置中删除一个参数"""
    try:
        success = await param_manager.delete_parameter(name, request.path, category)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete parameter")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete parameter: {str(e)}")

# --- 备份与恢复API ---
@router.post("/configs/{category}/{name}/backups")
async def create_backup(category: str, name: str):
    """创建一个手动备份"""
    try:
        backup_name = await param_manager.create_manual_backup(name, category)
        if not backup_name:
            raise HTTPException(status_code=500, detail="Failed to create backup")
        return {"success": True, "backup_name": backup_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")

@router.get("/configs/{category}/{name}/backups")
async def list_backups(category: str, name: str):
    """列出所有手动备份"""
    try:
        backups = await param_manager.get_backup_list(name, category)
        return {"backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")

@router.post("/configs/{category}/{name}/restore")
async def restore_backup(category: str, name: str, request: BackupRestoreRequest):
    """从手动备份恢复"""
    try:
        success = await param_manager.restore_from_manual_backup(name, request.backup_filename, category)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to restore from backup")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")

# --- 可确认的编辑（自动备份/恢复） ---
@router.post("/configs/{category}/{name}/confirm-start")
async def start_confirmable_edit_endpoint(category: str, name: str):
    """开始一个可确认的编辑会话（创建自动备份）"""
    try:
        success = await param_manager.start_confirmable_edit(name, category)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create auto backup")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start confirmable edit: {str(e)}")

@router.post("/configs/{category}/{name}/confirm-revert")
async def revert_confirmable_edit_endpoint(category: str, name: str):
    """撤销编辑（从自动备份恢复）"""
    try:
        success = await param_manager.revert_confirmable_edit(name, category)
        if not success:
            raise HTTPException(status_code=400, detail="No auto backup found to revert from.")
        return {"success": True}
    except HTTPException as e:
        raise e # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revert changes: {str(e)}")

@router.post("/configs/{category}/{name}/confirm-end")
async def end_confirmable_edit_endpoint(category: str, name: str):
    """结束编辑会话（删除自动备份）"""
    try:
        await param_manager.end_confirmable_edit(name, category)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end confirmable edit: {str(e)}")