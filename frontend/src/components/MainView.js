import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import ConnectionPanel from './ConnectionPanel';
import TopicPanel from './TopicPanel';
import Scene3D from './Scene3D';
import WebSocketManager from '../services/WebSocketManager';
import './MainView.css';

function MainView() {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    adapter: null,
    config: {},
    subscribed_topics: []
  });
  const [topics, setTopics] = useState([]);
  const [sceneData, setSceneData] = useState({});
  const [wsManager] = useState(() => new WebSocketManager());
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [debugInfo, setDebugInfo] = useState([]);

  // 添加调试信息
  const addDebugInfo = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [
      ...prev.slice(-9), // 保留最近10条
      { timestamp, message, type }
    ]);
    console.log(`[MainView] ${message}`);
  };

  useEffect(() => {
    console.log('[MainView] 组件初始化，设置WebSocket事件监听');
    
    // 设置WebSocket事件监听
    wsManager.on('connection_status', (data) => {
      console.log('[MainView] 收到连接状态更新:', data);
      setConnectionStatus(data);
      addDebugInfo(`连接状态更新: ${data.connected ? '已连接' : '未连接'}`);
    });
    
    wsManager.on('data_update', (data) => {
      console.log('[MainView] 收到数据更新:', data);
      setSceneData(prev => ({
        ...prev,
        [data.topic]: data.data
      }));
      addDebugInfo(`收到话题数据: ${data.topic}`);
    });
    
    wsManager.on('topic_subscribed', (data) => {
      console.log('[MainView] 话题订阅成功:', data.topic);
      addDebugInfo(`话题订阅成功: ${data.topic}`, 'success');
    });

    // WebSocket连接状态监听
    wsManager.on('websocket_connected', (data) => {
      setWsStatus('connected');
      addDebugInfo('WebSocket连接成功', 'success');
    });

    wsManager.on('websocket_disconnected', (data) => {
      setWsStatus('disconnected');
      addDebugInfo(`WebSocket连接断开: ${data.reason}`, 'warning');
    });

    wsManager.on('websocket_error', (data) => {
      setWsStatus('error');
      addDebugInfo(`WebSocket错误: ${data.error}`, 'error');
    });

    wsManager.on('websocket_max_reconnect_reached', () => {
      addDebugInfo('WebSocket重连次数达到上限', 'error');
    });

    // 连接WebSocket
    addDebugInfo('正在连接WebSocket...');
    wsManager.connect();

    // 定期检查WebSocket状态
    const statusInterval = setInterval(() => {
      const status = wsManager.getStatus();
      console.log('[MainView] WebSocket状态检查:', status);
    }, 10000);

    return () => {
      console.log('[MainView] 组件卸载，清理WebSocket连接');
      clearInterval(statusInterval);
      wsManager.disconnect();
    };
  }, [wsManager]);

  return (
    <div className="main-view">
      <div className="sidebar">
        {/* 调试信息面板 */}
        <div className="debug-panel">
          <h4>调试信息 <span className={`ws-status ${wsStatus}`}>{wsStatus}</span></h4>
          <div className="debug-log">
            {debugInfo.map((info, index) => (
              <div key={index} className={`debug-item ${info.type}`}>
                <span className="debug-time">{info.timestamp}</span>
                <span className="debug-message">{info.message}</span>
              </div>
            ))}
          </div>
        </div>
        
        <ConnectionPanel 
          connectionStatus={connectionStatus}
          wsManager={wsManager}
        />
        <TopicPanel 
          topics={topics}
          setTopics={setTopics}
          connectionStatus={connectionStatus}
          wsManager={wsManager}
        />
      </div>
      <div className="canvas-container">
        <Canvas
          camera={{ position: [10, 10, 10], fov: 60 }}
          style={{ background: '#1a1a1a' }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Scene3D data={sceneData} />
          <Grid args={[20, 20]} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          <Stats />
        </Canvas>
      </div>
    </div>
  );
}

export default MainView;