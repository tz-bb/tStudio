import React, { useState, useEffect } from 'react';
import { tfManager } from '../services/TFManager';
import './TFPanel.css';

function TFPanel() {
  const [frames, setFrames] = useState(new Map());
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [manualTransform, setManualTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });

  useEffect(() => {
    const updateFrames = () => {
      setFrames(new Map(tfManager.frames));
    };

    // 定期更新frame信息
    const interval = setInterval(updateFrames, 100);
    return () => clearInterval(interval);
  }, []);

  const handleFrameSelect = (frameId) => {
    setSelectedFrame(frameId);
    const frameObject = tfManager.getFrameObject(frameId);
    if (frameObject) {
      setManualTransform({
        position: {
          x: frameObject.position.x,
          y: frameObject.position.y,
          z: frameObject.position.z
        },
        rotation: {
          x: frameObject.rotation.x,
          y: frameObject.rotation.y,
          z: frameObject.rotation.z
        }
      });
    }
  };

  const handleTransformChange = (type, axis, value) => {
    const newTransform = {
      ...manualTransform,
      [type]: {
        ...manualTransform[type],
        [axis]: parseFloat(value)
      }
    };
    setManualTransform(newTransform);

    // 应用变换到场景对象
    if (selectedFrame) {
      const frameObject = tfManager.getFrameObject(selectedFrame);
      if (frameObject) {
        frameObject.position.set(
          newTransform.position.x,
          newTransform.position.y,
          newTransform.position.z
        );
        frameObject.rotation.set(
          newTransform.rotation.x,
          newTransform.rotation.y,
          newTransform.rotation.z
        );
      }
    }
  };

  const renderFrameTree = (frameId, level = 0) => {
    const children = Array.from(tfManager.frameHierarchy.entries())
      .filter(([child, parent]) => parent === frameId)
      .map(([child]) => child);

    return (
      <div key={frameId} style={{ marginLeft: level * 20 }}>
        <div 
          className={`frame-item ${selectedFrame === frameId ? 'selected' : ''}`}
          onClick={() => handleFrameSelect(frameId)}
        >
          📍 {frameId}
        </div>
        {children.map(child => renderFrameTree(child, level + 1))}
      </div>
    );
  };

  const rootFrames = Array.from(frames.keys())
    .filter(frameId => !tfManager.frameHierarchy.has(frameId));

  return (
    <div className="tf-panel">
      <h3>TF树结构</h3>
      
      <div className="frame-tree">
        {rootFrames.map(frameId => renderFrameTree(frameId))}
      </div>

      {selectedFrame && (
        <div className="transform-controls">
          <h4>Frame: {selectedFrame}</h4>
          
          <div className="control-group">
            <label>位置 (Position)</label>
            <div className="xyz-controls">
              <input
                type="number"
                step="0.1"
                value={manualTransform.position.x}
                onChange={(e) => handleTransformChange('position', 'x', e.target.value)}
                placeholder="X"
              />
              <input
                type="number"
                step="0.1"
                value={manualTransform.position.y}
                onChange={(e) => handleTransformChange('position', 'y', e.target.value)}
                placeholder="Y"
              />
              <input
                type="number"
                step="0.1"
                value={manualTransform.position.z}
                onChange={(e) => handleTransformChange('position', 'z', e.target.value)}
                placeholder="Z"
              />
            </div>
          </div>

          <div className="control-group">
            <label>旋转 (Rotation)</label>
            <div className="xyz-controls">
              <input
                type="number"
                step="0.1"
                value={manualTransform.rotation.x}
                onChange={(e) => handleTransformChange('rotation', 'x', e.target.value)}
                placeholder="X"
              />
              <input
                type="number"
                step="0.1"
                value={manualTransform.rotation.y}
                onChange={(e) => handleTransformChange('rotation', 'y', e.target.value)}
                placeholder="Y"
              />
              <input
                type="number"
                step="0.1"
                value={manualTransform.rotation.z}
                onChange={(e) => handleTransformChange('rotation', 'z', e.target.value)}
                placeholder="Z"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TFPanel;