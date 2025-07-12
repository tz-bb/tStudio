import { VisualizationPlugin } from '../base/VisualizationPlugin';

export class ScenePlugin extends VisualizationPlugin {
  constructor() {
    super('Scene', "Scene", -1, '1.0.0'); // 使用-1的优先级，确保它不会意外匹配到任何topic
  }

  canHandle(topic, type, data) {
    // 这个插件不直接处理任何topic，只提供模板
    return false;
  }

  render(topic, type, data, frameId) {
    // 不渲染任何东西
    return null;
  }

  static getConfigTemplate() {
    return {
      "grid_visible": {
        "__value__": true,
        "__metadata__": {
          "type": "boolean",
          "label": "Show Grid"
        }
      },
      "grid_size": {
        "__value__": 20,
        "__metadata__": {
          "type": "number",
          "label": "Grid Size",
          "min": 1,
          "max": 100
        }
      },
      "background_color": {
        "__value__": "#1e1e1e",
        "__metadata__": {
          "type": "color",
          "label": "Background Color"
        }
      }
    };
  }
}

export default new ScenePlugin();