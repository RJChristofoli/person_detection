from typing import Tuple
import numpy as np
import cv2


COLOR_TABLE = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "gray": (128, 128, 128),
    "red": (220, 30, 30),
    "orange": (255, 140, 0),
    "yellow": (250, 230, 50),
    "green": (50, 180, 75),
    "blue": (40, 120, 220),
    "purple": (160, 60, 200),
    "brown": (150, 75, 0),
}


def rgb_to_name(rgb: Tuple[int, int, int]) -> str:
    arr = np.array(rgb)
    best_name = "unknown"
    best_dist = 1e9
    for name, ref in COLOR_TABLE.items():
        d = np.linalg.norm(arr - np.array(ref))
        if d < best_dist:
            best_dist = d
            best_name = name
    return best_name


def dominant_color(bgr_img: np.ndarray) -> str:
    # Robust dominant color using HSV histogram, ignoring low saturation (gray/white/black)
    if bgr_img.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2HSV)
    h = hsv[:, :, 0].reshape(-1)
    s = hsv[:, :, 1].reshape(-1)
    v = hsv[:, :, 2].reshape(-1)

    # Classify achromatic first
    s_mean = np.mean(s)
    v_mean = np.mean(v)
    if v_mean < 50 and s_mean < 40:
        return "black"
    if v_mean > 200 and s_mean < 40:
        return "white"
    if s_mean < 40:
        return "gray"

    # Use only sufficiently saturated pixels
    mask = (s >= 60) & (v >= 50)
    if not np.any(mask):
        # Fall back to RGB nearest if no saturated pixels
        avg_bgr = np.mean(bgr_img.reshape(-1, 3), axis=0)
        rgb = (int(avg_bgr[2]), int(avg_bgr[1]), int(avg_bgr[0]))
        return rgb_to_name(rgb)

    h_sel = h[mask]
    # Histogram over hue (0-179) into bins
    bins = np.linspace(0, 180, 13)  # 12 bins
    hist, _ = np.histogram(h_sel, bins=bins)
    bin_idx = int(np.argmax(hist))
    # Convert bin index to representative hue
    h_low = bins[bin_idx]
    h_high = bins[bin_idx + 1]
    h_rep = (h_low + h_high) / 2.0

    # Map hue to color name
    # Hue ranges (OpenCV HSV): red~0/180, orange~15-25, yellow~26-35, green~36-85, blue~86-125, purple~126-160, brown ~ 10-20 low V
    if h_rep < 10 or h_rep >= 170:
        return "red"
    if 10 <= h_rep < 25:
        # Distinguish orange/brown via brightness
        return "brown" if v_mean < 120 else "orange"
    if 25 <= h_rep < 36:
        return "yellow"
    if 36 <= h_rep < 85:
        return "green"
    if 85 <= h_rep < 126:
        return "blue"
    if 126 <= h_rep < 160:
        return "purple"
    # fallback
    return "unknown"