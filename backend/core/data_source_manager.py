from typing import Dict, Any, List, Optional
import asyncio
from adapters.mock_adapter import MockAdapter
from adapters.ros_adapter import ROSAdapter

class DataSourceManager:
    def __init__(self):
        self.adapters: Dict[str, Any] = {}  # 存储适配器实例
        self.adapter_configs: Dict[str, Dict[str, Any]] = {}  # 存储适配器配置信息
        self.active_adapter = None
        self.active_adapter_name = None
        self.data_callbacks = []
        
        # 注册默认适配器
        self._register_default_adapters()
    
    def _register_default_adapters(self):
        """注册默认适配器"""
        self.register_adapter('rosbridge', ROSAdapter())
        self.register_adapter('mock', MockAdapter())
    
    def register_adapter(self, name: str, adapter_instance: Any):
        """注册适配器"""
        self.adapters[name] = adapter_instance
        
        # 收集适配器配置信息
        adapter_class = adapter_instance.__class__
        self.adapter_configs[name] = {
            "name": name,
            "display_name": adapter_class.get_display_name(),
            "description": adapter_class.get_description(),
            "config_schema": adapter_class.get_config_schema()
        }
        
        # 注册数据回调
        adapter_instance.add_data_callback(self._on_adapter_data)
    
    def get_available_adapters(self) -> List[str]:
        """获取可用适配器名称列表"""
        return list(self.adapters.keys())
    
    def get_adapter_configs(self) -> Dict[str, Dict[str, Any]]:
        """获取所有适配器的配置信息"""
        return self.adapter_configs
    
    def get_adapter_config(self, adapter_name: str) -> Optional[Dict[str, Any]]:
        """获取指定适配器的配置信息"""
        return self.adapter_configs.get(adapter_name)
    
    async def connect_adapter(self, adapter_name: str, config: Dict[str, Any]) -> bool:
        """连接到指定适配器"""
        if adapter_name not in self.adapters:
            return False
        
        # 如果有活跃的适配器，先断开
        if self.active_adapter:
            await self.disconnect_current_adapter()
        
        adapter = self.adapters[adapter_name]
        try:
            success = await adapter.connect(config)
            if success:
                self.active_adapter = adapter
                self.active_adapter_name = adapter_name
                return True
            return False
        except Exception as e:
            print(f"Failed to connect to adapter {adapter_name}: {e}")
            return False
    
    async def disconnect_current_adapter(self) -> bool:
        """断开当前活跃的适配器"""
        if self.active_adapter:
            try:
                success = await self.active_adapter.disconnect()
                self.active_adapter = None
                self.active_adapter_name = None
                return success
            except Exception as e:
                print(f"Failed to disconnect adapter: {e}")
                return False
        return True
    
    def get_connection_status(self) -> Dict[str, Any]:
        """获取连接状态"""
        if self.active_adapter and self.active_adapter.is_connected:
            return {
                'connected': True,
                'adapter': self.active_adapter_name,
                'config': self.active_adapter.config,
            }
        else:
            return {
                'connected': False,
                'adapter': None,
                'config': {},
            }
    
    async def get_available_topics(self) -> List[Dict[str, str]]:
        """获取可用话题列表"""
        if self.active_adapter and self.active_adapter.is_connected:
            return await self.active_adapter.get_available_topics()
        return []
    
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅话题"""
        if self.active_adapter and self.active_adapter.is_connected:
            return await self.active_adapter.subscribe_topic(topic, message_type)
        return False
    
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅话题"""
        if self.active_adapter and self.active_adapter.is_connected:
            return await self.active_adapter.unsubscribe_topic(topic)
        return False

    async def publish_tool_event(self, event: Dict[str, Any]) -> bool:
        """将前端工具事件发布到后端适配器（ROS/Mock）"""
        try:
            if not self.active_adapter or not self.active_adapter.is_connected:
                return False
            evt_type = event.get('type')
            data = event.get('data', {})
            params = event.get('params', {})
            if hasattr(self.active_adapter, 'publish_tool_event'):
                return await self.active_adapter.publish_tool_event(evt_type, data, params)
            return False
        except Exception as e:
            print(f"publish_tool_event error: {e}")
            return False
    
    def add_data_callback(self, callback):
        """添加数据回调"""
        self.data_callbacks.append(callback)
    
    def remove_data_callback(self, callback):
        """移除数据回调"""
        if callback in self.data_callbacks:
            self.data_callbacks.remove(callback)
    
    async def _on_adapter_data(self, topic: str, data: Any):
        """处理来自适配器的数据"""
        # 转发数据给所有注册的回调函数
        for callback in self.data_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(topic, data)
                else:
                    callback(topic, data)
            except Exception as e:
                print(f"Error in data callback: {e}")
