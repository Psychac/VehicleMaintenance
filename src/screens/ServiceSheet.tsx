import { useState } from 'react';
import { insertRow, updateRow } from '../lib/db';
import { numOrNull, strOrNull, today } from '../lib/format';
import { SERVICE_CATEGORIES, type Reminder, type ServiceLog } from '../lib/types';
import { Button, ListGroup, SelectField, Sheet, TextArea, TextField, Toggle, useToast } from '../ui';
import { FailureBanner, FormStack, SaveButton, useEntryForm, useOpenKey } from './forms';
import { deleteWithUndo, type Editing } from './shared';

interface Props {
  editing: Editing<ServiceLog>;
  vehicleId: string;
  reminders: Reminder[];
  suggestedOdo: number;
  onClose: () => void;
  reload: () => Promise<void>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Add or edit a service, repair or running cost. Can also reset the reminders the job took care of. */
export default function ServiceSheet(props: Props) {
  return <ServiceSheetInner key={useOpenKey(props.editing)} {...props} />;
}

function ServiceSheetInner({ editing, vehicleId, reminders, suggestedOdo, onClose, reload }: Props) {
  const toast = useToast();
  const form = useEntryForm();
  const [snap] = useState(editing);
  const log = snap === 'new' || snap === null ? null : snap;
  const id = 'service-form';

  const save = form.submit(async (f) => {
    if (!form.requireFields(f, { title: 'Say what was done', cost: 'Add the cost' })) return;
    const row = {
      vehicle_id: vehicleId,
      date: String(f.get('date')) || today(),
      odometer: numOrNull(f.get('odometer')),
      category: String(f.get('category')),
      title: String(f.get('title')).trim(),
      cost: numOrNull(f.get('cost')) ?? 0,
      vendor: strOrNull(f.get('vendor')),
      notes: strOrNull(f.get('notes')),
    };
    const completes = f.getAll('completes').map(String);
    await form.run(async () => {
      if (log) await updateRow('service_logs', log.id, row);
      else await insertRow('service_logs', row);
      // Reset the interval of every reminder this job takes care of.
      for (const rid of completes) {
        await updateRow('reminders', rid, {
          last_done_date: row.date,
          ...(row.odometer !== null ? { last_done_odometer: row.odometer } : {}),
        });
      }
      await reload();
      onClose();
    });
  });

  const remove = async () => {
    if (!log) return;
    onClose();
    try {
      await deleteWithUndo('service_logs', log, 'Entry deleted', toast, reload);
    } catch (e) {
      toast({ message: `Couldn't delete the entry. ${(e as Error).message}`, tone: 'error' });
    }
  };

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={log ? 'Edit entry' : 'Add service'}
      dirty={form.dirty && !form.busy}
      action={<SaveButton form={id} busy={form.busy} />}
    >
      <form id={id} noValidate onSubmit={save} onChange={form.markDirty}>
        <FormStack>
          <TextField
            label="What was done"
            name="title"
            autoCapitalize="sentences"
            enterKeyHint="next"
            placeholder="10,000 km service"
            defaultValue={log?.title ?? ''}
            error={form.errors.title}
            onChange={() => form.clearError('title')}
          />
          <TextField
            label="Cost"
            name="cost"
            inputMode="decimal"
            enterKeyHint="next"
            defaultValue={log?.cost ?? ''}
            error={form.errors.cost}
            onChange={() => form.clearError('cost')}
          />
          <SelectField label="Category" name="category" defaultValue={log?.category ?? 'service'}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {cap(c)}
              </option>
            ))}
          </SelectField>
          <TextField label="Date" name="date" type="date" defaultValue={log?.date ?? today()} />
          <TextField
            label="Odometer (km)"
            name="odometer"
            inputMode="decimal"
            enterKeyHint="next"
            placeholder={`Last ${suggestedOdo}`}
            defaultValue={log?.odometer ?? ''}
          />
          <TextField label="Garage or vendor" name="vendor" autoCapitalize="words" enterKeyHint="next" defaultValue={log?.vendor ?? ''} />
          <TextArea label="Notes" name="notes" rows={2} autoCapitalize="sentences" defaultValue={log?.notes ?? ''} />
          {reminders.length > 0 && (
            <ListGroup header="Also mark as done" footer="Resets the reminder to this date and odometer reading.">
              {reminders.map((r) => (
                <li key={r.id} className="ui-row-item">
                  <div className="ui-row form-toggle-row">
                    <Toggle label={r.title} name="completes" value={r.id} />
                  </div>
                </li>
              ))}
            </ListGroup>
          )}
          <FailureBanner message={form.failure} what="save the entry" />
          {log && (
            <Button variant="destructive" size="large" fullWidth onClick={remove} disabled={form.busy}>
              Delete entry
            </Button>
          )}
        </FormStack>
      </form>
    </Sheet>
  );
}
