from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Dict, Any
import json
import asyncio
import numpy as np
from datetime import datetime

app = FastAPI(title="RViz-like 3D Visualizer")

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
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()

# 数据存储
class DataStore:
    def __init__(self):
        self.topics = {
            "point_cloud": {
                "type": "PointCloud",
                "enabled": True,
                "color": "#ff0000",
                "size": 0.1,
                "data": []
            },
            "markers": {
                "type": "Markers",
                "enabled": True,
                "color": "#00ff00",
                "scale": 1.0,
                "data": []
            },
            "grid": {
                "type": "Grid",
                "enabled": True,
                "color": "#888888",
                "size": 10,
                "divisions": 10,
                "data": None
            }
        }
    
    def generate_sample_data(self):
        # 生成示例点云数据
        points = []
        for i in range(2000):
            x = np.random.uniform(-5, 5)
            y = np.random.uniform(-5, 5)
            z = np.random.uniform(0, 3)
            points.append([x, y, z])
        self.topics["point_cloud"]["data"] = points
        
        # 生成示例标记数据
        markers = []
        for i in range(10):
            marker = {
                "id": i,
                "position": [np.random.uniform(-3, 3), np.random.uniform(-3, 3), np.random.uniform(0, 2)],
                "rotation": [0, 0, 0],
                "scale": [0.5, 0.5, 0.5],
                "type": "cube"
            }
            markers.append(marker)
        self.topics["markers"]["data"] = markers

data_store = DataStore()
data_store.generate_sample_data()

@app.get("/api/topics")
async def get_topics():
    """获取所有数据主题"""
    return {"topics": list(data_store.topics.keys())}

@app.get("/api/topics/{topic_name}")
async def get_topic_data(topic_name: str):
    """获取特定主题的数据"""
    if topic_name in data_store.topics:
        return data_store.topics[topic_name]
    return {"error": "Topic not found"}

@app.post("/api/topics/{topic_name}/config")
async def update_topic_config(topic_name: str, config: Dict[str, Any]):
    """更新主题配置"""
    if topic_name in data_store.topics:
        data_store.topics[topic_name].update(config)
        # 广播配置更新
        await manager.broadcast({
            "type": "config_update",
            "topic": topic_name,
            "config": data_store.topics[topic_name]
        })
        return {"success": True}
    return {"error": "Topic not found"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # 发送初始数据
        await websocket.send_text(json.dumps({
            "type": "initial_data",
            "data": data_store.topics
        }))
        
        while True:
            # 模拟实时数据更新
            await asyncio.sleep(0.01)
            data_store.generate_sample_data()
            await manager.broadcast({
                "type": "data_update",
                "data": data_store.topics
            })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3500)