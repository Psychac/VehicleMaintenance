import { useState } from 'react';
import { IconFuel, IconPlus, IconTrash, IconWrench } from '../components/icons';
import { averageEfficiency, fuelEfficiency } from '../lib/calc';
import { fmtDate, fmtDec, fmtKm, fmtMoney, fmtRelDate } from '../lib/format';
import { SERVICE_CATEGORIES, type FuelLog, type ServiceLog } from '../lib/types';
import { Badge, Button, DataTable, EmptyState, Fade, Inspector, ListGroup, Row, ScreenHeader, Segmented, SelectField, SkeletonRows, useHasInspector, useIsDesktop, useShortcuts, useToast, type Column } from '../ui';
import FuelSheet from './FuelSheet';
import ServiceSheet from './ServiceSheet';
import { deleteWithUndo, odometerOf, type Editing, type VehicleScope } from './shared';
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

/** Rows rendered at a time. Long histories mount in pieces so switching to Log stays instant. */
const PAGE = 25;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One history for everything you've logged. Fuel and service share a screen and a segmented switch. */
export default function Log({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
  const toast = useToast();
  const { vehicle, fuel, service, reminders } = scope;
  const [kind, setKindState] = useState<Kind>(remembered);
  const [fuelEdit, setFuelEdit] = useState<Editing<FuelLog>>(null);
  const [serviceEdit, setServiceEdit] = useState<Editing<ServiceLog>>(null);
  const [category, setCategory] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [selId, setSelId] = useState<string | null>(null);
  const desktop = useIsDesktop();
  const wide = useHasInspector();
  const odo = odometerOf(scope);
  useShortcuts({ n: () => (kind === 'fuel' ? setFuelEdit('new') : setServiceEdit('new')) }, !loading);

  const setKind = (k: Kind) => {
    setKindState(k);
    setLimit(PAGE);
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
  const trash = <IconTrash size={18} />;

  const removeFuel = (r: FuelLog) => deleteWithUndo('fuel_logs', r, 'Fill-up deleted', toast, reload);
  const removeService = (r: ServiceLog) => deleteWithUndo('service_logs', r, 'Entry deleted', toast, reload);

  /* Desktop: a sortable table with the selected entry's details in a panel beside it. */
  const fuelColumns: Column<(typeof fuelRows)[number]>[] = [
    { key: 'date', label: 'Date', render: (r) => <>{fmtDate(r.date)} {!r.full_tank && <Badge tone="neutral">Partial</Badge>}</>, sort: (r) => r.date },
    { key: 'odo', label: 'Odometer', numeric: true, render: (r) => fmtKm(Number(r.odometer)), sort: (r) => Number(r.odometer) },
    { key: 'litres', label: 'Litres', numeric: true, render: (r) => fmtDec(Number(r.litres)), sort: (r) => Number(r.litres) },
    { key: 'cost', label: 'Cost', numeric: true, render: (r) => fmtMoney(Number(r.total_cost)), sort: (r) => Number(r.total_cost) },
    { key: 'ppl', label: 'Per litre', numeric: true, render: (r) => (Number(r.litres) > 0 ? fmtDec(Number(r.total_cost) / Number(r.litres)) : '—'), sort: (r) => Number(r.total_cost) / (Number(r.litres) || 1) },
    { key: 'eff', label: 'km/L', numeric: true, render: (r) => (r.efficiency !== null ? fmtDec(r.efficiency) : '—'), sort: (r) => r.efficiency ?? -1 },
  ];
  const serviceColumns: Column<ServiceLog>[] = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date), sort: (r) => r.date },
    { key: 'title', label: 'Entry', render: (r) => r.title, sort: (r) => r.title },
    { key: 'cat', label: 'Category', render: (r) => cap(r.category), sort: (r) => r.category },
    { key: 'vendor', label: 'Vendor', render: (r) => r.vendor ?? '—', sort: (r) => r.vendor ?? '' },
    { key: 'odo', label: 'Odometer', numeric: true, render: (r) => (r.odometer != null ? fmtKm(Number(r.odometer)) : '—'), sort: (r) => Number(r.odometer ?? 0) },
    { key: 'cost', label: 'Cost', numeric: true, render: (r) => fmtMoney(Number(r.cost)), sort: (r) => Number(r.cost) },
  ];
  const selFuel = kind === 'fuel' ? (fuelRows.find((r) => r.id === selId) ?? null) : null;
  const selService = kind === 'service' ? (serviceRows.find((r) => r.id === selId) ?? null) : null;
  const addButton = (
    <span className="desktop-only header-actions">
      <Button icon={<IconPlus size={18} />} disabled={loading} aria-keyshortcuts="n" onClick={() => (kind === 'fuel' ? setFuelEdit('new') : setServiceEdit('new'))}>
        {addLabel} <kbd aria-hidden="true">N</kbd>
      </Button>
    </span>
  );
  const desktopBody =
    kind === 'fuel' ? (
      fuelRows.length === 0 ? null : (
        <div className="split">
          <div className="split-main">
            <p className="table-caption">{[plural(fuelRows.length, 'fill-up', 'fill-ups'), avg ? `${fmtDec(avg)} km/L average` : null, fmtMoney(fuelRows.reduce((t, r) => t + Number(r.total_cost), 0))].filter(Boolean).join(' · ')}</p>
            <DataTable
              label="Fill-ups"
              columns={fuelColumns}
              rows={fuelRows}
              rowKey={(r) => r.id}
              selectedId={selId}
              onSelect={(r) => (wide ? setSelId(r.id) : setFuelEdit(r))}
              menu={(r) => [
                { label: 'Edit', onSelect: () => setFuelEdit(r) },
                { label: 'Delete', destructive: true, onSelect: () => void removeFuel(r) },
              ]}
            />
          </div>
          {wide && (
          <Inspector
            emptyTitle="No fill-up selected"
            emptyMessage="Select a row to see its details."
            title={selFuel ? fmtDate(selFuel.date) : undefined}
            subtitle={selFuel ? [selFuel.station, selFuel.full_tank ? 'Full tank' : 'Partial fill'].filter(Boolean).join(' · ') : undefined}
            items={
              selFuel
                ? [
                    { label: 'Odometer', value: fmtKm(Number(selFuel.odometer)) },
                    { label: 'Litres', value: fmtDec(Number(selFuel.litres)) },
                    { label: 'Total cost', value: fmtMoney(Number(selFuel.total_cost)) },
                    { label: 'Per litre', value: Number(selFuel.litres) > 0 ? fmtDec(Number(selFuel.total_cost) / Number(selFuel.litres)) : '—' },
                    { label: 'Mileage', value: selFuel.efficiency !== null ? `${fmtDec(selFuel.efficiency)} km/L` : '—' },
                    ...(selFuel.remaining_litres != null ? [{ label: 'Left before filling', value: `${fmtDec(Number(selFuel.remaining_litres))} L` }] : []),
                    ...(selFuel.notes ? [{ label: 'Notes', value: selFuel.notes }] : []),
                  ]
                : undefined
            }
            actions={
              selFuel && (
                <>
                  <Button variant="secondary" onClick={() => setFuelEdit(selFuel)}>Edit</Button>
                  <Button variant="tertiary" onClick={() => void removeFuel(selFuel)}>Delete</Button>
                </>
              )
            }
          />
          )}
        </div>
      )
    ) : serviceRows.length === 0 ? null : (
      <div className="split">
        <div className="split-main">
          <p className="table-caption">{`${plural(serviceRows.length, 'entry', 'entries')} · ${fmtMoney(serviceRows.reduce((t, r) => t + Number(r.cost), 0))}`}</p>
          <DataTable
            label="Service entries"
            columns={serviceColumns}
            rows={serviceRows}
            rowKey={(r) => r.id}
            selectedId={selId}
            onSelect={(r) => (wide ? setSelId(r.id) : setServiceEdit(r))}
            menu={(r) => [
              { label: 'Edit', onSelect: () => setServiceEdit(r) },
              { label: 'Delete', destructive: true, onSelect: () => void removeService(r) },
            ]}
          />
        </div>
        {wide && (
        <Inspector
          emptyTitle="No entry selected"
          emptyMessage="Select a row to see its details."
          title={selService?.title}
          subtitle={selService ? [fmtDate(selService.date), cap(selService.category)].join(' · ') : undefined}
          items={
            selService
              ? [
                  { label: 'Cost', value: fmtMoney(Number(selService.cost)) },
                  { label: 'Odometer', value: selService.odometer != null ? fmtKm(Number(selService.odometer)) : '—' },
                  { label: 'Vendor', value: selService.vendor ?? '—' },
                  ...(selService.notes ? [{ label: 'Notes', value: selService.notes }] : []),
                ]
              : undefined
          }
          actions={
            selService && (
              <>
                <Button variant="secondary" onClick={() => setServiceEdit(selService)}>Edit</Button>
                <Button variant="tertiary" onClick={() => void removeService(selService)}>Delete</Button>
              </>
            )
          }
        />
        )}
      </div>
    );
  const useDesktopBody = desktop && !loading && desktopBody !== null;

  return (
    <>
      <ScreenHeader
        title="Log"
        trailing={
          <>
            {addButton}
            {shell.vehicleButton}
            {shell.bellButton}
          </>
        }
      />

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

        <Fade id={loading ? 'loading' : kind}>
          {useDesktopBody ? desktopBody : <>
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
                live
                header={[plural(fuelRows.length, 'fill-up', 'fill-ups'), avg ? `${fmtDec(avg)} km/L average` : null, fmtMoney(fuelRows.reduce((t, r) => t + Number(r.total_cost), 0))]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {fuelRows.slice(0, limit).map((r) => (
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
                    menu={[
                      { label: 'Edit', onSelect: () => setFuelEdit(r) },
                      { label: 'Delete', destructive: true, onSelect: () => void removeFuel(r) },
                    ]}
                    swipe={{ trailing: { label: 'Delete', icon: trash, tone: 'destructive', onCommit: () => removeFuel(r) } }}
                  />
                ))}
                {fuelRows.length > limit && <Row key="more" title="Show older" value={`${fuelRows.length - limit} more`} onPress={() => setLimit(limit + PAGE)} />}
              </ListGroup>
            )
          ) : (
            <>
              {service.length > 0 && (
                <SelectField label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setLimit(PAGE); }}>
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
                <ListGroup live header={`${plural(serviceRows.length, 'entry', 'entries')} · ${fmtMoney(serviceRows.reduce((t, r) => t + Number(r.cost), 0))}`}>
                  {serviceRows.slice(0, limit).map((s) => (
                    <Row
                      key={s.id}
                      title={s.title}
                      subtitle={[fmtRelDate(s.date), cap(s.category), s.vendor].filter(Boolean).join(' · ')}
                      value={fmtMoney(Number(s.cost))}
                      onPress={() => setServiceEdit(s)}
                      menu={[
                        { label: 'Edit', onSelect: () => setServiceEdit(s) },
                        { label: 'Delete', destructive: true, onSelect: () => void removeService(s) },
                      ]}
                      swipe={{ trailing: { label: 'Delete', icon: trash, tone: 'destructive', onCommit: () => removeService(s) } }}
                    />
                  ))}
                  {serviceRows.length > limit && <Row key="more" title="Show older" value={`${serviceRows.length - limit} more`} onPress={() => setLimit(limit + PAGE)} />}
                </ListGroup>
              )}
            </>
          )}
          </>}
        </Fade>

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
