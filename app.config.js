// Dev-only iOS keys live here rather than in app.json.
//
// NSLocalNetworkUsageDescription and NSBonjourServices exist so a local build
// can discover the Metro dev server. Shipping them in a release build makes
// iOS prompt testers for local-network access on first launch for no reason,
// so they are stripped from anything built by EAS outside the `development`
// profile. Everything else comes straight from app.json.
const DEV_ONLY_INFO_PLIST_KEYS = [
  'NSLocalNetworkUsageDescription',
  'NSBonjourServices',
];

const isDevBuild =
  !process.env.EAS_BUILD || process.env.EAS_BUILD_PROFILE === 'development';

module.exports = ({ config }) => {
  if (isDevBuild) return config;

  const infoPlist = { ...config.ios.infoPlist };
  for (const key of DEV_ONLY_INFO_PLIST_KEYS) {
    delete infoPlist[key];
  }

  return { ...config, ios: { ...config.ios, infoPlist } };
};
