import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import ConnectionPanel from './ConnectionPanel';
import TopicPanel from './TopicPanel';
import Scene3D from './Scene3D';
import WebSocketManager from '../services/WebSocketManager';
import './MainView.css';
import TextDataPanel from './TextDataPanel';
import TFPanel from './TFPanel';
import { tfManager } from '../services/TFManager';

const MainView = () => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    adapter: null,
    config: {},
    subscribed_topics: []
  });
  const [topics, setTopics] = useState([]);
  const [sceneData, setSceneData] = useState({});
  const [subscribedTopics, setSubscribedTopics] = useState(new Set());
  const subscribedTopicsRef = useRef(subscribedTopics);
  const [wsManager] = useState(() => new WebSocketManager());
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [debugInfo, setDebugInfo] = useState([]);
  const [tfFrames, setTfFrames] = useState(new Map());
  const [tfHierarchy, setTfHierarchy] = useState(new Map());

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
    subscribedTopicsRef.current = subscribedTopics;
  }, [subscribedTopics]);

  useEffect(() => {
    console.log('[MainView] 组件初始化，设置WebSocket事件监听');
    
    // 定义事件处理函数
    const handleConnectionStatus = (data) => {
      console.log('[MainView] 收到连接状态更新:', data);
      setConnectionStatus(data);
      addDebugInfo(`连接状态更新: ${data.connected ? '已连接' : '未连接'}`);
    };
    
    const handleDataUpdate = (message) => { // 参数从 data 改为 message
      // 检查是否为TF数据
      // 使用 message.topic 和 message.message_type
      if (message.topic === '/tf' || message.message_type === 'tf2_msgs/TFMessage') {
        tfManager.updateTF(message.data);
        // 从tfManager获取最新状态并更新React state
        setTfFrames(new Map(tfManager.frames));
        setTfHierarchy(new Map(tfManager.frameHierarchy));
        return;
      }
      
      // 检查topic是否仍在订阅状态
      console.log(`in handleDataUpdate - ${JSON.stringify(message)}`)
      if (!subscribedTopicsRef.current.has(message.topic)) {
        console.log(`忽略已取消订阅topic的数据: ${message.topic}`);
        return;
      }
      
      setSceneData(prev => ({
        ...prev,
        [message.topic]: message // 使用完整的 message 对象
      }));
      addDebugInfo(`收到话题数据: ${message.topic}`);
    };
    
    const handleTopicSubscribed = (data) => {
      setSubscribedTopics(prev => new Set([...prev, data.topic])); // 添加到订阅列表
      addDebugInfo(`话题订阅成功: ${data.topic}`, 'success');
    };

    const handleTopicUnsubscribed = (data) => {
      console.log('[MainView] 话题取消订阅:', data.topic);
      // 先从订阅列表中移除
      setSubscribedTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.topic);
        return newSet;
      });
      
      // 然后清空数据
      setSceneData(prev => {
        const newSceneData = { ...prev };
        delete newSceneData[data.topic];
        return newSceneData;
      });
      
      addDebugInfo(`话题取消订阅: ${data.topic}`, 'warning');
    };

    const handleWebSocketConnected = (data) => {
      setWsStatus('connected');
      addDebugInfo('WebSocket连接成功', 'success');
    };

    const handleHeartbeat = () => {
      addDebugInfo('收到心跳响应');
    };

    const handleWebSocketDisconnected = (data) => {
      setWsStatus('disconnected');
      addDebugInfo(`WebSocket连接断开: ${data.reason}`, 'warning');
    };

    const handleWebSocketError = (data) => {
      setWsStatus('error');
      addDebugInfo(`WebSocket错误: ${data.error}`, 'error');
    };

    const handleMaxReconnectReached = () => {
      addDebugInfo('WebSocket重连次数达到上限', 'error');
    };

    const handleSystemMsg = (data) => {
      addDebugInfo(`系统消息: ${data.message}`, 'info');
    };
    
    // 注册事件监听器
    wsManager.on('connection_status', handleConnectionStatus);
    wsManager.on('data_update', handleDataUpdate);
    wsManager.on('topic_subscribed', handleTopicSubscribed);
    wsManager.on('topic_unsubscribed', handleTopicUnsubscribed);
    wsManager.on('websocket_connected', handleWebSocketConnected);
    wsManager.on('heartbeat', handleHeartbeat);
    wsManager.on('websocket_disconnected', handleWebSocketDisconnected);
    wsManager.on('websocket_error', handleWebSocketError);
    wsManager.on('websocket_max_reconnect_reached', handleMaxReconnectReached);
    wsManager.on('system_message', handleSystemMsg);

    // 连接WebSocket
    addDebugInfo('正在连接WebSocket...');
    wsManager.connect();

    // 定期检查WebSocket状态
    const statusInterval = setInterval(() => {
      const status = wsManager.getStatus();
    }, 10000);

    return () => {
      console.log('[MainView] 组件卸载，清理WebSocket连接');
      
      // 移除所有事件监听器
      wsManager.off('connection_status', handleConnectionStatus);
      wsManager.off('data_update', handleDataUpdate);
      wsManager.off('topic_subscribed', handleTopicSubscribed);
      wsManager.off('topic_unsubscribed', handleTopicUnsubscribed);
      wsManager.off('websocket_connected', handleWebSocketConnected);
      wsManager.off('heartbeat', handleHeartbeat);
      wsManager.off('websocket_disconnected', handleWebSocketDisconnected);
      wsManager.off('websocket_error', handleWebSocketError);
      wsManager.off('websocket_max_reconnect_reached', handleMaxReconnectReached);
      wsManager.off('system_message', handleSystemMsg);
      
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
        
        {/* 添加TF面板，并通过props传递状态和回调 */}
        <TFPanel 
          frames={tfFrames}
          hierarchy={tfHierarchy}
        />
        
        {/* 新增文本数据面板 */}
        {/* <TextDataPanel sceneData={sceneData} /> */}
      </div>
      <div className="canvas-container">
        <Canvas
          camera={{ position: [10, 10, 10], fov: 60 }}
          style={{ background: '#1a1a1a' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[15, 15, 5]} intensity={1} />
          <directionalLight position={[-15, -15, 5]} intensity={1} />
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