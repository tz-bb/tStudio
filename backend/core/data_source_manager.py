import asyncio
from typing import Dict, Any, Optional, Callable
from adapters.base_adapter import BaseAdapter
from adapters.mock_adapter import MockAdapter
from adapters.ros_adapter import ROSAdapter

class DataSourceManager:
    """数据源管理器"""
    
    def __init__(self):
        self.adapters: Dict[str, BaseAdapter] = {}
        self.active_adapter: Optional[BaseAdapter] = None
        self.data_callbacks: list[Callable] = []
        
        # 注册默认适配器
        self._register_default_adapters()
    
    def _register_default_adapters(self):
        """注册默认适配器"""
        self.register_adapter('mock', MockAdapter())
        self.register_adapter('ros1', ROSAdapter())
        # 可以在这里添加更多适配器
        # self.register_adapter('ros2', ROS2Adapter())
    
    def register_adapter(self, name: str, adapter: BaseAdapter):
        """注册适配器"""
        self.adapters[name] = adapter
        # 为适配器添加数据回调
        adapter.add_data_callback(self._on_adapter_data)
    
    def get_available_adapters(self) -> list[str]:
        """获取可用适配器列表"""
        return list(self.adapters.keys())
    
    async def connect_adapter(self, adapter_name: str, config: Dict[str, Any]) -> bool:
        """连接到指定适配器"""
        if adapter_name not in self.adapters:
            return False
        
        # 断开当前适配器
        if self.active_adapter:
            await self.active_adapter.disconnect()
        
        # 连接新适配器
        adapter = self.adapters[adapter_name]
        success = await adapter.connect(config)
        
        if success:
            self.active_adapter = adapter
            return True
        
        return False
    
    async def disconnect_current_adapter(self) -> bool:
        """断开当前适配器"""
        if self.active_adapter:
            success = await self.active_adapter.disconnect()
            if success:
                self.active_adapter = None
            return success
        return True
    
    async def get_available_topics(self) -> list[Dict[str, str]]:
        """获取当前适配器的可用话题"""
        if self.active_adapter:
            return await self.active_adapter.get_available_topics()
        return []
    
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅话题"""
        if self.active_adapter:
            return await self.active_adapter.subscribe_topic(topic, message_type)
        return False
    
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅话题"""
        if self.active_adapter:
            return await self.active_adapter.unsubscribe_topic(topic)
        return False
    
    def get_connection_status(self) -> Dict[str, Any]:
        """获取连接状态"""
        if self.active_adapter:
            return {
                'connected': self.active_adapter.is_connected,
                'adapter': type(self.active_adapter).__name__,
                'config': self.active_adapter.config,
                'subscribed_topics': list(self.active_adapter.subscribed_topics.keys())
            }
        return {
            'connected': False,
            'adapter': None,
            'config': {},
            'subscribed_topics': []
        }
    
    def add_data_callback(self, callback: Callable):
        """添加数据回调"""
        self.data_callbacks.append(callback)
    
    def remove_data_callback(self, callback: Callable):
        """移除数据回调"""
        if callback in self.data_callbacks:
            self.data_callbacks.remove(callback)
    
    async def _on_adapter_data(self, topic: str, data: Any):
        """适配器数据回调"""
        # 通知所有注册的回调函数
        for callback in self.data_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(topic, data)
                else:
                    callback(topic, data)
            except Exception as e:
                print(f"Error in data callback: {e}")