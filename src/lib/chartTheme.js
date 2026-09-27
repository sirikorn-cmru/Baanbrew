import { useTheme } from './theme'

// สีของกราฟแยกตามธีม — สีเส้น/แท่งผ่านการตรวจความต่างสีกับพื้นการ์ดของแต่ละธีมแล้ว
// (light: amber-700 บน white, dark: amber-600 บน stone-900)
const THEMES = {
  light: {
    series: '#b45309', // amber-700
    grid: '#e7e5e4', // stone-200
    axisText: '#78716c', // stone-500
    labelText: '#44403c', // stone-700
    cursor: '#a8a29e', // stone-400
    barCursor: '#f5f5f4', // stone-100
    surface: '#ffffff', // ใช้เป็นวงรอบจุด hover
  },
  dark: {
    series: '#d97706', // amber-600
    grid: '#292524', // stone-800
    axisText: '#a8a29e', // stone-400
    labelText: '#d6d3d1', // stone-300
    cursor: '#57534e', // stone-600
    barCursor: '#292524', // stone-800
    surface: '#1c1917', // stone-900
  },
}

// สีแยกสาขา (categorical) — ลำดับตายตัว ผ่านการตรวจแยกสีได้ทั้งตาบอดสีและตาปกติ ทั้งสองธีม
// สาขาได้สีตามลำดับในรายชื่อสาขาทั้งหมด (ไม่ใช่ลำดับหลังกรอง) สีจึงไม่เปลี่ยนเมื่อกรองสาขาออก
// light: สี aqua / yellow / magenta ตัดกับพื้นขาวต่ำกว่า 3:1 จึงต้องมี legend + ตาราง ไว้อ่านค่าเสมอ
const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}
const OTHER_COLOR = { light: '#a8a29e', dark: '#78716c' } // สาขาที่ 9 ขึ้นไป — ห้ามสร้างสีใหม่วนซ้ำ

export const categoricalColor = (resolved, index) =>
  CATEGORICAL[resolved]?.[index] ?? OTHER_COLOR[resolved] ?? OTHER_COLOR.light

export const CONTEXT_OPACITY = 0.3 // เส้นรองที่เป็นพื้นหลัง (เช่น ยอดรายวันใต้ค่าเฉลี่ย)

export const getChartTheme = (resolved) => THEMES[resolved] ?? THEMES.light

// สีกราฟของธีมที่ใช้อยู่ — เปลี่ยนธีมแล้วกราฟวาดใหม่ด้วยสีชุดใหม่
export const useChartTheme = () => {
  const { resolved } = useTheme()
  return { ...getChartTheme(resolved), categorical: (index) => categoricalColor(resolved, index) }
}
