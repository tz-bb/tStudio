import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Model, Actions } from 'flexlayout-react';
import registry from './ui-plugins';
import { AppProvider } from './services/AppContext';
import ParameterService from './services/ParameterService';  // 改为默认导入
import SaveLayoutDialog from './components/SaveLayoutDialog';

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
  const [model, setModel] = useState(null);
  const [availableLayouts, setAvailableLayouts] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const layoutRef = useRef();
  const saveTimeoutRef = useRef();

  // 加载可用布局列表
  const loadAvailableLayouts = useCallback(async () => {
    try {
      const layouts = await ParameterService.listLayouts();
      setAvailableLayouts(layouts);
    } catch (error) {
      console.error('Failed to load available layouts:', error);
    }
  }, []);

  // 在组件挂载时加载默认布局和布局列表
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const savedLayout = await ParameterService.loadLayout('default');
        setModel(Model.fromJson(savedLayout));
      } catch (error) {
        console.warn('Failed to load saved layout, using default.', error);
        setModel(Model.fromJson(initialJson));
      }
    };
    
    loadLayout();
    loadAvailableLayouts();
  }, [loadAvailableLayouts]);

  // 防抖保存函数
  const debouncedSave = useCallback((layoutData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await ParameterService.saveLayout('default', layoutData);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to auto-save layout:', error);
      }
    }, 1000); // 1秒防抖
  }, []);

  // 监听模型变化
  const onModelChange = useCallback((newModel) => {
    setHasUnsavedChanges(true);
    debouncedSave(newModel.toJson());
  }, [debouncedSave]);

  // 手动保存布局
  const handleSaveLayout = async (layoutName) => {
    if (!model) return;
    
    try {
      await ParameterService.saveLayout(layoutName, model.toJson());
      await loadAvailableLayouts(); // 刷新布局列表
      alert(`布局 "${layoutName}" 保存成功！`);
    } catch (error) {
      console.error('Failed to save layout:', error);
      alert(`保存布局失败: ${error.message}`);
    }
  };

  // 加载指定布局
  const handleLoadLayout = async (layoutName) => {
    try {
      const layoutData = await ParameterService.loadLayout(layoutName);
      setModel(Model.fromJson(layoutData));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to load layout:', error);
      alert(`加载布局失败: ${error.message}`);
    }
  };

  // 重置为默认布局
  const handleResetLayout = () => {
    if (hasUnsavedChanges && !window.confirm('当前布局有未保存的更改，确定要重置吗？')) {
      return;
    }
    setModel(Model.fromJson(initialJson));
    setHasUnsavedChanges(true);
  };

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
  };

  // 等待model加载完成再渲染
  if (!model) {
    return <div>Loading Layout...</div>;
  }

  return (
    <AppProvider>
        <div className="app-container">
            <div className="app-menu-bar">
                <div className="dropdown">
                    <button className="dropbtn">
                      Layout {hasUnsavedChanges && '*'}
                    </button>
                    <div className="dropdown-content">
                        <a href="#" onClick={() => setShowSaveDialog(true)}>Save Layout As...</a>
                        <hr />
                        <a href="#" onClick={handleResetLayout}>Reset to Default</a>
                        {availableLayouts.length > 0 && <hr />}
                        {availableLayouts.map(layout => {
                          const displayName = layout.replace('layout_', '');
                          return (
                            <a 
                              href="#" 
                              key={layout} 
                              onClick={() => handleLoadLayout(layout)}
                            >
                              Load: {displayName}
                            </a>
                          );
                        })}
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
                    onModelChange={onModelChange}
                />
            </div>
            
            <SaveLayoutDialog
              isOpen={showSaveDialog}
              onClose={() => setShowSaveDialog(false)}
              onSave={handleSaveLayout}
              existingLayouts={availableLayouts.map(l => l.replace('layout_', ''))}
            />
        </div>
    </AppProvider>
  );
};

export default App;
