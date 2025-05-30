<script>
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
</script>

<Canvas>
	<Scene />
</Canvas>

<style>
	:global(canvas) {
		width: 100% !important;
		height: 100% !important;
	}
</style>