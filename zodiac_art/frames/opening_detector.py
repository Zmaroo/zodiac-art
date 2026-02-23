"""Detect white opening circles in frame images."""

from __future__ import annotations

import math

import numpy as np
from PIL import Image


def detect_opening_circle(image: Image.Image) -> tuple[float, float, float]:
    """Detect the center and radius of a near-white opening."""

    rgba = image.convert("RGBA")
    data = np.asarray(rgba).astype(np.float32) / 255.0
    height, width, _ = data.shape

    r = data[:, :, 0]
    g = data[:, :, 1]
    b = data[:, :, 2]
    a = data[:, :, 3]

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    with np.errstate(divide="ignore", invalid="ignore"):
        saturation = np.where(max_c == 0, 0.0, (max_c - min_c) / max_c)
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

    mask = (a > 0.05) & (luminance > 0.95) & (saturation < 0.1)
    count = int(mask.sum())
    if count < (width * height * 0.01):
        raise ValueError("Frame opening not detected (white area too small).")

    ys, xs = np.nonzero(mask)
    cx = float(xs.mean())
    cy = float(ys.mean())
    max_radius = min(cx, cy, width - 1 - cx, height - 1 - cy)
    if max_radius <= 0:
        raise ValueError("Frame opening center is out of bounds.")

    angle_step = 2
    radius_step = 2
    boundaries: list[float] = []
    for angle_deg in range(0, 360, angle_step):
        angle_rad = math.radians(angle_deg)
        cos = math.cos(angle_rad)
        sin = math.sin(angle_rad)
        boundary = max_radius
        r_value = 0.0
        while r_value <= max_radius:
            x = int(round(cx + r_value * cos))
            y = int(round(cy + r_value * sin))
            if x < 0 or x >= width or y < 0 or y >= height:
                boundary = r_value
                break
            if not mask[y, x]:
                boundary = r_value
                break
            r_value += radius_step
        boundaries.append(boundary)

    if not boundaries:
        raise ValueError("Frame opening boundary not detected.")

    boundaries.sort()
    boundary = boundaries[int(len(boundaries) * 0.2)]
    safety_margin = max(1.0, width * 0.002)
    radius = max(1.0, boundary - safety_margin)

    return cx, cy, radius
