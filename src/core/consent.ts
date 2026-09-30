// LocalConnect consent core. Runs on the User device and is the ONLY authority
// on whether the Master may see or fetch a file. The Master's own state is display-only.

export type PermissionState =
  | 'NOT_CONNECTED' | 'CONNECTED' | 'T_AND_C_PENDING' | 'T_AND_C_ACCEPTED'
  | 'FILE_PERMISSION_PENDING' | 'FILE_ACCESS_GRANTED' | 'FILE_ACCESS_REVOKED' | 'DISCONNECTED';

// Legal transitions. Anything else is rejected.
const NEXT: Record<PermissionState, PermissionState[]> = {
  NOT_CONNECTED: ['CONNECTED'],
  CONNECTED: ['T_AND_C_PENDING', 'DISCONNECTED'],
  T_AND_C_PENDING: ['T_AND_C_ACCEPTED', 'DISCONNECTED'],
  T_AND_C_ACCEPTED: ['FILE_PERMISSION_PENDING', 'DISCONNECTED'],
  FILE_PERMISSION_PENDING: ['FILE_ACCESS_GRANTED', 'T_AND_C_ACCEPTED', 'DISCONNECTED'],
  FILE_ACCESS_GRANTED: ['FILE_ACCESS_REVOKED', 'DISCONNECTED'],
  FILE_ACCESS_REVOKED: ['FILE_PERMISSION_PENDING', 'DISCONNECTED'], // re-grant needs a fresh picker choice
  DISCONNECTED: ['NOT_CONNECTED'],
};

export interface LogEntry { at: number; masterId: string; event: string }

export interface MasterSession {
  masterId: string;
  masterName: string;
  sessionId: string;
  expiresAt: number;
  state: PermissionState;
  tcAcknowledged: boolean;
  // SAF tree/document URIs the user picked in the system picker. Nothing else is reachable.
  grantedUris: string[];
}

export type Denial = { ok: false; reason: string };
export type Allow = { ok: true };

export class ConsentRegistry {
  private sessions = new Map<string, MasterSession>(); // one independent entry per master
  private log: LogEntry[] = [];

  constructor(private now: () => number = Date.now) {}

  open(masterId: string, masterName: string, sessionId: string, ttlMs = 8 * 3600_000) {
    const s: MasterSession = {
      masterId, masterName, sessionId, expiresAt: this.now() + ttlMs,
      state: 'NOT_CONNECTED', tcAcknowledged: false, grantedUris: [],
    };
    this.sessions.set(masterId, s);
    this.go(s, 'CONNECTED');
    this.go(s, 'T_AND_C_PENDING');
    return s;
  }

  acceptTerms(masterId: string, checkboxTicked: boolean, scrolledToEnd: boolean): Allow | Denial {
    const s = this.sessions.get(masterId);
    if (!s || s.state !== 'T_AND_C_PENDING') return { ok: false, reason: 'Not awaiting T&C' };
    if (!checkboxTicked || !scrolledToEnd) return { ok: false, reason: 'T&C not acknowledged' };
    s.tcAcknowledged = true;
    this.go(s, 'T_AND_C_ACCEPTED'); // NOTE: this grants no file access
    this.go(s, 'FILE_PERMISSION_PENDING');
    return { ok: true };
  }

  // Call only with URIs returned by the Android system picker (ACTION_OPEN_DOCUMENT / _TREE).
  grantFiles(masterId: string, pickedUris: string[]): Allow | Denial {
    const s = this.sessions.get(masterId);
    if (!s || s.state !== 'FILE_PERMISSION_PENDING' || !s.tcAcknowledged)
      return { ok: false, reason: 'Terms not accepted' };
    if (pickedUris.length === 0) return { ok: false, reason: 'Nothing selected' };
    s.grantedUris = [...pickedUris];
    this.go(s, 'FILE_ACCESS_GRANTED');
    return { ok: true };
  }

  revoke(masterId: string) {
    const s = this.sessions.get(masterId);
    if (!s) return;
    s.grantedUris = []; // scope cleared immediately; in-flight transfers must check validate() per chunk
    if (s.state === 'FILE_ACCESS_GRANTED') this.go(s, 'FILE_ACCESS_REVOKED');
  }

  // Master asked again after a revoke: the user must pick files again in the system picker.
  requestAgain(masterId: string) {
    const s = this.sessions.get(masterId);
    if (s && s.state === 'FILE_ACCESS_REVOKED') this.go(s, 'FILE_PERMISSION_PENDING');
  }

  disconnect(masterId: string) {
    const s = this.sessions.get(masterId);
    if (!s || s.state === 'DISCONNECTED') return;
    s.grantedUris = [];
    this.go(s, 'DISCONNECTED');
    this.record(s, 'Connection disconnected');
  }

  // The full chain from the spec: connected -> T&C -> permission -> scope -> session active.
  validate(masterId: string, sessionId: string, requestedUri: string): Allow | Denial {
    const s = this.sessions.get(masterId);
    const deny = (reason: string): Denial => {
      if (s) this.record(s, `DENIED: ${reason}`);
      return { ok: false, reason };
    };
    if (!s || s.sessionId !== sessionId) return { ok: false, reason: 'Unknown session' };
    if (s.state === 'NOT_CONNECTED' || s.state === 'DISCONNECTED') return deny('Not connected');
    if (!s.tcAcknowledged) return deny('T&C not accepted');
    if (s.state !== 'FILE_ACCESS_GRANTED') return deny('File access not granted');
    if (!s.grantedUris.some(root => this.within(root, requestedUri))) return deny('Outside approved scope');
    if (this.now() > s.expiresAt) return deny('Session expired');
    return { ok: true };
  }

  record(s: MasterSession, event: string) {
    this.log.push({ at: this.now(), masterId: s.masterId, event });
  }
  accessLog(masterId: string) { return this.log.filter(l => l.masterId === masterId); }
  get(masterId: string) { return this.sessions.get(masterId); }

  private within(root: string, uri: string) {
    // Exact document, or child of a picked tree. Reject path tricks.
    if (uri.includes('..')) return false;
    return uri === root || uri.startsWith(root.endsWith('/') ? root : root + '/');
  }

  private go(s: MasterSession, to: PermissionState) {
    if (!NEXT[s.state].includes(to)) throw new Error(`Illegal transition ${s.state} -> ${to}`);
    s.state = to;
    this.record(s, `State: ${to}`);
  }
}
