import asyncio
import time
from typing import Dict, Any, List, Optional
from .base_adapter import BaseAdapter
import roslibpy

class ROSAdapter(BaseAdapter):
    """ROS1 数据适配器 - 通过 rosbridge 连接到 ROS1 系统"""
    
    def __init__(self):
        super().__init__()
        self.ros = None
        self.listeners = {}
        self._main_loop = None
        self.service_clients = {}
        
        # 默认启用批处理，30Hz频率
        self.enable_message_batching(30)
    
    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "fields": [
                {
                    "name": "host",
                    "type": "text",
                    "label": "ROS Bridge 主机地址",
                    "default": "localhost",
                    "required": True,
                    "placeholder": "例如: localhost 或 192.168.1.100"
                },
                {
                    "name": "port",
                    "type": "number",
                    "label": "ROS Bridge 端口",
                    "default": 9090,
                    "required": True,
                    "min": 1,
                    "max": 65535
                }
            ]
        }
    
    @classmethod
    def get_display_name(cls) -> str:
        return "ROS1 Bridge"
    
    async def connect(self, config: Dict[str, Any]) -> bool:
        try:
            # 保存主事件循环的引用
            self._main_loop = asyncio.get_event_loop()
            
            # 创建ROS连接
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
                self.is_connected = True
                self.config = config
                
                # 启动批处理任务
                await self._start_batch_update_task()
                
                print(f"Connected to ROS Bridge at {host}:{port}")
                return True
            else:
                print(f"Failed to connect to ROS Bridge at {host}:{port}")
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
            
            # 停止批处理任务
            await self._stop_batch_update_task()
            
            self.is_connected = False
            return True
            
        except Exception as e:
            print(f"ROS adapter disconnection error: {e}")
            return False
    
    async def get_available_topics(self) -> List[Dict[str, str]]:
        """获取可用话题列表"""
        if not self.is_connected or not self.ros:
            return []
        
        try:
            # 获取话题列表
            future = asyncio.Future()
            
            def callback(topics):
                if not future.done():
                    future.set_result(topics)
            
            def error_callback(error):
                if not future.done():
                    future.set_exception(Exception(error))
            
            # 调用ROS服务获取话题列表
            topics_service = roslibpy.Service(self.ros, '/rosapi/topics', 'rosapi/Topics')
            topics_service.call(roslibpy.ServiceRequest(), callback, error_callback)
            
            topics_response = await asyncio.wait_for(future, timeout=5.0)
            
            # 获取话题类型
            result = []
            for topic in topics_response.get('topics', []):
                try:
                    topic_type = await self._get_topic_type(topic)
                    result.append({
                        'name': topic,
                        'type': topic_type or 'unknown'
                    })
                except Exception as e:
                    print(f"Error getting type for topic {topic}: {e}")
                    result.append({
                        'name': topic,
                        'type': 'unknown'
                    })
            
            return result
            
        except Exception as e:
            print(f"Error getting available topics: {e}")
            return []
    
    async def subscribe_topic(self, topic: str, message_type: str = None) -> bool:
        """订阅话题"""
        if not self.is_connected or not self.ros:
            print(f"Cannot subscribe to {topic}: not connected")
            return False
        
        try:
            # 如果已经订阅，先取消订阅
            if topic in self.listeners:
                await self.unsubscribe_topic(topic)

            # 创建一个新的回调函数来处理消息
            def message_handler(message):
                # 使用 run_coroutine_threadsafe 将协程提交到主事件循环
                # 恢复调用 _handle_ros_message 来处理和转换消息
                self._handle_ros_message(topic, message_type, message)

            # 如果没有提供消息类型，动态获取
            if not message_type:
                try:
                    message_type = await self._get_topic_type(topic)
                    if not message_type:
                        print(f"Could not determine message type for topic {topic}")
                        return False
                except Exception as e:
                    print(f"Error getting message type for {topic}: {e}")
                    return False
            
            # 创建订阅者
            listener = roslibpy.Topic(self.ros, topic, message_type)
            self.listeners[topic] = listener
            
            # 订阅话题并绑定回调
            listener.subscribe(message_handler)
            
            print(f"Subscribed to topic: {topic} with type {message_type}")
            return True
            
        except Exception as e:
            print(f"Error subscribing to topic {topic}: {e}")
            return False
    
    async def unsubscribe_topic(self, topic: str) -> bool:
        """取消订阅话题"""
        try:
            if topic in self.listeners:
                # 取消订阅
                self.listeners[topic].unsubscribe()
                del self.listeners[topic]
                
                # 从订阅列表中移除
                if topic in self.subscribed_topics:
                    del self.subscribed_topics[topic]
                
                print(f"Unsubscribed from topic: {topic}")
                return True
            else:
                print(f"Topic {topic} was not subscribed")
                return False
                
        except Exception as e:
            print(f"Error unsubscribing from topic {topic}: {e}")
            return False

    async def _get_topic_type(self, topic: str) -> Optional[str]:
        """获取单个话题的消息类型"""
        try:
            future = asyncio.Future()
            
            def callback(response):
                if not future.done():
                    future.set_result(response.get('type'))
            
            def error_callback(error):
                if not future.done():
                    future.set_exception(Exception(error))
            
            type_service = roslibpy.Service(self.ros, '/rosapi/topic_type', 'rosapi/TopicType')
            type_service.call(
                roslibpy.ServiceRequest({'topic': topic}), 
                callback, 
                error_callback
            )
            
            return await asyncio.wait_for(future, timeout=2.0)
        except Exception as e:
            print(f"Error getting message type for {topic}: {e}")
            raise
    
    def _handle_ros_message(self, topic: str, message_type: str, message: dict):
        """处理ROS消息"""
        try:
            converted_data = self._convert_ros_message(topic, message, message_type)
            
            if converted_data and self._main_loop:
                # 使用基类的缓冲方法
                asyncio.run_coroutine_threadsafe(
                    self._buffer_message(topic, converted_data), 
                    self._main_loop
                )
                
        except Exception as e:
            print(f"Error handling ROS message from {topic}: {e}")
    
    def _convert_ros_message(self, topic: str, message: dict, message_type: str) -> Optional[Dict[str, Any]]:
        """转换ROS消息为统一格式"""
        try:
            return {
                'topic': topic,
                'type': 'generic',
                'message_type': message_type,
                'data': message,
                'timestamp': time.time()
            }
        except Exception as e:
            print(f"Error converting ROS message: {e}")
            return None
    
    def _on_connection(self):
        print("ROS Bridge connected")
    
    def _on_error(self, error):
        print(f"ROS Bridge error: {error}")
    
    def _on_close(self):
        print("ROS Bridge connection closed")
        self.is_connected = False