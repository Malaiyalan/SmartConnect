import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';
import * as SAF from 'react-native-saf-x';
import { Store } from './store';
import { Channel, b64, unb64, lineReader, newKeys, rid, sas } from './crypto';
import { ConsentRegistry } from '../core/consent';
import { PORT } from '../config';

export type Status = 'idle' | 'connecting' | 'request' | 'active' | 'error';
const S: any = SAF;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

class UserClient extends Store {
  reg = new ConsentRegistry();
  status: Status = 'idle'; err = ''; masterId = ''; masterName = ''; sessionId = ''; sas = '';
  found: { name: string; ip: string }[] = [];
  roots: any[] = []; wantsAccess = false; ip = '';
  private sock: any; private ch!: Channel;
  private ctl = new Map<string, 'pause' | 'resume' | 'cancel'>();
  deviceId = rid(); deviceName = 'Phone-' + rid().slice(0, 4);

  get session() { return this.reg.get(this.masterId); }
  get state() { return this.session?.state ?? 'NOT_CONNECTED'; }
  get log() { return this.reg.accessLog(this.masterId).filter(l => !l.event.startsWith('State:')); }

  discover() {
    try {
      const z = new Zeroconf();
      z.on('resolved', (s: any) => { const ip = s.addresses?.find((a: string) => a.includes('.')); if (ip && !this.found.some(f => f.ip === ip)) { this.found.push({ name: s.name, ip }); this.emit(); } });
      z.scan('localconnect', 'tcp', 'local');
    } catch {}
  }

  connect(ip: string, code: string) {
    this.status = 'connecting'; this.err = ''; this.ip = ip; this.emit();
    const keys = newKeys(); let ready = false;
    const sock = this.sock = TcpSocket.createConnection({ host: ip, port: PORT }, () => {
      sock.write(JSON.stringify({ t: 'hello', pub: b64(keys.publicKey), id: this.deviceId, name: this.deviceName }) + '\n');
    });
    sock.on('data', lineReader(line => {
      try {
        if (!ready) {
          const h = JSON.parse(line); const their = unb64(h.pub);
          this.ch = new Channel(keys, their); this.sas = sas(keys.publicKey, their); ready = true;
          this.send({ t: 'pair', code }); return;
        }
        this.onMsg(this.ch.open(line));
      } catch (e: any) { this.fail(e.message); }
    }));
    sock.on('error', (e: any) => this.fail(String(e?.message ?? e)));
    sock.on('close', () => { if (this.status !== 'idle') { this.masterId && this.reg.disconnect(this.masterId); this.status = 'idle'; this.emit(); } });
  }

  private fail(m: string) { this.status = 'error'; this.err = m; this.emit(); }
  private send(o: object) { try { this.sock.write(this.ch.seal(o) + '\n'); } catch {} }
  report() { const s = this.session; if (s) this.send({ t: 'state', state: s.state, tc: s.tcAcknowledged, count: this.roots.length }); this.emit(); }

  private authorize(uri: string | null) {
    const s = this.session; if (!s) return { ok: false as const, reason: 'No session' };
    return this.reg.validate(this.masterId, this.sessionId, uri ?? s.grantedUris[0] ?? '');
  }

  private async onMsg(m: any) {
    switch (m.t) {
      case 'pair_ok':
        this.masterName = m.masterName; this.masterId = this.ip; this.sessionId = rid();
        this.reg.open(this.masterId, m.masterName, this.sessionId); this.status = 'request'; this.report(); break;
      case 'pair_fail': this.fail('Pairing code rejected or expired'); break;
      case 'access_req': this.wantsAccess = true; this.reg.requestAgain(this.masterId); this.report(); break;
      case 'kick': this.disconnect(false); break;
      case 'ctl': this.ctl.set(m.id, m.op); break;
      case 'list': {
        const a = this.authorize(m.uri);
        if (!a.ok) return this.send({ t: 'list_res', denied: true, reason: a.reason });
        try {
          const items = m.uri ? (await S.listFiles(m.uri)).map((f: any) => ({ uri: f.uri, name: f.name, type: f.type, size: f.size })) : this.roots.map(f => ({ uri: f.uri, name: f.name, type: f.type, size: f.size }));
          this.reg.record(this.session!, m.uri ? `Opened folder ${decodeURIComponent(m.uri).split('/').pop()}` : 'Listed shared items'); this.send({ t: 'list_res', items }); this.emit();
        } catch (e: any) { this.send({ t: 'list_res', denied: true, reason: 'Cannot read: ' + e.message }); }
        break;
      }
      case 'get': await this.serve(m.id, m.uri); break;
    }
  }

  private async serve(id: string, uri: string) {
    const deny = (r: string) => this.send({ t: 'denied', id, reason: r });
    let a = this.authorize(uri); if (!a.ok) return deny(a.reason);
    try {
      const data: string = await S.readFile(uri, { encoding: 'base64' });
      const size = Math.floor((data.length * 3) / 4);
      this.send({ t: 'get_meta', id, size });
      for (let i = 0; i < data.length; i += 65536) {
        while (this.ctl.get(id) === 'pause') await sleep(200);
        if (this.ctl.get(id) === 'cancel') { this.ctl.delete(id); return; }
        a = this.authorize(uri); if (!a.ok) return deny(a.reason); // re-check consent for every chunk
        this.send({ t: 'chunk', id, b: data.slice(i, i + 65536) });
        await sleep(0);
      }
      this.send({ t: 'done', id }); this.ctl.delete(id);
      this.reg.record(this.session!, `Downloaded ${decodeURIComponent(uri).split('/').pop()}`); this.emit();
    } catch (e: any) { deny('Read failed: ' + e.message); }
  }

  // --- user actions ---
  acceptTerms(ticked: boolean, scrolled: boolean) { const r = this.reg.acceptTerms(this.masterId, ticked, scrolled); this.report(); return r; }
  private async grant(picked: any[] | null) {
    if (!picked || !picked.length) return; // user cancelled the system picker
    this.roots = picked; const r = this.reg.grantFiles(this.masterId, picked.map(p => p.uri));
    if (r.ok) { this.status = 'active'; this.wantsAccess = false; this.reg.record(this.session!, `Shared ${picked.length} item(s)`); }
    this.report();
  }
  async chooseFiles() { this.grant(await S.openDocument(true, true)); }
  async chooseFolder() { const f = await S.openDocumentTree(true); this.grant(f ? [f] : null); }
  revoke() { this.reg.revoke(this.masterId); this.roots = []; this.reg.record(this.session!, 'File access revoked'); this.report(); }
  disconnect(notify = true) {
    if (notify) this.send({ t: 'bye' });
    if (this.masterId) this.reg.disconnect(this.masterId);
    this.roots = []; this.status = 'idle'; this.emit(); try { this.sock.destroy(); } catch {}
  }
}
export const user = new UserClient();
