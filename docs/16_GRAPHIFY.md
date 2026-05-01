# FinSight AI — Graphify Knowledge Graph

> This document covers the Graphify code intelligence tool: what it generates, how to use it, how to keep it updated, and how the AI assistant integrates with it.

---

## What is Graphify?

Graphify is a code intelligence tool that analyzes the entire codebase using AST (Abstract Syntax Tree) parsing and generates a **navigable knowledge graph** of all files, functions, classes, imports, and their relationships.

The AI assistant reads this graph to answer architecture and codebase questions accurately without needing to scan raw source files one by one.

**Package name:** `graphifyy` (double 'y' — this is the correct package name on PyPI)

---

## What Graphify Generates

All output is stored in `graphify-out/` in the project root.

| File | Size | Description |
|------|------|-------------|
| `graphify-out/graph.json` | Large | Full project knowledge graph in JSON format |
| `graphify-out/graph.html` | Medium | Self-contained interactive browser visualization — open in any browser to explore |
| `graphify-out/GRAPH_REPORT.md` | Small | Human-readable summary: god nodes, communities, key architectural clusters |
| `graphify-out/cache/` | Varies | Per-file AST cache for fast incremental rebuilds |

---

## Current Graph Statistics

As of **April 21, 2026** (last full rebuild):

| Metric | Value |
|--------|-------|
| **Total nodes** | 695 (files, functions, classes, methods) |
| **Total edges** | 1,243 (imports, function calls, dependencies) |
| **Communities** | 82 (functional clusters auto-detected by Graphify) |

### Core "God Nodes" (Highest Connectivity)

Nodes with the most incoming and outgoing edges — understanding these is key to understanding the architecture:

| Node | Why It's a God Node |
|------|---------------------|
| `stock_service.py` | Called by route handlers, the agent, the price update job, and multiple other services |
| `api/stock.py` | The primary HTTP interface for stock data — many paths lead through it |
| `lib/api-client.ts` | Every frontend API module goes through this single base fetch wrapper |

---

## How the AI Assistant Uses Graphify

When you ask architecture or codebase-wide questions (e.g., "How does the portfolio P&L get calculated?", "What calls stock_service?", "Where is the JWT verified?"), the AI assistant is instructed by `.agents/rules/graphify.md` to:

1. **Read `graphify-out/GRAPH_REPORT.md` first** — to get an overview of god nodes and community clusters.
2. **Navigate graph edges** to trace call chains and dependency paths.
3. Only open raw source files when the graph summary is insufficient.

This makes architecture Q&A faster and more accurate than blind file searching.

---

## Automation — Git Hook

A `post-commit` hook is installed at `.git/hooks/post-commit`. Every time you run `git commit`, Graphify automatically rebuilds only the changed files using its AST cache:

```bash
# What the hook runs (automatically, you don't run this manually):
python -m graphify update .
```

The incremental update is fast (typically < 5 seconds) because Graphify caches each file's AST and only reprocesses files that changed in the commit.

---

## Manual Graph Update

If you need to update the graph outside of a git commit (e.g., after editing files without committing):

```bash
# From the project root, with .venv active:
python -m graphify update .
```

For a complete rebuild from scratch (if the cache is corrupted or stale):
```bash
python -m graphify extract .
```

---

## Installation (New Developer Setup)

Graphify must be installed on each developer's machine separately:

```bash
# From the project root, with .venv active:

# Step 1: Install the package (note: double 'y')
pip install graphifyy

# Step 2: Initialize for the Antigravity AI assistant
python -m graphify antigravity install

# Step 3: Build the full graph from scratch (first time only)
python -m graphify extract .

# Step 4: Install the git hook for automatic updates
python -m graphify hook install
```

After this, every `git commit` will automatically trigger a graph update.

---

## AI Assistant Configuration Files

### `.agents/rules/graphify.md`

This file instructs the Antigravity AI assistant to always read `GRAPH_REPORT.md` before answering architecture or codebase-wide questions. The rule is:

> "Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure."

### `.agents/workflows/graphify-workflow.md`

Registers the `/graphify` slash command in the AI assistant. When the developer types `/graphify` in the chat, the assistant triggers a graph rebuild:

```bash
python -m graphify update .
```

---

## Exploring the Graph Interactively

To browse the knowledge graph visually:

1. Open `graphify-out/graph.html` in any browser (no server needed — it's self-contained).
2. Click on nodes to see their connections.
3. Hover over edges to see relationship types (imports, calls, etc.).
4. Use the community filter to zoom into specific functional clusters.

This is especially useful for tracing dependency chains (e.g., "What does `portfolio_service.py` depend on?") or for understanding which files belong to a specific feature area.

---

## Graphify and the `graphify-out/` Directory

The `graphify-out/` directory is committed to Git (excluding `cache/` which is gitignored). This means:
- The current graph state is always available in the repo for the AI assistant to read.
- New team members immediately have graph access without needing to run a full rebuild.
- The `GRAPH_REPORT.md` serves as a continuously-updated architecture summary.

The `cache/` subdirectory is gitignored because it is machine-specific (contains absolute file paths baked into the cache entries).
