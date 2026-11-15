/**
 * PhysioHead Live - tiny DOM helpers.
 * Text is always inserted as text nodes, never as HTML, so nothing a visitor
 * types can run as code on the page.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && key !== 'list' && key !== 'form') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function formatTime(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

export function formatDateTime(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(ms));
}

/** Message shown to a person for each store error code. */
export function errorMessage(error, limit = 300) {
  switch (error?.code) {
    case 'too-fast': return `Please wait ${error.wait || 'a few'} seconds before sending again.`;
    case 'locked': return 'This is paused by the moderators.';
    case 'invalid': return `Please enter up to ${limit} characters.`;
    case 'denied': return 'You do not have permission to do that.';
    case 'offline': return 'You appear to be offline. Please try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

/** Tab strip with the same keyboard behaviour as the Activities hub. */
export function setupTabs(root, onChange) {
  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) tab.focus();
    if (onChange) onChange(tab);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in keys) {
        e.preventDefault();
        select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
      } else if (e.key === 'Home') {
        e.preventDefault();
        select(tabs[0], true);
      } else if (e.key === 'End') {
        e.preventDefault();
        select(tabs[tabs.length - 1], true);
      }
    });
  });
  return { select: (id) => { const t = tabs.find((x) => x.id === id); if (t) select(t); } };
}
