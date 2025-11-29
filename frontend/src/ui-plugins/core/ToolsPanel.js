import React, { useContext } from 'react';
import { AppContext } from '../../services/AppContext';
import { Button, Divider, Tooltip, InputNumber } from 'antd';
import { AimOutlined, DeleteOutlined, SelectOutlined, SendOutlined, FlagOutlined, PlusCircleOutlined, ScissorOutlined, CloseCircleOutlined, LineOutlined } from '@ant-design/icons';

const ToolsPanel = () => {
  const { currentTool, setCurrentTool, publishToolResult, clearToolPreview, missionPoints, publishMissionPoints, clearMissionPoints, addDebugInfo, clearAllToolsState, publishSelectedAreas, publishNavGoals, selectedAreas, navGoals, toolParams, updateToolParams } = useContext(AppContext);
  const iconStyle = { width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Tooltip title="Interact">
        <Button style={iconStyle} type={currentTool==='interact'?'primary':'default'} onClick={()=>{setCurrentTool('interact'); addDebugInfo('Tool: Interact','system');}} icon={<AimOutlined />} />
      </Tooltip>
      <Tooltip title="Clear">
        <Button style={iconStyle} onClick={()=>{clearAllToolsState(); addDebugInfo('Clear all tools state','system');}} icon={<DeleteOutlined />} />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title={`Select Area`}>
        <Button style={iconStyle} type={currentTool==='select_area'?'primary':'default'} onClick={()=>{setCurrentTool('select_area'); addDebugInfo('Tool: Select Area','system');}} icon={<SelectOutlined />} />
      </Tooltip>
      <InputNumber style={{ width: 76 }} min={0.1} step={0.1} value={toolParams?.select_area?.step_x} onChange={(v)=>updateToolParams('select_area',{ step_x: Number(v||0.1) })} placeholder="dx" />
      <InputNumber style={{ width: 76 }} min={0.1} step={0.1} value={toolParams?.select_area?.step_y} onChange={(v)=>updateToolParams('select_area',{ step_y: Number(v||0.1) })} placeholder="dy" />
      <Tooltip title={`Publish Areas (${selectedAreas.length})`}>
        <Button style={iconStyle} onClick={()=>{publishSelectedAreas(); addDebugInfo(`Publish ${selectedAreas.length} areas`,'system');}} disabled={!selectedAreas.length} icon={<SendOutlined />} />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title="2D Nav Goal">
        <Button style={iconStyle} type={currentTool==='nav_goal'?'primary':'default'} onClick={()=>{setCurrentTool('nav_goal'); addDebugInfo('Tool: 2D Nav Goal','system');}} icon={<FlagOutlined />} />
      </Tooltip>
      <Tooltip title={`Publish Goals (${navGoals.length})`}>
        <Button style={iconStyle} onClick={()=>{publishNavGoals(); addDebugInfo(`Publish ${navGoals.length} goals`,'system');}} disabled={!navGoals.length} icon={<SendOutlined />} />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title="Add Mission Point">
        <Button style={iconStyle} type={currentTool==='add_mission_point'?'primary':'default'} onClick={()=>{setCurrentTool('add_mission_point'); addDebugInfo('Tool: Add Mission Point','system');}} icon={<PlusCircleOutlined />} />
      </Tooltip>
      <Tooltip title="Erase Points">
        <Button style={iconStyle} type={currentTool==='erase_points'?'primary':'default'} onClick={()=>{setCurrentTool('erase_points'); addDebugInfo('Tool: Erase Points','system');}} icon={<ScissorOutlined />} />
      </Tooltip>
      <Tooltip title={`Publish Points (${missionPoints.length})`}>
        <Button style={iconStyle} onClick={()=>{publishMissionPoints(); addDebugInfo(`Publish ${missionPoints.length} mission points`,'system');}} disabled={!missionPoints.length} icon={<SendOutlined />} />
      </Tooltip>
      <Tooltip title="Clear Points">
        <Button style={iconStyle} onClick={()=>{clearMissionPoints(); addDebugInfo('Clear mission points','system');}} disabled={!missionPoints.length} icon={<CloseCircleOutlined />} />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title="Measure">
        <Button style={iconStyle} type={currentTool==='measure'?'primary':'default'} onClick={()=>{setCurrentTool('measure'); addDebugInfo('Tool: Measure','system');}} icon={<LineOutlined />} />
      </Tooltip>
      <Tooltip title="Publish preview">
        <Button style={iconStyle} onClick={()=>{publishToolResult(); addDebugInfo('Publish preview','system');}} icon={<SendOutlined />} />
      </Tooltip>
    </div>
  );
};

export default ToolsPanel;
