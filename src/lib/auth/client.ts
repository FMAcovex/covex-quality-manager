"use client";
export function csrfToken() {
  const value = document.cookie.split(";").map(v => v.trim()).find(v => /^(?:__Host-)?covex-csrf=/.test(v));
  return value ? decodeURIComponent(value.slice(value.indexOf("=") + 1)) : "";
}
export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const target = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  const method = init.method ?? (input instanceof Request ? input.method : "GET");
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  if (target.origin === window.location.origin && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers.set("x-covex-csrf", csrfToken());
  return fetch(input, { ...init, headers });
}
