import os
from typing import Dict, Any, List
from .adapters.file_adapter import FileParameterAdapter
from .parameter_types import create_parameter

# 辅助函数，用于在嵌套字典中按路径导航
def _navigate(d: Dict, path: str, create: bool = False):
    keys = path.split('.')
    for key in keys[:-1]:
        if key not in d and create:
            d[key] = {}
        d = d.get(key)
        if not isinstance(d, dict):
            return None, None, None
    return d, keys[-1], keys

class CategoryParameterManager:
    """按类别管理不同的参数适配器"""
    
    def __init__(self):
        self.adapters: Dict[str, FileParameterAdapter] = {}
        # 预加载一些常用类别
        for category in ['layouts', 'algorithms', 'system', 'user_preferences']:
            self.get_adapter(category)
    
    def get_adapter(self, category: str) -> FileParameterAdapter:
        if category not in self.adapters:
            self.adapters[category] = FileParameterAdapter(category=category)
        return self.adapters[category]
    
    async def get_configs_list(self, category: str) -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_configs()
    
    async def get_config_data(self, name: str, category: str) -> Dict[str, Any]:
        adapter = self.get_adapter(category)
        config = await adapter.load_config(name)
        if config is None:
            return None  # Let the API layer handle the 404 response
        return config
    
    async def save_config_data(self, name: str, config_data: Dict[str, Any], category: str) -> bool:
        adapter = self.get_adapter(category)
        return await adapter.save_config(name, config_data)

    async def delete_config(self, name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        return await adapter.delete_config(name)

    async def add_parameter(self, config_name: str, path: str, param_type: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        config = await adapter.load_config(config_name)
        if config is None: return False

        try:
            param_instance = create_parameter(param_type)
            parent, key, _ = _navigate(config, path, create=True)
            if parent is None or key is None:
                return False
            parent[key] = param_instance.model_dump()
            return await adapter.save_config(config_name, config)
        except ValueError:
            return False # 无效的参数类型

    async def update_parameter_value(self, config_name: str, path: str, value: Any, category: str) -> bool:
        adapter = self.get_adapter(category)
        config = await adapter.load_config(config_name)
        if config is None: 
            return False # 配置不存在

        # 路径需要指向 'value' 字段
        full_path = f"{path}.value"
        parent, key, _ = _navigate(config, full_path)
        if parent is None or key not in parent:
            # 当路径的任何部分无效或最终的 'value' 键不存在时，我们认为参数不存在
            # 导航函数将返回 parent=None
            return False # 参数路径不存在
        
        parent[key] = value
        return await adapter.save_config(config_name, config)

    async def delete_parameter(self, config_name: str, path: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        config = await adapter.load_config(config_name)
        if config is None: return False

        parent, key, _ = _navigate(config, path)
        if parent is not None and key in parent:
            del parent[key]
            return await adapter.save_config(config_name, config)
        return False
    
    async def create_manual_backup(self, config_name: str, category: str) -> str:
        adapter = self.get_adapter(category)
        return await adapter.create_backup(config_name)
    
    async def get_backup_list(self, config_name: str, category: str) -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_backups(config_name)
    
    async def restore_from_manual_backup(self, config_name: str, backup_filename: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        return await adapter.restore_from_backup(config_name, backup_filename)

    # --- 自动备份与恢复逻辑 ---
    def _get_auto_backup_name(self, config_name: str) -> str:
        return f"{config_name}_auto_backup.json"

    async def start_confirmable_edit(self, config_name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        backup_filename = await adapter.create_backup(config_name, is_auto=True)
        return backup_filename is not None

    async def revert_confirmable_edit(self, config_name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        auto_backup_name = self._get_auto_backup_name(config_name)
        
        # 检查备份是否存在
        backups = await adapter.list_backups(config_name)
        if auto_backup_name not in backups:
            return False

        return await adapter.restore_from_backup(config_name, auto_backup_name)

    async def end_confirmable_edit(self, config_name: str, category: str):
        adapter = self.get_adapter(category)
        auto_backup_name = self._get_auto_backup_name(config_name)
        backup_path = os.path.join(adapter.backup_dir, auto_backup_name)
        if os.path.exists(backup_path):
            os.remove(backup_path)