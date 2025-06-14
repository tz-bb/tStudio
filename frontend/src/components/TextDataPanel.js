import React, { useState, useEffect } from 'react';
import './TextDataPanel.css';

function TextDataPanel({ sceneData }) {
  const [textTopics, setTextTopics] = useState({});

  useEffect(() => {
    // 过滤出文本类型的话题数据
    const textData = {};
    Object.keys(sceneData).forEach(topic => {
      const data = sceneData[topic];
      if (data && (data.message_type?.includes('String') || 
                   data.message_type?.includes('std_msgs') ||
                   typeof data.data === 'string' ||
                   (data.data && typeof data.data.data === 'string'))) {
        textData[topic] = data;
      }
    });
    setTextTopics(textData);
  }, [sceneData]);

  return (
    <div className="text-data-panel">
      <h3>文本信息</h3>
      <div className="text-topics-list">
        {Object.keys(textTopics).length === 0 ? (
          <div className="no-text-data">暂无文本数据</div>
        ) : (
          Object.entries(textTopics).map(([topic, data]) => (
            <div key={topic} className="text-topic-item">
              <div className="topic-header">
                <span className="topic-name">{topic}</span>
                <span className="message-type">{data.message_type}</span>
              </div>
              <div className="text-content">
                {typeof data.data === 'string' ? data.data : 
                 data.data?.data || JSON.stringify(data.data, null, 2)}
              </div>
              <div className="timestamp">
                {new Date(data.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TextDataPanel;