// fermi_mm_bot.rs
// A minimal passive LP market‑making bot for Fermi DEX implementing an Avellaneda–Stoikov quoting
// strategy with inventory‑band hedging.
//
// ────────────────────────────────────────────────────────────────────────────────
// HOW TO USE
// 1. Create a `.env` file (or export env vars) with:
//      FERMI_API_KEY=your_key_here
//      FERMI_API_SECRET=your_secret_here
// 2. `cargo run --release -- --symbol SOL/USDC` (see CLI flags below).
// 3. The bot refreshes every 2s, cancelling previous quotes and posting new ones.
//    It hedges if inventory exceeds ±BAND_PCT of NAV.
//
// Disclaimer: For educational purposes only.  Test on a sandbox before mainnet.
// ────────────────────────────────────────────────────────────────────────────────

use std::env;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
use reqwest::{header, Client};
use serde::Deserialize;
use tokio::time::sleep;

// ============ Config & CLI ============
#[derive(Parser, Debug)]
#[command(author, version, about)]
struct Cli {
    /// Trading pair symbol (e.g., "SOL/USDC")
    #[arg(short, long)]
    symbol: String,

    /// Risk‑aversion gamma (default 0.05)
    #[arg(long, default_value_t = 0.05)]
    gamma: f64,

    /// Refresh interval in milliseconds
    #[arg(long, default_value_t = 2000)]
    refresh_ms: u64,

    /// Inventory band as percentage of NAV (e.g., 0.03 = 3 %)
    #[arg(long, default_value_t = 0.03)]
    band: f64,
}

// ============ REST DTOs ============
#[derive(Debug, Deserialize)]
struct Trade {
    price: f64,
    size: f64,
    side: String,
    ts: i64, // unix milli
}

#[derive(Debug, Deserialize)]
struct Balance {
    asset: String,
    available: f64,
    locked: f64,
}

// Replace with real endpoints once Fermi publishes swagger
const API_HOST: &str = "https://api.fermi.exchange";

// ============ Bot ============
struct Bot {
    http: Client,
    key: String,
    secret: String,
    cfg: Cli,
}

impl Bot {
    fn new(cfg: Cli) -> Result<Self> {
        let key = env::var("FERMI_API_KEY").map_err(|_| anyhow!("set FERMI_API_KEY"))?;
        let secret = env::var("FERMI_API_SECRET").map_err(|_| anyhow!("set FERMI_API_SECRET"))?;

        let mut headers = header::HeaderMap::new();
        headers.insert("FERMI-API-KEY", key.parse()?);
        // signature header added per‑request

        Ok(Self {
            http: Client::builder().default_headers(headers).build()?,
            key,
            secret,
            cfg,
        })
    }

    async fn run(&self) -> Result<()> {
        let mut last_cancel_ids: Vec<String> = Vec::new();

        loop {
            let start = Instant::now();

            let trades = self.fetch_recent_trades().await?;
            let mid = compute_mid_price(&trades);
            let sigma = compute_volatility(&trades);
            let k = (trades.len() as f64 / 60.0).max(1e-6); // crude arrival intensity per sec

            let (inv_base, inv_quote) = self.fetch_inventory().await?;
            let nav = inv_quote + inv_base * mid;
            let q = inv_base; // position in base asset

            let reservation = mid - q * self.cfg.gamma * sigma.powi(2);
            let spread = self.cfg.gamma * sigma.powi(2) + (2.0 / self.cfg.gamma) * ((1.0 + self.cfg.gamma / k).ln());
            let bid = (reservation - spread / 2.0).max(0.0);
            let ask = reservation + spread / 2.0;

            // Cancel previous quotes
            for oid in &last_cancel_ids {
                let _ = self.cancel_order(oid).await;
            }
            last_cancel_ids.clear();

            // Place new quotes equal size S
            let size = (0.5 * nav * self.cfg.gamma / mid).max(0.0001);
            let bid_id = self.place_limit_order("buy", bid, size).await?;
            let ask_id = self.place_limit_order("sell", ask, size).await?;
            last_cancel_ids.push(bid_id);
            last_cancel_ids.push(ask_id);

            // Hedge if inventory > band
            let band_qty = self.cfg.band * nav / mid;
            if q.abs() > band_qty {
                let side = if q > 0.0 { "sell" } else { "buy" };
                let hedge_qty = q.abs() - band_qty;
                let _ = self.place_market_order(side, hedge_qty).await?;
            }

            // Sleep remainder of interval
            let elapsed = start.elapsed();
            if elapsed < Duration::from_millis(self.cfg.refresh_ms) {
                sleep(Duration::from_millis(self.cfg.refresh_ms) - elapsed).await;
            }
        }
    }

    // ============ HTTP helpers (stubbed) ============
    async fn fetch_recent_trades(&self) -> Result<Vec<Trade>> {
        let url = format!("{API_HOST}/trades?symbol={}&limit=200", self.cfg.symbol);
        let res = self.http.get(url).send().await?.json::<Vec<Trade>>().await?;
        Ok(res)
    }

    async fn fetch_inventory(&self) -> Result<(f64, f64)> {
        let url = format!("{API_HOST}/balance");
        let res = self.http.get(url).send().await?.json::<Vec<Balance>>().await?;
        let base = self
            .cfg
            .symbol
            .split('/')
            .next()
            .unwrap()
            .to_string();
        let quote = self.cfg.symbol.split('/').nth(1).unwrap().to_string();

        let mut inv_base = 0.0;
        let mut inv_quote = 0.0;
        for b in res {
            if b.asset == base {
                inv_base = b.available + b.locked;
            } else if b.asset == quote {
                inv_quote = b.available + b.locked;
            }
        }
        Ok((inv_base, inv_quote))
    }

    async fn cancel_order(&self, order_id: &str) -> Result<()> {
        let url = format!("{API_HOST}/orders/{order_id}/cancel");
        self.http.delete(url).send().await?;
        Ok(())
    }

    async fn place_limit_order(&self, side: &str, price: f64, size: f64) -> Result<String> {
        let url = format!("{API_HOST}/orders/new");
        let body = serde_json::json!({
            "symbol": self.cfg.symbol,
            "side": side,
            "type": "limit",
            "price": price,
            "size": size,
            "post_only": true
        });
        let res = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
        Ok(res["order_id"].as_str().unwrap_or_default().to_string())
    }

    async fn place_market_order(&self, side: &str, size: f64) -> Result<String> {
        let url = format!("{API_HOST}/orders/new");
        let body = serde_json::json!({
            "symbol": self.cfg.symbol,
            "side": side,
            "type": "market",
            "size": size
        });
        let res = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
        Ok(res["order_id"].as_str().unwrap_or_default().to_string())
    }
}

// ============ Analytics helpers ============
fn compute_mid_price(trades: &[Trade]) -> f64 {
    let sum_px: f64 = trades.iter().map(|t| t.price).sum();
    sum_px / trades.len() as f64
}

fn compute_volatility(trades: &[Trade]) -> f64 {
    if trades.len() < 2 {
        return 0.0;
    }
    let mut returns = Vec::with_capacity(trades.len() - 1);
    for w in trades.windows(2) {
        let r = (w[1].price / w[0].price).ln();
        returns.push(r);
    }
    let mean: f64 = returns.iter().copied().sum::<f64>() / returns.len() as f64;
    let var: f64 = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
    var.sqrt() * (returns.len() as f64).sqrt() // annualised factor not needed for short horizon
}

// ============ Entrypoint ============
#[tokio::main]
async fn main() -> Result<()> {
    let cfg = Cli::parse();
    let bot = Bot::new(cfg)?;
    bot.run().await
}
