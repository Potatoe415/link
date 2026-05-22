use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{State, Manager};
use scraper::{Html, Selector};
use reqwest::header::{USER_AGENT, ACCEPT_LANGUAGE};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TorrentResult {
    pub title: String,
    #[serde(rename = "magnetUrl")]
    pub magnet_url: String,
    pub size: String,
    pub seeders: i32,
    pub source: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Selectors {
    pub row: String,
    pub title: String,
    pub magnet: String,
    pub size: String,
    pub seeders: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct JsonMapping {
    pub root_array: String,
    pub title: String,
    pub info_hash: String,
    pub size: String,
    pub seeders: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Indexer {
    pub name: String,
    pub enabled: bool,
    pub format: String,
    pub search_url: String,
    pub selectors: Option<Selectors>,
    pub json_mapping: Option<JsonMapping>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub version: String,
    pub indexers: Vec<Indexer>,
}

pub struct AppState {
    pub config: Mutex<Config>,
}

const FALLBACK_CONFIG: &str = r#"
{
  "version": "1.0.0",
  "indexers": [
    {
      "name": "Apibay (ThePirateBay API)",
      "enabled": true,
      "format": "json",
      "search_url": "https://apibay.org/q.php?q={query}",
      "json_mapping": {
        "root_array": "",
        "title": "name",
        "info_hash": "info_hash",
        "size": "size",
        "seeders": "seeders"
      }
    },
    {
      "name": "LimeTorrents (HTML Scraping)",
      "enabled": true,
      "format": "html",
      "search_url": "https://www.limetorrents.to/search/all/{query}/",
      "selectors": {
        "row": "table.table2 tr.table-toggle",
        "title": "div.tt-name a:nth-child(2)",
        "magnet": "td.tdnormal:nth-of-type(3) a.csbuttons[href^='magnet:']",
        "size": "td.tdnormal:nth-of-type(2)",
        "seeders": "td.tdseed"
      }
    }
  ]
}
"#;

#[tauri::command]
pub async fn search_torrents(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<TorrentResult>, String> {
    let config = state.config.lock().unwrap().clone();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut all_results = Vec::new();
    let encoded_query = urlencoding::encode(&query);

    for indexer in config.indexers {
        if !indexer.enabled {
            continue;
        }

        let url = indexer.search_url.replace("{query}", &encoded_query);
        
        let response = client
            .get(&url)
            .header(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header(ACCEPT_LANGUAGE, "en-US,en;q=0.9")
            .send()
            .await;

        match response {
            Ok(resp) => {
                if indexer.format == "json" {
                    if let Ok(results) = handle_json_indexer(resp, &indexer).await {
                        all_results.extend(results);
                    }
                } else if indexer.format == "html" {
                    if let Ok(body) = resp.text().await {
                        if let Ok(results) = handle_html_indexer(&body, &indexer) {
                            all_results.extend(results);
                        }
                    }
                }
            }
            Err(e) => eprintln!("Error fetching from {}: {}", indexer.name, e),
        }
    }

    Ok(all_results)
}

async fn handle_json_indexer(resp: reqwest::Response, indexer: &Indexer) -> Result<Vec<TorrentResult>, String> {
    let mapping = indexer.json_mapping.as_ref().ok_or("No JSON mapping")?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let items = if mapping.root_array.is_empty() {
        data.as_array().ok_or("Expected array at root")?
    } else {
        data.pointer(&mapping.root_array).and_then(|v| v.as_array()).ok_or("Expected array at pointer")?
    };

    let mut results = Vec::new();
    for item in items {
        let title = item.get(&mapping.title).and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let info_hash = item.get(&mapping.info_hash).and_then(|v| v.as_str()).unwrap_or("");
        
        let size_val = item.get(&mapping.size).unwrap_or(&serde_json::Value::String("0".to_string())).clone();
        let seeders_val = item.get(&mapping.seeders).unwrap_or(&serde_json::Value::String("0".to_string())).clone();

        if info_hash.is_empty() { continue; }

        let magnet_url = format!("magnet:?xt=urn:btih:{}&dn={}", info_hash, urlencoding::encode(&title));
        
        let seeders = if let Some(s) = seeders_val.as_str() {
            s.parse::<i32>().unwrap_or(0)
        } else {
            seeders_val.as_i64().unwrap_or(0) as i32
        };
        
        let size_bytes = if let Some(s) = size_val.as_str() {
            s.parse::<u64>().unwrap_or(0)
        } else {
            size_val.as_u64().unwrap_or(0)
        };

        results.push(TorrentResult {
            title,
            magnet_url,
            size: format_size(size_bytes),
            seeders,
            source: indexer.name.clone(),
        });
    }

    Ok(results)
}

fn handle_html_indexer(body: &str, indexer: &Indexer) -> Result<Vec<TorrentResult>, String> {
    let selectors = indexer.selectors.as_ref().ok_or("No HTML selectors")?;
    let document = Html::parse_document(body);
    
    let row_selector = Selector::parse(&selectors.row).map_err(|_| "Invalid row selector")?;
    let title_selector = Selector::parse(&selectors.title).map_err(|_| "Invalid title selector")?;
    let magnet_selector = Selector::parse(&selectors.magnet).map_err(|_| "Invalid magnet selector")?;
    let size_selector = Selector::parse(&selectors.size).map_err(|_| "Invalid size selector")?;
    let seeders_selector = Selector::parse(&selectors.seeders).map_err(|_| "Invalid seeders selector")?;

    let mut results = Vec::new();
    for row in document.select(&row_selector) {
        let title = row.select(&title_selector).next().map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
        let magnet_url = row.select(&magnet_selector).next().and_then(|e| e.value().attr("href")).map(|s| s.to_string()).unwrap_or_default();
        let size = row.select(&size_selector).next().map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
        let seeders_text = row.select(&seeders_selector).next().map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
        
        if title.is_empty() || magnet_url.is_empty() { continue; }

        let seeders = seeders_text.parse::<i32>().unwrap_or(0);

        results.push(TorrentResult {
            title,
            magnet_url,
            size,
            seeders,
            source: indexer.name.clone(),
        });
    }

    Ok(results)
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub async fn load_config() -> Config {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap();

    // Try local dev server first as requested by user (port 3003)
    let url = "http://localhost:3003/config.json";
    
    match client.get(url).send().await {
        Ok(resp) => {
            if let Ok(config) = resp.json::<Config>().await {
                return config;
            }
        }
        Err(_) => {}
    }

    serde_json::from_str(FALLBACK_CONFIG).expect("Fallback config should be valid")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Load config synchronously during setup to ensure AppState is available for commands
            let config = tauri::async_runtime::block_on(load_config());
            app.manage(AppState {
                config: Mutex::new(config),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![search_torrents])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
