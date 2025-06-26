from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseParameterAdapter(ABC):
    """参数适配器的抽象基类"""

    @abstractmethod
    async def list_configs(self) -> List[str]:
        """列出所有可用的配置。"""
        pass

    @abstractmethod
    async def load_config(self, name: str) -> Dict[str, Any]:
        """加载指定的配置。"""
        pass

    @abstractmethod
    async def save_config(self, name: str, config_data: Dict[str, Any]) -> bool:
        """保存指定的配置。"""
        pass