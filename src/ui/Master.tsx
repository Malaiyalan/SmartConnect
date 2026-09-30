import React, { useState } from 'react';
import { ScrollView, View, Modal, Text, FlatList } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { master, Dev, Item } from '../net/master';
import { useStore } from '../net/store';
import { Screen, Card, H, P, Btn, Badge, useTheme, row, Bar, mb, stateColor } from './kit';
import { DebugMaster } from './Debug';

export default function Master({ onExit }: { onExit: () => void }) {
  useStore(master);
  const t = useTheme();
  const [tab, setTab] = useState<'dev' | 'tr' | 'his' | 'dbg'>('dev');
  const [pair, setPair] = useState<string | null>(null);
  const [browse, setBrowse] = useState<string | null>(null);
  React.useEffect(() => { master.start(); }, []);
  const devs = master.list();
  const bd = devs.find(d => d.id === browse);
  if (bd) return <Browse d={bd} onBack={() => setBrowse(null)} />;

  return (
    <Screen>
      <H size={24}>LOCAL CONNECT</H>
      <P dim>MASTER DEVICE · Connected Devices: {devs.filter(d => d.connected && d.paired).length}</P>
      <View style={{ flexDirection: 'row', marginVertical: 8 }}>
        {(['dev', 'tr', 'his', 'dbg'] as const).map(k => (
          <View key={k} style={{ flex: 1 }}><Btn small kind={tab === k ? 'pri' : 'ghost'} title={{ dev: 'Devices', tr: 'Transfers', his: 'History', dbg: 'Debug' }[k]} onPress={() => setTab(k)} /></View>))}
      </View>
      <ScrollView>
        {tab === 'dev' && <>
          <Btn title="+ Connect Device" onPress={() => setPair(master.newPairing())} />
          {devs.map(d => (
            <Card key={d.id}>
              <H size={17}>{d.name}</H>
              <Badge text={d.connected ? '● Connected' : '○ Disconnected'} color={d.connected ? t.ok : t.bad} />
              <P>T&C: {d.tc ? 'Accepted' : 'Pending'}</P>
              <Badge text={`File Access: ${d.state === 'FILE_ACCESS_GRANTED' ? 'Granted' : d.state === 'FILE_ACCESS_REVOKED' ? 'Revoked' : 'Not Granted'}`} color={stateColor(d.state, t)} />
              {d.state === 'FILE_ACCESS_GRANTED' && <P dim>{d.count} shared item(s)</P>}
              {d.connected && (d.state === 'FILE_ACCESS_GRANTED'
                ? <Btn title="Browse Files" onPress={() => { master.browse(d); setBrowse(d.id); }} />
                : <Btn title="Request Access" kind="ghost" onPress={() => master.requestAccess(d)} />)}
              {d.connected && <Btn title="Disconnect" kind="bad" onPress={() => master.disconnect(d)} />}
            </Card>))}
          {!devs.length && <P dim>No devices yet. Tap “Connect Device”.</P>}
          <Btn kind="ghost" title="Log out (leave Master)" onPress={onExit} />
        </>}
        {tab === 'tr' && (master.transfers.length ? master.transfers.map(x => (
          <Card key={x.id}>
            <P>{x.name} · {x.devName}</P>
            <Bar pct={x.size ? (x.got / x.size) * 100 : 0} />
            <P dim>{mb(x.got)} / {mb(x.size)} · {x.status}{x.err ? ' · ' + x.err : ''}</P>
            {x.status === 'active' && <View style={row}><Btn small title="Pause" onPress={() => master.ctl(x, 'pause')} /><Btn small kind="bad" title="Cancel" onPress={() => master.ctl(x, 'cancel')} /></View>}
            {x.status === 'paused' && <View style={row}><Btn small title="Resume" onPress={() => master.ctl(x, 'resume')} /><Btn small kind="bad" title="Cancel" onPress={() => master.ctl(x, 'cancel')} /></View>}
            {(x.status === 'failed' || x.status === 'cancelled') && <Btn small title="Retry" onPress={() => master.retry(x)} />}
            {x.status === 'done' && <P dim>Saved: {x.dest}</P>}
          </Card>)) : <P dim>No transfers yet.</P>)}
        {tab === 'his' && master.history.map((h, i) => <P key={i} dim>{h}</P>)}
        {tab === 'dbg' && <DebugMaster />}
      </ScrollView>

      <Modal visible={!!pair} transparent animationType="fade" onRequestClose={() => setPair(null)}>
        <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 }}>
          <Card>
            <H>Pair a User device</H>
            <View style={{ alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12 }}>{pair && <QRCode value={pair} size={200} />}</View>
            <H size={30}>{master.code}</H>
            <P dim>Scan the QR or type the code on the User device. Valid for 2 minutes, one use. Master IP: {master.ip}</P>
            <Btn kind="ghost" title="Close" onPress={() => setPair(null)} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function Browse({ d, onBack }: { d: Dev; onBack: () => void }) {
  useStore(master);
  return (
    <Screen>
      <H>{d.name}'s Shared Files</H>
      {d.state !== 'FILE_ACCESS_GRANTED' || d.err
        ? <Card><H size={16}>ACCESS DENIED</H><P>The User has not granted permission to access this file.</P>{d.err && <P dim>{d.err}</P>}</Card> : null}
      <FlatList data={d.items} keyExtractor={i => i.uri} renderItem={({ item }: { item: Item }) => (
        <Card style={{ padding: 10 }}>
          <View style={row}>
            <Text style={{ flex: 1, color: '#888' }}>{item.type === 'directory' ? '📁' : '📄'} {item.name}</Text>
            {item.type === 'directory' ? <Btn small title="Open" onPress={() => master.browse(d, item)} /> : <Btn small title="Download" onPress={() => master.download(d, item)} />}
          </View>
          {item.type === 'file' && <P dim>{mb(item.size ?? 0)}</P>}
        </Card>)} />
      {d.trail.length > 0 && <Btn kind="ghost" title="⬆ Up" onPress={() => master.up(d)} />}
      <Btn kind="ghost" title="Back" onPress={onBack} />
    </Screen>
  );
}
