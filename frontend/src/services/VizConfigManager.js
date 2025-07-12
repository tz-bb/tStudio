import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import ParameterService from './ParameterService';

class VizConfigManager {
    constructor(configName) {
        this.category = 'viz';
        this.configName = configName;
        this.originalConfig = null;
        this.currentConfig = null;
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    unsubscribe() {
        this.listeners = [];
    }

    notify() {
        this.listeners.forEach(callback => callback(_.cloneDeep(this.currentConfig)));
    }

    async loadConfig() {
        try {
            const configData = await ParameterService.loadConfig(this.category, this.configName, true);
            this.originalConfig = _.cloneDeep(configData);
            this.currentConfig = _.cloneDeep(configData);
            this.notify();
        } catch (error) {
            console.error(`Failed to load config ${this.configName}:`, error);
            throw error;
        }
    }

    async _addTopic(topicName, topicType) {
        try {
            // 1. Get the template from the backend without saving
            const templateData = await ParameterService.getTopicVizTemplate(topicName, topicType);

            // 2. Generate a unique ID for the new topic on the client-side
            const topicId = `topics.topic_${uuidv4()}`;

            // 3. Add the new topic to the current working configuration
            if (templateData) {
                _.set(this.currentConfig, topicId, templateData);
                this.notify(); // Notify listeners to update the UI
            } else {
                console.warn('Received empty template from server.');
            }
        } catch (error) {
            console.error(`Failed to get template for topic '${topicName}' with type '${topicType}':`, error);
            throw error;
        }
    }

    async addTopicByName(topicName, topicType) {
        // topicType will be passed from the component, which gets it from AppContext
        return this._addTopic(topicName, topicType);
    }

    async addTopicByType(topicType) {
        // Generate a descriptive name for topics added by type
        const shortId = uuidv4().substring(0, 4);
        const topicName = `${topicType}_${shortId}`;
        return this._addTopic(topicName, topicType);
    }

    removeTopic(topicId) {
        if (_.has(this.currentConfig, topicId)) {
            _.unset(this.currentConfig, topicId);
            this.notify();
        }
    }

    handleValueChange(topicId, path, value) {
        const fullPath = topicId.concat(path);
        _.set(this.currentConfig,  fullPath.concat('__value__'), value);
        this.notify();
    }

    getRendererPropsForTopic(topicId) {
        const jsonData = _.get(this.currentConfig, topicId, {});
        const originalJsonData = _.get(this.originalConfig, topicId, {});

        return {
            jsonData,
            originalJsonData,
            onValueChange: (path, value) => this.handleValueChange(topicId, path, value),
        };
    }

    hasUnappliedChanges() {
        return !_.isEqual(this.currentConfig, this.originalConfig);
    }

    async applyChanges() {
        if (!this.hasUnappliedChanges()) return;

        try {
            await ParameterService.saveConfig(this.category, this.configName, this.currentConfig);
            this.originalConfig = _.cloneDeep(this.currentConfig);
            this.notify();
        } catch (error) {
            console.error(`Failed to save config ${this.configName}:`, error);
            throw error;
        }
    }

    revertChanges() {
        this.currentConfig = _.cloneDeep(this.originalConfig);
        this.notify();
    }
}

export default VizConfigManager;