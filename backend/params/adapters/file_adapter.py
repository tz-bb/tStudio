import os
import json
import shutil
import aiofiles
from datetime import datetime
from typing import Dict, Any, List
from .base_adapter import BaseParameterAdapter

# 获取项目根目录 (backend目录的上一级)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, '..', '..'))

class FileParameterAdapter(BaseParameterAdapter):
    """从本地文件系统加载/保存JSON格式的参数配置。"""

    def __init__(self, config_dir: str = "configs"):
        self.base_dir = os.path.join(PROJECT_ROOT, config_dir)
        self.active_dir = os.path.join(self.base_dir, "active")
        self.backup_dir = os.path.join(self.base_dir, "backups")
        
        print(f"[FileParameterAdapter] Initialized. Active directory: {self.active_dir}")
        os.makedirs(self.active_dir, exist_ok=True)
        os.makedirs(self.backup_dir, exist_ok=True)

    def _get_path(self, name: str, use_backup=False, timestamp=None) -> str:
        """获取配置文件的路径"""
        if use_backup:
            return os.path.join(self.backup_dir, f"{name}_{timestamp}.json")
        return os.path.join(self.active_dir, f"{name}.json")

    async def list_configs(self) -> List[str]:
        """列出所有活动的配置文件。"""
        files = [f for f in os.listdir(self.active_dir) if f.endswith('.json')]
        return [os.path.splitext(f)[0] for f in files]

    async def load_config(self, name: str) -> Dict[str, Any]:
        """加载指定的活动配置文件。"""
        file_path = self._get_path(name)
        if not os.path.exists(file_path):
            return None
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            return json.loads(await f.read())

    async def save_config(self, name: str, config_data: Dict[str, Any]) -> bool:
        """保存或覆盖整个活动配置文件。"""
        file_path = self._get_path(name)
        try:
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(config_data, indent=4))
            return True
        except Exception as e:
            print(f"Error saving config '{name}': {e}")
            return False

    async def create_backup(self, name: str) -> str:
        """为指定的配置文件创建一个时间戳备份。"""
        source_path = self._get_path(name)
        if not os.path.exists(source_path):
            return None
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self._get_path(name, use_backup=True, timestamp=timestamp)
        
        try:
            shutil.copy2(source_path, backup_path)
            return os.path.basename(backup_path)
        except Exception as e:
            print(f"Error creating backup for '{name}': {e}")
            return None

    async def list_backups(self, name: str) -> List[str]:
        """列出指定配置的所有备份文件。"""
        backups = [f for f in os.listdir(self.backup_dir) if f.startswith(f"{name}_") and f.endswith('.json')]
        return sorted(backups, reverse=True)

    async def restore_from_backup(self, name: str, backup_filename: str) -> bool:
        """从指定的备份文件恢复配置。"""
        backup_path = os.path.join(self.backup_dir, backup_filename)
        active_path = self._get_path(name)

        if not os.path.exists(backup_path):
            return False
        
        try:
            shutil.copy2(backup_path, active_path)
            return True
        except Exception as e:
            print(f"Error restoring '{name}' from '{backup_filename}': {e}")
            return False