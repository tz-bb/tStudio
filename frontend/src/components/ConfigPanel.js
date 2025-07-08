import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tree, Input, InputNumber, Switch, Select, Button, message, Row, Col, Slider, ColorPicker, Tooltip, Alert, Spin, Space, Tabs, List, Card } from 'antd';
import { RollbackOutlined, SaveOutlined, UndoOutlined, CloudUploadOutlined, CloudDownloadOutlined, HistoryOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import ParameterService from '../services/ParameterService';
import _ from 'lodash';

const ignoreCategories = ['layouts'];

const { Option } = Select;
const { TabPane } = Tabs;

const ConfigPanel = () => {
    const [configs, setConfigs] = useState({});
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedConfig, setSelectedConfig] = useState(null);
    
    // Staging and original data for parameter editing
    const [stagedConfigData, setStagedConfigData] = useState(null);
    const [originalConfigData, setOriginalConfigData] = useState(null);

    // State for backup and recovery management
    const [backups, setBackups] = useState([]);
    const [isBackupLoading, setIsBackupLoading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const hasUnappliedChanges = useMemo(() => {
        return !_.isEqual(stagedConfigData, originalConfigData);
    }, [stagedConfigData, originalConfigData]);

    // Fetch initial list of all configurations
    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                setLoading(true);
                const allConfigs = await ParameterService.listAllConfigs();
                const filteredConfigs = _.omitBy(allConfigs, (value, key) => ignoreCategories.includes(key));
                setConfigs(filteredConfigs);
                setError(null);
            } catch (err) {
                setError('Failed to load config list.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();
    }, []);

    // Fetch backups whenever the selected config changes
    const fetchBackups = useCallback(async () => {
        if (!selectedCategory || !selectedConfig) return;
        setIsBackupLoading(true);
        try {
            const backupList = await ParameterService.listBackups(selectedCategory, selectedConfig);
            setBackups(backupList || []);
        } catch (error) {
            message.error(`Failed to fetch backups: ${error.message}`);
        } finally {
            setIsBackupLoading(false);
        }
    }, [selectedCategory, selectedConfig]);

    useEffect(() => {
        if (selectedCategory && selectedConfig) {
            fetchBackups();
        }
    }, [selectedCategory, selectedConfig, fetchBackups]);

    const handleCategoryChange = (value) => {
        setSelectedCategory(value);
        setSelectedConfig(null);
        setStagedConfigData(null);
        setOriginalConfigData(null);
        setBackups([]);
    };

    const handleConfigChange = async (value) => {
        setSelectedConfig(value);
        if (selectedCategory && value) {
            try {
                setLoading(true);
                const response = await ParameterService.loadConfig(selectedCategory, value, true);
                if (response) {
                    setStagedConfigData(_.cloneDeep(response));
                    setOriginalConfigData(_.cloneDeep(response));
                    setError(null);
                } else {
                    throw new Error("Invalid config data received from server.");
                }
            } catch (err) {
                setError(`Failed to load config: ${value}. ${err.message}`);
                console.error(err);
                setStagedConfigData(null);
                setOriginalConfigData(null);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleValueChange = (path, value) => {
        const newConfigData = _.cloneDeep(stagedConfigData);
        _.set(newConfigData, path.concat('__value__'), value);
        setStagedConfigData(newConfigData);
    };

    const handleApplyChanges = async () => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            setLoading(true);
            await ParameterService.saveConfig(selectedCategory, selectedConfig, stagedConfigData);
            message.success('All changes have been applied successfully!');
            setOriginalConfigData(_.cloneDeep(stagedConfigData));
        } catch (err) {
            setError(`Failed to apply changes: ${err.message}`);
            console.error(err);
            message.error('Failed to apply changes.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevertAllChanges = () => {
        setStagedConfigData(_.cloneDeep(originalConfigData));
        message.info('All changes have been reverted.');
    };

    // --- Backup and Restore Handlers ---
    const handleCreateBackup = async () => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            const result = await ParameterService.createBackup(selectedCategory, selectedConfig);
            message.success(`Backup '${result.backup_name}' created successfully!`);
            fetchBackups(); // Refresh the list
        } catch (error) {
            message.error(`Failed to create backup: ${error.message}`);
        }
    };

    const handleRestoreBackup = async (backupFilename) => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            await ParameterService.restoreBackup(selectedCategory, selectedConfig, backupFilename);
            message.success(`Config restored from '${backupFilename}'. Reloading config...`);
            // Reload the config to see the restored state
            await handleConfigChange(selectedConfig);
        } catch (error) {
            message.error(`Failed to restore backup: ${error.message}`);
        }
    };

    // --- Confirmable Edit Session Handlers ---
    const handleStartEdit = async () => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            await ParameterService.startConfirmableEdit(selectedCategory, selectedConfig);
            message.info('Safe edit session started. An auto-backup has been created.');
        } catch (error) {
            message.error(`Failed to start session: ${error.message}`);
        }
    };

    const handleRevertEdit = async () => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            await ParameterService.revertConfirmableEdit(selectedCategory, selectedConfig);
            message.warn('Changes have been reverted. Reloading config to see the original state.');
            await handleConfigChange(selectedConfig); // Reload config
        } catch (error) {
            message.error(`Failed to revert: ${error.message}`);
        }
    };

    const handleEndEdit = async () => {
        if (!selectedCategory || !selectedConfig) return;
        try {
            await ParameterService.endConfirmableEdit(selectedCategory, selectedConfig);
            message.success('Edit session ended and changes are confirmed.');
        } catch (error) {
            message.error(`Failed to end session: ${error.message}`);
        }
    };

    const renderNodeTitle = (title, nodeData, path) => {
        const { __value__, __metadata__ = {} } = nodeData;
        const originalNode = _.get(originalConfigData, path);
        const originalValue = originalNode ? originalNode.__value__ : undefined;
        const isModified = !_.isEqual(__value__, originalValue);

        let editor;
        switch (__metadata__.type) {
            case 'boolean':
                editor = <Switch checked={__value__} onChange={(checked) => handleValueChange(path, checked)} />;
                break;
            case 'number':
                editor = (
                    <Row align="middle" style={{ width: '250px' }}>
                        <Col span={12}>
                            <Slider
                                min={__metadata__.min}
                                max={__metadata__.max}
                                value={typeof __value__ === 'number' ? __value__ : 0}
                                step={__metadata__.step || 0.1}
                                onChange={(val) => handleValueChange(path, val)}
                            />
                        </Col>
                        <Col span={4}>
                            <InputNumber
                                value={__value__}
                                min={__metadata__.min}
                                max={__metadata__.max}
                                step={__metadata__.step || 0.1}
                                onChange={(val) => handleValueChange(path, val)}
                                style={{ marginLeft: '16px' }}
                            />
                        </Col>
                    </Row>
                );
                break;
            case 'color':
                editor = <ColorPicker value={__value__} onChangeComplete={(color) => handleValueChange(path, color.toHexString())} />;
                break;
            case 'string':
            default:
                editor = <Input value={__value__} onPressEnter={(e) => handleValueChange(path, e.target.value)} onBlur={(e) => handleValueChange(path, e.target.value)} style={{ width: '150px' }}/>;
                break;
        }

        return (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Tooltip title={`Type: ${__metadata__.type || 'N/A'}`}>
                    <span style={{ color: isModified ? 'red' : 'inherit' }}>{title}</span>
                </Tooltip>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editor}
                </span>
            </span>
        );
    };

    const transformDataToTreeData = (data, parentPath = []) => {
        if (!data) return [];
        return Object.entries(data).map(([key, node]) => {
            if (key === '__value__' || key === '__metadata__') return null;

            const currentPath = [...parentPath, key];
            const treeNode = {
                key: currentPath.join('.'),
                title: key,
            };

            if (node && node.hasOwnProperty('__value__')) {
                treeNode.title = renderNodeTitle(key, node, currentPath);
                treeNode.isLeaf = true;
            } else if (node && typeof node === 'object' && node !== null) {
                treeNode.children = transformDataToTreeData(node, currentPath);
                treeNode.isLeaf = false;
            }
            
            return treeNode;
        }).filter(Boolean);
    };

    const treeData = useMemo(() => transformDataToTreeData(stagedConfigData), [stagedConfigData, originalConfigData]);

    const renderConfigEditor = () => (
        <>
            <Row justify="end" style={{ marginBottom: '20px' }}>
                <Col>
                    <Space>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            disabled={!hasUnappliedChanges || loading}
                            onClick={handleApplyChanges}
                        >
                            Apply Changes
                        </Button>
                        <Button
                            icon={<UndoOutlined />}
                            disabled={!hasUnappliedChanges || loading}
                            onClick={handleRevertAllChanges}
                        >
                            Revert All
                        </Button>
                    </Space>
                </Col>
            </Row>
            {loading && <Spin />}
            {stagedConfigData ? (
                <Tree
                    treeData={treeData}
                    defaultExpandAll
                />
            ) : (
                <p>Select a configuration file to start editing.</p>
            )}
        </>
    );

    const renderBackupManager = () => (
        <Row gutter={16}>
            <Col span={12}>
                <Card type="inner" title="Safe Editing Session" extra={<EditOutlined />}>
                    <p>Create a temporary restore point before making critical changes. Revert if something goes wrong.</p>
                    <Space>
                        <Button onClick={handleStartEdit} icon={<CloudUploadOutlined />}>Start Session</Button>
                        <Button onClick={handleRevertEdit} danger icon={<RollbackOutlined />}>Revert Changes</Button>
                        <Button onClick={handleEndEdit} type="primary" icon={<StopOutlined />}>Confirm & End</Button>
                    </Space>
                </Card>
            </Col>
            <Col span={12}>
                <Card type="inner" title="Manual Backups" extra={<HistoryOutlined />}>
                    <Space style={{ marginBottom: 16 }}>
                        <Button onClick={fetchBackups} loading={isBackupLoading}>Refresh List</Button>
                        <Button onClick={handleCreateBackup} type="primary">Create New Backup</Button>
                    </Space>
                    <List
                        bordered
                        dataSource={backups}
                        loading={isBackupLoading}
                        renderItem={item => (
                            <List.Item
                                actions={[<Button type="link" icon={<CloudDownloadOutlined />} onClick={() => handleRestoreBackup(item)}>Restore</Button>]}
                            >
                                {item}
                            </List.Item>
                        )}
                        locale={{ emptyText: 'No backups found.' }}
                    />
                </Card>
            </Col>
        </Row>
    );

    return (
        <div style={{ padding: '20px' }}>
            <h2>Configuration Panel</h2>
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
                            {Object.keys(configs).map(cat => (
                                <Option key={cat} value={cat}>{cat}</Option>
                            ))}
                        </Select>
                        <Select
                            style={{ width: 200 }}
                            placeholder="Select a config"
                            onChange={handleConfigChange}
                            disabled={!selectedCategory}
                            loading={loading}
                            value={selectedConfig}
                        >
                            {selectedCategory && configs[selectedCategory] && configs[selectedCategory].map(cfg => (
                                <Option key={cfg} value={cfg}>{cfg}</Option>
                            ))}
                        </Select>
                    </Space>
                </Col>
            </Row>

            {selectedConfig && (
                <Tabs defaultActiveKey="1">
                    <TabPane tab="Editor" key="1">
                        {renderConfigEditor()}
                    </TabPane>
                    <TabPane tab="Backup & Recovery" key="2">
                        {renderBackupManager()}
                    </TabPane>
                </Tabs>
            )}
        </div>
    );
};

export default ConfigPanel;