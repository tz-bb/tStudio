import React, { useState, useEffect } from 'react';
import ApiService from '../services/ApiService';
import './ConnectionPanel.css';

function ConnectionPanel({ connectionStatus, wsManager }) {
  const [adapters, setAdapters] = useState([]);
  const [adapterConfigs, setAdapterConfigs] = useState({});
  const [selectedAdapter, setSelectedAdapter] = useState('mock');
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdapters();
  }, []);

  useEffect(() => {
    // 当选择的适配器改变时，重置配置为默认值
    if (selectedAdapter && adapterConfigs[selectedAdapter]) {
      const schema = adapterConfigs[selectedAdapter].config_schema;
      const defaultConfig = {};
      schema.fields.forEach(field => {
        defaultConfig[field.name] = field.default;
      });
      setConfig(defaultConfig);
    }
  }, [selectedAdapter, adapterConfigs]);

  const loadAdapters = async () => {
    try {
      const response = await ApiService.getAdapters();
      setAdapters(response.adapters);
      setAdapterConfigs(response.adapter_configs);
      
      // 设置默认选择的适配器
      if (response.adapters.length > 0) {
        setSelectedAdapter(response.adapters[0]);
      }
    } catch (error) {
      console.error('Failed to load adapters:', error);
    }
  };

  const handleConfigChange = (fieldName, value) => {
    setConfig(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const renderConfigField = (field) => {
    const value = config[field.name] ?? field.default;
    
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => handleConfigChange(field.name, e.target.value)}
            required={field.required}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => handleConfigChange(field.name, parseFloat(e.target.value))}
            required={field.required}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleConfigChange(field.name, e.target.value)}
            required={field.required}
          />
        );
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

  const currentAdapterConfig = adapterConfigs[selectedAdapter];

  return (
    <div className="connection-panel">
      <h3>数据源连接</h3>
      
      <div className="status">
        <span className={`status-indicator ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
          {connectionStatus.connected ? '已连接' : '未连接'}
        </span>
        {connectionStatus.connected && (
          <span className="adapter-name">
            {adapterConfigs[connectionStatus.adapter]?.display_name || connectionStatus.adapter}
          </span>
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
                <option key={adapter} value={adapter}>
                  {adapterConfigs[adapter]?.display_name || adapter}
                </option>
              ))}
            </select>
          </div>

          {currentAdapterConfig?.description && (
            <div className="adapter-description">
              <small>{currentAdapterConfig.description}</small>
            </div>
          )}

          {currentAdapterConfig?.config_schema?.fields?.map(field => (
            <div key={field.name} className="form-group">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              {renderConfigField(field)}
            </div>
          ))}

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