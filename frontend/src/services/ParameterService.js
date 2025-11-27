const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3500/api/params';

class ParameterService {
    // --- Generic Config/File-level Methods ---

    static async listAllConfigs() {
        const response = await fetch(`${API_BASE_URL}/configs`);
        if (!response.ok) throw new Error('Failed to list configs');
        const data = await response.json();
        return data.configs; // Returns { "category1": ["conf1", "conf2"], ... }
    }

    static async listConfigsByCategory(category) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}`);
        if (!response.ok) throw new Error(`Failed to list configs for category ${category}`);
        const data = await response.json();
        return data.configs || [];
    }

    static async loadConfig(category, name, raw = false) {
        const url = new URL(`${API_BASE_URL}/configs/${category}/${name}`);
        if (raw) {
            url.searchParams.append('raw', 'true');
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    }

    static async saveConfig(category, name, configData) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to save config ${name} in ${category}`);
        }
        return await response.json();
    }

    static async deleteConfig(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(`Failed to delete config: ${response.statusText}`);
        return await response.json();
    }

    // --- Topic Visualization Specific Methods ---

    static async createNewConfig(category, configName) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: configName }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to create new config '${configName}' in category '${category}'`);
        }
        return await response.json();
    }

    // --- Atomic Parameter-level Methods ---

    static async getParameterNode(category, configName, path, field = null) {
        const url = new URL(`${API_BASE_URL}/configs/${category}/${configName}/param`);
        if (path && path.length > 0) {
            url.searchParams.append('path', path.join(','));
        }
        if (field) {
            url.searchParams.append('field', field);
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to get parameter node at path: ${path}`);
        return await response.json();
    }

    static async addParameter(category, configName, { parentPath, paramType, name, value }) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${configName}/param`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_path: parentPath, param_type: paramType, name, value }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add parameter');
        }
        return await response.json();
    }

    static async updateParameter(category, configName, { path, value, metadata }) {
        const payload = { path };
        if (value !== undefined) payload.value = value;
        if (metadata !== undefined) payload.metadata = metadata;
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${configName}/param`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update parameter');
        }
        return await response.json();
    }

    static async deleteParameter(category, configName, path) {
        const url = new URL(`${API_BASE_URL}/configs/${category}/${configName}/param`);
        if (path && path.length > 0) {
            url.searchParams.append('path', path.join(','));
        }
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete parameter');
        }
        return await response.json();
    }

    // --- Backup and Restore Methods ---

    static async createBackup(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/backups`, {
            method: 'POST',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create backup');
        }
        return await response.json();
    }

    static async listBackups(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/backups`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to list backups');
        }
        const data = await response.json();
        return data.backups;
    }

    static async restoreBackup(category, name, backupFilename) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup_filename: backupFilename }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to restore backup');
        }
        return await response.json();
    }

    // --- Confirmable Edit Session Methods ---

    static async startConfirmableEdit(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/edit/start`, {
            method: 'POST',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to start editable session');
        }
        return await response.json();
    }

    static async revertConfirmableEdit(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/edit/revert`, {
            method: 'POST',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to revert changes');
        }
        return await response.json();
    }

    static async endConfirmableEdit(category, name) {
        const response = await fetch(`${API_BASE_URL}/configs/${category}/${name}/edit/end`, {
            method: 'POST',
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to end editable session');
        }
        return await response.json();
    }

    // --- Layout Specific Methods (using the generic methods) ---

    static async listLayouts() {
        return this.listConfigsByCategory('layouts');
    }

    static async loadLayout(name) {
        return this.loadConfig('layouts', name);
    }

    static async saveLayout(name, layoutData) {
        return this.saveConfig('layouts', name, layoutData);
    }

    static async deleteLayout(name) {
        return this.deleteConfig('layouts', name);
    }
}

export default ParameterService;
