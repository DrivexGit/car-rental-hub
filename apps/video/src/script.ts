// The tutorial: scenes, and the Persian caption for each moment. A caption's `at` is the label of a recorded moment
// (see capture/record.mjs); it shows from just before that moment until the next caption starts.
// Words inside {{ }} are shown left-to-right and bold (names of buttons and screens in the app).
export type Cap = { at: string; text: string };
export type SceneDef = { id: string; title: string; caps: Cap[] };

export const FPS = 30;
export const SPEED = 1.25; // the recordings are played slightly faster to keep the video short
export const INTRO = 105;
export const OUTRO = 105;

export const SCENES: SceneDef[] = [
  {
    id: "home", title: "ورود و صفحه‌ی اصلی",
    caps: [
      { at: "Mobile number", text: "شماره‌ی موبایل امارات خود را وارد کنید" },
      { at: "Send code", text: "روی {{Send code}} بزنید تا کد ۶ رقمی پیامک شود" },
      { at: "6-digit code", text: "کد را وارد کنید؛ بعد از ۶ رقم وارد می‌شوید" },
      { at: "Home", text: "صفحه‌ی اصلی؛ آفرها و رستوران‌های همکار" },
      { at: "Pending invoice", text: "فاکتور پرداخت‌نشده را از همین‌جا با {{Pay now}} پرداخت کنید" },
    ],
  },
  {
    id: "booking", title: "پیدا کردن و رزرو ماشین",
    caps: [
      { at: "Book", text: "از منوی بالا وارد {{Book}} شوید" },
      { at: "Daily, weekly, monthly", text: "اجاره‌ی روزانه، هفتگی یا ماهانه را انتخاب کنید" },
      { at: "Search", text: "با جستجو ماشین دلخواه را پیدا کنید" },
      { at: "View & book", text: "روی {{View & book}} بزنید" },
      { at: "Car page", text: "مشخصات و قیمت ماشین را ببینید، تاریخ و موارد اضافه را انتخاب کنید" },
      { at: "Continue", text: "روی {{Continue}} بزنید تا به پرداخت بروید" },
      { at: "Checkout", text: "خلاصه‌ی رزرو را بررسی و پرداخت کنید" },
    ],
  },
  {
    id: "bookings", title: "رزروهای من",
    caps: [
      { at: "Bookings", text: "همه‌ی رزروها در بخش {{Bookings}} هستند" },
      { at: "View details", text: "برای دیدن جزئیات روی {{View details}} بزنید" },
      { at: "Booking details", text: "تاریخ تحویل و برگشت، فاکتورها و Salik در یک صفحه" },
      { at: "Extend rental", text: "با {{Extend rental}} اجاره را تمدید کنید" },
      { at: "Choose the days", text: "تعداد روز را انتخاب کنید؛ فاکتور جدید به همین رزرو اضافه می‌شود" },
      { at: "Download invoice", text: "فاکتور رسمی را دانلود کنید" },
      { at: "Pay now", text: "فاکتور پرداخت‌نشده را با {{Pay now}} پرداخت کنید" },
    ],
  },
  {
    id: "support", title: "پشتیبانی",
    caps: [
      { at: "Support", text: "در بخش {{Support}} با دستیار هوشمند Drivex گفتگو کنید" },
      { at: "Quick question", text: "برای سؤال‌های رایج یکی از دکمه‌ها را بزنید" },
      { at: "Ask a question", text: "یا سؤال خود را بنویسید؛ به فارسی، انگلیسی و عربی جواب می‌دهد" },
      { at: "Urgent call", text: "در حالت اضطراری {{Urgent call}} را بزنید؛ تیم ما فوراً خبردار می‌شود" },
    ],
  },
  {
    id: "profile", title: "پروفایل، زبان و ظاهر",
    caps: [
      { at: "Account menu", text: "از منوی حساب به پروفایل، پرداخت‌ها و مدارک دسترسی دارید" },
      { at: "Theme", text: "رنگ‌بندی برنامه را عوض کنید" },
      { at: "Language", text: "زبان را با یک کلیک بین انگلیسی و عربی عوض کنید" },
    ],
  },
];
