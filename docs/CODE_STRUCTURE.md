# Code Structure

The large root assets are now generated compatibility files. Do not edit these files directly:

- `script.js`
- `styles.css`
- `admin/admin.js`
- `admin/admin.css`
- `app.bundle.js`

Run `npm run build` after editing source files. The build assembles the compatibility files and creates the production `dist/` directory.

## Public Site JavaScript

Source: `src/site/`

| File | Responsibility |
| --- | --- |
| `00-core.js` | Shared state, escaping, Markdown, profile and shell rendering |
| `10-projects.js` | Project cards and project detail |
| `20-articles.js` | Article columns, lists, details and SEO |
| `30-knowledge-network.js` | Knowledge relationships and normalized nodes |
| `40-knowledge-graph.js` | Graph data, layout, filters and Cytoscape controls |
| `50-knowledge-pages.js` | Knowledge views, reading, timeline and about data |
| `60-ai-lab.js` | AI Lab navigation, scope and history |
| `70-dashboards.js` | Statistics, Now, Building and Changelog |
| `80-search-rag.js` | Command palette, citations and local RAG fallback |
| `90-agent-router.js` | Agent actions, routing and application startup |

The files intentionally share one browser scope. Their order is defined in `scripts/source-manifest.mjs`.

## Admin JavaScript

Source: `src/admin/`

The admin is split by workflow: core state, navigation/inbox, review/maintenance, knowledge, AI runs, content operations, editor, persistence, documents, and authentication/startup.

## Styles

- Public site styles: `src/styles/site/`
- Admin styles: `src/styles/admin/`

Later-numbered files win in the CSS cascade. Add page-specific rules to the matching page file instead of appending them to generated CSS.

## Backend

- `backend/app/routers/` contains HTTP route groups.
- `backend/app/content_versioning.py` owns shared draft, revision and version helpers.
- `backend/app/routers/content_admin.py` owns content CRUD, import/export, version restore and asset upload.
- `backend/app/routers/admin.py` owns content quality and system dashboards.
- `backend/app/routers/admin_runtime.py` owns AI runs, Agent evaluation and RAG operations.
- `backend/app/workspace_service.py` owns review, maintenance and organization algorithms.
- Domain services such as RAG, documents, search and knowledge remain under `backend/app/`.

## Commands

```bash
npm run build
cd backend && .venv/bin/python -m pytest -q
```

Use `npm run edit` for the legacy local editor. It assembles source files before starting.
