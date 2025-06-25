from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import asyncio
from dataclasses import dataclass

@dataclass
class PluginConfig:
    """插件配置"""
    enabled: bool = True
    priority: int = 0  # 数字越小优先级越高
    settings: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.settings is None:
            self.settings = {}

class BasePlugin(ABC):
    """插件基类"""
    
    def __init__(self, config: PluginConfig = None):
        self.config = config or PluginConfig()
        self.name = self.__class__.__name__
    
    @abstractmethod
    def get_supported_patterns(self) -> List[str]:
        """返回支持的消息模式列表
        
        格式: ["message_type#topic_name", "tf2_msgs/TFMessage#*", "*#/tf"]
        - message_type#topic_name: 精确匹配
        - message_type#*: 匹配所有该类型消息
        - *#topic_name: 匹配特定话题的所有消息类型
        - *#*: 匹配所有消息
        """
        pass
    
    @abstractmethod
    async def process_message(self, topic: str, message_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理消息
        
        Args:
            topic: 话题名称
            message_type: 消息类型
            data: 消息数据
            
        Returns:
            处理后的数据，如果返回None则表示消息被过滤掉
        """
        pass
    
    def get_priority(self) -> int:
        """获取插件优先级"""
        return self.config.priority
    
    def is_enabled(self) -> bool:
        """检查插件是否启用"""
        return self.config.enabled
    
    async def initialize(self):
        """插件初始化（可选重写）"""
        pass
    
    async def cleanup(self):
        """插件清理（可选重写）"""
        pass

# 插件注册装饰器
_registered_plugins = []

def register_plugin(plugin_class):
    """插件注册装饰器"""
    if issubclass(plugin_class, BasePlugin):
        _registered_plugins.append(plugin_class)
    return plugin_class

def get_registered_plugins():
    """获取所有注册的插件类"""
    return _registered_plugins.copy()