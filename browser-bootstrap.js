import { installBrowserApiTransport } from './runtime/browserTransport.js?v=f43a3064a3d50592';
installBrowserApiTransport();
await import('./app.js?v=0c7b9025784c52b1');
