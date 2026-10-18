(() => {
  'use strict';

  const APP_VERSION = '1.0.1';
  const STORAGE_KEY = 'northstar.products.variant5.v1';
  const DEMO_PRODUCTS = [
    { id: 'SKU-001', name: 'Органайзер Acacia', description: 'Настільний органайзер із натурального дерева.', price: 29.9, dateAdded: '2026-10-01', stock: 1 },
    { id: 'SKU-002', name: 'Термос Travel', description: 'Термос із нержавної сталі, об’єм 500 мл.', price: 10, dateAdded: '2026-10-02', stock: 1 },
    { id: 'SKU-003', name: 'Сумка Cotton', description: 'Бавовняна торба для щоденних покупок.', price: 100, dateAdded: '2026-10-03', stock: 1 },
    { id: 'SKU-004', name: 'Чашка Stoneware', description: 'Керамічна чашка ручної роботи.', price: 9.5, dateAdded: '2026-10-04', stock: 0 },
    { id: 'SKU-005', name: 'Клавіатура Wireless', description: 'Компактна бездротова клавіатура.', price: 399.99, dateAdded: '2026-10-05', stock: 1 },
    { id: 'SKU-006', name: 'Піднос Wooden', description: 'Дерев’яний піднос із заокругленими краями.', price: 9.5, dateAdded: '2026-10-06', stock: 0 }
  ];
  const collator = new Intl.Collator('uk-UA', { numeric: true, sensitivity: 'base' });
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get('demo') === '1';
  const testMode = params.get('test') === '1';
  const byId = (id) => document.getElementById(id);
  const form = byId('product-form');
  const dialog = byId('product-dialog');
  const selectedIds = new Set();
  let products = loadProducts();
  let sortState = { field: null, direction: 'ascending' };
  let editingId = null;
  let toastTimer = null;
  let lastUpdated = readLastUpdated();

  if (demoMode && params.get('sort') === 'price') {
    sortState = { field: 'price', direction: params.get('direction') === 'descending' ? 'descending' : 'ascending' };
  }

  function cloneProducts(items) {
    return items.map((item) => ({ ...item }));
  }

  function loadProducts() {
    if (testMode) return [];
    if (demoMode) return cloneProducts(DEMO_PRODUCTS);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(isValidStoredProduct).map(normalizeStoredProduct) : [];
    } catch {
      return [];
    }
  }

  function isValidStoredProduct(item) {
    return item && typeof item.id === 'string' && typeof item.name === 'string' &&
      Number.isFinite(Number(item.price)) && typeof item.dateAdded === 'string' &&
      (item.stock === 0 || item.stock === 1 || item.stock === '0' || item.stock === '1');
  }

  function normalizeStoredProduct(item) {
    return { id: item.id, name: item.name, description: String(item.description || ''), price: Number(item.price), dateAdded: item.dateAdded, stock: Number(item.stock) };
  }

  function readLastUpdated() {
    try { return localStorage.getItem(`${STORAGE_KEY}.updated`) || ''; } catch { return ''; }
  }

  function saveProducts() {
    if (demoMode || testMode) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      localStorage.setItem(`${STORAGE_KEY}.updated`, lastUpdated);
    } catch {
      showToast('Браузер не дозволив зберегти зміни локально.', true);
    }
  }

  function normalizePrice(raw) {
    return String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  }

  function validateProduct(raw, excludeId = null) {
    const value = {
      id: String(raw.id ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      description: String(raw.description ?? '').trim(),
      priceText: normalizePrice(raw.price),
      dateAdded: String(raw.dateAdded ?? '').trim(),
      stock: String(raw.stock ?? '')
    };
    const errors = {};
    if (!value.id) errors.id = 'Вкажіть ID товару.';
    else if (value.id.length > 40) errors.id = 'ID має містити не більше 40 символів.';
    else if (products.some((item) => item.id.toLocaleLowerCase('uk-UA') === value.id.toLocaleLowerCase('uk-UA') && item.id !== excludeId)) errors.id = 'Товар із таким ID уже існує.';
    if (!value.name) errors.name = 'Вкажіть назву товару.';
    if (!value.priceText) errors.price = 'Вкажіть ціну товару.';
    else if (!/^(?:\d+|\d*[.]\d+)$/.test(value.priceText) || !Number.isFinite(Number(value.priceText)) || Number(value.priceText) < 0) errors.price = 'Ціна має бути невід’ємним числом.';
    if (!value.dateAdded) errors.dateAdded = 'Вкажіть дату додавання.';
    else if (!isValidDate(value.dateAdded)) errors.dateAdded = 'Вкажіть коректну дату.';
    if (value.stock !== '0' && value.stock !== '1') errors.stock = 'Оберіть стан наявності.';
    return { errors, product: { id: value.id, name: value.name, description: value.description, price: Number(value.priceText), dateAdded: value.dateAdded, stock: Number(value.stock) } };
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function sortProducts(items, field, direction = 'ascending') {
    if (!field) return cloneProducts(items);
    const sign = direction === 'descending' ? -1 : 1;
    return cloneProducts(items).sort((a, b) => {
      const comparison = field === 'price'
        ? Number(a.price) - Number(b.price)
        : collator.compare(String(a[field] ?? ''), String(b[field] ?? ''));
      if (comparison !== 0) return sign * comparison;
      return collator.compare(a.id, b.id);
    });
  }

  function createProduct(raw) {
    const checked = validateProduct(raw);
    if (Object.keys(checked.errors).length) return { ok: false, errors: checked.errors };
    products.push(checked.product);
    markChanged();
    render();
    return { ok: true, product: { ...checked.product } };
  }

  function updateProduct(originalId, raw) {
    const index = products.findIndex((item) => item.id === originalId);
    if (index < 0) return { ok: false, errors: { form: 'Товар більше не знайдено. Оновіть список.' } };
    const checked = validateProduct(raw, originalId);
    if (Object.keys(checked.errors).length) return { ok: false, errors: checked.errors };
    products[index] = checked.product;
    if (originalId !== checked.product.id) selectedIds.delete(originalId);
    markChanged();
    render();
    return { ok: true, product: { ...checked.product } };
  }

  function deleteProduct(id) {
    const before = products.length;
    products = products.filter((item) => item.id !== id);
    selectedIds.delete(id);
    if (products.length === before) return false;
    markChanged();
    render();
    return true;
  }

  function markChanged() {
    lastUpdated = new Date().toISOString();
    saveProducts();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function formatPrice(value) {
    return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  function formatDate(value) {
    if (!isValidDate(value)) return value;
    return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  }

  function iconTone(index) { return `tone-${index % 4}`; }

  function getVisibleProducts() {
    const query = byId('search-input').value.trim().toLocaleLowerCase('uk-UA');
    const stockFilter = byId('stock-filter').value;
    const filtered = products.filter((item) => {
      const matchesQuery = !query || [item.id, item.name, item.description].some((value) => value.toLocaleLowerCase('uk-UA').includes(query));
      const matchesStock = stockFilter === 'all' || String(item.stock) === stockFilter;
      return matchesQuery && matchesStock;
    });
    return sortState.field ? sortProducts(filtered, sortState.field, sortState.direction) : filtered;
  }

  function renderRows() {
    const tbody = byId('product-rows');
    const visible = getVisibleProducts();
    const totalEmpty = products.length === 0;
    byId('empty-state').hidden = !totalEmpty;
    byId('no-results').hidden = totalEmpty || visible.length > 0;
    tbody.hidden = totalEmpty || visible.length === 0;
    tbody.innerHTML = visible.map((item, index) => `
      <tr data-row-id="${escapeHtml(item.id)}">
        <td class="check-col"><input class="row-check" type="checkbox" data-select-id="${escapeHtml(item.id)}" aria-label="Вибрати ${escapeHtml(item.name)}" ${selectedIds.has(item.id) ? 'checked' : ''}></td>
        <td><span class="product-id">${escapeHtml(item.id)}</span></td>
        <td><span class="product-name"><span class="product-icon ${iconTone(index)}" aria-hidden="true">${['◈','◌','◉','▤'][index % 4]}</span>${escapeHtml(item.name)}</span></td>
        <td><span class="description-text" title="${escapeHtml(item.description)}">${escapeHtml(item.description || '—')}</span></td>
        <td class="price-cell">₴ ${formatPrice(item.price)}</td>
        <td class="date-cell">${escapeHtml(formatDate(item.dateAdded))}</td>
        <td><span class="stock-badge ${item.stock ? 'in-stock' : 'out-stock'}">${item.stock ? 'Є в наявності' : 'Немає'}</span></td>
        <td class="actions-col"><div class="row-actions"><button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(item.id)}" aria-label="Редагувати ${escapeHtml(item.name)}" title="Редагувати">✎</button><button class="row-action delete" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" aria-label="Видалити ${escapeHtml(item.name)}" title="Видалити">⌫</button></div></td>
      </tr>`).join('');
    byId('nav-count').textContent = products.length;
    byId('stat-total').textContent = products.length;
    byId('stat-stock').textContent = products.filter((item) => item.stock === 1).length;
    const average = products.length ? products.reduce((sum, item) => sum + item.price, 0) / products.length : null;
    byId('stat-average').textContent = average === null ? '—' : `₴ ${formatPrice(average)}`;
    byId('stat-updated').textContent = lastUpdated ? new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short' }).format(new Date(lastUpdated)) : 'Ще не змінювався';
    byId('results-label').textContent = `Показано ${visible.length} з ${products.length} ${pluralize(visible.length, 'товар', 'товари', 'товарів')}`;
    const selectAll = byId('select-all');
    selectAll.checked = visible.length > 0 && visible.every((item) => selectedIds.has(item.id));
    selectAll.indeterminate = visible.some((item) => selectedIds.has(item.id)) && !selectAll.checked;
    document.querySelectorAll('[data-sort]').forEach((button) => {
      const active = sortState.field === button.dataset.sort;
      const th = button.closest('th');
      if (active) th.setAttribute('aria-sort', sortState.direction);
      else th.removeAttribute('aria-sort');
      button.querySelector('.sort-mark').textContent = active ? (sortState.direction === 'ascending' ? '↑' : '↓') : '↕';
    });
  }

  function pluralize(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const last = n % 10;
    if (n > 10 && n < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  function render() {
    renderRows();
  }

  function rawFormData() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function clearFieldErrors() {
    form.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
    form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
    byId('form-error').hidden = true;
    byId('form-error').textContent = '';
  }

  function showErrors(errors) {
    clearFieldErrors();
    for (const [field, message] of Object.entries(errors)) {
      if (field === 'form') {
        byId('form-error').textContent = message;
        byId('form-error').hidden = false;
        continue;
      }
      const target = form.querySelector(`[data-error="${field}"]`);
      if (target) {
        target.textContent = message;
        target.closest('.field').classList.add('has-error');
      }
    }
  }

  function resetForm() {
    form.reset();
    const today = new Date();
    byId('field-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    byId('field-stock').value = '1';
    clearFieldErrors();
  }

  function openCreateDialog() {
    editingId = null;
    resetForm();
    byId('dialog-title').textContent = 'Новий товар';
    byId('save-product').textContent = 'Зберегти товар';
    dialog.showModal();
    byId('field-id').focus();
  }

  function openEditDialog(id) {
    const item = products.find((product) => product.id === id);
    if (!item) return;
    editingId = item.id;
    resetForm();
    byId('field-id').value = item.id;
    byId('field-name').value = item.name;
    byId('field-description').value = item.description;
    byId('field-price').value = String(item.price);
    byId('field-date').value = item.dateAdded;
    byId('field-stock').value = String(item.stock);
    byId('dialog-title').textContent = 'Редагувати товар';
    byId('save-product').textContent = 'Зберегти зміни';
    dialog.showModal();
    byId('field-name').focus();
  }

  function showToast(message, error = false) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function exportCsv() {
    const columns = [['id','ID'],['name','Назва'],['description','Опис'],['price','Ціна'],['dateAdded','Дата додавання'],['stock','На складі (1/0)']];
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const content = [columns.map(([, label]) => quote(label)).join(';'), ...products.map((item) => columns.map(([key]) => quote(item[key])).join(';'))].join('\r\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products-variant-5.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Каталог експортовано у CSV.');
  }

  byId('new-product-button').addEventListener('click', openCreateDialog);
  byId('empty-add-button').addEventListener('click', openCreateDialog);
  byId('close-dialog').addEventListener('click', () => dialog.close());
  byId('cancel-dialog').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFieldErrors();
    const result = editingId ? updateProduct(editingId, rawFormData()) : createProduct(rawFormData());
    if (!result.ok) {
      showErrors(result.errors);
      const firstField = Object.keys(result.errors).find((key) => key !== 'form');
      if (firstField) byId(`field-${firstField === 'dateAdded' ? 'date' : firstField}`).focus();
      return;
    }
    dialog.close();
    showToast(editingId ? 'Зміни товару збережено.' : 'Товар додано до каталогу.');
    editingId = null;
    form.reset();
  });
  document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => {
    const field = button.dataset.sort;
    sortState = { field, direction: sortState.field === field && sortState.direction === 'ascending' ? 'descending' : 'ascending' };
    renderRows();
  }));
  byId('search-input').addEventListener('input', renderRows);
  byId('stock-filter').addEventListener('change', renderRows);
  byId('clear-filters').addEventListener('click', () => { byId('search-input').value = ''; byId('stock-filter').value = 'all'; renderRows(); });
  byId('export-button').addEventListener('click', exportCsv);
  byId('select-all').addEventListener('change', (event) => {
    getVisibleProducts().forEach((item) => event.target.checked ? selectedIds.add(item.id) : selectedIds.delete(item.id));
    renderRows();
  });
  byId('product-rows').addEventListener('change', (event) => {
    const id = event.target.dataset.selectId;
    if (!id) return;
    if (event.target.checked) selectedIds.add(id); else selectedIds.delete(id);
    renderRows();
  });
  byId('product-rows').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'edit') openEditDialog(id);
    if (button.dataset.action === 'delete' && window.confirm(`Видалити товар «${products.find((item) => item.id === id)?.name || id}»?`)) {
      deleteProduct(id);
      showToast('Товар видалено.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); byId('search-input').focus(); }
  });

  byId('app-version').textContent = `Версія ${APP_VERSION}`;
  byId('footer-version').textContent = APP_VERSION;
  window.InventoryApp = {
    getProducts: () => cloneProducts(products),
    validateProduct,
    sortProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    setProductsForTest(items) { products = cloneProducts(items); render(); },
    getVisibleProducts,
    version: APP_VERSION
  };
  render();
})();
