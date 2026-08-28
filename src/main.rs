use apply_witness::{Receipt, Status, VerifyInput, supported_supabase_fields, verify_supabase};
use chrono::{DateTime, Utc};
use clap::{Args, Parser, Subcommand};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    env, fs,
    io::{self, Write},
    path::{Path, PathBuf},
    process::ExitCode,
    time::Duration,
};

const PRODUCT_SLUG: &str = "config-apply-witness";
const DEFAULT_SUPABASE_API: &str = "https://api.supabase.com";
const DEFAULT_BILLING_API: &str = "https://api.sociobot.in";

#[derive(Parser)]
#[command(
    name = "apply-witness",
    version,
    about = "Prove declared configuration survived an apply.",
    long_about = "Apply Witness fetches provider readback and emits conservative field-level receipts. A field is only applied when declared and readback values match through an audited mapping; absent or unreadable fields are unknown, never successful."
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Verify one declared configuration against provider readback.
    Verify(VerifyArgs),
    /// Verify multiple configurations from a manifest (Team Receipt Kit).
    Batch(BatchArgs),
    /// List installed provider adapters.
    Adapters,
    /// List audited mappings for a provider adapter.
    Schema {
        #[arg(long, default_value = "supabase")]
        provider: String,
    },
    /// Validate and cache a Team Receipt Kit purchase license.
    License {
        #[command(subcommand)]
        command: LicenseCommand,
    },
}

#[derive(Args, Clone)]
struct VerifyArgs {
    /// Provider adapter.
    #[arg(long, default_value = "supabase")]
    provider: String,
    /// Supabase project reference; required for live readback.
    #[arg(long)]
    project_ref: Option<String>,
    /// Path to the declared Supabase config.toml.
    #[arg(long)]
    config: PathBuf,
    /// Offline Management API JSON response instead of a live request.
    #[arg(long)]
    readback: Option<PathBuf>,
    /// Also write the complete JSON receipt with mode 0600.
    #[arg(long)]
    receipt: Option<PathBuf>,
    /// Emit machine-readable JSON to stdout.
    #[arg(long)]
    json: bool,
    /// Supabase Management API origin.
    #[arg(long, env = "APPLY_WITNESS_SUPABASE_API", default_value = DEFAULT_SUPABASE_API)]
    api_base: String,
}

#[derive(Args)]
struct BatchArgs {
    /// JSON manifest path.
    #[arg(long)]
    manifest: PathBuf,
    /// Emit machine-readable JSON to stdout.
    #[arg(long)]
    json: bool,
    /// Supabase Management API origin.
    #[arg(long, env = "APPLY_WITNESS_SUPABASE_API", default_value = DEFAULT_SUPABASE_API)]
    api_base: String,
}

#[derive(Subcommand)]
enum LicenseCommand {
    Verify {
        #[arg(long, env = "APPLY_WITNESS_LICENSE")]
        token: String,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match dispatch(cli) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn dispatch(cli: Cli) -> Result<u8, String> {
    match cli.command {
        None => {
            Cli::command().print_help().map_err(|e| e.to_string())?;
            println!();
            Ok(0)
        }
        Some(Command::Adapters) => {
            println!("supabase\tManagement API /config/auth\tbuilt-in");
            Ok(0)
        }
        Some(Command::Schema { provider }) => {
            require_supabase(&provider)?;
            println!("Audited Supabase Management API auth mappings:");
            for path in supported_supabase_fields() {
                println!("- {path}");
            }
            println!("\nAll other declared [auth] fields produce unknown receipts.");
            Ok(0)
        }
        Some(Command::Verify(args)) => {
            let receipt = execute_verify(&args)?;
            if let Some(path) = &args.receipt {
                write_receipt(path, &receipt)?;
            }
            if args.json {
                print_json(&receipt)?
            } else {
                print_receipt(&receipt, args.receipt.as_deref());
            }
            Ok(if receipt.successful() { 0 } else { 2 })
        }
        Some(Command::Batch(args)) => run_batch(args),
        Some(Command::License {
            command: LicenseCommand::Verify { token },
        }) => {
            let result = verify_license(&token, true)?;
            println!(
                "License active; cached until {}.",
                (result.checked_at + chrono::Duration::days(1)).to_rfc3339()
            );
            Ok(0)
        }
    }
}

use clap::CommandFactory;

fn require_supabase(provider: &str) -> Result<(), String> {
    if provider == "supabase" {
        Ok(())
    } else {
        Err(format!("adapter {provider:?} is not installed"))
    }
}

fn execute_verify(args: &VerifyArgs) -> Result<Receipt, String> {
    require_supabase(&args.provider)?;
    let config =
        fs::read(&args.config).map_err(|e| format!("read {}: {e}", args.config.display()))?;
    let (readback, source) = if let Some(path) = &args.readback {
        (
            fs::read(path).map_err(|e| format!("read {}: {e}", path.display()))?,
            format!(
                "file:{}",
                path.file_name().unwrap_or_default().to_string_lossy()
            ),
        )
    } else {
        let project_ref = args
            .project_ref
            .as_deref()
            .ok_or("--project-ref is required for live readback")?;
        let token = env::var("SUPABASE_ACCESS_TOKEN")
            .map_err(|_| "SUPABASE_ACCESS_TOKEN is required for live readback")?;
        (
            fetch_supabase(&args.api_base, project_ref, &token)?,
            "supabase-management-api".into(),
        )
    };
    verify_supabase(VerifyInput {
        config: &config,
        readback: &readback,
        project_ref: args.project_ref.as_deref().unwrap_or(""),
        readback_source: &source,
    })
}

fn fetch_supabase(base: &str, project_ref: &str, token: &str) -> Result<Vec<u8>, String> {
    let url = format!(
        "{}/v1/projects/{}/config/auth",
        base.trim_end_matches('/'),
        project_ref
    );
    let response = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?
        .get(url)
        .bearer_auth(token)
        .header("Accept", "application/json")
        .header(
            "User-Agent",
            format!("apply-witness/{}", apply_witness::VERSION),
        )
        .send()
        .map_err(|e| format!("Supabase readback failed: {e}"))?;
    let status = response.status();
    let bytes = response
        .bytes()
        .map_err(|e| format!("read Supabase response: {e}"))?
        .to_vec();
    if !status.is_success() {
        let message = serde_json::from_slice::<Value>(&bytes)
            .ok()
            .and_then(|v| v.get("message")?.as_str().map(str::to_owned))
            .unwrap_or_else(|| status.canonical_reason().unwrap_or("request failed").into());
        return Err(format!(
            "Supabase readback returned {}: {message}",
            status.as_u16()
        ));
    }
    Ok(bytes)
}

fn print_receipt(receipt: &Receipt, path: Option<&Path>) {
    println!(
        "APPLY WITNESS  {}",
        receipt.conclusion.to_string().to_uppercase()
    );
    println!(
        "receipt {}  input sha256:{}",
        receipt.receipt_id,
        &receipt.input_sha256[..12]
    );
    print!("provider {}", receipt.provider);
    if !receipt.project_ref.is_empty() {
        print!("/{}", receipt.project_ref);
    }
    println!("  observed {}\n", receipt.observed_at.to_rfc3339());
    for field in &receipt.fields {
        let glyph = match field.status {
            Status::Applied => "✓",
            Status::Changed => "!",
            Status::Unknown => "?",
        };
        print!("{glyph} {:<8} {}", field.status, field.path);
        if field.status == Status::Changed {
            print!(
                "  declared={} readback={}",
                printable(&field.declared),
                printable(&field.readback)
            );
        }
        if let Some(reason) = &field.reason {
            print!("  — {reason}");
        }
        println!();
    }
    println!(
        "\n{} applied  {} changed  {} unknown",
        receipt.summary.applied, receipt.summary.changed, receipt.summary.unknown
    );
    if let Some(path) = path {
        println!("receipt written to {}", path.display());
    }
}

fn printable(value: &Option<Value>) -> String {
    value
        .as_ref()
        .map(Value::to_string)
        .unwrap_or_else(|| "null".into())
}
fn print_json(value: &impl Serialize) -> Result<(), String> {
    serde_json::to_writer_pretty(io::stdout().lock(), value).map_err(|e| e.to_string())?;
    println!();
    Ok(())
}

fn write_receipt(path: &Path, receipt: &Receipt) -> Result<(), String> {
    let mut data = serde_json::to_vec_pretty(receipt).map_err(|e| e.to_string())?;
    data.push(b'\n');
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| format!("write receipt: {e}"))?;
        file.write_all(&data)
            .map_err(|e| format!("write receipt: {e}"))?;
    }
    #[cfg(not(unix))]
    fs::write(path, data).map_err(|e| format!("write receipt: {e}"))?;
    Ok(())
}

#[derive(Deserialize)]
struct Manifest {
    jobs: Vec<Job>,
}
#[derive(Deserialize)]
struct Job {
    name: String,
    #[serde(default = "default_provider")]
    provider: String,
    project_ref: Option<String>,
    config: PathBuf,
    readback: Option<PathBuf>,
}
fn default_provider() -> String {
    "supabase".into()
}
#[derive(Serialize)]
struct BatchResult {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    receipt: Option<Receipt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn run_batch(args: BatchArgs) -> Result<u8, String> {
    let token = env::var("APPLY_WITNESS_LICENSE").map_err(|_| "Team Receipt Kit is locked: set APPLY_WITNESS_LICENSE or run `apply-witness license verify`".to_string())?;
    verify_license(&token, false).map_err(|e| format!("Team Receipt Kit is locked: {e}"))?;
    let bytes = fs::read(&args.manifest).map_err(|e| format!("read manifest: {e}"))?;
    let manifest: Manifest =
        serde_json::from_slice(&bytes).map_err(|e| format!("parse manifest: {e}"))?;
    if manifest.jobs.is_empty() {
        return Err("manifest has no jobs".into());
    }
    let base = args.manifest.parent().unwrap_or(Path::new("."));
    let mut failed = false;
    let mut results = Vec::new();
    for job in manifest.jobs {
        let verify_args = VerifyArgs {
            provider: job.provider,
            project_ref: job.project_ref,
            config: join_relative(base, job.config),
            readback: job.readback.map(|p| join_relative(base, p)),
            receipt: None,
            json: true,
            api_base: args.api_base.clone(),
        };
        match execute_verify(&verify_args) {
            Ok(receipt) => {
                if !receipt.successful() {
                    failed = true;
                }
                results.push(BatchResult {
                    name: job.name,
                    receipt: Some(receipt),
                    error: None,
                });
            }
            Err(error) => {
                failed = true;
                results.push(BatchResult {
                    name: job.name,
                    receipt: None,
                    error: Some(error),
                });
            }
        }
    }
    if args.json {
        print_json(&json!({"results": results}))?;
    } else {
        for result in &results {
            if let Some(receipt) = &result.receipt {
                println!(
                    "{} {}: {} ({}/{} applied)",
                    if receipt.successful() { "✓" } else { "!" },
                    result.name,
                    receipt.conclusion,
                    receipt.summary.applied,
                    receipt.summary.total
                );
            } else {
                println!(
                    "✗ {}: {}",
                    result.name,
                    result.error.as_deref().unwrap_or("failed")
                );
            }
        }
    }
    Ok(if failed { 2 } else { 0 })
}

fn join_relative(base: &Path, path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        base.join(path)
    }
}

#[derive(Clone, Deserialize, Serialize)]
struct LicenseCache {
    token: String,
    valid: bool,
    checked_at: DateTime<Utc>,
    reason: String,
}

fn verify_license(token: &str, force: bool) -> Result<LicenseCache, String> {
    let path = license_cache_path()?;
    let cached = fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice::<LicenseCache>(&b).ok());
    if !force
        && let Some(value) = &cached
        && value.token == token
        && value.valid
        && Utc::now() - value.checked_at < chrono::Duration::days(1)
    {
        return Ok(value.clone());
    }
    let base =
        env::var("APPLY_WITNESS_BILLING_BASE_URL").unwrap_or_else(|_| DEFAULT_BILLING_API.into());
    let url = format!(
        "{}/api/v1/products/{PRODUCT_SLUG}/verify",
        base.trim_end_matches('/')
    );
    let result = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?
        .get(url)
        .query(&[("license", token)])
        .send();
    let response = match result {
        Ok(response) => response,
        Err(error) => {
            if let Some(value) = cached
                && value.token == token
                && value.valid
            {
                return Ok(value);
            }
            return Err(format!("license verification failed: {error}"));
        }
    };
    let body: Value = response
        .json()
        .map_err(|_| "invalid license response".to_string())?;
    let valid = body.get("valid").and_then(Value::as_bool).unwrap_or(false);
    let reason = body
        .get("reason")
        .and_then(Value::as_str)
        .unwrap_or("invalid")
        .to_owned();
    let value = LicenseCache {
        token: token.into(),
        valid,
        checked_at: Utc::now(),
        reason: reason.clone(),
    };
    write_license_cache(&path, &value)?;
    if valid {
        Ok(value)
    } else {
        Err(format!("license is not active ({reason})"))
    }
}

fn license_cache_path() -> Result<PathBuf, String> {
    let base = env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")))
        .ok_or("cannot determine cache directory")?;
    Ok(base.join("apply-witness/license.json"))
}

fn write_license_cache(path: &Path, value: &LicenseCache) -> Result<(), String> {
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let data = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| e.to_string())?;
        file.write_all(&data).map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    fs::write(path, data).map_err(|e| e.to_string())?;
    Ok(())
}
