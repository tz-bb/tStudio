import React, { useContext } from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { AppContext } from '../../services/AppContext';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import Scene3D from '../../components/Scene3D';
import * as THREE from 'three';

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const World = ({ data }) => {
  return (
    <group>
      <Scene3D data={data} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <gridHelper args={[60, 60, '#333', '#333']} />
        <mesh position={[0, 0, 0]}>
          <meshBasicMaterial color="#2a2a2a" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <axesHelper args={[5]} />
    </group>
  );
};

const Scene3DComponent = () => {
  const { sceneData, currentTool } = useContext(AppContext);
  return (
    <Canvas
      camera={{ position: [7, -14, 10], fov: 60, up: [0, 0, 1] }}
      style={{ background: '#1a1a1a', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 15, 5]} intensity={1} />
      <World data={sceneData} />
      <PointerInteractor />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} enabled={currentTool==='interact'} />
      <Stats className="scene-stats" />
    </Canvas>
  );
};

export class Scene3DPlugin extends UIPanelPlugin {
  typeName = 'scene-3d';
  name = '3D Scene';

  createComponent = () => {
    return <Scene3DComponent />;
  }
}

export default Scene3DPlugin;
  const PointerInteractor = () => {
    const { camera, gl } = useThree();
  const { currentTool, setCurrentTool, setToolPreview, addMissionPoint, addSelectedArea, addNavGoal, addDebugInfo, toolPreview, clearToolPreview } = useContext(AppContext);
  const raycasterRef = React.useRef(new THREE.Raycaster());
  const planeRef = React.useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const dragStartRef = React.useRef(null);
  const navStartRef = React.useRef(null);
  const rafPendingRef = React.useRef(false);
  const latestPreviewRef = React.useRef(null);

  const getPlanePoint = (event) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera({ x, y }, camera);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeRef.current, pt);
    return pt;
  };

  React.useEffect(() => {
    const handleDown = (e) => {
      if (currentTool === 'interact') return;
      const p = getPlanePoint(e);
      if (currentTool === 'nav_goal') {
        navStartRef.current = { x: p.x, y: p.y, z: p.z };
        setToolPreview({ type: 'nav_goal', data: { start: { x: p.x, y: p.y, z: p.z }, end: { x: p.x, y: p.y, z: p.z }, yaw: 0 } });
        addDebugInfo(`NavGoal start at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, 'system');
      } else if (currentTool === 'add_mission_point') {
        addMissionPoint({ x: p.x, y: p.y, z: p.z });
        addDebugInfo(`Mission point added at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, 'system');
      } else if (currentTool === 'select_area') {
        dragStartRef.current = { x: p.x, y: p.y, z: 0 };
        addDebugInfo(`SelectArea start at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, 'system');
      }
    };

    const handleMove = (e) => {
      const p = getPlanePoint(e);
      if (currentTool === 'select_area' && dragStartRef.current) {
        const a = dragStartRef.current;
        const b = { x: p.x, y: p.y, z: 0 };
        const poly = [
          { x: a.x, y: a.y, z: 0 },
          { x: b.x, y: a.y, z: 0 },
          { x: b.x, y: b.y, z: 0 },
          { x: a.x, y: b.y, z: 0 },
        ];
        latestPreviewRef.current = { type: 'select_area', data: { polygon: poly } };
      } else if (currentTool === 'nav_goal' && navStartRef.current) {
        const a = navStartRef.current;
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const yaw = Math.atan2(dy, dx);
        latestPreviewRef.current = { type: 'nav_goal', data: { start: a, end: { x: p.x, y: p.y, z: p.z }, yaw } };
      } else {
        latestPreviewRef.current = null;
      }
      if (!rafPendingRef.current && latestPreviewRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          setToolPreview(latestPreviewRef.current);
          rafPendingRef.current = false;
        });
      }
    };

    const handleUp = (e) => {
      const p = getPlanePoint(e);
      if (dragStartRef.current) {
        const a = dragStartRef.current;
        const b = { x: p.x, y: p.y, z: 0 };
        const width = Math.abs(b.x - a.x);
        const height = Math.abs(b.y - a.y);
        if (toolPreview?.type === 'select_area' && toolPreview?.data?.polygon) {
          addSelectedArea(toolPreview.data.polygon);
          addDebugInfo(`SelectArea end at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) size (${width.toFixed(2)} x ${height.toFixed(2)})`, 'system');
          clearToolPreview();
        } else {
          addDebugInfo(`SelectArea end at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, 'system');
        }
        dragStartRef.current = null;
        setCurrentTool('interact');
      } else if (navStartRef.current) {
        const a = navStartRef.current;
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const yaw = Math.atan2(dy, dx);
        addNavGoal({ x: a.x, y: a.y, z: a.z || 0, yaw });
        addDebugInfo(`NavGoal end at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) yaw ${((yaw*180)/Math.PI).toFixed(1)}°`, 'system');
        clearToolPreview();
        navStartRef.current = null;
        setCurrentTool('interact');
      }
    };

    gl.domElement.addEventListener('pointerdown', handleDown);
    gl.domElement.addEventListener('pointermove', handleMove);
    gl.domElement.addEventListener('pointerup', handleUp);
    return () => {
      gl.domElement.removeEventListener('pointerdown', handleDown);
      gl.domElement.removeEventListener('pointermove', handleMove);
      gl.domElement.removeEventListener('pointerup', handleUp);
    };
  }, [camera, gl, currentTool, setToolPreview, setCurrentTool, addMissionPoint, addSelectedArea, addNavGoal, addDebugInfo, clearToolPreview]);

  return null;
};
