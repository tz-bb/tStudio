import React from 'react';
import { Text } from '@react-three/drei';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import TFWrapper from '../base/TFWrapper'; // 导入 TFWrapper

// 文本可视化组件
function TextVisualization({ data, topic, config }) {
  if (!data) return null;

  const textContent =
    typeof data.data === 'string' ? data.data : data.data?.data || JSON.stringify(data.data, null, 2);


  // 根据话题名称确定位置
  const position = [0, 3 + (Math.abs(textContent.length % 5) * 0.5), 0];

  return (
    <Text
      position={position}
      fontSize={config?.fontSize?.__value__ ?? 0.4}
      color={config?.color?.__value__ ?? 'white'}
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
    super('Text', ["std_msgs/String", "std_msgs/msg/String"], 1, '1.0.0'); // 低优先级，作为后备选项
  }

  render(topic, type, data, frameId, tfManager, config) {
    return (
      <TFWrapper frameId={frameId} tfManager={tfManager}>
        <TextVisualization data={data} topic={topic} config={config} />
      </TFWrapper>
    );
  }

  static getConfigTemplate() {
    return {
      fontSize: {
        __value__: 0.4,
        __metadata__: { type: 'number', min: 0.1, max: 2, step: 0.1 },
      },
      color: {
        __value__: '#ffffff',
        __metadata__: { type: 'color' },
      },
    };
  }
}

export default new TextPlugin();