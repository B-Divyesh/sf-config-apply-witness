use std::process::Command;

#[cfg(unix)]
use std::{fs, os::unix::fs::PermissionsExt, time::SystemTime};

fn binary() -> Command {
    Command::new(env!("CARGO_BIN_EXE_apply-witness"))
}

#[test]
fn help_is_useful() {
    let output = binary().arg("--help").output().unwrap();
    assert!(output.status.success());
    let text = String::from_utf8(output.stdout).unwrap();
    assert!(text.contains("provider readback"));
    assert!(text.contains("verify"));
    assert!(text.contains("adapters"));
}

#[test]
fn documented_offline_example_returns_policy_exit_and_json() {
    let output = binary()
        .args([
            "verify",
            "--config",
            "examples/supabase-config.toml",
            "--readback",
            "examples/auth-readback.json",
            "--json",
        ])
        .output()
        .unwrap();
    assert_eq!(
        output.status.code(),
        Some(2),
        "unknown OAuth field must fail policy"
    );
    let receipt: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(receipt["summary"]["applied"], 6);
    assert_eq!(receipt["summary"]["unknown"], 1);
    assert_eq!(receipt["conclusion"], "unknown");
}

#[test]
fn missing_credentials_is_an_operational_error() {
    let output = binary()
        .args([
            "verify",
            "--config",
            "examples/supabase-config.toml",
            "--project-ref",
            "demo",
        ])
        .env_remove("SUPABASE_ACCESS_TOKEN")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(
        String::from_utf8(output.stderr)
            .unwrap()
            .contains("SUPABASE_ACCESS_TOKEN")
    );
}

#[cfg(unix)]
#[test]
fn replacing_a_receipt_forces_owner_only_permissions() {
    let unique = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "apply-witness-permissions-{}-{unique}.json",
        std::process::id()
    ));
    fs::write(&path, b"previous receipt\n").unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

    let output = binary()
        .args([
            "verify",
            "--config",
            "examples/supabase-config.toml",
            "--readback",
            "examples/auth-readback.json",
            "--receipt",
        ])
        .arg(&path)
        .arg("--json")
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    assert_eq!(
        fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o600
    );
    assert_eq!(fs::read(&path).unwrap(), output.stdout);
    fs::remove_file(path).unwrap();
}
