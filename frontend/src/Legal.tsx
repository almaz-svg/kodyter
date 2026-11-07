import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Lock, Cookie, Scale, Clock, MapPin, Truck, AlertCircle, ArrowRight } from 'lucide-react';
import { useI18n } from './i18n';

/* ── Cookie Consent Banner ─────────────────────────────────────────────── */
export function CookieConsent() {
  const [accepted, setAccepted] = useState(true); // default true to avoid flash
  const { t } = useI18n();

  useEffect(() => {
    try {
      const consent = localStorage.getItem('anasym_cookies_accepted');
      if (!consent) {
        setAccepted(false);
      }
    } catch {
      // localStorage may fail in restricted mode
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('anasym_cookies_accepted', 'true');
    } catch {
      // ignore
    }
    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notification">
      <div className="cookie-banner-inner">
        <div className="cookie-icon-wrap">
          <Cookie size={22} aria-hidden="true" />
        </div>
        <div className="cookie-text">
          <p>
            {t.cookieText}{' '}
            <Link to="/privacy" className="cookie-link">
              {t.cookieMore}
            </Link>
          </p>
        </div>
        <button type="button" className="button button-gold cookie-btn" onClick={handleAccept}>
          {t.cookieAccept}
        </button>
      </div>
    </div>
  );
}

/* ── Privacy Policy Page ─────────────────────────────────────────────────── */
export function PrivacyPolicy() {
  const { t, lang } = useI18n();

  const isKz = lang === 'kz';
  const isEn = lang === 'en';

  return (
    <main className="container page legal-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link>
        <span>/</span>
        {t.footerPrivacy}
      </div>

      <header className="legal-header">
        <span className="eyebrow">
          {isKz ? 'ДЕРЕКТЕРДІ ҚОРҒАУ ЖӘНЕ ҚАУІПСІЗДІК' : isEn ? 'DATA PROTECTION & SECURITY' : 'ЗАЩИТА ДАННЫХ И БЕЗОПАСНОСТЬ'}
        </span>
        <h1>{t.footerPrivacy}</h1>
        <p className="legal-subtitle">
          {isKz
            ? 'Anasym авторлық кондитерлігі пайдаланушылардың жеке деректерін өңдеу саясаты'
            : isEn
            ? 'Privacy Policy and Personal Data Processing for Anasym Bakery customers'
            : 'Политика в отношении обработки и защиты персональных данных пользователей кондитерской Anasym'}
        </p>
        <div className="legal-meta-row">
          <span className="legal-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            {isKz ? 'ҚР Заңнамасына сәйкес қорғалған' : isEn ? 'Protected under applicable privacy laws' : 'Защищено в соответствии с Законом РК'}
          </span>
          <span className="legal-date">
            <Clock size={15} aria-hidden="true" />
            {isKz ? 'Жаңартылған күні: 2026 ж.' : isEn ? 'Last updated: 2026' : 'Редакция от: 2026 г.'}
          </span>
        </div>
      </header>

      <div className="legal-content">
        {/* Section 1 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">01</span>
            <h2>{isKz ? 'Жалпы ережелер' : isEn ? '1. General Provisions' : '1. Общие положения'}</h2>
          </div>
          <p>
            {isKz
              ? 'Осы Құпиялылық саясаты (бұдан әрі — Саясат) Anasym кондитерлігінің (бұдан әрі — Оператор, мекенжайы: Тараз қ., Қонаев к-сі, 62а) anasym-bakery.vercel.app веб-сайтын пайдаланушылардың жеке мәліметтерін жинау, өңдеу және сақтау тәртібін белгілейді.'
              : isEn
              ? 'This Privacy Policy defines the procedure and rules for collecting, storing, and processing personal data by Anasym Bakery (operator address: Taraz, Konaev St, 62a) when users access and use anasym-bakery.vercel.app.'
              : 'Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных, которые кондитерская «Anasym» (далее — Оператор, адрес: г. Тараз, ул. Конаева, 62а) получает от физических лиц при использовании сайта anasym-bakery.vercel.app.'}
          </p>
          <p>
            {isKz
              ? 'Сайтты пайдалану немесе тапсырыс рәсімдеу арқылы Пайдаланушы осы Саясаттың барлық шарттарымен толық және сөзсіз келісетінін растайды.'
              : isEn
              ? 'By using the website, registering, or placing an order, the User expresses full and unconditional agreement with this Privacy Policy.'
              : 'Используя сайт, регистрируясь или оформляя заказ, Пользователь свободно и без принуждения выражает своё безоговорочное согласие на обработку данных в соответствии с настоящей Политикой.'}
          </p>
        </section>

        {/* Section 2 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">02</span>
            <h2>{isKz ? 'Өңделетін деректер құрамы' : isEn ? '2. Personal Data We Collect' : '2. Состав собираемых данных'}</h2>
          </div>
          <p>
            {isKz
              ? 'Оператор қызмет көрсету үшін қажетті ең аз көлемдегі деректерді өңдейді:'
              : isEn
              ? 'The Operator collects only the minimal data strictly necessary to fulfill your orders and services:'
              : 'Оператор обрабатывает только те персональные данные, которые необходимы для качественного обслуживания и доставки заказов:'}
          </p>
          <ul className="legal-list">
            <li>
              <strong>{isKz ? 'Сәйкестендіру деректері:' : isEn ? 'Identity Data:' : 'Идентификационные данные:'}</strong>{' '}
              {isKz ? 'Аты-жөні немесе сатып алушының аты.' : isEn ? 'Customer name / recipient name.' : 'Имя покупателя / получателя заказа.'}
            </li>
            <li>
              <strong>{isKz ? 'Байланыс ақпараты:' : isEn ? 'Contact Information:' : 'Контактные данные:'}</strong>{' '}
              {isKz ? 'Байланыс телефоны және электрондық пошта (email).' : isEn ? 'Contact mobile phone number and email address.' : 'Номер телефона для подтверждения и связи курьера, адрес электронной почты (email).'}
            </li>
            <li>
              <strong>{isKz ? 'Жеткізу мекенжайы:' : isEn ? 'Delivery Address:' : 'Адрес доставки:'}</strong>{' '}
              {isKz ? 'Қала, көше, үй, пәтер/кеңсе, қабат, кіреберіс және курьерге арналған ескертпелер.' : isEn ? 'City, street, building, apartment, floor, intercom, and special delivery notes.' : 'Город, улица, номер дома, квартиры/офиса, подъезд, этаж, домофон и пожелания к доставке.'}
            </li>
            <li>
              <strong>{isKz ? 'Тапсырыс тарихы:' : isEn ? 'Order History:' : 'История заказов:'}</strong>{' '}
              {isKz ? 'Таңдалған өнімдер, себет құрамы, тапсырыс мәртебесі және жеткізу уақыты.' : isEn ? 'Items selected, quantities, order status, and delivery timestamps.' : 'Состав заказов, количество изделий, статусы выполнения и история покупок в личном кабинете.'}
            </li>
            <li>
              <strong>{isKz ? 'Техникалық деректер:' : isEn ? 'Technical Data:' : 'Технические параметры:'}</strong>{' '}
              {isKz ? 'IP-мекенжай, браузер түрі және авторизацияға қажетті cookie файлдары.' : isEn ? 'IP address, browser type, and essential authentication cookies.' : 'IP-адрес, тип браузера, сессионные cookie для поддержания защищённого входа.'}
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">03</span>
            <h2>{isKz ? 'Деректерді өңдеу мақсаттары' : isEn ? '3. Purposes of Processing' : '3. Цели обработки данных'}</h2>
          </div>
          <p>
            {isKz
              ? 'Пайдаланушының жеке деректері тек келесі заңды мақсаттарда қолданылады:'
              : isEn
              ? 'Your personal information is used strictly for legitimate business purposes:'
              : 'Персональные данные собираются и используются исключительно в следующих целях:'}
          </p>
          <ul className="legal-list">
            <li>{isKz ? 'Нан-тоқаш пен кондитерлік өнімдерге тапсырысты қабылдау, дайындау және мекенжайға жеткізу.' : isEn ? 'Processing, preparing, and delivering bakery orders to the specified address.' : 'Приём, изготовление и курьерская доставка заказов свежей выпечки и десертов.'}</li>
            <li>{isKz ? 'Сатып алушының жеке кабинетіне қауіпсіз кіруін қамтамасыз ету.' : isEn ? 'Providing secure access to customer account and saved cart.' : 'Предоставление доступа в личный кабинет, сохранение корзины и истории покупок.'}</li>
            <li>{isKz ? 'Тапсырыс мәртебесі, уақыты және курьердің жетуі туралы телефон немесе email арқылы хабардар ету.' : isEn ? 'Notifying customers about order confirmation, readiness, and courier dispatch.' : 'Информирование о статусе заказа, времени выпечки и прибытии курьера.'}</li>
            <li>{isKz ? 'Қызмет көрсету сапасын жақсарту және кері байланыс алу.' : isEn ? 'Quality control and customer service support.' : 'Контроль качества обслуживания, работа с пожеланиями и обращениями клиентов.'}</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">04</span>
            <h2>{isKz ? 'Қауіпсіздік және деректерді қорғау' : isEn ? '4. Security & Data Protection' : '4. Безопасность и защита данных'}</h2>
          </div>
          <p>
            {isKz
              ? 'Оператор жеке деректерді рұқсатсыз кіруден, өзгертуден немесе жоғалудан қорғау үшін қатаң техникалық және ұйымдастырушылық шараларды қолданады:'
              : isEn
              ? 'We implement robust industry-standard technical and organizational security measures:'
              : 'Оператор применяет современные технические и организационные меры информационной безопасности:'}
          </p>
          <ul className="legal-list">
            <li>
              <strong>{isKz ? 'Криптографиялық қорғау:' : isEn ? 'Encryption:' : 'Шифрование данных:'}</strong>{' '}
              {isKz ? 'Құпия сөздер ешқашан ашық түрде сақталмайды — тек қайтарылмайтын сенімді хэштер қолданылады.' : isEn ? 'Passwords are never stored in plain text; strong one-way cryptographic hashing is enforced.' : 'Пароли пользователей никогда не хранятся в открытом виде — применяется стойкое криптографическое хеширование.'}
            </li>
            <li>
              <strong>{isKz ? 'HTTPS және SSL/TLS:' : isEn ? 'Secure Transport:' : 'Защищённый протокол HTTPS:'}</strong>{' '}
              {isKz ? 'Браузер мен сервер арасындағы барлық деректер шифрланған байланыс арнасы арқылы өтеді.' : isEn ? 'All communication between browser and server is encrypted using TLS.' : 'Вся передача данных защищена сертификатом шифрования SSL/TLS.'}
            </li>
            <li>
              <strong>{isKz ? 'Қолжетімділікті шектеу:' : isEn ? 'Restricted Access:' : 'Разграничение прав доступа:'}</strong>{' '}
              {isKz ? 'Сатып алушының деректеріне тек тапсырыспен тікелей жұмыс істейтін қызметкерлер ғана (әкімші және курьер) қол жеткізе алады.' : isEn ? 'Customer details are accessible only by verified staff handling the active order.' : 'Данные доступны только авторизованным сотрудникам кондитерской, задействованным в выполнении конкретного заказа.'}
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">05</span>
            <h2>{isKz ? 'Cookie файлдарын пайдалану' : isEn ? '5. Cookie Files' : '5. Использование файлов Cookie'}</h2>
          </div>
          <p>
            {isKz
              ? 'Сайт пайдаланушы сессиясын сақтау, қауіпсіздік токендерін (CSRF қорғанысы) тексеру және себеттегі тауарларды сақтау үшін қажетті техникалық cookie файлдарын пайдаланады. Сіз браузер баптауларында cookie файлдарын өшіре аласыз, алайда бұл ретте сайттың кейбір қызметтері дұрыс жұмыс істемеуі мүмкін.'
              : isEn
              ? 'Our website uses strictly functional cookies necessary for user authentication, security tokens (CSRF protection), and maintaining cart contents. You may disable cookies in your browser settings, but please note that login and checkout features may become unavailable.'
              : 'Сайт использует исключительно функциональные cookie-файлы, необходимые для аутентификации пользователя, предотвращения подделки запросов (CSRF) и корректной работы корзины. Пользователь может отключить cookies в настройках своего браузера, однако авторизация и оформление заказа могут быть ограничены.'}
          </p>
        </section>

        {/* Section 6 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">06</span>
            <h2>{isKz ? 'Пайдаланушы құқықтары' : isEn ? '6. Customer Rights' : '6. Права пользователя'}</h2>
          </div>
          <p>
            {isKz
              ? 'Пайдаланушы кез келген уақытта өзінің жеке деректерімен танысуға, оларды түзетуге немесе жеке кабинетті жою туралы өтініш білдіруге құқылы. Ол үшін біздің байланыс мекенжайымызға хабарласуға болады.'
              : isEn
              ? 'You have the right to request access to your personal information, request corrections, or request deletion of your account and related data at any time by contacting our support.'
              : 'Пользователь имеет право запросить информацию об обработке своих данных, потребовать их уточнения, исправления либо удаления своей учётной записи, обратившись к администрации кондитерской.'}
          </p>
        </section>

        {/* Section 7 */}
        <section className="legal-card legal-contacts-card">
          <div className="legal-card-header">
            <MapPin size={22} aria-hidden="true" />
            <h2>{isKz ? 'Байланыс және реквизиттер' : isEn ? '7. Contacts & Operator Details' : '7. Контакты и реквизиты'}</h2>
          </div>
          <p>
            <strong>{isKz ? 'Кондитерлік атауы:' : isEn ? 'Operator:' : 'Кондитерская:'}</strong> Anasym Bakery<br />
            <strong>{isKz ? 'Мекенжайы:' : isEn ? 'Address:' : 'Адрес:'}</strong>{' '}
            {isKz ? 'Қазақстан Республикасы, Тараз қ., Қонаев к-сі, 62а' : isEn ? 'Republic of Kazakhstan, Taraz, Konaev St, 62a' : 'Республика Казахстан, г. Тараз, ул. Конаева, 62а'}<br />
            <strong>{isKz ? 'Жұмыс уақыты:' : isEn ? 'Working Hours:' : 'Режим работы:'}</strong>{' '}
            {isKz ? 'Дүй–Жек: 08:00–21:00' : isEn ? 'Mon–Sun: 08:00–21:00' : 'Ежедневно: 08:00–21:00'}
          </p>
        </section>
      </div>
    </main>
  );
}

/* ── Public Offer & Terms Page ───────────────────────────────────────────── */
export function PublicOffer() {
  const { t, lang } = useI18n();

  const isKz = lang === 'kz';
  const isEn = lang === 'en';

  return (
    <main className="container page legal-page">
      <div className="breadcrumb">
        <Link to="/">{t.breadcrumbHome}</Link>
        <span>/</span>
        {t.footerTerms}
      </div>

      <header className="legal-header">
        <span className="eyebrow">
          {isKz ? 'БӨЛШЕК САУДА ШАРТТАРЫ' : isEn ? 'TERMS OF SALE & RETAIL AGREEMENT' : 'УСЛОВИЯ РОЗНИЧНОЙ ПРОДАЖИ И ДОСТАВКИ'}
        </span>
        <h1>{t.footerTerms}</h1>
        <p className="legal-subtitle">
          {isKz
            ? 'Anasym кондитерлік және нан өнімдерін қашықтықтан сату, жеткізу және қабылдау шарттары'
            : isEn
            ? 'Terms and conditions for ordering, delivery, and payment of Anasym bakery products'
            : 'Публичная оферта на приобретение, доставку и оплату кондитерских и хлебобулочных изделий'}
        </p>
        <div className="legal-meta-row">
          <span className="legal-badge">
            <Scale size={16} aria-hidden="true" />
            {isKz ? 'ҚР Азаматтық кодексінің 395-бабына сәйкес жария оферта' : isEn ? 'Legally binding public offer' : 'Публичная оферта (ст. 395 ГК РК)'}
          </span>
          <span className="legal-date">
            <Clock size={15} aria-hidden="true" />
            {isKz ? 'Редакция: 2026 ж.' : isEn ? 'Edition: 2026' : 'Редакция от: 2026 г.'}
          </span>
        </div>
      </header>

      <div className="legal-content">
        {/* Section 1 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">01</span>
            <h2>{isKz ? 'Офертаның мәні және оны қабылдау' : isEn ? '1. Subject & Acceptance' : '1. Предмет оферты и акцепт'}</h2>
          </div>
          <p>
            {isKz
              ? 'Осы құжат Сатушының (Anasym кондитерлігі) кез келген жеке тұлғаға (Сатып алушыға) anasym-bakery.vercel.app сайтында ұсынылған кондитерлік және нан өнімдерін бөлшек саудада сатып алу туралы ресми жария ұсынысы (офертасы) болып табылады.'
              : isEn
              ? 'This document constitutes a public offer by Anasym Bakery to any individual (Customer) to purchase confectionery and bakery goods presented on anasym-bakery.vercel.app.'
              : 'Настоящий документ является официальным публичным предложением (офертой) кондитерской «Anasym» (Продавец) любому физическому лицу (Покупателю) заключить договор розничной купли-продажи кондитерских и хлебобулочных изделий на условиях, изложенных ниже.'}
          </p>
          <p>
            {isKz
              ? 'Сатып алушының сайтта тапсырысты ресімдеп, «Тапсырысты растау» батырмасын басуы осы офертаны толық және сөзсіз қабылдау (акцепт) болып саналады.'
              : isEn
              ? 'Submitting an order on the website by clicking "Confirm Order" constitutes full and unconditional acceptance (acceptance) of this offer.'
              : 'Оформление Покупателем заказа на сайте и нажатие кнопки «Подтвердить заказ» признаётся полным и безоговорочным акцептом настоящей публичной оферты.'}
          </p>
        </section>

        {/* Section 2 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">02</span>
            <h2>{isKz ? 'Өнімдер туралы ақпарат' : isEn ? '2. Product Information & Allergens' : '2. Сведения о товарах и аллергены'}</h2>
          </div>
          <p>
            {isKz
              ? 'Сайтта ұсынылған барлық бұйымдар — жаңа піскен, табиғи ингредиенттерден жасалған қолөнер кондитерлік және нан-тоқаш өнімдері (круассандар, нандар, бәліштер, торттар мен тәттілер).'
              : isEn
              ? 'All products offered are freshly baked artisan confectionery and bakery goods (croissants, sourdough breads, tarts, and pastries) prepared using high-quality natural ingredients.'
              : 'Все представленные изделия являются свежей выпечкой и кондитерскими изделиями ручной работы из натуральных ингредиентов.'}
          </p>
          <div className="legal-warning-box">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <strong>{isKz ? 'Аллергендер туралы ескерту:' : isEn ? 'Allergen Notice:' : 'Информация об аллергенах:'}</strong>
              <p>
                {isKz
                  ? 'Өнімдердің құрамында глютен (бидай ұны), сүт өнімдері (сарымай, кілегей, ірімшік), тауық жұмыртқасы және жаңғақ іздері болуы мүмкін. Аллергияңыз болған жағдайда тапсырыс пікіріне алдын ала көрсетуіңізді сұраймыз.'
                  : isEn
                  ? 'Our goods may contain or come into contact with common allergens including gluten, dairy, eggs, and nuts. Please specify any dietary restrictions in the order comments.'
                  : 'Изделия могут содержать глютен (пшеничную муку), молочные продукты (сливочное масло, сливки), яйца и орехи. При наличии аллергии обязательно укажите это в комментарии к заказу.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">03</span>
            <h2>{isKz ? 'Бағалар және төлем тәртібі' : isEn ? '3. Pricing & Payment Terms' : '3. Цены и порядок оплаты'}</h2>
          </div>
          <p>
            {isKz
              ? 'Өнімдердің бағалары сайт каталогында Қазақстан Республикасының ұлттық валютасы — теңгемен (₸) көрсетілген.'
              : isEn
              ? 'All prices on the website are displayed in Kazakhstani Tenge (₸) and include all applicable taxes.'
              : 'Все цены на товары в каталоге указаны в национальной валюте Республики Казахстан — тенге (₸).'}
          </p>
          <p>
            {isKz
              ? 'Төлем Сатып алушыға тапсырыс қолма-қол немесе курьерге төлем арқылы жеткізілген сәтте жүзеге асырылады. Жеткізу құны тапсырысты растау кезінде нақты есептеліп көрсетіледі.'
              : isEn
              ? 'Payment is made upon delivery directly to the courier (cash or card/transfer). The delivery fee is clearly itemized in the order summary before checkout.'
              : 'Оплата производится Покупателем в момент получения заказа (наличными или безналичным расчетом курьеру). Стоимость доставки является фиксированной и отображается в расчете заказа до момента отправки.'}
          </p>
        </section>

        {/* Section 4 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">04</span>
            <h2>{isKz ? 'Жеткізу және өнімді қабылдау' : isEn ? '4. Delivery & Inspection' : '4. Доставка и приёмка товара'}</h2>
          </div>
          <p>
            {isKz
              ? 'Жеткізу Тараз қаласының белгіленген аумағы бойынша келісілген уақыт аралығында орындалады.'
              : isEn
              ? 'Delivery is executed across Taraz city within the agreed time window.'
              : 'Доставка осуществляется в пределах города Тараз в согласованный с клиентом временной интервал.'}
          </p>
          <p>
            {isKz
              ? 'Сатып алушы курьердің көзінше тапсырыстың тұтастығын, қаптаманың бүлінбегенін және тауардың сәйкестігін тексеруге міндетті.'
              : isEn
              ? 'Upon receipt, the Customer is required to inspect package integrity, appearance, and order completeness in the presence of the courier.'
              : 'При передаче заказа Покупатель обязан в присутствии курьера осмотреть упаковку, внешний вид изделий и комплектность заказа.'}
          </p>
        </section>

        {/* Section 5 */}
        <section className="legal-card">
          <div className="legal-card-header">
            <span className="legal-num">05</span>
            <h2>{isKz ? 'Тауарды қайтару және шағымдар' : isEn ? '5. Returns & Complaints' : '5. Возврат и обмен товара'}</h2>
          </div>
          <p>
            {isKz
              ? '«Тұтынушылардың құқықтарын қорғау туралы» Қазақстан Республикасының Заңына сәйкес, тиісті сападағы азық-түлік және тез бұзылатын кондитерлік өнімдер қайтаруға немесе айырбастауға жатпайды.'
              : isEn
              ? 'In accordance with the Consumer Protection Laws of the Republic of Kazakhstan, fresh perishable food and bakery products of adequate quality cannot be returned or exchanged once received.'
              : 'В соответствии с Законом Республики Казахстан «О защите прав потребителей», продовольственные и скоропортящиеся товары надлежащего качества возврату и обмену не подлежат.'}
          </p>
          <p>
            {isKz
              ? 'Өнімде ақау, салмақ немесе сапа сәйкессіздігі анықталған жағдайда, Сатып алушы курьердің көзінше тауарды қабылдаудан бас тартуға немесе өнімді ауыстыруды / ақыны қайтаруды талап етуге құқылы.'
              : isEn
              ? 'In the event of a discrepancy, damage, or defect identified at delivery, the Customer has the right to refuse the damaged items or request an immediate replacement / fee adjustment.'
              : 'В случае обнаружения недостатков товара (брак, повреждение товарного вида при транспортировке) при курьере, Покупатель имеет право отказаться от заказа либо потребовать соразмерной замены на качественное изделие.'}
          </p>
        </section>

        {/* Section 6 */}
        <section className="legal-card legal-contacts-card">
          <div className="legal-card-header">
            <MapPin size={22} aria-hidden="true" />
            <h2>{isKz ? 'Сатушының реквизиттері' : isEn ? '6. Seller Details' : '6. Реквизиты продавца'}</h2>
          </div>
          <p>
            <strong>{isKz ? 'Сатушы:' : isEn ? 'Seller:' : 'Продавец:'}</strong> Кондитерская «Anasym Bakery»<br />
            <strong>{isKz ? 'Өндіріс және дүкен мекенжайы:' : isEn ? 'Bakery Address:' : 'Адрес кондитерской:'}</strong>{' '}
            {isKz ? 'Қазақстан Республикасы, Тараз қ., Қонаев к-сі, 62а' : isEn ? 'Republic of Kazakhstan, Taraz, Konaev St, 62a' : 'Республика Казахстан, г. Тараз, ул. Конаева, 62а'}<br />
            <strong>{isKz ? 'Жұмыс уақыты:' : isEn ? 'Working Hours:' : 'Режим работы:'}</strong>{' '}
            {isKz ? 'Дүйсенбі – Жексенбі: 08:00 – 21:00' : isEn ? 'Monday – Sunday: 08:00 – 21:00' : 'Понедельник – Воскресенье: 08:00 – 21:00'}
          </p>
        </section>
      </div>
    </main>
  );
}
