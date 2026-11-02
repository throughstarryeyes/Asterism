import { inDesktopApp } from './saveFile';

// the relay for live sessions, run by the desktop app on this computer. a web page cannot start programs, so in the browser
// these are not available and the window shows how to start the relay by hand instead.

export interface RelayInfo {
  port: number;
  host_key: string;
  // the address other computers on this network would type
  lan: string | null;
  // the address from the writer's own tunnel, when it is running
  tunnel: string | null;
}

export const canRunRelay = (): boolean => inDesktopApp();

// cloudflared is a program, and a phone cannot start one, so on Android hosting stays on the local network
export const canShareOverInternet = (): boolean => !/Android/i.test(navigator.userAgent);

async function call<T>(command: string): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command);
}

export const relayStatus = () => call<RelayInfo | null>('relay_status');
export const startRelay = () => call<RelayInfo>('relay_start');
export const stopRelay = () => call<void>('relay_stop');
export const startTunnel = () => call<string>('tunnel_start');
export const stopTunnel = () => call<void>('tunnel_stop');

// the address guests should be told: the tunnel when there is one, because it works from anywhere
export const guestAddress = (info: RelayInfo | null): string => info?.tunnel ?? info?.lan ?? '';
