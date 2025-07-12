import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout as FlexLayout, Model } from 'flexlayout-react';
import { ConfigProvider, theme, Menu, Dropdown, Button, Space } from 'antd';
import { DownOutlined, SaveOutlined, FolderOpenOutlined, RedoOutlined, PlusOutlined } from '@ant-design/icons';
import registry from './ui-plugins';
import { AppProvider } from './services/AppContext';
import ParameterService from './services/ParameterService';
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
                        name: 'Config Panel',
                        component: 'config-panel',
                    },
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
  const [currentLayoutName, setCurrentLayoutName] = useState(null); // 新增 state
  const layoutRef = useRef();
  const saveTimeoutRef = useRef();

  // 加载可用布局列表
  const loadAvailableLayouts = useCallback(async () => {
    try {
      // 使用新的API列出所有布局配置
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
        // 使用封装好的 loadLayout 方法
        const savedLayout = await ParameterService.loadLayout('auto_save');
        setModel(Model.fromJson(savedLayout)); // 从返回的结构中获取布局定义
        setCurrentLayoutName('auto_save');
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
        // 自动保存也应该使用 saveLayout
        await ParameterService.saveLayout('auto_save', layoutData);
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
      // 直接使用 saveLayout，它会处理创建或更新
      await ParameterService.saveLayout(layoutName, model.toJson());
      await loadAvailableLayouts(); // 刷新布局列表
      setCurrentLayoutName(layoutName); // 保存后更新当前布局名称
      alert(`布局 "${layoutName}" 保存成功！`);
    } catch (error) {
      console.error('Failed to save layout:', error);
      alert(`保存布局失败: ${error.message}`);
    }
  };

  // 加载指定布局
  const handleLoadLayout = async (layoutName) => {
    try {
      // 使用封装好的 loadLayout 方法
      const layoutData = await ParameterService.loadLayout(layoutName);
      setModel(Model.fromJson(layoutData)); // 从返回的结构中获取布局定义
      setCurrentLayoutName(layoutName); // 加载后更新当前布局名称
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
    setCurrentLayoutName(null); // 重置后清除当前布局名称
    setHasUnsavedChanges(true);
  };

  // 新增：覆盖当前布局
  const handleOverwriteLayout = async () => {
    if (!currentLayoutName || !model) return;
    if (!window.confirm(`确定要覆盖布局 "${currentLayoutName}" 吗？`)) {
      return;
    }
    handleSaveLayout(currentLayoutName);
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
      name: plugin.name,
      config: plugin.config,
    });
  };

  if (!model) {
    return <div>Loading layout...</div>;
  }

  const layoutMenu = (
    <Menu>
      {currentLayoutName && currentLayoutName !== 'auto_save' && (
        <Menu.Item key="overwrite" icon={<SaveOutlined />} onClick={handleOverwriteLayout}>
          Overwrite '{currentLayoutName}'
        </Menu.Item>
      )}
      <Menu.Item key="save_as" icon={<SaveOutlined />} onClick={() => setShowSaveDialog(true)}>
        Save Layout As...
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="reset" icon={<RedoOutlined />} onClick={handleResetLayout}>
        Reset to Default
      </Menu.Item>
      {availableLayouts.length > 0 && <Menu.Divider />}
      {availableLayouts.map(layout => {
        const displayName = layout.replace('layout_', '');
        return (
          <Menu.Item key={layout} icon={<FolderOpenOutlined />} onClick={() => handleLoadLayout(layout)}>
            Load: {displayName}
          </Menu.Item>
        );
      })}
    </Menu>
  );

  const windowsMenu = (
    <Menu>
      {registry.getAllPlugins().map(p => (
        <Menu.Item key={p.typeName} icon={<PlusOutlined />} onClick={() => onAddWindow(p)}>
          {p.name}
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <AppProvider>
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <div className="app-container">
          <div className="app-menu-bar">
            <Space>
              <Dropdown overlay={layoutMenu} trigger={['click']}>
                <Button>
                  Layout {hasUnsavedChanges && '*'} <DownOutlined />
                </Button>
              </Dropdown>
              <Dropdown overlay={windowsMenu} trigger={['click']}>
                <Button>
                  Windows <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </div>
          <div className="app-layout">
            <FlexLayout
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
      </ConfigProvider>
    </AppProvider>
  );
};

export default App;
