<script>
	import { topicsStore, updateTopicConfig } from '$lib/stores/dataStore.js';

	$: topics = $topicsStore;

	async function toggleTopic(topicName, enabled) {
		await updateTopicConfig(topicName, { enabled });
	}

	async function updateColor(topicName, color) {
		await updateTopicConfig(topicName, { color });
	}

	async function updateSize(topicName, size) {
		await updateTopicConfig(topicName, { size: parseFloat(size) });
	}

	async function updateScale(topicName, scale) {
		await updateTopicConfig(topicName, { scale: parseFloat(scale) });
	}
</script>

<div class="control-panel">
	<h2>数据可视化控制</h2>
	
	{#each Object.entries(topics) as [topicName, topic]}
		<div class="panel">
			<h3>{topic.type}</h3>
			
			<div class="control-item">
				<label>
					<input 
						type="checkbox" 
						checked={topic.enabled}
						on:change={(e) => toggleTopic(topicName, e.target.checked)}
					/>
					启用
				</label>
			</div>
			
			<div class="control-item">
				<label>颜色:</label>
				<input 
					type="color" 
					value={topic.color}
					on:change={(e) => updateColor(topicName, e.target.value)}
				/>
			</div>
			
			{#if topic.size !== undefined}
				<div class="control-item">
					<label>大小:</label>
					<input 
						type="range" 
						min="0.01" 
						max="1" 
						step="0.01"
						value={topic.size}
						on:input={(e) => updateSize(topicName, e.target.value)}
					/>
					<span>{topic.size}</span>
				</div>
			{/if}
			
			{#if topic.scale !== undefined}
				<div class="control-item">
					<label>缩放:</label>
					<input 
						type="range" 
						min="0.1" 
						max="3" 
						step="0.1"
						value={topic.scale}
						on:input={(e) => updateScale(topicName, e.target.value)}
					/>
					<span>{topic.scale}</span>
				</div>
			{/if}
			
			{#if topic.data && Array.isArray(topic.data)}
				<div class="control-item">
					<label>数据点数:</label>
					<span>{topic.data.length}</span>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.control-panel {
		padding: 20px;
		height: 100%;
		overflow-y: auto;
	}
	
	h2 {
		margin-bottom: 20px;
		font-size: 18px;
		color: #fff;
	}
	
	h3 {
		margin-bottom: 10px;
		font-size: 14px;
		color: #ccc;
	}
</style>