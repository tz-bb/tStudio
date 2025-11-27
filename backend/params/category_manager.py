import os
import uuid
from typing import Dict, Any, List, Optional, Set
from .adapters.file_adapter import FileParameterAdapter
from .parameter_types import ParamNode, build_param_tree, create_parameter

class CategoryParameterManager:
    """按类别管理不同的参数适配器，并使用 ParamNode 模型进行操作。"""
    
    def __init__(self):
        self.adapters: Dict[str, FileParameterAdapter] = {}
    
    def get_adapter(self, category: str) -> FileParameterAdapter:
        if category not in self.adapters:
            self.adapters[category] = FileParameterAdapter(category=category)
        return self.adapters[category]

    def dynamic_scan_categories(self) -> Set[str]:
        categories_to_check = set()
        base_path = "configs"
        if os.path.exists(base_path):
            for item in os.listdir(base_path):
                if os.path.isdir(os.path.join(base_path, item)):
                    categories_to_check.add(item)
        return (categories_to_check)

    async def _load_and_parse_config(self, config_name: str, category: str) -> Optional[ParamNode]:
        """加载配置文件并将其解析为 ParamNode 树。"""
        adapter = self.get_adapter(category)
        try:
            config_data = await adapter.load_config(config_name)
        except FileNotFoundError:
            return None
        if config_data is None:
            return None
        
        tree = build_param_tree(config_data, name=config_name)

        return tree

    async def _save_tree(self, tree: ParamNode, category: str) -> bool:
        """将 ParamNode 树序列化并保存到文件。"""
        adapter = self.get_adapter(category)
        config_data = tree.to_dict()
        return await adapter.save_config(tree.name, config_data)

    async def get_all_configs_structure(self) -> Dict[str, List[str]]:
        """获取所有类别的配置结构。"""
        structure = {}

        for category in self.dynamic_scan_categories():
            adapter = self.get_adapter(category)
            structure[category] = await adapter.list_configs()
        return structure

    async def create_new_config(self, name: str, category: str) -> ParamNode:
        adapter = self.get_adapter(category)
        existing = await adapter.load_config(name)
        if existing is not None:
            raise FileExistsError(f"Config '{name}' already exists in category '{category}'")

        empty_root = {}
        tree = build_param_tree(empty_root, name=name)
        await self._save_tree(tree, category)
        return tree
    
    async def get_configs_list(self, category: str) -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_configs()
    
    async def get_config_data(self, name: str, category: str) -> Optional[ParamNode]:
        """加载配置并返回根 ParamNode 对象。"""
        return await self._load_and_parse_config(name, category)

    async def get_parameter_node(self, config_name: str, path: List[str], category: str) -> Optional[ParamNode]:
        """获取单个参数节点。"""
        root_tree = await self._load_and_parse_config(config_name, category)
        if root_tree is None:
            return None
        return root_tree.get_child(path)
    
    async def save_config_data(self, name: str, category: str, config_data: Any) -> bool:
        """直接保存字典或原始值格式的配置数据。"""
        tree = build_param_tree(config_data, name=name)
        return await self._save_tree(tree, category)

    async def delete_config(self, name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        return await adapter.delete_config(name)

    async def add_parameter(self, config_name: str, parent_path: List[str], param_type: str, name: str, value: Any, category: str) -> bool:
        root_tree = await self._load_and_parse_config(config_name, category)
        if root_tree is None: return False
    
        parent_node = root_tree.get_child(parent_path)
        if parent_node is None or parent_node.is_value_node:
            # Cannot add child to a value node or non-existent parent
            return False

        try:
            new_param = create_parameter(param_type, name=name, value=value)
            parent_node.add_child(new_param)
            return await self._save_tree(root_tree, category)
        except (ValueError, KeyError):
            return False

    async def update_parameter_value(self, config_name: str, path: List[str], value: Any, category: str) -> bool:
        root_tree = await self._load_and_parse_config(config_name, category)
        if root_tree is None: return False

        param_node = root_tree.get_child(path)
        if param_node is None:
            return False

        param_node.value = value
        return await self._save_tree(root_tree, category)

    async def update_parameter_metadata(self, config_name: str, path: List[str], metadata: Dict[str, Any], category: str) -> bool:
        root_tree = await self._load_and_parse_config(config_name, category)
        if root_tree is None: return False

        param_node = root_tree.get_child(path)
        if param_node is None:
            return False

        param_node.metadata = metadata
        return await self._save_tree(root_tree, category)

    async def delete_parameter(self, config_name: str, path: List[str], category: str) -> bool:
        if not path:
            return False # Cannot delete the root

        root_tree = await self._load_and_parse_config(config_name, category)
        if root_tree is None: return False

        parent_path = path[:-1]
        child_name = path[-1]

        parent_node = root_tree.get_child(parent_path)

        if parent_node and child_name in parent_node.children:
            parent_node.remove_child(child_name)
            return await self._save_tree(root_tree, category)
        
        return False
    
    async def create_manual_backup(self, config_name: str, category: str) -> Optional[str]:
        adapter = self.get_adapter(category)
        return await adapter.create_backup(config_name)
    
    async def get_backup_list(self, config_name: str, category: str) -> List[str]:
        adapter = self.get_adapter(category)
        return await adapter.list_backups(config_name)
    
    async def restore_from_manual_backup(self, config_name: str, backup_filename: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        return await adapter.restore_from_backup(config_name, backup_filename)

    def _get_auto_backup_name(self, config_name: str) -> str:
        return f"{config_name}_auto_backup.json"

    async def start_confirmable_edit(self, config_name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        backup_filename = await adapter.create_backup(config_name, is_auto=True)
        return backup_filename is not None

    async def revert_confirmable_edit(self, config_name: str, category: str) -> bool:
        adapter = self.get_adapter(category)
        auto_backup_name = self._get_auto_backup_name(config_name)
        
        backups = await adapter.list_backups(config_name)
        if auto_backup_name not in backups:
            return False

        return await adapter.restore_from_backup(config_name, auto_backup_name)

    async def end_confirmable_edit(self, config_name: str, category: str):
        adapter = self.get_adapter(category)
        auto_backup_name = self._get_auto_backup_name(config_name)
        backup_path = os.path.join(adapter.backup_dir, auto_backup_name)
        if os.path.exists(backup_path):
            try:
                os.remove(backup_path)
            except OSError:
                pass # Ignore errors on cleanup
