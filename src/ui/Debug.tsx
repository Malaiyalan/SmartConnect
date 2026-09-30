import React from 'react';
import { master } from '../net/master';
import { user } from '../net/user';
import { Card, P } from './kit';
const R = ({ k, v }: any) => <P>{k}: <P dim>{String(v)}</P></P>;
export const DebugMaster = () => (
  <Card>
    <R k="DEVICE ID" v="master" /><R k="SESSION ID" v={master.list().map(d => d.id).join(', ') || '-'} />
    <R k="CONNECTION STATUS" v={master.running ? 'listening' : 'stopped'} /><R k="LOCAL IP" v={master.ip} />
    <R k="PAIRING STATUS" v={master.code ? 'code active' : 'idle'} />
    {master.list().map(d => <R key={d.id} k={d.name} v={`${d.state} · T&C ${d.tc} · ${d.count} files · SAS ${d.sas}`} />)}
    <R k="TRANSFER STATUS" v={master.transfers[0]?.status ?? 'none'} />
  </Card>);
export const DebugUser = () => (
  <Card>
    <R k="DEVICE ID" v={user.deviceId} /><R k="SESSION ID" v={user.sessionId || '-'} />
    <R k="CONNECTION STATUS" v={user.status} /><R k="MASTER IP" v={user.ip || '-'} />
    <R k="PAIRING STATUS" v={user.masterName ? 'paired' : 'not paired'} />
    <R k="T&C STATUS" v={user.session?.tcAcknowledged ? 'accepted' : 'pending'} />
    <R k="FILE PERMISSION STATUS" v={user.state} /><R k="SHARED FILE COUNT" v={user.roots.length} /><R k="SAS" v={user.sas || '-'} />
  </Card>);
