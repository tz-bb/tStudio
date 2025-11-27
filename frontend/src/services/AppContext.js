import React, { createContext, useState, useEffect, useRef, useContext } from 'react'; // Import useContext
import WebSocketManager from './WebSocketManager';
import { tfManager } from './TFManager';

export const AppContext = createContext();

// Export the hook for easy consumption
export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, adapter: null, config: {}, subscribed_topics: [] });
  const [sceneData, setSceneData] = useState({});
  const [topics, setTopics] = useState([]);
  const [subscribedTopics, setSubscribedTopics] = useState(new Set());
  const subscribedTopicsRef = useRef(subscribedTopics);
  const [wsManager] = useState(() => new WebSocketManager());
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [tfFrames, setTfFrames] = useState(new Map());
  const [tfHierarchy, setTfHierarchy] = useState(new Map());
  const [debugInfo, setDebugInfo] = useState([]); // Add debug info state
  const [scenePluginTemplates, setScenePluginTemplates] = useState([]);
  const [scenePluginsInitialized, setScenePluginsInitialized] = useState(false);
  const [vizConfigs, setVizConfigs] = useState({}); // Initialize with null
  const [topicDataCounts, setTopicDataCounts] = useState(new Map());

  // Add debug info function with message aggregation
  const addDebugInfo = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => {
      if (prev.length > 0 && prev[0].message === message && prev[0].type === type) {
        const newFirst = { ...prev[0], count: prev[0].count + 1, timestamp };
        return [newFirst, ...prev.slice(1)];
      }
      return [
        { timestamp, message, type, count: 1 },
        ...prev.slice(0, 99) // Keep last 100 unique entries
      ];
    });
  };

  useEffect(() => {
    subscribedTopicsRef.current = subscribedTopics;
  }, [subscribedTopics]);

  useEffect(() => {
    const handleConnectionStatus = (data) => {
      setConnectionStatus(data);
      // Sync subscribed topics from server snapshot (covers default /tf, /tf_static)
      if (Array.isArray(data.subscribed_topics)) {
        const initialSet = new Set(data.subscribed_topics);
        setSubscribedTopics(initialSet);
        setTopicDataCounts(prev => {
          const m = new Map(prev);
          data.subscribed_topics.forEach(t => { if (!m.has(t)) m.set(t, 0); });
          return m;
        });
      }
      addDebugInfo(`Connection status updated: ${data.connected ? 'Connected' : 'Disconnected'} to ${data.adapter}`, 'system');
    };
    const handleDataUpdate = (message) => {
      if (message.topic === '/tf' || message.topic === '/tf_static' || message.message_type === 'tf2_msgs/TFMessage') {
        tfManager.updateTF(message.data);
        setTfFrames(new Map(tfManager.frames));
        setTfHierarchy(new Map(tfManager.frameHierarchy));
      }
      if (['/system_log','/rosout'].includes(message.topic)) {
        addDebugInfo(message.data.message, message.data.level);
      } else if (subscribedTopicsRef.current.has(message.topic)) {
        setSceneData(prev => ({ ...prev, [message.topic]: message }));
        setTopicDataCounts(prev => {
          const m = new Map(prev);
          m.set(message.topic, (m.get(message.topic) || 0) + 1);
          return m;
        });
      } else {
        addDebugInfo(`Data received on topic: ${message.topic}`, 'data');
      }
    };
    const handleTopicSubscribed = (data) => {
      setSubscribedTopics(prev => new Set([...prev, data.topic]));
      setTopicDataCounts(prev => {
        const m = new Map(prev);
        if (!m.has(data.topic)) m.set(data.topic, 0);
        return m;
      });
      addDebugInfo(`Subscribed to topic: ${data.topic}`, 'system');
    };
    const handleTopicUnsubscribed = (data) => {
      setSubscribedTopics(prev => { const newSet = new Set(prev); newSet.delete(data.topic); return newSet; });
      setSceneData(prev => { const newSceneData = { ...prev }; delete newSceneData[data.topic]; return newSceneData; });
      setTopicDataCounts(prev => {
        const m = new Map(prev);
        m.delete(data.topic);
        return m;
      });
      addDebugInfo(`Unsubscribed from topic: ${data.topic}`, 'system');
    };
    const handleWebSocketConnected = () => {
      setWsStatus('connected');
      addDebugInfo('WebSocket connected', 'success');
    };
    const handleWebSocketDisconnected = () => {
      setWsStatus('disconnected');
      addDebugInfo('WebSocket disconnected', 'warning');
      setTopicDataCounts(new Map());
    };
    const handleWebSocketError = () => {
      setWsStatus('error');
      addDebugInfo('WebSocket error', 'error');
    };

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
    topics,
    setTopics,
    subscribedTopics,
    wsManager,
    wsStatus,
    tfFrames,
    tfHierarchy,
    setSubscribedTopics,
    debugInfo,      // Expose debug info
    addDebugInfo,   // Expose function
    scenePluginTemplates,
    setScenePluginTemplates,
    scenePluginsInitialized,
    setScenePluginsInitialized,
    vizConfigs,       // Expose viz configs
    setVizConfigs,  // Expose set function directly
    topicDataCounts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
