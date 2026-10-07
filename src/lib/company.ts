// Seller details printed on invoices. The TRN (VAT registration number) comes from the environment: set VITE_COMPANY_TRN.
export const COMPANY = {
  name: 'Drivex Car Rental LLC',
  address: 'Dubai, United Arab Emirates', // ponytail: replace with the registered address from DriveX
  phone: '+971 56 121 5152',
  email: 'info@drivex.ae',
  trn: (import.meta.env.VITE_COMPANY_TRN as string | undefined) || undefined,
};
