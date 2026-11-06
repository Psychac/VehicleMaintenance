import { useState } from 'react';
import { IconBell, IconCheck, IconPlus, IconTrash } from '../components/icons';
import type { ReminderState } from '../lib/calc';
import type { Reminder } from '../lib/types';
import { Button, EmptyState, Fade, ListGroup, Row, ScreenHeader, SkeletonRows, useCompletion, useToast } from '../ui';
import ReminderSheet from './ReminderSheet';
import { deleteWithUndo, dueText, markDoneNow, odometerOf, reminderRows, type Editing, type VehicleScope } from './shared';
import { useShell } from './shell';

const GROUPS: { state: ReminderState; header: string }[] = [
  { state: 'overdue', header: 'Overdue' },
  { state: 'soon', header: 'Due soon' },
  { state: 'ok', header: 'On track' },
  { state: 'unknown', header: 'Not started' },
];

/**
 * Reminders grouped by urgency, so the header words carry the status and the rows stay quiet.
 * Swipe right (or long-press) marks a reminder done today; swipe left deletes. Tapping opens the
 * detail, where the date can be chosen.
 */
export default function Reminders({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
  const toast = useToast();
  const celebrate = useCompletion();
  const [editing, setEditing] = useState<Editing<Reminder>>(null);
  const [startMode, setStartMode] = useState<'detail' | 'edit'>('detail');
  const odo = odometerOf(scope);
  const rows = reminderRows(scope);
  const overdue = rows.filter((x) => x.s.state === 'overdue').length;
  const soon = rows.filter((x) => x.s.state === 'soon').length;
  const subtitle = rows.length === 0 ? undefined : overdue + soon === 0 ? 'Everything is on track' : [overdue && `${overdue} overdue`, soon && `${soon} due soon`].filter(Boolean).join(' · ');

  const open = (r: Reminder, mode: 'detail' | 'edit' = 'detail') => {
    setStartMode(mode);
    setEditing(r);
  };
  const done = (r: Reminder) => markDoneNow(r, odo, toast, celebrate, reload);
  const remove = (r: Reminder) => deleteWithUndo('reminders', r, 'Reminder deleted', toast, reload);

  return (
    <>
      <ScreenHeader title="Reminders" subtitle={subtitle} trailing={shell.vehicleButton} />

      <div className="screen">
        <Fade id={loading ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}>
          {loading ? (
            <ListGroup label="Loading">
              <SkeletonRows count={5} />
            </ListGroup>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconBell size={56} />}
              title="Nothing to track yet"
              message="Add oil changes, insurance or tyres."
              action={{ label: 'Add reminder', icon: <IconPlus size={18} />, onPress: () => { setStartMode('detail'); setEditing('new'); } }}
            />
          ) : (
            GROUPS.map(({ state, header }) => {
              const group = rows.filter((x) => x.s.state === state);
              return group.length === 0 ? null : (
                <ListGroup key={state} header={header} live>
                  {group.map(({ r, s }) => (
                    <Row
                      key={r.id}
                      title={r.title}
                      subtitle={dueText(s)}
                      onPress={() => open(r)}
                      chevron
                      menu={[
                        { label: 'Mark done today', onSelect: () => void done(r) },
                        { label: 'Edit', onSelect: () => open(r, 'edit') },
                        { label: 'Delete', destructive: true, onSelect: () => void remove(r) },
                      ]}
                      swipe={{
                        leading: { label: 'Done', icon: <IconCheck size={18} />, tone: 'positive', onCommit: () => done(r) },
                        trailing: { label: 'Delete', icon: <IconTrash size={18} />, tone: 'destructive', onCommit: () => remove(r) },
                      }}
                    />
                  ))}
                </ListGroup>
              );
            })
          )}
        </Fade>

        {!loading && rows.length > 0 && (
          <div className="action-bar">
            <Button
              size="large"
              icon={<IconPlus size={18} />}
              onClick={() => {
                setStartMode('detail');
                setEditing('new');
              }}
            >
              Add reminder
            </Button>
          </div>
        )}
      </div>

      <ReminderSheet editing={editing} vehicleId={scope.vehicle.id} odometer={odo} startMode={startMode} onClose={() => setEditing(null)} reload={reload} />
    </>
  );
}
