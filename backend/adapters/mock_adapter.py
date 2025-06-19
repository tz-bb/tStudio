import asyncio
import numpy as np
import time
from typing import Dict, Any, List
from .base_adapter import BaseAdapter
from datetime import datetime

class MockAdapter(BaseAdapter):
    """模拟数据适配器 - 用于测试和演示"""
    
    def __init__(self):
        super().__init__()
        self.update_task = None
        self.update_interval = 0.1

        self.__text_count = 0
    
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "fields": [
                {
                    "name": "update_interval",
                    "type": "number",
                    "label": "更新间隔 (秒)",
                    "default": 0.1,
                    "required": True,
                    "min": 0.01,
                    "max": 10.0,
                    "step": 0.01
                },
                {
                    "name": "enable_batching",
                    "type": "boolean",
                    "label": "启用批处理",
                    "default": False,
                    "required": False
                }
            ]
        }
    
    @classmethod
    def get_display_name(cls) -> str:
        return "模拟数据源"
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到模拟数据源"""
        try:
            self.config = config
            self.update_interval = config.get('update_interval', 0.1)
            
            # 根据配置决定是否启用批处理
            if config.get('enable_batching', False):
                self.enable_message_batching(10)  # 10Hz批处理
                await self._start_batch_update_task()
            
            self.is_connected = True
            
            # 启动数据更新任务
            if self.update_task is None or self.update_task.done():
                self.update_task = asyncio.create_task(self._update_loop())
            
            return True
        except Exception as e:
            print(f"Mock adapter connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """断开连接"""
        try:
            self.is_connected = False
            
            # 停止更新任务
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()
                try:
                    await self.update_task
                except asyncio.CancelledError:
                    pass
                self.update_task = None
            
            # 停止批处理任务
            await self._stop_batch_update_task()
            
            # 清理订阅
            self.subscribed_topics.clear()
            
            return True
        except Exception as e:
            print(f"Mock adapter disconnection error: {e}")
            return False
    
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅话题"""
        try:
            self.subscribed_topics[topic] = {
                "type": message_type or "unknown",
                "subscribed_at": datetime.now().isoformat()
            }
            return True
        except Exception as e:
            print(f"Mock adapter subscription error: {e}")
            return False
    
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅话题"""
        try:
            if topic in self.subscribed_topics:
                del self.subscribed_topics[topic]
            return True
        except Exception as e:
            print(f"Mock adapter unsubscription error: {e}")
            return False
    
    async def _update_loop(self):
        """数据更新循环"""
        while self.is_connected:
            try:
                # 为每个订阅的话题生成数据
                for topic in self.subscribed_topics.keys():
                    data = self._generate_mock_data(topic)
                    await self._buffer_message(topic, data)
                
                await asyncio.sleep(self.update_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Mock adapter update error: {e}")
                await asyncio.sleep(1)
    
    # 在mock_adapter中添加TF数据生成
    
    def _generate_tf_data(self, topic: str) -> Dict[str, Any]:
        """生成模拟TF数据"""
        import math
        
        current_time = time.time()
        
        # 生成一些示例TF变换
        transforms = [
            {
                "header": {
                    "stamp": {
                        "sec": int(current_time),
                        "nsec": int((current_time % 1) * 1e9)
                    },
                    "frame_id": "base_link"
                },
                "child_frame_id": "laser_frame",
                "transform": {
                    "translation": {
                        "x": 0.1,
                        "y": 0.0,
                        "z": 0.2
                    },
                    "rotation": {
                        "x": 0.0,
                        "y": 0.0,
                        "z": math.sin(current_time * 0.5) * 0.1,
                        "w": math.cos(current_time * 0.5) * 0.1
                    }
                }
            },
            {
                "header": {
                    "stamp": {
                        "sec": int(current_time),
                        "nsec": int((current_time % 1) * 1e9)
                    },
                    "frame_id": "base_link"
                },
                "child_frame_id": "camera_frame",
                "transform": {
                    "translation": {
                        "x": 0.0,
                        "y": 0.0,
                        "z": 0.5
                    },
                    "rotation": {
                        "x": 0.0,
                        "y": 0.0,
                        "z": 0.0,
                        "w": 1.0
                    }
                }
            }
        ]
        
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'tf2_msgs/TFMessage',
            'data': {
                'transforms': transforms
            },
            'timestamp': current_time
        }
    
    # 在get_available_topics中添加
    async def get_available_topics(self) -> List[Dict[str, str]]:
        return [
            {"name": "/point_cloud", "type": "sensor_msgs/PointCloud2"},
            {"name": "/markers", "type": "visualization_msgs/MarkerArray"},
            {"name": "/grid", "type": "nav_msgs/OccupancyGrid"},
            {"name": "/robot_pose", "type": "geometry_msgs/PoseStamped"},
            {"name": "/text_test", "type": "std_msgs/String"},
            {"name": "/tf", "type": "tf2_msgs/TFMessage"}
        ]
    
    # 在_generate_mock_data中添加处理
    def _generate_mock_data(self, topic: str) -> Dict[str, Any]:
        """生成模拟数据"""
        if topic == "/point_cloud":
            return self._generate_point_cloud(topic)
        elif topic == "/markers":
            return self._generate_markers(topic)
        elif topic == "/grid":
            return self._generate_grid(topic)
        elif topic == "/robot_pose":
            return self._generate_pose(topic)
        elif topic == "/text_test":
            return self._generate_text(topic)
        elif topic == "/tf":
            return self._generate_tf_data(topic)
        else:
            return {
                'topic': topic,
                'type': 'generic',
                'message_type': 'unknown',
                'data': {"topic": topic, "data": "mock_data"},
                'timestamp': time.time()
            }
    
    def _generate_point_cloud(self, topic: str) -> Dict[str, Any]:
        """生成点云数据"""
        points = []
        for i in range(2000):
            x = np.random.uniform(-5, 5)
            y = np.random.uniform(-5, 5)
            z = np.random.uniform(0, 3)
            points.append({"x": x, "y": y, "z": z})
        
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'sensor_msgs/PointCloud2',
            'data': {
                "type": "PointCloud",
                "points": points
            },
            'timestamp': time.time()
        }
    
    def _generate_markers(self, topic: str) -> Dict[str, Any]:
        """生成标记数据"""
        markers = []
        for i in range(10):
            marker = {
                "id": i,
                "position": {
                    "x": np.random.uniform(-3, 3),
                    "y": np.random.uniform(-3, 3),
                    "z": np.random.uniform(0, 2)
                },
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 0.5, "y": 0.5, "z": 0.5},
                "type": "cube",
                "color": {
                    "r": np.random.random(),
                    "g": np.random.random(),
                    "b": np.random.random(),
                    "a": 1.0
                }
            }
            markers.append(marker)
        
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'visualization_msgs/MarkerArray',
            'data': {
                "type": "Markers",
                "markers": markers
            },
            'timestamp': time.time()
        }
    
    def _generate_grid(self, topic: str) -> Dict[str, Any]:
        """生成网格数据"""
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'nav_msgs/OccupancyGrid',
            'data': {
                "type": "Grid",
                "size": 10,
                "divisions": 10
            },
            'timestamp': time.time()
        }
    
    def _generate_pose(self, topic: str) -> Dict[str, Any]:
        """生成位姿数据"""
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'geometry_msgs/PoseStamped',
            'data': {
                "type": "Pose",
                "pose": {
                    "position": {
                        "x": np.random.uniform(-2, 2),
                        "y": np.random.uniform(-2, 2),
                        "z": 0
                    },
                    "orientation": {
                        "x": 0,
                        "y": 0,
                        "z": np.random.uniform(-np.pi, np.pi),
                        "w": 1
                    }
                }
            },
            'timestamp': time.time()
        }
    
    def _generate_text(self, topic: str) -> Dict[str, Any]:
        self.__text_count += 1
        """生成文本数据"""
        return {
            'topic': topic,
            'type': 'generic',
            'message_type': 'std_msgs/String',
            'data': {
                "data": f"Hello, World!,{self.__text_count}"
            },
            'timestamp': time.time()
        }