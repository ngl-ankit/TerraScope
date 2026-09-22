'use client';

import { useMemo } from 'react';
import { Activity, Globe2, Plane, Wind } from 'lucide-react';
import { StatusCard, StatusBar } from '@/components/ui/StatusBar';
import { useNow } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { formatAge, formatNumber } from '@/lib/utils/format';

/**
 * Desktop HUD cluster.
 *
 * Small, glanceable status cards below the layer dock: strongest event, fleet
 * count, worst air quality and the current sync health. Each card is derived
 * from data already in the store, so the cluster costs no extra requests.
 */
export function StatusCards() {
  const now = useNow(1000);
  const earthquakes = useTerraScope((s) => s.earthquakes);
  const flights = useTerraScope((s) => s.flights);
  const airQuality = useTerraScope((s) => s.airQuality);
  const layers = useTerraScope((s) => s.layers);
  const select = useTerraScope((s) => s.select);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  const strongest = useMemo(() => earthquakes.data[0] ?? null, [earthquakes.data]);

  const worstAir = useMemo(() => {
    if (airQuality.data.length === 0) return null;
    return airQuality.data.reduce((worst, sample) =>
      (sample.europeanAqi ?? -1) > (worst.europeanAqi ?? -1) ? sample : worst,
    );
  }, [airQuality.data]);

  const averageMagnitude = useMemo(() => {
    if (earthquakes.data.length === 0) return null;
    const total = earthquakes.data.reduce((sum, quake) => sum + quake.magnitude, 0);
    return total / earthquakes.data.length;
  }, [earthquakes.data]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <StatusCard
          label="Strongest event"
          icon={<Activity size={10} />}
          accent="#ff8a4c"
          value={strongest ? `M ${strongest.magnitude.toFixed(1)}` : '--'}
          detail={strongest ? formatAge(strongest.time, now) + ' ago' : 'no data'}
        />
        <StatusCard
          label="Fleet sampled"
          icon={<Plane size={10} />}
          accent="#7ee787"
          value={layers.flights ? flights.data.aircraft.length.toLocaleString('en-US') : 'off'}
          detail={layers.flights ? 'OpenSky regions' : 'layer disabled'}
        />
      </div>

      <div className="flex gap-1.5">
        <StatusCard
          label="Worst air quality"
          icon={<Wind size={10} />}
          accent="#c084fc"
          value={worstAir?.europeanAqi !== undefined && worstAir?.europeanAqi !== null ? `EAQI ${worstAir.europeanAqi}` : '--'}
          detail={worstAir ? worstAir.name : 'layer disabled'}
        />
        <StatusCard
          label="Mean magnitude"
          icon={<Globe2 size={10} />}
          accent="#4cc9f0"
          value={averageMagnitude === null ? '--' : formatNumber(averageMagnitude, 2)}
          detail={`${earthquakes.data.length} events`}
        />
      </div>

      {/* Clicking the strongest-event card focuses it, like the marker would. */}
      {strongest && (
        <button
          type="button"
          onClick={() => {
            select({ kind: 'earthquake', item: strongest });
            requestFlyTo(strongest.lat, strongest.lon, 1.5);
          }}
          className="glass-soft w-full rounded-xl px-2.5 py-2 text-left transition hover:border-accent/30"
        >
          <p className="text-2xs text-ink-faint">Focus strongest event</p>
          <p className="mt-0.5 truncate text-2xs font-medium text-ink">{strongest.place}</p>
        </button>
      )}

      <div className="glass-soft rounded-xl px-3 py-2.5">
        <StatusBar onOpenSources={() => useTerraScope.getState().setSourcesOpen(true)} />
      </div>
    </div>
  );
}
