import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import TFWrapper from '../base/TFWrapper';

function PathLine({ data, config }) {
  const attrRef = useRef();
  const positions = useMemo(() => {
    const poses = data?.poses || [];
    const count = poses.length;
    if (!count) return null;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = poses[i]?.pose?.position || poses[i]?.position || { x: 0, y: 0, z: 0 };
      arr[i * 3] = p.x || 0;
      arr[i * 3 + 1] = p.y || 0;
      arr[i * 3 + 2] = p.z || 0;
    }
    return arr;
  }, [data?.poses]);

  useEffect(() => {
    if (attrRef.current) attrRef.current.needsUpdate = true;
  }, [positions]);

  if (!positions) return null;

  return (
    <group>
      <line key={`path-line-${positions.length}`}>
        <bufferGeometry key={`geom-${positions.length}`}>
          <bufferAttribute key={`attr-${positions.length}`} ref={attrRef} attach="attributes-position" array={positions} itemSize={3} count={positions.length / 3} />
        </bufferGeometry>
        <lineBasicMaterial color={config?.line_color?.__value__ ?? '#33ccff'} linewidth={1} />
      </line>
      {config?.show_points?.__value__ ? (
        <group>
          {Array.from({ length: positions.length / 3 }, (_, i) => (
            <mesh key={i} position={new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])}>
              <sphereGeometry args={[config?.point_size?.__value__ ?? 0.06, 10, 10]} />
              <meshStandardMaterial color={config?.point_color?.__value__ ?? '#ffaa00'} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

export class PathPlugin extends VisualizationPlugin {
  constructor() {
    super('Path', ["nav_msgs/Path", "nav_msgs/msg/Path"], 8, '1.0.0');
  }

  canHandle(topic, type, data) {
    const t = (type || '').replace('/msg/', '/');
    return t === 'nav_msgs/Path';
  }

  render(topic, type, data, frameId, tfManager, config) {
    const displayConfig = config || PathPlugin.getConfigTemplate();
    return (
      <TFWrapper frameId={frameId} tfManager={tfManager}>
        <PathLine data={data} config={displayConfig} />
      </TFWrapper>
    );
  }

  static getConfigTemplate() {
    return {
      line_color: { __value__: '#33ccff', __metadata__: { type: 'color' } },
      show_points: { __value__: false, __metadata__: { type: 'boolean' } },
      point_size: { __value__: 0.06, __metadata__: { type: 'number', min: 0.01, max: 1, step: 0.01 } },
      point_color: { __value__: '#ffaa00', __metadata__: { type: 'color' } },
    };
  }
}

export default new PathPlugin();
