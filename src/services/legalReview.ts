// Ephemeral reading UI only. This never grants service access or replaces server consent.
import { useSyncExternalStore } from 'react';
export type PolicyKind = 'terms' | 'privacy';
let reviewed = { terms: false, privacy: false };
const listeners = new Set<() => void>();
export function setPolicyReviewed(kind: PolicyKind, value: boolean) {
  reviewed = { ...reviewed, [kind]: value };
  listeners.forEach(fn => fn());
}
export function resetPolicyReview() {
  reviewed = { terms: false, privacy: false };
  listeners.forEach(fn => fn());
}
export function usePolicyReview() {
  return useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => reviewed,
  );
}
