import { useEffect, useState, type ReactNode } from 'react';
import { IconBell, IconCar, IconChart, IconFuel, IconHome, IconMore, IconPlus, IconWrench } from '../components/icons';
import {
  AppNav,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  loadMotion,
  ListGroup,
  Row,
  ScreenHeader,
  Segmented,
  SelectField,
  Sheet,
  SkeletonRows,
  TextArea,
  TextField,
  ToastProvider,
  Toggle,
  useToast,
  type NavItem,
} from './index';
import './gallery.css';

type TabId = 'home' | 'log' | 'reminders' | 'more';

const NAV: NavItem<TabId>[] = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'log', label: 'Log', icon: IconFuel },
  { id: 'reminders', label: 'Reminders', icon: IconBell, badge: 2 },
  { id: 'more', label: 'More', icon: IconMore },
];

const COLORS = [
  'bg-primary',
  'bg-grouped',
  'bg-elevated',
  'bg-elevated2',
  'accent',
  'accent-tint',
  'success',
  'warning',
  'destructive',
  'label-primary',
  'label-secondary',
  'label-tertiary',
  'chart-other',
];

const TYPES = ['large-title', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption', 'caption2'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="g-section">
      <h2 className="g-label">{title}</h2>
      {children}
    </section>
  );
}

function Inner() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('home');
  const [seg, setSeg] = useState<'6' | '12' | '24'>('12');
  const [sheet, setSheet] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  const applyTheme = (t: typeof theme) => {
    setTheme(t);
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  };

  return (
    <div className="g-page">
      <ScreenHeader
        title="Components"
        subtitle="Step 3 gallery, every state"
        trailing={<IconButton label="Add" icon={<IconPlus size={22} />} tone="accent" />}
      />

      <Section title="Theme">
        <Segmented
          label="Theme"
          value={theme}
          onChange={applyTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Section>

      <Section title="Colour roles">
        <div className="g-swatches">
          {COLORS.map((c) => (
            <div key={c} className="g-swatch" style={{ background: `var(--color-${c})` }}>
              {c}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="g-surface">
          {TYPES.map((t) => (
            <div key={t} className={`t-${t}`}>
              {t} · 128,430 km
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons: default, pressed, disabled, loading">
        {(['primary', 'secondary', 'tertiary', 'destructive'] as const).map((v) => (
          <div key={v} className="g-row">
            <Button variant={v}>Save fill-up</Button>
            <Button variant={v} data-pressed="true">
              Pressed
            </Button>
            <Button variant={v} disabled>
              Disabled
            </Button>
            <Button variant={v} loading>
              Loading
            </Button>
          </div>
        ))}
        <Button
          size="large"
          fullWidth
          icon={<IconPlus size={18} />}
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              toast({ message: 'Fill-up saved', tone: 'success' });
            }, 1200);
          }}
        >
          Add fill-up
        </Button>
        <div className="g-row">
          <IconButton label="Add" icon={<IconPlus size={22} />} />
          <IconButton label="Add, pressed" icon={<IconPlus size={22} />} data-pressed="true" />
          <IconButton label="Add, disabled" icon={<IconPlus size={22} />} disabled />
        </div>
      </Section>

      <Section title="Segmented">
        <Segmented
          label="Range"
          value={seg}
          onChange={setSeg}
          options={[
            { value: '6', label: '6 mo' },
            { value: '12', label: '12 mo' },
            { value: '24', label: '24 mo' },
          ]}
        />
      </Section>

      <Section title="Grouped list">
        <ListGroup header="Needs attention" footer="Distance and date are checked against your odometer.">
          <Row leading={<IconWrench size={18} />} title="Engine oil & filter" subtitle="1,200 km overdue" trailing={<Badge tone="overdue">Overdue</Badge>} onPress={() => {}} chevron />
          <Row leading={<IconBell size={18} />} title="Insurance renewal" subtitle="By 12 Dec, in 36 days" trailing={<Badge tone="soon">Due soon</Badge>} onPress={() => {}} chevron />
          <Row leading={<IconCar size={18} />} title="Tyre rotation" subtitle="In 6,400 km" trailing={<Badge tone="ok">On track</Badge>} onPress={() => {}} chevron />
          <Row leading={<IconChart size={18} />} title="Coolant" subtitle="Record when it was last done" trailing={<Badge tone="neutral">Not started</Badge>} />
        </ListGroup>
        <ListGroup header="Single-line rows">
          <Row title="Odometer" value="48,210 km" />
          <Row title="Selected row" selected onPress={() => {}} />
          <Row title="Disabled row" disabled onPress={() => {}} />
        </ListGroup>
        <ListGroup header="Loading, same frames as the rows above">
          <SkeletonRows count={3} leading />
        </ListGroup>
      </Section>

      <Section title="Card">
        <Card hero onPress={() => toast({ message: 'Opened vehicle' })} label="Open vehicle">
          <div className="t-footnote g-secondary">2019 Honda City</div>
          <div className="t-title1">Family car</div>
          <div className="t-title2 tnum">48,210 km</div>
        </Card>
      </Section>

      <Section title="Fields">
        <div className="g-surface g-stack">
          <TextField label="Odometer (km)" name="odo" inputMode="decimal" enterKeyHint="next" placeholder="Last 48,210" required />
          <TextField label="Litres" name="l" inputMode="decimal" hint="From the pump display" defaultValue="32.4" />
          <TextField label="Station" name="s" error="Add a station name" defaultValue="" />
          <SelectField label="Fuel" defaultValue="petrol">
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
          </SelectField>
          <TextArea label="Notes" rows={2} />
          <Toggle label="Filled to full tank" description="Needed to work out mileage" defaultChecked />
          <Toggle label="Disabled" disabled />
        </div>
      </Section>

      <Section title="Banners">
        <Banner tone="offline">You're offline. Changes are saved on this device.</Banner>
        <Banner tone="warning" action={{ label: 'Back up now', onPress: () => {} }}>
          Your data won't be saved in this browser.
        </Banner>
        <Banner tone="error" action={{ label: 'Retry', onPress: () => {} }}>
          Couldn't load your data.
        </Banner>
      </Section>

      <Section title="Empty states">
        <div className="g-surface">
          <EmptyState
            icon={<IconFuel size={56} />}
            title="No fill-ups yet"
            message="Add one to see your mileage."
            action={{ label: 'Add fill-up', onPress: () => {}, icon: <IconPlus size={18} /> }}
          />
        </div>
        <div className="g-surface">
          <EmptyState variant="filtered" title="No results for “brake”" message="Check the spelling or try a broader term." action={{ label: 'Clear filter', onPress: () => {} }} />
        </div>
      </Section>

      <Section title="Sheet and toast">
        <div className="g-row">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
          <Button variant="secondary" onClick={() => toast({ message: 'Fill-up deleted', action: { label: 'Undo', onPress: () => toast({ message: 'Restored' }) } })}>
            Toast with undo
          </Button>
        </div>
      </Section>

      <div className="g-filler" />

      <AppNav items={NAV} value={tab} onChange={setTab} onReselect={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

      <Sheet
        open={sheet}
        onClose={() => {
          setSheet(false);
          setDirty(false);
        }}
        title="Add fill-up"
        dirty={dirty}
        action={
          <Button
            onClick={() => {
              setSheet(false);
              setDirty(false);
              toast({ message: 'Fill-up saved', tone: 'success' });
            }}
          >
            Save
          </Button>
        }
      >
        <div className="g-stack">
          <TextField label="Odometer (km)" inputMode="decimal" onChange={() => setDirty(true)} />
          <TextField label="Litres" inputMode="decimal" onChange={() => setDirty(true)} />
          <TextField label="Total cost" inputMode="decimal" onChange={() => setDirty(true)} />
          <Toggle label="Filled to full tank" defaultChecked />
        </div>
      </Sheet>
    </div>
  );
}

export default function Gallery() {
  useEffect(() => {
    void loadMotion();
  }, []);
  return (
      <ToastProvider>
        <Inner />
      </ToastProvider>
    
  );
}
