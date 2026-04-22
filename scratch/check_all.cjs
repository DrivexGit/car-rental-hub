const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

async function checkLeads() {
  console.log('Querying leads...');
  const { data, error } = await supabase.from('leads').select('*').limit(5);
  if (error) {
    console.error('Error fetching leads:', error.message);
  } else {
    console.log('Leads found:', data.length);
    if (data.length > 0) console.log('Sample Lead:', data[0].full_name);
  }

  console.log('Querying customer_documents...');
  const { data: docs, error: dError } = await supabase.from('customer_documents').select('*').limit(10);
  if (dError) {
    console.error('Error fetching docs:', dError.message);
  } else {
    console.log('Docs found:', docs.length);
    if (docs.length > 0) console.log('Sample Doc:', JSON.stringify(docs[0], null, 2));
  }
}

checkLeads();
