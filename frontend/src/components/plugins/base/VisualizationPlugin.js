import React from 'react';

// 可视化插件基类
export class VisualizationPlugin {
  constructor(name, priority = 0, version = '1.0.0') {
    this.name = name;
    this.priority = priority;
    this.version = version;
    this.enabled = true;
  }
  
  // 插件元数据
  getMetadata() {
    return {
      name: this.name,
      priority: this.priority,
      version: this.version,
      enabled: this.enabled
    };
  }
  
  // 检查是否可以处理该数据
  canHandle(topic, type, data) {
    throw new Error(`Plugin ${this.name}: canHandle method must be implemented`);
  }
  
  // 渲染组件
  render(topic, type, data) {
    throw new Error(`Plugin ${this.name}: render method must be implemented`);
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
  
  // 获取或创建消息实例
  getOrCreateInstance(topic, data) {
    // 如果该topic已有实例，直接返回
    if (this.messageInstances.has(topic)) {
      return this.messageInstances.get(topic);
    }
    
    // 查找合适的插件类型
    console.log(`markdebug ! - findPluginType: ${topic}, ${data.message_type}, ${data.data}`)
    const pluginType = this.findPluginType(topic, data.message_type, data.data);
    if (!pluginType) {
      console.warn(`No plugin found for topic: ${topic}`);
      return null;
    }else{
      console.log(`markdebug - got plugin: ${pluginType.name}`)
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
  render(topic, data) {
    const pluginInstance = this.getOrCreateInstance(topic, data);
    if (!pluginInstance) {
      console.warn(`No plugin found for topic: ${topic}. data - ${JSON.stringify(data)}`);
      return null;
    }
    
    try {
      return pluginInstance.render(topic, data.data);
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