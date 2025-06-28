import { UIPanelPlugin } from './base/UIPanelPlugin';

class UIPanelPluginRegistry {
  constructor() {
    if (!UIPanelPluginRegistry.instance) {
      /** @type {Object.<string, UIPanelPlugin>} */
      this.plugins = {};
      UIPanelPluginRegistry.instance = this;
    }
    return UIPanelPluginRegistry.instance;
  }

  /**
   * Registers a plugin definition.
   * @param {UIPanelPlugin} plugin - An instance of a class that extends UIPanelPlugin.
   */
  register(plugin) {
    if (!(plugin instanceof UIPanelPlugin)) {
      console.error('Plugin must be an instance of UIPanelPlugin.', plugin);
      return;
    }
    if (this.plugins[plugin.typeName]) {
      console.warn(`Plugin with typeName "${plugin.typeName}" is already registered.`);
      return;
    }
    this.plugins[plugin.typeName] = plugin;
  }

  /**
   * Gets a plugin definition by its typeName.
   * @param {string} typeName
   * @returns {UIPanelPlugin | undefined}
   */
  getPlugin(typeName) {
    return this.plugins[typeName];
  }

  /**
   * Gets all registered plugin definitions.
   * @returns {UIPanelPlugin[]}
   */
  getAllPlugins() {
    return Object.values(this.plugins);
  }
}

const instance = new UIPanelPluginRegistry();
export default instance;