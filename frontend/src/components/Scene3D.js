import React, { useMemo, useRef, useEffect, useState, useContext } from 'react';
import { initializePlugins } from './plugins';
import { tfManager } from '../services/TFManager'; // 导入 tfManager
import { AppContext } from '../services/AppContext';

function Scene3D({ data }) {
  const [pluginManager, setPluginManager] = useState(null);
  const { setScenePluginTemplates, setScenePluginsInitialized, vizConfigs, addDebugInfo } = useContext(AppContext);

  // 初始化插件系统
  useEffect(() => {
    const manager = initializePlugins(setScenePluginTemplates, setScenePluginsInitialized);
    setPluginManager(manager);

    // 组件卸载时执行清理
    return () => {
      manager.destroy();
    };
  }, [setScenePluginTemplates, setScenePluginsInitialized]); // 空依赖数组，确保此 effect 只在挂载和卸载时运行一次

  // 监听数据变化，清理不再存在的 topic 实例
  useEffect(() => {
    // 必须等待 pluginManager 初始化完成
    if (!pluginManager) {
      return; // useEffect hook 内部不能返回JSX元素，如果无事可做，直接返回
    }

    const currentTopics = new Set(Object.keys(data));
    // 假设 pluginManager.messageInstances 是一个 Map 或 Object
    const existingTopics = new Set(pluginManager.messageInstances.keys());

    // 移除不再接收数据的 topic 实例，以释放资源
    for (const topic of existingTopics) {
      if (!currentTopics.has(topic)) {
        pluginManager.removeInstance(topic);
      }
    }
  }, [data, pluginManager]);

  return (
    <group>
      {/* 动态渲染所有话题数据 */}
      {/* 确保 pluginManager 已初始化后再进行渲染，防止空指针错误 */}
      {pluginManager && Object.entries(data).map(([topic, topicData]) => {
        // Find the corresponding visualization config for this topic
        const topicConfig = Object.values(vizConfigs?.topics || {}).find(
          t => t.topic_name?.__value__ === topic
        );
        // 将 tfManager 和 config 传递给 render 方法
        const renderedComponent = pluginManager.render(topic, topicData, tfManager, topicConfig);
        if (!renderedComponent) {
          const type = topicData?.message_type || 'UnknownType';
          addDebugInfo(`No visualization plugin for ${topic} (${type})`, 'warn');
        }
        return <React.Fragment key={topic}>{renderedComponent}</React.Fragment>;
      })}
    </group>
  );
}

export default Scene3D;
