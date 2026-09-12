'use strict';

// Audio is supplied by the host. Text remains available when muted or playback fails.
const COMPANION_DIALOGUE = Object.freeze({
  welcome: { text: '今天一起学点新本领吧！', en: 'Let’s learn something new together!', gesture: 'wave' },
  taskCompleted: {
    text: '我们又完成一个小挑战啦！',
    en: 'We finished another little challenge!',
    gesture: 'jump',
  },
  knowledgeMastered: {
    text: '我学会{topic}啦，谢谢你教我！',
    en: 'I learned {topic}! Thank you for teaching me!',
    gesture: 'nod',
  },
  gameCompleted: {
    text: '谢谢你陪我学习，我们休息一下吧！',
    en: 'Thanks for learning with me. Let’s take a break!',
    gesture: 'dance',
  },
  grown: { text: '看，我又长大一点啦！', en: 'Look, I have grown a little!', gesture: 'stretch' },
  feed: { text: '香香的葵花籽，谢谢你！', en: 'Yummy sunflower seeds! Thank you!', gesture: 'eatSeed' },
  hungry: {
    text: '想吃几颗葵花籽，你愿意喂我吗？',
    en: 'Would you like to share some sunflower seeds?',
    gesture: 'curious',
  },
  dirty: { text: '一起洗个泡泡澡吧！', en: 'Let’s have a bubbly bath!', gesture: 'curious' },
  bath: { text: '洗得干干净净，真舒服！', en: 'All clean! That feels lovely!', gesture: 'bath' },
  scratch: {
    text: '脖子有点痒，可以帮我挠挠吗？',
    en: 'Could you scratch my neck, please?',
    gesture: 'scratch',
  },
  pet: { text: '摸摸好舒服呀！', en: 'That feels so nice!', gesture: 'pet' },
  teach: { text: '今天能教我数数吗？', en: 'Will you teach me to count today?', gesture: 'curious' },
  eyeBreak: {
    text: '我们休息一下，看看远处吧。',
    en: 'Let’s rest and look into the distance.',
    gesture: 'stretch',
  },
  wake: { text: '休息好啦，我们慢慢来！', en: 'I feel rested. Let’s take our time!', gesture: 'stretch' },
  fart: { text: '哎呀，不好意思！', en: 'Oops, excuse me!', gesture: 'fart' },
});

const COMPANION_ACTION_LABELS = Object.freeze({
  nod: '点头',
  sleep: '睡觉',
  stretch: '伸懒腰',
  eatSeed: '吃葵花籽',
  bath: '洗澡',
  scratch: '挠痒痒',
  kiss: '鸟吻',
  preen: '理毛',
  standOneFoot: '单脚站立',
  lookAround: '转眼观察',
  dance: '跳舞',
  flap: '原地扑翅',
  sneeze: '打喷嚏',
  hiccup: '打嗝',
  fart: '害羞小插曲',
  beakWipe: '磨嘴',
});

module.exports = { COMPANION_DIALOGUE, COMPANION_ACTION_LABELS };
