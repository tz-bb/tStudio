import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import ParameterService from './ParameterService';
import { pluginManager } from '../components/plugins'; // 导入插件管理器

class VizConfigManager {
    constructor(configName, setVizConfigs) {
        this.category = 'viz';
        this.configName = configName;
        this.originalConfig = null; // To track changes
        this.setVizConfigs = setVizConfigs;
    }

    async loadConfig() {
        try {
            const configData = await ParameterService.loadConfig(this.category, this.configName, true);
            this.originalConfig = _.cloneDeep(configData);
            this.setVizConfigs(_.cloneDeep(configData));
            return configData; // Return the loaded data
        } catch (error) {
            console.error(`Failed to load config ${this.configName}:`, error);
            throw error;
        }
    }

    // All methods now accept vizConfigs as the first argument
    _addTopic(vizConfigs, topicName, topicType) {
        try {
            console.log("in _addTopic: ", vizConfigs, topicName, topicType);
            const normalize = (s) => (typeof s === 'string' ? s.replace('/msg/', '/') : s);
            const normalizedType = normalize(topicType);
            const templateData = pluginManager.getConfigTemplateByType(normalizedType) || pluginManager.getConfigTemplateByType(topicType);
            const newTopicData = templateData || {};

            _.set(newTopicData, 'topic_name', { __value__: topicName, __metadata__: { type: 'string', readonly: false } });
            _.set(newTopicData, 'topic_type', { __value__: topicType, __metadata__: { type: 'string', readonly: true } });

            const topicId = `topics.topic_${uuidv4()}`;

            const newConfig = _.cloneDeep(vizConfigs);
            _.set(newConfig, topicId, newTopicData);
            this.setVizConfigs(newConfig);
        } catch (error) {
            console.error(`Failed to get template for topic '${topicName}' with type '${topicType}':`, error);
            throw error;
        }
    }

    addTopicByName(vizConfigs, topicName, topicType) {
        return this._addTopic(vizConfigs, topicName, topicType);
    }

    addTopicByType(vizConfigs, topicType) {
        const shortId = uuidv4().substring(0, 4);
        const topicName = `${topicType}_${shortId}`;
        return this._addTopic(vizConfigs, topicName, topicType);
    }

    removeTopic(vizConfigs, topicId) {
        const newConfig = _.cloneDeep(vizConfigs);
        if (_.has(newConfig, topicId)) {
            _.unset(newConfig, topicId);
            this.setVizConfigs(newConfig);
        }
    }

    handleValueChange(vizConfigs, topicId, path, value) {
        const newConfig = _.cloneDeep(vizConfigs);
        const fullPath = topicId.concat(path);
        _.set(newConfig,  fullPath.concat('__value__'), value);
        this.setVizConfigs(newConfig);
    }

    getRendererPropsForTopic(vizConfigs, topicId) {
        const jsonData = _.get(vizConfigs, topicId, {});
        const originalJsonData = _.get(this.originalConfig, topicId, {});

        return {
            jsonData,
            originalJsonData,
            onValueChange: (path, value) => this.handleValueChange(vizConfigs, topicId, path, value),
        };
    }

    hasUnappliedChanges(vizConfigs) {
        return !_.isEqual(vizConfigs, this.originalConfig);
    }

    async applyChanges(vizConfigs) {
        if (!this.hasUnappliedChanges(vizConfigs)) return;

        try {
            await ParameterService.saveConfig(this.category, this.configName, vizConfigs);
            this.originalConfig = _.cloneDeep(vizConfigs);
            this.setVizConfigs(_.cloneDeep(vizConfigs));
        } catch (error) {
            console.error(`Failed to save config ${this.configName}:`, error);
            throw error;
        }
    }

    revertChanges() {
        this.setVizConfigs(_.cloneDeep(this.originalConfig));
    }
}

export default VizConfigManager;
