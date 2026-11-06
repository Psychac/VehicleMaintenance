import { useState } from 'react';
import { IconBell, IconPlus } from '../components/icons';
import type { ReminderState } from '../lib/calc';
import type { Reminder } from '../lib/types';
import { Button, EmptyState, ListGroup, Row, ScreenHeader, SkeletonRows } from '../ui';
import ReminderSheet from './ReminderSheet';
import { dueText, odometerOf, reminderRows, type Editing, type VehicleScope } from './shared';
import { useShell } from './shell';

const GROUPS: { state: ReminderState; header: string }[] = [
  { state: 'overdue', header: 'Overdue' },
  { state: 'soon', header: 'Due soon' },
  { state: 'ok', header: 'On track' },
  { state: 'unknown', header: 'Not started' },
];

/** Reminders grouped by urgency, so the header words carry the status and the rows stay quiet. */
export default function Reminders({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
  const [editing, setEditing] = useState<Editing<Reminder>>(null);
  const rows = reminderRows(scope);
  const overdue = rows.filter((x) => x.s.state === 'overdue').length;
  const soon = rows.filter((x) => x.s.state === 'soon').length;
  const subtitle = rows.length === 0 ? undefined : overdue + soon === 0 ? 'Everything is on track' : [overdue && `${overdue} overdue`, soon && `${soon} due soon`].filter(Boolean).join(' · ');

  return (
    <>
      <ScreenHeader title="Reminders" subtitle={subtitle} trailing={shell.vehicleButton} />

      <div className="screen">
        {loading ? (
          <ListGroup label="Loading">
            <SkeletonRows count={5} />
          </ListGroup>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconBell size={56} />}
            title="Nothing to track yet"
            message="Add oil changes, insurance or tyres."
            action={{ label: 'Add reminder', icon: <IconPlus size={18} />, onPress: () => setEditing('new') }}
          />
        ) : (
          GROUPS.map(({ state, header }) => {
            const group = rows.filter((x) => x.s.state === state);
            return group.length === 0 ? null : (
              <ListGroup key={state} header={header}>
                {group.map(({ r, s }) => (
                  <Row key={r.id} title={r.title} subtitle={dueText(s)} onPress={() => setEditing(r)} chevron />
                ))}
              </ListGroup>
            );
          })
        )}

        {rows.length > 0 && (
          <div className="action-bar">
            <Button size="large" icon={<IconPlus size={18} />} onClick={() => setEditing('new')}>
              Add reminder
            </Button>
          </div>
        )}
      </div>

      <ReminderSheet editing={editing} vehicleId={scope.vehicle.id} odometer={odometerOf(scope)} onClose={() => setEditing(null)} reload={reload} />
    </>
  );
}
