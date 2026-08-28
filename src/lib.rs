//! Conservative post-apply configuration verification.
//!
//! Apply Witness deliberately distinguishes a matching field from a field the
//! provider cannot expose. Unknown is never success.
//!
//! ```
//! use apply_witness::{verify_supabase, VerifyInput, Status};
//!
//! let receipt = verify_supabase(VerifyInput {
//!     config: b"[auth]\nsite_url = 'https://example.test'\n",
//!     readback: br#"{"site_url":"https://example.test"}"#,
//!     project_ref: "demo",
//!     readback_source: "fixture",
//! }).unwrap();
//! assert_eq!(receipt.conclusion, Status::Applied);
//! ```

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Applied,
    Changed,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FieldResult {
    pub path: String,
    pub status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub declared: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readback: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub redacted: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Summary {
    pub applied: usize,
    pub changed: usize,
    pub unknown: usize,
    pub total: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Receipt {
    pub schema_version: String,
    pub witness_version: String,
    pub receipt_id: String,
    pub observed_at: DateTime<Utc>,
    pub provider: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub project_ref: String,
    pub input_sha256: String,
    pub readback_source: String,
    pub conclusion: Status,
    pub summary: Summary,
    pub fields: Vec<FieldResult>,
}

impl Receipt {
    pub fn successful(&self) -> bool {
        self.conclusion == Status::Applied
    }
}

impl std::fmt::Display for Status {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Status::Applied => "applied",
            Status::Changed => "changed",
            Status::Unknown => "unknown",
        })
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

pub struct VerifyInput<'a> {
    pub config: &'a [u8],
    pub readback: &'a [u8],
    pub project_ref: &'a str,
    pub readback_source: &'a str,
}

/// Provider boundary used by the built-in registry and future adapters.
pub trait ProviderAdapter {
    fn name(&self) -> &'static str;
    fn supported_fields(&self) -> Vec<&'static str>;
    fn verify(&self, input: VerifyInput<'_>) -> Result<Receipt, String>;
}

/// Audited Supabase auth configuration adapter.
pub struct SupabaseAdapter;

impl ProviderAdapter for SupabaseAdapter {
    fn name(&self) -> &'static str {
        "supabase"
    }
    fn supported_fields(&self) -> Vec<&'static str> {
        supported_supabase_fields()
    }
    fn verify(&self, input: VerifyInput<'_>) -> Result<Receipt, String> {
        verify_supabase_inner(input)
    }
}

#[derive(Clone, Copy)]
struct Mapping {
    readback: &'static str,
    invert_bool: bool,
    set_like: bool,
}

fn mappings() -> BTreeMap<&'static str, Mapping> {
    BTreeMap::from([
        (
            "auth.additional_redirect_urls",
            Mapping {
                readback: "uri_allow_list",
                invert_bool: false,
                set_like: true,
            },
        ),
        (
            "auth.email.double_confirm_changes",
            Mapping {
                readback: "mailer_secure_email_change_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.email.enable_confirmations",
            Mapping {
                readback: "mailer_autoconfirm",
                invert_bool: true,
                set_like: false,
            },
        ),
        (
            "auth.email.enable_signup",
            Mapping {
                readback: "external_email_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.email.otp_expiry",
            Mapping {
                readback: "mailer_otp_exp",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.email.secure_password_change",
            Mapping {
                readback: "mailer_secure_password_change_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.enable_anonymous_sign_ins",
            Mapping {
                readback: "external_anonymous_users_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.enable_manual_linking",
            Mapping {
                readback: "security_manual_linking_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.enable_refresh_token_rotation",
            Mapping {
                readback: "refresh_token_rotation_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.enable_signup",
            Mapping {
                readback: "disable_signup",
                invert_bool: true,
                set_like: false,
            },
        ),
        (
            "auth.jwt_expiry",
            Mapping {
                readback: "jwt_exp",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.refresh_token_reuse_interval",
            Mapping {
                readback: "refresh_token_reuse_interval",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.site_url",
            Mapping {
                readback: "site_url",
                invert_bool: false,
                set_like: false,
            },
        ),
        (
            "auth.sms.enable_confirmations",
            Mapping {
                readback: "sms_autoconfirm",
                invert_bool: true,
                set_like: false,
            },
        ),
        (
            "auth.sms.enable_signup",
            Mapping {
                readback: "external_phone_enabled",
                invert_bool: false,
                set_like: false,
            },
        ),
    ])
}

pub fn supported_supabase_fields() -> Vec<&'static str> {
    mappings().keys().copied().collect()
}

pub fn verify_supabase(input: VerifyInput<'_>) -> Result<Receipt, String> {
    SupabaseAdapter.verify(input)
}

fn verify_supabase_inner(input: VerifyInput<'_>) -> Result<Receipt, String> {
    let text =
        std::str::from_utf8(input.config).map_err(|_| "config is not valid UTF-8".to_string())?;
    let config: toml::Value = toml::from_str(text).map_err(|e| format!("parse config: {e}"))?;
    let readback: JsonValue =
        serde_json::from_slice(input.readback).map_err(|e| format!("parse readback JSON: {e}"))?;
    let mut declared = BTreeMap::new();
    flatten_toml("", &config, &mut declared);
    declared.retain(|path, _| path.starts_with("auth."));

    let known = mappings();
    let mut summary = Summary::default();
    let mut fields = Vec::with_capacity(declared.len().max(1));
    for (path, wanted) in declared {
        summary.total += 1;
        let secret = is_secret_path(&path);
        let shown_wanted = if secret {
            JsonValue::String("[REDACTED]".into())
        } else {
            toml_to_json(&wanted)
        };
        let Some(mapping) = known.get(path.as_str()) else {
            summary.unknown += 1;
            fields.push(FieldResult {
                path,
                status: Status::Unknown,
                declared: Some(shown_wanted),
                readback: None,
                reason: Some(
                    "provider readback does not expose an audited mapping for this field".into(),
                ),
                redacted: secret,
            });
            continue;
        };
        let Some(raw_readback) = lookup_json(&readback, mapping.readback) else {
            summary.unknown += 1;
            fields.push(FieldResult {
                path,
                status: Status::Unknown,
                declared: Some(shown_wanted),
                readback: None,
                reason: Some("field was absent from provider readback".into()),
                redacted: secret,
            });
            continue;
        };
        let mut got = raw_readback.clone();
        if mapping.invert_bool {
            let Some(value) = got.as_bool() else {
                summary.unknown += 1;
                fields.push(FieldResult {
                    path,
                    status: Status::Unknown,
                    declared: Some(shown_wanted),
                    readback: None,
                    reason: Some("provider returned a non-boolean value".into()),
                    redacted: secret,
                });
                continue;
            };
            got = JsonValue::Bool(!value);
        }
        let matches = equivalent(&toml_to_json(&wanted), &got, mapping.set_like);
        let status = if matches {
            summary.applied += 1;
            Status::Applied
        } else {
            summary.changed += 1;
            Status::Changed
        };
        fields.push(FieldResult {
            path,
            status,
            declared: Some(shown_wanted),
            readback: Some(if secret {
                JsonValue::String("[REDACTED]".into())
            } else {
                got
            }),
            reason: (!matches).then(|| "declared value differs from provider readback".into()),
            redacted: secret,
        });
    }
    if summary.total == 0 {
        summary.total = 1;
        summary.unknown = 1;
        fields.push(FieldResult {
            path: "auth".into(),
            status: Status::Unknown,
            declared: None,
            readback: None,
            reason: Some("no [auth] fields were declared".into()),
            redacted: false,
        });
    }
    let conclusion = if summary.changed > 0 {
        Status::Changed
    } else if summary.unknown > 0 {
        Status::Unknown
    } else {
        Status::Applied
    };
    let input_hash = hex::encode(Sha256::digest(input.config));
    let now = Utc::now();
    let id_material = format!(
        "{}{}{}",
        input_hash,
        input.project_ref,
        now.to_rfc3339_opts(SecondsFormat::Nanos, true)
    );
    let receipt_id = format!(
        "aw_{}",
        &hex::encode(Sha256::digest(id_material.as_bytes()))[..16]
    );
    Ok(Receipt {
        schema_version: "apply-witness.receipt/v1".into(),
        witness_version: VERSION.into(),
        receipt_id,
        observed_at: now,
        provider: "supabase".into(),
        project_ref: input.project_ref.into(),
        input_sha256: input_hash,
        readback_source: input.readback_source.into(),
        conclusion,
        summary,
        fields,
    })
}

fn flatten_toml(prefix: &str, value: &toml::Value, out: &mut BTreeMap<String, toml::Value>) {
    if let toml::Value::Table(table) = value {
        for (key, value) in table {
            let path = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{prefix}.{key}")
            };
            if value.is_table() {
                flatten_toml(&path, value, out)
            } else {
                out.insert(path, value.clone());
            }
        }
    }
}

fn toml_to_json(value: &toml::Value) -> JsonValue {
    serde_json::to_value(value).unwrap_or(JsonValue::Null)
}

fn lookup_json<'a>(root: &'a JsonValue, path: &str) -> Option<&'a JsonValue> {
    if let Some(value) = root.get(path) {
        return Some(value);
    }
    let mut current = root;
    for part in path.split('.') {
        current = current.get(part)?;
    }
    Some(current)
}

fn equivalent(wanted: &JsonValue, got: &JsonValue, set_like: bool) -> bool {
    if set_like {
        return normalized_set(wanted) == normalized_set(got);
    }
    match (wanted, got) {
        (JsonValue::Number(a), JsonValue::Number(b)) => a.as_f64() == b.as_f64(),
        (JsonValue::String(a), JsonValue::String(b)) => a.trim() == b.trim(),
        _ => wanted == got,
    }
}

fn normalized_set(value: &JsonValue) -> Vec<String> {
    let mut result: Vec<String> = match value {
        JsonValue::Array(values) => values.iter().map(scalar_string).collect(),
        JsonValue::String(value) => value
            .split(',')
            .map(|v| v.trim().to_owned())
            .filter(|v| !v.is_empty())
            .collect(),
        other => vec![scalar_string(other)],
    };
    result.sort();
    result
}

fn scalar_string(value: &JsonValue) -> String {
    value
        .as_str()
        .map(str::trim)
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string())
}

fn is_secret_path(path: &str) -> bool {
    let path = path.to_ascii_lowercase();
    [
        "secret",
        "password",
        "token",
        "credential",
        "private_key",
        "client_key",
    ]
    .iter()
    .any(|word| path.contains(word))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn verify(config: &str, readback: &str) -> Receipt {
        verify_supabase(VerifyInput {
            config: config.as_bytes(),
            readback: readback.as_bytes(),
            project_ref: "test",
            readback_source: "fixture",
        })
        .unwrap()
    }

    #[test]
    fn matches_normalized_and_inverted_fields() {
        let receipt = verify(
            "[auth]\nsite_url='https://app.test'\nadditional_redirect_urls=['https://b.test','https://a.test']\nenable_signup=true\n",
            r#"{"site_url":"https://app.test","uri_allow_list":"https://a.test, https://b.test","disable_signup":false}"#,
        );
        assert_eq!(receipt.conclusion, Status::Applied);
        assert_eq!(receipt.summary.applied, 3);
    }

    #[test]
    fn ignored_and_missing_fields_are_never_successful() {
        let receipt = verify(
            "[auth]\nsite_url='https://declared.test'\n[auth.oauth_server]\nenabled=true\nauthorization_path='/oauth/consent'\n",
            r#"{"site_url":"https://actual.test"}"#,
        );
        assert_eq!(receipt.summary.changed, 1);
        assert_eq!(receipt.summary.unknown, 2);
        assert!(
            receipt
                .fields
                .iter()
                .filter(|f| f.path.starts_with("auth.oauth_server"))
                .all(|f| f.status != Status::Applied)
        );
        assert!(!receipt.successful());
    }

    #[test]
    fn secret_values_are_redacted_even_when_unknown() {
        let receipt = verify("[auth.external.github]\nsecret='never-print-me'\n", "{}");
        let field = &receipt.fields[0];
        assert!(field.redacted);
        assert_eq!(field.declared, Some(JsonValue::String("[REDACTED]".into())));
        assert!(
            !serde_json::to_string(&receipt)
                .unwrap()
                .contains("never-print-me")
        );
    }
}
