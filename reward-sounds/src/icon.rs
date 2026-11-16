//! Иконка приложения, нарисованная кодом (без внешних файлов).
//!
//! 64×64, сглаживание достигается усреднением 3×3 подпикселей.

use eframe::egui;
use egui::IconData;

const SIZE: usize = 64;
const SS: usize = 3; // supersampling

pub fn app_icon() -> IconData {
    let mut rgba = vec![0u8; SIZE * SIZE * 4];

    for y in 0..SIZE {
        for x in 0..SIZE {
            let mut acc = [0f32; 4];

            for sy in 0..SS {
                for sx in 0..SS {
                    let px = x as f32 + (sx as f32 + 0.5) / SS as f32;
                    let py = y as f32 + (sy as f32 + 0.5) / SS as f32;
                    let color = sample(px, py);
                    // Накопление в «предумноженном» виде, чтобы края были ровными.
                    acc[0] += color[0] * color[3];
                    acc[1] += color[1] * color[3];
                    acc[2] += color[2] * color[3];
                    acc[3] += color[3];
                }
            }

            let samples = (SS * SS) as f32;
            let alpha = acc[3] / samples;
            let (r, g, b) = if acc[3] > 0.0 {
                (
                    acc[0] / acc[3],
                    acc[1] / acc[3],
                    acc[2] / acc[3],
                )
            } else {
                (0.0, 0.0, 0.0)
            };

            let index = (y * SIZE + x) * 4;
            rgba[index] = (r * 255.0).round().clamp(0.0, 255.0) as u8;
            rgba[index + 1] = (g * 255.0).round().clamp(0.0, 255.0) as u8;
            rgba[index + 2] = (b * 255.0).round().clamp(0.0, 255.0) as u8;
            rgba[index + 3] = (alpha * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }

    IconData {
        rgba,
        width: SIZE as u32,
        height: SIZE as u32,
    }
}

/// Цвет одной точки (r, g, b, a) в диапазоне 0..1.
fn sample(x: f32, y: f32) -> [f32; 4] {
    let size = SIZE as f32;
    if !inside_rounded_rect(x, y, size, size, 15.0) {
        return [0.0, 0.0, 0.0, 0.0];
    }

    // Фон: тёмный градиент с фиолетовым оттенком сверху.
    let t = (y / size).clamp(0.0, 1.0);
    let top = [0.145, 0.106, 0.235];
    let bottom = [0.047, 0.055, 0.086];
    let mut color = [
        top[0] + (bottom[0] - top[0]) * t,
        top[1] + (bottom[1] - top[1]) * t,
        top[2] + (bottom[2] - top[2]) * t,
        1.0,
    ];

    // Три «волны» звука справа.
    let bars = [(47.0, 9.0), (53.5, 15.0), (60.0, 21.0)];
    for (bar_x, height) in bars {
        let half = height / 2.0;
        if inside_rounded_rect(
            x - bar_x + 1.6,
            y - (size / 2.0) + half,
            3.2,
            height,
            1.6,
        ) {
            color = mix(color, [0.663, 0.439, 1.0, 0.95], 0.95);
        }
    }

    // Белый треугольник «играть».
    if inside_triangle(x, y, (19.0, 17.0), (19.0, 47.0), (41.0, 32.0)) {
        color = [0.96, 0.95, 1.0, 1.0];
    }

    color
}

fn mix(base: [f32; 4], top: [f32; 4], amount: f32) -> [f32; 4] {
    [
        base[0] + (top[0] - base[0]) * amount,
        base[1] + (top[1] - base[1]) * amount,
        base[2] + (top[2] - base[2]) * amount,
        base[3] + (top[3] - base[3]) * amount,
    ]
}

/// Точка внутри прямоугольника со скруглёнными углами.
fn inside_rounded_rect(x: f32, y: f32, w: f32, h: f32, radius: f32) -> bool {
    if x < 0.0 || y < 0.0 || x > w || y > h {
        return false;
    }
    let cx = x.clamp(radius, w - radius);
    let cy = y.clamp(radius, h - radius);
    let dx = x - cx;
    let dy = y - cy;
    dx * dx + dy * dy <= radius * radius
}

/// Точка внутри треугольника (через знаки барицентрических координат).
fn inside_triangle(
    px: f32,
    py: f32,
    a: (f32, f32),
    b: (f32, f32),
    c: (f32, f32),
) -> bool {
    let sign = |p1: (f32, f32), p2: (f32, f32), p3: (f32, f32)| {
        (p1.0 - p3.0) * (p2.1 - p3.1) - (p2.0 - p3.0) * (p1.1 - p3.1)
    };
    let d1 = sign((px, py), a, b);
    let d2 = sign((px, py), b, c);
    let d3 = sign((px, py), c, a);
    let has_neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
    let has_pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
    !(has_neg && has_pos)
}
