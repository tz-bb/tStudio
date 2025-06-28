import React, { useContext } from 'react';
import { UIPanelPlugin } from '../base/UIPanelPlugin';
import { AppContext } from '../../services/AppContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import Scene3D from '../../components/Scene3D';
import * as THREE from 'three';

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const World = ({ data }) => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <Scene3D data={data} />
    <Grid args={[30, 30]} />
    <axesHelper args={[5]} />
  </group>
);

const Scene3DComponent = () => {
  const { sceneData } = useContext(AppContext);
  return (
    <Canvas
      camera={{ position: [7, -14, 10], fov: 60 }}
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