import { VisualizationPluginManager } from './base/VisualizationPlugin';

// 创建全局插件管理器
export const pluginManager = new VisualizationPluginManager();

// 使用Webpack的require.context自动发现插件
function loadPlugins() {
  // 扫描所有插件文件夹中的插件文件
  const pluginModules = require.context(
    './', // 搜索目录
    true, // 递归搜索子目录
    /Plugin\.js$/ // 匹配以Plugin.js结尾的文件
  );
  
  const plugins = [];
  
  pluginModules.keys().forEach(modulePath => {
    try {
      const module = pluginModules(modulePath);
      const plugin = module.default;
      
      if (plugin) {
        plugins.push(plugin);
        console.log(`Discovered plugin: ${modulePath}`);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${modulePath}:`, error);
    }
  });
  
  return plugins;
}

// 初始化插件系统
export function initializePlugins() {
  console.log('🔌 Initializing plugin system...');
  
  // 自动发现并加载插件
  const discoveredPlugins = loadPlugins();
  
  // 注册所有发现的插件
  pluginManager.registerPlugins(discoveredPlugins);
  
  // 初始化插件管理器
  pluginManager.initialize();
  
  console.log(`✅ Plugin system initialized with ${discoveredPlugins.length} plugins`);
  
  return pluginManager;
}

// 手动注册插件的接口（用于外部插件）
export function registerPlugin(plugin) {
  pluginManager.register(plugin);
}

// 获取插件信息
export function getPluginInfo() {
  return pluginManager.getPlugins();
}

export default pluginManager;