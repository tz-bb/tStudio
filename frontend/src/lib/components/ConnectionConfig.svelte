<script>
    import { onMount } from 'svelte';
    import { connectionStore } from '$lib/stores/connectionStore.js';
    
    let connectionState = {};
    let selectedAdapter = 'mock';
    let config = {
        host: 'localhost',
        port: 9090,
        update_interval: 0.1
    };
    let showConfig = false;
    let showTopics = false; // 新增：控制话题列表显示
    
    onMount(async () => {
        await connectionStore.loadAvailableAdapters();
    });
    
    connectionStore.subscribe(state => {
        connectionState = state;
        // 连接成功后自动显示话题列表
        if (state.status === 'connected' && state.availableTopics.length > 0) {
            showTopics = true;
        }
    });
    
    async function handleConnect() {
        const success = await connectionStore.connect(selectedAdapter, config);
        if (!success) {
            alert('连接失败: ' + connectionState.error);
        }
    }
    
    async function handleDisconnect() {
        await connectionStore.disconnect();
        showTopics = false; // 断开连接时隐藏话题列表
    }
    
    function toggleConfig() {
        showConfig = !showConfig;
    }
    
    function toggleTopics() {
        showTopics = !showTopics;
    }
    
    // 添加这个辅助函数来检查话题是否已订阅
    // 添加响应式声明来确保UI更新
    $: subscribedTopicsCount = connectionState.subscribedTopics.length;
    $: console.log('当前订阅话题列表:', connectionState.subscribedTopics);
    
    // 在 script 标签顶部添加，确保响应式更新
    $: {
        // 强制响应式更新
        console.log('ConnectionConfig 响应式更新触发:', {
            subscribedCount: connectionState.subscribedTopics.length,
            subscribedTopics: connectionState.subscribedTopics,
            timestamp: new Date().toISOString()
        });
    }
    
    // 添加专门的响应式声明来触发按钮状态更新
    $: buttonStates = connectionState.availableTopics.map(topic => ({
        name: topic.name,
        isSubscribed: isTopicSubscribed(topic.name)
    }));
    
    function isTopicSubscribed(topicName) {
        const result = connectionState.subscribedTopics.some(subscribedTopic => {
            const match1 = subscribedTopic === topicName;
            const match2 = subscribedTopic === `/${topicName}`;
            const match3 = subscribedTopic.replace(/^\//, '') === topicName.replace(/^\//, '');
            
            console.log(`检查订阅匹配 - 话题: "${topicName}", 订阅项: "${subscribedTopic}"`, {
                完全匹配: match1,
                添加斜杠匹配: match2,
                去斜杠匹配: match3
            });
            
            return match1 || match2 || match3;
        });
        
        console.log(`话题 "${topicName}" 最终订阅状态:`, result, '当前订阅列表:', connectionState.subscribedTopics);
        return result;
    }
    
    // 新增：订阅话题
    // 修复订阅话题函数
    async function handleSubscribe(topic) {
        console.log('订阅话题:', topic); // 添加调试日志
        // 确保传递正确的话题名称和类型
        const success = await connectionStore.subscribeTopic(topic.name, topic.type);
        if (!success) {
            console.error('订阅话题失败:', connectionState.error);
            alert('订阅失败，请查看控制台获取详细信息');
        }
    }
    
    // 新增：取消订阅话题
    async function handleUnsubscribe(topicName) {
        console.log('取消订阅话题:', topicName); // 添加调试日志
        const success = await connectionStore.unsubscribeTopic(topicName);
        if (!success) {
            alert('取消订阅失败');
        }
    }
</script>

<div class="connection-config">
    <div class="header">
        <h3>数据源连接</h3>
        <button class="toggle-btn" on:click={toggleConfig}>
            {showConfig ? '隐藏' : '显示'}配置
        </button>
    </div>
    
    <div class="status">
        <span class="status-indicator {connectionState.status}">
            {#if connectionState.status === 'connected'}
                ✓ 已连接
            {:else if connectionState.status === 'connecting'}
                ⏳ 连接中...
            {:else if connectionState.status === 'error'}
                ✗ 连接错误
            {:else}
                ○ 未连接
            {/if}
        </span>
        
        {#if connectionState.adapter}
            <span class="adapter-name">({connectionState.adapter})</span>
        {/if}
    </div>
    
    {#if connectionState.error}
        <div class="error-message">
            {connectionState.error}
        </div>
    {/if}
    
    {#if showConfig}
        <div class="config-panel">
            <div class="form-group">
                <label>数据源类型:</label>
                <select bind:value={selectedAdapter} disabled={connectionState.status === 'connected'}>
                    {#each connectionState.availableAdapters as adapter}
                        <option value={adapter}>{adapter.toUpperCase()}</option>
                    {/each}
                </select>
            </div>
            
            {#if selectedAdapter.startsWith('ros')}
                <div class="ros-config">
                    <div class="form-group">
                        <label>ROS Bridge 主机:</label>
                        <input 
                            bind:value={config.host} 
                            placeholder="localhost" 
                            disabled={connectionState.status === 'connected'}
                        />
                    </div>
                    
                    <div class="form-group">
                        <label>端口:</label>
                        <input 
                            bind:value={config.port} 
                            type="number" 
                            placeholder="9090" 
                            disabled={connectionState.status === 'connected'}
                        />
                    </div>
                </div>
            {:else if selectedAdapter === 'mock'}
                <div class="mock-config">
                    <div class="form-group">
                        <label>更新间隔 (秒):</label>
                        <input 
                            bind:value={config.update_interval} 
                            type="number" 
                            step="0.1" 
                            min="0.01"
                            disabled={connectionState.status === 'connected'}
                        />
                    </div>
                </div>
            {/if}
            
            <div class="actions">
                {#if connectionState.status === 'connected'}
                    <button class="disconnect-btn" on:click={handleDisconnect}>
                        断开连接
                    </button>
                {:else}
                    <button 
                        class="connect-btn" 
                        on:click={handleConnect}
                        disabled={connectionState.status === 'connecting'}
                    >
                        {connectionState.status === 'connecting' ? '连接中...' : '连接'}
                    </button>
                {/if}
            </div>
        </div>
    {/if}
    
    <!-- 新增：话题列表部分 -->
    {#if connectionState.status === 'connected' && connectionState.availableTopics.length > 0}
        <div class="topics-section">
            <div class="header">
                <h3>可用话题 ({connectionState.availableTopics.length})</h3>
                <button class="toggle-btn" on:click={toggleTopics}>
                    {showTopics ? '隐藏' : '显示'}话题
                </button>
            </div>
            
            {#if showTopics}
                <div class="topics-panel">
                    <div class="topics-list">
                        {#each connectionState.availableTopics as topic}
                            <div class="topic-item">
                                <div class="topic-info">
                                    <span class="topic-name">{topic.name}</span>
                                    <span class="topic-type">{topic.type}</span>
                                </div>
                                <div class="topic-actions">
                                    {#if isTopicSubscribed(topic.name)}
                                        <button 
                                            class="unsubscribe-btn"
                                            on:click={() => handleUnsubscribe(topic.name)}
                                        >
                                            取消订阅
                                        </button>
                                    {:else}
                                        <button 
                                            class="subscribe-btn"
                                            on:click={() => handleSubscribe(topic)}
                                        >
                                            订阅
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                    
                    {#if connectionState.subscribedTopics.length > 0}
                        <div class="subscribed-info">
                            <small>已订阅 {connectionState.subscribedTopics.length} 个话题</small>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .connection-config {
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    }
    
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .header h3 {
        margin: 0;
        color: #fff;
        font-size: 16px;
    }
    
    .toggle-btn {
        background: #444;
        color: #fff;
        border: 1px solid #666;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
    }
    
    .toggle-btn:hover {
        background: #555;
    }
    
    .status {
        margin-bottom: 12px;
    }
    
    .status-indicator {
        font-size: 14px;
        font-weight: bold;
    }
    
    .status-indicator.connected {
        color: #4CAF50;
    }
    
    .status-indicator.connecting {
        color: #FF9800;
    }
    
    .status-indicator.error {
        color: #F44336;
    }
    
    .status-indicator:not(.connected):not(.connecting):not(.error) {
        color: #999;
    }
    
    .adapter-name {
        color: #ccc;
        font-size: 12px;
        margin-left: 8px;
    }
    
    .error-message {
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid #F44336;
        border-radius: 4px;
        padding: 8px;
        color: #F44336;
        font-size: 12px;
        margin-bottom: 12px;
    }
    
    .config-panel {
        border-top: 1px solid #333;
        padding-top: 12px;
    }
    
    .form-group {
        margin-bottom: 12px;
    }
    
    .form-group label {
        display: block;
        color: #ccc;
        font-size: 12px;
        margin-bottom: 4px;
    }
    
    .form-group input,
    .form-group select {
        width: 100%;
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 12px;
    }
    
    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: #007ACC;
    }
    
    .form-group input:disabled,
    .form-group select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .actions {
        margin-top: 16px;
    }
    
    .connect-btn,
    .disconnect-btn {
        width: 100%;
        padding: 8px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .connect-btn {
        background: #4CAF50;
        color: white;
    }
    
    .connect-btn:hover:not(:disabled) {
        background: #45a049;
    }
    
    .connect-btn:disabled {
        background: #666;
        cursor: not-allowed;
    }
    
    .disconnect-btn {
        background: #F44336;
        color: white;
    }
    
    .disconnect-btn:hover {
        background: #da190b;
    }
    
    /* 新增：话题列表样式 */
    .topics-section {
        border-top: 1px solid #333;
        padding-top: 12px;
        margin-top: 12px;
    }
    
    .topics-panel {
        border-top: 1px solid #333;
        padding-top: 12px;
    }
    
    .topics-list {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .topic-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border: 1px solid #444;
        border-radius: 4px;
        margin-bottom: 4px;
        background: rgba(255, 255, 255, 0.05);
    }
    
    .topic-info {
        flex: 1;
        min-width: 0;
    }
    
    .topic-name {
        display: block;
        color: #fff;
        font-size: 12px;
        font-weight: bold;
        word-break: break-all;
    }
    
    .topic-type {
        display: block;
        color: #999;
        font-size: 10px;
        margin-top: 2px;
    }
    
    .topic-actions {
        margin-left: 8px;
    }
    
    .subscribe-btn,
    .unsubscribe-btn {
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        font-size: 10px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .subscribe-btn {
        background: #2196F3;
        color: white;
    }
    
    .subscribe-btn:hover {
        background: #1976D2;
    }
    
    .unsubscribe-btn {
        background: #FF9800;
        color: white;
    }
    
    .unsubscribe-btn:hover {
        background: #F57C00;
    }
    
    .subscribed-info {
        text-align: center;
        color: #999;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #333;
    }
</style>