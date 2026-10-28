import {createContext,useCallback,useContext,useState} from 'react';
import type {ReactNode} from 'react';

export type Lang = 'kz' | 'ru' | 'en';

export interface Translations {
  /* Header / Nav */
  navHome: string;
  navCatalog: string;
  navAbout: string;
  navDelivery: string;
  navContacts: string;
  navAccount: string;
  navLogin: string;
  navLogout: string;
  cartLabel: string;
  cartCount: (n: number) => string;

  /* Hero */
  heroEyebrow: string;
  heroH1Line1: string;
  heroH1Line2: string;
  heroH1Brand: string;
  heroSubtitle: string;
  heroButton: string;
  heroNote: string;

  /* Benefits */
  benefit1a: string; benefit1b: string;
  benefit2a: string; benefit2b: string;
  benefit3a: string; benefit3b: string;
  benefit4a: string; benefit4b: string;

  /* Sections */
  sectionCategoriesEyebrow: string;
  sectionCategoriesTitle: string;
  sectionCatalogLink: string;
  sectionFavoritesEyebrow: string;
  sectionFavoritesTitle: string;
  sectionFavoritesLink: string;

  /* About section */
  aboutEyebrow: string;
  aboutTitle: string;
  aboutP1: string;
  aboutP2: string;
  aboutButton: string;
  aboutCaption: string;
  photoCaption: string;

  /* Map section */
  mapTitle: string;
  mapEyebrow: string;
  mapAddress: string;
  mapHours: string;
  mapHoursValue: string;
  mapPhone: string;

  /* Footer */
  footerTagline: string;
  footerHistory: string;
  footerDelivery: string;
  footerContacts: string;
  footerMoment: string;
  footerWarm: string;
  footerPrivacy: string;
  footerTerms: string;
  and: string;
  cookieText: string;
  cookieAccept: string;
  cookieMore: string;
  checkoutLegalNotice: string;
  authLegalNotice: string;

  /* Mobile bottom nav */
  bottomHome: string;
  bottomCatalog: string;
  bottomCart: string;
  bottomAccount: string;

  /* Info pages */
  breadcrumbHome: string;
  infoAboutCrumb: string;
  infoDeliveryCrumb: string;
  infoContactsCrumb: string;
  infoPrivacyCrumb: string;
  infoAboutEyebrow: string;
  infoAboutTitle: string;
  infoAboutH2: string;
  infoAboutP1: string;
  infoAboutP2: string;
  infoAboutButton: string;
  infoDeliveryTitle: string;
  infoDeliveryH2: string;
  infoDeliveryP1: string;
  infoDeliveryP2: string;
  infoPaymentH2: string;
  infoPaymentP1: string;
  infoPaymentP2: string;
  infoContactsTitle: string;
  infoAddressH2: string;
  infoAddressP: string;
  infoOrderH2: string;
  infoOrderP: string;
  infoOrderButton: string;
  infoPrivacyTitle: string;
  infoPrivacyP1: string;
  infoPrivacyP2: string;
  infoPrivacyP3: string;

  /* Auth */
  authWelcome: string;
  authH2: string;
  authEyebrow: string;
  authLoginTitle: string;
  authRegisterTitle: string;
  authResetTitle: string;
  authLoginSub: string;
  authRegisterSub: string;
  authResetSub: string;
  authCheckoutSub: string;
  authTabLogin: string;
  authTabRegister: string;
  authName: string;
  authNamePlaceholder: string;
  authEmail: string;
  authPassword: string;
  authPasswordPlaceholder: string;
  authNewPasswordPlaceholder: string;
  authRegisterNote: string;
  authButtonLogin: string;
  authButtonRegister: string;
  authButtonReset: string;
  authButtonBusy: string;
  authForgot: string;
  authBackToLogin: string;
  authSafe: string;
  authBack: string;
  authSentNote: string;
  authResetBack: string;

  /* Cart */
  cartTitle: string;
  cartEmpty: string;
  cartEmptyP: string;
  cartToCatalog: string;
  cartContinue: string;
  cartItems: string;
  cartDelivery: string;
  cartTotal: string;
  cartOrder: string;
  cartPayNote: string;
  cartPending: string;

  /* Checkout */
  checkoutBack: string;
  checkoutTitle: string;
  checkoutStep1: string;
  checkoutStep1Title: string;
  checkoutStep2: string;
  checkoutStep2Title: string;
  checkoutStep3: string;
  checkoutStep3Title: string;
  checkoutStep3Note: string;
  checkoutName: string;
  checkoutNamePlaceholder: string;
  checkoutPhone: string;
  checkoutPhonePlaceholder: string;
  checkoutAddress: string;
  checkoutAddressPl: string;
  checkoutComment: string;
  checkoutCommentPl: string;
  checkoutCommentOpt: string;
  checkoutDeliveryNote: string;
  checkoutDeliveryDemo: string;
  checkoutOrderTitle: string;
  checkoutRefreshBtn: string;
  checkoutRefreshing: string;
  checkoutItems: string;
  checkoutDelivery: string;
  checkoutTotal: string;
  checkoutReviewLabel: string;
  checkoutBtnConfirm: string;
  checkoutBtnUpdated: string;
  checkoutBtnBusy: string;
  checkoutBtnChecking: string;
  checkoutPayNote: string;
  checkoutMyOrders: string;
  checkoutNewOrder: string;

  /* Success */
  successEyebrow: string;
  successTitle: string;
  successP: string;
  successTotalLabel: string;
  successPayNote: string;
  successTrack: string;
  successBack: string;

  /* 404 */
  notFound: string;
  toHome: string;

  /* Loading / Errors */
  loading: string;
  retry: string;
  storageWarning: string;

  /* Notices */
  addedToCart: string;
  loggedOut: string;

  /* Product card */
  soonAvail: string;
  buy: string;
  outOfStock: string;
  inCart: (n: number) => string;
  perItem: string;
  toCart: string;
  selectedItems: (n: number) => string;
  withoutDelivery: string;
  toCartBtn: string;

  /* Catalog */
  catalogTitle: string;
  catalogEyebrow: string;
  catalogDesc: string;
  catalogAll: string;
  searchPlaceholder: string;
  resultsCount: (n: number) => string;
  noResults: string;
  noResultsSub: string;
  resetFilters: string;

  /* Password reset page */
  newPassword: string;
  newPasswordLabel: string;
  newPasswordSave: string;
  newPasswordSaving: string;
  newPasswordDone: string;
  newPasswordLogin: string;

  /* Account / profile shared */
  accountOrLogin: string;

  /* Lang switcher labels */
  langKz: string;
  langRu: string;
  langEn: string;
}

const kz: Translations = {
  navHome:'Басты бет', navCatalog:'Каталог', navAbout:'Біз туралы',
  navDelivery:'Жеткізу', navContacts:'Байланыс',
  navAccount:'Жеке кабинет', navLogin:'Кіру', navLogout:'Шығу',
  cartLabel:'Себет', cartCount:(n)=>`Себет, ${n} тауар`,

  heroEyebrow:'ДӘМ · ШАБЫТ · ДӘСТҮР',
  heroH1Line1:'Авторлық', heroH1Line2:'кондитерлік', heroH1Brand:'Anasym',
  heroSubtitle:'Күн сайын жасалатын свежий нан-тоқаш,\nдесерттер және торттар.',
  heroButton:'Каталогты ашу', heroNote:'Жанымен дайындаймыз. Күн сайын.',

  benefit1a:'Свежий', benefit1b:'ингредиенттер',
  benefit2a:'Авторлық', benefit2b:'рецепттер',
  benefit3a:'Табиғи', benefit3b:'құрам',
  benefit4a:'Қолмен', benefit4b:'жасалған',

  sectionCategoriesEyebrow:'СҮЙІСПЕНШІЛІКПЕН ЖАСАЛҒАН',
  sectionCategoriesTitle:'Біздің бұйымдар',
  sectionCatalogLink:'Бүкіл каталог',
  sectionFavoritesEyebrow:'ШАЙ МЕН ТАҒЫ ДА',
  sectionFavoritesTitle:'Өзіңізді сыйлауға себеп',
  sectionFavoritesLink:'Өзіңізге таңдаңыз',

  aboutEyebrow:'БІЗ ТУРАЛЫ',
  aboutTitle:'Әр нан-тоқашта — жан парасы',
  aboutP1:'Anasym — қарапайым ингредиенттер ерекше нәрсеге айналатын орын. Таныс дәмдерді, авторлық рецепттерді және өз ісіне деген сүйіспеншілікті ұштастырамыз.',
  aboutP2:'Баяу таңертеңге, отбасылық мерекеге немесе жай ыстық кездесуге арналған.',
  aboutButton:'Біздің тарих', aboutCaption:'Мастерство в каждом движении',
  photoCaption:'Мастерство в каждом движении',

  mapEyebrow:'МЕКЕН-ЖАЙЫМЫЗ', mapTitle:'Бізді табыңыз',
  mapAddress:'Алматы қ., Байзақов к-сі, 280',
  mapHours:'Жұмыс уақыты', mapHoursValue:'Дүй–Жек: 08:00–21:00',
  mapPhone:'Телефон',

  footerTagline:'Дәстүрден шабыт алған дәм.\nСезінуге болатын қамқорлық.',
  footerHistory:'Біздің тарих', footerDelivery:'Жеткізу және төлем',
  footerContacts:'Байланыс',
  footerMoment:'Сіздің ең\nжылы сәттеріңіз үшін.',
  footerWarm:'Сіздің ең\nжылы сәттеріңіз үшін.',
  footerDemo:'',
  footerPrivacy:'Құпиялылық саясаты',
  footerTerms:'Жария оферта',
  and:'және',
  cookieText:'Сайттың дұрыс жұмыс істеуі, кіру және себетті сақтау үшін cookie-файлдар қолданылады.',
  cookieAccept:'Қабылдау',
  cookieMore:'Толығырақ',
  checkoutLegalNotice:'«Тапсырысты растау» батырмасын басу арқылы сіз келесі шарттармен келісесіз:',
  authLegalNotice:'Тіркелу арқылы сіз келесі шарттарды қабылдайсыз:',

  bottomHome:'Басты', bottomCatalog:'Каталог', bottomCart:'Себет', bottomAccount:'Кабинет',

  breadcrumbHome:'Басты бет',
  infoAboutCrumb:'Біз туралы', infoDeliveryCrumb:'Жеткізу және төлем',
  infoContactsCrumb:'Байланыс', infoPrivacyCrumb:'Деректер туралы ақпарат',
  infoAboutEyebrow:'АВТОРЛЫҚ КОНДИТЕРЛІК ANASYM',
  infoAboutTitle:'Әр нан-тоқашта — жан парасы',
  infoAboutH2:'Таныс дәмдер.\nЕрекше көңіл.',
  infoAboutP1:'Anasym нан-тоқашқа деген сүйіспеншілік пен бір дастарқан басындағы кездесу қуанышын ұштастырады. Коллекцияда — ауа қабатты круасандар, нәзік десерттер және кез-келген көңіл-күйге арналған нан-тоқаш бар.',
  infoAboutP2:'Біз әрбір топтаманы жоғары сапалы табиғи ингредиенттерден қолмен дайындаймыз.',
  infoAboutButton:'Бұйымдармен танысу',
  infoDeliveryTitle:'Біздің асханадан — сіздің дастарқаныңызға',
  infoDeliveryH2:'Жеткізу',
  infoDeliveryP1:'Бекітілген <strong>1 500 ₸</strong> құны қолданылады. Тапсырысты растамас бұрын көрсетіледі.',
  infoDeliveryP2:'Жеткізу уақыты мен нақты мекен-жай тапсырыс расталғанда нақтыланады.',
  infoPaymentH2:'Төлем',
  infoPaymentP1:'Алу кезінде төлем. Барлық бағалар теңгемен берілген.',
  infoPaymentP2:'Тапсырыс рәсімделгеннен кейін кабинетте пайда болады. Әкімші растап дайындаған соң, тағайындалған курьер жеткізу мәртебесін жаңартады.',
  infoContactsTitle:'Байланыста боламыз',
  infoAddressH2:'Мекен-жай және жұмыс уақыты',
  infoAddressP:'Алматы қ., Байзақов к-сі, 280. Дүй–Жек: 08:00–21:00',
  infoOrderH2:'Онлайн тапсырыс беру',
  infoOrderP:'Бұйымды таңдаңыз, себетке қосыңыз және оңай онлайн тапсырыс беріңіз.',
  infoOrderButton:'Каталогқа өту',
  infoPrivacyTitle:'Деректерді қорғау және құпиялылық',
  infoPrivacyP1:'Біз сіздің жеке деректеріңіздің қауіпсіздігі мен құпиялылығына жауапкершілікпен қараймыз.',
  infoPrivacyP2:'Дерекқорда есім, электрондық пошта, телефон, мекен-жай, тапсырыс құрамы және мәртебе тарихы сақталады. Құпия сөздер қорғалған хэш түрінде сақталады.',
  infoPrivacyP3:'Жеке деректер тек тапсырыстарды өңдеу және қызмет көрсету үшін пайдаланылады.',

  authWelcome:'ANASYM-ға ХОШ КЕЛДІҢІЗ',
  authH2:'Тәтті сәттер\nосында басталады.',
  authEyebrow:'ЖЕКЕ КАБИНЕТ',
  authLoginTitle:'Сізді көргенімізге қуаныштымыз',
  authRegisterTitle:'Танысайық',
  authResetTitle:'Қолжетімділікті қалпына келтіру',
  authLoginSub:'Тапсырыстарыңыз, сүйікті дәмдеріңіз және біраз қамқорлық.',
  authRegisterSub:'Тапсырыстарыңыз, сүйікті дәмдеріңіз және біраз қамқорлық.',
  authResetSub:'Тіркелу кезінде пайдаланған поштаны көрсетіңіз.',
  authCheckoutSub:'Тапсырыс рәсімдеу үшін кіріңіз. Таңдалғанның бәрі себетте сақталды.',
  authTabLogin:'Кіру', authTabRegister:'Тіркелу',
  authName:'Атыңыз', authNamePlaceholder:'Қалай хабарласуға болады',
  authEmail:'Электрондық пошта',
  authPassword:'Құпия сөз',
  authPasswordPlaceholder:'Құпия сөзді енгізіңіз',
  authNewPasswordPlaceholder:'10 таңбадан кем емес',
  authRegisterNote:'Тіркелу сатып алушы кабинетін жасайды.',
  authButtonLogin:'Кіру', authButtonRegister:'Аккаунт жасау',
  authButtonReset:'Сілтеме жіберу', authButtonBusy:'Күте тұрыңыз…',
  authForgot:'Құпия сөзді ұмыттыңыз ба?', authBackToLogin:'Кіруге оралу',
  authSafe:'Деректеріңіз тек сізге және тапсырыс тобына қолжетімді.',
  authBack:'Бұйымдарға оралу',
  authSentNote:'Бұл пошта тіркелген болса, қалпына келтіру сілтемесі жіберілді.',
  authResetBack:'Кіруге оралу',

  cartTitle:'Сіздің себетіңіз',
  cartEmpty:'Мұнда жақында дәмді нәрсе болады',
  cartEmptyP:'Каталогты қараңыз және сүйікті нан-тоқашыңызды таңдаңыз.',
  cartToCatalog:'Каталогқа өту',
  cartContinue:'Таңдауды жалғастыру',
  cartItems:'Бұйымдар', cartDelivery:'Жеткізу', cartTotal:'Барлығы',
  cartOrder:'Тапсырыс рәсімдеу', cartPayNote:'Алу кезінде төлем',
  cartPending:'Нақтылануда',

  checkoutBack:'Себетке оралу', checkoutTitle:'Тапсырысты рәсімдеу',
  checkoutStep1:'01', checkoutStep1Title:'Кімге жеткізу',
  checkoutStep2:'02', checkoutStep2Title:'Қайда апару',
  checkoutStep3:'03', checkoutStep3Title:'Алу кезінде төлем',
  checkoutStep3Note:'Онлайн-төлем қажет емес. Қорытынды сомасы «Тапсырысыңыз» блогында көрсетілген.',
  checkoutName:'Алушының аты', checkoutNamePlaceholder:'Сіздің атыңыз',
  checkoutPhone:'Телефон', checkoutPhonePlaceholder:'+7 (___) ___ __ __',
  checkoutAddress:'Жеткізу мекен-жайы', checkoutAddressPl:'Қала, көше, үй, пәтер',
  checkoutComment:'Пікір', checkoutCommentOpt:'· міндетті емес',
  checkoutCommentPl:'Кіреберіс, қабат, домофон немесе тапсырысқа тілектер',
  checkoutDeliveryNote:'Жеткізу — ', checkoutDeliveryDemo:'Мерзім мен жеткізу мүмкіндігі растау кезінде нақтыланады.',
  checkoutOrderTitle:'Тапсырысыңыз',
  checkoutRefreshBtn:'Бағалар мен қолжетімділікті жаңарту',
  checkoutRefreshing:'Бағалар мен қолжетімділікті тексеруде…',
  checkoutItems:'Бұйымдар', checkoutDelivery:'Жеткізу', checkoutTotal:'Барлығы',
  checkoutReviewLabel:'Жаңартылған бағалар мен қорытынды соманы тексердім',
  checkoutBtnConfirm:'Тапсырысты растау', checkoutBtnUpdated:'Жаңартылған тапсырысты растау',
  checkoutBtnBusy:'Тапсырыс жасалуда…', checkoutBtnChecking:'Тапсырыс тексерілуде…',
  checkoutPayNote:'Алу кезінде төлем',
  checkoutMyOrders:'Тапсырыстарымды тексеру',
  checkoutNewOrder:'Жеке жаңа тапсырыс бастау',

  successEyebrow:'ТАҢДАУЫҢЫЗҒА РАХМЕТ',
  successTitle:'Тапсырыс қабылданды',
  successP:'Тапсырысыңызды сақтадық.\nОның мәртебесі жеке кабинетте жаңартылатын болады.',
  successTotalLabel:'Жеткізумен барлығы',
  successPayNote:'Алу кезінде төлем',
  successTrack:'Тапсырысты қадағалау',
  successBack:'Каталогқа оралу',

  notFound:'Бет табылмады', toHome:'Басты бетке',

  loading:'Жүктелуде…', retry:'Қайталап көру',
  storageWarning:'Браузер деректерді сақтамайды. Себет пен рәсімдеу тек осы бетті жаңартқанға дейін қолжетімді.',
  addedToCart:'Себетке қосылды', loggedOut:'Жүйеден шықтыңыз',

  soonAvail:'Жақында болады',
  buy:'Сатып алу', outOfStock:'Жоқ',
  inCart:(n)=>`Себетте: ${n} дана`,
  perItem:'1 данасы', toCart:'Себетке',
  selectedItems:(n)=>`Таңдалды: ${n} дана`,
  withoutDelivery:'жеткізусіз',
  toCartBtn:'Себетке',

  catalogTitle:'Каталог', catalogEyebrow:'АВТОРЛЫҚ КОНДИТЕРЛІК ANASYM',
  catalogDesc:'Нан-тоқаш пен десерттер жинағы',
  catalogAll:'Барлығы', searchPlaceholder:'Іздеу',
  resultsCount:(n)=>`${n} бұйым табылды`,
  noResults:'Бұйым табылмады',
  noResultsSub:'Сүзгіні немесе іздеуді өзгертіп көріңіз.',
  resetFilters:'Сүзгіні тазалау',

  newPassword:'Жаңа құпия сөз', newPasswordLabel:'Жаңа құпия сөз',
  newPasswordSave:'Құпия сөзді сақтау', newPasswordSaving:'Сақталуда…',
  newPasswordDone:'Құпия сөз жаңартылды. Жаңа құпия сөзбен кіріңіз.',
  newPasswordLogin:'Кіру',

  accountOrLogin:'Кіру / Тіркелу',

  langKz:'Қаз', langRu:'Рус', langEn:'Eng',
};

const ru: Translations = {
  navHome:'Главная', navCatalog:'Каталог', navAbout:'О нас',
  navDelivery:'Доставка', navContacts:'Контакты',
  navAccount:'Личный кабинет', navLogin:'Войти', navLogout:'Выйти',
  cartLabel:'Корзина', cartCount:(n)=>`Корзина, ${n} товаров`,

  heroEyebrow:'ВКУС · ВДОХНОВЕНИЕ · ТРАДИЦИИ',
  heroH1Line1:'Авторская', heroH1Line2:'кондитерская', heroH1Brand:'Anasym',
  heroSubtitle:'Свежая выпечка, десерты и торты,\nв которых чувствуется забота.',
  heroButton:'Открыть каталог', heroNote:'Готовим с душой. Каждый день.',

  benefit1a:'Свежие', benefit1b:'ингредиенты',
  benefit2a:'Авторские', benefit2b:'рецепты',
  benefit3a:'Натуральный', benefit3b:'состав',
  benefit4a:'Ручная', benefit4b:'работа',

  sectionCategoriesEyebrow:'СОЗДАНО С ЛЮБОВЬЮ',
  sectionCategoriesTitle:'Наши изделия',
  sectionCatalogLink:'Весь каталог',
  sectionFavoritesEyebrow:'К ЧАЮ И НЕ ТОЛЬКО',
  sectionFavoritesTitle:'Повод порадовать себя',
  sectionFavoritesLink:'Выбрать своё',

  aboutEyebrow:'НЕМНОГО О НАС',
  aboutTitle:'В каждой выпечке — частичка души',
  aboutP1:'Anasym — место, где простые ингредиенты становятся чем-то особенным. Мы соединяем знакомые вкусы, авторские рецепты и любовь к своему делу.',
  aboutP2:'Для неспешного утра, семейного праздника или просто тёплой встречи.',
  aboutButton:'Наша история', aboutCaption:'Мастерство в каждом движении',
  photoCaption:'Мастерство в каждом движении',

  mapEyebrow:'НАШ АДРЕС', mapTitle:'Найдите нас',
  mapAddress:'г. Алматы, ул. Байзакова, 280',
  mapHours:'Часы работы', mapHoursValue:'Пн–Вс: 08:00–21:00',
  mapPhone:'Телефон',

  footerTagline:'Вкус, вдохновлённый традициями.\nЗабота, которую можно почувствовать.',
  footerHistory:'Наша история', footerDelivery:'Доставка и оплата',
  footerContacts:'Контакты',
  footerMoment:'Для ваших\nсамых тёплых моментов.',
  footerWarm:'Для ваших\nсамых тёплых моментов.',
  footerDemo:'',
  footerPrivacy:'Политика конфиденциальности',
  footerTerms:'Публичная оферта',
  and:'и',
  cookieText:'Мы используем cookie-файлы для корректной работы сайта, авторизации и сохранения вашей корзины.',
  cookieAccept:'Принять',
  cookieMore:'Подробнее',
  checkoutLegalNotice:'Нажимая «Подтвердить заказ», вы соглашаетесь с условиями',
  authLegalNotice:'Создавая аккаунт, вы принимаете условия',

  bottomHome:'Главная', bottomCatalog:'Каталог', bottomCart:'Корзина', bottomAccount:'Кабинет',

  breadcrumbHome:'Главная',
  infoAboutCrumb:'О нас', infoDeliveryCrumb:'Доставка и оплата',
  infoContactsCrumb:'Контакты', infoPrivacyCrumb:'Информация о данных',
  infoAboutEyebrow:'АВТОРСКАЯ КОНДИТЕРСКАЯ ANASYM',
  infoAboutTitle:'В каждой выпечке — частичка души',
  infoAboutH2:'Знакомые вкусы.\nОсобенное отношение.',
  infoAboutP1:'Anasym объединяет любовь к выпечке и радость встреч за одним столом. В нашей коллекции — воздушные круассаны, нежные десерты и выпечка для любого настроения.',
  infoAboutP2:'Мы готовим каждую партию вручную из натуральных ингредиентов высшего качества.',
  infoAboutButton:'Познакомиться с изделиями',
  infoDeliveryTitle:'От нашей кухни — к вашему столу',
  infoDeliveryH2:'Доставка',
  infoDeliveryP1:'Действует фиксированная стоимость доставки <strong>1 500 ₸</strong>. Она показывается до подтверждения заказа.',
  infoDeliveryP2:'Сроки и детали доставки уточняются оператором при подтверждении заказа.',
  infoPaymentH2:'Оплата',
  infoPaymentP1:'Оплата при получении. Все цены представлены в тенге.',
  infoPaymentP2:'После оформления заказ появится в кабинете. Когда администратор подтвердит и подготовит его, назначенный курьер обновит статус доставки.',
  infoContactsTitle:'Будем на связи',
  infoAddressH2:'Адрес и часы работы',
  infoAddressP:'г. Алматы, ул. Байзакова, 280. Пн–Вс: 08:00–21:00',
  infoOrderH2:'Заказать онлайн',
  infoOrderP:'Выберите любимую выпечку, добавьте в корзину и оформите заказ онлайн.',
  infoOrderButton:'Перейти в каталог',
  infoPrivacyTitle:'Защита данных и конфиденциальность',
  infoPrivacyP1:'Мы ответственно относимся к безопасности и конфиденциальности ваших персональных данных.',
  infoPrivacyP2:'В базе сохраняются имя, электронная почта, телефон, адрес, состав заказа и история статусов. Пароли хранятся в виде защищённых хешей.',
  infoPrivacyP3:'Персональные данные используются исключительно для обработки и доставки ваших заказов.',

  authWelcome:'ДОБРО ПОЖАЛОВАТЬ В ANASYM',
  authH2:'Вкусные моменты\nначинаются здесь.',
  authEyebrow:'ВАШ ЛИЧНЫЙ КАБИНЕТ',
  authLoginTitle:'Рады видеть вас',
  authRegisterTitle:'Давайте знакомиться',
  authResetTitle:'Восстановить доступ',
  authLoginSub:'Ваши заказы, любимые вкусы и немного заботы.',
  authRegisterSub:'Ваши заказы, любимые вкусы и немного заботы.',
  authResetSub:'Укажите почту, которую использовали при регистрации.',
  authCheckoutSub:'Войдите, чтобы оформить заказ. Всё выбранное сохранено в корзине.',
  authTabLogin:'Войти', authTabRegister:'Регистрация',
  authName:'Ваше имя', authNamePlaceholder:'Как к вам обращаться',
  authEmail:'Электронная почта',
  authPassword:'Пароль',
  authPasswordPlaceholder:'Введите пароль',
  authNewPasswordPlaceholder:'Не менее 10 символов',
  authRegisterNote:'Регистрация создаёт кабинет покупателя.',
  authButtonLogin:'Войти', authButtonRegister:'Создать аккаунт',
  authButtonReset:'Отправить ссылку', authButtonBusy:'Подождите…',
  authForgot:'Не помните пароль?', authBackToLogin:'Вернуться ко входу',
  authSafe:'Ваши данные доступны только вам и команде заказа.',
  authBack:'Вернуться к изделиям',
  authSentNote:'Если эта почта зарегистрирована, на неё отправлена ссылка для восстановления.',
  authResetBack:'Вернуться ко входу',

  cartTitle:'Ваша корзина',
  cartEmpty:'Здесь скоро будет что-то вкусное',
  cartEmptyP:'Загляните в каталог и выберите любимую выпечку.',
  cartToCatalog:'Перейти в каталог',
  cartContinue:'Продолжить выбирать',
  cartItems:'Изделия', cartDelivery:'Доставка', cartTotal:'Итого',
  cartOrder:'Оформить заказ', cartPayNote:'Оплата при получении',
  cartPending:'Уточняется',

  checkoutBack:'Назад в корзину', checkoutTitle:'Оформление заказа',
  checkoutStep1:'01', checkoutStep1Title:'Кому доставить',
  checkoutStep2:'02', checkoutStep2Title:'Куда привезти',
  checkoutStep3:'03', checkoutStep3Title:'Оплата при получении',
  checkoutStep3Note:'Онлайн-оплата не требуется. Итоговая сумма указана в блоке «Ваш заказ».',
  checkoutName:'Имя получателя', checkoutNamePlaceholder:'Ваше имя',
  checkoutPhone:'Телефон', checkoutPhonePlaceholder:'+7 (___) ___ __ __',
  checkoutAddress:'Адрес доставки', checkoutAddressPl:'Город, улица, дом, квартира',
  checkoutComment:'Комментарий', checkoutCommentOpt:'· необязательно',
  checkoutCommentPl:'Подъезд, этаж, домофон или пожелания к заказу',
  checkoutDeliveryNote:'Доставка — ', checkoutDeliveryDemo:'Срок и возможность доставки уточняются при подтверждении.',
  checkoutOrderTitle:'Ваш заказ',
  checkoutRefreshBtn:'Обновить цены и наличие',
  checkoutRefreshing:'Проверяем цены и наличие…',
  checkoutItems:'Изделия', checkoutDelivery:'Доставка', checkoutTotal:'Итого',
  checkoutReviewLabel:'Я проверил(а) обновлённые цены и итоговую сумму',
  checkoutBtnConfirm:'Подтвердить заказ', checkoutBtnUpdated:'Подтвердить обновлённый заказ',
  checkoutBtnBusy:'Создаём заказ…', checkoutBtnChecking:'Проверяем заказ…',
  checkoutPayNote:'Оплата при получении',
  checkoutMyOrders:'Проверить мои заказы',
  checkoutNewOrder:'Начать отдельный новый заказ',

  successEyebrow:'СПАСИБО ЗА ВАШ ВЫБОР',
  successTitle:'Заказ принят',
  successP:'Мы сохранили ваш заказ.\nЕго статус будет обновляться в личном кабинете.',
  successTotalLabel:'Итого с доставкой',
  successPayNote:'Оплата при получении',
  successTrack:'Следить за заказом',
  successBack:'Вернуться в каталог',

  notFound:'Страница не найдена', toHome:'На главную',

  loading:'Загружаем…', retry:'Попробовать ещё раз',
  storageWarning:'Браузер не сохраняет данные. Корзина и попытка оформления доступны только до перезагрузки этой страницы.',
  addedToCart:'Добавлено в корзину', loggedOut:'Вы вышли из аккаунта',

  soonAvail:'Скоро в наличии',
  buy:'Купить', outOfStock:'Нет в наличии',
  inCart:(n)=>`В корзине: ${n} шт.`,
  perItem:'За 1 шт.', toCart:'В корзину',
  selectedItems:(n)=>`Выбрано: ${n} шт.`,
  withoutDelivery:'без доставки',
  toCartBtn:'В корзину',

  catalogTitle:'Каталог', catalogEyebrow:'АВТОРСКАЯ КОНДИТЕРСКАЯ ANASYM',
  catalogDesc:'Коллекция выпечки и десертов',
  catalogAll:'Все', searchPlaceholder:'Поиск',
  resultsCount:(n)=>`Найдено ${n} изделий`,
  noResults:'Изделия не найдены',
  noResultsSub:'Попробуйте изменить фильтр или запрос.',
  resetFilters:'Сбросить фильтр',

  newPassword:'Новый пароль', newPasswordLabel:'Новый пароль',
  newPasswordSave:'Сохранить пароль', newPasswordSaving:'Сохраняем…',
  newPasswordDone:'Пароль обновлён. Войдите с новым паролем.',
  newPasswordLogin:'Войти',

  accountOrLogin:'Войти / Регистрация',

  langKz:'Қаз', langRu:'Рус', langEn:'Eng',
};

const en: Translations = {
  navHome:'Home', navCatalog:'Catalog', navAbout:'About',
  navDelivery:'Delivery', navContacts:'Contacts',
  navAccount:'My Account', navLogin:'Sign in', navLogout:'Sign out',
  cartLabel:'Cart', cartCount:(n)=>`Cart, ${n} items`,

  heroEyebrow:'TASTE · INSPIRATION · TRADITION',
  heroH1Line1:'Artisan', heroH1Line2:'Bakery', heroH1Brand:'Anasym',
  heroSubtitle:'Fresh pastries, desserts and cakes\ncrafted with care every day.',
  heroButton:'Open Catalog', heroNote:'Made with soul. Every day.',

  benefit1a:'Fresh', benefit1b:'ingredients',
  benefit2a:'Original', benefit2b:'recipes',
  benefit3a:'Natural', benefit3b:'composition',
  benefit4a:'Handmade', benefit4b:'with love',

  sectionCategoriesEyebrow:'MADE WITH LOVE',
  sectionCategoriesTitle:'Our Products',
  sectionCatalogLink:'Full Catalog',
  sectionFavoritesEyebrow:'FOR TEA AND MORE',
  sectionFavoritesTitle:'A reason to treat yourself',
  sectionFavoritesLink:'Choose yours',

  aboutEyebrow:'ABOUT US',
  aboutTitle:'A piece of soul in every pastry',
  aboutP1:'Anasym is where simple ingredients become something special. We combine familiar flavours, original recipes and a passion for the craft.',
  aboutP2:'For a slow morning, a family celebration or just a warm gathering.',
  aboutButton:'Our Story', aboutCaption:'Craftsmanship in every move',
  photoCaption:'Craftsmanship in every move',

  mapEyebrow:'OUR ADDRESS', mapTitle:'Find Us',
  mapAddress:'Almaty, Baizakov St., 280',
  mapHours:'Opening Hours', mapHoursValue:'Mon–Sun: 08:00–21:00',
  mapPhone:'Phone',

  footerTagline:'Taste inspired by tradition.\nCare you can feel.',
  footerHistory:'Our Story', footerDelivery:'Delivery & Payment',
  footerContacts:'Contacts',
  footerMoment:'For your\nwarmest moments.',
  footerWarm:'For your\nwarmest moments.',
  footerDemo:'',
  footerPrivacy:'Privacy Policy',
  footerTerms:'Public Offer & Terms',
  and:'and',
  cookieText:'We use cookies to ensure proper website functionality, authentication, and cart persistence.',
  cookieAccept:'Accept',
  cookieMore:'Learn more',
  checkoutLegalNotice:'By clicking "Confirm Order", you agree to our',
  authLegalNotice:'By creating an account, you agree to our',

  bottomHome:'Home', bottomCatalog:'Catalog', bottomCart:'Cart', bottomAccount:'Account',

  breadcrumbHome:'Home',
  infoAboutCrumb:'About', infoDeliveryCrumb:'Delivery & Payment',
  infoContactsCrumb:'Contacts', infoPrivacyCrumb:'Data Information',
  infoAboutEyebrow:'ARTISAN BAKERY ANASYM',
  infoAboutTitle:'A piece of soul in every pastry',
  infoAboutH2:'Familiar flavours.\nSpecial care.',
  infoAboutP1:'Anasym unites the love of baking and the joy of gathering around one table. Our collection includes airy croissants, delicate desserts and pastries for every mood.',
  infoAboutP2:'We craft every batch by hand using premium, all-natural ingredients.',
  infoAboutButton:'Explore Products',
  infoDeliveryTitle:'From our kitchen to your table',
  infoDeliveryH2:'Delivery',
  infoDeliveryP1:'A fixed delivery fee of <strong>1 500 ₸</strong> applies. Shown before order confirmation.',
  infoDeliveryP2:'Delivery details and timing are confirmed with our operator upon order confirmation.',
  infoPaymentH2:'Payment',
  infoPaymentP1:'Payment on delivery. All prices in tenge.',
  infoPaymentP2:'After checkout the order appears in your account. Once the admin confirms and prepares it, the assigned courier will update the delivery status.',
  infoContactsTitle:'Get in touch',
  infoAddressH2:'Address & Hours',
  infoAddressP:'Almaty, Baizakov St, 280. Mon–Sun: 08:00–21:00',
  infoOrderH2:'Order Online',
  infoOrderP:'Pick your favourite pastries, add them to your cart, and place your order online.',
  infoOrderButton:'Go to Catalog',
  infoPrivacyTitle:'Data Protection & Privacy',
  infoPrivacyP1:'We take the security and privacy of your personal data seriously.',
  infoPrivacyP2:'The database stores name, email, phone, address, order contents and status history. Passwords are stored as secure hashes.',
  infoPrivacyP3:'Personal data is used exclusively for processing and delivering your orders.',

  authWelcome:'WELCOME TO ANASYM',
  authH2:'Sweet moments\nstart here.',
  authEyebrow:'YOUR ACCOUNT',
  authLoginTitle:'Great to see you',
  authRegisterTitle:"Let's get acquainted",
  authResetTitle:'Recover access',
  authLoginSub:'Your orders, favourite flavours and a little care.',
  authRegisterSub:'Your orders, favourite flavours and a little care.',
  authResetSub:'Enter the email you used when registering.',
  authCheckoutSub:'Sign in to complete your order. Everything in your cart is saved.',
  authTabLogin:'Sign in', authTabRegister:'Register',
  authName:'Your name', authNamePlaceholder:'What should we call you?',
  authEmail:'Email address',
  authPassword:'Password',
  authPasswordPlaceholder:'Enter password',
  authNewPasswordPlaceholder:'At least 10 characters',
  authRegisterNote:'Registration creates a customer account.',
  authButtonLogin:'Sign in', authButtonRegister:'Create account',
  authButtonReset:'Send link', authButtonBusy:'Please wait…',
  authForgot:"Forgot your password?", authBackToLogin:'Back to sign in',
  authSafe:'Your data is only accessible to you and the order team.',
  authBack:'Back to products',
  authSentNote:'If that email is registered, a recovery link has been sent.',
  authResetBack:'Back to sign in',

  cartTitle:'Your Cart',
  cartEmpty:'Something delicious coming soon',
  cartEmptyP:'Browse the catalog and choose your favourite pastry.',
  cartToCatalog:'Go to Catalog',
  cartContinue:'Keep shopping',
  cartItems:'Products', cartDelivery:'Delivery', cartTotal:'Total',
  cartOrder:'Place Order', cartPayNote:'Payment on delivery',
  cartPending:'TBC',

  checkoutBack:'Back to Cart', checkoutTitle:'Place Order',
  checkoutStep1:'01', checkoutStep1Title:'Recipient',
  checkoutStep2:'02', checkoutStep2Title:'Delivery address',
  checkoutStep3:'03', checkoutStep3Title:'Payment on delivery',
  checkoutStep3Note:"No online payment needed. The total is shown in the 'Your Order' block.",
  checkoutName:'Recipient name', checkoutNamePlaceholder:'Your name',
  checkoutPhone:'Phone', checkoutPhonePlaceholder:'+7 (___) ___ __ __',
  checkoutAddress:'Delivery address', checkoutAddressPl:'City, street, house, apt',
  checkoutComment:'Comment', checkoutCommentOpt:'· optional',
  checkoutCommentPl:'Entrance, floor, intercom or order notes',
  checkoutDeliveryNote:'Delivery — ', checkoutDeliveryDemo:'Timing and availability confirmed on approval.',
  checkoutOrderTitle:'Your Order',
  checkoutRefreshBtn:'Refresh prices & availability',
  checkoutRefreshing:'Checking prices & availability…',
  checkoutItems:'Products', checkoutDelivery:'Delivery', checkoutTotal:'Total',
  checkoutReviewLabel:'I have reviewed the updated prices and total amount',
  checkoutBtnConfirm:'Confirm Order', checkoutBtnUpdated:'Confirm Updated Order',
  checkoutBtnBusy:'Creating order…', checkoutBtnChecking:'Checking order…',
  checkoutPayNote:'Payment on delivery',
  checkoutMyOrders:'Check my orders',
  checkoutNewOrder:'Start a separate new order',

  successEyebrow:'THANK YOU FOR YOUR ORDER',
  successTitle:'Order Placed',
  successP:'We have saved your order.\nIts status will update in your account.',
  successTotalLabel:'Total incl. delivery',
  successPayNote:'Payment on delivery',
  successTrack:'Track my order',
  successBack:'Back to Catalog',

  notFound:'Page not found', toHome:'Go home',

  loading:'Loading…', retry:'Try again',
  storageWarning:'Browser storage is unavailable. Cart and checkout attempt are only available until page reload.',
  addedToCart:'Added to cart', loggedOut:'You have signed out',

  soonAvail:'Coming soon',
  buy:'Buy', outOfStock:'Out of stock',
  inCart:(n)=>`In cart: ${n}`,
  perItem:'Per item', toCart:'To cart',
  selectedItems:(n)=>`Selected: ${n}`,
  withoutDelivery:'excl. delivery',
  toCartBtn:'To Cart',

  catalogTitle:'Catalog', catalogEyebrow:'ARTISAN BAKERY ANASYM',
  catalogDesc:'Pastry & dessert collection',
  catalogAll:'All', searchPlaceholder:'Search',
  resultsCount:(n)=>`${n} products found`,
  noResults:'No products found',
  noResultsSub:'Try changing the filter or search query.',
  resetFilters:'Reset filters',

  newPassword:'New password', newPasswordLabel:'New password',
  newPasswordSave:'Save password', newPasswordSaving:'Saving…',
  newPasswordDone:'Password updated. Sign in with your new password.',
  newPasswordLogin:'Sign in',

  accountOrLogin:'Sign in / Register',

  langKz:'Қаз', langRu:'Рус', langEn:'Eng',
};

const DICT: Record<Lang, Translations> = {kz, ru, en};

interface I18nCtx {lang: Lang; t: Translations; setLang: (l: Lang) => void}
const I18nContext = createContext<I18nCtx>(null!);

export function I18nProvider({children}: {children: ReactNode}) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('anasym-lang') as Lang | null;
    return saved && ['kz','ru','en'].includes(saved) ? saved : 'kz';
  });
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('anasym-lang', l);
    setLangState(l);
  }, []);
  return (
    <I18nContext.Provider value={{lang, t: DICT[lang], setLang}}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
