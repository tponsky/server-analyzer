// State
let currentServer = null;
let metricsChart = null;
let historyChart = null;
let refreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Select first server by default
    const firstServer = document.querySelector('.server-item');
    if (firstServer) {
        selectServer(firstServer.dataset.server);
    }
});

function setupEventListeners() {
    // Server selection
    document.querySelectorAll('.server-item').forEach(item => {
        item.addEventListener('click', () => selectServer(item.dataset.server));
    });
    
    // View switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    
    // Auto-refresh toggle
    document.getElementById('autoRefresh').addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

// API Helper
async function fetchAPI(endpoint) {
    const response = await fetch(`/api${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Server Selection
function selectServer(serverId) {
    currentServer = serverId;
    
    // Update UI
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.toggle('active', item.dataset.server === serverId);
    });
    
    const serverName = document.querySelector(`.server-item[data-server="${serverId}"] .server-name`).textContent;
    document.getElementById('serverTitle').textContent = serverName;
    
    // Load data
    loadServerData();
    startAutoRefresh();
}

// View Switching
function switchView(viewName) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    
    // Load view-specific data
    if (viewName === 'overview') {
        loadAIRecommendations();
    } else if (viewName === 'processes') {
        loadProcesses();
    } else if (viewName === 'docker') {
        loadDocker();
    } else if (viewName === 'history') {
        loadHistory();
    } else if (viewName === 'chat') {
        setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
    } else if (viewName === 'actions') {
        loadAllActions();
    }
}

// Data Loading
async function loadServerData() {
    if (!currentServer) return;
    
    showLoading(true);
    
    try {
        const metrics = await fetchAPI(`/metrics/${currentServer}`);
        updateMetrics(metrics);
        updateStatus(metrics.status);
        document.getElementById('lastUpdate').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        
        // Auto-load AI recommendations on overview screen
        if (document.getElementById('view-overview').classList.contains('active')) {
            loadAIRecommendations();
        }
    } catch (error) {
        console.error('Failed to load metrics:', error);
        updateStatus('offline');
    } finally {
        showLoading(false);
    }
}

function updateMetrics(data) {
    if (data.status !== 'online') return;
    
    // CPU
    document.getElementById('cpuValue').textContent = `${data.cpu?.percent?.toFixed(1) || '--'} %`;
    document.getElementById('cpuCores').textContent = `${data.cpu?.cores || '--'} cores`;
    document.getElementById('loadAvg').textContent = `Load: ${data.cpu?.load_avg || '--'}`;
    
    // Memory
    const memPercent = data.memory?.percent || 0;
    const memUsedGB = (data.memory?.used / 1073741824).toFixed(1);
    const memTotalGB = (data.memory?.total / 1073741824).toFixed(1);
    document.getElementById('memValue').textContent = `${memPercent} %`;
    document.getElementById('memUsed').textContent = `${memUsedGB} GB`;
    document.getElementById('memTotal').textContent = `of ${memTotalGB} GB`;
    
    // Disk
    const diskPercent = data.disk?.percent || 0;
    const diskUsedGB = (data.disk?.used / 1073741824).toFixed(1);
    const diskTotalGB = (data.disk?.total / 1073741824).toFixed(1);
    document.getElementById('diskValue').textContent = `${diskPercent} %`;
    document.getElementById('diskUsed').textContent = `${diskUsedGB} GB`;
    document.getElementById('diskTotal').textContent = `of ${diskTotalGB} GB`;
    
    // Uptime
    document.getElementById('uptimeValue').textContent = data.uptime || '--';
    document.getElementById('hostname').textContent = data.hostname || '--';
}

function updateStatus(status) {
    const badge = document.getElementById('serverStatus');
    badge.textContent = status === 'online' ? 'Online' : 'Offline';
    badge.className = `status-badge ${status}`;
}

// Processes
async function loadProcesses() {
    if (!currentServer) return;
    
    try {
        const data = await fetchAPI(`/processes/${currentServer}`);
        const tbody = document.getElementById('processTable');
        
        tbody.innerHTML = data.processes.map(p => `
            <tr>
                <td>${escapeHtml(p.user)}</td>
                <td>${p.pid}</td>
                <td>${p.cpu}%</td>
                <td>${p.mem}%</td>
                <td>${escapeHtml(p.command)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load processes:', error);
    }
}

// Docker
async function loadDocker() {
    if (!currentServer) return;
    
    try {
        const data = await fetchAPI(`/docker/${currentServer}`);
        
        document.getElementById('dockerRunning').textContent = data.running;
        document.getElementById('dockerTotal').textContent = data.total;
        
        const tbody = document.getElementById('dockerTable');
        tbody.innerHTML = data.containers.map(c => `
            <tr>
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.image)}</td>
                <td>${escapeHtml(c.status)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load Docker info:', error);
    }
}

// History
async function loadHistory() {
    if (!currentServer) return;
    
    try {
        const data = await fetchAPI(`/history/${currentServer}?hours=24`);
        updateHistoryChart(data.history);
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function updateHistoryChart(history) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    if (historyChart) historyChart.destroy();
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.timestamp).toLocaleTimeString()),
            datasets: [
                {
                    label: 'CPU %',
                    data: history.map(h => h.cpu),
                    borderColor: '#6366f1',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Memory %',
                    data: history.map(h => h.memory),
                    borderColor: '#22c55e',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Disk %',
                    data: history.map(h => h.disk),
                    borderColor: '#f59e0b',
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#a0a0b0' } }
            },
            scales: {
                x: { ticks: { color: '#606070' }, grid: { color: '#2a2a3a' } },
                y: { ticks: { color: '#606070' }, grid: { color: '#2a2a3a' }, min: 0, max: 100 }
            }
        }
    });
}

// Deep Analysis
async function runDeepAnalysis() {
    if (!currentServer) return;
    
    document.getElementById('diskAnalysis').textContent = 'Analyzing...';
    document.getElementById('dockerAnalysis').textContent = 'Analyzing...';
    document.getElementById('largeFiles').textContent = 'Analyzing...';
    document.getElementById('memoryAnalysis').textContent = 'Analyzing...';
    
    try {
        const data = await fetchAPI(`/analyze/${currentServer}`);
        
        document.getElementById('diskAnalysis').textContent = data.disk_by_directory || 'No data';
        document.getElementById('dockerAnalysis').textContent = data.docker_disk || 'No data';
        document.getElementById('largeFiles').textContent = data.large_files || 'No large files found';
        document.getElementById('memoryAnalysis').textContent = data.memory_processes || 'No data';
    } catch (error) {
        document.getElementById('diskAnalysis').textContent = `Error: ${error.message}`;
    }
}

// AI Chat
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question || !currentServer) return;
    
    input.value = '';
    
    const messagesDiv = document.getElementById('chatMessages');
    
    // Add user message
    messagesDiv.innerHTML += `<div class="chat-message user"><p>${escapeHtml(question)}</p></div>`;
    messagesDiv.innerHTML += `<div class="chat-message assistant" id="typingIndicator"><p>Thinking...</p></div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        const response = await fetch(`/api/chat/${currentServer}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        
        const data = await response.json();
        
        document.getElementById('typingIndicator').remove();
        
        // Check if response is structured (new format) or plain text (old format)
        if (data.response && typeof data.response === 'object' && data.response.summary) {
            displayStructuredResponse(data.response, messagesDiv);
        } else {
            // Fallback to plain text
            messagesDiv.innerHTML += `<div class="chat-message assistant"><p>${escapeHtml(data.response || data.error || 'No response')}</p></div>`;
        }
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        document.getElementById('typingIndicator').remove();
        messagesDiv.innerHTML += `<div class="chat-message assistant"><p>Error: ${error.message}</p></div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function displayStructuredResponse(response, container) {
    // Check if this is for chat (append) or overview (replace)
    const isChat = container.id === 'chatMessages';
    let html = isChat ? '<div class="chat-message assistant">' : '';
    
    // Summary
    if (response.summary) {
        html += `<div class="ai-summary"><p>${escapeHtml(response.summary)}</p></div>`;
    }
    
    // Recommendations
    if (response.recommendations && response.recommendations.length > 0) {
        html += '<div class="ai-recommendations">';
        response.recommendations.forEach((rec, index) => {
            const risk = rec.risk || 'YELLOW';
            const riskClass = risk.toLowerCase();
            const riskColors = {
                'green': { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', icon: '✓' },
                'yellow': { bg: 'rgba(234, 179, 8, 0.1)', border: '#eab308', icon: '⚠' },
                'red': { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', icon: '⚠' }
            };
            const colors = riskColors[riskClass] || riskColors['yellow'];
            const hasAction = rec.action_id || rec.action;
            const recId = `rec-${Date.now()}-${index}`;
            
            // Store recommendation data - use base64 encoding to avoid escaping issues
            const recData = btoa(JSON.stringify(rec));
            
            html += `
                <div class="ai-recommendation ${hasAction ? 'clickable' : ''}" 
                     style="border-left: 4px solid ${colors.border}; background: ${colors.bg};"
                     data-rec-id="${recId}"
                     data-rec-data="${recData}"
                     ${hasAction ? `onclick="executeRecommendationFromElement(this)"` : ''}>
                    <div class="ai-rec-header">
                        <span class="ai-rec-risk" style="color: ${colors.border};">
                            <strong>${colors.icon} ${risk}</strong>
                        </span>
                        <h4>${escapeHtml(rec.title || 'Recommendation')}</h4>
                        ${hasAction ? '<span class="ai-rec-click-hint">Click to execute →</span>' : ''}
                    </div>
                    <p class="ai-rec-description">${escapeHtml(rec.description || '')}</p>
                    ${rec.considerations ? `<div class="ai-rec-considerations"><strong>Things to know:</strong> ${escapeHtml(rec.considerations)}</div>` : ''}
                    ${rec.action && !rec.action_id ? `<div class="ai-rec-action"><code>${escapeHtml(rec.action)}</code></div>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Upgrade suggestion
    if (response.upgrade_suggestion && response.upgrade_suggestion.needed) {
        html += `
            <div class="ai-upgrade-suggestion">
                <div class="ai-upgrade-header">
                    <span class="ai-upgrade-icon">💻</span>
                    <h4>Consider Upgrading Your Server</h4>
                </div>
                <p><strong>Why:</strong> ${escapeHtml(response.upgrade_suggestion.reason || '')}</p>
                ${response.upgrade_suggestion.current_specs ? `<p><strong>Current:</strong> ${escapeHtml(response.upgrade_suggestion.current_specs)}</p>` : ''}
                ${response.upgrade_suggestion.recommended ? `<p><strong>Recommended:</strong> ${escapeHtml(response.upgrade_suggestion.recommended)}</p>` : ''}
            </div>
        `;
    }
    
    if (isChat) {
        html += '</div>';
        container.innerHTML += html;
    } else {
        container.innerHTML = html;
    }
}

function executeRecommendationFromElement(element) {
    const recData = element.getAttribute('data-rec-data');
    if (!recData) return;
    
    try {
        const recommendation = JSON.parse(atob(recData));
        const recId = element.getAttribute('data-rec-id');
        executeRecommendation(recId, recommendation, element);
    } catch (e) {
        console.error('Failed to parse recommendation data:', e);
    }
}

async function executeRecommendation(recId, recommendation, recElement = null) {
    if (!currentServer) return;
    
    if (!recElement) {
        recElement = document.querySelector(`[data-rec-id="${recId}"]`);
    }
    if (!recElement) return;
    
    // Show loading state
    const originalContent = recElement.innerHTML;
    recElement.classList.add('executing');
    recElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div class="spinner-small"></div>
            <span>Executing...</span>
        </div>
    `;
    
    try {
        if (recommendation.action_id) {
            // Use existing action
            const response = await fetch(`/api/actions/${currentServer}/${recommendation.action_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            // Show result
            recElement.classList.remove('executing');
            recElement.classList.add('executed');
            recElement.innerHTML = `
                <div class="ai-rec-header">
                    <span class="ai-rec-risk" style="color: ${result.success ? '#22c55e' : '#ef4444'};">
                        <strong>${result.success ? '✓' : '✗'} ${result.success ? 'Completed' : 'Failed'}</strong>
                    </span>
                    <h4>${escapeHtml(recommendation.title || 'Recommendation')}</h4>
                </div>
                <div class="ai-rec-result">
                    ${result.success ? 
                        `<div style="color: #22c55e; margin: 10px 0;"><strong>Success!</strong></div>
                         ${result.output ? `<pre style="background: rgba(0,0,0,0.1); padding: 10px; border-radius: 4px; font-size: 12px; max-height: 200px; overflow-y: auto;">${escapeHtml(result.output)}</pre>` : ''}` :
                        `<div style="color: #ef4444; margin: 10px 0;"><strong>Error:</strong> ${escapeHtml(result.error || 'Unknown error')}</div>`
                    }
                </div>
            `;
        } else if (recommendation.action) {
            // Custom command - would need a new endpoint for custom commands
            recElement.classList.remove('executing');
            recElement.innerHTML = `
                <div class="ai-rec-header">
                    <span class="ai-rec-risk" style="color: #eab308;">
                        <strong>⚠ Manual Action Required</strong>
                    </span>
                    <h4>${escapeHtml(recommendation.title || 'Recommendation')}</h4>
                </div>
                <p>This action requires manual execution. Command:</p>
                <div class="ai-rec-action"><code>${escapeHtml(recommendation.action)}</code></div>
            `;
        }
    } catch (error) {
        recElement.classList.remove('executing');
        recElement.innerHTML = `
            <div class="ai-rec-header">
                <span class="ai-rec-risk" style="color: #ef4444;">
                    <strong>✗ Error</strong>
                </span>
                <h4>${escapeHtml(recommendation.title || 'Recommendation')}</h4>
            </div>
            <div style="color: #ef4444;">Error: ${escapeHtml(error.message)}</div>
        `;
    }
}

function askSuggestion(question) {
    document.getElementById('chatInput').value = question;
    sendChatMessage();
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') sendChatMessage();
}

// Smart Actions
async function loadSuggestions() {
    if (!currentServer) return;
    
    const panel = document.getElementById('suggestionsPanel');
    panel.innerHTML = '<div class="suggestion-empty"><div class="spinner"></div><p>Scanning server...</p></div>';
    
    try {
        const data = await fetchAPI(`/suggestions/${currentServer}`);
        displaySuggestions(data);
    } catch (error) {
        panel.innerHTML = `<div class="suggestion-empty"><p>Error: ${error.message}</p></div>`;
    }
    
    loadAllActions();
}

function displaySuggestions(data) {
    const panel = document.getElementById('suggestionsPanel');
    const suggestions = data.suggestions || [];
    
    if (suggestions.length === 0) {
        panel.innerHTML = `
            <div class="suggestion-card" style="border-color: var(--success); background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), var(--bg-card));">
                <div class="suggestion-header">
                    <div class="suggestion-icon" style="background: rgba(34, 197, 94, 0.2); color: var(--success);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <span class="suggestion-title">All Good!</span>
                </div>
                <p class="suggestion-message">No issues detected. Your server is running smoothly.</p>
                <p style="font-size:12px;color:var(--text-muted)">
                    CPU: ${data.metrics_summary?.cpu?.toFixed(1) || '--'}% | 
                    Memory: ${data.metrics_summary?.memory?.toFixed(1) || '--'}% | 
                    Disk: ${data.metrics_summary?.disk?.toFixed(1) || '--'}%
                </p>
            </div>
        `;
        return;
    }
    
    panel.innerHTML = suggestions.map(s => `
        <div class="suggestion-card ${s.severity}">
            <div class="suggestion-header">
                <div class="suggestion-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    </svg>
                </div>
                <span class="suggestion-title">${escapeHtml(s.title)}</span>
            </div>
            <p class="suggestion-message">${escapeHtml(s.message)}</p>
            <div class="suggestion-actions">
                ${(s.action_details || []).map(a => `
                    <button class="action-btn ${a.dangerous ? 'dangerous' : ''}" 
                            onclick="runAction('${a.id}')"
                            id="action-btn-${a.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        ${escapeHtml(a.name)}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

async function loadAllActions() {
    try {
        const data = await fetchAPI('/actions');
        const grid = document.getElementById('allActionsGrid');
        
        grid.innerHTML = (data.actions || []).map(a => `
            <div class="action-card">
                <div class="action-info">
                    <div class="action-name">${escapeHtml(a.name)}</div>
                    <div class="action-desc">${escapeHtml(a.description)}</div>
                </div>
                <button class="action-run-btn ${a.dangerous ? 'dangerous' : ''}"
                        onclick="runAction('${a.id}')"
                        id="action-card-btn-${a.id}">
                    Run
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load actions:', error);
    }
}

async function runAction(actionId) {
    if (!currentServer) return;
    
    const btns = document.querySelectorAll(`[id*="${actionId}"]`);
    btns.forEach(btn => {
        btn.classList.add('running');
        btn.innerHTML = '<div class="spinner-small"></div> Running...';
    });
    
    try {
        const response = await fetch(`/api/actions/${currentServer}/${actionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        showActionResult(result);
    } catch (error) {
        showActionResult({ success: false, action: actionId, error: error.message });
    }
}

function showActionResult(result) {
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('actionModalTitle');
    const output = document.getElementById('actionOutput');
    
    title.textContent = result.action || 'Action Result';
    output.className = result.success ? 'action-result-success' : 'action-result-error';
    output.textContent = result.success ? (result.output || 'Success!') : (result.error || 'Failed');
    
    modal.classList.add('active');
}

function closeActionModal() {
    document.getElementById('actionModal').classList.remove('active');
    
    document.querySelectorAll('.action-btn.running, .action-run-btn.running').forEach(btn => {
        btn.classList.remove('running');
        btn.textContent = btn.classList.contains('action-run-btn') ? 'Run' : btn.textContent;
    });
    
    loadSuggestions();
}

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function startAutoRefresh() {
    stopAutoRefresh();
    if (document.getElementById('autoRefresh').checked && currentServer) {
        refreshInterval = setInterval(loadServerData, 30000);
    }
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function refreshData() {
    loadServerData();
}

// Expose global functions
window.refreshData = refreshData;
window.runDeepAnalysis = runDeepAnalysis;
window.sendChatMessage = sendChatMessage;
window.askSuggestion = askSuggestion;
window.handleChatKeypress = handleChatKeypress;
window.loadSuggestions = loadSuggestions;
window.loadAllActions = loadAllActions;
window.runAction = runAction;
window.closeActionModal = closeActionModal;
window.executeRecommendation = executeRecommendation;
window.executeRecommendationFromElement = executeRecommendationFromElement;
window.loadAIRecommendations = loadAIRecommendations;

// Load AI Recommendations for Overview Screen
async function loadAIRecommendations() {
    if (!currentServer) return;
    
    const container = document.getElementById('overviewAIRecommendations');
    const btn = document.getElementById('refreshAIBtn');
    
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="ai-recommendations-placeholder">
            <div class="spinner" style="width:30px;height:30px;margin:0 auto 10px"></div>
            <p>Analyzing server and generating recommendations...</p>
        </div>
    `;
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div> Analyzing...';
    }
    
    try {
        // Get current metrics
        const metrics = await fetchAPI(`/metrics/${currentServer}`);
        const processes = await fetchAPI(`/processes/${currentServer}`);
        const docker = await fetchAPI(`/docker/${currentServer}`);
        
        const server_data = {
            metrics: metrics,
            top_processes: processes.processes?.slice(0, 5) || [],
            docker: docker
        };
        
        // Generate smart question based on current state
        let question = "Analyze my server and provide recommendations.";
        const diskPercent = metrics.disk?.percent || 0;
        const memPercent = metrics.memory?.percent || 0;
        const cpuPercent = metrics.cpu?.percent || 0;
        
        if (diskPercent > 80) {
            question = "My disk is getting full. How can I free up space safely?";
        } else if (memPercent > 80) {
            question = "My memory usage is high. What's using it and how can I optimize it?";
        } else if (cpuPercent > 80) {
            question = "My CPU usage is high. What should I do?";
        } else {
            question = "Analyze my server health and provide any recommendations for optimization.";
        }
        
        // Get AI analysis
        const response = await fetch(`/api/chat/${currentServer}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        
        const data = await response.json();
        
        // Display recommendations
        if (data.response && typeof data.response === 'object' && data.response.summary) {
            displayStructuredResponse(data.response, container);
        } else {
            container.innerHTML = `
                <div class="ai-recommendations-placeholder">
                    <p>Unable to generate recommendations. Please try the AI Assistant chat for detailed analysis.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load AI recommendations:', error);
        container.innerHTML = `
            <div class="ai-recommendations-placeholder">
                <p style="color: var(--danger);">Error loading recommendations: ${escapeHtml(error.message)}</p>
            </div>
        `;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Analyze
            `;
        }
    }
}


