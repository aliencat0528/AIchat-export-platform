# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**AIchat-export-platform** is a monorepo for exporting and managing AI chat conversations from multiple platforms (ChatGPT, Gemini, Claude). It provides a Chrome extension for direct data extraction and a web application for unified conversation management.

### Main Components

1. **browser-extension** (`browser-extension/`) - Chrome extension for extracting conversations directly from AI platforms
2. **web-app** (`web-app/`) - Vue 3 local management interface with IndexedDB storage
3. **export-parser** (`export-parser/`) - Parsers for official export file formats
4. **shared** (`shared/`) - Shared TypeScript type definitions

## Architecture & Technology Stack

### Core Technologies
- **TypeScript** - Primary development language across all modules
- **Vue 3** - Frontend framework for web-app and extension popup
- **Vite** - Build tool for fast development and production builds
- **IndexedDB (idb)** - Local data storage in browser
- **Chrome Manifest V3** - Extension platform

### Key Design Patterns
- **Monorepo Architecture** - npm workspaces for shared dependencies
- **Unified Data Format** - All platforms convert to `UnifiedConversation` type
- **API-first Extraction** - Use internal APIs when available, DOM fallback otherwise
- **Local-first Storage** - All data stored locally, exportable as JSON backup

## Browser Extension

### Core Functionality
- **Platform Detection**: Auto-detect ChatGPT, Gemini, or Claude pages
- **API Integration**: Use internal APIs for stable data extraction
- **Selective Export**: Choose specific conversations to export
- **Batch Processing**: Export multiple conversations at once

### Platform-specific APIs

| Platform | Conversation List | Single Conversation |
|----------|------------------|---------------------|
| ChatGPT | `GET /backend-api/conversations` | `GET /backend-api/conversation/{id}` |
| Claude | `GET /api/organizations/{org}/chat_conversations` | `GET /api/organizations/{org}/chat_conversations/{id}` |
| Gemini | DOM parsing (no API) | DOM parsing |

### Development Commands

```bash
# Build extension
npm run build:extension

# Watch mode
npm run dev:extension

# Output in browser-extension/dist/
```

### Loading in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `browser-extension/dist/` folder

## Web Application

### Core Functionality
- **Import**: Upload official export files or extension-extracted data
- **Manage**: Search, filter, view conversations across all platforms
- **Export**: Selective export or full backup to JSON

### Data Storage
Uses IndexedDB with the following structure:
- **conversations** store: `UnifiedConversation` objects
- Indexes: `by-platform`, `by-createdAt`, `by-updatedAt`

### Development Commands

```bash
# Development server
npm run dev:web

# Production build
npm run build:web

# Preview production build
cd web-app && npm run preview
```

## Export Parser

### Supported Formats

| Platform | File | Key Structure |
|----------|------|---------------|
| ChatGPT | `conversations.json` | `mapping` tree with `parent/children` nodes |
| Gemini | Google Takeout JSONs | `messages` array with `user/model` roles |
| Claude | Export ZIP JSONs | `chat_messages` array with `human/assistant` |

### Parser Usage

```typescript
import { parseExportFile, detectPlatform } from '@aichat-export/parser';

// Auto-detect and parse
const result = await parseExportFile(jsonData);

// Manual detection
const platform = detectPlatform(jsonData);
```

## Development Workflow

### Environment Setup

```bash
# Install all dependencies
npm install

# Build shared types first
cd shared && npm run build && cd ..

# Build parser
cd export-parser && npm run build && cd ..
```

### Build Commands

```bash
# Build all modules
npm run build:all

# Build individual modules
npm run build:parser
npm run build:extension
npm run build:web
```

### Testing Extension

1. Build: `npm run build:extension`
2. Load in Chrome (see above)
3. Navigate to https://chatgpt.com and login
4. Click extension icon
5. Verify conversation list appears

### Testing Web App

1. Start: `npm run dev:web`
2. Open http://localhost:5173
3. Go to "Import" page
4. Upload a `conversations.json` from ChatGPT export
5. Verify conversations appear in list

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                              │
├─────────────────────────────────────────────────────────────┤
│  Official Exports          │  Browser Extension              │
│  • ChatGPT ZIP            │  • Direct API calls             │
│  • Google Takeout          │  • DOM extraction (Gemini)      │
│  • Claude Export           │  • Real-time extraction         │
└─────────────┬──────────────┴───────────────┬────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    export-parser                             │
│  • ChatGPTParser (mapping tree traversal)                   │
│  • GeminiParser (message array parsing)                     │
│  • ClaudeParser (chat_messages parsing)                     │
│                          ↓                                   │
│              UnifiedConversation[]                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      web-app                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  IndexedDB  │◄───│   Import    │◄───│   Parser    │     │
│  │  Storage    │    │   View      │    │   Module    │     │
│  └──────┬──────┘    └─────────────┘    └─────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │    Home     │───▶│ Conversation│    │   Export    │     │
│  │    View     │    │    View     │    │    View     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Type Definitions (shared/)

### Core Types

```typescript
type Platform = 'chatgpt' | 'gemini' | 'claude';

interface UnifiedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  originalId?: string;
}

interface UnifiedConversation {
  id: string;
  title: string;
  platform: Platform;
  createdAt: string;
  updatedAt: string;
  messages: UnifiedMessage[];
  importedAt: string;
  originalId?: string;
  rawData?: unknown;
}
```

## Common Development Tasks

### Adding a New Platform Parser

1. Create `export-parser/src/parsers/newplatform.ts`
2. Implement `Parser` interface with `canParse()` and `parse()` methods
3. Register in `export-parser/src/utils/detector.ts`
4. Add content script in `browser-extension/src/content-scripts/`
5. Update `manifest.json` with new host permissions

### Debugging Extension Issues

1. Open Chrome DevTools on the target page
2. Check Console for "AI Chat Export: ... content script loaded"
3. If not loaded, refresh the page
4. Check extension popup DevTools (right-click popup → Inspect)

### Troubleshooting API Failures

1. Verify user is logged into the platform
2. Check Network tab for API response status
3. APIs may require specific cookies/tokens
4. Fallback to DOM extraction if API blocked

## Security Considerations

- All data stored locally in browser IndexedDB
- No server-side storage or transmission
- Export files stay on user's device
- Internal APIs used only for user's own data

## Known Limitations

1. **Gemini**: No internal API, relies on DOM which may break with UI updates
2. **Rate Limiting**: Platforms may rate-limit API requests
3. **Enterprise/Team Accounts**: May have restricted export capabilities
4. **Node.js Version**: Some dependencies prefer Node >= 20 (current: 18)

## Commit Conventions

Use Conventional Commits format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests

All commits include: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`
