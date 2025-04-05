# graphile-worker-orchid

## 1.1.1

### Patch Changes

- e202293: Fix runtime return type for `id`.

## 1.1.0

### Minor Changes

- 58e420b: Add `removeJob`.
- 98d4098: Parse job data and return a parsed and properly typed object. Previously, `addJob` returned the raw unparsed string (stringified Postgres row).

## 1.0.0

### Major Changes

- 31b4645: Initial release.
