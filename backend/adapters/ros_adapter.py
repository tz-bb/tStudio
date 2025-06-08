import asyncio
import time  # 添加这个导入
from typing import Dict, Any, List, Optional, Callable
from .base_adapter import BaseAdapter
import roslibpy

class ROSAdapter(BaseAdapter):
    """ROS1 数据适配器"""
    
    def __init__(self):
        super().__init__()
        self.ros = None
        self.listeners = {}
        self._main_loop = None  # 添加这行
        self.service_clients = {}
        
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            # 保存主事件循环的引用
            self._main_loop = asyncio.get_event_loop()
            
            host = config.get('host', 'localhost')
            port = config.get('port', 9090)
            
            self.ros = roslibpy.Ros(host=host, port=port)
            
            # 设置连接回调
            self.ros.on('connection', self._on_connection)
            self.ros.on('error', self._on_error)
            self.ros.on('close', self._on_close)
            
            # 连接到ROS Bridge
            self.ros.run()
            
            # 等待连接建立
            await asyncio.sleep(1)
            
            if self.ros.is_connected:
                self.config = config
                self.is_connected = True
                return True
            else:
                return False
                
        except Exception as e:
            print(f"ROS adapter connection error: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """断开ROS连接"""
        try:
            # 取消所有订阅
            for topic_name in list(self.listeners.keys()):
                await self.unsubscribe_topic(topic_name)
            
            # 关闭ROS连接
            if self.ros and self.ros.is_connected:
                self.ros.close()
            
            self.is_connected = False
            return True
            
        except Exception as e:
            print(f"ROS adapter disconnection error: {e}")
            return False
    
    async def get_available_topics(self) -> List[Dict[str, str]]:
        """获取ROS话题列表"""
        if not self.ros or not self.ros.is_connected:
            return []
        
        try:
            # 创建服务客户端获取话题列表
            service = roslibpy.Service(self.ros, '/rosapi/topics', 'rosapi/Topics')
            
            # 异步调用服务
            topics_response = await self._call_service_async(service, {})
            
            if topics_response and 'topics' in topics_response:
                topics = []
                for topic_name in topics_response['topics']:
                    # 获取话题类型
                    type_service = roslibpy.Service(self.ros, '/rosapi/topic_type', 'rosapi/TopicType')
                    type_response = await self._call_service_async(type_service, {'topic': topic_name})
                    
                    topic_type = type_response.get('type', 'unknown') if type_response else 'unknown'
                    topics.append({
                        'name': topic_name,
                        'type': topic_type
                    })
                
                return topics
            
            return []
            
        except Exception as e:
            print(f"Error getting ROS topics: {e}")
            return []
    
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅ROS话题"""
        if not self.ros or not self.ros.is_connected:
            print(f"ROS not connected when trying to subscribe to {topic}")
            return False
        
        try:
            # 如果已经订阅，先取消订阅
            if topic in self.listeners:
                await self.unsubscribe_topic(topic)
            
            # 如果没有提供消息类型，尝试获取
            if not message_type:
                print(f"Getting message type for topic: {topic}")
                type_service = roslibpy.Service(self.ros, '/rosapi/topic_type', 'rosapi/TopicType')
                type_response = await self._call_service_async(type_service, {'topic': topic})
                
                if type_response and 'type' in type_response:
                    message_type = type_response['type']
                    print(f"Found message type for {topic}: {message_type}")
                else:
                    print(f"Could not get message type for topic: {topic}, response: {type_response}")
            
            if not message_type:
                print(f"Could not determine message type for topic: {topic}")
                return False
            
            print(f"Creating listener for topic: {topic} with type: {message_type}")
            
            # 创建话题监听器
            listener = roslibpy.Topic(self.ros, topic, message_type)
            
            # 设置消息回调
            listener.subscribe(lambda message: self._handle_ros_message(topic, message_type, message))
            
            self.listeners[topic] = listener
            self.subscribed_topics[topic] = {
                'type': message_type,
                'subscribed_at': asyncio.get_event_loop().time()
            }
            
            print(f"Successfully subscribed to topic: {topic}")
            return True
            
        except Exception as e:
            print(f"Error subscribing to topic {topic}: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅ROS话题"""
        try:
            if topic in self.listeners:
                self.listeners[topic].unsubscribe()
                del self.listeners[topic]
            
            if topic in self.subscribed_topics:
                del self.subscribed_topics[topic]
            
            return True
            
        except Exception as e:
            print(f"Error unsubscribing from topic {topic}: {e}")
            return False
    
    def _handle_ros_message(self, topic: str, message_type: str, message: dict):
        """处理ROS消息"""
        try:
            # 转换ROS消息为tStudio格式
            converted_data = self._convert_ros_message(topic, message, message_type)  # 修复：调整参数顺序
            
            if converted_data and self._main_loop:
                # 使用保存的主事件循环来调度异步任务
                asyncio.run_coroutine_threadsafe(
                    self._notify_callbacks(topic, converted_data), self._main_loop
                )
                
        except Exception as e:
            print(f"Error handling ROS message from {topic}: {e}")
    
    def _convert_ros_message(self, topic: str, message: dict, message_type: str) -> Optional[Dict[str, Any]]:
        """转换ROS消息为统一格式"""
        try:
            # if message_type == 'sensor_msgs/PointCloud2':
            #     return self._convert_pointcloud2(message)
            # elif message_type == 'visualization_msgs/MarkerArray':
            #     return self._convert_marker_array(message)
            # elif message_type == 'geometry_msgs/PoseStamped':
            #     return self._convert_pose_stamped(message)
            # elif message_type == 'nav_msgs/OccupancyGrid':
            #     return self._convert_occupancy_grid(message)
            # else:
            # 通用转换
            return {
                'topic': topic,
                'type': 'generic',
                'message_type': message_type,
                'data': message,
                'timestamp': time.time()  # 修复：使用 time.time() 替代 asyncio.get_event_loop().time()
            }
                
        except Exception as e:
            print(f"Error converting ROS message: {e}")
            return None
    
    def _convert_pointcloud2(self, message: dict) -> Dict[str, Any]:
        """转换PointCloud2消息"""
        # 简化的点云转换（实际实现需要解析二进制数据）
        return {
            'topic': '/point_cloud',
            'type': 'PointCloud',
            'enabled': True,
            'color': '#ff0000',
            'size': 0.1,
            'data': [],  # 这里需要实际解析点云数据
            'timestamp': time.time()  # 修复：使用 time.time() 替代 asyncio.get_event_loop().time()
        }
    
    def _convert_marker_array(self, message: dict) -> Dict[str, Any]:
        """转换MarkerArray消息"""
        markers = []
        if 'markers' in message:
            for marker in message['markers']:
                converted_marker = {
                    'id': marker.get('id', 0),
                    'position': [
                        marker.get('pose', {}).get('position', {}).get('x', 0),
                        marker.get('pose', {}).get('position', {}).get('y', 0),
                        marker.get('pose', {}).get('position', {}).get('z', 0)
                    ],
                    'rotation': [
                        marker.get('pose', {}).get('orientation', {}).get('x', 0),
                        marker.get('pose', {}).get('orientation', {}).get('y', 0),
                        marker.get('pose', {}).get('orientation', {}).get('z', 0)
                    ],
                    'scale': [
                        marker.get('scale', {}).get('x', 1),
                        marker.get('scale', {}).get('y', 1),
                        marker.get('scale', {}).get('z', 1)
                    ],
                    'type': 'cube'  # 简化处理
                }
                markers.append(converted_marker)
        
        return {
            'topic': '/markers',
            'type': 'Markers',
            'enabled': True,
            'color': '#00ff00',
            'scale': 1.0,
            'data': markers,
            'timestamp': time.time()  # 修复：使用 time.time() 替代 asyncio.get_event_loop().time()
        }
    
    def _convert_pose_stamped(self, message: dict) -> Dict[str, Any]:
        """转换PoseStamped消息"""
        pose = message.get('pose', {})
        position = pose.get('position', {})
        
        return {
            'topic': '/robot_pose',
            'type': 'Pose',
            'enabled': True,
            'color': '#0000ff',
            'data': {
                'position': [position.get('x', 0), position.get('y', 0), position.get('z', 0)],
                'orientation': [
                    pose.get('orientation', {}).get('x', 0),
                    pose.get('orientation', {}).get('y', 0),
                    pose.get('orientation', {}).get('z', 0),
                    pose.get('orientation', {}).get('w', 1)
                ]
            },
            'timestamp': time.time()  # 修复：使用 time.time() 替代 asyncio.get_event_loop().time()
        }
    
    def _convert_occupancy_grid(self, message: dict) -> Dict[str, Any]:
        """转换OccupancyGrid消息"""
        return {
            'topic': '/grid',
            'type': 'Grid',
            'enabled': True,
            'color': '#888888',
            'data': message,
            'timestamp': time.time()  # 修复：使用 time.time() 替代 asyncio.get_event_loop().time()
        }
    
    async def _call_service_async(self, service, request):
        """异步调用ROS服务"""
        future = asyncio.Future()
        
        def callback(response):
            if not future.done():
                future.set_result(response)
        
        def error_callback(error):
            if not future.done():
                future.set_exception(Exception(error))
        
        try:
            service.call(roslibpy.ServiceRequest(request), callback, error_callback)
            # 增加超时时间到10秒
            return await asyncio.wait_for(future, timeout=2.0)
        except asyncio.TimeoutError:
            print(f"Service call timeout for request: {request}")
            return None
        except Exception as e:
            print(f"Service call error: {e}")
            return None
    
    def _on_connection(self):
        print("ROS Bridge connected")
    
    def _on_error(self, error):
        print(f"ROS Bridge error: {error}")
    
    def _on_close(self):
        print("ROS Bridge connection closed")
        self.is_connected = False