#!/usr/bin/env node
import('../dist/cli/index.js').catch(err => {
  console.error('Failed to load codex-flow:', err);
  process.exit(1);
});