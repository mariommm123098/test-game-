/*
 * 剧情数据层：未来新增章节时，优先在这里添加内容。
 * 界面与交互逻辑位于 game.js，不需要把对白写进 HTML。
 */
window.STORY = Object.freeze({
  meta: {
    title: "我们都没有说谎",
    prologue: "雨停之前",
    location: "临江市",
    time: "23:47"
  },

  prologue: [
    {
      type: "narration",
      text: "雨已经下了三个小时。",
      pauseBefore: 900,
      effect: "ground"
    },
    {
      type: "narration",
      text: "他们也已经沉默了很久。",
      pauseBefore: 800,
      effect: "reveal"
    },
    {
      type: "dialogue",
      speaker: "林栀",
      text: "“你今天来，是想让我留下，还是想证明我错了？”",
      pauseBefore: 700,
      afterHold: 1100,
      effect: "lin"
    },
    {
      type: "action",
      text: "周屿没有立刻回答。他的目光落在她手边的行李箱上。",
      pauseBefore: 1400,
      effect: "luggage"
    },
    {
      type: "dialogue",
      speaker: "周屿",
      text: "“我只想知道，我到底有没有资格知道你的人生。”",
      pauseBefore: 1000,
      afterHold: 700,
      effect: "zhou"
    },
    {
      type: "action",
      text: "林栀沉默。她收紧手指，低下头，像是在等一句迟到很久的话。",
      pauseBefore: 900,
      effect: "luggage"
    },
    {
      type: "dialogue",
      speaker: "林栀",
      text: "“我没有骗过你。”",
      pauseBefore: 800,
      afterHold: 800,
      effect: "lin"
    },
    {
      type: "action",
      text: "周屿看着她。",
      pauseBefore: 750,
      effect: "zhou"
    },
    {
      type: "dialogue",
      speaker: "周屿",
      text: "“可你也从来没有把真相给我。”",
      pauseBefore: 900,
      afterHold: 1200,
      effect: "train"
    }
  ],

  perspectives: {
    zhou: {
      id: "zhou",
      name: "周屿",
      remembered: "这是他记得的故事。",
      fragments: [
        "三通没有接通的电话。",
        "一场被取消的周年约会。",
        "一张前往南川的车票。",
        "一个所有人都比他更早知道的决定。"
      ],
      thought: "“我只是害怕，她早就决定离开，而我仍然以为一切都很好。”",
      visualLabel: "UNANSWERED / 03"
    },
    lin: {
      id: "lin",
      name: "林栀",
      remembered: "这是她记得的故事。",
      fragments: [
        "一张没有告诉他的病历。",
        "一笔无法独自承担的治疗费。",
        "一个她不敢让他放弃的机会。",
        "一次她以为能够减少伤害的离开。"
      ],
      thought: "“我只是害怕，他留下以后，终有一天会后悔爱过我。”",
      visualLabel: "ARCHIVE / SEALED"
    }
  },

  intertitles: {
    before: {
      main: "二百一十六天前"
    },
    chapterOne: {
      eyebrow: "第一章",
      main: "我们开始的地方",
      sub: "敬请期待"
    }
  },

  // 未来系统的预留结构。当前序章不会读取这些空数组。
  future: {
    chapters: [],
    endings: [],
    unsentMessages: [],
    saveSlots: []
  }
});
