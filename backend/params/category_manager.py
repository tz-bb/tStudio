from typing import Dict, Any, List
from .adapters.file_adapter import FileParameterAdapter

class CategoryParameterManager:
    """按类别管理不同的参数适配器"""
    
    def __init__(self):
        self.adapters: Dict[str, FileParameterAdapter] = {
            'layouts': FileParameterAdapter(category='layouts'),  # 使用 'layouts'
            'algorithms': FileParameterAdapter(category='algorithms'),
            'system': FileParameterAdapter(category='system'),
            'user_preferences': FileParameterAdapter(category='user_preferences')
        }
    
    def get_adapter(self, category: str) -> FileParameterAdapter:
        if category not in self.adapters:
            # 动态创建新类别
            self.adapters[category] = FileParameterAdapter(category=category)
        return self.adapters[category]
    
    async def get_configs_list(self, category: str = 'system') -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_configs()
    
    async def get_config_data(self, name: str, category: str = 'system') -> Dict[str, Any]:
        adapter = self.get_adapter(category)
        return await adapter.load_config(name)
    
    async def save_config_data(self, name: str, config_data: Dict[str, Any], category: str = 'system') -> bool:
        adapter = self.get_adapter(category)
        return await adapter.save_config(name, config_data)
    
    async def add_parameter(self, config_name: str, path: str, param_type: str, category: str = 'system') -> bool:
        adapter = self.get_adapter(category)
        # 这里需要实现具体的参数添加逻辑
        return True
    
    async def update_parameter_value(self, config_name: str, path: str, value: Any, category: str = 'system') -> bool:
        adapter = self.get_adapter(category)
        # 这里需要实现具体的参数更新逻辑
        return True
    
    async def delete_parameter(self, config_name: str, path: str, category: str = 'system') -> bool:
        adapter = self.get_adapter(category)
        # 这里需要实现具体的参数删除逻辑
        return True
    
    async def create_manual_backup(self, config_name: str, category: str = 'system') -> str:
        adapter = self.get_adapter(category)
        return await adapter.create_backup(config_name)
    
    async def get_backup_list(self, config_name: str, category: str = 'system') -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_backups(config_name)
    
    async def restore_from_manual_backup(self, config_name: str, backup_filename: str, category: str = 'system') -> bool:
        adapter = self.get_adapter(category)
        return await adapter.restore_from_backup(config_name, backup_filename)