import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tfManager } from '../services/TFManager'; // 仍然需要它来修改3D对象
import './TFPanel.css';
import { useAppContext } from '../services/AppContext';

// 渲染TF树的递归组件
const FrameNode = React.memo(({ frameId, hierarchy, level, onSelect, selectedFrame }) => {
  const children = useMemo(() => 
    Array.from(hierarchy.entries())
      .filter(([, parent]) => parent === frameId)
      .map(([child]) => child),
    [hierarchy, frameId]
  );

  return (
    <div style={{ marginLeft: level * 20 }}>
      <div 
        className={`frame-item ${selectedFrame === frameId ? 'selected' : ''}`}
        onClick={() => onSelect(frameId)}
      >
        📍 {frameId}
      </div>
      {children.map(child => (
        <FrameNode 
          key={child} 
          frameId={child} 
          hierarchy={hierarchy} 
          level={level + 1} 
          onSelect={onSelect} 
          selectedFrame={selectedFrame} 
        />
      ))}
    </div>
  );
});

function TFPanel() {
  const { tfFrames: frames, tfHierarchy: hierarchy } = useAppContext();
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [manualTransform, setManualTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }, // 使用四元数更准确
  });

  // 当选择的frame变化时，更新面板上的显示值
  useEffect(() => {
    if (selectedFrame) {
      const frameObject = tfManager.getFrameObject(selectedFrame);
      if (frameObject) {
        setManualTransform({
          position: { ...frameObject.position },
          rotation: { ...frameObject.quaternion },
        });
      }
    } else {
      // 重置
      setManualTransform({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
    }
  }, [selectedFrame]);

  const handleFrameSelect = useCallback((frameId) => {
    setSelectedFrame(frameId);
  }, []);

  // 当手动修改输入框时
  const handleTransformChange = (type, axis, value) => {
    const parsedValue = parseFloat(value) || 0;
    const newTransform = {
      ...manualTransform,
      [type]: {
        ...manualTransform[type],
        [axis]: parsedValue,
      },
    };
    setManualTransform(newTransform);

    // 直接应用变换到场景对象
    if (selectedFrame) {
      const frameObject = tfManager.getFrameObject(selectedFrame);
      if (frameObject) {
        frameObject.position.set(
          newTransform.position.x,
          newTransform.position.y,
          newTransform.position.z
        );
        // 注意：这里直接设置四元数，如果输入是欧拉角需要转换
        // 为简单起见，我们假设直接输入四元数或位置
        if (type === 'rotation') {
            frameObject.quaternion.set(
                newTransform.rotation.x,
                newTransform.rotation.y,
                newTransform.rotation.z,
                newTransform.rotation.w
            );
        }
      }
    }
  };

  const rootFrames = useMemo(() => 
    Array.from(frames.keys())
      .filter(frameId => !hierarchy.has(frameId)),
    [frames, hierarchy]
  );

  if (frames.size === 0) {
    return <div style={{ padding: '10px', color: '#888' }}>No TF data received.</div>;
  }

  return (
    <div className="tf-panel">
      <h3>TF树结构</h3>
      
      <div className="frame-tree">
        {rootFrames.map(frameId => (
          <FrameNode 
            key={frameId} 
            frameId={frameId} 
            hierarchy={hierarchy} 
            level={0} 
            onSelect={handleFrameSelect} 
            selectedFrame={selectedFrame} 
          />
        ))}
      </div>

      {selectedFrame && (
        <div className="transform-controls">
          <h4>Frame: {selectedFrame}</h4>
          
          <div className="control-group">
            <label>位置 (Position)</label>
            <div className="xyz-controls">
              {['x', 'y', 'z'].map(axis => (
                <input
                  key={axis}
                  type="number"
                  step="0.1"
                  value={manualTransform.position[axis]}
                  onChange={(e) => handleTransformChange('position', axis, e.target.value)}
                  placeholder={axis.toUpperCase()}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label>旋转 (Quaternion)</label>
            <div className="xyz-controls">
              {['x', 'y', 'z', 'w'].map(axis => (
                <input
                  key={axis}
                  type="number"
                  step="0.1"
                  value={manualTransform.rotation[axis]}
                  onChange={(e) => handleTransformChange('rotation', axis, e.target.value)}
                  placeholder={axis.toUpperCase()}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TFPanel;