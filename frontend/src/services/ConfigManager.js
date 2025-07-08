import _ from 'lodash';
import ParameterService from './ParameterService'; // Assuming ParameterService is in the same directory

// A helper for debouncing function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

class ConfigManager {
    constructor(category, name, options = {}) {
        this.category = category;
        this.name = name;
        this.originalConfig = {};
        this.currentConfig = {};

        const { mode = 'manual', debounceWait = 100 } = options;
        this.mode = mode; // 'manual' or 'realtime'

        if (this.mode === 'realtime') {
            this.debouncedSync = debounce(this.applyChanges, debounceWait);
        }
    }

    // --- Data Loading --- 
    async loadConfig() {
        try {
            // Load the raw config data and use it directly.
            const configData = await ParameterService.loadConfig(this.category, this.name, true);
            this.originalConfig = _.cloneDeep(configData);
            this.currentConfig = _.cloneDeep(configData);
            if (this.onDataUpdate) {
                this.onDataUpdate(_.cloneDeep(this.currentConfig));
            }
        } catch (error) {
            console.error(`Failed to load config ${this.category}/${this.name}:`, error);
            // Optionally, notify UI about the error
        }
    }

    // --- Internal Methods ---

    handleValueChange = (path, value) => {
        // Update the internal cache immediately
        _.set(this.currentConfig, path.concat('__value__'), value);

        // If in real-time mode, trigger the debounced sync
        if (this.mode === 'realtime') {
            this.debouncedSync();
        }
        
        // Notify any subscribers that the data has changed, so UI can re-render
        if (this.onDataUpdate) {
            this.onDataUpdate(_.cloneDeep(this.currentConfig));
        }
    };

    // --- Public APIs ---

    /**
     * Generates the props needed for a ConfigRenderer component.
     * @param {string[]} dataPath - The path within the config to render.
     * @returns {object} Props for ConfigRenderer.
     */
    getRendererProps = (dataPath = []) => {
        const isPathValid = dataPath && dataPath.length > 0;

        const jsonData = isPathValid
            ? _.get(this.currentConfig, dataPath, {})
            : this.currentConfig;

        const originalJsonData = isPathValid
            ? _.get(this.originalConfig, dataPath, {})
            : this.originalConfig;

        return {
            jsonData,
            originalJsonData,
            onValueChange: (path, value) => {
                // We prepend the base path to the path from the renderer
                const fullPath = isPathValid ? dataPath.concat(path) : path;
                this.handleValueChange(fullPath, value);
            },
        };
    };

    /**
     * Manually triggers a sync to the backend.
     * To be used in 'manual' mode.
     */
    applyChanges = async () => {
        if (this.mode === 'manual' || this.mode === 'realtime') {
            try {
                // We pass the raw data, not the one with __is_leaf__ etc.
                const rawConfig = await ParameterService.loadConfig(this.category, this.name, true);
                // selectively update the raw config with our changes
                const updatedRawConfig = this.updateRawConfig(rawConfig, this.currentConfig);

                await ParameterService.saveConfig(this.category, this.name, updatedRawConfig);
                // After successful sync, update the original config to reflect the new baseline
                this.originalConfig = _.cloneDeep(this.currentConfig);
                
                // Notify subscribers that the data has changed, which will trigger a re-render.
                if (this.onDataUpdate) {
                    this.onDataUpdate(_.cloneDeep(this.currentConfig));
                }

                console.log('Sync to backend successful');
            } catch (error) {
                console.error(`Failed to save config ${this.category}/${this.name}:`, error);
            }
        }
    };

    // Helper to apply updates from the UI-friendly format to the raw format
    updateRawConfig(rawObj, uiObj) {
        for (const key in uiObj) {
            // A node is a parameter if it has a __value__ property.
            if (uiObj[key] && uiObj[key].hasOwnProperty('__value__')) {
                if (rawObj.hasOwnProperty(key)) {
                    // Update the value in the raw config.
                    rawObj[key].__value__ = uiObj[key].__value__;
                }
            }
            // Recurse for nested objects that are not special keys.
            else if (_.isObject(uiObj[key]) && _.isObject(rawObj[key]) && !key.startsWith('__')) {
                this.updateRawConfig(rawObj[key], uiObj[key]);
            }
        }
        return rawObj;
    }

    /**
     * Reverts all changes to the last synced state.
     */
    revertChanges = () => {
        this.currentConfig = _.cloneDeep(this.originalConfig);
        if (this.onDataUpdate) {
            this.onDataUpdate(_.cloneDeep(this.currentConfig));
        }
    };
    
    /**
     * Subscribes to data updates to allow React components to re-render.
     * @param {function} callback - The function to call with the updated config.
     */
    subscribe = (callback) => {
        this.onDataUpdate = callback;
    };

    /**
     * Unsubscribes from data updates.
     */
    unsubscribe = () => {
        this.onDataUpdate = null;
    };
}

export default ConfigManager;