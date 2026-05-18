const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ampdpgwcjgoqbamfttlw.supabase.co';
const supabaseServiceKey = 'sb_secret_8uREf_ZA-QLiFDKcFj4dFQ_5E4aVNr-';

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
