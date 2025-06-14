import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { initializePlugins } from './plugins';

function PointCloud({ data }) {
  const points = useMemo(() => {
    if (!data || !data.points) return null;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(data.points.length * 3);
    const colors = new Float32Array(data.points.length * 3);
    
    data.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      
      // 根据高度设置颜色
      const height = point.z;
      const normalizedHeight = (height + 2) / 4; // 假设高度范围 -2 到 2
      colors[i * 3] = normalizedHeight; // R
      colors[i * 3 + 1] = 1 - normalizedHeight; // G
      colors[i * 3 + 2] = 0.5; // B
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, [data]);

  if (!points) return null;

  return (
    <points geometry={points}>
      <pointsMaterial size={0.05} vertexColors />
    </points>
  );
}

function Markers({ data }) {
  if (!data || !data.markers) return null;

  return (
    <group>
      {data.markers.map((marker, index) => {
        const { position, scale, color } = marker;
        return (
          <mesh key={index} position={[position.x, position.y, position.z]}>
            <boxGeometry args={[scale.x, scale.y, scale.z]} />
            <meshStandardMaterial color={[color.r, color.g, color.b]} />
          </mesh>
        );
      })}
    </group>
  );
}

function RobotPose({ data }) {
  if (!data || !data.pose) return null;

  const { position, orientation } = data.pose;
  
  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 机器人主体 */}
      <mesh>
        <boxGeometry args={[0.5, 0.3, 0.2]} />
        <meshStandardMaterial color="blue" />
      </mesh>
      {/* 方向指示器 */}
      <mesh position={[0.3, 0, 0]}>
        <coneGeometry args={[0.1, 0.2, 8]} rotation={[0, 0, -Math.PI/2]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  );
}

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

function AirplaneModel({ orientation, scale = 0.3 }) {
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
        // 如果没有材质或需要自定义材质
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

function IMUVisualization({ data }) {
  // 将所有 useMemo 移到条件检查之前
  const position = [0, 0, 1]; // IMU 位置
  
  // 构建 twist 数据结构
  const twist = useMemo(() => {
    if (!data) return null;
    return {
      linear: data.linear_acceleration || { x: 0, y: 0, z: 0 },
      angular: data.angular_velocity || { x: 0, y: 0, z: 0 }
    };
  }, [data]);
  
  // 线速度箭头的终点
  const linearEnd = useMemo(() => {
    if (!twist || !twist.linear) return position;
    const scale = 2; // 缩放因子
    return [
      position[0] + twist.linear.x * scale,
      position[1] + twist.linear.y * scale,
      position[2] + twist.linear.z * scale
    ];
  }, [twist, position]);
  
  // 条件检查移到 Hooks 之后
  if (!data) return null;
  
  return (
    <group position={position}>
      {/* IMU 模型表示陀螺仪方向 */}
      <AirplaneModel orientation={data.orientation} scale={0.6} />
      
      {/* 角速度可视化 - X轴旋转 */}
      {twist && twist.angular && twist.angular.x !== 0 && (
        <mesh rotation={[0, Math.PI/2, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 16]} />
          <meshStandardMaterial color="#ff0000" opacity={Math.abs(twist.angular.x) * 10} transparent />
        </mesh>
      )}
      
      {/* 角速度可视化 - Y轴旋转 */}
      {twist && twist.angular && twist.angular.y !== 0 && (
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.35, 0.02, 8, 16]} />
          <meshStandardMaterial color="#00ff00" opacity={Math.abs(twist.angular.y) * 10} transparent />
        </mesh>
      )}
      
      {/* 角速度可视化 - Z轴旋转 */}
      {twist && twist.angular && twist.angular.z !== 0 && (
        <mesh>
          <torusGeometry args={[0.4, 0.02, 8, 16]} />
          <meshStandardMaterial color="#0000ff" opacity={Math.abs(twist.angular.z) * 10} transparent />
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

function Scene3D({ data }) {
  const [pluginManager, setPluginManager] = useState(null);
  
  useEffect(() => {
    // 初始化插件系统
    const manager = initializePlugins();
    setPluginManager(manager);
    
    // 清理函数
    return () => {
      manager.destroy();
    };
  }, []);
  
  // 监听数据变化，清理不再存在的topic实例
  useEffect(() => {
    if (!pluginManager) return;
    
    const currentTopics = new Set(Object.keys(data));
    const existingTopics = new Set(pluginManager.messageInstances.keys());
    
    // 移除不再存在的topic实例
    for (const topic of existingTopics) {
      if (!currentTopics.has(topic)) {
        pluginManager.removeInstance(topic);
      }
    }
  }, [data, pluginManager]);
  
  if (!pluginManager) {
    return <group />; // 插件系统未初始化时显示空组
  }
  
  return (
    <group>
      {/* 动态渲染所有话题数据 - 每个topic都有独立的插件实例 */}
      {Object.entries(data).map(([topic, topicData]) => {
        const renderedComponent = pluginManager.render(topic, topicData);
        return renderedComponent;
      })}
    </group>
  );
}

export default Scene3D;