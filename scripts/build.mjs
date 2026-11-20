import fs from 'node:fs';
import path from 'node:path';
import { optimizeMedia } from './optimize-images.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const BASE = 'https://tongyangprocess.com';
const site = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
const aboutSettings = fs.existsSync('content/about.json') ? JSON.parse(fs.readFileSync('content/about.json', 'utf8')) : {};
const readList = (section) => fs.readdirSync(`content/${section}`).filter(x=>x.endsWith('.json')).sort().map(file=>({
  ...JSON.parse(fs.readFileSync(`content/${section}/${file}`, 'utf8')),
  slug:file.replace(/\.json$/, '')
}));
const equipment = readList('equipment');
const products = fs.existsSync('content/products') ? readList('products') : [];
const solutions = readList('solutions');
const projects = fs.existsSync('content/projects') ? readList('projects').filter(x => x.published === true && x.title && x.summary) : [];
const insights = readList('insights').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
// Customer logos: show entries that have both a customer name and a valid image URL.
const clientReferences = fs.existsSync('content/clients')
  ? readList('clients')
      .filter(c => String(c.name||'').trim() &&
        typeof c.logo === 'string' && (/^\/(?!\/)/.test(c.logo) || /^https:\/\//i.test(c.logo)))
      .sort((a,b) => (Number(a.order)||999) - (Number(b.order)||999) || String(a.name).localeCompare(String(b.name)))
  : [];

const e = (value='') => String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const safeImg = val => (typeof val==='string' && (/^\/(?!\/)/.test(val)||/^https:\/\//i.test(val))) ? e(val) : '';
const aboutPhoto = (key, fallback='') => {
  const value = aboutSettings[key];
  return typeof value === 'string' && safeImg(value) ? value : fallback;
};
const aboutGallery = (key, fallback=[]) => {
  const value = Array.isArray(aboutSettings[key]) ? aboutSettings[key] : fallback;
  return value.filter(source => typeof source === 'string' && safeImg(source));
};
const certificates = fs.existsSync('content/certificates') ? readList('certificates') : [];
let optimizedImages = new Map();
const img = (data, alt, cls='') => {
  if (!safeImg(data)) return '';
  const variant = optimizedImages.get(data);
  const priority = cls === 'hero-image';
  const gallery = cls === 'equipment-gallery-photo' || cls === 'certificate-gallery-photo';
  const chosen = variant ? (gallery ? variant.small : variant.large) : data;
  const responsive = variant && variant.small !== variant.large
    ? ` srcset="${safeImg(variant.small)} 720w, ${safeImg(variant.large)} 1500w" sizes="${priority ? '100vw' : gallery ? '(max-width: 700px) 100vw, 420px' : '(max-width: 800px) 100vw, 900px'}"`
    : '';
  const dimensions = variant ? ` width="${variant.width}" height="${variant.height}"` : '';
  return `<img class="${e(cls)}" src="${safeImg(chosen)}"${responsive}${dimensions} alt="${e(alt)}" loading="${priority ? 'eager' : 'lazy'}" decoding="async"${priority ? ' fetchpriority="high"' : ''}>`;
};
const htmlbody = html => String(html||''); // CMS content is maintained by trusted repository editors.
// Insert CMS-uploaded photos after separate article sections without rewriting the rich text.
const articleBody = item => {
  const html = htmlbody(item.body);
  const photos = [item.inlineImage, item.inlineImage2]
    .map((source, i) => ({ source, index: i }))
    .filter(({ source }) => safeImg(source));
  if (!photos.length) return html;
  const figure = ({ source, index }) => `<figure class="article-inline-figure">${img(source, `${item.title} — supporting image ${index + 1}`, 'article-inline-photo')}</figure>`;
  const headingMatches = [...html.matchAll(/<h([2-4])\b[^>]*>[\s\S]*?<\/h\1\s*>/gi)];
  const positions = [];
  if (!headingMatches.length) {
    const firstParagraphEnd = /<\/p\s*>/i.exec(html);
    positions.push(firstParagraphEnd ? firstParagraphEnd.index + firstParagraphEnd[0].length : html.length);
    positions.push(html.length);
  } else {
    const level = Number(headingMatches[0][1]);
    const sections = headingMatches.filter(m => Number(m[1]) <= level);
    positions.push(sections[1]?.index ?? html.length);
    positions.push(sections[2]?.index ?? html.length);
  }
  // Insert from the back so earlier character offsets remain valid.
  return photos.map(p => ({ ...p, at: positions[p.index] }))
    .sort((a, b) => b.at - a.at || b.index - a.index)
    .reduce((body, photo) => body.slice(0, photo.at) + figure(photo) + body.slice(photo.at), html);
};
const legacyCatalogUrl = val => { try { const u = new URL(String(val || '')); return u.protocol === 'https:' && u.hostname === 'tyceqt.com' ? e(u.href) : ''; } catch { return ''; } };
const catalogEntries = it => [
  {url:legacyCatalogUrl(it.catalogUrl),label:e(it.catalogLabel || it.title)},
  {url:legacyCatalogUrl(it.catalogUrl2),label:e(it.catalogLabel2 || it.title)}
].filter(entry => entry.url);
const legacyCategoryLinks = items => { const links=items.flatMap(catalogEntries);return links.length ? '<div style="margin-top:30px"><h3 style="font-size:19px;margin-bottom:12px">More equipment examples</h3><div style="display:flex;gap:12px;flex-wrap:wrap">'+links.map(entry => '<a class="btn btn-light" target="_blank" rel="noopener noreferrer" href="'+entry.url+'">'+entry.label+' ↗</a>').join('')+'</div></div>' : ''; };
const legacyDetailLinks = it => {const entry=catalogEntries(it)[0];return entry ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:30px"><a class="btn btn-light" target="_blank" rel="noopener noreferrer" href="'+entry.url+'">View More Equipment Examples ↗</a></div>' : '';};
const equipmentRelated = {
  'pressure-vessels': [
    {url:'/solutions/modular-process-systems/',title:'Modular Process Systems',description:'See how vessels can fit into a defined process package.'},
    {url:'/insights/pressure-vessel-rfq-checklist/',title:'Pressure Vessel RFQ Checklist',description:'Prepare the key information needed for a useful quotation.'},
    {url:'/equipment/reactors/',title:'Chemical Reactors',description:'Explore vessel configurations for mixing, reaction and temperature-control duties.'}
  ],
  'heat-exchangers': [
    {url:'/solutions/thermal-process-packages/',title:'Thermal Process Packages',description:'Explore integrated heating, cooling and condensation equipment.'},
    {url:'/insights/heat-exchanger-data-sheet-guide/',title:'Heat Exchanger Data Sheet Guide',description:'Review the core process inputs for an exchanger inquiry.'},
    {url:'/equipment/evaporators/',title:'Evaporators & Crystallizers',description:'Explore equipment for concentration and thermal-processing duties.'}
  ],
  'reactors': [
    {url:'/solutions/thermal-process-packages/',title:'Thermal Process Packages',description:'Connect reactor temperature-control needs with related equipment.'},
    {url:'/solutions/modular-process-systems/',title:'Modular Process Systems',description:'Review options for integrating vessels and selected auxiliaries.'},
    {url:'/equipment/pressure-vessels/',title:'Pressure Vessels',description:'Review vessel construction, materials and design-code requirements.'}
  ],
  'towers-and-columns': [
    {url:'/solutions/separation-and-conditioning/',title:'Separation & Conditioning',description:'Explore equipment for industrial separation services.'},
    {url:'/solutions/modular-process-systems/',title:'Modular Process Systems',description:'Review package interfaces and auxiliary equipment options.'},
    {url:'/equipment/heat-exchangers/',title:'Heat Exchangers',description:'Explore condensers, coolers and reboilers associated with column duties.'}
  ],
  'separators': [
    {url:'/solutions/separation-and-conditioning/',title:'Separation & Conditioning',description:'Explore gas, liquid and multiphase separation applications.'},
    {url:'/solutions/modular-process-systems/',title:'Modular Process Systems',description:'See options for integrating separation equipment into packages.'},
    {url:'/equipment/pressure-vessels/',title:'Pressure Vessels',description:'Review pressure-containing vessel design and fabrication requirements.'}
  ],
  'evaporators': [
    {url:'/solutions/thermal-process-packages/',title:'Thermal Process Packages',description:'Explore related heat-transfer and evaporation equipment.'},
    {url:'/solutions/modular-process-systems/',title:'Modular Process Systems',description:'Review integrated equipment and utility interfaces.'},
    {url:'/equipment/heat-exchangers/',title:'Heat Exchangers',description:'Explore heat-transfer equipment used in evaporation and condensation duties.'}
  ]
};
// Visible buyer FAQs for key equipment families; no unverified technical guarantees.
const equipmentFAQs = {
  'pressure-vessels': [
    ['What information is required for a pressure vessel quotation?', 'Please provide the equipment service, medium, design pressure and temperature, capacity, materials, applicable design code, inspection requirements and drawings when available.'],
    ['Can vessels be customized for different projects?', 'Yes. Vessel configuration, material, connections and documentation are reviewed against the project-specific specification.'],
    ['How are inspection requirements agreed?', 'Examination, testing, witnessing and the manufacturing documentation package are confirmed during technical review and quotation.']
  ],
  'heat-exchangers': [
    ['What process data are needed to select a heat exchanger?', 'Please provide fluid properties, flow rates, inlet and outlet temperatures, pressure conditions, allowable pressure drops and any fouling considerations.'],
    ['Can heat exchanger materials and configurations be customized?', 'Equipment configuration and material selection are evaluated against the process duty, operating conditions and applicable standards.'],
    ['Can related thermal equipment be discussed as a package?', 'Yes. Related condensers, coolers and associated equipment can be reviewed as part of a defined project scope.']
  ],
  'reactors': [
    ['What information is needed for a chemical reactor inquiry?', 'Please provide reaction medium, capacity, pressure, temperature, mixing requirements, heating or cooling method and applicable specifications.'],
    ['Can reactor designs include jackets or coils?', 'Jackets, coils and agitation arrangements can be reviewed where required by the process and mechanical design.'],
    ['Are reactor design and manufacturing requirements project-specific?', 'Yes. The final configuration depends on the approved process data, materials, applicable code and agreed scope.']
  ],
  'towers-and-columns': [
    ['What information is needed for a process tower quotation?', 'Please provide the separation duty, feed and product conditions, operating pressure and temperature, material requirements and available process data.'],
    ['Can towers be supplied with internals?', 'The scope of internals, supports, nozzles and accessories can be discussed based on the technical specification.'],
    ['How are transport limitations considered?', 'Shipping dimensions, lifting arrangements and possible sectional fabrication are reviewed for each project.']
  ],
  'separators': [
    ['What data are needed for a separator inquiry?', 'Please provide the fluids, phase flow rates, operating conditions, separation target, design conditions and applicable codes.'],
    ['Can separator internals be included?', 'Internals and their performance requirements are reviewed against the specified separation duty and project scope.'],
    ['Can separation equipment be integrated into a skid?', 'Skid integration can be evaluated when piping, instrumentation, utilities and battery limits are defined.']
  ],
  'evaporators': [
    ['What data are needed for an evaporator or crystallizer inquiry?', 'Please provide feed composition and flow, target concentration or product specification, operating pressure, temperature limits, utilities and fouling or crystallization concerns.'],
    ['Can the evaporation configuration be tailored to the process?', 'The configuration can be evaluated against process properties, thermal duty, material selection and energy requirements.'],
    ['Can related equipment be included?', 'Associated heat exchangers, condensers, vessels and package interfaces can be discussed according to the agreed scope.']
  ]
};
const equipmentFAQMarkup = it => {
  const rows = equipmentFAQs[it.slug] || [];
  if (!rows.length) return '';
  return '<section class="equipment-faq" aria-label="Frequently asked questions"><h2>Frequently Asked Questions</h2>'
    + rows.map(([question,answer]) => '<h3>'+e(question)+'</h3><p>'+e(answer)+'</p>').join('')
    + '</section>';
};
const equipmentRelatedLinks = it => {
  const links = equipmentRelated[it.slug] || [];
  if (!links.length) return '';
  return '<section class="related-content"><h2>Related Equipment, Solutions &amp; Resources</h2><div class="related-content-grid">' + links.map(link => '<a class="related-content-card" href="' + e(link.url) + '"><strong>' + e(link.title) + '</strong><span>' + e(link.description) + '</span></a>').join('') + '</div></section>';
};

// Descriptive alt text for verified factory photos; keyed by file path so CMS gallery order can change.
const galleryAltText = {
  '/media/03-three-tube-exchanger-assemblies.jpg': 'Three compact heat exchanger assemblies with flanged connections at Tongyang workshop',
  '/media/05-shipment-protected-exchanger-units.jpg': 'Multiple heat exchanger units wrapped for shipment at Tongyang manufacturing yard',
  '/media/06-large-horizontal-exchanger-units.jpg': 'Large horizontal heat exchanger units manufactured by Tongyang',
  '/media/01-tongyang-pressure-vessel-front-clean.jpg': 'Large fabricated horizontal pressure vessel with flanged connections at Tongyang factory',
  '/media/02-tongyang-pressure-vessel-angle-clean.jpg': 'Fabricated horizontal pressure vessel and industrial equipment outside Tongyang workshop',
  '/media/tongyangoldequipment01originallogo.jpg': 'Large process vessel alongside smaller fabricated equipment in Tongyang yard',
  '/media/tongyangoldequipment02originallogo.jpg': 'Industrial process equipment and cylindrical storage vessels at Tongyang yard',
  '/media/tycerealphotoexactlogo.jpg': 'Large horizontal fabricated industrial process vessel with flanges at Tongyang factory',
  '/media/tongyangimage2naturalcolororiginallogo.jpg': 'Industrial process vessels and connecting equipment in Tongyang factory yard',
  '/media/03-large-industrial-column.jpg': 'Large fabricated industrial process column at Tongyang factory',
  '/media/02-horizontal-process-vessel.jpg': 'Horizontal fabricated process vessel with bolted connections in Tongyang workshop',
  '/media/tongyangcoilvesselcleanoriginallogo-1.png': 'Industrial vessel with external pipe coils fabricated at Tongyang workshop'
};
const equipmentGallery = (item) => {
  const photos = Array.isArray(item.gallery)
    ? item.gallery.filter(src => safeImg(src)).slice(0, 6)
    : [];

  if (!photos.length) return '';

  return `
    <section class="equipment-gallery">
      <h2>Equipment Photo Gallery</h2>
      <div class="equipment-gallery-grid">
        ${photos.map((src, i) => `
          <a href="${safeImg(src)}" target="_blank" rel="noopener noreferrer">
            ${img(src, galleryAltText[src] || `${item.title} equipment manufacturing photo ${i + 1} at Tongyang`, 'equipment-gallery-photo')}
          </a>
        `).join('')}
      </div>
    </section>`;
};
const link = (href,text,cls='')=>`<a href="${href}" class="${cls}">${e(text)}</a>`;
const arrow = `<span aria-hidden="true">↗</span>`;
const logo = `<a class="brand" href="/" aria-label="Tongyang Process home"><img src="/media/tongyang-logo.png" alt="" style="height:44px;width:auto;max-width:75px;object-fit:contain"><span class="brandword"><strong>TONGYANG</strong><small>CHEMICAL EQUIPMENT CO., LTD.</small></span></a>`;
const navLinks=[['/projects/','Projects'],['/equipment/','Equipment'],['/quality/','Manufacturing & Quality'],['/insights/','Insights'],['/about/','About']];
const nav = current => `<div class="topbar"><div class="container"><span>${e(site.company)} · ${e(site.location)}</span><span>ENGINEERED EQUIPMENT & INTEGRATED SYSTEMS</span></div></div><header class="header"><div class="container header-inner">${logo}<button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-nav-toggle>☰</button><nav class="nav" data-site-nav aria-label="Primary navigation">${navLinks.map(([url,t])=>`<a href="${url}"${current===url?' aria-current="page"':''}>${t}</a>`).join('')}<a href="/contact/" class="nav-cta" ${current==='/contact/'?'aria-current="page"':''}>Request a Quote ↗</a></nav></div></header>`;
const footer=()=>`<footer class="footer"><div class="container"><div class="footer-grid"><div>${logo}<p style="max-width:340px;margin-top:22px">Custom process equipment, engineering support and integrated industrial solutions.</p><p>${e(site.company)}<br>${e(site.location)}</p></div><div><h4>Explore</h4><div class="footer-links">${[...navLinks,['/contact/','Contact / RFQ']].map(([h,t])=>link(h,t)).join('')}<a href="https://yz-tongyang.en.made-in-china.com/" target="_blank" rel="noopener noreferrer">Made-in-China · Equipment ↗</a><a href="https://tongyang-epcm-china.en.made-in-china.com/" target="_blank" rel="noopener noreferrer">Made-in-China · EPC &amp; Process Solutions ↗</a></div></div><div><h4>Get in touch</h4><div class="footer-links"><a href="mailto:${e(site.email)}">${e(site.email)}</a><a href="tel:${e(site.phone.replace(/[^0-9+]/g,''))}">${e(site.phone)}</a><p>${e(site.legalNotice)}</p></div></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(site.company)}. All rights reserved.</span><span>Process engineering · Equipment · Integrated systems</span></div></div></footer>`;
const organizationJSONLD=JSON.stringify({'@context':'https://schema.org','@type':'Organization','name':site.company,'url':BASE,'email':site.email,'telephone':site.phone,'address':{'@type':'PostalAddress','addressLocality':'Yangzhou','addressRegion':'Jiangsu','addressCountry':'CN'}}).replace(/</g,'\\u003c');
// Product-detail pages describe made-to-order industrial equipment, not priced retail offers.
// Use descriptive WebPage schema instead of Product rich-result markup that requires
// genuine offers or reviews. Keep the separate breadcrumb schema unchanged.
const productSchema = (item,url) => {
  const description = item.seoDescription || item.summary;
  const data = {
    '@context':'https://schema.org',
    '@type':'WebPage',
    name:item.title,
    description,
    url:BASE + url,
    about:{'@type':'Thing',name:item.title,description},
    publisher:{'@type':'Organization',name:site.company,url:BASE}
  };
  if (typeof item.image === 'string' && /^\/(?!\/)/.test(item.image)) data.primaryImageOfPage = {'@type':'ImageObject',url:BASE + item.image};
  return '<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';
};
const breadcrumbJSONLD = (url, title, breadcrumbName='') => {
  const parts = String(url || '/').split('/').filter(Boolean);
  if (!parts.length) return '';
  const labels = {equipment:'Process Equipment',solutions:'Process Solutions',insights:'Insights',manufacturing:'Manufacturing',quality:'Quality',projects:'Projects',about:'About',contact:'Contact','towers-and-columns':'Towers & Columns','pressure-vessels':'Pressure Vessels','heat-exchangers':'Heat Exchangers',reactors:'Chemical Reactors',separators:'Process Separators',evaporators:'Evaporators & Crystallizers'};
  const items = [{name:'Home',item:BASE+'/' }];
  let route = '';
  parts.forEach((part,index) => {
    route += '/' + part + '/';
    const label = index === parts.length - 1
      ? (breadcrumbName || String(title || '').split('|')[0].trim())
      : (labels[part] || part.replace(/-/g,' ').replace(/(^|\s)\S/g,match=>match.toUpperCase()));
    items.push({name:label,item:BASE+route});
  });
  return JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:item.item}))}).replace(/</g,'\\u003c');
};
const breadcrumbMarkup = (url,title,name='') => url !== '/' ? '<script type="application/ld+json">'+breadcrumbJSONLD(url,title,name)+'</script>' : '';
const shell = ({title,description,url='/',current='',body,noindex=false,breadcrumbName='',structuredData=''}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="msvalidate.01" content="CB77E60D240942FFC1852B01C16D1AD7"><meta name="theme-color" content="#102838"><title>${e(title)}</title><meta name="description" content="${e(description||'')}">${noindex?'<meta name="robots" content="noindex,follow">':''}<link rel="canonical" href="${BASE}${url}"><link rel="icon" href="/assets/tongyang-favicon-white.png" type="image/png"><link rel="stylesheet" href="/assets/style.css?v=20261120-about-photo-cms-v2"><meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description||'')}"><meta property="og:url" content="${BASE}${url}"><meta property="og:image" content="${BASE}${safeImg(site.heroImage)||'/assets/tongyang-favicon-white.png'}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(description||'')}"><meta name="twitter:image" content="${BASE}${safeImg(site.heroImage)||'/assets/tongyang-favicon-white.png'}"><script type="application/ld+json">${organizationJSONLD}</script>${!noindex ? breadcrumbMarkup(url,title,breadcrumbName) : ''}${structuredData}</head><body><a class="skip-link" href="#main">Skip to content</a>${nav(current)}<main id="main">${body}</main>${footer()}<script src="/assets/site.js" defer></script></body></html>`;
const pageHero=(eyebrow,title,summary,crumbs=[])=>`<section class="page-hero"><div class="container"><div class="breadcrumb"><a href="/">Home</a>${crumbs.map(c=>` / ${c}`).join('')}</div><div class="eyebrow">${e(eyebrow)}</div><h1>${e(title)}</h1><p>${e(summary)}</p></div></section>`;
const blueprint = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 440" aria-hidden="true"><defs><linearGradient id="v" x2="0" y2="1"><stop stop-color="#a8d6d1" stop-opacity=".22"/><stop offset="1" stop-color="#e2f2ef" stop-opacity=".02"/></linearGradient></defs><g stroke="#9bcacb" fill="none" stroke-width="1.6" opacity=".8"><path stroke-dasharray="4 8" d="M0 343H550 M50 0V440 M500 0V440"/><rect x="102" y="92" width="104" height="262" rx="49" fill="url(#v)"/><path d="M102 122 Q153 155 206 122 M102 312 Q155 285 206 312"/><path d="M118 92V70H189V92M118 354V367H189V354"/><path d="M153 70V37H238V61H305"/><circle cx="305" cy="61" r="5"/><path d="M206 190H277V105H356V80"/><path d="M206 266H254V338H355"/><rect x="345" y="80" width="112" height="258" rx="10" fill="url(#v)"/><path d="M362 101V316M377 101V316M393 101V316M409 101V316M425 101V316M440 101V316" stroke-width="1"/><path d="M345 115H457 M345 302H457"/><path d="M356 80V50H482V122H457 M355 338V373H476V302H457"/><path d="M54 190H102M457 210H523M254 338V390H333"/><circle cx="333" cy="390" r="5"/><circle cx="55" cy="190" r="4"/><circle cx="522" cy="210" r="4"/><path d="M153 65h40 M135 110h36 M132 335h46" stroke-width="1"/></g><g fill="#dcf1ee" font-family="monospace" font-size="10" opacity=".7"><text x="60" y="175">V-101</text><text x="366" y="69">E-201</text><text x="263" y="409">P&amp;ID · SCHEMATIC</text></g><path d="M6 420H540" stroke="#81c4c1" stroke-opacity=".35"/></svg>`;
const card = (item,section,i)=>`<a class="card" href="${e(item.href || `/${section}/${item.slug}/`)}"><div class="card-top" data-i="${i%4}"><div class="geometry"></div>${img(item.image,item.title)}</div><div class="card-content"><span class="card-label">${e(item.category||'Technical insight')}</span><h3>${e(item.title)}</h3><p>${e(item.summary)}</p><span class="arrow-link">Explore details ${arrow}</span></div></a>`;
const cards = (items, section)=>`<div class="cards">${items.map((it,i)=>card(it,section,i)).join('')}</div>`;
// Homepage application areas describe the industries Tongyang serves, not equipment categories.
const applicationAreas = [
  {slug:'chemical-processing',title:'CHEMICAL PROCESSING',category:'',summary:'',image:'https://images.pexels.com/photos/8325721/pexels-photo-8325721.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/projects/industrial-chemical-process-tower-and-column-project/'},
  {slug:'oil-gas-processing',title:'OIL & GAS PROCESSING',category:'',summary:'',image:'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Petroleum_sample.jpg/960px-Petroleum_sample.jpg',href:'/equipment/separators/'},
  {slug:'fertilizer-agrochemical',title:'FERTILIZER & AGROCHEMICAL',category:'',summary:'',image:'https://images.pexels.com/photos/25974981/pexels-photo-25974981.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/equipment/pressure-vessels/'},
  {slug:'polymer-resin',title:'POLYMER & RESIN',category:'',summary:'',image:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Plastic_pellets_for_injection_molding.jpg/960px-Plastic_pellets_for_injection_molding.jpg',href:'/projects/batf-group-chemical-production-facility-project/'},
  {slug:'energy-industrial-gas',title:'ENERGY & INDUSTRIAL GAS',category:'',summary:'',image:'https://images.pexels.com/photos/39785070/pexels-photo-39785070.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/equipment/heat-exchangers/'},
  {slug:'water-environmental',title:'WATER & ENVIRONMENTAL',category:'',summary:'',image:'https://images.pexels.com/photos/7298554/pexels-photo-7298554.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/projects/water-supply-wastewater-zld-epc-support/'},
  {slug:'pharmaceutical-processing',title:'PHARMACEUTICAL PROCESSING',category:'',summary:'',image:'https://images.pexels.com/photos/37650270/pexels-photo-37650270.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/equipment/reactors/'},
  {slug:'food-processing',title:'FOOD PROCESSING',category:'',summary:'',image:'https://images.pexels.com/photos/5953688/pexels-photo-5953688.jpeg?auto=compress&cs=tinysrgb&w=900',href:'/equipment/heat-exchangers/'}
];
// Products belong to one of the six equipment families; legacy products may only have a category label.
const productParentSlug = item => {
  const parent = String(item.parentCategory || '').trim();
  if (equipment.some(cat => cat.slug === parent)) return parent;
  const label = String(item.category || '').trim().toLowerCase();
  return equipment.find(cat => cat.title.toLowerCase() === label)?.slug || '';
};
const productPath = item => {
  // Keep this previously published address stable while new products use category-based URLs.
  if (item.slug === 'industrial-gas-accumulator') return `/products/${item.slug}/`;
  const parent = productParentSlug(item);
  return parent ? `/equipment/${parent}/${item.slug}/` : `/products/${item.slug}/`;
};
const categoryProducts = category => {
  const list = products.filter(item => productParentSlug(item) === category.slug);
  if (!list.length) return '';
  const entries = list.map(item => ({...item, href:productPath(item)}));
  return `<section class="category-product-list" aria-label="Products in ${e(category.title)}"><h2>Products in ${e(category.title)}</h2><p>Browse equipment examples in this category. Specifications and scope are confirmed for each project.</p>${cards(entries, 'equipment')}</section>`;
};
// Render a responsive logo gallery once there are image entries.
const clientSection = () => !clientReferences.length ? '' : `<section class="client-section" aria-labelledby="clients-heading"><div class="container"><div class="client-head"><div><span class="eyebrow">OUR EXPERIENCE</span><h2 id="clients-heading">${e(site.clientsHeading || 'Selected Customer References')}</h2><p>${e(site.clientsDescription || 'Selected customers and project partners from our industrial experience.')}</p></div>${site.clientsMore === true ? '<a class="client-more" href="/projects/">View more →</a>' : ''}</div><div class="client-grid">${clientReferences.map(c => `<div class="client-tile"><img src="${safeImg(c.logo)}" alt="${e(c.name)}" loading="lazy" decoding="async" title="${e(c.name)}"></div>`).join('')}</div></div></section>`;

function write(url,markup){const sub=url==='/'?'':url.replace(/^\//,'');const folder=path.join(dist,sub);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'index.html'),markup);urls.push(url);}
let urls=[];
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});fs.cpSync('assets',path.join(dist,'assets'),{recursive:true});fs.cpSync('public',dist,{recursive:true});
fs.writeFileSync(path.join(dist,'_redirects'),'/manufacturing/ /quality/ 301\\n');
optimizedImages = await optimizeMedia(path.join(root, 'public/media'), path.join(dist, 'media'));


const home = `<section class="hero">${site.heroImage ? img(site.heroImage,'Tongyang manufacturing facilities','hero-image'):''}<div class="container hero-inner"><div><div class="eyebrow">${e(site.heroEyebrow)}</div><h1>${e(site.heroTitle)}</h1><p>${e(site.heroDescription)}</p><div class="cta-row"><a class="btn btn-primary" href="/contact/">Discuss your project ↗</a><a class="btn btn-outline" href="/projects/">Projects &amp; solutions →</a></div></div><div class="hero-visual">${blueprint}<div class="hero-micro">Process · Design · Fabrication</div></div></div></section><section class="dark-strip"><div class="container strip-inner"><div><strong>Established ${e(site.since)}</strong><span>Manufacturing experience</span></div><div><strong>Project-specific engineering</strong><span>Built around approved specifications</span></div><div><strong>International project focus</strong><span>Industrial and EPC supply</span></div></div></section><section class="section application-section"><div class="container"><div class="section-head"><div><span class="eyebrow">TYPICAL APPLICATION AREAS</span><h2>Industries We Serve</h2></div><p>Project-specific process equipment, engineering coordination and manufacturing support for a range of industrial sectors. The applicable scope is established for each project.</p></div>${cards(applicationAreas,'solutions')}<p class="industry-credit">Polymer pellet image: <a href='https://commons.wikimedia.org/wiki/File:Plastic_pellets_for_injection_molding.jpg' target='_blank' rel='noopener'>Teemeah / Wikimedia Commons</a>, licensed under <a href='https://creativecommons.org/licenses/by-sa/3.0/' target='_blank' rel='noopener'>CC BY-SA 3.0</a> (cropped).</p></div></section><section class="feature"><div class="feature-visual"><div class="feature-photo">${img(site.manufacturingImage || "/media/tongyangfactorycorrectoriginallogo-1.jpg","Tongyang factory yard and equipment manufacturing facilities")}</div></div><div class="feature-text"><span class="eyebrow" style="color:#82cfc6">MANUFACTURING CAPABILITY</span><h2>Engineering Excellence. Manufacturing Strength.</h2><p>From engineering review and material selection to fabrication, inspection and documentation, Tongyang delivers project-specific industrial equipment built around customer requirements.</p><ul><li>Pressure Vessel &amp; Equipment Fabrication</li><li>Welding &amp; Manufacturing Control</li><li>Inspection, Testing &amp; Quality Assurance</li><li>Engineering Documentation &amp; Traceability</li></ul><a class="btn btn-primary" href="/quality/" style="align-self:flex-start">Explore Manufacturing &amp; Quality ↗</a></div></section><section class="section section-muted"><div class="container"><div class="section-head"><div><span class="eyebrow">PRODUCT FAMILIES</span><h2>Equipment engineered for your process.</h2></div><p>Custom-built equipment covering a wide variety of duties, materials and applicable design requirements.</p></div>${cards(equipment.slice(0,6),'equipment')}<p style="text-align:center;margin:35px 0 0"><a class="btn btn-light" href="/equipment/">Browse equipment →</a></p><p style="text-align:center;margin:15px 0 0"><a class="arrow-link" href="https://tyceqt.com/" target="_blank" rel="noopener noreferrer">See additional product examples on our established English website ↗</a></p></div></section><section class="section"><div class="container"><div class="section-head"><div><span class="eyebrow">KNOWLEDGE CENTER</span><h2>Practical engineering insight.</h2></div><p>Guidance for preparing technical inquiries and specifying industrial equipment.</p></div>${cards(insights.slice(0,3),'insights')}</div></section>${clientSection()}<section class="section-tight"><div class="container"><div class="note-banner"><div><h3>Have a process or equipment requirement?</h3><p>Send us your data sheet or outline your project; we will review a suitable scope.</p></div><a class="btn btn-primary" href="/contact/">Start an inquiry ↗</a></div></div></section>`;
write('/',shell({title:site.seoTitle,description:site.seoDescription,url:'/',body:home}));

const micShowrooms = section => {
  if (!['equipment','solutions'].includes(section)) return '';
  const shops = section==='equipment' ? [
    ['https://yz-tongyang.en.made-in-china.com/','EQUIPMENT','Equipment Manufacturing Store','Vessels, exchangers, reactors and custom equipment.'],
    ['https://tongyang-epcm-china.en.made-in-china.com/','EPC & PROCESS','EPC & Process Solutions Store','Skid packages and process equipment solutions.']
  ] : [
    ['https://tongyang-epcm-china.en.made-in-china.com/','EPC & PROCESS','EPC & Process Solutions Store','Skid packages and process equipment solutions.']
  ];
  return '<div class="mic-showrooms"><div class="mic-heading"><span class="eyebrow">ADDITIONAL B2B SHOWROOMS</span><h2>Our Made-in-China Stores</h2></div><div class="mic-grid">'+shops.map(([url,kicker,name,desc])=>'<a class="mic-card" href="'+url+'" target="_blank" rel="noopener noreferrer"><span class="mic-kicker">'+e(kicker)+'</span><strong>'+e(name)+'</strong><span class="mic-description">'+e(desc)+'</span><span class="mic-cta">VISIT STORE ↗</span></a>').join('')+'</div></div>';
};
const index = (title,eyebrow,summary,items,section) => `${pageHero(eyebrow,title,summary,[e(title)])}<section class="section"><div class="container">${micShowrooms(section)}${section==='equipment'?'<div style="margin:0 0 28px"><a class="btn btn-light" href="/products/">Browse All Products ↗</a></div>':''}${cards(items,section)}${section==='equipment'||section==='solutions'?legacyCategoryLinks(items):''}${section==='equipment'?'<div class="note-banner" style="margin-top:38px"><div><h3>Looking for more product examples?</h3><p>Explore additional equipment descriptions and product models on Tongyang\'s established English website.</p></div><a class="btn btn-light" href="https://tyceqt.com/" target="_blank" rel="noopener noreferrer">View extended product catalog ↗</a></div>':''}</div></section><section class="section-tight section-muted"><div class="container"><div class="note-banner"><div><h3>Looking for a project-specific configuration?</h3><p>We can discuss your technical basis, equipment scope and fabrication requirements.</p></div><a href="/contact/" class="btn btn-primary">Send an inquiry ↗</a></div></div></section>`;
write('/solutions/',shell({title:'Process Solutions | Tongyang Process',description:'Explore modular process systems, thermal process packages and separation solutions supported by Tongyang manufacturing.',url:'/solutions/',current:'/solutions/',body:index('Process Solutions','FROM EQUIPMENT TO SYSTEMS','Project-specific mechanical equipment and integrated packages designed around defined process requirements.',solutions,'solutions')}));
write('/equipment/',shell({title:'Process Equipment | Tongyang Process',description:'Explore industrial vessels, heat exchangers, reactors, towers, evaporators and separators from Tongyang Process.',url:'/equipment/',current:'/equipment/',body:index('Process Equipment','OUR PRODUCT PORTFOLIO','From pressure vessels to integrated process equipment, we support custom fabrication for diverse industrial duties.',equipment,'equipment')}));
// Dedicated catalog entry for products uploaded through the Products CMS collection.
// Keep equipment-family pages and existing detail URLs unchanged.
const productDirectoryGroups = equipment.map(family => ({
  family,
  items:products.filter(item => productParentSlug(item) === family.slug)
})).filter(group => group.items.length);
const uncategorizedProducts = products.filter(item => !productParentSlug(item));
const productCatalogBody = `${pageHero('PRODUCT CATALOG','Industrial Equipment Products','Browse the individual product pages added to our equipment catalog. Product configurations are subject to project-specific specifications.',['Products'])}<section class="section"><div class="container">${productDirectoryGroups.map(({family,items}) => `<section style="margin-bottom:52px"><div class="section-head"><div><span class="eyebrow">EQUIPMENT CATEGORY</span><h2>${e(family.title)}</h2></div><a class="arrow-link" href="/equipment/${e(family.slug)}/">Explore category ↗</a></div>${cards(items.map(item=>({...item,href:productPath(item)})),'equipment')}</section>`).join('')}${uncategorizedProducts.length ? `<section style="margin-bottom:52px"><div class="section-head"><div><span class="eyebrow">OTHER PRODUCTS</span><h2>Additional Equipment Products</h2></div></div>${cards(uncategorizedProducts.map(item=>({...item,href:productPath(item)})),'equipment')}</section>` : ''}${!products.length ? '<p>Product pages will appear here when published.</p>' : ''}</div></section>`;
write('/products/',shell({title:'Industrial Equipment Products | Tongyang Process',description:'Browse individual industrial equipment products from Tongyang, including vessels, reactors, separators, heat exchangers and custom process equipment.',url:'/products/',current:'/products/',body:productCatalogBody}));
write('/insights/',shell({title:'Technical Insights | Tongyang Process',description:'Practical industrial equipment RFQ checklists and engineering procurement insights.',url:'/insights/',current:'/insights/',body:index('Technical Insights','KNOWLEDGE CENTER','Useful guidance for planning specifications, quotations and equipment packages.',insights.map(x=>({...x,category:x.date||'Article'})),'insights')}));

for (const [section,list,current] of [['solutions',solutions,'/solutions/'],['equipment',equipment,'/equipment/'],['insights',insights,'/insights/']]){
 for (const it of list){const url=`/${section}/${it.slug}/`;const label=section==='equipment'?'Process Equipment':section==='solutions'?'Process Solutions':'Technical Insight';const body=`${pageHero(label,it.title,it.summary,[`<a href="/${section}/">${e(label)}</a>`,e(it.title)])}<div class="container detail-wrap"><article class="content-rich">${it.date?`<p class="article-date">Published ${e(it.date)}</p>`:''}${it.image?`<div class="${section === 'insights' ? 'article-cover' : 'detail-image'}">${img(it.image,it.title,section === 'insights' ? 'article-cover-photo' : 'detail-photo')}</div>`:''}${section === 'equipment' ? categoryProducts(it) : ''}${section === 'insights' ? articleBody(it) : htmlbody(it.body)}${section === 'equipment' ? equipmentGallery(it) : ''}${section === 'equipment' ? equipmentRelatedLinks(it) : ''}${section === 'equipment' ? equipmentFAQMarkup(it) : ''}${section === 'equipment' || section === 'solutions' ? legacyDetailLinks(it) : ''}<div class="divider"></div><a href="/${section}/" class="arrow-link">← Back to ${e(label)}</a></article><aside class="aside"><div class="eyebrow" style="color:#27877f">PROJECT INQUIRIES</div><h3>Let's discuss your requirements.</h3><p>Send the intended duty, material, design code and relevant technical data, and our team can review the scope.</p>${section === 'equipment' ? `<a class="btn btn-primary equipment-aside-cta" href="/contact/?equipment=${encodeURIComponent(it.title)}">Request a Quotation ↗</a>` : '<a href="/contact/">Contact our team ↗</a>'}<a href="mailto:${e(site.email)}">${e(site.email)}</a></aside></div>`;write(url,shell({title:it.seoTitle||`${it.title} | Tongyang Process`,description:it.seoDescription||it.summary,url,current,body,breadcrumbName:it.title}));}
}


for (const it of products) {
  const parentSlug = productParentSlug(it);
  const parent = equipment.find(category => category.slug === parentSlug);
  const parentURL = parent ? `/equipment/${parent.slug}/` : '/equipment/';
  const url = productPath(it);
  const crumbs = [`<a href="/equipment/">Process Equipment</a>`, parent ? `<a href="${e(parentURL)}">${e(parent.title)}</a>` : 'Products', e(it.title)];
  const photo = it.image ? `<div class="detail-image">${img(it.image, it.title, 'detail-photo')}</div>` : '';
  const body = `${pageHero('PRODUCT DETAIL',it.title,it.summary,crumbs)}<div class="container detail-wrap"><article class="content-rich">${photo}${htmlbody(it.body)}${equipmentGallery(it)}<div class="divider"></div><a href="${e(parentURL)}" class="arrow-link">← Back to ${e(parent?.title || 'Process Equipment')}</a></article><aside class="aside"><div class="eyebrow" style="color:#27877f">PROJECT INQUIRIES</div><h3>Request a quotation.</h3><p>Send your data sheet, drawing and project requirements for a technical review.</p><a class="btn btn-primary equipment-aside-cta" href="/contact/?equipment=${encodeURIComponent(it.title)}">Request a Quotation ↗</a><a href="mailto:${e(site.email)}">${e(site.email)}</a></aside></div>`;
  write(url,shell({title:it.seoTitle||`${it.title} | Tongyang Process`,description:it.seoDescription||it.summary,url,body,breadcrumbName:it.title,structuredData:productSchema(it,url)}));
}

const manufacturing = `${pageHero('PRODUCTION CAPABILITY','Engineering & Manufacturing','Practical engineering coordination and fabrication support for industrial equipment projects.',['Manufacturing'])}<section class="section"><div class="container"><div class="section-head"><div><span class="eyebrow">MANUFACTURING EXPERIENCE</span><h2>Quality begins before fabrication.</h2></div><p>Clear engineering inputs, approved drawings and traceable materials help keep technical requirements aligned through production.</p></div><div class="spec-grid"><div class="spec-item"><h3>Engineering review</h3><p>Reviewing project specifications, design code, materials and interface requirements.</p></div><div class="spec-item"><h3>Fabrication & assembly</h3><p>Welding and manufacturing plans selected according to the approved drawings.</p></div><div class="spec-item"><h3>Inspection & documentation</h3><p>Documented examinations and testing defined by the contract and applicable code.</p></div></div><div class="divider"></div><div class="simple-grid"><div class="info-tile"><h3>Complex fabricated equipment</h3><p>Pressure vessels, exchangers, reactors, towers and special-purpose mechanical equipment.</p></div><div class="info-tile"><h3>Project coordination</h3><p>Documentation, packing, shipment limits and site-assembly considerations reviewed at an early stage.</p></div></div></div></section>`;
write('/manufacturing/',shell({title:'Manufacturing & Quality | Tongyang Process',description:'Manufacturing and quality information is now consolidated on the Manufacturing & Quality page.',url:'/manufacturing/',current:'/quality/',body:`<section class="section"><div class="container"><h1>Manufacturing &amp; Quality</h1><p>This section has moved to our consolidated Manufacturing &amp; Quality page.</p><a class="button" href="/quality/">View Manufacturing &amp; Quality</a></div></section>`}));
const certificateItems = certificates
  .filter(c => String(c.title || '').trim() && safeImg(c.image))
  .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999) || String(a.title).localeCompare(String(b.title)));
const quality = `${pageHero('MANUFACTURING & QUALITY','Manufacturing, Quality & Certifications','Engineering review, fabrication capability, manufacturing controls and verified company qualifications — presented together in one place.',['Manufacturing & Quality'])}<section class="section"><div class="container"><div class="divider"></div><div class="section-head"><div><span class="eyebrow">01 / ENGINEERING &amp; MANUFACTURING</span><h2>Manufacturing capability</h2></div><p>Practical engineering coordination and fabrication support for industrial equipment projects. Clear engineering inputs, approved drawings and traceable materials help keep technical requirements aligned through production.</p></div><div class="spec-grid"><div class="spec-item"><h3>Engineering review</h3><p>Reviewing project specifications, design code, materials and interface requirements.</p></div><div class="spec-item"><h3>Fabrication &amp; assembly</h3><p>Welding and manufacturing plans selected according to the approved drawings.</p></div><div class="spec-item"><h3>Inspection &amp; documentation</h3><p>Documented examinations and testing defined by the contract and applicable code.</p></div></div><div class="simple-grid" style="margin-top:20px"><div class="info-tile"><h3>Complex fabricated equipment</h3><p>Pressure vessels, exchangers, reactors, towers and special-purpose mechanical equipment.</p></div><div class="info-tile"><h3>Project coordination</h3><p>Documentation, packing, shipment limits and site-assembly considerations reviewed at an early stage.</p></div></div><div class="divider"></div><div class="section-head"><div><span class="eyebrow">02 / AUTHORIZATIONS &amp; LICENSES</span><h2>Manufacturing qualifications</h2></div><p>Key authorizations and licenses relevant to pressure-vessel design and manufacturing are presented for customer qualification reviews.</p></div><div class="certificate-gallery">${certificateItems.length ? certificateItems.map(c => `<article class="certificate-item"><a href="${safeImg(c.image)}" target="_blank" rel="noopener" aria-label="View original ${e(c.title)}">${img(c.image,c.title,'certificate-gallery-photo')}</a><h3>${e(c.title)}</h3>${c.details ? `<p>${e(c.details)}</p>` : ""}</article>`).join("") : '<div class="placeholder-note">Certificate images will appear here when uploaded in CMS.</div>'}</div><div class="divider"></div><div class="section-head"><div><span class="eyebrow">03 / QUALITY CONTROL SYSTEM</span><h2>Manufacturing quality controls</h2></div><p>Coordinated controls support product performance, quality and traceable execution.</p></div><div class="quality-control-grid"><section><span class="eyebrow">TECHNICAL CONTROLS</span><div class="control-list"><article><h3>Design Control</h3><p>Approved technical requirements and design outputs.</p></article><article><h3>Process Control</h3><p>Defined manufacturing procedures and methods.</p></article><article><h3>Material &amp; Component Control</h3><p>Identification, acceptance and traceability.</p></article><article><h3>Heat Treatment Control</h3><p>Specified heat-treatment requirements and records.</p></article><article><h3>Welding Control</h3><p>Qualified procedures, personnel and weld records.</p></article></div></section><section><span class="eyebrow">VERIFICATION &amp; ACCEPTANCE</span><div class="control-list"><article><h3>Laboratory Equipment Control</h3><p>Control of test facilities and laboratory equipment.</p></article><article><h3>Nondestructive Testing</h3><p>Specified NDE examinations and records.</p></article><article><h3>Physical &amp; Chemical Testing</h3><p>Required physical and chemical verification.</p></article><article><h3>Inspection &amp; Test Control</h3><p>Planned inspection, testing and acceptance.</p></article><article><h3>Nonconforming Product Control</h3><p>Identification, disposition and corrective action.</p></article></div></section><section><span class="eyebrow">MANAGEMENT &amp; IMPROVEMENT</span><div class="control-list"><article><h3>Document &amp; Record Control</h3><p>Controlled documents and retained quality records.</p></article><article><h3>Contract Control</h3><p>Review and implementation of agreed requirements.</p></article><article><h3>Production Management</h3><p>Coordinated production activities and interfaces.</p></article><article><h3>Personnel Training</h3><p>Training, competence and personnel management.</p></article><article><h3>Quality Improvement &amp; Service</h3><p>Feedback, improvement and customer service.</p></article></div></section></div><div class="quality-note">Applicable licenses, codes, inspection points, testing scope and records are confirmed against the equipment category, project specification and agreed contract.</div><div class="section-head" style="margin-top:38px"><div><span class="eyebrow">INSPECTION &amp; TRACEABILITY</span><h2>Inspection, testing and documentation</h2></div><p>Quality requirements are translated into project-specific controls covering design inputs, materials, manufacturing, verification, documentation and acceptance.</p></div><div class="simple-grid"><div class="info-tile"><h3>Design &amp; process review</h3><p>Review technical requirements, approved design outputs, manufacturing procedures and applicable acceptance criteria.</p></div><div class="info-tile"><h3>Material &amp; welding records</h3><p>Maintain identification, material traceability, qualified welding procedures and relevant production records.</p></div><div class="info-tile"><h3>Inspection &amp; testing</h3><p>Coordinate specified visual, dimensional, NDE, physical, chemical and pressure tests as applicable.</p></div><div class="info-tile"><h3>Documentation &amp; handover</h3><p>Compile the agreed inspection records, test reports and manufacturing documentation for acceptance.</p></div></div></div></section>`;

write('/quality/',shell({title:'Quality & Manufacturing Control | Tongyang Process',description:'Tongyang Process quality and manufacturing controls covering design, materials, welding, inspection, testing, traceability and documentation.',url:'/quality/',current:'/quality/',body:quality}));
const aboutManufacturingPhotos = aboutGallery('manufacturingGallery', [
  '/media/tongyangimage2naturalcolororiginallogo.jpg',
  '/media/tongyangoldequipment01originallogo.jpg',
  '/media/tongyangoldequipment02originallogo.jpg',
  '/media/03-large-industrial-column.jpg'
]);
const aboutEngineeringPhotos = aboutGallery('engineeringGallery', [
  '/media/01-tongyang-pressure-vessel-front-clean.jpg',
  '/media/02-tongyang-pressure-vessel-angle-clean.jpg'
]);
const aboutInnovationPhotos = aboutGallery('innovationGallery', [
  '/media/tongyanguniversitycooperationphoto1enhanced.jpg',
  '/media/tongyanguniversitycooperationphoto2enhanced.jpg'
]);
const about = `${pageHero('ABOUT TONGYANG','A manufacturing partner for project-specific process equipment.','Yangzhou Tongyang Chemical Equipment Co., Ltd. combines an established manufacturing base with engineering coordination and project-focused equipment supply.',['About'])}
<section class='section about-overview'><div class='container about-intro-grid'><div><span class='eyebrow'>01 / COMPANY OVERVIEW</span><h2>Built on manufacturing experience since 1990.</h2><p>Yangzhou Tongyang Chemical Equipment Co., Ltd. is a China-based manufacturer of custom industrial process equipment. Through project-specific fabrication and engineering coordination, Tongyang supports customers and project partners with pressure vessels, heat exchangers, reactors, towers, storage tanks and related equipment packages.</p><p>Tongyang Process is the company’s international business presentation, providing overseas customers with a clear point of contact for technical enquiries, equipment proposals and project cooperation.</p><div class='about-inline-links'><a class='arrow-link' href='/projects/'>Explore project references ↗</a><a class='arrow-link' href='/quality/'>Manufacturing &amp; quality ↗</a></div></div><figure class='about-intro-photo'>${img(aboutPhoto('overviewImage','/media/tongyangfactorycorrectoriginallogo-1.jpg'),'Tongyang factory exterior and manufacturing site','about-image')}</figure></div></section>
<section class='section section-muted'><div class='container'><div class='section-head'><div><span class='eyebrow'>02 / COMPANY AT A GLANCE</span><h2>A substantial manufacturing base.</h2></div><p>Key site and workforce figures provide an overview of the company’s manufacturing environment. Detailed production capabilities and qualifications are presented separately on the Manufacturing &amp; Quality page.</p></div><div class='about-stats'><article><strong>80,200 <small>m²</small></strong><span>Factory site area</span></article><article><strong>73,900 <small>m²</small></strong><span>Workshop area</span></article><article><strong>9,300 <small>m²</small></strong><span>Testing centre</span></article><article><strong>~300</strong><span>Employees</span></article></div>${aboutPhoto('companyEnvironmentImage') ? `<figure class='about-company-photo'>${img(aboutPhoto('companyEnvironmentImage'),'Tongyang corporate office and reception environment','about-image')}</figure>` : ''}<p class='about-note'>Established in 1990 · Yangzhou, Jiangsu, China</p></div></section>
<section class='section'><div class='container'><div class='section-head'><div><span class='eyebrow'>03 / MANUFACTURING FOUNDATION</span><h2>From material preparation to finished equipment.</h2></div><p>Manufacturing activities are organized around approved drawings, applicable construction codes and project-specific quality requirements.</p></div><div class='about-copy-wide'><p>The manufacturing base brings together material preparation, forming, welding, assembly, inspection, testing and dispatch. Equipment is produced to the agreed technical specification, with manufacturing methods and inspection requirements confirmed for each order.</p><a class='arrow-link' href='/quality/'>View manufacturing capabilities, quality controls &amp; certifications ↗</a></div><div class='about-photo-grid about-photo-grid-four'>${aboutManufacturingPhotos.slice(0,4).map((src,i)=>{const captions=['Factory yard & equipment','Fabricated process vessels','Industrial equipment','Large process columns'];const alts=['Industrial process vessels and equipment in Tongyang factory yard','Large fabricated process vessel in Tongyang manufacturing yard','Industrial equipment and cylindrical vessels at Tongyang','Large fabricated industrial process column at Tongyang factory'];return `<figure>${img(src,alts[i]||'Tongyang manufacturing facility','about-image')}<figcaption>${captions[i]||'Manufacturing facility'}</figcaption></figure>`;}).join('')}</div></div></section>
<section class='section section-muted'><div class='container'><div class='section-head'><div><span class='eyebrow'>04 / ENGINEERING &amp; PROJECT COLLABORATION</span><h2>Clear interfaces. Project-specific responsibilities.</h2></div><p>We work with customers, EPC contractors and engineering partners to align equipment requirements with manufacturing scope.</p></div><div class='about-split'><div><p>Depending on the project, our coordination may cover technical clarification, design inputs, material selection, fabrication feasibility, equipment interfaces, inspection requirements, manufacturing documentation, packing and delivery planning.</p><ul class='about-check-list'><li>Technical specification and code review</li><li>Material and fabrication requirement coordination</li><li>Drawing, nozzle and interface clarification</li><li>Inspection, testing and manufacturing records</li><li>Equipment package and delivery coordination</li></ul><p class='about-scope-note'>Process licensor duties, detailed process design, site construction and commissioning are included only when expressly defined in the agreed project scope.</p></div><div class='about-photo-pair'>${aboutEngineeringPhotos.slice(0,3).map((src,i)=>img(src,i===0?'Large fabricated horizontal pressure vessel with flanged connections at Tongyang factory':'Fabricated horizontal process vessel and industrial equipment outside Tongyang workshop','about-image')).join('')}</div></div></div></section>
<section class='section'><div class='container'><div class='section-head'><div><span class='eyebrow'>05 / INDUSTRIES WE SERVE</span><h2>Equipment for a broad range of industries.</h2></div><p>Our equipment and project support are tailored to the duty, operating conditions, materials and applicable requirements of each industrial application.</p></div><div class='about-industries'>${applicationAreas.map((item,i)=>`<a href='${e(item.href)}'><span>${String(i+1).padStart(2,'0')}</span><strong>${e(item.title)}</strong><b>↗</b></a>`).join('')}</div></div></section>
<section class='section section-muted'><div class='container'><div class='section-head'><div><span class='eyebrow'>06 / INTERNATIONAL BUSINESS</span><h2>Working with customers and project partners worldwide.</h2></div><p>International cooperation is built around clear technical communication, agreed supply boundaries and dependable manufacturing coordination.</p></div><div class='about-split about-international'><div><p>We support overseas customers, engineering companies and EPC partners through project enquiries, technical and commercial clarification, equipment proposals and export supply coordination.</p><p>Depending on the contract, cooperation may include third-party inspection, factory acceptance testing, manufacturing documentation, export packing and shipment planning. Applicable codes, certification responsibilities, inspection scope and delivery terms are confirmed for each project.</p><a class='arrow-link' href='/contact/'>Contact our international sales team ↗</a></div><figure class='about-international-photo'>${img(aboutPhoto('internationalImage','/media/05-shipment-protected-exchanger-units.jpg'),'Industrial equipment prepared for export shipment at Tongyang manufacturing yard','about-image')}</figure></div></div></section>
<section class='section'><div class='container'><div class='section-head'><div><span class='eyebrow'>07 / INNOVATION &amp; DEVELOPMENT</span><h2>Connecting manufacturing experience with technical research.</h2></div><p>Long-term technical development benefits from cooperation between industrial manufacturing and academic research.</p></div><div class='about-split about-innovation'><div><p>Tongyang has established a strategic industry–university cooperation framework with a School of Materials Science and Engineering in Yangzhou. The collaboration focuses on advanced materials, welding and metal-forming technologies, joint laboratory development, industry-oriented talent training and research related to high-end chemical equipment.</p><p>The aim is to connect research capabilities with practical manufacturing challenges and support continuous improvement in equipment technology and production methods.</p></div><div class='about-photo-pair'>${aboutInnovationPhotos.slice(0,2).map((src,i)=>img(src,i===0?'Tongyang strategic cooperation signing with a School of Materials Science and Engineering':'Industry and university representatives at Tongyang technical cooperation event','about-image')).join('')}</div></div></div></section>
<section class='section-tight'><div class='container'><div class='about-cta'><div><span class='eyebrow'>LET’S WORK TOGETHER</span><h2>Have an equipment or project requirement?</h2><p>Share your technical data, drawings or project outline. Our team can review the proposed equipment scope and discuss the next steps.</p></div><a class='btn btn-primary' href='/contact/'>Contact Tongyang ↗</a></div></div></section>`;
write('/about/',shell({title:'About Tongyang | Company, Manufacturing & Project Cooperation',description:'Learn about Yangzhou Tongyang Chemical Equipment Co., Ltd., its manufacturing base, engineering coordination, eight industry sectors, international business and technical collaboration.',url:'/about/',current:'/about/',body:about}));
const projectExecution = `<section class="section section-muted"><div class="container"><div class="section-head"><div><span class="eyebrow">PROJECT EXECUTION &amp; CONTROL</span><h2>Integrated Project Management</h2></div><p>A coordinated framework for planning, execution, safety and quality control—from contract review through delivery and handover. Site activities and commissioning apply where included in the agreed scope.</p></div><div class="execution-flow">${[['01','Contract & Scope Review','Confirm responsibilities, technical requirements and agreed supply boundaries.'],['02','Project Planning','Establish the work breakdown, milestones, resources and execution baseline.'],['03','Execution Coordination','Coordinate the project team, technical interfaces and implementation progress.'],['04','Safety & Quality Control','Apply project-specific HSE arrangements, inspections and quality checks.'],['05','Delivery & Handover','Complete required confirmations, documentation and handover activities.']].map(([n,t,d])=>`<article><span>${n}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div><div class="execution-pillars"><article><span class="eyebrow">01 / PLANNING &amp; PROGRESS</span><h3>Project Coordination &amp; Schedule Control</h3><p>Translate the contract scope into an execution plan, baseline schedule and resource requirements. Coordinate staged, monthly and weekly plans; review progress, identify variances and update activities as required.</p></article><article><span class="eyebrow">02 / HEALTH, SAFETY &amp; ENVIRONMENT</span><h3>HSE Management</h3><p>Apply project-specific safety plans, hazard identification and job safety analysis. Arrange site induction, task-specific briefings, regular safety meetings and work-area inspections according to the contracted site scope.</p></article><article><span class="eyebrow">03 / QUALITY ASSURANCE</span><h3>Quality Control &amp; Inspection</h3><p>Define project quality responsibilities and procedures against contract and technical requirements. Apply pre-, in-process and final checks, inspection reviews and corrective measures. Weld identification and inspection records are maintained where required by the specification.</p></article></div></div></section>`; 
const projectsPage = `${pageHero('PROJECT REFERENCES','Selected Industrial Projects','Explore Tongyang’s selected industrial project experience, including equipment manufacturing, engineering coordination and project-specific supply scopes.',['Projects'])}<section class="section"><div class="container"><div class="section-head"><div><span class="eyebrow">01 / PROJECT REFERENCES</span><h2>Industrial project experience</h2></div><p>Tongyang supports project partners through custom pressure vessels, tanks, heat exchangers and related industrial equipment. Actual participation and supply scope depend on individual contracts and technical specifications.</p></div>${projects.length ? cards(projects,'projects') : '<div class="placeholder-note"><strong>Project reference details are being prepared.</strong>Public project profiles will appear here after equipment scope and disclosure details have been reviewed.</div>'}<p style="margin-top:30px"><a class="btn btn-light" href="/contact/">Request suitable manufacturing references ↗</a></p></div></section>${projectExecution}`;
// Project images use a responsive grid without changing other article layouts.
const projectGalleryCSS = '<style>.project-gallery{margin-top:34px}.project-gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.project-gallery-grid figure{margin:0}.project-gallery-grid img{display:block;width:100%;height:250px;object-fit:cover;border-radius:10px}@media(max-width:680px){.project-gallery-grid{grid-template-columns:1fr}.project-gallery-grid img{height:auto}}</style>';
write('/projects/',shell({title:'Projects | Tongyang Process',description:'Explore Tongyang’s selected industrial project references, engineering coordination and project-specific equipment supply scopes.',url:'/projects/',current:'/projects/',body:projectsPage}));
for (const it of projects) {
  const url = `/projects/${it.slug}/`;
  const meta = [
    it.location ? ['Location',it.location] : null,
    it.partner ? ['Project Partner',it.partner] : null,
    it.equipmentScope ? ['Tongyang Equipment Scope',it.equipmentScope] : null
  ].filter(Boolean).map(([label,value])=>'<p><strong>'+e(label)+':</strong> '+e(value)+'</p>').join('');
  const galleryImages = Array.isArray(it.gallery) ? it.gallery.filter(x => typeof x === 'string' && safeImg(x)).slice(0,12) : [];
  const galleryMarkup = galleryImages.length ? `<section class="project-gallery" aria-label="Project photos"><h2>Project Photos</h2><div class="project-gallery-grid">${galleryImages.map((photo,i)=>`<figure><a href="${safeImg(photo)}" target="_blank" rel="noopener noreferrer">${img(photo, `${it.title} – project photo ${i+1}`, 'equipment-gallery-photo')}</a></figure>`).join('')}</div></section>` : '';
  const body = `${pageHero(it.category || 'PROJECT REFERENCE',it.title,it.summary,['<a href="/projects/">Projects</a>',e(it.title)])}<div class="container detail-wrap"><article class="content-rich">${it.image ? img(it.image,it.title,'detail-photo') : ''}${meta}${htmlbody(it.body)}${galleryMarkup}${projectGalleryCSS}<div class="divider"></div><a href="/projects/" class="arrow-link">← Back to project references</a></article><aside class="aside"><div class="eyebrow">PROJECT INQUIRIES</div><h3>Discuss your equipment scope</h3><p>Send your technical requirements and intended project boundary for a quotation review.</p><a class="btn btn-primary" href="/contact/">Contact our team ↗</a></aside></div>`;
  write(url,shell({title:it.seoTitle || `${it.title} | Tongyang Process`,description:it.seoDescription || it.summary,url,current:'/projects/',body,breadcrumbName:it.title}));
}
const contact = `${pageHero('REQUEST A QUOTATION',"Let's talk about your project.",'Share your equipment or process requirements. We will review the scope and discuss the next steps.',['Contact'])}<section class="section"><div class="container detail-wrap"><div><h2 style="font-size:30px;margin-top:0">Send an inquiry</h2><p class="form-hint">Send your equipment requirements directly using this online inquiry form. You do not need to open an email application. For drawings or confidential documents, email us directly instead.</p><form class="form" action="https://formsubmit.co/${encodeURIComponent(site.email)}" method="POST" accept-charset="UTF-8"><input type="hidden" name="_subject" value="New RFQ from Tongyang Process website"><input type="hidden" name="_template" value="table"><input type="hidden" name="_url" value="https://tongyangprocess.com/contact/"><input type="hidden" name="_next" value="https://tongyangprocess.com/thank-you/"><input type="hidden" name="equipment" id="rfq-equipment"><input type="text" name="_honey" autocomplete="off" tabindex="-1" aria-hidden="true" style="display:none"><p class="rfq-context" id="rfq-context" hidden></p><div class="form-row"><label>Your name<input name="name" required maxlength="120" autocomplete="name"></label><label>Company<input name="company" maxlength="140" autocomplete="organization"></label></div><div class="form-row"><label>Business email<input name="email" required type="email" maxlength="180" autocomplete="email"></label><label>Inquiry type<select name="topic"><option>Process equipment</option><option>Process solution or skid package</option><option>Engineering inquiry</option><option>General inquiry</option></select></label></div><label>Requirements<textarea name="message" required maxlength="5000" placeholder="Duty, capacity, materials, code, destination, project timing..."></textarea></label><div><button type="submit" class="btn btn-primary">Send Inquiry ↗</button></div><p class="form-hint">This form is processed by FormSubmit to email your inquiry to our sales team. Please do not submit confidential drawings through this form; email them directly.</p></form></div><aside class="aside"><div class="eyebrow" style="color:#27877f">CONTACT</div><h3>${e(site.company)}</h3><p>${e(site.location)}</p><a href="mailto:${e(site.email)}">${e(site.email)}</a><a href="tel:${e(site.phone.replace(/[^0-9+]/g,''))}">${e(site.phone)}</a><p style="margin-top:20px">You can attach technical data sheets and drawings to an email sent directly to our team.</p></aside></div></section>`;
write('/contact/',shell({title:'Contact & Request a Quote | Tongyang Process',description:'Contact Tongyang Process to discuss engineered industrial equipment, pressure vessels, thermal equipment and integrated system requirements.',url:'/contact/',current:'/contact/',body:contact}));

// Optional AI-site guide: accurate navigation, not a guarantee of AI citations.
const llms = [
  '# TONGYANG PROCESS',
  '> Official international process-equipment website of ' + site.company + '.',
  '',
  'Website: ' + BASE,
  'Contact: ' + BASE + '/contact/',
  'Company: ' + site.company,
  'Location: ' + site.location,
  '',
  '## Company information',
  '- About: ' + BASE + '/about/',
  '- Manufacturing: ' + BASE + '/manufacturing/',
  '- Quality and standards: ' + BASE + '/quality/',
  '',
  '## Process equipment',
  ...equipment.map(item => '- ' + item.title + ': ' + BASE + '/equipment/' + item.slug + '/'),
  '',
  '## Process solutions',
  ...solutions.map(item => '- ' + item.title + ': ' + BASE + '/solutions/' + item.slug + '/'),
  '',
  '## Project references',
  '- Project references: ' + BASE + '/projects/',
  ...projects.map(item => '- ' + item.title + ': ' + BASE + '/projects/' + item.slug + '/'),
  '',
  '## Technical articles',
  ...insights.map(item => '- ' + item.title + ': ' + BASE + '/insights/' + item.slug + '/'),
  '',
  '## Notes',
  '- Equipment specifications, design codes, materials and certifications depend on the approved project requirements.',
  '- For a quotation, provide service conditions, design pressure, temperature, medium, material and relevant drawings.',
  ''
].join('\n');
fs.writeFileSync(path.join(dist,'llms.txt'), llms);
fs.writeFileSync(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /cdn-cgi/l/email-protection\nSitemap: ${BASE}/sitemap.xml\n`);
const stamp = new Date().toISOString().slice(0,10);
fs.writeFileSync(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${BASE}${url}</loc><lastmod>${stamp}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('/thank-you/',shell({title:'Inquiry Submitted | Tongyang Process',description:'Thank you for contacting Tongyang Process.',url:'/thank-you/',noindex:true,body:`<section class="section"><div class="container" style="max-width:760px;text-align:center;padding-top:80px;padding-bottom:80px"><div class="eyebrow">REQUEST RECEIVED</div><h1>Thank you for your inquiry!</h1><p>Your request has been submitted successfully. Our team will review your requirements and contact you by email.</p><p class="form-hint" style="margin:22px 0">You will return to our homepage automatically in a few seconds.</p><a class="btn btn-primary" href="/">Return to homepage →</a></div></section><script>window.setTimeout(function(){window.location.replace('/')},7000)</script>`}));
fs.writeFileSync(path.join(dist,'404.html'),shell({title:'Page not found | Tongyang Process',description:'This page could not be found.',url:'/404/',body:`<section class="section"><div class="container"><h1>Page not found</h1><p>Sorry, the requested page is unavailable.</p><a class="btn btn-primary" href="/">Back to homepage →</a></div></section>`}));
console.log(`Generated ${urls.length} website pages in dist/`);
