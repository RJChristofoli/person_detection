// estado global
let isConnected = false;
let startTime = null;
let currentFilters = {};
let timeInterval = null;
let qrStopNotified = false

// elementos DOM
const videoFeed = document.getElementById('video-feed');
const timeTrackingEl = document.getElementById('time-tracking');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// elementos DOM para dashboard
const totalTrackedEl = document.getElementById('total-tracked');
const activeInFrameEl = document.getElementById('active-in-frame');
const holdingObjectsCountEl = document.getElementById('holding-objects-count');
const avgTimeSpentEl = document.getElementById('avg-time-spent');

// elementos DOM para filtros
const filterColorEl = document.getElementById('filter-color');
const filterActionEl = document.getElementById('filter-action');
const filterHoldingEl = document.getElementById('filter-holding');
const filterFromEl = document.getElementById('filter-from');
const filterToEl = document.getElementById('filter-to');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const personsTbody = document.getElementById('persons-tbody');

// Chart.js removido: gráficos atualizados via eventos customizados

// Backend API URL (usa 127.0.0.1 para evitar problemas com IPv6/localhost)
const API_PORT = 8001;
const BACKEND_HOST = (typeof window !== 'undefined' && window.location &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '127.0.0.1'
  : (typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1');
// Base para os endpoints FastAPI com prefixo /api
const API_URL = `http://${BACKEND_HOST}:${API_PORT}/api`;

// inicializa a aplicação
function init() {
    // Controles de detecção e chat
    sendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Controles de filtros
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

    // placeholder para video até que a câmera comece
    videoFeed.src = createPlaceholder();

    // Inicializa gráficos e carrega dados iniciais
    refreshDashboard({});
    // Atualiza dashboard a cada 8 segundos
    setInterval(() => refreshDashboard(currentFilters), 8000);
    // Poll backend para verificar status de detecção a cada 2 segundos
    setInterval(() => pollDetectionStatus(), 2000);

    // Auto-inicia detecção quando o sistema (página) carregar
    startDetection();
}

// Inicia o processo de detecção
async function startDetection() {
    if (isConnected) return;
    try {
        await fetch(`${API_URL}/detections/start`, { method: 'POST' });
        isConnected = true;
        startTime = new Date();
        updateTimeTracking();
        videoFeed.src = `${API_URL}/detections/stream`;
        timeInterval = setInterval(updateTimeTracking, 1000);
    } catch (error) {
        console.error('Erro ao iniciar detecção:', error);
        addChatMessage('Assistente Virtual', `Erro ao iniciar detecção em ${API_URL}/detections/start`);
    }
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
        if (st && st.running === false && isConnected) {
            isConnected = false;
            clearInterval(timeInterval);
            videoFeed.src = createPlaceholder();
        }
    } catch (e) { /* noop */ }
    // Ignora erros de polling
}

// Atualiza o display de tracking de tempo
function updateTimeTracking() {
    if (!startTime) return;
    
    const now = new Date();
    const diff = now - startTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    timeTrackingEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Atualiza gráficos do dashboard
// ---- Dashboard data & charts ----



    // Gráficos inicializados via componentes do frontend (Shadcn); sem Chart.js aqui

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

// consumir /api/stats
async function fetchStats(filters = {}) {
    try {
        const qs = buildQueryString(filters);
        const url = `${API_URL}/stats/${qs ? `?${qs}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Error fetching stats:', e);
        // Fallback seguro
        return {
            total: 0,
            activeInFrame: 0,
            holdingCount: 0,
            avgTime: 0,
            actionsCount: { walking: 0, standing: 0 },
            colorsCount: {},
            timeSeries: { labels: [], data: [] }
        };
    }
}



// Alterado: agora recebe stats direto do backend
function updateOverviewCards(stats) {
    if (totalTrackedEl) totalTrackedEl.textContent = stats.total;
    if (activeInFrameEl) activeInFrameEl.textContent = stats.activeInFrame;
    if (holdingObjectsCountEl) holdingObjectsCountEl.textContent = stats.holdingCount;
    if (avgTimeSpentEl) avgTimeSpentEl.textContent = stats.avgTime;
}

// Alterado: agora usa stats diretamente
function updateCharts(stats) {
    // Ações
    window.dispatchEvent(new CustomEvent('actionsBarUpdate', {
        detail: {
            walking: stats.actionsCount.walking,
            standing: stats.actionsCount.standing
        }
    }));

    // Objetos
    const notHolding = Math.max(stats.total - stats.holdingCount, 0);
    window.dispatchEvent(new CustomEvent('objectsBarUpdate', {
        detail: { holding: stats.holdingCount, notHolding }
    }));

    // Série temporal
    window.dispatchEvent(new CustomEvent('detectionsTimeUpdate', { detail: stats.timeSeries }));
}

// Alterado: refresh agora usa /api/stats para métricas e gráficos
async function refreshDashboard(filters = {}) {
    const [stats, persons] = await Promise.all([
        fetchStats(filters),
        fetchPersons(filters)
    ]);

    try {
        console.debug('[dashboard] stats fetched:', stats?.total ?? 'n/a');
        console.debug('[dashboard] persons fetched:', Array.isArray(persons) ? persons.length : typeof persons);
    } catch (_) { /* noop */ }

    updateOverviewCards(stats);
    updateCharts(stats);
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

// Envia uma mensagem de chat para o assistente virtual
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Adiciona mensagem do usuário ao chat
    addChatMessage('You', message, 'user');
    
    // Limpa o campo de entrada
    chatInput.value = '';
    
    // Envia mensagem para o backend
    fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    })
    .then(response => response.json())
    .then(data => {
        // Adiciona resposta do assistente virtual ao chat  
        addChatMessage('AI Assistant', data.answer || data.response || 'Sem resposta');
    })
    .catch(error => {
        console.error('Error sending chat message:', error);
        addChatMessage('AI Assistant', 'Sorry, I encountered an error processing your request.');
    });
}

    // Adiciona mensagem ao display de chat
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
    
    // Rola para o final do chat para mostrar a nova mensagem
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Cria uma imagem de placeholder para o feed de vídeo
function createPlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Preenche fundo
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Adiciona texto
    ctx.fillStyle = '#666';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A câmera aparecerá aqui', canvas.width / 2, canvas.height / 2);
    
    return canvas.toDataURL();
}

// Inicializa a aplicação quando o DOM estiver pronto.
// No Next.js, este script pode ser carregado depois que o DOMContentLoaded já tenha disparado,
// então chamamos init() imediatamente se o documento não estiver carregando.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}