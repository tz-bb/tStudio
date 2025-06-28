import React, { createContext, useState, useEffect, useRef } from 'react';
import WebSocketManager from './WebSocketManager';
import { tfManager } from './TFManager';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, adapter: null, config: {}, subscribed_topics: [] });
  const [sceneData, setSceneData] = useState({});
  const [subscribedTopics, setSubscribedTopics] = useState(new Set());
  const subscribedTopicsRef = useRef(subscribedTopics);
  const [wsManager] = useState(() => new WebSocketManager());
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [tfFrames, setTfFrames] = useState(new Map());
  const [tfHierarchy, setTfHierarchy] = useState(new Map());

  useEffect(() => {
    subscribedTopicsRef.current = subscribedTopics;
  }, [subscribedTopics]);

  useEffect(() => {
    const handleConnectionStatus = (data) => setConnectionStatus(data);
    const handleDataUpdate = (message) => {
      if (message.topic === '/tf' || message.message_type === 'tf2_msgs/TFMessage') {
        tfManager.updateTF(message.data);
        setTfFrames(new Map(tfManager.frames));
        setTfHierarchy(new Map(tfManager.frameHierarchy));
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

    wsManager.on('connection_status', handleConnectionStatus);
    wsManager.on('data_update', handleDataUpdate);
    wsManager.on('topic_subscribed', handleTopicSubscribed);
    wsManager.on('topic_unsubscribed', handleTopicUnsubscribed);
    wsManager.on('websocket_connected', handleWebSocketConnected);
    wsManager.on('websocket_disconnected', handleWebSocketDisconnected);
    wsManager.on('websocket_error', handleWebSocketError);

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
    setSubscribedTopics
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};