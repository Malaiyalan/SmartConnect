import { useEffect, useState } from 'react';
export class Store {
  private subs = new Set<() => void>();
  subscribe(f: () => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  emit() { this.subs.forEach(f => f()); }
}
export function useStore(s: Store) {
  const [, set] = useState(0);
  useEffect(() => s.subscribe(() => set(x => x + 1)), [s]);
}
