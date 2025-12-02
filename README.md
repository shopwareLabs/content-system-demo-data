# Shopware Content System Demo Data

This script will install some demo data for the new content system prototype in your local dev environment. You can configure the environment and admin credentials via environment variables. You can use the default if you are using DevEnv in Shopware.

- `SW_ENV_URL` (default: `http://localhost:8000`)
- `SW_USER_NAME` (default: `admin`)
- `SW_PASSWORD` (default: `shopware`)

To run the script, simply run the `demoscript.js` via node. It does not have any further dependecies. No installation necessary.

```
node demoscript.js
```

The script performs upsert sync API requests and can be repeated at any time.

The content system prototype is available in the `shopware/shopware` repository, under the following branch:

```
8484/content-system-prototype
```
 

