import React, { useState } from 'react';
import { ScrollView, View, PermissionsAndroid, Platform } from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { user } from '../net/user';
import { useStore } from '../net/store';
import { Screen, Card, H, P, Btn, Input, Badge, useTheme, stateColor } from './kit';
import { TERMS } from '../config';
import { DebugUser } from './Debug';

export default function User({ onExit }: { onExit: () => void }) {
  useStore(user);
  const t = useTheme();
  const [ip, setIp] = useState(''); const [code, setCode] = useState('');
  const [scan, setScan] = useState(false); const [terms, setTerms] = useState(false);
  const [ticked, setTicked] = useState(false); const [end, setEnd] = useState(false);
  const [dbg, setDbg] = useState(false);
  React.useEffect(() => { user.discover(); }, []);

  const startScan = async () => {
    if (Platform.OS === 'android') { const r = await PermissionsAndroid.request('android.permission.CAMERA' as any); if (r !== 'granted') return; }
    setScan(true);
  };
  if (scan) return (
    <Screen>
      <Camera style={{ flex: 1 }} scanBarcode showFrame onReadCode={(e: any) => {
        try { const p = JSON.parse(e.nativeEvent.codeStringValue); setIp(p.ip); setCode(p.code); setScan(false); user.connect(p.ip, p.code); } catch { setScan(false); }
      }} />
      <Btn kind="ghost" title="Cancel" onPress={() => setScan(false)} />
    </Screen>);
  if (dbg) return <Screen><ScrollView><DebugUser /></ScrollView><Btn kind="ghost" title="Back" onPress={() => setDbg(false)} /></Screen>;

  const connected = user.status === 'request' || user.status === 'active';
  const st = user.state;

  if (!connected) return (
    <Screen><ScrollView>
      <H size={24}>LOCAL CONNECT</H><P dim>USER DEVICE</P>
      <Card>
        <H size={16}>Connect to a Master</H>
        {user.found.map(f => <Btn key={f.ip} kind="ghost" title={`Found: ${f.name} (${f.ip})`} onPress={() => setIp(f.ip)} />)}
        <Input placeholder="Master IP (e.g. 192.168.1.20)" value={ip} onChangeText={setIp} keyboardType="numbers-and-punctuation" />
        <Input placeholder="6-digit pairing code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
        <Btn title={user.status === 'connecting' ? 'Connecting…' : 'Connect'} disabled={!ip || code.length !== 6 || user.status === 'connecting'} onPress={() => user.connect(ip.trim(), code)} />
        <Btn kind="ghost" title="Scan QR" onPress={startScan} />
        {user.status === 'error' && <P style={{ color: t.bad }}>{user.err}</P>}
      </Card>
      <Btn kind="ghost" title="Debug" onPress={() => setDbg(true)} />
      <Btn kind="ghost" title="Back" onPress={onExit} />
    </ScrollView></Screen>);

  if (st === 'T_AND_C_PENDING' && !terms) return (
    <Screen><Card>
      <H>MASTER CONNECTION REQUEST</H>
      <P>Master:</P><H size={18}>{user.masterName}</H>
      <P>Requested Access:</P><P>Local Files</P>
      <P dim>The Master is requesting access to files you choose to share on this device. Nothing is shared automatically.</P>
      <P dim>Check code (must match the Master's screen in Debug): {user.sas}</P>
      <Btn kind="ghost" title="View Terms & Conditions" onPress={() => setTerms(true)} />
      <Btn title="Accept & Continue" onPress={() => setTerms(true)} />
      <Btn kind="bad" title="Reject" onPress={() => user.disconnect()} />
    </Card></Screen>);

  if (st === 'T_AND_C_PENDING') return (
    <Screen>
      <H>Terms & Conditions</H><P dim>Please read the following terms carefully.</P>
      <Card style={{ flex: 1 }}>
        <ScrollView scrollEventThrottle={100} onScroll={e => { const n = e.nativeEvent; if (n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - 24) setEnd(true); }}>
          <P>{TERMS}</P>
        </ScrollView>
      </Card>
      <P onPress={() => setTicked(!ticked)}>{ticked ? '☑' : '☐'} I have read and understood the Terms & Conditions.</P>
      {!end && <P dim>Scroll to the end to enable this.</P>}
      <Btn title="Accept & Continue" disabled={!(ticked && end)} onPress={() => { user.acceptTerms(ticked, end); setTerms(false); }} />
      <Btn kind="ghost" title="Back" onPress={() => setTerms(false)} />
    </Screen>);

  if (st === 'FILE_PERMISSION_PENDING') return (
    <Screen><Card>
      <H>FILE ACCESS REQUEST</H>
      <P>The application needs permission to access files that you choose to share with {user.masterName}.</P>
      <P dim>You control what files are available. Terms acceptance alone shares nothing.</P>
      <Btn title="Choose Files" onPress={() => user.chooseFiles()} />
      <Btn title="Choose Folder" onPress={() => user.chooseFolder()} />
      <Btn kind="ghost" title="Cancel" onPress={() => user.disconnect()} />
    </Card></Screen>);

  return (
    <Screen><ScrollView>
      <Card>
        <H>ACTIVE CONNECTION</H>
        <P>Master:</P><H size={17}>{user.masterName}</H>
        <Badge text={st === 'FILE_ACCESS_GRANTED' ? 'File Access: ● Active' : 'File Access: Revoked'} color={stateColor(st, t)} />
        {st === 'FILE_ACCESS_GRANTED' && <><P dim>Shared items:</P>{user.roots.map(r => <P key={r.uri}>{r.type === 'directory' ? '📁' : '📄'} {r.name}</P>)}
          <Btn kind="bad" title="Revoke File Access" onPress={() => user.revoke()} /></>}
        {st === 'FILE_ACCESS_REVOKED' && <><H size={16}>FILE ACCESS REVOKED</H><P>The Master can no longer access your shared files.</P></>}
        <Btn kind="ghost" title="Disconnect Master" onPress={() => user.disconnect()} />
      </Card>
      <Card><H size={16}>ACCESS HISTORY</H>
        {user.log.length ? user.log.map((l, i) => <P key={i} dim>{new Date(l.at).toLocaleTimeString()}  {l.event}</P>) : <P dim>Nothing yet.</P>}
      </Card>
      <Btn kind="ghost" title="Debug" onPress={() => setDbg(true)} />
    </ScrollView></Screen>);
}
