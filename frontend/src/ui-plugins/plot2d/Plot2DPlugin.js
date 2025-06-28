import React from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';

// A mock plotting component
const Plot2DComponent = ({ config }) => {
  const { robotId, topic } = config;
  return (
    <div style={{ padding: '20px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <h3>2D Plot</h3>
      <p>Displaying data for:</p>
      <ul>
        <li><strong>Robot ID:</strong> {robotId || 'Not specified'}</li>
        <li><strong>Topic:</strong> {topic || 'Not specified'}</li>
      </ul>
      <p><em>(Plot visualization would be rendered here)</em></p>
    </div>
  );
};

export class Plot2DPlugin extends UIPanelPlugin {
  typeName = 'plot-2d';
  name = '2D Plot';

  createComponent(config) {
    // The config object is passed from the layout manager when creating a new tab.
    // This allows each plot instance to be configured independently.
    return <Plot2DComponent config={config} />;
  }
}