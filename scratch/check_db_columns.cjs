const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching vehicles:', error.message);
  } else if (data.length > 0) {
    console.log('Available columns:', Object.keys(data[0]));
  } else {
    console.log('No vehicles found to check columns.');
  }
}

checkColumns();
