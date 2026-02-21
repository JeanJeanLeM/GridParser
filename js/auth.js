/**
 * Auth0 SPA client for Grid2Icons. Requires window.__auth0Config = { domain, clientId } (e.g. from js/auth0-config.js).
 */
import { createAuth0Client } from 'https://esm.sh/@auth0/auth0-spa-js@2.0.3';

const config = window.__auth0Config || {};
const domain = config.domain || '';
const clientId = config.clientId || '';
const redirectUri = typeof window !== 'undefined' ? window.location.origin + '/callback.html' : '';

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    if (!domain || !clientId) {
      clientPromise = Promise.reject(new Error('Auth0 config missing: set window.__auth0Config with domain and clientId'));
    } else {
      clientPromise = createAuth0Client({
        domain,
        clientId,
        authorizationParams: {
          redirect_uri: redirectUri,
        },
      });
    }
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
