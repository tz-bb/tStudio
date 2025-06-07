import { writable } from 'svelte/store';

class ConnectionStore {
    constructor() {
        this.store = writable({
            adapter: null,
            status: 'disconnected',
            config: {},
            error: null,
            availableAdapters: [],
            availableTopics: [],
            subscribedTopics: []
        });
    }
    
    async loadAvailableAdapters() {
        try {
            const response = await fetch('/api/adapters');
            const data = await response.json();
            
            this.store.update(state => ({
                ...state,
                availableAdapters: data.adapters
            }));
        } catch (error) {
            console.error('Failed to load adapters:', error);
        }
    }
    
    async connect(adapterType, config) {
        try {
            this.store.update(state => ({ ...state, status: 'connecting' }));
            
            const response = await fetch('/api/connection/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adapter: adapterType, config })
            });
            
            if (response.ok) {
                this.store.update(state => ({
                    ...state,
                    adapter: adapterType,
                    status: 'connected',
                    config,
                    error: null
                }));
                
                // 加载可用话题
                await this.loadAvailableTopics();
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Connection failed');
            }
        } catch (error) {
            this.store.update(state => ({
                ...state,
                status: 'error',
                error: error.message
            }));
            return false;
        }
    }
    
    async disconnect() {
        try {
            const response = await fetch('/api/connection/disconnect', {
                method: 'POST'
            });
            
            if (response.ok) {
                this.store.update(state => ({
                    ...state,
                    adapter: null,
                    status: 'disconnected',
                    config: {},
                    error: null,
                    availableTopics: [],
                    subscribedTopics: []
                }));
                return true;
            }
        } catch (error) {
            console.error('Disconnect failed:', error);
            return false;
        }
    }
    
    async loadAvailableTopics() {
        try {
            const response = await fetch('/api/topics');
            const data = await response.json();
            
            this.store.update(state => ({
                ...state,
                availableTopics: data.topics
            }));
        } catch (error) {
            console.error('Failed to load topics:', error);
        }
    }
    
    async subscribeTopic(topic, messageType = null) {
        try {
            // 确保topic是字符串类型
            const topicName = typeof topic === 'string' ? topic : topic.name;
            const topicType = messageType || (typeof topic === 'object' ? topic.type : null);
            
            console.log('Subscribing to topic:', { topic: topicName, message_type: topicType });
            
            const response = await fetch('/api/topics/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic: topicName, 
                    message_type: topicType 
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.store.update(state => ({
                    ...state,
                    subscribedTopics: [...state.subscribedTopics, topicName]
                }));
                return true;
            } else {
                const errorData = await response.json();
                console.error('Subscribe failed:', errorData);
                this.store.update(state => ({
                    ...state,
                    error: `订阅失败: ${errorData.detail || 'Unknown error'}`
                }));
                return false;
            }
        } catch (error) {
            console.error('Subscribe failed:', error);
            this.store.update(state => ({
                ...state,
                error: `订阅失败: ${error.message}`
            }));
            return false;
        }
    }
    
    async unsubscribeTopic(topic) {
        try {
            console.log('取消订阅话题:', topic); // 添加调试日志
            
            // 修改为使用查询参数而不是路径参数
            const response = await fetch(`/api/topics/unsubscribe?topic=${encodeURIComponent(topic)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                this.store.update(state => ({
                    ...state,
                    subscribedTopics: state.subscribedTopics.filter(t => t !== topic)
                }));
                return true;
            } else {
                const errorData = await response.json();
                console.error('取消订阅失败:', response.status, errorData);
                this.store.update(state => ({
                    ...state,
                    error: `取消订阅失败: ${errorData.detail || 'Unknown error'}`
                }));
                return false;
            }
        } catch (error) {
            console.error('Unsubscribe failed:', error);
            this.store.update(state => ({
                ...state,
                error: `取消订阅失败: ${error.message}`
            }));
            return false;
        }
    }
    
    subscribe(callback) {
        return this.store.subscribe(callback);
    }
}

// 创建并导出 store 实例
export const connectionStore = new ConnectionStore();

// 导出 store 的 subscribe 方法以便在组件中使用
export const connectionState = connectionStore.store;