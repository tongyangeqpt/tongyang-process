(() => {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-site-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const opened = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(opened));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }
  const form = document.querySelector('[data-rfq-form]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const lines = [
        `Name: ${fields.get('name') || ''}`,
        `Company: ${fields.get('company') || ''}`,
        `Email: ${fields.get('email') || ''}`,
        `Topic: ${fields.get('topic') || ''}`,
        '',
        `${fields.get('message') || ''}`
      ];
      const target = form.getAttribute('data-email');
      const subject = `Tongyang Process RFQ – ${fields.get('topic') || 'General inquiry'}`;
      window.location.href = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      const note = form.querySelector('[data-rfq-note]');
      if (note) note.textContent = 'Your email application should open with a prepared message. If it does not, please email us using the address displayed below.';
    });
  }
})();
