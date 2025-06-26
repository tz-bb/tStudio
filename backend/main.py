from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Any

import sys, os
sys.path.append(".")
# 从 app_state 导入共享实例和回调所需的模块
from app_state import manager, data_source_manager

# --- FastAPI 应用实例 ---
app = FastAPI(title="tStudio backend")

# --- 中间件 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 数据回调 ---
async def on_data_received(topic: str, data: Any):
    """数据接收回调, 广播给所有WebSocket客户端"""
    await manager.broadcast({
        "type": "data_update",
        "topic": topic,
        "data": data
    })

data_source_manager.add_data_callback(on_data_received)

# --- API路由 ---
# 导入并包含各个模块的路由
from api import api_data, api_topics, api_params

app.include_router(api_data.router, prefix="/api", tags=["Data & Connection"])
app.include_router(api_topics.router, prefix="/api", tags=["Topics & WebSocket"])
app.include_router(api_params.router, prefix="/api/params", tags=["Parameters"])

# --- 启动 ---
if __name__ == "__main__":
    import uvicorn
    # 注意这里的启动方式，对于uvicorn，它会找到app对象
    uvicorn.run("main:app", host="0.0.0.0", port=3500, reload=True)