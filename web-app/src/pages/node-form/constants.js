/**
 * 节点表单共用常量（与具体节点 UI 解耦，便于后期按类型拆文件时复用）。
 */

export const SCRIPT_OPERATION_OPTIONS = [
  { value: 'HEX_STRING_TO_DEC_ARRAY', label: 'HEX_STRING_TO_DEC_ARRAY（Hex串->十进制数组）' },
  { value: 'SPLIT', label: 'SPLIT（字符串拆分）' },
  { value: 'JOIN', label: 'JOIN（数组拼接）' },
  { value: 'HEX_ARRAY_TO_DEC', label: 'HEX_ARRAY_TO_DEC（Hex数组->十进制）' },
  { value: 'DEC_ARRAY_TO_HEX', label: 'DEC_ARRAY_TO_HEX（十进制数组->Hex）' },
  { value: 'HEX_TO_DEC', label: 'HEX_TO_DEC（单个Hex->十进制）' },
  { value: 'DEC_TO_HEX', label: 'DEC_TO_HEX（单个十进制->Hex）' },
  { value: 'ARRAY_LENGTH', label: 'ARRAY_LENGTH（长度）' },
  { value: 'ARRAY_SLICE', label: 'ARRAY_SLICE（切片）' },
  { value: 'STRING_TO_HEX', label: 'STRING_TO_HEX（字符串->Hex）' },
  { value: 'HEX_TO_STRING', label: 'HEX_TO_STRING（Hex->字符串）' },
  { value: 'STRIP_PREFIX', label: 'STRIP_PREFIX（去前缀）' },
  { value: 'CONCAT', label: 'CONCAT（拼接）' },
  { value: 'TEMPLATE', label: 'TEMPLATE（模板替换）' },
  { value: 'FORMAT_VALUES', label: 'FORMAT_VALUES（格式化键值串）' },
  { value: 'PARSE_CSV_VALUES', label: 'PARSE_CSV_VALUES（k=v解析）' },
  { value: 'JSON_BUILD', label: 'JSON_BUILD（构建JSON）' },
  { value: 'JSON_PARSE', label: 'JSON_PARSE（解析JSON）' },
  { value: 'JSON_STRINGIFY', label: 'JSON_STRINGIFY（对象转JSON字符串）' },
  { value: 'ROUND', label: 'ROUND（四舍五入）' },
  { value: 'TO_NUMBER', label: 'TO_NUMBER（转数字）' },
  { value: 'TO_STRING', label: 'TO_STRING（转字符串）' },
  { value: 'SUBSTRING', label: 'SUBSTRING（截取子串）' },
  { value: 'REPLACE', label: 'REPLACE（字符串替换）' },
];

export const CONDITION_OPERATOR_OPTIONS = [
  { value: '>', label: '大于 (>)' },
  { value: '>=', label: '大于等于 (>=)' },
  { value: '<', label: '小于 (<)' },
  { value: '<=', label: '小于等于 (<=)' },
  { value: '==', label: '等于 (==)' },
  { value: '!=', label: '不等于 (!=)' },
  { value: 'contains', label: '包含' },
  { value: 'starts_with', label: '匹配前缀' },
  { value: 'ends_with', label: '匹配后缀' },
  { value: 'is_empty', label: '变量为空' },
  { value: 'not_empty', label: '变量不为空' },
  { value: 'array_length_eq', label: '数组长度 = 指定值' },
  { value: 'array_length_gt', label: '数组长度 > 指定值' },
  { value: 'array_length_gte', label: '数组长度 >= 指定值' },
  { value: 'array_length_lt', label: '数组长度 < 指定值' },
  { value: 'array_length_lte', label: '数组长度 <= 指定值' },
];

export const CONDITION_ARRAY_LENGTH_OPS = [
  'array_length_eq',
  'array_length_gt',
  'array_length_gte',
  'array_length_lt',
  'array_length_lte',
];

export const CONDITION_UNARY_OPS = ['is_empty', 'not_empty', 'is_null', 'not_null'];
