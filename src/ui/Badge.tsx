import type { ReactNode } from 'react';
import { IconAlert, IconCheck, IconClock } from '../components/icons';

export type BadgeTone = 'overdue' | 'soon' | 'ok' | 'neutral';

const GLYPH: Record<BadgeTone, ReactNode> = {
  overdue: <IconAlert size={12} />,
  soon: <IconClock size={12} />,
  ok: <IconCheck size={12} />,
  neutral: null,
};

/** Status pill. Meaning is carried by an icon shape plus the word, never by colour alone (S10). */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className="ui-badge" data-tone={tone}>
      {GLYPH[tone]}
      {children}
    </span>
  );
}
