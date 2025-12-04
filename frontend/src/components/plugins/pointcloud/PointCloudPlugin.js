import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import TFWrapper from '../base/TFWrapper'; // 导入 TFWrapper

// 点云可视化组件
function PointCloud({ data, topic, config }) {
  const pointSize = config?.point_size?.__value__ ?? 0.05;
  const scheme = config?.color_scheme?.__value__ ?? 'height';
  const style = config?.style?.__value__ ?? 'squares'; // 'squares' (points) or 'boxes'

  // 如果是 PointCloud2 原始结构，尝试就地解码为几何体（不修改原消息）
  const decodedGeometry = useMemo(() => {
    if (!data) return null;
    const keys = Object.keys(data);
    const isPC2 = keys.includes('fields') && keys.includes('point_step') && keys.includes('data');
    if (!isPC2) return null;

    try {
      const fields = data.fields || [];
      const pointStep = data.point_step;
      const isBigEndian = !!data.is_bigendian;
      const b64 = data.data;
      if (!b64 || !pointStep) return null;

      const raw = atob(b64);
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);

      const fieldMap = {};
      fields.forEach(f => { fieldMap[f.name] = { offset: f.offset, datatype: f.datatype }; });
      const xOff = fieldMap.x?.offset, yOff = fieldMap.y?.offset, zOff = fieldMap.z?.offset;
      if (xOff == null || yOff == null || zOff == null) return null;

      const dv = new DataView(buf.buffer);
      const littleEndian = !isBigEndian;
      const total = Math.floor(buf.byteLength / pointStep);

      const positions = new Float32Array(total * 3);
      const colors = new Float32Array(total * 3);
      const iOff = fieldMap.intensity?.offset;
      const rgbOff = (fieldMap.rgb?.offset ?? fieldMap.rgba?.offset);
      for (let i = 0; i < total; i++) {
        const base = i * pointStep;
        const x = dv.getFloat32(base + xOff, littleEndian);
        const y = dv.getFloat32(base + yOff, littleEndian);
        const z = dv.getFloat32(base + zOff, littleEndian);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        if (scheme === 'intensity' && iOff != null) {
          const val = dv.getFloat32(base + iOff, littleEndian);
          const n = Math.max(0, Math.min(1, val));
          colors[i * 3] = n;
          colors[i * 3 + 1] = n;
          colors[i * 3 + 2] = n;
        } else if (scheme === 'rgb' && rgbOff != null) {
          const u = dv.getUint32(base + rgbOff, littleEndian);
          const r = (u & 0x000000ff) / 255;
          const g = ((u & 0x0000ff00) >>> 8) / 255;
          const b = ((u & 0x00ff0000) >>> 16) / 255;
          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
        } else {
          const h = z;
          const nh = (h + 2) / 4;
          colors[i * 3] = nh;
          colors[i * 3 + 1] = 1 - nh;
          colors[i * 3 + 2] = 0.5;
        }
      }

      // For 'boxes' style, we might need InstanceMesh instead of Points
      // But returning BufferGeometry is generic enough.
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    } catch (e) {
      console.warn(`[PointCloud] Decode PointCloud2 failed on ${topic}:`, e);
      return null;
    }
  }, [data, topic, scheme]);

  const points = useMemo(() => {
    if (decodedGeometry) return decodedGeometry;
    if (!data || !data.points) return null;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.points.length * 3);
    const colors = new Float32Array(data.points.length * 3);
    
    data.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      if (scheme === 'intensity' && typeof point.intensity === 'number') {
        const n = Math.max(0, Math.min(1, point.intensity));
        colors[i * 3] = n;
        colors[i * 3 + 1] = n;
        colors[i * 3 + 2] = n;
      } else if (scheme === 'rgb' && point.rgb) {
        const u = point.rgb >>> 0;
        const r = (u & 0x000000ff) / 255;
        const g = ((u & 0x0000ff00) >>> 8) / 255;
        const b = ((u & 0x00ff0000) >>> 16) / 255;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      } else {
        const height = point.z;
        const normalizedHeight = (height + 2) / 4;
        colors[i * 3] = normalizedHeight;
        colors[i * 3 + 1] = 1 - normalizedHeight;
        colors[i * 3 + 2] = 0.5;
      }
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, [data, decodedGeometry, scheme]);

  useEffect(() => {
    if (!data) {
      console.warn(`[PointCloud] No data for topic ${topic}`);
    } else if (!decodedGeometry && !data.points) {
      const keys = Object.keys(data || {});
      console.warn(`[PointCloud] Missing 'points' array for topic ${topic}, keys=${JSON.stringify(keys)}`);
    } else if (points) {
      points.computeBoundingBox();
    }
  }, [data, points, topic, decodedGeometry]);

  // Use InstancedMesh for boxes
  if (style === 'boxes') {
    if (!points) return null;
    const count = points.getAttribute('position').count;
    return (
      <instancedMesh args={[null, null, count]} key={topic}>
        <boxGeometry args={[pointSize, pointSize, pointSize]} />
        {/* Use vertexColors prop correctly for MeshStandardMaterial */}
        <meshStandardMaterial vertexColors={true} />
        <InstanceBuffer geometry={points} count={count} />
      </instancedMesh>
    );
  }

  // Default 'squares' (points)
  if (!points) return null;

  return (
    <points geometry={points}>
      <pointsMaterial size={pointSize} vertexColors sizeAttenuation={true} />
    </points>
  );
}

// Helper component to update InstancedMesh matrices from BufferGeometry positions
function InstanceBuffer({ geometry, count }) {
  const meshRef = React.useRef();
  
  React.useLayoutEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current.parent;
    if (!mesh) return;

    const positions = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    for (let i = 0; i < count; i++) {
      dummy.position.set(positions.getX(i), positions.getY(i), positions.getZ(i));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (colors) {
        color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
        mesh.setColorAt(i, color);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
    } else if (colors) {
        // If instanceColor attribute doesn't exist yet (first render), we might need to ensure it's created?
        // Three.js InstancedMesh should create it if we use setColorAt.
        // However, in React-Three-Fiber, sometimes props update order matters.
        // We force update to be sure.
        mesh.instanceColor.needsUpdate = true;
    }
  }, [geometry, count]);

  return <primitive object={new THREE.Object3D()} ref={meshRef} visible={false} />;
}

// 点云插件 - 支持TF
export class PointCloudPlugin extends VisualizationPlugin {
  constructor() {
    super('PointCloud', ["sensor_msgs/PointCloud2", "sensor_msgs/msg/PointCloud2"], 10, '1.0.0');
  }
  
  render(topic, type, data, frameId, tfManager, config) {
    // 使用TFWrapper包裹可视化组件
    return (
      <TFWrapper frameId={frameId} tfManager={tfManager}>
        <PointCloud data={data} topic={topic} config={config} />
      </TFWrapper>
    );
  }

  getConfigTemplate() {
    return {
      style: {
        __value__: 'squares',
        __metadata__: { type: 'enumerate', options: ['squares', 'boxes'] },
      },
      point_size: {
        __value__: 0.05,
        __metadata__: { type: 'number', min: 0.01, max: 1, step: 0.01 },
      },
      color_scheme: {
        __value__: 'height',
        __metadata__: { type: 'enumerate', options: ['height', 'intensity', 'rgb'] },
      },
    };
  }
}

export default new PointCloudPlugin();
