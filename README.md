# Buffertron (UJPO)

UDP JSON ingestion, buffering, and HTTP delivery service.

Buffertron receives JSON messages over UDP, parses them, optionally tries to fix parse errors, buffers them, and periodically forwards batches to one or more HTTP(S) endpoints.

It is designed as a lightweight, best-effort telemetry pipeline with minimal guarantees and high throughput.

## Data Format

### Valid JSON input

Source: `printf '{"request-id": 42, "device-id": "'"$HOSTNAME"'","timestamp": "%(%FT%T%z(%Z))T", "DATA": ["one","two"]}' -1 | socat -t 0 - udp:127.0.0.1:3495`

```json
{
  "messageCounter": 171,
  "txTimestamp": 1782706083.413,
  "datasets": [
    {
      "rxTimestamps": [1782706082.775],
      "type": "json",
      "data": {
        "request-id": 42,
        "device-id": "denkmatte",
        "timestamp": "2026-06-29T06:08:02+0200(CEST)",
        "DATA": [
          "one",
          "two"
        ]
      }
    }
  ]
```

### Invalid JSON input (fallback)

Source: `printf 'foobar' | socat -t 0 - udp:127.0.0.1:3495`

```json
{
  "messageCounter": 266,
  "txTimestamp": 1782706274.141,
  "datasets": [
    {
      "rxTimestamps": [1782706273.538],
      "type": "bytes",
      "data": [102, 111, 111, 98, 97, 114]
    }
  ]
}
```

## Usage

### Run as CLI

```sh
node main.js <mode> <config.json>
```

#### Modes

- gateway -> UDP ingestion + HTTP fan-out
- receiver -> HTTP ingestion endpoint
- both -> run both components

#### Example

```sh
node main.js gateway config.json
```

### Configuration (example)

```json
{
  "gateway": {
    "listen": {
      "host": "0.0.0.0",
      "port": 7570
    },
    "senders": [
      {
        "url": "http://localhost:8080/ingest",
        "encoding": "gzip",
        "headers": {
          "x-source": "buffertron"
        },
        "connectTimeout": 1000,
        "requestTimeout": 2000
      }
    ]
  },
  "receiver": {
    "listen": {
      "port": 8080
    },
    "maxBodySize": 2097152
  }
}
```

## Architecture

```text
UDP Devices
     │
     ▼
 ┌──────────────┐
 │ Buffertron   │
 │ (Gateway)    │
 │              │
 │  buffer[]    │───► HTTP Endpoint A
 │  buffer[]    │───► HTTP Endpoint B
 └──────────────┘
```

### Failure Semantics

Buffertron does not retry failed deliveries.

Possible data loss points:

- UDP packet loss
- JSON parse failures
- HTTP request errors/timeouts

This is intentional.

## When not to use it

- Billing / financial data
- Audit logs
- Critical event processing

## TODO

- set maxOutputLength in decoders options
- implement mutex to serialize requests
