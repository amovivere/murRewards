# -*- coding: utf-8 -*-
"""Карточки наград ближе к макету + тулбар."""
import pathlib

P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")


def sub(old: str, new: str) -> None:
    global s
    assert old in s, "NOT FOUND: " + old[:120]
    s = s.replace(old, new, 1)


# --- сетка: зазор 12 ---
sub("""    let mut actions = Vec::new();
    let columns = columns.max(1);
    for row in rewards.chunks(columns) {
        ui.columns(columns, |cols| {
""",
"""    let mut actions = Vec::new();
    let columns = columns.max(1);
    ui.spacing_mut().item_spacing.x = 12.0;
    for row in rewards.chunks(columns) {
        ui.columns(columns, |cols| {
""")

# --- карточка: компактнее и с макетными отступами ---
sub("""        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.set_min_height(198.0);

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
""",
"""        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing.y = 0.0;

            ui.horizontal(|ui| {
                let (tile, _) = ui.allocate_exact_size(Vec2::splat(38.0), Sense::hover());
""")
sub("""                ui.vertical(|ui| {
                    ui.set_max_width((ui.available_width() - 52.0).max(80.0));
""",
"""                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    ui.set_max_width((ui.available_width() - 52.0).max(80.0));
""")
sub("            ui.add_space(10.0);\n\n            let (meta, exists) = match binding {",
    "            ui.add_space(13.0);\n\n            let (meta, exists) = match binding {")
sub("""            egui::Frame::none()
                .fill(blend_over(fill, with_alpha(Color32::WHITE, 7)))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(8.0, 6.0))
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());
""",
"""            egui::Frame::none()
                .fill(blend_over(fill, with_alpha(Color32::WHITE, 7)))
                .rounding(Rounding::same(10.0))
                .inner_margin(egui::Margin::symmetric(11.0, 4.0))
                .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.set_min_height(34.0);
""")
sub("if sound_play_button(ui, 24.0, exists).clicked() && exists {",
    "if sound_play_button(ui, 18.0, exists).clicked() && exists {")
sub("            ui.add_space(8.0);\n\n            match binding {",
    "            ui.add_space(11.0);\n\n            match binding {")
sub("            ui.add_space(4.0);\n            ui.horizontal(|ui| match binding {",
    "            ui.add_space(12.0);\n            ui.spacing_mut().item_spacing.x = 6.0;\n            ui.horizontal(|ui| match binding {")
sub("""                Some(_) => {
                    if secondary_button(ui, "Заменить").clicked() {
""",
"""                Some(_) => {
                    if compact_secondary_button(ui, "Заменить").clicked() {
""")
sub("""                None => {
                    if accent_button(ui, "Выбрать звук").clicked() {
""",
"""                None => {
                    if compact_primary_button(ui, "Выбрать звук").clicked() {
""")

# --- компактная primary-кнопка ---
anchor = "/// Уменьшенная вторичная кнопка для нижних карточек (высота 30)."
helper = r'''/// Уменьшенная основная кнопка (высота 30, как btn-sm в макете).
fn compact_primary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    let font = FontId::new(13.0, egui::FontFamily::Proportional);
    let width = ui
        .painter()
        .layout_no_wrap(label.to_owned(), font.clone(), TEXT)
        .size()
        .x;
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(width + 26.0, 30.0), Sense::click());
    let rect = snap_rect(ui, rect);
    let hovered = response.hovered();
    ui.painter().rect_filled(
        rect,
        Rounding::same(15.0),
        if hovered {
            Color32::WHITE
        } else {
            Color32::from_rgb(0xED, 0xED, 0xED)
        },
    );
    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        label,
        font,
        BG,
    );
    response
}

'''
assert anchor in s
s = s.replace(anchor, helper + anchor, 1)

# --- поиск 252 px, как в макете ---
sub("""            let search_width = (ui.available_width() - 470.0).clamp(170.0, 270.0);
            egui::Frame::none()
                .fill(CARD)
                .stroke(Stroke::new(1.0_f32, BORDER))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(12.0, 6.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let (icon_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(14.0), Sense::hover());
                        paint_ui_icon(
                            ui.painter(),
                            icon_rect,
                            UiIcon::Search,
                            with_alpha(TEXT_DIM, 200),
                        );
                        ui.add(
                            egui::TextEdit::singleline(&mut self.search)
                                .frame(false)
                                .hint_text("Поиск награды")
                                .desired_width(search_width - 22.0)
                                .font(FontId::proportional(13.6)),
                        );
                    });
                });
""",
"""            let search_width = 252.0;
            egui::Frame::none()
                .fill(blend_over(BG, with_alpha(Color32::WHITE, 5)))
                .stroke(Stroke::new(
                    1.0_f32,
                    blend_over(BG, with_alpha(Color32::WHITE, 26)),
                ))
                .rounding(Rounding::same(17.0))
                .inner_margin(egui::Margin::symmetric(14.0, 6.0))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        let (icon_rect, _) =
                            ui.allocate_exact_size(Vec2::splat(15.0), Sense::hover());
                        paint_ui_icon(
                            ui.painter(),
                            icon_rect,
                            UiIcon::Search,
                            with_alpha(TEXT_DIM, 220),
                        );
                        ui.add(
                            egui::TextEdit::singleline(&mut self.search)
                                .frame(false)
                                .hint_text("Поиск награды")
                                .desired_width(search_width - 58.0)
                                .font(FontId::proportional(13.6)),
                        );
                    });
                });
""")

# --- сортировка в стиле select из макета ---
sub("""            // Сортировка — как выпадающий список в макете.
            egui::ComboBox::from_id_salt("reward-sort")
                .width(158.0)
                .selected_text(RichText::new(new_sort.label()).size(13.2).color(TEXT))
                .show_ui(ui, |ui| {
                    for sort in [
                        RewardSort::Default,
                        RewardSort::PriceDesc,
                        RewardSort::PriceAsc,
                        RewardSort::Title,
                    ] {
                        if ui
                            .selectable_label(new_sort == sort, sort.label())
                            .clicked()
                        {
                            new_sort = sort;
                        }
                    }
                });
""",
"""            // Сортировка — как выпадающий список в макете.
            ui.scope(|ui| {
                ui.spacing_mut().interact_size.y = 34.0;
                let visuals = &mut ui.style_mut().visuals.widgets;
                visuals.inactive.weak_bg_fill = blend_over(BG, with_alpha(Color32::WHITE, 4));
                visuals.inactive.bg_stroke = Stroke::new(
                    1.0_f32,
                    blend_over(BG, with_alpha(Color32::WHITE, 26)),
                );
                visuals.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT);
                visuals.inactive.rounding = Rounding::same(17.0);
                egui::ComboBox::from_id_salt("reward-sort")
                    .width(150.0)
                    .selected_text(RichText::new(new_sort.label()).size(13.2).color(TEXT))
                    .show_ui(ui, |ui| {
                        for sort in [
                            RewardSort::Default,
                            RewardSort::PriceDesc,
                            RewardSort::PriceAsc,
                            RewardSort::Title,
                        ] {
                            if ui
                                .selectable_label(new_sort == sort, sort.label())
                                .clicked()
                            {
                                new_sort = sort;
                            }
                        }
                    });
            });
""")

P.write_text(s, encoding="utf-8")
print("cards/toolbar patched")
