import React from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';

const WelcomePanelComponent = ({ config }) => {
  return (
    <div style={{ padding: '20px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <h2>{config.title || 'Welcome to tStudio'}</h2>
      <p>This is a dynamic and extensible layout powered by FlexLayout-React.</p>
      <p>You can add new panels from the "Layout" menu.</p>
    </div>
  );
};

export class WelcomePlugin extends UIPanelPlugin {
  typeName = 'welcome';
  name = 'Welcome Screen';

  createComponent(config) {
    return <WelcomePanelComponent config={config} />;
  }
}