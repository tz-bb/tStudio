import React from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import TFPanel from '../../components/TFPanel';

export class TFPanelPlugin extends UIPanelPlugin {
    typeName = 'tf-panel';
    name = 'TF Tree';

    createComponent = () => {
        return <TFPanel />;
    }
}

export default TFPanelPlugin;