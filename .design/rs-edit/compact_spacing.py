# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")
def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:110]
    s = s.replace(old, new, 1)

# плеер: убрать лишние межэлементные отступы
sub("""            ui.set_width(ui.available_width());
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 196.0;
""",
"""            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing = Vec2::ZERO;
            let total_width = ui.available_width();
            ui.horizontal_top(|ui| {
                let right_width = 196.0;
""")
sub("""                    Layout::top_down(Align::Min),
                    |ui| {
                    if playing {
""",
"""                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    if playing {
""")
sub("""                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.label(
                        RichText::new("Громкость музыки")
""",
"""                    Layout::top_down(Align::Min),
                    |ui| {
                    ui.spacing_mut().item_spacing.y = 2.0;
                    ui.label(
                        RichText::new("Громкость музыки")
""")
# очередь: нулевые вертикальные отступы
sub("""            ui.set_width(ui.available_width());

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""",
"""            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing = Vec2::ZERO;

            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("Очередь · {} из {}", pending.len(), max_queue))
""")
# строки очереди: нулевые отступы и компактная мета
sub("""                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.set_min_height(if item.state == ItemState::Loading {
""",
"""                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.spacing_mut().item_spacing = Vec2::ZERO;
                        ui.set_min_height(if item.state == ItemState::Loading {
""")
sub("""                            ui.vertical(|ui| {
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.8).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                if item.state == ItemState::Loading {
""",
"""                            ui.vertical(|ui| {
                                ui.spacing_mut().item_spacing.y = 1.0;
                                ui.add(
                                    egui::Label::new(
                                        RichText::new(item.label()).size(13.8).color(TEXT),
                                    )
                                    .truncate(),
                                );
                                if item.state == ItemState::Loading {
""")
# ввод: без двойных промежутков и с запасом под кнопку
sub("""            ui.horizontal(|ui| {
                let (plus_rect, _) = ui.allocate_exact_size(Vec2::new(18.0, 18.0), Sense::hover());
""",
"""            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 0.0;
                let (plus_rect, _) = ui.allocate_exact_size(Vec2::new(18.0, 18.0), Sense::hover());
""")
sub("let width = (ui.available_width() - button_width - 16.0).max(220.0);",
    "let width = (ui.available_width() - button_width - 40.0).max(200.0);")
# низ: убрать лишние отступы
sub("""                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""",
"""                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 6.0;
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new("OBS — строка «Сейчас играет»")
""")
sub("""                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.label(
                        RichText::new("Состояние")
""",
"""                    .show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    ui.spacing_mut().item_spacing.y = 3.0;
                    ui.label(
                        RichText::new("Состояние")
""")
P.write_text(s, encoding="utf-8")
print("spacing compacted")