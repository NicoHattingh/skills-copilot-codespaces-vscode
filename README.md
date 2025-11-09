# ISO Mapper & Message Modeling Prototype

This repository contains a small, config-driven mapping engine and HTTP API prototype. It demonstrates how message layouts, field definitions, and mapping rules can be described with YAML files and executed at runtime without any vendor-specific coupling.

The engine loads definitions from the `definitions/` directory, validates mapping sets, executes transform functions, and exposes an Express-based API for inspection and execution.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile the TypeScript sources:
   ```bash
   npm run build
   ```
3. Start the HTTP API:
   ```bash
   npm start
   ```
   The server listens on port `3000` by default. Use the `PORT` environment variable to override the port.

During development you can use:
```bash
npm run dev
```
which starts the server directly with `ts-node`.

## Definitions directory

The prototype ships with a set of proof-of-concept definitions:

- `definitions/fields.yaml` – shared field catalogue.
- `definitions/messages/` – message layouts for source and target messages.
- `definitions/mappings/` – mapping rules that connect the messages.

All files can be authored in either YAML or JSON. On startup the engine builds in-memory indexes for fields, messages, and mapping sets.

## HTTP API

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness probe returning `{ "status": "ok" }`. |
| `GET /mappings/:id` | Returns the raw mapping set definition. |
| `POST /validate/:id` | Validates the mapping set identified by `id` and returns configuration errors or warnings. |
| `POST /run` | Executes a mapping set using the logical JSON payload supplied in the request body. |

### Example `POST /run`

Request body:
```json
{
  "mapping_set_id": "iso8583_auth_to_internal_v1",
  "input": {
    "mti": "0100",
    "pan": "6011000990139424",
    "amount_minor": 10000,
    "currency_numeric": "840",
    "stan": "123456",
    "merchant_number": "M123456789",
    "acceptor_id": "TERM001",
    "auth_code": "",
    "txn_timestamp": "2025-11-09T12:34:56Z"
  }
}
```

Example response snippet:
```json
{
  "valid": true,
  "output": {
    "mti": "0100",
    "stan": "123456",
    "txn_timestamp": "2025-11-09T12:34:56Z",
    "pan": "6011000990139424",
    "bin": "601100",
    "amount_minor": 10000,
    "currency_alpha": "USD",
    "auth_code": "",
    "merchant_id": "M123456789",
    "channel": "POS",
    "approval_status": "PENDING",
    "response_code": "00"
  },
  "warnings": [],
  "errors": [],
  "trace": [
    { "ruleId": "rule_mti", "type": "direct", "fromField": "mti", "toField": "mti" },
    { "ruleId": "rule_bin", "type": "transform", "fromField": "pan", "toField": "bin", "transformFn": "derive_bin" },
    { "ruleId": "rule_channel", "type": "conditional", "toField": "channel" }
  ]
}
```

Warnings are non-blocking and do not prevent the `valid` flag from being `true`. The `trace` array records each rule that participated in the execution.

## Transform registry

The MVP transform registry bundles a few utility functions for demonstration purposes:

- `minor_to_major(value, { scale })`
- `iso4217_numeric_to_alpha(value)`
- `derive_bin(pan, { length })`

You can extend the registry by editing `src/transformRegistry.ts` and referencing the new function names inside mapping definitions.

## Running tests

This prototype does not yet include automated tests. Mapping behaviour can be validated via the `/run` endpoint or by importing the executor modules directly in your own scripts.
