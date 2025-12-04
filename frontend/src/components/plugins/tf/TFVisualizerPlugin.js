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
function Frame({ frameId, config, tfManager }) {

  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      const root = tfManager.getRootFrame();
      const world = tfManager.getTransform(frameId, root);
      if (world) {
        groupRef.current.position.copy(world.position);
        groupRef.current.quaternion.copy(world.quaternion);
        groupRef.current.visible = true;
      } else {
        groupRef.current.visible = false;
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
        <React.Fragment key={`frag-${childId}`}>
          <ParentChildEdge parentId={frameId} childId={childId} tfManager={tfManager} config={config} />
          <Frame key={childId} frameId={childId} config={config} tfManager={tfManager} />
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

  const frames = useMemo(() => tfManager.getAllFramesAsArray(), [version]);
  return (
    <group>
      {frames.map(f => (
        <Frame key={`frame-${f}`} frameId={f} config={config} tfManager={tfManager} />
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
