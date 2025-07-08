import React, { useState, useEffect, useCallback } from 'react';
import {
    Tree, Input, Slider, Checkbox, InputNumber, ColorPicker,
    Row, Col, Typography, Tooltip, Space
} from 'antd';
import { CaretDownOutlined } from '@ant-design/icons';
import _ from 'lodash';

const { Text } = Typography;

// Renders the appropriate UI control for a given parameter type.
const ParameterControl = ({ nodeData, path, onValueChange }) => {
    const { __value__, __metadata__ = {} } = nodeData;
    const type = __metadata__.type;

    const handleValueChange = (newValue) => {
        onValueChange(path, newValue);
    };

    switch (type) {
        case 'number':
            return (
                <Row align="middle" style={{ width: '100%' }} onMouseDown={(e) => e.stopPropagation()}>
                    <Col span={12}>
                        <Slider
                            min={__metadata__.min}
                            max={__metadata__.max}
                            value={typeof __value__ === 'number' ? __value__ : 0}
                            step={__metadata__.step || 0.1}
                            onChange={handleValueChange}
                        />
                    </Col>
                    <Col span={4}>
                        <InputNumber
                            min={__metadata__.min}
                            max={__metadata__.max}
                            value={__value__}
                            step={__metadata__.step || 0.1}
                            onChange={handleValueChange}
                            style={{ margin: '0 16px' }}
                        />
                    </Col>
                </Row>
            );
        case 'color':
            return (
                <Row align="middle" style={{ width: '100%' }} onMouseDown={(e) => e.stopPropagation()}>
                    <Col span={10}><ColorPicker value={__value__} onChange={(color) => handleValueChange(color.toHexString())} /></Col>
                </Row>
            );
        case 'boolean':
            return <Checkbox checked={__value__} onChange={(e) => handleValueChange(e.target.checked)} />;
        case 'string':
        default:
            return <Input value={__value__} onChange={(e) => handleValueChange(e.target.value)} style={{ width: 200 }} />;
    }
};

const ConfigRenderer = ({ jsonData, originalJsonData, onValueChange }) => {
    const [treeData, setTreeData] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState([]);

    // This function now builds a tree that supports hybrid nodes.
    const buildTree = useCallback((data, path = []) => {
        // Filter out special keys to get only child nodes.
        const childKeys = Object.keys(data).filter(key => !key.startsWith('__'));

        return childKeys.map(key => {
            const currentPath = path.concat(key);
            const value = data[key];
            const node = {
                title: key,
                key: currentPath.join('.'),
                path: currentPath,
                data: value, // Pass the whole child object to the node.
            };

            // A node is considered a branch if it's an object.
            if (_.isObject(value) && value !== null) {
                node.children = buildTree(value, currentPath);
            }
            return node;
        });
    }, []);

    useEffect(() => {
        if (jsonData) {
            const newTreeData = buildTree(jsonData);
            setTreeData(newTreeData);
            // Auto-expand all nodes for better visibility on first load.
            const allKeys = [];
            const getAllKeys = (nodes) => {
                for (const node of nodes) {
                    allKeys.push(node.key);
                    if (node.children) getAllKeys(node.children);
                }
            };
            getAllKeys(newTreeData);
            setExpandedKeys(allKeys);
        }
    }, [jsonData, buildTree]);

    // The title renderer is now more complex to handle hybrid nodes.
    const renderNodeTitle = (node) => {
        const { path, data, title } = node;
        
        // Check if the current node has a value to be rendered.
        const hasValue = data && data.hasOwnProperty('__value__') && data.hasOwnProperty('__metadata__');

        const originalValue = hasValue ? _.get(originalJsonData, path.concat('__value__')) : undefined;
        const isModified = hasValue && !_.isEqual(data.__value__, originalValue);

        const titleStyle = isModified ? { color: '#1890ff', fontWeight: 'bold' } : {};

        return (
            <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                <Col span={hasValue ? 8 : 24}>
                    <Tooltip title={hasValue ? data.__metadata__.description || title : title}>
                        <Text strong style={titleStyle}>{title}</Text>
                    </Tooltip>
                </Col>
                {hasValue && (
                    <Col span={16}>
                        <ParameterControl nodeData={data} path={path} onValueChange={onValueChange} />
                    </Col>
                )}
            </Row>
        );
    };

    return (
        <Tree
            showLine
            switcherIcon={<CaretDownOutlined />}
            treeData={treeData}
            titleRender={renderNodeTitle}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            blockNode
        />
    );
};

export default ConfigRenderer;