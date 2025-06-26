from typing import Dict, Any, Optional, List
from . import BasePlugin, register_plugin, PluginConfig

@register_plugin
class TFMessagePlugin(BasePlugin):
    """TF消息处理插件"""
    
    def __init__(self, config: PluginConfig = None):
        super().__init__(config)
        self.tf_buffer = {}  # 按child_frame_id缓存最新的TF数据
    
    def get_supported_patterns(self) -> List[str]:
        return [
            "tf2_msgs/TFMessage#/tf",
            "tf2_msgs/TFMessage#/tf_static"
        ]
    
    async def process_message(self, topic: str, message_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理TF消息，合并相同frame_id的变换"""
        try:
            message_data = data.get('data', {})
            transforms = message_data.get('transforms', [])
            
            if not transforms:
                return data
            
            # 合并TF变换到缓冲区
            for transform in transforms:
                child_frame_id = transform.get('child_frame_id')
                if child_frame_id:
                    self.tf_buffer[child_frame_id] = transform
            
            # 创建合并后的消息
            merged_data = data.copy()
            merged_data['data'] = {
                'transforms': list(self.tf_buffer.values())
            }
            merged_data['type'] = 'tf_merged'
            
            return merged_data
            
        except Exception as e:
            print(f"Error processing TF message: {e}")
            return data

@register_plugin
class MessageLoggerPlugin(BasePlugin):
    """消息日志插件示例"""
    
    def __init__(self, config: PluginConfig = None):
        super().__init__(config)
        self.message_count = 0
    
    def get_supported_patterns(self) -> List[str]:
        return ["*#*"]  # 处理所有消息
    
    async def process_message(self, topic: str, message_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """记录消息统计"""
        self.message_count += 1

        # 添加处理时间戳
        if 'metadata' not in data:
            data['metadata'] = {}
        data['metadata']['processed_at'] = self.message_count
        
        return data