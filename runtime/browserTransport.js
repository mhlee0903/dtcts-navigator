import { handleRequest } from './app.js?v=edab96dab0d70710';
const DIAGNOSTICS = {
    installed: false,
    version: 'dtcts-browser-transport-v1',
    api_intercepts: 0,
    delegated_requests: 0,
    last_api_path: null,
};
function inputUrl(input) {
    if (input instanceof Request)
        return input.url;
    if (input instanceof URL)
        return input.href;
    return String(input);
}
function browserBaseUrl() {
    const base = typeof document !== 'undefined' && document.baseURI ? document.baseURI : globalThis.location.href;
    return new URL(base);
}
function isSameOriginApi(url, base) {
    return url.origin === base.origin && url.pathname.startsWith('/api/');
}
export function browserTransportDiagnostics() {
    return { ...DIAGNOSTICS };
}
export function installBrowserApiTransport() {
    if (DIAGNOSTICS.installed)
        return;
    if (typeof globalThis.fetch !== 'function')
        throw new Error('Browser fetch API is unavailable');
    if (typeof globalThis.location === 'undefined')
        throw new Error('Browser location API is unavailable');
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (async (input, init) => {
        const base = browserBaseUrl();
        const resolved = new URL(inputUrl(input), base);
        if (!isSameOriginApi(resolved, base)) {
            DIAGNOSTICS.delegated_requests += 1;
            return nativeFetch(input, init);
        }
        DIAGNOSTICS.api_intercepts += 1;
        DIAGNOSTICS.last_api_path = `${resolved.pathname}${resolved.search}`;
        let request;
        if (input instanceof Request) {
            request = new Request(resolved.href, init === undefined ? input : new Request(input, init));
        }
        else {
            request = new Request(resolved.href, init);
        }
        return handleRequest(request);
    });
    DIAGNOSTICS.installed = true;
    globalThis.__DTCTS_BROWSER_API_TRANSPORT__ = DIAGNOSTICS;
}