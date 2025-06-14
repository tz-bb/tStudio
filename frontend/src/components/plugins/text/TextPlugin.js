import React from 'react';
import { Text } from '@react-three/drei';
import { VisualizationPlugin } from '../base/VisualizationPlugin';

// 文本可视化组件
function TextVisualization({ data, topic }) {
  if (!data) return null;
  
  const textContent = typeof data.data === 'string' ? data.data : 
                     data.data?.data || 
                     JSON.stringify(data.data, null, 2);
  
  // 根据话题名称确定位置
  const position = [0, 3 + Math.abs(topic.length % 5), 0];
  
  return (
    <Text
      position={position}
      fontSize={0.4}
      color="white"
      anchorX="center"
      anchorY="middle"
      maxWidth={10}
    >
      {`${topic}:\n${textContent}`}
    </Text>
  );
}

// 文本插件
export class TextPlugin extends VisualizationPlugin {
  constructor() {
    super('Text', 1, '1.0.0'); // 低优先级，作为后备选项
  }
  
  canHandle(topic, type, data) {
    return type === 'std_msgs/String'
  }
  
  render(topic, type, data) {
    return <TextVisualization data={data} topic={topic} />;
  }
}

export default new TextPlugin();