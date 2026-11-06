import { useState } from 'react';
import { deleteRow, insertRow, updateRow } from '../lib/db';
import { numOrNull, strOrNull } from '../lib/format';
import type { Vehicle } from '../lib/types';
import { Button, SelectField, Sheet, TextField, Toggle, haptic, useToast } from '../ui';
import { FailureBanner, FormStack, SaveButton, useEntryForm, useOpenKey } from './forms';
import type { Editing } from './shared';

const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  editing: Editing<Vehicle>;
  /** Fuel + service + reminder entries on the vehicle being edited, named on the delete button. */
  entryCount: number;
  onClose: () => void;
  /** Called with the new vehicle's id so it becomes the selected one. */
  onCreated: (id: string) => void;
  reload: () => Promise<void>;
}

/** Add or edit a vehicle. Deleting is irreversible (it takes its entries with it), so it asks, and names the cost. */
export default function VehicleSheet(props: Props) {
  return <VehicleSheetInner key={useOpenKey(props.editing)} {...props} />;
}

function VehicleSheetInner({ editing, entryCount, onClose, onCreated, reload }: Props) {
  const toast = useToast();
  const form = useEntryForm();
  const [snap] = useState(editing);
  const vehicle = snap === 'new' || snap === null ? null : snap;
  const [confirming, setConfirming] = useState(false);
  const id = 'vehicle-form';

  const save = form.submit(async (f) => {
    if (!form.requireFields(f, { name: 'Give the vehicle a name', start_odometer: 'Add the odometer reading' })) return;
    const row = {
      name: String(f.get('name')).trim(),
      make: strOrNull(f.get('make')),
      model: strOrNull(f.get('model')),
      year: numOrNull(f.get('year')),
      plate: strOrNull(f.get('plate')),
      fuel_type: String(f.get('fuel_type')),
      start_odometer: numOrNull(f.get('start_odometer')) ?? 0,
      archived: f.get('archived') === 'on',
    };
    await form.run(async () => {
      if (vehicle) {
        await updateRow('vehicles', vehicle.id, row);
        await reload();
      } else {
        const created = await insertRow('vehicles', row);
        await reload();
        onCreated(created.id);
      }
      onClose();
    });
  });

  const archive = async () => {
    if (!vehicle) return;
    await form.run(async () => {
      await updateRow('vehicles', vehicle.id, { archived: true });
      await reload();
      onClose();
      toast({ message: `${vehicle.name} archived`, action: { label: 'Undo', onPress: async () => { await updateRow('vehicles', vehicle.id, { archived: false }); await reload(); } } });
    });
  };

  const destroy = async () => {
    if (!vehicle) return;
    await form.run(async () => {
      await deleteRow('vehicles', vehicle.id);
      await reload();
      onClose();
      toast({ message: `${vehicle.name} deleted` });
    });
  };

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={confirming ? 'Delete vehicle' : vehicle ? 'Edit vehicle' : 'Add vehicle'}
      dirty={!confirming && form.dirty && !form.busy}
      detents={confirming ? ['medium'] : ['large']}
      action={confirming ? undefined : <SaveButton form={id} busy={form.busy} />}
    >
      {confirming && vehicle ? (
        <FormStack>
          <p className="form-note">
            {entryCount === 0
              ? `${vehicle.name} has no entries yet.`
              : `${vehicle.name} and its ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} will be deleted. This can't be undone.`}
          </p>
          <FailureBanner message={form.failure} what="delete the vehicle" />
          <Button variant="destructive" size="large" fullWidth loading={form.busy} onClick={destroy}>
            {entryCount === 0 ? `Delete ${vehicle.name}` : `Delete ${vehicle.name} and ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          </Button>
          {!vehicle.archived && (
            <Button variant="secondary" size="large" fullWidth disabled={form.busy} onClick={archive}>
              Archive instead
            </Button>
          )}
          <Button variant="tertiary" fullWidth onClick={() => setConfirming(false)}>
            Keep {vehicle.name}
          </Button>
        </FormStack>
      ) : (
        <form id={id} noValidate onSubmit={save} onChange={form.markDirty}>
          <FormStack>
            <TextField
              label="Name"
              name="name"
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Family car"
              defaultValue={vehicle?.name ?? ''}
              error={form.errors.name}
              onChange={() => form.clearError('name')}
            />
            <TextField label="Make" name="make" autoCapitalize="words" enterKeyHint="next" defaultValue={vehicle?.make ?? ''} />
            <TextField label="Model" name="model" autoCapitalize="words" enterKeyHint="next" defaultValue={vehicle?.model ?? ''} />
            <TextField label="Year" name="year" inputMode="numeric" enterKeyHint="next" defaultValue={vehicle?.year ?? ''} />
            <TextField label="Registration" name="plate" autoCapitalize="characters" enterKeyHint="next" defaultValue={vehicle?.plate ?? ''} />
            <SelectField label="Fuel" name="fuel_type" defaultValue={vehicle?.fuel_type ?? 'petrol'}>
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {cap(t)}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Odometer when you start tracking (km)"
              name="start_odometer"
              inputMode="numeric"
              enterKeyHint="done"
              defaultValue={vehicle?.start_odometer ?? ''}
              error={form.errors.start_odometer}
              onChange={() => form.clearError('start_odometer')}
            />
            {vehicle && <Toggle label="Archived" description="Hidden from the vehicle list. Sold or no longer used." name="archived" defaultChecked={vehicle.archived} />}
            <FailureBanner message={form.failure} what="save the vehicle" />
            {vehicle && (
              <Button
                variant="destructive"
                size="large"
                fullWidth
                disabled={form.busy}
                onClick={() => {
                  haptic('warning');
                  setConfirming(true);
                }}
              >
                Delete vehicle
              </Button>
            )}
          </FormStack>
        </form>
      )}
    </Sheet>
  );
}
