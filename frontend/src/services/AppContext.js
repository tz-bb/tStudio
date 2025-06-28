import React, { createContext, useState, useEffect, useRef, useContext } from 'react'; // Import useContext
import WebSocketManager from './WebSocketManager';
import { tfManager } from './TFManager';

export const AppContext = createContext();

// Export the hook for easy consumption
export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, adapter: null, config: {}, subscribed_topics: [] });
  const [sceneData, setSceneData] = useState({});
  const [subscribedTopics, setSubscribedTopics] = useState(new Set());
  const subscribedTopicsRef = useRef(subscribedTopics);
  const [wsManager] = useState(() => new WebSocketManager());
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [tfFrames, setTfFrames] = useState(new Map());
  const [tfHierarchy, setTfHierarchy] = useState(new Map());
  const [debugInfo, setDebugInfo] = useState([]); // Add debug info state

  // Add debug info function
  const addDebugInfo = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [
        { timestamp, message, type },
        ...prev.slice(0, 99) // Keep last 100 entries
    ]);
  };

  useEffect(() => {
    subscribedTopicsRef.current = subscribedTopics;
  }, [subscribedTopics]);

  useEffect(() => {
    const handleConnectionStatus = (data) => setConnectionStatus(data);
    const handleDataUpdate = (message) => {
      if (message.topic === '/tf' || message.topic === '/tf_static' || message.message_type === 'tf2_msgs/TFMessage') {
        tfManager.updateTF(message.data);
        setTfFrames(new Map(tfManager.frames));
        setTfHierarchy(new Map(tfManager.frameHierarchy));
      }
      if (message.topic === '/system_log') {
        addDebugInfo(message.data.message, message.data.level);
      }
      if (subscribedTopicsRef.current.has(message.topic)) {
        setSceneData(prev => ({ ...prev, [message.topic]: message }));
      }
    };
    const handleTopicSubscribed = (data) => setSubscribedTopics(prev => new Set([...prev, data.topic]));
    const handleTopicUnsubscribed = (data) => {
      setSubscribedTopics(prev => { const newSet = new Set(prev); newSet.delete(data.topic); return newSet; });
      setSceneData(prev => { const newSceneData = { ...prev }; delete newSceneData[data.topic]; return newSceneData; });
    };
    const handleWebSocketConnected = () => setWsStatus('connected');
    const handleWebSocketDisconnected = () => setWsStatus('disconnected');
    const handleWebSocketError = () => setWsStatus('error');

    // Add these handlers
    const handleSystemMessage = (data) => {
      addDebugInfo(data.message, data.level || 'info');
    };

    const handleHeartbeat = (data) => {
      // Optional: log heartbeat to confirm connection is alive
      // console.log('Heartbeat received:', data);
    };

    wsManager.on('connection_status', handleConnectionStatus);
    wsManager.on('data_update', handleDataUpdate);
    wsManager.on('topic_subscribed', handleTopicSubscribed);
    wsManager.on('topic_unsubscribed', handleTopicUnsubscribed);
    wsManager.on('websocket_connected', handleWebSocketConnected);
    wsManager.on('websocket_disconnected', handleWebSocketDisconnected);
    wsManager.on('websocket_error', handleWebSocketError);

    // Register new listeners
    wsManager.on('system_message', handleSystemMessage);
    wsManager.on('heartbeat', handleHeartbeat);

    wsManager.connect();

    return () => {
      wsManager.disconnect();
    };
  }, [wsManager]);

  const value = {
    connectionStatus,
    sceneData,
    subscribedTopics,
    wsManager,
    wsStatus,
    tfFrames,
    tfHierarchy,
    setSubscribedTopics,
    debugInfo,      // Expose debug info
    addDebugInfo,   // Expose function
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};