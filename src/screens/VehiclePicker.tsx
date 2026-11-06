import { IconCheck, IconPlus } from '../components/icons';
import type { Vehicle } from '../lib/types';
import { ListGroup, Row, Sheet } from '../ui';
import { vehicleDetails } from './shared';

/** Switch between vehicles, or add one. Opens from the vehicle button in the headers and the sidebar. */
export default function VehiclePicker({
  open,
  vehicles,
  selectedId,
  onSelect,
  onAdd,
  onClose,
}: {
  open: boolean;
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Vehicles" detents={['medium', 'large']}>
      <ListGroup label="Your vehicles">
        {vehicles.map((v) => (
          <Row
            key={v.id}
            title={v.name}
            subtitle={[vehicleDetails(v), v.plate].filter(Boolean).join(' · ') || undefined}
            selected={v.id === selectedId}
            trailing={v.id === selectedId ? <IconCheck size={18} /> : undefined}
            haptic="selection"
            onPress={() => {
              onSelect(v.id);
              onClose();
            }}
          />
        ))}
        <Row leading={<IconPlus size={18} />} title="Add vehicle" onPress={onAdd} />
      </ListGroup>
    </Sheet>
  );
}
