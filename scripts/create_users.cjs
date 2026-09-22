const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    email: 'info@drivex.ae',
    password: process.env.INFO_PASSWORD,
    full_name: 'DriveX Info'
  },
  {
    email: 'K.neshastehchi@gmail.com',
    password: process.env.KN_PASSWORD,
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
