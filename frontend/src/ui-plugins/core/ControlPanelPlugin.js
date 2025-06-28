import React, { useContext } from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { AppContext } from '../../services/AppContext';
import ConnectionPanel from '../../components/ConnectionPanel';
import TopicPanel from '../../components/TopicPanel';

const ControlPanelComponent = () => {
  const { connectionStatus, wsManager } = useContext(AppContext);
  // Note: TopicPanel manages its own state, but needs wsManager and connectionStatus
  return (
    <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <ConnectionPanel connectionStatus={connectionStatus} wsManager={wsManager} />
      <TopicPanel connectionStatus={connectionStatus} wsManager={wsManager} />
    </div>
  );
};

export class ControlPanelPlugin extends UIPanelPlugin {
  typeName = 'control-panel';
  name = 'Control Panel';
  createComponent = () => <ControlPanelComponent />;
}