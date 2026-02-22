/**
 * Auth0 SPA client for Grid2Icons. Config from window.__auth0Config (optional) or /api/auth-config (env vars).
 */
import { createAuth0Client } from 'https://esm.sh/@auth0/auth0-spa-js@2.0.3';

const redirectUri = typeof window !== 'undefined' ? window.location.origin + '/callback.html' : '';
const PLACEHOLDER_DOMAIN = 'your-tenant.auth0.com';
const PLACEHOLDER_CLIENT_ID = 'your_client_id';

let configPromise = null;

function getConfig() {
  if (configPromise) return configPromise;
  const fromWindow = window.__auth0Config || {};
  const valid = fromWindow.domain && fromWindow.clientId &&
    fromWindow.domain !== PLACEHOLDER_DOMAIN && fromWindow.clientId !== PLACEHOLDER_CLIENT_ID;
  if (valid) {
    configPromise = Promise.resolve(fromWindow);
    return configPromise;
  }
  configPromise = fetch('/api/auth-config')
    .then(function (r) { return r.json(); })
    .then(function (c) {
      window.__auth0Config = c;
      return c;
    });
  return configPromise;
}

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = getConfig().then(function (config) {
      const domain = config.domain || '';
      const clientId = config.clientId || '';
      if (!domain || !clientId) {
        return Promise.reject(new Error('Auth0 config missing: set AUTH0_DOMAIN and AUTH0_CLIENT_ID in .env or Vercel env'));
      }
      return createAuth0Client({
        domain,
        clientId,
        authorizationParams: {
          redirect_uri: redirectUri,
        },
      });
    });
  }
  return clientPromise;
}

async function login() {
  const client = await getClient();
  await client.loginWithRedirect();
}

async function signup() {
  const client = await getClient();
  await client.loginWithRedirect({
    authorizationParams: {
      screen_hint: 'signup',
    },
  });
}

async function logout() {
  const client = await getClient();
  await client.logout({
    logoutParams: {
      returnTo: window.location.origin + '/index.html',
    },
  });
}

async function getUser() {
  const client = await getClient();
  return client.getUser();
}

async function getToken() {
  const client = await getClient();
  return client.getTokenSilently();
}

async function isAuthenticated() {
  const client = await getClient();
  return client.isAuthenticated();
}

async function handleRedirectCallback() {
  const client = await getClient();
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    return client.handleRedirectCallback();
  }
  return Promise.resolve();
}

const ready = getClient().catch(function () {
  return null;
});

window.auth0Api = {
  login,
  signup,
  logout,
  getUser,
  getToken,
  isAuthenticated,
  handleRedirectCallback,
  ready,
};
if (typeof window !== 'undefined') {
  window.dispatchEvent(new CustomEvent('auth0ApiReady'));
}
