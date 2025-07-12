import { VisualizationPluginManager } from './base/VisualizationPlugin';

export const pluginManager = new VisualizationPluginManager();
// This function dynamically imports all plugins from the current directory.
function discoverPlugins() {
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

export function initializePlugins(setPluginTemplates, setPluginsInitialized) {
  const plugins = discoverPlugins();
  pluginManager.registerPlugins(plugins);
  pluginManager.initialize();

  const templates = pluginManager.getAllConfigTemplates();
  setPluginTemplates(templates);
  setPluginsInitialized(true);
  console.log('Plugins initialized and templates set in context.');
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