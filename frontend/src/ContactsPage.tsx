import {Link} from 'react-router-dom';
import {ArrowRight, MapPin, Clock, Phone, ShoppingBag, Store, Sunrise, Coffee, Users, PartyPopper} from 'lucide-react';
import {Branch, Ornament} from './ui';
import {MAP_URL, CONTACT_PHONE, CONTACT_PHONE_LINK, mapEmbedUrl} from './MapSection';
import {useI18n} from './i18n';
import './about-page.css';
import './delivery-page.css';
import './contacts-page.css';

type Content = {
  titleA: string; titleB: string;
  lead: string; intro: string;
  visitTitle: string; visitSub: string; visitP1: string; visitP2: string;
  addressLabel: string; address: string; hoursLabel: string; hours: string; phoneLabel: string;
  visitNote: string; showOnMap: string; call: string;
  orderTitle: string; orderSub: string; orderP1: string; orderP2: string; orderP3: string; orderButton: string;
  findEyebrow: string; findTitle: string; photoCaption: string;
  momentsEyebrow: string; momentsTitle: string; moments: string[];
  closingA: string; closingB: string; closingButton: string;
};

const CONTENT: Record<'ru' | 'kz' | 'en', Content> = {
  ru: {
    titleA: 'Будем', titleB: 'на связи',
    lead: 'Anasym — место, где вас всегда ждут с теплом.',
    intro: 'Мы рады быть частью ваших маленьких радостей, уютных семейных вечеров и особенных моментов. Хотите заглянуть к нам за свежей выпечкой или порадовать близких любимыми десертами? Мы всегда будем рады вашему визиту.',
    visitTitle: 'Адрес и часы работы', visitSub: 'Загляните к нам за хорошим настроением и любимыми вкусами.',
    visitP1: 'В самом сердце Тараза вас ждёт Anasym — уютный уголок, где аромат свежей выпечки создаёт особенную атмосферу, а каждый десерт приготовлен с заботой и вниманием к деталям.',
    visitP2: 'Заходите за любимыми лакомствами, выбирайте что-нибудь к семейному чаепитию или просто порадуйте себя чем-то вкусным.',
    addressLabel: 'Наш адрес', address: 'г. Тараз, ул. Конаева, 62а', hoursLabel: 'Режим работы', hours: 'Ежедневно с 08:00 до 21:00', phoneLabel: 'Телефон',
    visitNote: 'Мы будем рады видеть вас каждый день!', showOnMap: 'Показать на карте', call: 'Позвонить',
    orderTitle: 'Заказать онлайн', orderSub: 'Любимая выпечка — всего в нескольких шагах от вас.',
    orderP1: 'Иногда хочется чего-нибудь вкусного, не выходя из дома. Именно поэтому мы сделали процесс заказа простым и удобным, чтобы вы могли наслаждаться любимыми десертами без лишних хлопот.',
    orderP2: 'Откройте наш каталог, познакомьтесь с ассортиментом, выберите то, что вам по душе, и добавьте изделия в корзину. А мы с заботой подготовим ваш заказ.',
    orderP3: 'Будь то уютный завтрак, семейное чаепитие, встреча с друзьями или небольшой праздник — у Anasym найдётся что-то особенное для каждого момента.',
    orderButton: 'Выбрать любимые десерты',
    findEyebrow: 'КАК НАС НАЙТИ', findTitle: 'Ждём вас в гости', photoCaption: 'Anasym, Тараз, ул. Конаева, 62а',
    momentsEyebrow: 'ДЛЯ ЛЮБОГО МОМЕНТА', momentsTitle: 'Что-то особенное найдётся всегда',
    moments: ['Уютный завтрак', 'Семейное чаепитие', 'Встреча с друзьями', 'Небольшой праздник'],
    closingA: 'Anasym — рядом,', closingB: 'когда хочется чего-то особенного.', closingButton: 'Перейти в каталог',
  },
  kz: {
    titleA: 'Байланыста', titleB: 'боламыз',
    lead: 'Anasym — сізді әрқашан жылулықпен күтетін орын.',
    intro: 'Шағын қуаныштарыңыздың, жайлы отбасылық кештеріңіз бен ерекше сәттеріңіздің бір бөлігі болғанымызға қуаныштымыз. Жаңа піскен тоқаш үшін бізге соғып кеткіңіз келе ме, әлде жақындарыңызды сүйікті десерттермен қуантқыңыз келе ме? Келуіңізге әрқашан қуаныштымыз.',
    visitTitle: 'Мекенжай және жұмыс уақыты', visitSub: 'Жақсы көңіл-күй мен сүйікті дәмдер үшін бізге келіңіз.',
    visitP1: 'Тараздың дәл жүрегінде сізді Anasym күтеді — жаңа піскен тоқаштың хош иісі ерекше атмосфера сыйлайтын, ал әр десерт қамқорлықпен және бөлшектерге назар аудара отырып дайындалатын жайлы бұрыш.',
    visitP2: 'Сүйікті тәттілеріңізге келіңіз, отбасылық шай үстіне бірдеңе таңдаңыз немесе өзіңізді дәмді нәрсемен қуантыңыз.',
    addressLabel: 'Мекенжайымыз', address: 'Тараз қ., Қонаев к-сі, 62а', hoursLabel: 'Жұмыс уақыты', hours: 'Күн сайын 08:00-ден 21:00-ге дейін', phoneLabel: 'Телефон',
    visitNote: 'Сізді күн сайын көруге қуаныштымыз!', showOnMap: 'Картадан көрсету', call: 'Қоңырау шалу',
    orderTitle: 'Онлайн тапсырыс', orderSub: 'Сүйікті тоқаш сізден бірнеше қадам ғана жерде.',
    orderP1: 'Кейде үйден шықпай-ақ дәмді бірдеңе жегің келеді. Сондықтан біз тапсырыс беруді қарапайым әрі ыңғайлы еттік — сүйікті десерттерден артық әурешіліксіз ләззат алуыңыз үшін.',
    orderP2: 'Каталогымызды ашып, ассортиментпен танысыңыз, көңіліңізге жаққанын таңдап, себетке қосыңыз. Ал біз тапсырысыңызды қамқорлықпен дайындаймыз.',
    orderP3: 'Жайлы таңғы ас па, отбасылық шай ма, достармен кездесу ме, әлде шағын мереке ме — Anasym-да әр сәтке ерекше бірдеңе табылады.',
    orderButton: 'Сүйікті десерттерді таңдау',
    findEyebrow: 'БІЗДІ ҚАЛАЙ ТАБУҒА БОЛАДЫ', findTitle: 'Сізді қонаққа күтеміз', photoCaption: 'Anasym, Тараз қ., Қонаев к-сі, 62а',
    momentsEyebrow: 'КЕЗ КЕЛГЕН СӘТКЕ', momentsTitle: 'Әрқашан ерекше бірдеңе табылады',
    moments: ['Жайлы таңғы ас', 'Отбасылық шай', 'Достармен кездесу', 'Шағын мереке'],
    closingA: 'Anasym — ерекше бірдеңе қалағанда', closingB: 'әрқашан жаныңызда.', closingButton: 'Каталогқа өту',
  },
  en: {
    titleA: 'Get', titleB: 'in touch',
    lead: 'Anasym is a place where you are always welcomed with warmth.',
    intro: 'We are glad to be part of your small joys, cosy family evenings and special moments. Want to drop by for fresh pastries or treat your loved ones to their favourite desserts? We are always happy to see you.',
    visitTitle: 'Address & opening hours', visitSub: 'Drop by for a good mood and your favourite flavours.',
    visitP1: 'In the very heart of Taraz, Anasym awaits you — a cosy corner where the scent of fresh pastry creates a special atmosphere and every dessert is made with care and attention to detail.',
    visitP2: 'Come in for your favourite treats, pick something for a family tea or simply spoil yourself with something delicious.',
    addressLabel: 'Our address', address: 'Taraz, Konaev St, 62a', hoursLabel: 'Opening hours', hours: 'Daily from 08:00 to 21:00', phoneLabel: 'Phone',
    visitNote: 'We will be happy to see you every day!', showOnMap: 'Show on map', call: 'Call us',
    orderTitle: 'Order online', orderSub: 'Your favourite pastries are just a few steps away.',
    orderP1: 'Sometimes you want something delicious without leaving home. That is why we made ordering simple and convenient, so you can enjoy your favourite desserts without any fuss.',
    orderP2: 'Open our catalog, explore the range, choose what you like and add it to the cart. We will prepare your order with care.',
    orderP3: 'Whether it is a cosy breakfast, a family tea, a get-together with friends or a small celebration, Anasym has something special for every moment.',
    orderButton: 'Choose your favourite desserts',
    findEyebrow: 'HOW TO FIND US', findTitle: 'We look forward to your visit', photoCaption: 'Anasym, Taraz, Konaev St, 62a',
    momentsEyebrow: 'FOR EVERY MOMENT', momentsTitle: 'There is always something special',
    moments: ['A cosy breakfast', 'A family tea', 'Time with friends', 'A small celebration'],
    closingA: 'Anasym — close by', closingB: 'whenever you want something special.', closingButton: 'Go to the catalog',
  },
};

const MOMENT_ICONS = [Sunrise, Coffee, Users, PartyPopper];

export default function ContactsPage() {
  const {t, lang} = useI18n();
  const c = CONTENT[lang];

  return (
    <main className="about-page contacts-page">
      <section className="container ap-intro">
        <div className="breadcrumb">
          <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{t.infoContactsCrumb}
        </div>
        <span className="eyebrow">{t.infoAboutEyebrow}</span>
        <h1>{c.titleA} <em>{c.titleB}</em></h1>
        <p className="cp-lead">{c.lead}</p>
        <p className="dp-intro">{c.intro}</p>
        <Ornament />
      </section>

      <section className="container dp-cards">
        <article className="dp-card">
          <span className="dp-card-icon"><Store aria-hidden="true" /></span>
          <h2>{c.visitTitle}</h2>
          <p className="dp-sub">{c.visitSub}</p>
          <p>{c.visitP1}</p>
          <p>{c.visitP2}</p>
          <ul className="cp-info">
            <li><span className="find-icon"><MapPin aria-hidden="true" /></span><div><small>{c.addressLabel}</small><span>{c.address}</span></div></li>
            <li><span className="find-icon"><Clock aria-hidden="true" /></span><div><small>{c.hoursLabel}</small><span>{c.hours}</span></div></li>
            <li><span className="find-icon"><Phone aria-hidden="true" /></span><div><small>{c.phoneLabel}</small><a href={CONTACT_PHONE_LINK}>{CONTACT_PHONE}</a></div></li>
          </ul>
          <p className="cp-note">{c.visitNote}</p>
          <div className="cp-actions">
            <a className="find-btn" href={MAP_URL} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" />{c.showOnMap}</a>
            <a className="find-btn" href={CONTACT_PHONE_LINK}><Phone aria-hidden="true" />{c.call}</a>
          </div>
        </article>
        <article className="dp-card dp-card-green">
          <Branch className="dp-card-branch" />
          <span className="dp-card-icon"><ShoppingBag aria-hidden="true" /></span>
          <h2>{c.orderTitle}</h2>
          <p className="dp-sub">{c.orderSub}</p>
          <p>{c.orderP1}</p>
          <p>{c.orderP2}</p>
          <p className="dp-highlight">{c.orderP3}</p>
          <Link to="/catalog" className="button button-gold cp-order-btn">{c.orderButton} <ArrowRight size={18} aria-hidden="true" /></Link>
        </article>
      </section>

      <section className="container cp-find">
        <span className="eyebrow">{c.findEyebrow}</span>
        <h2>{c.findTitle}</h2>
        <div className="cp-find-grid">
          <figure className="ap-photo cp-photo">
            <img src="/images/storefront-1.webp" alt={c.photoCaption} loading="lazy" width={1080} height={1434} />
            <figcaption>{c.photoCaption}</figcaption>
          </figure>
          <div className="cp-map">
            <iframe src={mapEmbedUrl(lang)} title={`${c.findTitle} — ${c.address}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          </div>
        </div>
      </section>

      <section className="container cp-moments">
        <span className="eyebrow">{c.momentsEyebrow}</span>
        <h2>{c.momentsTitle}</h2>
        <ul>
          {c.moments.map((moment, index) => {
            const Icon = MOMENT_ICONS[index];
            return <li key={moment}><span className="ap-value-icon"><Icon aria-hidden="true" /></span><span>{moment}</span></li>;
          })}
        </ul>
      </section>

      <section className="container ap-closing-wrap">
        <div className="ap-closing">
          <img className="ap-closing-logo" src="/images/Logo.webp" alt="" aria-hidden="true" loading="lazy" />
          <p className="ap-closing-a">{c.closingA}</p>
          <p className="ap-closing-b">{c.closingB}</p>
          <Link to="/catalog" className="button button-gold">{c.closingButton} <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
