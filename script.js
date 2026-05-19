// ── CUSTOM CURSOR ──
const cursor = document.querySelector('.cursor');
const follower = document.querySelector('.cursor-follower');
if (cursor && follower) {
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    setTimeout(() => {
      follower.style.left = e.clientX + 'px';
      follower.style.top = e.clientY + 'px';
    }, 80);
  });
  document.querySelectorAll('a, button, .gallery-item, .service-card').forEach(el => {
    el.addEventListener('mouseenter', () => { follower.style.transform = 'translate(-50%,-50%) scale(1.6)'; follower.style.borderColor = 'var(--dark-pink)'; });
    el.addEventListener('mouseleave', () => { follower.style.transform = 'translate(-50%,-50%) scale(1)'; follower.style.borderColor = 'var(--pink)'; });
  });
}

// ── NAVBAR SCROLL ──
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

// ── MOBILE MENU ──
const hamburger = document.getElementById('hamburger');
const closeMenu = document.getElementById('closeMenu');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && closeMenu && mobileMenu) {
  hamburger.addEventListener('click', () => mobileMenu.classList.add('open'));
  closeMenu.addEventListener('click', () => mobileMenu.classList.remove('open'));
  document.querySelectorAll('.mob-link').forEach(l => l.addEventListener('click', () => mobileMenu.classList.remove('open')));
}

// ── HERO SLIDESHOW ──
const slides = document.querySelectorAll('.hero-slide');
if (slides.length > 0) {
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 5000);
}

// ── PARTICLES ──
const canvas = document.getElementById('particles');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.6 - 0.2,
      opacity: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.5 ? '212,175,122' : '232,164,184'
    };
  }

  for (let i = 0; i < 80; i++) particles.push(createParticle());

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
      ctx.fill();
      p.x += p.speedX;
      p.y += p.speedY;
      p.opacity -= 0.002;
      if (p.opacity <= 0 || p.y < -10) particles[i] = createParticle();
    });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();
}

// ── FADE IN ON SCROLL ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ── COUNTER ANIMATION ──
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = +el.dataset.target;
      let count = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        count += step;
        if (count >= target) { el.textContent = target; clearInterval(timer); }
        else el.textContent = Math.floor(count);
      }, 25);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ── LIGHTBOX ──
const galleryImgs = [...document.querySelectorAll('.gallery-item img')].map(img => img.src);
if (galleryImgs.length > 0) {
  let lbIndex = 0;

  function openLightbox(i) {
    lbIndex = i;
    document.getElementById('lb-img').src = galleryImgs[i];
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }
  function changeSlide(dir) {
    lbIndex = (lbIndex + dir + galleryImgs.length) % galleryImgs.length;
    document.getElementById('lb-img').src = galleryImgs[lbIndex];
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeSlide(1);
    if (e.key === 'ArrowRight') changeSlide(-1);
  });
}
