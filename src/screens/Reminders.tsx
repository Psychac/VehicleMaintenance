import { useState } from 'react';
import { IconBell, IconCheck, IconChevronLeft, IconPlus, IconTrash } from '../components/icons';
import { reminderProgress, type ReminderState } from '../lib/calc';
import type { Reminder } from '../lib/types';
import { Button, EmptyState, Fade, IconButton, Inspector, ListGroup, Row, ScreenHeader, SkeletonRows, useCompletion, useHasInspector, useShortcuts, useToast } from '../ui';
import ReminderSheet from './ReminderSheet';
import { fmtKm, fmtShortDate } from '../lib/format';
import { ReminderBadge, deleteWithUndo, dueText, markDoneNow, odometerOf, reminderRows, type Editing, type VehicleScope } from './shared';
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
  const desktop = useHasInspector();
  const [selId, setSelId] = useState<string | null>(null);
  // On desktop the most urgent reminder is selected by default so the panel is never empty.
  const selected = desktop ? (rows.find((x) => x.r.id === selId) ?? rows[0] ?? null) : null;
  useShortcuts({ n: () => { setStartMode('detail'); setEditing('new'); } }, !loading);
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
      <ScreenHeader
        inline
        title="Reminders"
        subtitle={subtitle}
        leading={<IconButton label="Back" tone="accent" icon={<IconChevronLeft size={22} />} onClick={shell.back} />}
        trailing={
          <>
            <span className="desktop-only header-actions">
              <Button icon={<IconPlus size={18} />} aria-keyshortcuts="n" onClick={() => { setStartMode('detail'); setEditing('new'); }}>
                Add reminder <kbd aria-hidden="true">N</kbd>
              </Button>
            </span>
            {shell.vehicleButton}
          </>
        }
      />

      <div className="screen">
        <Fade id={loading ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}>
          <div className="split-main">
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
                      progress={reminderProgress(r, s) ?? undefined}
                      selected={desktop && selected?.r.id === r.id}
                      onPress={() => (desktop ? setSelId(r.id) : open(r))}
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
          </div>
          {desktop && !loading && selected && (
            <Inspector
              title={selected.r.title}
              badge={<ReminderBadge status={selected.s} />}
              subtitle={dueText(selected.s)}
              progress={reminderProgress(selected.r, selected.s) ?? undefined}
              items={[
                { label: 'Every', value: [selected.r.interval_km && fmtKm(Number(selected.r.interval_km)), selected.r.interval_months && `${selected.r.interval_months} months`].filter(Boolean).join(' or ') },
                { label: 'Last done', value: selected.r.last_done_date ? `${fmtShortDate(selected.r.last_done_date)}${selected.r.last_done_odometer != null ? ' · ' + fmtKm(Number(selected.r.last_done_odometer)) : ''}` : 'Not recorded' },
                ...(selected.r.notes ? [{ label: 'Notes', value: selected.r.notes }] : []),
              ]}
              actions={
                <>
                  <Button onClick={() => void done(selected.r)}>Mark done today</Button>
                  <Button variant="secondary" onClick={() => open(selected.r, 'edit')}>Edit</Button>
                  <Button variant="tertiary" onClick={() => void remove(selected.r)}>Delete</Button>
                </>
              }
            />
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
