// Text of the three public legal pages (English and Arabic). First drafts written for the app: DriveX must read them
// and have them checked by their legal adviser before the app opens to real customers. Lines that start with "• " render as bullets.
import type { Lang } from "@/lib/i18n";

export type Section = { h: string; p: string[] };
export type Doc = { title: string; updated: string; intro: string; sections: Section[] };
export type DocId = "terms" | "privacy" | "delete";

const EMAIL = "info@drivex.ae";

export const LEGAL: Record<DocId, Record<Lang, Doc>> = {
  terms: {
    en: {
      title: "Terms & conditions",
      updated: "Last updated: 8 October 2026",
      intro: "These terms apply when you use the Drivex app to book and manage a car rental from Drivex Car Rental LLC (\"Drivex\", \"we\", \"us\"). By creating an account or making a booking you agree to them.",
      sections: [
        { h: "1. Your rental agreement", p: ["Every rental is also covered by the rental agreement you sign for the car. If this page and your rental agreement differ about the car, the deposit, the insurance or the rental period, the rental agreement applies."] },
        { h: "2. Your account", p: [
          "• You sign in with a UAE mobile number. Keep the code we send you private and do not share your account.",
          "• The details you give us (name, phone, email, driving licence and ID documents) must be true and up to date.",
          "• You must meet the age and driving licence requirements shown for the car when you book. We may refuse or cancel a booking if the documents are missing, invalid or do not match.",
        ] },
        { h: "3. Bookings and payment", p: [
          "• Prices are shown in UAE dirhams (AED). Your invoice shows the VAT.",
          "• A booking is confirmed when the invoice is paid, unless we tell you otherwise. Online payments are handled by our payment provider; we never see or store your card number.",
          "• Extra days are added to your booking as a new invoice. We can only extend if the car is free after your return date.",
        ] },
        { h: "4. Changes and cancellation", p: ["You can ask to change or cancel a booking from the app or through Support. Changes depend on availability. Any refund follows your rental agreement and the rules of the payment provider."] },
        { h: "5. Driving, Salik and fines", p: [
          "• You are responsible for the car from pick-up until we receive it back, and for following UAE traffic laws.",
          "• Salik tolls, traffic fines, parking charges and similar costs that happen during your rental are yours. We add them to your account and invoice them to you, and we may share your details with the authority that issues them.",
          "• Please return the car on time. A late return can lead to extra charges.",
        ] },
        { h: "6. Insurance, accidents and damage", p: [
          "• Your cover (basic or full) is shown in your booking. Excess and exclusions are in your rental agreement.",
          "• After an accident, a breakdown or a theft, stay safe, call 999 if anyone is hurt, and tell us at once through the Urgent call button in Support or by phone. Do not repair or move the car without speaking to us.",
        ] },
        { h: "7. Using the app", p: [
          "• Use the app only for your own bookings and do not try to break, copy or misuse it.",
          "• The Drivex AI assistant gives general help from our information and your own bookings. It can make mistakes and it does not replace our team or your rental agreement. For urgent help, call us.",
        ] },
        { h: "8. Our responsibility", p: ["We do our best to keep the app available and correct. As far as UAE law allows, we are not responsible for losses that come from things outside our control, such as network problems, or for indirect losses. Nothing here limits rights you have by law."] },
        { h: "9. Changes to these terms", p: ["We may update these terms. The date at the top shows the latest version. If you keep using the app after a change, you accept the new version."] },
        { h: "10. Law and contact", p: [
          "These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai, and the Dubai courts can decide disputes, unless the law says otherwise.",
          `Questions? Contact us at ${EMAIL} or through Support in the app.`,
        ] },
      ],
    },
    ar: {
      title: "الشروط والأحكام",
      updated: "آخر تحديث: 8 أكتوبر 2026",
      intro: "تسري هذه الشروط عند استخدامك تطبيق درايفكس لحجز وإدارة تأجير سيارة من شركة درايفكس لتأجير السيارات ذ.م.م («درايفكس» أو «نحن»). بإنشاء حساب أو إجراء حجز فإنك توافق عليها.",
      sections: [
        { h: "1. عقد الإيجار", p: ["يخضع كل إيجار أيضاً لعقد الإيجار الذي توقعه للسيارة. إذا اختلفت هذه الصفحة مع عقد الإيجار بشأن السيارة أو مبلغ التأمين أو الضمان أو مدة الإيجار، فالعمل بعقد الإيجار."] },
        { h: "2. حسابك", p: [
          "• تسجل الدخول برقم جوال إماراتي. أبقِ الرمز الذي نرسله إليك سرياً ولا تشارك حسابك.",
          "• يجب أن تكون بياناتك (الاسم والهاتف والبريد ورخصة القيادة ووثائق الهوية) صحيحة ومحدثة.",
          "• يجب أن تستوفي شروط العمر ورخصة القيادة الظاهرة للسيارة عند الحجز. يحق لنا رفض الحجز أو إلغاؤه إذا كانت الوثائق ناقصة أو غير صالحة أو غير مطابقة.",
        ] },
        { h: "3. الحجز والدفع", p: [
          "• الأسعار بالدرهم الإماراتي (AED) وتظهر ضريبة القيمة المضافة في الفاتورة.",
          "• يتأكد الحجز عند دفع الفاتورة ما لم نخبرك بغير ذلك. تتم المدفوعات عبر الإنترنت من خلال مزود الدفع لدينا، ولا نرى رقم بطاقتك ولا نحتفظ به.",
          "• تُضاف الأيام الإضافية إلى حجزك بفاتورة جديدة، ولا يمكن التمديد إلا إذا كانت السيارة متاحة بعد موعد الإرجاع.",
        ] },
        { h: "4. التعديل والإلغاء", p: ["يمكنك طلب تعديل الحجز أو إلغائه من التطبيق أو عبر الدعم. يخضع التعديل للتوفر، ويتبع أي استرداد عقد الإيجار وقواعد مزود الدفع."] },
        { h: "5. القيادة وسالك والمخالفات", p: [
          "• أنت مسؤول عن السيارة من لحظة الاستلام حتى نستلمها منك، وعن الالتزام بقوانين المرور في الإمارات.",
          "• رسوم سالك والمخالفات المرورية ورسوم المواقف وما شابهها خلال مدة إيجارك تقع عليك. نضيفها إلى حسابك ونحاسبك عليها، ويحق لنا مشاركة بياناتك مع الجهة المصدرة لها.",
          "• يرجى إرجاع السيارة في الموعد، فقد يترتب على التأخير رسوم إضافية.",
        ] },
        { h: "6. التأمين والحوادث والأضرار", p: [
          "• يظهر نوع التغطية (أساسية أو شاملة) في حجزك، وتجد مبلغ التحمل والاستثناءات في عقد الإيجار.",
          "• عند وقوع حادث أو عطل أو سرقة، حافظ على سلامتك واتصل بالرقم 999 إذا كان هناك مصابون، وأبلغنا فوراً عبر زر «اتصال عاجل» في الدعم أو هاتفياً. لا تصلح السيارة ولا تنقلها قبل التواصل معنا.",
        ] },
        { h: "7. استخدام التطبيق", p: [
          "• استخدم التطبيق لحجوزاتك أنت فقط، ولا تحاول اختراقه أو نسخه أو إساءة استخدامه.",
          "• يقدم مساعد درايفكس الذكي مساعدة عامة من معلوماتنا وحجوزاتك. وقد يخطئ ولا يغني عن فريقنا أو عن عقد الإيجار. للمساعدة العاجلة اتصل بنا.",
        ] },
        { h: "8. مسؤوليتنا", p: ["نبذل جهدنا ليبقى التطبيق متاحاً وصحيحاً. وبالقدر الذي يسمح به القانون الإماراتي، لا نتحمل الخسائر الناتجة عن أمور خارجة عن سيطرتنا مثل مشاكل الشبكة، ولا الخسائر غير المباشرة. ولا يحد شيء هنا من حقوقك التي يقررها القانون."] },
        { h: "9. تعديل الشروط", p: ["قد نحدّث هذه الشروط، ويبين التاريخ في الأعلى آخر نسخة. باستمرارك في استخدام التطبيق بعد التعديل فإنك تقبل النسخة الجديدة."] },
        { h: "10. القانون والتواصل", p: [
          "تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة كما تطبق في إمارة دبي، وتختص محاكم دبي بالنظر في النزاعات ما لم ينص القانون على غير ذلك.",
          `لديك سؤال؟ تواصل معنا عبر ${EMAIL} أو من خلال الدعم في التطبيق.`,
        ] },
      ],
    },
  },

  privacy: {
    en: {
      title: "Privacy policy",
      updated: "Last updated: 8 October 2026",
      intro: "Drivex Car Rental LLC (\"Drivex\", \"we\", \"us\") respects your privacy. This page explains what personal data the Drivex app collects, why, who sees it, and what you can do about it. We follow the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021).",
      sections: [
        { h: "1. What we collect", p: [
          "• Account: your name, UAE mobile number, email (optional) and profile photo (optional).",
          "• Rentals: your bookings, dates, the car, invoices, payment status, Salik and traffic fines. We do not see or store your card number; payments are handled by our payment provider.",
          "• Documents: images of your driving licence, Emirates ID or passport that you upload, and whether we approved them.",
          "• Support: your messages with the Drivex AI assistant and our team, and urgent requests.",
          "• Device: if you allow notifications, a notification address for your device. Your language and theme are kept on your device.",
        ] },
        { h: "2. Why we use it", p: [
          "• To create your account, confirm your phone number and run your bookings.",
          "• To issue invoices, take payments and handle fines and tolls.",
          "• To check that you can legally drive the car you rent.",
          "• To give you support, including urgent help after an accident or breakdown.",
          "• To send you notifications about your bookings and invoices, and offers if you allow them.",
          "• To keep the service safe and to meet our legal duties.",
        ] },
        { h: "3. Who we share it with", p: [
          "We do not sell your data. We share it only with:",
          "• Service providers who run the app for us: hosting and database, text messages, payments, notifications, messaging and the AI assistant.",
          "• Authorities, when the law requires it, for example for traffic fines or an accident report.",
          "These providers may only use your data to serve us, and some may process it outside the UAE with appropriate safeguards.",
        ] },
        { h: "4. The AI assistant", p: ["When you chat with the Drivex AI assistant, your message and the details needed to answer it (such as your own bookings and invoices) are sent to our AI provider to write the reply. Please do not type card numbers, passwords or other sensitive details in the chat."] },
        { h: "5. How long we keep it", p: ["We keep your data while your account is open and for as long as the law or our legitimate needs require, for example invoices, fines and accident records. When we no longer need it, we delete it or make it anonymous."] },
        { h: "6. Security", p: ["We use access controls and encrypted connections to protect your data. No system is perfectly secure, so please keep your sign-in code private."] },
        { h: "7. Your rights", p: [
          "You can ask us to give you a copy of your data, correct it, delete it, or stop some uses of it, and you can switch notifications off in the app (Profile → Notifications).",
          "To delete your account and data, use the Delete my account page. For other requests, write to us.",
        ] },
        { h: "8. Children", p: ["The app is for adults who can legally rent a car. We do not knowingly collect data from children."] },
        { h: "9. Changes and contact", p: [
          "We may update this policy and will show the date above.",
          `Questions or requests: ${EMAIL}, or Support in the app.`,
        ] },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      updated: "آخر تحديث: 8 أكتوبر 2026",
      intro: "تحترم شركة درايفكس لتأجير السيارات ذ.م.م («درايفكس» أو «نحن») خصوصيتك. توضح هذه الصفحة البيانات الشخصية التي يجمعها تطبيق درايفكس، ولماذا، ومن يطلع عليها، وما يمكنك فعله. نلتزم بقانون حماية البيانات الشخصية في دولة الإمارات (المرسوم بقانون اتحادي رقم 45 لسنة 2021).",
      sections: [
        { h: "1. ما الذي نجمعه", p: [
          "• الحساب: اسمك ورقم جوالك الإماراتي والبريد الإلكتروني (اختياري) وصورة الملف (اختيارية).",
          "• الإيجار: حجوزاتك وتواريخها والسيارة والفواتير وحالة الدفع وسالك والمخالفات المرورية. لا نرى رقم بطاقتك ولا نحتفظ به، فالدفع يتم عبر مزود الدفع لدينا.",
          "• الوثائق: صور رخصة القيادة أو الهوية الإماراتية أو جواز السفر التي ترفعها، وهل اعتمدناها.",
          "• الدعم: رسائلك مع مساعد درايفكس الذكي وفريقنا، وطلباتك العاجلة.",
          "• الجهاز: إذا سمحت بالإشعارات، عنوان إشعارات لجهازك. وتبقى لغتك ومظهر التطبيق محفوظين على جهازك.",
        ] },
        { h: "2. لماذا نستخدمها", p: [
          "• لإنشاء حسابك والتحقق من رقم هاتفك وإدارة حجوزاتك.",
          "• لإصدار الفواتير وتحصيل المدفوعات ومعالجة المخالفات والرسوم.",
          "• للتأكد من أنك تستطيع قانونياً قيادة السيارة التي تستأجرها.",
          "• لتقديم الدعم، ومنه المساعدة العاجلة بعد حادث أو عطل.",
          "• لإرسال إشعارات عن حجوزاتك وفواتيرك، وعن العروض إذا سمحت بها.",
          "• للحفاظ على أمان الخدمة والوفاء بالتزاماتنا القانونية.",
        ] },
        { h: "3. مع من نشاركها", p: [
          "لا نبيع بياناتك. نشاركها فقط مع:",
          "• مزودي الخدمة الذين يشغلون التطبيق لصالحنا: الاستضافة وقاعدة البيانات والرسائل النصية والدفع والإشعارات والمراسلة والمساعد الذكي.",
          "• الجهات الرسمية عندما يطلب القانون ذلك، مثل المخالفات المرورية أو بلاغ حادث.",
          "لا يجوز لهؤلاء استخدام بياناتك إلا لخدمتنا، وقد يعالج بعضهم البيانات خارج الإمارات مع ضمانات مناسبة.",
        ] },
        { h: "4. المساعد الذكي", p: ["عندما تتحدث مع مساعد درايفكس الذكي، تُرسل رسالتك والتفاصيل اللازمة للإجابة (مثل حجوزاتك وفواتيرك) إلى مزود الذكاء الاصطناعي لدينا لكتابة الرد. يرجى عدم كتابة أرقام البطاقات أو كلمات المرور أو أي تفاصيل حساسة في المحادثة."] },
        { h: "5. مدة الاحتفاظ", p: ["نحتفظ ببياناتك طالما حسابك مفتوح، ولما يتطلبه القانون أو احتياجاتنا المشروعة، مثل الفواتير والمخالفات وسجلات الحوادث. وحين لا نحتاجها نحذفها أو نجعلها مجهولة الهوية."] },
        { h: "6. الأمان", p: ["نستخدم ضوابط وصول واتصالات مشفرة لحماية بياناتك. لا يوجد نظام آمن تماماً، لذا يرجى إبقاء رمز الدخول سرياً."] },
        { h: "7. حقوقك", p: [
          "يمكنك أن تطلب منا نسخة من بياناتك أو تصحيحها أو حذفها أو إيقاف بعض استخداماتها، ويمكنك إيقاف الإشعارات من التطبيق (الملف الشخصي ← الإشعارات).",
          "لحذف حسابك وبياناتك استخدم صفحة «حذف حسابي». ولأي طلب آخر راسلنا.",
        ] },
        { h: "8. الأطفال", p: ["التطبيق للبالغين الذين يحق لهم قانوناً استئجار سيارة. ولا نجمع عمداً بيانات الأطفال."] },
        { h: "9. التعديلات والتواصل", p: [
          "قد نحدّث هذه السياسة ونبين التاريخ في الأعلى.",
          `للأسئلة والطلبات: ${EMAIL} أو الدعم في التطبيق.`,
        ] },
      ],
    },
  },

  delete: {
    en: {
      title: "Delete my account",
      updated: "Last updated: 8 October 2026",
      intro: "You can ask us to delete your Drivex account and personal data at any time. Fill in the form below and send it to us by email or WhatsApp.",
      sections: [
        { h: "What happens", p: [
          "• We confirm that the request is yours, using the mobile number on your account.",
          "• We aim to finish within 30 days and we tell you when it is done.",
          "• We delete your profile, photo, uploaded documents, chat messages and notification settings.",
        ] },
        { h: "What we may have to keep", p: [
          "Some records must be kept for the time the law requires, for example invoices, payments, Salik and traffic fines, and accident reports. We keep only what is needed and delete it when that time ends.",
        ] },
        { h: "Before you ask", p: [
          "• Open bookings must be finished or cancelled, and unpaid invoices and fines must be settled. We cannot delete an account with an active rental.",
          "• Deleting is permanent. You will need to create a new account to book again, and your past bookings and offers cannot be restored.",
        ] },
      ],
    },
    ar: {
      title: "حذف حسابي",
      updated: "آخر تحديث: 8 أكتوبر 2026",
      intro: "يمكنك في أي وقت أن تطلب منا حذف حسابك في درايفكس وبياناتك الشخصية. عبّئ النموذج أدناه وأرسله إلينا بالبريد الإلكتروني أو واتساب.",
      sections: [
        { h: "ماذا يحدث", p: [
          "• نتأكد أن الطلب منك، من خلال رقم الجوال المسجل في حسابك.",
          "• نهدف إلى إنهاء الطلب خلال 30 يوماً ونخبرك عند الانتهاء.",
          "• نحذف ملفك الشخصي وصورتك والوثائق التي رفعتها ورسائل المحادثة وإعدادات الإشعارات.",
        ] },
        { h: "ما قد نضطر إلى الاحتفاظ به", p: [
          "يجب الاحتفاظ ببعض السجلات للمدة التي يقتضيها القانون، مثل الفواتير والمدفوعات ورسوم سالك والمخالفات المرورية وبلاغات الحوادث. نحتفظ بما يلزم فقط ونحذفه عند انتهاء المدة.",
        ] },
        { h: "قبل أن تطلب", p: [
          "• يجب إنهاء الحجوزات المفتوحة أو إلغاؤها وتسوية الفواتير والمخالفات غير المسددة. لا يمكن حذف حساب لديه إيجار قائم.",
          "• الحذف نهائي. ستحتاج إلى إنشاء حساب جديد للحجز مرة أخرى، ولا يمكن استعادة حجوزاتك السابقة وعروضك.",
        ] },
      ],
    },
  },
};
