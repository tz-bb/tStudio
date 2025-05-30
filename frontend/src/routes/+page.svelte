<script>
	import Scene3D from '$lib/components/Scene3D.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import { onMount } from 'svelte';
	import { topicsStore, websocketStore } from '$lib/stores/dataStore.js';

	onMount(() => {
		// 初始化WebSocket连接
		websocketStore.connect();
	});
</script>

<div class="app-container">
	<div class="scene-container">
		<Scene3D />
	</div>
	<div class="control-container">
		<ControlPanel />
	</div>
</div>

<style>
	.app-container {
		display: flex;
		width: 100vw;
		height: 100vh;
	}

	.scene-container {
		flex: 1;
		position: relative;
	}

	.control-container {
		width: 300px;
		height: 100vh;
		overflow-y: auto;
		background: rgba(0, 0, 0, 0.9);
		border-left: 1px solid #333;
	}
</style>