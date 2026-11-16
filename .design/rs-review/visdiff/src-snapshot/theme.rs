//! Оформление интерфейса: цвета, шрифты, отступы.
//!
//! Тёмная минималистичная тема. Шрифт Inter встроен в приложение, поэтому
//! текст одинаково чёткий на любой машине и не зависит от системных шрифтов.

use eframe::egui;
use egui::{
    Color32, FontData, FontDefinitions, FontFamily, FontId, Rounding, Stroke, TextStyle, Visuals,
};

/// Фон окна.
pub const BG: Color32 = Color32::from_rgb(0x0A, 0x0A, 0x0A);
/// Панели (сайдбар, верхняя и нижняя полосы).
pub const PANEL: Color32 = Color32::from_rgb(0x0E, 0x0E, 0x0E);
/// Карточки.
pub const CARD: Color32 = Color32::from_rgb(0x14, 0x14, 0x14);
/// Карточка/кнопка при наведении.
pub const CARD_HOVER: Color32 = Color32::from_rgb(0x1D, 0x1D, 0x1D);
/// Активный пункт меню.
pub const CARD_ACTIVE: Color32 = Color32::from_rgb(0x22, 0x22, 0x22);
/// Границы.
pub const BORDER: Color32 = Color32::from_rgb(0x27, 0x27, 0x27);
/// Основной текст.
pub const TEXT: Color32 = Color32::from_rgb(0xF5, 0xF5, 0xF5);
/// Второстепенный текст.
pub const TEXT_DIM: Color32 = Color32::from_rgb(0x8B, 0x8B, 0x8B);
/// Акцент: в этой теме он светлый, ближе к белому.
pub const ACCENT: Color32 = Color32::from_rgb(0xED, 0xED, 0xED);
/// Тёмный акцент (нажатые состояния).
pub const ACCENT_DARK: Color32 = Color32::from_rgb(0xCF, 0xCF, 0xCF);
/// Успех.
pub const SUCCESS: Color32 = Color32::from_rgb(0x22, 0xC5, 0x5E);
/// Ошибка.
pub const DANGER: Color32 = Color32::from_rgb(0xEF, 0x44, 0x44);
/// Предупреждение.
pub const WARN: Color32 = Color32::from_rgb(0xF5, 0x9E, 0x0B);

/// Встроенный шрифт Inter (поддерживает кириллицу).
const INTER: &[u8] = include_bytes!("../assets/fonts/Inter-Regular.ttf");
const INTER_SEMIBOLD: &[u8] = include_bytes!("../assets/fonts/Inter-SemiBold.ttf");

/// Один раз при старте: шрифты + тёмная тема.
pub fn apply(ctx: &egui::Context) {
    install_fonts(ctx);
    install_style(ctx);
}

fn install_fonts(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();

    fonts
        .font_data
        .insert("inter".to_owned(), FontData::from_static(INTER));
    fonts.font_data.insert(
        "inter_semibold".to_owned(),
        FontData::from_static(INTER_SEMIBOLD),
    );

    fonts
        .families
        .entry(FontFamily::Proportional)
        .or_default()
        .insert(0, "inter".to_owned());
    fonts
        .families
        .entry(FontFamily::Monospace)
        .or_default()
        .insert(0, "inter".to_owned());
    fonts.families.insert(
        FontFamily::Name("Semibold".into()),
        vec!["inter_semibold".to_owned()],
    );

    ctx.set_fonts(fonts);
}

fn install_style(ctx: &egui::Context) {
    let mut visuals = Visuals::dark();
    visuals.panel_fill = BG;
    visuals.window_fill = PANEL;
    visuals.extreme_bg_color = Color32::from_rgb(0x10, 0x10, 0x10);
    visuals.faint_bg_color = CARD;
    // Не переопределяем цвет всех текстов: иначе подсказки в полях
    // (hint_text) рисуются ярким цветом вместо приглушённого.
    visuals.override_text_color = None;
    visuals.hyperlink_color = ACCENT;
    visuals.selection.bg_fill = with_alpha(ACCENT, 40);
    visuals.selection.stroke = Stroke::new(1.0_f32, ACCENT);
    visuals.window_rounding = Rounding::same(16.0);
    visuals.menu_rounding = Rounding::same(10.0);
    visuals.slider_trailing_fill = true;
    visuals.window_shadow = egui::epaint::Shadow {
        offset: egui::vec2(0.0, 12.0),
        blur: 48.0,
        spread: 0.0,
        color: Color32::from_black_alpha(170),
    };

    let widgets = &mut visuals.widgets;
    widgets.noninteractive.bg_fill = CARD;
    widgets.noninteractive.weak_bg_fill = CARD;
    widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, BORDER);
    widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, TEXT);
    widgets.noninteractive.rounding = Rounding::same(8.0);

    widgets.inactive.bg_fill = Color32::TRANSPARENT;
    widgets.inactive.weak_bg_fill = Color32::TRANSPARENT;
    widgets.inactive.bg_stroke = Stroke::new(1.0_f32, Color32::TRANSPARENT);
    widgets.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT);
    widgets.inactive.rounding = Rounding::same(8.0);

    widgets.hovered.bg_fill = CARD_HOVER;
    widgets.hovered.weak_bg_fill = CARD_HOVER;
    widgets.hovered.bg_stroke = Stroke::new(1.0_f32, BORDER);
    widgets.hovered.fg_stroke = Stroke::new(1.0_f32, TEXT);
    widgets.hovered.rounding = Rounding::same(8.0);

    widgets.active.bg_fill = CARD_ACTIVE;
    widgets.active.weak_bg_fill = CARD_ACTIVE;
    widgets.active.bg_stroke = Stroke::new(1.0_f32, BORDER);
    widgets.active.fg_stroke = Stroke::new(1.0_f32, TEXT);
    widgets.active.rounding = Rounding::same(8.0);

    widgets.open.bg_fill = CARD_HOVER;
    widgets.open.weak_bg_fill = CARD_HOVER;
    widgets.open.bg_stroke = Stroke::new(1.0_f32, BORDER);
    widgets.open.rounding = Rounding::same(8.0);

    ctx.set_visuals(visuals);

    let mut style = (*ctx.style()).clone();
    style.spacing.item_spacing = egui::vec2(9.0, 8.0);
    style.spacing.button_padding = egui::vec2(14.0, 7.0);
    style.spacing.interact_size.y = 31.0;
    style.spacing.slider_width = 160.0;
    style.spacing.scroll.bar_width = 6.0;
    style.spacing.scroll.floating = true;

    style.text_styles = [
        (TextStyle::Heading, FontId::new(25.2, semibold())),
        (TextStyle::Body, FontId::new(16.2, FontFamily::Proportional)),
        (TextStyle::Button, FontId::new(15.6, FontFamily::Proportional)),
        (TextStyle::Small, FontId::new(13.8, FontFamily::Proportional)),
        (TextStyle::Monospace, FontId::new(13.8, FontFamily::Monospace)),
    ]
    .into();

    ctx.set_style(style);
}

/// Полужирный шрифт для заголовков.
pub fn semibold() -> FontFamily {
    FontFamily::Name("Semibold".into())
}

/// Полупрозрачный вариант цвета.
pub fn with_alpha(color: Color32, alpha: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
}

/// Смешивает два цвета: `amount` — доля второго цвета (0.0–1.0).
pub fn tinted(base: Color32, color: Color32, amount: f32) -> Color32 {
    let amount = amount.clamp(0.0, 1.0);
    let mix = |a: u8, b: u8| (a as f32 * (1.0 - amount) + b as f32 * amount).round() as u8;
    Color32::from_rgb(
        mix(base.r(), color.r()),
        mix(base.g(), color.g()),
        mix(base.b(), color.b()),
    )
}

/// Цвет уровня журнала.
pub fn level_color(level: log::Level) -> Color32 {
    match level {
        log::Level::Error => DANGER,
        log::Level::Warn => WARN,
        log::Level::Info => TEXT_DIM,
        log::Level::Debug | log::Level::Trace => Color32::from_rgb(0x66, 0x6E, 0x80),
    }
}
