import React, { useRef, useState } from 'react';
import { Layout, Model, Actions } from 'flexlayout-react';
import registry from './ui-plugins'; // Auto-discovery index
import { AppProvider } from './services/AppContext';

import 'flexlayout-react/style/dark.css';
import './App.css';

const initialJson = {
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
        id: 'main-tabset',
        children: [
          {
            type: 'tab',
            name: '3D Scene',
            component: 'scene-3d',
          },
        ],
      },
      {
        type: 'row',
        weight: 20,
        children: [
            {
                type: 'tabset',
                weight: 50,
                children: [
                    {
                        type: 'tab',
                        name: 'TF Tree',
                        component: 'tf-panel',
                    },
                ]
            },
            {
                type: 'tabset',
                weight: 50,
                children: [
                    {
                        type: 'tab',
                        name: 'System Log',
                        component: 'debug-info',
                    },
                ]
            }
        ]
      },
    ],
  },
};

const App = () => {
  const [model, setModel] = useState(Model.fromJson(initialJson));
  const layoutRef = useRef();

  const factory = (node) => {
    const componentTypeName = node.getComponent();
    const plugin = registry.getPlugin(componentTypeName);
    if (plugin) {
      return plugin.createComponent(node.getConfig());
    }
    return <div>Plugin not found: {componentTypeName}</div>;
  };

  const onAddWindow = (plugin) => {
    if (!plugin) return;
    layoutRef.current.addTabToActiveTabSet({
        component: plugin.typeName,
        name: plugin.name
    });
  }

  return (
    <AppProvider>
        <div className="app-container">
            <div className="app-menu-bar">
                <div className="dropdown">
                    <button className="dropbtn">Layout</button>
                    <div className="dropdown-content">
                        <a href="#" onClick={() => setModel(Model.fromJson(initialJson))}>Reset Layout</a>
                    </div>
                </div>
                <div className="dropdown">
                    <button className="dropbtn">Windows</button>
                    <div className="dropdown-content">
                        {registry.getAllPlugins().map(p => (
                            <a href="#" key={p.typeName} onClick={() => onAddWindow(p)}>{p.name}</a>
                        ))}
                    </div>
                </div>
            </div>
            <div className="app-layout">
                <Layout
                    ref={layoutRef}
                    model={model}
                    factory={factory}
                />
            </div>
        </div>
    </AppProvider>
  );
};

export default App;
