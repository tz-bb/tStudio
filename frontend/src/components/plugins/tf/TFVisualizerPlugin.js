import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import { tfManager } from '../../../services/TFManager';
import { Text } from '@react-three/drei';

function ParentChildEdge({ parentId, childId, tfManager, config }) {
  const attrRef = useRef();
  const positions = useMemo(() => new Float32Array(6), []);

  useFrame(() => {
    const childData = tfManager.frames.get(childId);

    if (!attrRef.current || !childData || !childData.transform) return;
    const v = childData.transform.translation;

    attrRef.current.setXYZ(0, 0, 0, 0);
    attrRef.current.setXYZ(1, v.x, v.y, v.z);

    attrRef.current.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" array={positions} itemSize={3} count={2} />
      </bufferGeometry>
      <lineBasicMaterial color="#888888" linewidth={1} transparent opacity={config?.marker_alpha?.__value__ ?? 0.9} />
    </line>
  );
}

// 可视化单个Frame的组件
function Frame({ frameId, config, tfManager, isRoot = false }) {

  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      // 如果是根节点，我们需要将其定位到其绝对世界坐标
      if (isRoot) {
        const root = tfManager.getRootFrame();
        // 获取绝对变换 (仅针对根)
        const world = tfManager.getTransform(frameId, root);
        if (world) {
          groupRef.current.position.copy(world.position);
          groupRef.current.quaternion.copy(world.quaternion);
        }
      } else {
        // 子节点：使用相对于父节点的局部变换
        // 父组件已经在父节点的坐标系中了，所以这里只需要应用 local transform
        const frameData = tfManager.frames.get(frameId);
        if (frameData && frameData.transform) {
            const { translation, rotation } = frameData.transform;
            groupRef.current.position.copy(translation);
            groupRef.current.quaternion.copy(rotation);
        }
      }
      
      groupRef.current.visible = true;
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
        <React.Fragment key={`frag-${childId}`}>
          <ParentChildEdge parentId={frameId} childId={childId} tfManager={tfManager} config={config} />
          <Frame key={childId} frameId={childId} config={config} tfManager={tfManager} isRoot={false} />
        </React.Fragment>
      ))}
    </group>
  );
}

const TFWorldView = ({ config, tfManager }) => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handleTFUpdate = () => setVersion(v => v + 1);
    tfManager.on('update', handleTFUpdate);
    return () => tfManager.off('update', handleTFUpdate);
  }, [tfManager]);

  // Only render root frames to avoid duplication, as Frame component renders children recursively
  const rootFrames = useMemo(() => {
    const allFrames = tfManager.getAllFramesAsArray();
    const roots = allFrames.filter(f => !tfManager.frames.get(f).parent);
    return roots;
  }, [version, tfManager]);

  return (
    <group>
      {rootFrames.map(f => (
        <Frame key={`frame-${f}`} frameId={f} config={config} tfManager={tfManager} isRoot={true} />
      ))}
    </group>
  );
};

class TFVisualizerPlugin extends VisualizationPlugin {
  constructor() {
    super('TF', ["tf2_msgs/TFMessage", "tf2_msgs/msg/TFMessage"], 1, '1.0.0');
  }

  // eslint-disable-next-line class-methods-use-this
  render(topic, type, data, frameId, tfManager, config) {
    const displayConfig = config || TFVisualizerPlugin.getConfigTemplate();
    return <TFWorldView key="tf-world" config={displayConfig} tfManager={tfManager} />;
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
