import React, { useState } from 'react';
import { StatusBar, View, useColorScheme, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Screen, Card, H, P, Btn, Input, useTheme } from './src/ui/kit';
import Master from './src/ui/Master';
import User from './src/ui/User';
import { checkPassword } from './src/net/crypto';

export default function App() {
  const t = useTheme(); const dark = useColorScheme() === 'dark';
  const [screen, setScreen] = useState<'role' | 'login' | 'master' | 'user'>('role');
  const [u, setU] = useState(''); const [p, setP] = useState('');
  let body;
  if (screen === 'master') body = <Master onExit={() => { setP(''); setScreen('role'); }} />;
  else if (screen === 'user') body = <User onExit={() => setScreen('role')} />;
  else if (screen === 'login') body = (
    <Screen><Card>
      <H>Master Login</H>
      <Input placeholder="Username" autoCapitalize="none" value={u} onChangeText={setU} />
      <Input placeholder="Password" secureTextEntry value={p} onChangeText={setP} />
      <Btn title="Login" onPress={() => checkPassword(u.trim(), p) ? setScreen('master') : Alert.alert('Login failed', 'Wrong username or password.')} />
      <Btn kind="ghost" title="Back" onPress={() => setScreen('role')} />
    </Card></Screen>);
  else body = (
    <Screen>
      <H size={28}>LOCAL CONNECT</H>
      <P dim>Consent-based local file sharing. Choose this device's role.</P>
      <View style={{ height: 16 }} />
      <Btn title="Master (login required)" onPress={() => setScreen('login')} />
      <Btn kind="ghost" title="User / Receiver" onPress={() => setScreen('user')} />
    </Screen>);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>{body}</SafeAreaView>
    </SafeAreaProvider>
  );
}
