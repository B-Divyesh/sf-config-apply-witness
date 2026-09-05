use std::{
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    process::Command,
    thread,
};

#[cfg(unix)]
use std::{fs, os::unix::fs::PermissionsExt, time::SystemTime};

fn binary() -> Command {
    Command::new(env!("CARGO_BIN_EXE_apply-witness"))
}

#[cfg(unix)]
fn unique_path(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "apply-witness-{name}-{}-{unique}",
        std::process::id()
    ))
}

#[cfg(unix)]
fn valid_license_server() -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let worker = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0_u8; 4096];
        let length = stream.read(&mut request).unwrap();
        let request = String::from_utf8_lossy(&request[..length]);
        assert!(
            request
                .starts_with("GET /api/v1/products/config-apply-witness/verify?license=qa-valid")
        );
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 28\r\nConnection: close\r\n\r\n{\"valid\":true,\"reason\":\"ok\"}")
            .unwrap();
    });
    (format!("http://{address}"), worker)
}

#[cfg(unix)]
fn supabase_readback_server() -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let worker = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0_u8; 4096];
        let length = stream.read(&mut request).unwrap();
        let request = String::from_utf8_lossy(&request[..length]);
        assert!(request.starts_with("GET /v1/projects/sample-project/config/auth HTTP/1.1"));
        let request_lower = request.to_ascii_lowercase();
        assert!(request_lower.contains("authorization: bearer private-provider-token"));
        assert!(request_lower.contains("accept: application/json"));
        let body = r#"{"site_url":"https://example.test"}"#;
        stream
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .as_bytes(),
            )
            .unwrap();
    });
    (format!("http://{address}"), worker)
}

#[cfg(unix)]
fn write(path: &Path, contents: &str) {
    fs::write(path, contents).unwrap();
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

#[test]
fn demo_uses_bundled_sample_and_writes_a_receipt_in_a_temp_directory() {
    let output = binary().args(["demo", "--json"]).output().unwrap();
    assert_eq!(output.status.code(), Some(2));
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["receipt"]["summary"]["applied"], 6);
    assert_eq!(result["receipt"]["summary"]["unknown"], 1);
    let directory = PathBuf::from(result["demo_directory"].as_str().unwrap());
    let receipt = PathBuf::from(result["receipt_path"].as_str().unwrap());
    assert!(directory.join("supabase-config.toml").is_file());
    assert!(directory.join("auth-readback.json").is_file());
    assert!(receipt.is_file());
    #[cfg(unix)]
    assert_eq!(
        fs::metadata(&receipt).unwrap().permissions().mode() & 0o777,
        0o600
    );
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn boundary_numbers_and_out_of_range_configurations_never_exit_successfully() {
    let directory = unique_path("numeric");
    fs::create_dir_all(&directory).unwrap();
    let config = directory.join("config.toml");
    let readback = directory.join("readback.json");
    write(&config, "[auth]\njwt_expiry = 9007199254740992\n");
    write(&readback, r#"{"jwt_exp":9007199254740993}"#);
    let different_large_ints = binary()
        .args(["verify", "--config"])
        .arg(&config)
        .args(["--readback"])
        .arg(&readback)
        .arg("--json")
        .output()
        .unwrap();
    assert_eq!(different_large_ints.status.code(), Some(2));
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&different_large_ints.stdout).unwrap()["conclusion"],
        "changed"
    );

    write(&config, "[auth]\njwt_expiry = 9223372036854775808\n");
    let out_of_range = binary()
        .args(["verify", "--config"])
        .arg(&config)
        .args(["--readback"])
        .arg(&readback)
        .arg("--json")
        .output()
        .unwrap();
    assert_eq!(out_of_range.status.code(), Some(1));
    assert!(
        String::from_utf8(out_of_range.stderr)
            .unwrap()
            .contains("parse config")
    );
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn environment_substitutions_are_redacted_from_cli_output() {
    let directory = unique_path("redaction");
    fs::create_dir_all(&directory).unwrap();
    let config = directory.join("config.toml");
    let readback = directory.join("readback.json");
    write(&config, "[auth]\nsite_url = 'env(PRIVATE_SITE_URL)'\n");
    write(&readback, "{}");
    let output = binary()
        .args(["verify", "--config"])
        .arg(&config)
        .args(["--readback"])
        .arg(&readback)
        .arg("--json")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(2));
    let combined = format!(
        "{}{}",
        String::from_utf8(output.stdout).unwrap(),
        String::from_utf8(output.stderr).unwrap()
    );
    assert!(!combined.contains("PRIVATE_SITE_URL"));
    assert!(combined.contains("[REDACTED]"));
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn live_readback_is_a_get_and_never_prints_the_provider_token() {
    let directory = unique_path("live-readback");
    fs::create_dir_all(&directory).unwrap();
    let config = directory.join("config.toml");
    write(&config, "[auth]\nsite_url = 'https://example.test'\n");
    let (base, server) = supabase_readback_server();
    let output = binary()
        .args([
            "verify",
            "--config",
            config.to_str().unwrap(),
            "--project-ref",
            "sample-project",
            "--api-base",
            &base,
            "--json",
        ])
        .env("SUPABASE_ACCESS_TOKEN", "private-provider-token")
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(output.status.success());
    let combined = format!(
        "{}{}",
        String::from_utf8(output.stdout).unwrap(),
        String::from_utf8(output.stderr).unwrap()
    );
    assert!(!combined.contains("private-provider-token"));
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn replacing_a_license_cache_forces_owner_only_permissions_and_unlocks_batch() {
    let directory = unique_path("license-cache");
    let cache = directory.join("apply-witness/license.json");
    fs::create_dir_all(cache.parent().unwrap()).unwrap();
    write(&cache, "old cache");
    fs::set_permissions(&cache, fs::Permissions::from_mode(0o644)).unwrap();
    let (base, server) = valid_license_server();

    let verified = binary()
        .args(["license", "verify", "--token", "qa-valid"])
        .env("XDG_CACHE_HOME", &directory)
        .env("APPLY_WITNESS_BILLING_BASE_URL", base)
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(verified.status.success());
    assert_eq!(
        fs::metadata(&cache).unwrap().permissions().mode() & 0o777,
        0o600
    );

    let manifest = directory.join("manifest.json");
    let config = directory.join("config.toml");
    let readback = directory.join("readback.json");
    write(&config, "[auth]\nsite_url = 'https://example.test'\n");
    write(&readback, r#"{"site_url":"https://example.test"}"#);
    write(
        &manifest,
        r#"{"jobs":[{"name":"sample","config":"config.toml","readback":"readback.json"}]}"#,
    );
    let batch = binary()
        .args(["batch", "--manifest"])
        .arg(&manifest)
        .arg("--json")
        .env("XDG_CACHE_HOME", &directory)
        .env_remove("APPLY_WITNESS_LICENSE")
        .output()
        .unwrap();
    assert!(batch.status.success());
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&batch.stdout).unwrap()["results"][0]["receipt"]
            ["conclusion"],
        "applied"
    );
    fs::remove_dir_all(directory).unwrap();
}
