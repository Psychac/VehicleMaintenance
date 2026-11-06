import { useState } from 'react';
import { IconFuel, IconPlus, IconWrench } from '../components/icons';
import { averageEfficiency, fuelEfficiency } from '../lib/calc';
import { fmtDec, fmtKm, fmtMoney, fmtRelDate } from '../lib/format';
import { SERVICE_CATEGORIES, type FuelLog, type ServiceLog } from '../lib/types';
import { Button, EmptyState, ListGroup, Row, ScreenHeader, Segmented, SelectField, SkeletonRows } from '../ui';
import FuelSheet from './FuelSheet';
import ServiceSheet from './ServiceSheet';
import { odometerOf, type Editing, type VehicleScope } from './shared';
import { useShell } from './shell';

type Kind = 'fuel' | 'service';
const KEY = 'vehicle-log:log-kind';

function remembered(): Kind {
  try {
    return localStorage.getItem(KEY) === 'service' ? 'service' : 'fuel';
  } catch {
    return 'fuel';
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One history for everything you've logged. Fuel and service share a screen and a segmented switch. */
export default function Log({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
  const { vehicle, fuel, service, reminders } = scope;
  const [kind, setKindState] = useState<Kind>(remembered);
  const [fuelEdit, setFuelEdit] = useState<Editing<FuelLog>>(null);
  const [serviceEdit, setServiceEdit] = useState<Editing<ServiceLog>>(null);
  const [category, setCategory] = useState('all');
  const odo = odometerOf(scope);

  const setKind = (k: Kind) => {
    setKindState(k);
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* per-device convenience only */
    }
  };

  const fuelRows = fuelEfficiency(fuel).reverse();
  const avg = averageEfficiency(fuelRows);
  const serviceRows = service.filter((s) => category === 'all' || s.category === category).sort((a, b) => b.date.localeCompare(a.date));
  const addLabel = kind === 'fuel' ? 'Add fill-up' : 'Add service';

  return (
    <>
      <ScreenHeader title="Log" trailing={shell.vehicleButton} />

      <div className="screen">
        <Segmented
          label="Log type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'fuel', label: 'Fuel' },
            { value: 'service', label: 'Service' },
          ]}
        />

        {loading ? (
          <ListGroup label="Loading">
            <SkeletonRows count={6} />
          </ListGroup>
        ) : kind === 'fuel' ? (
          fuelRows.length === 0 ? (
            <EmptyState
              icon={<IconFuel size={56} />}
              title="No fill-ups yet"
              message="Add one to see your mileage."
              action={{ label: 'Add fill-up', icon: <IconPlus size={18} />, onPress: () => setFuelEdit('new') }}
            />
          ) : (
            <ListGroup
              header={[plural(fuelRows.length, 'fill-up', 'fill-ups'), avg ? `${fmtDec(avg)} km/L average` : null, fmtMoney(fuelRows.reduce((t, r) => t + Number(r.total_cost), 0))]
                .filter(Boolean)
                .join(' · ')}
            >
              {fuelRows.map((r) => (
                <Row
                  key={r.id}
                  title={fmtRelDate(r.date)}
                  subtitle={[
                    !r.full_tank ? 'Partial' : null,
                    `${fmtDec(Number(r.litres))} L`,
                    r.efficiency !== null ? `${fmtDec(r.efficiency)} km/L` : null,
                    fmtKm(Number(r.odometer)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={fmtMoney(Number(r.total_cost))}
                  onPress={() => setFuelEdit(r)}
                />
              ))}
            </ListGroup>
          )
        ) : (
          <>
            {service.length > 0 && (
              <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All categories</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {cap(c)}
                  </option>
                ))}
              </SelectField>
            )}
            {service.length === 0 ? (
              <EmptyState
                icon={<IconWrench size={56} />}
                title="No services yet"
                message="Log services, repairs, tyres and insurance."
                action={{ label: 'Add service', icon: <IconPlus size={18} />, onPress: () => setServiceEdit('new') }}
              />
            ) : serviceRows.length === 0 ? (
              <EmptyState
                variant="filtered"
                title={`No ${category} entries`}
                message="Try another category."
                action={{ label: 'Show all', onPress: () => setCategory('all') }}
              />
            ) : (
              <ListGroup
                header={`${plural(serviceRows.length, 'entry', 'entries')} · ${fmtMoney(serviceRows.reduce((t, r) => t + Number(r.cost), 0))}`}
              >
                {serviceRows.map((s) => (
                  <Row
                    key={s.id}
                    title={s.title}
                    subtitle={[fmtRelDate(s.date), cap(s.category), s.vendor].filter(Boolean).join(' · ')}
                    value={fmtMoney(Number(s.cost))}
                    onPress={() => setServiceEdit(s)}
                  />
                ))}
              </ListGroup>
            )}
          </>
        )}

        <div className="action-bar">
          <Button size="large" icon={<IconPlus size={18} />} disabled={loading} onClick={() => (kind === 'fuel' ? setFuelEdit('new') : setServiceEdit('new'))}>
            {addLabel}
          </Button>
        </div>
      </div>

      <FuelSheet editing={fuelEdit} vehicleId={vehicle.id} suggestedOdo={odo} onClose={() => setFuelEdit(null)} reload={reload} />
      <ServiceSheet
        editing={serviceEdit}
        vehicleId={vehicle.id}
        reminders={reminders}
        suggestedOdo={odo}
        onClose={() => setServiceEdit(null)}
        reload={reload}
      />
    </>
  );
}
