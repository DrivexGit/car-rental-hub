import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { carName } from "@/data/catalog";
import { day } from "@/lib/format";
import { Button, Card, Screen } from "@/components/ui";

/** Reservation step 3 of 3. */
export default function Confirmed() {
  const { id } = useParams();
  const { bookings, invoices } = useStore();
  const b = bookings.find((x) => x.id === id);
  if (!b) return null;
  const car = b.car;
  const unpaid = invoices.some((i) => i.bookingId === b.id && i.status === "pending");
  return (
    <Screen tabs={false} className="flex flex-col justify-center text-center">
      <CheckCircle2 className="mx-auto mt-16 h-20 w-20 text-brand" />
      <h1 className="mt-4 text-[28px] font-bold">{unpaid ? "Booking saved" : "You're all set!"}</h1>
      <p className="mt-1 text-ink-muted">{unpaid ? "Your car is held. Pay the invoice to confirm it." : "Your booking is confirmed. We'll message you before pickup."}</p>
      <Card className="mt-8 p-4 text-left">
        <img src={car.image} alt="" className="mx-auto h-28 object-contain" />
        <p className="mt-2 text-lg font-bold">{carName(car)}</p>
        <p className="text-sm text-ink-muted">{day(b.pickup)} → {day(b.dropoff)}</p>
      </Card>
      <Link to={`/bookings/${b.id}`} className="mt-6"><Button size="lg">View booking</Button></Link>
      <Link to="/" className="mt-3 block py-2 font-medium text-brand">Back to home</Link>
    </Screen>
  );
}
