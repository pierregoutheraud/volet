# Project skills

The skills under `skills/` are maintained by the Svelte team:

- `svelte-code-writer`: Svelte documentation lookup and autofixer workflow.
- `svelte-core-bestpractices`: modern Svelte patterns and bundled reference material.

Source: [sveltejs/ai-tools](https://github.com/sveltejs/ai-tools/tree/d3e755be770277d8c75fe61109b103b801b12775/tools/skills).
Revision: `d3e755be770277d8c75fe61109b103b801b12775`.
Official catalog: <https://svelte.dev/docs/ai/skills>.

The skills are vendored into this repository so collaborators use the same guidance. Their upstream MIT license
is included in `skills/SVELTE-LICENSE`. Em dash punctuation is replaced with commas to follow this repository's
writing convention; the instructions are otherwise unchanged.

These skills complement the Svelte MCP configuration in `.mcp.json` and the workflow in `AGENTS.md`.
The optional upstream `svelte-mcp-feedback` skill is not installed because it is an opt-in issue-reporting workflow.

To update, use a reviewed commit from `sveltejs/ai-tools`, replace the two skill directories from `tools/skills/`,
refresh the license, apply the punctuation convention, and update the revision above.
