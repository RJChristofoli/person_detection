import cv2


def decode_qr_text(frame_bgr) -> str | None:
    detector = cv2.QRCodeDetector()
    data, points, _ = detector.detectAndDecode(frame_bgr)
    if points is not None and data:
        return data
    return None