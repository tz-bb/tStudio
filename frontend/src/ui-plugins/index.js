import React from 'react';
import registry from './UIPanelPluginRegistry';
import { UIPanelPlugin } from './base/UIPanelPlugin';

// import components
import TFPanel from '../components/TFPanel';
import ConfigPanel from '../components/ConfigPanel';
import NewConfigPage from '../components/NewConfigPage';
import TopicVizPanel from '../components/TopicVizPanel';

const pluginComponentMap = {
  'tf-panel': ["TF Tree", TFPanel],
  'config-panel': ["Config Panel", ConfigPanel],
  'new-config-page': ["New Config Page", NewConfigPage],
  'topic-viz-panel': ['Topic Viz Panel', TopicVizPanel],
};

/**
 * A helper function to create and register a UI Panel Plugin directly from a React component.
 * This avoids the need to create a separate plugin class file for simple components.
 *
 * @param {object} options - The configuration for the plugin.
 * @param {string} options.typeName - The unique type name for the plugin (e.g., 'my-custom-panel').
 * @param {string} options.name - The human-readable name for the plugin (e.g., 'My Custom Panel').
 * @param {React.ComponentType} options.component - The React component to be rendered by the plugin.
 */
export function registerPluginFromComponent({ typeName, name, component }) {
  if (!typeName || !name || !component) {
    console.error('`typeName`, `name`, and `component` are required to register a plugin from a component.');
    return;
  }

  // Dynamically create a class that extends UIPanelPlugin
  class GenericPlugin extends UIPanelPlugin {
    constructor() {
      super();
      this.typeName = typeName;
      this.name = name;
    }

    createComponent(config) {
      // Pass the config as props to the wrapped component
      return React.createElement(component, config);
    }
  }

  try {
    const pluginInstance = new GenericPlugin();
    registry.register(pluginInstance);
    console.log(`✅ UI Panel Plugin registered via component: ${pluginInstance.name}`);
  } catch (error) {
    console.error(`Failed to register plugin from component '${name}':`, error);
  }
}

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

  // Register plugins from components
  Object.entries(pluginComponentMap).forEach(([typeName, [name, component]]) => {
    registerPluginFromComponent({ typeName, name, component });
  });

  console.log(`🎉 UI Panel Plugin system initialized with ${registry.getAllPlugins().length} plugins.`);
}

// Initialize the plugin system on application startup
initializeUIPanelPlugins();

// Export the fully populated registry
export default registry;