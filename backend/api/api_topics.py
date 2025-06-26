from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from pydantic import BaseModel
import json
import asyncio
from datetime import datetime
from typing import Any

from app_state import data_source_manager, manager

router = APIRouter()

class TopicSubscriptionRequest(BaseModel):
    topic: str
    message_type: str = None

@router.get("/topics")
async def get_available_topics():
    """获取可用话题"""
    topics = await data_source_manager.get_available_topics()
    return {"topics": topics}

@router.post("/topics/subscribe")
async def subscribe_to_topic(request: TopicSubscriptionRequest):
    """订阅话题"""
    print(f"Received subscription request: topic={request.topic}, message_type={request.message_type}")
    
    success = await data_source_manager.subscribe_topic(request.topic, request.message_type)
    
    if success:
        await manager.broadcast({
            "type": "topic_subscribed",
            "topic": request.topic
        })
        return {"success": True, "message": f"Subscribed to {request.topic}"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to subscribe to {request.topic}")

@router.post("/topics/unsubscribe")
async def unsubscribe_from_topic_by_query(topic: str = Query(...)):
    """通过查询参数取消订阅话题"""
    success = await data_source_manager.unsubscribe_topic(topic)
    
    if success:
        await manager.broadcast({
            "type": "topic_unsubscribed",
            "topic": topic
        })
        return {"success": True, "message": f"Unsubscribed from {topic}"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to unsubscribe from {topic}")

@router.post("/topics/{topic_name}/config")
async def update_topic_config(topic_name: str, config: dict):
    """更新话题配置（占位实现）"""
    print(f"收到配置更新请求: topic={topic_name}, config={config}")
    
    await manager.broadcast({
        "type": "config_update",
        "topic": topic_name,
        "config": config
    })
    
    return {"success": True, "message": f"Config updated for {topic_name}"}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_host = websocket.client.host if websocket.client else "unknown"
    print(f"[WebSocket] 新的连接请求来自: {client_host}")
    
    try:
        await manager.connect(websocket)
        print(f"[WebSocket] 客户端 {client_host} 连接成功")
        
        initial_status = {
            "type": "connection_status",
            "data": data_source_manager.get_connection_status()
        }
        await websocket.send_text(json.dumps(initial_status))
        print(f"[WebSocket] 已发送初始状态给客户端 {client_host}: {initial_status}")
        
        welcome_msg = {
            "type": "system_message",
            "data": {
                "message": "WebSocket连接建立成功",
                "timestamp": datetime.now().isoformat(),
                "server_info": "tStudio Backend v1.0"
            }
        }
        await websocket.send_text(json.dumps(welcome_msg))
        
        heartbeat_counter = 0
        while True:
            await asyncio.sleep(5)
            heartbeat_counter += 1
            
            heartbeat = {
                "type": "heartbeat",
                "data": {
                    "counter": heartbeat_counter,
                    "timestamp": datetime.now().isoformat(),
                    "active_connections": len(manager.active_connections)
                }
            }
            
            try:
                await websocket.send_text(json.dumps(heartbeat))
            except Exception as e:
                print(f"[WebSocket] 发送心跳失败给 {client_host}: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"[WebSocket] 客户端 {client_host} 正常断开连接")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket] 客户端 {client_host} 连接异常: {e}")
        manager.disconnect(websocket)