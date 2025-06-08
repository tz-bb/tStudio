const BASE_URL = 'http://localhost:3500/api';

class ApiService {
  static async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return response.json();
  }

  static async getAdapters() {
    return this.request('/adapters');
  }

  static async connect(adapter, config) {
    return this.request('/connection/connect', {
      method: 'POST',
      body: { adapter, config },
    });
  }

  static async disconnect() {
    return this.request('/connection/disconnect', {
      method: 'POST',
    });
  }

  static async getConnectionStatus() {
    return this.request('/connection/status');
  }

  static async getTopics() {
    return this.request('/topics');
  }

  static async subscribeTopic(topic, messageType) {
    return this.request('/topics/subscribe', {
      method: 'POST',
      body: { topic, message_type: messageType },
    });
  }

  static async unsubscribeTopic(topic) {
    return this.request(`/topics/unsubscribe?topic=${encodeURIComponent(topic)}`, {
      method: 'POST',
    });
  }
}

export default ApiService;