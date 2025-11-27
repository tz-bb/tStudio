import React, { useContext } from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { AppContext } from '../../services/AppContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import Scene3D from '../../components/Scene3D';
import * as THREE from 'three';

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const World = ({ data }) => (
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

const Scene3DComponent = () => {
  const { sceneData } = useContext(AppContext);
  return (
    <Canvas
      camera={{ position: [7, -14, 10], fov: 60, up: [0, 0, 1] }}
      style={{ background: '#1a1a1a', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 15, 5]} intensity={1} />
      <World data={sceneData} />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
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
