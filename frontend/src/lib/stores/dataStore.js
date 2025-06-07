import { writable } from 'svelte/store';
// 移除这行导入，因为会造成循环依赖
// import { connectionStore, topicsStore } from './connectionStore.js';

// 主题数据存储
export const topicsDataStore = writable({});

// 可视化配置存储
export const visualConfigStore = writable({
    point_cloud: {
        type: "PointCloud",
        enabled: true,
        color: "#ff0000",
        size: 0.1,
    },
    markers: {
        type: "Markers",
        enabled: true,
        color: "#00ff00",
        scale: 1.0,
    },
    grid: {
        type: "Grid",
        enabled: true,
        color: "#888888",
        size: 10,
        divisions: 10,
    }
});

// WebSocket连接管理
class WebSocketStore {
    constructor() {
        this.ws = null;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('尝试连接WebSocket:', wsUrl); // 添加调试日志
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket连接已建立');
                this.reconnectAttempts = 0;
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('WebSocket消息解析错误:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket连接已关闭');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
            this.attemptReconnect();
        }
    }

    disconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('WebSocket重连次数已达上限');
            return;
        }

        if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
                console.log(`尝试重连WebSocket (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                this.connect();
            }, 3000);
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'initial_status':
                this.handleInitialStatus(message);
                break;
            case 'data_update':
                this.handleDataUpdate(message);
                break;
            case 'config_update':
                this.handleConfigUpdate(message);
                break;
            case 'connection_status':
                this.handleConnectionStatus(message);
                break;
            case 'topic_subscribed':
            case 'topic_unsubscribed':
                this.handleTopicStatus(message);
                break;
            case 'heartbeat':
                // 心跳消息，不需要处理
                break;
            default:
                console.log('未知消息类型:', message.type);
        }
    }

    handleInitialStatus(message) {
        // 更新连接状态
        if (message.connection_status) {
            connectionStore.update(state => ({
                ...state,
                adapter: message.connection_status.active_adapter,
                connected: message.connection_status.connected,
                status: message.connection_status.connected ? 'connected' : 'disconnected'
            }));
        }

        // 更新可视化配置
        if (message.topics_config) {
            visualConfigStore.set(message.topics_config);
        }

        // 更新话题数据
        if (message.topics_data) {
            topicsDataStore.set(message.topics_data);
        }
    }

    handleDataUpdate(message) {
        console.log('收到数据更新:', message); // 添加调试日志
        topicsDataStore.update(data => {
            const newData = {
                ...data,
                [message.topic]: message.data
            };
            console.log('更新后的数据:', newData); // 添加调试日志
            return newData;
        });
    }

    handleConfigUpdate(message) {
        console.log('收到配置更新:', message); // 添加调试日志
        visualConfigStore.update(config => ({
            ...config,
            [message.topic]: message.config
        }));
    }

    handleConnectionStatus(message) {
        // 动态导入以避免循环依赖
        import('./connectionStore.js').then(({ connectionStore }) => {
            connectionStore.store.update(state => ({
                ...state,
                adapter: message.adapter,
                connected: message.connected,
                status: message.connected ? 'connected' : 'disconnected'
            }));
        });
    }

    handleTopicStatus(message) {
        console.log('收到话题状态更新:', message); // 添加调试日志
        // 动态导入以避免循环依赖
        import('./connectionStore.js').then(({ connectionStore }) => {
            if (message.type === 'topic_subscribed') {
                console.log('添加订阅话题:', message.topic);
                connectionStore.store.update(state => {
                    // 确保不重复添加
                    if (!state.subscribedTopics.includes(message.topic)) {
                        return {
                            ...state,
                            subscribedTopics: [...state.subscribedTopics, message.topic]
                        };
                    }
                    return state;
                });
            } else if (message.type === 'topic_unsubscribed') {
                console.log('移除订阅话题:', message.topic);
                connectionStore.store.update(state => {
                    const newSubscribedTopics = state.subscribedTopics.filter(t => {
                        // 支持多种匹配方式：完全匹配或去掉前缀斜杠匹配
                        return t !== message.topic && 
                               t !== message.topic.replace(/^\//, '') && 
                               t.replace(/^\//, '') !== message.topic.replace(/^\//, '');
                    });
                    console.log('更新后的订阅列表:', newSubscribedTopics);
                    return {
                        ...state,
                        subscribedTopics: newSubscribedTopics
                    };
                });
            }
        });
    }
}

export const websocketStore = new WebSocketStore();

// 更新话题配置的函数
export async function updateTopicConfig(topicName, config) {
    try {
        const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error('配置更新失败');
        }

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('更新配置错误:', error);
        return false;
    }
}