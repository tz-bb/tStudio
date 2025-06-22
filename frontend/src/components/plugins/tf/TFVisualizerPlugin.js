import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import { tfManager } from '../../../services/TFManager';

// 可视化单个Frame的组件
const Frame = ({ frameId, rootFrame }) => {
  const axesRef = useRef();

  useFrame(() => {
    if (axesRef.current) {
      const transform = tfManager.getTransform(rootFrame, frameId);
      if (transform) {
        axesRef.current.position.copy(transform.position);
        axesRef.current.quaternion.copy(transform.quaternion);
      }
    }
  });

  return <axesHelper ref={axesRef} args={[0.5]} />;
};

// 渲染所有TF Visuals的组件
const TFVisuals = ({ rootFrame }) => {
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    // 设置一个定时器来定期刷新坐标系列表
    const interval = setInterval(() => {
      const allFrames = tfManager.getAllFramesAsArray();
      setFrames(allFrames);
    }, 1000); // 每秒更新一次

    return () => clearInterval(interval);
  }, []);

  return (
    <group>
      {frames.map(frame => (
        <Frame key={frame.id} frameId={frame.id} rootFrame={rootFrame} />
      ))}
    </group>
  );
};


export class TFVisualizerPlugin extends VisualizationPlugin {
  constructor() {
    super('TF', 'tf2_msgs/TFMessage');
  }

  render(topic, type, data, frameId) {
    // TF的可视化不依赖于单条消息，而是依赖于tfManager的全局状态
    // 我们只需要一个根坐标系来计算所有其他坐标系的相对位置
    // 通常，这会是一个固定的frame，比如 'world' 或 'map'
    // 这里我们暂时硬编码为 'base_link'，后续可以做成可配置的
    const fixedFrame = 'base_link'; 

    // 返回一个持续渲染所有TF的组件
    return <TFVisuals key="tf-visualizer" rootFrame={fixedFrame} />;
  }
}