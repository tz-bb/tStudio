from typing import Dict, Any, List
from .adapters.base_adapter import BaseParameterAdapter
from .adapters.file_adapter import FileParameterAdapter
from .parameter_types import get_template_for_type

# 一个简单的辅助函数，用于通过点分路径在字典中导航
def _navigate_and_set(d: Dict, path: str, value: Any, create=False):
    keys = path.split('.')
    for key in keys[:-1]:
        if key not in d and create:
            d[key] = {}
        d = d.get(key)
        if not isinstance(d, dict):
            return False # 路径无效

    target_key = keys[-1]
    # 如果路径的最后一部分是 '__value__'，我们特殊处理
    if target_key == '__value__':
        if isinstance(d, dict) and create:
            d[target_key] = value
            return True
        elif isinstance(d, dict) and target_key in d:
            d[target_key] = value
            return True
        return False

    if create or target_key in d:
        d[target_key] = value
        return True
    return False

def _navigate_and_delete(d: Dict, path: str):
    keys = path.split('.')
    for key in keys[:-1]:
        d = d.get(key)
        if not isinstance(d, dict):
            return False # 路径无效
    if keys[-1] in d:
        del d[keys[-1]]
        return True
    return False

class ParameterManager:
    """管理不同的参数源适配器。"""

    def __init__(self):
        # 目前只硬编码一个FileParameterAdapter，未来可以扩展为动态加载
        self.adapter: BaseParameterAdapter = FileParameterAdapter(config_dir="configs")

    async def get_configs_list(self) -> List[str]:
        """获取可用配置的列表。"""
        return await self.adapter.list_configs()

    async def get_config_data(self, name: str) -> Dict[str, Any]:
        """获取指定配置的数据。"""
        return await self.adapter.load_config(name)

    async def save_config_data(self, name: str, config_data: Dict[str, Any]) -> bool:
        """保存配置数据。"""
        return await self.adapter.save_config(name, config_data)

    async def add_parameter(self, config_name: str, path: str, param_type: str) -> bool:
        config = await self.adapter.load_config(config_name)
        if config is None: return False

        template = get_template_for_type(param_type)
        if template is None: return False

        if _navigate_and_set(config, path, template, create=True):
            return await self.adapter.save_config(config_name, config)
        return False

    async def update_parameter_value(self, config_name: str, path: str, value: Any) -> bool:
        config = await self.adapter.load_config(config_name)
        if config is None: return False

        # 路径需要指向 '__value__' 字段
        full_path = f"{path}.__value__"
        if _navigate_and_set(config, full_path, value):
            return await self.adapter.save_config(config_name, config)
        return False

    async def delete_parameter(self, config_name: str, path: str) -> bool:
        config = await self.adapter.load_config(config_name)
        if config is None: return False

        if _navigate_and_delete(config, path):
            return await self.adapter.save_config(config_name, config)
        return False

    async def create_manual_backup(self, config_name: str) -> str:
        return await self.adapter.create_backup(config_name)

    async def get_backup_list(self, config_name: str) -> List[str]:
        return await self.adapter.list_backups(config_name)

    async def restore_from_manual_backup(self, config_name: str, backup_filename: str) -> bool:
        return await self.adapter.restore_from_backup(config_name, backup_filename)

    # --- 自动备份与恢复逻辑 ---
    async def create_auto_backup(self, config_name: str):
        """在内存中创建一个自动备份"""
        config = await self.adapter.load_config(config_name)
        if config:
            self.auto_backup_state[config_name] = config
            print(f"[AutoBackup] Created for '{config_name}'")

    async def restore_from_auto_backup(self, config_name: str) -> bool:
        """从内存中的自动备份恢复"""
        if config_name in self.auto_backup_state:
            config_to_restore = self.auto_backup_state[config_name]
            success = await self.adapter.save_config(config_name, config_to_restore)
            if success:
                del self.auto_backup_state[config_name]
                print(f"[AutoBackup] Restored and cleared for '{config_name}'")
            return success
        return False