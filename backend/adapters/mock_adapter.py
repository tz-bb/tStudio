import asyncio
import numpy as np
from typing import Dict, Any, List
from .base_adapter import BaseAdapter
from datetime import datetime

class MockAdapter(BaseAdapter):
    """模拟数据适配器"""
    
    def __init__(self):
        super().__init__()
        self.update_task = None
        self.update_interval = 0.1  # 100ms
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        """连接到模拟数据源"""
        try:
            self.config = config
            self.update_interval = config.get('update_interval', 0.1)
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
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()
            self.subscribed_topics.clear()
            return True
        except Exception as e:
            print(f"Mock adapter disconnection error: {e}")
            return False
    
    async def get_available_topics(self) -> List[Dict[str, str]]:
        """获取可用话题列表"""
        return [
            {"name": "/point_cloud", "type": "sensor_msgs/PointCloud2"},
            {"name": "/markers", "type": "visualization_msgs/MarkerArray"},
            {"name": "/grid", "type": "nav_msgs/OccupancyGrid"},
            {"name": "/robot_pose", "type": "geometry_msgs/PoseStamped"}
        ]
    
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
                    await self._notify_callbacks(topic, data)
                
                await asyncio.sleep(self.update_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Mock adapter update error: {e}")
                await asyncio.sleep(1)
    
    def _generate_mock_data(self, topic: str) -> Dict[str, Any]:
        """生成模拟数据"""
        if topic == "/point_cloud":
            return self._generate_point_cloud()
        elif topic == "/markers":
            return self._generate_markers()
        elif topic == "/grid":
            return self._generate_grid()
        elif topic == "/robot_pose":
            return self._generate_pose()
        else:
            return {"topic": topic, "data": "mock_data", "timestamp": datetime.now().isoformat()}
    
    def _generate_point_cloud(self) -> Dict[str, Any]:
        """生成点云数据"""
        points = []
        for i in range(2000):
            x = np.random.uniform(-5, 5)
            y = np.random.uniform(-5, 5)
            z = np.random.uniform(0, 3)
            points.append([x, y, z])
        
        return {
            "type": "PointCloud",
            "points": points,
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_markers(self) -> Dict[str, Any]:
        """生成标记数据"""
        markers = []
        for i in range(10):
            marker = {
                "id": i,
                "position": [np.random.uniform(-3, 3), np.random.uniform(-3, 3), np.random.uniform(0, 2)],
                "rotation": [0, 0, 0],
                "scale": [0.5, 0.5, 0.5],
                "type": "cube",
                "color": [np.random.random(), np.random.random(), np.random.random(), 1.0]
            }
            markers.append(marker)
        
        return {
            "type": "Markers",
            "markers": markers,
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_grid(self) -> Dict[str, Any]:
        """生成网格数据"""
        return {
            "type": "Grid",
            "size": 10,
            "divisions": 10,
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_pose(self) -> Dict[str, Any]:
        """生成位姿数据"""
        return {
            "type": "Pose",
            "position": [np.random.uniform(-2, 2), np.random.uniform(-2, 2), 0],
            "orientation": [0, 0, np.random.uniform(-np.pi, np.pi)],
            "timestamp": datetime.now().isoformat()
        }