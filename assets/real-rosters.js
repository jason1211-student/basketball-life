/* 真实球员增强层（单机离线）。
 * 1. 补全 1984/1996/2003/2009 四届缺失的球员模板，合并进全局球员池 Or（去重）。
 * 2. 包装内核 roster 构造函数 W_/D8，对知名球星用参考 NBA2K 的五维
 *    （sh 投射 / ins 内线 / pm 组织 / df 防守 / ath 运动）覆盖哈希派生值。
 * 不重写内核逻辑，只在产出对象上做温和覆盖；普通球员与旧档不受影响。 */
(function () {
  'use strict';
  if (window.MBLRealRosters) return;

  var FIVE = ['sh', 'ins', 'pm', 'df', 'ath'];

  // ---------- 1984 届缺失首轮（22 人），字段对齐原生 Or 模板 ----------
  // pos: guard/wing/big；at: pg/sg/sf/pf/c；draft 1984；stints 先留空，履历后续阶段补。
  function t(en, hans, born, pos, at, peak) {
    return { name: { en: en, hans: hans }, born: born, country: 'US', pos: pos, at: at,
      peak: peak, draft: 1984, legend: false, stints: [] };
  }
  var DRAFT_1984 = [
    t('Sam Bowie', '萨姆·鲍维', 1961, 'big', 'c', 76),
    t('Sam Perkins', '萨姆·帕金斯', 1961, 'big', 'pf', 80),
    t('Charles Barkley', '查尔斯·巴克利', 1963, 'big', 'pf', 94),
    t('Melvin Turpin', '梅尔文·特平', 1960, 'big', 'c', 68),
    t('Alvin Robertson', '阿尔文·罗伯特森', 1962, 'guard', 'sg', 86),
    t('Lancaster Gordon', '兰开斯特·戈登', 1962, 'guard', 'sg', 66),
    t('Otis Thorpe', '奥蒂斯·索普', 1962, 'big', 'pf', 82),
    t('Leon Wood', '莱昂·伍德', 1962, 'guard', 'pg', 68),
    t('Kevin Willis', '凯文·威利斯', 1962, 'big', 'pf', 82),
    t('Tim McCormick', '蒂姆·麦科米克', 1962, 'big', 'c', 70),
    t('Jay Humphries', '杰伊·亨弗里斯', 1962, 'guard', 'pg', 76),
    t('Michael Cage', '迈克尔·凯奇', 1962, 'big', 'pf', 74),
    t('Terence Stansbury', '特伦斯·斯坦斯伯里', 1961, 'guard', 'sg', 70),
    t('John Stockton', '约翰·斯托克顿', 1962, 'guard', 'pg', 93),
    t('Jeff Turner', '杰夫·特纳', 1962, 'big', 'pf', 68),
    t('Vern Fleming', '弗恩·弗莱明', 1962, 'guard', 'pg', 74),
    t('Bernard Thompson', '伯纳德·汤普森', 1962, 'wing', 'sf', 68),
    t('Tony Campbell', '托尼·坎贝尔', 1962, 'wing', 'sf', 74),
    t('Kenny Fields', '肯尼·菲尔兹', 1962, 'wing', 'sf', 68),
    t('Tom Sewell', '汤姆·休厄尔', 1962, 'guard', 'sg', 60),
    t('Earl Jones', '厄尔·琼斯', 1961, 'big', 'c', 62),
    t('Michael Young', '迈克尔·杨', 1961, 'guard', 'sg', 66)
  ];

  // ---------- 1996 黄金一代缺失球员（22 人，含落选秀本·华莱士） ----------
  function u(en, hans, born, pos, at, peak, country) {
    return { name: { en: en, hans: hans }, born: born, country: country || 'US', pos: pos, at: at,
      peak: peak, draft: 1996, legend: false, stints: [] };
  }
  var DRAFT_1996 = [
    u('Allen Iverson', '阿伦·艾弗森', 1975, 'guard', 'pg', 93),
    u('Marcus Camby', '马库斯·坎比', 1974, 'big', 'c', 84),
    u('Shareef Abdur-Rahim', '谢里夫·阿卜杜勒-拉希姆', 1976, 'big', 'pf', 82),
    u('Stephon Marbury', '斯蒂芬·马布里', 1977, 'guard', 'pg', 85),
    u('Ray Allen', '雷·阿伦', 1975, 'guard', 'sg', 88),
    u('Antoine Walker', '安托万·沃克', 1976, 'big', 'pf', 82),
    u('Lorenzen Wright', '洛伦岑·赖特', 1975, 'big', 'pf', 74),
    u('Kerry Kittles', '克里·基特尔斯', 1974, 'guard', 'sg', 76),
    u('Samaki Walker', '萨马基·沃克', 1976, 'big', 'pf', 70),
    u('Erick Dampier', '埃里克·丹皮尔', 1975, 'big', 'c', 74),
    u('Todd Fuller', '托德·福勒', 1974, 'big', 'c', 68),
    u('Vitaly Potapenko', '维塔利·波塔潘科', 1975, 'big', 'c', 70, 'UA'),
    u('Tony Delk', '托尼·德尔克', 1974, 'guard', 'pg', 72),
    u("Jermaine O'Neal", '杰梅因·奥尼尔', 1978, 'big', 'pf', 83),
    u('John Wallace', '约翰·华莱士', 1974, 'big', 'sf', 70),
    u('Walter McCarty', '沃尔特·麦卡蒂', 1974, 'wing', 'sf', 70),
    u('Zydrunas Ilgauskas', '扎伊德鲁纳斯·伊尔戈斯卡斯', 1975, 'big', 'c', 82, 'LT'),
    u('Dontae Jones', '唐泰·琼斯', 1975, 'big', 'sf', 68),
    u('Roy Rogers', '罗伊·罗杰斯', 1973, 'big', 'pf', 68),
    u('Efthimios Rentzias', '埃夫西米奥斯·伦齐亚斯', 1976, 'big', 'c', 66, 'GR'),
    u('Derek Fisher', '德里克·费舍尔', 1974, 'guard', 'pg', 74),
    u('Ben Wallace', '本·华莱士', 1974, 'big', 'c', 87)
  ];

  // ---------- 2003 白金一代缺失球员（26 人） ----------
  function v(en, hans, born, pos, at, peak, country) {
    return { name: { en: en, hans: hans }, born: born, country: country || 'US', pos: pos, at: at,
      peak: peak, draft: 2003, legend: false, stints: [] };
  }
  var DRAFT_2003 = [
    v('Darko Milicic', '达科·米利西奇', 1985, 'big', 'c', 70, 'RS'),
    v('Carmelo Anthony', '卡梅隆·安东尼', 1984, 'wing', 'sf', 89),
    v('Chris Bosh', '克里斯·波什', 1984, 'big', 'pf', 88),
    v('Dwyane Wade', '德维恩·韦德', 1982, 'guard', 'sg', 93),
    v('Chris Kaman', '克里斯·卡曼', 1982, 'big', 'c', 78),
    v('Kirk Hinrich', '柯克·辛里奇', 1981, 'guard', 'pg', 76),
    v('T.J. Ford', 'T.J.福特', 1983, 'guard', 'pg', 74),
    v('Michael Sweetney', '迈克尔·斯威特尼', 1982, 'big', 'pf', 70),
    v('Jarvis Hayes', '贾维斯·海耶斯', 1981, 'wing', 'sf', 72),
    v('Mickael Pietrus', '迈克尔·皮特鲁斯', 1982, 'wing', 'sf', 74, 'FR'),
    v('Nick Collison', '尼克·科里森', 1980, 'big', 'pf', 72),
    v('Marcus Banks', '马库斯·班克斯', 1981, 'guard', 'pg', 72),
    v('Luke Ridnour', '卢克·里德诺', 1981, 'guard', 'pg', 72),
    v('Reece Gaines', '里斯·盖恩斯', 1981, 'guard', 'pg', 68),
    v('Troy Bell', '特洛伊·贝尔', 1981, 'guard', 'pg', 68),
    v('Zarko Cabarkapa', '扎科·卡巴卡帕', 1982, 'big', 'pf', 68, 'RS'),
    v('David West', '大卫·韦斯特', 1980, 'big', 'pf', 80),
    v('Sasha Pavlovic', '萨沙·帕夫洛维奇', 1983, 'wing', 'sf', 70, 'RS'),
    v('Dahntay Jones', '邓台·琼斯', 1980, 'wing', 'sf', 70),
    v('Zoran Planinic', '佐兰·普拉尼尼奇', 1982, 'guard', 'pg', 68, 'HR'),
    v('Travis Outlaw', '特拉维斯·奥特洛', 1984, 'big', 'sf', 70),
    v('Brian Cook', '布莱恩·库克', 1980, 'big', 'pf', 70),
    v('Carlos Delfino', '卡洛斯·德尔菲诺', 1982, 'wing', 'sf', 72, 'AR'),
    v('Ndudi Ebi', '恩杜迪·埃比', 1984, 'wing', 'sf', 66, 'GB'),
    v('Kendrick Perkins', '肯德里克·帕金斯', 1984, 'big', 'c', 76),
    v('Josh Howard', '约什·霍华德', 1980, 'wing', 'sf', 78)
  ];

  // ---------- 2009 届缺失球员（25 人） ----------
  function w(en, hans, born, pos, at, peak, country) {
    return { name: { en: en, hans: hans }, born: born, country: country || 'US', pos: pos, at: at,
      peak: peak, draft: 2009, legend: false, stints: [] };
  }
  var DRAFT_2009 = [
    w('Blake Griffin', '布雷克·格里芬', 1989, 'big', 'pf', 88),
    w('Hasheem Thabeet', '哈希姆·塔比特', 1987, 'big', 'c', 72, 'TZ'),
    w('Tyreke Evans', '泰瑞克·埃文斯', 1989, 'guard', 'pg', 80),
    w('Jonny Flynn', '乔尼·弗林', 1989, 'guard', 'pg', 72),
    w('Jordan Hill', '乔丹·希尔', 1987, 'big', 'pf', 72),
    w('Brandon Jennings', '布兰登·詹宁斯', 1989, 'guard', 'pg', 78),
    w('Terrence Williams', '泰伦斯·威廉姆斯', 1987, 'wing', 'sf', 72),
    w('Gerald Henderson', '杰拉德·亨德森', 1987, 'guard', 'sg', 70),
    w('Tyler Hansbrough', '泰勒·汉斯布鲁', 1985, 'big', 'pf', 72),
    w('Earl Clark', '厄尔·克拉克', 1988, 'big', 'pf', 70),
    w('Austin Daye', '奥斯汀·达耶', 1988, 'big', 'sf', 70),
    w('James Johnson', '詹姆斯·约翰逊', 1987, 'big', 'pf', 74),
    w('Ty Lawson', '泰·劳森', 1987, 'guard', 'pg', 78),
    w('Jeff Teague', '杰夫·蒂格', 1988, 'guard', 'pg', 78),
    w('Eric Maynor', '埃里克·梅诺', 1987, 'guard', 'pg', 70),
    w('Darren Collison', '达伦·科里森', 1986, 'guard', 'pg', 74),
    w('Victor Claver', '维克多·克拉夫', 1988, 'wing', 'sf', 70, 'ES'),
    w('Omri Casspi', '欧米·卡斯比', 1988, 'wing', 'sf', 72, 'IL'),
    w('Byron Mullens', '拜伦·穆伦斯', 1989, 'big', 'c', 68, 'GB'),
    w('Rodrigue Beaubois', '罗德里格·布博瓦', 1987, 'guard', 'pg', 72, 'FR'),
    w('Taj Gibson', '泰·吉布森', 1985, 'big', 'pf', 76),
    w('DeMarre Carroll', '德马雷·卡罗尔', 1986, 'wing', 'sf', 74),
    w('Wayne Ellington', '韦恩·艾灵顿', 1987, 'guard', 'sg', 72),
    w('Toney Douglas', '托尼·道格拉斯', 1987, 'guard', 'pg', 70),
    w('Christian Eyenga', '克里斯蒂安·埃延加', 1989, 'wing', 'sf', 68, 'CD')
  ];

  // ---------- 核心球员五维覆盖（含已在 Or 的乔丹/大梦），参考 NBA2K ----------
  var TRAITS = {
    'Michael Jordan':   { sh: 98, ins: 96, pm: 84, df: 99, ath: 99 },
    'Hakeem Olajuwon':  { sh: 90, ins: 98, pm: 72, df: 98, ath: 95 },
    'Charles Barkley':  { sh: 88, ins: 95, pm: 78, df: 85, ath: 90 },
    'John Stockton':    { sh: 90, ins: 70, pm: 98, df: 88, ath: 80 },
    'Sam Perkins':      { sh: 86, ins: 72, pm: 68, df: 72, ath: 72 },
    'Alvin Robertson':  { sh: 78, ins: 72, pm: 80, df: 96, ath: 85 },
    'Otis Thorpe':      { sh: 74, ins: 88, pm: 60, df: 78, ath: 82 },
    'Kevin Willis':     { sh: 72, ins: 86, pm: 58, df: 78, ath: 80 },
    'Sam Bowie':        { sh: 70, ins: 78, pm: 62, df: 76, ath: 72 },

    // 1996 黄金一代（含已在 Or 的科比/纳什/佩贾）
    'Kobe Bryant':        { sh: 92, ins: 90, pm: 82, df: 90, ath: 94 },
    'Allen Iverson':      { sh: 90, ins: 88, pm: 84, df: 78, ath: 95 },
    'Steve Nash':         { sh: 92, ins: 66, pm: 98, df: 70, ath: 78 },
    'Ray Allen':          { sh: 96, ins: 72, pm: 76, df: 80, ath: 82 },
    'Peja Stojaković':    { sh: 92, ins: 70, pm: 72, df: 70, ath: 74 },
    'Ben Wallace':        { sh: 40, ins: 72, pm: 40, df: 98, ath: 84 },
    'Marcus Camby':       { sh: 66, ins: 80, pm: 60, df: 92, ath: 82 },
    'Stephon Marbury':    { sh: 86, ins: 80, pm: 90, df: 72, ath: 86 },
    "Jermaine O'Neal":   { sh: 76, ins: 86, pm: 66, df: 86, ath: 84 },
    'Zydrunas Ilgauskas': { sh: 78, ins: 86, pm: 62, df: 80, ath: 72 },
    'Antoine Walker':     { sh: 80, ins: 76, pm: 78, df: 72, ath: 78 },
    'Shareef Abdur-Rahim': { sh: 78, ins: 88, pm: 70, df: 74, ath: 80 },

    // 2003 白金一代（含已在 Or 的詹姆斯/迪奥/巴博萨）
    'LeBron James':      { sh: 90, ins: 88, pm: 90, df: 86, ath: 96 },
    'Dwyane Wade':       { sh: 90, ins: 86, pm: 82, df: 84, ath: 93 },
    'Carmelo Anthony':   { sh: 92, ins: 90, pm: 76, df: 76, ath: 84 },
    'Chris Bosh':        { sh: 84, ins: 88, pm: 74, df: 82, ath: 82 },
    'David West':        { sh: 80, ins: 86, pm: 68, df: 78, ath: 76 },
    'Chris Kaman':       { sh: 76, ins: 84, pm: 64, df: 78, ath: 72 },
    'Kirk Hinrich':      { sh: 80, ins: 68, pm: 82, df: 82, ath: 76 },
    'Boris Diaw':        { sh: 78, ins: 78, pm: 82, df: 76, ath: 78 },
    'Kendrick Perkins':  { sh: 58, ins: 74, pm: 50, df: 86, ath: 70 },
    'Leandro Barbosa':   { sh: 84, ins: 72, pm: 74, df: 72, ath: 90 },
    'Josh Howard':       { sh: 82, ins: 76, pm: 72, df: 82, ath: 82 },
    'Darko Milicic':     { sh: 66, ins: 72, pm: 60, df: 70, ath: 72 },

    // 2009 届（含已在 Or 的库里/哈登/德罗赞/霍勒迪/卢比奥）
    'Stephen Curry':     { sh: 98, ins: 74, pm: 94, df: 76, ath: 84 },
    'James Harden':      { sh: 92, ins: 84, pm: 92, df: 78, ath: 86 },
    'Blake Griffin':     { sh: 80, ins: 88, pm: 72, df: 82, ath: 90 },
    'DeMar DeRozan':     { sh: 88, ins: 86, pm: 76, df: 80, ath: 86 },
    'Jrue Holiday':      { sh: 80, ins: 74, pm: 84, df: 92, ath: 82 },
    'Ricky Rubio':       { sh: 72, ins: 66, pm: 90, df: 80, ath: 76 },
    'Tyreke Evans':      { sh: 82, ins: 80, pm: 78, df: 74, ath: 86 },
    'Brandon Jennings':  { sh: 84, ins: 72, pm: 82, df: 72, ath: 84 },
    'Jeff Teague':       { sh: 82, ins: 72, pm: 82, df: 76, ath: 86 },
    'Ty Lawson':         { sh: 82, ins: 72, pm: 84, df: 72, ath: 90 },
    'Taj Gibson':        { sh: 74, ins: 82, pm: 60, df: 82, ath: 76 },
    'Hasheem Thabeet':   { sh: 56, ins: 72, pm: 50, df: 80, ath: 74 },

    // 历史传奇（1990s–2000s，含已在 Or 的名人堂成员）
    'Tim Duncan':        { sh: 86, ins: 97, pm: 76, df: 96, ath: 82 },
    'Dirk Nowitzki':     { sh: 96, ins: 86, pm: 74, df: 78, ath: 76 },
    'Chris Paul':        { sh: 90, ins: 74, pm: 97, df: 92, ath: 84 },
    'Vince Carter':      { sh: 86, ins: 82, pm: 76, df: 80, ath: 95 },
    'Yao Ming':          { sh: 84, ins: 94, pm: 72, df: 90, ath: 74 },
    'Tony Parker':       { sh: 84, ins: 82, pm: 88, df: 72, ath: 84 },
    'Pau Gasol':         { sh: 84, ins: 90, pm: 82, df: 82, ath: 78 },
    'Marc Gasol':        { sh: 82, ins: 88, pm: 82, df: 88, ath: 72 },
    'Manu Ginóbili':     { sh: 86, ins: 78, pm: 84, df: 84, ath: 82 },
    'Arvydas Sabonis':   { sh: 84, ins: 90, pm: 88, df: 84, ath: 76 },
    'Dražen Petrović':   { sh: 93, ins: 76, pm: 80, df: 78, ath: 80 },

    // 2010s 一代核心（含已在 Or 的杜兰特/威少/小卡/字母哥/约基奇）
    'Kevin Durant':      { sh: 97, ins: 88, pm: 82, df: 86, ath: 90 },
    'Russell Westbrook': { sh: 74, ins: 84, pm: 86, df: 82, ath: 96 },
    'Kawhi Leonard':     { sh: 88, ins: 84, pm: 80, df: 97, ath: 86 },
    'Kyrie Irving':      { sh: 90, ins: 86, pm: 90, df: 76, ath: 86 },
    'Paul George':       { sh: 88, ins: 82, pm: 80, df: 90, ath: 86 },
    'Anthony Davis':     { sh: 80, ins: 93, pm: 72, df: 95, ath: 90 },
    'Draymond Green':    { sh: 72, ins: 80, pm: 86, df: 92, ath: 78 },
    'Damian Lillard':    { sh: 92, ins: 80, pm: 88, df: 74, ath: 86 },
    'Klay Thompson':     { sh: 95, ins: 72, pm: 68, df: 82, ath: 80 },
    'Jimmy Butler':      { sh: 84, ins: 84, pm: 82, df: 90, ath: 86 },
    'Khris Middleton':   { sh: 88, ins: 80, pm: 82, df: 82, ath: 80 },
    'Bradley Beal':      { sh: 88, ins: 80, pm: 82, df: 80, ath: 84 },
    'DeAndre Jordan':    { sh: 52, ins: 86, pm: 52, df: 84, ath: 86 },
    'Andre Drummond':    { sh: 58, ins: 88, pm: 60, df: 84, ath: 82 },
    'Brook Lopez':       { sh: 84, ins: 86, pm: 66, df: 86, ath: 76 },
    'Al Horford':        { sh: 84, ins: 84, pm: 78, df: 84, ath: 76 },
    'Giannis Antetokounmpo': { sh: 74, ins: 96, pm: 82, df: 92, ath: 97 },
    'Joel Embiid':       { sh: 88, ins: 95, pm: 76, df: 90, ath: 86 },
    'Nikola Jokić':      { sh: 88, ins: 97, pm: 95, df: 88, ath: 82 },
    'Rudy Gobert':       { sh: 58, ins: 88, pm: 60, df: 96, ath: 82 },
    'Karl-Anthony Towns': { sh: 90, ins: 88, pm: 76, df: 80, ath: 82 },

    // 现役新生代（2018 届起，含已在 Or 的东契奇/SGA/华子/文班）
    'Luka Dončić':       { sh: 90, ins: 84, pm: 95, df: 78, ath: 80 },
    'Shai Gilgeous-Alexander': { sh: 92, ins: 88, pm: 90, df: 90, ath: 88 },
    'Trae Young':        { sh: 90, ins: 72, pm: 92, df: 70, ath: 80 },
    "De'Aaron Fox":      { sh: 84, ins: 80, pm: 86, df: 82, ath: 94 },
    'Jayson Tatum':      { sh: 90, ins: 84, pm: 84, df: 88, ath: 86 },
    'Bam Adebayo':       { sh: 74, ins: 88, pm: 80, df: 90, ath: 86 },
    'Donovan Mitchell':  { sh: 88, ins: 84, pm: 84, df: 80, ath: 90 },
    'Devin Booker':      { sh: 93, ins: 82, pm: 84, df: 78, ath: 84 },
    'Jaylen Brown':      { sh: 86, ins: 86, pm: 78, df: 88, ath: 90 },
    'Jalen Brunson':     { sh: 90, ins: 82, pm: 90, df: 80, ath: 80 },
    'Anthony Edwards':   { sh: 86, ins: 86, pm: 82, df: 84, ath: 93 },
    'Tyrese Haliburton': { sh: 88, ins: 74, pm: 92, df: 78, ath: 82 },
    'Tyrese Maxey':      { sh: 88, ins: 80, pm: 84, df: 78, ath: 90 },
    'LaMelo Ball':       { sh: 84, ins: 78, pm: 88, df: 78, ath: 84 },
    'Zion Williamson':   { sh: 66, ins: 92, pm: 78, df: 80, ath: 94 },
    'Ja Morant':         { sh: 78, ins: 86, pm: 86, df: 78, ath: 94 },
    'Brandon Ingram':    { sh: 86, ins: 82, pm: 80, df: 82, ath: 84 },
    'Zach LaVine':       { sh: 86, ins: 80, pm: 78, df: 78, ath: 90 },
    'Ben Simmons':       { sh: 56, ins: 84, pm: 86, df: 88, ath: 88 },
    'Cade Cunningham':   { sh: 86, ins: 82, pm: 90, df: 84, ath: 84 },
    'Scottie Barnes':    { sh: 78, ins: 84, pm: 82, df: 88, ath: 86 },
    'Franz Wagner':      { sh: 84, ins: 82, pm: 82, df: 84, ath: 84 },
    'Alperen Şengün':    { sh: 78, ins: 88, pm: 80, df: 80, ath: 76 },
    'Domantas Sabonis':  { sh: 78, ins: 90, pm: 84, df: 82, ath: 80 },
    'Pascal Siakam':     { sh: 82, ins: 88, pm: 80, df: 86, ath: 88 },
    'Lauri Markkanen':   { sh: 88, ins: 84, pm: 76, df: 80, ath: 84 },
    'Kristaps Porziņģis': { sh: 86, ins: 88, pm: 72, df: 88, ath: 84 },
    'Nikola Vučević':    { sh: 82, ins: 88, pm: 76, df: 80, ath: 74 },
    'Deni Avdija':       { sh: 80, ins: 82, pm: 80, df: 86, ath: 82 },
    'Victor Wembanyama': { sh: 86, ins: 90, pm: 72, df: 98, ath: 90 },
    'Paolo Banchero':    { sh: 82, ins: 86, pm: 82, df: 80, ath: 84 },
    'Chet Holmgren':     { sh: 84, ins: 84, pm: 74, df: 90, ath: 84 },
    'Jalen Williams':    { sh: 84, ins: 84, pm: 82, df: 84, ath: 86 },
    'Evan Mobley':       { sh: 76, ins: 86, pm: 74, df: 92, ath: 86 },
    'Jalen Johnson':     { sh: 80, ins: 84, pm: 80, df: 86, ath: 88 },
    'Jalen Duren':       { sh: 68, ins: 86, pm: 68, df: 84, ath: 84 },
    'Amen Thompson':     { sh: 68, ins: 82, pm: 80, df: 86, ath: 90 },
    'Derrick White':     { sh: 84, ins: 76, pm: 80, df: 88, ath: 82 },
    'Julius Randle':     { sh: 80, ins: 86, pm: 80, df: 78, ath: 84 },
    'Austin Reaves':     { sh: 86, ins: 78, pm: 82, df: 76, ath: 80 },
    'Jamal Murray':      { sh: 88, ins: 80, pm: 84, df: 80, ath: 84 },
    'Stephon Castle':    { sh: 80, ins: 80, pm: 80, df: 84, ath: 86 },

    // 2025–2026 新秀（权威预期值，参考 NBA2K 新人建模）
    'Cooper Flagg':      { sh: 84, ins: 80, pm: 82, df: 86, ath: 88 },
    'Dylan Harper':      { sh: 82, ins: 80, pm: 82, df: 82, ath: 86 },
    'Kon Knueppel':      { sh: 84, ins: 78, pm: 78, df: 80, ath: 82 },
    'VJ Edgecombe':      { sh: 80, ins: 80, pm: 78, df: 84, ath: 88 },
    'AJ Dybantsa':       { sh: 84, ins: 80, pm: 80, df: 84, ath: 88 },
    'Darryn Peterson':   { sh: 82, ins: 82, pm: 80, df: 82, ath: 86 },
    'Cameron Boozer':    { sh: 82, ins: 84, pm: 78, df: 82, ath: 82 }
  };

  function inject() {
    if (!Array.isArray(window.Or)) return false;
    DRAFT_1984.concat(DRAFT_1996).concat(DRAFT_2003).concat(DRAFT_2009).forEach(function (p) {
      if (!window.Or.some(function (o) { return o.name && o.name.en === p.name.en; })) window.Or.push(p);
    });
    return true;
  }

  // 五维统一入口 my：教练模式(W_/D8)与球员模式现场派生都经过它，
  // 在此一处按名字覆盖权威 TRAITS，表中没有的球员保持内核派生，不重复包装
  function applyTraits(nameEn, five) {
    var t = TRAITS[nameEn];
    if (t) FIVE.forEach(function (k) { five[k] = t[k]; });
    return five;
  }

  function wrap() {
    var orig = window.my;
    if (typeof orig !== 'function' || orig.__mblWrapped) return;
    var wrapped = function () {
      return applyTraits(arguments[0], orig.apply(this, arguments));
    };
    wrapped.__mblWrapped = true;
    window.my = wrapped;
  }

  function init() { inject(); wrap(); }

  // Or 在内核脚本执行后已就绪；脚本加载即初始化，再加一次保险
  init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 300);

  window.MBLRealRosters = { init: init, inject: inject, traits: TRAITS };
})();
