<script>
	import { T } from '@threlte/core';

	export let markers = [];
	export let color = '#00ff00';
	export let scale = 1.0;
</script>

{#each markers as marker (marker.id)}
	<T.Mesh 
		position={marker.position}
		rotation={marker.rotation}
		scale={[marker.scale[0] * scale, marker.scale[1] * scale, marker.scale[2] * scale]}
	>
		{#if marker.type === 'cube'}
			<T.BoxGeometry />
		{:else if marker.type === 'sphere'}
			<T.SphereGeometry />
		{:else}
			<T.BoxGeometry />
		{/if}
		<T.MeshStandardMaterial {color} />
	</T.Mesh>
{/each}