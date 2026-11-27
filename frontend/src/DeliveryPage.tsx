import {Link} from 'react-router-dom';
import {ArrowRight, Truck, Wallet, ShoppingBag, ClipboardCheck, ChefHat, PackageCheck, HandCoins, BadgeCheck, LayoutDashboard} from 'lucide-react';
import {Branch, Ornament} from './ui';
import {useI18n} from './i18n';
import './about-page.css';
import './delivery-page.css';

type Content = {
  intro: string;
  deliveryTitle: string; deliverySub: string; deliveryP1: string; feeLabel: string; feeBadge: string; feeValue: string; feeFacts: string[]; deliveryP2: string;
  paymentTitle: string; paymentSub: string; paymentP1: string; paymentP2: string; paymentP3: string;
  stepsEyebrow: string; stepsTitle: string;
  steps: {title: string; text: string}[];
  facts: string[];
  closingA: string; closingB: string; button: string;
};

const CONTENT: Record<'ru' | 'kz' | 'en', Content> = {
  ru: {
    intro: 'В Anasym мы заботимся не только о вкусе наших изделий, но и о том, чтобы процесс заказа был для вас максимально простым и удобным. Выбирайте любимую выпечку и десерты, а мы позаботимся об остальном.',
    deliveryTitle: 'Доставка', deliverySub: 'Любимые вкусы становятся ближе.',
    deliveryP1: 'Необязательно выходить из дома, чтобы порадовать себя свежей и ароматной выпечкой. Мы с удовольствием доставим ваши любимые изделия прямо к вашему порогу, чтобы вы могли уделить больше времени себе и близким.',
    feeLabel: 'Стоимость доставки', feeBadge: 'Не входит в заказ', feeValue: 'рассчитывается отдельно',
    feeFacts: ['Зависит от адреса, расстояния и времени', 'Ориентировочно — около 1 500 ₸', 'Точную сумму оператор назовёт заранее'],
    deliveryP2: 'После оформления наш оператор уточнит с вами удобное время, адрес и все необходимые детали, а затем передаст заказ курьеру. Мы бережно относимся к каждому заказу, чтобы ваши десерты приехали в надлежащем виде.',
    paymentTitle: 'Оплата', paymentSub: 'Всё просто, удобно и прозрачно.',
    paymentP1: 'Мы хотим, чтобы покупка любимых десертов приносила только приятные эмоции. Поэтому в Anasym вы можете оформить заказ заранее, а оплатить его непосредственно при получении.',
    paymentP2: 'Все цены на сайте указаны в тенге, без скрытых доплат.',
    paymentP3: 'После оформления заказ автоматически появится в вашем личном кабинете. Как только администратор подтвердит его и передаст на подготовку, вы сможете следить за дальнейшими этапами доставки.',
    stepsEyebrow: 'ПРОСТО И УДОБНО', stepsTitle: 'Как проходит заказ',
    steps: [
      {title: 'Выберите изделия', text: 'Добавьте любимую выпечку и десерты из каталога в корзину.'},
      {title: 'Оформите заказ', text: 'Укажите адрес и контакты — заказ сразу появится в личном кабинете.'},
      {title: 'Подтверждение и подготовка', text: 'Оператор уточнит детали, администратор подтвердит заказ и передаст его на подготовку.'},
      {title: 'Доставка и оплата', text: 'Курьер привезёт заказ к вашей двери. Заказ оплачивается при получении, доставка — отдельно.'},
    ],
    facts: ['Оплата при получении', 'Цены в тенге без доплат', 'Статус заказа в кабинете'],
    closingA: 'Anasym — мы заботимся о деталях,', closingB: 'чтобы вам оставалось наслаждаться вкусом.',
    button: 'Выбрать изделия',
  },
  kz: {
    intro: 'Anasym-да біз бұйымдарымыздың дәмі туралы ғана емес, тапсырыс беру сіз үшін барынша қарапайым әрі ыңғайлы болуы туралы да қамқорлық жасаймыз. Сүйікті тоқаштар мен десерттерді таңдаңыз, қалғанын біз өз мойнымызға аламыз.',
    deliveryTitle: 'Жеткізу', deliverySub: 'Сүйікті дәмдер жақындай түседі.',
    deliveryP1: 'Жаңа піскен хош иісті тоқашпен өзіңізді қуанту үшін үйден шығудың қажеті жоқ. Сүйікті бұйымдарыңызды есігіңізге дейін қуана жеткіземіз — өзіңізге және жақындарыңызға көбірек уақыт бөлуіңіз үшін.',
    feeLabel: 'Жеткізу құны', feeBadge: 'Тапсырысқа кірмейді', feeValue: 'бөлек есептеледі',
    feeFacts: ['Мекенжайға, қашықтыққа және уақытқа байланысты', 'Шамамен — 1 500 ₸ шамасында', 'Нақты соманы оператор алдын ала айтады'],
    deliveryP2: 'Тапсырыс бергеннен кейін операторымыз сізбен ыңғайлы уақытты, мекенжайды және барлық қажетті мәліметтерді нақтылап, тапсырысты курьерге береді. Десерттеріңіз тиісті күйде жетуі үшін әр тапсырысқа ұқыпты қараймыз.',
    paymentTitle: 'Төлем', paymentSub: 'Бәрі қарапайым, ыңғайлы әрі ашық.',
    paymentP1: 'Сүйікті десерттерді сатып алу тек жағымды әсер сыйлағанын қалаймыз. Сондықтан Anasym-да тапсырысты алдын ала рәсімдеп, төлемін алған кезде жасай аласыз.',
    paymentP2: 'Сайттағы барлық баға теңгемен көрсетілген, жасырын үстемақысыз.',
    paymentP3: 'Рәсімдегеннен кейін тапсырыс жеке кабинетіңізде автоматты түрде пайда болады. Әкімші оны растап, дайындауға бергеннен кейін жеткізудің келесі кезеңдерін бақылай аласыз.',
    stepsEyebrow: 'ҚАРАПАЙЫМ ӘРІ ЫҢҒАЙЛЫ', stepsTitle: 'Тапсырыс қалай өтеді',
    steps: [
      {title: 'Бұйымдарды таңдаңыз', text: 'Каталогтан сүйікті тоқаштар мен десерттерді себетке қосыңыз.'},
      {title: 'Тапсырысты рәсімдеңіз', text: 'Мекенжай мен байланыс деректерін көрсетіңіз — тапсырыс бірден кабинетте пайда болады.'},
      {title: 'Растау және дайындау', text: 'Оператор мәліметтерді нақтылайды, әкімші тапсырысты растап, дайындауға береді.'},
      {title: 'Жеткізу және төлем', text: 'Курьер тапсырысты есігіңізге дейін әкеледі. Тапсырыс алған кезде төленеді, жеткізу — бөлек.'},
    ],
    facts: ['Алған кезде төлеу', 'Теңгедегі баға, үстемақысыз', 'Тапсырыс мәртебесі кабинетте'],
    closingA: 'Anasym — біз әр бөлшекке қамқорлық жасаймыз,', closingB: 'сізге тек дәмнен ләззат алу қалсын.',
    button: 'Бұйымдарды таңдау',
  },
  en: {
    intro: 'At Anasym we care not only about how our treats taste, but also about making ordering as simple and convenient as possible. Choose your favourite pastries and desserts — we will take care of the rest.',
    deliveryTitle: 'Delivery', deliverySub: 'Your favourite flavours, closer than ever.',
    deliveryP1: 'You do not have to leave home to treat yourself to fresh, fragrant pastries. We will gladly bring your favourite treats right to your door, so you can spend more time on yourself and your loved ones.',
    feeLabel: 'Delivery fee', feeBadge: 'Not included in the order', feeValue: 'calculated separately',
    feeFacts: ['Depends on the address, distance and time', 'Roughly about 1 500 ₸', 'The operator tells you the exact amount in advance'],
    deliveryP2: 'Once you place an order, our operator will confirm a convenient time, the address and every detail with you, then hand the order to a courier. We handle each order with care so your desserts arrive just as they should.',
    paymentTitle: 'Payment', paymentSub: 'Simple, convenient and transparent.',
    paymentP1: 'We want buying your favourite desserts to bring nothing but joy. That is why at Anasym you can place your order in advance and pay for it on delivery.',
    paymentP2: 'All prices on the site are in tenge, with no hidden extras.',
    paymentP3: 'After checkout your order appears in your account automatically. Once the administrator confirms it and sends it for preparation, you can follow every next step of the delivery.',
    stepsEyebrow: 'SIMPLE AND CONVENIENT', stepsTitle: 'How ordering works',
    steps: [
      {title: 'Choose your treats', text: 'Add your favourite pastries and desserts from the catalog to the cart.'},
      {title: 'Place the order', text: 'Enter your address and contacts — the order appears in your account right away.'},
      {title: 'Confirmation and preparation', text: 'The operator confirms the details; the administrator approves the order and sends it for preparation.'},
      {title: 'Delivery and payment', text: 'A courier brings the order to your door. You pay for the order on delivery; delivery is charged separately.'},
    ],
    facts: ['Pay on delivery', 'Prices in tenge, no extras', 'Order status in your account'],
    closingA: 'Anasym — we take care of the details,', closingB: 'so all that is left for you is to enjoy the flavour.',
    button: 'Choose your treats',
  },
};

const STEP_ICONS = [ShoppingBag, ClipboardCheck, ChefHat, PackageCheck];
const FACT_ICONS = [HandCoins, BadgeCheck, LayoutDashboard];

export default function DeliveryPage() {
  const {t, lang} = useI18n();
  const c = CONTENT[lang];
  const [titleLead, titleAccent] = t.infoDeliveryTitle.split(/\s*—\s*/);


  return (
    <main className="about-page delivery-page">
      <section className="container ap-intro">
        <div className="breadcrumb">
          <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{t.infoDeliveryCrumb}
        </div>
        <span className="eyebrow">{t.infoAboutEyebrow}</span>
        <h1>{titleAccent ? <>{titleLead}<br /><em>{titleAccent}</em></> : t.infoDeliveryTitle}</h1>
        <p className="dp-intro">{c.intro}</p>
        <Ornament />
      </section>

      <section className="container dp-cards">
        <article className="dp-card">
          <span className="dp-card-icon"><Truck aria-hidden="true" /></span>
          <h2>{c.deliveryTitle}</h2>
          <p className="dp-sub">{c.deliverySub}</p>
          <p>{c.deliveryP1}</p>
          <div className="dp-fee">
            <div className="dp-fee-head"><span>{c.feeLabel}</span><b className="dp-fee-badge">{c.feeBadge}</b></div>
            <strong>{c.feeValue}</strong>
            <ul>{c.feeFacts.map(fact => <li key={fact}>{fact}</li>)}</ul>
          </div>
          <p>{c.deliveryP2}</p>
        </article>
        <article className="dp-card dp-card-green">
          <Branch className="dp-card-branch" />
          <span className="dp-card-icon"><Wallet aria-hidden="true" /></span>
          <h2>{c.paymentTitle}</h2>
          <p className="dp-sub">{c.paymentSub}</p>
          <p>{c.paymentP1}</p>
          <p className="dp-highlight">{c.paymentP2}</p>
          <p>{c.paymentP3}</p>
        </article>
      </section>

      <section className="container dp-steps">
        <span className="eyebrow">{c.stepsEyebrow}</span>
        <h2>{c.stepsTitle}</h2>
        <ol>
          {c.steps.map((step, index) => {
            const Icon = STEP_ICONS[index];
            return (
              <li key={step.title}>
                <span className="dp-step-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="dp-step-icon"><Icon aria-hidden="true" /></span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="container">
        <ul className="dp-facts">
          {c.facts.map((fact, index) => {
            const Icon = FACT_ICONS[index];
            return <li key={fact}><Icon aria-hidden="true" /><span>{fact}</span></li>;
          })}
        </ul>
      </section>

      <section className="container ap-closing-wrap">
        <div className="ap-closing">
          <img className="ap-closing-logo" src="/images/Logo.webp" alt="" aria-hidden="true" loading="lazy" />
          <p className="ap-closing-a">{c.closingA}</p>
          <p className="ap-closing-b">{c.closingB}</p>
          <Link to="/catalog" className="button button-gold">{c.button} <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
