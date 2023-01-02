import nconf from 'nconf';

/**
 * Parse configuration data from either environment variables, command line
 * arguments, or a local file.  The local file containing the actual
 * configuration should not be checked into source control.
 */

nconf.env().argv().file('../.env');

const config = {
  DISCORD_TOKEN: nconf.get('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: nconf.get('DISCORD_CLIENT_ID'),
  DISCORD_CLIENT_SECRET: nconf.get('DISCORD_CLIENT_SECRET'),
  DISCORD_REDIRECT_URI: nconf.get('DISCORD_REDIRECT_URI'),
  COOKIE_SECRET: nconf.get('COOKIE_SECRET'),
  NEXUS_REDIRECT_URI: nconf.get('NEXUS_REDIRECT_URI'),
  NEXUS_OAUTH_ID: nconf.get('NEXUS_OAUTH_ID'),
  NEXUS_OAUTH_SECRET: nconf.get('NEXUS_OAUTH_SECRET')
};

export default config;
