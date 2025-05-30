<script>
	import { T } from '@threlte/core';
	import * as THREE from 'three';
	import { onMount } from 'svelte';

	export let points = [];
	export let color = '#ff0000';
	export let size = 0.1;

	let geometry;
	let material;

	$: if (points && points.length > 0) {
		updatePointCloud();
	}

	function updatePointCloud() {
		if (!geometry) return;
		
		const positions = new Float32Array(points.length * 3);
		for (let i = 0; i < points.length; i++) {
			positions[i * 3] = points[i][0];
			positions[i * 3 + 1] = points[i][1];
			positions[i * 3 + 2] = points[i][2];
		}
		
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.attributes.position.needsUpdate = true;
	}

	onMount(() => {
		geometry = new THREE.BufferGeometry();
		material = new THREE.PointsMaterial({ 
			color: new THREE.Color(color), 
			size: size 
		});
		updatePointCloud();
	});

	$: if (material) {
		material.color = new THREE.Color(color);
		material.size = size;
	}
</script>

{#if geometry && material}
	<T.Points {geometry} {material} />
{/if}