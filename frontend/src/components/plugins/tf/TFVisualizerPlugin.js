import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import { tfManager } from '../../../services/TFManager';

// 可视化单个Frame的组件
const Frame = ({ frameId }) => {
  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      const frameData = tfManager.frames.get(frameId);
      console.log("in useFrame", frameId, frameData)
      if (frameData && frameData.transform) {
        const { translation, rotation } = frameData.transform;
        groupRef.current.position.copy(translation);
        groupRef.current.quaternion.copy(rotation);
        groupRef.current.visible = true;
      } else {
        // 如果在tfManager中找不到，可能是一个根节点或者数据还未到达
        const isRoot = !tfManager.frameHierarchy.has(frameId);
        if(isRoot) {
          groupRef.current.position.set(0,0,0);
          groupRef.current.quaternion.set(0,0,0,1);
          groupRef.current.visible = true;
        } else {
          groupRef.current.visible = false;
        }
      }
    }
  });

  const children = tfManager.getChildren(frameId);

  return (
    <group ref={groupRef}>
      <axesHelper args={[0.5]} />
      {/* 递归渲染子节点 */}
      {children.map(childId => (
        <Frame key={childId} frameId={childId} />
      ))}
    </group>
  );
};

// 渲染整个TF树的组件
const TFTree = () => {
  const [rootFrame, setRootFrame] = useState(tfManager.getRootFrame());

  // 这里我们不再使用setInterval，而是需要一种方式来监听tfManager的变化
  // 理想情况下tfManager应该是一个事件发射器
  // 作为一个简单的替代方案，我们可以在这里用一个定时器来强制刷新
  // 但更好的方式是让外部调用来触发更新
  useEffect(() => {
    const handleTFUpdate = () => {
      setRootFrame(tfManager.getRootFrame());
    };

    // 这是一个简化的事件监听，实际应用中需要一个更健壮的事件系统
    const interval = setInterval(handleTFUpdate, 1000); // 模拟数据更新的监听
    return () => clearInterval(interval);
  }, []);

  if (!rootFrame) return null;

  return <Frame frameId={rootFrame} />;
};

export class TFVisualizerPlugin extends VisualizationPlugin {
  constructor() {
    super('TF', 1, '1.0.0');
  }

  canHandle(topic, type, data) {
    return type === 'tf2_msgs/TFMessage';
  }

  render(topic, type, data, frameId) {
    return <TFTree key={`tf-tree-${Date.now()}`} />;
  }
}

export default new TFVisualizerPlugin();