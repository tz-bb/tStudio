import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { tfManager } from '../../../services/TFManager';

export class VisualizationPlugin {
  constructor(name, default_type_str, priority = 0, version = '1.0.0') {
    this.name = name;
    this.default_type_str = default_type_str;
    this.priority = priority;
    this.version = version;
    this.enabled = true;
  }

  // 获取数据的frame信息
  getFrameId(data) {
    if (data.header && data.header.frame_id) {
      return data.header.frame_id;
    }
    return 'world'; // 默认frame
  }

  // 创建带TF支持的渲染组件
  renderWithTF(topic, type, data, children) {
    const frameId = this.getFrameId(data);
    const frameObject = tfManager.getFrameObject(frameId);
    
    return (
      <TFFrame frameId={frameId} key={`${topic}-${frameId}`}>
        {children}
      </TFFrame>
    );
  }

  canHandle(topic, type, data) {
    return type === this.default_type_str
  }

  render(topic, type, data, frameId, tfManager) {
    throw new Error(`Plugin ${this.name}: render method must be implemented`);
  }

  // 返回此可视化插件的参数模板
  getConfigTemplate() {
    throw new Error(`Plugin ${this.name}: getTemplate method must be implemented`);
  }
  
  // 插件初始化（可选）
  initialize() {
    console.log(`Plugin ${this.name} initialized`);
  }
  
  // 插件销毁（可选）
  destroy() {
    console.log(`Plugin ${this.name} destroyed`);
  }
}

// 插件管理器
export class VisualizationPluginManager {
  constructor() {
    this.plugins = []; // 插件注册字典
    this.messageInstances = new Map(); // 消息实例管理字典：topic -> 插件实例
    this.initialized = false;
  }
  
  // 注册插件
  register(plugin) {
    if (!(plugin instanceof VisualizationPlugin)) {
      throw new Error('Plugin must extend VisualizationPlugin');
    }
    
    this.plugins.push(plugin);
    // 按优先级排序
    this.plugins.sort((a, b) => b.priority - a.priority);
    
    console.log(`Registered plugin: ${plugin.name} (priority: ${plugin.priority})`);
  }
  
  // 批量注册插件
  registerPlugins(plugins) {
    plugins.forEach(plugin => this.register(plugin));
  }
  
  // 初始化所有插件
  initialize() {
    if (this.initialized) return;
    
    this.plugins.forEach(plugin => {
      try {
        plugin.initialize();
      } catch (error) {
        console.error(`Failed to initialize plugin ${plugin.name}:`, error);
      }
    });
    
    this.initialized = true;
    console.log(`Initialized ${this.plugins.length} plugins`);
  }
  
  // 查找合适的插件类型
  findPluginType(topic, type, data) {
    return this.plugins.find(plugin => 
      plugin.enabled && plugin.canHandle(topic, type, data)
    );
  }

  // 根据消息类型查找模板
  getConfigTemplateByType(topicType) {
    const plugin = this.plugins.find(p => p.canHandle(null, topicType, null));
    if (plugin) {
      try {
        return plugin.constructor.getConfigTemplate();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // 获取所有插件的配置模板
  getAllConfigTemplates() {
    const templates = {};
    this.plugins.forEach(plugin => {
      try {
        // 使用 plugin.constructor.getConfigTemplate() 来调用静态方法
        const template = plugin.constructor.getConfigTemplate();
        if (template) {
          // // add topic_type and topic_name
          // template.topic_type = {
          //   __value__: plugin.default_type_str,
          //   __metadata__: {
          //     type: 'string'

          //   }
          // };
          // template.topic_name = {
          //   __value__: plugin.default_type_str + `(${plugin.name})`,
          //   __metadata__: {
          //     type: 'string'
          //   }
          // };
          // 使用插件名称作为键
          templates[plugin.default_type_str] = template;
        }
      } catch (error) {
        // 忽略没有实现 getTemplate 的插件
      }
    });
    return templates;
  }
  
  // 获取或创建消息实例
  getOrCreateInstance(topic, message) { // 参数从 data 改为 message
    // 如果该topic已有实例，直接返回
    if (this.messageInstances.has(topic)) {
      return this.messageInstances.get(topic);
    }
    
    // 查找合适的插件类型
    const pluginType = this.findPluginType(topic, message.message_type, message.data);
    if (!pluginType) {
      console.warn(`No plugin found for topic: ${topic}, type: ${message.message_type}`);
      return null;
    }else{
      console.log(`Found plugin for ${topic}: ${pluginType.name}`)
    }
    
    // 创建新的插件实例（克隆插件类型）
    const pluginInstance = Object.create(Object.getPrototypeOf(pluginType));
    Object.assign(pluginInstance, pluginType);
    
    // 存储实例
    this.messageInstances.set(topic, pluginInstance);
    
    console.log(`Created new instance for topic: ${topic} using plugin: ${pluginType.name}`);
    return pluginInstance;
  }
  
  // 渲染数据
  render(topic, message, tfManager) { // 参数从 data 改为 message
    const pluginInstance = this.getOrCreateInstance(topic, message);
    if (!pluginInstance) {
      return null;
    }
    
    try {
      // 提取 frameId 并传递给插件的 render 方法
      const frameId = message.data?.header?.frame_id || 'world'; // 默认 frame
      return pluginInstance.render(topic, message.message_type, message.data, frameId, tfManager);
    } catch (error) {
      console.error(`Plugin ${pluginInstance.name} render error:`, error);
      return null;
    }
  }
  
  // 移除消息实例
  removeInstance(topic) {
    if (this.messageInstances.has(topic)) {
      const instance = this.messageInstances.get(topic);
      try {
        if (instance.destroy) {
          instance.destroy();
        }
      } catch (error) {
        console.error(`Error destroying instance for topic ${topic}:`, error);
      }
      this.messageInstances.delete(topic);
      console.log(`Removed instance for topic: ${topic}`);
    }
  }
  
  // 清理所有实例
  clearAllInstances() {
    for (const topic of this.messageInstances.keys()) {
      this.removeInstance(topic);
    }
  }
  
  // 获取所有插件信息
  getPlugins() {
    return this.plugins.map(plugin => plugin.getMetadata());
  }
  
  // 获取所有消息实例信息
  getInstances() {
    const instances = {};
    for (const [topic, instance] of this.messageInstances.entries()) {
      instances[topic] = instance.getMetadata();
    }
    return instances;
  }
  
  // 销毁管理器
  destroy() {
    this.clearAllInstances();
    
    this.plugins.forEach(plugin => {
      try {
        plugin.destroy();
      } catch (error) {
        console.error(`Failed to destroy plugin ${plugin.name}:`, error);
      }
    });
    
    this.plugins = [];
    this.initialized = false;
    console.log('Plugin manager destroyed');
  }
}

// TF Frame组件
function TFFrame({ frameId, children }) {
  const groupRef = useRef();
  
  useEffect(() => {
    if (groupRef.current) {
      const frameObject = tfManager.createFrameObject(frameId);
      // 将Three.js对象的变换应用到React组件
      groupRef.current.position.copy(frameObject.position);
      groupRef.current.quaternion.copy(frameObject.quaternion);
      groupRef.current.scale.copy(frameObject.scale);
    }
  }, [frameId]);

  // 监听TF更新
  useFrame(() => {
    if (groupRef.current) {
      const frameObject = tfManager.getFrameObject(frameId);
      if (frameObject) {
        groupRef.current.position.copy(frameObject.position);
        groupRef.current.quaternion.copy(frameObject.quaternion);
        groupRef.current.scale.copy(frameObject.scale);
      }
    }
  });

  return (
    <group ref={groupRef} name={frameId}>
      {children}
    </group>
  );
}

export { TFFrame };