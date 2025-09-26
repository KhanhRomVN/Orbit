#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Migration script to convert Chrome extension to Firefox addon
 * Run with: node migrate-to-firefox.js
 */

function migrateManifest() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ manifest.json not found');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Convert to Manifest V2
  const firefoxManifest = {
    manifest_version: 2,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    
    permissions: manifest.permissions || [],
    host_permissions: undefined, // Remove host_permissions for V2
    
    background: {
      scripts: ['serviceWorker.js'],
      persistent: false
    },
    
    content_security_policy: manifest.content_security_policy?.extension_pages || 
      "script-src 'self'; object-src 'none';",
    
    browser_action: {
      default_popup: manifest.action?.default_popup || 'popup.html',
      default_title: manifest.action?.default_title || manifest.name,
      default_icon: manifest.action?.default_icon || manifest.icons
    },
    
    icons: manifest.icons,
    
    web_accessible_resources: Array.isArray(manifest.web_accessible_resources) 
      ? manifest.web_accessible_resources[0]?.resources || []
      : manifest.web_accessible_resources || [],
    
    commands: manifest.commands,
    
    applications: {
      gecko: {
        id: `${manifest.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        strict_min_version: "109.0"
      }
    }
  };

  // Move host_permissions to permissions array
  if (manifest.host_permissions) {
    firefoxManifest.permissions = [...firefoxManifest.permissions, ...manifest.host_permissions];
  }

  // Write Firefox manifest
  const backupPath = path.join(__dirname, 'manifest-chrome.json.backup');
  fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Chrome manifest backed up to manifest-chrome.json.backup');

  fs.writeFileSync(manifestPath, JSON.stringify(firefoxManifest, null, 2));
  console.log('✅ Manifest converted to Firefox format');
}

function updatePackageJson() {
  const packagePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    console.log('⚠️ package.json not found, skipping...');
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Add Firefox-specific scripts and dependencies
  pkg.scripts = {
    ...pkg.scripts,
    'build:firefox': 'npm run build && npm run package:firefox',
    'package:firefox': 'web-ext build --source-dir dist --artifacts-dir web-ext-artifacts',
    'test:firefox': 'web-ext run --source-dir dist --firefox-profile test-profile --keep-profile-changes',
    'lint:firefox': 'web-ext lint --source-dir dist'
  };

  // Add web-ext dependency
  if (!pkg.devDependencies) pkg.devDependencies = {};
  if (!pkg.devDependencies['web-ext']) {
    pkg.devDependencies['web-ext'] = '^7.11.0';
  }

  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  console.log('✅ package.json updated with Firefox scripts');
}

function createFirefoxFiles() {
  // Create web-ext-config.js
  const webExtConfig = `module.exports = {
  verbose: false,
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: 'firefox',
    browserConsole: true,
    startUrl: ['about:debugging#/runtime/this-firefox'],
    pref: {
      'extensions.webextensions.keepStorageOnUninstall': true,
      'extensions.webextensions.keepUuidOnUninstall': true,
    },
  },
  lint: {
    pretty: true,
    warningsAsErrors: false,
  },
};`;

  fs.writeFileSync('web-ext-config.js', webExtConfig);
  console.log('✅ Created web-ext-config.js');

  // Create Firefox README section
  const readmePath = path.join(__dirname, 'README.md');
  let readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  
  if (!readmeContent.includes('Firefox')) {
    const firefoxSection = `

## Firefox Development

### Build for Firefox
\`\`\`bash
npm run build:firefox
\`\`\`

### Test in Firefox
\`\`\`bash
npm run test:firefox
\`\`\`

### Package for Distribution
\`\`\`bash
npm run package:firefox
\`\`\`

### Manual Installation
1. Build the addon: \`npm run build:firefox\`
2. Open Firefox and go to \`about:debugging\`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the \`manifest.json\` file from the \`dist\` folder
`;

    readmeContent += firefoxSection;
    fs.writeFileSync(readmePath, readmeContent);
    console.log('✅ Updated README.md with Firefox instructions');
  }
}

function updateViteConfig() {
  const viteConfigPath = path.join(__dirname, 'vite.config.ts');
  
  if (!fs.existsSync(viteConfigPath)) {
    console.log('⚠️ vite.config.ts not found, skipping...');
    return;
  }

  let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Update target for Firefox
  if (viteConfig.includes('target:')) {
    viteConfig = viteConfig.replace(/target:\s*['"`][^'"`]*['"`]/, "target: 'firefox109'");
  } else {
    viteConfig = viteConfig.replace(
      /(minify:\s*['"`][^'"`]*['"`],?)/,
      "$1\n    target: 'firefox109',"
    );
  }

  fs.writeFileSync(viteConfigPath, viteConfig);
  console.log('✅ Updated vite.config.ts for Firefox compatibility');
}

function addCompatibilityLayer() {
  // Create a compatibility utility file
  const compatPath = path.join(__dirname, 'src', 'shared', 'utils', 'browser-compat.ts');
  
  // Ensure directory exists
  const compatDir = path.dirname(compatPath);
  if (!fs.existsSync(compatDir)) {
    fs.mkdirSync(compatDir, { recursive: true });
  }

  const compatContent = `// Browser API compatibility layer for Firefox and Chrome
export const getBrowserAPI = () => {
  if (typeof browser !== 'undefined') {
    return browser; // Firefox
  } else if (typeof chrome !== 'undefined') {
    return chrome; // Chrome
  }
  throw new Error('No browser API available');
};

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const isFirefox = () => typeof browser !== 'undefined';
export const isChrome = () => typeof chrome !== 'undefined' && typeof browser === 'undefined';
`;

  fs.writeFileSync(compatPath, compatContent);
  console.log('✅ Created browser compatibility utility');
}

function main() {
  console.log('🚀 Starting migration to Firefox...\n');

  try {
    migrateManifest();
    updatePackageJson();
    createFirefoxFiles();
    updateViteConfig();
    addCompatibilityLayer();

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install web-ext: npm install');
    console.log('2. Update your TypeScript files to use the compatibility layer');
    console.log('3. Build for Firefox: npm run build:firefox');
    console.log('4. Test: npm run test:firefox');
    console.log('\n📖 Check the artifacts above for detailed code changes needed.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateManifest,
  updatePackageJson,
  createFirefoxFiles,
  updateViteConfig,
  addCompatibilityLayer
};