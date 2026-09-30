import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';
import { Store } from './store';
import { Channel, b64, unb64, lineReader, newKeys, pairCode, rid, sas } from './crypto';
import { MASTER_NAME, PORT } from '../config';

export interface Item { uri: string; name: string; type: 'file' | 'directory'; size?: number }
export interface Dev {
  id: string; name: string; sock: any; ch: Channel; sas: string; paired: boolean; connected: boolean;
  state: string; tc: boolean; count: number; items: Item[]; trail: Item[]; err?: string;
}
export interface Transfer {
  id: string; devId: string; devName: string; name: string; uri: string; size: number; got: number;
  status: 'active' | 'paused' | 'done' | 'failed' | 'cancelled'; dest: string; err?: string; q: Promise<any>;
}

class MasterHub extends Store {
  ip = ''; code = ''; codeExp = 0; running = false; zc: any;
  devices = new Map<string, Dev>();
  transfers: Transfer[] = [];
  history: string[] = [];

  log(s: string) { this.history.unshift(`${new Date().toLocaleTimeString()}  ${s}`); this.emit(); }

  async start() {
    if (this.running) return;
    const net = await NetInfo.fetch();
    this.ip = (net.details as any)?.ipAddress ?? '';
    TcpSocket.createServer(s => this.onConn(s)).listen({ port: PORT, host: '0.0.0.0' });
    try { this.zc = new Zeroconf(); this.zc.publishService('localconnect', 'tcp', 'local', 'LC-Master', PORT, {}); } catch {}
    this.running = true; this.emit();
  }

  newPairing() { this.code = pairCode(); this.codeExp = Date.now() + 120_000; this.emit(); return this.qrPayload(); }
  // Temporary pairing info only: no permanent credentials.
  qrPayload() { return JSON.stringify({ v: 1, ip: this.ip, port: PORT, code: this.code }); }

  private send(d: Dev, o: object) { try { d.sock.write(d.ch.seal(o) + '\n'); } catch {} }

  private onConn(sock: any) {
    const keys = newKeys();
    let dev: Dev | null = null, ch: Channel | null = null, theirPub: Uint8Array;
    sock.on('data', lineReader(line => {
      try {
        if (!ch) { // plaintext hello carries only the public key
          const h = JSON.parse(line);
          theirPub = unb64(h.pub); ch = new Channel(keys, theirPub);
          sock.write(JSON.stringify({ t: 'hello', pub: b64(keys.publicKey) }) + '\n');
          dev = { id: h.id, name: h.name, sock, ch, sas: sas(keys.publicKey, theirPub), paired: false, connected: true,
                  state: 'CONNECTED', tc: false, count: 0, items: [], trail: [] };
          return;
        }
        this.onMsg(dev!, ch.open(line));
      } catch (e: any) { this.log('Bad message: ' + e.message); }
    }));
    const gone = () => { if (dev && dev.connected) { dev.connected = false; dev.state = 'DISCONNECTED'; this.log(`${dev.name} disconnected`); } };
    sock.on('close', gone); sock.on('error', gone);
  }

  private onMsg(d: Dev, m: any) {
    switch (m.t) {
      case 'pair':
        if (m.code && m.code === this.code && Date.now() < this.codeExp) {
          this.code = ''; d.paired = true; this.devices.set(d.id, d);
          this.send(d, { t: 'pair_ok', masterName: MASTER_NAME });
          this.log(`${d.name} paired (waiting for user consent)`);
        } else { this.send(d, { t: 'pair_fail' }); d.sock.destroy(); }
        break;
      case 'state': d.state = m.state; d.tc = m.tc; d.count = m.count;
        if (m.state !== 'FILE_ACCESS_GRANTED') { d.items = []; d.trail = []; }
        this.log(`${d.name}: ${m.state}`); break;
      case 'list_res':
        if (m.denied) d.err = m.reason; else { d.err = undefined; d.items = m.items; }
        this.emit(); break;
      case 'get_meta': { const t = this.tr(m.id); if (t) { t.size = m.size; this.emit(); } break; }
      case 'chunk': { const t = this.tr(m.id); if (!t || t.status === 'cancelled') break;
        const pad = m.b.endsWith('==') ? 2 : m.b.endsWith('=') ? 1 : 0;
        t.got += (m.b.length * 3) / 4 - pad;
        t.q = t.q.then(() => RNFS.appendFile(t.dest, m.b, 'base64')); this.emit(); break; }
      case 'done': { const t = this.tr(m.id); if (t) { t.q.then(() => { t.status = 'done'; this.log(`Downloaded ${t.name} from ${d.name}`); }); } break; }
      case 'denied': { const t = this.tr(m.id); if (t) { t.status = 'failed'; t.err = 'ACCESS DENIED: ' + m.reason; } d.err = m.reason; this.emit(); break; }
      case 'bye': d.connected = false; d.state = 'DISCONNECTED'; d.sock.destroy(); this.log(`${d.name} left`); break;
    }
  }

  private tr(id: string) { return this.transfers.find(t => t.id === id); }

  requestAccess(d: Dev) { this.send(d, { t: 'access_req' }); this.log(`Requested access from ${d.name}`); }
  browse(d: Dev, folder?: Item) {
    if (folder) d.trail.push(folder); else d.trail = [];
    this.send(d, { t: 'list', uri: folder?.uri ?? null });
  }
  up(d: Dev) { d.trail.pop(); this.send(d, { t: 'list', uri: d.trail[d.trail.length - 1]?.uri ?? null }); }

  async download(d: Dev, it: Item) {
    const dir = `${RNFS.ExternalDirectoryPath}/LocalConnect/${d.name.replace(/[^\w-]/g, '_')}`;
    await RNFS.mkdir(dir);
    let dest = `${dir}/${it.name}`;
    if (await RNFS.exists(dest)) await RNFS.unlink(dest);
    const t: Transfer = { id: rid(), devId: d.id, devName: d.name, name: it.name, uri: it.uri, size: it.size ?? 0, got: 0, status: 'active', dest, q: Promise.resolve() };
    this.transfers.unshift(t); this.send(d, { t: 'get', id: t.id, uri: it.uri }); this.emit();
  }
  ctl(t: Transfer, op: 'pause' | 'resume' | 'cancel') {
    const d = this.devices.get(t.devId); if (!d) return;
    this.send(d, { t: 'ctl', id: t.id, op });
    t.status = op === 'pause' ? 'paused' : op === 'resume' ? 'active' : 'cancelled'; this.emit();
  }
  retry(t: Transfer) { const d = this.devices.get(t.devId); if (d) this.download(d, { uri: t.uri, name: t.name, type: 'file', size: t.size }); }
  disconnect(d: Dev) { this.send(d, { t: 'kick' }); d.connected = false; d.state = 'DISCONNECTED'; setTimeout(() => d.sock.destroy(), 200); this.log(`Disconnected ${d.name}`); }
  list() { return [...this.devices.values()]; }
}
export const master = new MasterHub();
export { rid };
