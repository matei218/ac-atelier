/* Interactions only; content, artwork and responsive layout live in HTML/CSS. */
(() => {
  const paper = document.getElementById('paper');
  const languageButtons = document.querySelectorAll('.language-buttons button');
  const translatable = document.querySelectorAll('[data-ro]');
  function copy(element, ro, en) {
    element.dataset.ro = ro;
    element.dataset.en = en;
    element.textContent = document.documentElement.lang === 'en' ? en : ro;
  }
  languageButtons.forEach(button => button.addEventListener('click', () => {
    const lang = button.lang;
    document.documentElement.lang = lang;
    translatable.forEach(element => { element.textContent = element.dataset[lang]; });
    const status = document.querySelector('.form-status');
    if (status.dataset[lang]) status.textContent = status.dataset[lang];
    languageButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    scheduleDraw();
  }));

  const form = document.querySelector('.contact-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = form.elements.namedItem('name');
    const email = form.elements.namedItem('email');
    const message = form.elements.namedItem('message');
    for (const field of [name, email, message]) {
      field.value = field.value.trim();
    }
    if (!form.reportValidity()) return;
    const output = form.querySelector('output');
    output.textContent = `${name.value}\n${email.value}\n\n${message.value}`;
    output.hidden = false;
    copy(form.querySelector('.form-status'), 'Mesaj pregătit mai jos. Nu a fost trimis; îl poți copia.', 'Your draft is below. It has not been sent; you can copy it.');
  });
  form.addEventListener('input', () => {
    form.querySelector('output').hidden = true;
    const status = form.querySelector('.form-status');
    copy(status, '', '');
  });
  form.querySelector('button').disabled = false;

  // A responsive SVG path needs measured endpoints to meet the title and signature.
  const thread = paper.querySelector('.cutting-thread');
  const path = thread.querySelector('path');
  const scissors = thread.querySelector('.scroll-scissors');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let totalLength = 0;
  let startY = 0;
  let endY = 0;
  let samples = [];
  let scrollRange = 1;
  let scissorScale = .85;
  let lastScrollY = window.scrollY;
  let direction = 1;
  let scrollFrame;
  let hideTimer;
  function positionScissors() {
    if (!totalLength || reducedMotion.matches) return;
    const progress = Math.max(0, Math.min(1, window.scrollY / scrollRange));
    const targetY = startY + (endY - startY) * progress;
    thread.classList.toggle('at-endpoint', progress <= .002 || progress >= .998);
    // Path Y is monotonic: find the point at the reader's viewport position.
    let low = 0;
    let high = samples.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (samples[middle].y < targetY) low = middle;
      else high = middle;
    }
    const first = samples[low];
    const last = samples[high];
    const fraction = Math.max(0, Math.min(1, (targetY - first.y) / Math.max(.001, last.y - first.y)));
    const distance = progress === 0 ? 0 : progress === 1 ? totalLength : first.distance + fraction * (last.distance - first.distance);
    const point = path.getPointAtLength(distance);
    const before = path.getPointAtLength(Math.max(0, distance - 2));
    const after = path.getPointAtLength(Math.min(totalLength, distance + 2));
    const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI + (direction < 0 ? 180 : 0);
    scissors.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle}) scale(${scissorScale})`);
  }
  window.addEventListener('scroll', () => {
    direction = window.scrollY < lastScrollY ? -1 : 1;
    lastScrollY = window.scrollY;
    if (reducedMotion.matches) return;
    thread.classList.add('is-cutting');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => thread.classList.remove('is-cutting'), 220);
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(positionScissors);
  }, { passive: true });
  reducedMotion.addEventListener('change', () => {
    thread.classList.remove('is-cutting');
    cancelAnimationFrame(scrollFrame);
    clearTimeout(hideTimer);
    if (!reducedMotion.matches) positionScissors();
  });
  function drawThread() {
    const rect = paper.getBoundingClientRect();
    const width = rect.width;
    const height = paper.offsetHeight;
    thread.setAttribute('viewBox', `0 0 ${width} ${height}`);
    thread.setAttribute('width', String(width));
    thread.setAttribute('height', String(height));
    // Broad free curves remain visible through text and pass behind images.
    const heading = paper.querySelector('.hero h1').getBoundingClientRect();
    const signature = paper.querySelector('.signature-footer span').getBoundingClientRect();
    const compact = width < 720;
    // Park mobile scissors in the open space above the headline, not across
    // the page edge or underneath the headline's opaque text surface.
    startY = compact ? Math.max(26, heading.top - rect.top - 30) : heading.top - rect.top + 30;
    endY = Math.min(height - 20, signature.bottom - rect.top + 20);
    const startX = compact ? Math.max(28, heading.left - rect.left + 26) : Math.max(26, heading.left - rect.left - 24);
    const endX = signature.left - rect.left + signature.width / 2;
    const swings = [0.84, 0.24, 0.77, 0.15, 0.82, 0.3, endX / width];
    let x = startX;
    let y = startY;
    let d = `M ${x} ${y}`;
    swings.forEach((fraction, index) => {
      const nextX = width * fraction;
      const nextY = startY + (endY - startY) * (index + 1) / swings.length;
      const span = nextY - y;
      d += ` C ${x} ${y + span * .55}, ${nextX} ${nextY - span * .55}, ${nextX} ${nextY}`;
      x = nextX;
      y = nextY;
    });
    path.setAttribute('d', d);
    totalLength = path.getTotalLength();
    samples = Array.from({ length: 193 }, (_, i) => {
      const distance = totalLength * i / 192;
      return { distance, y: path.getPointAtLength(distance).y };
    });
    scissorScale = width < 650 ? .7 : .85;
    scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    positionScissors();
  }
  let frame;
  function scheduleDraw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drawThread);
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe(paper);
  window.addEventListener('resize', scheduleDraw);
  paper.querySelectorAll('img').forEach(img => img.addEventListener('load', scheduleDraw));
  drawThread();
})();
