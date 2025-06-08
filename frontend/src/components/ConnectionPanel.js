import React, { useState } from 'react';
import ApiService from '../services/ApiService';
import './ConnectionPanel.css';

function ConnectionPanel({ connectionStatus, wsManager }) {
  const [adapters, setAdapters] = useState([]);
  const [selectedAdapter, setSelectedAdapter] = useState('mock');
  const [config, setConfig] = useState({
    host: 'localhost',
    port: 9090,
    update_interval: 0.1
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    loadAdapters();
  }, []);

  const loadAdapters = async () => {
    try {
      const response = await ApiService.getAdapters();
      setAdapters(response.adapters);
    } catch (error) {
      console.error('Failed to load adapters:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      await ApiService.connect(selectedAdapter, config);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('连接失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await ApiService.disconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connection-panel">
      <h3>数据源连接</h3>
      
      <div className="status">
        <span className={`status-indicator ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
          {connectionStatus.connected ? '已连接' : '未连接'}
        </span>
        {connectionStatus.connected && (
          <span className="adapter-name">{connectionStatus.adapter}</span>
        )}
      </div>

      {!connectionStatus.connected && (
        <div className="connection-form">
          <div className="form-group">
            <label>适配器类型:</label>
            <select 
              value={selectedAdapter} 
              onChange={(e) => setSelectedAdapter(e.target.value)}
            >
              {adapters.map(adapter => (
                <option key={adapter} value={adapter}>{adapter}</option>
              ))}
            </select>
          </div>

          {selectedAdapter === 'ros1' && (
            <>
              <div className="form-group">
                <label>主机:</label>
                <input 
                  type="text" 
                  value={config.host} 
                  onChange={(e) => setConfig({...config, host: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>端口:</label>
                <input 
                  type="number" 
                  value={config.port} 
                  onChange={(e) => setConfig({...config, port: parseInt(e.target.value)})}
                />
              </div>
            </>
          )}

          {selectedAdapter === 'mock' && (
            <div className="form-group">
              <label>更新间隔 (秒):</label>
              <input 
                type="number" 
                step="0.1" 
                value={config.update_interval} 
                onChange={(e) => setConfig({...config, update_interval: parseFloat(e.target.value)})}
              />
            </div>
          )}

          <button 
            onClick={handleConnect} 
            disabled={loading}
            className="connect-btn"
          >
            {loading ? '连接中...' : '连接'}
          </button>
        </div>
      )}

      {connectionStatus.connected && (
        <button 
          onClick={handleDisconnect} 
          disabled={loading}
          className="disconnect-btn"
        >
          {loading ? '断开中...' : '断开连接'}
        </button>
      )}
    </div>
  );
}

export default ConnectionPanel;