/**
 * Base class for all UI Panel Plugins.
 * It defines the interface that all panel plugins must implement.
 */
export class UIPanelPlugin {
  /**
   * A unique identifier for the type of the plugin.
   * This should be a machine-readable string, e.g., "plot-2d", "terminal".
   * @type {string}
   */
  typeName = 'base-plugin';

  /**
   * A human-readable name for the plugin.
   * This will be displayed in the UI, e.g., in a "Add Panel" menu.
   * @type {string}
   */
  name = 'Base Plugin';

  /**
   * A factory function to create an instance of the plugin's React component.
   * @param {object} config - The configuration object for this specific panel instance.
   *                          This object is passed when a new panel is created and can
   *                          contain anything the plugin needs, e.g., data source topic.
   * @returns {React.Component} A React component instance.
   */
  createComponent(config) {
    throw new Error('UIPanelPlugin.createComponent must be implemented by subclasses.');
  }
}