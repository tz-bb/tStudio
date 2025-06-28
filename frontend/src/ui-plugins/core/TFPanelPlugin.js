import React, { useContext } from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { AppContext } from '../../services/AppContext';
import TFPanel from '../../components/TFPanel';

const TFPanelComponent = () => {
  const { tfFrames, tfHierarchy } = useContext(AppContext);
  return <TFPanel frames={tfFrames} hierarchy={tfHierarchy} />;
};

export class TFPanelPlugin extends UIPanelPlugin {
  typeName = 'tf-panel';
  name = 'TF Panel';
  createComponent = () => <TFPanelComponent />;
}