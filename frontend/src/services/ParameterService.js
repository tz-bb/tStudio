const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3500/api/params';

class ParameterService {
    static async listConfigs() {
        const response = await fetch(`${API_BASE_URL}/configs`);
        if (!response.ok) throw new Error('Failed to list configs');
        const data = await response.json();
        return data.configs;
    }
    
    // 布局相关方法 - 使用新的分类API路径
    static async listLayouts() {
        const response = await fetch(`${API_BASE_URL}/configs/category/layouts`);
        if (!response.ok) {
            throw new Error(`Failed to fetch layouts: ${response.statusText}`);
        }
        const data = await response.json();
        return data.configs || [];
    }

    static async saveLayout(name, layoutData) {
        const response = await fetch(`${API_BASE_URL}/configs/category/layouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                data: layoutData
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save layout: ${response.statusText}`);
        }
        
        return await response.json();
    }

    static async loadLayout(name) {
        const response = await fetch(`${API_BASE_URL}/configs/category/layouts/${name}`);
        if (!response.ok) {
            throw new Error(`Failed to load layout: ${response.statusText}`);
        }
        return await response.json();
    }

    static async deleteLayout(name) {
        const response = await fetch(`${API_BASE_URL}/configs/category/layouts/${name}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete layout: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    // 算法配置相关方法
    static async listAlgorithmConfigs() {
        const response = await fetch(`${API_BASE_URL}/configs/algorithms`);
        if (!response.ok) throw new Error('Failed to list algorithm configs');
        const data = await response.json();
        return data.configs;
    }
}

export default ParameterService;