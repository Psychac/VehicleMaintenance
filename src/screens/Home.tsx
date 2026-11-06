import { useState } from 'react';
import { IconPlus, IconTrash } from '../components/icons';
import { averageEfficiency, fuelEfficiency, reminderProgress } from '../lib/calc';
import { fmtDec, fmtKm, fmtMoney, fmtNum, fmtRelDate, today } from '../lib/format';
import type { FuelLog, ServiceLog } from '../lib/types';
import { Button, Fade, ListGroup, Roll, Row, ScreenHeader, Skeleton, SkeletonRows, StatGrid, useToast } from '../ui';
import FuelSheet from './FuelSheet';
import ServiceSheet from './ServiceSheet';
import { ReminderBadge, deleteWithUndo, dueText, odometerOf, reminderRows, vehicleDetails, type Editing, type VehicleScope } from './shared';
import { useShell } from './shell';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Home: the vehicle's odometer first, what needs attention, then the numbers. Logging is one tap away. */
export default function Home({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
  const toast = useToast();
  const [fuelEdit, setFuelEdit] = useState<Editing<FuelLog>>(null);
  const [serviceEdit, setServiceEdit] = useState<Editing<ServiceLog>>(null);
  const { vehicle, fuel, service, reminders } = scope;

  const odo = odometerOf(scope);
  const rows = fuelEfficiency(fuel);
  const avg = averageEfficiency(rows);
  const lastTank = [...rows].reverse().find((r) => r.efficiency !== null)?.efficiency ?? null;
  const month = today().slice(0, 7);
  const monthSpend =
    fuel.filter((f) => f.date.startsWith(month)).reduce((s, f) => s + Number(f.total_cost), 0) +
    service.filter((s) => s.date.startsWith(month)).reduce((s, x) => s + Number(x.cost), 0);
  const totalSpend = fuel.reduce((s, f) => s + Number(f.total_cost), 0) + service.reduce((s, x) => s + Number(x.cost), 0);
  const driven = odo - (Number(vehicle.start_odometer) || 0);
  const lastFill = fuel.reduce<string | null>((m, f) => (m === null || f.date > m ? f.date : m), null);

  const statuses = reminderRows(scope);
  const attention = statuses.filter((x) => x.s.state === 'overdue' || x.s.state === 'soon');

  const recent = [
    ...fuel.map((f) => ({ kind: 'fuel' as const, row: f, date: f.date })),
    ...service.map((s) => ({ kind: 'service' as const, row: s, date: s.date })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const details = [vehicleDetails(vehicle), vehicle.plate].filter(Boolean).join(' · ');
  const goReminders = () => shell.navigate({ tab: 'home', sub: 'reminders' });
  const trash = <IconTrash size={18} />;

  return (
    <>
      <ScreenHeader title={vehicle.name} subtitle={details || undefined} trailing={
          <>
            {shell.switchButton}
            {shell.bellButton}
          </>
        } />

      <div className="screen">
        <Fade id={loading ? 'loading' : 'ready'}>
          {loading ? (
            <>
              <section className="hero" aria-hidden="true">
                <Skeleton w="var(--space-80)" h="var(--space-12)" />
                <Skeleton w="60%" h="var(--space-40)" radius="var(--radius-sm)" />
              </section>
              <ListGroup label="Loading">
                <SkeletonRows count={3} />
              </ListGroup>
              <ListGroup label="Loading">
                <SkeletonRows count={4} />
              </ListGroup>
            </>
          ) : (
            <>
              <section className="hero" aria-label="Odometer">
                <p className="hero-label">Odometer</p>
                <p className="hero-value">
                  <Roll text={fmtNum(odo)} />
                  <span className="hero-unit"> km</span>
                </p>
                <dl className="hero-meta">
                  <div>
                    <dt>Last fill-up</dt>
                    <dd>{lastFill ? fmtRelDate(lastFill) : 'None yet'}</dd>
                  </div>
                  <div>
                    <dt>Tracked</dt>
                    <dd className="tnum">{driven > 0 ? fmtKm(driven) : '—'}</dd>
                  </div>
                </dl>
              </section>

              <ListGroup header="Needs attention" live>
                {reminders.length === 0 ? (
                  <Row key="none" leading={<IconPlus size={18} />} title="Add a reminder" value="Oil, insurance, tyres" onPress={goReminders} chevron />
                ) : attention.length === 0 ? (
                  <Row key="ok" title="All reminders on track" value={reminders.length} onPress={goReminders} chevron />
                ) : (
                  [
                    ...attention.slice(0, 3).map(({ r, s }) => (
                      <Row key={r.id} title={r.title} subtitle={dueText(s)} progress={reminderProgress(r, s) ?? undefined} trailing={<ReminderBadge status={s} />} onPress={goReminders} chevron />
                    )),
                    ...(attention.length > 3
                      ? [<Row key="more" title="All reminders" value={`${attention.length} need attention`} onPress={goReminders} chevron />]
                      : []),
                  ]
                )}
              </ListGroup>

              <StatGrid
                header="Summary"
                footer={avg ? undefined : 'Mileage appears after two full-tank fill-ups.'}
                items={[
                  { label: 'Average mileage', value: avg ? <Roll text={`${fmtDec(avg)} km/L`} /> : '—' },
                  { label: 'Last tank', value: lastTank !== null ? <Roll text={`${fmtDec(lastTank)} km/L`} /> : '—' },
                  { label: 'This month', value: <Roll text={fmtMoney(monthSpend)} /> },
                  { label: 'Cost per km', value: driven > 0 && totalSpend > 0 ? <Roll text={fmtMoney(totalSpend / driven)} /> : '—' },
                  { label: 'Total spent', value: <Roll text={fmtMoney(totalSpend)} /> },
                ]}
              />

              {recent.length > 0 && (
                <ListGroup header="Recent" live>
                  {recent.map((x) =>
                    x.kind === 'fuel' ? (
                      <Row
                        key={x.row.id}
                        title="Fuel"
                        subtitle={`${fmtRelDate(x.date)} · ${fmtDec(Number(x.row.litres))} L`}
                        value={fmtMoney(Number(x.row.total_cost))}
                        onPress={() => setFuelEdit(x.row)}
                        menu={[
                          { label: 'Edit', onSelect: () => setFuelEdit(x.row) },
                          { label: 'Delete', destructive: true, onSelect: () => void deleteWithUndo('fuel_logs', x.row, 'Fill-up deleted', toast, reload) },
                        ]}
                        swipe={{ trailing: { label: 'Delete', icon: trash, tone: 'destructive', onCommit: () => deleteWithUndo('fuel_logs', x.row, 'Fill-up deleted', toast, reload) } }}
                      />
                    ) : (
                      <Row
                        key={x.row.id}
                        title={x.row.title}
                        subtitle={`${fmtRelDate(x.date)} · ${cap(x.row.category)}`}
                        value={fmtMoney(Number(x.row.cost))}
                        onPress={() => setServiceEdit(x.row)}
                        menu={[
                          { label: 'Edit', onSelect: () => setServiceEdit(x.row) },
                          { label: 'Delete', destructive: true, onSelect: () => void deleteWithUndo('service_logs', x.row, 'Entry deleted', toast, reload) },
                        ]}
                        swipe={{ trailing: { label: 'Delete', icon: trash, tone: 'destructive', onCommit: () => deleteWithUndo('service_logs', x.row, 'Entry deleted', toast, reload) } }}
                      />
                    )
                  )}
                </ListGroup>
              )}
            </>
          )}
        </Fade>

        <div className="action-bar">
          <Button size="large" icon={<IconPlus size={18} />} onClick={() => setFuelEdit('new')} disabled={loading}>
            Add fill-up
          </Button>
          <Button variant="secondary" size="large" onClick={() => setServiceEdit('new')} disabled={loading}>
            Add service
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
