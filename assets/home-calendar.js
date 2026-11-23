/* 主界面内联日历：把当前年的可预期节点直接嵌进 play 主界面（header 之后），
   纯随机突发（kind=event）不标注。独立注入，不改动核心模板，删除文件即可回退。 */
(function () {
  'use strict';
  if (window.MBLHomeCalendar) return;
  var C = window.MBLCore;
  var make = C.h;

  var POOL_CN = {
    business: '事业经营', camp: '训练营', campus: '校园', child: '子女', early: '早年',
    elder: '晚年', game: '关键比赛', hoops: '篮球抉择', job: '工作抉择', life: '生活抉择',
    media: '媒体', money: '财务抉择', offseason: '休赛期安排', playoffs: '季后赛',
    son: '子女', team: '球队抉择', teen: '青少年'
  };

  function nodeLabel(m) {
    if (m.kind === 'season') return '赛季节点';
    if (m.tid && typeof b0 === 'function') {
      var t = b0(m.tid);
      if (t && t.title) return C.hans(t.title);
    }
    return POOL_CN[m.pool] || m.pool || '抉择';
  }

  var box = make('section', 'mbl-home-cal');
  var cal = make('div', 'mbl-hc-grid');
  box.append(cal);

  function render(l) {
    cal.replaceChildren();
    if (!l) return;
    var baseYear = (typeof Ee !== 'undefined' ? Ee : 0) + l.age;
    var progress = (typeof bB === 'function' && bB(l)) ? Math.min(1, de.acc / bB(l)) : 0;

    var head = make('div', 'mbl-hc-head');
    head.append(make('span', 'mbl-hc-age', l.age + '岁'));
    head.append(make('span', 'mbl-hc-year', baseYear + '年'));
    cal.append(head);

    var byMonth = {};
    (l.moments || []).forEach(function (m) {
      if (m.kind === 'event') return;
      var mi = Math.min(11, Math.max(0, Math.floor(m.at * 12)));
      (byMonth[mi] || (byMonth[mi] = [])).push(m);
    });

    var grid = make('div', 'mbl-hc-months');
    for (var mi = 0; mi < 12; mi++) {
      var cell = make('div', 'mbl-hc-cell');
      cell.append(make('div', 'mbl-hc-month', (mi + 1) + '月'));
      var items = make('div', 'mbl-hc-items');
      (byMonth[mi] || []).forEach(function (m) {
        var isDone = m.at <= progress + 0.001;
        var isCurrent = !isDone && Math.abs(m.at - progress) < 0.06;
        var chip = make('div', 'mbl-hc-node' + (isDone ? ' is-done' : isCurrent ? ' is-current' : ''));
        chip.append(
          make('span', 'mbl-hc-ico', m.kind === 'season' ? '🏆' : '▸'),
          make('span', 'mbl-hc-text', nodeLabel(m))
        );
        items.append(chip);
      });
      cell.append(items);
      grid.append(cell);
    }
    cal.append(grid);

    var legend = make('div', 'mbl-hc-legend');
    legend.append(make('span', '', '▸ 待抉择/事件'));
    legend.append(make('span', '', '🏆 赛季节点'));
    legend.append(make('span', '', '已发生置灰'));
    cal.append(legend);
  }

  function mount() {
    var main = document.querySelector('main.play');
    if (!main) return;
    if (box.parentElement === main) { render(de.life); return; }
    var header = main.querySelector('header.lifebar');
    if (header && header.nextSibling) main.insertBefore(box, header.nextSibling);
    else main.append(box);
    render(de.life);
  }

  // 只在 play 界面触发，进一步减少无关查询
  C.onDom(mount, 'play');
  mount();

  window.MBLHomeCalendar = { refresh: function () { mount(); } };
})();
