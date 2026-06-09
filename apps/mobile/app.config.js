const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

const googleServicesPath = path.join(__dirname, 'google-services.json');

const ensureGoogleServicesFile = () => {
  if (fs.existsSync(googleServicesPath)) {
    return true;
  }

  const rawBase64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (!rawBase64) {
    return false;
  }

  const normalizedBase64 = rawBase64.replace(/\s+/g, '');
  const decoded = Buffer.from(normalizedBase64, 'base64').toString('utf8').trim();

  if (!decoded) {
    return false;
  }

  fs.writeFileSync(googleServicesPath, decoded, { encoding: 'utf8' });
  return true;
};

let hasGoogleServices = false;
try {
  hasGoogleServices = ensureGoogleServicesFile();
} catch (_error) {
  hasGoogleServices = false;
}

module.exports = ({ config }) => {
  const baseExpoConfig = {
    ...appJson.expo,
    ...(config ?? {}),
  };

  const android = {
    ...(appJson.expo.android ?? {}),
    ...(config?.android ?? {}),
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
  };

  const plugins = [
    ...(baseExpoConfig.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: {
          gradleWrapperVersion: '8.13',
        },
      },
    ],
  ];

  return {
    ...baseExpoConfig,
    android,
    plugins,
  };
};
