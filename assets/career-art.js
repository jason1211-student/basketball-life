/* Local illustration assets for career screens. */
(function () {
  'use strict';
  const C = window.MBLCore, h = C.h;
  const directory = 'assets/images/career/';
  const portraitCount = 3;
  const portraitName = (life,index) => (life.sex==='female'?'portrait-w-':'portrait-') + (index + 1);
  const palettes = ['navy', 'cream', 'red', 'green', 'blue', 'purple'];

  function hash(value) {
    let result = 0;
    for (const letter of String(value ?? '')) result = (Math.imul(result, 31) + letter.codePointAt(0)) >>> 0;
    return result;
  }

  function picture(name, size, lazy = true) {
    const image = h('img', 'mbl-career-image');
    image.alt = '';
    image.width = image.height = size;
    image.decoding = 'async';
    if (lazy) image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    image.src = directory + name + '.webp';
    return image;
  }

  function portraitIndex(life) {
    const chosen = life.flags?.mblPortrait;
    return Number.isInteger(chosen) && chosen >= 0 && chosen < portraitCount
      ? chosen : hash(life.seed) % portraitCount;
  }

  function portrait(life, name, age) {
    const frame = h('span', 'mbl-career-portrait', Array.from(name || '球')[0]);
    frame.setAttribute('aria-hidden', 'true');
    if (life && age >= 16) frame.append(picture(portraitName(life,portraitIndex(life)), 320, false));
    return frame;
  }

  function profile(p) {
    const life = p.isMe ? C.life() : null;
    const frame = portrait(life, p.name, p.age);
    if (p.source !== 'career' || !life || p.age < 16) return frame;

    const group = h('div', 'mbl-art-profile');
    const picker = h('details', 'mbl-art-picker');
    const options = h('div', 'mbl-art-options');
    const status = h('span', 'mbl-art-status');
    status.setAttribute('role', 'status');
    picker.append(h('summary', '', '换肖像'), options, status);
    group.append(frame, picker);
    function refresh() {
      for (const button of options.children) {
        button.setAttribute('aria-pressed', String(Number(button.value) === portraitIndex(life)));
      }
    }
    for (let i = 0; i < portraitCount; i++) {
      const button = h('button', 'mbl-art-option');
      button.type = 'button';
      button.value = i;
      button.setAttribute('aria-label', '肖像 ' + (i + 1));
      button.append(picture(portraitName(life,i), 320));
      button.onclick = () => {
        if (C.life() !== life || !button.isConnected) return;
        const previous = life.flags.mblPortrait;
        life.flags.mblPortrait = i;
        try {
          Nt.saveLife(life);
          if (window.MBLAutoSave && !MBLAutoSave.save()) throw new Error('save failed');
        } catch (_) {
          if (previous === undefined) delete life.flags.mblPortrait;
          else life.flags.mblPortrait = previous;
          try { Nt.saveLife(life); } catch (_) { /* Preserve the previous selection. */ }
          status.textContent = '肖像保存失败';
          return;
        }
        const next = portrait(life, p.name, p.age);
        frame.replaceChildren(...next.childNodes);
        refresh();
        header(document.querySelector('.lifebar .arena-player-avatar'),life);
        status.textContent = '已选择肖像 ' + (i + 1);
      };
      options.append(button);
    }
    refresh();
    return group;
  }

  function header(host,life) {
    if(!host || !life || life.age<16) return;
    const name=portraitName(life,portraitIndex(life));
    const current=host.querySelector('.mbl-career-image');
    if(current?.dataset.asset===name) return;
    const image=picture(name,320,false);
    image.classList.add('portrait');
    image.dataset.asset=name;
    if(current)current.replaceWith(image);
    else host.prepend(image);
  }

  function palette(team) {
    const color = window.MBLBroadcast?.teamColor(team);
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) return palettes[hash(team?.en || C.hans(team)) % palettes.length];
    const [r, g, b] = color.slice(1).match(/../g).map(v => parseInt(v, 16));
    if (Math.max(r,g,b) - Math.min(r,g,b) < 50) return r > 150 ? 'cream' : 'navy';
    if (r > 185 && g > 120 && b < 100) return 'cream';
    if (b >= r && b >= g) return r >= b * .55 ? 'purple' : 'blue';
    if (g > r) return 'green';
    return 'red';
  }

  function jersey(team, number) {
    const figure = h('figure', 'mbl-art-jersey');
    const label = h('figcaption', '', C.hans(team) || '训练球衣');
    figure.append(picture('jersey-' + palette(team), 320), h('b', 'mbl-art-jersey-number'), label);
    setNumber(figure, number);
    return figure;
  }

  function setNumber(figure, value) {
    const label = figure?.querySelector('.mbl-art-jersey-number');
    if (!label) return;
    const number = value == null || value === '' ? '' : String(value);
    label.textContent = /^\d{1,2}$/.test(number) ? number : '';
    label.setAttribute('aria-label', label.textContent ? label.textContent + ' 号' : '未选号码');
  }

  window.MBLCareerArt = { picture, profile, header, jersey, setNumber };
})();
