import { writable } from 'svelte/store';

// 主题数据存储
export const topicsStore = writable({});

// WebSocket连接管理
class WebSocketStore {
	constructor() {
		this.ws = null;
		this.reconnectInterval = null;
	}

	connect() {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/ws`;
		
		this.ws = new WebSocket(wsUrl);
		
		this.ws.onopen = () => {
			console.log('WebSocket连接已建立');
			if (this.reconnectInterval) {
				clearInterval(this.reconnectInterval);
				this.reconnectInterval = null;
			}
		};
		
		this.ws.onmessage = (event) => {
			const message = JSON.parse(event.data);
			this.handleMessage(message);
		};
		
		this.ws.onclose = () => {
			console.log('WebSocket连接已关闭，尝试重连...');
			this.reconnect();
		};
		
		this.ws.onerror = (error) => {
			console.error('WebSocket错误:', error);
		};
	}
	
	reconnect() {
		if (!this.reconnectInterval) {
			this.reconnectInterval = setInterval(() => {
				this.connect();
			}, 3000);
		}
	}
	
	handleMessage(message) {
		switch (message.type) {
			case 'initial_data':
			case 'data_update':
				topicsStore.set(message.data);
				break;
			case 'config_update':
				topicsStore.update(topics => {
					topics[message.topic] = message.config;
					return topics;
				});
				break;
		}
	}
	
	send(message) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}
}

export const websocketStore = new WebSocketStore();

// API调用函数
export async function updateTopicConfig(topicName, config) {
	try {
		const response = await fetch(`/api/topics/${topicName}/config`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(config)
		});
		return await response.json();
	} catch (error) {
		console.error('更新配置失败:', error);
		return { error: error.message };
	}
}