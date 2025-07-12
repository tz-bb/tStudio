from fastapi import APIRouter, HTTPException, Body, Depends, Query, Request
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

from app_state import param_manager
from params.parameter_types import get_type_definitions, create_parameter, ParamNode
from params.category_manager import CategoryParameterManager

router = APIRouter()

def get_param_manager():
    return param_manager

@router.get("/types")
async def get_param_types():
    return get_type_definitions()

@router.get("/types/{type_name}")
async def get_param_type_template(type_name: str):
    try:
        template_node = create_parameter(type_name, name="_template")
        return template_node.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

class ParamAddRequest(BaseModel):
    parent_path: List[str] = Field(..., description="要添加新节点的父节点路径，根节点为[]")
    param_type: str = Field(..., description="新参数的类型, e.g., 'string', 'number'")
    name: str = Field(..., description="新参数的名称")
    value: Optional[Any] = Field(None, description="新参数的初始值，如果为None则使用类型默认值")

class ParamUpdateRequest(BaseModel):
    path: List[str] = Field(..., description="要更新的参数节点的完整路径")
    value: Optional[Any] = Field(None, description="要更新的参数值")
    metadata: Optional[Dict[str, Any]] = Field(None, description="要更新的元数据")

class BackupRestoreRequest(BaseModel):
    backup_filename: str

@router.get("/configs")
async def list_all_config_categories(param_manager: CategoryParameterManager = Depends(get_param_manager)):
    structure = await param_manager.get_all_configs_structure()
    return {"configs": structure}

@router.post("/configs/{category}", status_code=201)
async def create_new_config(
    category: str,
    request: Request,
    param_manager: CategoryParameterManager = Depends(get_param_manager)
):
    """Create a new, empty configuration file in a given category."""
    body = await request.json()
    config_name = body.get('name')
    if not config_name:
        raise HTTPException(status_code=400, detail="'name' field is required to create a new config.")

    try:
        new_config = await param_manager.create_new_config(config_name, category)
        return new_config.to_clean_dict()
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@router.get("/configs/{category}")
async def list_configs_by_category(category: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    configs = await param_manager.get_configs_list(category)
    return {"category": category, "configs": configs}

@router.get("/configs/{category}/{name}")
async def get_config_by_category(category: str, name: str, raw: bool = False, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    try:
        root_node = await param_manager.get_config_data(name, category)
        if root_node is None:
            raise HTTPException(status_code=404, detail=f"Config '{name}' not found in category '{category}'")
        return root_node.to_clean_dict() if not raw else root_node.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing config: {e}")

@router.put("/configs/{category}/{name}")
async def overwrite_config_by_category(category: str, name: str, request: Request, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    try:
        new_content = await request.json()
        await param_manager.save_config_data(name, category, new_content)
        return {"success": True, "message": f"Config '{name}' in category '{category}' has been overwritten."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to overwrite config: {e}")

@router.delete("/configs/{category}/{name}")
async def delete_config_by_category(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    success = await param_manager.delete_config(name, category)
    if not success:
        raise HTTPException(status_code=404, detail="Config not found or could not be deleted.")
    return {"success": True, "message": "Config deleted successfully"}

@router.get("/configs/{category}/{name}/param")
async def get_parameter_node(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager), path: List[str] = Query([]), field: Optional[str] = None):
    try:
        node = await param_manager.get_parameter_node(name, path, category)
        if node is None:
            raise HTTPException(status_code=404, detail=f"Parameter path '{'.'.join(path)}' not found")

        if field == 'value':
            return {"value": node.value}
        elif field == 'metadata':
            return node.metadata if node.metadata is not None else {}
        elif field is None:
            if node.is_value_node and not node.children:
                return {"value": node.value}
            else:
                return node.to_clean_dict()
        else:
            raise HTTPException(status_code=400, detail=f"Invalid 'field' parameter. Must be 'value' or 'metadata'.")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Config '{name}' not found")
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error in get_parameter_node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/configs/{category}/{name}/param")
async def add_parameter(category: str, name: str, request: ParamAddRequest, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    try:
        success = await param_manager.add_parameter(
            config_name=name,
            parent_path=request.parent_path,
            param_type=request.param_type,
            name=request.name,
            value=request.value,
            category=category
        )
        if not success:
             raise HTTPException(status_code=400, detail=f"Could not add parameter. Parent path might be a value node or invalid.")
        return {"message": f"Parameter '{request.name}' added successfully."}
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Config file not found.")

@router.patch("/configs/{category}/{name}/param")
async def update_parameter(category: str, name: str, request: ParamUpdateRequest, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    # 检查节点是否存在
    node = await param_manager.get_parameter_node(name, request.path, category)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Failed to update. Path '{'.'.join(request.path)}' not found.")

    if request.value is not None:
        success = await param_manager.update_parameter_value(name, request.path, request.value, category)
        if not success:
            raise HTTPException(status_code=404, detail=f"Failed to update value. Path '{'.'.join(request.path)}' not found.")
    
    if request.metadata is not None:
        success = await param_manager.update_parameter_metadata(name, request.path, request.metadata, category)
        if not success:
            raise HTTPException(status_code=404, detail=f"Failed to update metadata. Path '{'.'.join(request.path)}' not found.")

    return {"success": True}

@router.delete("/configs/{category}/{name}/param")
async def delete_parameter(category: str, name: str, path: List[str] = Query(...), param_manager: CategoryParameterManager = Depends(get_param_manager)):
    # First, check if the node exists to provide a clear 404.
    node = await param_manager.get_parameter_node(name, path, category)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Failed to delete. Path '{'.'.join(path)}' not found.")

    success = await param_manager.delete_parameter(name, path, category)
    if not success:
        # This logic might be hit if deletion fails for other reasons (e.g., permissions, lock files).
        raise HTTPException(status_code=500, detail=f"Failed to delete path '{'.'.join(path)}' due to an internal error.")
    return {"success": True}

@router.post("/configs/{category}/{name}/backups")
async def create_backup(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    backup_name = await param_manager.create_manual_backup(name, category)
    if not backup_name:
        raise HTTPException(status_code=500, detail="Failed to create backup")
    return {"success": True, "backup_name": backup_name}

@router.get("/configs/{category}/{name}/backups")
async def list_backups(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    backups = await param_manager.get_backup_list(name, category)
    return {"backups": backups}

@router.post("/configs/{category}/{name}/restore")
async def restore_backup(category: str, name: str, request: BackupRestoreRequest, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    success = await param_manager.restore_from_manual_backup(name, request.backup_filename, category)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore from backup")
    return {"success": True}

@router.post("/configs/{category}/{name}/edit/start", summary="开始一个可恢复的编辑会话")
async def start_confirmable_edit_endpoint(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    success = await param_manager.start_confirmable_edit(name, category)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create auto backup")
    return {"success": True}

@router.post("/configs/{category}/{name}/edit/revert", summary="撤销编辑会话中的所有更改")
async def revert_confirmable_edit_endpoint(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    success = await param_manager.revert_confirmable_edit(name, category)
    if not success:
        raise HTTPException(status_code=404, detail="No auto backup found to revert from.")
    return {"success": True}

@router.post("/configs/{category}/{name}/edit/end", summary="结束并确认编辑会话")
async def end_confirmable_edit_endpoint(category: str, name: str, param_manager: CategoryParameterManager = Depends(get_param_manager)):
    await param_manager.end_confirmable_edit(name, category)
    return {"success": True}
