import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import { tfManager } from '../../../services/TFManager';
import { Text } from '@react-three/drei';

// 可视化单个Frame的组件
function Frame({ frameId, config, tfManager }) {

  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      const frameData = tfManager.frames.get(frameId);
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
      <axesHelper args={[config?.marker_scale?.__value__ ?? 0.5]} visible={!!config?.show_axes?.__value__} />
      <Text
        position={[0, 0.1, 0]} // Position text slightly above the origin
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
        visible={!!config?.show_names?.__value__}
      >
        {frameId}
      </Text>

      {children.map(childId => (
        <Frame key={childId} frameId={childId} config={config} tfManager={tfManager} />
      ))}
    </group>
  );
}

// 渲染整个TF树的组件
const TFTree = ({ config, tfManager }) => {
  const [rootFrame, setRootFrame] = useState(tfManager.getRootFrame());

  useEffect(() => {
    const handleTFUpdate = () => {
      // 强制组件重新渲染以获取最新的根节点和层级结构
      setRootFrame(tfManager.getRootFrame());
    };

    // 监听tfManager的更新事件
    tfManager.on('update', handleTFUpdate);

    // 组件卸载时移除监听
    return () => {
      tfManager.off('update', handleTFUpdate);
    };
  }, [tfManager]); // 依赖项更新为 tfManager

  if (!rootFrame) return null;

  return <Frame frameId={rootFrame} config={config} tfManager={tfManager} />;
};

class TFVisualizerPlugin extends VisualizationPlugin {
  constructor() {
    super('TF', ["tf2_msgs/TFMessage", "tf2_msgs/msg/TFMessage"], 1, '1.0.0');
  }

  // eslint-disable-next-line class-methods-use-this
  render(topic, type, data, frameId, tfManager, config) {
    // 如果没有提供config，使用默认模板
    const displayConfig = config || TFVisualizerPlugin.getConfigTemplate();
    return <TFTree key="tf-tree" config={displayConfig} tfManager={tfManager} />;
  }

  static getConfigTemplate() {
    return {
      show_names: {
        __value__: true,
        __metadata__: { type: 'boolean' },
      },
      show_axes: {
        __value__: true,
        __metadata__: { type: 'boolean' },
      },
      show_arrows: {
        __value__: true,
        __metadata__: { type: 'boolean' },
      },
      marker_scale: {
        __value__: 0.5,
        __metadata__: { type: 'number', min: 0.1, max: 5, step: 0.1 },
      },
      marker_alpha: {
        __value__: 0.9,
        __metadata__: { type: 'number', min: 0.1, max: 1.0, step: 0.1 },
      },
    };
  }
}

export default new TFVisualizerPlugin();