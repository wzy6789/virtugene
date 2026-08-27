/**
 * Edge 音色 → 本地专属 sid 池（自动生成，勿手改）：
 * 每个音色独占 3~4 个本地音色编号，保证不同性格词的离线声音互不相同；
 * 生成脚本：scripts/gen-voice-sid-map.cjs
 */
export const VOICE_SID_MAP: Record<string, number[]> = {
  'zh-CN-XiaoxiaoNeural': [3,5,9,12],
  'zh-CN-XiaoyiNeural': [157,31,33,89],
  'zh-CN-XiaoyouNeural': [105,0,11,22],
  'zh-CN-XiaohanNeural': [17,26,28,44],
  'zh-CN-XiaoxuanNeural': [6,147,37,47],
  'zh-CN-XiaomengNeural': [67,49,8,108],
  'zh-CN-XiaoruiNeural': [63,34,73,106],
  'zh-CN-XiaomoNeural': [159,131,109,51],
  'zh-CN-XiaoguiNeural': [39,55,62,64],
  'zh-CN-XiaozhenNeural': [50,92,154],
  'zh-CN-YunxiNeural': [78,146,137,128],
  'zh-CN-YunyangNeural': [2,7,10,16],
  'zh-CN-YunjianNeural': [124,119,29,69],
  'zh-CN-YunxiaNeural': [4,13,14,18],
  'zh-CN-YunhaoNeural': [100,75,59,145],
  'zh-CN-YunfengNeural': [65,156,48,25],
  'zh-CN-YunzeNeural': [20,21,23,32],
  'zh-CN-YunfanNeural': [41,115,114,120],
};
