<script>
	import { T } from '@threlte/core';
	import { OrbitControls, Grid } from '@threlte/extras';
	import PointCloud from './PointCloud.svelte';
	import Markers from './Markers.svelte';
	import { visualConfigStore, topicsDataStore } from '$lib/stores/dataStore.js';

	$: config = $visualConfigStore;
	$: data = $topicsDataStore;
	
	// 添加更详细的调试日志
	$: {
	    console.log('Scene数据:', data);
	    console.log('Scene配置:', config);
	    console.log('点云数据:', pointCloudData);
	    console.log('点云配置:', config.point_cloud);
	    console.log('渲染条件检查:', {
	        hasConfig: !!config.point_cloud,
	        isEnabled: config.point_cloud?.enabled,
	        hasData: !!pointCloudData,
	        pointsArray: pointCloudData?.points
	    });
	}
	
	// 动态查找点云和标记数据（支持多种类型）
	$: pointCloudData = Object.values(data).find(item => 
		item?.type === 'PointCloud' || 
		(item?.type === 'generic' && item?.message_type?.includes('PointCloud'))
	);
	$: markersData = Object.values(data).find(item => 
		item?.type === 'Markers' || 
		(item?.type === 'generic' && item?.message_type?.includes('Marker'))
	);
	
	// 为IMU数据创建简单的可视化
	$: imuData = Object.values(data).find(item => 
		item?.message_type?.includes('Imu')
	);
</script>

<!-- 相机和控制 -->
<T.PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- 光照 -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[10, 10, 5]} intensity={1} castShadow />

<!-- 网格 -->
{#if config.grid && config.grid.enabled}
	<Grid 
		size={config.grid.size} 
		divisions={config.grid.divisions}
		colorCenterLine={config.grid.color}
		colorGrid={config.grid.color}
	/>
{/if}

<!-- 点云 -->
{#if config.point_cloud && config.point_cloud.enabled && pointCloudData}
	<PointCloud 
		points={pointCloudData.data || pointCloudData}
		color={config.point_cloud.color}
		size={config.point_cloud.size}
	/>
{/if}

<!-- 标记 -->
{#if config.markers && config.markers.enabled && markersData}
	<Markers 
		markers={markersData.data || markersData}
		color={config.markers.color}
		scale={config.markers.scale}
	/>
{/if}

<!-- IMU数据可视化（简单的坐标轴显示） -->
{#if imuData}
	<T.Group>
		<!-- X轴 - 红色 -->
		<T.Mesh position={[1, 0, 0]}>
			<T.CylinderGeometry args={[0.05, 0.05, 2]} />
			<T.MeshBasicMaterial color="red" />
		</T.Mesh>
		<!-- Y轴 - 绿色 -->
		<T.Mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI/2]}>
			<T.CylinderGeometry args={[0.05, 0.05, 2]} />
			<T.MeshBasicMaterial color="green" />
		</T.Mesh>
		<!-- Z轴 - 蓝色 -->
		<T.Mesh position={[0, 0, 1]} rotation={[Math.PI/2, 0, 0]}>
			<T.CylinderGeometry args={[0.05, 0.05, 2]} />
			<T.MeshBasicMaterial color="blue" />
		</T.Mesh>
	</T.Group>
{/if}