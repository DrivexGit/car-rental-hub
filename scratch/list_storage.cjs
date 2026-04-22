const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const url = urlMatch[1];
const key = keyMatch[1];

const supabase = createClient(url, key);

async function listAll() {
  console.log('Listing buckets...');
  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  if (bError) {
    console.error('Error listing buckets:', bError.message);
  } else {
    console.log('Buckets:', buckets.map(b => b.name));
  }

  const targetBucket = 'customer-documents';
  console.log(`Listing files in bucket: ${targetBucket}...`);
  const { data: files, error: fError } = await supabase.storage.from(targetBucket).list('', { limit: 100 });
  if (fError) {
    console.error('Error listing files:', fError.message);
  } else {
    console.log('Files in root:', files.map(f => f.name));
  }
}

listAll();
