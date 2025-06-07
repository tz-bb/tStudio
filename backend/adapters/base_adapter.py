from abc import ABC, abstractmethod
from typing import Dict, Any, Callable, List
import asyncio
from datetime import datetime

class BaseAdapter(ABC):
    """数据源适配器基类"""
    
    def __init__(self):
        self.callbacks: List[Callable] = []
        self.is_connected = False
        self.config = {}
        self.subscribed_topics = {}
    
    @abstractmethod
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到数据源"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """断开连接"""
        pass
    
    @abstractmethod
    async def get_available_topics(self) -> List[Dict[str, str]]:
        """获取可用话题列表"""
        pass
    
    @abstractmethod
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅话题"""
        pass
    
    @abstractmethod
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅话题"""
        pass
    
    def add_data_callback(self, callback: Callable):
        """添加数据回调函数"""
        self.callbacks.append(callback)
    
    def remove_data_callback(self, callback: Callable):
        """移除数据回调函数"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    async def _notify_callbacks(self, topic: str, data: Any):
        """通知所有回调函数"""
        for callback in self.callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(topic, data)
                else:
                    callback(topic, data)
            except Exception as e:
                print(f"Callback error: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取适配器状态"""
        return {
            "connected": self.is_connected,
            "config": self.config,
            "subscribed_topics": list(self.subscribed_topics.keys()),
            "last_update": datetime.now().isoformat()
        }