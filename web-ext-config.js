module.exports = {
    // Global options:
    verbose: false,
    
    // Command options:
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
    
    sign: {
      // Only needed for distribution
      // apiKey: process.env.WEB_EXT_API_KEY,
      // apiSecret: process.env.WEB_EXT_API_SECRET,
    },
  };