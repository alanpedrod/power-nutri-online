// =========================
// ADMIN.JS — Painel Administrativo
// =========================

import {
  db, auth, collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  getDoc,
  signOut, onAuthStateChanged
} from './firebase-config.js';

// ========================
// CLOUDINARY CONFIG
// ========================
const CLOUD_NAME = 'ddojjqwky';
const UPLOAD_PRESET = 'produtos_powernutriofc';

// ========================
// AUTH GUARD
// ========================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 🔐 Verifica se é admin
  const docRef = doc(db, "admins", user.uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    alert("Acesso negado");
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('admin-user-email').textContent = user.email;

  initAdmin();
});

// ========================
// ESTADO
// ========================
let products = [];
let banners = [];
let editingId = null;
let editingBannerId = null;
let uploadedImageUrl = '';
let uploadedBannerUrl = '';

// ========================
// INICIALIZAÇÃO
// ========================
async function initAdmin() {
  await Promise.all([loadProducts(), loadBanners()]);
  setupTabs();
  setupForm();
  setupUpload();
  setupBannerForm();
  setupBannerUpload();
  setupBannerUploadMobile();
}

// ========================
// TABS
// ========================
function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.panel);
      if (target) target.style.display = 'block';
    });
  });

  // Mostrar primeiro painel
  if (panels.length) panels[0].style.display = 'block';
}

// ========================
// CARREGAR PRODUTOS
// ========================
async function loadProducts() {
  const snap = await getDocs(collection(db, 'produtos'));
  products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable();
  updateStats();
}

function updateStats() {
  const el = document.getElementById('stat-total');
  if (el) el.textContent = products.length;

  const bannerEl = document.getElementById('stat-banner');
  if (bannerEl) bannerEl.textContent = banners.filter(b => b.ativo !== false).length;

  const cats = new Set(products.map(p => p.categoria).filter(Boolean));
  const catEl = document.getElementById('stat-cats');
  if (catEl) catEl.textContent = cats.size;
}

// ========================
// TABELA DE PRODUTOS
// ========================
function renderTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-gray);padding:32px">
      Nenhum produto cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <img class="admin-table-img"
             src="${p.imagem || 'https://placehold.co/48x48/1F2937/00AEEF?text=P'}"
             alt="${p.nome}">
      </td>
      <td>${p.nome || '—'}</td>
      <td>${p.categoria || '—'}</td>
      <td>R$ ${Number(p.preco || 0).toFixed(2)}</td>
      <td>${p.badge || '—'}</td>
      <td>
        <div class="admin-table-actions">
          <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ========================
// FORM
// ========================
function setupForm() {
  const form = document.getElementById('product-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const data = {
      nome: form.nome.value.trim(),
      categoria: form.categoria.value,
      descricao: form.descricao.value.trim(),
      preco: Number(form.preco.value),
      precoAntigo: form.badge.value === 'Promoção' ? Number(form.precoAntigo.value) || 0 : 0,
      badge: form.badge.value,
      exibirNoBanner: form.exibirNoBanner.checked,
      imagem: uploadedImageUrl || form.imagemUrl.value.trim(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'produtos', editingId), data);
        showMsg('Produto atualizado!', 'success');
        editingId = null;
      } else {
        await addDoc(collection(db, 'produtos'), data);
        showMsg('Produto criado!', 'success');
      }
      form.reset();
      uploadedImageUrl = '';
      document.getElementById('img-preview').innerHTML = '';
      btn.textContent = 'Salvar produto';
      document.getElementById('form-title').textContent = 'Adicionar produto';
      await loadProducts();
    } catch (err) {
      showMsg('Erro ao salvar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    editingId = null;
    form.reset();
    uploadedImageUrl = '';
    document.getElementById('img-preview').innerHTML = '';
    document.getElementById('form-title').textContent = 'Adicionar produto';
    document.getElementById('btn-cancel-edit').style.display = 'none';
  });
}

// ========================
// EDITAR / EXCLUIR
// ========================
window.editProduct = function (id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  editingId = id;
  const form = document.getElementById('product-form');
  form.nome.value = p.nome || '';
  form.categoria.value = p.categoria || '';
  form.descricao.value = p.descricao || '';
  form.preco.value = p.preco || '';
  form.badge.value = p.badge || '';
  form.precoAntigo.value = p.precoAntigo || '';
  form.exibirNoBanner.checked = !!p.exibirNoBanner;
  form.imagemUrl.value = p.imagem || '';
  uploadedImageUrl = p.imagem || '';

  // Mostrar/esconder campo preço antigo conforme badge
  const group = document.getElementById('group-preco-antigo');
  group.style.display = p.badge === 'Promoção' ? 'flex' : 'none';

  if (p.imagem) {
    document.getElementById('img-preview').innerHTML =
      `<img src="${p.imagem}" style="max-height:120px;border-radius:8px;margin-top:8px">`;
  }

  document.getElementById('form-title').textContent = 'Editar produto';
  document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
  document.querySelector('[data-panel="panel-form"]')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async function (id) {
  if (!confirm('Deseja realmente excluir este produto?')) return;
  try {
    await deleteDoc(doc(db, 'produtos', id));
    showMsg('Produto excluído.', 'success');
    await loadProducts();
  } catch (err) {
    showMsg('Erro: ' + err.message, 'error');
  }
};

// ========================
// UPLOAD CLOUDINARY
// ========================
function setupUpload() {
  const area = document.getElementById('img-upload-area');
  const input = document.getElementById('img-input');
  const preview = document.getElementById('img-preview');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());

  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) uploadFile(input.files[0]);
  });

  async function uploadFile(file) {
    area.querySelector('p').textContent = 'Enviando...';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST', body: fd
      });
      const data = await res.json();
      uploadedImageUrl = data.secure_url;
      preview.innerHTML = `<img src="${uploadedImageUrl}" style="max-height:120px;border-radius:8px;margin-top:8px">`;
      area.querySelector('p').textContent = 'Imagem enviada com sucesso!';
    } catch (err) {
      area.querySelector('p').textContent = 'Erro no upload. Tente novamente.';
      showMsg('Erro no upload: ' + err.message, 'error');
    }
  }
}

// ========================
// BANNERS — CARREGAR
// ========================
async function loadBanners() {
  const snap = await getDocs(collection(db, 'banners'));
  banners = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  renderBannerTable();
  updateStats();
}

// ========================
// BANNERS — TABELA
// ========================
function renderBannerTable() {
  const tbody = document.getElementById('banners-tbody');
  if (!tbody) return;

  if (!banners.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-gray);padding:32px">
      Nenhum banner cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = banners.map(b => `
    <tr>
      <td>
        <img class="admin-table-img"
             src="${b.imagemUrl || 'https://placehold.co/80x40/1F2937/00AEEF?text=Banner'}"
             alt="${b.titulo || 'Banner'}" style="width:80px;height:40px;object-fit:cover">
      </td>
      <td>${b.titulo || '—'}</td>
      <td>${b.categoria || '—'}</td>
      <td>${b.ordem ?? '—'}</td>
      <td>
        <span style="
          display:inline-block;padding:2px 10px;border-radius:99px;font-size:.72rem;font-weight:700;
          background:${b.ativo !== false ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)'};
          color:${b.ativo !== false ? '#6EE7B7' : '#FCA5A5'}">
          ${b.ativo !== false ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="admin-table-actions">
          <button class="btn btn-outline btn-sm" onclick="editBanner('${b.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBanner('${b.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ========================
// BANNERS — FORM
// ========================
function setupBannerForm() {
  const form = document.getElementById('banner-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const data = {
      titulo: form['banner-titulo'].value.trim(),
      categoria: form['banner-categoria'].value,
      ordem: Number(form['banner-ordem'].value) || 0,
      ativo: form['banner-ativo'].checked,
      imagemUrl: uploadedBannerUrl || form['banner-imagemUrl'].value.trim(),
      imagemMobile: window.getBannerMobileUrl?.() || form['banner-imagemMobile'].value.trim(),
    };

    try {
      if (editingBannerId) {
        await updateDoc(doc(db, 'banners', editingBannerId), data);
        showMsg('Banner atualizado!', 'success');
        editingBannerId = null;
      } else {
        await addDoc(collection(db, 'banners'), data);
        showMsg('Banner criado!', 'success');
      }
      form.reset();
      uploadedBannerUrl = '';
      document.getElementById('banner-img-preview').innerHTML = '';
      btn.textContent = 'Salvar banner';
      document.getElementById('banner-form-title').textContent = 'Adicionar banner';
      document.getElementById('btn-cancel-banner').style.display = 'none';
      await loadBanners();
    } catch (err) {
      showMsg('Erro ao salvar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-cancel-banner')?.addEventListener('click', () => {
    editingBannerId = null;
    form.reset();
    uploadedBannerUrl = '';
    document.getElementById('banner-img-preview').innerHTML = '';
    document.getElementById('banner-form-title').textContent = 'Adicionar banner';
    document.getElementById('btn-cancel-banner').style.display = 'none';
  });
}

window.editBanner = function (id) {
  const b = banners.find(x => x.id === id);
  if (!b) return;

  editingBannerId = id;
  const form = document.getElementById('banner-form');
  form['banner-titulo'].value = b.titulo || '';
  form['banner-categoria'].value = b.categoria || '';
  form['banner-ordem'].value = b.ordem ?? 0;
  form['banner-ativo'].checked = b.ativo !== false;
  form['banner-imagemUrl'].value = b.imagemUrl || '';
  uploadedBannerUrl = b.imagemUrl || '';

  if (b.imagemUrl) {
    document.getElementById('banner-img-preview').innerHTML =
      `<img src="${b.imagemUrl}" style="max-height:80px;border-radius:8px;margin-top:8px">`;
  }

  document.getElementById('banner-form-title').textContent = 'Editar banner';
  document.getElementById('btn-cancel-banner').style.display = 'inline-flex';
  document.querySelector('[data-panel="panel-banners"]')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteBanner = async function (id) {
  if (!confirm('Deseja realmente excluir este banner?')) return;
  try {
    await deleteDoc(doc(db, 'banners', id));
    showMsg('Banner excluído.', 'success');
    await loadBanners();
  } catch (err) {
    showMsg('Erro: ' + err.message, 'error');
  }
};

// ========================
// BANNERS — UPLOAD
// ========================
function setupBannerUpload() {
  const area = document.getElementById('banner-upload-area');
  const input = document.getElementById('banner-img-input');
  const preview = document.getElementById('banner-img-preview');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) uploadBannerFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) uploadBannerFile(input.files[0]);
  });

  async function uploadBannerFile(file) {
    area.querySelector('p').textContent = 'Enviando...';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST', body: fd
      });
      const data = await res.json();
      uploadedBannerUrl = data.secure_url;
      preview.innerHTML = `<img src="${uploadedBannerUrl}" style="max-height:80px;border-radius:8px;margin-top:8px">`;
      area.querySelector('p').textContent = 'Banner enviado com sucesso!';
    } catch (err) {
      area.querySelector('p').textContent = 'Erro no upload. Tente novamente.';
      showMsg('Erro no upload: ' + err.message, 'error');
    }
  }
}

// Código referente ao imagens banner para mobile 
function setupBannerUploadMobile() {
  const area = document.getElementById('banner-upload-area-mobile');
  const input = document.getElementById('banner-img-input-mobile');
  const preview = document.getElementById('banner-img-preview-mobile');

  if (!area || !input) return;

  let uploadedBannerMobileUrl = '';

  area.addEventListener('click', () => input.click());

  area.addEventListener('dragover', e => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) uploadFile(input.files[0]);
  });

  async function uploadFile(file) {
    area.querySelector('p').textContent = 'Enviando...';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: fd
      });

      const data = await res.json();
      uploadedBannerMobileUrl = data.secure_url;

      preview.innerHTML = `
        <img src="${uploadedBannerMobileUrl}" 
             style="max-height:80px;border-radius:8px;margin-top:8px">
      `;

      area.querySelector('p').textContent = 'Imagem enviada com sucesso!';
    } catch (err) {
      area.querySelector('p').textContent = 'Erro no upload.';
      showMsg('Erro no upload: ' + err.message, 'error');
    }
  }

  // 👉 disponibiliza globalmente para o form usar
  window.getBannerMobileUrl = () => uploadedBannerMobileUrl;
}

// ========================
// FEEDBACK
// ========================
function showMsg(msg, type = 'success') {
  const el = document.getElementById('admin-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `login-error${type === 'success' ? '' : ''} visible`;
  el.style.borderLeftColor = type === 'success' ? 'var(--color-success)' : 'var(--color-danger)';
  el.style.color = type === 'success' ? '#6EE7B7' : '#FCA5A5';
  setTimeout(() => el.classList.remove('visible'), 3500);
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  console.log("logout clicado");

  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error("erro ao sair:", error);
  }
});