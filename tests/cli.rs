use std::process::Command;

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
