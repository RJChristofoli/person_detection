// Global state
let socket = null;
let isConnected = false;
let startTime = null;
let peopleCount = 0;
let currentFilters = {};
let timeInterval = null;
let qrStopNotified = false;

// DOM elements
const videoFeed = document.getElementById('video-feed');
// Start/Stop buttons were removed from UI; keep null references to avoid errors
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const peopleCountEl = document.getElementById('people-count');
const timeTrackingEl = document.getElementById('time-tracking');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// Dashboard overview cards
const totalTrackedEl = document.getElementById('total-tracked');
const activeInFrameEl = document.getElementById('active-in-frame');
const holdingObjectsCountEl = document.getElementById('holding-objects-count');
const avgTimeSpentEl = document.getElementById('avg-time-spent');

// Filters UI
const filterColorEl = document.getElementById('filter-color');
const filterActionEl = document.getElementById('filter-action');
const filterHoldingEl = document.getElementById('filter-holding');
const filterFromEl = document.getElementById('filter-from');
const filterToEl = document.getElementById('filter-to');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const personsTbody = document.getElementById('persons-tbody');

// Chart.js instances
let actionsChartInstance = null;
let colorsChartInstance = null;
let objectsChartInstance = null;
let detectionsTimeChartInstance = null;

// Backend API URL (usa 127.0.0.1 para evitar problemas com IPv6/localhost)
const API_PORT = 8001;
const BACKEND_HOST = (typeof window !== 'undefined' && window.location &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '127.0.0.1'
  : (typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1');
// Base para os endpoints FastAPI com prefixo /api
const API_URL = `http://${BACKEND_HOST}:${API_PORT}/api`;

// Initialize the application
function init() {
    // Detection controls & chat
    if (startBtn) startBtn.addEventListener('click', startDetection);
    if (stopBtn) stopBtn.addEventListener('click', stopDetection);
    sendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Filters
    if (applyFiltersBtn && clearFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            currentFilters = getFiltersFromUI();
            refreshDashboard(currentFilters);
        });
        clearFiltersBtn.addEventListener('click', () => {
            filterColorEl.value = '';
            filterActionEl.value = '';
            filterHoldingEl.value = '';
            filterFromEl.value = '';
            filterToEl.value = '';
            currentFilters = {};
            refreshDashboard(currentFilters);
        });
    }

    // Placeholder for video until camera starts
    videoFeed.src = createPlaceholder();

    // Initialize charts and first data load
    initCharts();
    refreshDashboard({});
    // Periodic refresh of dashboard data
    setInterval(() => refreshDashboard(currentFilters), 8000);
    // Poll backend detection status to react to QR stop
    setInterval(() => pollDetectionStatus(), 2000);

    // Auto-start detection when the system (page) loads
    startDetection();
}

// Start the detection process
async function startDetection() {
    if (isConnected) return;
    try {
        // Aciona o backend para iniciar a câmera
        await fetch(`${API_URL}/detections/start`, { method: 'POST' });
        isConnected = true;
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        startTime = new Date();
        updateTimeTracking();
        // Usa stream MJPEG do backend
        videoFeed.src = `${API_URL}/detections/stream`;
        // Inicia atualização do tempo
        timeInterval = setInterval(updateTimeTracking, 1000);
    } catch (error) {
        console.error('Erro ao iniciar detecção:', error);
        addChatMessage('Assistente Virtual', `Erro ao iniciar detecção em ${API_URL}/detections/start`);
    }
}

// Stop the detection process
async function stopDetection() {
    if (!isConnected) return;
    try {
        await fetch(`${API_URL}/detections/stop`, { method: 'POST' });
    } catch (e) {
        // ignore
    }
    isConnected = false;
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    clearInterval(timeInterval);
    videoFeed.src = createPlaceholder();
}

function handleQRStopUI() {
    // Stop timers and replace video with placeholder
    clearInterval(timeInterval);
    isConnected = false;
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    videoFeed.src = createPlaceholder();
    // Show message in chat/UI
    try {
        addChatMessage('Assistente Virtual', 'Camera desligada por QRCODE');
    } catch (_) { /* noop */ }
}

async function pollDetectionStatus() {
    try {
        const res = await fetch(`${API_URL}/detections/status`);
        if (!res.ok) return;
        const st = await res.json();
        if (st && st.stopped_by_qr && !qrStopNotified) {
            qrStopNotified = true;
            handleQRStopUI();
        }
        // If system stopped for any reason, ensure UI shows placeholder
        if (st && st.running === false && isConnected) {
            isConnected = false;
            clearInterval(timeInterval);
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            videoFeed.src = createPlaceholder();
        }
    } catch (e) {
        // ignore polling errors
    }
}

// Update the time tracking display
function updateTimeTracking() {
    if (!startTime) return;
    
    const now = new Date();
    const diff = now - startTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    timeTrackingEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update dashboard charts
// ---- Dashboard data & charts ----

function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false, labels: { color: '#d1d5db' } }, tooltip: { enabled: true } },
        scales: {
            x: { ticks: { color: '#d1d5db' }, grid: { color: '#4b5563' } },
            y: { ticks: { color: '#d1d5db' }, grid: { color: '#4b5563' }, beginAtZero: true }
        }
    };

    // Actions (bar)
    const actionsCtx = document.getElementById('actionsChart')?.getContext('2d');
    if (actionsCtx) {
        actionsChartInstance = new Chart(actionsCtx, {
            type: 'bar',
            data: { labels: ['Walking', 'Standing'], datasets: [{ label: 'People', backgroundColor: ['#3b82f6', '#10b981'], data: [0, 0] }] },
            options: { ...commonOptions, indexAxis: 'y' }
        });
    }

    // Colors (bar)
    const colorsCtx = document.getElementById('colorsChart')?.getContext('2d');
    if (colorsCtx) {
        colorsChartInstance = new Chart(colorsCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Count', backgroundColor: '#f59e0b', data: [] }] },
            options: { ...commonOptions, indexAxis: 'y' }
        });
    }

    // Objects (bar)
    const objectsCtx = document.getElementById('objectsChart')?.getContext('2d');
    if (objectsCtx) {
        objectsChartInstance = new Chart(objectsCtx, {
            type: 'bar',
            data: { labels: ['Holding', 'Not Holding'], datasets: [{ label: 'People', backgroundColor: ['#8b5cf6', '#6b7280'], data: [0, 0] }] },
            options: { ...commonOptions, indexAxis: 'y' }
        });
    }

    // Detections over time: usar Shadcn quando não for <canvas>
    const timeEl = document.getElementById('detectionsTimeChart');
    const isCanvas = timeEl && timeEl.tagName && timeEl.tagName.toLowerCase() === 'canvas';
    if (isCanvas) {
        const timeCtx = timeEl.getContext('2d');
        if (timeCtx) {
            detectionsTimeChartInstance = new Chart(timeCtx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Detections', borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', tension: 0.3, data: [] }] },
                options: { ...commonOptions, scales: { x: { ticks: { color: '#374151' } }, y: { ticks: { color: '#374151' }, beginAtZero: true, suggestedMax: 10 } } }
            });
        }
    }
}

function getFiltersFromUI() {
    const filters = {};
    if (filterColorEl?.value) filters.color = filterColorEl.value.trim();
    if (filterActionEl?.value) filters.action = filterActionEl.value;
    if (filterHoldingEl?.value) filters.holding_object = filterHoldingEl.value;
    if (filterFromEl?.value) filters.time_from = new Date(filterFromEl.value).toISOString();
    if (filterToEl?.value) filters.time_to = new Date(filterToEl.value).toISOString();
    return filters;
}

function buildQueryString(filters) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.append(k, v); });
    return params.toString();
}

async function fetchPersons(filters = {}) {
    try {
        // Backend atual expõe pessoas em /api/people/
        const qs = buildQueryString(filters);
        const url = `${API_URL}/people/${qs ? `?${qs}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Error fetching persons:', e);
        return [];
    }
}

function computeAggregates(persons) {
    const total = persons.length;
    const colorsCount = {};
    const actionsCount = { walking: 0, standing: 0 };
    let holdingCount = 0;
    let activeInFrame = 0;
    let totalSeconds = 0;
    let finishedSessions = 0;

    persons.forEach(p => {
        // Colors: usar top_color e bottom_color do backend
        [p.top_color, p.bottom_color].forEach(c => {
            if (c) colorsCount[c] = (colorsCount[c] || 0) + 1;
        });
        // Action: mapear 'stopped' para 'standing'
        if (p.last_action === 'walking') actionsCount.walking++;
        else if (p.last_action === 'stopped') actionsCount.standing++;

        // Holding object
        if (p.holding_object === true) holdingCount++;

        // Active in frame: sem last_seen (ainda não saiu), considerar ativo
        if (!p.last_seen) {
            activeInFrame++;
        }

        // Time spent: aproximar usando first_seen e last_seen
        if (p.first_seen && p.last_seen) {
            const start = new Date(p.first_seen).getTime();
            const end = new Date(p.last_seen).getTime();
            if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
                totalSeconds += Math.round((end - start) / 1000);
                finishedSessions++;
            }
        }
    });

    const avgTime = finishedSessions > 0 ? Math.round(totalSeconds / finishedSessions) : 0;
    return { total, colorsCount, actionsCount, holdingCount, activeInFrame, avgTime };
}

function buildTimeSeries(persons) {
    const buckets = new Map();
    persons.forEach(p => {
        if (!p.first_seen) return;
        const d = new Date(p.first_seen);
        const label = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        buckets.set(label, (buckets.get(label) || 0) + 1);
    });
    const labels = Array.from(buckets.keys()).sort();
    const data = labels.map(l => buckets.get(l));
    return { labels, data };
}

function updateOverviewCards(agg) {
    if (totalTrackedEl) totalTrackedEl.textContent = agg.total;
    if (activeInFrameEl) activeInFrameEl.textContent = agg.activeInFrame;
    if (holdingObjectsCountEl) holdingObjectsCountEl.textContent = agg.holdingCount;
    if (avgTimeSpentEl) avgTimeSpentEl.textContent = agg.avgTime;
}

function updateCharts(agg, timeSeries) {
    // Actions
    if (actionsChartInstance) {
        actionsChartInstance.data.datasets[0].data = [agg.actionsCount.walking, agg.actionsCount.standing];
        actionsChartInstance.update();
    } else {
        // Dispatch event for Shadcn/Recharts Bar Mixed (Ações)
        window.dispatchEvent(new CustomEvent('actionsBarUpdate', {
            detail: { walking: agg.actionsCount.walking, standing: agg.actionsCount.standing }
        }));
    }

    // Colors
    if (colorsChartInstance) {
        const colorLabels = Object.keys(agg.colorsCount);
        const colorData = colorLabels.map(k => agg.colorsCount[k]);
        colorsChartInstance.data.labels = colorLabels;
        colorsChartInstance.data.datasets[0].data = colorData;
        if (colorLabels.length > 1) {
            colorsChartInstance.data.datasets[0].backgroundColor = colorLabels.map((_, i) => {
                const hues = [30, 200, 120, 0, 260, 320, 160];
                const h = hues[i % hues.length];
                return `hsl(${h}, 70%, 55%)`;
            });
        } else {
            colorsChartInstance.data.datasets[0].backgroundColor = '#f59e0b';
        }
        colorsChartInstance.update();
    }

    // Objects
    if (objectsChartInstance) {
        const notHolding = Math.max(agg.total - agg.holdingCount, 0);
        objectsChartInstance.data.datasets[0].data = [agg.holdingCount, notHolding];
        objectsChartInstance.update();
    } else {
        const notHolding = Math.max(agg.total - agg.holdingCount, 0);
        window.dispatchEvent(new CustomEvent('objectsBarUpdate', {
            detail: { holding: agg.holdingCount, notHolding }
        }));
    }

    // Time series
    if (detectionsTimeChartInstance) {
        detectionsTimeChartInstance.data.labels = timeSeries.labels;
        detectionsTimeChartInstance.data.datasets[0].data = timeSeries.data;
        detectionsTimeChartInstance.update();
    } else {
        // Not Chart.js — dispatch event for Shadcn/Recharts component
        window.dispatchEvent(new CustomEvent('detectionsTimeUpdate', { detail: timeSeries }));
    }
}

async function refreshDashboard(filters = {}) {
    const persons = await fetchPersons(filters);
    try {
        console.debug('[dashboard] persons fetched:', Array.isArray(persons) ? persons.length : typeof persons);
    } catch (_) { /* noop */ }
    const agg = computeAggregates(persons);
    const timeSeries = buildTimeSeries(persons);
    updateOverviewCards(agg);
    updateCharts(agg, timeSeries);
    renderPersonsTable(persons);
}

function renderPersonsTable(persons) {
    if (!personsTbody) return;
    personsTbody.innerHTML = '';
    if (!Array.isArray(persons) || persons.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        const td = document.createElement('td');
        td.className = 'px-3 py-2';
        td.colSpan = 7;
        td.textContent = 'Sem dados para mostrar';
        tr.appendChild(td);
        personsTbody.appendChild(tr);
        return;
    }
    persons.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        const td = (text) => { const el = document.createElement('td'); el.className = 'px-3 py-2'; el.textContent = text ?? ''; return el; };
        const colors = [p.top_color, p.bottom_color].filter(Boolean).join(', ');
        tr.appendChild(td(p.id));
        tr.appendChild(td(p.first_seen ? new Date(p.first_seen).toLocaleString() : ''));
        tr.appendChild(td(p.last_seen ? new Date(p.last_seen).toLocaleString() : ''));
        tr.appendChild(td(colors));
        tr.appendChild(td(p.last_action || ''));
        tr.appendChild(td(p.holding_object ? 'Sim' : 'Não'));
        tr.appendChild(td(p.object_description || ''));
        personsTbody.appendChild(tr);
    });
}

// Send a chat message to the AI assistant
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addChatMessage('You', message, 'user');
    
    // Clear input
    chatInput.value = '';
    
    // Send message to backend
    fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    })
    .then(response => response.json())
    .then(data => {
        // Add AI response to chat
        addChatMessage('AI Assistant', data.answer || data.response || 'Sem resposta');
    })
    .catch(error => {
        console.error('Error sending chat message:', error);
        addChatMessage('AI Assistant', 'Sorry, I encountered an error processing your request.');
    });
}

// Add a message to the chat display
function addChatMessage(sender, message, type = 'ai') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-3';
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'font-medium text-gray-800';
    senderDiv.textContent = sender;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = type === 'user' ? 'bg-gray-200 p-3 rounded-lg inline-block' : 'bg-blue-100 p-3 rounded-lg inline-block';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create a placeholder image for the video feed
function createPlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = '#666';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A câmera aparecerá aqui', canvas.width / 2, canvas.height / 2);
    
    return canvas.toDataURL();
}

// Initialize the application when the DOM is ready.
// In Next.js, this script can be loaded after DOMContentLoaded has already fired,
// so we call init() immediately if the document is not loading.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}