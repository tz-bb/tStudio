from abc import ABC, abstractmethod
from typing import Dict, Any, Callable, Optional, List
import asyncio
from datetime import datetime
from plugins.plugin_manager import PluginManager

class BaseAdapter(ABC):
    """数据源适配器基类"""
    
    def __init__(self):
        # 基础属性
        self.callbacks: List[Callable] = []
        self.is_connected = False
        self.config = {}
        self.subscribed_topics = {}
        
        # 批处理相关属性
        self.enable_batching = False
        self.update_frequency = 30.0  # Hz
        self.message_buffer = {}
        self.buffer_lock = None  # 延迟初始化
        self.batch_update_task = None
        
        # 插件系统
        self.plugin_manager = PluginManager()
        self.plugins_initialized = False
    
    async def _ensure_async_resources(self):
        """确保异步资源已初始化"""
        if self.buffer_lock is None:
            self.buffer_lock = asyncio.Lock()
        
        # 初始化插件系统
        if not self.plugins_initialized:
            import os
            plugins_dir = os.path.join(os.path.dirname(__file__), '..', 'plugins')
            await self.plugin_manager.initialize(plugins_dir)
            self.plugins_initialized = True
    
    def enable_message_batching(self, frequency: float = 30.0):
        """启用消息批处理（仅设置标志，不创建任务）"""
        self.enable_batching = True
        self.update_frequency = frequency
    
    def disable_message_batching(self):
        """禁用消息批处理"""
        self.enable_batching = False
    
    async def _start_batch_update_task(self):
        """启动批处理任务（在连接后调用）"""
        if self.enable_batching and (self.batch_update_task is None or self.batch_update_task.done()):
            await self._ensure_async_resources()
            self.batch_update_task = asyncio.create_task(self._batch_update_loop())
    
    async def _stop_batch_update_task(self):
        """停止批处理任务"""
        if self.batch_update_task and not self.batch_update_task.done():
            self.batch_update_task.cancel()
            try:
                await self.batch_update_task
            except asyncio.CancelledError:
                pass
            self.batch_update_task = None
    
    async def _buffer_message(self, topic: str, data: dict, message_type: str = None):
        """缓冲消息或直接发送（集成插件处理）"""
        await self._ensure_async_resources()
        
        # 通过插件系统处理消息
        processed_data = await self._process_through_plugins(topic, message_type, data)
        
        # 如果插件返回None，表示消息被过滤
        if processed_data is None:
            return
        
        if self.enable_batching:
            async with self.buffer_lock:
                self.message_buffer[topic] = processed_data
        else:
            # 直接发送
            await self._notify_callbacks(topic, processed_data)
    
    async def _process_through_plugins(self, topic: str, message_type: str, data: dict) -> Optional[dict]:
        """通过插件系统处理消息"""
        try:
            if self.plugins_initialized:
                return await self.plugin_manager.process_message(topic, message_type or 'unknown', data)
            return data
        except Exception as e:
            print(f"Error processing message through plugins: {e}")
            return data
    
    async def _batch_update_loop(self):
        """批量更新循环"""
        update_interval = 1.0 / self.update_frequency
        
        while True:
            try:
                await asyncio.sleep(update_interval)
                
                # 如果批处理被禁用或适配器未连接，跳过处理
                if not self.enable_batching or not self.is_connected:
                    continue
                
                async with self.buffer_lock:
                    if not self.message_buffer:
                        continue
                    
                    # 获取所有缓冲的消息
                    messages_to_send = self.message_buffer.copy()
                    self.message_buffer.clear()
                
                # 发送批量更新
                for topic, data in messages_to_send.items():
                    await self._notify_callbacks(topic, data)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in batch update loop: {e}")
    
    # 抽象方法 - 子类必须实现
    @classmethod
    @abstractmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        """获取适配器配置模式"""
        pass
    
    @classmethod
    def get_display_name(cls) -> str:
        """获取适配器显示名称"""
        return cls.__name__
    
    @classmethod
    def get_description(cls) -> str:
        """获取适配器描述"""
        return cls.__doc__ or ""
    
    @abstractmethod
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到数据源"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """断开连接（添加插件清理）"""
        # 停止批处理任务
        await self._stop_batch_update_task()
        
        # 清理插件
        if self.plugins_initialized:
            await self.plugin_manager.cleanup()
            self.plugins_initialized = False
        
        # 子类实现具体的断开逻辑
        return await self._disconnect_impl()
    
    @abstractmethod
    async def _disconnect_impl(self) -> bool:
        """子类实现具体的断开逻辑"""
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
    
    # 通用方法 - 子类可以直接使用
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
            "last_update": datetime.now().isoformat(),
            "batching_enabled": self.enable_batching,
            "update_frequency": self.update_frequency
        }