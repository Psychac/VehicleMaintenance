import { useState } from 'react';
import { IconPlus } from '../components/icons';
import { averageEfficiency, fuelEfficiency } from '../lib/calc';
import { fmtDec, fmtKm, fmtMoney, fmtNum, fmtRelDate, today } from '../lib/format';
import type { FuelLog, ServiceLog } from '../lib/types';
import { Button, ListGroup, Row, ScreenHeader, Skeleton, SkeletonRows } from '../ui';
import FuelSheet from './FuelSheet';
import ServiceSheet from './ServiceSheet';
import { ReminderBadge, dueText, odometerOf, reminderRows, vehicleDetails, type Editing, type VehicleScope } from './shared';
import { useShell } from './shell';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Home: the vehicle's odometer first, what needs attention, then the numbers. Logging is one tap away. */
export default function Home({ scope, loading, reload }: { scope: VehicleScope; loading: boolean; reload: () => Promise<void> }) {
  const shell = useShell();
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

  return (
    <>
      <ScreenHeader title={vehicle.name} subtitle={details || undefined} trailing={shell.switchButton} />

      <div className="screen">
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
              <p className="hero-value tnum">
                {fmtNum(odo)}
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

            <ListGroup header="Needs attention">
              {reminders.length === 0 ? (
                <Row leading={<IconPlus size={18} />} title="Add a reminder" value="Oil, insurance, tyres" onPress={() => shell.navigate({ tab: 'reminders' })} chevron />
              ) : attention.length === 0 ? (
                <Row title="All reminders on track" value={reminders.length} onPress={() => shell.navigate({ tab: 'reminders' })} chevron />
              ) : (
                <>
                  {attention.slice(0, 3).map(({ r, s }) => (
                    <Row
                      key={r.id}
                      title={r.title}
                      subtitle={dueText(s)}
                      trailing={<ReminderBadge status={s} />}
                      onPress={() => shell.navigate({ tab: 'reminders' })}
                      chevron
                    />
                  ))}
                  {attention.length > 3 && (
                    <Row title="All reminders" value={`${attention.length} need attention`} onPress={() => shell.navigate({ tab: 'reminders' })} chevron />
                  )}
                </>
              )}
            </ListGroup>

            <ListGroup header="Summary" footer={avg ? undefined : 'Mileage appears after two full-tank fill-ups.'}>
              <Row title="Average mileage" value={avg ? `${fmtDec(avg)} km/L` : '—'} />
              {lastTank !== null && <Row title="Last tank" value={`${fmtDec(lastTank)} km/L`} />}
              <Row title="This month" value={fmtMoney(monthSpend)} />
              <Row title="Cost per km" value={driven > 0 && totalSpend > 0 ? fmtMoney(totalSpend / driven) : '—'} />
              <Row title="Total spent" value={fmtMoney(totalSpend)} />
            </ListGroup>

            {recent.length > 0 && (
              <ListGroup header="Recent">
                {recent.map((x) =>
                  x.kind === 'fuel' ? (
                    <Row
                      key={x.row.id}
                      title="Fuel"
                      subtitle={`${fmtRelDate(x.date)} · ${fmtDec(Number(x.row.litres))} L`}
                      value={fmtMoney(Number(x.row.total_cost))}
                      onPress={() => setFuelEdit(x.row)}
                    />
                  ) : (
                    <Row
                      key={x.row.id}
                      title={x.row.title}
                      subtitle={`${fmtRelDate(x.date)} · ${cap(x.row.category)}`}
                      value={fmtMoney(Number(x.row.cost))}
                      onPress={() => setServiceEdit(x.row)}
                    />
                  )
                )}
              </ListGroup>
            )}
          </>
        )}

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
