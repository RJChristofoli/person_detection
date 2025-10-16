# FALCON Vision AI – Person Detection App

Aplicação de visão computacional em tempo real que detecta e rastreia pessoas via webcam, registra entrada/saída, características visuais e expõe uma interface web com stream da câmera, dashboard e chat integrado a um LLM (OpenAI API). A captura é interrompida automaticamente ao detectar um QR Code com texto configurável.

## Visão Geral
- Backend em `FastAPI` com inferência `YOLO (Ultralytics)`, tracking `ByteTrack` (via `supervision`), `OpenCV` para captura/stream MJPEG e persistência em `SQLite` com `SQLAlchemy`.
- Frontend em `Next.js 14` com `Tailwind CSS` e componentes `shadcn/ui`, gráficos com `Recharts`, consumo do backend via REST.
- Chat via `OpenAI API` usando o contexto dos eventos e pessoas registrados.
- QR-stop: se o texto lido do QR Code corresponder ao configurado (`QR_STOP_TEXT`) ou se `QR_STOP_ANY=1`, o backend para a câmera e sinaliza o motivo na UI.

## Requisitos
- Python 3.10+ e Node.js 18+
- Dependências do backend (arquivo `backend/requirements.txt`).
- Dependências do frontend (`npm install` no diretório `frontend`).

## Arquitetura e Localização de Componentes
- Backend
  - `backend/main.py`: criação da app, CORS, inclusão de routers e endpoint `/health`.
  - `backend/core/config.py`: carregamento de `.env`, parâmetros como `YOLO_MODEL`, `QR_STOP_TEXT`, `QR_STOP_ANY`, `ROI_*`, `CONF_THRESHOLD`, `IOU_THRESHOLD`, `HANDHELD_CLASSES`, `CORS_ORIGINS`, `DATABASE_URL`.
  - `backend/core/db.py`: inicialização do banco e `SessionLocal`.
  - `backend/services/detection_service.py`: captura webcam, inferência YOLO, tracking ByteTrack, ROI, QR-stop, persistência e stream MJPEG.
  - `backend/services/chat_service.py`: integração OpenAI API, construção de contexto com pessoas/eventos.
  - Routers:
    - `backend/routers/detections.py`: `/api/detections/start|stop|status|stream|current`
    - `backend/routers/events.py`: `/api/events/` com filtros
    - `backend/routers/people.py`: `/api/people/`
    - `backend/routers/config_router.py`: `/api/config` GET/POST para ajustes em tempo real
    - `backend/routers/chat.py`: `/api/chat/` POST para perguntas
  - Banco local: `backend/data.db` (SQLite).

- Frontend
  - `frontend/pages/index.tsx`: página principal com UI de controle, dashboard e chat.
  - `frontend/public/app.js`: lógica de integração com o backend (API base, stream MJPEG, polling de status, filtros, gráficos, chat).
  - `frontend/components/ui/*`: componentes visuais (shadcn/ui) e gráficos (`Recharts`).
  - Estilos: `frontend/styles/globals.css` (tema escuro).

## Configuração
1) Backend – criar e preencher `backend/.env` (exemplo):

```
# Servidor
HOST=0.0.0.0
PORT=8001

# Banco
DATABASE_URL=sqlite:///./backend/data.db

# Modelo YOLO (baixa latência)
YOLO_MODEL=yolov8n.pt
CONF_THRESHOLD=0.35
IOU_THRESHOLD=0.45

# ROI normalizada (x1,y1,x2,y2 em 0-1)
ROI_X1=0.25
ROI_Y1=0.25
ROI_X2=0.75
ROI_Y2=0.75

# QR-stop
QR_STOP_TEXT=STOP_APP
QR_STOP_ANY=0

# Classes de objetos de mão (para detecção de "holding")
HANDHELD_CLASSES=bottle,cup,cell phone,remote,book,sports ball

# OpenAI
OPENAI_API_KEY=coloque_sua_chave_aqui

# CORS (inclui 3000 por padrão; ajuste se necessário)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

2) Backend – instalar e preparar ambiente Python:

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3) Frontend – instalar dependências:

```
cd frontend
npm install
```

## Execução
- Backend (porta 8001 para alinhar com o frontend):

```
cd backend
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

- Frontend (Next.js dev server padrão em `http://localhost:3000`):

```
cd frontend
npm run dev
```

Observação: o frontend usa `frontend/public/app.js`, que define `API_PORT=8001` e resolve `BACKEND_HOST` dinamicamente (localhost/127.0.0.1). Se alterar a porta do backend, ajuste `API_PORT` nesse arquivo.

## Fluxo Operacional
- A UI aciona `/api/detections/start` e começa a renderizar o stream MJPEG de `/api/detections/stream`.
- Cada quadro processado é analisado por YOLO; ByteTrack associa IDs persistentes.
- Características visuais: cores de roupa (top/bottom), ação (parado/andando/correndo) e objeto na mão (se houver), além de ROI (dentro/fora), com eventos registrados em `SQLite`.
- QR-stop: `decode_qr_text(frame)` lê QR; se `QR_STOP_ANY=1` ou texto igual a `QR_STOP_TEXT`, o backend para a captura, sinaliza `stopped_by_qr` e a UI atualiza o estado.
- Chat: pergunta enviada para `/api/chat/` usa contexto das pessoas/eventos do banco e retorna resposta.

## Endpoints Principais (REST)
- Detecção (`/api/detections/*`):
  - `POST /api/detections/start`
  - `POST /api/detections/stop`
  - `GET /api/detections/status`
  - `GET /api/detections/stream` (MJPEG)
  - `GET /api/detections/current` (lista de detecções atuais)
- Pessoas (`/api/people/`): `GET /api/people/`
- Eventos (`/api/events/`): `GET /api/events/?event_type=&track_id=&start=&end=`
- Config (`/api/config`): `GET /api/config` e `POST /api/config` para atualizar `roi_rect`, `qr_stop_text`, `qr_stop_any`, `conf_threshold`, `iou_threshold`, `handheld_classes` em runtime.
- Chat (`/api/chat/`): `POST { message }` devolve `{ answer }`.

## Uso da Interface
- Controle:
  - Botões Iniciar/Parar; inicia automaticamente ao carregar a página.
  - Polling de status a cada 2s; placeholder exibido quando parado.
- Stream da câmera com overlay: caixas e rótulos com `ID`, `ação`, `top_color/bottom_color` e objetos.
- Dashboard e Filtros: filtros por cor/ação/objeto/período; gráficos via `Recharts`; tabela de pessoas.
- Chat: digite perguntas; se `OPENAI_API_KEY` não estiver definido, a UI informa.
- QR-stop UI: ao detectar o QR, aparece uma indicação visual de parada.

## Demonstração do QR-stop
1) Gere um QR com o texto "STOP_APP" (padrão do `QR_STOP_TEXT`).
2) Mostre o QR para a câmera durante a detecção.
3) A captura é interrompida e a UI reflete o estado (`stopped_by_qr=true`).

Para alterar o texto, ajuste `QR_STOP_TEXT` no `.env` ou via `POST /api/config`.

## Segurança e Boas Práticas
- `.gitignore`: mantém fora do repositório arquivos sensíveis/pesados (ex.: pesos YOLO, `.env`, `__pycache__`).
- Nunca faça commit de `OPENAI_API_KEY`.
- Mantenha `CORS_ORIGINS` alinhado com a porta do frontend (3000 por padrão).

## Solução de Problemas
- Git `index.lock`: se aparecer `fatal: Unable to create '.git/index.lock': File exists.`, feche editores de commit, remova `index.lock` e tente novamente; se persistir, encerre processos `git.exe` e reinicie o terminal.
- Câmera não inicia: verifique permissões e tente `cv2.CAP_DSHOW` (já usado no Windows); cheque se outra app está usando a webcam.
- Conexão frontend/backend: assegure backend em `8001` e frontend em `3000`; a UI usa `127.0.0.1` para evitar IPv6.
- Chat sem resposta: verifique `OPENAI_API_KEY`; o backend retorna mensagem de aviso se não configurado.
- Import ausente `qr_router`: caso o backend falhe ao iniciar por `app.include_router(qr_router)`, remova essa linha ou adicione o router correspondente.

## Roadmap
- Estatísticas agregadas e gráficos adicionais (tempo médio, contagem por ação/cor).
- Auto-reconexão da câmera e múltiplas fontes.
- UI mais rica com histórico, filtros avançados e exportações.
- Fallback local para LLM.
- Dockerização (compose) e testes unitários.

## Execução Rápida
```
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
npm install
npm run dev

# Acesse a UI
http://localhost:3000/

# Teste QR-stop
# Mostre um QR com texto STOP_APP para a câmera
```