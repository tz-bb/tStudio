from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

# 导入共享对象
from app_state import data_source_manager, manager

router = APIRouter()

class ConnectionRequest(BaseModel):
    adapter: str
    config: Dict[str, Any]

@router.get("/adapters")
async def get_available_adapters():
    """获取可用的数据源适配器及其配置信息"""
    return {
        "adapters": data_source_manager.get_available_adapters(),
        "adapter_configs": data_source_manager.get_adapter_configs()
    }

@router.get("/adapters/{adapter_name}/config")
async def get_adapter_config(adapter_name: str):
    """获取指定适配器的配置信息"""
    config = data_source_manager.get_adapter_config(adapter_name)
    if config is None:
        raise HTTPException(status_code=404, detail="Adapter not found")
    return config

@router.post("/connection/connect")
async def connect_to_adapter(request: ConnectionRequest):
    """连接到数据源"""
    success = await data_source_manager.connect_adapter(request.adapter, request.config)
    
    if success:
        await manager.broadcast({
            "type": "connection_status",
            "data": data_source_manager.get_connection_status()
        })
        return {"success": True, "message": "Connected successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to connect to adapter")

@router.post("/connection/disconnect")
async def disconnect_from_adapter():
    """断开当前连接"""
    success = await data_source_manager.disconnect_current_adapter()
    
    if success:
        await manager.broadcast({
            "type": "connection_status",
            "data": data_source_manager.get_connection_status()
        })
        return {"success": True, "message": "Disconnected successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to disconnect")

@router.get("/connection/status")
async def get_connection_status():
    """获取连接状态"""
    return data_source_manager.get_connection_status()