import { useMotionParts } from './motionLoader';

/** Pull-to-refresh for touch screens (see PullToRefreshImpl); renders once the motion chunk has loaded. */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const parts = useMotionParts();
  return parts ? <parts.PullToRefreshImpl onRefresh={onRefresh} /> : null;
}
