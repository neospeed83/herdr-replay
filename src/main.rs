use chrono::Utc;
use regex::Regex;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env, fs,
    io::{self, Read},
    path::PathBuf,
    process::{Command, ExitCode, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};
const BLOCK: &str = "[[keys.command]]\nkey = \"prefix+f\"\ntype = \"plugin_action\"\ncommand = \"herdr-replay.toggle\"\ndescription = \"toggle Herdr Replay recording\"";
fn dir() -> PathBuf {
    env::var_os("HERDR_PLUGIN_STATE_DIR")
        .or_else(|| env::var_os("HERDR_REPLAY_STATE_DIR"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(".herdr-replay"))
}
fn paths() -> (PathBuf, PathBuf, PathBuf) {
    let d = dir();
    (
        d.join("recorder.pid"),
        d.join("latest.herdr-replay.json"),
        d.join("latest.html"),
    )
}
fn alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    if cfg!(windows) {
        return Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .is_ok_and(|o| {
                o.status.success() && String::from_utf8_lossy(&o.stdout).contains(&pid.to_string())
            });
    }
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stderr(Stdio::null())
        .stdout(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}
fn terminate(pid: u32) -> io::Result<()> {
    let status = if cfg!(windows) {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T"])
            .status()?
    } else {
        Command::new("kill").arg(pid.to_string()).status()?
    };
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other("unable to stop recorder"))
    }
}
fn spawn_recorder() -> io::Result<std::process::Child> {
    let mut command = Command::new(env::current_exe()?);
    command
        .arg("recorder")
        .env("HERDR_REPLAY_STATE_DIR", dir())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x00000008 | 0x00000200);
    }
    command.spawn()
}
fn pid() -> u32 {
    fs::read_to_string(paths().0)
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}
fn redact(s: &str) -> String {
    let a = Regex::new(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+")
        .unwrap()
        .replace_all(s, "$1[REDACTED]");
    Regex::new(r#"(?i)(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s'\"]+"#)
        .unwrap()
        .replace_all(&a, "$1=[REDACTED]")
        .into_owned()
}
fn call(args: &[&str]) -> io::Result<String> {
    let out = Command::new(env::var("HERDR_BIN_PATH").unwrap_or_else(|_| "herdr".into()))
        .args(args)
        .output()?;
    if !out.status.success() {
        return Err(io::Error::other(String::from_utf8_lossy(&out.stderr)));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into())
}
fn snapshot() -> io::Result<Value> {
    let v: Value = serde_json::from_str(&call(&["api", "snapshot"])?).map_err(io::Error::other)?;
    Ok(v.pointer("/result/snapshot")
        .or_else(|| v.get("result"))
        .unwrap_or(&v)
        .clone())
}
fn git_evidence(cwd: &str) -> Option<Value> {
    let run = |args: &[&str]| output("git", args, Some(std::path::Path::new(cwd))).ok();
    let root = run(&["rev-parse", "--show-toplevel"])?;
    let branch = run(&["-C", &root, "branch", "--show-current"])?;
    let changes = run(&["-C", &root, "status", "--short"])?;
    let head = run(&["-C", &root, "log", "-1", "--pretty=%H%x1f%s"])?;
    Some(
        json!({"root":root,"branch":branch,"changes":changes.lines().take(100).collect::<Vec<_>>(),"head":head}),
    )
}
fn output(program: &str, args: &[&str], cwd: Option<&std::path::Path>) -> io::Result<String> {
    let mut command = Command::new(program);
    command.args(args);
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let result = command.output()?;
    if !result.status.success() {
        return Err(io::Error::other(String::from_utf8_lossy(&result.stderr)));
    }
    Ok(String::from_utf8_lossy(&result.stdout).trim().into())
}
fn html(r: &Value) -> String {
    let data = serde_json::to_string(r).unwrap().replace('<', "\\u003c");
    format!(
        r#"<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Herdr Replay</title><style>body{{margin:0;background:#0a0d0b;color:#e6ece8;font:14px system-ui}}header,footer{{padding:18px;background:#121814}}main{{display:grid;grid-template-columns:1fr 320px;gap:18px;padding:18px}}pre{{height:65vh;overflow:auto;background:#050806;padding:16px;white-space:pre-wrap}}li{{margin:10px 0}}input{{width:100%}}@media(max-width:760px){{main{{grid-template-columns:1fr}}}}</style><header><h2>herdr replay / <span id=t></span></h2><span id=m></span></header><main><pre id=o>No terminal evidence.</pre><ol id=e></ol></main><footer><input id=s type=range min=0 max=1000 value=1000></footer><script>const r={data},s=document.querySelector('#s');t.textContent=r.title||'session';m.textContent=(r.agents||[]).length+' agents · '+r.events.length+' events';function x(v){{return String(v||'').replace(/[&<>]/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;'}}[c]))}}function draw(){{let n=Math.ceil(r.events.length*s.value/1000),v=r.events.slice(0,n),q=[...v].reverse().find(x=>x.type==='terminal.snapshot');o.textContent=q?.text||'No terminal evidence.';e.innerHTML=v.slice(-8).map(x=>'<li>'+x.type+' · '+(x.agent||'')+' '+(x.status||'')+'</li>').join('')}}s.oninput=draw;draw()</script>"#
    )
}
fn export() -> io::Result<()> {
    let (_, p, h) = paths();
    let r: Value = serde_json::from_str(&fs::read_to_string(p)?).map_err(io::Error::other)?;
    fs::write(h, html(&r))
}
fn recorder() -> io::Result<()> {
    fs::create_dir_all(dir())?;
    let (pp, rp, _) = paths();
    fs::write(&pp, std::process::id().to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    ctrlc::set_handler(move || flag.store(true, Ordering::SeqCst)).map_err(io::Error::other)?;
    let started = Utc::now().to_rfc3339();
    let mut rec = json!({"schemaVersion":2,"title":"agent-session","startedAt":started,"updatedAt":started,"endedAt":null,"agents":[],"events":[],"redaction":"built-in"});
    let mut hashes: HashMap<String, String> = HashMap::new();
    let mut git_hashes: HashMap<String, String> = HashMap::new();
    let mut previous: HashMap<String, Value> = HashMap::new();
    let workspace_filter = env::var("HERDR_REPLAY_WORKSPACE_ID")
        .or_else(|_| env::var("HERDR_WORKSPACE_ID"))
        .unwrap_or_default();
    while !stop.load(Ordering::SeqCst) {
        if let Ok(s) = snapshot() {
            let agents = s
                .get("agents")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter(|a| {
                    workspace_filter.is_empty()
                        || a["workspace_id"].as_str() == Some(&workspace_filter)
                })
                .collect::<Vec<_>>();
            let current = agents
                .iter()
                .filter_map(|a| a["pane_id"].as_str().map(|p| (p.to_string(), a.clone())))
                .collect::<HashMap<_, _>>();
            let at = Utc::now().to_rfc3339();
            for (pane, a) in &current {
                match previous.get(pane) { None=>rec["events"].as_array_mut().unwrap().push(json!({"at":at,"type":"agent.discovered","paneId":pane,"workspaceId":a["workspace_id"],"agent":a["agent"],"status":a["agent_status"],"cwd":a["cwd"]})), Some(old) if old["agent_status"]!=a["agent_status"]||old["state_change_seq"]!=a["state_change_seq"]=>rec["events"].as_array_mut().unwrap().push(json!({"at":at,"type":"agent.state","paneId":pane,"workspaceId":a["workspace_id"],"agent":a["agent"],"from":old["agent_status"],"status":a["agent_status"],"cwd":a["cwd"]})), _=>{} }
            }
            for (pane, a) in &previous {
                if !current.contains_key(pane) {
                    rec["events"].as_array_mut().unwrap().push(json!({"at":at,"type":"agent.closed","paneId":pane,"workspaceId":a["workspace_id"],"agent":a["agent"],"status":a["agent_status"],"cwd":a["cwd"]}))
                }
            }
            rec["agents"]=Value::Array(agents.iter().map(|a|json!({"paneId":a["pane_id"],"workspaceId":a["workspace_id"],"agent":a["agent"],"cwd":a["cwd"]})).collect());
            for a in agents {
                let pane = a["pane_id"].as_str().unwrap_or("");
                if let Ok(text) = call(&[
                    "pane",
                    "read",
                    pane,
                    "--source",
                    "recent-unwrapped",
                    "--lines",
                    "80",
                ]) {
                    let text = redact(&text);
                    let hash = format!("{:x}", Sha256::digest(text.as_bytes()));
                    if hashes.get(pane) != Some(&hash) {
                        rec["events"].as_array_mut().unwrap().push(json!({"at":Utc::now().to_rfc3339(),"type":"terminal.snapshot","paneId":pane,"workspaceId":a["workspace_id"],"agent":a["agent"],"status":a["agent_status"],"hash":&hash[..16],"text":text}));
                        hashes.insert(pane.into(), hash);
                    }
                }
                if let Some(git) = a["cwd"].as_str().and_then(git_evidence) {
                    let root = git["root"].as_str().unwrap_or("");
                    let hash = format!("{:x}", Sha256::digest(serde_json::to_vec(&git)?));
                    if git_hashes.get(root) != Some(&hash) {
                        rec["events"].as_array_mut().unwrap().push(json!({"at":Utc::now().to_rfc3339(),"type":"git.snapshot","paneId":pane,"workspaceId":a["workspace_id"],"agent":a["agent"],"repo":std::path::Path::new(root).file_name().unwrap_or_default(),"root":root,"branch":git["branch"],"changes":git["changes"],"head":git["head"]}));
                        git_hashes.insert(root.into(), hash);
                    }
                }
            }
            previous = current;
        }
        rec["updatedAt"] = json!(Utc::now().to_rfc3339());
        fs::write(&rp, serde_json::to_vec_pretty(&rec)?)?;
        thread::sleep(Duration::from_millis(1200));
    }
    rec["endedAt"] = json!(Utc::now().to_rfc3339());
    fs::write(&rp, serde_json::to_vec_pretty(&rec)?)?;
    export()?;
    fs::write(pp, "")
}
fn binding(remove: bool) -> io::Result<()> {
    let p = if cfg!(windows) {
        PathBuf::from(env::var("APPDATA").unwrap()).join("herdr/config.toml")
    } else {
        PathBuf::from(env::var("HOME").unwrap()).join(".config/herdr/config.toml")
    };
    let old = fs::read_to_string(&p).unwrap_or_default();
    let new = if remove {
        old.replace(&format!("\n\n{BLOCK}\n"), "\n")
    } else if old.contains("herdr-replay.toggle") {
        old.clone()
    } else if old.contains("key = \"prefix+f\"") {
        return Err(io::Error::other("prefix+f is already assigned"));
    } else {
        format!("{}\n\n{BLOCK}\n", old.trim_end())
    };
    if new != old {
        fs::create_dir_all(p.parent().unwrap())?;
        fs::write(p, new)
    } else {
        Ok(())
    }
}
fn main() -> ExitCode {
    let cmd = env::args().nth(1).unwrap_or_else(|| "status".into());
    let result = (|| -> io::Result<()> {
        fs::create_dir_all(dir())?;
        match cmd.as_str() {
            "install" => binding(false),
            "remove-keybinding" => binding(true),
            "recorder" => recorder(),
            "start" | "toggle" if !alive(pid()) => {
                let child = spawn_recorder()?;
                fs::write(paths().0, child.id().to_string())?;
                println!("Recording started (PID {}).", child.id());
                Ok(())
            }
            "stop" | "toggle" => {
                terminate(pid())?;
                thread::sleep(Duration::from_secs(2));
                export()?;
                println!("Recording stopped. Replay: {}", paths().2.display());
                Ok(())
            }
            "export" => export(),
            "open" => {
                if cfg!(windows) {
                    Command::new("cmd")
                        .args(["/c", "start", "", paths().2.to_str().unwrap()])
                        .spawn()?;
                } else {
                    Command::new(if cfg!(target_os = "macos") {
                        "open"
                    } else {
                        "xdg-open"
                    })
                    .arg(paths().2)
                    .spawn()?;
                }
                Ok(())
            }
            "show" => {
                let r =
                    fs::read_to_string(paths().1).unwrap_or_else(|_| "No recording yet.".into());
                println!("HERDR REPLAY\n\n{}\n\nPress Enter to close…", r);
                let _ = io::stdin().read(&mut [0]);
                Ok(())
            }
            _ => {
                println!(
                    "{}",
                    if alive(pid()) {
                        "Recording is active."
                    } else {
                        "Replay is idle."
                    }
                );
                Ok(())
            }
        }
    })();
    match result {
        Ok(_) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn secrets() {
        assert!(!redact("Bearer abc.def api_key=nope").contains("abc.def"))
    }
    #[test]
    fn page() {
        assert!(html(&json!({"events":[],"agents":[]})).contains("type=range"))
    }
}
