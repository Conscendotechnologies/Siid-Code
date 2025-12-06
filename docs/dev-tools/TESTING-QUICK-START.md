# Quick Start: Testing fetch_instructions

## 🚀 One-Liner Commands

```bash
# Interactive testing (recommended)
npm run test:instructions

# Test specific section
npm run test:instructions apex "SOQL & SOSL"

# Run unit tests
npm test -- markdown-parser
```

## 📊 What You'll See

### Token Savings Dashboard

```
💰 Token Savings:
  Full guide: ~22,308 tokens
  Summary: ~3,000 tokens
  Savings: 86.5%
```

### Section List

```
## Available Sections:

1. Language Fundamentals
2. Data Types
3. Collections
4. Classes, Interfaces & Enums
5. SOQL & SOSL
6. DML Operations
...
```

## 🎮 Interactive Mode Commands

```
Commands:
  5              → Get section #5
  SOQL           → Get SOQL section (fuzzy search)
  toc            → Get table of contents only
  <Enter>        → Get summary with TOC
  quit           → Exit
```

## ✅ Testing Checklist

- [ ] `npm test -- markdown-parser` - All tests pass
- [ ] `npm run test:instructions apex` - Apex guide loads
- [ ] `npm run test:instructions lwc` - LWC guide loads
- [ ] Try section queries: `"5"`, `"SOQL"`, `"toc"`
- [ ] Verify token savings > 80%
- [ ] Test in VSCode extension (F5)

## 🔍 Quick Debug

```bash
# Check guides exist
ls .roo/rules-code/*.md

# Verify build
npm run build

# Run with debugging
npm run test:instructions apex 2>&1 | tee debug.log
```

## 📝 Example Session

```bash
$ npm run test:instructions

🧪 Testing fetch_instructions: APEX Guide
════════════════════════════════════════

✓ Loaded from: .roo/rules-code/apex-guide.md

Statistics:
  Lines: 2515
  Estimated Tokens: ~22,308

🎮 Interactive Mode
────────────────────

Enter section (number/title/toc) or "quit": SOQL

🎯 Section Retrieval: "SOQL"
────────────────────────────

✓ Found section: "SOQL & SOSL"

# SOQL & SOSL

## SOQL (Salesforce Object Query Language)
...

Statistics:
  Lines: 235
  Estimated Tokens: ~3,200

💰 Token Savings: 85.7%

Enter section or "quit": quit
👋 Goodbye!
```

## 📚 Full Documentation

See [testing-fetch-instructions.md](./testing-fetch-instructions.md) for complete guide.
