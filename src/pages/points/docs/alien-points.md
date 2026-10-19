---
title: 'ALIEN Points'
description: 'How the ALIEN points program works, how points are calculated, and when you get them.'
---

# ALIEN Points

ALIEN points are the rewards program of Fermi Trade. You get points when you supply liquidity or trade on Fermi.

This page tells you:

- what gives points,
- how many points Fermi releases each week,
- how Fermi calculates your share,
- when your points become final.

Fermi publishes all rules and parameters on this page before the season starts.

> **Status:** Draft. The values on this page can change before the season starts. Fermi publishes all changes in advance. Refer to [Changes to the rules](#changes-to-the-rules).

## Terms

This page uses the terms that follow. Each term has one meaning only.

| Term               | Meaning                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Season 1           | The first ALIEN period: 26 epochs, from 1 November 2026 to 2 May 2027.                                       |
| Pre-deposit period | 20 October 2026 to 1 November 2026. Only FLP vault deposits get points in this period.                       |
| Epoch              | One week of activity. An epoch closes each Sunday at 00:00 UTC.                                              |
| Wallet             | One Solana wallet address. Fermi calculates points for each wallet.                                          |
| Pool               | The number of points for one category in one epoch.                                                          |
| Score              | The measure of the activity of a wallet in one category in one epoch.                                        |
| Qualified volume   | Traded notional that passes the fair-play rules. Taker notional counts at 1.0. Maker notional counts at 0.5. |
| Floor              | The guaranteed part of each epoch's points.                                                                  |
| Curve              | The part of each epoch's points that changes with qualified volume.                                          |
| Provisional points | Points that Fermi can still review.                                                                          |
| Final points       | Points that Fermi cannot change.                                                                             |

## Key dates

| Date (00:00 UTC) | Event                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| 20 October 2026  | The pre-deposit period starts. FLP vault deposits start to get points.  |
| 1 November 2026  | Season 1, epoch 1 starts. All categories start to get points.           |
| Each Sunday      | The epoch closes. Provisional points are available in 48 hours or less. |
| 2 May 2027       | Season 1 ends after epoch 26.                                           |

## Activities that give points

Five categories give points.

| Category      | Fermi measures                                                                 | Starts          |
| ------------- | ------------------------------------------------------------------------------ | --------------- |
| FLP vault     | The USD value you deposit in the FLP vault, multiplied by the time you hold it | 20 October 2026 |
| Resting depth | Your two-sided resting orders near the mid price                               | 1 November 2026 |
| Volume        | Your qualified volume                                                          | 1 November 2026 |
| Open interest | Your net open position, measured each hour                                     | 1 November 2026 |
| Referrals     | The points of the wallets that you referred                                    | 1 November 2026 |

Fermi divides each category pool among all wallets. The share of a wallet is equal to its score divided by the total score of all wallets in that category.

You do not have to claim points. Fermi adds them to your wallet automatically.

## How many points Fermi releases

Each epoch has two sources of points: the floor and the curve.

![Weekly points emitted in three growth paths. The floor decreases from 50k to 20k points. The curve adds points as qualified volume increases.](images/alien-weekly-emissions.webp)

_Figure 1. Weekly points in three illustrative growth paths. These paths are examples, not forecasts._

### The floor

The floor is guaranteed. Fermi releases the floor in each epoch, also when volume is low. All floor points go to liquidity: the FLP vault and resting depth.

The floor decreases by the same quantity each epoch:

```
Floor(w) = 50,000 − 30,000 × (w − 1) / 25        w = epoch number, 1 to 26
```

- Epoch 1: 50,000 points.
- Epoch 26: 20,000 points.
- Season 1 total: 910,000 points.

### The curve

The curve is conditional. It releases points only when qualified volume occurs.

The curve uses cumulative qualified volume, X. X is the total qualified volume from 1 November 2026 to the given time.

```
P(X) = 3,600,000 × (1 − e^(−X / 12,000,000,000))

Curve pool(w) = P(X at the end of epoch w) − P(X at the start of epoch w)

Rate(X) = 300 × e^(−X / 12,000,000,000)        points for each $1M of qualified volume
```

The curve has these properties:

- The curve cannot release more than 3,600,000 points in total.
- At the start, the rate is 300 points for each $1M of qualified volume.
- The rate decreases by 50% for each $8.3B of cumulative qualified volume.
- Fermi publishes the current rate in each epoch. Thus you know the rate before you trade.

![The curve rate decreases from 300 points per $1M. It decreases by 50% for each $8.3B of cumulative qualified volume.](images/alien-curve-rate.webp)

_Figure 2. The curve rate for each $1M of qualified volume. Early activity gets more points for each dollar._

### The pre-deposit pool

The pre-deposit pool is 250,000 points. Fermi divides it among FLP vault deposits made in the pre-deposit period. The share of a wallet is equal to its USD deposit multiplied by the time it holds the deposit.

### The discretionary reserve

Fermi keeps a reserve of 500,000 points or less. Fermi uses the reserve only for special events, for example to compensate users after an outage. Fermi announces each use of the reserve, with the reason and the quantity.

### Season maximum

Season 1 cannot release more than 5,260,000 points.

| Source                | Maximum points |
| --------------------- | -------------- |
| Floor                 | 910,000        |
| Curve                 | 3,600,000      |
| Pre-deposit pool      | 250,000        |
| Discretionary reserve | 500,000        |
| **Total**             | **5,260,000**  |

## How Fermi divides each epoch

### Division between categories

| Category                                | Share of the floor | Share of the curve |
| --------------------------------------- | ------------------ | ------------------ |
| Liquidity (FLP vault and resting depth) | 100%               | 20%                |
| Volume                                  | 0%                 | 37.5%              |
| Open interest                           | 0%                 | 37.5%              |
| Referrals                               | 0%                 | 5%                 |

### Division of liquidity points

Fermi divides liquidity points between the FLP vault and resting depth. The FLP vault share decreases by the same quantity each epoch:

```
FLP vault share(w)     = 70% − 45% × (w − 1) / 25
Resting depth share(w) = 100% − FLP vault share(w)
```

| Epoch | FLP vault | Resting depth |
| ----- | --------- | ------------- |
| 1     | 70.0%     | 30.0%         |
| 7     | 59.2%     | 40.8%         |
| 13    | 48.4%     | 51.6%         |
| 20    | 35.8%     | 64.2%         |
| 26    | 25.0%     | 75.0%         |

### Change of the mix over time

The floor decreases. The curve increases when qualified volume increases. Thus the mix moves from liquidity to trading as Fermi grows.

![Stacked area chart of weekly points by category in the Base growth path. FLP vault and resting depth are largest at the start. Volume and open interest become largest after epoch 13.](images/alien-category-mix.webp)

_Figure 3. Points by category in the illustrative Base growth path._

In the Base growth path, the mix is:

| Epoch | FLP vault | Resting depth | Volume | Open interest | Referrals |
| ----- | --------- | ------------- | ------ | ------------- | --------- |
| 1     | 58.4%     | 25.0%         | 7.8%   | 7.8%          | 1.0%      |
| 8     | 38.7%     | 28.7%         | 15.3%  | 15.3%         | 2.0%      |
| 13    | 24.9%     | 26.5%         | 22.8%  | 22.8%         | 3.0%      |
| 26    | 7.3%      | 21.8%         | 33.3%  | 33.3%         | 4.4%      |

The real mix depends on real qualified volume.

## Scoring rules

Fermi calculates all scores for each wallet.

### FLP vault

1. Fermi multiplies the USD deposit of a wallet by the number of seconds the wallet holds it in the epoch. This value is the score.
2. If a wallet withdraws a deposit in 7 days or less after the deposit, the wallet loses the points from that deposit.

### Resting depth

Fermi measures resting depth with snapshots of the order book.

- **Snapshot times.** Fermi takes approximately 1,440 snapshots each day. The snapshot times come from a seed that Fermi publishes after the epoch closes. Thus makers cannot know the snapshot times in advance.
- **Minimum age.** An order counts only if it was on the book for 5 seconds or more before the snapshot.
- **Distance from the mid price.** Fermi multiplies the notional of each order by a weight. The weight depends on the distance of the order from the mid price.

  | Distance from mid (BTC, ETH, SOL) | Distance from mid (other markets) | Weight |
  | --------------------------------- | --------------------------------- | ------ |
  | 2 bps or less                     | 4 bps or less                     | 1.00   |
  | 5 bps or less                     | 10 bps or less                    | 0.50   |
  | 10 bps or less                    | 20 bps or less                    | 0.25   |
  | 25 bps or less                    | 50 bps or less                    | 0.10   |

- **Cap.** Fermi counts a maximum notional for each wallet, side and distance band: $250,000 on BTC, ETH and SOL, and $50,000 on other markets.
- **Two sides.** Each snapshot score is `2 × Bid × Ask / (Bid + Ask)`. Bid and Ask are the weighted notional on each side. If one side has no orders, the snapshot score is zero.
- **Epoch score.** The epoch score is `average snapshot score × uptime^1.5 × (1 − fade ratio)`.
  - Uptime is the percentage of snapshots in which the wallet had orders on the two sides.
  - Fade ratio is the percentage of top-of-book orders of the wallet that it cancelled 500 ms or less before an opposite order arrived.
- **Markets.** BTC, ETH and SOL get 60% of the resting depth pool. Fermi divides the remaining 40% with a market weight table. Fermi publishes this table before each epoch.
- **Exclusion.** Market makers with a direct liquidity agreement with Fermi do not get resting depth points. Their agreement pays them.

### Volume

1. Fermi calculates the qualified volume of the wallet: taker notional × 1.0 + maker notional × 0.5.
2. Fermi applies a size multiplier. The multiplier depends on the average daily qualified volume of the wallet over the last 30 days.

| Average daily qualified volume (30 days) | Multiplier |
| ---------------------------------------- | ---------- |
| Less than $10M                           | 1.00       |
| $10M or more                             | 1.10       |
| $100M or more                            | 1.25       |

The multiplier changes the share of the wallet in the volume pool. It does not increase the volume pool.

### Open interest

1. Each hour, Fermi measures the absolute net position of the wallet in each market.
2. Fermi adds these hourly values for the epoch. This sum is the score.
3. Fermi does not count positions that are open for less than 1 hour.
4. Fermi does not count open interest above 5 times the account equity of the wallet.

### Referrals

- When you refer a wallet, you get 10% of the points of that wallet. Fermi calculates this after the fair-play rules.
- The referred wallet gets 5% more points.
- These points come from the referral pool. They do not come from other categories.
- If the referral claims are more than the referral pool, Fermi decreases all claims by the same percentage.
- If part of the referral pool is not used, Fermi adds it to the other categories in the same epoch.
- To get referral points, your wallet must also trade or supply liquidity.
- A wallet cannot refer itself.

## Weekly cycle

1. The epoch closes on Sunday at 00:00 UTC.
2. In 48 hours or less, Fermi publishes the provisional points, the curve rate and the pool sizes.
3. For 14 days, the points stay provisional. In this period, Fermi can review them and you can appeal.
4. After 14 days, the points become final.
5. Fermi adds removed points to the pools of the next epoch. All wallets share them.

## Fair-play rules

The activities that follow do not get points. If Fermi finds points from these activities, Fermi removes the points.

| Activity       | Description                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Self-trading   | A trade in which the same wallet is on the two sides. The Fermi matching engine also prevents self-matching.      |
| Wash trading   | Trades that wallets make only to increase volume. This includes round trips with a net PnL near zero before fees. |
| Sybil activity | Use of many wallets to get rewards that are not proportional to real activity.                                    |
| Spoofing       | Orders that a wallet places only for the snapshots, or that it cancels just before a fill.                        |

Fermi uses proprietary anti-sybil and anti-abuse checks. Fermi does not publish the methods or the thresholds of these checks. If Fermi published them, abusers could avoid them. Fermi publishes the rules on this page, the total of removed points in each epoch, and the appeal procedure.

## Start to get points

1. Go to [app.fermi.trade](https://app.fermi.trade).
2. Connect your Solana wallet.
3. Deposit USDC in the FLP vault. Deposits made from 20 October 2026 share the pre-deposit pool.
4. From 1 November 2026, trade or place resting orders to get points in the other categories.
5. Monitor your points on the points page after each epoch closes.

## Parameter reference

| Parameter                           | Value                                                          |
| ----------------------------------- | -------------------------------------------------------------- |
| Pre-deposit period                  | 20 October 2026 to 1 November 2026                             |
| Season 1                            | 1 November 2026 to 2 May 2027 (26 epochs)                      |
| Epoch close                         | Sunday, 00:00 UTC                                              |
| Points unit                         | Each wallet                                                    |
| Floor                               | 50,000 to 20,000 points for each epoch                         |
| Curve maximum (Pmax)                | 3,600,000 points                                               |
| Curve scale (Xs)                    | $12,000,000,000 of cumulative qualified volume                 |
| Curve rate at start                 | 300 points for each $1M                                        |
| Curve division                      | 20% liquidity, 37.5% volume, 37.5% open interest, 5% referrals |
| FLP vault share of liquidity        | 70% to 25%, linear over 26 epochs                              |
| Pre-deposit pool                    | 250,000 points                                                 |
| Discretionary reserve               | 500,000 points or less                                         |
| Season maximum                      | 5,260,000 points                                               |
| Minimum order age for snapshots     | 5 seconds                                                      |
| Uptime exponent                     | 1.5                                                            |
| Fade window                         | 500 ms                                                         |
| Maker volume weight                 | 0.5                                                            |
| Size multipliers                    | 1.10 at $10M each day, 1.25 at $100M each day                  |
| Minimum open interest time          | 1 hour                                                         |
| Open interest cap                   | 5 × account equity                                             |
| FLP vault minimum hold              | 7 days                                                         |
| Referrer share and referee increase | 10% and 5%                                                     |
| Provisional period                  | 14 days                                                        |

## Changes to the rules

Fermi can change the parameters on this page. If Fermi changes a parameter:

- Fermi publishes the change one full epoch or more before it starts.
- The change does not apply to past epochs.

## Questions

**Can I change ALIEN points to a token?**
Fermi has not announced a token or a conversion. ALIEN points record your contribution to Fermi.

**Can I lose points?**
You can lose provisional points if they come from activity that breaks the fair-play rules. You can appeal in the 14-day provisional period. Final points do not change.

**Why do I get fewer points for each dollar over time?**
The curve rate decreases when cumulative qualified volume increases. Thus early activity gets more points. Also, total points stay in proportion to the size of Fermi.

**I use more than one wallet. Do my points combine?**
No. Fermi calculates points for each wallet separately.

**Do I get points if I trade through a market maker agreement?**
Market makers with a direct liquidity agreement do not get resting depth points. They can get points in the other categories.
