import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      const [r, v] = await Promise.all([
        supabase.from('reservations').select('*, vehicles(plate_number, make, model)').in('status', ['draft', 'pending', 'confirmed', 'blocked']),
        supabase.from('vehicles').select('id, plate_number, make, model'),
      ]);
      setReservations(r.data || []);
      setVehicles(v.data || []);
    };
    load();
  }, []);

  const filtered = vehicleFilter === 'all' ? reservations : reservations.filter(r => r.vehicle_id === vehicleFilter);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getReservationsForDay = (day: Date) =>
    filtered.filter(r => {
      const s = new Date(r.start_datetime);
      const e = new Date(r.end_datetime);
      return isWithinInterval(day, { start: new Date(s.toDateString()), end: new Date(e.toDateString()) }) || isSameDay(day, s) || isSameDay(day, e);
    });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Calendar</h1>
      <div className="flex gap-3 mb-4 items-center">
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All vehicles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-medium min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

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
    </div>
  );
}
