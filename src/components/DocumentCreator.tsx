import { useState, useEffect, useMemo } from 'react'
import { getAllProjects } from '../store/db'
import type { Project } from '../types'

// ========== 类型定义 ==========
interface FormField {
  key: string
  label: string
  type: 'text' | 'date' | 'select' | 'textarea' | 'number' | 'calc'
  options?: string[]
  required?: boolean
  autoFill?: keyof Project | 'today'
  calcFormula?: string   // 计算公式说明
}

interface Template {
  id: string
  category: string
  name: string
  icon: string
  description: string
  gbRef?: string          // 国标引用
  supportBatch?: boolean  // 支持批量生成
  supportCalc?: boolean   // 支持智能计算
  fields: FormField[]
}

// ========== 抽样计算规则 (GB 50300) ==========
function calcSampleRate(batchSize: number): { rate: number; minCount: number } {
  if (batchSize <= 15) return { rate: 1, minCount: batchSize }
  if (batchSize <= 25) return { rate: 1, minCount: 15 }
  if (batchSize <= 90) return { rate: 1, minCount: 20 }
  if (batchSize <= 150) return { rate: 1, minCount: 32 }
  if (batchSize <= 280) return { rate: 1, minCount: 50 }
  if (batchSize <= 500) return { rate: 1, minCount: 80 }
  if (batchSize <= 1200) return { rate: 0.8, minCount: Math.ceil(1200 * 0.8) }
  return { rate: 0.5, minCount: Math.ceil(batchSize * 0.5) }
}

// 混凝土强度评定 (GB/T 50107)
function calcConcreteStrength(values: number[], designStrength: number): { avg: number; min: number; stddev: number; qualified: boolean } {
  if (values.length < 3) return { avg: 0, min: 0, stddev: 0, qualified: false }
  const n = values.length
  const avg = values.reduce((a, b) => a + b, 0) / n
  const min = Math.min(...values)
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1)
  const stddev = Math.sqrt(variance)
  // 统计方法评定 (n >= 10)
  const λ1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.70, 1.65, 1.60, 1.55, 1.50][n] || 1.50
  const λ2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.90, 0.85, 0.85, 0.85, 0.85][n] || 0.85
  const qualified = n >= 10
    ? avg - λ1 * stddev >= 0.9 * designStrength && min >= λ2 * designStrength
    : avg >= 1.15 * designStrength && min >= 0.95 * designStrength
  return { avg: +avg.toFixed(1), min: +min.toFixed(1), stddev: +stddev.toFixed(2), qualified }
}

// ========== 全部模板（恒智天成风格） ==========
const TEMPLATES: Template[] = [
  // ---- 质量验收 ----
  {
    id: 'inspection_batch', category: '质量验收', icon: '✅',
    name: '检验批质量验收记录',
    description: 'GB 50300 各分项工程检验批质量验收',
    gbRef: 'GB 50300-2013',
    supportBatch: true, supportCalc: true,
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'subProject', label: '分项工程名称', type: 'text', required: true },
      { key: 'inspectionBatch', label: '检验批部位', type: 'text', required: true },
      { key: 'batchSize', label: '检验批容量', type: 'number', required: true },
      { key: 'sampleCount', label: '抽样数量', type: 'calc', calcFormula: '根据容量自动计算（GB 50300）' },
      { key: 'acceptanceStandard', label: '验收依据', type: 'textarea', required: true },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'projectManager', label: '项目负责人', type: 'text', autoFill: 'manager' },
      { key: 'inspectionDate', label: '检验日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'hidden_works', category: '质量验收', icon: '👁️',
    name: '隐蔽工程验收记录',
    description: '隐蔽工程施工质量验收记录表',
    gbRef: 'GB 50300-2013',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'hiddenPart', label: '隐蔽部位', type: 'text', required: true },
      { key: 'hiddenContent', label: '隐蔽内容', type: 'textarea', required: true },
      { key: 'inspectionResult', label: '检查结果', type: 'textarea', required: true },
      { key: 'acceptanceOpinion', label: '验收意见', type: 'textarea' },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'supervisorUnit', label: '监理单位', type: 'text', autoFill: 'supervisor' },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'sub_item_acceptance', category: '质量验收', icon: '📊',
    name: '分项工程质量验收记录',
    description: '分项工程质量验收标准表格',
    gbRef: 'GB 50300-2013',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'subItemName', label: '分项工程名称', type: 'text', required: true },
      { key: 'batchCount', label: '检验批数', type: 'number', required: true },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'projectManager', label: '项目负责人', type: 'text', autoFill: 'manager' },
      { key: 'supervisorUnit', label: '监理单位', type: 'text', autoFill: 'supervisor' },
      { key: 'acceptanceOpinion', label: '验收结论', type: 'textarea' },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'section_acceptance', category: '质量验收', icon: '🏢',
    name: '分部工程质量验收记录',
    description: '分部（子分部）工程质量验收',
    gbRef: 'GB 50300-2013',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'sectionName', label: '分部工程名称', type: 'text', required: true },
      { key: 'subItemCount', label: '分项工程数量', type: 'number', required: true },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'projectManager', label: '项目负责人', type: 'text', autoFill: 'manager' },
      { key: 'designUnit', label: '设计单位', type: 'text', autoFill: 'designUnit' },
      { key: 'supervisorUnit', label: '监理单位', type: 'text', autoFill: 'supervisor' },
      { key: 'acceptanceOpinion', label: '综合验收结论', type: 'textarea' },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'unit_acceptance', category: '质量验收', icon: '🏛️',
    name: '单位工程竣工验收记录',
    description: '单位工程质量竣工验收记录',
    gbRef: 'GB 50300-2013',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'structureType', label: '结构类型', type: 'text', autoFill: 'structureType' },
      { key: 'buildingArea', label: '建筑面积（m²）', type: 'text', autoFill: 'buildingArea' },
      { key: 'floorCount', label: '层数', type: 'text', autoFill: 'floorCount' },
      { key: 'developer', label: '建设单位', type: 'text', autoFill: 'developer' },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'designUnit', label: '设计单位', type: 'text', autoFill: 'designUnit' },
      { key: 'supervisorUnit', label: '监理单位', type: 'text', autoFill: 'supervisor' },
      { key: 'startDate', label: '开工日期', type: 'date', autoFill: 'startDate' },
      { key: 'endDate', label: '竣工日期', type: 'date', autoFill: 'endDate' },
      { key: 'acceptanceOpinion', label: '竣工验收结论', type: 'textarea' },
    ],
  },
  // ---- 混凝土/钢筋 ----
  {
    id: 'concrete_construction', category: '混凝土工程', icon: '🧱',
    name: '混凝土施工记录',
    description: '混凝土浇筑施工全过程记录',
    gbRef: 'GB 50204-2015',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'pourLocation', label: '浇筑部位', type: 'text', required: true },
      { key: 'strengthGrade', label: '混凝土强度等级', type: 'select', options: ['C15','C20','C25','C30','C35','C40','C45','C50','C55','C60'], required: true },
      { key: 'pourVolume', label: '浇筑方量（m³）', type: 'number', required: true },
      { key: 'slump', label: '坍落度（mm）', type: 'text' },
      { key: 'mixRatio', label: '配合比编号', type: 'text' },
      { key: 'pourMethod', label: '浇筑方式', type: 'select', options: ['泵送', '塔吊', '自卸'] },
      { key: 'pourDate', label: '浇筑日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'rebar_hidden', category: '混凝土工程', icon: '🔩',
    name: '钢筋隐蔽工程验收记录',
    description: '钢筋绑扎安装隐蔽验收',
    gbRef: 'GB 50204-2015',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'rebarLocation', label: '钢筋部位', type: 'text', required: true },
      { key: 'rebarSpec', label: '钢筋规格', type: 'text', required: true },
      { key: 'spacingDesign', label: '设计间距（mm）', type: 'text' },
      { key: 'spacingActual', label: '实测间距（mm）', type: 'text' },
      { key: 'coverThickness', label: '保护层厚度（mm）', type: 'text' },
      { key: 'jointMethod', label: '连接方式', type: 'select', options: ['绑扎搭接', '机械连接', '焊接'] },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  // ---- 砌体/防水/装饰 ----
  {
    id: 'masonry_acceptance', category: '砌体/防水', icon: '🧱',
    name: '砌体工程质量验收记录',
    description: '砌体结构工程质量验收',
    gbRef: 'GB 50203-2011',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'masonryLocation', label: '砌筑部位', type: 'text', required: true },
      { key: 'blockType', label: '砌块类型', type: 'select', options: ['烧结普通砖', '多孔砖', '加气混凝土砌块', '混凝土小型空心砌块'], required: true },
      { key: 'mortarGrade', label: '砂浆强度等级', type: 'select', options: ['M5','M7.5','M10','M15','M20'] },
      { key: 'masonryMethod', label: '砌筑方法', type: 'select', options: ['三一砌筑法', '铺浆法'] },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'waterproof_acceptance', category: '砌体/防水', icon: '💧',
    name: '防水工程质量验收记录',
    description: '屋面/地下室/厨卫防水验收',
    gbRef: 'GB 50208-2011',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'waterproofLocation', label: '防水部位', type: 'text', required: true },
      { key: 'waterproofMaterial', label: '防水材料', type: 'text', required: true },
      { key: 'waterproofMethod', label: '防水做法', type: 'textarea', required: true },
      { key: 'testMethod', label: '试验方法', type: 'select', options: ['蓄水试验', '淋水试验'] },
      { key: 'testDuration', label: '试验时间（h）', type: 'number' },
      { key: 'acceptanceDate', label: '验收日期', type: 'date', autoFill: 'today' },
    ],
  },
  // ---- 地基基础 ----
  {
    id: 'foundation_trench', category: '地基基础', icon: '🏗️',
    name: '地基验槽记录',
    description: '基槽开挖质量检查记录',
    gbRef: 'GB 50202-2018',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'trenchLocation', label: '验槽部位', type: 'text', required: true },
      { key: 'designElevation', label: '设计标高（m）', type: 'text' },
      { key: 'actualElevation', label: '实测标高（m）', type: 'text' },
      { key: 'soilType', label: '土质情况', type: 'textarea', required: true },
      { key: 'groundwater', label: '地下水情况', type: 'textarea' },
      { key: 'acceptanceOpinion', label: '验槽结论', type: 'textarea' },
      { key: 'acceptanceDate', label: '验槽日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'pile_foundation', category: '地基基础', icon: '⛏️',
    name: '桩基施工记录',
    description: '桩基础施工全过程记录',
    gbRef: 'JGJ 94-2008',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'pileNo', label: '桩号', type: 'text', required: true },
      { key: 'pileType', label: '桩型', type: 'select', options: ['灌注桩', '预制桩', '管桩', 'CFG桩'] },
      { key: 'pileDiameter', label: '桩径（mm）', type: 'number' },
      { key: 'pileDepth', label: '桩长（m）', type: 'number' },
      { key: 'designCapacity', label: '设计承载力（kN）', type: 'number' },
      { key: 'constructionDate', label: '施工日期', type: 'date', autoFill: 'today' },
    ],
  },
  // ---- 材料管理 ----
  {
    id: 'material_approval', category: '材料管理', icon: '📦',
    name: '工程材料报审表',
    description: '进场材料/构配件报验申请表',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'materialName', label: '材料名称', type: 'text', required: true },
      { key: 'materialSpec', label: '规格型号', type: 'text', required: true },
      { key: 'quantity', label: '数量', type: 'text', required: true },
      { key: 'manufacturer', label: '生产厂家', type: 'text' },
      { key: 'certificateNo', label: '合格证编号', type: 'text' },
      { key: 'inspectionReport', label: '检测报告编号', type: 'text' },
      { key: 'submitDate', label: '报审日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'material_equipment_approval', category: '材料管理', icon: '🏗️',
    name: '材料设备报审表',
    description: '材料与设备进场报审验收记录',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'subProject', label: '分项工程名称', type: 'text', required: true },
      { key: 'useLocation', label: '使用部位', type: 'text', required: true },
      { key: 'itemName', label: '材料/设备名称', type: 'text', required: true },
      { key: 'itemSpec', label: '规格型号', type: 'text', required: true },
      { key: 'entryQuantity', label: '进场数量', type: 'text', required: true },
      { key: 'manufacturer', label: '生产厂家', type: 'text' },
      { key: 'certificateNo', label: '合格证编号', type: 'text' },
      { key: 'reportNo', label: '检测报告编号', type: 'text' },
      { key: 'contractor', label: '施工单位', type: 'text', autoFill: 'contractor' },
      { key: 'projectManager', label: '项目负责人', type: 'text', autoFill: 'manager' },
      { key: 'supervisorUnit', label: '监理单位', type: 'text', autoFill: 'supervisor' },
      { key: 'reviewOpinion', label: '审查意见', type: 'textarea' },
      { key: 'submitDate', label: '报审日期', type: 'date', autoFill: 'today' },
      { key: 'reviewDate', label: '审查日期', type: 'date' },
    ],
  },
  {
    id: 'witness_sampling', category: '材料管理', icon: '🧪',
    name: '见证取样记录',
    description: '见证取样送检记录表',
    gbRef: 'GB/T 50344-2019',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'sampleName', label: '样品名称', type: 'text', required: true },
      { key: 'sampleSpec', label: '规格/等级', type: 'text', required: true },
      { key: 'sampleLocation', label: '取样部位', type: 'text', required: true },
      { key: 'sampleDate', label: '取样日期', type: 'date', autoFill: 'today' },
      { key: 'witnessPerson', label: '见证人', type: 'text', required: true },
      { key: 'sampler', label: '取样人', type: 'text', required: true },
      { key: 'testItem', label: '检测项目', type: 'textarea', required: true },
    ],
  },
  // ---- 施工管理 ----
  {
    id: 'construction_log', category: '施工管理', icon: '📓',
    name: '施工日志',
    description: '每日施工情况记录',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'logDate', label: '日期', type: 'date', required: true, autoFill: 'today' },
      { key: 'weather', label: '天气', type: 'select', options: ['晴', '阴', '雨', '雪', '多云'] },
      { key: 'temperature', label: '气温（℃）', type: 'text' },
      { key: 'workContent', label: '施工内容', type: 'textarea', required: true },
      { key: 'workerCount', label: '施工人数', type: 'number' },
      { key: 'materialUsage', label: '材料使用情况', type: 'textarea' },
      { key: 'equipmentUsage', label: '机械使用情况', type: 'textarea' },
      { key: 'qualitySafety', label: '质量安全情况', type: 'textarea' },
      { key: 'recorder', label: '记录人', type: 'text', required: true },
    ],
  },
  {
    id: 'technical_disclosure', category: '施工管理', icon: '📋',
    name: '技术交底记录',
    description: '分项工程技术交底',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'subProject', label: '分项工程名称', type: 'text', required: true },
      { key: 'disclosureContent', label: '交底内容', type: 'textarea', required: true },
      { key: 'acceptor', label: '接受交底人', type: 'text', required: true },
      { key: 'discloser', label: '交底人', type: 'text', required: true },
      { key: 'disclosureDate', label: '交底日期', type: 'date', autoFill: 'today' },
    ],
  },
  // ---- 测量记录 ----
  {
    id: 'survey_record', category: '测量记录', icon: '📐',
    name: '工程定位测量记录',
    description: '工程定位/放线测量记录',
    gbRef: 'GB 50026-2020',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'measureType', label: '测量类型', type: 'select', options: ['定位测量', '放线测量', '标高测量', '沉降观测'] },
      { key: 'measureLocation', label: '测量部位', type: 'text', required: true },
      { key: 'instrument', label: '使用仪器', type: 'select', options: ['全站仪', '水准仪', 'GPS', '经纬仪'] },
      { key: 'measureResult', label: '测量结果', type: 'textarea', required: true },
      { key: 'surveyor', label: '测量员', type: 'text' },
      { key: 'measureDate', label: '测量日期', type: 'date', autoFill: 'today' },
    ],
  },
  // ---- 机电安装 ----
  {
    id: 'electrical_test', category: '机电安装', icon: '⚡',
    name: '电气绝缘电阻测试记录',
    description: '电气线路绝缘电阻测试',
    gbRef: 'GB 50303-2015',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'circuitName', label: '回路名称', type: 'text', required: true },
      { key: 'voltageLevel', label: '电压等级（V）', type: 'select', options: ['220', '380'] },
      { key: 'insulationValue', label: '绝缘电阻值（MΩ）', type: 'number', required: true },
      { key: 'testInstrument', label: '测试仪表', type: 'text' },
      { key: 'testDate', label: '测试日期', type: 'date', autoFill: 'today' },
    ],
  },
  {
    id: 'pipeline_pressure', category: '机电安装', icon: '🔧',
    name: '管道压力试验记录',
    description: '给排水/暖通管道压力试验',
    gbRef: 'GB 50242-2002',
    fields: [
      { key: 'projectName', label: '工程名称', type: 'text', required: true, autoFill: 'name' },
      { key: 'pipelineSystem', label: '管道系统', type: 'select', options: ['给水', '排水', '消防', '暖通', '燃气'] },
      { key: 'testPressure', label: '试验压力（MPa）', type: 'number', required: true },
      { key: 'duration', label: '稳压时间（min）', type: 'number' },
      { key: 'pressureDrop', label: '压力降（MPa）', type: 'number' },
      { key: 'testResult', label: '试验结论', type: 'select', options: ['合格', '不合格'] },
      { key: 'testDate', label: '试验日期', type: 'date', autoFill: 'today' },
    ],
  },
]

// ========== 分部→分项工程划分标准数据 ==========
const WORK_BREAKDOWN: Record<string, string[]> = {
  '地基与基础': ['土方开挖', '土方回填', '砂和砂石地基', '灰土地基', '桩基', '混凝土基础', '砌体基础', '防水混凝土', '卷材防水层'],
  '主体结构': ['模板', '钢筋', '混凝土', '现浇结构', '砌体结构', '钢结构焊接', '钢结构紧固件连接', '钢结构安装'],
  '建筑装饰装修': ['抹灰', '门窗', '吊顶', '饰面砖', '幕墙', '涂饰', '细部'],
  '建筑屋面': ['找平层', '保温层', '防水层', '细部构造'],
  '建筑给排水': ['给水管道', '排水管道', '卫生器具', '消火栓系统', '喷淋系统'],
  '建筑电气': ['电线导管敷设', '电缆桥架安装', '配电箱安装', '灯具安装', '防雷接地', '等电位联结'],
  '通风与空调': ['风管制作', '风管安装', '风机安装', '空调水系统'],
  '电梯': ['导轨安装', '轿厢安装', '电气装置', '安全装置'],
}

// ========== 主组件 ==========
export default function DocumentCreator() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [generated, setGenerated] = useState(false)
  const [viewMode, setViewMode] = useState<'templates' | 'tree' | 'batch' | 'concrete'>('templates')

  // 批量生成
  const [batchConfig, setBatchConfig] = useState({
    templateId: '',
    section: '',
    subItem: '',
    startFloor: 1,
    endFloor: 5,
    prefix: '',
  })
  const [batchResults, setBatchResults] = useState<Record<string, string>[]>([])

  // 混凝土试块
  const [cubeRecords, setCubeRecords] = useState<{ id: string; location: string; grade: string; age: string; date: string; strength: number; qualified: boolean }[]>([])
  const [cubeForm, setCubeForm] = useState({ location: '', grade: 'C30', age: '28', date: new Date().toISOString().slice(0, 10), strength: 0 })

  // 智能计算
  const [calcResult, setCalcResult] = useState('')
  const [strengthValues, setStrengthValues] = useState('')
  const [strengthDesign, setStrengthDesign] = useState(30)
  const [strengthResult, setStrengthResult] = useState<ReturnType<typeof calcConcreteStrength> | null>(null)

  useEffect(() => {
    getAllProjects().then(setProjects)
  }, [])

  const currentProject = projects.find((p) => p.id === selectedProject)

  function selectTemplate(tpl: Template) {
    setSelectedTemplate(tpl)
    setGenerated(false)
    setCalcResult('')
    const auto: Record<string, string> = {}
    for (const f of tpl.fields) {
      if (f.autoFill === 'today') auto[f.key] = new Date().toISOString().slice(0, 10)
      else if (f.autoFill && currentProject) auto[f.key] = String(currentProject[f.autoFill] || '')
    }
    setFormData(auto)
  }

  function updateField(key: string, value: string) {
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      // 智能计算抽样数量
      if (key === 'batchSize' && selectedTemplate?.id === 'inspection_batch') {
        const batchSize = parseInt(value) || 0
        if (batchSize > 0) {
          const { minCount } = calcSampleRate(batchSize)
          next.sampleCount = String(minCount)
          setCalcResult(`检验批容量 ${batchSize} → 最小抽样数量：${minCount}（GB 50300 全数检查）`)
        }
      }
      return next
    })
  }

  function handleGenerate() {
    setGenerated(true)
  }

  function handlePrint() { window.print() }

  // 批量生成
  function handleBatchGenerate() {
    const tpl = TEMPLATES.find((t) => t.id === batchConfig.templateId)
    if (!tpl) return
    const results: Record<string, string>[] = []
    for (let floor = batchConfig.startFloor; floor <= batchConfig.endFloor; floor++) {
      const batchName = `${batchConfig.prefix || ''}${floor}F${batchConfig.subItem ? ' - ' + batchConfig.subItem : ''}`
      const record: Record<string, string> = {}
      for (const f of tpl.fields) {
        if (f.autoFill === 'today') record[f.key] = new Date().toISOString().slice(0, 10)
        else if (f.autoFill && currentProject) record[f.key] = String(currentProject[f.autoFill] || '')
        else if (f.key === 'inspectionBatch' || f.key === 'subProject') record[f.key] = batchName
        else record[f.key] = ''
      }
      results.push(record)
    }
    setBatchResults(results)
  }

  // 混凝土试块
  function addCubeRecord() {
    if (!cubeForm.location || !cubeForm.strength) return
    const id = crypto.randomUUID()
    const qualified = cubeForm.strength >= (parseInt(cubeForm.grade.slice(1)) || 30)
    setCubeRecords((prev) => [
      { ...cubeForm, id, qualified },
      ...prev,
    ])
    setCubeForm({ location: '', grade: 'C30', age: '28', date: new Date().toISOString().slice(0, 10), strength: 0 })
  }
  function deleteCubeRecord(id: string) {
    setCubeRecords((prev) => prev.filter((r) => r.id !== id))
  }

  // 强度评定
  function handleStrengthCalc() {
    const vals = strengthValues.split(/[,，\s]+/).map(Number).filter((n) => !isNaN(n))
    if (vals.length < 3) { setStrengthResult(null); return }
    setStrengthResult(calcConcreteStrength(vals, strengthDesign))
  }

  const categories = [...new Set(TEMPLATES.map((t) => t.category))]

  // ========== 批量生成视图 ==========
  if (viewMode === 'batch') {
    const batchTemplates = TEMPLATES.filter((t) => t.supportBatch)
    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setViewMode('templates')}>←</button>
            <h2>批量生成检验批</h2>
          </div>
        </div>
        <div className="page-content">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3>生成配置</h3></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>模板</label>
                  <select value={batchConfig.templateId} onChange={(e) => setBatchConfig({ ...batchConfig, templateId: e.target.value })}>
                    <option value="">选择模板</option>
                    {batchTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>分部工程</label>
                  <select value={batchConfig.section} onChange={(e) => setBatchConfig({ ...batchConfig, section: e.target.value })}>
                    <option value="">选择分部</option>
                    {Object.keys(WORK_BREAKDOWN).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>分项工程</label>
                  <select value={batchConfig.subItem} onChange={(e) => setBatchConfig({ ...batchConfig, subItem: e.target.value })}>
                    <option value="">选择分项</option>
                    {(WORK_BREAKDOWN[batchConfig.section] || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>前缀</label>
                  <input value={batchConfig.prefix} onChange={(e) => setBatchConfig({ ...batchConfig, prefix: e.target.value })} placeholder="如：XX层" />
                </div>
                <div className="form-group">
                  <label>起始楼层</label>
                  <input type="number" value={batchConfig.startFloor} onChange={(e) => setBatchConfig({ ...batchConfig, startFloor: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label>结束楼层</label>
                  <input type="number" value={batchConfig.endFloor} onChange={(e) => setBatchConfig({ ...batchConfig, endFloor: +e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <button className="btn btn-primary" onClick={handleBatchGenerate} disabled={!batchConfig.templateId}>
                  批量生成（{batchConfig.endFloor - batchConfig.startFloor + 1} 份）
                </button>
              </div>
            </div>
          </div>

          {batchResults.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>生成结果（{batchResults.length} 份）</h3>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ 批量打印</button>
              </div>
              <div className="card-body print-area">
                {batchResults.map((record, i) => (
                  <div key={i} style={{
                    border: '1px solid #333', padding: 20, marginBottom: 16,
                    fontFamily: '"SimSun", "宋体", serif', fontSize: 13,
                  }}>
                    <h3 style={{ textAlign: 'center', fontSize: 16, marginBottom: 16 }}>检验批质量验收记录</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {Object.entries(record).map(([k, v]) => {
                          const f = TEMPLATES.find((t) => t.id === batchConfig.templateId)?.fields.find((ff) => ff.key === k)
                          return f ? (
                            <tr key={k}>
                              <td style={{ border: '1px solid #333', padding: '4px 8px', background: '#f5f5f5', fontWeight: 600, width: 130 }}>{f.label}</td>
                              <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{v || '—'}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // ========== 混凝土试块台账视图 ==========
  if (viewMode === 'concrete') {
    const gradeStats = cubeRecords.reduce((acc, r) => {
      if (!acc[r.grade]) acc[r.grade] = { count: 0, qualified: 0, total: 0 }
      acc[r.grade].count++
      acc[r.grade].qualified += r.qualified ? 1 : 0
      acc[r.grade].total += r.strength
      return acc
    }, {} as Record<string, { count: number; qualified: number; total: number }>)

    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setViewMode('templates')}>←</button>
            <h2>混凝土试块台账</h2>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ 打印</button>
        </div>
        <div className="page-content">
          {/* 添加试块 */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3>添加试块记录</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ minWidth: 120 }}>
                  <label>浇筑部位</label>
                  <input value={cubeForm.location} onChange={(e) => setCubeForm({ ...cubeForm, location: e.target.value })} placeholder="部位" />
                </div>
                <div className="form-group" style={{ minWidth: 100 }}>
                  <label>强度等级</label>
                  <select value={cubeForm.grade} onChange={(e) => setCubeForm({ ...cubeForm, grade: e.target.value })}>
                    {['C15','C20','C25','C30','C35','C40','C45','C50','C55','C60'].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ minWidth: 100 }}>
                  <label>龄期（天）</label>
                  <select value={cubeForm.age} onChange={(e) => setCubeForm({ ...cubeForm, age: e.target.value })}>
                    {['7','14','28','56','60','90'].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ minWidth: 130 }}>
                  <label>试验日期</label>
                  <input type="date" value={cubeForm.date} onChange={(e) => setCubeForm({ ...cubeForm, date: e.target.value })} />
                </div>
                <div className="form-group" style={{ minWidth: 120 }}>
                  <label>强度值（MPa）</label>
                  <input type="number" value={cubeForm.strength || ''} onChange={(e) => setCubeForm({ ...cubeForm, strength: +e.target.value })} />
                </div>
                <button className="btn btn-primary" style={{ height: 38 }} onClick={addCubeRecord}>添加</button>
              </div>
            </div>
          </div>

          {/* 统计 */}
          {Object.keys(gradeStats).length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><h3>强度统计</h3></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {Object.entries(gradeStats).map(([g, s]) => (
                    <div key={g} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 10, minWidth: 140 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{g}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        共 {s.count} 组 | 合格率 {s.count > 0 ? Math.round((s.qualified / s.count) * 100) : 0}%
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        平均 {s.count > 0 ? (s.total / s.count).toFixed(1) : '-'} MPa
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 试块列表 */}
          <div className="card">
            <div className="card-header"><h3>试块记录（共 {cubeRecords.length} 组）</h3></div>
            <div className="card-body">
              {cubeRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🧪</div>
                  <h3>暂无试块记录</h3>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={th}>编号</th>
                      <th style={th}>浇筑部位</th>
                      <th style={th}>等级</th>
                      <th style={th}>龄期</th>
                      <th style={th}>试验日期</th>
                      <th style={th}>强度 (MPa)</th>
                      <th style={th}>结果</th>
                      <th style={th}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cubeRecords.map((r, i) => (
                      <tr key={r.id}>
                        <td style={td}>{cubeRecords.length - i}</td>
                        <td style={td}>{r.location}</td>
                        <td style={td}>{r.grade}</td>
                        <td style={td}>{r.age}d</td>
                        <td style={td}>{r.date}</td>
                        <td style={td}>{r.strength}</td>
                        <td style={td}>
                          <span className={`badge ${r.qualified ? 'badge-green' : 'badge-red'}`}>
                            {r.qualified ? '合格' : '不合格'}
                          </span>
                        </td>
                        <td style={td}>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteCubeRecord(r.id)}>删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 强度评定计算器 */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header"><h3>混凝土强度评定（GB/T 50107）</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ minWidth: 120 }}>
                  <label>设计强度等级</label>
                  <select value={strengthDesign} onChange={(e) => setStrengthDesign(+e.target.value)}>
                    {[15,20,25,30,35,40,45,50,55,60].map((s) => <option key={s} value={s}>C{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 250 }}>
                  <label>强度值（逗号分隔）</label>
                  <input value={strengthValues} onChange={(e) => setStrengthValues(e.target.value)} placeholder="如：35.2, 36.1, 34.8, 37.0, 35.5" />
                </div>
                <button className="btn btn-primary" style={{ height: 38 }} onClick={handleStrengthCalc}>评定</button>
              </div>
              {strengthResult && (
                <div style={{ marginTop: 16, padding: 16, background: strengthResult.qualified ? '#f0fdf4' : '#fef2f2', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div><span style={{ color: 'var(--text-light)' }}>平均值：</span><strong>{strengthResult.avg} MPa</strong></div>
                    <div><span style={{ color: 'var(--text-light)' }}>最小值：</span><strong>{strengthResult.min} MPa</strong></div>
                    <div><span style={{ color: 'var(--text-light)' }}>标准差：</span><strong>{strengthResult.stddev}</strong></div>
                    <div>
                      <span style={{ color: 'var(--text-light)' }}>评定结论：</span>
                      <span className={`badge ${strengthResult.qualified ? 'badge-green' : 'badge-red'}`}>
                        {strengthResult.qualified ? '合格' : '不合格'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ========== 资料目录树视图 ==========
  if (viewMode === 'tree') {
    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setViewMode('templates')}>←</button>
            <h2>资料目录树</h2>
          </div>
        </div>
        <div className="page-content">
          {Object.entries(WORK_BREAKDOWN).map(([section, subItems]) => (
            <div key={section} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ background: '#f8fafc', cursor: 'pointer' }}>
                <h3>📂 {section}</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {subItems.map((item) => (
                    <div key={item} style={{
                      padding: '6px 14px', borderRadius: 100, background: 'var(--primary-bg)',
                      fontSize: 13, fontWeight: 500, color: 'var(--primary)', cursor: 'pointer',
                    }}
                      onClick={() => {
                        setBatchConfig({
                          templateId: 'inspection_batch',
                          section,
                          subItem: item,
                          startFloor: 1,
                          endFloor: 5,
                          prefix: '',
                        })
                        setViewMode('batch')
                      }}
                    >
                      📄 {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  // ========== 生成结果视图 ==========
  if (selectedTemplate && generated) {
    return (
      <div className="print-area">
        <div className="page-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setGenerated(false)} style={{ fontSize: 18 }}>←</button>
            <h2>{selectedTemplate.name}</h2>
          </div>
          <div className="page-header-actions no-print">
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ 打印</button>
          </div>
        </div>
        <div className="page-content">
          <div style={{
            maxWidth: 800, margin: '0 auto', background: '#fff',
            padding: '40px 48px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            fontFamily: '"SimSun", "宋体", serif',
          }}>
            <h2 style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 8, fontFamily: '"SimHei","黑体",sans-serif' }}>
              {selectedTemplate.name}
            </h2>
            {selectedTemplate.gbRef && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginBottom: 20 }}>依据标准：{selectedTemplate.gbRef}</p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {selectedTemplate.fields.map((f) => (
                  <tr key={f.key}>
                    <td style={{ padding: '8px 12px', border: '1px solid #333', background: '#f5f5f5', fontWeight: 600, width: 140, fontSize: 13 }}>
                      {f.label}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #333', minWidth: 160 }}>
                      {formData[f.key] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ marginBottom: 32 }}>施工单位：</div>
                <div>项目负责人：</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ marginBottom: 32 }}>监理单位：</div>
                <div>监理工程师：</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div>
                  日期：{formData.inspectionDate || formData.acceptanceDate || formData.logDate || formData.disclosureDate || formData.submitDate || formData.testDate || '____年__月__日'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========== 表单填写视图 ==========
  if (selectedTemplate) {
    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={() => setSelectedTemplate(null)} style={{ fontSize: 18 }}>←</button>
            <h2>{selectedTemplate.name}</h2>
            {selectedTemplate.gbRef && <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{selectedTemplate.gbRef}</span>}
          </div>
        </div>
        <div className="page-content">
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="card">
              <div className="card-header"><h3>填写表单</h3></div>
              <div className="card-body">
                <div className="form-grid">
                  {selectedTemplate.fields.map((f) => (
                    <div key={f.key} className={`form-group${f.type === 'textarea' || f.type === 'calc' ? ' full-width' : ''}`}>
                      <label>
                        {f.label}
                        {f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                        {f.calcFormula && <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 6 }}>（{f.calcFormula}）</span>}
                      </label>
                      {f.type === 'calc' ? (
                        <input value={formData[f.key] || ''} readOnly style={{ background: '#f8fafc', color: 'var(--primary)', fontWeight: 600 }} placeholder="自动计算" />
                      ) : f.type === 'textarea' ? (
                        <textarea value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} rows={3} placeholder={f.label} />
                      ) : f.type === 'select' ? (
                        <select value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)}>
                          <option value="">请选择</option>
                          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'date' ? (
                        <input type="date" value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} />
                      ) : (
                        <input type={f.type} value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} placeholder={f.label} />
                      )}
                    </div>
                  ))}
                </div>
                {calcResult && (
                  <div style={{ marginTop: 12, padding: '8px 14px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: 'var(--primary)' }}>
                    {calcResult}
                  </div>
                )}
                <div style={{ marginTop: 20, textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={handleGenerate}
                    disabled={selectedTemplate.fields.some((f) => f.required && !formData[f.key])}>
                    生成资料
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ========== 主页模板列表 ==========
  return (
    <>
      <div className="page-header">
        <h2>资料编制</h2>
      </div>

      <div className="page-content">
        {/* 快捷入口 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { mode: 'templates' as const, icon: '📝', label: '模板编制', desc: '选择模板填写资料' },
            { mode: 'tree' as const, icon: '📂', label: '资料目录树', desc: '按分部→分项→检验批管理' },
            { mode: 'batch' as const, icon: '🔄', label: '批量生成', desc: '按楼层/部位批量生成检验批' },
            { mode: 'concrete' as const, icon: '🧪', label: '混凝土试块台账', desc: '试块强度记录与评定' },
          ].map((item) => (
            <div
              key={item.mode}
              className="card"
              style={{
                flex: '1 1 200px', cursor: viewMode === item.mode ? 'default' : 'pointer',
                border: viewMode === item.mode ? '2px solid var(--primary)' : undefined,
              }}
              onClick={() => setViewMode(item.mode)}
            >
              <div className="card-body" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Project selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>选择项目</h3></div>
          <div className="card-body">
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ maxWidth: 400 }}>
              <option value="">请选择要编制资料的项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {currentProject && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                当前项目：{currentProject.name} | 阶段：{currentProject.currentPhase} | 负责人：{currentProject.manager || '未设置'}
              </div>
            )}
          </div>
        </div>

        {/* Template list */}
        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>{cat}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {TEMPLATES.filter((t) => t.category === cat).map((tpl) => (
                <div key={tpl.id} className="card"
                  style={{ cursor: selectedProject ? 'pointer' : 'not-allowed', opacity: selectedProject ? 1 : 0.5 }}
                  onClick={() => { if (!selectedProject) { alert('请先选择项目'); return } selectTemplate(tpl) }}
                >
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {tpl.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{tpl.name}</span>
                          {tpl.supportBatch && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#e8f5e9', color: '#059669' }}>批量</span>}
                          {tpl.supportCalc && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#2563eb' }}>计算</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{tpl.description}</div>
                        {tpl.gbRef && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{tpl.gbRef}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

const th: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', fontSize: 13 }
