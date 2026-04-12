const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ampdpgwcjgoqbamfttlw.supabase.co';
const supabaseServiceKey = 'sb_secret_8uREf_ZA-QLiFDKcFj4dFQ_5E4aVNr-';
const tenantId = '22c42919-4f33-4463-ae13-39cc26993c64';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importVehicles() {
  const filePath = path.join(__dirname, '..', 'public', 'DrivexVehicles (1).xlsx');
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`Read ${data.length} rows from Excel.`);

  const vehicles = data.map(row => {
    // Helper to convert Excel date
    const convertDate = (val) => {
      if (!val) return null;
      if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toISOString();
      }
      return new Date(val).toISOString();
    };

    return {
      tenant_id: tenantId,
      source_row_number: row['#'],
      plate_number: row['Plate Number']?.toString(),
      make: row['Make'],
      model: row['Model'],
      year: row['Year'] ? parseInt(row['Year']) : null,
      color: row['Color'],
      categories_raw: row['Categories'],
      categories: row['Categories'] ? row['Categories'].split(',').map(s => s.trim()) : [],
      current_location: row['Current Location'],
      status: (row['Status'] || 'available').toLowerCase(),
      expected_return_date: convertDate(row['Expected Return Date']),
      latest_return_date: convertDate(row['Latest Return Date']),
      odometer: row['Odometer'] ? parseInt(row['Odometer']) : null,
      chassis_number: row['Chassis Number']?.toString(),
    };
  });

  const { error } = await supabase
    .from('vehicles')
    .insert(vehicles);

  if (error) {
    console.error('Error importing vehicles:', error);
    process.exit(1);
  } else {
    console.log(`Successfully imported ${vehicles.length} vehicles.`);
  }
}

importVehicles();
