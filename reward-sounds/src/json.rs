//! JSON через `serde_json`: разбор ответов Twitch без ручного парсера.

pub use serde_json::{json, Value};

/// Разбирает текст в JSON-значение.
pub fn parse(input: &str) -> Result<Value, String> {
    serde_json::from_str(input).map_err(|err| format!("некорректный JSON: {err}"))
}

/// Удобные обращения к строковым и числовым полям объекта.
pub trait JsonExt {
    fn str_field(&self, name: &str) -> Option<&str>;
    fn i64_field(&self, name: &str) -> Option<i64>;
    fn u64_field(&self, name: &str) -> Option<u64>;
    fn bool_field(&self, name: &str) -> Option<bool>;
}

impl JsonExt for Value {
    fn str_field(&self, name: &str) -> Option<&str> {
        self.get(name)?.as_str()
    }

    fn i64_field(&self, name: &str) -> Option<i64> {
        self.get(name)?.as_i64()
    }

    fn u64_field(&self, name: &str) -> Option<u64> {
        self.get(name)?.as_u64()
    }

    fn bool_field(&self, name: &str) -> Option<bool> {
        self.get(name)?.as_bool()
    }
}

/// Экранирует строку для ручной сборки JSON (оставлено для совместимости).
pub fn escape(text: &str) -> String {
    let quoted = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string());
    quoted
        .strip_prefix('"')
        .and_then(|inner| inner.strip_suffix('"'))
        .unwrap_or("")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_objects() {
        let value = parse(r#"{"data":[{"id":"1","title":"Тест","cost":500}]}"#).unwrap();
        let data = value.get("data").and_then(Value::as_array).unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0].str_field("title"), Some("Тест"));
        assert_eq!(data[0].i64_field("cost"), Some(500));
    }

    #[test]
    fn string_fields_and_flags() {
        let value = parse(r#"{"id":"42","enabled":true,"n":3}"#).unwrap();
        assert_eq!(value.str_field("id"), Some("42"));
        assert_eq!(value.bool_field("enabled"), Some(true));
        assert_eq!(value.u64_field("n"), Some(3));
        assert_eq!(value.str_field("missing"), None);
    }

    #[test]
    fn reports_broken_json() {
        assert!(parse("{oops").is_err());
    }

    #[test]
    fn escapes_special_characters() {
        let escaped = escape("кавычка \" и перевод\nстроки");
        let value = parse(&format!("\"{escaped}\"")).unwrap();
        assert_eq!(value.as_str(), Some("кавычка \" и перевод\nстроки"));
    }
}
