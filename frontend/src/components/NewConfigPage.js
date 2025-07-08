import React, { useState, useEffect, useMemo } from 'react';
import {
    Card, Button, Space, Divider, Typography, Select, Row, Col, Alert, Spin
} from 'antd';
import ConfigManager from '../services/ConfigManager';
import ConfigRenderer from './ConfigRenderer';
import ParameterService from '../services/ParameterService';
import _ from 'lodash';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const ignoreCategories = ['layouts'];

const NewConfigPage = () => {
    // State for managing the selection dropdowns
    const [allConfigs, setAllConfigs] = useState({});
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedConfigName, setSelectedConfigName] = useState(null);

    // State for the manager and the data it provides
    const [configManager, setConfigManager] = useState(null);
    const [currentConfig, setCurrentConfig] = useState(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch the list of all available configs on component mount
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                setLoading(true);
                const configs = await ParameterService.listAllConfigs();
                const filteredConfigs = _.omitBy(configs, (value, key) => ignoreCategories.includes(key));
                setAllConfigs(filteredConfigs);
            } catch (err) {
                setError('Failed to load config list.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();
    }, []);

    // This effect runs when a new config is selected from the dropdown
    useEffect(() => {
        if (selectedCategory && selectedConfigName) {
            setLoading(true);
            // Clear the view of the previous configuration while the new one is loading.
            setCurrentConfig(null);

            const manager = new ConfigManager(selectedCategory, selectedConfigName, { mode: 'manual' });

            // Subscribe to its updates. The `setCurrentConfig` callback will be called
            // by the manager once `loadConfig` is complete.
            manager.subscribe(setCurrentConfig);

            // Load the data asynchronously.
            manager.loadConfig().finally(() => {
                setLoading(false);
            });

            // Set the manager instance in state so that UI controls like buttons can use it.
            setConfigManager(manager);

            // Unsubscribe on cleanup to prevent memory leaks.
            return () => manager.unsubscribe();
        }
    }, [selectedCategory, selectedConfigName]);

    const handleCategoryChange = (value) => {
        setSelectedCategory(value);
        setSelectedConfigName(null);
        setConfigManager(null);
        setCurrentConfig(null);
    };

    const rendererProps = useMemo(() => {
        if (!configManager) return {};
        return configManager.getRendererProps();
    }, [configManager, currentConfig]);

    const hasUnappliedChanges = useMemo(() => {
        if (!configManager) return false;
        return !_.isEqual(configManager.currentConfig, configManager.originalConfig);
    }, [configManager, currentConfig]);

    return (
        <div style={{ padding: '20px' }}>
            <Title level={2}>New Config Management Page</Title>
            <Paragraph>
                This page uses the decoupled `ConfigManager` and `ConfigRenderer` to edit live backend data.
            </Paragraph>

            {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}

            <Row justify="start" align="middle" style={{ marginBottom: '20px' }}>
                <Col>
                    <Space>
                        <Select
                            style={{ width: 200 }}
                            placeholder="Select a category"
                            onChange={handleCategoryChange}
                            loading={loading}
                            value={selectedCategory}
                        >
                            {Object.keys(allConfigs).map(cat => (
                                <Option key={cat} value={cat}>{cat}</Option>
                            ))}
                        </Select>
                        <Select
                            style={{ width: 200 }}
                            placeholder="Select a config"
                            onChange={(value) => setSelectedConfigName(value)}
                            disabled={!selectedCategory}
                            loading={loading}
                            value={selectedConfigName}
                        >
                            {selectedCategory && allConfigs[selectedCategory] && allConfigs[selectedCategory].map(cfg => (
                                <Option key={cfg} value={cfg}>{cfg}</Option>
                            ))}
                        </Select>
                    </Space>
                </Col>
            </Row>

            {configManager && (
                <Card title={`Editing: ${selectedCategory} / ${selectedConfigName}`}>
                    <Space style={{ marginBottom: '20px' }}>
                        <Button 
                            type="primary" 
                            onClick={() => configManager.applyChanges()}
                            disabled={!hasUnappliedChanges || loading}
                        >
                            Apply Changes
                        </Button>
                        <Button 
                            onClick={() => configManager.revertChanges()}
                            disabled={!hasUnappliedChanges || loading}
                        >
                            Revert All
                        </Button>
                    </Space>
                    
                    {loading && <Spin />}
                    {!loading && currentConfig && (
                        <ConfigRenderer {...rendererProps} />
                    )}
                </Card>
            )}
        </div>
    );
};

export default NewConfigPage;