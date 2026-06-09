// ---- Condition operators ----

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'operators.equals' },
  { value: 'not_equals', label: 'operators.not_equals' },
  { value: 'greater_than', label: 'operators.greater_than' },
  { value: 'less_than', label: 'operators.less_than' },
  { value: 'greater_than_or_equal', label: 'operators.greater_than_or_equal' },
  { value: 'less_than_or_equal', label: 'operators.less_than_or_equal' },
  { value: 'contains', label: 'operators.contains' },
  { value: 'not_contains', label: 'operators.not_contains' },
  { value: 'starts_with', label: 'operators.starts_with' },
  { value: 'ends_with', label: 'operators.ends_with' },
  { value: 'is_empty', label: 'operators.is_empty' },
  { value: 'is_not_empty', label: 'operators.is_not_empty' },
  { value: 'is_true', label: 'operators.is_true' },
  { value: 'is_false', label: 'operators.is_false' },
] as const;

export const NO_VALUE_OPERATORS = new Set(['is_empty', 'is_not_empty', 'is_true', 'is_false']);

// ---- Default code template ----

export const RUN_CODE_DEFAULT_CODE = `// 在这里，您可以通过 'params' 获取节点中的输入变量，并通过 'ret' 输出结果
// 'params' 已经被正确地注入到环境中
// 下面是一个示例，获取节点输入中参数名为 'input' 的值：
// const input = params.input
// 下面是一个示例，输出一个包含多种数据类型的 'ret' 对象：
// const ret = { "name": '小明', "hobbies": ["看书", "旅游"] }

async function main({ params }) {
  const ret = {
    "key0": params.input + params.input,
    "key1": ["hello", "world"],
    "key2": {
      "key21": "hi",
    },
  }

  return ret
}`;
