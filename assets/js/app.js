// =========================
// APP.JS — Lógica principal da loja
// =========================

import {
  db, auth, collection, getDocs, query, where, orderBy, onAuthStateChanged
} from './firebase-config.js';


// ---- Estado global ----
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  carouselIndex: 0,
  carouselTimer: null,
};

// ========================
// UTILIDADES
// ========================
function formatPrice(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ========================
// FIREBASE — PRODUTOS
// ========================
async function fetchProducts() {
  try {
    const snap = await getDocs(collection(db, 'produtos'));
    state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return state.products;
  } catch (e) {
    console.error('Erro ao carregar produtos:', e);
    return [];
  }
}

// ========================
// CARROSSEL
// ========================
function initCarousel(bannerProducts) {
  const track = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  if (!track) return;

  if (!bannerProducts.length) {
    track.innerHTML = `
      <div class="carousel-placeholder">
        <div class="spinner"></div>
        <p>Nenhum banner configurado ainda.</p>
      </div>`;
    return;
  }

  track.innerHTML = bannerProducts.map(b => `
  <div class="carousel-slide" data-category="${b.categoria}">
    <picture>
  <source media="(max-width: 768px)" srcset="${b.imagemMobile || b.imagemUrl}">
  <img src="${b.imagemUrl || 'https://placehold.co/1200x480/111827/00AEEF?text=Banner'}"
       alt="${b.titulo || 'Banner'}"
       loading="lazy">
</picture>
  </div>
`).join('');

  dotsWrap.innerHTML = bannerProducts.map((_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  // eventos dots
  dotsWrap.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => goToSlide(Number(dot.dataset.index)));
  });


  startCarouselTimer(bannerProducts.length);

  track.querySelectorAll('.carousel-slide').forEach(slide => {
    slide.addEventListener('click', () => {
      const category = slide.dataset.category;
      if (!category) return;

      // filtrar produtos
      const filtered = state.products.filter(p => p.categoria === category);
      renderProducts(filtered);

      // atualizar botões de categoria
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === category);
      });

      // atualizar URL sem recarregar
      window.history.pushState({}, '', `?categoria=${encodeURIComponent(category)}`);
      const productsSection = document.getElementById('products-grid');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function goToSlide(index) {
  const track = document.getElementById('carousel-track');
  const dots = document.querySelectorAll('.carousel-dot');
  if (!track) return;

  state.carouselIndex = index;
  track.style.transform = `translateX(-${index * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

function startCarouselTimer(total) {
  clearInterval(state.carouselTimer);
  state.carouselTimer = setInterval(() => {
    goToSlide((state.carouselIndex + 1) % total);
  }, 5000);
}

document.getElementById('carousel-prev')?.addEventListener('click', () => {
  const total = document.querySelectorAll('.carousel-slide').length;
  if (!total) return;
  goToSlide((state.carouselIndex - 1 + total) % total);
});

document.getElementById('carousel-next')?.addEventListener('click', () => {
  const total = document.querySelectorAll('.carousel-slide').length;
  if (!total) return;
  goToSlide((state.carouselIndex + 1) % total);
});

// ========================
// PRODUTOS — GRID
// ========================
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (!products.length) {
    grid.innerHTML = `<div class="products-empty"><p>Nenhum produto encontrado.</p></div>`;
    return;
  }

  grid.innerHTML = products.map(p => `
    <article class="product-card" data-id="${p.id}">
      <div class="product-img-wrap">
        <img src="${p.imagem || 'https://placehold.co/400x400/1F2937/00AEEF?text=Produto'}"
             alt="${p.nome}" loading="lazy">
        ${p.badge ? `<span class="product-badge badge-${badgeClass(p.badge)}">${p.badge}</span>` : ''}
      </div>
      <div class="product-info">
        <span class="product-category">${p.categoria || ''}</span>
        <p class="product-name">${p.nome}</p>
        ${p.badge === 'Promoção' && p.precoAntigo ? `
  <span class="product-price-old">${formatPrice(p.precoAntigo)}</span>` : ''}
<span class="product-price">${formatPrice(p.preco)}</span>
      </div>
      <button class="btn btn-primary btn-sm btn-add-cart" data-id="${p.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        Adicionar
      </button>
    </article>
  `).join('');

  // Evento: abrir modal
  grid.querySelectorAll('.product-img-wrap').forEach(el => {
    el.addEventListener('click', () => openProductModal(el.closest('.product-card').dataset.id));
  });

  // Evento: adicionar ao carrinho
  grid.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(btn.dataset.id);
    });
  });
}

function badgeClass(badge) {
  const map = { 'promoção': 'promo', 'promo': 'promo', 'novo': 'novo', 'destaque': 'destaque', 'popular': 'popular' };
  return map[badge?.toLowerCase()] || 'destaque';
}

// ========================
// FILTROS DE CATEGORIA
// ========================
function initFilters(products) {
  const wrap = document.getElementById('category-filters');
  if (!wrap) return;

  const categories = ['Todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];

  wrap.innerHTML = categories.map((c, i) =>
    `<button class="filter-btn${i === 0 ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');

  wrap.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      const filtered = cat === 'Todos' ? products : products.filter(p => p.categoria === cat);
      renderProducts(filtered);
    });
  });
}

// Filtrar produtos clicando nos utens do menu 
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();

    const category = link.dataset.category;

    if (!category) return;

    if (category === 'Todos') {
      renderProducts(state.products);
    } else {
      const filtered = state.products.filter(p => p.categoria === category);
      renderProducts(filtered);
    }

    // atualizar botões de filtro (os de baixo)
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === category);
    });

    // scroll até produtos
    const section = document.getElementById('products-grid');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  });
});



// ========================
// MODAL DE PRODUTO
// ========================
function openProductModal(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  const overlay = document.getElementById('modal-product');
  overlay.querySelector('.modal-product-img img').src =
    product.imagem || 'https://placehold.co/400x400/1F2937/00AEEF?text=Produto';
  overlay.querySelector('.modal-product-img img').alt = product.nome;
  overlay.querySelector('#modal-product-name').textContent = product.nome;
  overlay.querySelector('#modal-product-price').textContent = formatPrice(product.preco);
  overlay.querySelector('#modal-product-desc').textContent = product.descricao || 'Sem descrição disponível.';
  overlay.querySelector('#modal-product-category').textContent = product.categoria || '';
  overlay.querySelector('#btn-modal-add-cart').dataset.id = product.id;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('modal-product')?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('modal-product')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeProductModal();
});

document.getElementById('modal-product-close')?.addEventListener('click', closeProductModal);

document.getElementById('btn-modal-add-cart')?.addEventListener('click', function () {
  addToCart(this.dataset.id);
  closeProductModal();
});

// ========================
// CARRINHO
// ========================
function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  const existing = state.cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({ ...product, qty: 1 });
  }

  saveCart();
  updateCartUI();
  showToast(`"${product.nome}" adicionado ao carrinho!`);
}

function removeFromCart(id) {
  state.cart = state.cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function changeQty(id, delta) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
}

function updateCartUI() {
  // Count badge
  const total = state.cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    // el.textContent = total;
    // el.style.display = total ? 'flex' : 'none';
    el.textContent = total;
    el.style.display = 'flex'; // remove o ternário, sempre mostra
  });

  // Items list
  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;

  if (!state.cart.length) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Seu carrinho está vazio</p>
      </div>`;
    document.getElementById('cart-total-value').textContent = formatPrice(0);
    return;
  }

  itemsEl.innerHTML = state.cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img class="cart-item-img"
           src="${item.imagem || 'https://placehold.co/64x64/1F2937/00AEEF?text=P'}"
           alt="${item.nome}">
      <div>
        <p class="cart-item-name">${item.nome}</p>
        <span class="cart-item-price">${formatPrice(item.preco)}</span>
        <div class="cart-item-qty">
          <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}" aria-label="Remover">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Total
  const totalPrice = state.cart.reduce((s, i) => s + i.preco * i.qty, 0);
  document.getElementById('cart-total-value').textContent = formatPrice(totalPrice);

  // Eventos qty e remove
  itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => changeQty(btn.dataset.id, Number(btn.dataset.delta)));
  });

  itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
}

// Abrir/fechar carrinho
document.getElementById('btn-cart')?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ========================
// BUSCA
// ========================
document.getElementById('search-input')?.addEventListener('input', function () {
  const term = this.value.toLowerCase().trim();
  if (!term) { renderProducts(state.products); return; }
  const filtered = state.products.filter(p =>
    p.nome?.toLowerCase().includes(term) ||
    p.categoria?.toLowerCase().includes(term) ||
    p.descricao?.toLowerCase().includes(term)
  );
  renderProducts(filtered);
  initFilters(filtered);
});

// ========================
// FINALIZAR COMPRA (WHATSAPP)
// ========================
const WHATSAPP_NUMBER = '5581986953009'; // ← Substitua pelo número real

// Limpa erro visual ao usuário corrigir o campo
['checkout-nome', 'checkout-endereco', 'checkout-pagamento'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', function () {
    this.style.borderColor = '';
    this.parentElement.querySelector('.field-error')?.remove();
  });
});

document.getElementById('btn-checkout')?.addEventListener('click', () => {
  if (!state.cart.length) { showToast('Carrinho vazio!', 'error'); return; }
  closeCart();
  document.getElementById('modal-checkout')?.classList.add('open');
  document.body.style.overflow = 'hidden';
});

document.getElementById('modal-checkout-close')?.addEventListener('click', () => {
  document.getElementById('modal-checkout')?.classList.remove('open');
  document.body.style.overflow = '';
});

document.getElementById('modal-checkout')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('open');
    document.body.style.overflow = '';
  }
});

document.getElementById('form-checkout')?.addEventListener('submit', e => {
  e.preventDefault();

  const nome = document.getElementById('checkout-nome').value.trim();
  const endereco = document.getElementById('checkout-endereco').value.trim();
  const pagamento = document.getElementById('checkout-pagamento').value;
  const obs = document.getElementById('checkout-obs').value.trim();

  // ── Validação manual ──────────────────────────────────────
  const fields = [
    { value: nome, id: 'checkout-nome', msg: 'Por favor, informe seu nome.' },
    { value: endereco, id: 'checkout-endereco', msg: 'Por favor, informe o endereço de entrega.' },
    { value: pagamento, id: 'checkout-pagamento', msg: 'Por favor, selecione a forma de pagamento.' },
  ];

  // Remove erros anteriores
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.form-input--error, .form-select--error').forEach(el => {
    el.style.borderColor = '';
  });

  let firstError = null;
  for (const field of fields) {
    if (!field.value) {
      const input = document.getElementById(field.id);
      input.style.borderColor = 'var(--color-danger)';

      const msg = document.createElement('span');
      msg.className = 'field-error';
      msg.textContent = field.msg;
      msg.style.cssText = 'font-size:.78rem;color:#FCA5A5;margin-top:3px;display:block';
      input.parentElement.appendChild(msg);

      if (!firstError) firstError = input;
    }
  }

  if (firstError) {
    firstError.focus();
    return; // Bloqueia o envio
  }
  // ─────────────────────────────────────────────────────────

  const itens = state.cart.map(i =>
    `• ${i.nome} x${i.qty} — ${formatPrice(i.preco * i.qty)}`
  ).join('\n');

  const total = state.cart.reduce((s, i) => s + i.preco * i.qty, 0);

  const msg = encodeURIComponent(
    `🛒 *NOVO PEDIDO — POWERNUTRI*\n\n` +
    `👤 *Cliente:* ${nome}\n` +
    `📍 *Endereço:* ${endereco}\n` +
    `💰 *Pagamento:* ${pagamento}\n\n` +
    `*PRODUTOS:*🛍\n${itens}\n \n` +
    `*Total:* ${formatPrice(total)}\n\n` +
    (obs ? `*Obs:* ${obs}` : '')
  );

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  state.cart = [];
  saveCart();
  updateCartUI();
  document.getElementById('modal-checkout')?.classList.remove('open');
  document.body.style.overflow = '';
  showToast('Pedido enviado com sucesso!');
});

// ========================
// MENU MOBILE
// ========================
document.getElementById('btn-hamburger')?.addEventListener('click', () => {
  const btn = document.getElementById('btn-hamburger');
  const panel = document.getElementById('mobile-panel');
  const overlay = document.getElementById('mobile-overlay');
  const isOpen = panel?.classList.contains('open');

  if (isOpen) {
    closeMobileMenu();
  } else {
    panel?.classList.add('open');
    overlay?.classList.add('open');
    btn?.classList.add('open');
  }
});

document.getElementById('mobile-close')?.addEventListener('click', closeMobileMenu);
document.getElementById('mobile-overlay')?.addEventListener('click', closeMobileMenu);

function closeMobileMenu() {
  document.getElementById('mobile-panel')?.classList.remove('open');
  document.getElementById('mobile-overlay')?.classList.remove('open');
  document.getElementById('btn-hamburger')?.classList.remove('open');
}


// ========================
// INICIALIZAÇÃO
// ========================
async function fetchBanners() {
  const snap = await getDocs(collection(db, 'banners'));

  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(b => b.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function getCategoryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('categoria');
}

async function init() {
  updateCartUI();

  const products = await fetchProducts();

  // Banner (novo sistema)
  const banners = await fetchBanners();
  initCarousel(banners);

  // Grid
  const categoryFromURL = getCategoryFromURL();

  if (categoryFromURL) {
    const filtered = products.filter(p => p.categoria === categoryFromURL);
    renderProducts(filtered);
    initFilters(products);

    // opcional: marcar botão ativo
    setTimeout(() => {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.cat === categoryFromURL) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }, 100);

  } else {
    renderProducts(products);
    initFilters(products);
  }
}

init();
