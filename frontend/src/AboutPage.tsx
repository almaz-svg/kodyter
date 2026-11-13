import {Link} from 'react-router-dom';
import {ArrowRight, Leaf, HandHeart, Croissant, Sparkles, Quote} from 'lucide-react';
import {Branch, Ornament} from './ui';
import {useI18n} from './i18n';
import './about-page.css';

type Content = {
  lead: string;
  p1: string; p2: string; p3: string; p4: string;
  quote: string;
  valuesEyebrow: string; valuesTitle: string;
  values: {title: string; text: string}[];
  storyEyebrow: string; storyTitle: string;
  closingA: string; closingB: string;
  button: string;
  photoCaption: string;
};

const CONTENT: Record<'ru' | 'kz' | 'en', Content> = {
  ru: {
    lead: 'Anasym — место, где вкус становится частью тёплых воспоминаний.',
    p1: 'В самом сердце Тараза мы создаём не просто выпечку и десерты, а маленькие поводы для радости.',
    p2: 'В Anasym мы верим, что настоящая вкусная выпечка начинается с любви к своему делу. Именно поэтому каждое изделие для нас — это особенное сочетание качественных натуральных ингредиентов, бережного ручного приготовления и внимания к мельчайшим деталям.',
    p3: 'Мы бережно сохраняем знакомые с детства вкусы, добавляя к ним собственный характер и вдохновение. От румяной, ароматной выпечки до нежных десертов — в нашей коллекции каждый найдёт что-то близкое своему сердцу.',
    p4: 'Для нас важно не только то, каким будет первый кусочек, но и то, какие эмоции останутся после него. Мы хотим, чтобы наши изделия становились частью ваших семейных вечеров, душевных встреч, особенных праздников и простых счастливых моментов.',
    quote: 'Иногда для счастья нужно совсем немного: аромат свежей выпечки, чашка любимого чая и близкие люди рядом.',
    valuesEyebrow: 'НАШ ПОДХОД', valuesTitle: 'Из чего складывается вкус',
    values: [
      {title: 'Натуральные ингредиенты', text: 'Только качественные и честные продукты — с них начинается настоящий вкус.'},
      {title: 'Ручная работа', text: 'Каждое изделие мы готовим вручную — бережно и без спешки.'},
      {title: 'Вкус из детства', text: 'Знакомые рецепты, к которым мы добавляем свой характер и вдохновение.'},
      {title: 'Внимание к деталям', text: 'От румяной корочки до последнего штриха украшения — всё продумано до мелочей.'},
    ],
    storyEyebrow: 'ВКУС, КОТОРЫЙ ПОМНЯТ', storyTitle: 'Больше, чем просто десерт',
    closingA: 'Anasym — вкус, который объединяет.', closingB: 'Тепло, к которому хочется возвращаться.',
    button: 'Откройте для себя наши вкусы',
    photoCaption: 'Anasym, Тараз, ул. Конаева, 62а',
  },
  kz: {
    lead: 'Anasym — дәм жылы естеліктердің бір бөлігіне айналатын орын.',
    p1: 'Тараздың дәл жүрегінде біз жай ғана нан-тоқаш пен десерт емес, қуанышқа арналған кішкентай себептер жасаймыз.',
    p2: 'Anasym-да біз нағыз дәмді тоқаш өз ісіңе деген сүйіспеншіліктен басталады деп сенеміз. Сондықтан әр бұйым біз үшін — сапалы табиғи ингредиенттердің, ұқыпты қол еңбегінің және ең ұсақ бөлшектерге деген назардың ерекше үйлесімі.',
    p3: 'Біз балалық шақтан таныс дәмдерді ұқыпты сақтап, оларға өз мінезіміз бен шабытымызды қосамыз. Қызара піскен хош иісті тоқаштан бастап нәзік десерттерге дейін — біздің коллекциядан әркім өз жүрегіне жақын нәрсе табады.',
    p4: 'Біз үшін алғашқы тістемнің қандай болатыны ғана емес, одан кейін қандай әсер қалатыны да маңызды. Біздің бұйымдар отбасылық кештеріңіздің, жылы кездесулеріңіздің, ерекше мерекелеріңіз бен қарапайым бақытты сәттеріңіздің бөлігіне айналғанын қалаймыз.',
    quote: 'Кейде бақытқа өте аз нәрсе жетеді: жаңа піскен тоқаштың хош иісі, бір кесе сүйікті шай және қасыңдағы жақын адамдар.',
    valuesEyebrow: 'БІЗДІҢ ТӘСІЛ', valuesTitle: 'Дәм неден құралады',
    values: [
      {title: 'Табиғи ингредиенттер', text: 'Тек сапалы әрі таза өнімдер — нағыз дәм осыдан басталады.'},
      {title: 'Қол еңбегі', text: 'Әр бұйымды қолмен, ұқыпты әрі асықпай дайындаймыз.'},
      {title: 'Балалық шақтың дәмі', text: 'Таныс рецепттер — өз мінезіміз бен шабытымызбен.'},
      {title: 'Бөлшектерге назар', text: 'Қызарған қыртыстан безендірудің соңғы штрихына дейін — бәрі мұқият ойластырылған.'},
    ],
    storyEyebrow: 'ЕСТЕ ҚАЛАТЫН ДӘМ', storyTitle: 'Жай десерттен де артық',
    closingA: 'Anasym — біріктіретін дәм.', closingB: 'Қайта оралғың келетін жылулық.',
    button: 'Біздің дәмдерді ашыңыз',
    photoCaption: 'Anasym, Тараз қ., Қонаев к-сі, 62а',
  },
  en: {
    lead: 'Anasym is a place where flavour becomes part of warm memories.',
    p1: 'In the very heart of Taraz we create more than pastries and desserts — we create small reasons for joy.',
    p2: 'At Anasym we believe that truly delicious baking begins with a love for the craft. That is why every item is, for us, a special blend of quality natural ingredients, careful handmade preparation and attention to the smallest details.',
    p3: 'We lovingly keep the flavours you remember from childhood, adding our own character and inspiration. From golden, fragrant pastries to delicate desserts, everyone will find something close to their heart in our collection.',
    p4: 'What matters to us is not only the first bite, but the feelings that stay afterwards. We want our treats to become part of your family evenings, heartfelt gatherings, special celebrations and simple happy moments.',
    quote: 'Sometimes happiness takes very little: the scent of fresh pastry, a cup of your favourite tea and loved ones close by.',
    valuesEyebrow: 'OUR APPROACH', valuesTitle: 'What makes the flavour',
    values: [
      {title: 'Natural ingredients', text: 'Only honest, quality produce — that is where real flavour begins.'},
      {title: 'Made by hand', text: 'We make every item by hand, with care and without rushing.'},
      {title: 'A taste of childhood', text: 'Familiar recipes with our own character and inspiration.'},
      {title: 'Attention to detail', text: 'From the golden crust to the final decoration, every detail is considered.'},
    ],
    storyEyebrow: 'A FLAVOUR TO REMEMBER', storyTitle: 'More than just dessert',
    closingA: 'Anasym — a flavour that brings people together.', closingB: 'Warmth you will want to come back to.',
    button: 'Discover our flavours',
    photoCaption: 'Anasym, Taraz, Konaev St, 62a',
  },
};

const VALUE_ICONS = [Leaf, HandHeart, Croissant, Sparkles];

export default function AboutPage() {
  const {t, lang} = useI18n();
  const c = CONTENT[lang];
  const [titleLead, titleAccent] = t.infoAboutTitle.split(/\s*—\s*/);
  const [h2a, h2b] = t.infoAboutH2.split('\n');

  return (
    <main className="about-page">
      {/* Intro */}
      <section className="container ap-intro">
        <div className="breadcrumb">
          <Link to="/">{t.breadcrumbHome}</Link><span>/</span>{t.infoAboutCrumb}
        </div>
        <span className="eyebrow">{t.infoAboutEyebrow}</span>
        <h1>{titleAccent ? <>{titleLead}<br /><em>{titleAccent}</em></> : t.infoAboutTitle}</h1>
        <Ornament />
      </section>

      {/* Story, part 1 */}
      <section className="container ap-split">
        <figure className="ap-photo">
          <img src="/images/about-pies.webp" alt={c.lead} loading="lazy" width={1712} height={1332} />
        </figure>
        <div className="ap-copy">
          <h2>{h2a}{h2b && <><br /><em>{h2b}</em></>}</h2>
          <p className="ap-lead">{c.lead}</p>
          <p>{c.p1}</p>
          <p>{c.p2}</p>
        </div>
      </section>

      {/* Quote */}
      <section className="ap-quote">
        <Branch className="ap-quote-branch" />
        <div className="container">
          <Quote className="ap-quote-mark" aria-hidden="true" />
          <blockquote>{c.quote}</blockquote>
          <span className="ap-quote-sign">Anasym</span>
        </div>
      </section>

      {/* Values */}
      <section className="container ap-values">
        <span className="eyebrow">{c.valuesEyebrow}</span>
        <h2>{c.valuesTitle}</h2>
        <ul>
          {c.values.map((value, index) => {
            const Icon = VALUE_ICONS[index];
            return (
              <li key={value.title}>
                <span className="ap-value-icon"><Icon aria-hidden="true" /></span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Story, part 2 */}
      <section className="container ap-split ap-split-reverse">
        <figure className="ap-photo ap-photo-store">
          <img src="/images/storefront-1.webp" alt={c.photoCaption} loading="lazy" width={1080} height={1434} />
          <figcaption>{c.photoCaption}</figcaption>
        </figure>
        <div className="ap-copy">
          <span className="eyebrow">{c.storyEyebrow}</span>
          <h2>{c.storyTitle}</h2>
          <p>{c.p3}</p>
          <p>{c.p4}</p>
        </div>
      </section>

      {/* Closing */}
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
