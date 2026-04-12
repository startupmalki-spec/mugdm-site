# Mugdm AI Assistant PRD — "Your AI-Powered COO"

## Overview
A conversational AI interface that serves as the CEO's virtual COO. Users can chat naturally, upload Excel files, ask business questions, take actions, and get proactive advice — all through a ChatGPT-like interface that deeply understands their business data.

## The Core Insight
Saudi CEOs currently run everything on Excel spreadsheets — finances, team tracking, document logs, compliance checklists. Mugdm AI should be the bridge: "Upload your Excel, and I'll handle everything from here."

## Interface Design

### 1. Dedicated Chat Page (`/chat`)
A full-page conversational interface:
- ChatGPT-like message thread with user/AI bubbles
- File upload zone (drag & drop Excel, PDF, images)
- Suggested prompts for first-time users
- Conversation history (saved per business)
- Rich message rendering: tables, charts, action buttons inline
- Arabic and English support (responds in user's language)

### 2. Floating Mini-Assistant
A persistent floating chat bubble on every page:
- Small circular button in bottom-right (bottom-left for RTL)
- Expands to a compact chat panel (400x500px)
- Context-aware: knows which page the user is on
- Quick actions relevant to current page (e.g., on Vault page: "Upload a document", on Calendar: "What's due this week?")
- Can escalate to full chat page for complex conversations

## AI Capabilities

### 3. Excel Intelligence
The killer feature — import CEO's existing Excel workflow into Mugdm.

#### 3.1 Excel Upload & Understanding
- Accept .xlsx, .xls, .csv files
- AI reads the file, understands the structure (columns, data types, patterns)
- Summarizes contents: "This spreadsheet has 145 transactions from Jan-Dec 2025, totaling SAR 1.2M in expenses across 8 categories"
- Asks clarifying questions: "Column D looks like dates — is this the transaction date?"

#### 3.2 Smart Data Import
- Map Excel columns to Mugdm data model (transactions, team members, documents, obligations)
- Preview import before committing: "I'll import 145 transactions into your bookkeeper. Here's a preview of the first 10."
- Handle conflicts: "3 transactions already exist in your bookkeeper — skip, overwrite, or keep both?"
- Support multiple sheet types:
  - Financial tracking → import as transactions
  - Employee list → import as team members
  - Document tracking → import as document metadata
  - Compliance checklist → import as obligations

#### 3.3 Proactive Suggestions
After reading Excel data:
- "I noticed you track rent payments monthly — want me to set up automatic reminders?"
- "You have 12 employees listed but only 8 in your team module — want me to add the missing 4?"
- "Your expense categories don't include 'Government Fees' but I see GOSI and ZATCA payments — should I recategorize?"
- "You're tracking CR expiry manually — I can monitor this automatically and alert you 90 days before"

### 4. Business Data Queries
Natural language access to all business data:

#### Financial queries:
- "How much did I spend on rent this year?"
- "What's my total revenue for Q1?"
- "Show me my top 5 expenses last month"
- "Compare this month's spending to last month"
- "What's my estimated VAT liability?"

#### Compliance queries:
- "When does my CR expire?"
- "What compliance tasks are overdue?"
- "Am I compliant with all GOSI requirements?"
- "Show me all documents expiring in the next 60 days"

#### Team queries:
- "What's my current Saudization ratio?"
- "How many employees do I have?"
- "What's my total monthly salary cost?"
- "Who has the earliest contract expiry?"

### 5. Action Commands
Take actions through natural language:

#### Document actions:
- "Upload this as an insurance document" (with file attached)
- "Download my latest GOSI certificate"
- "Share my CR with my accountant"

#### Financial actions:
- "Add a new expense: SAR 5,000 rent payment to ABC Properties"
- "Import this bank statement" (with CSV/PDF attached)
- "Generate a VAT report for Q1"
- "Export my P&L to Excel"

#### Team actions:
- "Add a new team member: Ahmed Al-Ghamdi, Saudi, Software Engineer, salary 12,000"
- "Update Mohammed's salary to 15,000"
- "Deactivate Ravi's profile — he resigned"

#### Compliance actions:
- "Mark GOSI payment as done for March"
- "Add a new obligation: fire safety inspection, due May 15"
- "Snooze the ZATCA reminder for 3 days"

### 6. Advisory Mode (AI COO)
Proactive business advice:

#### Strategic suggestions:
- "Based on your expenses, you could save SAR 2,000/month by switching utility providers"
- "Your Saudization ratio is at 28% — you need 30% minimum. Consider hiring 1 Saudi employee"
- "Your CR expires in 45 days. Here's a checklist for renewal: [1] Updated lease, [2] Balady license, [3] Chamber membership"

#### Risk alerts:
- "Warning: your GOSI payment is 5 days overdue. Estimated penalty: SAR 400"
- "Your insurance expires next week — no renewal document uploaded yet"
- "Cash flow alert: based on current spending, you'll run low on funds in 6 weeks"

#### Weekly digest:
- Automated weekly summary via chat: what happened, what's coming up, what needs attention

## Technical Architecture

### Chat Backend
- New API route: `/api/chat`
- Uses Claude API with system prompt containing business context
- Streams responses for real-time feel
- Tool use / function calling for actions (Claude tool_use)
- Conversation memory stored in Supabase

### Data Context
- Before each AI response, inject relevant business data as context:
  - Recent transactions summary
  - Upcoming obligations
  - Document status
  - Team summary
- Use RAG pattern: query relevant data based on user's question

### Excel Processing
- Parse Excel files server-side using `xlsx` or `exceljs` npm package
- Convert to JSON, send to Claude for understanding
- Stream import progress to the client

### Security
- All AI actions require confirmation before executing
- Destructive actions (delete, overwrite) require explicit user consent
- Rate limit AI calls per subscription tier
- Never expose raw database queries to AI — use typed action functions

## File Structure
```
src/app/[locale]/(app)/chat/page.tsx       — Full chat page
src/components/chat/ChatInterface.tsx       — Main chat UI component
src/components/chat/ChatBubble.tsx          — Individual message bubble
src/components/chat/FloatingAssistant.tsx   — Floating mini-assistant
src/components/chat/FileUploadZone.tsx      — Drag & drop file area
src/components/chat/ActionConfirmation.tsx  — Confirm before AI takes action
src/app/api/chat/route.ts                  — Chat API with streaming
src/lib/chat/context-builder.ts            — Build AI context from business data
src/lib/chat/actions.ts                    — Typed action functions for AI
src/lib/chat/excel-parser.ts               — Excel file processing
```
