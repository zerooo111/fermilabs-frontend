# Fermi Trades API Documentation

## Base URL

Default: `http://localhost:3000`

## Endpoints

### Health Check

Check if the API and database connection are working properly.

**GET** `/health`

#### Response

```json
// Success (200 OK)
{
  "status": "healthy",
  "database": "connected"
}

// Error (503 Service Unavailable)
{
  "status": "unhealthy",
  "database": "disconnected"
}
```

### Candles (OHLCV Data)

Get candlestick (OHLCV) data for a specific market.

**GET** `/candles`

#### Query Parameters

| Parameter | Type   | Required | Description                                                  |
| --------- | ------ | -------- | ------------------------------------------------------------ |
| interval  | string | Yes      | Time bucket interval (e.g., '1 hour', '15 minutes', '1 day') |
| startTime | number | Yes      | Start timestamp (Unix seconds)                               |
| endTime   | number | Yes      | End timestamp (Unix seconds)                                 |
| marketId  | string | Yes      | Market identifier                                            |

#### Response

```json
[
  {
    "time": 1612345678, // Unix timestamp in seconds
    "open": 100.5, // Opening price
    "high": 105.3, // Highest price
    "low": 98.1, // Lowest price
    "close": 103.7, // Closing price
    "volume": 245.6 // Volume traded
  }
  // Additional candles...
]
```

### Volume

Get total trading volume for a specific market within a time range.

**GET** `/volume`

#### Query Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| startTime | number | Yes      | Start timestamp (Unix seconds) |
| endTime   | number | Yes      | End timestamp (Unix seconds)   |
| marketId  | string | Yes      | Market identifier              |

#### Response

```json
{
  "volume": 1234.56 // Total volume in the specified period
}
```

### Latest Price

Get the most recent price for a specific market.

**GET** `/price`

#### Query Parameters

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| marketId  | string | Yes      | Market identifier |

#### Response

```json
{
  "price": 102.45 // Latest price (null if no trades found)
}
```

## Error Handling

All endpoints may return a 500 status code with an error message on failure:

```json
{
  "error": "Failed to fetch data"
}
```

400 Bad Request is returned when required parameters are missing:

```json
{
  "error": "Missing required parameters. Please provide parameter1, parameter2, etc."
}
```
