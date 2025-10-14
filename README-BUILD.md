# Build Instructions for Orbit Firefox Extension

## Prerequisites

### Operating System
- **Supported**: Linux, macOS, Windows 10/11
- **Tested on**: Ubuntu 22.04, macOS Ventura, Windows 11

### Required Software

1. **Node.js**: v18.0.0 or higher
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm**: v9.0.0 or higher (comes with Node.js)
   - Verify: `npm --version`

3. **Git** (optional, for cloning)
   - Download: https://git-scm.com/

---

## Build Steps

### Step 1: Extract Source Code
```bash
# If downloaded as zip
unzip orbit-source.zip
cd orbit-source

# Or if cloned from git
git clone https://github.com/KhanhRomVN/Orbit.git
cd Orbit
```

### Step 2: Install Dependencies
```bash
npm install
```

**Important**: This will install exact versions specified in `package-lock.json` to ensure reproducible builds.

**Expected output**: Should complete without errors. Total install size ~250MB.

### Step 3: Build Extension
```bash
npm run build
```

**What this does**:
- Compiles TypeScript to JavaScript
- Bundles React components with Vite
- Processes Tailwind CSS
- Generates production-ready files in `dist/` folder

**Expected output**:
```
vite v5.x.x building for production...
✓ built in X seconds
dist/
├── serviceWorker.js
├── sidebar.html
├── sidebar.js
├── popup.html
├── popup.js
├── claude-content.js
├── manifest.json
└── [assets]
```

### Step 4: Verify Build
```bash
# Check that all required files exist
ls -la dist/

# Files should match structure in manifest.json
```

**Required files in `dist/`**:
- `manifest.json`
- `serviceWorker.js`
- `sidebar.html` + `sidebar.js`
- `popup.html` + `popup.js`
- `claude-content.js`
- `icon-16.png`, `icon-48.png`, `icon-128.png`

---

## Build Output Verification

### File Sizes (approximate)
- `serviceWorker.js`: ~50KB
- `sidebar.js`: ~200KB
- `claude-content.js`: ~10KB
- Total: ~500KB uncompressed

### Verify Manifest
```bash
cat dist/manifest.json
```

Should show `manifest_version: 2` and match source `manifest.json`.

---

## Packaging for Firefox

### Create Submission Package
```bash
cd dist
zip -r ../orbit-extension.zip .
```

**Result**: `orbit-extension.zip` ready for Firefox Add-ons submission.

---

## Troubleshooting

### Issue: `npm install` fails
**Solution**: 
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Build errors about TypeScript
**Solution**: Ensure Node.js version >= 18.0.0
```bash
node --version
npm --version
```

### Issue: Missing dependencies
**Solution**: Clear cache and reinstall
```bash
npm cache clean --force
npm install
```

### Issue: Vite build fails
**Solution**: Check for disk space, ensure write permissions in project folder
```bash
df -h  # Check disk space
ls -la  # Check permissions
```

---

## Build Environment Details

### Dependencies Used (from package.json)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "^3.7.2",
    "vite": "^5.4.11",
    "typescript": "^5.7.2",
    "tailwindcss": "^3.4.17"
  }
}
```

### Build Process Details
1. **TypeScript Compilation**: `tsc` via Vite
2. **React Bundling**: Vite with SWC for fast compilation
3. **CSS Processing**: Tailwind CSS via PostCSS
4. **Minification**: Vite's esbuild minifier
5. **Source Maps**: Not included in production build

---

## Reproducibility

### Same Build Output
To ensure identical build output:
1. Use exact Node.js version specified
2. Use `package-lock.json` (DO NOT delete)
3. Run on same OS architecture when possible
4. Build from clean state:
```bash
   rm -rf node_modules dist
   npm install
   npm run build
```

### Build Hash Verification
```bash
# After building, generate checksums
cd dist
sha256sum serviceWorker.js sidebar.js
```

Reviewers can compare these hashes with their own build.

---

## Contact

If you encounter build issues:
- **GitHub Issues**: https://github.com/KhanhRomVN/Orbit/issues
- **Email**: khanhromvn@gmail.com

---

## Reviewer Notes

### Key Files to Inspect
1. **Background Script**: `src/background/service-worker.ts`
2. **Content Script**: `src/content-scripts/claude-content.ts`
3. **UI Components**: `src/presentation/components/`
4. **Build Config**: `vite.config.ts`, `tailwind.config.js`

### No Obfuscation
- All source code is readable TypeScript/React
- No minification in source files
- Vite only bundles for distribution
- No external API calls except:
  - WebSocket to `localhost:3031` (optional VS Code integration)
  - Firefox native APIs only

### Permissions Justification
See `manifest.json` comments for each permission usage.

---

**Last Updated**: 2025-01-15
**Build System Version**: Vite 5.4.11 + Node.js 18+