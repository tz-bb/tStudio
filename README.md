# tStudio 简易启动指南

tStudio 包含一个 React 前端与一个 FastAPI 后端。最简方式如下。

## 前置条件
- 已安装 `Node.js >= 18` 与 `npm`
- 已安装 `Python >= 3.10` 与 `pip`
- 已安装 `make`

## 一键安装
在项目根目录运行：

```
make install
```

该命令会：
- 在 `frontend/` 执行 `npm install`
- 在 `backend/` 执行 `pip install -r requirements.txt`

## 一键启动（开发模式）

```
make dev
```

启动后：
- 前端开发服务器：`http://localhost:3000/`
- 后端 API：`http://localhost:3500/`（示例：`http://localhost:3500/api/params/...`）
- 后端 WebSocket：`ws://localhost:3500/api/ws`

前端会直接请求后端的 `3500` 端口，无需额外代理。

## 手动启动（可选）

1) 后端：

```
cd backend
pip install -r requirements.txt
python main.py
```

后端默认监听 `0.0.0.0:3500` 并启用热重载。

2) 前端：

```
cd frontend
npm install
npm start
```

前端默认在 `http://localhost:3000/` 启动。

## 可选配置
- 覆盖前端调用的 API 根地址：设置环境变量 `REACT_APP_API_URL`（默认：`http://localhost:3500/api/params`）。

示例：

```
REACT_APP_API_URL=http://<your-host>:3500/api/params npm start
```

## 清理

```
make clean
```

## 参考位置
- 启动脚本：`tStudio/Makefile`
- 后端端口：`tStudio/backend/main.py`（`uvicorn.run(..., port=3500)`）
- 前端脚本：`tStudio/frontend/package.json`（`npm start`）
- 前端 API 默认地址：`tStudio/frontend/src/services/ParameterService.js`（`REACT_APP_API_URL`）
- 前端 WebSocket 默认地址：`tStudio/frontend/src/services/WebSocketManager.js`（`ws://localhost:3500/api/ws`）

