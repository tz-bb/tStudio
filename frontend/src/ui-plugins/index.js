import registry from './UIPanelPluginRegistry';

/**
 * Automatically discovers and registers all UI Panel Plugins.
 * It uses Webpack's require.context to scan for plugin files.
 * A plugin file must be named `*Plugin.js` and export a class that extends UIPanelPlugin.
 */
function initializeUIPanelPlugins() {
  console.log('🔌 Initializing UI Panel Plugin system...');

  // Scan all subdirectories for files ending with 'Plugin.js'
  const pluginModules = require.context(
    './',     // The directory to search
    true,     // Search subdirectories
    /Plugin\.js$/ // Regex to match files
  );

  pluginModules.keys().forEach(modulePath => {
    // Ignore the base plugin class file
    if (modulePath.includes('/base/')) {
      return;
    }

    try {
      const module = pluginModules(modulePath);
      // The plugin class is expected to be the default export or a named export
      const PluginClass = module.default || Object.values(module)[0];

      if (PluginClass && typeof PluginClass === 'function') {
        const pluginInstance = new PluginClass();
        registry.register(pluginInstance);
        console.log(`✅ UI Panel Plugin registered: ${pluginInstance.name}`);
      } else {
        console.warn(`Could not find a valid plugin class in ${modulePath}`);
      }
    } catch (error) {
      console.error(`Failed to load UI Panel Plugin from ${modulePath}:`, error);
    }
  });

  console.log(`🎉 UI Panel Plugin system initialized with ${registry.getAllPlugins().length} plugins.`);
}

// Initialize the plugin system on application startup
initializeUIPanelPlugins();

// Export the fully populated registry
export default registry;