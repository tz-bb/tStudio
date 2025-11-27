import React, { useState, useEffect, useContext } from 'react'; // Import useContext
import ApiService from '../services/ApiService';
import './TopicPanel.css';
import { AppContext } from '../services/AppContext'; // Import AppContext

function TopicPanel({ connectionStatus, wsManager }) {
  const { topics, setTopics, subscribedTopics, setSubscribedTopics, topicDataCounts } = useContext(AppContext); // Use context
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (connectionStatus.connected) {
      loadTopics();
      // Subscribed topics are now managed by AppContext, no need to set them here from connectionStatus
    } else {
      setTopics([]);
      setSubscribedTopics(new Set()); // Clear topics in context on disconnect
    }
  }, [connectionStatus, setTopics, setSubscribedTopics]); // Add setTopics to dependency array

  const loadTopics = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getTopics();
      setTopics(response.topics);
    } catch (error) {
      console.error('Failed to load topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (topic, messageType) => {
    try {
      await ApiService.subscribeTopic(topic, messageType);
      const status = await ApiService.getConnectionStatus();
      if (Array.isArray(status.subscribed_topics)) {
        setSubscribedTopics(new Set(status.subscribed_topics));
      }
      // No longer need to call setSubscribedTopics, as it's handled by the WebSocket event in AppContext
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('订阅失败: ' + error.message);
    }
  };

  const handleUnsubscribe = async (topic) => {
    try {
      await ApiService.unsubscribeTopic(topic);
      const status = await ApiService.getConnectionStatus();
      if (Array.isArray(status.subscribed_topics)) {
        setSubscribedTopics(new Set(status.subscribed_topics));
      }
      // No longer need to call setSubscribedTopics, as it's handled by the WebSocket event in AppContext
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      alert('取消订阅失败: ' + error.message);
    }
  };

  return (
    <div className="topic-panel">
      <h3>话题管理</h3>
      
      {connectionStatus.connected && (
        <button onClick={loadTopics} disabled={loading} className="refresh-btn">
          {loading ? '刷新中...' : '刷新话题'}
        </button>
      )}

      <div className="topics-list">
        {topics.map((topic, index) => (
          <div key={index} className="topic-item">
            <div className="topic-grid">
              <div className="topic-left">
                <div className="topic-name">{topic.name}</div>
                <div className="topic-type">{topic.type}</div>
              </div>
              <div className="topic-right">
                {subscribedTopics.has(topic.name) && (
                  <div className="topic-count-badge" title="接收数据次数">
                    {topicDataCounts.get(topic.name) || 0}
                  </div>
                )}
                <div className="topic-actions">
                  {subscribedTopics.has(topic.name) ? (
                    <button 
                      onClick={() => handleUnsubscribe(topic.name)}
                      className="unsubscribe-btn"
                    >
                      取消订阅
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSubscribe(topic.name, topic.type)}
                      className="subscribe-btn"
                    >
                      订阅
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {topics.length === 0 && connectionStatus.connected && !loading && (
        <div className="no-topics">没有可用的话题</div>
      )}
    </div>
  );
}

export default TopicPanel;
