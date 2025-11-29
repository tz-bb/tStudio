import React, { useMemo, useRef, useEffect, useState, useContext } from 'react';
import { initializePlugins } from './plugins';
import { tfManager } from '../services/TFManager'; // 导入 tfManager
import { AppContext } from '../services/AppContext';
import * as THREE from 'three';

function Scene3D({ data }) {
  const [pluginManager, setPluginManager] = useState(null);
  const { setScenePluginTemplates, setScenePluginsInitialized, vizConfigs, addDebugInfo, currentTool, toolPreview, setToolPreview, previewPublished, missionPoints, selectedAreas, navGoals, toolParams } = useContext(AppContext);

  // 初始化插件系统
  useEffect(() => {
    const manager = initializePlugins(setScenePluginTemplates, setScenePluginsInitialized);
    setPluginManager(manager);

    // 组件卸载时执行清理
    return () => {
      manager.destroy();
    };
  }, [setScenePluginTemplates, setScenePluginsInitialized]); // 空依赖数组，确保此 effect 只在挂载和卸载时运行一次

  // 监听数据变化，清理不再存在的 topic 实例
  useEffect(() => {
    // 必须等待 pluginManager 初始化完成
    if (!pluginManager) {
      return; // useEffect hook 内部不能返回JSX元素，如果无事可做，直接返回
    }

    const currentTopics = new Set(Object.keys(data));
    // 假设 pluginManager.messageInstances 是一个 Map 或 Object
    const existingTopics = new Set(pluginManager.messageInstances.keys());

    // 移除不再接收数据的 topic 实例，以释放资源
    for (const topic of existingTopics) {
      if (!currentTopics.has(topic)) {
        pluginManager.removeInstance(topic);
      }
    }
  }, [data, pluginManager]);

  return (
    <group>
      {/* Debug mounts for goals/areas count */}
      {/* {(() => { console.log('Scene3D render counts', { goals: (navGoals||[]).length, areas: (selectedAreas||[]).length, points: (missionPoints||[]).length }); return null; })()} */}
      {/* 动态渲染所有话题数据 */}
      {/* 确保 pluginManager 已初始化后再进行渲染，防止空指针错误 */}
      {pluginManager && Object.entries(data).map(([topic, topicData]) => {
        // Find the corresponding visualization config for this topic
        const topicConfig = Object.values(vizConfigs?.topics || {}).find(
          t => t.topic_name?.__value__ === topic
        );
        // 将 tfManager 和 config 传递给 render 方法
        const renderedComponent = pluginManager.render(topic, topicData, tfManager, topicConfig);
        if (!renderedComponent) {
          const type = topicData?.message_type || 'UnknownType';
          addDebugInfo(`No visualization plugin for ${topic} (${type})`, 'warn');
        }
        return <React.Fragment key={topic}>{renderedComponent}</React.Fragment>;
      })}
      {/* 工具预览覆盖层：根据 currentTool 与 toolPreview 渲染 */}
      {/* 已设定的 Nav Goals 持续可见 */}
      {navGoals && navGoals.length > 0 && (
        <group>
          {navGoals.map((g, i) => (
            <group key={`goal-${i}`} position={new THREE.Vector3(g.pose.x, g.pose.y, g.pose.z||0)} rotation={[0,0,g.pose.yaw||0]}>
              <mesh position={[0,0,0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} />
                <meshStandardMaterial color={g.published ? '#44aa44' : '#ffaa00'} />
              </mesh>
              <mesh position={[0.3,0,0.1]} rotation={[0,Math.PI/2,0]}>
                <coneGeometry args={[0.1, 0.25, 16]} />
                <meshStandardMaterial color={g.published ? '#44aa44' : '#ffaa00'} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {/* 已设定的 Selected Areas 持续可见 */}
      {selectedAreas && selectedAreas.length > 0 && (
        <group>
          {selectedAreas.map((area, idx) => (
            <AreaBorder key={`area-${idx}`} area={area} />
          ))}
        </group>
      )}
      {selectedAreas && selectedAreas.length > 0 && (
        <group>
          {selectedAreas.map((area, idx) => {
            const color = area.published ? '#44aa44' : '#ffaa00';
            const xs = area.polygon.map(p=>p.x);
            const ys = area.polygon.map(p=>p.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;
            const stepX = Math.max(toolParams?.select_area?.step_x || 1.0, 0.1);
            const stepY = Math.max(toolParams?.select_area?.step_y || 1.0, 0.1);
            const cols = Math.max(Math.floor(width / stepX), 1);
            const rows = Math.max(Math.floor(height / stepY), 1);
            const startX = minX + (width - (cols-1)*stepX)/2;
            const startY = minY + (height - (rows-1)*stepY)/2;
            const points = [];
            for (let r=0; r<rows; r++) {
              for (let c=0; c<cols; c++) {
                points.push({ x: startX + c*stepX, y: startY + r*stepY, z: 0 });
              }
            }
            return (
              <group key={`area-matrix-${idx}`}>
                {points.map((p,i)=>(
                  <mesh key={i} position={new THREE.Vector3(p.x, p.y, 0)}>
                    <sphereGeometry args={[0.08, 10, 10]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                ))}
              </group>
            );
          })}
        </group>
      )}
      {toolPreview?.type === 'select_area' && toolPreview?.data?.polygon && (
        <>
          <PreviewSelectArea polygon={toolPreview.data.polygon} />
          <PreviewAreaMatrix polygon={toolPreview.data.polygon} color={'#ffaa00'} />
        </>
      )}
      {toolPreview?.type === 'nav_goal' && toolPreview?.data?.start && toolPreview?.data?.end && (
        (() => {
          const s = toolPreview.data.start;
          const e = toolPreview.data.end;
          const yaw = toolPreview.data.yaw || 0;
          return (
            <group position={new THREE.Vector3(s.x, s.y, s.z||0)} rotation={[0,0,yaw]}>
              <mesh position={[0.15,0,0]} rotation={[0,0,Math.PI/2]}>
                <cylinderGeometry args={[0.05, 0.05, 0.3, 12]} />
                <meshStandardMaterial color={'#ffaa00'} />
              </mesh>
              <mesh position={[0.45,0,0]} rotation={[0,0,Math.PI/2]}>
                <coneGeometry args={[0.1, 0.2, 16]} />
                <meshStandardMaterial color={'#ffaa00'} />
              </mesh>
              <line>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" array={new Float32Array([0, 0, 0, e.x - s.x, e.y - s.y, 0])} itemSize={3} count={2} />
                </bufferGeometry>
                <lineBasicMaterial color={'#ffaa00'} />
              </line>
            </group>
          );
        })()
      )}
      {missionPoints && missionPoints.length > 0 && (
        <group>
          {missionPoints.map((p, i) => (
            <mesh key={i} position={new THREE.Vector3(p.x, p.y, p.z||0)}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color={'#00bcd4'} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default Scene3D;
function AreaBorder({ area }) {
  const attrRef = useRef();
  const pts = area.polygon || [];
  const positions = useMemo(() => {
    const arr = new Float32Array((pts.length + 1) * 3);
    for (let i = 0; i < pts.length; i++) {
      arr[i*3] = pts[i].x;
      arr[i*3+1] = pts[i].y;
      arr[i*3+2] = 0;
    }
    if (pts.length) {
      arr[pts.length*3] = pts[0].x;
      arr[pts.length*3+1] = pts[0].y;
      arr[pts.length*3+2] = 0;
    }
    return arr;
  }, [pts]);
  useEffect(() => { if (attrRef.current) attrRef.current.needsUpdate = true; }, [positions]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" array={positions} itemSize={3} count={pts.length+1} />
      </bufferGeometry>
      <lineBasicMaterial color={area.published ? '#44aa44' : '#ffaa00'} />
    </line>
  );
}
function PreviewSelectArea({ polygon }) {
  const attrRef = useRef();
  const positionsRef = useRef(new Float32Array(15));
  useEffect(() => {
    if (!polygon || polygon.length < 4) return;
    for (let i = 0; i < 4; i++) {
      positionsRef.current[i*3] = polygon[i].x;
      positionsRef.current[i*3+1] = polygon[i].y;
      positionsRef.current[i*3+2] = 0;
    }
    positionsRef.current[12] = polygon[0].x;
    positionsRef.current[13] = polygon[0].y;
    positionsRef.current[14] = 0;
    if (attrRef.current) attrRef.current.needsUpdate = true;
  }, [polygon]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" array={positionsRef.current} itemSize={3} count={5} />
      </bufferGeometry>
      <lineBasicMaterial color={'#ffaa00'} linewidth={2} />
    </line>
  );
}

function PreviewAreaMatrix({ polygon, color }) {
  const spheresRef = useRef([]);
  const { toolParams } = useContext(AppContext);
  const points = useMemo(() => {
    if (!polygon || polygon.length < 4) return [];
    const xs = polygon.map(p=>p.x);
    const ys = polygon.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const stepX = Math.max(toolParams?.select_area?.step_x || 1.0, 0.1);
    const stepY = Math.max(toolParams?.select_area?.step_y || 1.0, 0.1);
    const cols = Math.max(Math.floor(width / stepX), 1);
    const rows = Math.max(Math.floor(height / stepY), 1);
    const startX = minX + (width - (cols-1)*stepX)/2;
    const startY = minY + (height - (rows-1)*stepY)/2;
    const pts = [];
    for (let r=0; r<rows; r++) {
      for (let c=0; c<cols; c++) {
        pts.push({ x: startX + c*stepX, y: startY + r*stepY, z: 0 });
      }
    }
    return pts;
  }, [polygon, toolParams?.select_area?.step_x, toolParams?.select_area?.step_y]);
  return (
    <group>
      {points.map((p,i)=> (
        <mesh key={i} position={new THREE.Vector3(p.x, p.y, 0)}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
