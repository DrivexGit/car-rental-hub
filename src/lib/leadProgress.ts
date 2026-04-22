
export const calculateDynamicProgress = (lead: any) => {
  const state = lead.conversation_states;
  const rawFields = Array.isArray(state) ? state[0]?.collected_fields : state?.collected_fields;
  let fields: any = {};
  
  try {
    fields = typeof rawFields === 'string' ? JSON.parse(rawFields) : (rawFields || {});
  } catch (e) {
    fields = {};
  }

  let p = 0;
  
  // Handling both old flat structure and new nested structure
  const user = fields.user || {};
  const booking = fields.booking || {};
  
  // 1. User Info (25%)
  // Name (10%)
  if (user.name || fields.name || lead.full_name) p += 10;
  // Phone (10%)
  if (user.phone || fields.phone || lead.whatsapp_number) p += 10;
  // Language (5%)
  if (user.language || fields.language) p += 5;
  
  // 2. Booking Info (60%)
  // Car (15%)
  if (booking.car || fields.car) p += 15;
  // Date (15%)
  if (booking.date || fields.date) p += 15;
  // Duration (10%)
  if (booking.duration || fields.duration) p += 10;
  // Pickup Location (10%)
  if (booking.pickup_location || fields.pickup_location) p += 10;
  // Dropoff Location (10%)
  if (booking.dropoff_location || fields.dropoff_location) p += 10;
  
  // 3. Confirmation Status (15%)
  // Confirmed (15%)
  if (booking.confirmed || fields.confirmed) p += 15;

  // Determine color based on progress
  let c = 'bg-slate-400';
  if (p >= 100) c = 'bg-emerald-500';
  else if (p > 70) c = 'bg-green-500';
  else if (p > 50) c = 'bg-blue-500';
  else if (p > 30) c = 'bg-indigo-500';
  else if (p > 0) c = 'bg-slate-500';

  return { p: Math.min(p, 100), c };
};
