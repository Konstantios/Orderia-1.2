# Build Orderia Project

This workflow describes the steps to install dependencies, fix common type errors, and build the Next.js application.

## 1. Environment Setup
Ensure Node.js >= 20 is installed.
```bash
node --version
```
Note: If node is not found, check `/usr/local/bin/node`.

## 2. Install Dependencies
```bash
npm install
```

## 3. Typecheck
Verify code quality before building.
```bash
npm run typecheck
```

## 4. Build
Compile the production application.
```bash
npm run build
```
