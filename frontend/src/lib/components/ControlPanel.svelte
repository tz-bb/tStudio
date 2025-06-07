<script>
	import { visualConfigStore, topicsDataStore, updateTopicConfig } from '$lib/stores/dataStore.js';
	import { connectionStore } from '$lib/stores/connectionStore.js';
	import ConnectionConfig from './ConnectionConfig.svelte';

	$: topics = $visualConfigStore;
	$: topicsData = $topicsDataStore;
	$: connectionState = $connectionStore;
	
	// 添加调试日志
	$: console.log('ControlPanel话题配置:', topics);
	$: console.log('ControlPanel话题数据:', topicsData);
	$: console.log('ControlPanel连接状态:', connectionState);

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
	<!-- 连接配置组件 -->
	<ConnectionConfig />
	
	<h2>数据可视化控制</h2>
	
	<!-- 显示已订阅的话题 -->
	{#if connectionState.subscribedTopics && connectionState.subscribedTopics.length > 0}
		<div class="subscribed-topics">
			<h3>已订阅话题:</h3>
			<ul>
				{#each connectionState.subscribedTopics as topic}
					<li>{topic}</li>
				{/each}
			</ul>
		</div>
	{/if}
	
	<!-- 显示话题数据状态 -->
	{#if Object.keys(topicsData).length > 0}
		<div class="topics-data">
			<h3>接收到的数据:</h3>
			{#each Object.entries(topicsData) as [topicName, data]}
				<div class="data-item">
					<strong>{topicName}</strong>: {data?.type || 'Unknown'}
					{#if data?.timestamp}
						<small>(最后更新: {new Date(data.timestamp * 1000).toLocaleTimeString()})</small>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	
	<!-- 原有的可视化控制 -->
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
						type="number" 
						value={topic.size}
						step="0.1"
						min="0.1"
						on:change={(e) => updateSize(topicName, e.target.value)}
					/>
				</div>
			{/if}
			
			{#if topic.scale !== undefined}
				<div class="control-item">
					<label>比例:</label>
					<input 
						type="number" 
						value={topic.scale}
						step="0.1"
						min="0.1"
						on:change={(e) => updateScale(topicName, e.target.value)}
					/>
				</div>
			{/if}
			
			{#if topic.divisions !== undefined}
				<div class="control-item">
					<label>网格分割:</label>
					<input 
						type="number" 
						value={topic.divisions}
						step="1"
						min="1"
						on:change={(e) => updateTopicConfig(topicName, { divisions: parseInt(e.target.value) })}
					/>
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
	
	.subscribed-topics, .topics-data {
		margin-bottom: 20px;
		padding: 10px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 5px;
	}
	
	.data-item {
		margin-bottom: 5px;
		font-size: 12px;
	}
	
	.data-item small {
		color: #999;
	}
</style>