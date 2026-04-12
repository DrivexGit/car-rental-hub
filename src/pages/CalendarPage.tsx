import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addMonths, subMonths, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'grid'>('grid');

  useEffect(() => {
    const load = async () => {
      const [r, v] = await Promise.all([
        supabase.from('reservations').select('*, vehicles(plate_number, make, model)').in('status', ['draft', 'pending', 'confirmed', 'blocked']),
        supabase.from('vehicles').select('id, plate_number, make, model').order('plate_number'),
      ]);
      setReservations(r.data || []);
      setVehicles(v.data || []);
    };
    load();
  }, []);

  const filtered = vehicleFilter === 'all' ? reservations : reservations.filter(r => r.vehicle_id === vehicleFilter);
  const filteredVehicles = vehicleFilter === 'all' ? vehicles : vehicles.filter(v => v.id === vehicleFilter);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Grid view: all days of the month
  const gridDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getReservationsForDay = (day: Date) =>
    filtered.filter(r => {
      const s = new Date(r.start_datetime);
      const e = new Date(r.end_datetime);
      return isWithinInterval(day, { start: new Date(s.toDateString()), end: new Date(e.toDateString()) }) || isSameDay(day, s) || isSameDay(day, e);
    });

  const isVehicleOccupied = (vehicleId: string, day: Date) =>
    reservations.some(r => {
      if (r.vehicle_id !== vehicleId) return false;
      const s = new Date(r.start_datetime);
      const e = new Date(r.end_datetime);
      return isWithinInterval(day, { start: new Date(s.toDateString()), end: new Date(e.toDateString()) }) || isSameDay(day, s) || isSameDay(day, e);
    });

  const getVehicleReservation = (vehicleId: string, day: Date) =>
    reservations.find(r => {
      if (r.vehicle_id !== vehicleId) return false;
      const s = new Date(r.start_datetime);
      const e = new Date(r.end_datetime);
      return isWithinInterval(day, { start: new Date(s.toDateString()), end: new Date(e.toDateString()) }) || isSameDay(day, s) || isSameDay(day, e);
    });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Calendar</h1>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All vehicles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</SelectItem>)}
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={v => setView(v as any)} className="ml-2">
          <TabsList>
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-medium min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 bg-muted z-10 px-3 py-2 text-left font-medium text-muted-foreground border-r min-w-[160px]">Vehicle</th>
                {gridDays.map(day => (
                  <th key={day.toISOString()} className={`px-1 py-2 text-center font-medium min-w-[32px] ${[0, 6].includes(day.getDay()) ? 'bg-muted/70 text-muted-foreground/60' : 'text-muted-foreground'}`}>
                    <div>{format(day, 'd')}</div>
                    <div className="text-[9px] font-normal">{format(day, 'EEE')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map(vehicle => (
                <tr key={vehicle.id} className="border-t hover:bg-muted/30">
                  <td className="sticky left-0 bg-background z-10 px-3 py-1.5 font-mono text-xs border-r whitespace-nowrap">
                    <span className="font-semibold">{vehicle.plate_number}</span>
                    <span className="text-muted-foreground ml-1.5">{vehicle.make} {vehicle.model}</span>
                  </td>
                  {gridDays.map(day => {
                    const res = getVehicleReservation(vehicle.id, day);
                    const occupied = !!res;
                    const isBlock = res?.reservation_type === 'block';
                    const isWeekend = [0, 6].includes(day.getDay());
                    return (
                      <td
                        key={day.toISOString()}
                        className={`px-0 py-0 text-center border-l ${
                          occupied
                            ? isBlock
                              ? 'bg-rose-100 dark:bg-rose-950/40'
                              : 'bg-blue-100 dark:bg-blue-950/40'
                            : isWeekend
                              ? 'bg-muted/30'
                              : ''
                        }`}
                        title={res ? `${res.status} — ${(res.vehicles as any)?.plate_number || ''}` : 'Free'}
                      >
                        {occupied && (
                          <div className={`w-full h-6 flex items-center justify-center text-[9px] font-medium ${
                            isBlock ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'
                          }`}>
                            {isBlock ? '■' : '●'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr><td colSpan={gridDays.length + 1} className="text-center text-muted-foreground py-8">No vehicles</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center gap-4 px-3 py-2 bg-muted/50 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950 border border-blue-200"></span> Booking</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-950 border border-rose-200"></span> Block</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-background border"></span> Free</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
          {days.map(day => {
            const dayRes = getReservationsForDay(day);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            return (
              <div key={day.toISOString()} className={`bg-background min-h-[80px] p-1 ${!isCurrentMonth ? 'opacity-40' : ''}`}>
                <div className="text-xs text-muted-foreground mb-1">{format(day, 'd')}</div>
                {dayRes.slice(0, 3).map(r => (
                  <div key={r.id} className={`text-[10px] px-1 rounded mb-0.5 truncate ${r.reservation_type === 'block' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                    {(r.vehicles as any)?.plate_number}
                  </div>
                ))}
                {dayRes.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayRes.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
