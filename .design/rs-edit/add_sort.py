# -*- coding: utf-8 -*-
import pathlib
P = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs")
s = P.read_text(encoding="utf-8")

def sub(old, new):
    global s
    assert old in s, "NOT FOUND: " + old[:100]
    s = s.replace(old, new, 1)

# --- типы и поля ---
sub("""/// Фильтр списка наград.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RewardFilter {""",
"""/// Сортировка списка наград.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RewardSort {
    Default,
    PriceDesc,
    PriceAsc,
    Title,
}

impl RewardSort {
    fn label(self) -> &'static str {
        match self {
            RewardSort::Default => "Все награды",
            RewardSort::PriceDesc => "Сначала дорогие",
            RewardSort::PriceAsc => "Сначала дешёвые",
            RewardSort::Title => "По названию",
        }
    }
}

/// Фильтр списка наград.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RewardFilter {""")

sub("""    /// Активный фильтр списка наград.
    reward_filter: RewardFilter,
""",
"""    /// Активный фильтр списка наград.
    reward_filter: RewardFilter,
    /// Сортировка списка наград.
    reward_sort: RewardSort,
""")
sub("""            reward_filter: RewardFilter::All,
""",
"""            reward_filter: RewardFilter::All,
            reward_sort: RewardSort::Default,
""")

# --- сортировка в rewards_tab ---
sub("""        let mut rewards = self.remote_rewards.clone();
        twitch::sort_rewards_for_display(&mut rewards);
""",
"""        let mut rewards = self.remote_rewards.clone();
        twitch::sort_rewards_for_display(&mut rewards);
        match self.reward_sort {
            RewardSort::Default => {}
            RewardSort::PriceDesc => {
                rewards.sort_by(|a, b| b.cost.cmp(&a.cost).then(a.title.cmp(&b.title)))
            }
            RewardSort::PriceAsc => {
                rewards.sort_by(|a, b| a.cost.cmp(&b.cost).then(a.title.cmp(&b.title)))
            }
            RewardSort::Title => rewards.sort_by(|a, b| a.title.cmp(&b.title)),
        }
        let mut new_sort = self.reward_sort;
""")
sub("""        if new_filter != filter {
            self.reward_filter = new_filter;
            self.touch();
        }
""",
"""        if new_filter != filter {
            self.reward_filter = new_filter;
            self.touch();
        }
        if new_sort != self.reward_sort {
            self.reward_sort = new_sort;
            self.touch();
        }
""")

P.write_text(s, encoding="utf-8")
print("types + sort added")