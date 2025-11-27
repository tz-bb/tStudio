import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import TFWrapper from '../base/TFWrapper'; // 导入 TFWrapper

// 点云可视化组件
function PointCloud({ data, topic, config }) {
  const pointSize = config?.point_size?.__value__ ?? 0.05;
  const scheme = config?.color_scheme?.__value__ ?? 'height';
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
      const bb = points.boundingBox;
      const count = data?.points ? data.points.length : (points.getAttribute('position')?.count || 0);
      const pos = points.getAttribute('position');
      if (pos && count > 0) {
        const first = { x: pos.getX(0), y: pos.getY(0), z: pos.getZ(0) };
        const midIdx = Math.floor(count / 2);
        const mid = { x: pos.getX(midIdx), y: pos.getY(midIdx), z: pos.getZ(midIdx) };
        console.log(`[PointCloud] samples ${topic}: first=(${first.x.toFixed(2)},${first.y.toFixed(2)},${first.z.toFixed(2)}) mid=(${mid.x.toFixed(2)},${mid.y.toFixed(2)},${mid.z.toFixed(2)})`);
        console.log(`[PointCloud] bbox ${topic}: min=(${bb.min.x.toFixed(2)},${bb.min.y.toFixed(2)},${bb.min.z.toFixed(2)}) max=(${bb.max.x.toFixed(2)},${bb.max.y.toFixed(2)},${bb.max.z.toFixed(2)}) count=${count}`);
      }
    }
  }, [data, points, topic, decodedGeometry]);

  if (!points) return null;

  return (
    <points geometry={points}>
      <pointsMaterial size={pointSize} vertexColors />
    </points>
  );
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
