<script>
	import { T } from '@threlte/core';
	import { OrbitControls, Grid } from '@threlte/extras';
	import PointCloud from './PointCloud.svelte';
	import Markers from './Markers.svelte';
	import { topicsStore } from '$lib/stores/dataStore.js';

	$: topics = $topicsStore;
</script>

<!-- 相机和控制 -->
<T.PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- 光照 -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[10, 10, 5]} intensity={1} castShadow />

<!-- 网格 -->
{#if topics.grid && topics.grid.enabled}
	<Grid 
		size={topics.grid.size} 
		divisions={topics.grid.divisions}
		colorCenterLine={topics.grid.color}
		colorGrid={topics.grid.color}
	/>
{/if}

<!-- 点云 -->
{#if topics.point_cloud && topics.point_cloud.enabled && topics.point_cloud.data}
	<PointCloud 
		points={topics.point_cloud.data}
		color={topics.point_cloud.color}
		size={topics.point_cloud.size}
	/>
{/if}

<!-- 标记 -->
{#if topics.markers && topics.markers.enabled && topics.markers.data}
	<Markers 
		markers={topics.markers.data}
		color={topics.markers.color}
		scale={topics.markers.scale}
	/>
{/if}