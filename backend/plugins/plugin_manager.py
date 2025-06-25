import os
import importlib
import inspect
from typing import Dict, List, Optional, Any
from collections import defaultdict
import asyncio
from . import BasePlugin, PluginConfig, get_registered_plugins

class PluginManager:
    """插件管理器"""
    
    def __init__(self):
        self.plugins: Dict[str, List[BasePlugin]] = defaultdict(list)
        self.plugin_instances: List[BasePlugin] = []
        self.initialized = False
    
    async def initialize(self, plugins_dir: str = None):
        """初始化插件管理器"""
        if self.initialized:
            return
        
        # 自动发现并加载插件
        if plugins_dir:
            await self._discover_plugins(plugins_dir)
        
        # 注册所有发现的插件
        await self._register_discovered_plugins()
        
        # 初始化所有插件
        for plugin in self.plugin_instances:
            try:
                await plugin.initialize()
            except Exception as e:
                print(f"Failed to initialize plugin {plugin.name}: {e}")
        
        self.initialized = True
        print(f"Plugin manager initialized with {len(self.plugin_instances)} plugins")
    
    async def _discover_plugins(self, plugins_dir: str):
        """自动发现插件文件"""
        if not os.path.exists(plugins_dir):
            print(f"Plugins directory {plugins_dir} does not exist")
            return
        
        # 遍历插件目录
        for root, dirs, files in os.walk(plugins_dir):
            for file in files:
                if file.endswith('plugin.py') and not file.startswith('__'):
                    print(f"Found plugin file: {file}")
                    try:
                        # 构建模块路径
                        rel_path = os.path.relpath(os.path.join(root, file), plugins_dir)
                        module_path = rel_path.replace(os.sep, '.').replace('.py', '')
                        full_module_path = f"plugins.{module_path}"
                        
                        # 动态导入模块
                        importlib.import_module(full_module_path)
                        print(f"Loaded plugin module: {full_module_path}")
                        
                    except Exception as e:
                        print(f"Failed to load plugin {file}: {e}")
    
    async def _register_discovered_plugins(self):
        """注册所有发现的插件"""
        plugin_classes = get_registered_plugins()
        
        for plugin_class in plugin_classes:
            try:
                # 创建插件实例
                plugin_instance = plugin_class()
                
                # 获取支持的模式
                patterns = plugin_instance.get_supported_patterns()
                
                # 注册到对应的模式
                for pattern in patterns:
                    self.plugins[pattern].append(plugin_instance)
                
                self.plugin_instances.append(plugin_instance)
                print(f"Registered plugin: {plugin_instance.name} for patterns: {patterns}")
                
            except Exception as e:
                print(f"Failed to register plugin {plugin_class.__name__}: {e}")
        
        # 按优先级排序每个模式的插件
        for pattern in self.plugins:
            self.plugins[pattern].sort(key=lambda p: p.get_priority())
    
    async def process_message(self, topic: str, message_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理消息通过插件pipeline"""
        if not self.initialized:
            return data
        
        # 查找匹配的插件
        matching_plugins = self._find_matching_plugins(topic, message_type)
        
        if not matching_plugins:
            return data
        
        # 依次通过插件处理
        current_data = data
        for plugin in matching_plugins:
            if not plugin.is_enabled():
                continue
                
            try:
                processed_data = await plugin.process_message(topic, message_type, current_data)
                if processed_data is None:
                    # 插件过滤了消息
                    return None
                current_data = processed_data
            except Exception as e:
                print(f"Error in plugin {plugin.name}: {e}")
                # 继续处理，不因单个插件错误而中断
        
        return current_data
    
    def _find_matching_plugins(self, topic: str, message_type: str) -> List[BasePlugin]:
        """查找匹配的插件"""
        matching_plugins = []
        
        # 精确匹配: message_type#topic
        exact_key = f"{message_type}#{topic}"
        matching_plugins.extend(self.plugins.get(exact_key, []))
        
        # 消息类型匹配: message_type#*
        type_key = f"{message_type}#*"
        matching_plugins.extend(self.plugins.get(type_key, []))
        
        # 话题匹配: *#topic
        topic_key = f"*#{topic}"
        matching_plugins.extend(self.plugins.get(topic_key, []))
        
        # 全局匹配: *#*
        global_key = "*#*"
        matching_plugins.extend(self.plugins.get(global_key, []))
        
        # 去重并按优先级排序
        unique_plugins = list(dict.fromkeys(matching_plugins))  # 保持顺序去重
        unique_plugins.sort(key=lambda p: p.get_priority())
        
        return unique_plugins
    
    async def cleanup(self):
        """清理所有插件"""
        for plugin in self.plugin_instances:
            try:
                await plugin.cleanup()
            except Exception as e:
                print(f"Error cleaning up plugin {plugin.name}: {e}")
        
        self.plugins.clear()
        self.plugin_instances.clear()
        self.initialized = False
    
    def get_plugin_status(self) -> Dict[str, Any]:
        """获取插件状态"""
        return {
            "total_plugins": len(self.plugin_instances),
            "enabled_plugins": len([p for p in self.plugin_instances if p.is_enabled()]),
            "plugins": [
                {
                    "name": p.name,
                    "enabled": p.is_enabled(),
                    "priority": p.get_priority(),
                    "patterns": p.get_supported_patterns()
                }
                for p in self.plugin_instances
            ]
        }