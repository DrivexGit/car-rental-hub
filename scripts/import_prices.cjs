const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importPrices() {
  const filePath = path.join(__dirname, '..', 'public', 'DrivexVehicles_with_prices.xlsx');
  
  console.log(`Starting price import from: ${filePath}`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    console.log(`Read ${data.length} rows from Excel.`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const row of data) {
      const plateNumber = row['Plate Number']?.toString();
      const dailyPrice = row['Daily Price (AED)'];
      const weeklyPrice = row['Weekly Price (AED)'];
      const monthlyPrice = row['Monthly Price (AED)'];

      if (!plateNumber) {
        skipCount++;
        continue;
      }

      // We only update if at least one price is present
      if (dailyPrice === undefined && weeklyPrice === undefined && monthlyPrice === undefined) {
        skipCount++;
        continue;
      }

      const { data: updateData, error } = await supabase
        .from('vehicles')
        .update({
          daily_price: dailyPrice !== undefined ? parseFloat(dailyPrice) : null,
          weekly_price: weeklyPrice !== undefined ? parseFloat(weeklyPrice) : null,
          monthly_price: monthlyPrice !== undefined ? parseFloat(monthlyPrice) : null,
        })
        .eq('plate_number', plateNumber)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error(`Error updating vehicle ${plateNumber}:`, error.message);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Progress: Updated ${successCount} vehicles...`);
        }
      }
    }

    console.log(`\nImport Summary:`);
    console.log(`- Successfully updated: ${successCount}`);
    console.log(`- Skipped (no plate or no prices): ${skipCount}`);
    console.log(`- Errors: ${errorCount}`);

  } catch (error) {
    console.error('Fatal error during import:', error.message);
    process.exit(1);
  }
}

importPrices();
