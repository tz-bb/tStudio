import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';

// 3D 箭头组件
function Arrow3D({ start, end, color = 'red', thickness = 0.02 }) {
  const direction = useMemo(() => {
    const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    return dir;
  }, [start, end]);
  
  const length = direction.length();
  const midpoint = useMemo(() => [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ], [start, end]);
  
  const rotation = useMemo(() => {
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(axis, direction.normalize());
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z];
  }, [direction]);
  
  if (length < 0.01) return null;
  
  return (
    <group>
      {/* 箭头杆 */}
      <mesh position={midpoint} rotation={rotation}>
        <cylinderGeometry args={[thickness, thickness, length * 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 箭头头部 */}
      <mesh position={end} rotation={rotation}>
        <coneGeometry args={[thickness * 3, length * 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// IMU模型组件
function ImuModel({ orientation, scale = 0.3 }) {
  const { scene } = useGLTF('/imu.glb');
  const groupRef = useRef();
  
  const euler = useMemo(() => {
    if (!orientation) return [0, 0, 0];
    const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z];
  }, [orientation]);
  
  // 克隆场景以避免多个实例之间的冲突
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const cloned = scene.clone();
    
    // 遍历所有子对象，确保材质正确设置
    cloned.traverse((child) => {
      if (child.isMesh) {
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({ 
            color: '#4a90e2',
            metalness: 0.3,
            roughness: 0.4
          });
        }
      }
    });
    
    return cloned;
  }, [scene]);
  
  if (!clonedScene) {
    // 加载中的占位符
    return (
      <group ref={groupRef} rotation={euler} scale={[scale, scale, scale]}>
        <mesh>
          <boxGeometry args={[1, 0.3, 0.2]} />
          <meshStandardMaterial color="#cccccc" opacity={0.5} transparent />
        </mesh>
      </group>
    );
  }
  
  return (
    <group ref={groupRef} rotation={euler} scale={[scale, scale, scale]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// IMU可视化组件
function ImuVisualization({ data }) {
  const position = [0, 0, 1]; // IMU 位置
  
  // 线性加速度箭头的终点
  const linearAccelEnd = useMemo(() => {
    if (!data || !data.linear_acceleration) return position;
    const scale = 2; // 缩放因子
    return [
      position[0] + data.linear_acceleration.x * scale,
      position[1] + data.linear_acceleration.y * scale,
      position[2] + data.linear_acceleration.z * scale
    ];
  }, [data, position]);
  
  if (!data) return null;
  
  return (
    <group position={position}>
      {/* IMU 模型表示方向 */}
      <ImuModel orientation={data.orientation} scale={0.6} />
      
      {/* 线性加速度可视化 - 紫色箭头 */}
      {data.linear_acceleration && (
        <Arrow3D 
          start={position} 
          end={linearAccelEnd} 
          color="#9c27b0" 
          thickness={0.03} 
        />
      )}
      
      {/* 角速度可视化 - X轴旋转（红色环） */}
      {data.angular_velocity && data.angular_velocity.x !== 0 && (
        <mesh rotation={[0, Math.PI/2, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 16]} />
          <meshStandardMaterial 
            color="#ff0000" 
            opacity={Math.min(Math.abs(data.angular_velocity.x) * 10, 1)} 
            transparent 
          />
        </mesh>
      )}
      
      {/* 角速度可视化 - Y轴旋转（绿色环） */}
      {data.angular_velocity && data.angular_velocity.y !== 0 && (
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.35, 0.02, 8, 16]} />
          <meshStandardMaterial 
            color="#00ff00" 
            opacity={Math.min(Math.abs(data.angular_velocity.y) * 10, 1)} 
            transparent 
          />
        </mesh>
      )}
      
      {/* 角速度可视化 - Z轴旋转（蓝色环） */}
      {data.angular_velocity && data.angular_velocity.z !== 0 && (
        <mesh>
          <torusGeometry args={[0.4, 0.02, 8, 16]} />
          <meshStandardMaterial 
            color="#0000ff" 
            opacity={Math.min(Math.abs(data.angular_velocity.z) * 10, 1)} 
            transparent 
          />
        </mesh>
      )}
      
      {/* 坐标系参考 */}
      <group scale={[0.3, 0.3, 0.3]}>
        {/* X 轴 - 红色 */}
        <Arrow3D start={[0, 0, 0]} end={[1, 0, 0]} color="#ff0000" thickness={0.02} />
        {/* Y 轴 - 绿色 */}
        <Arrow3D start={[0, 0, 0]} end={[0, 1, 0]} color="#00ff00" thickness={0.02} />
        {/* Z 轴 - 蓝色 */}
        <Arrow3D start={[0, 0, 0]} end={[0, 0, 1]} color="#0000ff" thickness={0.02} />
      </group>
    </group>
  );
}

// IMU插件
export class ImuPlugin extends VisualizationPlugin {
  constructor() {
    super('IMU', 15, '1.0.0'); // 高优先级
  }
  
  canHandle(topic, data) {
    // 检查是否为IMU消息
    return topic.includes('imu') || 
           topic.includes('/imu') ||
           (data && (
             (data.orientation && data.angular_velocity && data.linear_acceleration) ||
             (data.header && (data.orientation || data.angular_velocity || data.linear_acceleration))
           ));
  }
  
  render(topic, type, data) {
    console.log(`ImuPlugin rendering topic: ${topic}, data:`, data);
    return <ImuVisualization data={data} />;
  }
}

// 默认导出插件实例
export default new ImuPlugin();