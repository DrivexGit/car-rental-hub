const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const faqs = [
  {
    category: 'Security Deposit',
    question: 'How much is the security deposit and what does it cover?',
    answer: "The deposit starts at 1,000 AED and can go up to 3,000 AED depending on the luxe car you choose. It covers potential things like traffic fines, Salik tolls, or late returns. Since we offer unlimited mileage, you don't even have to worry about extra distance charges!",
    sort_order: 10
  },
  {
    category: 'Security Deposit',
    question: 'How can I pay the security deposit?',
    answer: "We keep it easy for you. You can block it on your credit card, or pay cash—we accept both AED in Dubai and IRR in Iran. International bank transfers are also fine, as long as you cover those pesky transfer fees.",
    sort_order: 20
  },
  {
    category: 'Security Deposit',
    question: 'When and how will I get my deposit back?',
    answer: "You’ll get it back in 14 to 30 days. Why the wait? We just need to make sure all RTA and Dubai Police fines are accounted for. We can refund it in AED or IRR, whichever is more convenient for you.",
    sort_order: 30
  },
  {
    category: 'Rules & Penalties',
    question: 'What happens if I smoke in the car?',
    answer: "We take pride in our spotless, new-car smell, so smoking is a no-go. It carries a fine of 1,000 AED from the police plus 500 AED from us. Let's keep the interior fresh for your whole journey!",
    sort_order: 40
  },
  {
    category: 'Rules & Penalties',
    question: 'What is your fuel policy?',
    answer: "Your car arrives with a full tank of gas, and we just ask for it back the same way. It saves you time and lets the next guest hit the road immediately!",
    sort_order: 50
  },
  {
    category: 'Rules & Penalties',
    question: 'How does the Salik (Toll) system work and how much does it cost?',
    answer: "Dubai’s electronic toll system is called Salik. Every time you pass a gate, it’s automatically recorded by a tag on your car. We charge 6 AED per passage (which includes the RTA fee and a small admin fee). No need to pay on the spot; we’ll settle the total from your deposit at the end!",
    sort_order: 60
  },
  {
    category: 'Booking & Documents',
    question: 'What documents do I need to rent a car?',
    answer: "Super simple: just a clear photo of your international driver's license, passport, visa, and your flight ticket. We'll handle the rest so you can start your Dubai adventure.",
    sort_order: 70
  },
  {
    category: 'Booking & Documents',
    question: 'How can I check for traffic fines?',
    answer: "You can hop onto the Dubai Police website anytime and check by plate number. It’s transparent and quick. We also apply a small 50 AED fee for handling any violations on our side.",
    sort_order: 80
  },
  {
    category: 'Insurance',
    question: "What's the difference between Standard and Full Insurance?",
    answer: "Standard is free and covers the essentials. But if you want total peace of mind, go for Full Insurance—it covers body, glass, and tires, and removes the 3,000 AED excess liability. It’s the best way to enjoy our high-end fleet without a single worry!",
    sort_order: 90
  },
  {
    category: 'Delivery & Convenience',
    question: 'Can you deliver the car to my location?',
    answer: "Definitely! One of our perks is free delivery and pickup anywhere in Dubai during our working hours (9 AM to 6 PM). We bring the car to you, and we take it back when you're done—completely free of charge.",
    sort_order: 100
  },
  {
    category: 'Driving Limits',
    question: 'Is there a limit on how many kilometers I can drive?',
    answer: "Nope! We believe your journey shouldn't have limits. That’s why we offer unlimited mileage on all our vehicles. Drive as much as you want, wherever you want in the UAE!",
    sort_order: 110
  },
  {
    category: 'Quality & Reliability',
    question: 'What kind of condition are the cars in?',
    answer: "You’re in for a treat. We have one of the newest and most diverse fleets in Dubai. Every vehicle is 100% healthy, meticulously inspected, and feels like it just rolled off the showroom floor. No old cars, no issues—just pure luxury and reliability.",
    sort_order: 120
  },
  {
    category: 'Location & Contact',
    question: 'Where is your office located and how can I reach you?',
    answer: "We’re right in the heart of the action! You can find us on Google Maps here: https://maps.app.goo.gl/JLbyg2qNbwZPmbWU7. If you need anything, give us a shout at +971 2 458 9322 or drop an email to info@drivex.ae. We're always here to help!",
    sort_order: 130
  },
  {
    category: 'About DriveX',
    question: 'Who is DriveX and why should I choose you?',
    answer: "We’re more than just a rental company; we’re your luxury travel partner. Founded by Kamyar Neshastehchi with 10+ years of international expertise, we offer 300+ of the latest cars with unlimited mileage, free delivery, and 24/7 support. We treat every customer like family!",
    sort_order: 140
  },
  {
    category: 'Legal & Driving License',
    question: 'Do I need an International Driving Permit (IDP) to drive in Dubai?',
    answer: "If you're a tourist from a country like the US, UK, Canada, or any GCC country, your valid national license is usually enough! For many other countries, you'll need an IDP alongside your original license. If your license isn't in English or Arabic, an IDP is a must-have.",
    sort_order: 150
  },
  {
    category: 'Legal & Driving License',
    question: 'What is the minimum age to rent a car?',
    answer: "To drive our standard cars, you need to be at least 21 years old. For our high-performance and luxury fleet, the minimum age is 25. Also, ensure your national license has been valid for at least one year.",
    sort_order: 160
  },
  {
    category: 'Safety & Accidents',
    question: 'What should I do if I get into an accident?',
    answer: "First, stay calm and call the police (999 for emergencies, 901 for minor accidents). A Police Report is mandatory in Dubai for any insurance claim to be processed. Once you have the report, notify us immediately, and we’ll guide you through the next steps.",
    sort_order: 170
  },
  {
    category: 'Rules & Penalties',
    question: 'Are there any speed limits or "buffers" I should know about?',
    answer: "This is vital for your safety and wallet! In Dubai and Sharjah, there is a 20 km/h buffer (if the limit is 100, you're safe up to 120). But in Abu Dhabi, there is ZERO buffer—if the sign says 100, the camera flashes at 101 km/h. Always follow the posted signs carefully!",
    sort_order: 180
  },
  {
    category: 'Parking',
    question: 'How does parking work in Dubai vs. Sharjah?',
    answer: "Both cities use zoned paid parking (usually 8 AM – 10 PM): \n- In Dubai: Managed by RTA and generally free on Sundays. Pay via the RTA app or SMS to 7275. \n- In Sharjah: Managed by ShjMunicipality and free on Fridays (except for '7-day zones' with blue signs). Pay via the Sharjah Digital app or SMS to 5566.",
    sort_order: 190
  },
  {
    category: 'Driving Between Emirates',
    question: 'Can I drive to Sharjah or Abu Dhabi? Are there extra charges?',
    answer: "You're free to explore! There are no borders or checkpoints between Emirates. Just remember: \n1. Abu Dhabi Tolls (Darb): High-traffic gates in Abu Dhabi charge 4 AED during peak hours (7-9 AM & 5-7 PM, Mon–Sat). \n2. Traffic: Be prepared for heavy rush-hour traffic between Dubai and Sharjah. \n3. Authorized use: Your insurance covers you across all Emirates, but remember that crossing the border into Oman is NOT allowed.",
    sort_order: 200
  },
  {
    category: 'Additional Drivers',
    question: 'Can someone else drive the car while I’m renting it?',
    answer: "Yes, but they must be added to the rental agreement as an additional driver. We’ll need their passport and driving license just like yours. If an unregistered person drives the car, the insurance will be void if anything happens.",
    sort_order: 210
  },
  {
    category: 'Fleet & Pricing',
    question: 'What is your general daily rental price range?',
    answer: 'Our daily rental prices currently start from AED 119 for models like the Toyota Yaris and Hyundai i10 Grand, and go up to AED 1,999 for premium models like the Range Rover Vogue, Mercedes-Benz SL Convertible, and Porsche 911.',
    sort_order: 220
  },
  {
    category: 'Fleet & Pricing',
    question: 'What is your general monthly rental price range?',
    answer: 'Our monthly rental prices currently start from AED 2,199 for models like the MG ZS and Hyundai i10 Grand, and go up to AED 32,000 for the Mercedes-Benz G63.',
    sort_order: 230
  },
  {
    category: 'Fleet & Pricing',
    question: 'What are your most budget-friendly rental cars?',
    answer: 'Some of our most budget-friendly options include the Toyota Yaris and Hyundai i10 Grand from AED 119/day and AED 699/week. For monthly rentals, options like the MG ZS and Hyundai i10 Grand start from AED 2,199/month.',
    sort_order: 240
  },
  {
    category: 'Fleet & Pricing',
    question: 'Do you have affordable SUVs?',
    answer: 'Yes. Affordable SUV options include the GAC GS3 from AED 149/day, Hyundai Creta from AED 179/day, Chevrolet Captiva from AED 199/day, and Toyota Fortuner from AED 229/day. Their monthly prices range from AED 2,990 to AED 5,999 depending on the model.',
    sort_order: 250
  },
  {
    category: 'Fleet & Pricing',
    question: 'Do you offer 7-seater cars, and what are the prices?',
    answer: 'Yes. Our 7-seater options include Chevrolet Captiva from AED 199/day, Toyota Fortuner from AED 229/day, Chevrolet Tahoe from AED 599/day, Nissan Patrol from AED 590/day, Mercedes-Benz GLS 450 from AED 899/day, and Cadillac Escalade from AED 1,199/day. Monthly options include Captiva from AED 2,990, Fortuner from AED 5,999, Tahoe from AED 10,999, and Patrol from AED 13,990.',
    sort_order: 260
  },
  {
    category: 'Fleet & Pricing',
    question: 'What sports or fun-to-drive cars do you have?',
    answer: 'Sportier options on our list include the Mini Cooper from AED 299/day or AED 4,990/month, the Dodge Charger from AED 349/day or AED 5,499/month, the Mercedes-Benz SL Convertible from AED 1,999/day, and the Porsche 911 from AED 1,999/day.',
    sort_order: 270
  },
  {
    category: 'Fleet & Pricing',
    question: 'Do you offer luxury Mercedes models?',
    answer: 'Yes. Our listed Mercedes models include the C Class, GLB, GLE, GLS 450, S Class, G63, and SL Convertible. Prices start from AED 399/day for the GLB and go up to AED 1,999/day for the SL Convertible. Monthly Mercedes options range from AED 5,999 for the GLB to AED 32,000 for the G63.',
    sort_order: 280
  },
  {
    category: 'Fleet & Pricing',
    question: 'What are your premium or special cars?',
    answer: 'Some of our standout premium models include the Range Rover Vogue at AED 1,999/day, Mercedes-Benz G63 at AED 1,699/day or AED 32,000/month, Porsche 911 at AED 1,999/day, Mercedes-Benz SL Convertible at AED 1,999/day, and Cadillac Escalade at AED 1,199/day.',
    sort_order: 290
  },
  {
    category: 'Fleet & Pricing',
    question: 'What is a good mid-range premium option?',
    answer: 'If you want something premium without going into ultra-luxury pricing, good options include the Audi A6 from AED 349/day or AED 5,990/month, Mercedes-Benz GLB from AED 399/day or AED 5,999/month, Mini Cooper from AED 299/day or AED 4,990/month, and Hyundai Santafe from AED 299/day or AED 6,499/month.',
    sort_order: 300
  },
  {
    category: 'Fleet & Pricing',
    question: 'Do you have unique brands or models that are not very common everywhere?',
    answer: 'Yes. Besides popular brands like Toyota, Hyundai, and Nissan, our list also includes models like the Jetour T2, Citroen C3, Opel Crossland, MG ZS, GAC GS3, and Mini Cooper. Prices for these models range from AED 149/day up to AED 399/day, with monthly options starting from AED 2,199.',
    sort_order: 310
  }
];

async function importFaqs() {
  console.log(`Starting FAQ import for tenant ${tenantId}...`);

  // First, clear existing FAQs for this tenant to avoid duplicates
  const { error: deleteError } = await supabase
    .from('faq_entries')
    .delete()
    .eq('tenant_id', tenantId);

  if (deleteError) {
    console.error('Error clearing old FAQs:', deleteError);
    process.exit(1);
  }

  const dataToInsert = faqs.map(f => ({
    ...f,
    tenant_id: tenantId,
    is_active: true
  }));

  const { data, error } = await supabase
    .from('faq_entries')
    .insert(dataToInsert)
    .select();

  if (error) {
    console.error('Error importing FAQs:', error);
    process.exit(1);
  } else {
    console.log(`Successfully imported ${data.length} FAQ entries.`);
  }
}

importFaqs();
