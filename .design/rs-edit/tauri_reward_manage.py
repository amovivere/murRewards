# -*- coding: utf-8 -*-
"""Создание/редактирование/удаление наград Twitch из Tauri-UI."""
import pathlib

# ---------- backend ----------
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = p.read_text(encoding="utf-8")


def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, 1)


sub("""            twitch::Event::RewardsUnauthorized => {""",
"""            twitch::Event::RewardCreated { title, .. } => {
                log::info!("Twitch: награда «{title}» создана");
            }
            twitch::Event::RewardUpdated { title, .. } => {
                log::info!("Twitch: награда «{title}» изменена");
            }
            twitch::Event::RewardDeleted(title) => {
                log::info!("Twitch: награда «{title}» удалена");
            }
            twitch::Event::RewardManageUnauthorized => {
                let mut inner = self.lock();
                inner.error = Some(
                    "Twitch не разрешил управлять наградами — переподключите аккаунт.".into(),
                );
            }
            twitch::Event::RewardManageFailed(message) => {
                let mut inner = self.lock();
                inner.error = Some(message);
            }
            twitch::Event::RewardsUnauthorized => {""")

sub("""#[tauri::command]
pub fn choose_sound(""",
"""fn twitch_reward_credentials(inner: &Inner) -> Result<(String, String, String), String> {
    if !inner.settings.twitch.is_connected() {
        return Err("Twitch не подключён.".into());
    }
    let access = inner
        .settings
        .twitch
        .access_token()
        .ok_or("Не удалось прочитать токен Twitch. Переподключите аккаунт.")?;
    Ok((
        inner.settings.twitch.client_id.trim().to_string(),
        access,
        inner.settings.twitch.user_id.trim().to_string(),
    ))
}

#[tauri::command]
pub fn create_reward(
    core: State<'_, Arc<AppCore>>,
    title: String,
    cost: i64,
    color: String,
    requires_input: bool,
) -> Result<CoreView, String> {
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .create_reward(&client_id, &access, &user_id, draft);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn update_reward(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    title: String,
    cost: i64,
    color: String,
    requires_input: bool,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    let draft = twitch::RewardDraft::new(title, cost, color).with_input(requires_input);
    draft.validate()?;
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .update_reward(&client_id, &access, &user_id, &reward_id, draft);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn delete_reward(
    core: State<'_, Arc<AppCore>>,
    reward_id: String,
    title: String,
) -> Result<CoreView, String> {
    if reward_id.trim().is_empty() {
        return Err("Не передана награда.".into());
    }
    {
        let inner = core.lock();
        let (client_id, access, user_id) = twitch_reward_credentials(&inner)?;
        inner
            .twitch
            .delete_reward(&client_id, &access, &user_id, &reward_id, &title);
    }
    Ok(core.view())
}

#[tauri::command]
pub fn choose_sound(""")
p.write_text(s, encoding="utf-8")

# main registration
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s = p.read_text(encoding="utf-8")
s = s.replace("""            core::get_logs,
        ])""", """            core::get_logs,
            core::create_reward,
            core::update_reward,
            core::delete_reward,
        ])""")
p.write_text(s, encoding="utf-8")

# ---------- frontend ----------
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s = p.read_text(encoding="utf-8")

needle = "  /* ---------- модальное окно OBS ---------- */"
assert needle in s
modal = r'''  /* ---------- создание/редактирование награды ---------- */
  function openRewardModal(reward) {
    if ($('#reward-modal')) return;
    const editing = !!reward;
    const modal = document.createElement('div');
    modal.className = 'modal-scrim';
    modal.id = 'reward-modal';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="modal-title">${editing ? 'Изменить награду' : 'Новая награда'}</div>
          <button class="modal-close" id="reward-modal-close" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="modal-sub">${editing ? 'Название, цена и цвет обновятся на Twitch.' : 'Награда создастся в канале через Twitch API.'}</div>
        <div class="modal-label">НАЗВАНИЕ</div>
        <input class="input reward-input" id="reward-title" maxlength="45" value="${escapeHtml(reward?.title || '')}" placeholder="Например, «Сказать слово»">
        <div class="reward-form-row">
          <div><div class="modal-label">ЦЕНА, БАЛЛОВ</div><input class="input reward-input" id="reward-cost" type="number" min="1" max="1000000" value="${reward?.cost ?? 100}"></div>
          <div><div class="modal-label">ЦВЕТ</div><input class="input reward-input" id="reward-color" type="color" value="${reward?.color || '#8B00FF'}"></div>
        </div>
        <label class="reward-check"><input type="checkbox" id="reward-input-required" ${reward?.requires_input ? 'checked' : ''}> Нужен ввод текста от зрителя</label>
        <div class="modal-actions" style="margin-top:18px">
          ${editing ? '<button class="btn btn-secondary reward-delete" id="reward-delete">Удалить</button>' : ''}
          <div class="right">
            <button class="btn btn-secondary" id="reward-cancel">Отмена</button>
            <button class="btn btn-primary" id="reward-save">${editing ? 'Сохранить' : 'Создать'}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    $('#reward-modal-close', modal).addEventListener('click', close);
    $('#reward-cancel', modal).addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    const save = async () => {
      const title = $('#reward-title', modal).value.trim();
      const cost = Number($('#reward-cost', modal).value) || 0;
      const color = $('#reward-color', modal).value || '#8B00FF';
      const requiresInput = $('#reward-input-required', modal).checked;
      if (!title) {
        setFooter('Введите название награды');
        return;
      }
      try {
        const view = editing
          ? await invoke('update_reward', {
              rewardId: reward.id,
              title,
              cost,
              color,
              requiresInput,
            })
          : await invoke('create_reward', { title, cost, color, requiresInput });
        close();
        setFooter(editing ? 'Награда обновляется…' : 'Награда создаётся…');
        if (view) applyCoreView(view);
        setTimeout(async () => {
          try {
            const fresh = await invoke('get_state');
            if (fresh) {
              applyCoreView(fresh);
              if (state.tab === 'rewards') renderCoreRewards(fresh);
            }
          } catch {}
        }, 900);
      } catch (err) {
        setFooter(String(err), 6000);
      }
    };
    $('#reward-save', modal).addEventListener('click', save);
    $('#reward-title', modal).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
    $('#reward-delete', modal)?.addEventListener('click', async () => {
      if (!window.confirm(`Удалить награду «${reward.title}» на Twitch?`)) return;
      try {
        const view = await invoke('delete_reward', { rewardId: reward.id, title: reward.title });
        close();
        setFooter('Награда удаляется…');
        if (view) applyCoreView(view);
        setTimeout(async () => {
          try {
            const fresh = await invoke('get_state');
            if (fresh) {
              applyCoreView(fresh);
              if (state.tab === 'rewards') renderCoreRewards(fresh);
            }
          } catch {}
        }, 900);
      } catch (err) {
        setFooter(String(err), 6000);
      }
    });
  }

  /* ---------- модальное окно OBS ---------- */'''
s = s.replace(needle, modal, 1)

# dots -> edit modal; create button -> modal
s = s.replace("""      const action = event.target.closest('[data-act]');
      if (!action) return;""", """      if (event.target.closest('.dots')) {
        const fresh = state.core?.rewards?.find((item) => item.id === rewardId);
        openRewardModal(fresh || { id: rewardId, title });
        return;
      }
      const action = event.target.closest('[data-act]');
      if (!action) return;""")

s = s.replace("""    $('.head-actions .btn-primary')?.addEventListener('click', () => {
      setFooter('Создание награды появится на следующем этапе');
    });""", """    $('.head-actions .btn-primary')?.addEventListener('click', () => openRewardModal(null));""")

s = s.replace("""    const card = event.target.closest('.reward-card');
      if (!card) return;
      const rewardId = card.dataset.id;
      const title = card.dataset.title || 'награда';""", """    const card = event.target.closest('.reward-card');
      if (!card) return;
      const rewardId = card.dataset.id;
      const title = card.dataset.title || 'награда';""")
p.write_text(s, encoding="utf-8")

# CSS
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.css")
s = p.read_text(encoding="utf-8")
s += """

/* ===== форма награды ===== */
.reward-input { width: 100%; background: #161616; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; padding: 8px 10px; color: #F5F5F5; font-size: 12.8px; }
.reward-input:focus { outline: none; border-color: rgba(139,0,255,.55); }
.reward-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.reward-check { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: #BDBDBD; cursor: pointer; }
.reward-check input { accent-color: #8B00FF; width: 15px; height: 15px; cursor: pointer; }
.reward-delete { color: #EF4444; }
"""
p.write_text(s, encoding="utf-8")
print("reward management wired")
