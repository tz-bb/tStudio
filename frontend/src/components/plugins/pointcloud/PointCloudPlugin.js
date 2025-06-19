import React, { useMemo } from 'react';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';

// 点云可视化组件
function PointCloud({ data }) {
  const points = useMemo(() => {
    if (!data || !data.points) return null;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.points.length * 3);
    const colors = new Float32Array(data.points.length * 3);
    
    data.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      
      // 根据高度设置颜色
      const height = point.z;
      const normalizedHeight = (height + 2) / 4;
      colors[i * 3] = normalizedHeight;
      colors[i * 3 + 1] = 1 - normalizedHeight;
      colors[i * 3 + 2] = 0.5;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, [data]);

  if (!points) return null;

  return (
    <points geometry={points}>
      <pointsMaterial size={0.05} vertexColors />
    </points>
  );
}

// 点云插件 - 支持TF
export class PointCloudPlugin extends VisualizationPlugin {
  constructor() {
    super('PointCloud', 10, '1.0.0');
  }
  
  canHandle(topic, type, data) {
    return type === "sensor_msgs/PointCloud2";
  }
  
  render(topic, type, data) {
    // 使用TF支持的渲染
    return this.renderWithTF(topic, type, data, 
      <PointCloud data={data} />
    );
  }
}

export default new PointCloudPlugin();