import threading
import time
from typing import Dict, List, Tuple, Set
import datetime
import os

import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv

from backend.core.config import settings
from backend.core.db import SessionLocal
from backend.models.person import Person
from backend.models.event import Event
from backend.schemas.common import DetectionItem
from backend.utils.color import dominant_color
from backend.utils.actions import classify_action
from backend.services.qr_service import decode_qr_text

# Função auxiliar para verificar se um bbox está dentro da ROI
def inside_roi(bbox: Tuple[int, int, int, int], width: int, height: int) -> bool:
    x1, y1, x2, y2 = bbox
    rx1, ry1, rx2, ry2 = settings.roi_rect
    rX1, rY1, rX2, rY2 = int(rx1 * width), int(ry1 * height), int(rx2 * width), int(ry2 * height)
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    return rX1 <= cx <= rX2 and rY1 <= cy <= rY2


# Serviço de detecção de pessoas
class DetectionService:
    def __init__(self):
        self.model = YOLO(settings.yolo_model)
        self.tracker = sv.ByteTrack()
        self.cap = None
        self.thread = None
        self.running = False
        self.last_frame = None
        self.current_detections: List[DetectionItem] = []
        self.track_inside_roi: Dict[int, bool] = {}
        self.stopped_by_qr = False
        # Mapear ids->nomes de classes para detecção (COCO)
        try:
            self.class_names = self.model.names
        except Exception:
            self.class_names = {}
        # Mapear nomes->ids de forma robusta
        if isinstance(self.class_names, dict):
            id_to_name = {int(k): str(v).lower().strip() for k, v in self.class_names.items()}
        else:
            id_to_name = {i: str(n).lower().strip() for i, n in enumerate(self.class_names)}
        allowed_names = {n.lower().strip() for n in settings.handheld_classes}
        self.allowed_object_class_ids = {cid for cid, name in id_to_name.items() if name in allowed_names}
        # Sempre incluir pessoa (id 0) na inferência
        self.allowed_classes_for_predict = sorted({0, *self.allowed_object_class_ids})
        self.prev_speeds: Dict[int, List[float]] = {}
        self.last_seen_times: Dict[int, float] = {}
        self.exit_timeout: float = 1.0  # segundos sem detecção para marcar saída
        # Ajustes de performance
        self.imgsz: int = int(os.environ.get("IMG_SIZE", "512"))
        self.frame_skip: int = int(os.environ.get("FRAME_SKIP", "1"))
        self._frame_count: int = 0

    def _iou(self, a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
        #Calcula Intersection over Union (IoU) entre dois bboxes.
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        inter_x1 = max(ax1, bx1)
        inter_y1 = max(ay1, by1)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)
        inter_w = max(0, inter_x2 - inter_x1)
        inter_h = max(0, inter_y2 - inter_y1)
        inter = inter_w * inter_h
        area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
        area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
        union = area_a + area_b - inter
        return float(inter / union) if union > 0 else 0.0

    def _is_in_hand(self, person_bbox: Tuple[int, int, int, int], obj_bbox: Tuple[int, int, int, int]) -> bool:
        #Heurística para estimar se um objeto está na mão da pessoa.
        # Critérios:
        # - Centro do objeto dentro de faixas laterais (mão esquerda/direita) da bbox da pessoa.
        # - Altura do centro do objeto entre 35% e 85% da altura da pessoa.
        # - Objeto relativamente pequeno (área <= 25% da área da pessoa).
        x1, y1, x2, y2 = person_bbox
        ox1, oy1, ox2, oy2 = obj_bbox
        w = max(0, x2 - x1)
        h = max(0, y2 - y1)
        if w <= 0 or h <= 0:
            return False

        ocx = (ox1 + ox2) / 2.0
        ocy = (oy1 + oy2) / 2.0

        # Faixas de mão (laterais)
        left_strip_x2 = x1 + 0.25 * w
        right_strip_x1 = x2 - 0.25 * w
        # Faixa vertical onde normalmente ficam as mãos
        hand_y1 = y1 + 0.35 * h
        hand_y2 = y1 + 0.85 * h

        in_left = (x1 <= ocx <= left_strip_x2)
        in_right = (right_strip_x1 <= ocx <= x2)
        in_vertical_band = (hand_y1 <= ocy <= hand_y2)

        # Tamanho relativo do objeto
        obj_area = max(0, ox2 - ox1) * max(0, oy2 - oy1)
        person_area = w * h
        small_enough = obj_area <= 0.25 * person_area

        return (in_vertical_band and (in_left or in_right) and small_enough)

    def _dedup_boxes(self, xyxy: np.ndarray, conf: np.ndarray | None, iou_thresh: float = 0.85) -> List[int]:
        # Remove duplicatas com IoU alto, mantendo maior confiança
        n = len(xyxy)
        keep: List[int] = []
        suppressed: Set[int] = set()
        for i in range(n):
            if i in suppressed:
                continue
            for j in range(i + 1, n):
                iou = self._iou(tuple(xyxy[i].astype(int)), tuple(xyxy[j].astype(int)))
                if iou > iou_thresh:
                    ci = float(conf[i]) if conf is not None else 0.0
                    cj = float(conf[j]) if conf is not None else 0.0
                    if cj > ci:
                        suppressed.add(i)
                    else:
                        suppressed.add(j)
            if i not in suppressed:
                keep.append(i)
        return keep

    def start(self, src: int | str = 0):
        if self.running:
            return
        # Reinicia flag de parada por QR em novas sessões
        self.stopped_by_qr = False
        # No Windows, usar DirectShow para evitar erros MSMF ao capturar
        try:
            if isinstance(src, int) and os.name == 'nt':
                self.cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
            else:
                self.cap = cv2.VideoCapture(src)
        except Exception:
            self.cap = cv2.VideoCapture(src)

        # Ajustes da câmera para reduzir travamento
        try:
            # 640x480 é suficiente e leve para detecção
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            # Buffer pequeno para reduzir latência
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            # MJPG costuma melhorar performance de captura em Windows
            self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        except Exception:
            pass

        # Reset de estados e tracker para evitar sobreposição de pessoas de sessões anteriores
        self.tracker = sv.ByteTrack()
        self.prev_speeds.clear()
        self.last_seen_times.clear()
        self.track_inside_roi.clear()
        self._frame_count = 0

        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.cap is not None:
            self.cap.release()
        self.cap = None
        # Marcar saída em todas as pessoas sem horário de saída
        try:
            db = SessionLocal()
            now_dt = datetime.datetime.now()
            rows = db.query(Person).filter(Person.last_seen.is_(None)).all()
            for p in rows:
                p.last_seen = now_dt
            db.commit()
            # Registrar evento de parada do sistema quando não for por QR
            if not self.stopped_by_qr:
                try:
                    db.add(Event(event_type="system_stopped", track_id=None, roi_name=None, details=None))
                    db.commit()
                except Exception:
                    pass
        except Exception:
            pass

    def _loop(self):
        db = SessionLocal()
        prev_centers: Dict[int, Tuple[float, float]] = {}
        prev_timestamps: Dict[int, float] = {}
        while self.running and self.cap is not None:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            self._frame_count += 1
            if self.frame_skip > 1 and (self._frame_count % self.frame_skip != 0):
                # pula detecção neste frame para aliviar CPU
                self.last_frame = frame
                continue

            # QR stop
            qr_text = decode_qr_text(frame)
            should_stop = (qr_text is not None and settings.qr_stop_any) or (qr_text and qr_text == settings.qr_stop_text)
            if should_stop:
                try:
                    db.add(Event(event_type="stop_by_qr", track_id=None, roi_name=None, details=f"qr={qr_text}"))
                    db.commit()
                except Exception:
                    pass
                self.stopped_by_qr = True
                self.stop()
                break

            height, width = frame.shape[:2]
            results = self.model.predict(
                frame,
                conf=settings.conf_threshold,
                iou=settings.iou_threshold,
                verbose=False,
                classes=self.allowed_classes_for_predict,
                imgsz=self.imgsz,  # reduz custo de inferência
            )
            det_all = sv.Detections.from_ultralytics(results[0])

            # filtra somente pessoas (id 0)
            mask = det_all.class_id == 0
            det = det_all[mask]
            non_person = det_all[~mask]

            # filtro extra por whitelist (defensivo)
            if len(self.allowed_object_class_ids) > 0 and hasattr(non_person, "class_id"):
                allowed_mask = np.isin(non_person.class_id, list(self.allowed_object_class_ids))
                non_person = non_person[allowed_mask]

            tracked = self.tracker.update_with_detections(det)
            # Deduplicação de pessoas no mesmo frame
            keep_idx = self._dedup_boxes(tracked.xyxy, getattr(tracked, "confidence", None), iou_thresh=0.85)

            items: List[DetectionItem] = []
            now = time.time()

            present_ids: Set[int] = set()
            for i in keep_idx:  # i é o índice na detecção deduplicada
                bbox = tracked.xyxy[i].astype(int)
                x1, y1, x2, y2 = bbox
                track_id = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
                conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
                valid_id = track_id >= 0
                if valid_id:
                    present_ids.add(track_id)

                # extração de cor com recorte central para evitar fundo
                w = max(0, x2 - x1)
                h = max(0, y2 - y1)
                if w <= 0 or h <= 0:
                    top_color = bottom_color = None
                else:
                    # margem de 15% nas laterais e 10% no topo/rodapé
                    mx = int(w * 0.15)
                    my = int(h * 0.10)
                    cx1 = max(x1 + mx, 0)
                    cy1 = max(y1 + my, 0)
                    cx2 = min(x2 - mx, width)
                    cy2 = min(y2 - my, height)
                    # recorte central
                    if cx2 <= cx1 or cy2 <= cy1:
                        central = frame[y1:y2, x1:x2]
                    else:
                        central = frame[cy1:cy2, cx1:cx2]

                    if central.size == 0:
                        top_color = bottom_color = None
                    else:
                        ch = central.shape[0]
                        top_color = dominant_color(central[: ch // 2])
                        bottom_color = dominant_color(central[ch // 2 :])

                # estimativa de ação com suavização
                center = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)
                dt = now - prev_timestamps.get(track_id, now)
                if valid_id and track_id in prev_centers and dt > 0:
                    dx = center[0] - prev_centers[track_id][0]
                    dy = center[1] - prev_centers[track_id][1]
                    speed = float(np.hypot(dx, dy) / dt)
                    speeds = self.prev_speeds.get(track_id, [])
                    speeds.append(speed)
                    if len(speeds) > 5:
                        speeds = speeds[-5:]
                    self.prev_speeds[track_id] = speeds
                    avg_speed = sum(speeds) / len(speeds)
                    action = "walking" if avg_speed > 25.0 else "stopped"
                else:
                    action = "stopped"
                if valid_id:
                    prev_centers[track_id] = center
                    prev_timestamps[track_id] = now
                    self.last_seen_times[track_id] = now

                # Objetos NAS MÃOS da pessoa (heurística)
                objects_set: Set[str] = set()
                for j in range(len(non_person)):
                    ob = non_person.xyxy[j].astype(int)
                    if self._is_in_hand(tuple(bbox), tuple(ob)):
                        cid = int(non_person.class_id[j]) if non_person.class_id is not None else -1
                        name = self.class_names.get(cid, str(cid)) if isinstance(self.class_names, dict) else str(cid)
                        objects_set.add(name)
                objects: List[str] = sorted(list(objects_set))

                items.append(
                    DetectionItem(
                        track_id=track_id,
                        bbox=bbox.tolist(),
                        confidence=conf,
                        top_color=top_color,
                        bottom_color=bottom_color,
                        action=action,
                        objects=objects,
                    )
                )

                # DB upsert person
                if valid_id:
                    person = db.query(Person).filter(Person.track_id == (track_id + os.getpid() * 100000)).first()
                    if person is None:
                        person = Person(
                            track_id=(track_id + os.getpid() * 100000),
                            top_color=top_color,
                            bottom_color=bottom_color,
                            last_action=action,
                            first_seen=datetime.datetime.now(),
                            last_x=center[0],
                            last_y=center[1],
                            holding_object=True if len(objects) > 0 else False,
                            object_description=", ".join(objects) if objects else None,
                        )
                        db.add(person)
                        try:
                            print(f"[det] create person track_id={track_id} action={action} colors={top_color}/{bottom_color} objects={person.object_description}")
                        except Exception:
                            pass
                    else:
                        # Se a pessoa foi marcada como saída, trate como nova aparição
                        if person.last_seen is not None:
                            person.first_seen = datetime.datetime.now()
                            person.last_seen = None
                            person.holding_object = False
                            person.object_description = None
                        # Não sobrescrever cor conhecida com "unknown".
                        top_color_upd = top_color if top_color not in (None, "", "unknown") else None
                        bottom_color_upd = bottom_color if bottom_color not in (None, "", "unknown") else None
                        if person.last_seen is not None:
                            person.last_seen = None
                        person.top_color = top_color_upd or person.top_color
                        person.bottom_color = bottom_color_upd or person.bottom_color
                        person.last_action = action
                        person.last_x = center[0]
                        person.last_y = center[1]
                        # Persistir objetos segurados: agregar sem remover
                        prev_objs = []
                        if person.object_description:
                            prev_objs = [s.strip() for s in person.object_description.split(",") if s.strip()]
                        union = sorted(list(set(prev_objs).union(objects)))
                        person.object_description = ", ".join(union) if union else person.object_description
                        person.holding_object = True if (union and len(union) > 0) else person.holding_object
                        try:
                            print(f"[det] update person track_id={track_id} action={action} colors={person.top_color}/{person.bottom_color} objects={person.object_description}")
                        except Exception:
                            pass

                # ROI enter/exit events
                inside = inside_roi(tuple(bbox), width, height)
                if valid_id:
                    prev_inside = self.track_inside_roi.get(track_id, False)
                    if inside and not prev_inside:
                        db.add(Event(event_type="enter_roi", track_id=track_id, roi_name="default", details=None))
                    elif not inside and prev_inside:
                        db.add(Event(event_type="exit_roi", track_id=track_id, roi_name="default", details=None))
                    self.track_inside_roi[track_id] = inside

            db.commit()
            # Marca saídas: quem não apareceu por exit_timeout congela last_seen
            now_ts = time.time()
            for tid, last_ts in list(self.last_seen_times.items()):
                if tid not in present_ids and (now_ts - last_ts) > self.exit_timeout:
                    person = db.query(Person).filter(Person.track_id == (tid + os.getpid() * 100000)).first()
                    if person and person.last_seen is None:
                        person.last_seen = datetime.datetime.fromtimestamp(last_ts)
                        db.commit()
                    # Limpa estado dos rastros que saíram
                    self.prev_speeds.pop(tid, None)
                    prev_centers.pop(tid, None)
                    prev_timestamps.pop(tid, None)
                    self.track_inside_roi.pop(tid, None)
                    self.last_seen_times.pop(tid, None)
            self.current_detections = items

            # Draw overlay for stream
            overlay = frame.copy()
            for item in items:
                x1, y1, x2, y2 = item.bbox
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
                obj_label = (" | " + ", ".join(item.objects)) if item.objects else ""
                label = f"ID {item.track_id} {item.action or ''} {item.top_color or ''}/{item.bottom_color or ''}{obj_label}"
                cv2.putText(overlay, label, (x1, max(y1 - 5, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            # draw ROI
            rX1, rY1, rX2, rY2 = int(settings.roi_rect[0] * width), int(settings.roi_rect[1] * height), int(settings.roi_rect[2] * width), int(settings.roi_rect[3] * height)
            cv2.rectangle(overlay, (rX1, rY1), (rX2, rY2), (255, 0, 0), 2)

            self.last_frame = overlay
        db.close()

    def get_detections(self) -> List[DetectionItem]:
        return self.current_detections

    def gen_stream(self):
        """MJPEG stream generator."""
        while self.running:
            if self.last_frame is None:
                time.sleep(0.01)
                continue
            ret, jpeg = cv2.imencode('.jpg', self.last_frame)
            if not ret:
                continue
            frame = jpeg.tobytes()
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")


# Singleton service
detection_service = DetectionService()