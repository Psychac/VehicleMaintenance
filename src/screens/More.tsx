import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { IconChevronLeft, IconPlus } from '../components/icons';
import { dataToSqliteFile, isLocalMode, restoreAll, sqliteFileToData, storageStatus, supabase } from '../lib/db';
import { fmtShortDate, today } from '../lib/format';
import type { AllData, BackupFile, Vehicle } from '../lib/types';
import { Banner, Button, IconButton, ListGroup, Row, ScreenHeader, Sheet, useToast } from '../ui';
import StorageSettings from './StorageSettings';
import { FormStack } from './forms';
import { vehicleDetails } from './shared';
import { useShell } from './shell';

/** Header for a pushed screen: inline title, back button. */
function PushedHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const shell = useShell();
  return <ScreenHeader inline title={title} leading={<IconButton label="Back" tone="accent" icon={<IconChevronLeft size={22} />} onClick={shell.back} />} trailing={trailing} />;
}

/** The fourth tab: everything that isn't daily use. */
export function More({ data }: { data: AllData }) {
  const shell = useShell();
  return (
    <>
      <ScreenHeader title="More" trailing={shell.bellButton} />
      <div className="screen narrow">
        <ListGroup label="Vehicles">
          <Row title="Vehicles" value={data.vehicles.length} onPress={() => shell.navigate({ tab: 'more', sub: 'vehicles' })} chevron />
        </ListGroup>
        <ListGroup header="Data">
          <Row title="Backup and restore" onPress={() => shell.navigate({ tab: 'more', sub: 'backup' })} chevron />
          <Row title="Storage" value={isLocalMode ? 'This device' : 'Supabase'} onPress={() => shell.navigate({ tab: 'more', sub: 'storage' })} chevron />
        </ListGroup>
        {!isLocalMode && (
          <ListGroup label="Account">
            <Row title="Account" onPress={() => shell.navigate({ tab: 'more', sub: 'account' })} chevron />
          </ListGroup>
        )}
      </div>
    </>
  );
}

export function Vehicles({ vehicles }: { vehicles: Vehicle[] }) {
  const shell = useShell();
  return (
    <>
      <PushedHeader title="Vehicles" />
      <div className="screen narrow">
        <ListGroup label="Vehicles">
          {vehicles.map((v) => (
            <Row
              key={v.id}
              title={v.name}
              subtitle={[vehicleDetails(v), v.plate].filter(Boolean).join(' · ') || undefined}
              value={v.archived ? 'Archived' : undefined}
              onPress={() => shell.editVehicle(v)}
              chevron
            />
          ))}
        </ListGroup>
        <div className="action-bar">
          <Button size="large" icon={<IconPlus size={18} />} onClick={() => shell.editVehicle('new')}>
            Add vehicle
          </Button>
        </div>
      </div>
    </>
  );
}

interface PendingRestore {
  data: AllData;
  summary: string;
  when: string;
}

export function Backup({ data, reload }: { data: AllData; reload: () => Promise<void> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [restoring, setRestoring] = useState(false);

  const exportJson = () => {
    const backup: BackupFile = { app: 'vehicle-log', version: 1, exported_at: new Date().toISOString(), data };
    download(`vehicle-log-${today()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  const exportCsv = () => {
    const names = new Map(data.vehicles.map((v) => [v.id, v.name]));
    const lines = [['type', 'vehicle', 'date', 'odometer', 'category', 'description', 'litres', 'cost'].join(',')];
    for (const f of data.fuel_logs) lines.push(csv(['fuel', names.get(f.vehicle_id), f.date, f.odometer, 'fuel', f.station ?? '', f.litres, f.total_cost]));
    for (const s of data.service_logs) lines.push(csv(['service', names.get(s.vehicle_id), s.date, s.odometer ?? '', s.category, s.title, '', s.cost]));
    download(`vehicle-log-${today()}.csv`, lines.join('\n'), 'text/csv');
  };

  const exportSqlite = async () => {
    try {
      download(`vehicle-log-${today()}.sqlite`, await dataToSqliteFile(data), 'application/vnd.sqlite3');
    } catch (ex) {
      toast({ message: `Couldn't export the database. ${(ex as Error).message}`, tone: 'error' });
    }
  };

  /** Reads a .json backup or .sqlite file and asks before overwriting anything. */
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let restored: AllData;
      let when = '';
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(await file.text()) as BackupFile;
        if (parsed.app !== 'vehicle-log' || !parsed.data) throw new Error('This file is not a Vehicle Log backup.');
        restored = parsed.data;
        when = parsed.exported_at.slice(0, 10);
      } else {
        restored = await sqliteFileToData(new Uint8Array(await file.arrayBuffer()));
      }
      const summary = Object.entries(restored)
        .map(([k, v]) => `${v.length} ${k.replace('_', ' ')}`)
        .join(', ');
      setPending({ data: restored, summary, when });
    } catch (ex) {
      toast({ message: `Couldn't read that file. ${(ex as Error).message}`, tone: 'error' });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setRestoring(true);
    try {
      await restoreAll(pending.data);
      await reload();
      setPending(null);
      toast({ message: 'Backup restored', tone: 'success' });
    } catch (ex) {
      toast({ message: `Couldn't restore the backup. ${(ex as Error).message}`, tone: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <PushedHeader title="Backup and restore" />
      <div className="screen narrow">
        <ListGroup
          header="Download a copy"
          footer={
            isLocalMode
              ? 'Your data lives in this browser. Clearing site data deletes it, so download a copy now and then.'
              : 'Your data lives in your Supabase project. You can also run the scheduled backup script (see the README).'
          }
        >
          <Row title="Database" subtitle="SQLite file" onPress={exportSqlite} />
          <Row title="Backup" subtitle="JSON, restorable here" onPress={exportJson} />
          <Row title="Spreadsheet" subtitle="CSV of fuel and service" onPress={exportCsv} />
        </ListGroup>
        <ListGroup header="Restore" footer="Matching entries are overwritten. Nothing is deleted.">
          <Row title="Restore from file" subtitle=".sqlite or .json" onPress={() => input.current?.click()} chevron />
        </ListGroup>
        <input ref={input} type="file" accept=".sqlite,.sqlite3,.db,application/json,.json" hidden onChange={pick} />
      </div>

      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Restore backup" detents={['medium']}>
        <FormStack>
          <p className="form-note">
            {pending?.summary}
            {pending?.when ? ` · exported ${fmtShortDate(pending.when)}` : ''}
          </p>
          <p className="form-note">Entries with the same id are overwritten with the backup version. Nothing is deleted.</p>
          <Button size="large" fullWidth loading={restoring} onClick={restore}>
            Restore backup
          </Button>
        </FormStack>
      </Sheet>
    </>
  );
}

export function Storage() {
  return (
    <>
      <PushedHeader title="Storage" />
      <div className="screen narrow">
        {isLocalMode && !storageStatus.persistent && (
          <Banner tone="warning">
            Not saving to this device right now{storageStatus.reason ? ': ' + storageStatus.reason : ''}.
          </Banner>
        )}
        <StorageSettings />
      </div>
    </>
  );
}

export function Account() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <>
      <PushedHeader title="Account" />
      <div className="screen narrow">
        <ListGroup label="Signed in">
          <Row title="Email" value={email ?? '…'} />
        </ListGroup>
        <Banner tone="info">Signing out keeps your data in Supabase. You can sign in again any time.</Banner>
        <Button variant="destructive" size="large" fullWidth onClick={() => supabase?.auth.signOut()}>
          Sign out
        </Button>
      </div>
    </>
  );
}

function csv(values: unknown[]) {
  return values
    .map((v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

function download(name: string, content: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
