export function setTabs() {
  const tabs = [...document.querySelectorAll('.tab[data-tab]')];
  const panels = [...document.querySelectorAll('.panel')];
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('is-active'));
    t.classList.add('is-active');
    panels.forEach((p) => p.classList.toggle('is-visible', p.id === t.dataset.tab));
  }));
}

export function renderList(el, items) {
  el.innerHTML = '';
  items.forEach((html) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = html;
    el.appendChild(div);
  });
}

export function priorityColor(level) {
  return level === 'high' ? 'alert-high' : level === 'med' ? 'alert-med' : 'alert-low';
}
