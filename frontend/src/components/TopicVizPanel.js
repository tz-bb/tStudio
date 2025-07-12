import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Card, Button, Space, Select, Row, Col, Alert, Spin, Collapse, Typography, Checkbox, Modal, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import VizConfigManager from '../services/VizConfigManager';
import ConfigRenderer from './ConfigRenderer';
import ParameterService from '../services/ParameterService';
import { AppContext } from '../services/AppContext'; // Import AppContext
import _ from 'lodash';

const { Option } = Select;
const { Panel } = Collapse;
const { Text } = Typography;

const TopicVizPanel = ({ defaultConfigName = null }) => {
    const { topics } = useContext(AppContext); // Get topics from context

    // State for managing the selection dropdowns
    const [configList, setConfigList] = useState([]);
    const [selectedConfigName, setSelectedConfigName] = useState(defaultConfigName);

    // State for the manager and the data it provides
    const [vizManager, setVizManager] = useState(null);
    const [currentConfig, setCurrentConfig] = useState(null);

    // State for adding new topics
    const [newTopicType, setNewTopicType] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newConfigName, setNewConfigName] = useState('');
    const [pendingAction, setPendingAction] = useState(null);

    // State for topic types
    const [topicTypes, setTopicTypes] = useState([]);

    // Fetch the list of all available viz configs on component mount
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                setLoading(true);
                const configs = await ParameterService.listConfigsByCategory('viz');
                setConfigList(configs);
            } catch (err) {
                setError('Failed to load viz config list.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();

        // Fetch topic types for the dropdown
        const fetchTopicTypes = async () => {
            try {
                const types = await ParameterService.getTopicVizTemplates();
                setTopicTypes(Object.keys(types));
            } catch (err) {
                setError('Failed to load topic types.');
                console.error(err);
            }
        };
        fetchTopicTypes();
    }, []);

    // This effect runs when a new config is selected from the dropdown
    useEffect(() => {
        if (selectedConfigName) {
            setLoading(true);
            setCurrentConfig(null);

            const manager = new VizConfigManager(selectedConfigName);
            manager.subscribe(setCurrentConfig);

            manager.loadConfig().finally(() => {
                setLoading(false);
            });

            setVizManager(manager);

            return () => manager.unsubscribe();
        }
    }, [selectedConfigName]);

    const promptForNewConfig = (action) => {
        setPendingAction(() => action);
        setIsModalVisible(true);
    };

    const handleCreateConfig = async () => {
        if (!newConfigName) {
            setError('Config name cannot be empty.');
            return;
        }
        setLoading(true);
        try {
            await ParameterService.createNewVizConfig(newConfigName);
            setConfigList(prev => [...prev, newConfigName]);
            setSelectedConfigName(newConfigName);
            setIsModalVisible(false);
            if (pendingAction) {
                // The useEffect for selectedConfigName will create the new manager
                // We need to wait for it. A bit tricky.
                // A simpler way is to just let the user re-trigger the action.
                // For a better UX, we could do this:
                const newManager = new VizConfigManager(newConfigName);
                await newManager.loadConfig();
                setVizManager(newManager);
                pendingAction(newManager); // Execute pending action with the new manager
            }
            setNewConfigName('');
        } catch (err) {
            setError(`Failed to create config ${newConfigName}.`);
            console.error(err);
        } finally {
            setLoading(false);
            setPendingAction(null);
        }
    };

    const handleTopicSelectionChange = async (selectedTopics, managerOverride = null) => {
        const manager = managerOverride || vizManager;
        if (!manager) {
            promptForNewConfig(() => (newManager) => handleTopicSelectionChange(selectedTopics, newManager));
            return;
        }
        setLoading(true);
        try {
            const currentTopicsInViz = Object.values(_.get(currentConfig, 'topics', {})).map(t => _.get(t, 'topic_name.__value__'));
            const topicsToAdd = selectedTopics.filter(t => !currentTopicsInViz.includes(t));

            for (const topicName of topicsToAdd) {
                const topicInfo = topics.find(t => t.name === topicName);
                if (topicInfo) {
                    await manager.addTopicByName(topicName, topicInfo.type);
                } else {
                    console.warn(`Could not find type for topic: ${topicName}, skipping.`);
                    // Optionally, inform the user that the topic type couldn't be found.
                    setError(`Could not find type for topic: ${topicName}`);
                }
            }
            // Handle removals if necessary
            const topicsToRemove = currentTopicsInViz.filter(t => !selectedTopics.includes(t));
            for (const topicNameToRemove of topicsToRemove) {
                const topicIdToRemove = Object.keys(_.get(currentConfig, 'topics', {})).find(id => _.get(currentConfig, `topics.${id}.topic_name.__value__`) === topicNameToRemove);
                if (topicIdToRemove) {
                    manager.removeTopic(`topics.${topicIdToRemove}`);
                }
            }

        } catch (err) {
            setError(`Failed to update topic selections.`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTopicByType = async (managerOverride = null) => {
        const manager = managerOverride || vizManager;
        if (!manager) {
            promptForNewConfig(() => (newManager) => handleAddTopicByType(newManager));
            return;
        }
        if (!newTopicType) return;
        setLoading(true);
        try {
            await manager.addTopicByType(newTopicType); // This now works correctly with the refactored VizConfigManager
            setNewTopicType('');
        } catch (err) {
            setError(`Failed to add topic of type ${newTopicType}.`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const hasUnappliedChanges = useMemo(() => {
        if (!vizManager) return false;
        return vizManager.hasUnappliedChanges();
    }, [vizManager, currentConfig]);

    const renderTopicPanels = () => {
        if (!vizManager || !currentConfig) return null;

        const topicConfigs = _.get(currentConfig, 'topics', {});

        return (
            <Collapse accordion>
                {Object.keys(topicConfigs).map(topicKey => {
                    const topicId = ['topics'].concat(topicKey);
                    const topicConfig = topicConfigs[topicKey];
                    const rendererProps = vizManager.getRendererPropsForTopic(topicId);
                    const topicName = _.get(topicConfig, 'topic_name.__value__', 'Unknown Topic');
                    const topicType = _.get(topicConfig, 'topic_type.__value__', 'Unknown Type');
                    const header = `${topicName} (${topicType})`;

                    return (
                        <Panel header={header} key={topicId}>
                            <ConfigRenderer {...rendererProps} />
                        </Panel>
                    );
                })}
            </Collapse>
        );
    };

    const availableTopics = useMemo(() => {
        if (!topics) return [];
        // Filter out topics that are already in the current visualization config
        const currentTopicNames = Object.values(_.get(currentConfig, 'topics', {})).map(t => _.get(t, 'topic_name.__value__'));
        return topics.filter(t => !currentTopicNames.includes(t.name));
    }, [topics, currentConfig]);

    const selectedTopicNames = useMemo(() => {
        return Object.values(_.get(currentConfig, 'topics', {})).map(t => _.get(t, 'topic_name.__value__'));
    }, [currentConfig]);

    return (
        <div style={{ padding: '20px' }}>
            <Modal
                title="Create New Config File"
                visible={isModalVisible}
                onOk={handleCreateConfig}
                onCancel={() => setIsModalVisible(false)}
                confirmLoading={loading}
            >
                <Input 
                    placeholder="Enter new config name"
                    value={newConfigName}
                    onChange={e => setNewConfigName(e.target.value)}
                />
            </Modal>

            <Card title="Topic Visualization Configuration">
                {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}

                <Row justify="space-between" align="middle" style={{ marginBottom: '20px' }}>
                    <Col>
                        <Space>
                            <Text>Config File:</Text>
                            <Select
                                style={{ width: 200 }}
                                placeholder="Select a viz config"
                                onChange={(value) => setSelectedConfigName(value)}
                                loading={loading}
                                value={selectedConfigName}
                            >
                                {configList.map(cfg => (
                                    <Option key={cfg} value={cfg}>{cfg}</Option>
                                ))}
                            </Select>
                            <Button icon={<PlusOutlined />} onClick={() => promptForNewConfig(null)}>New</Button>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Button 
                                type="primary" 
                                onClick={() => vizManager.applyChanges()}
                                disabled={!hasUnappliedChanges || loading}
                            >
                                Apply Changes
                            </Button>
                            <Button 
                                onClick={() => vizManager.revertChanges()}
                                disabled={!hasUnappliedChanges || loading}
                            >
                                Revert All
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <Card title="Add New Visualization" size="small" style={{ marginBottom: '20px' }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Text>Add by Name:</Text>
                            <Checkbox.Group 
                                options={topics.map(t => ({ label: t.name, value: t.name }))} 
                                onChange={handleTopicSelectionChange} 
                                value={Object.values(currentConfig?.topics || {}).map(t => t.topic_name?.__value__).filter(Boolean)}
                            />
                        </Col>
                        <Col span={12}>
                            <Space>
                                <Select
                                    style={{ width: 200 }}
                                    placeholder="Select Topic Type"
                                    onChange={(value) => setNewTopicType(value)}
                                    value={newTopicType || undefined}
                                >
                                    {topicTypes.map(type => (
                                        <Option key={type} value={type}>{type}</Option>
                                    ))}
                                </Select>
                                <Button icon={<PlusOutlined />} onClick={handleAddTopicByType}>Add by Type</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {loading && <Spin />}
                {!loading && vizManager && renderTopicPanels()}
            </Card>
        </div>
    );
};

export default TopicVizPanel;