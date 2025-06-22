from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Dict, Any
import json
import asyncio
from datetime import datetime
from pydantic import BaseModel

# 导入我们的模块
from core.data_source_manager import DataSourceManager

app = FastAPI(title="tStudio backend")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()
data_source_manager = DataSourceManager()

# 请求模型
class ConnectionRequest(BaseModel):
    adapter: str
    config: Dict[str, Any]

class TopicSubscriptionRequest(BaseModel):
    topic: str
    message_type: str = None

# API路由
@app.get("/api/adapters")
async def get_available_adapters():
    """获取可用的数据源适配器及其配置信息"""
    return {
        "adapters": data_source_manager.get_available_adapters(),
        "adapter_configs": data_source_manager.get_adapter_configs()
    }

@app.get("/api/adapters/{adapter_name}/config")
async def get_adapter_config(adapter_name: str):
    """获取指定适配器的配置信息"""
    config = data_source_manager.get_adapter_config(adapter_name)
    if config is None:
        raise HTTPException(status_code=404, detail="Adapter not found")
    return config

@app.post("/api/connection/connect")
async def connect_to_adapter(request: ConnectionRequest):
    """连接到数据源"""
    success = await data_source_manager.connect_adapter(request.adapter, request.config)
    
    if success:
        # 广播连接状态更新
        await manager.broadcast({
            "type": "connection_status",
            "data": data_source_manager.get_connection_status()
        })
        return {"success": True, "message": "Connected successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to connect to adapter")

@app.post("/api/connection/disconnect")
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

@app.get("/api/connection/status")
async def get_connection_status():
    """获取连接状态"""
    return data_source_manager.get_connection_status()

@app.get("/api/topics")
async def get_available_topics():
    """获取可用话题"""
    topics = await data_source_manager.get_available_topics()
    return {"topics": topics}

@app.post("/api/topics/subscribe")
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

@app.post("/api/topics/unsubscribe")
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

# 数据回调函数
async def on_data_received(topic: str, data: Any):
    """数据接收回调"""
    # print(f"[DEBUG] Broadcasting data for topic: {topic}") # <--- 添加这行
    await manager.broadcast({
        "type": "data_update",
        "topic": topic,
        "data": data
    })

# 注册数据回调
data_source_manager.add_data_callback(on_data_received)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_host = websocket.client.host if websocket.client else "unknown"
    print(f"[WebSocket] 新的连接请求来自: {client_host}")
    
    try:
        await manager.connect(websocket)
        print(f"[WebSocket] 客户端 {client_host} 连接成功")
        
        # 发送初始连接状态
        initial_status = {
            "type": "connection_status",
            "data": data_source_manager.get_connection_status()
        }
        await websocket.send_text(json.dumps(initial_status))
        print(f"[WebSocket] 已发送初始状态给客户端 {client_host}: {initial_status}")
        
        # 发送欢迎消息
        welcome_msg = {
            "type": "system_message",
            "data": {
                "message": "WebSocket连接建立成功",
                "timestamp": datetime.now().isoformat(),
                "server_info": "tStudio Backend v1.0"
            }
        }
        await websocket.send_text(json.dumps(welcome_msg))
        
        # 保持连接活跃并定期发送心跳
        heartbeat_counter = 0
        while True:
            await asyncio.sleep(5)  # 每5秒发送一次心跳
            heartbeat_counter += 1
            
            # 发送心跳消息
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
                print(f"[WebSocket] 心跳 #{heartbeat_counter} 发送给 {client_host}")
            except Exception as e:
                print(f"[WebSocket] 发送心跳失败给 {client_host}: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"[WebSocket] 客户端 {client_host} 正常断开连接")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket] 客户端 {client_host} 连接异常: {e}")
        manager.disconnect(websocket)

@app.post("/api/topics/{topic_name}/config")
async def update_topic_config(topic_name: str, config: dict):
    """更新话题配置（占位实现）"""
    print(f"收到配置更新请求: topic={topic_name}, config={config}")
    
    # 广播配置更新给前端
    await manager.broadcast({
        "type": "config_update",
        "topic": topic_name,
        "config": config
    })
    
    return {"success": True, "message": f"Config updated for {topic_name}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3500)