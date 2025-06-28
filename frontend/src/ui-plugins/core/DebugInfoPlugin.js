import React from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { useAppContext } from '../../services/AppContext';

const DebugInfoPanel = () => {
    const { debugInfo } = useAppContext();

    const getLogStyle = (type) => {
        switch (type) {
            case 'error': return { color: '#ff4d4d' };
            case 'warn': return { color: '#ffc107' };
            case 'success': return { color: '#28a745' };
            default: return { color: '#f0f0f0' };
        }
    };

    return (
        <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box', overflowY: 'auto', backgroundColor: '#2a2a2a', color: '#f0f0f0', fontFamily: 'monospace' }}>
            {[...debugInfo].reverse().map((log, index) => (
                <div key={index} style={getLogStyle(log.type)}>
                    [{log.timestamp}] {log.message}
                </div>
            ))}
        </div>
    );
};

export class DebugInfoPlugin extends UIPanelPlugin {
    typeName = 'debug-info';
    name = 'System Log';

    createComponent = () => {
        return <DebugInfoPanel />;
    }
}

export default DebugInfoPlugin;