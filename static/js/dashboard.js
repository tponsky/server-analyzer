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
    if (viewName === 'processes') {
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
        messagesDiv.innerHTML += `<div class="chat-message assistant"><p>${escapeHtml(data.response || data.error)}</p></div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        document.getElementById('typingIndicator').remove();
        messagesDiv.innerHTML += `<div class="chat-message assistant"><p>Error: ${error.message}</p></div>`;
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

