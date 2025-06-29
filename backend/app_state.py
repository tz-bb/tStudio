from params.category_manager import CategoryParameterManager
from core.data_source_manager import DataSourceManager
from fastapi import WebSocket
from typing import List
import json

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

# --- 全局单例 ---
# 这些对象将在整个应用中共享
manager = ConnectionManager()
data_source_manager = DataSourceManager()
param_manager = CategoryParameterManager()  # 使用CategoryParameterManager