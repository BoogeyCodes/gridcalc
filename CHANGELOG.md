# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Three built-in functions: `MEDIAN`, `COUNTA` (count non-empty values) and
  `POWER`.

## [0.1.0]

### Added
- Formula engine: lexer, Pratt parser, evaluator, and a cell grid.
- Cell and range references with a dependency graph and incremental recompute.
- Circular-reference detection.
- Built-in arithmetic, logical, aggregation and text functions.
