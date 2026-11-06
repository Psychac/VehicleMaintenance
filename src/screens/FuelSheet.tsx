import { useState } from 'react';
import { insertRow, updateRow } from '../lib/db';
import { numOrNull, strOrNull, today } from '../lib/format';
import type { FuelLog } from '../lib/types';
import { Button, Sheet, TextArea, TextField, Toggle, useToast } from '../ui';
import { FailureBanner, FormStack, SaveButton, useEntryForm, useOpenKey } from './forms';
import { deleteWithUndo, type Editing } from './shared';

interface Props {
  editing: Editing<FuelLog>;
  vehicleId: string;
  suggestedOdo: number;
  onClose: () => void;
  reload: () => Promise<void>;
}

/** Add or edit a fill-up. The most frequent action in the app: three required fields, the rest optional. */
export default function FuelSheet(props: Props) {
  return <FuelSheetInner key={useOpenKey(props.editing)} {...props} />;
}

function FuelSheetInner({ editing, vehicleId, suggestedOdo, onClose, reload }: Props) {
  const toast = useToast();
  const form = useEntryForm();
  const [snap] = useState(editing);
  const log = snap === 'new' || snap === null ? null : snap;
  const id = 'fuel-form';

  const save = form.submit(async (f) => {
    if (!form.requireFields(f, { odometer: 'Add the odometer reading', litres: 'Add the litres', total_cost: 'Add the total cost' })) return;
    const row = {
      vehicle_id: vehicleId,
      date: String(f.get('date')) || today(),
      odometer: numOrNull(f.get('odometer')) ?? 0,
      litres: numOrNull(f.get('litres')) ?? 0,
      total_cost: numOrNull(f.get('total_cost')) ?? 0,
      full_tank: f.get('full_tank') === 'on',
      remaining_litres: numOrNull(f.get('remaining_litres')),
      station: strOrNull(f.get('station')),
      notes: strOrNull(f.get('notes')),
    };
    await form.run(async () => {
      if (log) await updateRow('fuel_logs', log.id, row);
      else await insertRow('fuel_logs', row);
      await reload();
      onClose();
    });
  });

  const remove = async () => {
    if (!log) return;
    onClose();
    try {
      await deleteWithUndo('fuel_logs', log, 'Fill-up deleted', toast, reload);
    } catch (e) {
      toast({ message: `Couldn't delete the fill-up. ${(e as Error).message}`, tone: 'error' });
    }
  };

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={log ? 'Edit fill-up' : 'Add fill-up'}
      dirty={form.dirty && !form.busy}
      action={<SaveButton form={id} busy={form.busy} />}
    >
      <form id={id} noValidate onSubmit={save} onChange={form.markDirty}>
        <FormStack>
          <TextField label="Date" name="date" type="date" defaultValue={log?.date ?? today()} />
          <TextField
            label="Odometer (km)"
            name="odometer"
            inputMode="decimal"
            enterKeyHint="next"
            placeholder={`Last ${suggestedOdo}`}
            defaultValue={log?.odometer ?? ''}
            error={form.errors.odometer}
            onChange={() => form.clearError('odometer')}
          />
          <TextField
            label="Litres"
            name="litres"
            inputMode="decimal"
            enterKeyHint="next"
            defaultValue={log?.litres ?? ''}
            error={form.errors.litres}
            onChange={() => form.clearError('litres')}
          />
          <TextField
            label="Total cost"
            name="total_cost"
            inputMode="decimal"
            enterKeyHint="done"
            defaultValue={log?.total_cost ?? ''}
            error={form.errors.total_cost}
            onChange={() => form.clearError('total_cost')}
          />
          <Toggle label="Filled to full tank" description="Needed to work out mileage" name="full_tank" defaultChecked={log?.full_tank ?? true} />
          <TextField
            label="Fuel left before filling (litres)"
            name="remaining_litres"
            inputMode="decimal"
            enterKeyHint="next"
            hint="From the dashboard display. Optional."
            defaultValue={log?.remaining_litres ?? ''}
          />
          <TextField label="Station" name="station" autoCapitalize="words" enterKeyHint="next" defaultValue={log?.station ?? ''} />
          <TextArea label="Notes" name="notes" rows={2} autoCapitalize="sentences" defaultValue={log?.notes ?? ''} />
          <FailureBanner message={form.failure} what="save the fill-up" />
          {log && (
            <Button variant="destructive" size="large" fullWidth onClick={remove} disabled={form.busy}>
              Delete fill-up
            </Button>
          )}
        </FormStack>
      </form>
    </Sheet>
  );
}
