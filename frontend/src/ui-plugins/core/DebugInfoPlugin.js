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
            case 'data': return { color: '#888' }; // Style for data messages
            case 'system': return { color: '#00bcd4' }; // Style for system messages
            default: return { color: '#0077ff' };
        }
    };

    return (
        <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box', overflowY: 'auto', backgroundColor: '#2a2a2a', color: '#f0f0f0', fontFamily: 'monospace' }}>
            {debugInfo.map((log, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', ...getLogStyle(log.type) }}>
                    <span>[{log.timestamp}] {log.message}</span>
                    {log.count > 1 && (
                        <span style={{
                            marginLeft: '10px',
                            backgroundColor: '#555',
                            color: '#fff',
                            borderRadius: '10px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                        }}>
                            {log.count}
                        </span>
                    )}
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