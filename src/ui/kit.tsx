import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet, useColorScheme, TextInput } from 'react-native';

export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { bg: '#0E1116', card: '#1A1F27', text: '#F2F5F9', sub: '#9AA6B5', pri: '#4C8DFF', ok: '#2EC27E', bad: '#F0524F', warn: '#F5A524', line: '#2A313B' }
    : { bg: '#F3F5F9', card: '#FFFFFF', text: '#12161C', sub: '#5B6675', pri: '#2F6BFF', ok: '#1E9E62', bad: '#D93B38', warn: '#C77F0A', line: '#E1E6EE' };
}
export const Screen = ({ children }: any) => { const t = useTheme(); return <View style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>{children}</View>; };
export const Card = ({ children, style }: any) => { const t = useTheme(); return <View style={[{ backgroundColor: t.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: t.line }, style]}>{children}</View>; };
export const H = ({ children, size = 20 }: any) => { const t = useTheme(); return <Text style={{ color: t.text, fontSize: size, fontWeight: '700', marginBottom: 6 }}>{children}</Text>; };
export const P = ({ children, dim, style }: any) => { const t = useTheme(); return <Text style={[{ color: dim ? t.sub : t.text, fontSize: 14, marginVertical: 2 }, style]}>{children}</Text>; };
export const Btn = ({ title, onPress, kind = 'pri', disabled, small }: any) => {
  const t = useTheme(); const bg = kind === 'bad' ? t.bad : kind === 'ghost' ? 'transparent' : t.pri;
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={{ backgroundColor: bg, opacity: disabled ? 0.4 : 1, borderRadius: 12, paddingVertical: small ? 8 : 13, paddingHorizontal: 14, marginVertical: 4, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: t.line, alignItems: 'center' }}>
      <Text style={{ color: kind === 'ghost' ? t.text : '#fff', fontWeight: '600' }}>{title}</Text>
    </TouchableOpacity>
  );
};
export const Badge = ({ text, color }: any) => <Text style={{ color, borderColor: color, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, alignSelf: 'flex-start', marginVertical: 2 }}>{text}</Text>;
export const Input = (p: any) => { const t = useTheme(); return <TextInput placeholderTextColor={t.sub} {...p} style={{ color: t.text, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12, marginVertical: 6, backgroundColor: t.card }} />; };
export const Bar = ({ pct }: { pct: number }) => { const t = useTheme(); return <View style={{ height: 8, backgroundColor: t.line, borderRadius: 4, marginVertical: 6 }}><View style={{ width: `${Math.min(100, pct)}%`, height: 8, backgroundColor: t.pri, borderRadius: 4 }} /></View>; };
export const row = StyleSheet.create({ r: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } }).r;
export const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
export const stateColor = (s: string, t: any) => s === 'FILE_ACCESS_GRANTED' ? t.ok : s.includes('REVOKED') || s === 'DISCONNECTED' ? t.bad : t.warn;
