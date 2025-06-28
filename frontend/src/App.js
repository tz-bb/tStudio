import React, { useRef } from 'react';
import { Layout, Model, Actions } from 'flexlayout-react';
import registry from './ui-plugins'; // Auto-discovery index
import { AppProvider } from './services/AppContext';

import 'flexlayout-react/style/dark.css';
import './App.css';

const json = {
  global: { tabEnableFloat: true },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 20,
        children: [
          {
            type: 'tab',
            name: 'Controls',
            component: 'control-panel',
          },
        ],
      },
      {
        type: 'tabset',
        weight: 60,
        children: [
          {
            type: 'tab',
            name: '3D Scene',
            component: 'scene-3d',
          },
        ],
      },
      {
        type: 'tabset',
        weight: 20,
        children: [
          {
            type: 'tab',
            name: 'TF',
            component: 'tf-panel',
          },
        ],
      },
    ],
  },
};

const model = Model.fromJson(json);

const App = () => {
  const layoutRef = useRef();

  const factory = (node) => {
    const componentTypeName = node.getComponent();
    const plugin = registry.getPlugin(componentTypeName);
    if (plugin) {
      return plugin.createComponent(node.getConfig());
    }
    return <div>Plugin not found: {componentTypeName}</div>;
  };

  return (
    <AppProvider>
        <div className="app-container">
            <Layout
                ref={layoutRef}
                model={model}
                factory={factory}
            />
        </div>
    </AppProvider>
  );
};

export default App;
