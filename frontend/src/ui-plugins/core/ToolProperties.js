import React, { useContext } from 'react';
import { AppContext } from '../../services/AppContext';
import { Card, Select, Input, Space } from 'antd';

const { Option } = Select;

const ToolProperties = () => {
  const { currentTool, toolParams, updateToolParams } = useContext(AppContext);
  const params = toolParams[currentTool] || {};

  const renderSelectAreaProps = () => (
    <Space wrap>
      <Select value={params.shape} onChange={(v)=>updateToolParams('select_area',{shape:v})} style={{width:160}}>
        <Option value="rectangle">Rectangle</Option>
        <Option value="polygon">Polygon</Option>
        <Option value="circle">Circle</Option>
      </Select>
      <Input value={params.publish_topic} onChange={(e)=>updateToolParams('select_area',{publish_topic:e.target.value})} placeholder="Publish Topic" style={{width:200}} />
      <Input type="number" step={0.1} value={params.step_x} onChange={(e)=>updateToolParams('select_area',{step_x:parseFloat(e.target.value||'0')})} placeholder="Step X" style={{width:120}} />
      <Input type="number" step={0.1} value={params.step_y} onChange={(e)=>updateToolParams('select_area',{step_y:parseFloat(e.target.value||'0')})} placeholder="Step Y" style={{width:120}} />
    </Space>
  );

  const renderNavGoalProps = () => (
    <Space wrap>
      <Input value={params.publish_topic} onChange={(e)=>updateToolParams('nav_goal',{publish_topic:e.target.value})} placeholder="Publish Topic" style={{width:200}} />
    </Space>
  );

  const renderAddMissionPointProps = () => (
    <Space wrap>
      <Input value={params.publish_topic} onChange={(e)=>updateToolParams('add_mission_point',{publish_topic:e.target.value})} placeholder="Publish Topic" style={{width:200}} />
    </Space>
  );

  return (
    <Card size="small" title="Tool Properties" style={{ marginBottom: 10 }}>
      {currentTool==='select_area' && renderSelectAreaProps()}
      {currentTool==='nav_goal' && renderNavGoalProps()}
      {currentTool==='add_mission_point' && renderAddMissionPointProps()}
      {currentTool==='erase_points' && <div>Erase by click/box</div>}
      {currentTool==='measure' && <div>Measure distance/area</div>}
    </Card>
  );
};

export default ToolProperties;
