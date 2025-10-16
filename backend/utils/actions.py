from typing import Optional, Tuple


def classify_action(prev_center: Optional[Tuple[float, float]],
                    curr_center: Tuple[float, float],
                    dt: float,
                    speed_thresh: float = 40.0) -> str:
    """Classify action using pixel speed.
    speed_thresh in pixels/second for walking.
    """
    if prev_center is None or dt <= 0:
        return "stopped"
    dx = curr_center[0] - prev_center[0]
    dy = curr_center[1] - prev_center[1]
    speed = ((dx ** 2 + dy ** 2) ** 0.5) / dt
    return "walking" if speed > speed_thresh else "stopped"