# Person Detection Backend (FastAPI + YOLO)

Backend para detecção e rastreamento de pessoas em tempo real com YOLO, eventos de entrada/saída em ROI, extração simples de cores/ações, parada por QR code e chat usando OpenAI.

## Estrutura

- `core/` – configuração e banco de dados (SQLite)
- `models/` – SQLAlchemy models (`Person`, `Event`)
- `services/` – detecção YOLO+ByteTrack, QR, chat OpenAI
- `routers/` – rotas HTTP (detections, events, people, config, chat)

## Endpoints principais

- `POST /api/detections/start` – inicia a câmera
- `POST /api/detections/stop` – para a câmera
- `GET  /api/detections/stream` – stream MJPEG com caixas e ROI
- `GET  /api/detections/current` – JSON com detecções atuais
- `GET  /api/events` – lista eventos com filtros (`event_type`, `track_id`, `start`, `end`)
- `GET  /api/people` – pessoas rastreadas
- `GET/POST /api/config` – obtém/atualiza `roi_rect` e `qr_stop_text`
- `POST /api/chat` – perguntas sobre os dados detectados (requer `OPENAI_API_KEY`)

## Requisitos

```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
```

## Rodando

```
python backend/main.py
```

A API subirá em `http://localhost:8000`. Para desenvolvimento com Vite (frontend), habilite CORS conforme necessário (padrão já inclui `http://localhost:5173`).

## Configuração

Variáveis de ambiente (opcional):

- `YOLO_MODEL` (ex.: `yolov8n.pt`)
- `CONF_THRESHOLD` (padrão `0.35`) e `IOU_THRESHOLD` (padrão `0.45`)
- `ROI_X1/ROI_Y1/ROI_X2/ROI_Y2` (normalizado 0–1)
- `QR_STOP_TEXT` – texto esperado no QR para parar a aplicação
- `OPENAI_API_KEY` – chave para o chat

Você também pode ajustar em runtime via `POST /api/config`.

## Notas técnicas

- Rastreamento com `supervision.ByteTrack`.
- A ação "walking" é inferida por velocidade dos centros dos boxes; "stopped" caso contrário.
- Cores são estimadas pela média de cor do topo/baixo do bounding box e mapeadas para nomes simples.
- Eventos de `enter_roi`/`exit_roi` são registrados quando o centro entra/sai do retângulo ROI.
- O QR é detectado via `cv2.QRCodeDetector()`. Mostre o QR com o texto configurado para parar.

## GitHub

Após configurar seu repositório, faça:

```
git init
git add .
git commit -m "feat(backend): fastapi + yolo tracking + qr stop + chat"
git branch -M main
git remote add origin <URL_DO_SEU_REPO>
git push -u origin main
```