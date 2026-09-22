const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, make, model, plate_number')
    .order('make');

  if (error) {
    console.error('Error fetching vehicles:', error.message);
  } else {
    console.log('--- VEHICLE LIST ---');
    data.forEach(v => {
      console.log(`${v.make} ${v.model} (${v.plate_number}) -> UUID: ${v.id}`);
    });
    console.log('--------------------');
  }
}

getVehicles();
