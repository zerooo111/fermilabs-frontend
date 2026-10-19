---
title: 'ALIEN Points'
description: 'How the ALIEN points program works, how points are calculated, and how to verify your balance.'
---

# ALIEN Points

ALIEN points are the rewards program of Fermi Trade. You get points when you supply liquidity or trade on Fermi.

This page tells you:

- what gives points,
- how many points Fermi releases each week,
- how Fermi calculates your share,
- how to verify your balance.

All rules and parameters on this page are fixed before the season starts. An open-source scorer applies them to on-chain data. Anyone can use the same data to calculate the points of any account.

> **Status:** Draft. The values on this page can change before the season starts. Fermi publishes all changes in advance. Refer to [Changes to the rules](#changes-to-the-rules).

## Terms

This page uses the terms that follow. Each term has one meaning only.

| Term               | Meaning                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Season 1           | The first ALIEN period: 52 epochs, from 1 November 2026 to 31 October 2027.                                     |
| Pre-deposit period | 15 October 2026 to 1 November 2026. Only FLP vault deposits get points in this period.                          |
| Epoch              | One week of activity. An epoch closes each Sunday at 00:00 UTC.                                                 |
| Pool               | The number of points for one category in one epoch.                                                             |
| Score              | The measure of your activity in one category in one epoch.                                                      |
| Owner              | One participant. An owner can control more than one wallet. Fermi counts all wallets of one owner as one owner. |
| Qualified volume   | Traded notional that passes the fair-play rules. Taker notional counts at 1.0. Maker notional counts at 0.5.    |
| Floor              | The guaranteed part of each epoch's points.                                                                     |
| Curve              | The part of each epoch's points that changes with qualified volume.                                             |
| Provisional points | Points that Fermi can still review.                                                                             |
| Final points       | Points that Fermi cannot change.                                                                                |

## Key dates

| Date (00:00 UTC) | Event                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| 15 October 2026  | The pre-deposit period starts. FLP vault deposits start to get points.  |
| 1 November 2026  | Season 1, epoch 1 starts. All categories start to get points.           |
| Each Sunday      | The epoch closes. Provisional points are available in 48 hours or less. |
| 31 October 2027  | Season 1 ends after epoch 52.                                           |

## Activities that give points

Five categories give points.

| Category      | Fermi measures                                                                 | Starts          |
| ------------- | ------------------------------------------------------------------------------ | --------------- |
| FLP vault     | The USD value you deposit in the FLP vault, multiplied by the time you hold it | 15 October 2026 |
| Resting depth | Your two-sided resting orders near the mid price                               | 1 November 2026 |
| Volume        | Your qualified volume                                                          | 1 November 2026 |
| Open interest | Your net open position, measured each hour                                     | 1 November 2026 |
| Referrals     | The points of the accounts that you referred                                   | 1 November 2026 |

Fermi divides each category pool among all participants. Your share is equal to your score divided by the total score of all participants in that category.

You do not have to claim points. Fermi adds them to your account automatically.

## How many points Fermi releases

Each epoch has two sources of points: the floor and the curve.

![Weekly points emitted in three growth paths. The floor decreases from 500k to 200k points. The curve adds points as qualified volume increases.](images/alien-weekly-emissions.webp)

_Figure 1. Weekly points in three illustrative growth paths. These paths are examples, not forecasts._

### The floor

The floor is guaranteed. Fermi releases the floor in each epoch, also when volume is low. All floor points go to liquidity: the FLP vault and resting depth.

The floor decreases by the same quantity each epoch:

```
Floor(w) = 500,000 − 300,000 × (w − 1) / 51        w = epoch number, 1 to 52
```

- Epoch 1: 500,000 points.
- Epoch 52: 200,000 points.
- Season 1 total: 18,200,000 points.

### The curve

The curve is conditional. It releases points only when qualified volume occurs.

The curve uses cumulative qualified volume, X. X is the total qualified volume from 1 November 2026 to the given time.

```
P(X) = 100,000,000 × (1 − e^(−X / 32,000,000,000))

Curve pool(w) = P(X at the end of epoch w) − P(X at the start of epoch w)

Rate(X) = 3,125 × e^(−X / 32,000,000,000)        points for each $1M of qualified volume
```

The curve has these properties:

- The curve cannot release more than 100,000,000 points in total.
- At the start, the rate is 3,125 points for each $1M of qualified volume.
- The rate decreases by 50% for each $22.2B of cumulative qualified volume.
- Fermi publishes the current rate in each epoch. Thus you know the rate before you trade.

![The curve rate decreases from 3,125 points per $1M. It decreases by 50% for each $22.2B of cumulative qualified volume.](images/alien-curve-rate.webp)

_Figure 2. The curve rate for each $1M of qualified volume. Early activity gets more points for each dollar._

### The pre-deposit pool

The pre-deposit pool is 1,000,000 points. Fermi divides it among FLP vault deposits made in the pre-deposit period. Your share is equal to your USD deposit multiplied by the time you hold it.

### The discretionary reserve

Fermi keeps a reserve of 5,000,000 points or less. Fermi uses the reserve only for special events, for example to compensate users after an outage. Fermi announces each use of the reserve, with the reason and the quantity.

### Season maximum

Season 1 cannot release more than 124,200,000 points.

| Source                | Maximum points  |
| --------------------- | --------------- |
| Floor                 | 18,200,000      |
| Curve                 | 100,000,000     |
| Pre-deposit pool      | 1,000,000       |
| Discretionary reserve | 5,000,000       |
| **Total**             | **124,200,000** |

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
FLP vault share(w)     = 70% − 45% × (w − 1) / 51
Resting depth share(w) = 100% − FLP vault share(w)
```

| Epoch | FLP vault | Resting depth |
| ----- | --------- | ------------- |
| 1     | 70.0%     | 30.0%         |
| 13    | 59.4%     | 40.6%         |
| 26    | 47.9%     | 52.1%         |
| 39    | 36.5%     | 63.5%         |
| 52    | 25.0%     | 75.0%         |

### Change of the mix over time

The floor decreases. The curve increases when qualified volume increases. Thus the mix moves from liquidity to trading as Fermi grows.

![Stacked area chart of weekly points by category in the Base growth path. FLP vault and resting depth are largest at the start. Volume and open interest become largest after epoch 13.](images/alien-category-mix.webp)

_Figure 3. Points by category in the illustrative Base growth path._

In the Base growth path, the mix is:

| Epoch | FLP vault | Resting depth | Volume | Open interest | Referrals |
| ----- | --------- | ------------- | ------ | ------------- | --------- |
| 1     | 58.0%     | 24.8%         | 8.1%   | 8.1%          | 1.1%      |
| 8     | 43.4%     | 24.6%         | 15.0%  | 15.0%         | 2.0%      |
| 26    | 14.3%     | 15.5%         | 32.9%  | 32.9%         | 4.4%      |
| 52    | 7.9%      | 23.8%         | 32.0%  | 32.0%         | 4.3%      |

The real mix depends on real qualified volume.

## Scoring rules

### FLP vault

1. Fermi multiplies your USD deposit by the number of seconds you hold it in the epoch. This value is your score.
2. If you withdraw a deposit in 7 days or less after you made it, you lose the points from that deposit.

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

- **Cap.** Fermi counts a maximum notional for each account, side and distance band: $250,000 on BTC, ETH and SOL, and $50,000 on other markets.
- **Two sides.** Each snapshot score is `2 × Bid × Ask / (Bid + Ask)`. Bid and Ask are the weighted notional on each side. If one side has no orders, the snapshot score is zero.
- **Epoch score.** Your epoch score is `average snapshot score × uptime^1.5 × (1 − fade ratio)`.
  - Uptime is the percentage of snapshots in which you had orders on the two sides.
  - Fade ratio is the percentage of your top-of-book orders that you cancelled 500 ms or less before an opposite order arrived.
- **Markets.** BTC, ETH and SOL get 60% of the resting depth pool. Fermi divides the remaining 40% with a market weight table. Fermi publishes this table before each epoch.
- **Exclusion.** Market makers with a direct liquidity agreement with Fermi do not get resting depth points. Their agreement pays them.

### Volume

1. Fermi calculates your qualified volume: taker notional × 1.0 + maker notional × 0.5.
2. Fermi applies a size multiplier. The multiplier depends on your average daily qualified volume over the last 30 days.

| Average daily qualified volume (30 days) | Multiplier |
| ---------------------------------------- | ---------- |
| Less than $10M                           | 1.00       |
| $10M or more                             | 1.10       |
| $100M or more                            | 1.25       |

The multiplier changes your share of the volume pool. It does not increase the volume pool.

### Open interest

1. Each hour, Fermi measures your absolute net position in each market. Fermi adds all wallets of one owner together.
2. Fermi adds these hourly values for the epoch. This sum is your score.
3. Fermi does not count positions that are open for less than 1 hour.
4. Fermi does not count open interest above 5 times your account equity.

A long position and a short position of the same owner cancel each other.

### Referrals

- When you refer an account, you get 10% of the points of that account. Fermi calculates this after the fair-play rules.
- The referred account gets 5% more points.
- These points come from the referral pool. They do not come from other categories.
- If the referral claims are more than the referral pool, Fermi decreases all claims by the same percentage.
- If part of the referral pool is not used, Fermi adds it to the other categories in the same epoch.
- To get referral points, you must also trade or supply liquidity.
- Referrals between wallets of the same owner do not get points.

## Weekly cycle

1. The epoch closes on Sunday at 00:00 UTC.
2. Fermi publishes the input data for the epoch: fills, order book snapshots, positions and vault balances.
3. In 48 hours or less, Fermi publishes provisional points, the curve rate and the pool sizes.
4. For 14 days, the points stay provisional. In this period, Fermi can review them and you can appeal.
5. After 14 days, the points become final.
6. Fermi adds removed points to the pools of the next epoch. All participants share them.

## Fair-play rules

The activities that follow do not get points. If Fermi finds points from these activities, Fermi removes the points.

| Activity       | Description                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Self-trading   | A trade in which the same owner is on the two sides. The Fermi matching engine also prevents self-matching.                |
| Wash trading   | Trades between accounts that work together to make volume. This includes round trips with a net PnL near zero before fees. |
| Sybil activity | One participant who uses many wallets to get more rewards.                                                                 |
| Spoofing       | Orders that you place only for the snapshots, or that you cancel just before a fill.                                       |

Fermi finds the wallets of one owner with this data:

- the source of the funds,
- the destination of withdrawals,
- shared signers and fee payers,
- activity at the same times.

Fermi does not publish the detection thresholds. If Fermi published them, abusers could stay below them. Fermi publishes the rules, the total of removed points in each epoch, and the appeal procedure.

## Verify your points

In each epoch, Fermi publishes:

- the source code of the scorer and its parameters,
- the input data from the chain,
- a Merkle root of all balances,
- the number of excluded accounts and the total of removed points.

To verify your points:

1. Download the scorer and the input data for the epoch.
2. Run the scorer on the input data.
3. Find your account in the output.
4. Compare your balance with the Merkle root.

The result is the same as the published balance. Excluded accounts are the only exception.

<!-- TODO: Add the links to the scorer repository and to the weekly input data before launch. -->

## Start to get points

1. Go to [app.fermi.trade](https://app.fermi.trade).
2. Connect your Solana wallet.
3. Deposit USDC in the FLP vault. Deposits made from 15 October 2026 share the pre-deposit pool.
4. From 1 November 2026, trade or place resting orders to get points in the other categories.
5. Monitor your points on the points page after each epoch closes.

## Parameter reference

| Parameter                           | Value                                                          |
| ----------------------------------- | -------------------------------------------------------------- |
| Pre-deposit period                  | 15 October 2026 to 1 November 2026                             |
| Season 1                            | 1 November 2026 to 31 October 2027 (52 epochs)                 |
| Epoch close                         | Sunday, 00:00 UTC                                              |
| Floor                               | 500,000 to 200,000 points for each epoch                       |
| Curve maximum (Pmax)                | 100,000,000 points                                             |
| Curve scale (Xs)                    | $32,000,000,000 of cumulative qualified volume                 |
| Curve rate at start                 | 3,125 points for each $1M                                      |
| Curve division                      | 20% liquidity, 37.5% volume, 37.5% open interest, 5% referrals |
| FLP vault share of liquidity        | 70% to 25%, linear over 52 epochs                              |
| Pre-deposit pool                    | 1,000,000 points                                               |
| Discretionary reserve               | 5,000,000 points or less                                       |
| Season maximum                      | 124,200,000 points                                             |
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

**Do I get points if I trade through a market maker agreement?**
Market makers with a direct liquidity agreement do not get resting depth points. They can get points in the other categories.
