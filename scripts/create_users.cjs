const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ampdpgwcjgoqbamfttlw.supabase.co';
const supabaseServiceKey = 'sb_secret_8uREf_ZA-QLiFDKcFj4dFQ_5E4aVNr-';
const tenantId = '22c42919-4f33-4463-ae13-39cc26993c64';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    email: 'info@drivex.ae',
    password: 'DriveX_Info_2026!#',
    full_name: 'DriveX Info'
  },
  {
    email: 'K.neshastehchi@gmail.com',
    password: 'KN_Admin_2026_Secure',
    full_name: 'Kamyar Neshastehchi'
  }
];

async function createUsers() {
  console.log('Starting user creation process...');

  for (const userData of users) {
    console.log(`Creating user: ${userData.email}...`);

    // 1) Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true // Confirm email automatically
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.warn(`User ${userData.email} already exists in Auth.`);
        // Try to fetch existing user to create profile if missing
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingUser = listData.users.find(u => u.email === userData.email);
        if (existingUser) {
          await createProfile(existingUser.id, userData.full_name, userData.email);
        }
      } else {
        console.error(`Error creating auth user ${userData.email}:`, authError.message);
      }
      continue;
    }

    if (authData && authData.user) {
      console.log(`Auth user created successfully for ${userData.email}. ID: ${authData.user.id}`);
      await createProfile(authData.user.id, userData.full_name, userData.email);
    }
  }

  console.log('User creation process completed.');
}

async function createProfile(userId, fullName, email) {
  console.log(`Creating/Updating profile for ${email}...`);
  
  const { error: profileError } = await supabase
    .from('staff_profiles')
    .upsert({
      id: userId,
      tenant_id: tenantId,
      full_name: fullName,
      role: 'admin',
      is_active: true
    });

  if (profileError) {
    console.error(`Error creating staff profile for ${email}:`, profileError.message);
  } else {
    console.log(`Staff profile successfully linked for ${email}.`);
  }
}

createUsers();
