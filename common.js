/* Спільна логіка: мови UA/EN, CSV, нормалізація кодів */
(function(){
  const I18N = {
    uk: {
      titleIndex:'Перевірка картини — Tatiana Sova', titleCatalog:'Каталог картин — Tatiana Sova',
      eyebrow:'Атрибуційний реєстр · Провенанс',
      h1:'Перевірка картини',
      sub:'Введіть код з картини або сертифіката, щоб підтвердити оригінальність.',
      toCatalog:'→ Каталог картин', toVerify:'← До перевірки коду',
      codeLabel:'Код картини',
      segInitials:'Ініціали', segYear:'Рік', segNo:'№', segCheck:'Контроль',
      codeHint:'Вводьте по частинах — курсор перейде далі сам. Код можна й вставити цілком.',
      verify:'Перевірити',
      loading:'Завантаження реєстру…',
      loaded:'Реєстр веде художниця особисто. Записів: {n}.',
      loadFail:'Не вдалося завантажити реєстр. Спробуйте пізніше.',
      incomplete:'Введіть код повністю.',
      good:'Код підтверджено — оригінал',
      bad:'Код не знайдено в реєстрі',
      badHelp:'Перевірте, чи правильно введені символи. Якщо код збігається з написаним на картині, зверніться до художниці.',
      kCode:'Код', kTitle:'Назва', kNote:'Опис', kDate:'Зареєстровано',
      catalogH1:'Каталог картин', catalogSub:'Усі зареєстровані роботи.',
      empty:'Реєстр поки порожній.', noPhoto:'без фото', untitled:'Без назви', catalogFail:'Не вдалося завантажити каталог.',
      photoFail:'Фото недоступне', zoom:'Натисніть, щоб збільшити'
    },
    en: {
      titleIndex:'Verify your painting — Tatiana Sova', titleCatalog:'Catalogue — Tatiana Sova',
      eyebrow:'Provenance register',
      h1:'Verify your painting',
      sub:'Enter the code from the painting or certificate to confirm it is an original.',
      toCatalog:'→ Browse the catalogue', toVerify:'← Verify a code',
      codeLabel:'Painting code',
      segInitials:'Initials', segYear:'Year', segNo:'No.', segCheck:'Check',
      codeHint:'Type part by part — the cursor moves on by itself. You can also paste the whole code.',
      verify:'Verify',
      loading:'Loading the register…',
      loaded:'The register is kept by the artist personally. Entries: {n}.',
      loadFail:'Could not load the register. Please try again later.',
      incomplete:'Please enter the full code.',
      good:'Code confirmed — original',
      bad:'Code not found in the register',
      badHelp:'Please check the characters you entered. If they match the code on your painting, contact the artist.',
      kCode:'Code', kTitle:'Title', kNote:'Details', kDate:'Registered',
      catalogH1:'Catalogue', catalogSub:'All registered works.',
      empty:'The register is empty for now.', noPhoto:'no photo', untitled:'Untitled', catalogFail:'Could not load the catalogue.',
      photoFail:'Photo unavailable', zoom:'Tap to enlarge'
    }
  };

  let lang = 'uk';
  try { const s = localStorage.getItem('lang'); if (s && I18N[s]) lang = s; else throw 0; }
  catch(e){ const n=(navigator.language||'uk').toLowerCase(); lang = (n.startsWith('uk')||n.startsWith('ru')) ? 'uk' : 'en'; }

  const listeners = [];
  const t = (k, vars) => { let s = (I18N[lang][k] ?? I18N.uk[k] ?? k); if(vars) for(const v in vars) s = s.replace('{'+v+'}', vars[v]); return s; };

  function apply(){
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    const tk = document.documentElement.dataset.titleKey; if(tk) document.title = t(tk);
    document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  }
  function setLang(l){
    if(!I18N[l]) return; lang = l;
    try { localStorage.setItem('lang', l); } catch(e){}
    apply(); listeners.forEach(fn => fn(l));
  }

  function parseCSV(text){
    const rows=[]; let row=[], f='', q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(q){ if(c==='"'&&n==='"'){f+='"';i++;} else if(c==='"'){q=false;} else f+=c; }
      else if(c==='"') q=true;
      else if(c===','){ row.push(f); f=''; }
      else if(c==='\n'||c==='\r'){ if(f!==''||row.length){ row.push(f); rows.push(row); row=[]; f=''; } if(c==='\r'&&n==='\n') i++; }
      else f+=c;
    }
    if(f!==''||row.length){ row.push(f); rows.push(row); }
    if(!rows.length) return [];
    const h = rows[0].map(x=>x.trim().replace(/^\uFEFF/,''));
    return rows.slice(1).filter(r=>r.some(v=>v.trim()!=='')).map(r=>{ const o={}; h.forEach((k,i)=>o[k]=(r[i]||'').trim()); return o; });
  }

  const esc = s => { const d=document.createElement('div'); d.textContent = s||''; return d.innerHTML; };

  // Кириличні літери, схожі на латинські, вважаємо однаковими (ОК = OK)
  const LOOK = {'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','І':'I','У':'Y'};
  function canon(code){
    const parts = (code||'').toUpperCase().replace(/[\s–—_./]+/g,'-').split('-');
    const last = parts.length-1;
    return parts.map((p,i)=>{
      p = p.replace(/[АВЕКМНОРСТХІУ]/g, ch=>LOOK[ch]);
      if(i===last && last>=3) p = p.replace(/O/g,'0').replace(/I/g,'1'); // контрольна частина — лише 0-9 A-F
      return p;
    }).join('-');
  }

  const pick = (p, field) => (lang==='en' && p[field+'_en']) ? p[field+'_en'] : (p[field]||'');
  const fmtDate = iso => { if(!iso) return '—'; const d=new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString(lang==='uk'?'uk-UA':'en-GB'); };


  // Фото: «001.jpg» → photos/001.jpg; повне посилання (https://…) лишається як є
  function photoUrl(v){
    v = (v||'').trim(); if(!v) return '';
    if(/^(https?:)?\/\//i.test(v) || v.startsWith('/') || v.startsWith('photos/')) return v;
    return 'photos/' + (v.includes('%') ? v : encodeURI(v));
  }

  function zoom(src, alt){
    const box = document.createElement('div'); box.className = 'lightbox';
    box.innerHTML = '<span class="x" aria-hidden="true">×</span>';
    const im = document.createElement('img'); im.src = src; im.alt = alt || ''; box.appendChild(im);
    const close = () => { box.remove(); document.body.style.overflow=''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if(e.key==='Escape') close(); };
    box.addEventListener('click', close); document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; document.body.appendChild(box);
  }

  // Плавна поява, заглушка якщо фото не завантажилось, збільшення по кліку
  function hookImages(root){
    root.querySelectorAll('img.art-img').forEach(img => {
      const frame = img.closest('.art-frame, .photo');
      const done = () => img.classList.add('loaded');
      const fail = () => { if(frame){ frame.classList.add('broken'); frame.innerHTML = '<span class="placeholder">'+esc(t('photoFail'))+'</span>'; } };
      if(img.complete && img.naturalWidth) done(); else if(img.complete) fail();
      else { img.addEventListener('load', done); img.addEventListener('error', fail); }
      if(frame){
        const open = () => { if(!frame.classList.contains('broken')) zoom(img.currentSrc || img.src, img.alt); };
        frame.addEventListener('click', open);
        frame.addEventListener('keydown', e => { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); open(); } });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
    apply();
  });

  window.Site = { photoUrl, hookImages, zoom, t, esc, parseCSV, canon, pick, fmtDate, getLang:()=>lang, onLang:fn=>listeners.push(fn) };
})();
