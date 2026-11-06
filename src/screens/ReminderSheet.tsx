import { useState } from 'react';
import { reminderStatus } from '../lib/calc';
import { insertRow, updateRow } from '../lib/db';
import { fmtKm, fmtShortDate, numOrNull, strOrNull, today } from '../lib/format';
import type { Reminder } from '../lib/types';
import { Button, ListGroup, Row, Sheet, TextArea, TextField, useToast } from '../ui';
import { FailureBanner, FormStack, SaveButton, useEntryForm, useOpenKey } from './forms';
import { ReminderBadge, deleteWithUndo, dueText, type Editing } from './shared';

const SUGGESTIONS = [
  'Engine oil & filter',
  'Air filter',
  'Cabin filter',
  'Tyre rotation',
  'Brake fluid',
  'Coolant',
  'Battery check',
  'Insurance renewal',
  'Pollution (PUC) certificate',
  'Wheel alignment',
];

interface Props {
  editing: Editing<Reminder>;
  vehicleId: string;
  odometer: number;
  onClose: () => void;
  reload: () => Promise<void>;
}

type Mode = 'detail' | 'done' | 'edit';

/**
 * One sheet for a reminder's whole life: the detail view leads with the daily action (Mark done);
 * Edit and Delete sit one level down. New reminders open straight into the form.
 */
export default function ReminderSheet(props: Props) {
  return <ReminderSheetInner key={useOpenKey(props.editing)} {...props} />;
}

function ReminderSheetInner({ editing, vehicleId, odometer, onClose, reload }: Props) {
  const toast = useToast();
  const form = useEntryForm();
  const [snap] = useState(editing);
  const reminder = snap === 'new' || snap === null ? null : snap;
  const [mode, setMode] = useState<Mode>(reminder ? 'detail' : 'edit');
  const id = 'reminder-form';

  const status = reminder ? reminderStatus(reminder, odometer, today()) : null;

  const saveEdit = form.submit(async (f) => {
    if (!form.requireFields(f, { title: 'Name the item' })) return;
    const row = {
      vehicle_id: vehicleId,
      title: String(f.get('title')).trim(),
      interval_km: numOrNull(f.get('interval_km')),
      interval_months: numOrNull(f.get('interval_months')),
      last_done_date: strOrNull(f.get('last_done_date')),
      last_done_odometer: numOrNull(f.get('last_done_odometer')),
      notes: strOrNull(f.get('notes')),
    };
    if (!row.interval_km && !row.interval_months) {
      form.requireFields(f, { interval_km: 'Add a distance, a time, or both' });
      return;
    }
    await form.run(async () => {
      if (reminder) await updateRow('reminders', reminder.id, row);
      else await insertRow('reminders', row);
      await reload();
      onClose();
    });
  });

  const saveDone = form.submit(async (f) => {
    if (!reminder) return;
    await form.run(async () => {
      await updateRow('reminders', reminder.id, {
        last_done_date: String(f.get('date')) || today(),
        last_done_odometer: numOrNull(f.get('odometer')) ?? reminder.last_done_odometer,
      });
      await reload();
      onClose();
      toast({ message: `${reminder.title} marked done` });
    });
  });

  const remove = async () => {
    if (!reminder) return;
    onClose();
    try {
      await deleteWithUndo('reminders', reminder, 'Reminder deleted', toast, reload);
    } catch (e) {
      toast({ message: `Couldn't delete the reminder. ${(e as Error).message}`, tone: 'error' });
    }
  };

  const title = mode === 'detail' ? (reminder?.title ?? '') : mode === 'done' ? 'Mark done' : reminder ? 'Edit reminder' : 'Add reminder';

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={title}
      detents={mode === 'detail' ? ['medium', 'large'] : ['large']}
      dirty={mode !== 'detail' && form.dirty && !form.busy}
      action={mode === 'detail' ? undefined : <SaveButton form={id} busy={form.busy} />}
    >
      {mode === 'detail' && reminder && status && (
        <FormStack>
          <ListGroup label="Reminder details">
            <Row title="Status" trailing={<ReminderBadge status={status} />} />
            <Row title="Due" value={dueText(status)} />
            <Row
              title="Every"
              value={[
                reminder.interval_km && fmtKm(Number(reminder.interval_km)),
                reminder.interval_months && `${reminder.interval_months} months`,
              ]
                .filter(Boolean)
                .join(' or ')}
            />
            <Row
              title="Last done"
              value={
                reminder.last_done_date
                  ? `${fmtShortDate(reminder.last_done_date)}${reminder.last_done_odometer != null ? ` · ${fmtKm(Number(reminder.last_done_odometer))}` : ''}`
                  : 'Not recorded'
              }
            />
          </ListGroup>
          {reminder.notes && <p className="form-note">{reminder.notes}</p>}
          <Button size="large" fullWidth onClick={() => setMode('done')}>
            Mark done
          </Button>
          <Button variant="secondary" size="large" fullWidth onClick={() => setMode('edit')}>
            Edit reminder
          </Button>
        </FormStack>
      )}

      {mode === 'done' && reminder && (
        <form id={id} noValidate onSubmit={saveDone} onChange={form.markDirty}>
          <FormStack>
            <TextField label="Date done" name="date" type="date" defaultValue={today()} />
            <TextField label="Odometer (km)" name="odometer" inputMode="decimal" enterKeyHint="done" defaultValue={odometer} />
            <FailureBanner message={form.failure} what="save this" />
          </FormStack>
        </form>
      )}

      {mode === 'edit' && (
        <form id={id} noValidate onSubmit={saveEdit} onChange={form.markDirty}>
          <FormStack>
            <TextField
              label="Item"
              name="title"
              list="reminder-suggestions"
              autoCapitalize="sentences"
              enterKeyHint="next"
              defaultValue={reminder?.title ?? ''}
              error={form.errors.title}
              onChange={() => form.clearError('title')}
            />
            <datalist id="reminder-suggestions">
              {SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <TextField
              label="Every (km)"
              name="interval_km"
              inputMode="numeric"
              enterKeyHint="next"
              defaultValue={reminder?.interval_km ?? ''}
              error={form.errors.interval_km}
              onChange={() => form.clearError('interval_km')}
            />
            <TextField label="Every (months)" name="interval_months" inputMode="numeric" enterKeyHint="next" defaultValue={reminder?.interval_months ?? ''} />
            <TextField label="Last done on" name="last_done_date" type="date" defaultValue={reminder?.last_done_date ?? ''} />
            <TextField
              label="Last done at (km)"
              name="last_done_odometer"
              inputMode="numeric"
              enterKeyHint="next"
              defaultValue={reminder?.last_done_odometer ?? ''}
            />
            <TextArea label="Notes" name="notes" rows={2} placeholder="5W-30 synthetic, 3.5 L" defaultValue={reminder?.notes ?? ''} />
            <FailureBanner message={form.failure} what="save the reminder" />
            {reminder && (
              <Button variant="destructive" size="large" fullWidth onClick={remove} disabled={form.busy}>
                Delete reminder
              </Button>
            )}
          </FormStack>
        </form>
      )}
    </Sheet>
  );
}
