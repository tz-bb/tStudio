import React, { useState } from 'react';
import './SaveLayoutDialog.css';

const SaveLayoutDialog = ({ isOpen, onClose, onSave, existingLayouts = [] }) => {
  const [layoutName, setLayoutName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!layoutName.trim()) {
      setError('请输入布局名称');
      return;
    }
    
    // 检查是否与现有布局重名
    if (existingLayouts.includes(layoutName.trim())) {
      if (!window.confirm(`布局 "${layoutName}" 已存在，是否覆盖？`)) {
        return;
      }
    }
    
    onSave(layoutName.trim());
    setLayoutName('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setLayoutName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h3>保存布局</h3>
        <div className="dialog-body">
          <label htmlFor="layout-name">布局名称:</label>
          <input
            id="layout-name"
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSave()}
            placeholder="输入布局名称"
            autoFocus
          />
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button onClick={handleClose} className="btn-cancel">取消</button>
          <button onClick={handleSave} className="btn-save">保存</button>
        </div>
      </div>
    </div>
  );
};

export default SaveLayoutDialog;